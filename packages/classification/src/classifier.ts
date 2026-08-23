import type { EntryDisposition, RepositoryClassification } from "@ai-ark/contracts";
import { Parser, type Node as CommonMarkNode } from "commonmark";

import { normalizeIdentityToken, parseSkillFrontMatter } from "./parser-profile.js";

const EXCLUDED_SEGMENTS = new Set([
  "docs",
  "doc",
  "examples",
  "example",
  "templates",
  "template",
  "tests",
  "test",
  "fixtures",
  "fixture",
  "vendor",
  "vendored",
  "generated",
  "dist",
  "build",
  "tutorials",
]);
const ROOT_MANIFESTS = new Set([
  "package.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
]);
const ROOT_SOURCE_DIRECTORIES = new Set(["src", "app", "apps", "web", "server"]);

export interface ClassificationFile {
  readonly normalizedPath: string;
  readonly disposition: EntryDisposition;
  readonly entryKind: "file" | "symlink" | "submodule";
  readonly contentSha256: string | null;
  readonly utf8Text?: string;
  readonly evidenceReferenceId?: string;
}

export interface RetainedIdentityToken {
  readonly original: string;
  readonly normalized: string;
  readonly unicodePolicyVersion: "unicode-15.1";
  readonly evidenceReferenceId: string;
}

export interface SkillDeclaration {
  readonly root: string;
  readonly path: string;
  readonly name: string;
  readonly normalizedName: string | null;
  readonly identityTokens: Readonly<Record<string, RetainedIdentityToken>>;
}

export interface ClassificationResult {
  readonly classification: RepositoryClassification;
  readonly roots: readonly string[];
  readonly declarations: readonly SkillDeclaration[];
  readonly evidencePaths: readonly string[];
  readonly warningCodes: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly collectionRootOrder: readonly string[];
  readonly applicationPaths: readonly string[];
  readonly requiresAiAssistance: boolean;
}

export interface ClassificationInput {
  readonly files: readonly ClassificationFile[];
  readonly snapshotComplete?: boolean;
  readonly inventoryLimitHit?: boolean;
  readonly contentLimitHit?: boolean;
  readonly analysisLimitHit?: boolean;
  readonly caseOrPathCollision?: boolean;
}

const byteSort = (values: Iterable<string>) =>
  [...values].sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
const segments = (path: string) => path.split("/");
export const isExcludedPath = (path: string) =>
  segments(path).some((segment) => EXCLUDED_SEGMENTS.has(segment.toLowerCase()));
const basename = (path: string) => segments(path).at(-1) ?? "";
const rootFor = (path: string) =>
  path === "SKILL.md" ? "." : segments(path).slice(0, -1).join("/");
const isUnderRoot = (path: string, root: string) =>
  root === "." || path === root || path.startsWith(`${root}/`);
const isSafeNormalizedPath = (path: string) =>
  path.length > 0 &&
  !path.startsWith("/") &&
  !path.endsWith("/") &&
  !path.includes("\\") &&
  !path.includes("\0") &&
  path.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
const hasVerifiedHash = (file: ClassificationFile) =>
  typeof file.contentSha256 === "string" && /^[a-f0-9]{64}$/u.test(file.contentSha256);

function normalizeCollectionTarget(target: string): string | null {
  const withoutFragment = target.split("#", 1)[0] ?? "";
  if (
    withoutFragment.length === 0 ||
    /^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/iu.test(withoutFragment) ||
    withoutFragment.includes("?")
  )
    return null;
  let decoded: string;
  try {
    if (/%(?![\da-f]{2})/iu.test(withoutFragment)) return null;
    decoded = withoutFragment.replace(/%([\da-f]{2})/giu, (escape, hex: string) => {
      const value = Number.parseInt(hex, 16);
      return /[A-Za-z0-9._~-]/u.test(String.fromCharCode(value))
        ? String.fromCharCode(value)
        : escape.toUpperCase();
    });
  } catch {
    return null;
  }
  const stack: string[] = [];
  for (const segment of decoded.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (stack.length === 0) return null;
      stack.pop();
    } else stack.push(segment);
  }
  if (stack.at(-1) === "SKILL.md") stack.pop();
  return stack.join("/") || ".";
}

function childNodes(node: CommonMarkNode): readonly CommonMarkNode[] {
  const children: CommonMarkNode[] = [];
  for (let child = node.firstChild; child !== null; child = child.next) children.push(child);
  return children;
}

function headingInlineText(node: CommonMarkNode): string {
  let text = "";
  for (const child of childNodes(node)) {
    if (child.type === "image" || child.type === "html_inline") continue;
    if (child.type === "text" || child.type === "code") text += child.literal ?? "";
    else if (child.type === "softbreak" || child.type === "linebreak") text += " ";
    else text += headingInlineText(child);
  }
  return text;
}

