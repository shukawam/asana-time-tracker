import type { AsanaApis } from "./client.js";
import { collectAll, unwrapData } from "./client.js";

export interface TimeEntry {
  gid: string;
  duration_minutes: number;
  entered_on: string;
  task?: {
    gid: string;
    name: string;
    permalink_url?: string;
    projects?: { gid: string; name: string }[];
  };
  time_tracking_category?: { gid: string; name: string } | null;
  created_by?: { gid: string; name?: string } | null;
}

const ENTRY_FIELDS =
  "duration_minutes,entered_on,task.name,task.permalink_url,task.projects.name,time_tracking_category.name,created_by.gid,created_by.name";

export async function createTimeEntry(
  apis: AsanaApis,
  args: {
    taskGid: string;
    durationMinutes: number;
    enteredOn: string;
    categoryGid?: string;
  },
): Promise<TimeEntry> {
  const data: any = {
    duration_minutes: args.durationMinutes,
    entered_on: args.enteredOn,
  };
  if (args.categoryGid) data.time_tracking_category = args.categoryGid;
  const res = await apis.timeTrackingEntries.createTimeTrackingEntry(
    { data },
    args.taskGid,
    { opt_fields: ENTRY_FIELDS },
  );
  return unwrapData<TimeEntry>(res);
}

export async function getTimeEntry(apis: AsanaApis, entryGid: string): Promise<TimeEntry> {
  const res = await apis.timeTrackingEntries.getTimeTrackingEntry(entryGid, {
    opt_fields: ENTRY_FIELDS,
  });
  return unwrapData<TimeEntry>(res);
}

export async function deleteTimeEntry(apis: AsanaApis, entryGid: string): Promise<void> {
  await apis.timeTrackingEntries.deleteTimeTrackingEntry(entryGid);
}

export async function updateTimeEntry(
  apis: AsanaApis,
  entryGid: string,
  changes: { durationMinutes?: number; enteredOn?: string },
): Promise<TimeEntry> {
  const data: any = {};
  if (changes.durationMinutes !== undefined) data.duration_minutes = changes.durationMinutes;
  if (changes.enteredOn !== undefined) data.entered_on = changes.enteredOn;
  const res = await apis.timeTrackingEntries.updateTimeTrackingEntry(
    { data },
    entryGid,
    { opt_fields: ENTRY_FIELDS },
  );
  return unwrapData<TimeEntry>(res);
}

export async function listTimeEntriesForUserInRange(
  apis: AsanaApis,
  args: { workspaceGid: string; userGid: string; startDate: string; endDate: string },
): Promise<TimeEntry[]> {
  const opts: any = {
    workspace: args.workspaceGid,
    user: args.userGid,
    entered_on_start_date: args.startDate,
    entered_on_end_date: args.endDate,
    limit: 100,
    opt_fields: ENTRY_FIELDS,
  };
  const page = await apis.timeTrackingEntries.getTimeTrackingEntries(opts);
  return await collectAll<TimeEntry>(page);
}

export async function listTimeEntriesForTask(
  apis: AsanaApis,
  taskGid: string,
): Promise<TimeEntry[]> {
  const opts: any = {
    task: taskGid,
    limit: 100,
    opt_fields: ENTRY_FIELDS,
  };
  const page = await apis.timeTrackingEntries.getTimeTrackingEntries(opts);
  return await collectAll<TimeEntry>(page);
}
