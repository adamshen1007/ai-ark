import { describe, expect, it } from "vitest";

import { inspectSourceSafetyText } from "./check-source-safety.mjs";

describe("source-safety scanner", () => {
  it("rejects direct exec call syntax", () => {
    expect(inspectSourceSafetyText("exec(untrustedSource)")).not.toEqual([]);
  });

  it.each([
    ["generic cp member", "cp.exec(untrustedSource)"],
    ["generic runner member", "runner.exec(acquiredSource)"],
    ["RegExp member under conservative policy", String.raw`/^row:(.+)$/u.exec(key)`],
    ["CommonJS child-process alias", `const cp = require("child_process"); cp.exec(source);`],
    [
      "node-prefixed CommonJS child-process alias",
      `const runner = require("node:child_process"); runner.exec(source);`,
    ],
  ])("rejects %s", (_description, source) => {
    const execPattern = String.raw`/\bexec\s*\(/`;
    expect(inspectSourceSafetyText(source), source).toContain(execPattern);
  });

  it("continues to reject child-process imports", () => {
    const source = `import { ex${"ec"} } from "node:child_process";`;

    expect(inspectSourceSafetyText(source)).toContain(String.raw`/node:child_process/`);
  });
});
