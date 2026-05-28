#!/usr/bin/env node
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const source = join(repoRoot, "skills", "att", "SKILL.md");
const targetDir = join(homedir(), ".claude", "skills", "att");
const target = join(targetDir, "SKILL.md");

async function main() {
  try {
    await fs.access(source);
  } catch {
    console.error(`Source skill file not found: ${source}`);
    process.exit(1);
  }

  await fs.mkdir(targetDir, { recursive: true });

  let existing;
  try {
    existing = await fs.lstat(target);
  } catch (err) {
    if ((err).code !== "ENOENT") throw err;
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
      console.error(
        `Refusing to overwrite a real file at ${target}.\n` +
          `Move or delete it first if you want this skill installed there.`,
      );
      process.exit(1);
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
