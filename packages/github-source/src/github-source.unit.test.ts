import { describe, expect, it } from "vitest";

import { normalizeGitHubReference } from "./index.js";

describe("GitHub URL validation and normalization", () => {
  it.each([
    ["https://github.com/OpenAI/codex", "https://github.com/OpenAI/codex"],
    ["https://github.com/OpenAI/codex/", "https://github.com/OpenAI/codex"],
    ["https://github.com/OpenAI/codex.git", "https://github.com/OpenAI/codex"],
  ])("normalizes %s", (input, canonical) => {
    expect(normalizeGitHubReference(input).canonicalUrl).toBe(canonical);
  });

  it.each([
    "http://github.com/o/r",
    "https://gitlab.com/o/r",
    "https://github.com/o",
    "https://github.com/o/r/issues",
    "https://github.com//o/r",
    "https://github.com/o/r//",
    "https://github.com/o/r?tab=readme",
    "https://token@github.com/o/r",
    "git@github.com:o/r.git",
    " https://github.com/o/r",
  ])("rejects unsupported reference %s", (input) => {
    expect(() => normalizeGitHubReference(input)).toThrow();
  });
});
