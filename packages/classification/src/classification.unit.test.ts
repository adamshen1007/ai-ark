import { describe, expect, it } from "vitest";

import {
  buildRepositoryCandidateGroup,
  classifyRepository,
  normalizeIdentityToken,
  parseSkillFrontMatter,
  resolveCandidateOwnership,
  type ClassificationFile,
} from "./index.js";

const acquired = (path: string, text: string, sha256 = "d".repeat(64)): ClassificationFile => ({
  normalizedPath: path,
  disposition: "ACQUIRED",
  entryKind: "file",
  contentSha256: sha256,
  utf8Text: text,
});

const skill = (path: string, name: string) =>
  acquired(path, `---\nname: ${name}\n---\n# ${name}\n`);

describe("parser-profile-v1", () => {
  it("accepts restricted YAML string scalars and retains inert identity tokens", () => {
    expect(
      parseSkillFrontMatter(
        "---\nname: 'React Agent' # comment\nid: \"vendor\\u002Did\"\ncreator_id: acme\n---\n",
      ),
    ).toEqual({
      ok: true,
      fields: { creator_id: "acme", id: "vendor-id", name: "React Agent" },
    });
  });

  it.each([
    "---\nname: true\n---\n",
    "---\nname: 42\n---\n",
    "---\nname: .5\n---\n",
    "---\nname: 0xFF\n---\n",
    "---\nname: .Inf\n---\n",
    "---\nname: NULL\n---\n",
    "---\nname: [agent]\n---\n",
    "---\nname: &agent value\n---\n",
    "---\nname: one\nname: two\n---\n",
    "---\nname: |\n  value\n---\n",
    "%YAML 1.2\n---\nname: agent\n---\n",
  ])("rejects forbidden YAML constructs", (source) => {
    expect(parseSkillFrontMatter(source)).toMatchObject({
      ok: false,
      reasonCode: "MALFORMED_FRONT_MATTER",
    });
  });

  it("normalizes tokens with NFKC, default case folding, and separator runs", () => {
    expect(normalizeIdentityToken(" React_Agent ")).toEqual({
      normalized: "react-agent",
      unicodePolicyVersion: "unicode-15.1",
    });
    expect(normalizeIdentityToken("Straße")).toMatchObject({ normalized: "strasse" });
    expect(normalizeIdentityToken("\u{ab70}")).toMatchObject({ normalized: "\u{13a0}" });
    expect(normalizeIdentityToken("\u{1c89}")).toBeNull();
    expect(normalizeIdentityToken("agent!")).toBeNull();
  });

  it("implements YAML 1.2 double-quoted escapes and exact front-matter bounds", () => {
    expect(parseSkillFrontMatter('---\nname: "agent\\x2D\\u0031\\U00000032"\n---\n')).toEqual({
      ok: true,
      fields: { name: "agent-12" },
    });
    expect(parseSkillFrontMatter("---\n# comment only\n---\n")).toMatchObject({ ok: false });
    expect(
      parseSkillFrontMatter(
        `---\n${Array.from({ length: 48 }, (_, index) => `k${String(index)}: value`).join("\n")}\n---\n`,
      ),
    ).toMatchObject({ ok: true });
    expect(
      parseSkillFrontMatter(
        `---\n${Array.from({ length: 49 }, (_, index) => `k${String(index)}: value`).join("\n")}\n---\n`,
      ),
    ).toMatchObject({ ok: false });
  });

  it("handles quotes according to scalar style without accepting malformed quoted tails", () => {
    expect(parseSkillFrontMatter("---\nname: it's-valid\n---\n")).toEqual({
      ok: true,
      fields: { name: "it's-valid" },
    });
    expect(parseSkillFrontMatter('---\nname: a-"quote"-inside\n---\n')).toEqual({
      ok: true,
      fields: { name: 'a-"quote"-inside' },
    });
    expect(parseSkillFrontMatter("---\nname: 'it''s-valid'\n---\n")).toEqual({
      ok: true,
      fields: { name: "it's-valid" },
    });
    for (const source of [
      "---\nname: 'closed' junk'\n---\n",
      '---\nname: "closed" junk"\n---\n',
      "---\nname: 'unclosed\n---\n",
      '---\nname: "unclosed\n---\n',
    ]) {
      expect(parseSkillFrontMatter(source)).toMatchObject({ ok: false });
    }
  });

  it.each([
    "---\nname: value &anchor\n---\n",
    "---\nname: value *alias\n---\n",
    "---\nname: value !tag\n---\n",
    "---\nname: { nested: value }\n---\n",
    "---\nname: value\n  nested: value\n---\n",
    "---\nname: value\n- sequence\n---\n",
    "---\n\tname: value\n---\n",
    "---\nname: value\n...\n---\n",
  ])("rejects additional parser-profile forbidden syntax", (source) => {
    expect(parseSkillFrontMatter(source)).toMatchObject({
      ok: false,
      reasonCode: "MALFORMED_FRONT_MATTER",
    });
  });
});

