import { describe, expect, it } from "vitest";

import {
  ExtractionFieldResultV1Schema,
  M03_FIELD_KEYS,
  M03_POLICY_VERSIONS,
} from "@ai-ark/contracts";

import { extractDeterministic } from "./index.js";

const sha = "a".repeat(64);

function fixtureInput(
  documents: readonly {
    readonly sourceEntryId: string;
    readonly sourceDocumentId: string;
    readonly normalizedPath: string;
    readonly ownership: "CANDIDATE_OWNED" | "SHARED";
    readonly content: string;
  }[],
) {
  return {
    sourceSnapshotId: "snapshot-1",
    sourceRevision: "b".repeat(40),
    resourceVersionObservationId: "observation-1",
    resourceSourceLinkId: "source-link-1",
    candidateRootId: "root-1",
    ownershipTopologyFingerprint: sha,
    acquisitionResultFingerprint: sha,
    sourceSnapshotFingerprint: sha,
    providerMetadataFingerprint: sha,
    policyVersions: M03_POLICY_VERSIONS,
    providerMetadata: {
      providerRepositoryId: "repo-1",
      name: "demo-repository",
      owner: "ExampleOrg",
      description: "An inert fixture",
      archived: false,
      visibility: "PUBLIC",
      tags: [] as readonly string[],
      latestRelease: null,
      license: { spdxId: null, source: null },
      fork: { isFork: false, parentCanonicalUrl: null },
    },
    documents,
  };
}

