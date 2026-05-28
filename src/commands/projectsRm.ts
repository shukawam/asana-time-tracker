import { confirm } from "@inquirer/prompts";
import { loadConfig, saveConfig, configPath } from "../config.js";

export interface ProjectsRmOpts {
  yes?: boolean;
}

export async function projectsRmCommand(aliases: string[], opts: ProjectsRmOpts): Promise<void> {
  if (aliases.length === 0) throw new Error("Provide one or more aliases to remove.");
  const config = await loadConfig();

  const resolved = aliases.map((a) => {
    const key = a.trim().toLowerCase();
    return { input: a, key, target: config.customerAliases[key] };
  });

  const missing = resolved.filter((r) => !r.target);
  if (missing.length > 0) {
    const known = Object.keys(config.customerAliases).join(", ") || "(none)";
    throw new Error(
      `Unknown alias(es): ${missing.map((m) => m.input).join(", ")}. Registered: ${known}`,
    );
  }

  console.log(`About to remove ${resolved.length} alias(es) (Asana projects are untouched):`);
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
    delete config.customerAliases[r.key];
  }
  await saveConfig(config);
  console.log(`✓ Removed ${resolved.length} alias(es) from ${configPath()}`);
}
