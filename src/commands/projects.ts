import { loadConfig } from "../config.js";
import { buildApis } from "../asana/client.js";
import { getProjectActualTimeMinutes } from "../asana/projects.js";

export async function projectsCommand(): Promise<void> {
  const config = await loadConfig();
  const aliases = Object.entries(config.customerAliases);
  if (aliases.length === 0) {
    console.log("No customer aliases registered. Run `att init` to add some.");
    return;
  }

  const apis = buildApis(config);
  const rows = await Promise.all(
    aliases.map(async ([alias, info]) => {
      let minutes = 0;
      let err: string | undefined;
      try {
        minutes = await getProjectActualTimeMinutes(apis, info.projectGid);
      } catch (e) {
        err = (e as Error).message;
      }
      return { alias, name: info.name, projectGid: info.projectGid, minutes, err };
    }),
  );

  const aliasWidth = Math.max(5, ...rows.map((r) => r.alias.length));
  const nameWidth = Math.max(12, ...rows.map((r) => r.name.length));

  console.log(`${pad("alias", aliasWidth)}  ${pad("project", nameWidth)}  ${pad("total", 8)}`);
  console.log(`${"-".repeat(aliasWidth)}  ${"-".repeat(nameWidth)}  ${"-".repeat(8)}`);
  for (const r of rows) {
    const total = r.err ? `err: ${r.err.slice(0, 30)}` : `${(r.minutes / 60).toFixed(2)}h`;
    console.log(`${pad(r.alias, aliasWidth)}  ${pad(r.name, nameWidth)}  ${pad(total, 8)}`);
  }
}

function pad(s: string, width: number): string {
  if (s.length >= width) return s;
  return s + " ".repeat(width - s.length);
}
