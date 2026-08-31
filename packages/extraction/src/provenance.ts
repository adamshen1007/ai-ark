import { createHash } from "node:crypto";

import type { ExtractionSourceReferenceV1, M03WarningCode } from "@ai-ark/contracts";

import { canonicalJson } from "./normalization.js";
import { frozenM01LineRange } from "./source-lines.js";

const secretRules = [
  /\b(api[_-]?key|access[_-]?token|auth[_-]?token|password|passwd|secret|private[_-]?key)\b\s*[:=]\s*[^\s]+/iu,
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/iu,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/iu,
  /\bsk-[A-Za-z0-9_-]{20,}\b/iu,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/iu,
] as const;
const contactRules = [
  /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,63}(?![A-Za-z0-9.-])/iu,
  /(?<![0-9])(?:\+[0-9]{1,3}[ .-]?)?(?:\(?[0-9]{2,4}\)?[ .-]?){2,4}[0-9]{3,4}(?![0-9])/iu,
] as const;

export class M03ProvenanceAuthority {
  readonly #sensitiveLocatorPreimages = new Map<string, string>();
  readonly #hash: (preimage: string) => string;

  public constructor(hash: (preimage: string) => string = sha256Hex) {
    this.#hash = hash;
  }

  public sensitiveLocatorFingerprint(locatorPreimage: string): string {
    const fingerprint = this.#hash(locatorPreimage);
    const retainedPreimage = this.#sensitiveLocatorPreimages.get(fingerprint);
    if (retainedPreimage !== undefined && retainedPreimage !== locatorPreimage)
      throw new Error("CONTENT_DERIVED_ID_COLLISION");
    this.#sensitiveLocatorPreimages.set(fingerprint, locatorPreimage);
    return fingerprint;
  }
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function scanSensitiveText(value: string): {
  readonly secretMatch: boolean;
  readonly contactMatch: boolean;
} {
  return {
    secretMatch: secretRules.some((rule) => rule.test(value)),
    contactMatch: contactRules.some((rule) => rule.test(value)),
  };
}

type OrdinaryLocator =
  | {
      readonly type: "LINE_RANGE";
      readonly path: string;
      readonly startLine: number;
      readonly endLine: number;
    }
  | {
      readonly type: "BYTE_RANGE";
      readonly path: string;
      readonly startByte: number;
      readonly endByteExclusive: number;
      readonly extractionTransform: "EXACT_COMMAND_V1";
    }
  | { readonly type: "JSON_POINTER"; readonly path: string; readonly jsonPointer: string }
  | {
      readonly type: "DATA_POINTER";
      readonly path: string;
      readonly format: "YAML_FRONT_MATTER" | "TOML";
      readonly dataPointer: string;
    }
  | {
      readonly type: "FILE_METADATA";
      readonly path: string;
      readonly owningRecord: "SOURCE_ENTRY" | "SOURCE_DOCUMENT";
      readonly metadataKey: string;
    }
  | { readonly type: "TREE_PATH"; readonly path: string };

function pointerTokens(locator: OrdinaryLocator): readonly string[] {
  const pointer =
    locator.type === "JSON_POINTER"
      ? locator.jsonPointer
      : locator.type === "DATA_POINTER"
        ? locator.dataPointer
        : null;
  if (pointer === null) return [];
  return [
    pointer,
    ...pointer
      .split("/")
      .slice(1)
      .map((token) => token.replace(/~1/gu, "/").replace(/~0/gu, "~")),
  ];
}

function privacySafeLocator(
  locator: OrdinaryLocator,
  authority: M03ProvenanceAuthority,
): {
  readonly locator: ExtractionSourceReferenceV1 extends { kind: "DOCUMENT"; locator: infer L }
    ? L
    : never;
  readonly warningCodes: readonly M03WarningCode[];
} {
  const scans = [locator.path, ...pointerTokens(locator)].map(scanSensitiveText);
  const secretMatch = scans.some((scan) => scan.secretMatch);
  const contactMatch = scans.some((scan) => scan.contactMatch);
  if (!secretMatch && !contactMatch) return { locator: locator as never, warningCodes: [] };
  const locatorPreimage = canonicalJson(locator);
  const locatorFingerprint = authority.sensitiveLocatorFingerprint(locatorPreimage);
  const common = {
    type: "SENSITIVE_LOCATOR" as const,
    originalType: locator.type,
    locatorFingerprint,
  };
  let safeLocator: Readonly<Record<string, unknown>> = common;
  if (locator.type === "LINE_RANGE") {
    safeLocator = { ...common, startLine: locator.startLine, endLine: locator.endLine };
  } else if (locator.type === "BYTE_RANGE") {
    safeLocator = {
      ...common,
      startByte: locator.startByte,
      endByteExclusive: locator.endByteExclusive,
      extractionTransform: locator.extractionTransform,
    };
  } else if (locator.type === "DATA_POINTER") {
    safeLocator = { ...common, format: locator.format };
  } else if (locator.type === "FILE_METADATA") {
    safeLocator = {
      ...common,
      owningRecord: locator.owningRecord,
      metadataKey: locator.metadataKey,
    };
  }
  return {
    locator: safeLocator as never,
    warningCodes: [
      ...(secretMatch ? (["SECRET_LIKE_VALUE_WITHHELD"] as const) : []),
      ...(contactMatch ? (["PERSONAL_CONTACT_WITHHELD"] as const) : []),
    ],
  };
}

function excerptMustBeWithheld(value: string): boolean {
  return (
    /[\uD800-\uDFFF]/u.test(value) ||
    /<(?:script\b|\/script\s*>|\/?[A-Za-z][A-Za-z0-9-]*(?:\s|>|\/>))/iu.test(value)
  );
}

export function createDocumentReference(input: {
  readonly sourceSnapshotId: string;
  readonly sourceEntryId: string;
  readonly sourceDocumentId: string;
  readonly ownership: "CANDIDATE_OWNED" | "SHARED";
  readonly locator: OrdinaryLocator;
  readonly documentContent: string;
  readonly excerptCandidate: string | null;
  readonly provenanceAuthority?: M03ProvenanceAuthority;
}): {
  readonly reference: ExtractionSourceReferenceV1 & { readonly kind: "DOCUMENT" };
  readonly warningCodes: readonly M03WarningCode[];
  readonly sensitivity: {
    readonly locatorSecretMatch: boolean;
    readonly locatorContactMatch: boolean;
    readonly excerptSecretMatch: boolean;
    readonly excerptContactMatch: boolean;
  };
} {
  const privacy = privacySafeLocator(
    input.locator,
    input.provenanceAuthority ?? new M03ProvenanceAuthority(),
  );
  const excerptCandidate =
    input.locator.type === "LINE_RANGE"
      ? frozenM01LineRange(input.documentContent, input.locator.startLine, input.locator.endLine)
      : input.excerptCandidate;
  const excerptSensitivity =
    excerptCandidate === null
      ? { secretMatch: false, contactMatch: false }
      : scanSensitiveText(excerptCandidate);
  const locatorSensitive = privacy.warningCodes.length > 0;
  const excerptAllowed =
    !locatorSensitive &&
    !excerptSensitivity.secretMatch &&
    !excerptSensitivity.contactMatch &&
    (excerptCandidate === null || !excerptMustBeWithheld(excerptCandidate)) &&
    input.locator.type !== "TREE_PATH";
  const excerpt = excerptAllowed
    ? Array.from(excerptCandidate ?? "")
        .slice(0, 2000)
        .join("") || null
    : null;
  const identity = {
    kind: "DOCUMENT" as const,
    sourceSnapshotId: input.sourceSnapshotId,
    sourceEntryId: input.sourceEntryId,
    sourceDocumentId: input.sourceDocumentId,
    ownership: input.ownership,
    locator: privacy.locator,
    contentHash: sha256Hex(input.documentContent),
  };
  const reference = {
    ...identity,
    id: `src_${sha256Hex(canonicalJson(identity))}`,
    excerptHashOrNull: excerpt === null ? null : sha256Hex(excerpt),
    excerptOrNull: excerpt,
  } as ExtractionSourceReferenceV1 & { readonly kind: "DOCUMENT" };
  const warningCodes = [
    ...privacy.warningCodes,
    ...(!locatorSensitive && excerptSensitivity.secretMatch
      ? (["SECRET_LIKE_VALUE_WITHHELD"] as const)
      : []),
    ...(!locatorSensitive && excerptSensitivity.contactMatch
      ? (["PERSONAL_CONTACT_WITHHELD"] as const)
      : []),
  ];
  return {
    reference,
    warningCodes: [...new Set(warningCodes)],
    sensitivity: {
      locatorSecretMatch: privacy.warningCodes.includes("SECRET_LIKE_VALUE_WITHHELD"),
      locatorContactMatch: privacy.warningCodes.includes("PERSONAL_CONTACT_WITHHELD"),
      excerptSecretMatch: !locatorSensitive && excerptSensitivity.secretMatch,
      excerptContactMatch: !locatorSensitive && excerptSensitivity.contactMatch,
    },
  };
}

export function createSnapshotMetadataReference(input: {
  readonly sourceSnapshotId: string;
  readonly metadataFingerprintKind: "SOURCE_SNAPSHOT" | "PROVIDER_METADATA";
  readonly metadataFingerprint: string;
  readonly locator:
    | {
        readonly type: "SNAPSHOT_FIELD";
        readonly metadataKey:
          | "id"
          | "identityKey"
          | "provider"
          | "providerRepositoryId"
          | "immutableRevision"
          | "acquisitionPolicyVersion"
          | "acquiredAt";
      }
    | {
        readonly type: "REPOSITORY_FIELD";
        readonly metadataKey: "name" | "owner" | "description" | "archived" | "visibility";
      }
    | {
        readonly type: "RELEASE_FIELD";
        readonly metadataKey: "tags" | "latestRelease";
        readonly ordinalOrNull: number | null;
      }
    | { readonly type: "LICENSE_FIELD"; readonly metadataKey: "spdxId" | "source" }
    | { readonly type: "FORK_FIELD"; readonly metadataKey: "isFork" | "parentCanonicalUrl" };
  readonly value: unknown;
}): ExtractionSourceReferenceV1 & { readonly kind: "SNAPSHOT_METADATA" } {
  const identity = {
    kind: "SNAPSHOT_METADATA" as const,
    sourceSnapshotId: input.sourceSnapshotId,
    metadataFingerprintKind: input.metadataFingerprintKind,
    metadataFingerprint: input.metadataFingerprint,
    locator: input.locator,
    contentHash: sha256Hex(canonicalJson(input.value)),
  };
  return {
    ...identity,
    id: `src_${sha256Hex(canonicalJson(identity))}`,
    excerptHashOrNull: null,
    excerptOrNull: null,
  };
}

export function createInventoryAbsenceReference(input: {
  readonly sourceSnapshotId: string;
  readonly candidateRootId: string;
  readonly ownershipTopologyFingerprint: string;
  readonly acquisitionResultFingerprint: string;
  readonly predicate: "CHANGELOG_SELECTOR_SET_EMPTY" | "DEPRECATION_DECLARATION_ABSENT";
  readonly evaluatedSelectorPaths: readonly string[];
}): ExtractionSourceReferenceV1 & { readonly kind: "INVENTORY_ABSENCE" } {
  const contentPreimage = { ...input, result: true };
  const identity = {
    kind: "INVENTORY_ABSENCE" as const,
    ...input,
    evaluatedSelectorPaths: [...input.evaluatedSelectorPaths],
    contentHash: sha256Hex(canonicalJson(contentPreimage)),
  };
  return {
    ...identity,
    id: `src_${sha256Hex(canonicalJson(identity))}`,
    excerptHashOrNull: null,
    excerptOrNull: null,
  };
}