function isAtxHeading(node: CommonMarkNode, lines: readonly string[]): boolean {
  const startLine = node.sourcepos?.[0][0];
  if (startLine === undefined || node.level === null || node.level < 1 || node.level > 6)
    return false;
  return /^ {0,3}#{1,6}(?:[ \t]+|$)/u.test(lines[startLine - 1] ?? "");
}

function collectionLinks(text: string): {
  readonly hasHeading: boolean;
  readonly roots: readonly string[];
} {
  const lines = text.split(/\n/u);
  let active = false;
  let hasHeading = false;
  const roots = new Set<string>();
  const document = new Parser().parse(text);
  const walker = document.walker();
  let insideAtxHeading = false;
  let event = walker.next();
  while (event !== null) {
    const node = event.node;
    if (node.type === "heading") {
      const atx = isAtxHeading(node, lines);
      insideAtxHeading = event.entering && atx;
      if (event.entering && atx) {
        const label = headingInlineText(node)
          .replace(/[ \t\n\r\f]+/gu, " ")
          .trim()
          .replace(/[A-Z]/gu, (letter) => letter.toLowerCase());
        active = label === "skills" || label === "skill collection";
        hasHeading ||= active;
      }
    } else if (event.entering && active && !insideAtxHeading && node.type === "link") {
      const target = normalizeCollectionTarget(node.destination ?? "");
      if (target) roots.add(target);
    }
    event = walker.next();
  }
  return { hasHeading, roots: byteSort(roots) };
}

function result(
  classification: RepositoryClassification,
  roots: readonly string[],
  declarations: readonly SkillDeclaration[],
  evidencePaths: Iterable<string>,
  warningCodes: Iterable<string>,
  reasonCodes: Iterable<string>,
  collectionRootOrder: readonly string[] = [],
  applicationPaths: readonly string[] = [],
): ClassificationResult {
  return {
    classification,
    roots,
    declarations,
    evidencePaths: byteSort(evidencePaths),
    warningCodes: byteSort(warningCodes),
    reasonCodes: byteSort(reasonCodes),
    collectionRootOrder,
    applicationPaths,
    requiresAiAssistance: classification === "AMBIGUOUS",
  };
}

