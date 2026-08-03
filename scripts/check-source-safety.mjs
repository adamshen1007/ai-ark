import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const prohibited = [
  /node:child_process/,
  /from\s+["']child_process["']/,
  /\beval\s*\(/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/,
  /\bimport\s*\(/,
  /docker\.sock/,
  /\bgit\s+(?:clone|checkout)\b/,
  /\b(?:preinstall|postinstall|prepare)\b.*(?:source|repository|acquired)/i,
  /\b(?:npm|pnpm|yarn|pip)\s+install\b/,
];
const roots = [new URL("../packages/", import.meta.url), new URL("../apps/", import.meta.url)];
const failures = [];

async function scan(path) {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) await scan(target);
    else if ([".ts", ".tsx", ".js", ".mjs"].includes(extname(entry.name))) {
      const source = await readFile(target, "utf8");
      prohibited.forEach((pattern) => {
        if (pattern.test(source)) failures.push(`${target}: ${pattern}`);
      });
    }
  }
}

for (const root of roots) await scan(root.pathname);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("No prohibited acquired-source execution paths found.");
}
