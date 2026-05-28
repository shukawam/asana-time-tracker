import { loadConfig } from "../config.js";
import { buildApis } from "../asana/client.js";
import { updateTimeEntry } from "../asana/timeEntries.js";
import { parseIsoDate, toIsoDate } from "../util/date.js";

export interface EditOpts {
  hours?: string;
  date?: string;
}

export async function editCommand(entryGid: string, opts: EditOpts): Promise<void> {
  if (!opts.hours && !opts.date) {
    throw new Error("Nothing to update. Pass --hours <n> and/or --date <YYYY-MM-DD>.");
  }
  const config = await loadConfig();
  const apis = buildApis(config);

  const changes: { durationMinutes?: number; enteredOn?: string } = {};
  if (opts.hours) {
    const h = Number(opts.hours);
    if (!Number.isFinite(h) || h <= 0) throw new Error(`Invalid hours: ${opts.hours}`);
    changes.durationMinutes = Math.round(h * 60);
  }
  if (opts.date) {
    changes.enteredOn = toIsoDate(parseIsoDate(opts.date));
  }

  const updated = await updateTimeEntry(apis, entryGid, changes);
  console.log(
    `✓ Updated entry ${updated.gid}: ${(updated.duration_minutes / 60).toFixed(2)}h on ${updated.entered_on}`,
  );
}
