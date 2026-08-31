/* eslint-disable @typescript-eslint/prefer-regexp-exec -- acquired-source safety forbids RegExp.exec */

import { defaultCaseFoldUnicode15_1 } from "./m03-unicode-15-1.js";

const unicodeWhitespace = /\p{White_Space}+/gu;
const unicodeWhitespaceAtEdges = /^\p{White_Space}+|\p{White_Space}+$/gu;

function defaultCaseFold(value: string): string {
  return defaultCaseFoldUnicode15_1(value);
}

export function textKey(value: string): string {
  return defaultCaseFold(value.replace(unicodeWhitespaceAtEdges, "").normalize("NFC"))
    .replace(unicodeWhitespace, " ")
    .normalize("NFC");
}

export function handleKey(value: string): string {
  const normalized = textKey(value);
  return normalized.startsWith("@") ? normalized.slice(1) : normalized;
}

const semverPattern =
  /^(?:v)?(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

export function semverKey(value: string): string | null {
  const match = value.match(semverPattern);
  if (!match) return null;
  const [, major, minor, patch, prerelease] = match;
  return `${major ?? ""}.${minor ?? ""}.${patch ?? ""}${prerelease ? `-${prerelease}` : ""}`;
}

const spdxIdentifiers = new Map(
  [
    "0BSD",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "CC0-1.0",
    "GPL-2.0-only",
    "GPL-3.0-only",
    "ISC",
    "LGPL-2.1-only",
    "LGPL-3.0-only",
    "MIT",
    "MPL-2.0",
    "Unlicense",
  ].map((identifier) => [identifier.toLowerCase(), identifier]),
);

type SpdxNode =
  | { readonly kind: "IDENTIFIER"; readonly identifier: string }
  | { readonly kind: "AND" | "OR"; readonly left: SpdxNode; readonly right: SpdxNode };

function serializeSpdx(node: SpdxNode, parentPrecedence = 0): string {
  if (node.kind === "IDENTIFIER") return node.identifier;
  const precedence = node.kind === "AND" ? 2 : 1;
  const serialized = `${serializeSpdx(node.left, precedence)} ${node.kind} ${serializeSpdx(node.right, precedence)}`;
  return precedence < parentPrecedence ? `(${serialized})` : serialized;
}

export function canonicalizeSpdx(value: string): string | null {
  const tokens = value.match(/[A-Za-z0-9.-]+|\(|\)/gu);
  if (tokens?.join("") !== value.replace(/\s+/gu, "")) return null;
  let index = 0;
  function primary(): SpdxNode | null {
    const token = tokens?.[index];
    if (token === "(") {
      index += 1;
      const nested = disjunction();
      if (nested === null || tokens?.[index] !== ")") return null;
      index += 1;
      return nested;
    }
    if (token === undefined || token === ")" || /^(?:AND|OR|WITH)$/iu.test(token)) return null;
    const identifier = spdxIdentifiers.get(token.toLowerCase());
    if (identifier === undefined) return null;
    index += 1;
    return { kind: "IDENTIFIER", identifier };
  }
  function conjunction(): SpdxNode | null {
    let left = primary();
    if (left === null) return null;
    while (/^AND$/iu.test(tokens?.[index] ?? "")) {
      index += 1;
      const right = primary();
      if (right === null) return null;
      left = { kind: "AND", left, right };
    }
    return left;
  }
  function disjunction(): SpdxNode | null {
    let left = conjunction();
    if (left === null) return null;
    while (/^OR$/iu.test(tokens?.[index] ?? "")) {
      index += 1;
      const right = conjunction();
      if (right === null) return null;
      left = { kind: "OR", left, right };
    }
    return left;
  }
  const expression = disjunction();
  return expression !== null && index === tokens.length ? serializeSpdx(expression) : null;
}

export function normalizeDependencyName(
  ecosystem: "NPM" | "PYPI" | "SYSTEM" | "OTHER" | null,
  value: string,
): string {
  if (ecosystem === "NPM") return value.replace(/[A-Z]/gu, (character) => character.toLowerCase());
  if (ecosystem === "PYPI")
    return value
      .replace(/[A-Z]/gu, (character) => character.toLowerCase())
      .replace(/[-_.]+/gu, "-");
  return textKey(value);
}

export function isValidDependencyName(
  ecosystem: "NPM" | "PYPI" | "SYSTEM" | "OTHER" | null,
  value: string,
): boolean {
  if (ecosystem === "NPM")
    return /^(?:@[A-Za-z0-9][A-Za-z0-9._~-]*\/)?[A-Za-z0-9][A-Za-z0-9._~-]*$/u.test(value);
  if (ecosystem === "PYPI") return /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/u.test(value);
  return true;
}

export function compareUnsignedUtf8(left: string, right: string): number {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftBytes[index] ?? 0) - (rightBytes[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return leftBytes.length - rightBytes.length;
}

function serializeM03Json(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new TypeError("Canonical JSON rejects non-finite numbers");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(serializeM03Json).join(",")}]`;
  }
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record)
    .sort(compareUnsignedUtf8)
    .map((key) => `${JSON.stringify(key)}:${serializeM03Json(record[key])}`)
    .join(",")}}`;
}

export function canonicalJsonM03(value: unknown): string {
  return serializeM03Json(value);
}
