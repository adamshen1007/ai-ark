/* eslint-disable @typescript-eslint/prefer-regexp-exec -- RegExp.exec is prohibited by the acquired-source safety gate. */
import type {
  ExtractionFieldResultV1,
  ExtractionSourceReferenceV1,
  M03AnalysisSubOperation,
  M03FieldKey,
  M03WarningCode,
} from "@ai-ark/contracts";
import { M03_FIELD_KEYS, M03_WARNING_CODES } from "@ai-ark/contracts";
import { isIP } from "node:net";
import { parse as parseToml } from "smol-toml";
import { parseDocument, visit } from "yaml";

import {
  extractInstallationContexts,
  markdownBodyForDocument,
  parseMarkdownProfile,
} from "./commands.js";
import { scanFrozenM01Lines, skillFrontMatterBoundary } from "./source-lines.js";
import {
  canonicalJson,
  canonicalizeSpdx,
  compareUnsignedUtf8,
  handleKey,
  normalizeDependencyName,
  semverKey,
  textKey,
} from "./normalization.js";
import { scanStaticPermissions } from "./permissions.js";
import {
  createDocumentReference,
  createInventoryAbsenceReference,
  createSnapshotMetadataReference,
  M03ProvenanceAuthority,
  scanSensitiveText,
  sha256Hex,
} from "./provenance.js";

const operationDocumentationHeadingKeys: readonly [M03AnalysisSubOperation, readonly string[]][] = [
  ["NORMALIZE_CAPABILITIES", ["capabilities", "features", "what it does"]],
  ["MAP_TASKS", ["tasks", "workflow", "what it does"]],
  ["SYNTHESIZE_OUTCOME", ["overview", "summary", "purpose"]],
  ["PROPOSE_USE_CASES", ["use cases", "examples"]],
  ["PROPOSE_TARGET_USERS", ["target users", "audience", "who is this for"]],
  ["SYNTHESIZE_BEST_FOR_NOT_IDEAL", ["best for", "not ideal for", "limitations"]],
  ["SYNTHESIZE_LIMITATIONS", ["limitations", "known issues", "not ideal for"]],
];

const operationAffectedFields: Readonly<Record<M03AnalysisSubOperation, readonly M03FieldKey[]>> = {
  NORMALIZE_CAPABILITIES: ["capabilities"],
  MAP_TASKS: ["tasks"],
  SYNTHESIZE_OUTCOME: ["outcome_candidate"],
  PROPOSE_USE_CASES: ["use_cases"],
  PROPOSE_TARGET_USERS: ["target_user_candidates"],
  SYNTHESIZE_BEST_FOR_NOT_IDEAL: ["target_user_candidates", "limitations"],
  SYNTHESIZE_LIMITATIONS: ["limitations"],
  INFER_PERMISSIONS_FROM_STATIC_EVIDENCE: ["permissions"],
  DETECT_AMBIGUITY: [],
};

export interface M03SourceDocument {
  readonly sourceEntryId: string;
  readonly sourceDocumentId: string;
  readonly normalizedPath: string;
  readonly ownership: "CANDIDATE_OWNED" | "SHARED";
  readonly content: string;
}

export interface DeterministicExtractionInput {
  readonly sourceSnapshotId: string;
  readonly sourceRevision: string;
  readonly resourceVersionObservationId: string;
  readonly resourceSourceLinkId: string;
  readonly candidateRootId: string;
  readonly ownershipTopologyFingerprint: string;
  readonly acquisitionResultFingerprint: string;
  readonly sourceSnapshotFingerprint: string;
  readonly providerMetadataFingerprint: string;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly providerMetadata: {
    readonly providerRepositoryId: string;
    readonly name: string;
    readonly owner: string;
    readonly description: string | null;
    readonly archived: boolean;
    readonly visibility: string;
    readonly tags: readonly string[];
    readonly latestRelease: string | null;
    readonly license: { readonly spdxId: string | null; readonly source: string | null };
    readonly fork: { readonly isFork: boolean; readonly parentCanonicalUrl: string | null };
  };
  readonly documents: readonly M03SourceDocument[];
  readonly unavailableEntries?: readonly {
    readonly normalizedPath: string;
    readonly disposition: "SKIPPED" | "QUARANTINED";
    readonly reasonCodes: readonly string[];
  }[];
  readonly includeOperationReferences?: boolean;
  readonly provenanceAuthority?: M03ProvenanceAuthority;
}

export interface ExtractorRefV1 {
  readonly id: string;
  readonly kind: "DETERMINISTIC_PARSER" | "AI_ANALYSIS";
  readonly name: string;
  readonly semanticVersion: "1.0.0";
  readonly ownedFieldKeys: readonly M03FieldKey[];
  readonly configurationFingerprint: string;
  readonly codeBundleFingerprint: string;
}

export interface ExtractionCandidateV1 {
  readonly id: string;
  readonly fieldKey: M03FieldKey;
  readonly value: unknown;
  readonly normalizedKey: string;
  readonly extractorRefId: string;
  readonly supportNature: "EXACT" | "INFERENTIAL";
  readonly claimClass:
    "SOURCE_FACT" | "REPOSITORY_METADATA" | "STATIC_CODE_INDICATOR" | "FORMAT_INFERENCE";
  readonly sourceType: string;
  readonly sourceReferenceIds: readonly string[];
  readonly confidence: number;
  readonly warningCodes: readonly M03WarningCode[];
  readonly candidateFingerprint: string;
}

export interface ExtractionConflictV1 {
  readonly id: string;
  readonly fieldKey: M03FieldKey;
  readonly reasonCode:
    | "SAME_TIER_DISTINCT_VALUES"
    | "CROSS_TIER_DISTINCT_VALUES"
    | "LICENSE_METADATA_TEXT_DISAGREE"
    | "INSTALLATION_PATHS_DIVERGE"
    | "COMPATIBILITY_ASSERTIONS_DIVERGE"
    | "PERMISSION_ASSERTIONS_DIVERGE"
    | "TAXONOMY_MAPPING_AMBIGUOUS"
    | "AI_DETERMINISTIC_DISAGREEMENT"
    | "AI_MULTIPLE_INTERPRETATIONS";
  readonly candidateIds: readonly string[];
  readonly aiProposalIds: readonly string[];
  readonly preferredCandidateIdOrNull: null;
  readonly preferenceIsNonCanonicalGuidance: false;
  readonly sourceReferenceIds: readonly string[];
}

const extractorSpecifications: readonly Omit<
  ExtractorRefV1,
  "id" | "configurationFingerprint" | "codeBundleFingerprint"
>[] = [
  {
    kind: "DETERMINISTIC_PARSER",
    name: "provider-metadata-v1",
    semanticVersion: "1.0.0",
    ownedFieldKeys: ["canonical_skill_name", "version", "license", "maintenance_signals"],
  },
  {
    kind: "DETERMINISTIC_PARSER",
    name: "skill-metadata-v1",
    semanticVersion: "1.0.0",
    ownedFieldKeys: [
      "canonical_skill_name",
      "creator_candidates",
      "organization_candidates",
      "version",
      "license",
      "categories",
      "permissions",
      "compatibility",
      "maintenance_signals",
    ],
  },
  {
    kind: "DETERMINISTIC_PARSER",
    name: "package-json-v1",
    semanticVersion: "1.0.0",
    ownedFieldKeys: [
      "canonical_skill_name",
      "creator_candidates",
      "organization_candidates",
      "version",
      "license",
      "dependencies",
      "compatibility",
    ],
  },
  {
    kind: "DETERMINISTIC_PARSER",
    name: "pyproject-v1",
    semanticVersion: "1.0.0",
    ownedFieldKeys: [
      "canonical_skill_name",
      "creator_candidates",
      "organization_candidates",
      "version",
      "license",
      "dependencies",
      "compatibility",
    ],
  },
  {
    kind: "DETERMINISTIC_PARSER",
    name: "requirements-v1",
    semanticVersion: "1.0.0",
    ownedFieldKeys: ["dependencies"],
  },
  {
    kind: "DETERMINISTIC_PARSER",
    name: "license-v1",
    semanticVersion: "1.0.0",
    ownedFieldKeys: ["license"],
  },
  {
    kind: "DETERMINISTIC_PARSER",
    name: "changelog-v1",
    semanticVersion: "1.0.0",
    ownedFieldKeys: ["version", "maintenance_signals"],
  },
  {
    kind: "DETERMINISTIC_PARSER",
    name: "markdown-declarations-v1",
    semanticVersion: "1.0.0",
    ownedFieldKeys: [
      "canonical_skill_name",
      "creator_candidates",
      "organization_candidates",
      "outcome_candidate",
      "capabilities",
      "tasks",
      "use_cases",
      "target_user_candidates",
      "configuration",
      "external_services",
      "permissions",
      "compatibility",
      "limitations",
      "maintenance_signals",
    ],
  },
  {
    kind: "DETERMINISTIC_PARSER",
    name: "command-v1",
    semanticVersion: "1.0.0",
    ownedFieldKeys: ["installation"],
  },
  {
    kind: "DETERMINISTIC_PARSER",
    name: "installation-mechanism-v1",
    semanticVersion: "1.0.0",
    ownedFieldKeys: ["installation"],
  },
  {
    kind: "DETERMINISTIC_PARSER",
    name: "static-permission-v1",
    semanticVersion: "1.0.0",
    ownedFieldKeys: ["external_services", "permissions"],
  },
  {
    kind: "DETERMINISTIC_PARSER",
    name: "inventory-absence-v1",
    semanticVersion: "1.0.0",
    ownedFieldKeys: ["maintenance_signals"],
  },
  {
    kind: "DETERMINISTIC_PARSER",
    name: "source-revision-v1",
    semanticVersion: "1.0.0",
    ownedFieldKeys: ["version", "source_revision"],
  },
];

const aiExtractorSpecification: Omit<
  ExtractorRefV1,
  "id" | "configurationFingerprint" | "codeBundleFingerprint"
> = {
  kind: "AI_ANALYSIS",
  name: "structured-extraction-analysis-v1",
  semanticVersion: "1.0.0",
  ownedFieldKeys: [
    "outcome_candidate",
    "capabilities",
    "tasks",
    "use_cases",
    "target_user_candidates",
    "permissions",
    "limitations",
  ],
};

export function createExtractorRegistry(
  policyFingerprint: string,
  analysisEnabled = false,
): readonly ExtractorRefV1[] {
  return [...extractorSpecifications, ...(analysisEnabled ? [aiExtractorSpecification] : [])]
    .map((specification) => {
      const record = {
        ...specification,
        configurationFingerprint: sha256Hex(
          canonicalJson({ name: specification.name, policyFingerprint }),
        ),
        codeBundleFingerprint: sha256Hex(
          canonicalJson({
            name: specification.name,
            semanticVersion: specification.semanticVersion,
          }),
        ),
      };
      return { ...record, id: `xtr_${sha256Hex(canonicalJson(record))}` };
    })
    .sort((left, right) => compareUnsignedUtf8(left.id, right.id));
}

function warningSort(values: Iterable<M03WarningCode>): M03WarningCode[] {
  const set = new Set(values);
  return M03_WARNING_CODES.filter((warning) => set.has(warning));
}

function createCandidate(
  input: Omit<ExtractionCandidateV1, "id" | "candidateFingerprint">,
): ExtractionCandidateV1 {
  const payload = {
    ...input,
    sourceReferenceIds: [...new Set(input.sourceReferenceIds)].sort(),
    warningCodes: warningSort(input.warningCodes),
  };
  const candidateFingerprint = sha256Hex(canonicalJson(payload));
  return { ...payload, id: `cand_${candidateFingerprint}`, candidateFingerprint };
}

function valueIdentity(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((member) => valueIdentity(member));
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Readonly<Record<string, unknown>>)
        .filter(([key]) => key !== "sourceReferenceIds")
        .map(([key, member]) => [key, valueIdentity(member)]),
    );
  return value;
}

function structKey(value: unknown): string {
  return `struct:${sha256Hex(canonicalJson(valueIdentity(value)))}`;
}

function containsInterpolation(value: unknown): boolean {
  if (typeof value === "string") return value.includes("${");
  if (Array.isArray(value)) return value.some(containsInterpolation);
  if (value !== null && typeof value === "object")
    return Object.entries(value).some(
      ([key, member]) => key.includes("${") || containsInterpolation(member),
    );
  return false;
}

function isJsonCompatibleData(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonCompatibleData);
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype)
    return Object.entries(value).every(([, member]) => isJsonCompatibleData(member));
  return false;
}

function parseSkillFrontMatter(content: string): {
  readonly fields: Readonly<Record<string, unknown>>;
} | null {
  const boundary = skillFrontMatterBoundary("SKILL.md", content);
  if (boundary.state !== "CLOSED") return null;
  try {
    const document = parseDocument(boundary.yamlContent, {
      version: "1.2",
      schema: "core",
      strict: true,
      uniqueKeys: true,
      merge: false,
      resolveKnownTags: false,
      stringKeys: true,
    });
    if (document.errors.length > 0 || document.warnings.length > 0) return null;
    const parseState = { prohibitedNode: false };
    visit(document, {
      Alias: () => {
        parseState.prohibitedNode = true;
      },
      Node: (_key, node) => {
        if (("anchor" in node && node.anchor) || ("tag" in node && node.tag))
          parseState.prohibitedNode = true;
      },
      Pair: (_key, pair) => {
        if (
          pair.key !== null &&
          typeof pair.key === "object" &&
          "value" in pair.key &&
          pair.key.value === "<<"
        )
          parseState.prohibitedNode = true;
      },
    });
    if (parseState.prohibitedNode) return null;
    const fields: unknown = document.toJS({ maxAliasCount: 0 });
    if (
      fields === null ||
      typeof fields !== "object" ||
      Array.isArray(fields) ||
      containsInterpolation(fields) ||
      !isJsonCompatibleData(fields)
    )
      return null;
    return { fields: fields as Readonly<Record<string, unknown>> };
  } catch {
    return null;
  }
}

function skillFrontMatterInvalid(content: string): boolean {
  const boundary = skillFrontMatterBoundary("SKILL.md", content);
  if (boundary.state === "NONE") return false;
  return parseSkillFrontMatter(content) === null;
}

function hasDuplicateJsonObjectKeys(content: string): boolean {
  const stack: (
    | { readonly kind: "OBJECT"; readonly keys: Set<string>; expectingKey: boolean }
    | { readonly kind: "ARRAY" }
  )[] = [];
  for (let index = 0; index < content.length; index += 1) {
    const scalar = content[index] ?? "";
    if (scalar === '"') {
      const start = index;
      index += 1;
      while (index < content.length) {
        const current = content[index] ?? "";
        if (current === "\\") index += 2;
        else if (current === '"') break;
        else index += 1;
      }
      if (index >= content.length) return false;
      const top = stack.at(-1);
      let cursor = index + 1;
      while (/\s/u.test(content[cursor] ?? "")) cursor += 1;
      if (top?.kind === "OBJECT" && top.expectingKey && content[cursor] === ":") {
        let key: string;
        try {
          key = JSON.parse(content.slice(start, index + 1)) as string;
        } catch {
          return false;
        }
        if (top.keys.has(key)) return true;
        top.keys.add(key);
        top.expectingKey = false;
      }
      continue;
    }
    if (scalar === "{") stack.push({ kind: "OBJECT", keys: new Set(), expectingKey: true });
    else if (scalar === "[") stack.push({ kind: "ARRAY" });
    else if (scalar === "}" || scalar === "]") stack.pop();
    else if (scalar === ",") {
      const top = stack.at(-1);
      if (top?.kind === "OBJECT") top.expectingKey = true;
    }
  }
  return false;
}

function parseSimplePyproject(content: string):
  | {
      readonly ok: true;
      readonly project: Readonly<
        Record<
          string,
          | string
          | readonly string[]
          | readonly { readonly name: string }[]
          | Readonly<{ text?: string; file?: string }>
          | Readonly<Record<string, readonly string[]>>
        >
      >;
    }
  | { readonly ok: false } {
  try {
    const parsed: unknown = parseToml(content);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
      return { ok: false };
    if (containsInterpolation(parsed)) return { ok: false };
    const project = (parsed as Readonly<Record<string, unknown>>).project;
    if (project === undefined) return { ok: true, project: {} };
    if (project === null || typeof project !== "object" || Array.isArray(project))
      return { ok: false };
    return { ok: true, project: project as never };
  } catch {
    return { ok: false };
  }
}

function isExactStringObject<Key extends string>(
  value: unknown,
  key: Key,
): value is Readonly<Record<Key, string>> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    Object.keys(value)[0] === key &&
    typeof (value as Readonly<Record<string, unknown>>)[key] === "string"
  );
}

const pep508NamePattern = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/u;
const pep508MarkerVariables = new Set([
  "python_version",
  "python_full_version",
  "os_name",
  "sys_platform",
  "platform_release",
  "platform_system",
  "platform_version",
  "platform_machine",
  "platform_python_implementation",
  "implementation_name",
  "implementation_version",
  "extra",
]);

type Pep508MarkerToken =
  | { readonly kind: "LPAREN" | "RPAREN" | "AND" | "OR" }
  | { readonly kind: "OP"; readonly value: string }
  | { readonly kind: "VARIABLE" | "STRING"; readonly value: string };

const pep508MarkerStringCharacters = new Set(
  " \tABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789().{}-_*#:;,/?!~`@$%^&=+|<>[]".split(
    "",
  ),
);
const trimPep508Whitespace = (value: string): string => value.replace(/^[ \t]+|[ \t]+$/gu, "");

