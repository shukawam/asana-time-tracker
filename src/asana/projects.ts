import type { AsanaApis } from "./client.js";
import { collectAll, unwrapData } from "./client.js";

export interface AsanaProject {
  gid: string;
  name: string;
  archived?: boolean;
}

export async function listWorkspaceProjects(
  apis: AsanaApis,
  workspaceGid: string,
  opts: { archived?: boolean } = {},
): Promise<AsanaProject[]> {
  const page = await apis.projects.getProjectsForWorkspace(workspaceGid, {
    archived: opts.archived ?? false,
    limit: 100,
    opt_fields: "name,archived",
  });
  return await collectAll<AsanaProject>(page);
}

export async function getProjectActualTimeMinutes(
  apis: AsanaApis,
  projectGid: string,
): Promise<number> {
  const res = await apis.projects.getProject(projectGid, {
    opt_fields: "name,actual_time_minutes",
  });
  const data = unwrapData<{ actual_time_minutes?: number }>(res);
  return data.actual_time_minutes ?? 0;
}
