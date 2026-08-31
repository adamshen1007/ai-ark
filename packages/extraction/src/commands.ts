/* eslint-disable @typescript-eslint/prefer-regexp-exec -- RegExp.exec is prohibited by the acquired-source safety gate. */
import type {
  ExactCommandV1,
  ExtractionSourceReferenceV1,
  InstallationPathV1,
  M03WarningCode,
} from "@ai-ark/contracts";
import { textKey } from "@ai-ark/contracts";
import { Parser, type Node } from "commonmark";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";
import { gfmTable } from "micromark-extension-gfm-table";

import {
  createDocumentReference,
  type M03ProvenanceAuthority,
  scanSensitiveText,
  sha256Hex,
} from "./provenance.js";
import { scanFrozenM01Lines, skillFrontMatterBoundary } from "./source-lines.js";

const installationHeadings = new Set([
  "install",
  "installation",
  "setup",
  "getting started",
  "prerequisites",
]);
const fenceLanguages = new Set(["sh", "bash", "zsh", "shell", "console"]);

export interface MarkdownHeading {
  readonly line: number;
  readonly level: number;
  readonly label: string;
}

interface MarkdownCodeBlock {
  readonly startLine: number;
  readonly endLine: number;
  readonly language: string;
}

interface PhysicalLine {
  readonly content: string;
  readonly terminator: "\r\n" | "\n" | "\r" | "";
  readonly startIndex: number;
  readonly endContentIndex: number;
  readonly startByte: number;
  readonly endContentByte: number;
}

function scanPhysicalLines(content: string): readonly PhysicalLine[] {
  const result: PhysicalLine[] = [];
  let start = 0;
  let startByte = 0;
  for (let index = 0; index < content.length; index += 1) {
    const scalar = content[index];
    if (scalar !== "\r" && scalar !== "\n") continue;
    const terminator = scalar === "\r" && content[index + 1] === "\n" ? "\r\n" : scalar;
    const lineContent = content.slice(start, index);
    const endContentByte = startByte + Buffer.byteLength(lineContent, "utf8");
    result.push({
      content: lineContent,
      terminator,
      startIndex: start,
      endContentIndex: index,
      startByte,
      endContentByte,
    });
    if (terminator === "\r\n") index += 1;
    start = index + 1;
    startByte = endContentByte + Buffer.byteLength(terminator, "utf8");
  }
  result.push({
    content: content.slice(start),
    terminator: "",
    startIndex: start,
    endContentIndex: content.length,
    startByte,
    endContentByte: startByte + Buffer.byteLength(content.slice(start), "utf8"),
  });
  return result;
}

function markdownParserContent(content: string): string {
  let result = "";
  for (let index = 0; index < content.length; index += 1) {
    const scalar = content[index] ?? "";
    result += scalar === "\r" && content[index + 1] !== "\n" ? " " : scalar;
  }
  return result;
}

export interface MarkdownBodyView {
  readonly content: string;
  readonly lines: readonly string[];
  readonly absoluteLineOffset: number;
  readonly absoluteByteOffset: number;
}

export function markdownBodyForDocument(
  normalizedPath: string,
  documentContent: string,
): MarkdownBodyView {
  const boundary = skillFrontMatterBoundary(normalizedPath, documentContent);
  if (boundary.state === "NONE")
    return {
      content: documentContent,
      lines: scanFrozenM01Lines(documentContent).map(({ content }) => content),
      absoluteLineOffset: 0,
      absoluteByteOffset: 0,
    };
  if (boundary.state === "UNCLOSED")
    return {
      content: "",
      lines: [],
      absoluteLineOffset: boundary.bodyStartLine - 1,
      absoluteByteOffset: boundary.bodyStartByte,
    };
  return {
    content: boundary.bodyContent,
    lines: scanFrozenM01Lines(boundary.bodyContent).map(({ content }) => content),
    absoluteLineOffset: boundary.bodyStartLine - 1,
    absoluteByteOffset: boundary.bodyStartByte,
  };
}

export interface MarkdownSemanticRange {
  readonly startLine: number;
  readonly endLine: number;
  readonly blockKind: "PARAGRAPH" | "LIST_ITEM" | "TABLE_ROW";
}

