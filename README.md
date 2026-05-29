# att — Asana Time Tracker

![att](/img/att.png)

*Read this in [日本語](README_ja.md).*

CLI that makes **Asana the single source of truth** for billable hours, with a weekly summary you can copy-paste into SFDC and Google Spreadsheet.

Each customer is an Asana Project; each work session becomes a `time_tracking_entry` on a task inside that Project. Designed for workflows where you log your own work and roll it up into reports as needed.

Requires Asana **Business or Enterprise** plan (native Time Tracking is gated).

## Install

```bash
npm install -g @shukawam/asana-time-tracker
att --help
```

Requires Node.js ≥ 20.

> **From source (contributors)**: `git clone https://github.com/shukawam/asana-time-tracker && cd asana-time-tracker && npm install && npm link`. `npm install` runs `prepare` automatically, which builds `dist/` — so `npm link` finds the executable. The dev loop itself uses `tsx` and doesn't need a rebuild on every edit; see [Development](#development).

## Setup

1. Create a Personal Access Token at <https://app.asana.com/0/my-apps>.
2. Run:

   ```bash
   att init
   ```

   You'll be prompted for the PAT (or set `ASANA_PAT` in the environment), the value to emit in the CSV **Kong Resource** column (e.g. `Field Engineer` — leave blank to omit), and then short aliases for each customer project (e.g. `acme` → "ACME Corp").

Config lives at `~/.config/att/config.json` (file mode 0600, dir mode 0700). If `ASANA_PAT` is set in the environment, `att init` will *delete* any previously-persisted PAT from the file so env precedence behaves as documented.

## Daily logging

```bash
# Pattern A — new ad-hoc task in a customer project
att log 1.5 acme "kickoff meeting"

# Pattern B — log against an existing Asana task by URL or GID
att log 0.5 --task https://app.asana.com/0/1234.../5678... --comment "follow-up"

# Pattern C — pick from your recent tasks in that project (fuzzy select)
att log 1 acme:recent

# Backdate
att log 2 beta "design review" --date 2026-05-27
```

Each `att log` creates a `time_tracking_entry` on a task. The task's "Actual time" field updates automatically and is visible in the standard Asana UI.

## Inspecting / fixing entries

```bash
att list                  # today
att list --week           # current week
att list --date 2026-05-27

att edit <entry-gid> --hours 0.75
att rm   <entry-gid> [<entry-gid> ...]   # multiple GIDs OK; shows a preview before deleting

att recent --customer acme --days 21
```

The `entry-gid` is shown in `att list` output. `att edit` and `att rm` are self-only: if a given GID isn't owned by you, `att` refuses to touch it (the Asana web UI is the path for anything else). This is a guardrail against typos with shared workspace PATs.

## Weekly export (Friday flow)

```bash
att summary --week                                  # Markdown — paste anywhere
att summary --last-week --format md
att summary --week --customer acme --format csv     # per-customer sheet (see below)
att summary --week --format sfdc                    # Sun→Sat per-day TSV for the SFDC Time Entry grid
```

**Markdown** (`--format md`, default): Customer × Day matrix (decimal hours), per-task breakdown, and a "SFDC entries (1h rounded)" section.

**CSV** (`--format csv`): per-entry rows shaped for a customer reporting sheet:

| Date | Kong Resource | Activity Details | Hours Consumed |
|---|---|---|---|
| 2026/5/27 | Field Engineer | 定例会準備 | 1 |
| 2026/5/27 | Field Engineer | 定例会 | 1 |

Each Asana time entry becomes one row. **`--customer <alias>` is required** for this format — the destination sheet is per-customer, so without it `att` errors out rather than dump every customer's hours into the wrong tab. Entries that round to 0h are dropped; date is `YYYY/M/D`, hours are `Math.round(min/60)`, and **Kong Resource** is the static `config.kongResource` value (set during `att init`, blank if unset) — same string on every row.

**SFDC** (`--format sfdc`): paste-ready TSV laid out to match SFDC's Time Entry grid — one row per project, 7 day columns **Sun→Sat**, integer hours per cell. Anchored to a Sunday-based week (the SFDC grid's orientation), not the Mon→Sun week the other formats use; `--last-week` shifts to the prior Sun→Sat. Select the project rows in the terminal and paste starting at the SUN cell of the corresponding row in SFDC.

```
Week ending 2026-05-23 (Sat)

Beta	0	1	0	2	0	1	0
ACME	0	0	0	2	0	0	0
```

Suggested Friday cadence:
1. `att summary --week --format sfdc` → SFDC.
2. For each customer: `att summary --week --customer <alias> --format csv` → the team Spreadsheet's customer tab.

## Customer aliases

```bash
att projects             # list aliases + total actual_time per project
att projects add         # pick an Asana project and register a new alias (interactive)
att projects rm <alias> [<alias> ...]  # unregister one or more aliases (Asana projects untouched)
```

`att projects add` opens an interactive picker over your workspace's projects — no need to dig the Project GID out of Asana's URL. `att init` registers aliases too, but rerunning it makes you re-confirm PAT/workspace; `add` skips straight to the picker.

## Kong Resource column

The CSV's **Kong Resource** column is filled with a single static string from `config.kongResource` (e.g. `Field Engineer`) — same value on every row. Set it during `att init`, or hand-edit `~/.config/att/config.json`. Leave it blank to emit an empty column.

> Note: an earlier design routed this through native Asana **Time Tracking Categories** (per-entry granularity). That API was not enabled in the target workspace, so the role/category surface was removed in favor of this simpler per-config-static approach.

## Using from Claude Code

`att` is designed to be invoked from Claude Code's Bash tool. Typical prompts:

> 「直近のClaude Codeセッション、ACMEの設計レビューに2.5時間使った。記録して」 → Claude runs `att log 2.5 acme "design review"`
> 「今週分のサマリ出して、SFDC形式で」 → Claude runs `att summary --week --format sfdc`

### Optional: install the bundled `/att` skill

The repo ships a [Claude Code Skill](skills/att/SKILL.md) that makes Claude better at translating natural-language work descriptions into `att log` commands (preview-then-confirm flow, multi-entry batching, ambiguity detection). Install once and use it from any working directory:

```bash
att install-skill     # symlinks the bundled SKILL.md → ~/.claude/skills/att/SKILL.md
```

Then in Claude Code, either say `/att` or just describe the work — e.g. 「今 1.5h ACME のキックオフやってた、記録して」. Restart Claude Code if it's already running so it picks up the skill. Uninstall with `rm ~/.claude/skills/att/SKILL.md`. The symlink points back at the installed package, so `npm update -g @shukawam/asana-time-tracker` (or `git pull` for source installs) also updates the skill.

## Development

```bash
npm test              # vitest
npm run typecheck     # tsc --noEmit
npm run att -- ...    # run CLI in dev (tsx — no build step needed)
npm run build         # compile to dist/ (for publish; runs automatically via prepublishOnly)
npm pack --dry-run    # preview what would be published
```

### Known issues

- The official `asana` SDK transitively pulls in deprecated packages (`superagent`, `formidable`, `glob@7`, `inflight`). Today they only surface as `npm install` deprecation notices, not as `npm audit --omit=dev` findings, but they will eventually need upstream attention. Tracking: <https://github.com/Asana/node-asana>.

## Roadmap (intentionally NOT in MVP)

- Google Calendar event → `att log` import
- Google Sheets API direct write
- SFDC API direct write
- MCP server wrapper for richer Claude Code integration
