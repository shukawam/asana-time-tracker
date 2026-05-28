import type { TimeEntry } from "../asana/timeEntries.js";
import type { WeekRollup } from "./aggregate.js";
import { formatHoursCell, dayLabels } from "./aggregate.js";

export function formatMarkdown(week: WeekRollup): string {
  const labels = dayLabels(week.days);
  const lines: string[] = [];
  lines.push(`## Week of ${week.start} (${labels[0]}) – ${week.end} (${labels[6]})`);
  lines.push("");
  lines.push(`| Customer | ${labels.join(" | ")} | Total |`);
  lines.push(`|---|${labels.map(() => "---:").join("|")}|---:|`);
  for (const c of week.customers) {
    const cells = week.days.map((d) => formatHoursCell(c.byDate[d]));
    lines.push(`| ${escapePipe(c.name)} | ${cells.join(" | ")} | ${formatHoursCell(c.totalMinutes)} |`);
  }
  const totalCells = week.days.map((d) => formatHoursCell(week.totalByDate[d]));
  lines.push(`| **Total** | ${totalCells.join(" | ")} | ${formatHoursCell(week.totalMinutes)} |`);
  lines.push("");
  lines.push("### Tasks breakdown");
  for (const c of week.customers) {
    lines.push(`**${c.name}** (${formatHoursCell(c.totalMinutes)}h)`);
    for (const t of c.tasks) {
      const dates = Object.entries(t.durationsByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([d, m]) => `${formatHoursCell(m)}h on ${d}`)
        .join(", ");
      lines.push(`  - ${t.name} — ${dates}`);
    }
    lines.push("");
  }
  lines.push("### SFDC entries (1h rounded)");
  for (const c of week.customers) {
    lines.push(`- ${c.name}: ${Math.round(c.totalMinutes / 60)}h`);
  }
  return lines.join("\n");
}

/**
 * Per-entry CSV matching the customer reporting sheet:
 *   Date, Kong Resource, Activity Details, Hours Consumed
 *
 * - Date format: YYYY/M/D (no zero-pad)
 * - Hours Consumed: Math.round(duration_minutes / 60); rows that round to 0 are dropped
 * - Kong Resource: pulled from the entry's time_tracking_category name; blank if unset
 *
 * Intended to be filtered to a single customer (`att summary --customer <alias>`)
 * before formatting, since the destination sheet is per-customer.
 */
export function formatCsv(entries: TimeEntry[]): string {
  const header = ["Date", "Kong Resource", "Activity Details", "Hours Consumed"].join(",");
  const rows: string[] = [header];
  const sorted = [...entries].sort((a, b) =>
    a.entered_on < b.entered_on ? -1 : a.entered_on > b.entered_on ? 1 : 0,
  );
  for (const e of sorted) {
    const hours = Math.round(e.duration_minutes / 60);
    if (hours <= 0) continue;
    const date = formatSheetDate(e.entered_on);
    const role = e.time_tracking_category?.name ?? "";
    const activity = e.task?.name ?? "";
    rows.push([date, csvEscape(role), csvEscape(activity), String(hours)].join(","));
  }
  return rows.join("\n");
}

function formatSheetDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}/${m}/${d}`;
}

/**
 * TSV laid out to match the SFDC Time Entry grid: one row per project, with
 * 7 day columns Sun→Sat. Caller is expected to feed a Sun-anchored WeekRollup
 * (see `sundayWeekRange` in util/date) so `week.days` is already Sun→Sat.
 *
 * Per-day cells are rounded to whole hours to match SFDC's hourly granularity.
 */
export function formatSfdc(week: WeekRollup): string {
  const lines: string[] = [];
  lines.push(`Week ending ${week.end} (Sat)`);
  lines.push("");
  for (const c of week.customers) {
    const cells = week.days.map((d) => String(Math.round((c.byDate[d] ?? 0) / 60)));
    lines.push([c.name, ...cells].join("\t"));
  }
  lines.push("");
  lines.push(`(actual: ${(week.totalMinutes / 60).toFixed(2)}h across ${week.customers.length} customer(s))`);
  return lines.join("\n");
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function escapePipe(s: string): string {
  return s.replace(/\|/g, "\\|");
}
