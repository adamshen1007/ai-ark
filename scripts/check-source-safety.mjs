import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";

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
export function inspectSourceSafetyText(source) {
  return prohibited.filter((pattern) => pattern.test(source)).map((pattern) => pattern.toString());
}

async function scan(path, failures) {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) await scan(target, failures);
    else if ([".ts", ".tsx", ".js", ".mjs"].includes(extname(entry.name))) {
      const source = await readFile(target, "utf8");
      inspectSourceSafetyText(source).forEach((pattern) => failures.push(`${target}: ${pattern}`));
    }
  }
}

export async function inspectSourceSafetyRoots(scanRoots = roots) {
  const failures = [];
  for (const root of scanRoots) await scan(root.pathname, failures);
  return failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const failures = await inspectSourceSafetyRoots();
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("No prohibited acquired-source execution paths found.");
  }
}
