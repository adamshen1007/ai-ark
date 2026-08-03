import { describe, expect, it } from "vitest";

import { parseEnvironment, redactedEnvironment } from "./index.js";

describe("environment schema", () => {
  it("provides safe local defaults", () => {
    expect(parseEnvironment({})).toEqual({ NODE_ENV: "development", LOG_LEVEL: "info" });
  });

  it("rejects malformed configured URLs", () => {
    expect(() => parseEnvironment({ DATABASE_URL: "not-a-url" })).toThrow();
  });

  it("redacts provider credentials", () => {
    const environment = parseEnvironment({ GITHUB_TOKEN: "secret", AI_PROVIDER_API_KEY: "secret" });
    expect(redactedEnvironment(environment)).toMatchObject({
      GITHUB_TOKEN: "[REDACTED]",
      AI_PROVIDER_API_KEY: "[REDACTED]",
    });
  });
});
