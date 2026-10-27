import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    passWithNoTests: false,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
