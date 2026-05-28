import { loadConfig, saveConfig, configPath } from "../config.js";
import { buildApis } from "../asana/client.js";
import { ensureCategory } from "../asana/categories.js";

export async function rolesAddCommand(alias: string, displayName: string): Promise<void> {
  const config = await loadConfig();
  if (!config.workspaceGid) throw new Error("No workspace configured. Run `att init` first.");
  const key = alias.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(key)) {
    throw new Error(`Invalid alias: ${alias}. Use letters, digits, hyphens.`);
  }
  const name = displayName.trim();
  if (!name) throw new Error("Display name cannot be empty.");

  const apis = buildApis(config);
  const category = await ensureCategory(apis, config.workspaceGid, name);

  const existed = !!config.roles[key];
  config.roles[key] = { name: category.name, categoryGid: category.gid };
  if (!config.defaultRole) config.defaultRole = key;
  await saveConfig(config);
  const verb = existed ? "Updated" : "Registered";
  console.log(`✓ ${verb} role "${key}" → ${category.name} (category gid ${category.gid})`);
  console.log(`  Saved to ${configPath()}`);
}
