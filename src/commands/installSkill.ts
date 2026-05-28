import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// `skills/att/SKILL.md` sits two levels above this module in all three layouts:
//   dev:    <repo>/src/commands/installSkill.ts   → <repo>/skills/att/SKILL.md
//   built:  <root>/dist/commands/installSkill.js  → <root>/skills/att/SKILL.md
//   global: …/node_modules/<pkg>/dist/commands/…  → …/node_modules/<pkg>/skills/att/SKILL.md
const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "..", "..", "skills", "att", "SKILL.md");
const targetDir = join(homedir(), ".claude", "skills", "att");
const target = join(targetDir, "SKILL.md");

export async function installSkillCommand(): Promise<void> {
  try {
    await fs.access(source);
  } catch {
    throw new Error(`Bundled skill not found at ${source}. Reinstall the package and try again.`);
  }

  await fs.mkdir(targetDir, { recursive: true });

  let existing: Awaited<ReturnType<typeof fs.lstat>> | undefined;
  try {
    existing = await fs.lstat(target);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  if (existing) {
    if (existing.isSymbolicLink()) {
      const current = await fs.readlink(target);
      if (resolve(targetDir, current) === source) {
        console.log(`✓ Already installed at ${target}`);
        console.log(`  → ${source}`);
        return;
      }
      console.log(`Replacing existing symlink at ${target}`);
      console.log(`  was: ${current}`);
      await fs.unlink(target);
    } else {
      throw new Error(
        `Refusing to overwrite a real file at ${target}.\n` +
          `Move or delete it first if you want this skill installed there.`,
      );
    }
  }

  await fs.symlink(source, target);
  console.log(`✓ Installed att skill`);
  console.log(`  ${target}`);
  console.log(`  → ${source}`);
  console.log("");
  console.log("Restart Claude Code if it's running, then try `/att` or just say");
  console.log('  「今 1 時間 <customer> の <task> やった、記録して」');
  console.log("");
  console.log(`Uninstall: rm ${target}`);
}