function tokenizePep508Marker(marker: string): readonly Pep508MarkerToken[] | null {
  const tokens: Pep508MarkerToken[] = [];
  let cursor = 0;
  while (cursor < marker.length) {
    if (/[ \t]/u.test(marker[cursor] ?? "")) {
      cursor += 1;
      continue;
    }
    const remainder = marker.slice(cursor);
    if (remainder.startsWith("(")) {
      tokens.push({ kind: "LPAREN" });
      cursor += 1;
      continue;
    }
    if (remainder.startsWith(")")) {
      tokens.push({ kind: "RPAREN" });
      cursor += 1;
      continue;
    }
    const quote = remainder[0];
    if (quote === '"' || quote === "'") {
      let end = 1;
      for (; end < remainder.length; end += 1) {
        const scalar = remainder[end] ?? "";
        if (scalar === quote) break;
        if (!pep508MarkerStringCharacters.has(scalar)) return null;
      }
      if (end >= remainder.length) return null;
      tokens.push({ kind: "STRING", value: remainder.slice(0, end + 1) });
      cursor += end + 1;
      continue;
    }
    const symbolicOperator = remainder.match(/^(===|~=|==|!=|<=|>=|<|>)/u)?.[1];
    if (symbolicOperator !== undefined) {
      tokens.push({ kind: "OP", value: symbolicOperator });
      cursor += symbolicOperator.length;
      continue;
    }
    if (remainder.startsWith("and") || remainder.startsWith("or")) {
      const operator = remainder.startsWith("and") ? "and" : "or";
      tokens.push({ kind: operator === "and" ? "AND" : "OR" });
      cursor += operator.length;
      continue;
    }
    const word = remainder.match(/^[A-Za-z_][A-Za-z0-9_]*/u)?.[0];
    if (word === undefined) return null;
    if (word === "in") {
      if (cursor === 0 || !/[ \t]/u.test(marker[cursor - 1] ?? "")) return null;
      tokens.push({ kind: "OP", value: "in" });
    } else if (word === "not") {
      const inMatch = remainder.slice(word.length).match(/^[ \t]+in/u)?.[0];
      if (cursor === 0 || !/[ \t]/u.test(marker[cursor - 1] ?? "") || inMatch === undefined)
        return null;
      tokens.push({ kind: "OP", value: "not in" });
      cursor += inMatch.length;
    } else if (pep508MarkerVariables.has(word)) tokens.push({ kind: "VARIABLE", value: word });
    else return null;
    cursor += word.length;
  }
  return tokens;
}

function validPep508Marker(marker: string): boolean {
  const tokens = tokenizePep508Marker(marker);
  if (tokens === null || tokens.length === 0) return false;
  let cursor = 0;
  const operand = (): boolean => {
    const token = tokens[cursor];
    if (token?.kind !== "VARIABLE" && token?.kind !== "STRING") return false;
    cursor += 1;
    return true;
  };
  const comparison = (): boolean => {
    if (!operand()) return false;
    if (tokens[cursor]?.kind !== "OP") return false;
    cursor += 1;
    return operand();
  };
  const atom = (): boolean => {
    if (tokens[cursor]?.kind !== "LPAREN") return comparison();
    cursor += 1;
    if (!orExpression() || tokens[cursor]?.kind !== "RPAREN") return false;
    cursor += 1;
    return true;
  };
  const andExpression = (): boolean => {
    if (!atom()) return false;
    while (tokens[cursor]?.kind === "AND") {
      cursor += 1;
      if (!atom()) return false;
    }
    return true;
  };
  const orExpression = (): boolean => {
    if (!andExpression()) return false;
    while (tokens[cursor]?.kind === "OR") {
      cursor += 1;
      if (!andExpression()) return false;
    }
    return true;
  };
  return orExpression() && cursor === tokens.length;
}

function validPep440SpecifierSet(value: string): boolean {
  if (value === "") return true;
  let candidate = trimPep508Whitespace(value);
  if (candidate.startsWith("(") || candidate.endsWith(")")) {
    if (!(candidate.startsWith("(") && candidate.endsWith(")"))) return false;
    candidate = trimPep508Whitespace(candidate.slice(1, -1));
  }
  if (candidate === "") return false;
  const rawSpecifiers = candidate.split(",");
  if (rawSpecifiers.length === 0) return false;
  return rawSpecifiers.every((rawSpecifier) => {
    const specifier = trimPep508Whitespace(rawSpecifier);
    const match = specifier.match(/^(===|~=|==|!=|<=|>=|<|>)[ \t]*([^\s,;()<>!=~]+)$/u);
    if (match === null) return false;
    const operator = match[1] ?? "";
    const version = match[2] ?? "";
    if (operator === "===") return version.length > 0;
    if (!/^[A-Za-z0-9][A-Za-z0-9.*+!_-]*(?:\.[A-Za-z0-9*+!_-]+)*$/u.test(version)) return false;
    if (version.includes("*"))
      return (operator === "==" || operator === "!=") && /^\d+(?:\.\d+)*\.\*$/u.test(version);
    if (operator === "~=") return /^\d+(?:\.\d+)+(?:[A-Za-z0-9._+-]*)?$/u.test(version);
    return true;
  });
}

