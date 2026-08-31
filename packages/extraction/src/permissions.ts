import type {
  ExtractionSourceReferenceV1,
  M03WarningCode,
  PermissionValueV1,
} from "@ai-ark/contracts";

import { createDocumentReference, type M03ProvenanceAuthority } from "./provenance.js";
import { scanFrozenM01Lines } from "./source-lines.js";

const rules = [
  {
    kind: "FILESYSTEM_READ",
    group: "TS_JS",
    pattern: /\b(fs\.(promises\.)?(readFile|readFileSync)|Deno\.read(Text)?File)\s*\(/giu,
  },
  {
    kind: "FILESYSTEM_READ",
    group: "PYTHON",
    pattern: /\b(Path\([^)]*\)\.read_(text|bytes)|open\s*\([^,\n]+,\s*["']r[b+t]?["'])/giu,
  },
  { kind: "FILESYSTEM_READ", group: "SHELL", pattern: /(^|[;&|]\s*)(cat|head|tail)\s+/giu },
  {
    kind: "FILESYSTEM_WRITE",
    group: "TS_JS",
    pattern:
      /\b(fs\.(promises\.)?(writeFile|writeFileSync|unlink|rename|mkdir)|Deno\.(write(Text)?File|remove|rename|mkdir))\s*\(/giu,
  },
  {
    kind: "FILESYSTEM_WRITE",
    group: "PYTHON",
    pattern: /\b(Path\([^)]*\)\.write_(text|bytes)|open\s*\([^,\n]+,\s*["'][wax][b+t]?["'])/giu,
  },
  {
    kind: "SHELL_EXECUTION",
    group: "TS_JS",
    pattern: /\bchild_process\.(exec|execFile|spawn)\s*\(/giu,
  },
  {
    kind: "SHELL_EXECUTION",
    group: "PYTHON",
    pattern: /\b(subprocess\.(run|Popen)|os\.system)\s*\(/giu,
  },
  { kind: "PROCESS_CONTROL", group: "TS_JS", pattern: /\bprocess\.kill\s*\(/giu },
  { kind: "PROCESS_CONTROL", group: "PYTHON", pattern: /\bos\.(kill|killpg)\s*\(/giu },
  {
    kind: "NETWORK_ACCESS",
    group: "TS_JS",
    pattern: /\b(fetch|axios\.(get|post|put|delete)|https?\.request)\s*\(/giu,
  },
  {
    kind: "NETWORK_ACCESS",
    group: "PYTHON",
    pattern: /\b(requests\.(get|post|put|delete)|urllib\.request\.urlopen)\s*\(/giu,
  },
  { kind: "ENVIRONMENT_READ", group: "TS_JS", pattern: /\bprocess\.env(?:\b|\[|\.)/giu },
  { kind: "ENVIRONMENT_READ", group: "PYTHON", pattern: /\bos\.(environ|getenv)\b/giu },
  {
    kind: "SECRET_ACCESS",
    group: "TS_JS",
    pattern: /\bprocess\.env.{0,80}(key|token|password|secret)\b/giu,
  },
  {
    kind: "SECRET_ACCESS",
    group: "PYTHON",
    pattern: /\bos\.(environ|getenv).{0,80}(key|token|password|secret)\b/giu,
  },
  {
    kind: "DATABASE_ACCESS",
    group: "TS_JS",
    pattern: /\b(pg|PrismaClient|Sequelize|better-sqlite3)\b/giu,
  },
  { kind: "DATABASE_ACCESS", group: "PYTHON", pattern: /\b(psycopg|sqlite3|sqlalchemy)\b/giu },
  { kind: "BROWSER_CONTROL", group: "BOTH", pattern: /\b(playwright|puppeteer|selenium)\b/giu },
  {
    kind: "EXTERNAL_SERVICE_ACCESS",
    group: "BOTH",
    pattern: /\b(OpenAI|Anthropic|Stripe|WebClient|discord)\b/giu,
  },
] as const;

function languageGroup(path: string): "TS_JS" | "PYTHON" | "SHELL" | null {
  if (/\.(?:ts|tsx|js|jsx|mjs|cjs)$/u.test(path)) return "TS_JS";
  if (path.endsWith(".py")) return "PYTHON";
  if (/\.(?:sh|bash|zsh)$/u.test(path)) return "SHELL";
  return null;
}

export function scanStaticPermissions(input: {
  readonly sourceSnapshotId: string;
  readonly sourceEntryId: string;
  readonly sourceDocumentId: string;
  readonly ownership: "CANDIDATE_OWNED" | "SHARED";
  readonly normalizedPath: string;
  readonly documentContent: string;
  readonly provenanceAuthority?: M03ProvenanceAuthority;
}): readonly {
  readonly line: number;
  readonly value: PermissionValueV1;
  readonly reference: ExtractionSourceReferenceV1;
  readonly warningCodes: readonly M03WarningCode[];
  readonly sensitivity: ReturnType<typeof createDocumentReference>["sensitivity"];
}[] {
  const group = languageGroup(input.normalizedPath);
  if (group === null) return [];
  const found: {
    line: number;
    value: PermissionValueV1;
    reference: ExtractionSourceReferenceV1;
    warningCodes: readonly M03WarningCode[];
    sensitivity: ReturnType<typeof createDocumentReference>["sensitivity"];
  }[] = [];
  scanFrozenM01Lines(input.documentContent).forEach(({ content: line }, index) => {
    for (const rule of rules) {
      if (rule.group !== group && rule.group !== "BOTH") continue;
      const matchCount = (line.normalize("NFC").match(rule.pattern) ?? []).length;
      for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
        const referenceResult = createDocumentReference({
          ...input,
          locator: {
            type: "LINE_RANGE",
            path: input.normalizedPath,
            startLine: index + 1,
            endLine: index + 1,
          },
          excerptCandidate: line,
        });
        const reference = referenceResult.reference;
        found.push({
          line: index + 1,
          reference,
          warningCodes: referenceResult.warningCodes,
          sensitivity: referenceResult.sensitivity,
          value: {
            kind: rule.kind,
            evidenceLevel: "CODE_INDICATED",
            scopeOrNull: null,
            absenceClaim: false,
            sourceReferenceIds: [reference.id],
          },
        });
      }
    }
  });
  return found;
}
