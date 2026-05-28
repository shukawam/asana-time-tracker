import { loadConfig } from "../config.js";
import { buildApis } from "../asana/client.js";
import { listTimeEntriesForUserInRange } from "../asana/timeEntries.js";
import { todayIso, weekRange, parseIsoDate, toIsoDate } from "../util/date.js";

export interface ListOpts {
  today?: boolean;
  week?: boolean;
  date?: string;
}

export async function listCommand(opts: ListOpts): Promise<void> {
  const config = await loadConfig();
  const apis = buildApis(config);

  let startDate: string;
  let endDate: string;
  if (opts.week) {
    const range = weekRange();
    startDate = range.start;
    endDate = range.end;
  } else if (opts.date) {
    startDate = toIsoDate(parseIsoDate(opts.date));
    endDate = startDate;
  } else {
    startDate = todayIso();
    endDate = startDate;
  }

  const entries = await listTimeEntriesForUserInRange(apis, {
    workspaceGid: config.workspaceGid,
    userGid: config.userGid,
    startDate,
    endDate,
  });

  if (entries.length === 0) {
    console.log(`No time entries between ${startDate} and ${endDate}.`);
    return;
  }

  entries.sort((a, b) => (a.entered_on > b.entered_on ? 1 : a.entered_on < b.entered_on ? -1 : 0));

  let totalMin = 0;
  for (const e of entries) {
    totalMin += e.duration_minutes;
    const project = e.task?.projects?.[0]?.name ?? "(no project)";
    const hours = (e.duration_minutes / 60).toFixed(2);
    console.log(`${e.entered_on}  ${hours.padStart(5)}h  [${project}] ${e.task?.name ?? "(?)"}`);
    console.log(`            entry: ${e.gid}${e.task?.permalink_url ? `  ${e.task.permalink_url}` : ""}`);
  }
  console.log(`-------- total: ${(totalMin / 60).toFixed(2)}h across ${entries.length} entries`);
}