function rawBlockText(line: string, blockKind: MarkdownSemanticRange["blockKind"]): string | null {
  if (blockKind === "TABLE_ROW") return null;
  const withoutMarker = blockKind === "LIST_ITEM" ? line.replace(/^([\t ]*)- /u, "$1") : line;
  if (blockKind === "LIST_ITEM" && withoutMarker === line) return null;
  return withoutMarker.trim();
}

function rawAtxHeading(line: string): { readonly level: number; readonly label: string } | null {
  const opening = line.match(/^ {0,3}(#{1,6})(?:[\t ]+|$)/u);
  if (!opening) return null;
  let label = line.slice(opening[0].length).replace(/[\t ]+$/u, "");
  label = label.replace(/[\t ]+#+$/u, "").replace(/^[\t ]+|[\t ]+$/gu, "");
  if (label === "") return null;
  return { level: (opening[1] ?? "").length, label };
}

export function parseMarkdownProfile(content: string): {
  readonly headings: readonly MarkdownHeading[];
  readonly codeBlocks: readonly MarkdownCodeBlock[];
  readonly semanticRanges: readonly MarkdownSemanticRange[];
} {
  const parserContent = markdownParserContent(content);
  const document = new Parser().parse(parserContent);
  const headings: MarkdownHeading[] = [];
  const codeBlocks: MarkdownCodeBlock[] = [];
  const semanticRanges: MarkdownSemanticRange[] = [];
  const lines = scanFrozenM01Lines(content).map(({ content: line }) => line);
  let blockQuoteDepth = 0;
  let listItemDepth = 0;
  const walker = document.walker();
  for (let step = walker.next(); step !== null; step = walker.next()) {
    if (step.entering && step.node.type === "block_quote") blockQuoteDepth += 1;
    if (step.entering && step.node.type === "item") listItemDepth += 1;
    if (step.entering && blockQuoteDepth === 0 && step.node.sourcepos != null) {
      const startLine = step.node.sourcepos[0][0] - 1;
      const endLine = step.node.sourcepos[1][0] - 1;
      if (step.node.type === "heading") {
        const heading = rawAtxHeading(lines[startLine] ?? "");
        if (heading !== null) headings.push({ line: startLine, ...heading });
      }
      if (step.node.type === "code_block") {
        const rawInfo = (step.node as Node & { readonly info?: unknown }).info;
        const language = (typeof rawInfo === "string" ? rawInfo : "").trim().split(/\s+/u)[0] ?? "";
        if (fenceLanguages.has(language)) codeBlocks.push({ startLine, endLine, language });
      }
      if (step.node.type === "item" || (step.node.type === "paragraph" && listItemDepth === 0))
        semanticRanges.push({
          startLine,
          endLine,
          blockKind: step.node.type === "paragraph" ? "PARAGRAPH" : "LIST_ITEM",
        });
    }
    if (!step.entering && step.node.type === "item") listItemDepth -= 1;
    if (!step.entering && step.node.type === "block_quote") blockQuoteDepth -= 1;
  }
  const gfmDocument = fromMarkdown(parserContent, {
    extensions: [gfmTable()],
    mdastExtensions: [gfmTableFromMarkdown()],
  }) as unknown as {
    readonly type: string;
    readonly children?: readonly unknown[];
  };
  const tableLines = new Set<number>();
  const visitGfm = (node: unknown, quoted: boolean): void => {
    if (node === null || typeof node !== "object") return;
    const record = node as {
      readonly type?: string;
      readonly children?: readonly unknown[];
      readonly position?: {
        readonly start?: { readonly line?: number };
        readonly end?: { readonly line?: number };
      };
    };
    const insideQuote = quoted || record.type === "blockquote";
    if (record.type === "tableRow" && !insideQuote) {
      const start = (record.position?.start?.line ?? 1) - 1;
      const end = (record.position?.end?.line ?? 1) - 1;
      for (let line = start; line <= end; line += 1) tableLines.add(line);
    }
    for (const child of record.children ?? []) visitGfm(child, insideQuote);
  };
  visitGfm(gfmDocument, false);
  const tableRanges = [...tableLines]
    .sort((left, right) => left - right)
    .map((line) => ({ startLine: line, endLine: line, blockKind: "TABLE_ROW" as const }));
  const nonTableRanges = semanticRanges.filter(
    ({ startLine, endLine }) =>
      ![...tableLines].some((line) => line >= startLine && line <= endLine),
  );
  return { headings, codeBlocks, semanticRanges: [...nonTableRanges, ...tableRanges] };
}

function commandSafety(text: string): ExactCommandV1["safetyIndicators"] {
  const sensitive = scanSensitiveText(text);
  const indicators: ExactCommandV1["safetyIndicators"][number][] = [];
  if (sensitive.secretMatch) indicators.push("CREDENTIAL_LITERAL");
  if (sensitive.contactMatch) indicators.push("PERSONAL_CONTACT_LITERAL");
  if (/(^|[;&|]\s*)(curl|wget)\s+|\b(fetch|Invoke-WebRequest)\s+/iu.test(text))
    indicators.push("NETWORK_DOWNLOAD");
  if (/\|\s*(sh|bash|zsh|python|python3|node|ruby|perl)\b/iu.test(text))
    indicators.push("PIPE_TO_INTERPRETER");
  if (/(^|[;&|]\s*)(sudo|doas|su)\b/iu.test(text)) indicators.push("PRIVILEGE_ESCALATION");
  if (
    /(^|[;&|]\s*)(rm\s+(-[^\n]*r[^\n]*f|-rf|-fr)\b|mkfs\b|dd\s+[^\n]*\bof=|git\s+reset\s+--hard\b)/iu.test(
      text,
    )
  )
    indicators.push("DESTRUCTIVE_OPERATION");
  if (/(\$[A-Za-z_][A-Za-z0-9_]*|\$\{|`|\$\()/u.test(text))
    indicators.push("VARIABLE_INTERPOLATION");
  if (!finiteTokenizationAccepts(text)) indicators.push("UNKNOWN");
  return indicators;
}

function finiteTokenizationAccepts(text: string): boolean {
  let state: "NORMAL" | "SINGLE" | "DOUBLE" | "ESCAPED_NORMAL" | "ESCAPED_DOUBLE" = "NORMAL";
  const scalars = Array.from(text);
  for (let index = 0; index < scalars.length; index += 1) {
    const scalar = scalars[index] ?? "";
    if (scalar === "\0") return false;
    if (state === "ESCAPED_NORMAL") {
      state = "NORMAL";
      continue;
    }
    if (state === "ESCAPED_DOUBLE") {
      state = "DOUBLE";
      continue;
    }
    if (state === "SINGLE") {
      if (scalar === "'") state = "NORMAL";
      continue;
    }
    if (state === "DOUBLE") {
      if (scalar === "\\") state = "ESCAPED_DOUBLE";
      else if (scalar === '"') state = "NORMAL";
      continue;
    }
    if (scalar === "\\") state = "ESCAPED_NORMAL";
    else if (scalar === "'") state = "SINGLE";
    else if (scalar === '"') state = "DOUBLE";
    else if (scalar === "&") {
      if (scalars[index + 1] !== "&") return false;
      index += 1;
    }
  }
  return state === "NORMAL";
}

export function extractInstallationContexts(input: {
  readonly sourceSnapshotId: string;
  readonly sourceEntryId: string;
  readonly sourceDocumentId: string;
  readonly ownership: "CANDIDATE_OWNED" | "SHARED";
  readonly normalizedPath: string;
  readonly documentContent: string;
  readonly markdownBodyContent?: string;
  readonly absoluteLineOffset?: number;
  readonly absoluteByteOffset?: number;
  readonly provenanceAuthority?: M03ProvenanceAuthority;
}): {
  readonly state:
    | "EXPLICIT_COMPLETE"
    | "EXPLICIT_PARTIAL"
    | "MULTIPLE_PATHS"
    | "INFERRED"
    | "MISSING"
    | "UNSAFE_OR_AMBIGUOUS";
  readonly paths: readonly InstallationPathV1[];
  readonly sourceReferences: readonly ExtractionSourceReferenceV1[];
  readonly routingSourceReferenceIds: readonly string[];
  readonly sensitiveReferenceWarningCodesById: Readonly<Record<string, readonly M03WarningCode[]>>;
  readonly warningCodes: readonly M03WarningCode[];
} {
  const markdownContent = input.markdownBodyContent ?? input.documentContent;
  const absoluteLineOffset = input.absoluteLineOffset ?? 0;
  const absoluteByteOffset = input.absoluteByteOffset ?? 0;
  const physicalLines = scanPhysicalLines(markdownContent);
  let frozenLineIndex = 0;
  const physicalToFrozenLine = physicalLines.map(({ terminator }) => {
    const current = frozenLineIndex;
    if (terminator === "\n" || terminator === "\r\n") frozenLineIndex += 1;
    return current;
  });
  const firstPhysicalLineByFrozenLine = new Map<number, number>();
  for (const [physicalLineIndex, frozenLine] of physicalToFrozenLine.entries())
    if (!firstPhysicalLineByFrozenLine.has(frozenLine))
      firstPhysicalLineByFrozenLine.set(frozenLine, physicalLineIndex);
  const lines = scanFrozenM01Lines(markdownContent).map(({ content: line }) => line);
  const structure = parseMarkdownProfile(markdownContent);
  const referenceInput = {
    sourceSnapshotId: input.sourceSnapshotId,
    sourceEntryId: input.sourceEntryId,
    sourceDocumentId: input.sourceDocumentId,
    ownership: input.ownership,
    documentContent: input.documentContent,
    ...(input.provenanceAuthority === undefined
      ? {}
      : { provenanceAuthority: input.provenanceAuthority }),
  };
  const absoluteLine = (localZeroBasedLine: number) => absoluteLineOffset + localZeroBasedLine + 1;
  const headingByLine = new Map(structure.headings.map((item) => [item.line, item]));
  const eligibleOneLineBlocks = new Map(
    structure.semanticRanges
      .filter(
        ({ startLine, endLine, blockKind }) => startLine === endLine && blockKind !== "TABLE_ROW",
      )
      .map((range) => [range.startLine, range.blockKind] as const),
  );
  const references: ExtractionSourceReferenceV1[] = [];
  const routingSourceReferenceIds = new Set<string>();
  const sensitiveReferenceWarningCodesById = new Map<string, Set<M03WarningCode>>();
  const retainReference = (
    result: ReturnType<typeof createDocumentReference>,
    surface: "GENERAL" | "COMMAND" = "GENERAL",
  ) => {
    references.push(result.reference);
    if (result.warningCodes.length > 0) {
      const warningCodes = sensitiveReferenceWarningCodesById.get(result.reference.id) ?? new Set();
      for (const warning of result.warningCodes) warningCodes.add(warning);
      sensitiveReferenceWarningCodesById.set(result.reference.id, warningCodes);
    }
    if (result.sensitivity.locatorSecretMatch) warnings.add("SECRET_LIKE_VALUE_WITHHELD");
    if (result.sensitivity.locatorContactMatch) warnings.add("PERSONAL_CONTACT_WITHHELD");
    if (surface === "GENERAL" && result.sensitivity.excerptSecretMatch)
      warnings.add("SECRET_LIKE_VALUE_WITHHELD");
    if (surface === "GENERAL" && result.sensitivity.excerptContactMatch)
      warnings.add("PERSONAL_CONTACT_WITHHELD");
    return result.reference;
  };
  const warnings = new Set<M03WarningCode>();
  const paths: InstallationPathV1[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const startHeading = headingByLine.get(index) ?? null;
    if (startHeading?.level !== 2 || !installationHeadings.has(textKey(startHeading.label)))
      continue;
    let end = index + 1;
    while (end < lines.length) {
      const nextHeading = headingByLine.get(end) ?? null;
      if (nextHeading && nextHeading.level <= 2) break;
      end += 1;
    }
    const pathHeadings: { readonly line: number; readonly label: string }[] = [];
    for (let cursor = index + 1; cursor < end; cursor += 1) {
      const candidate = headingByLine.get(cursor) ?? null;
      if (candidate?.level === 3) pathHeadings.push({ line: cursor, label: candidate.label });
    }
    const segments =
      pathHeadings.length === 0
        ? [
            {
              start: index + 1,
              end,
              label: null as string | null,
              headingLine: null as number | null,
            },
          ]
        : pathHeadings.map((pathHeading, pathIndex) => ({
            start: pathHeading.line + 1,
            end: pathHeadings[pathIndex + 1]?.line ?? end,
            label: pathHeading.label,
            headingLine: pathHeading.line,
          }));
    for (const segment of segments) {
      let startCondition: string | null = null;
      let completionCue: string | null = null;
      const prerequisites: string[] = [];
      const commands: ExactCommandV1[] = [];
      const pathReferenceIds: string[] = [];
      let firstCommandLine = Number.POSITIVE_INFINITY;
      let lastCommandLine = -1;
      let contextInvalid = false;
      let invalidContextRange: { startLine: number; endLine: number } | null = null;
      let pathProseSuppressed = false;
      if (segment.label !== null && segment.headingLine !== null) {
        const sensitivity = scanSensitiveText(segment.label);
        const labelReference = createDocumentReference({
          ...referenceInput,
          locator: {
            type: "LINE_RANGE",
            path: input.normalizedPath,
            startLine: absoluteLine(segment.headingLine),
            endLine: absoluteLine(segment.headingLine),
          },
          excerptCandidate: segment.label,
        });
        retainReference(labelReference);
        pathReferenceIds.push(labelReference.reference.id);
        if (sensitivity.secretMatch) warnings.add("SECRET_LIKE_VALUE_WITHHELD");
        if (sensitivity.contactMatch) warnings.add("PERSONAL_CONTACT_WITHHELD");
        if (sensitivity.secretMatch || sensitivity.contactMatch) {
          routingSourceReferenceIds.add(labelReference.reference.id);
          continue;
        }
      }
      for (const block of structure.codeBlocks.filter(
        ({ startLine }) => startLine >= segment.start && startLine < segment.end,
      )) {
        const cursor = block.startLine;
        const openingLine = lines[cursor] ?? "";
        const opening = openingLine.match(/^( {0,3})(```+|~~~+)([^\s`]*)\s*$/u);
        if (!opening) {
          warnings.add("DETERMINISTIC_DECLARATION_INVALID");
          contextInvalid = true;
          invalidContextRange = { startLine: block.startLine, endLine: block.endLine };
          break;
        }
        const openingIndent = (opening[1] ?? "").length;
        const language = block.language;
        const closing = block.endLine;
        const openingPhysicalLine = firstPhysicalLineByFrozenLine.get(cursor);
        const closingPhysicalLine = firstPhysicalLineByFrozenLine.get(closing);
        if (openingPhysicalLine === undefined || closingPhysicalLine === undefined) {
          warnings.add("DETERMINISTIC_DECLARATION_INVALID");
          contextInvalid = true;
          invalidContextRange = { startLine: block.startLine, endLine: block.endLine };
          break;
        }
        const delimiter = opening[2] ?? "```";
        if (
          !new RegExp(
            `^ {0,3}${delimiter.startsWith("`") ? "`" : "~"}{${String(delimiter.length)},}\\s*$`,
            "u",
          ).test(lines[closing] ?? "")
        ) {
          warnings.add("DETERMINISTIC_DECLARATION_INVALID");
          contextInvalid = true;
          invalidContextRange = { startLine: block.startLine, endLine: block.endLine };
          break;
        }
        for (
          let commandLine = openingPhysicalLine + 1;
          commandLine < closingPhysicalLine;
          commandLine += 1
        ) {
          const firstRawLine = physicalLines[commandLine]?.content ?? "";
          if (firstRawLine.slice(0, openingIndent) !== " ".repeat(openingIndent)) {
            warnings.add("DETERMINISTIC_DECLARATION_INVALID");
            contextInvalid = true;
            invalidContextRange = { startLine: block.startLine, endLine: block.endLine };
            break;
          }
          let firstTransformed = firstRawLine.slice(openingIndent);
          if (language === "console" && firstTransformed.startsWith("$ "))
            firstTransformed = firstTransformed.slice(2);
          if (firstTransformed.startsWith(">")) {
            warnings.add("DETERMINISTIC_DECLARATION_INVALID");
            contextInvalid = true;
            invalidContextRange = { startLine: block.startLine, endLine: block.endLine };
            break;
          }
          if (/^ *$/u.test(firstTransformed) || /^ *#/u.test(firstTransformed)) continue;
          const transformedLines = [firstTransformed];
          let finalCommandLine = commandLine;
          const hasOddTrailingBackslashes = (value: string) =>
            (value.match(/\\+$/u)?.[0].length ?? 0) % 2 === 1;
          while (hasOddTrailingBackslashes(transformedLines.at(-1) ?? "")) {
            finalCommandLine += 1;
            if (finalCommandLine >= closingPhysicalLine) {
              contextInvalid = true;
              invalidContextRange = { startLine: block.startLine, endLine: block.endLine };
              break;
            }
            const rawContinuation = physicalLines[finalCommandLine]?.content ?? "";
            if (rawContinuation.slice(0, openingIndent) !== " ".repeat(openingIndent)) {
              contextInvalid = true;
              invalidContextRange = { startLine: block.startLine, endLine: block.endLine };
              break;
            }
            const transformedContinuation = rawContinuation.slice(openingIndent);
            if (/^ *$/u.test(transformedContinuation) || /^ *#/u.test(transformedContinuation)) {
              contextInvalid = true;
              invalidContextRange = { startLine: block.startLine, endLine: block.endLine };
              break;
            }
            transformedLines.push(transformedContinuation);
          }
          if (contextInvalid) {
            warnings.add("DETERMINISTIC_DECLARATION_INVALID");
            break;
          }
          const transformedSourceBytes = transformedLines
            .map(
              (line, lineIndex) =>
                line +
                (lineIndex < transformedLines.length - 1
                  ? (physicalLines[commandLine + lineIndex]?.terminator ?? "")
                  : ""),
            )
            .join("");
          const commandText = transformedSourceBytes.replace(/\r\n|\r|\n/gu, "\n");
          firstCommandLine = Math.min(
            firstCommandLine,
            physicalToFrozenLine[commandLine] ?? cursor,
          );
          lastCommandLine = Math.max(
            lastCommandLine,
            physicalToFrozenLine[finalCommandLine] ?? closing,
          );
          const indicators = commandSafety(commandText.replace(/\\\n/gu, " "));
          const sensitivity = scanSensitiveText(commandText);
          const startByte = absoluteByteOffset + (physicalLines[commandLine]?.startByte ?? 0);
          const endByteExclusive =
            absoluteByteOffset +
            (physicalLines[finalCommandLine]?.endContentByte ?? startByte - absoluteByteOffset);
          const referenceResult = createDocumentReference({
            ...referenceInput,
            locator: {
              type: "BYTE_RANGE",
              path: input.normalizedPath,
              startByte,
              endByteExclusive,
              extractionTransform: "EXACT_COMMAND_V1",
            },
            excerptCandidate: commandText,
          });
          retainReference(referenceResult, "COMMAND");
          pathReferenceIds.push(referenceResult.reference.id);
          if (indicators.length > 0) warnings.add("INSTALL_COMMAND_UNSAFE");
          if (sensitivity.secretMatch) warnings.add("SECRET_LIKE_COMMAND_WITHHELD");
          if (sensitivity.contactMatch) warnings.add("PERSONAL_CONTACT_WITHHELD");
          commands.push({
            ordinal: commands.length,
            languageTagOrNull: language,
            commandTextState: sensitivity.secretMatch
              ? "WITHHELD_SECRET_LIKE"
              : sensitivity.contactMatch
                ? "WITHHELD_PERSONAL_CONTACT"
                : "PRESENT",
            commandTextOrNull:
              sensitivity.secretMatch || sensitivity.contactMatch ? null : commandText,
            sourceContentHash: sha256Hex(transformedSourceBytes),
            sourceReferenceIds: [referenceResult.reference.id],
            safetyIndicators: indicators,
          });
          commandLine = finalCommandLine;
        }
      }
      if (contextInvalid) commands.splice(0, commands.length);
      if (invalidContextRange !== null) {
        const invalidReference = createDocumentReference({
          ...referenceInput,
          locator: {
            type: "LINE_RANGE",
            path: input.normalizedPath,
            startLine: absoluteLine(invalidContextRange.startLine),
            endLine: absoluteLine(invalidContextRange.endLine),
          },
          excerptCandidate: lines
            .slice(invalidContextRange.startLine, invalidContextRange.endLine + 1)
            .join("\n"),
        });
        retainReference(invalidReference);
        routingSourceReferenceIds.add(invalidReference.reference.id);
      }
      for (const [cursor, blockKind] of eligibleOneLineBlocks) {
        if (cursor < segment.start || cursor >= segment.end) continue;
        const text = rawBlockText(lines[cursor] ?? "", blockKind);
        if (text === null || text === "") continue;
        if (
          cursor < firstCommandLine &&
          startCondition === null &&
          text.startsWith("To install, ")
        ) {
          const ref = createDocumentReference({
            ...referenceInput,
            locator: {
              type: "LINE_RANGE",
              path: input.normalizedPath,
              startLine: absoluteLine(cursor),
              endLine: absoluteLine(cursor),
            },
            excerptCandidate: text,
          });
          retainReference(ref);
          pathReferenceIds.push(ref.reference.id);
          if (ref.sensitivity.excerptSecretMatch || ref.sensitivity.excerptContactMatch) {
            pathProseSuppressed = true;
            routingSourceReferenceIds.add(ref.reference.id);
          } else startCondition = text;
        } else if (cursor < firstCommandLine && blockKind === "LIST_ITEM") {
          const prerequisite = text;
          const ref = createDocumentReference({
            ...referenceInput,
            locator: {
              type: "LINE_RANGE",
              path: input.normalizedPath,
              startLine: absoluteLine(cursor),
              endLine: absoluteLine(cursor),
            },
            excerptCandidate: prerequisite,
          });
          retainReference(ref);
          pathReferenceIds.push(ref.reference.id);
          if (ref.sensitivity.excerptSecretMatch || ref.sensitivity.excerptContactMatch) {
            pathProseSuppressed = true;
            routingSourceReferenceIds.add(ref.reference.id);
          } else prerequisites.push(text);
        }
        if (
          cursor > lastCommandLine &&
          completionCue === null &&
          (text.startsWith("After installation, ") || text.startsWith("Verify: "))
        ) {
          const ref = createDocumentReference({
            ...referenceInput,
            locator: {
              type: "LINE_RANGE",
              path: input.normalizedPath,
              startLine: absoluteLine(cursor),
              endLine: absoluteLine(cursor),
            },
            excerptCandidate: text,
          });
          retainReference(ref);
          pathReferenceIds.push(ref.reference.id);
          if (ref.sensitivity.excerptSecretMatch || ref.sensitivity.excerptContactMatch) {
            pathProseSuppressed = true;
            routingSourceReferenceIds.add(ref.reference.id);
          } else completionCue = text;
        }
      }
      if (commands.length > 0) {
        if (pathProseSuppressed) continue;
        paths.push({
          ordinal: paths.length,
          pathKind: "EXPLICIT_COMMANDS",
          labelOrNull: segment.label,
          startConditionOrNull: startCondition,
          inferredMechanismOrNull: null,
          prerequisites,
          commands,
          completionCueOrNull: completionCue,
          sourceReferenceIds: [...new Set(pathReferenceIds)].sort(),
        });
        if (startCondition === null || completionCue === null)
          warnings.add("INSTALL_CONTEXT_INCOMPLETE");
      } else {
        const substantive = [...eligibleOneLineBlocks]
          .filter(
            ([line]) => line >= segment.start && line < segment.end && !headingByLine.has(line),
          )
          .map(([line, blockKind]) => ({
            line,
            text: rawBlockText(lines[line] ?? "", blockKind) ?? "",
          }))
          .filter(({ text }) => text.length > 0);
        const inferred =
          substantive.length === 1
            ? (substantive[0]?.text ?? "").match(/^Install with (.+)\.$/u)
            : null;
        if (inferred?.[1]) {
          const mechanism = inferred[1];
          const line = substantive[0]?.line ?? segment.start;
          const ref = createDocumentReference({
            ...referenceInput,
            locator: {
              type: "LINE_RANGE",
              path: input.normalizedPath,
              startLine: absoluteLine(line),
              endLine: absoluteLine(line),
            },
            excerptCandidate: substantive[0]?.text ?? null,
          });
          retainReference(ref);
          if (ref.sensitivity.excerptSecretMatch || ref.sensitivity.excerptContactMatch)
            routingSourceReferenceIds.add(ref.reference.id);
          else
            paths.push({
              ordinal: paths.length,
              pathKind: "INFERRED_MECHANISM",
              labelOrNull: segment.label,
              startConditionOrNull: null,
              inferredMechanismOrNull: mechanism,
              prerequisites: [],
              commands: [],
              completionCueOrNull: null,
              sourceReferenceIds: [ref.reference.id],
            });
        } else if (substantive.length > 0) {
          for (const context of substantive) {
            const ref = createDocumentReference({
              ...referenceInput,
              locator: {
                type: "LINE_RANGE",
                path: input.normalizedPath,
                startLine: absoluteLine(context.line),
                endLine: absoluteLine(context.line),
              },
              excerptCandidate: context.text,
            });
            const retained = retainReference(ref);
            routingSourceReferenceIds.add(retained.id);
          }
          warnings.add("DETERMINISTIC_DECLARATION_INVALID");
        }
      }
    }
    index = end - 1;
  }
  const stripNestedReferences = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stripNestedReferences);
    if (value === null || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as Readonly<Record<string, unknown>>)
        .filter(([key]) => key !== "sourceReferenceIds")
        .map(([key, member]) => [key, stripNestedReferences(member)]),
    );
  };
  const stripPathProvenance = (path: InstallationPathV1): unknown =>
    stripNestedReferences(
      Object.fromEntries(Object.entries(path).filter(([key]) => key !== "ordinal")),
    );
  const retainedPaths: InstallationPathV1[] = [];
  const groups = new Map<string, InstallationPathV1[]>();
  for (const path of paths) {
    const key = path.labelOrNull === null ? "UNLABELED" : `LABELED:${textKey(path.labelOrNull)}`;
    const group = groups.get(key) ?? [];
    group.push(path);
    groups.set(key, group);
  }
  let pathsDiverge = false;
  for (const group of groups.values()) {
    const byContent = new Map<string, InstallationPathV1[]>();
    for (const path of group) {
      const key = JSON.stringify(stripPathProvenance(path));
      const equal = byContent.get(key) ?? [];
      equal.push(path);
      byContent.set(key, equal);
    }
    if (byContent.size > 1) {
      pathsDiverge = true;
      retainedPaths.push(...group);
      continue;
    }
    const equal = [...byContent.values()][0] ?? [];
    const first = equal[0];
    if (first === undefined) continue;
    const commands = first.commands.map((command, commandIndex) => ({
      ...command,
      ordinal: commandIndex,
      sourceReferenceIds: [
        ...new Set(equal.flatMap((path) => path.commands[commandIndex]?.sourceReferenceIds ?? [])),
      ].sort(),
    }));
    retainedPaths.push({
      ...first,
      commands,
      sourceReferenceIds: [...new Set(equal.flatMap((path) => path.sourceReferenceIds))].sort(),
    });
  }
  const canonicalPaths = retainedPaths.map((path, ordinal) => ({ ...path, ordinal }));
  let state: ReturnType<typeof extractInstallationContexts>["state"] = "MISSING";
  if (pathsDiverge) state = "UNSAFE_OR_AMBIGUOUS";
  else if (canonicalPaths.length > 0) {
    if (warnings.has("INSTALL_COMMAND_UNSAFE") || warnings.has("DETERMINISTIC_DECLARATION_INVALID"))
      state = "UNSAFE_OR_AMBIGUOUS";
    else if (
      canonicalPaths.some((path) => path.pathKind === "EXPLICIT_COMMANDS") &&
      canonicalPaths.some((path) => path.pathKind === "INFERRED_MECHANISM")
    ) {
      warnings.add("INSTALL_PATH_KINDS_MIXED");
      state = "UNSAFE_OR_AMBIGUOUS";
    } else if (warnings.has("INSTALL_CONTEXT_INCOMPLETE")) state = "EXPLICIT_PARTIAL";
    else if (canonicalPaths.every((path) => path.pathKind === "INFERRED_MECHANISM"))
      state = "INFERRED";
    else if (canonicalPaths.length === 1) state = "EXPLICIT_COMPLETE";
    else state = "MULTIPLE_PATHS";
  } else if (warnings.size > 0) state = "UNSAFE_OR_AMBIGUOUS";
  return {
    state,
    paths: canonicalPaths,
    sourceReferences: references,
    routingSourceReferenceIds: [...routingSourceReferenceIds].sort(),
    sensitiveReferenceWarningCodesById: Object.fromEntries(
      [...sensitiveReferenceWarningCodesById.entries()]
        .map(([id, warningCodes]) => [id, [...warningCodes]] as const)
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
    warningCodes: [...warnings],
  };
}
