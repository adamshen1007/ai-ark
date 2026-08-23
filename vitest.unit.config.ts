import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.unit.test.ts", "scripts/**/*.unit.test.mjs"],
    passWithNoTests: false,
    sequence: { concurrent: false },
  },
});
