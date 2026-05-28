---
name: att
description: Log billable hours into Asana via the `att` CLI. Use when the user wants to record time, mentions hours/duration for a customer or task, says things like "log my time", "track time", "今の2時間記録して", "ACMEに1.5h", or otherwise describes recent work in a way that implies they want to bill for it. Translates natural-language descriptions into one or more `att log` invocations after confirming with the user.
---

# att — log billable hours into Asana

This skill helps you (Claude) translate a natural-language description of work into one or more `att log` invocations. It does NOT handle weekly summaries, list/edit, or any destructive operation — those are direct Bash calls.

## When to use

- User says they worked on something and wants it tracked: "今 2 時間 ACME と打ち合わせしてた", "log 1h kickoff for beta", "30分ずつ ACME と Beta に分けて".
- User explicitly invokes `/att` or says "att log".
- User pastes an Asana task URL and says "record N hours on this".

## When NOT to use

- User asks for a weekly summary → call `att summary --week [--customer <alias>] --format <md|csv|sfdc>` directly.
- User asks "what did I log today/this week" → call `att list [--today|--week|--date YYYY-MM-DD]` directly.
- User asks to delete or edit entries → call `att rm` / `att edit` directly. **Never** auto-invoke these from inside this skill — they are destructive.
- User asks to add/remove a customer or role → call `att projects add` / `att roles add` directly.

## Workflow

### 1. Discovery (once per Claude Code session)

Before composing any `att log` command for the first time in a session, run:

```bash
att projects     # registered customer aliases (left column)
att roles        # registered role aliases + which is the default (marked with *)
```

Cache these in memory for the rest of the session. If `att` isn't on PATH, tell the user to run `npm link` in their `asana-time-tracker` checkout, or `npm install -g`.

### 2. Argument extraction

| User phrase | Maps to |
|---|---|
| "2時間" / "1.5h" / "30分" / "quarter hour" | first positional arg, normalized to nearest 0.25 (e.g. 30分 → `0.5`) |
| Customer name ("ACME", "いすゞ", "Beta Inc.") | match against `att projects` output; pick the alias |
| Description of work ("kickoff", "設計レビュー") | third positional arg — quote it |
| "同じやつ" / "さっきの定例" / "the task I was on" | use `<alias>:recent` and let the user pick from the fuzzy list |
| An Asana task URL or bare GID in the message | use `--task <url-or-gid>` instead of an alias |
| "FE として" / "Engagement Managerで" | `--role <alias>` (match against `att roles`) |
| (role not mentioned) | omit `--role` — the CLI uses the default |
| "昨日" / "先週金曜" / explicit YYYY-MM-DD | `--date YYYY-MM-DD` (resolve relative dates against today's date in the conversation context) |
| (date not mentioned) | omit `--date` — defaults to today |

If any of these are ambiguous (e.g. user said "ACMEっぽいやつ" or the customer name doesn't match any alias), **ask before composing the command** — do not guess.

### 3. Confirm before executing

Always preview the planned command(s) and get a yes/ok before running. Use a compact format:

```
About to log:
  1. 1.5h ACME Corp — "kickoff meeting"  role=fe  date=today
  2. 0.5h Beta Inc — pick from recent     role=em  date=today
Proceed? [y/N]
```

For a single entry, one line is fine. For multiple, bullet them. Wait for explicit confirmation before any Bash call.

### 4. Execute

Run each `att log` as a separate Bash call. Examples:

```bash
# Pattern B: new task in a customer project
att log 1.5 acme "kickoff meeting"

# Pattern A: existing task via URL
att log 0.5 --task https://app.asana.com/0/1234.../5678... --comment "follow-up"

# Pattern C: fuzzy-pick from recent tasks (this is interactive — the user picks)
att log 1 acme:recent

# Role override
att log 1 acme:recent --role em

# Backdated
att log 2 beta "design review" --date 2026-05-27
```

After execution, report the result (att prints a ✓ line with the Asana URL). If att exits non-zero, surface the error verbatim and propose a fix rather than retrying blindly.

## Common patterns (memorize these examples)

| Said | Run |
|---|---|
| 「今 1 時間 ACME のキックオフやった、記録して」 | `att log 1 acme "キックオフ"` |
| 「ACME のさっきの定例に追加で 30 分」 | `att log 0.5 acme:recent` (interactive pick) |
| 「Beta に 2h 設計レビュー、EMロールで」 | `att log 2 beta "設計レビュー" --role em` |
| 「<asana-url> に 1h」 | `att log 1 --task <asana-url>` |
| 「昨日の分: ACME に 1.5h、Beta に 1h」 | two separate `att log` calls, both with `--date <yesterday>` |
| 「今週まだ何も記録してない、まとめてやって」 | DO NOT auto-fabricate. Ask the user for the breakdown first. |

## Edge cases

- **Unknown customer alias**: list available aliases from `att projects` and ask which one.
- **No default role + no `--role`**: `att log` will refuse with a clear error. Either ask the user for the role, or suggest `att roles set-default <alias>`.
- **Role not registered**: do NOT auto-create it. Tell the user to run `att roles add <alias> "<display name>"`.
- **PAT missing / Asana auth error**: tell the user to run `att init` (full setup).
- **att not installed**: see the Discovery section.

## What this skill must NOT do

- Never call `att rm`, `att edit`, `att projects rm`, `att roles rm`, or any other destructive op — even if the user asks. Defer to direct Bash invocation by the user (or by Claude outside this skill).
- Never auto-create customer aliases or roles. Always defer to `att projects add` / `att roles add`.
- Never fabricate hours, dates, or task names that weren't given. If the description is too vague, ask.
- Never invoke this skill recursively for sub-tasks — once you're in the log workflow, finish it.
