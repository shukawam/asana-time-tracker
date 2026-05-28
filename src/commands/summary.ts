import { loadConfig } from "../config.js";
import { buildApis } from "../asana/client.js";
import { listTimeEntriesForUserInRange, type TimeEntry } from "../asana/timeEntries.js";
import { weekRange, lastWeekRange, sundayWeekRange, lastSundayWeekRange } from "../util/date.js";
import { rollupWeek } from "../summary/aggregate.js";
import { formatMarkdown, formatCsv, formatSfdc } from "../summary/format.js";

export interface SummaryOpts {
  week?: boolean;
  lastWeek?: boolean;
  format?: "md" | "csv" | "sfdc";
  customer?: string;
}

export async function summaryCommand(opts: SummaryOpts): Promise<void> {
  const config = await loadConfig();
  const apis = buildApis(config);

  let projectGid: string | undefined;
  let customerLabel: string | undefined;
  if (opts.customer) {
    const alias = opts.customer.trim().toLowerCase();
    const project = config.customerAliases[alias];
    if (!project) {
      throw new Error(`Unknown customer alias: ${opts.customer}. Run \`att projects\` to list.`);
    }
    projectGid = project.projectGid;
    customerLabel = project.name;
  }

  const format = opts.format ?? "md";
  const range =
    format === "sfdc"
      ? opts.lastWeek
        ? lastSundayWeekRange()
        : sundayWeekRange()
      : opts.lastWeek
        ? lastWeekRange()
        : weekRange();
  const allEntries = await listTimeEntriesForUserInRange(apis, {
    workspaceGid: config.workspaceGid,
    userGid: config.userGid,
    startDate: range.start,
    endDate: range.end,
  });

  const entries = projectGid ? allEntries.filter((e) => entryBelongsToProject(e, projectGid!)) : allEntries;
  switch (format) {
    case "md": {
      const week = rollupWeek(entries, range.days);
      const header = customerLabel ? `(filtered to ${customerLabel})\n\n` : "";
      console.log(header + formatMarkdown(week));
      break;
    }
    case "csv":
      console.log(formatCsv(entries));
      break;
    case "sfdc": {
      const week = rollupWeek(entries, range.days);
      console.log(formatSfdc(week));
      break;
    }
    default:
      throw new Error(`Unknown format: ${format}. Use md, csv, or sfdc.`);
  }
}

function entryBelongsToProject(entry: TimeEntry, projectGid: string): boolean {
  return entry.task?.projects?.some((p) => p.gid === projectGid) ?? false;
}
