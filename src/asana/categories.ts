import type { AsanaApis } from "./client.js";
import { collectAll, unwrapData } from "./client.js";

export interface TimeTrackingCategory {
  gid: string;
  name: string;
  is_archived?: boolean;
}

export async function listCategories(
  apis: AsanaApis,
  workspaceGid: string,
): Promise<TimeTrackingCategory[]> {
  const page = await apis.timeTrackingCategories.getTimeTrackingCategories(workspaceGid, {
    limit: 100,
    opt_fields: "name,is_archived",
  });
  return await collectAll<TimeTrackingCategory>(page);
}

export async function findCategoryByName(
  apis: AsanaApis,
  workspaceGid: string,
  name: string,
): Promise<TimeTrackingCategory | undefined> {
  const all = await listCategories(apis, workspaceGid);
  const needle = name.trim().toLowerCase();
  return all.find((c) => c.name.trim().toLowerCase() === needle);
}

export async function createCategory(
  apis: AsanaApis,
  workspaceGid: string,
  name: string,
): Promise<TimeTrackingCategory> {
  const body = { data: { workspace: workspaceGid, name } };
  const res = await apis.timeTrackingCategories.createTimeTrackingCategory(body, {
    opt_fields: "name,is_archived",
  });
  return unwrapData<TimeTrackingCategory>(res);
}

export async function ensureCategory(
  apis: AsanaApis,
  workspaceGid: string,
  name: string,
): Promise<TimeTrackingCategory> {
  const existing = await findCategoryByName(apis, workspaceGid, name);
  if (existing) return existing;
  return await createCategory(apis, workspaceGid, name);
}