describe("deterministic repository classification", () => {
  it("classifies a valid name even when it cannot produce a reliable identity token", () => {
    const result = classifyRepository({ files: [skill("SKILL.md", "it's-valid")] });

    expect(result).toMatchObject({
      classification: "SINGLE_SKILL",
      roots: ["."],
      declarations: [{ name: "it's-valid", normalizedName: null }],
    });
  });

  it.each([
    ["single", [skill("SKILL.md", "one")], "SINGLE_SKILL", ["."]],
    [
      "multiple",
      [skill("alpha/SKILL.md", "alpha"), skill("beta/SKILL.md", "beta")],
      "MULTIPLE_SKILLS",
      ["alpha", "beta"],
    ],
    [
      "collection",
      [
        skill("alpha/SKILL.md", "alpha"),
        skill("beta/SKILL.md", "beta"),
        acquired("README.md", "# Skills\n- [B](beta/)\n- [A](./alpha/SKILL.md)\n"),
      ],
      "SKILL_COLLECTION",
      ["alpha", "beta"],
    ],
    [
      "skill plus application",
      [
        skill("skills/one/SKILL.md", "one"),
        acquired("package.json", "{}"),
        acquired("src/app.ts", "x"),
      ],
      "SKILL_PLUS_APPLICATION",
      ["skills/one"],
    ],
    ["non skill", [acquired("README.md", "# useful repository")], "NON_SKILL", []],
    ["example only", [skill("examples/demo/SKILL.md", "demo")], "NON_SKILL", []],
  ] as const)("classifies %s", (_name, files, classification, roots) => {
    expect(classifyRepository({ files })).toMatchObject({ classification, roots });
  });

  it("fails closed for incomplete evidence and for malformed candidate declarations", () => {
    expect(
      classifyRepository({ files: [skill("SKILL.md", "one")], snapshotComplete: false }),
    ).toMatchObject({ classification: "UNSUPPORTED", roots: [] });
    expect(
      classifyRepository({ files: [acquired("SKILL.md", "---\nname: true\n---\n")] }),
    ).toMatchObject({ classification: "AMBIGUOUS", roots: [] });
  });

  it("blocks parent-child declarations as ambiguous", () => {
    expect(
      classifyRepository({
        files: [skill("SKILL.md", "outer"), skill("nested/SKILL.md", "inner")],
      }),
    ).toMatchObject({ classification: "AMBIGUOUS", roots: [".", "nested"] });
  });

  it("treats collection missing/extra links as an ownership warning", () => {
    const result = classifyRepository({
      files: [
        skill("alpha/SKILL.md", "alpha"),
        skill("beta/SKILL.md", "beta"),
        acquired("README.md", "# Skills\n- [A](alpha)\n- [Missing](missing)\n"),
      ],
    });
    expect(result).toMatchObject({ classification: "AMBIGUOUS" });
    expect(result.warningCodes).toContain("COLLECTION_ROOT_MISMATCH");
  });

  it("does not mistake an exact one-root index or root-owned application files for broader classes", () => {
    expect(
      classifyRepository({
        files: [skill("one/SKILL.md", "one"), acquired("README.md", "# Skills\n- [One](one)\n")],
      }),
    ).toMatchObject({ classification: "SINGLE_SKILL", roots: ["one"] });
    expect(
      classifyRepository({
        files: [
          skill("SKILL.md", "one"),
          acquired("package.json", "{}"),
          acquired("src/app.ts", "x"),
        ],
      }),
    ).toMatchObject({ classification: "SINGLE_SKILL", roots: ["."] });
  });

  it("uses decoded CommonMark ATX heading text but ignores Setext headings and image links", () => {
    const roots = [skill("alpha/SKILL.md", "alpha"), skill("beta/SKILL.md", "beta")];
    expect(
      classifyRepository({
        files: [
          ...roots,
          acquired("README.md", "# **Skill&#32;collection**\n[A](alpha) [B](beta)\n"),
        ],
      }),
    ).toMatchObject({ classification: "SKILL_COLLECTION" });
    expect(
      classifyRepository({
        files: [...roots, acquired("README.md", "Skills\n======\n[A](alpha) [B](beta)\n")],
      }),
    ).toMatchObject({ classification: "MULTIPLE_SKILLS" });
    expect(
      classifyRepository({
        files: [...roots, acquired("README.md", "# Skills\n![A](alpha) ![B](beta)\n")],
      }),
    ).toMatchObject({ classification: "MULTIPLE_SKILLS" });
    const activeAcrossSetext = classifyRepository({
      files: [...roots, acquired("README.md", "# Skills\n[A](alpha)\nOther\n-----\n[B](beta)\n")],
    });
    expect(activeAcrossSetext.collectionRootOrder).toEqual(["alpha", "beta"]);
    expect(activeAcrossSetext).toMatchObject({
      classification: "SKILL_COLLECTION",
      collectionRootOrder: ["alpha", "beta"],
    });
  });

  it("never uses unhashed files as positive collection or application evidence", () => {
    const roots = [skill("alpha/SKILL.md", "alpha"), skill("beta/SKILL.md", "beta")];
    expect(
      classifyRepository({
        files: [
          ...roots,
          { ...acquired("README.md", "# Skills\n[A](alpha) [B](beta)\n"), contentSha256: null },
        ],
      }),
    ).toMatchObject({ classification: "MULTIPLE_SKILLS" });
    expect(
      classifyRepository({
        files: [
          skill("skills/one/SKILL.md", "one"),
          { ...acquired("package.json", "{}"), contentSha256: null },
          { ...acquired("src/app.ts", "x"), contentSha256: null },
        ],
      }),
    ).toMatchObject({ classification: "SINGLE_SKILL" });
    const { utf8Text: manifestText, ...hashOnlyManifest } = acquired("package.json", "{}");
    const { utf8Text: sourceText, ...hashOnlySource } = acquired("src/app.ts", "x");
    expect(manifestText).toBe("{}");
    expect(sourceText).toBe("x");
    expect(
      classifyRepository({
        files: [skill("skills/one/SKILL.md", "one"), hashOnlyManifest, hashOnlySource],
      }),
    ).toMatchObject({ classification: "SINGLE_SKILL" });
  });

  it.each([
    ["# Skill\\ collection\n[A](alpha) [B](beta)\n", "MULTIPLE_SKILLS"],
    ["## [Skills](ignored) ##\n[A](alpha) [B](beta)\n", "SKILL_COLLECTION"],
    ["###### Skills\n[A](alpha) [B](beta)\n", "SKILL_COLLECTION"],
    ["# `Skills`\n[A](<alpha> \"A\") [B](beta 'B')\n", "SKILL_COLLECTION"],
    ['# Skills\n[Alpha][a] [Beta][]\n\n[a]: alpha "A"\n[Beta]: beta\n', "SKILL_COLLECTION"],
    ["# Skills\n[A](%61lpha) [B](beta#fragment)\n", "SKILL_COLLECTION"],
    ["# Skills\n[A](./alpha/../alpha/SKILL.md#readme) [B](beta/)\n", "SKILL_COLLECTION"],
    ["#Skills\n[A](alpha) [B](beta)\n", "MULTIPLE_SKILLS"],
    ["# S*kills\n[A](alpha) [B](beta)\n", "MULTIPLE_SKILLS"],
    ["<h1>Skills</h1>\n[A](alpha) [B](beta)\n", "MULTIPLE_SKILLS"],
    ["# Skills\n<https://example.test/alpha> https://example.test/beta\n", "MULTIPLE_SKILLS"],
    ["# Skills\n![A](alpha) [B](beta)\n", "AMBIGUOUS"],
    ["# Skills\n[A](https://example.test/a) [B](/beta)\n", "MULTIPLE_SKILLS"],
    ["# Skills\n[A](alpha)\n# Other\n[B](beta)\n", "AMBIGUOUS"],
  ] as const)("applies the ATX/non-image-link subset to %j", (readme, classification) => {
    expect(
      classifyRepository({
        files: [
          skill("alpha/SKILL.md", "alpha"),
          skill("beta/SKILL.md", "beta"),
          acquired("README.md", readme),
        ],
      }),
    ).toMatchObject({ classification });
  });

  it("recognizes balanced parentheses in CommonMark inline destinations", () => {
    expect(
      classifyRepository({
        files: [
          skill("alpha(one)/SKILL.md", "alpha"),
          skill("beta/SKILL.md", "beta"),
          acquired("README.md", "# Skills\n[A](alpha(one)) [B](beta)\n"),
        ],
      }),
    ).toMatchObject({
      classification: "SKILL_COLLECTION",
      collectionRootOrder: ["alpha(one)", "beta"],
    });
  });

  it("aggregates multiple collection indexes independently of file order", () => {
    const base = [skill("alpha/SKILL.md", "alpha"), skill("beta/SKILL.md", "beta")];
    const readme = acquired("README.md", "# Skills\n[A](alpha) [B](beta)\n");
    const emptyIndex = acquired("SKILLS.md", "# Skills\nNo inline links here.\n");
    const forward = classifyRepository({ files: [...base, readme, emptyIndex] });
    const reverse = classifyRepository({ files: [emptyIndex, readme, ...base].reverse() });
    expect(forward).toMatchObject({
      classification: "SKILL_COLLECTION",
      collectionRootOrder: ["alpha", "beta"],
    });
    expect(reverse).toEqual(forward);
  });

  it("fails closed on unsafe paths, duplicate inventory records, and unverified hashes", () => {
    const badHash = { ...skill("SKILL.md", "one"), contentSha256: "not-a-hash" };
    expect(classifyRepository({ files: [skill("../SKILL.md", "one")] })).toMatchObject({
      classification: "UNSUPPORTED",
    });
    const duplicate = skill("SKILL.md", "one");
    expect(classifyRepository({ files: [duplicate, duplicate] })).toMatchObject({
      classification: "UNSUPPORTED",
    });
    expect(classifyRepository({ files: [badHash] })).toMatchObject({
      classification: "UNSUPPORTED",
    });
  });
});

