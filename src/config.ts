import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const CONFIG_DIR = join(homedir(), ".config", "att");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export interface Config {
  asanaPat?: string;
  workspaceGid: string;
  workspaceName?: string;
  userGid: string;
  userName?: string;
  customerAliases: Record<string, { projectGid: string; name: string }>;
  /** Value emitted in the CSV "Kong Resource" column for every row. */
  kongResource?: string;
}

const EMPTY: Config = {
  workspaceGid: "",
  userGid: "",
  customerAliases: {},
};

type LegacyRoleEntry = { name?: string; categoryGid?: string };
type LegacyConfigShape = Partial<Config> & {
  roles?: Record<string, LegacyRoleEntry>;
  defaultRole?: string;
};

export async function loadConfig(): Promise<Config> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as LegacyConfigShape;

    // One-shot migration from the removed roles/defaultRole shape:
    // if kongResource isn't set but the user had a defaultRole pointing at a
    // role with a display name, promote that name into kongResource so the
    // CSV column keeps emitting the same string post-upgrade.
    if (
      !parsed.kongResource &&
      typeof parsed.defaultRole === "string" &&
      parsed.roles &&
      typeof parsed.roles[parsed.defaultRole]?.name === "string"
    ) {
      parsed.kongResource = parsed.roles[parsed.defaultRole]!.name!;
    }
    delete parsed.roles;
    delete parsed.defaultRole;

    return {
      ...EMPTY,
      ...parsed,
      customerAliases: parsed.customerAliases ?? {},
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { ...EMPTY };
    throw err;
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await fs.chmod(CONFIG_DIR, 0o700).catch(() => {});
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
  await fs.mkdir(dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });
}
