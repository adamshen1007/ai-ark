import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  canonicalJsonM03,
  canonicalizeSpdx,
  handleKey,
  normalizeDependencyName,
  semverKey,
  textKey,
} from "./index.js";

describe("M03 deterministic normalization", () => {
  it("normalizes Unicode whitespace and handles deterministically", () => {
    expect(textKey("  Ａ\u00a0Tool  ")).toBe("ａ tool");
    expect(textKey("  Straße\u2003ΟΣ ς  ")).toBe("strasse οσ σ");
    expect(textKey("\ufeffDemo\ufeff")).toBe("\ufeffdemo\ufeff");
    expect(handleKey(" @Creator ")).toBe("creator");
  });

  it("normalizes exact SemVer without build metadata", () => {
    expect(semverKey("v1.2.3-beta.1+build.9")).toBe("1.2.3-beta.1");
    expect(semverKey("1.2")).toBeNull();
    expect(semverKey("01.2.3")).toBeNull();
  });

  it("canonicalizes supported SPDX expressions and rejects unsupported identifiers", () => {
    expect(canonicalizeSpdx("mit or (Apache-2.0 AND BSD-3-Clause)")).toBe(
      "MIT OR Apache-2.0 AND BSD-3-Clause",
    );
    expect(canonicalizeSpdx("(MIT OR Apache-2.0) AND BSD-3-Clause")).toBe(
      "(MIT OR Apache-2.0) AND BSD-3-Clause",
    );
    expect(canonicalizeSpdx("MIT AND (Apache-2.0 OR BSD-3-Clause)")).toBe(
      "MIT AND (Apache-2.0 OR BSD-3-Clause)",
    );
    expect(canonicalizeSpdx("0bsd")).toBe("0BSD");
    expect(canonicalizeSpdx("AGPL-3.0-only")).toBeNull();
    expect(canonicalizeSpdx("NOASSERTION")).toBeNull();
    expect(canonicalizeSpdx("MIT WITH Classpath-exception-2.0")).toBeNull();
  });

  it("normalizes dependency ecosystems and canonical JSON key ordering", () => {
    expect(normalizeDependencyName("NPM", "@Scope/Package")).toBe("@scope/package");
    expect(normalizeDependencyName("PYPI", "My_Package.Name")).toBe("my-package-name");
    expect(canonicalJson({ z: 1, a: { y: 2, b: 3 } })).toBe('{"a":{"b":3,"y":2},"z":1}');
  });

  it("uses Unicode-code-point ordering only for M03 canonical JSON", () => {
    expect(canonicalJson({ "\ue000": 1, "\u{10000}": 2 })).toBe('{"":1,"𐀀":2}');
    expect(canonicalJsonM03({ "\ue000": 1, "\u{10000}": 2 })).toBe('{"":1,"𐀀":2}');
  });
});
