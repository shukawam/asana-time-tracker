import { password, confirm, select } from "@inquirer/prompts";
import { loadConfig, saveConfig, configPath, type Config } from "../config.js";
import { buildApis, unwrapData } from "../asana/client.js";
import { fetchWorkspaceProjects, runAliasAddLoop } from "./aliasInteractive.js";

export async function initCommand(): Promise<void> {
  const existing = await loadConfig();

  console.log("Asana Time Tracker setup");
  console.log(`Config will be written to: ${configPath()}`);
  console.log("");

  const pat =
    process.env.ASANA_PAT ||
    (await password({
      message: "Asana Personal Access Token (create at https://app.asana.com/0/my-apps)",
      mask: "*",
      validate: (v) => (v.trim().length > 10 ? true : "Token looks too short"),
    }));

  const draft: Config = { ...existing };
  if (process.env.ASANA_PAT) {
    // PAT comes from the environment — drop any previously-persisted token so
    // unsetting the env var later doesn't silently fall back to a stale value.
    delete draft.asanaPat;
  } else {
    draft.asanaPat = pat;
  }

  const apis = buildApisFresh(draft, pat);

  const meRes = await apis.users.getUser("me", {
    opt_fields: "name,email,workspaces.name",
  });
  const me = unwrapData<{ gid: string; name: string; email?: string; workspaces: { gid: string; name: string }[] }>(meRes);
  console.log(`Authenticated as: ${me.name}${me.email ? ` <${me.email}>` : ""}`);

  let workspaceGid: string;
  let workspaceName: string;
  if (me.workspaces.length === 1) {
    workspaceGid = me.workspaces[0].gid;
    workspaceName = me.workspaces[0].name;
    console.log(`Workspace: ${workspaceName}`);
  } else {
    workspaceGid = await select({
      message: "Select workspace",
      choices: me.workspaces.map((w) => ({ name: w.name, value: w.gid })),
    });
    workspaceName = me.workspaces.find((w) => w.gid === workspaceGid)!.name;
  }

  draft.workspaceGid = workspaceGid;
  draft.workspaceName = workspaceName;
  draft.userGid = me.gid;
  draft.userName = me.name;

  const addProjects = await confirm({
    message: "Register customer project aliases now?",
    default: Object.keys(draft.customerAliases).length === 0,
  });

  if (addProjects) {
    const projects = await fetchWorkspaceProjects(apis, workspaceGid);
    await runAliasAddLoop(draft, projects);
  }

  await saveConfig(draft);
  console.log("");
  console.log(`Saved ${Object.keys(draft.customerAliases).length} alias(es) to ${configPath()}`);
  console.log("Run `att projects` to verify, then try `att log 0.25 <alias> \"test\"`.");
  console.log("Tip: add more later with `att projects add` (no need to re-run init).");
}

function buildApisFresh(config: Config, pat: string) {
  const previous = process.env.ASANA_PAT;
  process.env.ASANA_PAT = pat;
  try {
    return buildApis(config);
  } finally {
    if (previous === undefined) delete process.env.ASANA_PAT;
    else process.env.ASANA_PAT = previous;
  }
}
