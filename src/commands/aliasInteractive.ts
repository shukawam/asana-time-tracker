import { input, confirm, select } from "@inquirer/prompts";
import type { Config } from "../config.js";
import type { AsanaApis } from "../asana/client.js";
import { collectAll } from "../asana/client.js";

export interface AsanaProjectLite {
  gid: string;
  name: string;
}

export async function fetchWorkspaceProjects(
  apis: AsanaApis,
  workspaceGid: string,
): Promise<AsanaProjectLite[]> {
  const page = await apis.projects.getProjectsForWorkspace(workspaceGid, {
    archived: false,
    limit: 100,
    opt_fields: "name",
  });
  const projects = await collectAll<AsanaProjectLite>(page);
  projects.sort((a, b) => a.name.localeCompare(b.name));
  return projects;
}

/**
 * Interactive loop to register one or more customer aliases. Mutates
 * `config.customerAliases` in place. Returns the number of aliases added/updated.
 */
export async function runAliasAddLoop(
  config: Config,
  projects: AsanaProjectLite[],
  opts: { stopAfterFirst?: boolean } = {},
): Promise<number> {
  if (projects.length === 0) {
    console.log("(No projects found in this workspace.)");
    return 0;
  }

  let added = 0;
  let keepAdding = true;
  while (keepAdding) {
    const projectGid = await select({
      message: "Pick a customer project",
      choices: projects.map((p) => ({
        name: aliasedLabel(p, config.customerAliases),
        value: p.gid,
      })),
      pageSize: 15,
    });
    const project = projects.find((p) => p.gid === projectGid)!;
    const defaultAlias =
      existingAliasFor(project.gid, config.customerAliases) ??
      suggestAlias(project.name, config.customerAliases);
    const alias = await input({
      message: `Alias for "${project.name}"`,
      default: defaultAlias,
      validate: (v) => {
        const trimmed = v.trim();
        if (!/^[a-z0-9][a-z0-9-]*$/i.test(trimmed)) return "Use letters, digits, hyphens";
        return true;
      },
    });
    const key = alias.trim().toLowerCase();
    const collision = config.customerAliases[key];
    if (collision && collision.projectGid !== project.gid) {
      const ok = await confirm({
        message:
          `Alias "${key}" is already mapped to "${collision.name}". ` +
          `Reassign it to "${project.name}"? Future \`att log ${key} ...\` will go to the new project.`,
        default: false,
      });
      if (!ok) {
        console.log(`  ↳ skipped (kept "${key}" → ${collision.name})`);
      } else {
        config.customerAliases[key] = { projectGid: project.gid, name: project.name };
        added++;
      }
    } else {
      // new alias, or re-confirming the same project — silent overwrite is fine
      config.customerAliases[key] = { projectGid: project.gid, name: project.name };
      added++;
    }
    if (opts.stopAfterFirst) break;
    keepAdding = await confirm({ message: "Add another?", default: false });
  }
  return added;
}

export function suggestAlias(name: string, existing: Record<string, unknown>): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  if (!existing[base]) return base;
  for (let i = 2; i < 99; i++) {
    const candidate = `${base}-${i}`;
    if (!existing[candidate]) return candidate;
  }
  return base;
}

export function aliasedLabel(
  project: AsanaProjectLite,
  aliases: Record<string, { projectGid: string }>,
): string {
  const existing = existingAliasFor(project.gid, aliases);
  return existing ? `${project.name}  [${existing}]` : project.name;
}

function existingAliasFor(
  projectGid: string,
  aliases: Record<string, { projectGid: string }>,
): string | undefined {
  return Object.entries(aliases).find(([, v]) => v.projectGid === projectGid)?.[0];
}
