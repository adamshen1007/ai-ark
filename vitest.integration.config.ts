import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@ai-ark/acquisition": fileURLToPath(
        new URL("./packages/acquisition/src/index.ts", import.meta.url),
      ),
      "@ai-ark/github-source": fileURLToPath(
        new URL("./packages/github-source/src/index.ts", import.meta.url),
      ),
      "@ai-ark/job-queue": fileURLToPath(
        new URL("./packages/job-queue/src/index.ts", import.meta.url),
      ),
      "@ai-ark/object-storage": fileURLToPath(
        new URL("./packages/object-storage/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["packages/**/*.integration.test.ts"],
    passWithNoTests: true,
    sequence: { concurrent: false },
  },
});
