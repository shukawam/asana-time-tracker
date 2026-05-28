import { loadConfig } from "../config.js";
import { buildApis } from "../asana/client.js";
import { searchRecentTasksForUser } from "../asana/tasks.js";
import { toIsoDate } from "../util/date.js";

export interface RecentOpts {
  customer?: string;
  days?: string;
}

export async function recentCommand(opts: RecentOpts): Promise<void> {
  const config = await loadConfig();
  const apis = buildApis(config);
  const days = opts.days ? Number(opts.days) : 14;
  if (!Number.isFinite(days) || days <= 0) throw new Error(`Invalid --days: ${opts.days}`);

  let projectGid: string | undefined;
  if (opts.customer) {
    const alias = opts.customer.toLowerCase();
    const project = config.customerAliases[alias];
    if (!project) throw new Error(`Unknown customer alias: ${alias}`);
    projectGid = project.projectGid;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const tasks = await searchRecentTasksForUser(apis, {
    workspaceGid: config.workspaceGid,
    userGid: config.userGid,
    projectGid,
    modifiedAfter: toIsoDate(cutoff),
    limit: 50,
  });

  if (tasks.length === 0) {
    console.log("No recent tasks found.");
    return;
  }

  for (const t of tasks) {
    const project = t.projects?.[0]?.name ?? "(no project)";
    console.log(`${t.gid}  [${project}] ${t.name}`);
    if (t.permalink_url) console.log(`            ${t.permalink_url}`);
  }
}
