import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const CONFIG_DIR = join(homedir(), ".config", "att");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export interface RoleEntry {
  name: string;
  categoryGid: string;
}

export interface Config {
  asanaPat?: string;
  workspaceGid: string;
  workspaceName?: string;
  userGid: string;
  userName?: string;
  customerAliases: Record<string, { projectGid: string; name: string }>;
  roles: Record<string, RoleEntry>;
  defaultRole?: string;
}

const EMPTY: Config = {
  workspaceGid: "",
  userGid: "",
  customerAliases: {},
  roles: {},
};

export async function loadConfig(): Promise<Config> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<Config>;
    return {
      ...EMPTY,
      ...parsed,
      customerAliases: parsed.customerAliases ?? {},
      roles: parsed.roles ?? {},
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { ...EMPTY };
    throw err;
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  const toWrite: Config = { ...config };
  if (process.env.ASANA_PAT && toWrite.asanaPat === process.env.ASANA_PAT) {
    delete toWrite.asanaPat;
  }
  await fs.writeFile(CONFIG_PATH, JSON.stringify(toWrite, null, 2), { mode: 0o600 });
  await fs.chmod(CONFIG_PATH, 0o600).catch(() => {});
}

export function resolvePat(config: Config): string {
  const pat = process.env.ASANA_PAT || config.asanaPat;
  if (!pat) {
    throw new Error(
      "No Asana PAT found. Run `att init` first, or set the ASANA_PAT environment variable.",
    );
  }
  return pat;
}

export function configPath(): string {
  return CONFIG_PATH;
}

export function configDir(): string {
  return CONFIG_DIR;
}

export async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(dirname(CONFIG_PATH), { recursive: true });
}
