import { describe, expect, it } from "vitest";

import { enumerateManualResolutionModes } from "./manual-resolution-modes.js";

describe("M02 closed command-mode registry", () => {
  it("enumerates the exact 256 Section 15.9 expansions without aliases", () => {
    const modes = enumerateManualResolutionModes();
    expect(modes).toHaveLength(256);
    expect(new Set(modes.map(({ expansionId }) => expansionId))).toHaveLength(256);
    expect(
      Object.fromEntries(
        [...new Set(modes.map(({ family }) => family))].map((family) => [
          family,
          modes.filter((mode) => mode.family === family).length,
        ]),
      ),
    ).toEqual({
      CREATE_RESOURCE: 12,
      ATTACH_NEW_VERSION: 36,
      MARK_FORK: 12,
      MARK_MIRROR: 18,
      MARK_DUPLICATE: 18,
      REJECT_CANDIDATE: 18,
      SPLIT_ROOTS: 3,
      MERGE_ROOTS: 3,
      OVERRIDE_NON_SKILL: 3,
      REQUEST_CLARIFICATION: 6,
      RESOLVE_AMBIGUITY: 123,
      REPLACE_M02_JOB: 4,
    });
  });
});
