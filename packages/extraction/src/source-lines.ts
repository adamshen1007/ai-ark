export interface FrozenM01Line {
  readonly content: string;
  readonly terminator: "\r\n" | "\n" | "";
  readonly startIndex: number;
  readonly endContentIndex: number;
  readonly endIndex: number;
  readonly startByte: number;
  readonly endContentByte: number;
  readonly endByte: number;
}

export function scanFrozenM01Lines(content: string): readonly FrozenM01Line[] {
  if (content === "") return [];
  const lines: FrozenM01Line[] = [];
  let startIndex = 0;
  let startByte = 0;
  for (
    let lfIndex = content.indexOf("\n");
    lfIndex >= 0;
    lfIndex = content.indexOf("\n", lfIndex + 1)
  ) {
    const crlf = lfIndex > startIndex && content[lfIndex - 1] === "\r";
    const endContentIndex = crlf ? lfIndex - 1 : lfIndex;
    const lineContent = content.slice(startIndex, endContentIndex);
    const terminator = crlf ? "\r\n" : "\n";
    const endContentByte = startByte + Buffer.byteLength(lineContent, "utf8");
    const endByte = endContentByte + Buffer.byteLength(terminator, "utf8");
    lines.push({
      content: lineContent,
      terminator,
      startIndex,
      endContentIndex,
      endIndex: lfIndex + 1,
      startByte,
      endContentByte,
      endByte,
    });
    startIndex = lfIndex + 1;
    startByte = endByte;
  }
  const tail = content.slice(startIndex);
  lines.push({
    content: tail,
    terminator: "",
    startIndex,
    endContentIndex: content.length,
    endIndex: content.length,
    startByte,
    endContentByte: startByte + Buffer.byteLength(tail, "utf8"),
    endByte: startByte + Buffer.byteLength(tail, "utf8"),
  });
  return lines;
}

export function frozenM01LineRange(
  content: string,
  startLine: number,
  endLine: number,
): string | null {
  if (endLine < startLine) return null;
  const lines = scanFrozenM01Lines(content);
  const first = lines[startLine - 1];
  const last = lines[endLine - 1];
  if (first === undefined || last === undefined) return null;
  return content.slice(first.startIndex, last.endContentIndex) || null;
}

export type SkillFrontMatterBoundary =
  | {
      readonly state: "NONE";
      readonly yamlContent: null;
      readonly bodyContent: string;
      readonly bodyStartLine: number;
      readonly bodyStartByte: number;
    }
  | {
      readonly state: "UNCLOSED";
      readonly yamlContent: null;
      readonly bodyContent: "";
      readonly bodyStartLine: number;
      readonly bodyStartByte: number;
    }
  | {
      readonly state: "CLOSED";
      readonly yamlContent: string;
      readonly bodyContent: string;
      readonly bodyStartLine: number;
      readonly bodyStartByte: number;
    };

export function skillFrontMatterBoundary(
  normalizedPath: string,
  content: string,
): SkillFrontMatterBoundary {
  const lines = scanFrozenM01Lines(content);
  const opener = lines[0];
  if (normalizedPath !== "SKILL.md" || opener?.content !== "---")
    return {
      state: "NONE",
      yamlContent: null,
      bodyContent: content,
      bodyStartLine: 1,
      bodyStartByte: 0,
    };
  const closingIndex = lines.findIndex(({ content: line }, index) => index > 0 && line === "---");
  if (closingIndex < 0)
    return {
      state: "UNCLOSED",
      yamlContent: null,
      bodyContent: "",
      bodyStartLine: lines.length + 1,
      bodyStartByte: Buffer.byteLength(content, "utf8"),
    };
  const closing = lines[closingIndex];
  if (closing === undefined) throw new Error("M03_FRONT_MATTER_BOUNDARY_INVALID");
  return {
    state: "CLOSED",
    yamlContent: content.slice(opener.endIndex, closing.startIndex),
    bodyContent: content.slice(closing.endIndex),
    bodyStartLine: closingIndex + 2,
    bodyStartByte: closing.endByte,
  };
}