describe("M03 deterministic structured extraction", () => {
  it("retains only heading-scoped candidate-independent references when analysis is enabled", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-readme",
          sourceDocumentId: "doc-readme",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED",
          content: [
            "## Overview",
            "Overview evidence.",
            "### Detail",
            "Nested overview evidence.",
            "## Unrelated",
            "Must not be an operation input.",
            "## Features",
            "- Feature evidence.",
          ].join("\n"),
        },
      ]),
    );

    expect(result.operationSourceReferenceIds.SYNTHESIZE_OUTCOME).toHaveLength(2);
    expect(result.operationSourceReferenceIds.NORMALIZE_CAPABILITIES).toHaveLength(1);
    const operationIds = new Set(Object.values(result.operationSourceReferenceIds).flat());
    const operationLines = result.sourceReferences
      .filter((reference) => operationIds.has(reference.id))
      .map((reference) =>
        reference.kind === "DOCUMENT" && reference.locator.type === "LINE_RANGE"
          ? reference.locator.startLine
          : null,
      )
      .sort((left, right) => (left ?? 0) - (right ?? 0));
    expect(operationLines).toEqual([2, 4, 8]);
    const serializedIds = result.sourceReferences.map(({ id }) => id);
    const exactUnion = [
      ...new Set([
        ...result.deterministicCandidates.flatMap(({ sourceReferenceIds }) => sourceReferenceIds),
        ...result.conflicts.flatMap(({ sourceReferenceIds }) => sourceReferenceIds),
        ...result.fields.flatMap(({ evidenceIds }) => evidenceIds),
        ...result.routingSourceReferenceIds,
        ...Object.values(result.operationSourceReferenceIds).flatMap((ids) => ids),
      ]),
    ].sort();
    expect(serializedIds).toEqual([...serializedIds].sort());
    expect(serializedIds).toEqual(exactUnion);
  });

  it("omits operation-only references when analysis is disabled", () => {
    const result = extractDeterministic({
      ...fixtureInput([
        {
          sourceEntryId: "entry-readme",
          sourceDocumentId: "doc-readme",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED",
          content: "## Overview\nCandidate-independent evidence only.",
        },
      ]),
      includeOperationReferences: false,
    });

    expect(result.operationSourceReferenceIds).toEqual({});
    expect(
      result.sourceReferences.filter(
        (reference) =>
          reference.kind === "DOCUMENT" &&
          reference.locator.type === "LINE_RANGE" &&
          reference.locator.path === "README.md" &&
          reference.locator.startLine === 2,
      ),
    ).toEqual([]);
  });

  it("produces all 20 fields with attributable candidates from one eligible inert corpus", () => {
    const result = extractDeterministic({
      sourceSnapshotId: "snapshot-1",
      sourceRevision: "b".repeat(40),
      resourceVersionObservationId: "observation-1",
      resourceSourceLinkId: "source-link-1",
      candidateRootId: "root-1",
      ownershipTopologyFingerprint: sha,
      acquisitionResultFingerprint: sha,
      sourceSnapshotFingerprint: sha,
      providerMetadataFingerprint: sha,
      policyVersions: M03_POLICY_VERSIONS,
      providerMetadata: {
        providerRepositoryId: "repo-1",
        name: "demo-repository",
        owner: "ExampleOrg",
        description: "An inert fixture",
        archived: false,
        visibility: "PUBLIC",
        tags: [],
        latestRelease: null,
        license: { spdxId: null, source: null },
        fork: { isFork: false, parentCanonicalUrl: null },
      },
      documents: [
        {
          sourceEntryId: "entry-skill",
          sourceDocumentId: "doc-skill",
          normalizedPath: "SKILL.md",
          ownership: "CANDIDATE_OWNED",
          content: [
            "---",
            "name: Demo Skill",
            "version: 1.2.3",
            "author: '@creator'",
            "organization: Example Org",
            "license: MIT",
            "categories:",
            "  - Automation",
            "compatibility:",
            "  - 'RUNTIME: Node.js; constraint: >=22'",
            "permissions:",
            "  - 'NETWORK_ACCESS; scope: api.example.invalid'",
            "deprecated: false",
            "---",
            "# Demo Skill",
            "",
            "## Installation",
            "To install, use pnpm.",
            "```sh",
            "pnpm add demo",
            "```",
            "After installation, invoke the skill.",
            "",
            "## Configuration",
            "- `DEMO_MODE` (`optional`, `string`); default: `safe`",
            "",
            "External service: Example API; optional",
            "Limitation: Requires a network connection.",
          ].join("\n"),
        },
        {
          sourceEntryId: "entry-package",
          sourceDocumentId: "doc-package",
          normalizedPath: "package.json",
          ownership: "CANDIDATE_OWNED",
          content: JSON.stringify({
            name: "demo-package",
            version: "1.2.3",
            license: "MIT",
            dependencies: { zod: "4.4.3" },
            optionalDependencies: { undici: "7.0.0" },
            devDependencies: { vitest: "4.1.10" },
            engines: { node: ">=22" },
          }),
        },
        {
          sourceEntryId: "entry-source",
          sourceDocumentId: "doc-source",
          normalizedPath: "src/index.ts",
          ownership: "CANDIDATE_OWNED",
          content: "await fetch('https://example.invalid');",
        },
      ],
    });

    expect(result.fields.map(({ fieldKey }) => fieldKey)).toEqual(M03_FIELD_KEYS);
    expect(result.fields).toHaveLength(20);
    for (const field of result.fields) {
      const parsed = ExtractionFieldResultV1Schema.safeParse(field);
      expect(
        parsed.success,
        `${field.fieldKey}: ${parsed.success ? "" : parsed.error.message}`,
      ).toBe(true);
    }
    expect(result.fields.find(({ fieldKey }) => fieldKey === "canonical_skill_name")).toMatchObject(
      {
        status: "EXPLICIT",
        value: { normalizedName: "demo skill", displayName: "Demo Skill" },
      },
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "version")).toMatchObject({
      status: "EXPLICIT",
      value: { state: "RESOLVED", selectedOrNull: { versionLabel: "1.2.3" } },
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "source_revision")).toMatchObject({
      status: "EXPLICIT",
      value: { immutableRevision: "b".repeat(40) },
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "license")).toMatchObject({
      status: "EXPLICIT",
      value: { state: "CONFIRMED", selectedOrNull: { spdxExpressionOrNull: "MIT" } },
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "installation")).toMatchObject({
      status: "EXPLICIT",
      value: { state: "EXPLICIT_COMPLETE" },
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "dependencies")).toMatchObject({
      status: "EXPLICIT",
      value: expect.arrayContaining([
        expect.objectContaining({ normalizedName: "zod", scope: "REQUIRED" }),
        expect.objectContaining({ normalizedName: "undici", scope: "OPTIONAL" }),
        expect.objectContaining({ normalizedName: "vitest", scope: "DEVELOPMENT" }),
      ]),
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "permissions")).toMatchObject({
      status: "INFERRED",
      confidence: 0.7,
      warningCodes: ["PERMISSION_NOT_PROVEN_ABSENT"],
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "outcome_candidate")).toMatchObject({
      status: "MISSING",
      value: null,
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "maintenance_signals")).toMatchObject({
      status: "EXPLICIT",
      value: {
        archived: false,
        providerUpdatedAtOrNull: null,
        matchingReleaseOrTagDateOrNull: null,
        changelogPresent: false,
        currentChangelogEntryOrNull: null,
        explicitDeprecation: false,
        predecessorMetadataComplete: false,
      },
    });
    expect(result.extractorRefs.length).toBeGreaterThan(0);
    expect(result.sourceReferences.length).toBeGreaterThan(0);
    expect(result.deterministicCandidates.length).toBeGreaterThan(0);
    expect(result.conflicts).toEqual([]);
  });

  it("extracts README installation and declarations instead of limiting Markdown to SKILL.md", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-readme",
          sourceDocumentId: "doc-readme",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED",
          content: [
            "# README Skill",
            "",
            "## Installation",
            "To install, use pnpm.",
            "```sh",
            "pnpm add readme-skill",
            "```",
            "After installation, invoke it.",
            "",
            "## Configuration",
            "- `MODE` (`optional`, `string`); default: `safe`",
            "",
            "External service: Example API; required",
            "",
            "Permission: NETWORK_ACCESS; scope: api.example.invalid",
            "",
            "Compatibility: RUNTIME: Node.js; constraint: >=22",
            "",
            "Limitation: Requires network access.",
          ].join("\n"),
        },
      ]),
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "canonical_skill_name")).toMatchObject(
      {
        status: "EXPLICIT",
        value: { displayName: "README Skill" },
      },
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "installation")).toMatchObject({
      status: "EXPLICIT",
      value: { state: "EXPLICIT_COMPLETE" },
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "configuration")).toMatchObject({
      status: "EXPLICIT",
      value: [expect.objectContaining({ normalizedName: "mode" })],
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "external_services")).toMatchObject({
      value: [expect.objectContaining({ normalizedServiceName: "example api" })],
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "permissions")).toMatchObject({
      value: [expect.objectContaining({ kind: "NETWORK_ACCESS", evidenceLevel: "EXPLICIT" })],
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "compatibility")).toMatchObject({
      value: [expect.objectContaining({ subjectKind: "RUNTIME", normalizedSubject: "node.js" })],
    });
  });

  it("never interprets README delimiters as SKILL front matter", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-readme-front-matter",
          sourceDocumentId: "doc-readme-front-matter",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED",
          content: ["---", "name: README Spoof", "version: 9.9.9", "---", "# Real README"].join(
            "\n",
          ),
        },
      ]),
    );
    expect(
      result.deterministicCandidates.some(({ sourceType }) => sourceType === "SKILL_METADATA"),
    ).toBe(false);
    expect(
      result.sourceReferences.some(
        (reference) => reference.kind === "DOCUMENT" && reference.locator.type === "DATA_POINTER",
      ),
    ).toBe(false);
  });

  it("parses only the exact SKILL Markdown body after the front-matter state machine", () => {
    const closed = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-skill-closed",
          sourceDocumentId: "doc-skill-closed",
          normalizedPath: "SKILL.md",
          ownership: "CANDIDATE_OWNED",
          content: [
            "---",
            "name: Demo",
            "description: |",
            "  ## Installation",
            "  ```sh",
            "  echo frontmatter",
            "  ```",
            "---",
            "# Body title",
          ].join("\n"),
        },
      ]),
    );
    expect(closed.fields.find(({ fieldKey }) => fieldKey === "installation")).toMatchObject({
      status: "MISSING",
      value: { state: "MISSING", paths: [] },
    });
    expect(JSON.stringify(closed)).not.toContain("echo frontmatter");
    expect(closed.fields.find(({ fieldKey }) => fieldKey === "canonical_skill_name")).toMatchObject(
      {
        status: "EXPLICIT",
        value: { displayName: "Demo" },
      },
    );

    const bareCrCloser = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-skill-bare-cr",
          sourceDocumentId: "doc-skill-bare-cr",
          normalizedPath: "SKILL.md",
          ownership: "CANDIDATE_OWNED",
          content: "---\nname: Must Not Parse\n---\r",
        },
      ]),
    );
    expect(
      bareCrCloser.fields.find(({ fieldKey }) => fieldKey === "canonical_skill_name"),
    ).toMatchObject({
      status: "REVIEW_REQUIRED",
      warningCodes: expect.arrayContaining(["DETERMINISTIC_DECLARATION_INVALID"]),
    });
    expect(JSON.stringify(bareCrCloser)).not.toContain("Must Not Parse");

    const bareCrOpener = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-skill-bare-cr-opener",
          sourceDocumentId: "doc-skill-bare-cr-opener",
          normalizedPath: "SKILL.md",
          ownership: "CANDIDATE_OWNED",
          content: "---\rname: Must Also Not Parse\n---\n",
        },
      ]),
    );
    expect(
      bareCrOpener.fields.find(({ fieldKey }) => fieldKey === "canonical_skill_name")?.value,
    ).not.toMatchObject({ displayName: "Must Also Not Parse" });
    expect(JSON.stringify(bareCrOpener)).not.toContain("Must Also Not Parse");

    const bodyContent = [
      "---",
      "name: Demo",
      "---",
      "## Installation",
      "To install, prepare the fixture.",
      "```sh",
      "echo body",
      "```",
      "After installation, verify the fixture.",
    ].join("\n");
    const closedWithBody = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-skill-body",
          sourceDocumentId: "doc-skill-body",
          normalizedPath: "SKILL.md",
          ownership: "CANDIDATE_OWNED",
          content: bodyContent,
        },
      ]),
    );
    expect(closedWithBody.fields.find(({ fieldKey }) => fieldKey === "installation")).toMatchObject(
      {
        status: "EXPLICIT",
        value: {
          state: "EXPLICIT_COMPLETE",
          paths: [
            {
              commands: [{ commandTextOrNull: "echo body" }],
            },
          ],
        },
      },
    );
    const bodyCommandReference = closedWithBody.sourceReferences.find(
      (reference) =>
        reference.kind === "DOCUMENT" &&
        reference.locator.type === "BYTE_RANGE" &&
        reference.excerptOrNull === "echo body",
    );
    expect(bodyCommandReference).toMatchObject({
      locator: {
        startByte: Buffer.byteLength(
          "---\nname: Demo\n---\n## Installation\nTo install, prepare the fixture.\n```sh\n",
        ),
      },
    });

    const unclosed = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-skill-unclosed",
          sourceDocumentId: "doc-skill-unclosed",
          normalizedPath: "SKILL.md",
          ownership: "CANDIDATE_OWNED",
          content: ["---", "name: Demo", "## Installation", "```sh", "echo unclosed", "```"].join(
            "\n",
          ),
        },
      ]),
    );
    expect(unclosed.fields.find(({ fieldKey }) => fieldKey === "installation")).toMatchObject({
      status: "MISSING",
      value: { state: "MISSING", paths: [] },
    });
    expect(JSON.stringify(unclosed)).not.toContain("echo unclosed");
  });

  it("extracts typed attribution and deprecation declarations while rejecting untyped attribution", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-readme",
          sourceDocumentId: "doc-readme",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED",
          content: [
            "Creator: @creator",
            "",
            "- Organization: Example Org",
            "",
            "Attribution: Unproven Party",
            "",
            "Deprecated: true",
          ].join("\n"),
        },
      ]),
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "creator_candidates")).toMatchObject({
      status: "REVIEW_REQUIRED",
      value: [],
      claimClass: "NO_CLAIM",
      deterministicCandidateIds: [],
      evidenceIds: [],
      warningCodes: ["PREDECESSOR_METADATA_INSUFFICIENT", "ATTRIBUTION_TYPE_UNPROVEN"],
    });
    expect(
      result.fields.find(({ fieldKey }) => fieldKey === "organization_candidates"),
    ).toMatchObject({
      status: "REVIEW_REQUIRED",
      value: [],
      claimClass: "NO_CLAIM",
      deterministicCandidateIds: [],
      evidenceIds: [],
      warningCodes: ["PREDECESSOR_METADATA_INSUFFICIENT", "ATTRIBUTION_TYPE_UNPROVEN"],
    });
    expect(result.deterministicCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "creator_candidates",
          value: expect.objectContaining({ displayName: "@creator", basis: "SOURCE_DECLARATION" }),
        }),
        expect.objectContaining({
          fieldKey: "organization_candidates",
          value: expect.objectContaining({
            displayName: "Example Org",
            basis: "SOURCE_DECLARATION",
          }),
        }),
      ]),
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "maintenance_signals")).toMatchObject({
      value: { explicitDeprecation: true },
    });
    expect(
      result.deterministicCandidates.filter(
        (candidate) =>
          candidate.fieldKey === "maintenance_signals" &&
          (candidate.value as { kind?: string }).kind === "EXPLICIT_DEPRECATION",
      ),
    ).toHaveLength(1);
  });

  it("extracts package author and maintainers with their exact manifest bases", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-package",
          sourceDocumentId: "doc-package",
          normalizedPath: "package.json",
          ownership: "CANDIDATE_OWNED",
          content: JSON.stringify({ author: { name: "@author" }, maintainers: ["Maintainer"] }),
        },
      ]),
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "creator_candidates")).toMatchObject({
      value: expect.arrayContaining([
        expect.objectContaining({ displayName: "@author", basis: "MANIFEST_AUTHOR" }),
        expect.objectContaining({ displayName: "Maintainer", basis: "MANIFEST_MAINTAINER" }),
      ]),
    });
  });

  it("parses the approved Python manifest selectors and conflicts same-tier versions", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-package",
          sourceDocumentId: "doc-package",
          normalizedPath: "package.json",
          ownership: "CANDIDATE_OWNED",
          content: JSON.stringify({ name: "demo", version: "1.0.0", license: "MIT" }),
        },
        {
          sourceEntryId: "entry-python",
          sourceDocumentId: "doc-python",
          normalizedPath: "pyproject.toml",
          ownership: "CANDIDATE_OWNED",
          content: [
            "[project]",
            'name = "demo"',
            'version = "2.0.0"',
            'license = "Apache-2.0"',
            'dependencies = ["requests>=2", "pydantic==2.12.5"]',
            'requires-python = ">=3.11"',
          ].join("\n"),
        },
      ]),
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "version")).toMatchObject({
      status: "CONFLICTING",
      value: { state: "CONFLICTING", selectedOrNull: null, preferredCandidateIdOrNull: null },
      conflictIds: [expect.stringMatching(/^conf_[a-f0-9]{64}$/u)],
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "license")).toMatchObject({
      status: "CONFLICTING",
      value: { state: "CONFLICTING", selectedOrNull: null, preferredCandidateIdOrNull: null },
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "dependencies")).toMatchObject({
      value: expect.arrayContaining([
        expect.objectContaining({ ecosystemOrNull: "PYPI", normalizedName: "requests" }),
      ]),
    });
    expect(result.conflicts).toHaveLength(2);
  });

  it("parses Python attribution, inline license text, and optional dependency groups", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-python",
          sourceDocumentId: "doc-python",
          normalizedPath: "pyproject.toml",
          ownership: "CANDIDATE_OWNED",
          content: [
            "[project]",
            'authors = [{name = "@author"}]',
            "maintainers = [{name = 'Maintainer'}]",
            'license = {text = "Custom license terms"}',
            "[project.optional-dependencies]",
            'docs = ["mkdocs>=1", "sphinx==8"]',
          ].join("\n"),
        },
      ]),
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "creator_candidates")).toMatchObject({
      value: expect.arrayContaining([
        expect.objectContaining({ displayName: "@author", basis: "MANIFEST_AUTHOR" }),
        expect.objectContaining({ displayName: "Maintainer", basis: "MANIFEST_MAINTAINER" }),
      ]),
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "license")).toMatchObject({
      status: "EXPLICIT",
      value: { state: "CUSTOM", selectedOrNull: { spdxExpressionOrNull: null } },
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "dependencies")).toMatchObject({
      value: expect.arrayContaining([
        expect.objectContaining({ normalizedName: "mkdocs", scope: "OPTIONAL" }),
        expect.objectContaining({ normalizedName: "sphinx", scope: "OPTIONAL" }),
      ]),
    });
  });

  it("recognizes configuration declarations only under the owning heading", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-readme",
          sourceDocumentId: "doc-readme",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED",
          content: [
            "## Examples",
            "- `IGNORED` (`required`, `string`)",
            "## Configuration",
            "- `RETAINED` (`optional`, `boolean`)",
          ].join("\n"),
        },
      ]),
    );
    const configuration = result.fields.find(({ fieldKey }) => fieldKey === "configuration");
    expect(configuration).toMatchObject({
      value: [expect.objectContaining({ name: "RETAINED" })],
    });
    expect(JSON.stringify(configuration)).not.toContain("IGNORED");
  });

  it("does not treat fenced examples as headings or declarations", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-readme",
          sourceDocumentId: "doc-readme",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED",
          content: [
            "```md",
            "# Fake Title",
            "## Configuration",
            "- `FAKE` (`required`, `string`)",
            "Permission: NETWORK_ACCESS",
            "External service: Fake API; required",
            "Limitation: Fake limitation",
            "```",
          ].join("\n"),
        },
      ]),
    );
    for (const fieldKey of ["configuration", "external_services", "limitations"]) {
      expect(result.fields.find((field) => field.fieldKey === fieldKey)).toMatchObject({
        status: "MISSING",
      });
    }
    expect(
      result.deterministicCandidates.filter((candidate) => candidate.fieldKey === "permissions"),
    ).toHaveLength(0);
    expect(result.fields.find(({ fieldKey }) => fieldKey === "canonical_skill_name")).toMatchObject(
      { value: { displayName: "demo-repository" } },
    );
  });

  it("suppresses contact/credential-like source values across deterministic value families", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-package",
          sourceDocumentId: "doc-package",
          normalizedPath: "package.json",
          ownership: "CANDIDATE_OWNED",
          content: JSON.stringify({
            name: "maintainer@example.com",
            version: "api_key=synthetic-placeholder-value",
            dependencies: { "contact@example.com": "1.0.0" },
          }),
        },
      ]),
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "canonical_skill_name")).toMatchObject(
      {
        status: "REVIEW_REQUIRED",
        value: null,
        warningCodes: ["PERSONAL_CONTACT_WITHHELD"],
      },
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "version")).toMatchObject({
      status: "REVIEW_REQUIRED",
      value: { state: "REVIEW_REQUIRED", selectedOrNull: null },
      warningCodes: ["SECRET_LIKE_VALUE_WITHHELD"],
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "dependencies")).toMatchObject({
      status: "REVIEW_REQUIRED",
      value: [],
      warningCodes: ["PERSONAL_CONTACT_WITHHELD"],
    });
    expect(JSON.stringify(result)).not.toContain("maintainer@example.com");
    expect(JSON.stringify(result)).not.toContain("synthetic-placeholder-value");
    expect(JSON.stringify(result)).not.toContain("contact@example.com");
    expect(result.routingSourceReferenceIds.length).toBeGreaterThan(0);
    const exactUnion = [
      ...new Set([
        ...result.deterministicCandidates.flatMap(({ sourceReferenceIds }) => sourceReferenceIds),
        ...result.conflicts.flatMap(({ sourceReferenceIds }) => sourceReferenceIds),
        ...result.fields.flatMap(({ evidenceIds }) => evidenceIds),
        ...result.routingSourceReferenceIds,
        ...Object.values(result.operationSourceReferenceIds).flatMap((ids) => ids),
      ]),
    ].sort();
    expect(result.sourceReferences.map(({ id }) => id)).toEqual(exactUnion);
  });

  it("applies the closed configuration sensitivity precedence without retaining defaults", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-readme",
          sourceDocumentId: "doc-readme",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED",
          content: [
            "## Configuration",
            "- `CONTACT` (`optional`, `string`); default: `maintainer@example.com`",
            "- `TOKEN` (`required`, `secret`); default: `safe-placeholder`",
            "- `BROKEN` (`optional`, `bool`); default: `api_key=synthetic-placeholder-value`",
          ].join("\n"),
        },
      ]),
    );
    const field = result.fields.find(({ fieldKey }) => fieldKey === "configuration");
    expect(field).toMatchObject({
      status: "REVIEW_REQUIRED",
      value: [],
      claimClass: "NO_CLAIM",
      deterministicCandidateIds: [],
      evidenceIds: [],
      warningCodes: [
        "DETERMINISTIC_DECLARATION_INVALID",
        "SENSITIVE_CONFIGURATION_DEFAULT_WITHHELD",
        "PERSONAL_CONTACT_WITHHELD",
      ],
    });
    expect(JSON.stringify(result)).not.toContain("maintainer@example.com");
    expect(JSON.stringify(result)).not.toContain("synthetic-placeholder-value");
    const configurationSupportIds = result.deterministicCandidates
      .filter(({ fieldKey }) => fieldKey === "configuration")
      .flatMap(({ sourceReferenceIds }) => sourceReferenceIds);
    expect(configurationSupportIds).toHaveLength(2);
    expect(result.routingSourceReferenceIds).toHaveLength(1);
    expect(result.routingSourceReferenceIds[0]).not.toBe(configurationSupportIds[0]);
    expect(result.routingSourceReferenceIds[0]).not.toBe(configurationSupportIds[1]);
    const exactReferenceUnion = [
      ...new Set([
        ...result.deterministicCandidates.flatMap(({ sourceReferenceIds }) => sourceReferenceIds),
        ...result.conflicts.flatMap(({ sourceReferenceIds }) => sourceReferenceIds),
        ...result.fields.flatMap(({ evidenceIds }) => evidenceIds),
        ...result.routingSourceReferenceIds,
        ...Object.values(result.operationSourceReferenceIds).flatMap((ids) => ids),
      ]),
    ].sort();
    expect(result.sourceReferences.map(({ id }) => id)).toEqual(exactReferenceUnion);
  });

  it("routes whole-document duplicate/unclosed parser invalidity to exact owning fields", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-package",
          sourceDocumentId: "doc-package",
          normalizedPath: "package.json",
          ownership: "CANDIDATE_OWNED",
          content: '{"name":"first","name":"second","version":"1.0.0"}',
        },
        {
          sourceEntryId: "entry-skill",
          sourceDocumentId: "doc-skill",
          normalizedPath: "SKILL.md",
          ownership: "CANDIDATE_OWNED",
          content: ["---", "name: Demo", "version: 1.0.0"].join("\n"),
        },
      ]),
    );
    for (const fieldKey of [
      "canonical_skill_name",
      "creator_candidates",
      "organization_candidates",
      "version",
      "license",
      "categories",
      "dependencies",
      "permissions",
      "compatibility",
    ]) {
      expect(result.fields.find((field) => field.fieldKey === fieldKey)).toMatchObject({
        status: "REVIEW_REQUIRED",
        warningCodes: expect.arrayContaining(["DETERMINISTIC_DECLARATION_INVALID"]),
      });
    }
  });

  it("does not coerce wrong-type Skill metadata scalars or list members", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-skill",
          sourceDocumentId: "doc-skill",
          normalizedPath: "SKILL.md",
          ownership: "CANDIDATE_OWNED",
          content: [
            "---",
            "name: 123",
            "author:",
            "  name: false",
            "categories:",
            "  - true",
            "permissions:",
            "  - 7",
            "---",
          ].join("\n"),
        },
      ]),
    );
    for (const fieldKey of [
      "canonical_skill_name",
      "creator_candidates",
      "categories",
      "permissions",
    ]) {
      expect(result.fields.find((field) => field.fieldKey === fieldKey)).toMatchObject({
        status: "REVIEW_REQUIRED",
        warningCodes: expect.arrayContaining(["DETERMINISTIC_DECLARATION_INVALID"]),
      });
    }
    expect(JSON.stringify(result.fields)).not.toContain('"displayName":"123"');
  });

  it("applies closed source-affinity and unsupported-language routing", () => {
    const input = fixtureInput([
      {
        sourceEntryId: "entry-rust",
        sourceDocumentId: "doc-rust",
        normalizedPath: "src/main.rs",
        ownership: "CANDIDATE_OWNED",
        content: "std::fs::read_to_string(path);",
      },
      {
        sourceEntryId: "entry-manifest",
        sourceDocumentId: "doc-manifest",
        normalizedPath: "custom-manifest.yaml",
        ownership: "CANDIDATE_OWNED",
        content: "name: ignored",
      },
    ]);
    const result = extractDeterministic({
      ...input,
      unavailableEntries: [
        {
          normalizedPath: "README.md",
          disposition: "SKIPPED",
          reasonCodes: ["LINE_LIMIT_EXCEEDED"],
        },
      ],
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "permissions")).toMatchObject({
      status: "UNSUPPORTED",
      value: [],
      warningCodes: [
        "SOURCE_CORPUS_INCOMPLETE",
        "UNSUPPORTED_STATIC_LANGUAGE",
        "PERMISSION_NOT_PROVEN_ABSENT",
      ],
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "dependencies")).toMatchObject({
      status: "REVIEW_REQUIRED",
      warningCodes: ["SOURCE_CORPUS_INCOMPLETE", "UNRECOGNIZED_MANIFEST"],
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "maintenance_signals")).toMatchObject({
      status: "EXPLICIT",
      warningCodes: ["PREDECESSOR_METADATA_INSUFFICIENT"],
    });
  });

  it("extracts requirements, license-file, changelog, and inferred-installation artifacts", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-readme",
          sourceDocumentId: "doc-readme",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED",
          content: ["# Artifact Skill", "", "## Install", "Install with Homebrew."].join("\n"),
        },
        {
          sourceEntryId: "entry-requirements",
          sourceDocumentId: "doc-requirements",
          normalizedPath: "requirements.txt",
          ownership: "CANDIDATE_OWNED",
          content: ["requests>=2", "pydantic==2.12.5"].join("\n"),
        },
        {
          sourceEntryId: "entry-license",
          sourceDocumentId: "doc-license",
          normalizedPath: "LICENSE",
          ownership: "CANDIDATE_OWNED",
          content: "SPDX-License-Identifier: Apache-2.0\n",
        },
        {
          sourceEntryId: "entry-changelog",
          sourceDocumentId: "doc-changelog",
          normalizedPath: "CHANGELOG.md",
          ownership: "CANDIDATE_OWNED",
          content: ["# Changelog", "", "## [2.3.4]", "", "- Current release"].join("\n"),
        },
      ]),
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "installation")).toMatchObject({
      status: "INFERRED",
      confidence: 0.7,
      claimClass: "FORMAT_INFERENCE",
      value: {
        state: "INFERRED",
        paths: [expect.objectContaining({ inferredMechanismOrNull: "Homebrew" })],
      },
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "dependencies")).toMatchObject({
      status: "EXPLICIT",
      value: expect.arrayContaining([
        expect.objectContaining({ normalizedName: "requests", ecosystemOrNull: "PYPI" }),
      ]),
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "license")).toMatchObject({
      status: "EXPLICIT",
      value: { state: "CONFIRMED", selectedOrNull: { spdxExpressionOrNull: "Apache-2.0" } },
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "version")).toMatchObject({
      status: "EXPLICIT",
      value: {
        state: "RESOLVED",
        selectedOrNull: { versionLabel: "2.3.4", versionSource: "CHANGELOG" },
      },
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "maintenance_signals")).toMatchObject({
      value: {
        changelogPresent: true,
        currentChangelogEntryOrNull: "2.3.4",
        explicitDeprecation: false,
      },
    });
  });

  it("uses the frozen raw ATX profile for the first non-title changelog heading", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-changelog-atx",
          sourceDocumentId: "doc-changelog-atx",
          normalizedPath: "CHANGELOG.md",
          ownership: "CANDIDATE_OWNED",
          content: [
            "# Changelog",
            "",
            "> ## [9.9.9]",
            "",
            "Unreleased",
            "----------",
            "",
            "   ## [2.3.4] ###",
            "",
            "- Current release",
          ].join("\n"),
        },
      ]),
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "version")).toMatchObject({
      status: "EXPLICIT",
      value: {
        state: "RESOLVED",
        selectedOrNull: { versionLabel: "2.3.4", versionSource: "CHANGELOG" },
      },
    });
  });

  it("does not create a changelog line locator from a bare-CR pseudo-heading", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-changelog-bare-cr",
          sourceDocumentId: "doc-changelog-bare-cr",
          normalizedPath: "CHANGELOG.md",
          ownership: "CANDIDATE_OWNED",
          content: "# Changelog\r## [9.9.9]\n",
        },
      ]),
    );
    expect(JSON.stringify(result)).not.toContain("9.9.9");
    expect(
      result.sourceReferences.filter(
        (reference) =>
          reference.kind === "DOCUMENT" &&
          reference.locator.type === "LINE_RANGE" &&
          reference.locator.path === "CHANGELOG.md",
      ),
    ).toEqual([]);
  });

  it("retains privacy-safe routing provenance for every sensitive generic value family", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-readme-sensitive",
          sourceDocumentId: "doc-readme-sensitive",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED",
          content: [
            "# api_key=synthetic-placeholder-value maintainer@example.com",
            "Creator: api_key=synthetic-placeholder-value maintainer@example.com",
          ].join("\n"),
        },
        {
          sourceEntryId: "entry-package-sensitive",
          sourceDocumentId: "doc-package-sensitive",
          normalizedPath: "package.json",
          ownership: "CANDIDATE_OWNED",
          content: JSON.stringify({ author: "maintainer@example.com" }),
        },
        {
          sourceEntryId: "entry-pyproject-sensitive",
          sourceDocumentId: "doc-pyproject-sensitive",
          normalizedPath: "pyproject.toml",
          ownership: "CANDIDATE_OWNED",
          content: ["[project]", 'authors = [{name = "api_key=synthetic-placeholder-value"}]'].join(
            "\n",
          ),
        },
      ]),
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "canonical_skill_name")).toMatchObject(
      {
        status: "REVIEW_REQUIRED",
        value: null,
        warningCodes: expect.arrayContaining([
          "SECRET_LIKE_VALUE_WITHHELD",
          "PERSONAL_CONTACT_WITHHELD",
        ]),
      },
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "creator_candidates")).toMatchObject({
      status: "REVIEW_REQUIRED",
      value: [],
      warningCodes: expect.arrayContaining([
        "SECRET_LIKE_VALUE_WITHHELD",
        "PERSONAL_CONTACT_WITHHELD",
      ]),
    });
    expect(result.routingSourceReferenceIds.length).toBeGreaterThanOrEqual(4);
    for (const id of result.routingSourceReferenceIds) {
      const reference = result.sourceReferences.find((candidate) => candidate.id === id);
      expect(reference).toMatchObject({ excerptOrNull: null });
    }
    expect(JSON.stringify(result)).not.toContain("synthetic-placeholder-value");
    expect(JSON.stringify(result)).not.toContain("maintainer@example.com");
  });

  it("maps Skill body declarations to original absolute lines", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-skill-lines",
          sourceDocumentId: "doc-skill-lines",
          normalizedPath: "SKILL.md",
          ownership: "CANDIDATE_OWNED",
          content: [
            "---",
            "name: Demo",
            "---",
            "Creator: Example Creator",
            "",
            "Organization: Example Org",
            "",
            "Deprecated: true",
          ].join("\n"),
        },
      ]),
    );
    const lines = result.sourceReferences
      .filter(
        (reference) =>
          reference.kind === "DOCUMENT" &&
          reference.locator.type === "LINE_RANGE" &&
          reference.locator.path === "SKILL.md" &&
          ["Creator: Example Creator", "Organization: Example Org", "Deprecated: true"].includes(
            reference.excerptOrNull ?? "",
          ),
      )
      .map((reference) =>
        reference.kind === "DOCUMENT" && reference.locator.type === "LINE_RANGE"
          ? reference.locator.startLine
          : null,
      );
    expect([...lines].sort((left, right) => Number(left) - Number(right))).toEqual([4, 6, 8]);
  });

  it("implements invalid and disagreeing explicit-deprecation review branches", () => {
    const invalid = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-invalid-deprecation",
          sourceDocumentId: "doc-invalid-deprecation",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED",
          content: "Deprecated: maybe",
        },
      ]),
    );
    expect(invalid.fields.find(({ fieldKey }) => fieldKey === "maintenance_signals")).toMatchObject(
      {
        status: "REVIEW_REQUIRED",
        value: { explicitDeprecation: null },
        warningCodes: expect.arrayContaining(["DETERMINISTIC_DECLARATION_INVALID"]),
        evidenceIds: expect.arrayContaining([expect.stringMatching(/^src_[a-f0-9]{64}$/u)]),
      },
    );

    const disagreeing = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-true",
          sourceDocumentId: "doc-true",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED",
          content: "Deprecated: true",
        },
        {
          sourceEntryId: "entry-false",
          sourceDocumentId: "doc-false",
          normalizedPath: "SKILL.md",
          ownership: "CANDIDATE_OWNED",
          content: "Deprecated: false",
        },
      ]),
    );
    expect(
      disagreeing.fields.find(({ fieldKey }) => fieldKey === "maintenance_signals"),
    ).toMatchObject({
      status: "REVIEW_REQUIRED",
      value: { explicitDeprecation: null },
      conflictIds: [],
      warningCodes: expect.arrayContaining(["MULTIPLE_EXPLICIT_VALUES"]),
    });
  });

  it("collapses equal semantic values while retaining provenance union", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-readme-one",
          sourceDocumentId: "doc-readme-one",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED",
          content: "Creator: Same Creator",
        },
        {
          sourceEntryId: "entry-readme-two",
          sourceDocumentId: "doc-readme-two",
          normalizedPath: "SKILL.md",
          ownership: "CANDIDATE_OWNED",
          content: "Creator: Same Creator",
        },
      ]),
    );
    const field = result.fields.find(({ fieldKey }) => fieldKey === "creator_candidates");
    expect(field).toMatchObject({ status: "EXPLICIT" });
    expect(field?.value).toEqual([
      expect.objectContaining({
        displayName: "Same Creator",
        sourceReferenceIds: [
          expect.stringMatching(/^src_[a-f0-9]{64}$/u),
          expect.stringMatching(/^src_[a-f0-9]{64}$/u),
        ],
      }),
    ]);
  });

  it("creates the exact installation conflict for divergent same-label paths", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-install-divergence",
          sourceDocumentId: "doc-install-divergence",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED",
          content: [
            "## Installation",
            "### Package manager",
            "To install, use pnpm.",
            "```sh",
            "pnpm add demo",
            "```",
            "Verify: invoke demo.",
            "### Package manager",
            "To install, use npm.",
            "```sh",
            "pnpm add demo-alt",
            "```",
            "Verify: invoke demo.",
          ].join("\n"),
        },
      ]),
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "installation")).toMatchObject({
      status: "CONFLICTING",
      value: { state: "UNSAFE_OR_AMBIGUOUS", paths: [] },
      conflictIds: [expect.stringMatching(/^conf_[a-f0-9]{64}$/u)],
    });
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        fieldKey: "installation",
        reasonCode: "INSTALLATION_PATHS_DIVERGE",
        candidateIds: [
          expect.stringMatching(/^cand_[a-f0-9]{64}$/u),
          expect.stringMatching(/^cand_[a-f0-9]{64}$/u),
        ],
      }),
    ]);
  });

  it("sorts dependency values by the field-specific tuple independent of source order", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-package-order",
          sourceDocumentId: "doc-package-order",
          normalizedPath: "package.json",
          ownership: "CANDIDATE_OWNED",
          content: JSON.stringify({ dependencies: { zeta: "1.0.0", alpha: "1.0.0" } }),
        },
      ]),
    );
    const field = result.fields.find(({ fieldKey }) => fieldKey === "dependencies");
    expect(
      (field?.value as readonly { normalizedName: string }[]).map(
        ({ normalizedName }) => normalizedName,
      ),
    ).toEqual(["alpha", "zeta"]);
  });

  it("propagates candidate-independent excerpt sensitivity to operation fields and AI state", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-sensitive-operation",
          sourceDocumentId: "doc-sensitive-operation",
          normalizedPath: "README.md",
          ownership: "SHARED",
          content: [
            "## Features",
            "Contact maintainer@example.com using api_key=synthetic-placeholder-value.",
          ].join("\n"),
        },
      ]),
    );
    const operationReferenceId = result.operationSourceReferenceIds.NORMALIZE_CAPABILITIES?.[0];
    expect(operationReferenceId).toBeDefined();
    expect(result.sensitiveReferenceWarningCodesById[operationReferenceId ?? ""]).toEqual([
      "SECRET_LIKE_VALUE_WITHHELD",
      "PERSONAL_CONTACT_WITHHELD",
    ]);
    expect(result.sourceReferences.find(({ id }) => id === operationReferenceId)).toMatchObject({
      excerptHashOrNull: null,
      excerptOrNull: null,
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "capabilities")).toMatchObject({
      status: "REVIEW_REQUIRED",
      value: [],
      claimClass: "NO_CLAIM",
      warningCodes: ["SECRET_LIKE_VALUE_WITHHELD", "PERSONAL_CONTACT_WITHHELD"],
    });
  });

  it("retains safe static candidates while propagating locator and unrelated excerpt sensitivity", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-sensitive-locator",
          sourceDocumentId: "doc-sensitive-locator",
          normalizedPath: "src/maintainer@example.com.ts",
          ownership: "CANDIDATE_OWNED",
          content: 'fetch("https://example.invalid");',
        },
        {
          sourceEntryId: "entry-sensitive-excerpt",
          sourceDocumentId: "doc-sensitive-excerpt",
          normalizedPath: "src/network.ts",
          ownership: "CANDIDATE_OWNED",
          content: 'fetch("https://example.invalid"); // maintainer@example.com',
        },
      ]),
    );
    const permissionCandidates = result.deterministicCandidates.filter(
      ({ fieldKey }) => fieldKey === "permissions",
    );
    expect(permissionCandidates).toHaveLength(2);
    expect(
      permissionCandidates.filter(({ warningCodes }) =>
        warningCodes.includes("PERSONAL_CONTACT_WITHHELD"),
      ),
    ).toHaveLength(1);
    expect(result.fields.find(({ fieldKey }) => fieldKey === "permissions")).toMatchObject({
      status: "REVIEW_REQUIRED",
      value: [],
      claimClass: "NO_CLAIM",
      warningCodes: expect.arrayContaining(["PERSONAL_CONTACT_WITHHELD"]),
    });
    const sensitiveReferences = result.sourceReferences.filter(
      ({ id }) => (result.sensitiveReferenceWarningCodesById[id]?.length ?? 0) > 0,
    );
    expect(sensitiveReferences).toHaveLength(2);
    expect(
      sensitiveReferences.some(
        (reference) =>
          reference.kind === "DOCUMENT" && reference.locator.type === "SENSITIVE_LOCATOR",
      ),
    ).toBe(true);
    expect(sensitiveReferences.every(({ excerptOrNull }) => excerptOrNull === null)).toBe(true);
  });

  it("preserves deterministic conflicts before applying sensitive-reference precedence", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-explicit-permission",
          sourceDocumentId: "doc-explicit-permission",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED",
          content: "Permission: NETWORK_ACCESS",
        },
        {
          sourceEntryId: "entry-static-permission",
          sourceDocumentId: "doc-static-permission",
          normalizedPath: "src/network.ts",
          ownership: "CANDIDATE_OWNED",
          content: 'fetch("https://example.invalid"); // maintainer@example.com',
        },
      ]),
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "permissions")).toMatchObject({
      status: "CONFLICTING",
      conflictIds: [expect.stringMatching(/^conf_[a-f0-9]{64}$/u)],
      warningCodes: expect.arrayContaining(["PERSONAL_CONTACT_WITHHELD"]),
    });
    expect(result.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "permissions",
          reasonCode: "PERMISSION_ASSERTIONS_DIVERGE",
        }),
      ]),
    );
  });

  it("routes sensitive-label and invalid commandless installation contexts without paths", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-install-sensitive-label",
          sourceDocumentId: "doc-install-sensitive-label",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED",
          content: ["## Installation", "### maintainer@example.com", "Install with pnpm."].join(
            "\n",
          ),
        },
        {
          sourceEntryId: "entry-install-invalid",
          sourceDocumentId: "doc-install-invalid",
          normalizedPath: "SKILL.md",
          ownership: "CANDIDATE_OWNED",
          content: ["## Installation", "Use whichever mechanism you prefer."].join("\n"),
        },
      ]),
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "installation")).toMatchObject({
      status: "REVIEW_REQUIRED",
      value: { state: "UNSAFE_OR_AMBIGUOUS", paths: [] },
      claimClass: "NO_CLAIM",
      deterministicCandidateIds: [],
      evidenceIds: [],
      warningCodes: expect.arrayContaining([
        "DETERMINISTIC_DECLARATION_INVALID",
        "PERSONAL_CONTACT_WITHHELD",
      ]),
    });
    const routedInstallationReferences = result.sourceReferences.filter(({ id }) =>
      result.routingSourceReferenceIds.includes(id),
    );
    expect(routedInstallationReferences).toHaveLength(2);
    expect(routedInstallationReferences.every(({ excerptOrNull }) => excerptOrNull === null)).toBe(
      false,
    );
    expect(JSON.stringify(result)).not.toContain("maintainer@example.com");
  });

  it("retains a safe installation path while routing a suppressed sensitive path label", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-install-mixed-sensitive-label",
          sourceDocumentId: "doc-install-mixed-sensitive-label",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED",
          content: [
            "## Installation",
            "### Local",
            "```sh",
            "tool setup local",
            "```",
            "### maintainer@example.com",
            "```sh",
            "tool setup private",
            "```",
          ].join("\n"),
        },
      ]),
    );
    const installation = result.fields.find(({ fieldKey }) => fieldKey === "installation");
    expect(installation).toMatchObject({
      status: "REVIEW_REQUIRED",
      value: { state: "UNSAFE_OR_AMBIGUOUS", paths: [{ labelOrNull: "Local" }] },
      warningCodes: expect.arrayContaining(["PERSONAL_CONTACT_WITHHELD"]),
    });
    expect(result.routingSourceReferenceIds.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain("maintainer@example.com");
  });

  it("routes an exact context reference for an unclosed installation fence", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-install-unclosed-fence",
          sourceDocumentId: "doc-install-unclosed-fence",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED",
          content: ["## Installation", "```sh", "echo incomplete"].join("\n"),
        },
      ]),
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "installation")).toMatchObject({
      status: "REVIEW_REQUIRED",
      value: { state: "UNSAFE_OR_AMBIGUOUS", paths: [] },
      warningCodes: expect.arrayContaining(["DETERMINISTIC_DECLARATION_INVALID"]),
    });
    const routed = result.sourceReferences.filter(({ id }) =>
      result.routingSourceReferenceIds.includes(id),
    );
    expect(routed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locator: expect.objectContaining({ type: "LINE_RANGE", startLine: 2, endLine: 3 }),
        }),
      ]),
    );
  });

  it("retains exact routed line references for every no-candidate Markdown declaration", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-invalid-declarations",
          sourceDocumentId: "doc-invalid-declarations",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED",
          content: [
            "## Declarations",
            "- External service:",
            "- Limitation:",
            "- Permission: NOT_A_PERMISSION",
            "- Compatibility: NOT_A_KIND: demo",
            "- Creator:",
            "- Organization:",
            "- Attribution: Ambiguous Party",
          ].join("\n"),
        },
      ]),
    );
    const routedLines = result.sourceReferences
      .filter(({ id }) => result.routingSourceReferenceIds.includes(id))
      .map((reference) =>
        reference.kind === "DOCUMENT" && reference.locator.type === "LINE_RANGE"
          ? reference.locator.startLine
          : null,
      )
      .sort((left, right) => (left ?? 0) - (right ?? 0));
    expect(routedLines).toEqual([2, 3, 4, 5, 6, 7, 8]);
    for (const fieldKey of [
      "external_services",
      "limitations",
      "permissions",
      "compatibility",
      "creator_candidates",
      "organization_candidates",
    ] as const)
      expect(result.fields.find((field) => field.fieldKey === fieldKey)).toMatchObject({
        status: "REVIEW_REQUIRED",
      });
  });

  it("uses separate closed compatibility and permission authorities for Skill metadata", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-skill-enums",
          sourceDocumentId: "doc-skill-enums",
          normalizedPath: "SKILL.md",
          ownership: "CANDIDATE_OWNED",
          content: [
            "---",
            "compatibility:",
            "  - 'RUNTIME: Python; constraint: >=3.11'",
            "permissions:",
            "  - BOGUS_PERMISSION",
            "---",
          ].join("\n"),
        },
      ]),
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "compatibility")).toMatchObject({
      status: "EXPLICIT",
      value: [expect.objectContaining({ subjectKind: "RUNTIME", subject: "Python" })],
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "permissions")).toMatchObject({
      status: "REVIEW_REQUIRED",
      value: [],
      deterministicCandidateIds: [],
      warningCodes: expect.arrayContaining(["DETERMINISTIC_DECLARATION_INVALID"]),
    });
    expect(
      result.sourceReferences.some(
        (reference) =>
          result.routingSourceReferenceIds.includes(reference.id) &&
          reference.kind === "DOCUMENT" &&
          reference.locator.type === "DATA_POINTER" &&
          reference.locator.dataPointer === "/permissions/0",
      ),
    ).toBe(true);
  });

  it("rejects structured objects with members outside the exact selector shapes", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-package-shape",
          sourceDocumentId: "doc-package-shape",
          normalizedPath: "package.json",
          ownership: "CANDIDATE_OWNED",
          content: JSON.stringify({ author: { name: "Alice", role: "maintainer" } }),
        },
        {
          sourceEntryId: "entry-python-shape",
          sourceDocumentId: "doc-python-shape",
          normalizedPath: "pyproject.toml",
          ownership: "CANDIDATE_OWNED",
          content: [
            "[project]",
            'name = "demo"',
            'license = { text = "Custom", file = "LICENSE" }',
          ].join("\n"),
        },
      ]),
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "creator_candidates")).toMatchObject({
      status: "REVIEW_REQUIRED",
      value: [],
      deterministicCandidateIds: [],
    });
    expect(result.fields.find(({ fieldKey }) => fieldKey === "license")).toMatchObject({
      status: "REVIEW_REQUIRED",
      value: { state: "REVIEW_REQUIRED", selectedOrNull: null },
      deterministicCandidateIds: [],
    });
    const routedPointers = result.sourceReferences
      .filter(({ id }) => result.routingSourceReferenceIds.includes(id))
      .map((reference) =>
        reference.kind === "DOCUMENT" &&
        (reference.locator.type === "JSON_POINTER" || reference.locator.type === "DATA_POINTER")
          ? "jsonPointer" in reference.locator
            ? reference.locator.jsonPointer
            : reference.locator.dataPointer
          : null,
      );
    expect(routedPointers).toEqual(expect.arrayContaining(["/author", "/project/license"]));
  });

  it("parses valid PEP-508 extras, markers, and direct references exactly", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-pep508-valid",
          sourceDocumentId: "doc-pep508-valid",
          normalizedPath: "requirements.txt",
          ownership: "CANDIDATE_OWNED",
          content: [
            'requests[security]>=2.31; python_version >= "3.11"',
            'demo @ https://example.invalid/demo.whl ; python_version < "4"',
            "url-semicolon @ https://example.invalid/a;b.whl",
            "empty-extra[]>=1",
            'platform-only; sys_platform == "darwin"',
            'compact-marker>=1;python_version>="3.11"and os_name=="posix"',
            "spaced-version >= 1",
            "relative-reference @ ../demo.whl",
            'compact-operators>=1;python_version>="3.11"andpython_full_version<"4"',
          ].join("\n"),
        },
      ]),
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "dependencies")).toMatchObject({
      status: "EXPLICIT",
      value: expect.arrayContaining([
        expect.objectContaining({
          normalizedName: "requests",
          declaredConstraintOrNull: '[security]>=2.31; python_version >= "3.11"',
        }),
        expect.objectContaining({
          normalizedName: "demo",
          declaredConstraintOrNull: '@ https://example.invalid/demo.whl ; python_version < "4"',
        }),
        expect.objectContaining({
          normalizedName: "url-semicolon",
          declaredConstraintOrNull: "@ https://example.invalid/a;b.whl",
        }),
        expect.objectContaining({
          normalizedName: "empty-extra",
          declaredConstraintOrNull: "[]>=1",
        }),
        expect.objectContaining({
          normalizedName: "platform-only",
          declaredConstraintOrNull: '; sys_platform == "darwin"',
        }),
        expect.objectContaining({
          normalizedName: "compact-marker",
          declaredConstraintOrNull: '>=1;python_version>="3.11"and os_name=="posix"',
        }),
        expect.objectContaining({
          normalizedName: "spaced-version",
          declaredConstraintOrNull: ">= 1",
        }),
        expect.objectContaining({
          normalizedName: "relative-reference",
          declaredConstraintOrNull: "@ ../demo.whl",
        }),
        expect.objectContaining({
          normalizedName: "compact-operators",
          declaredConstraintOrNull: '>=1;python_version>="3.11"andpython_full_version<"4"',
        }),
      ]),
    });
  });

  it("rejects malformed PEP-508 marker and direct-reference token boundaries", () => {
    for (const declaration of [
      "demo>=1; python_version >= 3.11",
      'demo>=1; "linux"in sys_platform',
      'demo @ https://example.invalid/demo.whl; python_version < "4"',
      "demo>=1,",
      'demo>=1;\rpython_version >= "3.11"',
      "demo @ |",
      "demo @ bad%escape",
      "demo @ http://[invalid",
      "demo @ //user@@example.invalid/demo.whl",
      "demo @ relative|reference",
    ]) {
      const result = extractDeterministic(
        fixtureInput([
          {
            sourceEntryId: "entry-invalid-pep508",
            sourceDocumentId: "doc-invalid-pep508",
            normalizedPath: "requirements.txt",
            ownership: "CANDIDATE_OWNED",
            content: declaration,
          },
        ]),
      );
      expect(result.fields.find(({ fieldKey }) => fieldKey === "dependencies")).toMatchObject({
        status: "REVIEW_REQUIRED",
        value: [],
        deterministicCandidateIds: [],
      });
    }
  });

  it("routes a requirements document when any declaration is outside PEP-508", () => {
    const result = extractDeterministic(
      fixtureInput([
        {
          sourceEntryId: "entry-pep508-invalid",
          sourceDocumentId: "doc-pep508-invalid",
          normalizedPath: "requirements.txt",
          ownership: "CANDIDATE_OWNED",
          content: ["requests>=2", "broken>>=2"].join("\n"),
        },
      ]),
    );
    expect(result.fields.find(({ fieldKey }) => fieldKey === "dependencies")).toMatchObject({
      status: "REVIEW_REQUIRED",
      value: [],
      deterministicCandidateIds: [],
    });
    expect(
      result.sourceReferences.some(
        (reference) =>
          result.routingSourceReferenceIds.includes(reference.id) &&
          reference.kind === "DOCUMENT" &&
          reference.locator.type === "LINE_RANGE" &&
          reference.locator.startLine === 2,
      ),
    ).toBe(true);
  });

  it("routes exact locator-only provenance for invalid license signals", () => {
    const result = extractDeterministic({
      ...fixtureInput([
        {
          sourceEntryId: "entry-invalid-skill-license",
          sourceDocumentId: "doc-invalid-skill-license",
          normalizedPath: "SKILL.md",
          ownership: "CANDIDATE_OWNED",
          content: ["---", "license: NOASSERTION", "---"].join("\n"),
        },
        {
          sourceEntryId: "entry-invalid-license-file",
          sourceDocumentId: "doc-invalid-license-file",
          normalizedPath: "LICENSE",
          ownership: "CANDIDATE_OWNED",
          content: "SPDX-License-Identifier: NOT-A-LICENSE\n",
        },
      ]),
      providerMetadata: {
        ...fixtureInput([]).providerMetadata,
        license: { spdxId: "NOASSERTION", source: "provider" },
      },
    });
    const routed = result.sourceReferences.filter(({ id }) =>
      result.routingSourceReferenceIds.includes(id),
    );
    expect(
      routed.some(
        (reference) =>
          reference.kind === "DOCUMENT" &&
          reference.locator.type === "DATA_POINTER" &&
          reference.locator.dataPointer === "/license",
      ),
    ).toBe(true);
    expect(
      routed.some(
        (reference) =>
          reference.kind === "DOCUMENT" &&
          reference.locator.type === "LINE_RANGE" &&
          reference.locator.path === "LICENSE" &&
          reference.locator.startLine === 1,
      ),
    ).toBe(true);
    expect(
      routed.some(
        (reference) =>
          reference.kind === "SNAPSHOT_METADATA" &&
          reference.locator.type === "LICENSE_FIELD" &&
          reference.locator.metadataKey === "spdxId",
      ),
    ).toBe(true);
  });
});
