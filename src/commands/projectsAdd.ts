import { loadConfig, saveConfig, configPath } from "../config.js";
import { buildApis } from "../asana/client.js";
import { fetchWorkspaceProjects, runAliasAddLoop } from "./aliasInteractive.js";

export async function projectsAddCommand(): Promise<void> {
  const config = await loadConfig();
  if (!config.workspaceGid) {
    throw new Error("No workspace configured. Run `att init` first.");
  }
  const apis = buildApis(config);
  const projects = await fetchWorkspaceProjects(apis, config.workspaceGid);
  const added = await runAliasAddLoop(config, projects);
  if (added === 0) {
    console.log("No changes.");
    return;
  }
  await saveConfig(config);
  console.log(`✓ Saved ${added} alias change(s) to ${configPath()}`);
}
