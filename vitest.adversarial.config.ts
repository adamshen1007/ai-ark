import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.adversarial.test.ts"],
    passWithNoTests: true,
    sequence: { concurrent: false },
  },
});
