#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "../commands/init.js";
import { projectsCommand } from "../commands/projects.js";
import { projectsAddCommand } from "../commands/projectsAdd.js";
import { projectsRmCommand } from "../commands/projectsRm.js";
import { logCommand } from "../commands/log.js";
import { recentCommand } from "../commands/recent.js";
import { listCommand } from "../commands/list.js";
import { editCommand } from "../commands/edit.js";
import { rmCommand } from "../commands/rm.js";
import { summaryCommand } from "../commands/summary.js";
import { rolesCommand, rolesSetDefaultCommand } from "../commands/roles.js";
import { rolesAddCommand } from "../commands/rolesAdd.js";
import { rolesRmCommand } from "../commands/rolesRm.js";

const program = new Command();
program
  .name("att")
  .description("Asana Time Tracker — record billable hours into Asana as the single source of truth")
  .version("0.1.0");

program
  .command("init")
  .description("Set up Asana PAT, workspace, and customer project aliases")
  .action(runAsync(initCommand));

const projects = program
  .command("projects")
  .description("List or manage customer project aliases")
  .action(runAsync(projectsCommand));

projects
  .command("add")
  .description("Pick an Asana project and register a short alias for it (interactive)")
  .action(runAsync(projectsAddCommand));

projects
  .command("rm")
  .description("Remove one or more registered aliases (Asana projects are untouched)")
  .argument("<aliases...>", "aliases to remove (space-separated)")
  .option("-y, --yes", "skip confirmation")
  .action(runAsync((aliases: string[], opts) => projectsRmCommand(aliases, opts)));

program
  .command("recent")
  .description("Show your recently modified Asana tasks (useful for finding what to log against)")
  .option("--customer <alias>", "limit to a specific customer alias")
  .option("--days <n>", "lookback window in days (default 14)")
  .action(runAsync((opts) => recentCommand(opts)));

program
  .command("list")
  .description("List your own time entries for today/this week/a specific date")
  .option("--today", "today only (default)")
  .option("--week", "current Monday-Sunday week")
  .option("--date <yyyy-mm-dd>", "specific date")
  .action(runAsync((opts) => listCommand(opts)));

program
  .command("edit")
  .description("Edit a time entry (find its gid via `att list`)")
  .argument("<entry-gid>", "time tracking entry GID")
  .option("--hours <n>", "new hours")
  .option("--date <yyyy-mm-dd>", "new date")
  .action(runAsync((gid: string, opts) => editCommand(gid, opts)));

program
  .command("rm")
  .description("Delete one or more time entries")
  .argument("<entry-gids...>", "time tracking entry GIDs (space-separated)")
  .option("-y, --yes", "skip confirmation")
  .action(runAsync((gids: string[], opts) => rmCommand(gids, opts)));

program
  .command("summary")
  .description("Aggregate this week's (or last week's) time entries for SFDC/Spreadsheet copy-paste")
  .option("--week", "current Monday-Sunday week (default)")
  .option("--last-week", "previous Monday-Sunday week")
  .option("--customer <alias>", "filter to a single customer (required for per-customer CSV sheets)")
  .option("--format <md|csv|sfdc>", "output format (default md)", "md")
  .action(runAsync((opts) => summaryCommand(opts)));

const roles = program
  .command("roles")
  .description("List or manage role aliases (mapped to Asana Time Tracking Categories)")
  .action(runAsync(rolesCommand));

roles
  .command("add")
  .description("Register a role alias (creates the underlying Asana Time Tracking Category if missing)")
  .argument("<alias>", "short alias used on the command line (e.g. fe)")
  .argument("<displayName>", 'display name as it appears in the CSV (e.g. "Field Engineer")')
  .action(runAsync((alias: string, name: string) => rolesAddCommand(alias, name)));

roles
  .command("rm")
  .description("Remove one or more role aliases (Asana categories are untouched)")
  .argument("<aliases...>", "role aliases to remove")
  .option("-y, --yes", "skip confirmation")
  .action(runAsync((aliases: string[], opts) => rolesRmCommand(aliases, opts)));

roles
  .command("set-default")
  .description("Set the default role used by `att log` when --role is omitted")
  .argument("<alias>", "role alias")
  .action(runAsync((alias: string) => rolesSetDefaultCommand(alias)));

program
  .command("log")
  .description("Log billable time. Examples: `att log 1.5 acme \"kickoff\"`, `att log 0.5 acme:recent`, `att log 1 --task <url>`")
  .argument("<hours>", "hours (decimals allowed, e.g. 1.5 or 0.25)")
  .argument("[target]", "customer alias, or `<alias>:recent` for fuzzy task pick")
  .argument("[description]", "task name when creating a new task")
  .option("--task <url-or-gid>", "log against an existing Asana task")
  .option("--date <yyyy-mm-dd>", "date the work happened (defaults to today)")
  .option("--comment <text>", "notes attached to a newly created task")
  .option("--role <alias>", "role alias (defaults to configured default; see `att roles`)")
  .action(runAsync((hours: string, target: string | undefined, desc: string | undefined, opts) => logCommand(hours, target, desc, opts)));

program.parseAsync(process.argv).catch(handleFatal);

function runAsync(fn: (...args: any[]) => Promise<void>) {
  return async (...args: any[]) => {
    try {
      await fn(...args);
    } catch (err) {
      handleFatal(err);
    }
  };
}

function handleFatal(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  const asanaErr = (err as any)?.response?.body?.errors;
  if (Array.isArray(asanaErr) && asanaErr.length > 0) {
    console.error("Asana API error:");
    for (const e of asanaErr) {
      console.error(`  ${e.message}${e.help ? ` (${e.help})` : ""}`);
    }
  } else {
    console.error(`Error: ${message}`);
  }
  process.exit(1);
}
