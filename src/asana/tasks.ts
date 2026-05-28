import type { AsanaApis } from "./client.js";
import { collectAll, unwrapData } from "./client.js";

export interface AsanaTask {
  gid: string;
  name: string;
  permalink_url?: string;
  projects?: { gid: string; name: string }[];
  actual_time_minutes?: number;
}

export async function createTaskInProject(
  apis: AsanaApis,
  args: {
    workspaceGid: string;
    projectGid: string;
    name: string;
    notes?: string;
    assigneeGid?: string;
  },
): Promise<AsanaTask> {
  const body: any = {
    data: {
      name: args.name,
      workspace: args.workspaceGid,
      projects: [args.projectGid],
    },
  };
  if (args.notes) body.data.notes = args.notes;
  if (args.assigneeGid) body.data.assignee = args.assigneeGid;
  const res = await apis.tasks.createTask(body, {
    opt_fields: "name,permalink_url,projects.name",
  });
  return unwrapData<AsanaTask>(res);
}

export async function getTask(apis: AsanaApis, taskGid: string): Promise<AsanaTask> {
  const res = await apis.tasks.getTask(taskGid, {
    opt_fields: "name,permalink_url,projects.name,actual_time_minutes",
  });
  return unwrapData<AsanaTask>(res);
}

export async function searchRecentTasksForUser(
  apis: AsanaApis,
  args: {
    workspaceGid: string;
    userGid: string;
    projectGid?: string;
    modifiedAfter: string;
    limit?: number;
  },
): Promise<AsanaTask[]> {
  const opts: any = {
    "assignee.any": args.userGid,
    "modified_on.after": args.modifiedAfter,
    sort_by: "modified_at",
    sort_ascending: false,
    limit: args.limit ?? 25,
    opt_fields: "name,permalink_url,projects.name,modified_at",
  };
  if (args.projectGid) opts["projects.any"] = args.projectGid;
  const page = await apis.tasks.searchTasksForWorkspace(args.workspaceGid, opts);
  return await collectAll<AsanaTask>(page);
}
