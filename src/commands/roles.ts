import { loadConfig, saveConfig, configPath } from "../config.js";

export async function rolesCommand(): Promise<void> {
  const config = await loadConfig();
  const entries = Object.entries(config.roles);
  if (entries.length === 0) {
    console.log("No roles registered. Add one with `att roles add <alias> \"<display name>\"`.");
    return;
  }
  const aliasWidth = Math.max(5, ...entries.map(([a]) => a.length));
  console.log(`${pad("alias", aliasWidth)}  display name`);
  console.log(`${"-".repeat(aliasWidth)}  ------------`);
  for (const [alias, info] of entries) {
    const star = alias === config.defaultRole ? " *" : "";
    console.log(`${pad(alias, aliasWidth)}  ${info.name}${star}`);
  }
  if (config.defaultRole) console.log(`\n* default (used when \`att log\` is invoked without --role)`);
  else console.log(`\nNo default set. Pick one with \`att roles set-default <alias>\`.`);
  console.log(`Config: ${configPath()}`);
}

export interface RolesRmOpts {
  yes?: boolean;
}

export async function rolesSetDefaultCommand(alias: string): Promise<void> {
  const config = await loadConfig();
  const key = alias.trim().toLowerCase();
  if (!config.roles[key]) {
    throw new Error(`Unknown role alias: ${alias}. Run \`att roles\` to list.`);
  }
  config.defaultRole = key;
  await saveConfig(config);
  console.log(`✓ Default role set to "${key}" (${config.roles[key].name})`);
}

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}
