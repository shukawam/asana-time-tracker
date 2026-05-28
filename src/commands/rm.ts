import { confirm } from "@inquirer/prompts";
import { loadConfig } from "../config.js";
import { buildApis } from "../asana/client.js";
import { deleteTimeEntry, getTimeEntry, type TimeEntry } from "../asana/timeEntries.js";

export interface RmOpts {
  yes?: boolean;
}

export async function rmCommand(entryGids: string[], opts: RmOpts): Promise<void> {
  if (entryGids.length === 0) throw new Error("Provide one or more entry GIDs to delete.");
  const config = await loadConfig();
  const apis = buildApis(config);

  type Fetched = { gid: string; entry?: TimeEntry; err?: string };
  const fetched: Fetched[] = await Promise.all(
    entryGids.map(async (gid) => {
      try {
        return { gid, entry: await getTimeEntry(apis, gid) };
      } catch (e) {
        return { gid, err: (e as Error).message };
      }
    }),
  );

  // Refuse to delete entries that aren't ours, even if the PAT has the
  // permission to. att is single-user by design — anything else has to
  // happen in the Asana web UI. Fail-closed: if we can't positively confirm
  // ownership we skip the entry rather than risk deleting someone else's.
  const deletable: string[] = [];
  const skipped: { gid: string; reason: string }[] = [];
  for (const f of fetched) {
    if (!f.entry) {
      skipped.push({ gid: f.gid, reason: `could not load: ${f.err}` });
      continue;
    }
    const ownerGid = f.entry.created_by?.gid;
    if (!ownerGid) {
      skipped.push({ gid: f.gid, reason: "owner unknown (created_by missing from API response)" });
      continue;
    }
    if (ownerGid !== config.userGid) {
      const ownerName = f.entry.created_by?.name ?? ownerGid;
      skipped.push({ gid: f.gid, reason: `owned by ${ownerName}, not you` });
      continue;
    }
    deletable.push(f.gid);
  }

  console.log(`About to delete ${deletable.length} of ${entryGids.length} time entr${entryGids.length === 1 ? "y" : "ies"}:`);
  for (const f of fetched) {
    if (!f.entry) continue;
    if (skipped.some((s) => s.gid === f.gid)) continue;
    const project = f.entry.task?.projects?.[0]?.name ?? "(no project)";
    const hours = (f.entry.duration_minutes / 60).toFixed(2);
    console.log(`  - ${f.gid}  ${f.entry.entered_on}  ${hours}h  [${project}] ${f.entry.task?.name ?? "(?)"}`);
  }
  if (skipped.length > 0) {
    console.log(`Skipping ${skipped.length}:`);
    for (const s of skipped) console.log(`  - ${s.gid}  (${s.reason})`);
  }
  if (deletable.length === 0) {
    console.log("Nothing to delete.");
    if (skipped.length > 0) process.exitCode = 1;
    return;
  }

  if (!opts.yes) {
    const ok = await confirm({ message: "Delete the above?", default: false });
    if (!ok) {
      console.log("Aborted.");
      return;
    }
  }

  const results = await Promise.all(
    deletable.map(async (gid) => {
      try {
        await deleteTimeEntry(apis, gid);
        return { gid, ok: true as const };
      } catch (e) {
        return { gid, ok: false as const, err: (e as Error).message };
      }
    }),
  );

  const okCount = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`✓ Deleted ${okCount}/${results.length}`);
  for (const f of failed) {
    console.error(`  ✗ ${f.gid}: ${("err" in f ? f.err : "unknown error")}`);
  }
  if (failed.length > 0 || skipped.length > 0) process.exitCode = 1;
}
