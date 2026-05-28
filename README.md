# att — Asana Time Tracker

![att](/img/att.png)

*Read this in [日本語](README_ja.md).*

CLI that makes **Asana the single source of truth** for billable hours, with a weekly summary you can copy-paste into SFDC and Google Spreadsheet.

Each customer is an Asana Project; each work session becomes a `time_tracking_entry` on a task inside that Project. Designed for workflows where you log your own work and roll it up into reports as needed.

Requires Asana **Business or Enterprise** plan (native Time Tracking is gated).

## Install

```bash
git clone <this repo> ~/work/asana-time-tracker
cd ~/work/asana-time-tracker
npm install
npm link        # exposes the `att` command globally
att --help
```

## Setup

1. Create a Personal Access Token at <https://app.asana.com/0/my-apps>.
2. Run:

   ```bash
   att init
   ```

   You'll be prompted for the PAT (or set `ASANA_PAT` in the environment), then asked to register short aliases for each customer project (e.g. `acme` → "ACME Corp").

3. Register the roles you bill as (these become the **Kong Resource** column in the per-customer CSV sheet, and are stored as native Asana Time Tracking Categories):

   ```bash
   att roles add fe "Field Engineer"
   att roles add em "Engagement Manager"
   att roles set-default fe
   ```

Config lives at `~/.config/att/config.json` (mode 600).

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

# Override the default role for this one entry
att log 1 acme:recent --role em
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

The `entry-gid` is shown in `att list` output.

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
| 2026/5/27 | Engagement Manager | 定例会準備 | 1 |
| 2026/5/27 | Field Engineer | 定例会 | 1 |

Each Asana time entry becomes one row. **Use `--customer <alias>` to filter** — the destination sheet is per-customer, and entries that round to 0h are dropped. Date is `YYYY/M/D`, hours are `Math.round(min/60)`, and Kong Resource comes from the entry's role.

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

## Roles (Kong Resource column)

```bash
att roles                              # list aliases + show which is default
att roles add fe "Field Engineer"      # creates the Asana Time Tracking Category if needed
att roles set-default fe               # used when `att log` is invoked without --role
att roles rm <alias> [<alias> ...]     # alias removed from config; Asana category untouched
```

Roles are stored as native **Asana Time Tracking Categories**, so they round-trip via the Asana UI and any third-party reporting on the same workspace.

## Using from Claude Code

`att` is designed to be invoked from Claude Code's Bash tool. Typical prompts:

> 「直近のClaude Codeセッション、ACMEの設計レビューに2.5時間使った。記録して」 → Claude runs `att log 2.5 acme "design review"`
> 「今週分のサマリ出して、SFDC形式で」 → Claude runs `att summary --week --format sfdc`

### Optional: install the bundled `/att` skill

The repo ships a [Claude Code Skill](skills/att/SKILL.md) that makes Claude better at translating natural-language work descriptions into `att log` commands (preview-then-confirm flow, multi-entry batching, ambiguity detection). Install once and use it from any working directory:

```bash
npm run install-skill     # symlinks skills/att/SKILL.md → ~/.claude/skills/att/SKILL.md
```

Then in Claude Code, either say `/att` or just describe the work — e.g. 「今 1.5h ACME のキックオフやってた、記録して」. Restart Claude Code if it's already running so it picks up the skill. Uninstall with `rm ~/.claude/skills/att/SKILL.md`. The symlink means `git pull` in this repo also updates the installed skill.

## Development

```bash
npm test              # vitest
npm run typecheck     # tsc --noEmit
npm run att -- ...    # run CLI in dev (no global link needed)
```

### Known issues

- The official `asana` SDK pulls in old `superagent`/`formidable` transitive dependencies that npm flags as vulnerable. They affect server-side HTTP parsing, not the read-only PAT auth flow used here. Upstream tracking: <https://github.com/Asana/node-asana>.

## Roadmap (intentionally NOT in MVP)

- Google Calendar event → `att log` import
- Google Sheets API direct write
- SFDC API direct write
- MCP server wrapper for richer Claude Code integration
