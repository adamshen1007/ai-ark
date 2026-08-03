import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const allowed = new Map([
  ["@ai-ark/contracts", new Set()],
  ["@ai-ark/config", new Set(["@ai-ark/contracts"])],
  ["@ai-ark/testing", new Set(["@ai-ark/contracts"])],
]);

const packageRoot = new URL("../packages/", import.meta.url);
const directories = await readdir(packageRoot, { withFileTypes: true });
const failures = [];

for (const directory of directories.filter((entry) => entry.isDirectory())) {
  const manifestPath = join(packageRoot.pathname, directory.name, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const declared = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.peerDependencies,
  };
  const permitted = allowed.get(manifest.name);

  if (!permitted) {
    failures.push(`${manifest.name}: package is missing from the boundary policy`);
    continue;
  }

  for (const dependency of Object.keys(declared).filter((name) => name.startsWith("@ai-ark/"))) {
    if (!permitted.has(dependency)) {
      failures.push(`${manifest.name}: forbidden dependency on ${dependency}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Dependency boundaries valid for 3 M00 packages.");
}
