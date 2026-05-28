# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run att -- <args>` — run the CLI in dev (no global link needed). Example: `npm run att -- log 1 acme "test"`. The `--` is required so flags reach the CLI rather than npm.
- `npm test` — run the full vitest suite once.
- `npm run test:watch` — vitest in watch mode.
- `npx vitest run tests/aggregate.test.ts -t "ignores entries outside the week"` — run a single test by file + name pattern.
- `npm run typecheck` — `tsc --noEmit` for type-only check (no build artifacts).
- `npm link` then `att <args>` — exposes the global `att` binary (the `bin/att.mjs` shim re-runs `src/bin/att.ts` through `tsx`, so source edits take effect without a build step).

There is no compile step in normal use — `tsx` runs TypeScript directly. `dist/` is configured in `tsconfig.json` for typecheck output organization only.

A Claude Code Skill is bundled at `skills/att/SKILL.md`; users opt in via `npm run install-skill` (creates `~/.claude/skills/att/SKILL.md` as a symlink). The skill itself is intentionally scoped to `att log` only — summary/list/edit/rm are invoked directly through Bash.

## Architecture

### Layered structure

```
src/bin/att.ts          ← commander CLI entry, wires commands and centralizes error printing
   ↓
src/commands/*.ts       ← one file per subcommand; reads config, builds APIs, formats output
   ↓
src/asana/*.ts          ← thin wrappers over the official `asana` SDK; one file per resource
src/summary/*.ts        ← pure aggregation and formatting (no IO) — kept testable in isolation
src/util/*.ts           ← date math (Monday-based weeks), URL→GID parser, fuzzy picker
   ↓
src/config.ts           ← read/write ~/.config/att/config.json (mode 600); PAT comes from
                          ASANA_PAT env var first, then config file
```

### Customer alias management

`att init`, `att projects add`, and `att projects rm <alias>` all manipulate the same `customerAliases` map in config. The interactive picker (project select → alias input) is shared via `src/commands/aliasInteractive.ts`'s `runAliasAddLoop` — `init` runs it as part of full setup, `projects add` runs it standalone. Don't duplicate the picker logic; extend `aliasInteractive.ts` and let both call sites pick it up.

### Load-bearing assumptions

- **Asana Business or Enterprise plan**. The whole tool depends on the Time Tracking Entries API (`/tasks/{gid}/time_tracking_entries`), which is gated to those tiers. Do not introduce features that assume Free/Premium.
- **Customer = Asana Project**. One Asana Project per customer. `config.json` stores a `customerAliases` map of short slug → `{ projectGid, name }`. Don't bake in alternative shapes like portfolio-of-customers without coordinating with the user.
- **The user is the only actor.** All queries are filtered by `userGid` (their own entries). There is no multi-user reporting path.

### The Asana SDK is CommonJS — import accordingly

The `asana` npm package is auto-generated CommonJS. From the ESM TypeScript in `src/`, the working pattern is:

```ts
import * as Asana from "asana";
const client = (Asana as any).ApiClient.instance;
client.authentications["token"].accessToken = pat;   // PAT goes on "token", not "personalAccessToken"
const tasks = new (Asana as any).TasksApi();
```

`src/asana/client.ts` caches the API objects after first auth. The SDK returns either `{ data, response }`-shaped objects or paginated `Collection` objects depending on the call; `unwrapData()` and `collectAll()` in `client.ts` handle both.

### Roles (Kong Resource) — stored as Asana Time Tracking Categories

The "Kong Resource" column in the per-customer CSV sheet (e.g. "Field Engineer", "Engagement Manager") is **per-time-entry**, not per-task: the same Asana task can have entries logged under different roles. Asana's only native, per-entry attribute that fits this is **Time Tracking Category** (`time_tracking_category` on a `time_tracking_entry`, Enterprise+ feature). Do not encode role as a task-name prefix or a tag — that loses the per-entry granularity and fragments tasks.

`att roles add <alias> "<display>"` looks up or creates the named Time Tracking Category in the workspace and stores `{ name, categoryGid }` under `config.roles[alias]`. `defaultRole` in config is the fallback when `att log` is called without `--role`. The CSV reads the role back from `entry.time_tracking_category.name`.

### Time entries — the data model

Each `att log` writes one `time_tracking_entry` (duration_minutes + entered_on) to a task. Two input modes converge to the same end state:

- **Pattern A** (`--task <url|gid>`): just create the entry on the existing task.
- **Pattern B** (`<alias> "description"`): create a new task in the customer project, then create the entry. The task is assigned to the user.
- **Pattern C** (`<alias>:recent`): fuzzy-pick from the user's recently modified tasks in that project, then Pattern A.

The weekly summary is **one** API call: `listTimeEntriesForUserInRange()` queries `time_tracking_entries` filtered by `workspace + user + entered_on_start_date/end_date`. No per-task iteration is needed. The rollup (`src/summary/aggregate.ts`) groups by `task.projects[0]` to bucket into customers.

### Week semantics

Weeks are **Monday-based, local time** by default (see `src/util/date.ts`). `weekRange(date)` returns 7 ISO dates Mon→Sun for the week containing `date`; `lastWeekRange()` shifts that back by 7 days. The **sfdc** format is the lone exception: it uses `sundayWeekRange` / `lastSundayWeekRange` (Sun→Sat) to align with the SFDC Time Entry grid — only the `summary` command switches anchors based on `--format`, nothing else in the codebase should depend on Sunday-based weeks. Tests pin specific calendar dates (e.g. 2026-05-27 Wed) to verify the math — preserve that approach when touching date logic, and don't switch to UTC without changing the test fixtures.

### Output formats

`att summary --format <md|csv|sfdc>`:

- **md** is built from `WeekRollup` over a Mon→Sun week.
- **sfdc** is also a `WeekRollup`, but anchored to a **Sun→Sat** week (`sundayWeekRange` / `lastSundayWeekRange` in `src/util/date.ts`) so the columns line up with the SFDC Time Entry grid. Emits one paste-ready TSV row per project: `<name>\t<sun>\t<mon>\t…\t<sat>`. Per-day cells are rounded to whole hours to match SFDC's hourly granularity.
- **csv** is **per-entry**, not aggregated — one row per `time_tracking_entry`, columns `Date / Kong Resource / Activity Details / Hours Consumed`. Date is `YYYY/M/D`, hours are `Math.round(min/60)`, and entries that round to 0 are dropped. This shape is fixed by the user's customer reporting sheet template; don't restructure it.
- `--customer <alias>` filters entries to one customer before formatting. The CSV format is meaningless without this filter (the destination sheet is per-customer).

If you add a new format, decide upfront whether it's aggregated (use rollup) or per-entry (use entries directly) — they have different shapes.

## Auth and config

- PAT precedence: `process.env.ASANA_PAT` → `config.asanaPat` (in `~/.config/att/config.json`). `att init` will persist the PAT to config only when `ASANA_PAT` is not set in the environment at save time — this keeps env-driven setups from accidentally writing tokens to disk.
- The config file is written with mode 600.

## What's intentionally NOT here (don't add without asking)

The plan deliberately scopes these out of MVP:
- Google Calendar → att log import
- Google Sheets API direct write
- SFDC API direct write (output is copy-paste-only)
- MCP server wrapper

If a future task drifts toward one of these, surface it to the user before implementing.
