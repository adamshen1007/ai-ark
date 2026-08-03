import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { AnalysisProvider, SourceProvider } from "./index.js";

describe("provider-neutral port contracts", () => {
  it("do not expose vendor SDK types", () => {
    const sourcePort: keyof SourceProvider = "validateReference";
    const analysisPort: keyof AnalysisProvider = "analyze";
    expect([sourcePort, analysisPort]).toEqual(["validateReference", "analyze"]);
    expect(z.object({ value: z.string() }).parse({ value: "schema-bound" })).toEqual({
      value: "schema-bound",
    });
  });
});