const uriPcharPattern = /^(?:[A-Za-z0-9._~!$&'()*+,;=:@-]|%[0-9A-Fa-f]{2})*$/u;
const uriSegmentNzNcPattern = /^(?:[A-Za-z0-9._~!$&'()*+,;=@-]|%[0-9A-Fa-f]{2})+$/u;
const uriQueryOrFragmentPattern = /^(?:[A-Za-z0-9._~!$&'()*+,;=:@/?-]|%[0-9A-Fa-f]{2})*$/u;
const uriUserInfoPattern = /^(?:[A-Za-z0-9._~!$&'()*+,;=:-]|%[0-9A-Fa-f]{2})*$/u;
const uriRegNamePattern = /^(?:[A-Za-z0-9._~!$&'()*+,;=-]|%[0-9A-Fa-f]{2})*$/u;
const uriIpvFuturePattern = /^v[0-9A-F]+\.[A-Za-z0-9._~!$&'()*+,;=:-]+$/iu;

function validUriPath(path: string): boolean {
  return path.split("/").every((segment) => uriPcharPattern.test(segment));
}

function validUriAuthority(authority: string): boolean {
  const atIndex = authority.lastIndexOf("@");
  const userInfo = atIndex < 0 ? null : authority.slice(0, atIndex);
  const hostPort = atIndex < 0 ? authority : authority.slice(atIndex + 1);
  if (userInfo !== null && !uriUserInfoPattern.test(userInfo)) return false;
  if (hostPort.startsWith("[")) {
    const closeIndex = hostPort.indexOf("]");
    if (closeIndex < 0) return false;
    const literal = hostPort.slice(1, closeIndex);
    const suffix = hostPort.slice(closeIndex + 1);
    if (suffix !== "" && !/^:\d*$/u.test(suffix)) return false;
    return isIP(literal) === 6 || uriIpvFuturePattern.test(literal);
  }
  if (hostPort.includes("[") || hostPort.includes("]")) return false;
  const colonIndex = hostPort.lastIndexOf(":");
  if (colonIndex >= 0 && hostPort.slice(0, colonIndex).includes(":")) return false;
  const host = colonIndex < 0 ? hostPort : hostPort.slice(0, colonIndex);
  const port = colonIndex < 0 ? null : hostPort.slice(colonIndex + 1);
  return uriRegNamePattern.test(host) && (port === null || /^\d*$/u.test(port));
}

function validPep508UriReference(value: string): boolean {
  if (value === "") return false;
  const hashIndex = value.indexOf("#");
  if (hashIndex >= 0 && value.slice(hashIndex + 1).includes("#")) return false;
  const beforeFragment = hashIndex < 0 ? value : value.slice(0, hashIndex);
  const fragment = hashIndex < 0 ? null : value.slice(hashIndex + 1);
  if (fragment !== null && !uriQueryOrFragmentPattern.test(fragment)) return false;
  const queryIndex = beforeFragment.indexOf("?");
  const hierarchical = queryIndex < 0 ? beforeFragment : beforeFragment.slice(0, queryIndex);
  const query = queryIndex < 0 ? null : beforeFragment.slice(queryIndex + 1);
  if (query !== null && !uriQueryOrFragmentPattern.test(query)) return false;

  const scheme = hierarchical.match(/^[A-Za-z][A-Za-z0-9+.-]*:/u)?.[0] ?? null;
  const absolute = scheme !== null;
  const remainder = absolute ? hierarchical.slice(scheme.length) : hierarchical;
  if (remainder.startsWith("//")) {
    const pathIndex = remainder.indexOf("/", 2);
    const authority = pathIndex < 0 ? remainder.slice(2) : remainder.slice(2, pathIndex);
    const path = pathIndex < 0 ? "" : remainder.slice(pathIndex);
    return validUriAuthority(authority) && validUriPath(path);
  }
  if (remainder === "") return true;
  if (remainder.startsWith("/")) return validUriPath(remainder);
  if (!validUriPath(remainder)) return false;
  if (!absolute) {
    const firstSegment = remainder.split("/", 1)[0] ?? "";
    if (!uriSegmentNzNcPattern.test(firstSegment)) return false;
  }
  return true;
}

function splitPep508Marker(
  value: string,
): { readonly requirement: string; readonly marker: string | null } | null {
  let quote: '"' | "'" | null = null;
  let escaped = false;
  let bracketDepth = 0;
  let parenDepth = 0;
  let markerIndex = -1;
  for (let index = 0; index < value.length; index += 1) {
    const scalar = value[index] ?? "";
    if (quote !== null) {
      if (escaped) escaped = false;
      else if (scalar === "\\") escaped = true;
      else if (scalar === quote) quote = null;
      continue;
    }
    if (scalar === '"' || scalar === "'") quote = scalar;
    else if (scalar === "[") bracketDepth += 1;
    else if (scalar === "]") bracketDepth -= 1;
    else if (scalar === "(") parenDepth += 1;
    else if (scalar === ")") parenDepth -= 1;
    else if (scalar === ";" && bracketDepth === 0 && parenDepth === 0) {
      if (markerIndex >= 0) return null;
      markerIndex = index;
    }
    if (bracketDepth < 0 || parenDepth < 0) return null;
  }
  if (quote !== null || bracketDepth !== 0 || parenDepth !== 0) return null;
  if (markerIndex < 0) return { requirement: trimPep508Whitespace(value), marker: null };
  const requirement = trimPep508Whitespace(value.slice(0, markerIndex));
  const marker = trimPep508Whitespace(value.slice(markerIndex + 1));
  return marker === "" ? null : { requirement, marker };
}

function parsePep508Requirement(declaration: string): {
  readonly name: string;
  readonly constraint: string | null;
} | null {
  if (/[\r\n]/u.test(declaration)) return null;
  const trimmed = trimPep508Whitespace(declaration);
  const name = trimmed.match(/^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?/u)?.[0];
  if (name === undefined || !pep508NamePattern.test(name)) return null;
  let remainder = trimPep508Whitespace(trimmed.slice(name.length));
  if (remainder.startsWith("[")) {
    const end = remainder.indexOf("]");
    if (end < 0) return null;
    const extrasText = remainder.slice(1, end);
    const extras =
      extrasText === "" ? [] : extrasText.split(",").map((extra) => trimPep508Whitespace(extra));
    if (extras.some((extra) => !pep508NamePattern.test(extra))) return null;
    remainder = trimPep508Whitespace(remainder.slice(end + 1));
  }
  if (remainder.startsWith("@")) {
    const directReference = remainder.slice(1).replace(/^[ \t]+/u, "");
    const directMatch = directReference.match(/^(\S+)(?:[ \t]+;[ \t]*(.+))?$/u);
    if (directMatch === null) return null;
    const uri = directMatch[1] ?? "";
    if (!validPep508UriReference(uri)) return null;
    const marker = directMatch[2] ?? null;
    if (marker !== null && !validPep508Marker(marker)) return null;
  } else {
    const split = splitPep508Marker(remainder);
    if (split === null || (split.marker !== null && !validPep508Marker(split.marker))) return null;
    if (!validPep440SpecifierSet(split.requirement)) return null;
  }
  return {
    name,
    constraint: trimPep508Whitespace(trimmed.slice(name.length)) || null,
  };
}

function releaseChannel(version: string): string {
  const normalized = semverKey(version);
  if (!normalized?.includes("-")) return normalized === null ? "UNKNOWN" : "STABLE";
  const first = normalized.split("-", 2)[1]?.split(".", 1)[0]?.toLowerCase();
  if (first === "a" || first === "alpha") return "ALPHA";
  if (first === "b" || first === "beta") return "BETA";
  if (first === "rc" || first === "release-candidate") return "RELEASE_CANDIDATE";
  if (first === "exp" || first === "experimental") return "EXPERIMENTAL";
  if (first === "deprecated") return "DEPRECATED";
  if (first === "archived") return "ARCHIVED";
  return "UNKNOWN";
}

function emptyValue(fieldKey: M03FieldKey): unknown {
  if (fieldKey === "canonical_skill_name" || fieldKey === "outcome_candidate") return null;
  if (fieldKey === "target_user_candidates")
    return { targetUsers: [], bestFor: [], notIdealFor: [] };
  if (fieldKey === "license")
    return { state: "MISSING", selectedOrNull: null, preferredCandidateIdOrNull: null };
  if (fieldKey === "installation") return { state: "MISSING", paths: [] };
  return [];
}

const unsupportedCodeExtensions = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".go",
  ".java",
  ".kt",
  ".php",
  ".rb",
  ".rs",
  ".swift",
]);
const permissionKinds = new Set([
  "FILESYSTEM_READ",
  "FILESYSTEM_WRITE",
  "SHELL_EXECUTION",
  "PROCESS_CONTROL",
  "NETWORK_ACCESS",
  "ENVIRONMENT_READ",
  "SECRET_ACCESS",
  "DATABASE_ACCESS",
  "BROWSER_CONTROL",
  "EXTERNAL_SERVICE_ACCESS",
  "UNKNOWN",
]);
const compatibilitySubjectKinds = new Set([
  "PLATFORM",
  "RUNTIME",
  "HOST_TOOL",
  "FORMAT",
  "REGION",
  "UNKNOWN",
]);
const incompleteReasonCodes = new Set([
  "FILE_TOO_LARGE",
  "LINE_LIMIT_EXCEEDED",
  "ENTRY_LIMIT_EXCEEDED",
  "SELECTED_FILE_LIMIT_EXCEEDED",
  "TOTAL_BYTE_LIMIT_EXCEEDED",
]);
const manifestFields: readonly M03FieldKey[] = [
  "canonical_skill_name",
  "creator_candidates",
  "organization_candidates",
  "version",
  "license",
  "configuration",
  "dependencies",
  "compatibility",
];
const skillDocFields: readonly M03FieldKey[] = [
  "canonical_skill_name",
  "creator_candidates",
  "organization_candidates",
  "version",
  "license",
  "categories",
  "outcome_candidate",
  "capabilities",
  "tasks",
  "use_cases",
  "target_user_candidates",
  "installation",
  "configuration",
  "dependencies",
  "external_services",
  "permissions",
  "compatibility",
  "limitations",
];

function pathExtension(path: string): string {
  const basename = path.slice(path.lastIndexOf("/") + 1);
  const dot = basename.lastIndexOf(".");
  return dot < 0 ? "" : basename.slice(dot).toLowerCase();
}

function fieldAffinity(path: string): readonly M03FieldKey[] {
  if (path === "SKILL.md" || path === "README.md") return skillDocFields;
  if (
    ["package.json", "pyproject.toml", "requirements.txt"].includes(path) ||
    (/(manifest|package|requirements|pyproject)/iu.test(path.slice(path.lastIndexOf("/") + 1)) &&
      [".json", ".toml", ".yaml", ".yml"].includes(pathExtension(path)))
  )
    return manifestFields;
  if (["LICENSE", "LICENSE.md", "LICENSE.txt"].includes(path)) return ["license"];
  if (["CHANGELOG.md", "CHANGELOG.txt", "CHANGES.md"].includes(path))
    return ["version", "limitations", "maintenance_signals"];
  if (
    [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".sh", ".bash", ".zsh"].includes(
      pathExtension(path),
    ) ||
    unsupportedCodeExtensions.has(pathExtension(path))
  )
    return ["permissions"];
  return [];
}

function createConflict(
  fieldKey: M03FieldKey,
  reasonCode: ExtractionConflictV1["reasonCode"],
  candidates: readonly ExtractionCandidateV1[],
): ExtractionConflictV1 {
  const record = {
    fieldKey,
    reasonCode,
    candidateIds: candidates.map(({ id }) => id).sort(),
    aiProposalIds: [] as readonly string[],
    preferredCandidateIdOrNull: null,
    preferenceIsNonCanonicalGuidance: false as const,
    sourceReferenceIds: [
      ...new Set(candidates.flatMap(({ sourceReferenceIds }) => sourceReferenceIds)),
    ].sort(),
  };
  return { ...record, id: `conf_${sha256Hex(canonicalJson(record))}` };
}

function sourceDerivedCandidateStrings(fieldKey: M03FieldKey, value: unknown): readonly string[] {
  const object = value as Readonly<Record<string, unknown>>;
  const strings = (...values: readonly unknown[]) =>
    values.filter((value): value is string => typeof value === "string");
  switch (fieldKey) {
    case "canonical_skill_name":
      return strings(object.displayName, object.normalizedName);
    case "creator_candidates":
    case "organization_candidates":
      return strings(object.displayName, object.normalizedHandleOrNull);
    case "version":
      return strings(object.versionLabel, object.normalizedVersionOrNull);
    case "categories":
      return strings(object.label, object.normalizedLabel);
    case "outcome_candidate":
    case "capabilities":
    case "tasks":
    case "use_cases":
    case "target_user_candidates":
      return strings(object.text, object.normalizedKey);
    case "installation":
      return [
        ...strings(
          object.labelOrNull,
          object.startConditionOrNull,
          object.inferredMechanismOrNull,
          object.completionCueOrNull,
        ),
        ...(Array.isArray(object.prerequisites)
          ? object.prerequisites.filter((value): value is string => typeof value === "string")
          : []),
      ];
    case "configuration":
      return strings(object.name, object.normalizedName);
    case "dependencies":
      return strings(object.name, object.normalizedName, object.declaredConstraintOrNull);
    case "external_services":
      return strings(object.serviceName, object.normalizedServiceName);
    case "permissions":
      return strings(object.scopeOrNull);
    case "compatibility":
      return strings(object.subject, object.normalizedSubject, object.constraintOrNull);
    case "limitations":
      return strings(object.text, object.normalizedKey);
    case "maintenance_signals":
      return strings(object.value, object.valueOrNull);
    case "source_revision":
    case "license":
      return [];
  }
}

export function extractDeterministic(input: DeterministicExtractionInput): {
  readonly sourceReferences: readonly ExtractionSourceReferenceV1[];
  readonly sensitiveReferenceWarningCodesById: Readonly<Record<string, readonly M03WarningCode[]>>;
  readonly routingSourceReferenceIds: readonly string[];
  readonly operationSourceReferenceIds: Readonly<
    Partial<Record<M03AnalysisSubOperation, readonly string[]>>
  >;
  readonly extractorRefs: readonly ExtractorRefV1[];
  readonly deterministicCandidates: readonly ExtractionCandidateV1[];
  readonly conflicts: readonly ExtractionConflictV1[];
  readonly fields: readonly ExtractionFieldResultV1[];
  readonly warningCodes: readonly M03WarningCode[];
} {
  const provenanceAuthority = input.provenanceAuthority ?? new M03ProvenanceAuthority();
  const extractors = createExtractorRegistry(input.policyVersions.policyArtifactFingerprint ?? "");
  const extractorByName = new Map(extractors.map((extractor) => [extractor.name, extractor]));
  const candidates: ExtractionCandidateV1[] = [];
  const conflicts: ExtractionConflictV1[] = [];
  const references: ExtractionSourceReferenceV1[] = [];
  const explicitRoutingSourceReferenceIds = new Set<string>();
  const operationSourceReferenceIds = new Map<M03AnalysisSubOperation, Set<string>>();
  const directFieldWarnings = new Map<M03FieldKey, Set<M03WarningCode>>();
  const privacyReviewRequiredFields = new Set<M03FieldKey>();
  let installationNoPathReview = false;
  const warn = (fieldKey: M03FieldKey, warning: M03WarningCode) => {
    const set = directFieldWarnings.get(fieldKey) ?? new Set<M03WarningCode>();
    set.add(warning);
    directFieldWarnings.set(fieldKey, set);
  };
  const referenceSensitivityById = new Map<
    string,
    {
      readonly locatorWarningCodes: readonly M03WarningCode[];
      readonly excerptWarningCodes: readonly M03WarningCode[];
    }
  >();
  const registerDocumentReference = (result: ReturnType<typeof createDocumentReference>): void => {
    const locatorWarningCodes = warningSort([
      ...(result.sensitivity.locatorSecretMatch ? (["SECRET_LIKE_VALUE_WITHHELD"] as const) : []),
      ...(result.sensitivity.locatorContactMatch ? (["PERSONAL_CONTACT_WITHHELD"] as const) : []),
    ]);
    const excerptWarningCodes = warningSort([
      ...(result.sensitivity.excerptSecretMatch ? (["SECRET_LIKE_VALUE_WITHHELD"] as const) : []),
      ...(result.sensitivity.excerptContactMatch ? (["PERSONAL_CONTACT_WITHHELD"] as const) : []),
    ]);
    if (locatorWarningCodes.length > 0 || excerptWarningCodes.length > 0)
      referenceSensitivityById.set(result.reference.id, {
        locatorWarningCodes,
        excerptWarningCodes,
      });
  };
  const bindReferenceToFields = (
    referenceId: string,
    fieldKeys: readonly M03FieldKey[],
    requiresReview = true,
  ): void => {
    const sensitivity = referenceSensitivityById.get(referenceId);
    if (sensitivity === undefined) return;
    for (const fieldKey of fieldKeys)
      for (const warning of [
        ...sensitivity.locatorWarningCodes,
        ...sensitivity.excerptWarningCodes,
      ]) {
        warn(fieldKey, warning);
        if (requiresReview) privacyReviewRequiredFields.add(fieldKey);
      }
  };
  const retainRoutingReference = (referenceId: string, fieldKeys: readonly M03FieldKey[]): void => {
    explicitRoutingSourceReferenceIds.add(referenceId);
    bindReferenceToFields(referenceId, fieldKeys);
  };
  const retainOperationReference = (
    operation: M03AnalysisSubOperation,
    reference: ExtractionSourceReferenceV1,
  ) => {
    if (input.includeOperationReferences === false) return;
    references.push(reference);
    const ids = operationSourceReferenceIds.get(operation) ?? new Set<string>();
    ids.add(reference.id);
    operationSourceReferenceIds.set(operation, ids);
    bindReferenceToFields(reference.id, operationAffectedFields[operation], false);
  };
  const addCandidate = (rawCandidate: ExtractionCandidateV1) => {
    const referenceSensitivity = rawCandidate.sourceReferenceIds.flatMap((id) => {
      const sensitivity = referenceSensitivityById.get(id);
      return sensitivity === undefined ? [] : [sensitivity];
    });
    const locatorWarningCodes = warningSort(
      referenceSensitivity.flatMap(({ locatorWarningCodes }) => locatorWarningCodes),
    );
    const excerptWarningCodes =
      rawCandidate.fieldKey === "installation" || rawCandidate.fieldKey === "configuration"
        ? []
        : warningSort(
            referenceSensitivity.flatMap(({ excerptWarningCodes }) => excerptWarningCodes),
          );
    for (const warning of [...locatorWarningCodes, ...excerptWarningCodes]) {
      warn(rawCandidate.fieldKey, warning);
      privacyReviewRequiredFields.add(rawCandidate.fieldKey);
    }
    let candidate = rawCandidate;
    if (excerptWarningCodes.length > 0) {
      candidate = createCandidate({
        fieldKey: rawCandidate.fieldKey,
        value: rawCandidate.value,
        normalizedKey: rawCandidate.normalizedKey,
        extractorRefId: rawCandidate.extractorRefId,
        supportNature: rawCandidate.supportNature,
        claimClass: rawCandidate.claimClass,
        sourceType: rawCandidate.sourceType,
        sourceReferenceIds: rawCandidate.sourceReferenceIds,
        confidence: rawCandidate.confidence,
        warningCodes: [...rawCandidate.warningCodes, ...excerptWarningCodes],
      });
    }
    const classifications = sourceDerivedCandidateStrings(candidate.fieldKey, candidate.value).map(
      (value) => scanSensitiveText(value),
    );
    if (classifications.some(({ secretMatch }) => secretMatch))
      warn(candidate.fieldKey, "SECRET_LIKE_VALUE_WITHHELD");
    if (classifications.some(({ contactMatch }) => contactMatch))
      warn(candidate.fieldKey, "PERSONAL_CONTACT_WITHHELD");
    if (classifications.some(({ secretMatch, contactMatch }) => secretMatch || contactMatch)) {
      privacyReviewRequiredFields.add(candidate.fieldKey);
      for (const id of candidate.sourceReferenceIds)
        retainRoutingReference(id, [candidate.fieldKey]);
      return;
    }
    candidates.push(candidate);
  };
  const sourceRef = (
    document: M03SourceDocument,
    locator: Parameters<typeof createDocumentReference>[0]["locator"],
    excerpt: string | null,
  ) => {
    const result = createDocumentReference({
      sourceSnapshotId: input.sourceSnapshotId,
      sourceEntryId: document.sourceEntryId,
      sourceDocumentId: document.sourceDocumentId,
      ownership: document.ownership,
      locator,
      documentContent: document.content,
      excerptCandidate: excerpt,
      provenanceAuthority,
    });
    references.push(result.reference);
    registerDocumentReference(result);
    return result;
  };
  const retainDocumentRoutingReference = (
    document: M03SourceDocument,
    locator: Parameters<typeof createDocumentReference>[0]["locator"],
    excerpt: string | null,
    fieldKeys: readonly M03FieldKey[],
  ) => {
    const result = sourceRef(document, locator, excerpt);
    retainRoutingReference(result.reference.id, fieldKeys);
    return result;
  };

  for (const unavailable of input.unavailableEntries ?? []) {
    const warning: M03WarningCode = unavailable.reasonCodes.some((reason) =>
      incompleteReasonCodes.has(reason),
    )
      ? "SOURCE_CORPUS_INCOMPLETE"
      : "SOURCE_DISPOSITION_EXCLUDED";
    for (const fieldKey of fieldAffinity(unavailable.normalizedPath)) warn(fieldKey, warning);
  }

  const snapshotRevisionRef = createSnapshotMetadataReference({
    sourceSnapshotId: input.sourceSnapshotId,
    metadataFingerprintKind: "SOURCE_SNAPSHOT",
    metadataFingerprint: input.sourceSnapshotFingerprint,
    locator: { type: "SNAPSHOT_FIELD", metadataKey: "immutableRevision" },
    value: input.sourceRevision,
  });
  const snapshotRepositoryRef = createSnapshotMetadataReference({
    sourceSnapshotId: input.sourceSnapshotId,
    metadataFingerprintKind: "SOURCE_SNAPSHOT",
    metadataFingerprint: input.sourceSnapshotFingerprint,
    locator: { type: "SNAPSHOT_FIELD", metadataKey: "providerRepositoryId" },
    value: input.providerMetadata.providerRepositoryId,
  });
  references.push(snapshotRevisionRef, snapshotRepositoryRef);
  const repositoryNameRef = createSnapshotMetadataReference({
    sourceSnapshotId: input.sourceSnapshotId,
    metadataFingerprintKind: "PROVIDER_METADATA",
    metadataFingerprint: input.providerMetadataFingerprint,
    locator: { type: "REPOSITORY_FIELD", metadataKey: "name" },
    value: input.providerMetadata.name,
  });
  references.push(repositoryNameRef);
  addCandidate(
    createCandidate({
      fieldKey: "canonical_skill_name",
      value: {
        normalizedName: textKey(input.providerMetadata.name),
        displayName: input.providerMetadata.name,
        sourceReferenceIds: [repositoryNameRef.id],
      },
      normalizedKey: `name:${textKey(input.providerMetadata.name)}`,
      extractorRefId: extractorByName.get("provider-metadata-v1")?.id ?? "",
      supportNature: "EXACT",
      claimClass: "REPOSITORY_METADATA",
      sourceType: "REPOSITORY_METADATA",
      sourceReferenceIds: [repositoryNameRef.id],
      confidence: 1,
      warningCodes: [],
    }),
  );
  warn("creator_candidates", "PREDECESSOR_METADATA_INSUFFICIENT");
  warn("organization_candidates", "PREDECESSOR_METADATA_INSUFFICIENT");
  if (input.providerMetadata.tags.length > 0 || input.providerMetadata.latestRelease !== null)
    warn("version", "PREDECESSOR_METADATA_INSUFFICIENT");
  if (input.providerMetadata.license.spdxId !== null) {
    const spdx = canonicalizeSpdx(input.providerMetadata.license.spdxId);
    const spdxRef = createSnapshotMetadataReference({
      sourceSnapshotId: input.sourceSnapshotId,
      metadataFingerprintKind: "PROVIDER_METADATA",
      metadataFingerprint: input.providerMetadataFingerprint,
      locator: { type: "LICENSE_FIELD", metadataKey: "spdxId" },
      value: input.providerMetadata.license.spdxId,
    });
    const providerLicenseSourceRef = createSnapshotMetadataReference({
      sourceSnapshotId: input.sourceSnapshotId,
      metadataFingerprintKind: "PROVIDER_METADATA",
      metadataFingerprint: input.providerMetadataFingerprint,
      locator: { type: "LICENSE_FIELD", metadataKey: "source" },
      value: input.providerMetadata.license.source,
    });
    references.push(spdxRef, providerLicenseSourceRef);
    if (spdx === null) {
      explicitRoutingSourceReferenceIds.add(spdxRef.id);
      explicitRoutingSourceReferenceIds.add(providerLicenseSourceRef.id);
      warn("license", "UNSUPPORTED_LICENSE_IDENTIFIER");
    } else {
      const value = {
        sourceReferenceIds: [providerLicenseSourceRef.id, spdxRef.id].sort(),
        spdxExpressionOrNull: spdx,
        customTextHashOrNull: null,
      };
      addCandidate(
        createCandidate({
          fieldKey: "license",
          value,
          normalizedKey: `license:${spdx}`,
          extractorRefId: extractorByName.get("provider-metadata-v1")?.id ?? "",
          supportNature: "EXACT",
          claimClass: "REPOSITORY_METADATA",
          sourceType: "LICENSE_METADATA",
          sourceReferenceIds: value.sourceReferenceIds,
          confidence: 1,
          warningCodes: [],
        }),
      );
    }
  }
  const sourceRevisionValue = {
    provider: "GITHUB",
    providerRepositoryId: input.providerMetadata.providerRepositoryId,
    sourceSnapshotId: input.sourceSnapshotId,
    immutableRevision: input.sourceRevision,
    resourceVersionObservationId: input.resourceVersionObservationId,
    resourceSourceLinkId: input.resourceSourceLinkId,
    sourceReferenceIds: [snapshotRepositoryRef.id, snapshotRevisionRef.id].sort(),
  };
  addCandidate(
    createCandidate({
      fieldKey: "source_revision",
      value: sourceRevisionValue,
      normalizedKey: `revision:${input.sourceRevision}`,
      extractorRefId: extractorByName.get("source-revision-v1")?.id ?? "",
      supportNature: "EXACT",
      claimClass: "SOURCE_FACT",
      sourceType: "SOURCE_REVISION_FALLBACK",
      sourceReferenceIds: sourceRevisionValue.sourceReferenceIds,
      confidence: 1,
      warningCodes: [],
    }),
  );

  const selectedChangelog = ["CHANGELOG.md", "CHANGELOG.txt", "CHANGES.md"]
    .map((path) => input.documents.find((document) => document.normalizedPath === path))
    .find((document) => document !== undefined);
  const declarationState = {
    deprecationObserved: false,
    untypedAttributionObserved: false,
    invalidDeprecationReferenceIds: [] as string[],
  };
  for (const document of input.documents) {
    if (unsupportedCodeExtensions.has(pathExtension(document.normalizedPath)))
      warn("permissions", "UNSUPPORTED_STATIC_LANGUAGE");
    const basename = document.normalizedPath.slice(document.normalizedPath.lastIndexOf("/") + 1);
    if (
      /(manifest|package|requirements|pyproject)/iu.test(basename) &&
      [".json", ".toml", ".yaml", ".yml"].includes(pathExtension(document.normalizedPath)) &&
      !["package.json", "pyproject.toml", "requirements.txt"].includes(document.normalizedPath)
    )
      for (const fieldKey of manifestFields) warn(fieldKey, "UNRECOGNIZED_MANIFEST");
    if (document.normalizedPath === "SKILL.md" || document.normalizedPath === "README.md") {
      const markdownBody = markdownBodyForDocument(document.normalizedPath, document.content);
      const isSkillDocument = document.normalizedPath === "SKILL.md";
      const invalidSkillMetadata = isSkillDocument && skillFrontMatterInvalid(document.content);
      const parsed =
        isSkillDocument && !invalidSkillMetadata ? parseSkillFrontMatter(document.content) : null;
      if (invalidSkillMetadata) {
        for (const key of [
          "canonical_skill_name",
          "creator_candidates",
          "organization_candidates",
          "version",
          "license",
          "categories",
          "permissions",
          "compatibility",
          "maintenance_signals",
        ] as const)
          warn(key, "DETERMINISTIC_DECLARATION_INVALID");
      }
      if (parsed !== null) {
        const field = (key: string) => parsed.fields[key];
        const routeSkillPointer = (
          pointer: string,
          value: unknown,
          fieldKeys: readonly M03FieldKey[],
        ) =>
          retainDocumentRoutingReference(
            document,
            {
              type: "DATA_POINTER",
              path: "SKILL.md",
              format: "YAML_FRONT_MATTER",
              dataPointer: pointer,
            },
            canonicalJson(value),
            fieldKeys,
          );
        const addSkillValue = (
          fieldKey: M03FieldKey,
          key: string,
          value: unknown,
          normalizedKey: string,
        ) => {
          const pointer = `/${key}`;
          const reference = sourceRef(
            document,
            {
              type: "DATA_POINTER",
              path: "SKILL.md",
              format: "YAML_FRONT_MATTER",
              dataPointer: pointer,
            },
            canonicalJson(field(key)),
          );
          for (const warning of reference.warningCodes) warn(fieldKey, warning);
          if (reference.warningCodes.length > 0) return;
          addCandidate(
            createCandidate({
              fieldKey,
              value,
              normalizedKey,
              extractorRefId: extractorByName.get("skill-metadata-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass:
                fieldKey === "maintenance_signals" ? "REPOSITORY_METADATA" : "SOURCE_FACT",
              sourceType: "SKILL_METADATA",
              sourceReferenceIds: [reference.reference.id],
              confidence: 1,
              warningCodes: [],
            }),
          );
        };
        const name = field("name");
        if (typeof name === "string") {
          const ref = sourceRef(
            document,
            {
              type: "DATA_POINTER",
              path: "SKILL.md",
              format: "YAML_FRONT_MATTER",
              dataPointer: "/name",
            },
            JSON.stringify(name),
          );
          addCandidate(
            createCandidate({
              fieldKey: "canonical_skill_name",
              value: {
                normalizedName: textKey(name),
                displayName: name,
                sourceReferenceIds: [ref.reference.id],
              },
              normalizedKey: `name:${textKey(name)}`,
              extractorRefId: extractorByName.get("skill-metadata-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "SKILL_METADATA",
              sourceReferenceIds: [ref.reference.id],
              confidence: 1,
              warningCodes: [],
            }),
          );
        } else if (name !== undefined) {
          routeSkillPointer("/name", name, ["canonical_skill_name"]);
          warn("canonical_skill_name", "DETERMINISTIC_DECLARATION_INVALID");
        }
        const version = field("version");
        if (typeof version === "string") {
          const ref = sourceRef(
            document,
            {
              type: "DATA_POINTER",
              path: "SKILL.md",
              format: "YAML_FRONT_MATTER",
              dataPointer: "/version",
            },
            JSON.stringify(version),
          );
          const value = {
            versionLabel: version,
            normalizedVersionOrNull: semverKey(version),
            versionSource: "SKILL_METADATA",
            releaseChannel: releaseChannel(version),
            sourceReferenceIds: [ref.reference.id],
          };
          addCandidate(
            createCandidate({
              fieldKey: "version",
              value,
              normalizedKey: `version:${semverKey(version) ?? textKey(version)}`,
              extractorRefId: extractorByName.get("skill-metadata-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "SKILL_METADATA",
              sourceReferenceIds: [ref.reference.id],
              confidence: 1,
              warningCodes: [],
            }),
          );
        } else if (version !== undefined) {
          routeSkillPointer("/version", version, ["version"]);
          warn("version", "DETERMINISTIC_DECLARATION_INVALID");
        }
        for (const [key, kind] of [
          ["author", "CREATOR"],
          ["organization", "ORGANIZATION"],
        ] as const) {
          const attribution = field(key);
          if (attribution === undefined) continue;
          const displayName =
            typeof attribution === "string"
              ? attribution
              : isExactStringObject(attribution, "name")
                ? attribution.name
                : null;
          const fieldKey = kind === "CREATOR" ? "creator_candidates" : "organization_candidates";
          if (displayName === null) {
            routeSkillPointer(`/${key}`, attribution, [fieldKey]);
            warn(fieldKey, "DETERMINISTIC_DECLARATION_INVALID");
            continue;
          }
          const ref = sourceRef(
            document,
            {
              type: "DATA_POINTER",
              path: "SKILL.md",
              format: "YAML_FRONT_MATTER",
              dataPointer: typeof attribution === "string" ? `/${key}` : `/${key}/name`,
            },
            JSON.stringify(displayName),
          );
          const value = {
            kind,
            displayName,
            normalizedHandleOrNull: displayName.startsWith("@") ? handleKey(displayName) : null,
            basis: "SKILL_METADATA",
            verificationState: "UNVERIFIED",
            sourceReferenceIds: [ref.reference.id],
          };
          addCandidate(
            createCandidate({
              fieldKey,
              value,
              normalizedKey: `attribution:${kind}:${value.normalizedHandleOrNull ?? textKey(displayName)}`,
              extractorRefId: extractorByName.get("skill-metadata-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "SKILL_METADATA",
              sourceReferenceIds: [ref.reference.id],
              confidence: 1,
              warningCodes: [],
            }),
          );
        }
        const license = field("license");
        if (typeof license === "string") {
          const spdx = canonicalizeSpdx(license);
          if (spdx === null) {
            routeSkillPointer("/license", license, ["license"]);
            warn("license", "UNSUPPORTED_LICENSE_IDENTIFIER");
          } else {
            const ref = sourceRef(
              document,
              {
                type: "DATA_POINTER",
                path: "SKILL.md",
                format: "YAML_FRONT_MATTER",
                dataPointer: "/license",
              },
              JSON.stringify(license),
            );
            const value = {
              sourceReferenceIds: [ref.reference.id],
              spdxExpressionOrNull: spdx,
              customTextHashOrNull: null,
            };
            addCandidate(
              createCandidate({
                fieldKey: "license",
                value,
                normalizedKey: `license:${spdx}`,
                extractorRefId: extractorByName.get("skill-metadata-v1")?.id ?? "",
                supportNature: "EXACT",
                claimClass: "SOURCE_FACT",
                sourceType: "SKILL_METADATA",
                sourceReferenceIds: [ref.reference.id],
                confidence: 1,
                warningCodes: [],
              }),
            );
          }
        } else if (license !== undefined) {
          routeSkillPointer("/license", license, ["license"]);
          warn("license", "DETERMINISTIC_DECLARATION_INVALID");
        }
        for (const [key, fieldKey] of [
          ["categories", "categories"],
          ["compatibility", "compatibility"],
          ["permissions", "permissions"],
        ] as const) {
          const declared = field(key);
          if (
            declared !== undefined &&
            (!Array.isArray(declared) || declared.some((member) => typeof member !== "string"))
          ) {
            routeSkillPointer(`/${key}`, declared, [fieldKey]);
            warn(fieldKey, "DETERMINISTIC_DECLARATION_INVALID");
          }
        }
        const categories = field("categories");
        for (const [index, category] of (Array.isArray(categories) &&
        categories.every((member): member is string => typeof member === "string")
          ? categories
          : []
        ).entries()) {
          const ref = sourceRef(
            document,
            {
              type: "DATA_POINTER",
              path: "SKILL.md",
              format: "YAML_FRONT_MATTER",
              dataPointer: `/categories/${String(index)}`,
            },
            JSON.stringify(category),
          );
          const value = {
            label: category,
            normalizedLabel: textKey(category),
            sourceReferenceIds: [ref.reference.id],
            mappingState: "TAXONOMY_CANDIDATE",
            taxonomyIdOrNull: null,
            taxonomyRegistryVersion: input.policyVersions.taxonomyRegistryVersion ?? "",
            taxonomyRegistryFingerprint: input.policyVersions.taxonomyRegistryFingerprint ?? "",
          };
          addCandidate(
            createCandidate({
              fieldKey: "categories",
              value,
              normalizedKey: `taxonomy:${textKey(category)}`,
              extractorRefId: extractorByName.get("skill-metadata-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "SKILL_METADATA",
              sourceReferenceIds: [ref.reference.id],
              confidence: 1,
              warningCodes: ["TAXONOMY_CANDIDATE"],
            }),
          );
        }
        const compatibilityDeclarations = field("compatibility");
        for (const [index, declaration] of (Array.isArray(compatibilityDeclarations) &&
        compatibilityDeclarations.every((member): member is string => typeof member === "string")
          ? compatibilityDeclarations
          : []
        ).entries()) {
          const match = declaration.match(
            /^(PLATFORM|RUNTIME|HOST_TOOL|FORMAT|REGION|UNKNOWN):\s*(.+?)(?:;\s*constraint:\s*(.+))?$/u,
          );
          if (!match || !compatibilitySubjectKinds.has(match[1] ?? "")) {
            routeSkillPointer(`/compatibility/${String(index)}`, declaration, ["compatibility"]);
            warn("compatibility", "DETERMINISTIC_DECLARATION_INVALID");
            continue;
          }
          const ref = sourceRef(
            document,
            {
              type: "DATA_POINTER",
              path: "SKILL.md",
              format: "YAML_FRONT_MATTER",
              dataPointer: `/compatibility/${String(index)}`,
            },
            JSON.stringify(declaration),
          );
          const value = {
            subjectKind: match[1],
            subject: match[2],
            normalizedSubject: textKey(match[2] ?? ""),
            constraintOrNull: match[3] ?? null,
            evidenceClass: "SOURCE_DECLARATION",
            support: "UNKNOWN",
            sourceReferenceIds: [ref.reference.id],
          };
          addCandidate(
            createCandidate({
              fieldKey: "compatibility",
              value,
              normalizedKey: structKey(value),
              extractorRefId: extractorByName.get("skill-metadata-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "SKILL_METADATA",
              sourceReferenceIds: [ref.reference.id],
              confidence: 1,
              warningCodes: [],
            }),
          );
        }
        const permissionDeclarations = field("permissions");
        for (const [index, declaration] of (Array.isArray(permissionDeclarations) &&
        permissionDeclarations.every((member): member is string => typeof member === "string")
          ? permissionDeclarations
          : []
        ).entries()) {
          const match = declaration.match(/^([A-Z_]+)(?:;\s*scope:\s*(.+))?$/u);
          if (!match || !permissionKinds.has(match[1] ?? "")) {
            routeSkillPointer(`/permissions/${String(index)}`, declaration, ["permissions"]);
            warn("permissions", "DETERMINISTIC_DECLARATION_INVALID");
            continue;
          }
          const ref = sourceRef(
            document,
            {
              type: "DATA_POINTER",
              path: "SKILL.md",
              format: "YAML_FRONT_MATTER",
              dataPointer: `/permissions/${String(index)}`,
            },
            JSON.stringify(declaration),
          );
          const value = {
            kind: match[1],
            evidenceLevel: "EXPLICIT",
            scopeOrNull: match[2] ?? null,
            absenceClaim: false,
            sourceReferenceIds: [ref.reference.id],
          };
          addCandidate(
            createCandidate({
              fieldKey: "permissions",
              value,
              normalizedKey: structKey(value),
              extractorRefId: extractorByName.get("skill-metadata-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "SKILL_METADATA",
              sourceReferenceIds: [ref.reference.id],
              confidence: 1,
              warningCodes: [],
            }),
          );
        }
        const deprecated = field("deprecated");
        if (typeof deprecated === "boolean") {
          const ref = sourceRef(
            document,
            {
              type: "DATA_POINTER",
              path: "SKILL.md",
              format: "YAML_FRONT_MATTER",
              dataPointer: "/deprecated",
            },
            String(deprecated),
          );
          addSkillValue(
            "maintenance_signals",
            "deprecated",
            {
              kind: "EXPLICIT_DEPRECATION",
              value: deprecated,
              sourceReferenceIds: [ref.reference.id],
            },
            `struct:${sha256Hex(canonicalJson({ kind: "EXPLICIT_DEPRECATION", value: deprecated }))}`,
          );
        } else if (deprecated !== undefined) {
          const ref = sourceRef(
            document,
            {
              type: "DATA_POINTER",
              path: "SKILL.md",
              format: "YAML_FRONT_MATTER",
              dataPointer: "/deprecated",
            },
            canonicalJson(deprecated),
          );
          declarationState.deprecationObserved = true;
          declarationState.invalidDeprecationReferenceIds.push(ref.reference.id);
          explicitRoutingSourceReferenceIds.add(ref.reference.id);
          warn("maintenance_signals", "DETERMINISTIC_DECLARATION_INVALID");
        }
      }
      const install = extractInstallationContexts({
        sourceSnapshotId: input.sourceSnapshotId,
        sourceEntryId: document.sourceEntryId,
        sourceDocumentId: document.sourceDocumentId,
        ownership: document.ownership,
        normalizedPath: document.normalizedPath,
        documentContent: document.content,
        markdownBodyContent: markdownBody.content,
        absoluteLineOffset: markdownBody.absoluteLineOffset,
        absoluteByteOffset: markdownBody.absoluteByteOffset,
        provenanceAuthority,
      });
      references.push(...install.sourceReferences);
      for (const referenceId of install.routingSourceReferenceIds)
        retainRoutingReference(referenceId, ["installation"]);
      for (const [referenceId, warningCodes] of Object.entries(
        install.sensitiveReferenceWarningCodesById,
      ))
        referenceSensitivityById.set(referenceId, {
          locatorWarningCodes: [],
          excerptWarningCodes: warningCodes,
        });
      for (const warning of install.warningCodes) warn("installation", warning);
      if (install.paths.length === 0 && install.state === "UNSAFE_OR_AMBIGUOUS") {
        installationNoPathReview = true;
      }
      for (const path of install.paths) {
        const inferred = path.pathKind === "INFERRED_MECHANISM";
        addCandidate(
          createCandidate({
            fieldKey: "installation",
            value: path,
            normalizedKey: structKey(path),
            extractorRefId:
              extractorByName.get(inferred ? "installation-mechanism-v1" : "command-v1")?.id ?? "",
            supportNature: inferred ? "INFERENTIAL" : "EXACT",
            claimClass: inferred ? "FORMAT_INFERENCE" : "SOURCE_FACT",
            sourceType: inferred ? "MARKDOWN_TEXT" : "FENCED_COMMAND",
            sourceReferenceIds: path.sourceReferenceIds,
            confidence: inferred ? 0.7 : 1,
            warningCodes: install.warningCodes.filter(
              (warning) =>
                warning === "INSTALL_COMMAND_UNSAFE" ||
                warning === "INSTALL_CONTEXT_INCOMPLETE" ||
                warning === "SECRET_LIKE_COMMAND_WITHHELD" ||
                warning === "PERSONAL_CONTACT_WITHHELD",
            ),
          }),
        );
      }
      const lines = markdownBody.lines;
      const markdown = parseMarkdownProfile(markdownBody.content);
      const absoluteLine = (localZeroBasedLine: number) =>
        markdownBody.absoluteLineOffset + localZeroBasedLine + 1;
      const atxHeadings = markdown.headings;
      for (const [headingIndex, operationHeading] of atxHeadings.entries()) {
        const key = textKey(operationHeading.label);
        const operations = operationDocumentationHeadingKeys
          .filter(([, headingKeys]) => headingKeys.includes(key))
          .map(([operation]) => operation);
        if (operations.length === 0) continue;
        const next = atxHeadings
          .slice(headingIndex + 1)
          .find(({ level }) => level <= operationHeading.level);
        const endLineExclusive = next?.line ?? lines.length;
        for (const range of markdown.semanticRanges.filter(
          ({ startLine }) => startLine > operationHeading.line && startLine < endLineExclusive,
        )) {
          const reference = createDocumentReference({
            sourceSnapshotId: input.sourceSnapshotId,
            sourceEntryId: document.sourceEntryId,
            sourceDocumentId: document.sourceDocumentId,
            ownership: document.ownership,
            documentContent: document.content,
            locator: {
              type: "LINE_RANGE",
              path: document.normalizedPath,
              startLine: absoluteLine(range.startLine),
              endLine: absoluteLine(range.endLine),
            },
            excerptCandidate: null,
            provenanceAuthority,
          });
          registerDocumentReference(reference);
          for (const operation of operations)
            retainOperationReference(operation, reference.reference);
        }
      }
      const titleHeading = atxHeadings.find(({ level }) => level === 1);
      if (titleHeading !== undefined) {
        const title = titleHeading.label;
        if (title !== "") {
          const ref = sourceRef(
            document,
            {
              type: "LINE_RANGE",
              path: document.normalizedPath,
              startLine: absoluteLine(titleHeading.line),
              endLine: absoluteLine(titleHeading.line),
            },
            title,
          );
          const value = {
            normalizedName: textKey(title),
            displayName: title,
            sourceReferenceIds: [ref.reference.id],
          };
          addCandidate(
            createCandidate({
              fieldKey: "canonical_skill_name",
              value,
              normalizedKey: `name:${value.normalizedName}`,
              extractorRefId: extractorByName.get("markdown-declarations-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "MARKDOWN_TEXT",
              sourceReferenceIds: [ref.reference.id],
              confidence: 1,
              warningCodes: [],
            }),
          );
        }
      }
      const eligibleDeclarationBlocks = new Map(
        markdown.semanticRanges
          .filter(
            ({ startLine, endLine, blockKind }) =>
              startLine === endLine && blockKind !== "TABLE_ROW",
          )
          .map((range) => [range.startLine, range.blockKind] as const),
      );
      const configurationLines = new Set<number>();
      for (const [headingIndex, configurationHeading] of atxHeadings.entries()) {
        if (
          !["configuration", "configure", "environment variables"].includes(
            textKey(configurationHeading.label),
          )
        )
          continue;
        const next = atxHeadings
          .slice(headingIndex + 1)
          .find(({ level }) => level <= configurationHeading.level);
        const endLineExclusive = next?.line ?? lines.length;
        for (let line = configurationHeading.line + 1; line < endLineExclusive; line += 1)
          configurationLines.add(line);
      }
      lines.forEach((line, index) => {
        const blockKind = eligibleDeclarationBlocks.get(index);
        if (blockKind === undefined) return;
        const inConfigurationSection = configurationLines.has(index);
        const trimmedLine = line.trim();
        const declaration =
          blockKind === "LIST_ITEM" && trimmedLine.startsWith("- ")
            ? trimmedLine.slice(2).trim()
            : trimmedLine;
        const retainInvalidDeclaration = (fieldKeys: readonly M03FieldKey[]) => {
          const reference = sourceRef(
            document,
            {
              type: "LINE_RANGE",
              path: document.normalizedPath,
              startLine: absoluteLine(index),
              endLine: absoluteLine(index),
            },
            line.trim(),
          );
          retainRoutingReference(reference.reference.id, fieldKeys);
          return reference;
        };
        const configuration = declaration.match(
          /^`([^`]+)` \(`(required|optional)`, `([^`]+)`\)(?:; default: `([^`]*)`)?$/u,
        );
        if (configuration && inConfigurationSection) {
          const [, name = "", requiredness = "", type = "", defaultValue] = configuration;
          const typeMap: Record<string, string> = {
            string: "STRING",
            number: "NUMBER",
            boolean: "BOOLEAN",
            path: "PATH",
            url: "URL",
            enum: "ENUM",
            secret: "SECRET",
            object: "OBJECT",
            array: "ARRAY",
            unknown: "UNKNOWN",
          };
          const valueKind = typeMap[textKey(type)];
          const reference = sourceRef(
            document,
            {
              type: "LINE_RANGE",
              path: document.normalizedPath,
              startLine: absoluteLine(index),
              endLine: absoluteLine(index),
            },
            line.trim(),
          );
          const nameSensitivity = scanSensitiveText(name);
          const defaultSensitivity =
            defaultValue === undefined
              ? { secretMatch: false, contactMatch: false }
              : scanSensitiveText(defaultValue);
          const candidateWarnings: M03WarningCode[] = [];
          if (!valueKind) candidateWarnings.push("DETERMINISTIC_DECLARATION_INVALID");
          if (nameSensitivity.secretMatch) candidateWarnings.push("SECRET_LIKE_VALUE_WITHHELD");
          if (nameSensitivity.contactMatch || defaultSensitivity.contactMatch)
            candidateWarnings.push("PERSONAL_CONTACT_WITHHELD");
          const baseline =
            valueKind === "SECRET"
              ? "SECRET"
              : /key|token|password|secret/u.test(textKey(name))
                ? "POSSIBLY_SECRET"
                : valueKind === "UNKNOWN"
                  ? "UNKNOWN"
                  : "NON_SECRET";
          if (
            valueKind === "UNKNOWN" &&
            !nameSensitivity.secretMatch &&
            !nameSensitivity.contactMatch
          )
            candidateWarnings.push("CONFIGURATION_TYPE_UNKNOWN");
          const defaultWithheld =
            defaultValue !== undefined &&
            (defaultSensitivity.secretMatch ||
              defaultSensitivity.contactMatch ||
              baseline !== "NON_SECRET");
          if (defaultWithheld) candidateWarnings.push("SENSITIVE_CONFIGURATION_DEFAULT_WITHHELD");
          for (const warning of candidateWarnings) warn("configuration", warning);
          if (nameSensitivity.secretMatch || nameSensitivity.contactMatch || !valueKind) {
            explicitRoutingSourceReferenceIds.add(reference.reference.id);
            return;
          }
          const sensitivity =
            baseline === "SECRET" || defaultSensitivity.secretMatch
              ? "SECRET"
              : baseline === "POSSIBLY_SECRET" || defaultSensitivity.contactMatch
                ? "POSSIBLY_SECRET"
                : baseline;
          const value = {
            name,
            normalizedName: textKey(name),
            requiredness: requiredness.toUpperCase(),
            valueKind,
            secretSensitivity: sensitivity,
            defaultPresent: defaultValue !== undefined,
            defaultValueOrNull:
              defaultValue !== undefined && !defaultWithheld ? defaultValue : null,
            sourceReferenceIds: [reference.reference.id],
          };
          addCandidate(
            createCandidate({
              fieldKey: "configuration",
              value,
              normalizedKey: `configuration:${textKey(name)}`,
              extractorRefId: extractorByName.get("markdown-declarations-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "CONFIGURATION_DECLARATION",
              sourceReferenceIds: [reference.reference.id],
              confidence: 1,
              warningCodes: candidateWarnings,
            }),
          );
        } else if (inConfigurationSection && declaration.startsWith("`")) {
          retainInvalidDeclaration(["configuration"]);
          warn("configuration", "DETERMINISTIC_DECLARATION_INVALID");
        }
        const service = declaration.match(/^External service: (.+?)(?:; (required|optional))?$/u);
        if (service) {
          const name = service[1] ?? "";
          const reference = sourceRef(
            document,
            {
              type: "LINE_RANGE",
              path: document.normalizedPath,
              startLine: absoluteLine(index),
              endLine: absoluteLine(index),
            },
            line.trim(),
          );
          const value = {
            serviceName: name,
            normalizedServiceName: textKey(name),
            basis: "EXPLICIT_DECLARATION",
            requiredness: (service[2] ?? "UNKNOWN").toUpperCase(),
            sourceReferenceIds: [reference.reference.id],
          };
          addCandidate(
            createCandidate({
              fieldKey: "external_services",
              value,
              normalizedKey: `service:${textKey(name)}`,
              extractorRefId: extractorByName.get("markdown-declarations-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "MARKDOWN_TEXT",
              sourceReferenceIds: [reference.reference.id],
              confidence: 1,
              warningCodes: [],
            }),
          );
        } else if (declaration.startsWith("External service:")) {
          retainInvalidDeclaration(["external_services"]);
          warn("external_services", "DETERMINISTIC_DECLARATION_INVALID");
        }
        const limitation = declaration.match(/^Limitation: (.+)$/u);
        if (limitation) {
          const text = limitation[1] ?? "";
          const reference = sourceRef(
            document,
            {
              type: "LINE_RANGE",
              path: document.normalizedPath,
              startLine: absoluteLine(index),
              endLine: absoluteLine(index),
            },
            line.trim(),
          );
          const value = {
            text,
            normalizedKey: textKey(text),
            kind: "EXPLICIT_LIMITATION",
            sourceAIProposalIdOrNull: null,
            sourceReferenceIds: [reference.reference.id],
          };
          addCandidate(
            createCandidate({
              fieldKey: "limitations",
              value,
              normalizedKey: `limitation:EXPLICIT_LIMITATION:${textKey(text)}`,
              extractorRefId: extractorByName.get("markdown-declarations-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "MARKDOWN_TEXT",
              sourceReferenceIds: [reference.reference.id],
              confidence: 1,
              warningCodes: [],
            }),
          );
        } else if (declaration.startsWith("Limitation:")) {
          retainInvalidDeclaration(["limitations"]);
          warn("limitations", "DETERMINISTIC_DECLARATION_INVALID");
        }
        const permission = declaration.match(/^Permission: ([A-Z_]+)(?:; scope: (.+))?$/u);
        if (permission) {
          if (!permissionKinds.has(permission[1] ?? "")) {
            retainInvalidDeclaration(["permissions"]);
            warn("permissions", "DETERMINISTIC_DECLARATION_INVALID");
          } else {
            const reference = sourceRef(
              document,
              {
                type: "LINE_RANGE",
                path: document.normalizedPath,
                startLine: absoluteLine(index),
                endLine: absoluteLine(index),
              },
              declaration,
            );
            const value = {
              kind: permission[1],
              evidenceLevel: "EXPLICIT",
              scopeOrNull: permission[2] ?? null,
              absenceClaim: false,
              sourceReferenceIds: [reference.reference.id],
            };
            addCandidate(
              createCandidate({
                fieldKey: "permissions",
                value,
                normalizedKey: structKey(value),
                extractorRefId: extractorByName.get("markdown-declarations-v1")?.id ?? "",
                supportNature: "EXACT",
                claimClass: "SOURCE_FACT",
                sourceType: "MARKDOWN_TEXT",
                sourceReferenceIds: [reference.reference.id],
                confidence: 1,
                warningCodes: [],
              }),
            );
          }
        } else if (declaration.startsWith("Permission:")) {
          retainInvalidDeclaration(["permissions"]);
          warn("permissions", "DETERMINISTIC_DECLARATION_INVALID");
        }
        const compatibility = declaration.match(
          /^Compatibility: (PLATFORM|RUNTIME|HOST_TOOL|FORMAT|REGION|UNKNOWN): (.+?)(?:; constraint: (.+))?$/u,
        );
        if (compatibility) {
          const reference = sourceRef(
            document,
            {
              type: "LINE_RANGE",
              path: document.normalizedPath,
              startLine: absoluteLine(index),
              endLine: absoluteLine(index),
            },
            declaration,
          );
          const value = {
            subjectKind: compatibility[1],
            subject: compatibility[2],
            normalizedSubject: textKey(compatibility[2] ?? ""),
            constraintOrNull: compatibility[3] ?? null,
            evidenceClass: "SOURCE_DECLARATION",
            support: "UNKNOWN",
            sourceReferenceIds: [reference.reference.id],
          };
          addCandidate(
            createCandidate({
              fieldKey: "compatibility",
              value,
              normalizedKey: structKey(value),
              extractorRefId: extractorByName.get("markdown-declarations-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "MARKDOWN_TEXT",
              sourceReferenceIds: [reference.reference.id],
              confidence: 1,
              warningCodes: [],
            }),
          );
        } else if (declaration.startsWith("Compatibility:")) {
          retainInvalidDeclaration(["compatibility"]);
          warn("compatibility", "DETERMINISTIC_DECLARATION_INVALID");
        }
        const attribution = declaration.match(/^(Creator|Organization): (.+)$/u);
        if (attribution) {
          const displayName = attribution[2] ?? "";
          const fieldKey =
            attribution[1] === "Creator" ? "creator_candidates" : "organization_candidates";
          const reference = sourceRef(
            document,
            {
              type: "LINE_RANGE",
              path: document.normalizedPath,
              startLine: absoluteLine(index),
              endLine: absoluteLine(index),
            },
            declaration,
          );
          {
            const kind = attribution[1] === "Creator" ? "CREATOR" : "ORGANIZATION";
            const value = {
              kind,
              displayName,
              normalizedHandleOrNull: displayName.startsWith("@") ? handleKey(displayName) : null,
              basis: "SOURCE_DECLARATION",
              verificationState: "UNVERIFIED",
              sourceReferenceIds: [reference.reference.id],
            };
            addCandidate(
              createCandidate({
                fieldKey,
                value,
                normalizedKey: `attribution:${kind}:${value.normalizedHandleOrNull ?? textKey(displayName)}`,
                extractorRefId: extractorByName.get("markdown-declarations-v1")?.id ?? "",
                supportNature: "EXACT",
                claimClass: "SOURCE_FACT",
                sourceType: "MARKDOWN_TEXT",
                sourceReferenceIds: [reference.reference.id],
                confidence: 1,
                warningCodes: [],
              }),
            );
          }
        } else if (declaration.startsWith("Creator:")) {
          retainInvalidDeclaration(["creator_candidates"]);
          warn("creator_candidates", "DETERMINISTIC_DECLARATION_INVALID");
        } else if (declaration.startsWith("Organization:")) {
          retainInvalidDeclaration(["organization_candidates"]);
          warn("organization_candidates", "DETERMINISTIC_DECLARATION_INVALID");
        }
        if (declaration.startsWith("Attribution:")) {
          declarationState.untypedAttributionObserved = true;
          retainInvalidDeclaration(["creator_candidates", "organization_candidates"]);
          warn("creator_candidates", "ATTRIBUTION_TYPE_UNPROVEN");
          warn("organization_candidates", "ATTRIBUTION_TYPE_UNPROVEN");
        }
        if (declaration.startsWith("Deprecated:")) {
          declarationState.deprecationObserved = true;
          if (declaration === "Deprecated: true" || declaration === "Deprecated: false") {
            const reference = sourceRef(
              document,
              {
                type: "LINE_RANGE",
                path: document.normalizedPath,
                startLine: absoluteLine(index),
                endLine: absoluteLine(index),
              },
              declaration,
            );
            const value = {
              kind: "EXPLICIT_DEPRECATION",
              value: declaration === "Deprecated: true",
              sourceReferenceIds: [reference.reference.id],
            };
            addCandidate(
              createCandidate({
                fieldKey: "maintenance_signals",
                value,
                normalizedKey: `struct:${sha256Hex(canonicalJson({ kind: "EXPLICIT_DEPRECATION", value: declaration === "Deprecated: true" }))}`,
                extractorRefId: extractorByName.get("markdown-declarations-v1")?.id ?? "",
                supportNature: "EXACT",
                claimClass: "REPOSITORY_METADATA",
                sourceType: "MARKDOWN_TEXT",
                sourceReferenceIds: [reference.reference.id],
                confidence: 1,
                warningCodes: [],
              }),
            );
          } else {
            const reference = sourceRef(
              document,
              {
                type: "LINE_RANGE",
                path: document.normalizedPath,
                startLine: absoluteLine(index),
                endLine: absoluteLine(index),
              },
              declaration,
            );
            declarationState.invalidDeprecationReferenceIds.push(reference.reference.id);
            retainRoutingReference(reference.reference.id, ["maintenance_signals"]);
            warn("maintenance_signals", "DETERMINISTIC_DECLARATION_INVALID");
          }
        }
      });
    }
    if (document.normalizedPath === "package.json") {
      let manifest: unknown;
      try {
        manifest = hasDuplicateJsonObjectKeys(document.content)
          ? null
          : JSON.parse(document.content);
      } catch {
        manifest = null;
      }
      if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
        for (const key of [
          "canonical_skill_name",
          "creator_candidates",
          "organization_candidates",
          "version",
          "license",
          "dependencies",
          "compatibility",
        ] as const)
          warn(key, "DETERMINISTIC_DECLARATION_INVALID");
      } else {
        const object = manifest as Record<string, unknown>;
        const manifestRef = (pointer: string, value: unknown) =>
          sourceRef(
            document,
            { type: "JSON_POINTER", path: "package.json", jsonPointer: pointer },
            canonicalJson(value),
          );
        const routeManifestPointer = (
          pointer: string,
          value: unknown,
          fieldKeys: readonly M03FieldKey[],
        ) => {
          const reference = manifestRef(pointer, value);
          retainRoutingReference(reference.reference.id, fieldKeys);
          return reference;
        };
        if (typeof object.name === "string") {
          const ref = manifestRef("/name", object.name);
          const value = {
            normalizedName: textKey(object.name),
            displayName: object.name,
            sourceReferenceIds: [ref.reference.id],
          };
          addCandidate(
            createCandidate({
              fieldKey: "canonical_skill_name",
              value,
              normalizedKey: `name:${value.normalizedName}`,
              extractorRefId: extractorByName.get("package-json-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "PACKAGE_MANIFEST",
              sourceReferenceIds: [ref.reference.id],
              confidence: 1,
              warningCodes: [],
            }),
          );
        } else if (object.name !== undefined) {
          routeManifestPointer("/name", object.name, ["canonical_skill_name"]);
          warn("canonical_skill_name", "DETERMINISTIC_DECLARATION_INVALID");
        }
        const attributionName = (raw: unknown): string | null =>
          typeof raw === "string" ? raw : isExactStringObject(raw, "name") ? raw.name : null;
        const addManifestAttribution = (
          raw: unknown,
          pointer: string,
          basis: "MANIFEST_AUTHOR" | "MANIFEST_MAINTAINER",
        ) => {
          const name = attributionName(raw);
          if (name === null) {
            routeManifestPointer(pointer, raw, ["creator_candidates"]);
            warn("creator_candidates", "DETERMINISTIC_DECLARATION_INVALID");
            return;
          }
          const namePointer = typeof raw === "string" ? pointer : `${pointer}/name`;
          const ref = manifestRef(namePointer, name);
          const value = {
            kind: "CREATOR",
            displayName: name,
            normalizedHandleOrNull: name.startsWith("@") ? handleKey(name) : null,
            basis,
            verificationState: "UNVERIFIED",
            sourceReferenceIds: [ref.reference.id],
          };
          addCandidate(
            createCandidate({
              fieldKey: "creator_candidates",
              value,
              normalizedKey: `attribution:CREATOR:${value.normalizedHandleOrNull ?? textKey(name)}`,
              extractorRefId: extractorByName.get("package-json-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "PACKAGE_MANIFEST",
              sourceReferenceIds: [ref.reference.id],
              confidence: 1,
              warningCodes: [],
            }),
          );
        };
        if (object.author !== undefined)
          addManifestAttribution(object.author, "/author", "MANIFEST_AUTHOR");
        if (object.maintainers !== undefined) {
          if (!Array.isArray(object.maintainers)) {
            routeManifestPointer("/maintainers", object.maintainers, ["creator_candidates"]);
            warn("creator_candidates", "DETERMINISTIC_DECLARATION_INVALID");
          } else
            object.maintainers.forEach((maintainer, index) => {
              addManifestAttribution(
                maintainer,
                `/maintainers/${String(index)}`,
                "MANIFEST_MAINTAINER",
              );
            });
        }
        if (typeof object.version === "string") {
          const ref = manifestRef("/version", object.version);
          const value = {
            versionLabel: object.version,
            normalizedVersionOrNull: semverKey(object.version),
            versionSource: "MANIFEST_VERSION",
            releaseChannel: releaseChannel(object.version),
            sourceReferenceIds: [ref.reference.id],
          };
          addCandidate(
            createCandidate({
              fieldKey: "version",
              value,
              normalizedKey: `version:${semverKey(object.version) ?? textKey(object.version)}`,
              extractorRefId: extractorByName.get("package-json-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "PACKAGE_MANIFEST",
              sourceReferenceIds: [ref.reference.id],
              confidence: 1,
              warningCodes: [],
            }),
          );
        } else if (object.version !== undefined) {
          routeManifestPointer("/version", object.version, ["version"]);
          warn("version", "DETERMINISTIC_DECLARATION_INVALID");
        }
        if (typeof object.license === "string") {
          const spdx = canonicalizeSpdx(object.license);
          if (spdx === null) {
            routeManifestPointer("/license", object.license, ["license"]);
            warn("license", "UNSUPPORTED_LICENSE_IDENTIFIER");
          } else {
            const ref = manifestRef("/license", object.license);
            const value = {
              sourceReferenceIds: [ref.reference.id],
              spdxExpressionOrNull: spdx,
              customTextHashOrNull: null,
            };
            addCandidate(
              createCandidate({
                fieldKey: "license",
                value,
                normalizedKey: `license:${spdx}`,
                extractorRefId: extractorByName.get("package-json-v1")?.id ?? "",
                supportNature: "EXACT",
                claimClass: "SOURCE_FACT",
                sourceType: "PACKAGE_MANIFEST",
                sourceReferenceIds: [ref.reference.id],
                confidence: 1,
                warningCodes: [],
              }),
            );
          }
        } else if (object.license !== undefined) {
          routeManifestPointer("/license", object.license, ["license"]);
          warn("license", "DETERMINISTIC_DECLARATION_INVALID");
        }
        for (const [member, scope] of [
          ["dependencies", "REQUIRED"],
          ["optionalDependencies", "OPTIONAL"],
          ["devDependencies", "DEVELOPMENT"],
        ] as const) {
          const dependencies = object[member];
          if (dependencies === undefined) continue;
          if (
            dependencies === null ||
            typeof dependencies !== "object" ||
            Array.isArray(dependencies)
          ) {
            routeManifestPointer(`/${member}`, dependencies, ["dependencies"]);
            warn("dependencies", "DETERMINISTIC_DECLARATION_INVALID");
            continue;
          }
          for (const [name, constraint] of Object.entries(dependencies)) {
            if (typeof constraint !== "string") {
              routeManifestPointer(
                `/${member}/${name.replace(/~/gu, "~0").replace(/\//gu, "~1")}`,
                constraint,
                ["dependencies"],
              );
              warn("dependencies", "DEPENDENCY_INCOMPLETE");
              continue;
            }
            const ref = manifestRef(
              `/${member}/${name.replace(/~/gu, "~0").replace(/\//gu, "~1")}`,
              constraint,
            );
            const value = {
              kind: "PACKAGE",
              ecosystemOrNull: "NPM",
              name,
              normalizedName: normalizeDependencyName("NPM", name),
              declaredConstraintOrNull: constraint,
              scope,
              directness: "DIRECT_DECLARATION",
              sourceReferenceIds: [ref.reference.id],
            };
            addCandidate(
              createCandidate({
                fieldKey: "dependencies",
                value,
                normalizedKey: structKey(value),
                extractorRefId: extractorByName.get("package-json-v1")?.id ?? "",
                supportNature: "EXACT",
                claimClass: "SOURCE_FACT",
                sourceType: "DEPENDENCY_DECLARATION",
                sourceReferenceIds: [ref.reference.id],
                confidence: 1,
                warningCodes: [],
              }),
            );
          }
        }
        if (object.engines !== undefined) {
          if (
            object.engines === null ||
            typeof object.engines !== "object" ||
            Array.isArray(object.engines)
          ) {
            routeManifestPointer("/engines", object.engines, ["compatibility"]);
            warn("compatibility", "DETERMINISTIC_DECLARATION_INVALID");
          } else {
            for (const [runtime, constraint] of Object.entries(object.engines)) {
              if (typeof constraint !== "string") {
                routeManifestPointer(
                  `/engines/${runtime.replace(/~/gu, "~0").replace(/\//gu, "~1")}`,
                  constraint,
                  ["compatibility"],
                );
                warn("compatibility", "DETERMINISTIC_DECLARATION_INVALID");
                continue;
              }
              const ref = manifestRef(
                `/engines/${runtime.replace(/~/gu, "~0").replace(/\//gu, "~1")}`,
                constraint,
              );
              const value = {
                subjectKind: "RUNTIME",
                subject: runtime,
                normalizedSubject: textKey(runtime),
                constraintOrNull: constraint,
                evidenceClass: "SOURCE_DECLARATION",
                support: "UNKNOWN",
                sourceReferenceIds: [ref.reference.id],
              };
              addCandidate(
                createCandidate({
                  fieldKey: "compatibility",
                  value,
                  normalizedKey: structKey(value),
                  extractorRefId: extractorByName.get("package-json-v1")?.id ?? "",
                  supportNature: "EXACT",
                  claimClass: "SOURCE_FACT",
                  sourceType: "PACKAGE_MANIFEST",
                  sourceReferenceIds: [ref.reference.id],
                  confidence: 1,
                  warningCodes: [],
                }),
              );
            }
          }
        }
      }
    }
    if (document.normalizedPath === "pyproject.toml") {
      const parsed = parseSimplePyproject(document.content);
      if (!parsed.ok) {
        for (const key of [
          "canonical_skill_name",
          "creator_candidates",
          "organization_candidates",
          "version",
          "license",
          "dependencies",
          "compatibility",
        ] as const)
          warn(key, "DETERMINISTIC_DECLARATION_INVALID");
      } else {
        const projectRef = (key: string, value: unknown) =>
          sourceRef(
            document,
            {
              type: "DATA_POINTER",
              path: "pyproject.toml",
              format: "TOML",
              dataPointer: `/project/${key}`,
            },
            canonicalJson(value),
          );
        const routeProjectPointer = (
          key: string,
          value: unknown,
          fieldKeys: readonly M03FieldKey[],
        ) => {
          const reference = projectRef(key, value);
          retainRoutingReference(reference.reference.id, fieldKeys);
          return reference;
        };
        const name = parsed.project.name;
        if (typeof name === "string") {
          const ref = projectRef("name", name);
          const value = {
            normalizedName: textKey(name),
            displayName: name,
            sourceReferenceIds: [ref.reference.id],
          };
          addCandidate(
            createCandidate({
              fieldKey: "canonical_skill_name",
              value,
              normalizedKey: `name:${value.normalizedName}`,
              extractorRefId: extractorByName.get("pyproject-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "PACKAGE_MANIFEST",
              sourceReferenceIds: [ref.reference.id],
              confidence: 1,
              warningCodes: [],
            }),
          );
        } else if (name !== undefined) {
          routeProjectPointer("name", name, ["canonical_skill_name"]);
          warn("canonical_skill_name", "DETERMINISTIC_DECLARATION_INVALID");
        }
        for (const [member, basis] of [
          ["authors", "MANIFEST_AUTHOR"],
          ["maintainers", "MANIFEST_MAINTAINER"],
        ] as const) {
          const people = parsed.project[member];
          if (people === undefined) continue;
          if (!Array.isArray(people)) {
            routeProjectPointer(member, people, ["creator_candidates"]);
            warn("creator_candidates", "DETERMINISTIC_DECLARATION_INVALID");
            continue;
          }
          for (const [index, person] of people.entries()) {
            const candidate: unknown = person;
            if (!isExactStringObject(candidate, "name")) {
              routeProjectPointer(`${member}/${String(index)}`, candidate, ["creator_candidates"]);
              warn("creator_candidates", "DETERMINISTIC_DECLARATION_INVALID");
              continue;
            }
            const personName = candidate.name;
            const ref = projectRef(`${member}/${String(index)}/name`, personName);
            const value = {
              kind: "CREATOR",
              displayName: personName,
              normalizedHandleOrNull: personName.startsWith("@") ? handleKey(personName) : null,
              basis,
              verificationState: "UNVERIFIED",
              sourceReferenceIds: [ref.reference.id],
            };
            addCandidate(
              createCandidate({
                fieldKey: "creator_candidates",
                value,
                normalizedKey: `attribution:CREATOR:${value.normalizedHandleOrNull ?? textKey(personName)}`,
                extractorRefId: extractorByName.get("pyproject-v1")?.id ?? "",
                supportNature: "EXACT",
                claimClass: "SOURCE_FACT",
                sourceType: "PACKAGE_MANIFEST",
                sourceReferenceIds: [ref.reference.id],
                confidence: 1,
                warningCodes: [],
              }),
            );
          }
        }
        const version = parsed.project.version;
        if (typeof version === "string") {
          const ref = projectRef("version", version);
          const value = {
            versionLabel: version,
            normalizedVersionOrNull: semverKey(version),
            versionSource: "MANIFEST_VERSION",
            releaseChannel: releaseChannel(version),
            sourceReferenceIds: [ref.reference.id],
          };
          addCandidate(
            createCandidate({
              fieldKey: "version",
              value,
              normalizedKey: `version:${semverKey(version) ?? textKey(version)}`,
              extractorRefId: extractorByName.get("pyproject-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "PACKAGE_MANIFEST",
              sourceReferenceIds: [ref.reference.id],
              confidence: 1,
              warningCodes: [],
            }),
          );
        } else if (version !== undefined) {
          routeProjectPointer("version", version, ["version"]);
          warn("version", "DETERMINISTIC_DECLARATION_INVALID");
        }
        const license = parsed.project.license;
        if (typeof license === "string") {
          const spdx = canonicalizeSpdx(license);
          if (spdx === null) {
            routeProjectPointer("license", license, ["license"]);
            warn("license", "UNSUPPORTED_LICENSE_IDENTIFIER");
          } else {
            const ref = projectRef("license", license);
            const value = {
              sourceReferenceIds: [ref.reference.id],
              spdxExpressionOrNull: spdx,
              customTextHashOrNull: null,
            };
            addCandidate(
              createCandidate({
                fieldKey: "license",
                value,
                normalizedKey: `license:${spdx}`,
                extractorRefId: extractorByName.get("pyproject-v1")?.id ?? "",
                supportNature: "EXACT",
                claimClass: "SOURCE_FACT",
                sourceType: "PACKAGE_MANIFEST",
                sourceReferenceIds: [ref.reference.id],
                confidence: 1,
                warningCodes: [],
              }),
            );
          }
        } else if (isExactStringObject(license, "text")) {
          const ref = projectRef("license/text", license.text);
          const value = {
            sourceReferenceIds: [ref.reference.id],
            spdxExpressionOrNull: null,
            customTextHashOrNull: sha256Hex(license.text),
          };
          addCandidate(
            createCandidate({
              fieldKey: "license",
              value,
              normalizedKey: `license:${value.customTextHashOrNull}`,
              extractorRefId: extractorByName.get("pyproject-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "PACKAGE_MANIFEST",
              sourceReferenceIds: [ref.reference.id],
              confidence: 1,
              warningCodes: [],
            }),
          );
        } else if (isExactStringObject(license, "file")) {
          if (
            !["LICENSE", "LICENSE.md", "LICENSE.txt"].includes(license.file) ||
            !input.documents.some((candidate) => candidate.normalizedPath === license.file)
          ) {
            routeProjectPointer("license/file", license.file, ["license"]);
            warn("license", "DETERMINISTIC_DECLARATION_INVALID");
          }
        } else if (license !== undefined) {
          routeProjectPointer("license", license, ["license"]);
          warn("license", "DETERMINISTIC_DECLARATION_INVALID");
        }
        const dependencies = parsed.project.dependencies;
        if (Array.isArray(dependencies)) {
          for (const [index, declaration] of dependencies.entries()) {
            if (typeof declaration !== "string") {
              routeProjectPointer(`dependencies/${String(index)}`, declaration, ["dependencies"]);
              warn("dependencies", "DEPENDENCY_INCOMPLETE");
              continue;
            }
            const parsedRequirement = parsePep508Requirement(declaration);
            if (parsedRequirement === null) {
              routeProjectPointer(`dependencies/${String(index)}`, declaration, ["dependencies"]);
              warn("dependencies", "DETERMINISTIC_DECLARATION_INVALID");
              continue;
            }
            const { name, constraint } = parsedRequirement;
            const ref = sourceRef(
              document,
              {
                type: "DATA_POINTER",
                path: "pyproject.toml",
                format: "TOML",
                dataPointer: `/project/dependencies/${String(index)}`,
              },
              canonicalJson(declaration),
            );
            const value = {
              kind: "PACKAGE",
              ecosystemOrNull: "PYPI",
              name,
              normalizedName: normalizeDependencyName("PYPI", name),
              declaredConstraintOrNull: constraint,
              scope: "REQUIRED",
              directness: "DIRECT_DECLARATION",
              sourceReferenceIds: [ref.reference.id],
            };
            addCandidate(
              createCandidate({
                fieldKey: "dependencies",
                value,
                normalizedKey: structKey(value),
                extractorRefId: extractorByName.get("pyproject-v1")?.id ?? "",
                supportNature: "EXACT",
                claimClass: "SOURCE_FACT",
                sourceType: "DEPENDENCY_DECLARATION",
                sourceReferenceIds: [ref.reference.id],
                confidence: 1,
                warningCodes: [],
              }),
            );
          }
        } else if (dependencies !== undefined)
          warn("dependencies", "DETERMINISTIC_DECLARATION_INVALID");
        const optionalDependencies = parsed.project["optional-dependencies"];
        if (
          optionalDependencies !== undefined &&
          typeof optionalDependencies === "object" &&
          !Array.isArray(optionalDependencies)
        ) {
          for (const [group, declarations] of Object.entries(optionalDependencies)) {
            if (!Array.isArray(declarations)) {
              routeProjectPointer(
                `optional-dependencies/${group.replace(/~/gu, "~0").replace(/\//gu, "~1")}`,
                declarations,
                ["dependencies"],
              );
              warn("dependencies", "DETERMINISTIC_DECLARATION_INVALID");
              continue;
            }
            for (const [index, declaration] of declarations.entries()) {
              if (typeof declaration !== "string") {
                routeProjectPointer(
                  `optional-dependencies/${group.replace(/~/gu, "~0").replace(/\//gu, "~1")}/${String(index)}`,
                  declaration,
                  ["dependencies"],
                );
                warn("dependencies", "DEPENDENCY_INCOMPLETE");
                continue;
              }
              const parsedRequirement = parsePep508Requirement(declaration);
              if (parsedRequirement === null) {
                routeProjectPointer(
                  `optional-dependencies/${group.replace(/~/gu, "~0").replace(/\//gu, "~1")}/${String(index)}`,
                  declaration,
                  ["dependencies"],
                );
                warn("dependencies", "DETERMINISTIC_DECLARATION_INVALID");
                continue;
              }
              const dependencyName = parsedRequirement.name;
              const ref = projectRef(
                `optional-dependencies/${group.replace(/~/gu, "~0").replace(/\//gu, "~1")}/${String(index)}`,
                declaration,
              );
              const value = {
                kind: "PACKAGE",
                ecosystemOrNull: "PYPI",
                name: dependencyName,
                normalizedName: normalizeDependencyName("PYPI", dependencyName),
                declaredConstraintOrNull: parsedRequirement.constraint,
                scope: "OPTIONAL",
                directness: "DIRECT_DECLARATION",
                sourceReferenceIds: [ref.reference.id],
              };
              addCandidate(
                createCandidate({
                  fieldKey: "dependencies",
                  value,
                  normalizedKey: structKey(value),
                  extractorRefId: extractorByName.get("pyproject-v1")?.id ?? "",
                  supportNature: "EXACT",
                  claimClass: "SOURCE_FACT",
                  sourceType: "DEPENDENCY_DECLARATION",
                  sourceReferenceIds: [ref.reference.id],
                  confidence: 1,
                  warningCodes: [],
                }),
              );
            }
          }
        } else if (optionalDependencies !== undefined)
          warn("dependencies", "DETERMINISTIC_DECLARATION_INVALID");
        const requiresPython = parsed.project["requires-python"];
        if (typeof requiresPython === "string") {
          const ref = projectRef("requires-python", requiresPython);
          const value = {
            subjectKind: "RUNTIME",
            subject: "python",
            normalizedSubject: "python",
            constraintOrNull: requiresPython,
            evidenceClass: "SOURCE_DECLARATION",
            support: "UNKNOWN",
            sourceReferenceIds: [ref.reference.id],
          };
          addCandidate(
            createCandidate({
              fieldKey: "compatibility",
              value,
              normalizedKey: structKey(value),
              extractorRefId: extractorByName.get("pyproject-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "PACKAGE_MANIFEST",
              sourceReferenceIds: [ref.reference.id],
              confidence: 1,
              warningCodes: [],
            }),
          );
        } else if (requiresPython !== undefined) {
          routeProjectPointer("requires-python", requiresPython, ["compatibility"]);
          warn("compatibility", "DETERMINISTIC_DECLARATION_INVALID");
        }
      }
    }
    if (document.normalizedPath === "requirements.txt") {
      const declarations = scanFrozenM01Lines(document.content).map(({ content }) => content);
      let invalid = false;
      const parsed: {
        readonly line: number;
        readonly name: string;
        readonly constraint: string | null;
      }[] = [];
      for (const [index, rawLine] of declarations.entries()) {
        const line = rawLine.trim();
        if (line === "" || line.startsWith("#")) continue;
        if (/^(?:-|https?:|git\+|[A-Za-z][A-Za-z0-9+.-]*:\/\/)/u.test(line)) {
          invalid = true;
          retainDocumentRoutingReference(
            document,
            {
              type: "LINE_RANGE",
              path: document.normalizedPath,
              startLine: index + 1,
              endLine: index + 1,
            },
            line,
            ["dependencies"],
          );
          continue;
        }
        const parsedRequirement = parsePep508Requirement(line);
        if (parsedRequirement === null) {
          invalid = true;
          retainDocumentRoutingReference(
            document,
            {
              type: "LINE_RANGE",
              path: document.normalizedPath,
              startLine: index + 1,
              endLine: index + 1,
            },
            line,
            ["dependencies"],
          );
          continue;
        }
        parsed.push({
          line: index + 1,
          name: parsedRequirement.name,
          constraint: parsedRequirement.constraint,
        });
      }
      if (invalid) warn("dependencies", "DETERMINISTIC_DECLARATION_INVALID");
      else
        for (const declaration of parsed) {
          const reference = sourceRef(
            document,
            {
              type: "LINE_RANGE",
              path: document.normalizedPath,
              startLine: declaration.line,
              endLine: declaration.line,
            },
            declarations[declaration.line - 1]?.trim() ?? "",
          );
          const value = {
            kind: "PACKAGE",
            ecosystemOrNull: "PYPI",
            name: declaration.name,
            normalizedName: normalizeDependencyName("PYPI", declaration.name),
            declaredConstraintOrNull: declaration.constraint,
            scope: "REQUIRED",
            directness: "DIRECT_DECLARATION",
            sourceReferenceIds: [reference.reference.id],
          };
          addCandidate(
            createCandidate({
              fieldKey: "dependencies",
              value,
              normalizedKey: structKey(value),
              extractorRefId: extractorByName.get("requirements-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "DEPENDENCY_DECLARATION",
              sourceReferenceIds: [reference.reference.id],
              confidence: 1,
              warningCodes: [],
            }),
          );
        }
    }
    if (["LICENSE", "LICENSE.md", "LICENSE.txt"].includes(document.normalizedPath)) {
      if (document.content.length === 0) {
        retainDocumentRoutingReference(
          document,
          { type: "TREE_PATH", path: document.normalizedPath },
          null,
          ["license"],
        );
        warn("license", "UNSUPPORTED_LICENSE_IDENTIFIER");
      } else {
        const firstLine = scanFrozenM01Lines(document.content)[0]?.content ?? "";
        const prefixed = firstLine.match(/^SPDX-License-Identifier: (.+)$/u);
        if (prefixed) {
          const expression = canonicalizeSpdx(prefixed[1] ?? "");
          if (expression === null) {
            retainDocumentRoutingReference(
              document,
              {
                type: "LINE_RANGE",
                path: document.normalizedPath,
                startLine: 1,
                endLine: 1,
              },
              firstLine,
              ["license"],
            );
            warn("license", "UNSUPPORTED_LICENSE_IDENTIFIER");
          } else {
            const reference = sourceRef(
              document,
              { type: "LINE_RANGE", path: document.normalizedPath, startLine: 1, endLine: 1 },
              firstLine,
            );
            const value = {
              sourceReferenceIds: [reference.reference.id],
              spdxExpressionOrNull: expression,
              customTextHashOrNull: null,
            };
            addCandidate(
              createCandidate({
                fieldKey: "license",
                value,
                normalizedKey: `license:${expression}`,
                extractorRefId: extractorByName.get("license-v1")?.id ?? "",
                supportNature: "EXACT",
                claimClass: "SOURCE_FACT",
                sourceType: "LICENSE_TEXT",
                sourceReferenceIds: [reference.reference.id],
                confidence: 1,
                warningCodes: [],
              }),
            );
          }
        } else {
          const reference = sourceRef(
            document,
            { type: "TREE_PATH", path: document.normalizedPath },
            null,
          );
          const value = {
            sourceReferenceIds: [reference.reference.id],
            spdxExpressionOrNull: null,
            customTextHashOrNull: sha256Hex(document.content),
          };
          addCandidate(
            createCandidate({
              fieldKey: "license",
              value,
              normalizedKey: `license:${value.customTextHashOrNull}`,
              extractorRefId: extractorByName.get("license-v1")?.id ?? "",
              supportNature: "EXACT",
              claimClass: "SOURCE_FACT",
              sourceType: "LICENSE_TEXT",
              sourceReferenceIds: [reference.reference.id],
              confidence: 1,
              warningCodes: [],
            }),
          );
        }
      }
    }
    if (selectedChangelog === document) {
      const pathReference = sourceRef(
        document,
        { type: "TREE_PATH", path: document.normalizedPath },
        null,
      );
      addCandidate(
        createCandidate({
          fieldKey: "maintenance_signals",
          value: {
            kind: "CHANGELOG_PRESENT",
            value: true,
            sourceReferenceIds: [pathReference.reference.id],
          },
          normalizedKey: `struct:${sha256Hex(canonicalJson({ kind: "CHANGELOG_PRESENT", value: true }))}`,
          extractorRefId: extractorByName.get("changelog-v1")?.id ?? "",
          supportNature: "EXACT",
          claimClass: "REPOSITORY_METADATA",
          sourceType: "CHANGELOG",
          sourceReferenceIds: [pathReference.reference.id],
          confidence: 1,
          warningCodes: [],
        }),
      );
      const lines = scanFrozenM01Lines(document.content).map(({ content }) => content);
      const headings = parseMarkdownProfile(document.content).headings;
      const firstNonTitle =
        headings[0]?.level === 1 ? (headings[1] ?? null) : (headings[0] ?? null);
      const rawLabel = firstNonTitle?.level === 2 ? firstNonTitle.label : null;
      const bracketedLabel =
        rawLabel !== null &&
        rawLabel.startsWith("[") &&
        rawLabel.endsWith("]") &&
        !rawLabel.slice(1, -1).includes("[") &&
        !rawLabel.slice(1, -1).includes("]")
          ? rawLabel.slice(1, -1)
          : null;
      const current =
        rawLabel === null
          ? null
          : {
              line: (firstNonTitle?.line ?? 0) + 1,
              label: bracketedLabel ?? rawLabel,
            };
      const currentSemver = current === null ? null : semverKey(current.label);
      if (current !== null && currentSemver !== null) {
        const reference = sourceRef(
          document,
          {
            type: "LINE_RANGE",
            path: document.normalizedPath,
            startLine: current.line,
            endLine: current.line,
          },
          lines[current.line - 1] ?? "",
        );
        const versionValue = {
          versionLabel: current.label,
          normalizedVersionOrNull: semverKey(current.label),
          versionSource: "CHANGELOG",
          releaseChannel: releaseChannel(current.label),
          sourceReferenceIds: [reference.reference.id],
        };
        addCandidate(
          createCandidate({
            fieldKey: "version",
            value: versionValue,
            normalizedKey: `version:${currentSemver}`,
            extractorRefId: extractorByName.get("changelog-v1")?.id ?? "",
            supportNature: "EXACT",
            claimClass: "SOURCE_FACT",
            sourceType: "CHANGELOG",
            sourceReferenceIds: [reference.reference.id],
            confidence: 1,
            warningCodes: [],
          }),
        );
        addCandidate(
          createCandidate({
            fieldKey: "maintenance_signals",
            value: {
              kind: "CURRENT_CHANGELOG_ENTRY",
              valueOrNull: current.label,
              sourceReferenceIds: [reference.reference.id],
            },
            normalizedKey: `struct:${sha256Hex(canonicalJson({ kind: "CURRENT_CHANGELOG_ENTRY", valueOrNull: current.label }))}`,
            extractorRefId: extractorByName.get("changelog-v1")?.id ?? "",
            supportNature: "EXACT",
            claimClass: "REPOSITORY_METADATA",
            sourceType: "CHANGELOG",
            sourceReferenceIds: [reference.reference.id],
            confidence: 1,
            warningCodes: [],
          }),
        );
      }
    }
    for (const permission of scanStaticPermissions({
      sourceSnapshotId: input.sourceSnapshotId,
      sourceEntryId: document.sourceEntryId,
      sourceDocumentId: document.sourceDocumentId,
      ownership: document.ownership,
      normalizedPath: document.normalizedPath,
      documentContent: document.content,
      provenanceAuthority,
    })) {
      references.push(permission.reference);
      const locatorWarningCodes = warningSort([
        ...(permission.sensitivity.locatorSecretMatch
          ? (["SECRET_LIKE_VALUE_WITHHELD"] as const)
          : []),
        ...(permission.sensitivity.locatorContactMatch
          ? (["PERSONAL_CONTACT_WITHHELD"] as const)
          : []),
      ]);
      const excerptWarningCodes = warningSort([
        ...(permission.sensitivity.excerptSecretMatch
          ? (["SECRET_LIKE_VALUE_WITHHELD"] as const)
          : []),
        ...(permission.sensitivity.excerptContactMatch
          ? (["PERSONAL_CONTACT_WITHHELD"] as const)
          : []),
      ]);
      if (locatorWarningCodes.length > 0 || excerptWarningCodes.length > 0)
        referenceSensitivityById.set(permission.reference.id, {
          locatorWarningCodes,
          excerptWarningCodes,
        });
      addCandidate(
        createCandidate({
          fieldKey: "permissions",
          value: permission.value,
          normalizedKey: structKey(permission.value),
          extractorRefId: extractorByName.get("static-permission-v1")?.id ?? "",
          supportNature: "INFERENTIAL",
          claimClass: "STATIC_CODE_INDICATOR",
          sourceType: "STATIC_CODE",
          sourceReferenceIds: permission.value.sourceReferenceIds,
          confidence: 0.7,
          warningCodes: ["PERMISSION_NOT_PROVEN_ABSENT"],
        }),
      );
    }
  }

  const archivedRef = createSnapshotMetadataReference({
    sourceSnapshotId: input.sourceSnapshotId,
    metadataFingerprintKind: "PROVIDER_METADATA",
    metadataFingerprint: input.providerMetadataFingerprint,
    locator: { type: "REPOSITORY_FIELD", metadataKey: "archived" },
    value: input.providerMetadata.archived,
  });
  references.push(archivedRef);
  addCandidate(
    createCandidate({
      fieldKey: "maintenance_signals",
      value: {
        kind: "ARCHIVED",
        value: input.providerMetadata.archived,
        sourceReferenceIds: [archivedRef.id],
      },
      normalizedKey: `struct:${sha256Hex(canonicalJson({ kind: "ARCHIVED", value: input.providerMetadata.archived }))}`,
      extractorRefId: extractorByName.get("provider-metadata-v1")?.id ?? "",
      supportNature: "EXACT",
      claimClass: "REPOSITORY_METADATA",
      sourceType: "REPOSITORY_METADATA",
      sourceReferenceIds: [archivedRef.id],
      confidence: 1,
      warningCodes: input.providerMetadata.archived ? ["ARCHIVED_SOURCE"] : [],
    }),
  );
  if (selectedChangelog === undefined) {
    const changelogAbsence = createInventoryAbsenceReference({
      sourceSnapshotId: input.sourceSnapshotId,
      candidateRootId: input.candidateRootId,
      ownershipTopologyFingerprint: input.ownershipTopologyFingerprint,
      acquisitionResultFingerprint: input.acquisitionResultFingerprint,
      predicate: "CHANGELOG_SELECTOR_SET_EMPTY",
      evaluatedSelectorPaths: ["CHANGELOG.md", "CHANGELOG.txt", "CHANGES.md"],
    });
    references.push(changelogAbsence);
    addCandidate(
      createCandidate({
        fieldKey: "maintenance_signals",
        value: {
          kind: "CHANGELOG_PRESENT",
          value: false,
          sourceReferenceIds: [changelogAbsence.id],
        },
        normalizedKey: `struct:${sha256Hex(canonicalJson({ kind: "CHANGELOG_PRESENT", value: false }))}`,
        extractorRefId: extractorByName.get("inventory-absence-v1")?.id ?? "",
        supportNature: "EXACT",
        claimClass: "REPOSITORY_METADATA",
        sourceType: "INVENTORY_ABSENCE",
        sourceReferenceIds: [changelogAbsence.id],
        confidence: 1,
        warningCodes: [],
      }),
    );
  }
  if (
    !declarationState.deprecationObserved &&
    !candidates.some(
      (candidate) =>
        candidate.fieldKey === "maintenance_signals" &&
        (candidate.value as { kind?: string }).kind === "EXPLICIT_DEPRECATION",
    )
  ) {
    const deprecationAbsence = createInventoryAbsenceReference({
      sourceSnapshotId: input.sourceSnapshotId,
      candidateRootId: input.candidateRootId,
      ownershipTopologyFingerprint: input.ownershipTopologyFingerprint,
      acquisitionResultFingerprint: input.acquisitionResultFingerprint,
      predicate: "DEPRECATION_DECLARATION_ABSENT",
      evaluatedSelectorPaths: ["SKILL.md", "README.md"],
    });
    references.push(deprecationAbsence);
    addCandidate(
      createCandidate({
        fieldKey: "maintenance_signals",
        value: {
          kind: "EXPLICIT_DEPRECATION",
          value: false,
          sourceReferenceIds: [deprecationAbsence.id],
        },
        normalizedKey: `struct:${sha256Hex(canonicalJson({ kind: "EXPLICIT_DEPRECATION", value: false }))}`,
        extractorRefId: extractorByName.get("inventory-absence-v1")?.id ?? "",
        supportNature: "EXACT",
        claimClass: "REPOSITORY_METADATA",
        sourceType: "INVENTORY_ABSENCE",
        sourceReferenceIds: [deprecationAbsence.id],
        confidence: 1,
        warningCodes: [],
      }),
    );
  }
  warn("maintenance_signals", "PREDECESSOR_METADATA_INSUFFICIENT");
  for (const fieldKey of ["creator_candidates", "organization_candidates"] as const) {
    if (
      !candidates.some((candidate) => candidate.fieldKey === fieldKey) &&
      !declarationState.untypedAttributionObserved
    )
      warn(fieldKey, "ATTRIBUTION_TYPE_UNPROVEN");
  }
  warn("permissions", "PERMISSION_NOT_PROVEN_ABSENT");
  warn("compatibility", "COMPATIBILITY_NOT_RUNTIME_VERIFIED");

  const reconciledFields = M03_FIELD_KEYS.map((fieldKey): ExtractionFieldResultV1 => {
    const supports = candidates.filter((candidate) => candidate.fieldKey === fieldKey);
    const configured = extractors
      .filter((extractor) => extractor.ownedFieldKeys.includes(fieldKey))
      .map((extractor) => extractor.id)
      .sort();
    const warnings = warningSort([
      ...(directFieldWarnings.get(fieldKey) ?? []),
      ...supports.flatMap((candidate) => candidate.warningCodes),
    ]);
    if (fieldKey === "source_revision")
      return positiveField(fieldKey, sourceRevisionValue, supports, configured, warnings);
    if (fieldKey === "canonical_skill_name") {
      if (supports.length === 0)
        return warnings.some((warning) => reviewRoutingWarnings.has(warning))
          ? emptyReviewField(fieldKey, configured, warnings)
          : missingField(fieldKey, configured, warnings);
      if (
        warnings.some(
          (warning) => reviewRoutingWarnings.has(warning) && !privacyWarnings.has(warning),
        )
      )
        return emptyReviewField(fieldKey, configured, warnings);
      const tierOrder = [
        "SKILL_METADATA",
        "PACKAGE_MANIFEST",
        "MARKDOWN_TEXT",
        "REPOSITORY_METADATA",
      ];
      const selectedTier = tierOrder.find((sourceType) =>
        supports.some((candidate) => candidate.sourceType === sourceType),
      );
      const tierSupports = supports.filter((candidate) => candidate.sourceType === selectedTier);
      const identities = new Set(
        tierSupports.map(
          (candidate) => (candidate.value as { normalizedName: string }).normalizedName,
        ),
      );
      if (identities.size > 1) {
        const conflict = createConflict(fieldKey, "SAME_TIER_DISTINCT_VALUES", tierSupports);
        conflicts.push(conflict);
        return conflictingField(fieldKey, null, tierSupports, [conflict], warnings);
      }
      const winner = [...tierSupports].sort((left, right) => {
        const leftName = (left.value as { displayName: string }).displayName;
        const rightName = (right.value as { displayName: string }).displayName;
        return (
          Buffer.from(leftName).compare(Buffer.from(rightName)) ||
          compareUnsignedUtf8(left.id, right.id)
        );
      })[0];
      const value = {
        ...(winner?.value as {
          normalizedName: string;
          displayName: string;
          sourceReferenceIds: readonly string[];
        }),
        sourceReferenceIds: [
          ...new Set(tierSupports.flatMap((candidate) => candidate.sourceReferenceIds)),
        ].sort(),
      };
      return positiveField(fieldKey, value, tierSupports, configured, warnings);
    }
    if (fieldKey === "version") {
      const values = supports.map(
        (candidate) =>
          candidate.value as {
            versionLabel: string;
            normalizedVersionOrNull: string | null;
            versionSource: string;
            releaseChannel: string;
            sourceReferenceIds: readonly string[];
          },
      );
      if (values.length === 0 && warnings.some((warning) => reviewRoutingWarnings.has(warning)))
        return emptyReviewField(fieldKey, configured, warnings);
      if (
        warnings.some(
          (warning) => reviewRoutingWarnings.has(warning) && !privacyWarnings.has(warning),
        )
      )
        return emptyReviewField(fieldKey, configured, warnings);
      if (values.length === 0) {
        const fallback = {
          versionLabel: `snapshot-${input.sourceRevision.slice(0, 12)}`,
          normalizedVersionOrNull: null,
          versionSource: "AI_ARK_SNAPSHOT",
          releaseChannel: "UNKNOWN",
          sourceReferenceIds: [snapshotRevisionRef.id],
        };
        const fallbackCandidate = createCandidate({
          fieldKey: "version",
          value: fallback,
          normalizedKey: `version:${textKey(fallback.versionLabel)}`,
          extractorRefId: extractorByName.get("source-revision-v1")?.id ?? "",
          supportNature: "EXACT",
          claimClass: "SOURCE_FACT",
          sourceType: "SOURCE_REVISION_FALLBACK",
          sourceReferenceIds: [snapshotRevisionRef.id],
          confidence: 1,
          warningCodes: [],
        });
        candidates.push(fallbackCandidate);
        return positiveField(
          fieldKey,
          { state: "FALLBACK", selectedOrNull: fallback, preferredCandidateIdOrNull: null },
          [fallbackCandidate],
          configured,
          warnings,
        );
      }
      const highestTier = supports.some((candidate) => candidate.sourceType === "PACKAGE_MANIFEST")
        ? supports.filter((candidate) => candidate.sourceType === "PACKAGE_MANIFEST")
        : supports.some((candidate) => candidate.sourceType === "SKILL_METADATA")
          ? supports.filter((candidate) => candidate.sourceType === "SKILL_METADATA")
          : supports;
      const identities = new Set(
        highestTier.map(
          (candidate) =>
            (candidate.value as { normalizedVersionOrNull: string | null; versionLabel: string })
              .normalizedVersionOrNull ??
            textKey((candidate.value as { versionLabel: string }).versionLabel),
        ),
      );
      if (identities.size > 1) {
        const conflict = createConflict(fieldKey, "SAME_TIER_DISTINCT_VALUES", highestTier);
        conflicts.push(conflict);
        return conflictingField(
          fieldKey,
          { state: "CONFLICTING", selectedOrNull: null, preferredCandidateIdOrNull: null },
          highestTier,
          [conflict],
          warnings,
        );
      }
      const selected = highestTier[0]?.value as (typeof values)[number] | undefined;
      const agreeing = highestTier.filter(
        (candidate) =>
          (candidate.value as { normalizedVersionOrNull: string | null })
            .normalizedVersionOrNull === selected?.normalizedVersionOrNull,
      );
      return positiveField(
        fieldKey,
        {
          state: "RESOLVED",
          selectedOrNull: {
            ...selected,
            sourceReferenceIds: [
              ...new Set(agreeing.flatMap((candidate) => candidate.sourceReferenceIds)),
            ].sort(),
          },
          preferredCandidateIdOrNull: null,
        },
        agreeing,
        configured,
        warnings,
      );
    }
    if (fieldKey === "license") {
      if (supports.length === 0)
        return warnings.some((warning) => reviewRoutingWarnings.has(warning))
          ? emptyReviewField(fieldKey, configured, warnings)
          : missingField(fieldKey, configured, warnings);
      if (
        warnings.some(
          (warning) => reviewRoutingWarnings.has(warning) && !privacyWarnings.has(warning),
        )
      )
        return emptyReviewField(fieldKey, configured, warnings);
      const identities = new Set(
        supports.map((candidate) => {
          const value = candidate.value as {
            spdxExpressionOrNull: string | null;
            customTextHashOrNull: string | null;
          };
          return value.spdxExpressionOrNull === null
            ? `custom:${value.customTextHashOrNull ?? ""}`
            : `spdx:${canonicalizeSpdx(value.spdxExpressionOrNull) ?? ""}`;
        }),
      );
      if (identities.size > 1) {
        const conflict = createConflict(fieldKey, "LICENSE_METADATA_TEXT_DISAGREE", supports);
        conflicts.push(conflict);
        return conflictingField(
          fieldKey,
          { state: "CONFLICTING", selectedOrNull: null, preferredCandidateIdOrNull: null },
          supports,
          [conflict],
          warnings,
        );
      }
      const selected = supports[0]?.value as Record<string, unknown>;
      const agreeing = supports.filter(
        (candidate) =>
          (candidate.value as { spdxExpressionOrNull: string | null }).spdxExpressionOrNull ===
          selected.spdxExpressionOrNull,
      );
      return positiveField(
        fieldKey,
        {
          state: selected.spdxExpressionOrNull ? "CONFIRMED" : "CUSTOM",
          selectedOrNull: {
            ...selected,
            sourceReferenceIds: [
              ...new Set(agreeing.flatMap((candidate) => candidate.sourceReferenceIds)),
            ].sort(),
          },
          preferredCandidateIdOrNull: null,
        },
        agreeing,
        configured,
        warnings,
      );
    }
    if (fieldKey === "installation") {
      if (supports.length === 0)
        return installationNoPathReview
          ? emptyReviewField(fieldKey, configured, warnings)
          : missingField(fieldKey, configured, warnings);
      const labelGroups = new Map<string, ExtractionCandidateV1[]>();
      for (const candidate of supports) {
        const label = (candidate.value as { labelOrNull?: string | null }).labelOrNull ?? null;
        const key = label === null ? "UNLABELED" : `LABELED:${textKey(label)}`;
        const group = labelGroups.get(key) ?? [];
        group.push(candidate);
        labelGroups.set(key, group);
      }
      const divergent = [...labelGroups.values()].find(
        (group) =>
          new Set(group.map((candidate) => canonicalJson(stripValueProvenance(candidate.value))))
            .size > 1,
      );
      if (divergent !== undefined) {
        const conflict = createConflict(fieldKey, "INSTALLATION_PATHS_DIVERGE", divergent);
        conflicts.push(conflict);
        return conflictingField(
          fieldKey,
          { state: "UNSAFE_OR_AMBIGUOUS", paths: [] },
          divergent,
          [conflict],
          warnings,
        );
      }
      const paths = supports.map((candidate) => candidate.value);
      const review = warnings.some((warning) =>
        [
          "INSTALL_COMMAND_UNSAFE",
          "INSTALL_CONTEXT_INCOMPLETE",
          "INSTALL_PATH_KINDS_MIXED",
          "SECRET_LIKE_COMMAND_WITHHELD",
          "SECRET_LIKE_VALUE_WITHHELD",
          "PERSONAL_CONTACT_WITHHELD",
          "DETERMINISTIC_DECLARATION_INVALID",
        ].includes(warning),
      );
      const hasInferred = supports.some((candidate) => candidate.supportNature === "INFERENTIAL");
      const unsafeOrAmbiguous = warnings.some((warning) =>
        [
          "INSTALL_COMMAND_UNSAFE",
          "INSTALL_PATH_KINDS_MIXED",
          "SECRET_LIKE_COMMAND_WITHHELD",
          "SECRET_LIKE_VALUE_WITHHELD",
          "PERSONAL_CONTACT_WITHHELD",
          "DETERMINISTIC_DECLARATION_INVALID",
        ].includes(warning),
      );
      const state = review
        ? unsafeOrAmbiguous
          ? "UNSAFE_OR_AMBIGUOUS"
          : "EXPLICIT_PARTIAL"
        : hasInferred
          ? "INFERRED"
          : paths.length === 1
            ? "EXPLICIT_COMPLETE"
            : "MULTIPLE_PATHS";
      return reviewFieldOrPositive(
        fieldKey,
        { state, paths },
        supports,
        configured,
        warnings,
        review,
      );
    }
    if (fieldKey === "maintenance_signals") {
      const deprecations = supports.filter(
        (candidate) => (candidate.value as { kind?: string }).kind === "EXPLICIT_DEPRECATION",
      );
      const changelog = supports.find(
        (candidate) => (candidate.value as { kind?: string }).kind === "CHANGELOG_PRESENT",
      );
      const currentEntry = supports.find(
        (candidate) => (candidate.value as { kind?: string }).kind === "CURRENT_CHANGELOG_ENTRY",
      );
      const deprecationValues = new Set(
        deprecations.map((candidate) => (candidate.value as { value: boolean }).value),
      );
      const invalidDeprecation = declarationState.invalidDeprecationReferenceIds.length > 0;
      const deprecationDisagreement = deprecationValues.size > 1;
      if (deprecationDisagreement && !warnings.includes("MULTIPLE_EXPLICIT_VALUES"))
        warnings.push("MULTIPLE_EXPLICIT_VALUES");
      const evidenceIds = [
        ...new Set([
          ...supports.flatMap((candidate) => candidate.sourceReferenceIds),
          ...declarationState.invalidDeprecationReferenceIds,
        ]),
      ].sort();
      const value = {
        archived: input.providerMetadata.archived,
        providerUpdatedAtOrNull: null,
        matchingReleaseOrTagDateOrNull: null,
        changelogPresent: (changelog?.value as { value?: boolean } | undefined)?.value ?? false,
        currentChangelogEntryOrNull:
          (currentEntry?.value as { valueOrNull?: string } | undefined)?.valueOrNull ?? null,
        explicitDeprecation:
          invalidDeprecation || deprecationDisagreement
            ? null
            : deprecations.length > 0
              ? (deprecations[0]?.value as { value: boolean }).value
              : false,
        predecessorMetadataComplete: false,
        sourceReferenceIds: evidenceIds,
      };
      if (invalidDeprecation || deprecationDisagreement)
        return {
          fieldKey,
          value,
          status: "REVIEW_REQUIRED",
          claimClass: "REPOSITORY_METADATA",
          confidence: null,
          deterministicCandidateIds: supports.map((candidate) => candidate.id).sort(),
          aiProposalIds: [],
          evidenceIds,
          conflictIds: [],
          warningCodes: warningSort(warnings),
          extractorRefs: [...configured],
        };
      return positiveField(fieldKey, value, supports, configured, warnings);
    }
    if (supports.length === 0) {
      if (fieldKey === "limitations") warnings.push("NO_KNOWN_LIMITATION_NOT_PROVEN");
      if (fieldKey === "permissions" && warnings.includes("UNSUPPORTED_STATIC_LANGUAGE"))
        return unsupportedField(fieldKey, configured, warningSort(warnings));
      if (warnings.some((warning) => reviewRoutingWarnings.has(warning)))
        return emptyReviewField(fieldKey, configured, warningSort(warnings));
      return missingField(fieldKey, configured, warningSort(warnings));
    }
    if (
      (fieldKey === "creator_candidates" || fieldKey === "organization_candidates") &&
      warnings.includes("ATTRIBUTION_TYPE_UNPROVEN")
    )
      return emptyReviewField(fieldKey, configured, warnings);
    if (
      fieldKey === "configuration" &&
      warnings.some((warning) =>
        [
          "CONFIGURATION_TYPE_UNKNOWN",
          "SENSITIVE_CONFIGURATION_DEFAULT_WITHHELD",
          "PERSONAL_CONTACT_WITHHELD",
        ].includes(warning),
      )
    )
      return emptyReviewField(fieldKey, configured, warnings);
    const reconciliationGroups = new Map<string, ExtractionCandidateV1[]>();
    for (const candidate of supports) {
      const key = fieldReconciliationKey(fieldKey, candidate.value);
      const group = reconciliationGroups.get(key) ?? [];
      group.push(candidate);
      reconciliationGroups.set(key, group);
    }
    const divergent = [...reconciliationGroups.values()].find(
      (group) =>
        new Set(group.map((candidate) => canonicalJson(stripValueProvenance(candidate.value))))
          .size > 1,
    );
    if (divergent !== undefined) {
      const reason =
        fieldKey === "permissions"
          ? "PERMISSION_ASSERTIONS_DIVERGE"
          : fieldKey === "compatibility"
            ? "COMPATIBILITY_ASSERTIONS_DIVERGE"
            : fieldKey === "categories"
              ? "TAXONOMY_MAPPING_AMBIGUOUS"
              : "SAME_TIER_DISTINCT_VALUES";
      const conflict = createConflict(fieldKey, reason, divergent);
      conflicts.push(conflict);
      return conflictingField(fieldKey, emptyValue(fieldKey), divergent, [conflict], warnings);
    }
    const selectedValues = deduplicateValues(fieldKey, supports);
    return positiveField(
      fieldKey,
      fieldKey === "outcome_candidate"
        ? selectedValues[0]
        : fieldKey === "target_user_candidates"
          ? { targetUsers: [], bestFor: [], notIdealFor: [] }
          : selectedValues,
      supports,
      configured,
      warnings,
    );
  });
  const fields = reconciledFields.map((field): ExtractionFieldResultV1 => {
    if (!privacyReviewRequiredFields.has(field.fieldKey) || field.status === "CONFLICTING")
      return field;
    if (field.fieldKey === "installation") {
      const paths = (field.value as { paths?: readonly unknown[] }).paths ?? [];
      if (paths.length === 0)
        return emptyReviewField(field.fieldKey, field.extractorRefs, field.warningCodes);
      return {
        ...field,
        value: { ...(field.value as object), state: "UNSAFE_OR_AMBIGUOUS" },
        status: "REVIEW_REQUIRED",
        confidence: null,
        aiProposalIds: [],
        conflictIds: [],
      };
    }
    if (field.fieldKey === "maintenance_signals")
      return {
        ...field,
        status: "REVIEW_REQUIRED",
        claimClass: "REPOSITORY_METADATA",
        confidence: null,
        aiProposalIds: [],
        conflictIds: [],
      };
    return emptyReviewField(field.fieldKey, field.extractorRefs, field.warningCodes);
  });
  const referenceById = new Map<string, ExtractionSourceReferenceV1>();
  for (const reference of references) {
    const existing = referenceById.get(reference.id);
    if (existing !== undefined && canonicalJson(existing) !== canonicalJson(reference))
      throw new Error("CONTENT_DERIVED_ID_COLLISION");
    referenceById.set(reference.id, reference);
  }
  candidates.sort(
    (left, right) =>
      Buffer.from(left.fieldKey).compare(Buffer.from(right.fieldKey)) ||
      Buffer.from(left.normalizedKey).compare(Buffer.from(right.normalizedKey)) ||
      Buffer.from(canonicalJson(left.sourceReferenceIds)).compare(
        Buffer.from(canonicalJson(right.sourceReferenceIds)),
      ) ||
      compareUnsignedUtf8(left.id, right.id),
  );
  conflicts.sort(
    (left, right) =>
      M03_FIELD_KEYS.indexOf(left.fieldKey) - M03_FIELD_KEYS.indexOf(right.fieldKey) ||
      Buffer.from(left.reasonCode).compare(Buffer.from(right.reasonCode)) ||
      Buffer.from(canonicalJson(left.candidateIds)).compare(
        Buffer.from(canonicalJson(right.candidateIds)),
      ) ||
      compareUnsignedUtf8(left.id, right.id),
  );
  const supportReferenceIds = new Set([
    ...candidates.flatMap((candidate) => candidate.sourceReferenceIds),
    ...conflicts.flatMap((conflict) => conflict.sourceReferenceIds),
    ...fields.flatMap((field) => field.evidenceIds),
  ]);
  const operationReferenceIds = new Set(
    [...operationSourceReferenceIds.values()].flatMap((ids) => [...ids]),
  );
  const routingSourceReferenceIds = [...explicitRoutingSourceReferenceIds].sort(
    compareUnsignedUtf8,
  );
  const requiredReferenceIds = [
    ...new Set([...supportReferenceIds, ...routingSourceReferenceIds, ...operationReferenceIds]),
  ].sort(compareUnsignedUtf8);
  const uniqueReferences = requiredReferenceIds.map((id) => {
    const reference = referenceById.get(id);
    if (reference === undefined) throw new Error("SOURCE_REFERENCE_INVALID");
    return reference;
  });
  return {
    sourceReferences: uniqueReferences,
    sensitiveReferenceWarningCodesById: Object.fromEntries(
      [...referenceSensitivityById.entries()]
        .map(
          ([id, sensitivity]) =>
            [
              id,
              warningSort([...sensitivity.locatorWarningCodes, ...sensitivity.excerptWarningCodes]),
            ] as const,
        )
        .filter(([, warningCodes]) => warningCodes.length > 0)
        .sort(([left], [right]) => compareUnsignedUtf8(left, right)),
    ),
    routingSourceReferenceIds,
    operationSourceReferenceIds: Object.fromEntries(
      [...operationSourceReferenceIds.entries()].map(([operation, ids]) => [
        operation,
        [...ids].sort(compareUnsignedUtf8),
      ]),
    ),
    extractorRefs: extractors,
    deterministicCandidates: candidates,
    conflicts,
    fields,
    warningCodes: warningSort(fields.flatMap((field) => field.warningCodes)),
  };
}

const reviewRoutingWarnings = new Set<M03WarningCode>([
  "SOURCE_CORPUS_INCOMPLETE",
  "SOURCE_DISPOSITION_EXCLUDED",
  "DEPENDENCY_INCOMPLETE",
  "UNRECOGNIZED_MANIFEST",
  "DETERMINISTIC_DECLARATION_INVALID",
  "UNSUPPORTED_LICENSE_IDENTIFIER",
  "SECRET_LIKE_VALUE_WITHHELD",
  "PERSONAL_CONTACT_WITHHELD",
]);

const privacyWarnings = new Set<M03WarningCode>([
  "SECRET_LIKE_VALUE_WITHHELD",
  "PERSONAL_CONTACT_WITHHELD",
]);

function stripValueProvenance(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripValueProvenance);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Readonly<Record<string, unknown>>)
      .filter(([key]) => key !== "sourceReferenceIds" && key !== "sourceAIProposalIdOrNull")
      .map(([key, member]) => [key, stripValueProvenance(member)]),
  );
}

function fieldValueSortKey(fieldKey: M03FieldKey, value: unknown): string {
  const item = value as Readonly<Record<string, unknown>>;
  const attributionBasis = [
    "SKILL_METADATA",
    "MANIFEST_AUTHOR",
    "MANIFEST_MAINTAINER",
    "SOURCE_DECLARATION",
    "PROVIDER_OWNER",
  ];
  switch (fieldKey) {
    case "creator_candidates":
    case "organization_candidates":
      return canonicalJson([
        attributionBasis.indexOf(String(item.basis)),
        item.normalizedHandleOrNull ?? "",
        item.displayName,
        item.sourceReferenceIds,
      ]);
    case "dependencies":
      return canonicalJson([
        item.kind,
        item.ecosystemOrNull ?? "",
        item.normalizedName,
        item.scope,
        item.declaredConstraintOrNull ?? "",
      ]);
    case "configuration":
      return canonicalJson([item.normalizedName]);
    case "permissions":
      return canonicalJson([item.kind, item.scopeOrNull ?? "", item.evidenceLevel]);
    case "compatibility":
      return canonicalJson([
        item.subjectKind,
        item.normalizedSubject,
        item.constraintOrNull ?? "",
        item.evidenceClass,
      ]);
    case "categories":
      return canonicalJson([item.normalizedLabel, item.mappingState, item.taxonomyIdOrNull ?? ""]);
    case "capabilities":
    case "tasks":
    case "use_cases":
      return canonicalJson([
        item.normalizedKey,
        item.proposalKind,
        item.sourceReferenceIds,
        item.id ?? "",
      ]);
    case "external_services":
      return canonicalJson([item.normalizedServiceName, item.basis, item.requiredness]);
    case "limitations":
      return canonicalJson([item.normalizedKey, item.kind]);
    default:
      return canonicalJson(stripValueProvenance(value));
  }
}

function fieldReconciliationKey(fieldKey: M03FieldKey, value: unknown): string {
  const item = value as Readonly<Record<string, unknown>>;
  switch (fieldKey) {
    case "creator_candidates":
    case "organization_candidates":
      return canonicalJson([
        item.kind,
        item.normalizedHandleOrNull ??
          textKey(typeof item.displayName === "string" ? item.displayName : ""),
      ]);
    case "categories":
      return canonicalJson([item.taxonomyIdOrNull ?? item.normalizedLabel]);
    case "capabilities":
    case "tasks":
    case "use_cases":
    case "target_user_candidates":
    case "outcome_candidate":
      return canonicalJson([item.proposalKind, item.normalizedKey]);
    case "configuration":
      return canonicalJson([item.normalizedName]);
    case "dependencies":
      return canonicalJson([
        item.kind,
        item.ecosystemOrNull ?? "",
        item.normalizedName,
        item.scope,
      ]);
    case "external_services":
      return canonicalJson([item.normalizedServiceName]);
    case "permissions":
      return canonicalJson([item.kind, item.scopeOrNull ?? ""]);
    case "compatibility":
      return canonicalJson([item.subjectKind, item.normalizedSubject]);
    case "limitations":
      return canonicalJson([item.normalizedKey]);
    default:
      return canonicalJson(stripValueProvenance(value));
  }
}

function deduplicateValues(
  fieldKey: M03FieldKey,
  candidates: readonly ExtractionCandidateV1[],
): unknown[] {
  const grouped = new Map<string, unknown[]>();
  for (const candidate of candidates) {
    const key = canonicalJson(stripValueProvenance(candidate.value));
    const values = grouped.get(key) ?? [];
    values.push(candidate.value);
    grouped.set(key, values);
  }
  return [...grouped.values()]
    .map((values) => {
      const first = [...values].sort((left, right) =>
        compareUnsignedUtf8(canonicalJson(left), canonicalJson(right)),
      )[0] as Readonly<Record<string, unknown>>;
      const sourceReferenceIds = [
        ...new Set(
          values.flatMap((value) =>
            Array.isArray((value as { sourceReferenceIds?: unknown }).sourceReferenceIds)
              ? (value as { sourceReferenceIds: string[] }).sourceReferenceIds
              : [],
          ),
        ),
      ].sort(compareUnsignedUtf8);
      return { ...first, sourceReferenceIds };
    })
    .sort((left, right) =>
      compareUnsignedUtf8(fieldValueSortKey(fieldKey, left), fieldValueSortKey(fieldKey, right)),
    );
}

function positiveField(
  fieldKey: M03FieldKey,
  value: unknown,
  supports: readonly ExtractionCandidateV1[],
  extractorRefs: readonly string[],
  warningCodes: readonly M03WarningCode[],
): ExtractionFieldResultV1 {
  const confidence = Math.min(...supports.map((candidate) => candidate.confidence));
  const claimClasses = new Set(supports.map((candidate) => candidate.claimClass));
  const inferential = supports.some((candidate) => candidate.supportNature === "INFERENTIAL");
  return {
    fieldKey,
    value,
    status: inferential ? (confidence >= 0.85 ? "STRONGLY_SUPPORTED" : "INFERRED") : "EXPLICIT",
    claimClass:
      claimClasses.size > 1
        ? "MIXED_DETERMINISTIC_SUPPORT"
        : (supports[0]?.claimClass ?? "NO_CLAIM"),
    confidence,
    deterministicCandidateIds: supports.map((candidate) => candidate.id).sort(),
    aiProposalIds: [],
    evidenceIds: [...new Set(supports.flatMap((candidate) => candidate.sourceReferenceIds))].sort(),
    conflictIds: [],
    warningCodes: warningSort(warningCodes),
    extractorRefs: [...extractorRefs],
  };
}

function missingField(
  fieldKey: M03FieldKey,
  extractorRefs: readonly string[],
  warningCodes: readonly M03WarningCode[],
): ExtractionFieldResultV1 {
  return {
    fieldKey,
    value: emptyValue(fieldKey),
    status: "MISSING",
    claimClass: "NO_CLAIM",
    confidence: null,
    deterministicCandidateIds: [],
    aiProposalIds: [],
    evidenceIds: [],
    conflictIds: [],
    warningCodes: warningSort(warningCodes),
    extractorRefs: [...extractorRefs],
  };
}

function emptyReviewField(
  fieldKey: M03FieldKey,
  extractorRefs: readonly string[],
  warningCodes: readonly M03WarningCode[],
): ExtractionFieldResultV1 {
  const value =
    fieldKey === "version"
      ? { state: "REVIEW_REQUIRED", selectedOrNull: null, preferredCandidateIdOrNull: null }
      : fieldKey === "license"
        ? { state: "REVIEW_REQUIRED", selectedOrNull: null, preferredCandidateIdOrNull: null }
        : fieldKey === "installation"
          ? { state: "UNSAFE_OR_AMBIGUOUS", paths: [] }
          : emptyValue(fieldKey);
  return {
    fieldKey,
    value,
    status: "REVIEW_REQUIRED",
    claimClass: "NO_CLAIM",
    confidence: null,
    deterministicCandidateIds: [],
    aiProposalIds: [],
    evidenceIds: [],
    conflictIds: [],
    warningCodes: warningSort(warningCodes),
    extractorRefs: [...extractorRefs],
  };
}

function unsupportedField(
  fieldKey: M03FieldKey,
  extractorRefs: readonly string[],
  warningCodes: readonly M03WarningCode[],
): ExtractionFieldResultV1 {
  return {
    fieldKey,
    value: emptyValue(fieldKey),
    status: "UNSUPPORTED",
    claimClass: "NO_CLAIM",
    confidence: null,
    deterministicCandidateIds: [],
    aiProposalIds: [],
    evidenceIds: [],
    conflictIds: [],
    warningCodes: warningSort(warningCodes),
    extractorRefs: [...extractorRefs],
  };
}

function reviewFieldOrPositive(
  fieldKey: M03FieldKey,
  value: unknown,
  supports: readonly ExtractionCandidateV1[],
  extractorRefs: readonly string[],
  warningCodes: readonly M03WarningCode[],
  review: boolean,
): ExtractionFieldResultV1 {
  if (!review) return positiveField(fieldKey, value, supports, extractorRefs, warningCodes);
  const classes = new Set(supports.map((candidate) => candidate.claimClass));
  return {
    fieldKey,
    value,
    status: "REVIEW_REQUIRED",
    claimClass:
      classes.size > 1 ? "MIXED_DETERMINISTIC_SUPPORT" : (supports[0]?.claimClass ?? "NO_CLAIM"),
    confidence: null,
    deterministicCandidateIds: supports.map((candidate) => candidate.id).sort(),
    aiProposalIds: [],
    evidenceIds: [...new Set(supports.flatMap((candidate) => candidate.sourceReferenceIds))].sort(),
    conflictIds: [],
    warningCodes: warningSort(warningCodes),
    extractorRefs: [...extractorRefs],
  };
}

function conflictingField(
  fieldKey: M03FieldKey,
  value: unknown,
  supports: readonly ExtractionCandidateV1[],
  conflicts: readonly ExtractionConflictV1[],
  warningCodes: readonly M03WarningCode[],
): ExtractionFieldResultV1 {
  return {
    fieldKey,
    value,
    status: "CONFLICTING",
    claimClass:
      new Set(supports.map(({ claimClass }) => claimClass)).size === 1
        ? (supports[0]?.claimClass ?? "NO_CLAIM")
        : "MIXED_DETERMINISTIC_SUPPORT",
    confidence: null,
    deterministicCandidateIds: supports.map(({ id }) => id).sort(),
    aiProposalIds: [],
    evidenceIds: [
      ...new Set(supports.flatMap(({ sourceReferenceIds }) => sourceReferenceIds)),
    ].sort(),
    conflictIds: conflicts.map(({ id }) => id).sort(),
    warningCodes: warningSort([...warningCodes, "MULTIPLE_EXPLICIT_VALUES"]),
    extractorRefs: [...new Set(supports.map(({ extractorRefId }) => extractorRefId))].sort(),
  };
}
