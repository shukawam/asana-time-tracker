import { loadConfig } from "../config.js";
import { buildApis } from "../asana/client.js";
import { getTimeEntry, updateTimeEntry } from "../asana/timeEntries.js";
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

  // Fetch first so we can verify ownership before mutating. att is single-user
  // by design (rmCommand already enforces this); same rule for edit.
  const current = await getTimeEntry(apis, entryGid);
  const ownerGid = current.created_by?.gid;
  if (!ownerGid || ownerGid !== config.userGid) {
    const ownerName = current.created_by?.name ?? ownerGid ?? "(unknown)";
    throw new Error(
      `Refusing to edit entry ${entryGid}: owned by ${ownerName}, not you. ` +
        `att is single-user; edit other users' entries via the Asana web UI.`,
    );
  }

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