export function classifyRepository(input: ClassificationInput): ClassificationResult {
  const warnings = new Set<string>();
  const reasons = new Set<string>();
  const evidence = new Set<string>();
  const declarations: SkillDeclaration[] = [];
  const observedPaths = new Set<string>();
  const observedCaseFoldedPaths = new Set<string>();
  let invalidInventory = false;
  for (const file of input.files) {
    const foldedPath = file.normalizedPath.toLowerCase();
    if (
      !isSafeNormalizedPath(file.normalizedPath) ||
      observedPaths.has(file.normalizedPath) ||
      (observedCaseFoldedPaths.has(foldedPath) && !observedPaths.has(file.normalizedPath))
    ) {
      invalidInventory = true;
    }
    observedPaths.add(file.normalizedPath);
    observedCaseFoldedPaths.add(foldedPath);
  }
  const hardUnsupported =
    input.snapshotComplete === false ||
    input.inventoryLimitHit === true ||
    input.contentLimitHit === true ||
    input.analysisLimitHit === true ||
    input.caseOrPathCollision === true ||
    invalidInventory;

  for (const file of input.files) {
    if (basename(file.normalizedPath) !== "SKILL.md" || isExcludedPath(file.normalizedPath))
      continue;
    if (
      file.disposition !== "ACQUIRED" ||
      file.entryKind !== "file" ||
      !hasVerifiedHash(file) ||
      file.utf8Text === undefined
    ) {
      reasons.add("CANDIDATE_DECLARATION_UNAVAILABLE");
      continue;
    }
    const parsed = parseSkillFrontMatter(file.utf8Text);
    if (!parsed.ok) {
      warnings.add("MALFORMED_FRONT_MATTER");
      continue;
    }
    const name = parsed.fields.name;
    const normalizedName = name === undefined ? null : normalizeIdentityToken(name);
    if (!name || Array.from(name).length > 128) {
      warnings.add("MALFORMED_FRONT_MATTER");
      continue;
    }
    const identityTokens: Record<string, RetainedIdentityToken> = {};
    for (const key of ["id", "external_id", "creator_id", "organization_id"] as const) {
      const token = parsed.fields[key];
      const normalized = token === undefined ? null : normalizeIdentityToken(token);
      if (token !== undefined && normalized) {
        identityTokens[key] = {
          original: token,
          normalized: normalized.normalized,
          unicodePolicyVersion: normalized.unicodePolicyVersion,
          evidenceReferenceId: file.evidenceReferenceId ?? file.normalizedPath,
        };
      }
    }
    declarations.push({
      root: rootFor(file.normalizedPath),
      path: file.normalizedPath,
      name,
      normalizedName: normalizedName?.normalized ?? null,
      identityTokens,
    });
    evidence.add(file.normalizedPath);
  }

  if (reasons.has("CANDIDATE_DECLARATION_UNAVAILABLE"))
    return result("UNSUPPORTED", [], declarations, evidence, warnings, reasons);
  if (hardUnsupported) {
    reasons.add("HARD_UNSUPPORTED");
    return result("UNSUPPORTED", [], declarations, evidence, warnings, reasons);
  }

  declarations.sort((left, right) => Buffer.from(left.path).compare(Buffer.from(right.path)));
  const roots = byteSort(new Set(declarations.map((declaration) => declaration.root)));
  const namesByRoot = new Map<string, Set<string>>();
  for (const declaration of declarations) {
    const names = namesByRoot.get(declaration.root) ?? new Set<string>();
    names.add(declaration.normalizedName ?? declaration.name.normalize("NFC"));
    namesByRoot.set(declaration.root, names);
  }
  if ([...namesByRoot.values()].some((names) => names.size > 1))
    warnings.add("CONFLICTING_ROOT_NAMES");
  for (const outer of roots) {
    for (const inner of roots) {
      if (outer !== inner && isUnderRoot(inner, outer)) warnings.add("PARENT_CHILD_DECLARATION");
    }
  }

  const collectionRoots = new Set<string>();
  let hasCollectionIndex = false;
  const repositoryIndexes = input.files
    .filter((file) => ["README.md", "SKILLS.md"].includes(file.normalizedPath))
    .sort((left, right) =>
      Buffer.from(left.normalizedPath).compare(Buffer.from(right.normalizedPath)),
    );
  for (const file of repositoryIndexes) {
    if (
      file.disposition !== "ACQUIRED" ||
      file.entryKind !== "file" ||
      !hasVerifiedHash(file) ||
      file.utf8Text === undefined ||
      !["README.md", "SKILLS.md"].includes(file.normalizedPath)
    )
      continue;
    const parsed = collectionLinks(file.utf8Text);
    if (!parsed.hasHeading) continue;
    evidence.add(file.normalizedPath);
    for (const root of parsed.roots) collectionRoots.add(root);
    const exact =
      parsed.roots.length === roots.length &&
      parsed.roots.every((root, index) => root === roots[index]);
    if (parsed.roots.length > 0 && !exact) warnings.add("COLLECTION_ROOT_MISMATCH");
    if (parsed.roots.length >= 2 && exact) hasCollectionIndex = true;
  }
  const collectionOrder = byteSort(collectionRoots);

  if (warnings.size > 0)
    return result("AMBIGUOUS", roots, declarations, evidence, warnings, reasons, collectionOrder);
  if (roots.length === 0) return result("NON_SKILL", [], declarations, evidence, warnings, reasons);
  if (hasCollectionIndex)
    return result(
      "SKILL_COLLECTION",
      roots,
      declarations,
      evidence,
      warnings,
      reasons,
      collectionOrder,
    );

  const hasManifest = input.files.some(
    (file) =>
      file.disposition === "ACQUIRED" &&
      file.entryKind === "file" &&
      hasVerifiedHash(file) &&
      file.utf8Text !== undefined &&
      ROOT_MANIFESTS.has(file.normalizedPath),
  );
  const applicationPaths = byteSort(
    input.files
      .filter((file) => {
        const [first] = segments(file.normalizedPath);
        return (
          file.disposition === "ACQUIRED" &&
          file.entryKind === "file" &&
          hasVerifiedHash(file) &&
          file.utf8Text !== undefined &&
          first !== undefined &&
          ROOT_SOURCE_DIRECTORIES.has(first) &&
          !roots.some((root) => isUnderRoot(file.normalizedPath, root))
        );
      })
      .map((file) => file.normalizedPath),
  );
  if (hasManifest && applicationPaths.length > 0)
    return result(
      "SKILL_PLUS_APPLICATION",
      roots,
      declarations,
      evidence,
      warnings,
      reasons,
      [],
      applicationPaths,
    );
  return result(
    roots.length === 1 ? "SINGLE_SKILL" : "MULTIPLE_SKILLS",
    roots,
    declarations,
    evidence,
    warnings,
    reasons,
  );
}
