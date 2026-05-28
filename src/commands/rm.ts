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

  console.log(`About to delete ${entryGids.length} time entr${entryGids.length === 1 ? "y" : "ies"}:`);
  for (const f of fetched) {
    if (f.entry) {
      const project = f.entry.task?.projects?.[0]?.name ?? "(no project)";
      const hours = (f.entry.duration_minutes / 60).toFixed(2);
      console.log(`  - ${f.gid}  ${f.entry.entered_on}  ${hours}h  [${project}] ${f.entry.task?.name ?? "(?)"}`);
    } else {
      console.log(`  - ${f.gid}  (could not load: ${f.err})`);
    }
  }

  if (!opts.yes) {
    const ok = await confirm({ message: "Delete all of the above?", default: false });
    if (!ok) {
      console.log("Aborted.");
      return;
    }
  }

  const results = await Promise.all(
    entryGids.map(async (gid) => {
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
  if (failed.length > 0) process.exitCode = 1;
}
