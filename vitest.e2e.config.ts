import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.e2e.test.ts"],
    passWithNoTests: true,
    sequence: { concurrent: false },
  },
});
