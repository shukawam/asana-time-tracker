import { confirm } from "@inquirer/prompts";
import { loadConfig, saveConfig, configPath } from "../config.js";

export interface RolesRmOpts {
  yes?: boolean;
}

export async function rolesRmCommand(aliases: string[], opts: RolesRmOpts): Promise<void> {
  if (aliases.length === 0) throw new Error("Provide one or more role aliases to remove.");
  const config = await loadConfig();

  const resolved = aliases.map((a) => {
    const key = a.trim().toLowerCase();
    return { input: a, key, target: config.roles[key] };
  });

  const missing = resolved.filter((r) => !r.target);
  if (missing.length > 0) {
    const known = Object.keys(config.roles).join(", ") || "(none)";
    throw new Error(
      `Unknown role alias(es): ${missing.map((m) => m.input).join(", ")}. Registered: ${known}`,
    );
  }

  console.log(`About to remove ${resolved.length} role alias(es) (Asana categories untouched):`);
  for (const r of resolved) {
    console.log(`  - ${r.key} → ${r.target!.name}`);
  }

  if (!opts.yes) {
    const ok = await confirm({ message: "Remove all of the above?", default: false });
    if (!ok) {
      console.log("Aborted.");
      return;
    }
  }

  for (const r of resolved) {
    delete config.roles[r.key];
    if (config.defaultRole === r.key) delete config.defaultRole;
  }
  await saveConfig(config);
  console.log(`✓ Removed ${resolved.length} role alias(es) from ${configPath()}`);
}
