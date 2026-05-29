import * as Asana from "asana";
import type { Config } from "../config.js";
import { resolvePat } from "../config.js";

export interface AsanaApis {
  users: any;
  workspaces: any;
  projects: any;
  tasks: any;
  timeTrackingEntries: any;
}

let cached: AsanaApis | null = null;

export function buildApis(config: Config): AsanaApis {
  if (cached) return cached;
  const pat = resolvePat(config);
  const A = Asana as any;
  const client = A.ApiClient.instance;
  client.authentications["token"].accessToken = pat;
  cached = {
    users: new A.UsersApi(),
    workspaces: new A.WorkspacesApi(),
    projects: new A.ProjectsApi(),
    tasks: new A.TasksApi(),
    timeTrackingEntries: new A.TimeTrackingEntriesApi(),
  };
  return cached;
}

export function unwrapData<T = any>(result: any): T {
  if (result && typeof result === "object" && "data" in result) return result.data as T;
  return result as T;
}

export async function collectAll<T = any>(result: any): Promise<T[]> {
  const items: T[] = [];
  let page = result;
  while (page) {
    if (Array.isArray(page.data)) {
      items.push(...(page.data as T[]));
    } else if (Array.isArray(page)) {
      items.push(...(page as T[]));
      return items;
    } else if (page.data) {
      items.push(page.data as T);
    }
    if (typeof page.nextPage === "function") {
      page = await page.nextPage();
    } else {
      break;
    }
  }
  return items;
}