describe("candidate ownership", () => {
  it("is order independent, deepest-root owned, and permits explicitly associated shared files", () => {
    const files = [
      skill("SKILL.md", "outer"),
      acquired("README.md", "readme", "a".repeat(64)),
      acquired("outer.txt", "outer", "b".repeat(64)),
      skill("nested/SKILL.md", "inner"),
      acquired("nested/file.txt", "inner", "c".repeat(64)),
    ];
    const associations = [{ repositoryPath: "README.md", rootIds: ["nested", "."] }];
    const forward = resolveCandidateOwnership({
      files,
      roots: [".", "nested"],
      sharedAssociations: associations,
    });
    const reverse = resolveCandidateOwnership({
      files: [...files].reverse(),
      roots: ["nested", "."],
      sharedAssociations: associations,
    });

    expect(forward).toEqual(reverse);
    expect(forward).toMatchObject({
      ok: true,
      candidates: [
        {
          root: ".",
          ownedRepositoryPaths: ["SKILL.md", "outer.txt"],
          sharedRepositoryPaths: ["README.md"],
        },
        {
          root: "nested",
          ownedRepositoryPaths: ["nested/SKILL.md", "nested/file.txt"],
          sharedRepositoryPaths: ["README.md"],
        },
      ],
    });
  });

  it("rejects duplicate records and invalid shared overlap", () => {
    const duplicate = acquired("SKILL.md", "x");
    expect(
      resolveCandidateOwnership({ files: [duplicate, duplicate], roots: ["."] }),
    ).toMatchObject({ ok: false, reasonCode: "DUPLICATE_PATH_RECORD" });
    expect(
      resolveCandidateOwnership({
        files: [skill("nested/SKILL.md", "inner")],
        roots: ["nested"],
        sharedAssociations: [{ repositoryPath: "nested/SKILL.md", rootIds: ["nested", "other"] }],
      }),
    ).toMatchObject({ ok: false, reasonCode: "INVALID_SHARED_ASSOCIATION" });
  });

  it("never owns excluded, unavailable, or non-regular candidate content", () => {
    const unavailable: ClassificationFile = {
      ...acquired("private.txt", "secret"),
      disposition: "QUARANTINED",
    };
    const symlink: ClassificationFile = {
      ...acquired("linked.txt", "link"),
      entryKind: "symlink",
    };
    expect(
      resolveCandidateOwnership({
        files: [skill("SKILL.md", "one"), acquired("docs/guide.md", "guide"), unavailable, symlink],
        roots: ["."],
      }),
    ).toMatchObject({
      ok: true,
      candidates: [{ root: ".", ownedRepositoryPaths: ["SKILL.md"] }],
      excludedRepositoryPaths: ["docs/guide.md", "linked.txt", "private.txt"],
    });
  });
});

describe("repository candidate group context", () => {
  it.each([
    ["SKILL_COLLECTION", "INCLUDES", undefined],
    ["SKILL_PLUS_APPLICATION", "BUNDLES", ["package.json", "src/app.ts"]],
  ] as const)(
    "retains ordered %s relationships",
    (classification, relationshipType, applicationPaths) => {
      const group = buildRepositoryCandidateGroup({
        id: "group-1",
        sourceSnapshotId: "snapshot-1",
        classificationPolicyVersion: "classification-v1",
        classification,
        candidates: [
          { id: "candidate-a", rootFingerprint: "a".repeat(64) },
          { id: "candidate-b", rootFingerprint: "b".repeat(64) },
        ],
        evidenceReferenceIds: ["evidence-b", "evidence-a"],
        warningCodes: ["WARNING_B", "WARNING_A"],
        applicationPaths,
        supersedesGroupId: null,
      });
      expect(group.relationships).toEqual([
        { order: 0, relationshipType, candidateId: "candidate-a" },
        { order: 1, relationshipType, candidateId: "candidate-b" },
      ]);
      expect(group.applicationContext?.applicationPaths).toEqual(applicationPaths);
      expect(group.groupFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    },
  );
});
