import { defaultCaseFoldUnicode15_1, isUnicode15_1Assigned } from "./unicode-15-1.js";

const FRONT_MATTER_LIMIT_BYTES = 8_192;
const FRONT_MATTER_LIMIT_LINES = 50;
const IDENTITY_TOKEN_LIMIT_SCALARS = 128;

export type ParsedSkillFrontMatter =
  | { readonly ok: true; readonly fields: Readonly<Record<string, string>> }
  | { readonly ok: false; readonly reasonCode: "MALFORMED_FRONT_MATTER" };

const malformed = (): ParsedSkillFrontMatter => ({
  ok: false,
  reasonCode: "MALFORMED_FRONT_MATTER",
});

function parseDoubleQuoted(value: string): string | null {
  if (!value.startsWith('"') || !value.endsWith('"')) return null;
  const escapes: Readonly<Record<string, string>> = {
    "0": "\0",
    a: "\u0007",
    b: "\b",
    t: "\t",
    n: "\n",
    v: "\v",
    f: "\f",
    r: "\r",
    e: "\u001b",
    " ": " ",
    '"': '"',
    "/": "/",
    "\\": "\\",
    N: "\u0085",
    _: "\u00a0",
    L: "\u2028",
    P: "\u2029",
  };
  let parsed = "";
  const inner = value.slice(1, -1);
  for (let index = 0; index < inner.length; index += 1) {
    const character = inner[index] ?? "";
    if (character !== "\\") {
      if (character === '"' || /\p{Cc}/u.test(character)) return null;
      parsed += character;
      continue;
    }
    const escape = inner[index + 1];
    if (escape === undefined) return null;
    const simple = escapes[escape];
    if (simple !== undefined) {
      parsed += simple;
      index += 1;
      continue;
    }
    const digits = escape === "x" ? 2 : escape === "u" ? 4 : escape === "U" ? 8 : 0;
    if (digits === 0) return null;
    const encoded = inner.slice(index + 2, index + 2 + digits);
    if (encoded.length !== digits || !/^[\da-f]+$/iu.test(encoded)) return null;
    const codePoint = Number.parseInt(encoded, 16);
    if (codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return null;
    parsed += String.fromCodePoint(codePoint);
    index += digits + 1;
  }
  return parsed;
}

function quotedScalarBoundary(source: string, quote: "'" | '"'): number {
  let escaped = false;
  for (let index = 1; index < source.length; index += 1) {
    const character = source[index];
    if (quote === '"' && escaped) {
      escaped = false;
      continue;
    }
    if (quote === '"' && character === "\\") {
      escaped = true;
      continue;
    }
    if (character !== quote) continue;
    if (quote === "'" && source[index + 1] === "'") {
      index += 1;
      continue;
    }
    const rest = source.slice(index + 1);
    if (rest.length === 0 || /^[ \t]+(?:#.*)?$/u.test(rest)) return index + 1;
    return -1;
  }
  return -1;
}

function parseSingleQuoted(value: string): string | null {
  if (!value.startsWith("'") || !value.endsWith("'")) return null;
  let parsed = "";
  const inner = value.slice(1, -1);
  for (let index = 0; index < inner.length; index += 1) {
    const character = inner[index] ?? "";
    if (character !== "'") {
      if (/\p{Cc}/u.test(character)) return null;
      parsed += character;
      continue;
    }
    if (inner[index + 1] !== "'") return null;
    parsed += "'";
    index += 1;
  }
  return parsed;
}

function parseStringScalar(source: string): string | null {
  const leadingTrimmed = source.trimStart();
  const first = leadingTrimmed[0];
  if (first === "'" || first === '"') {
    const boundary = quotedScalarBoundary(leadingTrimmed, first);
    if (boundary < 0) return null;
    const quoted = leadingTrimmed.slice(0, boundary);
    return first === "'" ? parseSingleQuoted(quoted) : parseDoubleQuoted(quoted);
  }

  const commentIndex = [...source.matchAll(/(^|[ \t])#/gu)].at(0)?.index;
  const value = source.slice(0, commentIndex ?? source.length).trim();
  if (value.length === 0) return null;
  if (/\p{Cc}/u.test(value)) return null;
  if ("!&*>{}[],|%@`".includes(value[0] ?? "") || /:\s/u.test(value)) return null;
  if (/(?:^|[ \t])[!&*](?=\S)/u.test(value)) return null;
  if (
    /^(?:null|~|true|false)$/iu.test(value) ||
    /^[-+]?(?:0|[1-9][\d_]*|0o[0-7_]+|0x[\da-f_]+)$/iu.test(value) ||
    /^[-+]?(?:\.(?:inf|nan)|\.[\d_]+(?:e[-+]?\d+)?|(?:0|[1-9][\d_]*)(?:\.[\d_]*)?(?:e[-+]?\d+)?)$/iu.test(
      value,
    )
  ) {
    return null;
  }
  return value;
}

export function parseSkillFrontMatter(source: string): ParsedSkillFrontMatter {
  if (source.includes("\r")) return malformed();
  const lines = source.split("\n");
  if (lines[0] !== "---") return malformed();
  const closingIndex = lines.indexOf("---", 1);
  if (closingIndex < 0 || closingIndex + 1 > FRONT_MATTER_LIMIT_LINES) return malformed();
  const block = lines.slice(0, closingIndex + 1).join("\n");
  if (Buffer.byteLength(block, "utf8") > FRONT_MATTER_LIMIT_BYTES) return malformed();

  const fields: Record<string, string> = {};
  for (const line of lines.slice(1, closingIndex)) {
    if (line.trim().length === 0 || line.trimStart().startsWith("#")) continue;
    if (/^\s/u.test(line) || line === "---" || line === "...") return malformed();
    const match = line.matchAll(/^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/gu).next().value;
    if (!match) return malformed();
    const key = match[1];
    const scalar = parseStringScalar(match[2] ?? "");
    if (key === undefined || scalar === null || Object.hasOwn(fields, key)) return malformed();
    fields[key] = scalar;
  }
  if (Object.keys(fields).length === 0) return malformed();
  return { ok: true, fields };
}

export interface NormalizedIdentityToken {
  readonly normalized: string;
  readonly unicodePolicyVersion: "unicode-15.1";
}

export function normalizeIdentityToken(value: string): NormalizedIdentityToken | null {
  if (
    Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint === undefined || !isUnicode15_1Assigned(codePoint);
    })
  ) {
    return null;
  }
  const folded = defaultCaseFoldUnicode15_1(value.normalize("NFKC"));
  if (folded === null) return null;
  const normalized = folded.replace(/[\p{White_Space}_-]+/gu, "-").replace(/^-+|-+$/gu, "");
  if (!/^[\p{L}\p{Nd}]+(?:-[\p{L}\p{Nd}]+)*$/u.test(normalized)) return null;
  const scalarLength = Array.from(normalized).length;
  if (scalarLength < 1 || scalarLength > IDENTITY_TOKEN_LIMIT_SCALARS) return null;
  return { normalized, unicodePolicyVersion: "unicode-15.1" };
}
