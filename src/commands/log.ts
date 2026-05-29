import { loadConfig } from "../config.js";
import { buildApis } from "../asana/client.js";
import { createTaskInProject, getTask, searchRecentTasksForUser, type AsanaTask } from "../asana/tasks.js";
import { createTimeEntry } from "../asana/timeEntries.js";
import { todayIso, parseIsoDate, toIsoDate } from "../util/date.js";
import { parseTaskRef } from "../util/parseTask.js";
import { chooseFromList } from "../util/fuzzy.js";

export interface LogOpts {
  task?: string;
  date?: string;
  comment?: string;
}

export async function logCommand(
  hoursArg: string,
  targetArg: string | undefined,
  descriptionArg: string | undefined,
  opts: LogOpts,
): Promise<void> {
  const hours = parseHours(hoursArg);
  const durationMinutes = Math.round(hours * 60);
  if (durationMinutes <= 0) throw new Error("Hours must be > 0");
  const enteredOn = normalizeDate(opts.date);

  const config = await loadConfig();
  const apis = buildApis(config);

  let task: AsanaTask;
  let createdNew = false;

  if (opts.task) {
    const gid = parseTaskRef(opts.task);
    task = await getTask(apis, gid);
  } else {
    if (!targetArg) {
      throw new Error("Provide either --task <url|gid> or a customer alias as the second argument.");
    }
    const { alias, mode } = parseTarget(targetArg);
    const project = config.customerAliases[alias];
    if (!project) {
      throw new Error(`Unknown customer alias: ${alias}. Run \`att projects\` to list aliases.`);
    }
    if (mode === "recent") {
      const recents = await searchRecentTasksForUser(apis, {
        workspaceGid: config.workspaceGid,
        userGid: config.userGid,
        projectGid: project.projectGid,
        modifiedAfter: lookbackIso(30),
        limit: 20,
      });
      if (recents.length === 0) {
        throw new Error(`No recent tasks found in ${project.name}. Use \`att log <hours> ${alias} "description"\` to create one.`);
      }
      task = await chooseFromList(recents, `Pick a task in ${project.name}`, (t) => t.name);
    } else {
      if (!descriptionArg) {
        throw new Error("Description is required when creating a new task. Example: att log 1 acme \"kickoff\"");
      }
      task = await createTaskInProject(apis, {
        workspaceGid: config.workspaceGid,
        projectGid: project.projectGid,
        name: descriptionArg,
        notes: opts.comment,
        assigneeGid: config.userGid,
      });
      createdNew = true;
    }
  }

  const entry = await createTimeEntry(apis, {
    taskGid: task.gid,
    durationMinutes,
    enteredOn,
  });

  printLogResult(task, entry, { hours, enteredOn, createdNew });
}

function parseHours(input: string): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid hours: ${input}`);
  }
  return n;
}

function normalizeDate(input?: string): string {
  if (!input) return todayIso();
  return toIsoDate(parseIsoDate(input));
}

function parseTarget(target: string): { alias: string; mode: "create" | "recent" } {
  if (target.includes(":")) {
    const [alias, mode] = target.split(":", 2);
    if (mode === "recent") return { alias: alias.toLowerCase(), mode: "recent" };
    throw new Error(`Unknown target mode: ${mode}. Supported: <alias>:recent`);
  }
  return { alias: target.toLowerCase(), mode: "create" };
}

function lookbackIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toIsoDate(d);
}

function printLogResult(
  task: AsanaTask,
  _entry: { gid: string; duration_minutes: number; entered_on: string },
  ctx: { hours: number; enteredOn: string; createdNew: boolean },
): void {
  const projectName = task.projects?.[0]?.name ?? "(no project)";
  const verb = ctx.createdNew ? "Created task + logged" : "Logged";
  console.log(`✓ ${verb} ${ctx.hours}h on ${ctx.enteredOn}`);
  console.log(`  [${projectName}] ${task.name}`);
  if (task.permalink_url) console.log(`  ${task.permalink_url}`);
}

