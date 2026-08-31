# M03 — Structured Extraction

## 1. Status and authorization

- Document status: `CANDIDATE FOR INDEPENDENT REVIEW`.
- Specification-preparation authorization: `GRANTED` on `2026-08-24`.
- Current-candidate independent specification review: `AUTHORIZED; NOT YET PERFORMED`.
- Previous candidate SHA-256: `0df2def74df0ae53b27c58aa51bbc9b497ecf6dc67db7ce34b08162fa78f4115`.
- Previous independent-review decision: `NO-GO — M03 SPECIFICATION NOT READY FOR HUMAN APPROVAL`.
- Second candidate SHA-256: `6dd4c7d17a07a27668ce83f670119e3be95a8401bf17d7285dcb0f5292a937a1`.
- Second independent-review decision: `NO-GO — M03 SPECIFICATION NOT READY FOR HUMAN APPROVAL`.
- Third candidate SHA-256: `bcf655c64d314245b4139a9f3ec252d6ab9496e30ccffad85c2ba45cef1fb220`.
- Third independent-review decision: `NO-GO — M03 SPECIFICATION NOT READY FOR HUMAN APPROVAL`.
- Fourth candidate SHA-256: `90d9d916dd3a2a21f74ba513643121a4a22f706952822f9c5ccca58cab33b325`.
- Fourth independent-review decision: `NO-GO — M03 SPECIFICATION NOT READY FOR HUMAN APPROVAL`.
- Fifth candidate SHA-256: `c8803452901bfcf38a9a521015d7f8eacd567ff16a716adb82312ba69a9a760d`.
- Fifth independent-review decision: `NO-GO — M03 SPECIFICATION NOT READY FOR HUMAN APPROVAL`.
- Sixth candidate SHA-256: `cb9f4a28710c3d64bc54a1eff26e3b65e7a15fc64282c9a42a3f4267c851f8dd`.
- Sixth independent-review decision: `NO-GO — M03 SPECIFICATION NOT READY FOR HUMAN APPROVAL`.
- Seventh candidate SHA-256: `cbe2b7b9e8c0b1085b9c7f959d85030500f85bcf28c2d42387aea057456cef46`.
- Seventh independent-review decision: `NO-GO — M03 SPECIFICATION NOT READY FOR HUMAN APPROVAL`.
- Eighth candidate SHA-256: `10aad84c93200fac2a6ba591d0f0f50a091361adc853325c87b040c1ac0da2e7`.
- Eighth independent-review decision: `NO-GO — M03 SPECIFICATION NOT READY FOR HUMAN APPROVAL`.
- Ninth candidate SHA-256: `e652fcd2adc79f1b094970778cc3099707f4eeb76c8f08c4863ff88e10bee8fc`.
- Ninth independent-review decision: `NO-GO — M03 SPECIFICATION NOT READY FOR HUMAN APPROVAL`.
- Tenth candidate SHA-256: `fc88842a0f8096833255b7b46665883df920ea293f5f350b09bffbb5aeef35c3`.
- Tenth independent-review decision: `NO-GO — M03 SPECIFICATION NOT READY FOR HUMAN APPROVAL`.
- Eleventh candidate SHA-256: `04211007e4e40c4c34cea6c81a2238739df025ad1d5b0e16fe8127386c0d2cb5`.
- Eleventh independent-review decision: `NO-GO — M03 SPECIFICATION NOT READY FOR HUMAN APPROVAL`.
- Twelfth candidate SHA-256: `a0298c64f1409cfe07ede2bcb1a15728f4b5bf1f4c43129fc67e6e6b39f91ece`.
- Twelfth independent-review decision: `NO-GO — M03 SPECIFICATION NOT READY FOR HUMAN APPROVAL`.
- Thirteenth candidate SHA-256: `dbfaa3db1609409ebe386309bdbe2ca758f692a80211aef128024db6293452b0`.
- Thirteenth independent-review decision: `NO-GO — M03 SPECIFICATION NOT READY FOR HUMAN APPROVAL`.
- Fourteenth candidate SHA-256: `e08a7e9389123333997bff8f75c01034818b2886acffed45470779b931b37e77`.
- Fourteenth independent-review decision: `NO-GO — M03 SPECIFICATION NOT READY FOR HUMAN APPROVAL`.
- Fifteenth candidate SHA-256: `4e745772de752fcf0627c5db0b3870e46d9e74fdae522baefa516adc82c581fd`.
- Fifteenth independent-review decision: `NO-GO — M03 SPECIFICATION NOT READY FOR HUMAN APPROVAL`.
- Sixteenth candidate SHA-256: `9db87b963d9afaaf618f71297114a87deaee46824dfa6fd0ae62783014ff6da2`.
- Sixteenth independent-review decision: `NO-GO — M03 SPECIFICATION NOT READY FOR HUMAN APPROVAL`.
- Seventeenth candidate SHA-256: `c60670f5e7b000364b852e8513619b64614aacae34d15e9cf848ac78f7f369b7`.
- Seventeenth independent-review decision: `NO-GO — M03 SPECIFICATION NOT READY FOR HUMAN APPROVAL`.
- Current amendment reason: close sensitive-reference conflict/status precedence, retained-candidate excerpt
  warning issuance, installation sensitive-locator state, and locator-preimage lifecycle authority together without
  implementation or migration changes.
- Human approval of an exact final specification SHA-256: `NOT YET GRANTED`.
- M03 implementation authorization: `NOT GRANTED`.
- Migration modification authorization: `NOT GRANTED`.
- Commit, push, pull-request, merge, release, deployment, and publication authorization: `NOT GRANTED`.
- M04+ specification or implementation authorization: `NOT GRANTED`.
- Approved predecessor: M02 `GO — M02 COMMIT READY`, publicly verified and frozen at repository baseline
  `c6bb0c298dbb386a3ddf1a5363b98a74f2bb6db7`.

This document is a review candidate only. No implementation or migration work may begin until the human product
owner approves the exact final whole-file SHA-256 and separately authorizes implementation against those bytes.
Independent review is evidence for that decision, not human approval and not implementation authorization.

## 2. Objective

For one immutable, identity-resolved M02 candidate/version handoff, M03 must deterministically produce one
versioned structured-extraction bundle containing all required Skill fields, explicit unknown/conflict/review
states, local source references, parser provenance, and separately attributable AI-assisted proposals.

The output is an internal proposal. M03 does not create M04 `Claim`, `EvidenceItem`, or evidence-link records; does
not create an editorial draft; does not approve or publish anything; and does not execute acquired content.

## 3. Scope

M03 includes:

1. eligibility validation against an active controlling M02 identity handoff;
2. deterministic parsing of eligible acquired repository metadata and text;
3. typed extraction of the required Section 10 field registry;
4. version, license, installation, dependency, permission, compatibility, limitation, and maintenance policies;
5. provider-neutral, tool-free AI-assisted normalization for the exact operations in Section 14;
6. explicit source-reference, conflict, warning, uncertainty, and provenance contracts;
7. immutable in-memory/domain output contracts and idempotent orchestration behavior;
8. deterministic fixtures, adversarial fixtures, contract tests, and M00–M02 regressions; and
9. a typed M03-ready handoff result for the separately owned M04 evidence-binding milestone.

M03 implementation, when separately authorized, may add the minimum real `extraction` package and extend the
existing inward-owned `contracts` and fake `analysis` contracts. Package-boundary policy must be updated for any
real package. No empty `domain`, `ai-analysis`, or future package may be created merely to mirror an illustrative
layout.

## 4. Explicit exclusions

M03 excludes:

- any M04 `Claim`, `EvidenceItem`, `ClaimEvidenceLink`, `EvidenceConflict`, publication-evidence validation,
  prompt-injection security milestone completion, or durable evidence graph;
- M05 descriptive draft generation, editorial workflow, approval, publication, public slugs/pages, directory,
  search, ranking, reviews, creator claims, or validation-user workflows;
- canonical Graph promotion of M02 identity shells, creator/organization entity creation, public/current version
  selection, or mutation of M02 identity decisions and handoff markers;
- database schema or migration changes, production persistence, a production AI provider, live-provider-required
  verification, checkout, clone, package installation, command execution, dynamic import, compilation, runtime
  verification, containers, or external-service calls derived from acquired content;
- assets, screenshots, media selection, regional/commercial assertions, rights clearance beyond license-text
  extraction, security auditing, vulnerability scanning, malware scanning, and transitive dependency resolution;
- changes to frozen M00–M02 authority documents or behavior; and
- all M04+ work.

M02 Section 12.2 permits, but does not require, M03 to promote identity shells. This specification deliberately
does not authorize promotion because M04 owns durable claim/evidence binding and later milestones own editorial
and publication state. M03 preserves the opaque M02 identity IDs in its output so a later approved milestone can
promote without changing identity.

## 5. Normative authority and conflict resolution

The repository authority order in `AGENTS.md` applies. Within M03 scope, this document narrows the execution
prompt and architecture without weakening them. In particular:

- the execution prompt's M03 field list, status enums, method, fixtures, and acceptance criteria are mandatory;
- the architecture's deterministic-before-AI order and provider-neutral analysis boundary are mandatory;
- the Resource Intelligence Pipeline defines extraction taxonomy and provenance intent;
- the Resource and Capability Graph is a future canonical destination, not permission to create partial Graph
  records in M03; and
- M02 controls eligibility, stable identity, immutable revision, candidate ownership, and handoff authority.

The execution prompt's illustrative Vitest `--filter` commands conflict with the repository's proven Vitest 4
positional filtering. Section 28 uses the repository-supported positional commands. This is a command correction,
not a gate reduction.

## 6. Normative language, versions, and canonical bytes

`MUST`, `MUST NOT`, `REQUIRED`, `SHOULD`, and `MAY` are normative. All enums are closed. Unknown enum values fail
validation. All timestamps are RFC 3339 UTC with millisecond precision. All hashes are lowercase SHA-256 hex.
All repository paths are the normalized M01 paths and use `/` separators.

M03 v1 constants are:

```text
schemaVersion              = M03_EXTRACTION_V1
extractionPolicyVersion    = m03-extraction-policy-v1
fieldRegistryVersion       = m03-field-registry-v1
taxonomyMappingVersion     = m03-taxonomy-mapping-v1
taxonomyRegistryVersion    = m03-taxonomy-registry-empty-v1
taxonomyRegistryFingerprint = 4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945
permissionPolicyVersion    = m03-permission-policy-v1
compatibilityPolicyVersion = m03-compatibility-policy-v1
analysisBundleVersion      = m03-analysis-bundle-v1
deterministicParserBundleVersion = m03-parsers-v1
normalizationProfileVersion = m03-normalization-unicode-15.1-v1
promptBundleVersion        = m03-prompt-bundle-v1
outputContractVersion      = m03-analysis-output-v1
rawAnalysisSchemaVersion   = m03-analysis-raw-v1
methodologyVersion         = m03-methodology-v1
```

Canonical serialization is UTF-8 RFC 8785-style JSON: object keys sorted by Unicode code point, array order
preserved where semantic and explicitly sorted where declared set-like, no insignificant whitespace, and numbers
in canonical JSON form. A fingerprint never contains its own fingerprint field, timestamps, random IDs, latency,
or provider billing metrics unless the relevant formula explicitly says so.

For every `canonical-sort` without a more specific tuple comparator, serialize each complete declared element to
canonical UTF-8 JSON bytes and sort ascending by unsigned byte lexicographic order; identical bytes deduplicate only
where the collection is declared unique. A named tuple comparator compares components left-to-right, strings by
Unicode-code-point order, integers numerically, and null before non-null. These rules are part of every fingerprint
byte domain and leave no database, locale, insertion-order, or implementation-default ordering.

`positiveBigInt` is a canonical JSON string matching `[1-9][0-9]*`; leading zeroes, signs, whitespace, exponent
notation, and JSON numeric values are invalid. Database `bigint` values are converted to that decimal string before
comparison or canonical serialization, so no JavaScript-safe-integer assumption enters a fingerprint.

`policyArtifactFingerprint` is SHA-256 of the exact UTF-8 bytes strictly between the
`M03_POLICY_ARTIFACT_V1_BEGIN` and `M03_POLICY_ARTIFACT_V1_END` marker lines in Sections 12.2–12.6, with LF line
endings and no Unicode or whitespace normalization. The markers themselves and the LF immediately after BEGIN and
immediately before END are excluded. These source bytes are the fixed canonical byte literal; prose outside the
markers is normative but not hashed. The request value must equal direct recomputation from the approved
specification bytes.
For this candidate's policy literal, the required value is
`48efb226368bf9ed5cdae77ca629c2cab93dbd08250b6a12d88a2a4e08ecaaa9`; any mismatch is request-schema invalid.
The request value must equal the recomputation; the embedded tables, their order, and their declared regex engine
are the normative bytes.

## 7. M02 eligibility and immutable input boundary

An extraction request is eligible only when all of the following are true in one consistent read:

1. the referenced `m02_identity_handoff_markers` row exists and is `ACTIVE`;
2. the distinct acquisition job is `COMPLETED` with `cancellationRequested = false`, and the controlling M02 job has
   `supersessionState = CONTROLLING`;
3. its candidate is `IDENTITY_RESOLVED`, not rejected or superseded, and has no active review;
4. the marker names exactly one `ResourceIdentity` with status `ACTIVE` and one `ResourceVersionIdentity` with
   status `IDENTITY_RESOLVED`, whose parent relation and candidate content fingerprint match;
5. the request names exactly one current `ResourceVersionObservation` for the marker's version identity, candidate
   snapshot, candidate root, and active `ResourceSourceLink`;
6. that observation's snapshot/revision/root/provider/repository tuple matches the candidate, controlling job,
   source link, and requested extraction source; the version identity's first-observed snapshot/revision may differ;
7. the source link is `ACTIVE`, targets the marker's version identity, and its repository/root match the observation;
8. the marker's controlling `IdentityDecision` is the request's decision and still controls the candidate;
9. the candidate root is active and the M02 ownership topology is current;
10. the observation's snapshot is completed and every consumed entry/document is an acquired, eligible M01 record;
    and
11. every expected predecessor record version and immutable fingerprint matches the request.

Failure returns one closed error from Section 17 and produces no extraction bundle or AI call. M03 never repairs,
reopens, or supersedes M02. A handoff that becomes non-controlling during work invalidates the attempt before each
externally observable write/return boundary.

`EXACT_REPEAT_REUSE` and mirror/alternate observations are first-class eligible cases. The current extraction source
is the observation tuple, not `ResourceVersionIdentity.firstObserved*`. M03 preserves the version identity's
first-observed provenance separately and never rewrites it.

### 7.1 ExtractionRequestV1

The command boundary consumes exact UTF-8 request bytes. Invalid JSON, non-UTF-8 input, or any request that fails
the closed schema returns `{kind: INVALID_REQUEST, rawRequestDigest, errorCode: REQUEST_SCHEMA_INVALID,
safeContext:{phase:REQUEST_VALIDATION}}`; `rawRequestDigest` is lowercase SHA-256 of those exact bytes. This arm has
no request fingerprint, IDs, source text, or echoed invalid value and performs no predecessor read, AI call, or
mutation. A schema-valid request proceeds as follows.

```text
{
  schemaVersion,
  requestId,
  idempotencyKey,
  m02HandoffMarkerId,
  controllingM02JobId,
  identityDecisionId,
  m02ReviewStateId,
  resourceCandidateId,
  resourceIdentityId,
  resourceVersionIdentityId,
  resourceVersionObservationId,
  resourceSourceLinkId,
  sourceRepositoryId,
  sourceSnapshotId,
  sourceRevision,
  candidateRootId,
  candidateRootFingerprint,
  candidateContentFingerprint,
  expectedPredecessorState: ExpectedPredecessorStateV1,
  policyVersions: {
    extractionPolicyVersion,
    fieldRegistryVersion,
    taxonomyMappingVersion,
    taxonomyRegistryVersion,
    taxonomyRegistryFingerprint,
    permissionPolicyVersion,
    compatibilityPolicyVersion,
    deterministicParserBundleVersion,
    extractorRegistryFingerprint,
    normalizationProfileVersion,
    policyArtifactFingerprint,
    analysisBundleVersion,
    promptBundleVersion,
    outputContractVersion,
    rawAnalysisSchemaVersion,
    methodologyVersion
  },
  analysisConfiguration: {
    mode: DISABLED | ENABLED,
    operation: NORMALIZE_STRUCTURED_EXTRACTION,
    providerAdapterNameOrNull: deterministic-fake | null,
    providerAdapterVersionOrNull: 1.0.0 | null,
    providerNameOrNull: offline-fake | null,
    modelNameOrNull: m03-fixture-v1 | null,
    deterministicSettings,
    subOperationPlan
  },
  analysisConfigurationFingerprint
}
```

All IDs and expectations are caller supplied. The request fingerprint is SHA-256 of the complete canonical
request except `requestId` and `idempotencyKey`. The orchestrator retains those canonical semantic-request bytes
beside their fingerprint for process lifetime. Before idempotency replay, join, or tuple replay, equal fingerprints
must have byte-identical retained preimages. Equal request fingerprints with different preimages return
`FAILED/INPUT_FINGERPRINT_COLLISION`; this collision check precedes idempotency-key comparison. Reuse of an
idempotency key with a genuinely different request fingerprint returns `IDEMPOTENCY_KEY_REUSED` without AI work or
output mutation.

`analysisConfigurationFingerprint` is SHA-256 of canonical `{mode, operation, providerAdapterNameOrNull,
providerAdapterVersionOrNull, providerNameOrNull, modelNameOrNull, methodologyVersion, deterministicSettings,
promptBundleVersion, outputContractVersion, rawAnalysisSchemaVersion, analysisBundleVersion, subOperationPlan}`.
`DISABLED` requires all provider/model fields null, empty deterministic settings, and an empty sub-operation plan.
`ENABLED` requires exactly adapter `deterministic-fake` version `1.0.0`, provider `offline-fake`, model
`m03-fixture-v1`, the exact deterministic settings below, and the exact ordered sub-operation plan. No other
enabled provider tuple is schema-valid in M03 v1. Provider, adapter, model, methodology, deterministic
setting, prompt, output contract, analysis-bundle, or plan changes therefore change request/input/extraction
identity.

For `ENABLED`, `deterministicSettings` has exactly `{temperature: 0, topP: 1, seedOrNull: 0,
maxOutputTokens: integer[1..16384], responseFormat: JSON_SCHEMA, toolChoice: NONE}`. Unsupported provider controls are
recorded as null only where the schema permits; no hidden/default setting is omitted from the fingerprint.
`subOperationPlan` is a unique list in the canonical Section 14.1 enum order. The required fake-provider plan
contains exactly all nine operations. M03 v1 has no optional enabled operation or legal enabled subset: `ENABLED`
requires that one complete plan, while `DISABLED` requires the empty plan.

### 7.2 ExpectedPredecessorStateV1

```text
ExpectedPredecessorStateV1 = {
  mutableRecordVersions: {
    acquisitionJob: positiveBigInt,
    controllingM02Job: positiveBigInt,
    handoffMarker: positiveBigInt,
    candidate: positiveBigInt,
    resourceIdentity: positiveBigInt,
    resourceVersionIdentity: positiveBigInt,
    resourceSourceLink: positiveBigInt,
    sourceRepositoryIdentity: positiveBigInt,
    identityDecision: positiveBigInt,
    candidateReviewState: positiveBigInt,
    candidateRoot: positiveBigInt
  },
  fingerprintExpectations: {
    sourceSnapshot: lowercaseHex[64],
    acquisitionResult: lowercaseHex[64],
    resourceVersionObservation: lowercaseHex[64],
    ownershipTopology: lowercaseHex[64],
    reviewStateSet: lowercaseHex[64],
    providerMetadata: lowercaseHex[64]
  }
}
```

The object has exactly those keys: missing, extra, zero, negative, non-integer, or duplicate semantic keys return
`EXPECTED_VERSION_SET_INVALID`. `acquisitionJob` and `controllingM02Job` guard the distinct
`acquisition_jobs.record_version` and `m02_jobs.record_version` rows even though both rows share an ID.
`candidateReviewState` guards the request's `m02ReviewStateId`, which must be the unique current review row whose
`resource_candidate_id` is the active candidate, whose `superseded_by_review_id` is null, and whose state is not
`SUPERSEDED`. That row must be `NOT_REQUIRED` or `RESOLVED`; any candidate- or controlling-group-scoped review row
in `CLASSIFICATION_REVIEW_REQUIRED`, `IDENTITY_REVIEW_REQUIRED`, or `CLARIFICATION_REQUESTED` is active and makes
the request ineligible. `resourceVersionObservation` has no record version and is guarded only by its immutable
fingerprint.

Fingerprint expectations are SHA-256 of exact canonical row/set projections, excluding database physical metadata
and using RFC 3339 timestamps. Snapshot, acquisition result, observation, and provider metadata are immutable
records/aggregates; ownership topology and the review-state set are phantom/set guards recomputed from their
complete current sets:

```text
sourceSnapshot = {id, identityKey, provider, providerRepositoryId, immutableRevision,
                  acquisitionPolicyVersion, acquiredAt}
acquisitionResult = {jobId, sourceSnapshotId, result, createdAt}
resourceVersionObservation = {id, resourceVersionIdentityId, sourceSnapshotId, candidateRootId,
  resourceSourceLinkId, sourceRepositoryId, provider, providerRepositoryId, normalizedRootPath,
  immutableRevision, observedAt}
ownershipTopology = {
  ownershipRows: complete rows WHERE candidateRootId = request.candidateRootId
                 AND sourceSnapshotId = request.sourceSnapshotId, projected as
    {id, candidateRootId, sourceSnapshotId, sourceEntryId, ownership},
  rootOrderRows: complete rows WHERE groupId = activeCandidateRoot.groupId
                 AND classificationRunId = activeCandidateRoot.classificationRunId
                 AND sourceSnapshotId = request.sourceSnapshotId, projected as
    {id, groupId, classificationRunId, candidateRootId, sourceSnapshotId, rootOrdinal}
}
reviewStateSet = complete rows WHERE resourceCandidateId = request.resourceCandidateId
                 OR groupId = activeCandidateRoot.groupId, projected as
  {id, groupIdOrNull, resourceCandidateIdOrNull, reviewState, recordVersion: positiveBigInt,
   supersededByReviewIdOrNull}
```

`ownershipRows` sort by `(candidateRootId, sourceEntryId, id)`, `rootOrderRows` by
`(groupId, rootOrdinal, candidateRootId, id)`, and `reviewStateSet` by
`(resourceCandidateIdOrNull null-first, groupIdOrNull null-first, id)`, each using ascending Unicode-code-point byte
comparison for strings and numeric comparison for `rootOrdinal`. No row is described as active unless its schema
has an active-state predicate. The topology projection includes `OWNED`, `SHARED`, and `EXCLUDED` rows. The
review-set projection detects inserted, deleted, superseded, or state/version-changed candidate/group review rows;
the separately versioned candidate row prevents a set hash from substituting for its mutable-row guard.

`providerMetadata` uses the Section 11.1 formula. Exact request expectations are compared during the initial
consistent read, before/after each AI call, and at the final guard. Mutable rows compare positive record versions;
immutable rows/aggregates and the topology set compare canonical fingerprints; the
observation/current-link/decision, resource-identity `ACTIVE`, version-identity `IDENTITY_RESOLVED`,
unique-current-review, no-active-review, and topology-controller predicates are also re-evaluated. Internal read
retries reuse the caller's original complete expectation object and never refresh it.
During the initial eligibility read, a changed version/fingerprint returns `STALE_RECORD_VERSION`, an invalid key
set returns `EXPECTED_VERSION_SET_INVALID`, and a changed active/controller predicate returns its more specific M02
error. After eligibility completes, any predecessor version/fingerprint or active/controller drift returns the
`SUPERSEDED_INPUT` terminal arm; it does not reclassify accepted work as `REJECTED`. Cancellation is checked first at
every post-eligibility guard and wins as `CANCELLED` if both conditions are observed in the same guard. No partial
output or AI call occurs after a failed initial comparison, and no provisional bundle survives a later one.

Initial eligibility evaluates the following first-match table after basic request-schema validation. If multiple
predicates fail in the same consistent read, the first row supplies the sole error:

| Order | Failed predicate                                                                                                      | Eligibility error                       |
| ----: | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
|     1 | idempotency key already binds a different request fingerprint                                                         | `IDEMPOTENCY_KEY_REUSED`                |
|     2 | expected-version/fingerprint object has invalid keys or version encoding                                              | `EXPECTED_VERSION_SET_INVALID`          |
|     3 | handoff row absent                                                                                                    | `M02_HANDOFF_NOT_FOUND`                 |
|     4 | handoff not `ACTIVE`                                                                                                  | `M02_HANDOFF_NOT_ACTIVE`                |
|     5 | acquisition job absent/not completed/cancel-requested, or M02 job absent/noncontrolling/not the handoff controller    | `M02_JOB_NOT_CONTROLLING`               |
|     6 | candidate absent, not `IDENTITY_RESOLVED`, rejected, or superseded                                                    | `M02_CANDIDATE_NOT_RESOLVED`            |
|     7 | candidate review row not uniquely current/clear, or any candidate/group active review exists                          | `M02_REVIEW_ACTIVE`                     |
|     8 | resource identity/version absent, wrong parent/content tuple, or statuses not `ACTIVE`/`IDENTITY_RESOLVED`            | `M02_IDENTITY_TUPLE_INVALID`            |
|     9 | observation absent                                                                                                    | `M02_OBSERVATION_NOT_FOUND`             |
|    10 | observation is not the exact current candidate/version/snapshot/root/repository/provider tuple                        | `M02_OBSERVATION_TUPLE_INVALID`         |
|    11 | source link absent, inactive, or not the observation/version/repository/root link                                     | `M02_SOURCE_LINK_NOT_ACTIVE`            |
|    12 | identity decision absent, inactive, or not the handoff/candidate controller                                           | `M02_IDENTITY_DECISION_NOT_CONTROLLING` |
|    13 | snapshot/acquisition-result identity does not match the observation/request                                           | `SOURCE_SNAPSHOT_MISMATCH`              |
|    14 | immutable revision does not match snapshot/observation/request                                                        | `SOURCE_REVISION_MISMATCH`              |
|    15 | ownership/root-order topology invalid/noncontrolling or consumed M01 records are structurally inconsistent/ineligible | `SOURCE_CORPUS_INVALID`                 |
|    16 | any validly shaped expected version or immutable/set fingerprint differs                                              | `STALE_RECORD_VERSION`                  |

Post-eligibility guards use cancellation-first precedence from above; otherwise any failure of rows 3–16 returns
`SUPERSEDED_INPUT`, not a new eligibility code. This table replaces any implicit “more specific” error selection.

## 8. Eligible source set and ownership

M03 reads no provider or filesystem content directly. It consumes only M01 `SourceDocument` bytes and immutable
provider metadata already bound to the request's snapshot.

The eligible set is:

- every acquired document owned by the active candidate root;
- every acquired document explicitly marked shared with that root by the controlling M02 topology; and
- snapshot-level repository, release/tag, license, and fork metadata explicitly linked to the same snapshot.

Excluded, unowned, sibling-owned, skipped, quarantined, rejected, missing, mutable, symlink, submodule, binary,
archive, encrypted, invalidly encoded, or limit-rejected content MUST NOT be restored or inspected. Shared files
retain their shared provenance and are never silently reclassified as candidate-owned.

M03 performs no additional repository sampling. It processes the complete eligible acquired set in canonical
path order for deterministic parsers. Incompleteness/exclusion field affinity is exhaustive:

| Unavailable/excluded path class                       | Exact affected field keys                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| exact `SKILL.md` or `README.md`                       | `canonical_skill_name`, `creator_candidates`, `organization_candidates`, `version`, `license`, `categories`, `outcome_candidate`, `capabilities`, `tasks`, `use_cases`, `target_user_candidates`, `installation`, `configuration`, `dependencies`, `external_services`, `permissions`, `compatibility`, `limitations` |
| exact Section 12.2 manifest or manifest-like selector | `canonical_skill_name`, `creator_candidates`, `organization_candidates`, `version`, `license`, `configuration`, `dependencies`, `compatibility`                                                                                                                                                                       |
| exact license-file selector                           | `license`                                                                                                                                                                                                                                                                                                             |
| exact changelog selector                              | `version`, `limitations`, `maintenance_signals`                                                                                                                                                                                                                                                                       |
| exact supported Section 12.5 source extension         | `permissions`                                                                                                                                                                                                                                                                                                         |
| exact extension in the unsupported-code set below     | `permissions`                                                                                                                                                                                                                                                                                                         |
| any other path                                        | none                                                                                                                                                                                                                                                                                                                  |

The frozen disposition/reason matrix is literal; reason arrays are unique Unicode-code-point sorted strings:

| Disposition   | Exact legal reason-code shape at completed acquisition                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| `ACQUIRED`    | `[]`                                                                                                            |
| `SELECTED`    | never legal after completed acquisition                                                                         |
| `SKIPPED`     | exactly one of `[FILE_TOO_LARGE]`, `[EXTENSION_NOT_ALLOWED]`, `[LINE_LIMIT_EXCEEDED]`                           |
| `QUARANTINED` | one singleton content-code array named below, or any nonempty inventory-code set except sole `[FILE_TOO_LARGE]` |
| `REJECTED`    | never produced by frozen M01 and never legal for an M03-eligible completed snapshot                             |

The inventory-code vocabulary is exactly `PATH_NULL_BYTE`, `PATH_BACKSLASH`, `PATH_ABSOLUTE`, `PATH_EMPTY`,
`PATH_TOO_LONG`, `PATH_INVALID_PERCENT_ENCODING`, `PATH_TRAVERSAL`, `PATH_AMBIGUOUS_SEGMENT`, `SYMLINK_ENTRY`,
`SUBMODULE_ENTRY`, `EXECUTABLE_ENTRY`, `INVALID_ENTRY_SIZE`, `DUPLICATE_PATH`, `CASE_COLLISION`,
`ENTRY_LIMIT_EXCEEDED`, `SELECTED_FILE_LIMIT_EXCEEDED`, `TOTAL_BYTE_LIMIT_EXCEEDED`, and `FILE_TOO_LARGE`.
`FILE_TOO_LARGE`, `LINE_LIMIT_EXCEEDED`, `ENTRY_LIMIT_EXCEEDED`, `SELECTED_FILE_LIMIT_EXCEEDED`, and
`TOTAL_BYTE_LIMIT_EXCEEDED` are incomplete codes; every other legal code is explicit exclusion.
The singleton content-code arrays are `[UNSUPPORTED_ENCODING_POLICY]`, `[ARCHIVE_CONTENT]`,
`[EXECUTABLE_CONTENT]`, `[BINARY_CONTENT]`, `[ENCRYPTED_CONTENT]`, and `[INVALID_ENCODING]`.
Apply the first path-affinity row. An unavailable entry with any incomplete code emits `SOURCE_CORPUS_INCOMPLETE`; otherwise it
emits `SOURCE_DISPOSITION_EXCLUDED`; every affected field routes to `REVIEW_REQUIRED`. Multiple codes use
incomplete precedence. Any row outside this matrix, unknown code, or missing normalized path fails eligibility with
`SOURCE_CORPUS_INVALID`. An acquired file with an exact unsupported-code extension instead emits
`UNSUPPORTED_STATIC_LANGUAGE` and makes permissions `UNSUPPORTED`. No other residual file is treated as code.
Extension comparison uses ASCII lowercase of `posix.extname(normalizedPath)` and the unsupported-code set is exactly
`[.c,.cc,.cpp,.h,.hpp,.cs,.go,.java,.kt,.php,.rb,.rs,.swift]`.
These predicates replace “relevant” or “may depend” discretion. AI receives only the bounded bundle in Section 14.3.

## 9. Pipeline and separation of authority

The required order is:

```text
validate active M02 handoff
→ freeze canonical input inventory
→ deterministic metadata parsers
→ deterministic manifest and Skill-metadata parsers
→ deterministic Markdown/command parsers
→ deterministic dependency/configuration parsers
→ bounded static permission indicators
→ reconcile deterministic candidates and conflicts
→ construct bounded analysis bundle
→ optional provider-neutral AI proposals
→ validate AI envelope and references
→ merge without overwriting deterministic facts
→ validate all required field results
→ final active-observation/handoff guard
→ return closed ExtractionAttemptResultV1
```

Deterministic candidates and AI proposals are separate immutable records. AI cannot edit, delete, downgrade, or
replace a deterministic candidate, source reference, conflict, or warning. Reconciliation may select or aggregate
only under the field-specific rules in this document and must preserve every input candidate.

## 10. Required field registry

Exactly one `ExtractionFieldResultV1` exists for every key below, even when missing or unsupported.

| Field key                 | Typed value                                   | Cardinality | Material          |
| ------------------------- | --------------------------------------------- | ----------- | ----------------- |
| `canonical_skill_name`    | normalized name plus exact display candidate  | scalar      | yes               |
| `creator_candidates`      | ordered attribution candidates                | list        | attribution group |
| `organization_candidates` | ordered attribution candidates                | list        | attribution group |
| `version`                 | version resolution object                     | scalar      | yes               |
| `source_revision`         | provider and immutable revision               | scalar      | yes               |
| `license`                 | license resolution object                     | scalar      | yes               |
| `categories`              | taxonomy mappings/candidates                  | list        | no                |
| `outcome_candidate`       | concise user outcome proposal                 | scalar      | yes               |
| `capabilities`            | normalized capability proposals               | list        | yes               |
| `tasks`                   | controlled Task mappings/candidates           | list        | yes               |
| `use_cases`               | bounded use-case proposals                    | list        | yes               |
| `target_user_candidates`  | target/Best-for/Not-ideal proposal object     | object      | no                |
| `installation`            | status plus ordered exact-command paths       | object      | yes               |
| `configuration`           | ordered required/optional settings            | list        | yes               |
| `dependencies`            | direct declared dependencies                  | list        | yes               |
| `external_services`       | declared or indicated services                | list        | yes               |
| `permissions`             | required/indicated permission records         | list        | yes               |
| `compatibility`           | platform/runtime/tool compatibility records   | list        | yes               |
| `limitations`             | explicit or synthesized qualified limitations | list        | yes               |
| `maintenance_signals`     | archived/update/release/changelog signals     | object      | no                |

No registry key may be omitted, renamed, duplicated, or extended without a new field-registry version.

### 10.1 ExtractionFieldResultV1

```text
{
  fieldKey,
  value,
  status,
  claimClass,
  confidence,
  deterministicCandidateIds,
  aiProposalIds,
  evidenceIds,
  conflictIds,
  warningCodes,
  extractorRefs
}
```

`evidenceIds` in M03 reference only Section 11 `ExtractionSourceReferenceV1` records. They are deliberately named
to satisfy the inherited field contract but are not M04 `EvidenceItem` IDs and have no publication authority.
M04 must validate and convert them under its own approved contract.

### 10.2 Field statuses

Closed values:

```text
EXPLICIT
STRONGLY_SUPPORTED
INFERRED
CONFLICTING
MISSING
UNSUPPORTED
REVIEW_REQUIRED
```

- `EXPLICIT` requires a deterministic exact source value and at least one source reference.
- `STRONGLY_SUPPORTED` requires validated deterministic inference, source-grounded AI, or mixed support with
  confidence at least `0.85` and no unresolved material conflict; exact deterministic facts use `EXPLICIT`.
- `INFERRED` requires confidence at least `0.60` and below `0.85`, at least one source reference, and an explicit
  inference claim class.
- `CONFLICTING` requires one or more conflict IDs and preserves every conflicting candidate; its canonical scalar
  and preferred-candidate values are always null in M03 v1.
- `MISSING` means the complete eligible corpus contains no candidate and no incompleteness warning.
- `UNSUPPORTED` means M03 v1 cannot represent or safely evaluate the available candidate.
- `REVIEW_REQUIRED` is used for low confidence, unsafe ambiguity, incomplete relevant corpus, invalid AI output
  after bounded repair, or a policy-required human decision. It remains M04-bindable so M04 can persist its
  evidence/claim state, but it blocks all later draft/editorial/publication progression.

`confidence` is `1.0` for exact deterministic values, a decimal in `[0,1]` for supported/inferred proposals, and
null for `CONFLICTING`, `MISSING`, `UNSUPPORTED`, or `REVIEW_REQUIRED`. Empty list values use `[]`; missing scalar
values use null. The `version`, `license`, `target_user_candidates`, `installation`, and `maintenance_signals`
resolution envelopes remain present in missing/conflicting states but require their selected value/list to be
null/empty under Section 10.5. Neither form may be replaced by an invented placeholder.

### 10.3 Claim classes

Closed M03 values:

```text
SOURCE_FACT
REPOSITORY_METADATA
STATIC_CODE_INDICATOR
FORMAT_INFERENCE
AI_INFERENCE
MIXED_DETERMINISTIC_SUPPORT
MIXED_SUPPORT
NO_CLAIM
```

These classes are extraction provenance, not M04 Claim records. `NO_CLAIM` is required for missing, unsupported,
or review-only results with no asserted value.
`MIXED_DETERMINISTIC_SUPPORT` means selected deterministic supports contain at least two distinct candidate claim
classes and no AI proposal. `MIXED_SUPPORT` means both deterministic and AI supports are selected. Neither class is
valid on an individual candidate/proposal.

### 10.4 Closed value schema vocabulary

All strings below are trimmed Unicode NFC. User-facing text is 1–1,000 Unicode scalar values unless a narrower
limit is stated. Exact source strings are not normalized except where their type includes a separate normalized
field. All IDs are non-empty opaque IDs. `sourceReferenceIds` are unique, canonical-sorted IDs owned by the current
bundle. Set-like lists are unique by the declared normalized key and canonical sorted; authored procedures preserve
source order and use zero-based `ordinal` values without gaps.

Normalized members are derived, never caller/parser discretion:

- `textKey(s)`: trim Unicode White_Space at both ends, NFC, apply Unicode Default Case Folding, replace every
  nonempty internal Unicode White_Space run with one ASCII space, then NFC again;
- `handleKey(s)`: `textKey`, then remove exactly one leading `@` if present;
- `semverKey(s)`: only for an exact SemVer 2.0.0 parse after removing one optional leading ASCII `v`; serialize
  `major.minor.patch`, append the source-exact dot-separated prerelease identifiers, and omit build metadata;
- `spdxKey(s)`: parse the SPDX 2.3 expression grammar and serialize canonical identifier casing, uppercase
  `AND`/`OR`/`WITH`, one ASCII space around operators, and only grammar-required parentheses;
- NPM package keys: ASCII lowercase of the valid package name; PyPI keys: PEP 503 normalization (ASCII lowercase
  and each run of `-`, `_`, or `.` replaced by `-`); and other dependency keys: `textKey`.

`normalizedName`, `normalizedLabel`, `normalizedServiceName`, `normalizedSubject`, and every semantic/limitation
`normalizedKey` equal `textKey` of their corresponding display/text member. Attribution handles equal `handleKey`.
`normalizedVersionOrNull` equals `semverKey` when parsing succeeds and is null otherwise. Configuration names use
`textKey`; dependency names use the ecosystem rule above. A supplied normalized member that differs is
`FIELD_SCHEMA_INVALID`. `normalizationProfileVersion` fixes Unicode 15.1.0 Default Case Folding; PEP 503,
SemVer 2.0.0, and SPDX 2.3 are the exact other algorithm versions used by fixtures.

```text
NameValueV1 = {
  normalizedName: string[1..200],
  displayName: string[1..200],
  sourceReferenceIds: nonempty SourceReferenceId[]
}

AttributionCandidateV1 = {
  kind: CREATOR | ORGANIZATION,
  displayName: string[1..200],
  normalizedHandleOrNull: string[1..200] | null,
  basis: SKILL_METADATA | MANIFEST_AUTHOR | MANIFEST_MAINTAINER |
         SOURCE_DECLARATION | PROVIDER_OWNER,
  verificationState: UNVERIFIED,
  sourceReferenceIds: nonempty SourceReferenceId[]
}

VersionValueV1 = {
  versionLabel: string[1..200],
  normalizedVersionOrNull: string[1..200] | null,
  versionSource: SEMVER_RELEASE | GIT_TAG | MANIFEST_VERSION | SKILL_METADATA |
                 CHANGELOG | AI_ARK_SNAPSHOT,
  releaseChannel: ALPHA | BETA | RELEASE_CANDIDATE | STABLE | EXPERIMENTAL |
                  DEPRECATED | ARCHIVED | UNKNOWN,
  sourceReferenceIds: nonempty SourceReferenceId[]
}

VersionResolutionV1 = {
  state: RESOLVED | CONFLICTING | FALLBACK | REVIEW_REQUIRED,
  selectedOrNull: VersionValueV1 | null,
  preferredCandidateIdOrNull: null
}

SourceRevisionValueV1 = {
  provider: GITHUB,
  providerRepositoryId: string[1..200],
  sourceSnapshotId: string,
  immutableRevision: lowercaseHex[40],
  resourceVersionObservationId: string,
  resourceSourceLinkId: string,
  sourceReferenceIds: nonempty SourceReferenceId[]
}

LicenseValueV1 = {sourceReferenceIds: nonempty SourceReferenceId[]} & (
  {spdxExpressionOrNull: string[1..200], customTextHashOrNull: null} |
  {spdxExpressionOrNull: null, customTextHashOrNull: lowercaseHex[64]}
)

LicenseResolutionV1 = {
  state: CONFIRMED | CONFLICTING | MISSING | CUSTOM | AMBIGUOUS | REVIEW_REQUIRED,
  selectedOrNull: LicenseValueV1 | null,
  preferredCandidateIdOrNull: null
}

TaxonomyValueBaseV1 = {
  label: string[1..200],
  normalizedLabel: string[1..200],
  sourceReferenceIds: nonempty SourceReferenceId[]
}

TaxonomyBindingV1 =
  {mappingState: MATCHED, taxonomyIdOrNull: string[1..200],
   taxonomyRegistryVersion, taxonomyRegistryFingerprint} |
  {mappingState: TAXONOMY_CANDIDATE, taxonomyIdOrNull: null,
   taxonomyRegistryVersion, taxonomyRegistryFingerprint}

TaxonomyValueV1 = TaxonomyValueBaseV1 & TaxonomyBindingV1

SemanticProposalV1 = {
  text: string[1..1000],
  normalizedKey: string[1..1000],
  proposalKind: OUTCOME | CAPABILITY | TASK | USE_CASE | TARGET_USER | BEST_FOR |
                NOT_IDEAL_FOR,
  targetFieldKey: outcome_candidate | capabilities | tasks | use_cases |
                  target_user_candidates,
  taxonomyBinding: TaxonomyBindingV1,
  sourceReferenceIds: nonempty SourceReferenceId[]
}

The v1 taxonomy registry artifact is the exact canonical UTF-8 JSON bytes `[]`, whose SHA-256 is the declared
`taxonomyRegistryFingerprint`. No Category, Capability, or Task taxonomy IDs are therefore approved in M03 v1:
every category and every semantic proposal uses `TAXONOMY_CANDIDATE` with null ID. `MATCHED` is schema-valid only
under a future separately approved nonempty registry version/fingerprint and requires exact membership in that
artifact; unknown/nonmember IDs invalidate the proposal. Categories, Tasks, capabilities, and every other semantic
value share this same binding union and constants, so an AI response cannot introduce an arbitrary ID.

TargetUserResolutionV1 = {
  targetUsers: SemanticProposalV1[TARGET_USER, target_user_candidates][],
  bestFor: SemanticProposalV1[BEST_FOR, target_user_candidates][],
  notIdealFor: SemanticProposalV1[NOT_IDEAL_FOR, target_user_candidates][]
}

ExactCommandV1 = {
  ordinal: integer[0..255],
  languageTagOrNull: string[1..50] | null,
  commandTextState: PRESENT | WITHHELD_SECRET_LIKE | WITHHELD_PERSONAL_CONTACT,
  commandTextOrNull: string[1..8000] | null,
  sourceContentHash: lowercaseHex[64],
  sourceReferenceIds: nonempty SourceReferenceId[],
  safetyIndicators: unique enum-order (NETWORK_DOWNLOAD | PIPE_TO_INTERPRETER | PRIVILEGE_ESCALATION |
                                      DESTRUCTIVE_OPERATION | CREDENTIAL_LITERAL | VARIABLE_INTERPOLATION |
                                      PERSONAL_CONTACT_LITERAL | UNKNOWN)[]
}

InstallationPathV1 = {
  ordinal: integer[0..255],
  pathKind: EXPLICIT_COMMANDS | INFERRED_MECHANISM,
  labelOrNull: string[1..200] | null,
  startConditionOrNull: string[1..1000] | null,
  inferredMechanismOrNull: string[1..1000] | null,
  prerequisites: string[1..1000][],
  commands: ExactCommandV1[],
  completionCueOrNull: string[1..1000] | null,
  sourceReferenceIds: nonempty SourceReferenceId[]
}

InstallationResolutionV1 = {
  state: EXPLICIT_COMPLETE | EXPLICIT_PARTIAL | MULTIPLE_PATHS | INFERRED | MISSING |
         UNSAFE_OR_AMBIGUOUS,
  paths: InstallationPathV1[]
}

ConfigurationValueV1 = {
  name: string[1..200],
  normalizedName: string[1..200],
  requiredness: REQUIRED | OPTIONAL | UNKNOWN,
  valueKind: STRING | NUMBER | BOOLEAN | PATH | URL | ENUM | SECRET | OBJECT | ARRAY | UNKNOWN,
  secretSensitivity: SECRET | POSSIBLY_SECRET | NON_SECRET | UNKNOWN,
  defaultPresent: boolean,
  defaultValueOrNull: null | string[1..1000],
  sourceReferenceIds: nonempty SourceReferenceId[]
}

DependencyValueV1 = {
  kind: PACKAGE | RUNTIME | SYSTEM_BINARY | PLUGIN_OR_EXTENSION | UNKNOWN,
  ecosystemOrNull: NPM | PYPI | SYSTEM | OTHER | null,
  name: string[1..200],
  normalizedName: string[1..200],
  declaredConstraintOrNull: string[1..200] | null,
  scope: REQUIRED | OPTIONAL | DEVELOPMENT | UNKNOWN,
  directness: DIRECT_DECLARATION,
  sourceReferenceIds: nonempty SourceReferenceId[]
}

ExternalServiceValueV1 = {
  serviceName: string[1..200],
  normalizedServiceName: string[1..200],
  basis: EXPLICIT_DECLARATION | CONFIGURATION_INDICATOR | STATIC_CODE_INDICATOR,
  requiredness: REQUIRED | OPTIONAL | UNKNOWN,
  sourceReferenceIds: nonempty SourceReferenceId[]
}

PermissionValueV1 = {
  kind: FILESYSTEM_READ | FILESYSTEM_WRITE | SHELL_EXECUTION | PROCESS_CONTROL |
        NETWORK_ACCESS | ENVIRONMENT_READ | SECRET_ACCESS | DATABASE_ACCESS |
        BROWSER_CONTROL | EXTERNAL_SERVICE_ACCESS | UNKNOWN,
  evidenceLevel: EXPLICIT | CODE_INDICATED | INFERRED | UNKNOWN,
  scopeOrNull: string[1..500] | null,
  absenceClaim: false,
  sourceReferenceIds: nonempty SourceReferenceId[]
}

CompatibilityValueV1 = {
  subjectKind: PLATFORM | RUNTIME | HOST_TOOL | FORMAT | REGION | UNKNOWN,
  subject: string[1..200],
  normalizedSubject: string[1..200],
  constraintOrNull: string[1..200] | null,
  evidenceClass: AI_ARK_TEST | SOURCE_DECLARATION | CREATOR_DECLARATION |
                 COMMUNITY_REPORT | FORMAT_INFERENCE | UNKNOWN,
  support: SUPPORTED | UNSUPPORTED | UNKNOWN,
  sourceReferenceIds: nonempty SourceReferenceId[]
}

LimitationValueV1 = {
  text: string[1..1000],
  normalizedKey: string[1..1000],
  kind: EXPLICIT_LIMITATION | SYNTHESIZED_LIMITATION | NOT_IDEAL_FOR,
  sourceAIProposalIdOrNull: AIProposalId | null,
  sourceReferenceIds: nonempty SourceReferenceId[]
}

LimitationProposalValueV1 = {
  text: string[1..1000],
  normalizedKey: string[1..1000],
  kind: SYNTHESIZED_LIMITATION | NOT_IDEAL_FOR,
  sourceReferenceIds: nonempty SourceReferenceId[]
}

MaintenanceSignalsV1 = {
  archived: boolean,
  providerUpdatedAtOrNull: timestamp | null,
  matchingReleaseOrTagDateOrNull: timestamp | null,
  changelogPresent: boolean,
  currentChangelogEntryOrNull: string[1..200] | null,
  explicitDeprecation: boolean | null,
  predecessorMetadataComplete: boolean,
  sourceReferenceIds: SourceReferenceId[]
}
```

`MaintenanceSignalsV1` has these exhaustive cross-field invariants. `changelogPresent = false` iff
`currentChangelogEntryOrNull = null` and exactly one false `CHANGELOG_PRESENT` candidate cites a
`CHANGELOG_SELECTOR_SET_EMPTY` inventory-absence reference. A non-null current entry requires
`changelogPresent = true` and exactly one selected `CURRENT_CHANGELOG_ENTRY` candidate. `archived` and
`changelogPresent` always equal their selected candidates: archived true/false cites `REPOSITORY_FIELD/archived`;
changelog true cites the selected changelog document and false cites inventory absence. `explicitDeprecation` uses
one of four exact branches: an explicit true/false declaration selects that candidate and its document pointer; no
declaration selects false with `DEPRECATION_DECLARATION_ABSENT`; an invalid declaration selects null with its exact
line reference; disagreeing true/false candidates select null and retain both supports/references. The last two
branches make maintenance `REVIEW_REQUIRED`; absence is not used when any declaration prefix exists. Under frozen M01, both date fields are null and `predecessorMetadataComplete = false`; no date candidate
may exist. `sourceReferenceIds` is exactly the canonical union from all selected maintenance candidates, including
the archived=false, changelog=false, and explicitDeprecation=false facts, plus an exact invalid-declaration
reference only in its review branch; it is never an arbitrary superset. The
outer field support/evidence arrays equal the corresponding complete candidate/reference unions. Every other
combination is `FIELD_SCHEMA_INVALID` and the maintenance Cartesian fixture exercises every boolean/null branch.

Secret/contact-sensitive configuration always has `defaultValueOrNull = null`. `WITHHELD_SECRET_LIKE` requires
null text and `CREDENTIAL_LITERAL`; `WITHHELD_PERSONAL_CONTACT` requires null text,
`PERSONAL_CONTACT_LITERAL`, and no credential match; `PRESENT` requires non-null exact text and excludes both
indicators. `COMMUNITY_REPORT` and `AI_ARK_TEST` are schema values for forward compatibility but M03
cannot originate them. `immutableRevision` is 40 lowercase hex because the only M03 provider is the M01 GitHub
source contract. `LimitationValueV1.sourceAIProposalIdOrNull` is null exactly for `EXPLICIT_LIMITATION` and non-null
for `SYNTHESIZED_LIMITATION` or `NOT_IDEAL_FOR`.

### 10.5 Exact value mapping for all 20 fields

```text
ExtractionValueByFieldV1 =
  canonical_skill_name    -> NameValueV1 | null
  creator_candidates      -> AttributionCandidateV1[CREATOR][]
  organization_candidates -> AttributionCandidateV1[ORGANIZATION][]
  version                 -> VersionResolutionV1
  source_revision         -> SourceRevisionValueV1
  license                 -> LicenseResolutionV1
  categories              -> TaxonomyValueV1[]
  outcome_candidate       -> SemanticProposalV1[OUTCOME, outcome_candidate] | null
  capabilities            -> SemanticProposalV1[CAPABILITY, capabilities][]
  tasks                   -> SemanticProposalV1[TASK, tasks][]
  use_cases               -> SemanticProposalV1[USE_CASE, use_cases][]
  target_user_candidates  -> TargetUserResolutionV1
  installation            -> InstallationResolutionV1
  configuration           -> ConfigurationValueV1[]
  dependencies            -> DependencyValueV1[]
  external_services       -> ExternalServiceValueV1[]
  permissions             -> PermissionValueV1[]
  compatibility           -> CompatibilityValueV1[]
  limitations             -> LimitationValueV1[]
  maintenance_signals     -> MaintenanceSignalsV1
```

`ExtractionFieldResultV1` is a discriminated union on `fieldKey`; a value of any other mapped type fails schema
validation. The outcome scalar has at most one selected proposal. All other proposal lists sort by normalized key,
proposal kind, source-reference IDs, then proposal ID. Attribution sorts by basis precedence, normalized handle,
display name, then source-reference IDs. Dependencies sort by kind/ecosystem/normalized name/scope/constraint;
configuration by normalized name; permissions by kind/scope/evidence level; compatibility by subject kind,
normalized subject, constraint, and evidence class. Duplicates compare semantic value identity with provenance and
derived IDs removed; byte-identical semantic values collapse into one selected output with the canonical union of
source references while their distinct provenance records remain in bundle arrays. Same-key semantic differences
follow the exhaustive Section 11.2 reconciliation table.

### 10.6 Nested-state to field-state mapping

`ExtractionFieldResultV1` is the following closed status-discriminated union after applying the field-key value map:

```text
FieldResultBaseV1<K> = {
  fieldKey: K,
  deterministicCandidateIds: unique canonical-sort CandidateId[],
  aiProposalIds: unique canonical-sort AIProposalId[],
  evidenceIds: unique canonical-sort SourceReferenceId[],
  conflictIds: unique canonical-sort ConflictId[],
  warningCodes: unique enum-order WarningCode[],
  extractorRefs: unique canonical-sort ExtractorRefId[]
}

ExplicitFieldResultV1<K> = FieldResultBaseV1<K> & {
  status: EXPLICIT,
  value: nonempty/non-null valid ExtractionValueByFieldV1[K],
  claimClass: SOURCE_FACT | REPOSITORY_METADATA | STATIC_CODE_INDICATOR,
  confidence: 1.0,
  deterministicCandidateIds: nonempty,
  aiProposalIds: [],
  evidenceIds: nonempty,
  conflictIds: []
}

SupportedFieldResultV1<K> = FieldResultBaseV1<K> & {
  status: STRONGLY_SUPPORTED,
  value: nonempty/non-null valid ExtractionValueByFieldV1[K],
  claimClass: FORMAT_INFERENCE | STATIC_CODE_INDICATOR | AI_INFERENCE |
              MIXED_DETERMINISTIC_SUPPORT | MIXED_SUPPORT,
  confidence: decimal[0.85..1.0],
  supportIds:
    claimClass FORMAT_INFERENCE | STATIC_CODE_INDICATOR -> deterministicCandidateIds: nonempty, aiProposalIds: [],
    claimClass AI_INFERENCE -> deterministicCandidateIds: [], aiProposalIds: nonempty,
    claimClass MIXED_DETERMINISTIC_SUPPORT -> deterministicCandidateIds: nonempty with >=2 claim classes,
                                              aiProposalIds: [],
    claimClass MIXED_SUPPORT -> deterministicCandidateIds: nonempty, aiProposalIds: nonempty,
  evidenceIds: nonempty,
  conflictIds: []
}

InferredFieldResultV1<K> = FieldResultBaseV1<K> & {
  status: INFERRED,
  value: nonempty/non-null valid ExtractionValueByFieldV1[K],
  claimClass: FORMAT_INFERENCE | STATIC_CODE_INDICATOR | AI_INFERENCE |
              MIXED_DETERMINISTIC_SUPPORT | MIXED_SUPPORT,
  confidence: decimal[0.60..0.85),
  supportIds:
    claimClass FORMAT_INFERENCE | STATIC_CODE_INDICATOR -> deterministicCandidateIds: nonempty, aiProposalIds: [],
    claimClass AI_INFERENCE -> deterministicCandidateIds: [], aiProposalIds: nonempty,
    claimClass MIXED_DETERMINISTIC_SUPPORT -> deterministicCandidateIds: nonempty with >=2 claim classes,
                                              aiProposalIds: [],
    claimClass MIXED_SUPPORT -> deterministicCandidateIds: nonempty, aiProposalIds: nonempty,
  evidenceIds: nonempty,
  conflictIds: []
}

ConflictingFieldResultV1<K> = FieldResultBaseV1<K> & {
  status: CONFLICTING,
  value: ConflictValueByFieldV1[K],
  claimClass: SOURCE_FACT | REPOSITORY_METADATA | STATIC_CODE_INDICATOR |
              FORMAT_INFERENCE | AI_INFERENCE | MIXED_DETERMINISTIC_SUPPORT | MIXED_SUPPORT,
  confidence: null,
  supportIds: deterministicCandidateIds + aiProposalIds with total cardinality >= 2,
  evidenceIds: nonempty,
  conflictIds: nonempty
}

MissingFieldResultV1<K> = FieldResultBaseV1<K> & {
  status: MISSING,
  value: EmptyValueByFieldV1[K],
  claimClass: NO_CLAIM,
  confidence: null,
  deterministicCandidateIds: [], aiProposalIds: [], evidenceIds: [], conflictIds: [],
  extractorRefs: nonempty
}

UnsupportedFieldResultV1<K> = FieldResultBaseV1<K> & {
  status: UNSUPPORTED,
  value: EmptyValueByFieldV1[K],
  claimClass: NO_CLAIM,
  confidence: null,
  deterministicCandidateIds: [], aiProposalIds: [], evidenceIds: [], conflictIds: [],
  warningCodes: nonempty, extractorRefs: nonempty
}

ReviewFieldResultV1<K> = FieldResultBaseV1<K> & {
  status: REVIEW_REQUIRED,
  value: ReviewValueByFieldV1[K],
  claimClass:
    K=installation and value.paths nonempty -> SOURCE_FACT | FORMAT_INFERENCE |
                                               MIXED_DETERMINISTIC_SUPPORT,
    K=maintenance_signals -> REPOSITORY_METADATA,
    otherwise -> NO_CLAIM,
  confidence: null,
  warningCodes: nonempty, extractorRefs: nonempty
}
```

Review values are exactly the table below. For every field except `installation` and `maintenance_signals`, a
`REVIEW_REQUIRED` arm has the exact empty review value plus empty deterministic-candidate, AI-proposal, evidence,
and conflict arrays; low-confidence or invalid proposals remain only in the bundle-level proposal/attempt arrays.
Installation and maintenance review values may retain only their exact deterministic safe typed value, with empty
AI-proposal/conflict arrays and their special claim class above. Installation has exact nonempty deterministic
support/evidence when paths are nonempty; unavailable or structurally invalid installation source has
`{state:UNSAFE_OR_AMBIGUOUS,paths:[]}`, `NO_CLAIM`, and empty support/evidence. Maintenance disagreement has both candidate supports and their evidence; an invalid declaration
has empty candidate support but the exact declaration reference in evidence; incomplete corpus may have both empty.
No AI-owned review value is preserved as an asserted field value.

A nonempty installation review derives its claim class exactly from its retained path-candidate supports:
`SOURCE_FACT` when every support is `SOURCE_FACT`, `FORMAT_INFERENCE` when every support is `FORMAT_INFERENCE`, and
`MIXED_DETERMINISTIC_SUPPORT` when both classes occur. It never uses `MIXED_SUPPORT` because installation review
retains no AI proposal. Empty installation review remains `NO_CLAIM`.

For every positive field result, the support-ID arrays are exactly the IDs whose candidate/proposal values are
selected into that field value; unrelated candidates and proposals are preserved in bundle arrays but are not
listed as field support. Each selected scalar, list, or object field has the minimum confidence across its one or
more selected supports and every selected leaf support after deduplication; an empty nested
optional list contributes no confidence term. Deterministic exact-source candidates contribute `1.0`; other
deterministic candidates and all AI proposals contribute their recorded confidence. The field's `confidence` is
that minimum, rounded neither in storage nor comparison. A minimum of `1.0` with any inferential support is still
`STRONGLY_SUPPORTED`, never `EXPLICIT`; `[0.85,1.0]` is `STRONGLY_SUPPORTED`, `[0.60,0.85)` is `INFERRED`, and below
`0.60` is `REVIEW_REQUIRED`. Deterministic-plus-AI fields use `MIXED_SUPPORT`; AI-only fields use `AI_INFERENCE`;
deterministic-only fields with at least two distinct selected claim classes use `MIXED_DETERMINISTIC_SUPPORT`, and
those with one use that exact class. Conflicting, missing,
unsupported, and review-required arms retain their mandated null confidence. Any support-ID/class/confidence
mismatch is `FIELD_SCHEMA_INVALID`.

For `EXPLICIT`, every listed candidate has `supportNature = EXACT` and the same `claimClass` as the field. For a
single-class deterministic-only supported/inferred field, every listed candidate is `INFERENTIAL` and its candidate
claim class equals the field claim class. `MIXED_DETERMINISTIC_SUPPORT` requires deterministic supports from at
least two claim classes and may combine exact and inferential support; it never includes AI. AI proposals have only
`AI_INFERENCE`; `MIXED_SUPPORT` is derived solely during field reconciliation when both nonempty deterministic and
AI support arrays select the value, never supplied by a candidate or AI proposal.

For `CONFLICTING`, support arrays equal the canonical union of every member of every listed conflict and
`evidenceIds` equals their complete source-reference union. If all support records have one identical non-mixed
claim class, the field uses it; otherwise a deterministic-only conflict uses `MIXED_DETERMINISTIC_SUPPORT` and a
conflict containing AI plus deterministic support uses `MIXED_SUPPORT`. No other claim-class choice is valid.
`UNSUPPORTED` retains candidate/proposal records only at bundle level and always has the exact empty support,
evidence, and conflict arrays shown above.

`supportIds` is a cardinality constraint, not a serialized member. `evidenceIds` equals the canonical union of all
source-reference IDs reachable from the serialized selected value plus its listed support records; no unreferenced
ID may be added. `extractorRefs` follows only the exhaustive status-discriminated rule in Section 11.0; there is no
generic fallback or MISSING-only exception. Each `conflictId` targets the same field, and every unresolved conflict
for the field is listed.

Empty/conflict/review values are exact:

| Field family                                                                                                      | `EmptyValueByFieldV1`                                                   | `ConflictValueByFieldV1`                                               | `ReviewValueByFieldV1`                                                                                         |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `canonical_skill_name`, `outcome_candidate`                                                                       | null                                                                    | null                                                                   | null                                                                                                           |
| creator/org/category/capability/Task/use-case/config/dependency/service/permission/compatibility/limitation lists | `[]`                                                                    | `[]`                                                                   | `[]`                                                                                                           |
| `target_user_candidates`                                                                                          | `{targetUsers:[], bestFor:[], notIdealFor:[]}`                          | same empty object                                                      | same empty object                                                                                              |
| `version`                                                                                                         | not permitted                                                           | `{state:CONFLICTING, selectedOrNull:null, preferredCandidateIdOrNull}` | `{state:REVIEW_REQUIRED, selectedOrNull:null, preferredCandidateIdOrNull:null}`                                |
| `license`                                                                                                         | `{state:MISSING, selectedOrNull:null, preferredCandidateIdOrNull:null}` | `{state:CONFLICTING, selectedOrNull:null, preferredCandidateIdOrNull}` | `{state:AMBIGUOUS or REVIEW_REQUIRED, selectedOrNull:null, preferredCandidateIdOrNull:null}`                   |
| `installation`                                                                                                    | `{state:MISSING, paths:[]}`                                             | `{state:UNSAFE_OR_AMBIGUOUS, paths:[]}`                                | `{state:EXPLICIT_PARTIAL, paths:nonempty safe paths}` or `{state:UNSAFE_OR_AMBIGUOUS, paths:safe paths or []}` |
| `maintenance_signals`                                                                                             | not permitted                                                           | not permitted                                                          | complete `MaintenanceSignalsV1` with unavailable values null                                                   |
| `source_revision`                                                                                                 | not permitted                                                           | not permitted                                                          | not permitted                                                                                                  |

`MISSING` is valid only for field families with an `EmptyValueByFieldV1`; `UNSUPPORTED` is invalid for
`source_revision` and uses the same empty-value availability; `REVIEW_REQUIRED` is valid only where the review
column permits it. Ineligible source/version state is an attempt rejection/failure, not a field result.

| Nested result                                                                                                                            | Required field status | Claim class                                                                   | Confidence    | M04 bindability                     |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------- | ------------- | ----------------------------------- |
| exact deterministic selected value                                                                                                       | `EXPLICIT`            | source-specific deterministic class                                           | `1.0`         | bindable                            |
| corroborated supported deterministic/AI/mixed inference                                                                                  | `STRONGLY_SUPPORTED`  | inferential class, `MIXED_DETERMINISTIC_SUPPORT`, or `MIXED_SUPPORT`          | `[0.85,1]`    | bindable                            |
| qualified inference                                                                                                                      | `INFERRED`            | inferential class, `MIXED_DETERMINISTIC_SUPPORT`, or `MIXED_SUPPORT`          | `[0.60,0.85)` | bindable                            |
| any unresolved conflict / `VersionResolution.CONFLICTING` / `LicenseResolution.CONFLICTING`, except maintenance deprecation disagreement | `CONFLICTING`         | exact identical-support class or the deterministic/AI mixed algorithm above   | null          | bindable; later progression blocked |
| complete-corpus absence / license or installation `MISSING`                                                                              | `MISSING`             | `NO_CLAIM`                                                                    | null          | bindable                            |
| representable source but unsupported M03 interpretation                                                                                  | `UNSUPPORTED`         | `NO_CLAIM`                                                                    | null          | bindable; later progression blocked |
| ambiguity, incomplete predecessor/corpus, unsafe withheld command, low confidence, invalid required AI proposal                          | `REVIEW_REQUIRED`     | `NO_CLAIM`, except exact deterministic installation/maintenance review values | null          | bindable; later progression blocked |

`source_revision` is always `EXPLICIT` with confidence `1.0` for an eligible request. `version` fallback is
`EXPLICIT`/`SOURCE_FACT`/`1.0` because the fallback algorithm and revision are exact, while semantic normalized
version remains null. `license.MISSING` maps to field `MISSING`; `CUSTOM` maps to `EXPLICIT`; `AMBIGUOUS` and nested
`REVIEW_REQUIRED` map to field `REVIEW_REQUIRED`. Installation nested states map as follows:
`EXPLICIT_COMPLETE` and `MULTIPLE_PATHS` → `EXPLICIT`; `EXPLICIT_PARTIAL` → `REVIEW_REQUIRED`; `INFERRED` →
`INFERRED`; `MISSING` → `MISSING`; `UNSAFE_OR_AMBIGUOUS` → `REVIEW_REQUIRED` unless the exact contradictory-path rule below requires outer
`CONFLICTING`. Empty semantic/list fields with complete eligible input are
`MISSING`; empty permissions additionally carry `PERMISSION_NOT_PROVEN_ABSENT`.

True/false explicit-deprecation candidates are the sole non-conflict exception: retain both candidates and their
references, serialize no `ExtractionConflictV1`, set `explicitDeprecation=null`, and route maintenance to
`REVIEW_REQUIRED` with `MULTIPLE_EXPLICIT_VALUES`. This is a policy-required human decision, not a selected fact.

Resolution invariants are exact:

- `VersionResolution.RESOLVED` requires non-null selected value whose source is not `AI_ARK_SNAPSHOT` and null
  preferred candidate; `FALLBACK` requires non-null selected `AI_ARK_SNAPSHOT`, null normalized version, and null
  preferred candidate; `CONFLICTING`/`REVIEW_REQUIRED` require null selected and follow the table above.
- `LicenseResolution.CONFIRMED` requires non-null selected with non-null SPDX and null custom hash; `CUSTOM` requires
  non-null selected with null SPDX and non-null custom hash; `MISSING`, `CONFLICTING`, `AMBIGUOUS`, and
  `REVIEW_REQUIRED` require null selected. Preferred candidate is always null, including `CONFLICTING`.
- An `EXPLICIT_COMMANDS` path requires null `inferredMechanismOrNull`, nonempty commands, the exact captured
  start-condition paragraph or null, and the exact captured completion cue or null. An `INFERRED_MECHANISM` path
  requires non-null `inferredMechanismOrNull`, null start/completion, and empty prerequisites/commands. No other
  `InstallationPathV1` shape is valid.
- `Installation.EXPLICIT_COMPLETE` requires exactly one complete explicit path. `EXPLICIT_PARTIAL` requires one or
  more explicit paths with at least one path missing its start condition or completion cue; it retains every path
  in authored order and is always outer `REVIEW_REQUIRED` with `INSTALL_CONTEXT_INCOMPLETE` on exactly the
  incomplete members and field. `MULTIPLE_PATHS` requires at least two complete explicit paths with distinct
  normalized labels and creates no conflict. `INFERRED` requires one or more inferred paths; `MISSING` requires no
  paths. Mixed explicit/inferred paths and structurally invalid contexts follow the total table in Section 12.2.
  Contradictory instructions asserted for the same path/prerequisite are not alternatives: they create
  `INSTALLATION_PATHS_DIVERGE`, outer `CONFLICTING`, and the empty conflict installation value. Unsafe but
  non-conflicting instructions use outer `REVIEW_REQUIRED` and retain only safe typed/withheld path content.
- Configuration `defaultPresent = false` requires null default. `defaultPresent = true` plus
  `secretSensitivity = NON_SECRET` requires non-null default. `SECRET`, `POSSIBLY_SECRET`, or `UNKNOWN` always
  requires null default even when presence is true; the source reference/hash preserves provenance without value.

### 10.7 Materiality and progression

Materiality affects later draft/editorial progression only; it does not control whether M04 may bind the bundle.
Every schema-valid result, including `CONFLICTING`, `MISSING`, `UNSUPPORTED`, or `REVIEW_REQUIRED`, proceeds to M04
for durable Claim/Evidence/Conflict binding. A material missing, conflicting, unsupported, or review-required state
must remain blocking after M04 until an approved later human workflow resolves it. M03 defines no override command.

## 11. Local source references, candidates, conflicts, and warnings

### 11.0 ExtractorRefV1

```text
ExtractorRefV1 = {
  id: ExtractorRefId,
  kind: DETERMINISTIC_PARSER | AI_ANALYSIS,
  name: lowercase-kebab-string[1..100],
  semanticVersion: exact-semver-string[1..50],
  ownedFieldKeys: unique registry-order nonempty FieldKey[],
  configurationFingerprint: lowercaseHex[64],
  codeBundleFingerprint: lowercaseHex[64]
}
```

`id = "xtr_" + SHA-256(canonical record excluding id)`. The bundle `extractorRefs` registry is the unique
canonical-ID-sorted union of the complete configured deterministic parser set plus the single `AI_ANALYSIS` ref
when analysis is enabled. It contains at most 128 records. Every candidate, final AI proposal, and field extractor
ID must resolve to exactly one byte-equal registry record; dangling IDs or same-ID/different-bytes collisions fail
with `CONTENT_DERIVED_ID_COLLISION`.
`extractorRegistryFingerprint` is SHA-256 of that complete canonical ID-sorted registry and must equal the request
policy value and bundle recomputation.

For each field, its configured parser set is exactly every registry ref whose `ownedFieldKeys` contains that field.
A positive/conflicting field lists the union of refs reachable from all listed supports. `MISSING`, `UNSUPPORTED`,
and empty `REVIEW_REQUIRED` list the complete configured parser set for that field, proving which extractors ran or
were intentionally configured. Deterministic installation/maintenance review values instead list their reachable
support refs. No field may list an extractor that does not own it. The implementation's parser registry bytes and
code/configuration hashes are input-bound by `deterministicParserBundleVersion` and the individual fingerprints.
Every final AI proposal's `extractorRefId` is system-assigned to the unique `AI_ANALYSIS` ref after raw validation;
provider output never supplies it.

### 11.1 ExtractionSourceReferenceV1

```text
ExtractionSourceReferenceV1 = DocumentSourceReferenceV1 | SnapshotMetadataReferenceV1 |
                              InventoryAbsenceReferenceV1

DocumentSourceReferenceV1 = {
  kind: DOCUMENT,
  id,
  sourceSnapshotId,
  sourceEntryId,
  sourceDocumentId,
  ownership: CANDIDATE_OWNED | SHARED,
  locator:
    {type: LINE_RANGE, path, startLine: positiveInteger, endLine: positiveInteger} |
    {type: BYTE_RANGE, path, startByte: nonnegativeInteger, endByteExclusive: positiveInteger,
     extractionTransform: EXACT_COMMAND_V1} |
    {type: JSON_POINTER, path, jsonPointer: rfc6901-string[0..1000]} |
    {type: DATA_POINTER, path, format: YAML_FRONT_MATTER | TOML,
     dataPointer: rfc6901-string[0..1000]} |
    {type: FILE_METADATA, path, owningRecord: SOURCE_ENTRY | SOURCE_DOCUMENT,
     metadataKey: SafeFileMetadataKeyV1} |
    {type: TREE_PATH, path} |
    {type: SENSITIVE_LOCATOR, originalType: LINE_RANGE, locatorFingerprint: lowercaseHex[64],
     startLine: positiveInteger, endLine: positiveInteger} |
    {type: SENSITIVE_LOCATOR, originalType: BYTE_RANGE, locatorFingerprint: lowercaseHex[64],
     startByte: nonnegativeInteger, endByteExclusive: positiveInteger,
     extractionTransform: EXACT_COMMAND_V1} |
    {type: SENSITIVE_LOCATOR, originalType: JSON_POINTER, locatorFingerprint: lowercaseHex[64]} |
    {type: SENSITIVE_LOCATOR, originalType: DATA_POINTER, locatorFingerprint: lowercaseHex[64],
     format: YAML_FRONT_MATTER | TOML} |
    {type: SENSITIVE_LOCATOR, originalType: FILE_METADATA, locatorFingerprint: lowercaseHex[64],
     owningRecord: SOURCE_ENTRY | SOURCE_DOCUMENT, metadataKey: SafeFileMetadataKeyV1} |
    {type: SENSITIVE_LOCATOR, originalType: TREE_PATH, locatorFingerprint: lowercaseHex[64]},
  contentHash,
  excerptHashOrNull,
  excerptOrNull
}

SnapshotMetadataReferenceV1 = {
  kind: SNAPSHOT_METADATA,
  id,
  sourceSnapshotId,
  metadataFingerprintKind: SOURCE_SNAPSHOT | PROVIDER_METADATA,
  metadataFingerprint,
  locator:
    {type: SNAPSHOT_FIELD, metadataKey} |
    {type: REPOSITORY_FIELD, metadataKey} |
    {type: RELEASE_FIELD, metadataKey, ordinalOrNull: integer[0..999] | null} |
    {type: LICENSE_FIELD, metadataKey} |
    {type: FORK_FIELD, metadataKey},
  contentHash,
  excerptHashOrNull: null,
  excerptOrNull: null
}

InventoryAbsenceReferenceV1 = {
  kind: INVENTORY_ABSENCE,
  id,
  sourceSnapshotId,
  candidateRootId,
  ownershipTopologyFingerprint,
  acquisitionResultFingerprint,
  predicate: CHANGELOG_SELECTOR_SET_EMPTY | DEPRECATION_DECLARATION_ABSENT,
  evaluatedSelectorPaths: unique canonical-sort string[],
  contentHash,
  excerptHashOrNull: null,
  excerptOrNull: null
}
```

`LINE_RANGE` is 1-based and requires `1 <= startLine <= endLine <= SourceDocument.lineCount`. It adopts frozen M01
line semantics exactly: an empty document has line count zero; every nonempty document has
`1 + count(LF bytes)` lines, including an empty terminal line after a final LF. CRLF counts once through its LF and
a bare CR remains an ordinary content scalar. The locator span includes line content and internal LF/CRLF terminators but
excludes the terminator after `endLine`. `JSON_POINTER` follows RFC 6901 against a successfully
parsed eligible JSON document and must resolve exactly one value.
`DATA_POINTER` applies RFC 6901 tokens to the safe data-only parsed YAML-front-matter mapping or TOML document and
must resolve exactly one value. YAML pointers are rooted at the front-matter mapping after delimiter removal; TOML
pointers are rooted at the complete table object. Its excerpt is RFC 8785 canonical JSON serialization of the
resolved data value. It is invalid for JSON or any unparsed/invalid document.
`BYTE_RANGE` requires `0 <= startByte < endByteExclusive <= SourceEntry.byteLength`, both offsets address the exact
M01 document UTF-8 bytes, and it is valid only for an exact-command source. The range includes fence indentation and
an optional console `$ ` prefix. `EXACT_COMMAND_V1` applies the exact Section 12.3 opening-indent algorithm to
each spanned physical line and removes exactly one first-line `$ ` console prefix before producing
`originalSubstringBytes`; no other transform or byte-range use is valid.

`SafeFileMetadataKeyV1` is closed: `SOURCE_ENTRY` permits only `entryType | byteLength | mediaType |
candidateFileClass | priority | disposition | reasonCodes | sha256`; `SOURCE_DOCUMENT` permits only
`encoding | lineCount | contentHash`. `originalPath`, `objectKey`, identities, timestamps, and any other key are
prohibited. The locator path/entry/document ownership must match the owning record. Release `tags` requires ordinal
in `[0, tags.length)` and `latestRelease` requires null; the global 999 ceiling is an additional schema bound.
Boundary fixtures cover LF, CRLF, bare-CR-as-content, EOF/no-final-LF, empty documents, invalid pointers, metadata
keys, and release ordinals without changing M01 line counts.

Locator privacy is evaluated on the complete original locator before reference construction. Scan normalized
`path`, raw RFC-6901 pointer bytes, and every RFC-6901-decoded pointer token independently with both sensitive
classifiers. If none matches, serialize the ordinary locator arm. If any matches, serialize only the corresponding
`SENSITIVE_LOCATOR` arm: preserve its nontextual coordinates/closed enums, omit `path`, `jsonPointer`, and
`dataPointer`, set `locatorFingerprint = SHA-256(canonical complete original ordinary locator)`, force null
excerpt/hash, and emit the matching secret/contact warning once on each reference-owning field under Section 11.4.
The reference-owning field set is exactly the canonical registry-order union of its deterministic candidate/field
owner and every non-`DETECT_AMBIGUITY` Section 14.3 operation-membership row containing the reference;
`DETECT_AMBIGUITY` adds no field.
Each such field receives the matching warning and follows the shared sensitive-reference precedence below. The
safe candidate remains in the bundle; no candidate warning occurrence is created solely by locator sensitivity.
The safe arm's `originalType` and optional members must exactly match one ordinary arm above; extra/missing members
are invalid. A sensitive locator never makes its original literal bytes an M03 record or M04 payload.
Every later constructor statement that names an ordinary locator describes the pre-privacy locator; this paragraph
mandatorily replaces it with `SENSITIVE_LOCATOR` when the trigger matches and has precedence over literal locator
retention elsewhere in this specification.

The complete ordinary-locator preimage is retained only in the Section 12.6 access-restricted transient collision
store beside `locatorFingerprint`. Before source-reference ID derivation, deduplication, lookup, replay, or M04
handoff accepts the digest, compare that preimage byte-for-byte; equal digest with distinct locator bytes is
`CONTENT_DERIVED_ID_COLLISION`. The source-reference identity record contains the safe locator arm and digest, while
collision validation additionally binds the transient original bytes. For ordering that otherwise names `path` or
pointer bytes, a `SENSITIVE_LOCATOR` uses `(originalType enum ordinal, locatorFingerprint, safe coordinates/enums,
sourceReferenceId)` at that same comparator position. Operation input always assigns it `OMITTED_SENSITIVE`; it is
never in `citableAIReferenceIds`, even when reachable from a structured candidate. M04 may bind only the serialized
safe arm, opaque source entry/document IDs, content hash, and warnings; reconstruction/display of the original
locator is outside M03/M04 authority.

An inventory-absence reference is valid only after the complete eligible candidate-owned/shared set passes
eligibility. `evaluatedSelectorPaths` equals all Section 12.2 selector paths for its predicate in artifact order;
the predicate is true only when none exists (`CHANGELOG_SELECTOR_SET_EMPTY`) or no valid exact Skill/Markdown
deprecation declaration exists (`DEPRECATION_DECLARATION_ABSENT`). Its `contentHash` is SHA-256 of canonical
`{sourceSnapshotId,candidateRootId,ownershipTopologyFingerprint,acquisitionResultFingerprint,predicate,
evaluatedSelectorPaths,result:true}`. It cannot prove absence if any selector-affine path is incomplete/excluded.
It is also prohibited when a recognized declaration prefix is present but invalid.

Document references require entry/document IDs and prohibit metadata fingerprints. A command `BYTE_RANGE`
reference's `contentHash` remains the complete M01 document hash; `ExactCommandV1.sourceContentHash` separately
hashes the transformed original substring. Snapshot-metadata references
require the selected metadata fingerprint and prohibit entry/document IDs, paths, line ranges,
JSON/data pointers, and excerpts. Each locator variant accepts exactly its listed keys. `contentHash` is the M01
document content hash for documents and SHA-256 of the canonical exact metadata field value for metadata.
Inventory-absence references prohibit entry/document IDs, metadata locators/fingerprints, paths, and excerpts and
use only their declared complete-set fingerprints/predicate payload.

The metadata vocabularies are exact:

```text
SNAPSHOT_FIELD   -> id | identityKey | provider | providerRepositoryId | immutableRevision |
                    acquisitionPolicyVersion | acquiredAt
REPOSITORY_FIELD -> name | owner | description | archived | visibility
RELEASE_FIELD    -> tags (ordinal required) | latestRelease (ordinal null)
LICENSE_FIELD    -> spdxId | source
FORK_FIELD       -> isFork | parentCanonicalUrl
```

`SOURCE_SNAPSHOT` is valid only with `SNAPSHOT_FIELD` and uses the Section 7.2 source-snapshot fingerprint.
`PROVIDER_METADATA` prohibits `SNAPSHOT_FIELD` and uses:

```text
providerMetadataFingerprint = SHA-256(canonical {
  repositoryMetadata: {name, owner, description, archived, visibility},
  releaseSignals: {tags: Unicode-code-point sorted unique exact strings, latestRelease},
  licenseSignals: {spdxId, source},
  forkSignals: {isFork, parentCanonicalUrl}
})
```

Release tag ordinal is its index in that canonical sorted tag list. `metadataFingerprint` must equal the selected
aggregate fingerprint. Metadata references cannot address any key outside this vocabulary.

IDs are `src_` plus SHA-256 of the canonical identity record without `id` or excerpt fields. Derived-ID collision
comparison uses those same identity bytes; excerpt fields are deterministic policy-versioned non-identity
decoration. Metadata references and `TREE_PATH`/`SENSITIVE_LOCATOR` document locators always have null excerpt/hash. Other document
locators derive one candidate excerpt as follows: `LINE_RANGE` selects the exact decoded Unicode scalars from the
start of `startLine` through the final scalar before the line terminator after `endLine`; `JSON_POINTER` selects the
RFC 8785 canonical JSON serialization of the addressed value; `DATA_POINTER` does the same for its safe parsed
YAML/TOML value; `FILE_METADATA` selects the canonical JSON
serialization of the addressed metadata value. Empty selections use null.
Thus a valid `LINE_RANGE` addressing only the empty terminal line after a final LF has null excerpt/hash while
retaining its valid line locator and document content hash.

Before clipping, the complete candidate excerpt is scanned by the versioned secret/credential/contact policy; any match,
invalid Unicode, or prohibited raw HTML/script body makes both excerpt fields null. Otherwise retain the first
2,000 Unicode scalar values without adding ellipsis or other bytes. `excerptHashOrNull` is SHA-256 of the exact
retained UTF-8 bytes and is null exactly with `excerptOrNull`. This construction has no discretionary substring,
boundary, or presence choice. The excerpt may support local/AI review but is not an M04 EvidenceItem or public-use
authority.

A `sensitiveReferenceEvent` exists iff either the locator privacy scan matches or a would-be noncommand/
nonconfiguration candidate excerpt matches a secret/contact rule while the candidate's own typed value remains
safe; command and configuration references use their dedicated Section 12.6 routes. For the latter, retain the safe
candidate, null the excerpt/hash, assign that reference occurrence `OMITTED_SENSITIVE`, remove it from
`citableAIReferenceIds`, and add each matching warning once to the candidate and owning field. After complete
deterministic/AI reconciliation, apply this final field precedence in order:

1. an existing `CONFLICTING` result remains byte-identical in status/value/support/evidence/conflict IDs and claim
   class, using only ordinary or `SENSITIVE_LOCATOR` safe reference records; add the sensitive field warning(s);
2. installation becomes `UNSAFE_OR_AMBIGUOUS`/outer `REVIEW_REQUIRED`, retains all safe typed paths and their exact
   candidate supports/evidence, derives claim class under Section 10.6, and adds the warning(s);
3. maintenance becomes its deterministic typed `REVIEW_REQUIRED` arm with safe supports/evidence and warning(s);
4. every other positive, missing, unsupported, or already-review field becomes its exact empty
   `REVIEW_REQUIRED`/`NO_CLAIM` arm with the warning(s); its safe candidates remain bundle-level only.

This precedence preserves every unresolved deterministic or deterministic/AI conflict and overrides generic
candidate-independent sensitive routing for every locator-sensitive reference and every retained-candidate
sensitive excerpt. No sensitive literal becomes evidence, and no safe reference ID is removed from a preserved
conflict.

### 11.2 ExtractionCandidateV1

```text
ExtractionCandidateV1 = {
  id,
  fieldKey,
  value: CandidateValueByFieldV1[fieldKey],
  normalizedKey,
  extractorRefId,
  supportNature: EXACT | INFERENTIAL,
  claimClass: SOURCE_FACT | REPOSITORY_METADATA | STATIC_CODE_INDICATOR | FORMAT_INFERENCE,
  sourceType: REPOSITORY_METADATA | RELEASE_SIGNAL | SKILL_METADATA | PACKAGE_MANIFEST |
              LICENSE_METADATA | LICENSE_TEXT | MARKDOWN_TEXT | FENCED_COMMAND |
              DEPENDENCY_DECLARATION | CONFIGURATION_DECLARATION | STATIC_CODE |
              CHANGELOG | INVENTORY_ABSENCE | SOURCE_REVISION_FALLBACK,
  sourceReferenceIds: unique nonempty canonical-sort SourceReferenceId[],
  confidence: decimal[0..1],
  warningCodes: unique enum-order WarningCode[],
  candidateFingerprint
}
```

Candidate provenance is closed: `EXACT` requires confidence `1.0` and claim class `SOURCE_FACT`,
`REPOSITORY_METADATA`, or `STATIC_CODE_INDICATOR`; `INFERENTIAL` requires `FORMAT_INFERENCE` or
`STATIC_CODE_INDICATOR` and any declared confidence. A candidate cannot use AI provenance. Exact versus inferential
static indicators are distinct because an exact observed code construct may remain a static indicator while a
broader permission/compatibility interpretation is inferential.

```text
CandidateValueByFieldV1 =
  canonical_skill_name    -> NameValueV1
  creator_candidates      -> AttributionCandidateV1[CREATOR]
  organization_candidates -> AttributionCandidateV1[ORGANIZATION]
  version                 -> VersionValueV1
  source_revision         -> SourceRevisionValueV1
  license                 -> LicenseValueV1
  categories              -> TaxonomyValueV1
  outcome_candidate       -> SemanticProposalV1[OUTCOME]
  capabilities            -> SemanticProposalV1[CAPABILITY]
  tasks                   -> SemanticProposalV1[TASK]
  use_cases               -> SemanticProposalV1[USE_CASE]
  target_user_candidates  -> SemanticProposalV1[TARGET_USER | BEST_FOR | NOT_IDEAL_FOR]
  installation            -> InstallationPathV1
  configuration           -> ConfigurationValueV1
  dependencies            -> DependencyValueV1
  external_services       -> ExternalServiceValueV1
  permissions             -> PermissionValueV1
  compatibility           -> CompatibilityValueV1
  limitations             -> LimitationValueV1[EXPLICIT_LIMITATION]
  maintenance_signals     -> MaintenanceSignalCandidateV1

MaintenanceSignalCandidateV1 =
  {kind: ARCHIVED, value: boolean, sourceReferenceIds} |
  {kind: PROVIDER_UPDATED_AT, value: timestamp, sourceReferenceIds} |
  {kind: MATCHING_RELEASE_OR_TAG_DATE, value: timestamp, sourceReferenceIds} |
  {kind: CHANGELOG_PRESENT, value: boolean, sourceReferenceIds} |
  {kind: CURRENT_CHANGELOG_ENTRY, valueOrNull: string[1..200]|null, sourceReferenceIds} |
  {kind: EXPLICIT_DEPRECATION, value: boolean, sourceReferenceIds}
```

`ExtractionCandidateV1.normalizedKey` is exact and field-dependent:

| Field                                                   | Exact normalized-key formula                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `canonical_skill_name`                                  | `name:` + `value.normalizedName`                                                                                   |
| creator/organization                                    | `attribution:` + kind + `:` + (`normalizedHandleOrNull` or `textKey(displayName)`)                                 |
| `version`                                               | `version:` + (`normalizedVersionOrNull` or `textKey(versionLabel)`)                                                |
| `source_revision`                                       | `revision:` + `immutableRevision`                                                                                  |
| `license`                                               | `license:` + (`spdxKey(spdxExpressionOrNull)` or `customTextHashOrNull`)                                           |
| `categories`                                            | `taxonomy:` + (`taxonomyBinding.taxonomyIdOrNull` or `normalizedLabel`)                                            |
| outcome/capability/Task/use-case/target-user candidates | `semantic:` + `proposalKind` + `:` + semantic `normalizedKey`                                                      |
| `installation`                                          | `struct:` + SHA-256 of canonical value identity bytes                                                              |
| `configuration`                                         | `configuration:` + `normalizedName`                                                                                |
| `dependencies`                                          | `struct:` + SHA-256 of canonical `{kind,ecosystemOrNull,normalizedName,declaredConstraintOrNull,scope,directness}` |
| `external_services`                                     | `service:` + `normalizedServiceName`                                                                               |
| `permissions`                                           | `struct:` + SHA-256 of canonical `{kind,evidenceLevel,scopeOrNull,absenceClaim}`                                   |
| `compatibility`                                         | `struct:` + SHA-256 of canonical `{subjectKind,normalizedSubject,constraintOrNull,evidenceClass,support}`          |
| `limitations`                                           | `limitation:` + `kind` + `:` + semantic `normalizedKey`                                                            |
| `maintenance_signals`                                   | `struct:` + SHA-256 of canonical maintenance-signal candidate identity bytes                                       |

“Value identity bytes” are the complete declared value with every `sourceReferenceIds` member recursively removed;
no other field is omitted. Formula strings are UTF-8 NFC and compared byte-for-byte. A candidate whose supplied key
does not equal its formula is `FIELD_SCHEMA_INVALID`; equal keys with byte-distinct value identities create the
field's reconciliation outcome below and never silently collapse.

Semantic value identity is distinct from provenance/value identity: canonical name uses only `normalizedName`;
version uses `{normalizedKey, releaseChannel}` and excludes display spelling plus `versionSource`; license uses
exactly `{kind:SPDX,spdxKey(spdxExpressionOrNull)}` or `{kind:CUSTOM,customTextHashOrNull}` so equivalent SPDX
spelling/parenthesization cannot conflict; every other field uses value identity bytes with provenance-only
`sourceAIProposalIdOrNull` removed. Exact license source spelling remains in provenance only. Candidate/proposal IDs
continue to cover full provenance/value identity. Selection and conflict compare semantic identity; audit retention
preserves all full provenance records.

Same-key reconciliation is exhaustive:

| Field family                                                                             | Same key and equal semantic identity                                                                                                                    | Same key and different semantic identity                                                                                           |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `canonical_skill_name`                                                                   | select by source-tier precedence, then display-name UTF-8 byte order, then candidate ID; union references; retain all provenance; no spelling conflict  | not reachable for same normalized key                                                                                              |
| `version`                                                                                | select exact winner by tier, then value-identity UTF-8 bytes, then candidate ID; copy winner spelling/source and union all agreeing references          | preserve all and create `CROSS_TIER_DISTINCT_VALUES` or `SAME_TIER_DISTINCT_VALUES` by candidate tiers                             |
| `license`                                                                                | SPDX selected value serializes canonical `spdxKey`, null custom hash, and unioned refs; custom selects tier then value bytes then ID; retain provenance | preserve all and create the field-specific conflict                                                                                |
| attribution, categories                                                                  | select by complete value-identity UTF-8 bytes then candidate ID; union references; retain provenance                                                    | preserve all and create the field-specific conflict                                                                                |
| outcome/capability/Task/use-case/target-user/limitation semantic values                  | collapse selected value and union references; retain all provenance                                                                                     | preserve all and create `SAME_TIER_DISTINCT_VALUES`                                                                                |
| installation, configuration, dependency, service, permission, compatibility, maintenance | collapse selected value and union references; retain all provenance                                                                                     | preserve all and create the field-specific divergent-value conflict, or `SAME_TIER_DISTINCT_VALUES` when no narrower reason exists |
| `source_revision`                                                                        | collapse and union references                                                                                                                           | `M02_OBSERVATION_TUPLE_INVALID`; two values are impossible for one eligible observation                                            |

Canonical-name candidates with different normalized keys at the highest populated tier remain `CONFLICTING`; the
display-variant rule uses the total tie-break above.

Every candidate value's own `sourceReferenceIds` must equal the enclosing candidate's source-reference IDs. Frozen
M01 provides neither maintenance date, so M03 creates no candidate for them; the aggregate value uses null plus
`predecessorMetadataComplete = false` and `PREDECESSOR_METADATA_INSUFFICIENT`. A future non-null date candidate
requires explicit predecessor bytes under a new input-policy version.

`candidateFingerprint` is SHA-256 of the canonical candidate without `id` or `candidateFingerprint`; `id` is
`cand_` plus that fingerprint. Set-like candidate collections sort by `(fieldKey, normalizedKey,
sourceReferenceIds, id)`; authored command/procedure order is preserved. Discovery of an existing ID with
byte-distinct canonical payload is `CONTENT_DERIVED_ID_COLLISION` and fails the whole attempt.

### 11.3 ExtractionConflictV1

```text
ExtractionConflictV1 = {
  id,
  fieldKey,
  reasonCode: SAME_TIER_DISTINCT_VALUES | CROSS_TIER_DISTINCT_VALUES |
              LICENSE_METADATA_TEXT_DISAGREE |
              INSTALLATION_PATHS_DIVERGE | COMPATIBILITY_ASSERTIONS_DIVERGE |
              PERMISSION_ASSERTIONS_DIVERGE | TAXONOMY_MAPPING_AMBIGUOUS |
              AI_DETERMINISTIC_DISAGREEMENT | AI_MULTIPLE_INTERPRETATIONS,
  candidateIds: unique canonical-sort CandidateId[],
  aiProposalIds: unique canonical-sort AIProposalId[],
  preferredCandidateIdOrNull: null,
  preferenceIsNonCanonicalGuidance: false,
  sourceReferenceIds: unique nonempty canonical-sort SourceReferenceId[]
}
```

Candidate, AI-proposal, and source-reference IDs are canonical sorted; combined candidate/proposal cardinality is
at least two, while `candidateIds` alone may be empty only for an AI-to-AI conflict. M03 v1 never serializes
preferred guidance for an unresolved conflict. Conflict fingerprint is SHA-256 of the canonical record without `id`; ID is `conf_` plus that
fingerprint. Byte-distinct payload collision fails the attempt. No candidate is discarded.

Every final field AI proposal's nested value `sourceReferenceIds` must byte-equal its enclosing
`sourceReferenceIds`; ambiguity signals have no nested value and use their enclosing references. Interpretation
equality compares `{targetFieldKey, subOperation, semantic value identity}` and excludes references,
attempt/proposal IDs, fingerprints, confidence, and warnings. Two proposals with equal interpretation but different
citations are agreeing provenance, not `MULTIPLE_INTERPRETATIONS`. Every conflict `sourceReferenceIds` is exactly
the canonical unique union of references from every member candidate/proposal; missing or extra references
invalidate the conflict.

### 11.4 Warning policy

Warning codes are closed and versioned. The complete v1 set is:

```text
SOURCE_CORPUS_INCOMPLETE
SOURCE_DISPOSITION_EXCLUDED
PREDECESSOR_METADATA_INSUFFICIENT
ATTRIBUTION_TYPE_UNPROVEN
MULTIPLE_EXPLICIT_VALUES
NORMALIZATION_LOSS
TAXONOMY_CANDIDATE
DEPENDENCY_INCOMPLETE
TRANSITIVE_DEPENDENCY_NOT_RESOLVED
UNRECOGNIZED_MANIFEST
DETERMINISTIC_DECLARATION_INVALID
UNSUPPORTED_LICENSE_IDENTIFIER
UNSUPPORTED_STATIC_LANGUAGE
PERMISSION_NOT_PROVEN_ABSENT
COMPATIBILITY_NOT_RUNTIME_VERIFIED
INSTALL_COMMAND_UNSAFE
INSTALL_CONTEXT_INCOMPLETE
INSTALL_PATH_KINDS_MIXED
SECRET_LIKE_COMMAND_WITHHELD
SECRET_LIKE_VALUE_WITHHELD
CONFIGURATION_TYPE_UNKNOWN
SENSITIVE_CONFIGURATION_DEFAULT_WITHHELD
PERSONAL_CONTACT_WITHHELD
AI_INPUT_BOUNDED
AI_OUTPUT_REPAIRED
AI_OUTPUT_REJECTED
LOW_CONFIDENCE
ARCHIVED_SOURCE
NO_KNOWN_LIMITATION_NOT_PROVEN
```

Unknown warning codes invalidate output rather than being silently ignored.

Issuance is exhaustive. Each row is an `iff`: the named owner must emit the code exactly when its predicate is
true and must not emit it otherwise. `field` means the trusted deterministic field assembler adds the code directly
even when no candidate exists, making absence-only warnings representable. A candidate may serialize only a
`candidate` row for its own field; a validated AI proposal may serialize only its own `proposal` row. All other raw
proposal codes invalidate the whole response.

| Code                                       | Owner                  | Exact trigger and target/status propagation                                                                                                           |
| ------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SOURCE_CORPUS_INCOMPLETE`                 | field                  | exact Section 8 path-affinity row has incomplete input → every field in that row `REVIEW_REQUIRED`                                                    |
| `SOURCE_DISPOSITION_EXCLUDED`              | field                  | exact Section 8 path-affinity row has excluded input → every field in that row `REVIEW_REQUIRED`                                                      |
| `PREDECESSOR_METADATA_INSUFFICIENT`        | field                  | M01 omits tag target/date, provider-update date, or owner type → version/maintenance, maintenance, or both attribution fields respectively            |
| `ATTRIBUTION_TYPE_UNPROVEN`                | field                  | provider-owner-only → both `MISSING`; exact untyped `Attribution:` line → both `REVIEW_REQUIRED`; warning on both                                     |
| `MULTIPLE_EXPLICIT_VALUES`                 | candidate + field      | same-tier distinct candidates → each member and `CONFLICTING`, except deprecation true/false → maintenance `REVIEW_REQUIRED`                          |
| `NORMALIZATION_LOSS`                       | candidate              | normalized display bytes differ from trimmed NFC bytes beyond case alone → that candidate and selected field through normal union                     |
| `TAXONOMY_CANDIDATE`                       | candidate or proposal  | taxonomy binding is exactly `TAXONOMY_CANDIDATE` → owning record/field                                                                                |
| `DEPENDENCY_INCOMPLETE`                    | field                  | a recognized dependency declaration is syntactically incomplete → dependencies `REVIEW_REQUIRED`                                                      |
| `TRANSITIVE_DEPENDENCY_NOT_RESOLVED`       | field                  | at least one direct dependency is selected → dependencies field, status otherwise unchanged                                                           |
| `UNRECOGNIZED_MANIFEST`                    | field                  | parser artifact's manifest-like selector matches but no recognized selector does → affected manifest-owned fields `REVIEW_REQUIRED`                   |
| `DETERMINISTIC_DECLARATION_INVALID`        | field                  | recognized Skill/manifest/Markdown declaration or installation context has wrong shape/grammar → only constructor-table target field(s) review        |
| `UNSUPPORTED_LICENSE_IDENTIFIER`           | field                  | any tier's signal is empty/sentinel/invalid/unallowlisted → license `REVIEW_REQUIRED`; no candidate for that signal                                   |
| `UNSUPPORTED_STATIC_LANGUAGE`              | field                  | exact Section 8 owned-code-path rule finds a non-supported source extension → permissions `UNSUPPORTED`                                               |
| `PERMISSION_NOT_PROVEN_ABSENT`             | field                  | always on permissions because M03 never proves absence → status otherwise unchanged                                                                   |
| `COMPATIBILITY_NOT_RUNTIME_VERIFIED`       | field                  | always on compatibility because M03 performs no runtime verification → status otherwise unchanged                                                     |
| `INSTALL_COMMAND_UNSAFE`                   | candidate + field      | any command safety indicator is nonempty → path candidate and installation `REVIEW_REQUIRED`                                                          |
| `INSTALL_CONTEXT_INCOMPLETE`               | candidate + field      | an `EXPLICIT_COMMANDS` path lacks start condition or completion cue → path candidate and installation `REVIEW_REQUIRED`                               |
| `INSTALL_PATH_KINDS_MIXED`                 | field                  | retained paths contain both `EXPLICIT_COMMANDS` and `INFERRED_MECHANISM` → installation `UNSAFE_OR_AMBIGUOUS` review                                  |
| `SECRET_LIKE_COMMAND_WITHHELD`             | candidate + field      | a secret-signature rule matches exact command bytes → withheld path candidate and installation `REVIEW_REQUIRED`                                      |
| `SECRET_LIKE_VALUE_WITHHELD`               | surface equation below | secret classifier matches noncommand source text other than a configuration default → privacy-safe reference and exact owning/operation fields review |
| `CONFIGURATION_TYPE_UNKNOWN`               | candidate + field      | configuration TYPE `textKey` is exactly `unknown` → retained candidate with outer configuration `REVIEW_REQUIRED`                                     |
| `SENSITIVE_CONFIGURATION_DEFAULT_WITHHELD` | surface equation below | a present default is withheld by secret/contact match or retained non-`NON_SECRET` sensitivity → null default and configuration review                |
| `PERSONAL_CONTACT_WITHHELD`                | surface equation below | contact classifier matches retained source value/excerpt/command/default → privacy-safe reference and exact owning/operation field review             |
| `AI_INPUT_BOUNDED`                         | orchestrator           | at least one otherwise eligible nonsensitive excerpt is omitted solely by AI-input ceilings → bundle only                                             |
| `AI_OUTPUT_REPAIRED`                       | orchestrator           | the exact legal invalid-primary/succeeded-repair pair exists → bundle only                                                                            |
| `AI_OUTPUT_REJECTED`                       | orchestrator + field   | analysis error is unrecovered → bundle and every analysis-affected field routed to `REVIEW_REQUIRED`                                                  |
| `LOW_CONFIDENCE`                           | field proposal + field | field proposal `<0.60` → warning on proposal/targets; deterministic result preserved, otherwise empty review; NOT_IDEAL has two targets               |
| `ARCHIVED_SOURCE`                          | candidate + field      | provider archived value is true → archived candidate and maintenance field                                                                            |
| `NO_KNOWN_LIMITATION_NOT_PROVEN`           | field                  | final limitations is empty → limitations field                                                                                                        |

Sensitive warning occurrence ownership is exact:

- `SECRET_LIKE_VALUE_WITHHELD`: a retained safe candidate whose unrelated would-be excerpt matches receives one
  candidate occurrence and its owning field receives one occurrence; a suppressed candidate/value creates only
  the owning-field occurrence; candidate-independent documentation and secret-sensitive locators give each exact
  Section 14.3/reference-owning field one occurrence. Commands and configuration defaults use their dedicated
  codes instead. No AI proposal can carry this code.
- `PERSONAL_CONTACT_WITHHELD`: a retained command/path candidate receives one candidate occurrence and
  installation receives one field occurrence; a retained configuration candidate with a contact-bearing default
  receives one candidate occurrence and configuration receives one field occurrence; a suppressed candidate/value
  creates no candidate occurrence and its owning field receives one occurrence; a retained safe candidate whose
  unrelated would-be excerpt matches receives one candidate occurrence and its owning field receives one;
  candidate-independent
  documentation gives each Section 14.3 affected field one occurrence; a contact-sensitive locator gives each
  reference-owning field one occurrence. Multiple matches/references for the same surface do not duplicate that
  record's occurrence. No AI proposal can carry this code because matching AI output is invalid.
- `SENSITIVE_CONFIGURATION_DEFAULT_WITHHELD`: when a configuration candidate is retained, that candidate and the
  configuration field each receive one occurrence; when candidate construction is suppressed by name/type policy,
  only the field receives one occurrence. No other record can carry it.

The corresponding candidate occurrence is therefore mandatory, not optional, whenever the named retained
candidate exists. The bundle occurrence remains the one top-level unique-union member under the rule below.

A field warning array is exactly the enum-ordered union of its row-mandated direct field codes plus warnings
reachable from listed support records and conflicts. No other field-only warning is valid. Provider-owner-only has
no local candidate and leaves both fields `MISSING`. An exact untyped `Attribution:` declaration is the only v1
cross-field attribution ambiguity and routes both fields to exact empty `REVIEW_REQUIRED`; neither route fabricates
a cross-field `ExtractionConflictV1`. Consequently `ATTRIBUTION_ROLE_AMBIGUOUS` is not a v1 conflict reason.

Bundle `warningCodes` is the exact unique enum-ordered union of every candidate, AI proposal, and field warning plus
these exhaustive bundle-scope predicates: include `AI_OUTPUT_REPAIRED` iff the legal repair-pair predicate holds;
include `AI_OUTPUT_REJECTED` iff an analysis error is unrecovered; include `AI_INPUT_BOUNDED` iff at least one
otherwise eligible non-sensitive excerpt occurrence is omitted by the excerpt-count/character ceilings. No other
event creates a bundle-only warning and no union member may be omitted or added.

The global warning-reference ceiling counts every serialized warning-array occurrence across candidates,
proposals, fields, and the bundle array; the same code on two records counts twice and its one top-level union member
counts once more. Limits are computed before bundle acceptance with no partial warning truncation.

### 11.5 AIProposalV1 and AnalysisAttemptV1

```text
RawAnalysisResponseV1 = {
  schemaVersion: m03-analysis-raw-v1,
  proposals: RawAIProposalV1[0..512]
}

RawFieldProposalV1 = {
  kind: FIELD_PROPOSAL,
  localOrdinal: integer[0..511],
  subOperation,
  targetFieldKey,
  value,
  confidence,
  claimClass,
  sourceReferenceIds,
  warningCodes
}

RawAmbiguityProposalV1 = {
  kind: AMBIGUITY_SIGNAL,
  localOrdinal: integer[0..511],
  subOperation: DETECT_AMBIGUITY,
  targetFieldKey,
  reason,
  candidateIds,
  interpretedProposalOrdinals: unique canonical-sort integer[0..511][],
  confidence: 1.0,
  sourceReferenceIds,
  warningCodes
}

RawAIProposalV1 = RawFieldProposalV1 | RawAmbiguityProposalV1

AIProposalV1 = FieldAIProposalV1 | AmbiguityAIProposalV1

FieldAIProposalV1 = {
  kind: FIELD_PROPOSAL,
  id,
  analysisAttemptId,
  extractorRefId,
  subOperation,
  targetFieldKey,
  value: AIProposalValueBySubOperationV1[subOperation],
  confidence: decimal[0..1],
  claimClass: AI_INFERENCE,
  sourceReferenceIds: unique nonempty canonical-sort SourceReferenceId[],
  warningCodes: unique enum-order WarningCode[],
  proposalFingerprint
}

AmbiguityAIProposalV1 = {
  kind: AMBIGUITY_SIGNAL,
  id,
  analysisAttemptId,
  extractorRefId,
  subOperation: DETECT_AMBIGUITY,
  targetFieldKey,
  reason: LOW_CONFIDENCE | MULTIPLE_INTERPRETATIONS | DETERMINISTIC_AI_DISAGREEMENT,
  candidateIds: unique canonical-sort CandidateId[],
  interpretedAIProposalIds: unique canonical-sort AIProposalId[],
  confidence: 1.0,
  sourceReferenceIds: unique nonempty canonical-sort SourceReferenceId[],
  warningCodes: [],
  proposalFingerprint
}

AnalysisAttemptV1 = AnalysisSucceededV1 | AnalysisInvalidV1 | AnalysisTimedOutV1 | AnalysisFailedV1

AnalysisAttemptBaseV1 = {
  invocationId,
  id: AnalysisAttemptId,
  analysisConfigurationFingerprint,
  extractionInputFingerprint,
  analysisInputFingerprint,
  providerRequestIdOrNull: string[1..200] | null,
  tokenCountsOrNull: {input: nonnegativeInteger, output: nonnegativeInteger,
                      total: nonnegativeInteger} | null,
  durationMsOrNull: nonnegativeInteger | null
} & (
  {ordinal: 0, purpose: PRIMARY} |
  {ordinal: 1, purpose: SYNTACTIC_REPAIR}
)

AnalysisSucceededV1 = AnalysisAttemptBaseV1 & {
  status: SUCCEEDED,
  outputFingerprintOrNull: lowercaseHex[64],
  safeErrorCodeOrNull: null
}

AnalysisInvalidV1 = AnalysisAttemptBaseV1 & (
  {status: INVALID_OUTPUT, outputFingerprintOrNull: lowercaseHex[64],
   safeErrorCodeOrNull: ANALYSIS_OUTPUT_INVALID,
   invalidityClass: SYNTACTIC_OR_SCHEMA_SHAPE | SEMANTIC_OR_POLICY} |
  {status: LIMIT_EXCEEDED, outputFingerprintOrNull: lowercaseHex[64],
   safeErrorCodeOrNull: ANALYSIS_LIMIT_EXCEEDED,
   invalidityClass: LIMIT}
)

AnalysisTimedOutV1 = AnalysisAttemptBaseV1 & {
  status: TIMED_OUT,
  outputFingerprintOrNull: null,
  safeErrorCodeOrNull: ANALYSIS_TIMED_OUT
}

AnalysisFailedV1 = AnalysisAttemptBaseV1 & {
  status: FAILED,
  outputFingerprintOrNull: null,
  safeErrorCodeOrNull: ANALYSIS_FAILED
}
```

Raw proposal `localOrdinal` equals its zero-based array index without gaps. Raw field values, confidence, claim
class, references, and warnings have the same closed types and sub-operation mapping as their final counterparts.
Raw ambiguity ordinals may reference only raw field proposals in the same response, never another ambiguity signal;
forward references are allowed. Provider output contains none of `id`, `analysisAttemptId`, `proposalFingerprint`,
`interpretedAIProposalIds`, or provider-derived arbitrary keys.

Only field proposals participate in confidence thresholding. A field proposal carries `LOW_CONFIDENCE` iff its
confidence is below `0.60`, in addition to any other proposal-owned mandatory warning. Ambiguity signals always
have confidence `1.0` and no warnings because their reason is a routing observation, not confidence in a value.

Low-confidence and AI-only ambiguity never downgrade deterministic truth. For each affected field, precedence is:
retain an existing deterministic `EXPLICIT`, `STRONGLY_SUPPORTED`, `INFERRED`, or `CONFLICTING` result unchanged
except for adding the exact field warning; value/status/support/evidence/conflicts remain unchanged. Otherwise route
to the exact empty `REVIEW_REQUIRED` arm. An
`AI_MULTIPLE_INTERPRETATIONS` signal is valid only when the field has no deterministic candidate/conflict; when
deterministic candidates exist, disagreement must use `DETERMINISTIC_AI_DISAGREEMENT`. For low-confidence
`NOT_IDEAL_FOR`, apply this precedence independently to target-user and limitations. The proposal/ambiguity records
remain bundle-level evidence and never become selected support below threshold.

Allowed `FieldAIProposalV1` mappings are exact:

| Sub-operation                            | Value                                               | Target field             |
| ---------------------------------------- | --------------------------------------------------- | ------------------------ |
| `NORMALIZE_CAPABILITIES`                 | `SemanticProposalV1[CAPABILITY]`                    | `capabilities`           |
| `MAP_TASKS`                              | `SemanticProposalV1[TASK]`                          | `tasks`                  |
| `SYNTHESIZE_OUTCOME`                     | `SemanticProposalV1[OUTCOME]`                       | `outcome_candidate`      |
| `PROPOSE_USE_CASES`                      | `SemanticProposalV1[USE_CASE]`                      | `use_cases`              |
| `PROPOSE_TARGET_USERS`                   | `SemanticProposalV1[TARGET_USER]`                   | `target_user_candidates` |
| `SYNTHESIZE_BEST_FOR_NOT_IDEAL`          | `SemanticProposalV1[BEST_FOR or NOT_IDEAL_FOR]`     | `target_user_candidates` |
| `SYNTHESIZE_LIMITATIONS`                 | `LimitationProposalValueV1[SYNTHESIZED_LIMITATION]` | `limitations`            |
| `INFER_PERMISSIONS_FROM_STATIC_EVIDENCE` | `PermissionValueV1[INFERRED]`                       | `permissions`            |

`DETECT_AMBIGUITY` may produce only `AmbiguityAIProposalV1`; it never selects a value. Every referenced candidate
or field proposal must exist in the same bundle/validated response and target exactly `targetFieldKey`. The
ambiguity proposal remains in the bundle-level proposal list but is not a value support and therefore is included
in neither the resulting field's nor a conflict's `aiProposalIds`; those arrays list only interpreted value
proposals. Routing is exhaustive:

| Reason                          | Required candidate IDs               | Required interpreted AI proposal IDs          | Conflict                                                                                                       | Field status                                                    | Aggregate contribution |
| ------------------------------- | ------------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------- |
| `LOW_CONFIDENCE`                | `[]`                                 | exactly one proposal with confidence `< 0.60` | none                                                                                                           | retain deterministic result, else exact empty `REVIEW_REQUIRED` | unchanged or review    |
| `MULTIPLE_INTERPRETATIONS`      | `[]`                                 | at least two byte-distinct value proposals    | `AI_MULTIPLE_INTERPRETATIONS` with exactly those AI IDs, their unioned source references, and no candidate IDs | `CONFLICTING`                                                   | conflict               |
| `DETERMINISTIC_AI_DISAGREEMENT` | one or more deterministic candidates | one or more byte-distinct value proposals     | `AI_DETERMINISTIC_DISAGREEMENT` with exactly those candidate/AI IDs and their unioned source references        | `CONFLICTING`                                                   | conflict               |

All conflict rows have `preferredCandidateIdOrNull = null` and `preferenceIsNonCanonicalGuidance = false` for these
three routes. Empty or extra IDs, an ID owned by another field, a low-confidence proposal at or above `0.60`, equal
interpretations, or any other reason/cardinality combination invalidates the complete AI response. Multiple
validated ambiguity signals for one field must be byte-identical after canonicalization or the response is
invalid. The resulting outer status is therefore singular and deterministic: the two conflict routes are
`CONFLICTING`; the no-conflict low-confidence route follows deterministic-preservation precedence. Any other
sub-operation/value/target combination fails the complete AI response.

Every ambiguity signal's `sourceReferenceIds` equals the canonical unique union of references on all listed
candidate IDs and interpreted field-proposal IDs—exactly the one interpreted proposal for `LOW_CONFIDENCE`, all
interpreted proposals for `MULTIPLE_INTERPRETATIONS`, and both candidate/proposal sides for disagreement. Missing
or extra references invalidate the response before proposal-ID derivation.

After proposal ID derivation, merging a `LimitationProposalValueV1` or a `NOT_IDEAL_FOR` semantic proposal creates
the corresponding `LimitationValueV1` with `sourceAIProposalIdOrNull` set to that proposal ID. Thus no proposal
payload contains or hashes its own derived ID.

`extractionInputFingerprint` equals the bundle/request `inputFingerprint` exactly. For each invocation:

```text
OperationSourceInputV1 =
  {sourceReferenceId, state: SUPPLIED_EXCERPT, excerptHash: lowercaseHex[64], excerpt: string[1..2000]} |
  {sourceReferenceId, state: SUPPLIED_STRUCTURED} |
  {sourceReferenceId, state: OMITTED_BOUNDED | OMITTED_SENSITIVE | OMITTED_INVALID}

OperationInputV1 = {
  subOperation,
  deterministicCandidates: canonical-sort complete partition candidate identity payloads,
  deterministicConflicts: canonical-sort complete partition conflict identity payloads,
  allReferenceIds: unique canonical-sort SourceReferenceId[],
  citableAIReferenceIds: unique canonical-sort SourceReferenceId[],
  sourceInputs: one OperationSourceInputV1 per allReferenceId in the same ID order
}
```

`SUPPLIED_EXCERPT` requires the exact non-null safe source-reference excerpt/hash.
`SUPPLIED_STRUCTURED` requires a nonsensitive reference reachable from a serialized candidate/conflict value but no
excerpt. Omission precedence is sensitive, then invalid, then bounded. `citableAIReferenceIds` equals exactly the
two SUPPLIED state IDs. Candidate-independent references can only be `SUPPLIED_EXCERPT` or an omitted state.
Each `(subOperation,sourceReferenceId)` is a distinct occurrence for the global excerpt-count/character ceilings;
the same source ID supplied in two partitions counts twice. Bounding follows Section 14.3 order across occurrence
tuples, and omitted records remain as ID/state only, so no locator/text/hash for omitted content enters the provider
envelope. Duplicate/missing/extra source-input records invalidate the call plan.

```text
analysisInputFingerprint = SHA-256(canonical {
  analysisBundleVersion,
  extractionInputFingerprint,
  purpose,
  priorInvalidOutputFingerprintOrNull,
  fieldRegistryVersion,
  rawAnalysisSchemaVersion,
  subOperationPlan,
  operationInputs: subOperationPlan-order complete OperationInputV1[],
  bundleLimitDeclaration
})

invocationId = "ain_" + SHA-256(canonical {
  extractionInputFingerprint, analysisInputFingerprint, ordinal, purpose,
  analysisConfigurationFingerprint
})

id = "ana_" + SHA-256(canonical {
  invocationId, status, outputFingerprintOrNull, safeErrorCodeOrNull, invalidityClassOrNull
})
```

Each partition candidate/conflict identity payload is the complete canonical record excluding only its derived ID;
`bundleLimitDeclaration` is the exact Section 14.3 excerpt/count/character ceilings. Primary purpose requires null
prior output. Repair purpose requires ordinal 1, a primary `INVALID_OUTPUT` attempt, and that attempt's non-null
output fingerprint and `invalidityClass = SYNTACTIC_OR_SCHEMA_SHAPE`. `invalidityClassOrNull` equals the invalid
arm's class and is null for succeeded/timed-out/failed arms. JSON parse failure, closed raw-shape failure, or
noncontiguous/mistyped local ordinals is `SYNTACTIC_OR_SCHEMA_SHAPE`; every later authorization, reference,
semantic, claim, safety, or policy failure is `SEMANTIC_OR_POLICY` and prohibits repair. The repair uses the
byte-identical `operationInputs` and sub-operation plan. The
attempt-result ID therefore differs for byte-distinct raw outputs or statuses while the invocation ID remains the
logical call identity. Provider request ID, token counts, and duration are metrics and do not affect either ID.
When token counts are present, `total = input + output`; partial token-count objects are invalid.

Provider-output processing order is exact:

1. fingerprint the exact raw response bytes;
2. parse `RawAnalysisResponseV1` and validate its closed schema, contiguous local ordinals, local-reference domain,
   limits, allowed source references, and all semantic rules that do not require derived IDs;
3. select the current invocation's attempt status and derive its attempt `id` from the raw fingerprint;
4. in ascending `localOrdinal`, convert every valid raw field proposal to its final payload and derive its
   proposal fingerprint/ID using that attempt `id` as `analysisAttemptId`;
5. resolve each raw ambiguity ordinal through that complete ordinal-to-final-ID map, form
   `interpretedAIProposalIds`, validate the Section 11.5 truth table, and derive the ambiguity fingerprint/ID; and
6. validate byte equality for every derived-ID lookup before merge.

Proposal fingerprint is SHA-256 of the canonical final proposal without `id`, `analysisAttemptId`, or
`proposalFingerprint`; proposal ID is `aip_` plus SHA-256 of `{analysisAttemptId, proposalFingerprint}`. Invalid raw
responses derive no proposals. Output fingerprints cover exact raw provider output bytes before merge, whether
valid or invalid; timeout/failure before bytes yields null under the status union. Invocation, attempt, and proposal
identities deliberately exclude the later-derived extraction ID and analysis-result fingerprint, avoiding a cycle.
Every content-derived ID is accepted on replay only after byte-exact canonical identity-payload comparison;
mismatch is `CONTENT_DERIVED_ID_COLLISION`.

Every non-null analysis `outputFingerprintOrNull` is lowercase SHA-256 of the exact raw response bytes, without JSON
normalization or repair. The bounded exact bytes are retained only in the authorized process-lifetime in-memory
collision store, keyed by their fingerprint, and compared before attempt-ID derivation, repair linkage, replay, or
merge. Equal hashes with byte-distinct output return `FAILED/CONTENT_DERIVED_ID_COLLISION`; no proposal is derived.
Raw response bytes are never retained in the bundle, diagnostics, persistent storage, or logs and are discarded
when the process-lifetime result store is discarded. This store is exactly the restricted transient exception in
Section 12.6, including for a rejected response containing contact bytes; no adapter or observability interface can
read it.

## 12. Deterministic extraction

Deterministic parsers run before AI and are pure functions of versioned policy plus canonical input bytes.
Extractor identity, registry membership, ownership, and collision rules are exactly Section 11.0.

### 12.1 Repository and release metadata

Extract the provider repository ID/owner/name/description, immutable commit SHA, archived state, and the exact tag
names/latest-release string retained by M01. The frozen M01 contract does not retain tag targets, release dates, or
provider last-updated timestamps. Therefore M03 v1 cannot prove that a tag/release targets the snapshot and cannot
populate either maintenance date from provider metadata. It records the strings only as unproven candidates,
emits `PREDECESSOR_METADATA_INSUFFICIENT`, uses a lower provable version tier or the source-revision fallback, sets
both unavailable dates null, and sets `predecessorMetadataComplete = false`. It never upgrades those strings or
null dates to exact facts. Stars, popularity, sponsorship, and commercial metadata are excluded from field truth
and AI inputs.

When that known predecessor limitation is the only gap, `maintenance_signals` is outer `EXPLICIT` with confidence
`1.0`: the archived boolean and the fact that the two dates are unavailable are deterministic. It becomes
`REVIEW_REQUIRED` only when eligible acquired changelog/deprecation inputs are themselves incomplete or invalid.

### 12.2 Manifest and Skill metadata

<!-- M03_POLICY_ARTIFACT_V1_BEGIN -->

<!-- M03_FIELD_REGISTRY_V1_BEGIN -->

```json
[
  {
    "cardinality": "scalar",
    "fieldKey": "canonical_skill_name",
    "material": "yes",
    "typedValue": "NameValueV1"
  },
  {
    "cardinality": "list",
    "fieldKey": "creator_candidates",
    "material": "attribution_group",
    "typedValue": "AttributionCandidateV1[]"
  },
  {
    "cardinality": "list",
    "fieldKey": "organization_candidates",
    "material": "attribution_group",
    "typedValue": "AttributionCandidateV1[]"
  },
  {
    "cardinality": "scalar",
    "fieldKey": "version",
    "material": "yes",
    "typedValue": "VersionResolutionV1"
  },
  {
    "cardinality": "scalar",
    "fieldKey": "source_revision",
    "material": "yes",
    "typedValue": "SourceRevisionValueV1"
  },
  {
    "cardinality": "scalar",
    "fieldKey": "license",
    "material": "yes",
    "typedValue": "LicenseResolutionV1"
  },
  {
    "cardinality": "list",
    "fieldKey": "categories",
    "material": "no",
    "typedValue": "TaxonomyValueV1[]"
  },
  {
    "cardinality": "scalar",
    "fieldKey": "outcome_candidate",
    "material": "yes",
    "typedValue": "SemanticProposalV1|null"
  },
  {
    "cardinality": "list",
    "fieldKey": "capabilities",
    "material": "yes",
    "typedValue": "SemanticProposalV1[]"
  },
  {
    "cardinality": "list",
    "fieldKey": "tasks",
    "material": "yes",
    "typedValue": "SemanticProposalV1[]"
  },
  {
    "cardinality": "list",
    "fieldKey": "use_cases",
    "material": "yes",
    "typedValue": "SemanticProposalV1[]"
  },
  {
    "cardinality": "object",
    "fieldKey": "target_user_candidates",
    "material": "no",
    "typedValue": "TargetUserResolutionV1"
  },
  {
    "cardinality": "object",
    "fieldKey": "installation",
    "material": "yes",
    "typedValue": "InstallationResolutionV1"
  },
  {
    "cardinality": "list",
    "fieldKey": "configuration",
    "material": "yes",
    "typedValue": "ConfigurationValueV1[]"
  },
  {
    "cardinality": "list",
    "fieldKey": "dependencies",
    "material": "yes",
    "typedValue": "DependencyValueV1[]"
  },
  {
    "cardinality": "list",
    "fieldKey": "external_services",
    "material": "yes",
    "typedValue": "ExternalServiceValueV1[]"
  },
  {
    "cardinality": "list",
    "fieldKey": "permissions",
    "material": "yes",
    "typedValue": "PermissionValueV1[]"
  },
  {
    "cardinality": "list",
    "fieldKey": "compatibility",
    "material": "yes",
    "typedValue": "CompatibilityValueV1[]"
  },
  {
    "cardinality": "list",
    "fieldKey": "limitations",
    "material": "yes",
    "typedValue": "LimitationValueV1[]"
  },
  {
    "cardinality": "object",
    "fieldKey": "maintenance_signals",
    "material": "no",
    "typedValue": "MaintenanceSignalsV1"
  }
]
```

<!-- M03_FIELD_REGISTRY_V1_END -->

The fingerprinted v1 deterministic-parser artifact is exhaustive; a path means exactly the candidate-root-relative
NFC path shown, with ASCII-case-sensitive matching:

```text
skillMetadata = {path: SKILL.md, YAML-front-matter mapping keys:
  [name:string, version:string, author:string|{name:string}, organization:string|{name:string},
   license:string, categories:string[], compatibility:string[], permissions:string[], deprecated:boolean]}
packageManifest = {path: package.json, JSON object pointers:
  [/name:string, /version:string, /license:string, /author:string|{name:string},
   /maintainers:(string|{name:string})[], /dependencies:record<string,string>,
   /optionalDependencies:record<string,string>, /devDependencies:record<string,string>,
   /engines:record<string,string>]}
pythonManifest = {path: pyproject.toml, TOML pointers:
  [project.name:string, project.version:string, project.license:string|{text:string}|{file:string},
   project.authors:{name:string}[], project.maintainers:{name:string}[], project.dependencies:string[],
   project.optional-dependencies:record<string,string[]>, project.requires-python:string]}
requirementsManifest = {path: requirements.txt, grammar: one PEP-508 direct requirement per nonblank,
  non-comment line; include/constraint/editable/URL lines are unsupported and make dependencies review-required}
skillDocs = {paths: [README.md, SKILL.md]}
changelog = {paths: [CHANGELOG.md, CHANGELOG.txt, CHANGES.md], select first present in listed order}
licenseFiles = {paths: [LICENSE, LICENSE.md, LICENSE.txt], select all present in listed order}
manifestLikeExtensions = [.json, .toml, .yaml, .yml]
markdownDeclarations = {
  configuration: "- `<NAME>` (`required`|`optional`, `<TYPE>`)[; default: `<VALUE>`]",
  permission: "Permission: <PERMISSION_KIND>[; scope: <TEXT>]",
  compatibility: "Compatibility: <SUBJECT_KIND>: <SUBJECT>[; constraint: <TEXT>]",
  service: "External service: <NAME>[; required|optional]",
  limitation: "Limitation: <TEXT>",
  attribution: "Creator: <NAME>" | "Organization: <NAME>" | "Attribution: <NAME>",
  deprecation: "Deprecated: true"
}

parserProfiles = {
  yaml: YAML 1.2.2 Core Schema, data-only mapping/sequence/scalar nodes,
        duplicate keys prohibited, aliases/tags/merge keys/interpolation prohibited,
  toml: TOML 1.0.0, duplicate keys/tables prohibited, interpolation prohibited,
  markdown: CommonMark 0.31.2 plus GFM 0.29 table extension only
}
```

No other filename, pointer, key, alias, coercion, or shape creates a deterministic manifest/Skill candidate.
Wrong-type recognized members make only their owning fields `REVIEW_REQUIRED`; unknown members are ignored.
YAML uses the 1.2.2 Core Schema without YAML 1.1 implicit booleans; only string, boolean, null, finite JSON-number,
sequence, and string-keyed mapping nodes may exist, and recognized members must still have the exact shapes above.
TOML uses the TOML 1.0.0 value model; datetime values are parsed as tagged TOML datetimes and therefore fail every
recognized string shape rather than being locale-converted. Both parsers reject duplicate keys before object
construction, perform no environment interpolation, object construction, code execution, or custom-type revival,
and serialize a resolved `DATA_POINTER` value only after conversion to its JSON-compatible string/boolean/null/
finite-number/array/object representation. An interpolation token is exactly the two consecutive decoded scalars
`${` anywhere in a YAML/TOML scalar string and invalidates the whole recognized document. Unknown members must
parse under the same profile before being ignored.

`SKILL.md` front matter uses this exact line state machine over frozen M01 lines. It exists only when line 1's
content excluding its LF/CRLF terminator is exactly `---`. The closing delimiter is the first later line whose
content is exactly `---`; `...`, indentation, trailing spaces, and bare-CR variants are not delimiters. The YAML
byte domain is everything after the opening line terminator through the byte before the closing line. With no
opener, no Skill metadata is parsed and the complete document is the Markdown body. With an opener and closer, the
Markdown body starts after the closing line terminator, or is empty when the closing line ends at EOF; this body
boundary remains the same even when YAML is invalid. With an opener and no closer, front matter is invalid and the
Markdown body is empty. README has no front-matter handling. These rules precede CommonMark parsing.

The only recognized YAML `DATA_POINTER` bytes are `/name`, `/version`, `/author`, `/author/name`, `/organization`,
`/organization/name`, `/license`, `/categories/<index>`, `/compatibility/<index>`, `/permissions/<index>`, and
`/deprecated`, where `<index>` is the canonical zero-based decimal array index. The only recognized TOML pointers
are `/project/name`, `/project/version`, `/project/license`, `/project/license/text`, `/project/license/file`,
`/project/authors/<index>/name`, `/project/maintainers/<index>/name`, `/project/dependencies/<index>`,
`/project/optional-dependencies/<rfc6901-escaped-key>/<index>`, and `/project/requires-python`. A constructor uses
the most specific pointer to the selected scalar; no dotted-key spelling, source order, or parser-native path is
serialized.
`UNRECOGNIZED_MANIFEST` applies exactly to a candidate-root file whose basename contains ASCII-case-insensitive
`manifest`, `package`, `requirements`, or `pyproject`, has a manifest-like extension, and is not an exact selector
above. JSON duplicate keys, YAML aliases/custom tags/merge keys, TOML duplicate keys, object construction,
environment interpolation, and executable extensions invalidate that recognized document without execution.

Whole-document invalidity uses first-match order and never silently becomes absence:

| Document                | First matching invalidity                                                                                           | Exact fields routed to `REVIEW_REQUIRED` with `DETERMINISTIC_DECLARATION_INVALID`                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `package.json`          | invalid UTF-8/JSON, duplicate object key, or non-object root                                                        | `canonical_skill_name`, `creator_candidates`, `organization_candidates`, `version`, `license`, `dependencies`, `compatibility`                                     |
| `SKILL.md` front matter | unclosed delimiters, invalid YAML/mapping root, alias, custom tag, merge key, duplicate key, or interpolation token | `canonical_skill_name`, `creator_candidates`, `organization_candidates`, `version`, `license`, `categories`, `permissions`, `compatibility`, `maintenance_signals` |
| `pyproject.toml`        | invalid TOML/table root, duplicate key, or interpolation token                                                      | `canonical_skill_name`, `creator_candidates`, `organization_candidates`, `version`, `license`, `dependencies`, `compatibility`                                     |
| `requirements.txt`      | any noncomment line outside the exact PEP-508 grammar                                                               | `dependencies`                                                                                                                                                     |

Invalid UTF-8 is normally already an M01 disposition case and follows Section 8 first. For acquired UTF-8 bytes,
the table above is exhaustive. Field-affinity warnings from Section 8 have precedence over parser invalidity; then
the first parser row applies. Markdown CommonMark body parsing is total; an unclosed command fence is the exact
installation empty-review branch rather than whole-document invalidity.

A license-signal string from any Skill/manifest/provider tier or an SPDX-prefixed license file follows one total
classifier: null (provider only) creates no candidate/warning; trimmed empty or ASCII-case-insensitive `NONE` or
`NOASSERTION` creates no candidate and routes license review with `UNSUPPORTED_LICENSE_IDENTIFIER`; a valid SPDX
2.3 expression using only the allowlist creates the SPDX candidate; invalid syntax or any unallowlisted identifier
creates no candidate and routes license review with that warning. A license file beginning at byte zero with one
ASCII line `SPDX-License-Identifier: <expression>` classifies the exact remainder; otherwise every nonempty license
file creates a CUSTOM candidate from exact whole-file SHA-256 and never infers SPDX from legal prose. An empty
license file routes review with the warning. `pyproject` license `{file}` must equal one exact listed license path
and resolves to that same candidate. A changelog current entry exists only when the selected changelog's
first non-title ATX heading is `## <SemVer>` or `## [<SemVer>]`; the captured value is the exact heading label and
becomes a CHANGELOG version candidate. No `Unreleased`, date, prose, or later heading is current.

Candidate construction is exhaustive. Package JSON members use `JSON_POINTER`; YAML-front-matter and TOML members
use their exact `DATA_POINTER`; Markdown declarations use their exact `LINE_RANGE`. Every table-created
candidate is `EXACT`, confidence `1.0`, with the indicated claim class except the explicitly inferential
installation-mechanism row; no undeclared default is supplied.

| Selector/member                                                  | Target and exact constructor                                                                                                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skill/package/Python `name`                                      | canonical name; exact string → `NameValueV1`; `SOURCE_FACT`                                                                                                                     |
| Skill/package/Python `version`                                   | version; exact string, `versionSource` respectively `SKILL_METADATA`/`MANIFEST_VERSION`; `SOURCE_FACT`                                                                          |
| author/maintainer/organization members or typed attribution line | exact attribution kind/basis/display; handle null unless exact object name begins `@`; `SOURCE_FACT`; untyped `Attribution:` creates no candidate and routes both fields review |
| license member / license file                                    | Section 13.3 license constructor; `SOURCE_FACT`                                                                                                                                 |
| Skill categories                                                 | one taxonomy candidate per string using empty registry binding; `SOURCE_FACT`                                                                                                   |
| Skill permission string / permission line                        | exact grammar `<PermissionKind>[; scope: <trimmed text>]`; `PermissionValueV1`, `EXPLICIT`, absence false; malformed value routes permissions review                            |
| Skill compatibility string / compatibility line                  | exact grammar `<SubjectKind>: <subject>[; constraint: <trimmed text>]`; `SOURCE_DECLARATION`, support `UNKNOWN`; malformed value routes compatibility review                    |
| package dependency records                                       | key/name plus exact constraint, ecosystem NPM, scopes required/optional/development; `DIRECT_DECLARATION`; `SOURCE_FACT`                                                        |
| Python dependency/optional-dependency/requirements members       | exact PEP-508 name/constraint, ecosystem PYPI, required or optional group scope; extras/markers remain in declared constraint; `DIRECT_DECLARATION`; `SOURCE_FACT`              |
| package engines / Python requires-python                         | runtime compatibility using key/`python`, exact constraint, `SOURCE_DECLARATION`, support `UNKNOWN`; `SOURCE_FACT`                                                              |
| explicit command-bearing installation path                       | complete `InstallationPathV1[EXPLICIT_COMMANDS]`; `SOURCE_FACT`, `EXACT`, confidence `1.0`                                                                                      |
| exact `Install with <mechanism>.` paragraph                      | complete `InstallationPathV1[INFERRED_MECHANISM]`; `FORMAT_INFERENCE`, `INFERENTIAL`, confidence `0.70`                                                                         |
| configuration declaration                                        | name/requiredness/TYPE exact; apply the precedence-ordered configuration sensitivity matrix below; suffix controls `defaultPresent` and retention                               |
| service declaration                                              | exact name, explicit basis, requiredness from optional suffix or `UNKNOWN`; `SOURCE_FACT`                                                                                       |
| limitation declaration                                           | exact nonempty text, `EXPLICIT_LIMITATION`, null AI proposal ID; `SOURCE_FACT`                                                                                                  |
| Skill `deprecated:true` or exact deprecation declaration         | `EXPLICIT_DEPRECATION=true`; false Skill member creates false candidate; absence uses Section 11.1 inventory-absence reference; `REPOSITORY_METADATA`                           |
| provider archived boolean / changelog presence/current entry     | corresponding `MaintenanceSignalCandidateV1`; booleans include false through Section 11.1 inventory/provider references; `REPOSITORY_METADATA`                                  |

Markdown declarations match one complete trimmed paragraph/list-item line byte-for-byte after stripping exactly
one list marker `- `; names/text are the captured nonempty substrings. They are recognized only in the owning
configuration heading for configuration, and anywhere in `README.md`/non-front-matter `SKILL.md` for all other
declarations. Duplicate semantic values reconcile normally; wrong grammar creates no candidate except a line with
an exact declaration prefix (`Permission:`, `Compatibility:`, etc.) routes only its target field to review with
`DETERMINISTIC_DECLARATION_INVALID`.

Constructor provenance is total: Skill front matter uses extractor/source `skill-metadata-v1/SKILL_METADATA`;
package and Python manifests use `package-json-v1` or `pyproject-v1` with `PACKAGE_MANIFEST`; requirements uses
`requirements-v1/DEPENDENCY_DECLARATION`; Markdown declarations and title use
`markdown-declarations-v1/MARKDOWN_TEXT`; explicit command paths use `command-v1/FENCED_COMMAND`; inferred
mechanism paths use `installation-mechanism-v1/MARKDOWN_TEXT`; changelog uses
`changelog-v1/CHANGELOG`; license files use `license-v1/LICENSE_TEXT`; provider facts use
`provider-metadata-v1/REPOSITORY_METADATA` or `LICENSE_METADATA`. Every exact constructor has support nature EXACT,
confidence 1.0, and claim class SOURCE_FACT except provider facts/maintenance use REPOSITORY_METADATA and explicit
documented permissions use SOURCE_FACT. Inferred installation mechanism is the sole `MARKDOWN_TEXT` deterministic
inference: its source reference is the exact paragraph `LINE_RANGE`, normalized key is the ordinary installation
`struct:` hash, warning array is empty absent a separately mandated warning, and it uses INFERENTIAL,
FORMAT_INFERENCE, 0.70. Static permission constructors alone otherwise are INFERENTIAL, STATIC_CODE_INDICATOR,
0.70. No other extractor/source/support/class/confidence combination is valid.

Inventory-absence false maintenance candidates use `inventory-absence-v1/INVENTORY_ABSENCE`, their exact
`InventoryAbsenceReferenceV1`, `REPOSITORY_METADATA`, EXACT, and 1.0. Repository-name fallback uses
`provider-metadata-v1/REPOSITORY_METADATA` plus `REPOSITORY_FIELD/name`; source-revision and snapshot-version
fallbacks use `source-revision-v1/SOURCE_REVISION_FALLBACK` plus exact `SNAPSHOT_FIELD/immutableRevision` and
`SNAPSHOT_FIELD/providerRepositoryId` references, SOURCE_FACT, EXACT, and 1.0. Observation/source-link IDs are bound
by the serialized value and `m02InputProjection`; they are not falsely represented as source references.

License locator construction is exact: Skill/package/pyproject scalar signals use their member pointer; provider
uses both declared LICENSE_FIELD references; an SPDX-prefixed license file uses `LINE_RANGE` line 1; a custom
license file uses `TREE_PATH` and its document content hash. `pyproject` `{file}` equal to an allowed path uses that
file's rule. An allowed path absent from a complete eligible inventory, or any other path value, emits
`DETERMINISTIC_DECLARATION_INVALID` and routes license review; an allowed but unavailable path follows the exact
Section 8 disposition warning. No file is opened outside the eligible inventory.

Documentation-title extraction is exactly the first nonempty ATX H1 in `README.md`; its Section 12.3
`headingSourceText`, Unicode-trimmed but otherwise literal, creates the name candidate at the documentation-title
precedence tier. No Setext or later H1 is a name candidate.

Installation path construction is exact. Each direct H3 child inside an installation-context H2 is one separately
labeled path; if there is no H3, the H2 context is one unlabeled path. Nested/later headings do not create paths.
The first raw paragraph beginning exactly `To install, ` before the first command is
`startConditionOrNull`. List items before the first command are ordered prerequisites. Section 12.3 fences provide
ordered commands. The first raw paragraph after the last command beginning exactly `After installation, ` or
`Verify: ` is `completionCueOrNull`. A context with commands constructs `EXPLICIT_COMMANDS` with null inferred
mechanism whether complete or incomplete. A context with no command and exactly one raw paragraph matching
`Install with <nonempty mechanism>.`, with no prerequisites or other nonheading content, constructs
`INFERRED_MECHANISM`; its inferred member is the captured nonempty mechanism. Any other commandless installation
context is structurally invalid, constructs no path, retains its exact context reference, emits
`DETERMINISTIC_DECLARATION_INVALID`, and participates in the invalid row below.

Before state selection, group constructed paths by the canonical discriminated key `{kind:UNLABELED}` when
`labelOrNull=null`, otherwise `{kind:LABELED,key:textKey(labelOrNull)}`. The enum discriminator is part of the key,
so authored text such as `<unlabeled>` cannot collide with null. Within a group, canonical path content excludes the path ordinal and every recursively nested
source-reference ID, and compares pathKind, label, start, inferred mechanism, prerequisites, commands including
their ordinal/language/text-state/text/hash/safety, and completion. Byte-equal content deduplicates to the first
authored path, unions the path references and corresponding command references position-by-position, and then all
retained paths are renumbered contiguously in authored-first order. Byte-distinct content in one group is contradictory and creates
`INSTALLATION_PATHS_DIVERGE`; no path is preferred. The following table is first-match and exhaustive after that
deduplication:

| Condition                                                         | Nested/outer result and exact retention                                                                                                                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| no installation context                                           | `MISSING`/outer `MISSING`, `paths:[]`                                                                                                                                           |
| contradictory same-label group                                    | `UNSAFE_OR_AMBIGUOUS`/outer `CONFLICTING`, `paths:[]`, exact conflict supports/references                                                                                       |
| retained path candidate has a `sensitiveReferenceEvent`           | `UNSAFE_OR_AMBIGUOUS`/outer `REVIEW_REQUIRED`; retain all safe typed paths/supports/evidence, derive review claim class, and add exact sensitive warnings                       |
| any structurally invalid context or unclosed command fence        | `UNSAFE_OR_AMBIGUOUS`/outer `REVIEW_REQUIRED`; retain every otherwise constructed safe/withheld path, or `[]`; `DETERMINISTIC_DECLARATION_INVALID` plus exact context reference |
| any path prose is suppressed by secret/contact policy             | `UNSAFE_OR_AMBIGUOUS`/outer `REVIEW_REQUIRED`; retain other paths plus locator-only sensitive reference and exact sensitive warning(s)                                          |
| any retained command has a nonempty safety-indicator array        | `UNSAFE_OR_AMBIGUOUS`/outer `REVIEW_REQUIRED`; retain every constructed safe/withheld typed path and all mandated safety warnings                                               |
| retained paths contain both path kinds                            | `UNSAFE_OR_AMBIGUOUS`/outer `REVIEW_REQUIRED`; retain all paths and emit `INSTALL_PATH_KINDS_MIXED`                                                                             |
| all paths are explicit and at least one lacks start or completion | `EXPLICIT_PARTIAL`/outer `REVIEW_REQUIRED`; retain all paths and issue `INSTALL_CONTEXT_INCOMPLETE` only for incomplete members plus field                                      |
| exactly one complete explicit path                                | `EXPLICIT_COMPLETE`/outer `EXPLICIT`; retain it                                                                                                                                 |
| at least two complete explicit paths, necessarily distinct labels | `MULTIPLE_PATHS`/outer `EXPLICIT`; retain all                                                                                                                                   |
| one or more inferred paths                                        | `INFERRED`/outer `INFERRED`; retain all                                                                                                                                         |

No other paragraph, list, heading, or fence creates installation structure.

### 12.3 Markdown and exact commands

Markdown block recognition is CommonMark 0.31.2 plus only the GFM 0.29 table extension, without rendering HTML,
resolving entities, resolving links, or interpreting inline nodes. Every comparison/captured deterministic string
uses raw source, never rendered inline text. For an ATX heading line, remove up to three leading ASCII spaces, the
one-to-six opening `#` bytes and all immediately following ASCII spaces/tabs. Trim trailing ASCII spaces/tabs; when
the remainder ends in a run of `#` bytes preceded by at least one ASCII space/tab, remove that preceding whitespace,
the hash run, and any already-trimmed trailing whitespace; then trim ASCII spaces/tabs again. The resulting raw
substring—including literal emphasis/code/link/entity punctuation—is `headingSourceText`; headings with an empty
result are not context/name candidates. `textKey(headingSourceText)` is the only heading comparison key. Setext
headings and headings inside block quotes never create M03 contexts.

Parser source positions are mapped without renderer offsets. README local line/byte positions are already absolute
frozen-M01 positions. For `SKILL.md` with no front matter, the same is true. With closed front matter,
`bodyStartLine = closingDelimiterAbsoluteLine + 1` and `bodyStartByte` is the first byte after the closing
delimiter's LF/CRLF terminator; body-local line `L` maps to absolute line `bodyStartLine + L - 1`, and body-local
zero-based byte offset `B` maps to absolute byte `bodyStartByte + B`. An EOF closing delimiter yields no body
nodes. All `LINE_RANGE` and command `BYTE_RANGE` locators use those mapped absolute coordinates against the original
M01 document, never a front-matter-stripped buffer.

For deterministic declarations/start/completion cues, `rawBlockText` exists only for a paragraph or list-item
opening line whose selected content occupies one physical source line after removing exactly one list marker `- `;
strip that line's LF/CRLF terminator and trim Unicode whitespace, but perform no inline parsing/entity decoding or
line joining. Multi-line paragraphs/list items cannot match deterministic declaration/start/completion grammars.
For candidate-independent operation inputs, select: every paragraph block not descended from a list item, table,
or block quote; every list-item block at every nesting depth outside block quotes using its complete CommonMark
source-position range; and every GFM header/body table row outside block quotes using its physical row range.
Delimiter rows, headings, fenced blocks, HTML blocks, and individual table cells are not selected. A selected range
is nonempty iff trimming Unicode whitespace from its exact decoded source range leaves content. Identical resulting
locators deduplicate to one reference ID; distinct or overlapping ranges remain distinct. Nodes order by absolute
start line, end line, block-kind ordinal `PARAGRAPH < LIST_ITEM < TABLE_ROW`, then reference ID. Nested list items
therefore remain explicit overlapping references, while duplicate parser views cannot duplicate a registry record.

Installation context exists only below an ATX H2 whose `textKey(headingSourceText)` is one of
`[install, installation, setup, getting started, prerequisites]`; configuration context similarly uses any ATX
heading whose key is `[configuration, configure, environment variables]`. Context ends at the next ATX heading of
equal or lower level. Duplicate same-key headings create separate contexts in source order; a selected node belongs
only to the nearest preceding open context. Direct H3 path labels use exact `headingSourceText` and the absolute
heading reference.
Only fenced blocks tagged exactly `sh`, `bash`, `zsh`, `shell`, or `console` inside installation context create
commands. A console line may remove exactly one leading `$ ` prompt; all other bytes are part of the command.

The fingerprinted command-boundary artifact first identifies the exact source `BYTE_RANGE`, then derives
`originalSubstringBytes` with its `EXACT_COMMAND_V1` transform. The range spans one nonblank/non-comment physical
line plus consecutive following lines while the prior line ends in an odd number of backslashes.
`sourceContentHash` hashes transformed bytes. `normalizedCommandText` decodes UTF-8 and changes only CRLF/bare CR to LF; it
retains continuation backslashes and LF. `commandTextOrNull`, when present, is exactly
`normalizedCommandText`. `safetyInputText` is derived from normalized text by replacing each backslash+LF
continuation with one ASCII space; it is never serialized. There is no separate display transform. Blank and
comment-only lines create no record. Unclosed fences, continuation at EOF, or a line beginning `>` are
context-incomplete and create no command.

Byte-level fence handling is exact. An accepted opening fence has `N` leading ASCII spaces where `N` is 0–3;
tabs before the fence are invalid. Opening/closing fence lines are never in a command range. Each nonblank content
line must begin with at least `N` ASCII spaces; remove exactly `N` from every spanned line. A tab or fewer spaces in
that prefix makes the installation context invalid/review-required. For `console`, remove exactly one `$ ` after
that indentation on the first physical line of each command; never remove it on continuation lines or other tags.
Blank/comment classification occurs after indent/prompt removal and newline normalization: blank is zero or more
ASCII spaces; comment-only is zero or more ASCII spaces followed by `#`. Grouping then starts at each remaining
line, and continuation is determined by an odd count of trailing backslashes immediately before its physical line
terminator. A one-line command follows the same algorithm. The `BYTE_RANGE` spans the pre-transform indentation,
prompt, continuations, and original CR/LF bytes for exactly that grouped command. Mixed-indent, single-line,
console, comment, CRLF, bare-CR, and continuation golden byte pairs are mandatory.

Physical-line grouping has two states. In `IDLE`, a transformed blank/comment line is skipped; any other line starts
a command and moves to `CONTINUING` iff it ends with an odd trailing-backslash count, otherwise emits immediately.
In `CONTINUING`, the very next physical line is never skipped: if its transformed form is blank or comment-only,
the whole installation context is invalid and yields the empty review arm; otherwise append it and remain
`CONTINUING` iff its trailing count is odd, else emit and return `IDLE`. Closing-fence/EOF while continuing is the
same invalid branch. Thus continuation never jumps across a blank/comment line.

The ordered command-safety artifact uses the Section 12.6 regex engine over `safetyInputText` and emits every
matching indicator in enum order:

```text
commandSafetyRules = [
  {indicator: CREDENTIAL_LITERAL, predicate: any secretSignatureRule matches},
  {indicator: PERSONAL_CONTACT_LITERAL, predicate: any contactSignatureRule matches},
  {indicator: NETWORK_DOWNLOAD, pattern: "(^|[;&|]\\s*)(curl|wget)\\s+|\\b(fetch|Invoke-WebRequest)\\s+"},
  {indicator: PIPE_TO_INTERPRETER, pattern: "\\|\\s*(sh|bash|zsh|python|python3|node|ruby|perl)\\b"},
  {indicator: PRIVILEGE_ESCALATION, pattern: "(^|[;&|]\\s*)(sudo|doas|su)\\b"},
  {indicator: DESTRUCTIVE_OPERATION, pattern: "(^|[;&|]\\s*)(rm\\s+(-[^\\n]*r[^\\n]*f|-rf|-fr)\\b|mkfs\\b|dd\\s+[^\\n]*\\bof=|git\\s+reset\\s+--hard\\b)"},
  {indicator: VARIABLE_INTERPOLATION, pattern: "(\\$[A-Za-z_][A-Za-z0-9_]*|\\$\\{|`|\\$\\()"},
  {indicator: UNKNOWN, predicate: finite tokenizer rejects}
]
```

The finite tokenizer scans Unicode scalars left-to-right in states `NORMAL`, `SINGLE_QUOTE`, `DOUBLE_QUOTE`,
`ESCAPED_FROM_NORMAL`, and `ESCAPED_FROM_DOUBLE`. Backslash from NORMAL/DOUBLE enters the matching escaped state for
exactly one scalar and then returns to NORMAL/DOUBLE respectively; backslash is ordinary inside `SINGLE_QUOTE`.
ASCII `'`/`"` enter/leave their matching quote state. In `NORMAL`, the only recognized operators are longest-match
`&&`, `||`, `>>`, `<<`, then `;`, `|`, `<`, `>`; every other scalar is an ordinary word scalar. EOF in
`SINGLE_QUOTE`, `DOUBLE_QUOTE`, either escaped state, NUL, or an isolated `&` makes the tokenizer reject and emits
`UNKNOWN`. No expansion, token execution, or shell dialect interpretation occurs.

An indicator is present iff its row matches; overlaps retain all indicators. Any nonempty indicator array makes the
path `UNSAFE_OR_AMBIGUOUS`, emits `INSTALL_COMMAND_UNSAFE`, and routes installation to `REVIEW_REQUIRED`.
`CREDENTIAL_LITERAL` additionally withholds text. Boundary, continuation, overlap, exact-match, and one-character
near-miss fixtures are required for every row.

No command is executed, corrected, completed, joined across non-contiguous blocks, interpolated, or invented.
HTML/script blocks remain inert text. For ordinary commands, `commandTextState = PRESENT` and the bundle preserves
the exact Section 12.3 normalized command text plus its original-substring content hash. If a deterministic secret-pattern check finds a credential/token/
private-key-like literal, the exact bytes remain in the existing restricted immutable M01 source object and may
otherwise exist only under the closed transient preimage-buffer exception in Section 12.6. M03 records the locator and source hash,
sets `commandTextState = WITHHELD_SECRET_LIKE`, stores null command text,
emits `SECRET_LIKE_COMMAND_WITHHELD` and `INSTALL_COMMAND_UNSAFE`, and makes the field `REVIEW_REQUIRED`. The literal
must not enter the bundle excerpt, provider AI input, logs, diagnostics, persisted fixture expectations, or an M04 EvidenceItem. This withholding
is the sole exception to duplication of exact command text and preserves exact source provenance without copying a
possible secret.

### 12.4 Dependencies and configuration

Only directly declared dependencies and settings are extracted. Dependency records distinguish package, runtime,
system binary, plugin/extension, external service, and unknown kinds; required/optional/dev scope; exact declared
constraint; normalized ecosystem/name; and source reference. No registry lookup or transitive resolution occurs.
When a manifest indicates incomplete resolution, emit `DEPENDENCY_INCOMPLETE`.

Configuration records identify the exact documented key/name, requiredness (`REQUIRED`, `OPTIONAL`, `UNKNOWN`),
value kind, secret sensitivity, default-presence boolean, and source reference. Secret values are never retained.

### 12.5 Static permission indicators

M03 v1 source-code inspection is limited to inert text in:

- TypeScript/JavaScript: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`;
- Python: `.py`;
- POSIX-family shell: `.sh`, `.bash`, `.zsh`; and
- declarative manifests/configuration already recognized by Sections 12.2 and 12.4.

Inspection uses bounded lexical/static patterns only. It does not parse through a compiler, import modules,
resolve symbols, follow generated code, or claim reachability. Other source languages emit
`UNSUPPORTED_STATIC_LANGUAGE` under the exact Section 8 path rule and cannot support an absence claim.

Permission kinds are closed in v1:

```text
FILESYSTEM_READ
FILESYSTEM_WRITE
SHELL_EXECUTION
PROCESS_CONTROL
NETWORK_ACCESS
ENVIRONMENT_READ
SECRET_ACCESS
DATABASE_ACCESS
BROWSER_CONTROL
EXTERNAL_SERVICE_ACCESS
UNKNOWN
```

Each permission has evidence level `EXPLICIT`, `CODE_INDICATED`, `INFERRED`, or `UNKNOWN`. Documentation silence,
absence of a matched pattern, or an unsupported language never means a permission is absent. Static indicators
are not a security audit and must carry `PERMISSION_NOT_PROVEN_ABSENT` where an absence interpretation is possible.

### 12.6 Embedded policy artifacts

The Section 12.6 portion of the canonical policy artifact is:

```text
regexEngine = {name: ECMAScript, edition: 2024, inputNormalization: NFC, unicodeMode: true,
               singleMatchFlags: iu, staticScanFlags: giu}
staticRuleDefaults = {
  supportNature: INFERENTIAL,
  claimClass: STATIC_CODE_INDICATOR,
  evidenceLevel: CODE_INDICATED,
  confidence: 0.70,
  warningCodes: [PERMISSION_NOT_PROVEN_ABSENT]
}

spdxAllowedIdentifiers = [
  0BSD, Apache-2.0, BSD-2-Clause, BSD-3-Clause, CC0-1.0,
  GPL-2.0-only, GPL-3.0-only, ISC, LGPL-2.1-only, LGPL-3.0-only,
  MIT, MPL-2.0, Unlicense
]
spdxAllowedExceptions = []

releaseChannelRules = [
  {prereleaseFirstIdentifier: null, channel: STABLE},
  {identifiers: [a, alpha], channel: ALPHA},
  {identifiers: [b, beta], channel: BETA},
  {identifiers: [rc, release-candidate], channel: RELEASE_CANDIDATE},
  {identifiers: [exp, experimental], channel: EXPERIMENTAL},
  {identifiers: [deprecated], channel: DEPRECATED},
  {identifiers: [archived], channel: ARCHIVED},
  {otherwise: UNKNOWN}
]

secretSignatureRules = [
  {id: ASSIGNMENT, pattern: "\\b(api[_-]?key|access[_-]?token|auth[_-]?token|password|passwd|secret|private[_-]?key)\\b\\s*[:=]\\s*[^\\s]+"},
  {id: PRIVATE_KEY, pattern: "-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----"},
  {id: GITHUB_TOKEN, pattern: "\\bgh[pousr]_[A-Za-z0-9]{20,}\\b"},
  {id: PROVIDER_KEY, pattern: "\\bsk-[A-Za-z0-9_-]{20,}\\b"},
  {id: JWT, pattern: "\\beyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\b"}
]

contactSignatureRules = [
  {id: EMAIL, pattern: "(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\\.[A-Za-z]{2,63}(?![A-Za-z0-9.-])"},
  {id: PHONE, pattern: "(?<![0-9])(?:\\+[0-9]{1,3}[ .-]?)?(?:\\(?[0-9]{2,4}\\)?[ .-]?){2,4}[0-9]{3,4}(?![0-9])"}
]

sensitiveLocatorPolicy = {
  scanMembers: [NORMALIZED_PATH, RAW_RFC6901_POINTER, EACH_DECODED_RFC6901_TOKEN],
  replacementType: SENSITIVE_LOCATOR,
  fingerprintDomain: CANONICAL_COMPLETE_ORDINARY_LOCATOR,
  excerptState: NULL,
  operationInputState: OMITTED_SENSITIVE,
  citable: false
}

staticPermissionRules = [
  {kind: FILESYSTEM_READ, languages: [TS_JS], pattern: "\\b(fs\\.(promises\\.)?(readFile|readFileSync)|Deno\\.read(Text)?File)\\s*\\("},
  {kind: FILESYSTEM_READ, languages: [PYTHON], pattern: "\\b(Path\\([^)]*\\)\\.read_(text|bytes)|open\\s*\\([^,\\n]+,\\s*[\"']r[b+t]?[\"'])"},
  {kind: FILESYSTEM_READ, languages: [SHELL], pattern: "(^|[;&|]\\s*)(cat|head|tail)\\s+"},
  {kind: FILESYSTEM_WRITE, languages: [TS_JS], pattern: "\\b(fs\\.(promises\\.)?(writeFile|writeFileSync|unlink|rename|mkdir)|Deno\\.(write(Text)?File|remove|rename|mkdir))\\s*\\("},
  {kind: FILESYSTEM_WRITE, languages: [PYTHON], pattern: "\\b(Path\\([^)]*\\)\\.write_(text|bytes)|open\\s*\\([^,\\n]+,\\s*[\"'][wax][b+t]?[\"'])"},
  {kind: SHELL_EXECUTION, languages: [TS_JS], pattern: "\\bchild_process\\.(exec|execFile|spawn)\\s*\\("},
  {kind: SHELL_EXECUTION, languages: [PYTHON], pattern: "\\b(subprocess\\.(run|Popen)|os\\.system)\\s*\\("},
  {kind: PROCESS_CONTROL, languages: [TS_JS], pattern: "\\bprocess\\.kill\\s*\\("},
  {kind: PROCESS_CONTROL, languages: [PYTHON], pattern: "\\bos\\.(kill|killpg)\\s*\\("},
  {kind: NETWORK_ACCESS, languages: [TS_JS], pattern: "\\b(fetch|axios\\.(get|post|put|delete)|https?\\.request)\\s*\\("},
  {kind: NETWORK_ACCESS, languages: [PYTHON], pattern: "\\b(requests\\.(get|post|put|delete)|urllib\\.request\\.urlopen)\\s*\\("},
  {kind: ENVIRONMENT_READ, languages: [TS_JS], pattern: "\\bprocess\\.env(?:\\b|\\[|\\.)"},
  {kind: ENVIRONMENT_READ, languages: [PYTHON], pattern: "\\bos\\.(environ|getenv)\\b"},
  {kind: SECRET_ACCESS, languages: [TS_JS], pattern: "\\bprocess\\.env.{0,80}(key|token|password|secret)\\b"},
  {kind: SECRET_ACCESS, languages: [PYTHON], pattern: "\\bos\\.(environ|getenv).{0,80}(key|token|password|secret)\\b"},
  {kind: DATABASE_ACCESS, languages: [TS_JS], pattern: "\\b(pg|PrismaClient|Sequelize|better-sqlite3)\\b"},
  {kind: DATABASE_ACCESS, languages: [PYTHON], pattern: "\\b(psycopg|sqlite3|sqlalchemy)\\b"},
  {kind: BROWSER_CONTROL, languages: [TS_JS, PYTHON], pattern: "\\b(playwright|puppeteer|selenium)\\b"},
  {kind: EXTERNAL_SERVICE_ACCESS, languages: [TS_JS, PYTHON], pattern: "\\b(OpenAI|Anthropic|Stripe|WebClient|discord)\\b"}
]

prohibitedClaimRules = [
  {id: VERIFIED, pattern: "\\b(verified|independently verified)\\b"},
  {id: GUARANTEE, pattern: "\\b(guaranteed|guarantees)\\b"},
  {id: PRODUCTION_READY, pattern: "\\bproduction[- ]ready\\b"},
  {id: SECURITY_ASSURANCE, pattern: "\\b(proven secure|completely safe|security audited)\\b"},
  {id: SUPERLATIVE, pattern: "\\b(best[- ]in[- ]class|unmatched|unbeatable)\\b"}
]
```

`TS_JS`, `PYTHON`, and `SHELL` map exactly to the extension groups in Section 12.5. A rule is evaluated only for its
listed language; every match creates one permission candidate using `staticRuleDefaults`, the matched span's exact
source reference, and the rule kind. The listed qualified receivers are mandatory: unqualified member names such
as `window.open`, `RegExp.exec`, user-defined `open`, and user-defined `kill` do not match. No-match remains no
absence claim.

Static scanning uses the frozen M01 LF-only line sequence, including its empty terminal line. For each line remove
the terminating LF and an immediately preceding CR, retain every other bare CR, then NFC-normalize that one line as
regex input; `^` and `$` mean the start/end of this per-line string. For each rule in displayed order, construct a
fresh ECMAScript `RegExp` with exactly `giu`, set `lastIndex=0`, and repeatedly call `exec`; ECMAScript's native
UTF-16-code-unit `lastIndex` and global nonoverlap behavior are authoritative. All patterns must consume at least
one code unit, so no manual cursor advance exists. Matches do not overlap within one rule; overlaps across different
rules are retained. Each match maps back to and cites the complete original frozen-M01 line with one exact
`LINE_RANGE`; normalized match offsets are never serialized. Distinct matches that
construct equal permission semantic values reconcile normally while their provenance candidates remain. No regex
sees another line, and no implicit global/multiline/dotAll/sticky flag or implementation default is permitted.

Sensitive-literal evaluation occurs before any source-derived string, excerpt, default, or command enters an M03
record or provider AI input. Apply `secretSignatureRules` and `contactSignatureRules`, each in displayed order with
single-match flags `iu`, independently to the complete decoded would-be retained string; never scan only a clipped
or normalized substring. The two booleans `secretMatch` and `contactMatch` drive these exhaustive routes:

- for any noncommand/nonconfiguration source-display or semantic value—including names, attribution, taxonomy
  labels, versions/release labels, inferred installation mechanism/label/start/prerequisite/completion text,
  dependency text, service text, compatibility text, limitation text, and maintenance changelog text—either match
  suppresses the entire candidate/value before construction, retains only its locator/hash reference with null
  excerpt, and routes the owning field to exact empty `REVIEW_REQUIRED`; `secretMatch` emits
  `SECRET_LIKE_VALUE_WITHHELD`, `contactMatch` emits `PERSONAL_CONTACT_WITHHELD`, and both warnings remain when both
  match. Fixed enums, booleans, timestamps, IDs, hashes, parser names, and policy constants are not source-derived
  strings and are not scanned;
- installation path prose follows the preceding route before path construction. Any matched label/start/mechanism/
  prerequisite/completion suppresses that path, retains the locator-only reference, and makes installation
  `UNSAFE_OR_AMBIGUOUS`/outer `REVIEW_REQUIRED`; other safe/withheld paths remain under the total table;
- configuration follows the exact first-match Cartesian table below;
- a command retains locator/original-substring hash. `secretMatch` has text-state precedence and uses
  `WITHHELD_SECRET_LIKE` plus `SECRET_LIKE_COMMAND_WITHHELD`; otherwise `contactMatch` uses
  `WITHHELD_PERSONAL_CONTACT`. A contact match adds `PERSONAL_CONTACT_WITHHELD` once to the retained path candidate
  and once to installation; either match adds its mandated candidate/field safety warnings and routes installation
  review;
- a would-be source excerpt has null excerpt/hash and is excluded from `citableAIReferenceIds` when either match is
  present; and
- any exact raw AI response bytes or decoded AI string/value matching either policy is
  `SEMANTIC_OR_POLICY` invalid output, is not repairable, and creates no proposal. It is retained only under the
  transient collision-buffer exception below.

The captured `<TYPE>` is trimmed/NFC and mapped by its `textKey` through this closed table: `string → STRING`,
`number → NUMBER`, `boolean → BOOLEAN`, `path → PATH`, `url → URL`, `enum → ENUM`, `secret → SECRET`,
`object → OBJECT`, `array → ARRAY`, and `unknown → UNKNOWN`. No alias (`bool`, `int`, `uri`, or otherwise) is
accepted. Any other key creates no candidate and routes configuration to exact empty `REVIEW_REQUIRED` with
`DETERMINISTIC_DECLARATION_INVALID`. Independently scan the complete decoded name and present default with both
sensitive classifiers. Let `typeClass` be `KNOWN`, `UNKNOWN` for the exact mapped `unknown`, or `INVALID`; let
`nameSecret`, `nameContact`, `defaultSecret`, and `defaultContact` be the four match booleans. Warning selection is
an exact set equation before enum ordering:

```text
configurationWarnings =
  {DETERMINISTIC_DECLARATION_INVALID iff typeClass=INVALID} ∪
  {SECRET_LIKE_VALUE_WITHHELD iff nameSecret} ∪
  {PERSONAL_CONTACT_WITHHELD iff nameContact or defaultContact} ∪
  {CONFIGURATION_TYPE_UNKNOWN iff typeClass=UNKNOWN and not nameSecret and not nameContact} ∪
  {SENSITIVE_CONFIGURATION_DEFAULT_WITHHELD iff defaultPresent and
     (defaultSecret or defaultContact or
      (typeClass!=INVALID and declaredBaseline!=NON_SECRET))}
```

`declaredBaseline` is defined only for non-invalid types: `SECRET` for `valueKind=SECRET`, `POSSIBLY_SECRET` when
name `textKey` contains `key`, `token`, `password`, or `secret`, `UNKNOWN` for `valueKind=UNKNOWN`, and
`NON_SECRET` otherwise. When a candidate exists, final sensitivity is `SECRET` if baseline is SECRET or
`defaultSecret`; else `POSSIBLY_SECRET` if baseline is POSSIBLY_SECRET or `defaultContact`; else `UNKNOWN` if the
baseline is UNKNOWN; else `NON_SECRET`. Default presence remains serialized even when the value is withheld.

The following configuration table is first-match and exhaustive; “matching warnings” means exactly the equation
above, with each code once on the field and on the candidate only when that code's warning-policy owner permits and
a candidate exists:

| Condition                                         | Candidate/value                                                                               | Field result                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `nameSecret or nameContact`                       | none; retain name/default locator/hash references only                                        | exact empty `REVIEW_REQUIRED`/`NO_CLAIM` plus matching warnings           |
| safe name and `typeClass=INVALID`                 | none; default never retained; retain locator/hash references                                  | exact empty `REVIEW_REQUIRED`/`NO_CLAIM` plus matching warnings           |
| safe name and `typeClass=UNKNOWN`                 | retain candidate; present default always null; final sensitivity follows precedence above     | deterministic configuration review value plus matching warnings           |
| safe name, `typeClass=KNOWN`, default withheld    | retain candidate with `defaultPresent=true`, null default, and final sensitivity              | deterministic configuration review value plus matching warnings           |
| safe name, `typeClass=KNOWN`, no withheld default | retain candidate; absent default is null, present `NON_SECRET` default is exact source string | normal deterministic reconciliation; no configuration sensitivity warning |

Thus invalid TYPE plus a contact default emits `DETERMINISTIC_DECLARATION_INVALID`,
`PERSONAL_CONTACT_WITHHELD`, and `SENSITIVE_CONFIGURATION_DEFAULT_WITHHELD`, creates no candidate, and retains only
privacy-safe source references/hashes. Invalid TYPE plus a secret-only default emits the invalid/sensitive pair. A name match has
candidate-suppression precedence but does not suppress independently triggered type/default field warnings.

Thus `TYPE SECRET` plus a contact default remains `SECRET`, a neutral name plus a credential-pattern default
becomes `SECRET`, a neutral name plus only a contact default becomes `POSSIBLY_SECRET`, and `TYPE UNKNOWN` without
a stronger match remains `UNKNOWN`. Fixtures cover every accepted/rejected type token and every declared-baseline
× secret-match × contact-match × default-presence combination plus contact-bearing names.

Exact secret/contact-bearing source bytes remain only in restricted immutable M01 source except for the minimum
transient M03 validation/collision-buffer exception below. They never enter candidates, field values, excerpts, provider AI
input, diagnostics, logs, persisted fixture expectations, persistent storage, or M04 payloads. Synthetic reserved
contact/credential examples may exist only inside restricted M01-source test inputs needed to exercise the
classifiers; contacts must use `example.com` addresses or North American `555-01xx` fictional numbers, and
credential strings must be documented inert placeholders, never real personal data or secrets. The ordinary
nonsensitive locator or `SENSITIVE_LOCATOR` plus existing document/substring hash is the only serialized M03 provenance. Near-miss fixtures
cover package-like strings, version numbers, and short digit sequences that must not match.

The exception is closed: the orchestrator may hold exact acquired preimages already read from M01 and exact raw AI
response bytes in its access-restricted in-memory validation/collision stores solely for the byte-equality checks
required by Sections 11.1, 11.5, and 16, expressly including complete ordinary-locator preimages and
locator/source-reference collision checks. Those buffers are not domain records, cannot be queried by provider adapters or
observability, never cross the process boundary, and expose only hashes/safe codes to callers. Sensitive scanning and
rejection occurs before candidate/proposal construction. References to each buffer are discarded with the
process-lifetime result store and no bytes are copied to persistence, crash reports, traces, metrics, logs, or test
snapshots. M03 makes no unverifiable physical-memory-zeroization claim.

SPDX expressions may use only the allowed identifiers with `AND`, `OR`, and parentheses; `WITH` is invalid because
the exception artifact is empty. Release matching applies `textKey` only to the first SemVer prerelease identifier.
Secret matches withhold excerpts/commands/defaults; permission matches create only static indicators; prohibited
claim matches invalidate AI output. Any table change requires a new policy version/fingerprint and changes input
identity. Exact positive, negative, overlap, Unicode, boundary, and one-character-near-miss fixtures are mandatory.

<!-- M03_POLICY_ARTIFACT_V1_END -->

## 13. Field-specific resolution rules

### 13.1 Canonical Skill name and attribution

Name precedence is exact Skill front-matter name, package display/name metadata, explicit top-level documentation
title, then repository name. A lower source may fill only when every higher tier is absent. Conflicting values at
the highest populated tier produce `CONFLICTING`; normalization-equivalent spelling may select an exact display
candidate while preserving variants.

Creator and organization values remain candidates, not verified identities. Explicit author/maintainer fields and
source declarations remain distinguishable. Frozen M01 metadata retains a provider owner string but not whether the
owner is a person or organization; that string therefore populates neither field by itself and emits
`ATTRIBUTION_TYPE_UNPROVEN` plus `PREDECESSOR_METADATA_INSUFFICIENT`. A future predecessor that provides a proven
owner type may use `PROVIDER_OWNER` basis under a new compatible input-policy version. Sponsorship, distribution,
repository membership, commit authorship, or package publishing alone must not be represented as creator ownership.

### 13.2 Version

Version candidate precedence, when the cited predecessor data can prove that the candidate applies to the current
observation, is:

1. release or tag metadata whose target is exactly the source revision;
2. recognized candidate-root manifest version;
3. exact `SKILL.md` metadata version;
4. candidate-root changelog version explicitly marked current;
5. deterministic source-revision fallback.

All candidates are retained. M01 v1 release/tag strings lack target revisions, so they are never provable tier 1
inputs in M03 v1 and carry `PREDECESSOR_METADATA_INSUFFICIENT`; this does not change the future-compatible
precedence. Multiple normalization-distinct values in the highest populated provable tier produce `CONFLICTING`
with no canonical version. No candidate is serialized as preferred guidance; M04 may bind the conflict while later draft/editorial progression is
blocked until an approved human workflow resolves it.

The fallback value is `snapshot-<first 12 lowercase source-revision hex characters>`, source
`AI_ARK_SNAPSHOT`, normalized version null, and release channel `UNKNOWN`. It is freshly derived by M03 and is not
the M02 internal observation label `snapshot:<sha12>`. Release channels are
`ALPHA`, `BETA`, `RELEASE_CANDIDATE`, `STABLE`, `EXPERIMENTAL`, `DEPRECATED`, `ARCHIVED`, or `UNKNOWN`; inference
from arbitrary version text is prohibited except exact recognized suffixes under the version policy.

### 13.3 License

License states are exactly:

```text
CONFIRMED
CONFLICTING
MISSING
CUSTOM
AMBIGUOUS
REVIEW_REQUIRED
```

License candidates and precedence are exact:

1. exact recognized license text;
2. recognized candidate-root manifest license fields; and
3. frozen M01 `licenseSignals.spdxId` provider metadata.

A provider signal uses the same exhaustive Section 12.2 license-signal classifier. Its valid allowlisted arm creates
one `LICENSE_METADATA` candidate with `{spdxExpressionOrNull: spdxId, customTextHashOrNull: null}`; source
references are exactly `LICENSE_FIELD/spdxId` and `LICENSE_FIELD/source`, normalized key follows Section 11.2, and
confidence is `1.0`. Every invalid/sentinel arm routes license to exact empty `REVIEW_REQUIRED`; otherwise valid
candidates remain bundle-level only. Null alone creates no candidate/warning. The
`source` value alone is provenance, not a license assertion. Identical normalized SPDX values across tiers collapse
with unioned references. Distinct values
in any populated tiers produce `LICENSE_METADATA_TEXT_DISAGREE`, outer `CONFLICTING`, and preserve every candidate;
no candidate is serialized as preferred guidance.

Missing license text, manifest fields, and provider SPDX metadata yields `MISSING`, never an implied default. A
non-standard license text is `CUSTOM` with no invented SPDX ID. Multiple-license expressions are preserved only
when an exact SPDX expression is present; legal interpretation and public-use rights remain out of scope.

### 13.4 Installation

Installation statuses are exactly:

```text
EXPLICIT_COMPLETE
EXPLICIT_PARTIAL
MULTIPLE_PATHS
INFERRED
MISSING
UNSAFE_OR_AMBIGUOUS
```

Each path retains ordered exact commands, prerequisites, surrounding context references, and unsafe indicators.
`ExactCommandV1.sourceContentHash`, locator, `commandTextOrNull`, and safety input follow only the four exact
Section 12.3 transforms. It is not the containing M01 document hash. `WITHHELD_SECRET_LIKE` requires null text while
retaining the original-substring-byte hash; `WITHHELD_PERSONAL_CONTACT` does the same under contact policy.
`EXPLICIT_COMPLETE` requires an explicit start condition, all ordered steps, and an explicit completion/use cue.
`EXPLICIT_PARTIAL` retains one or more coherent command-bearing paths and at least one lacks the exact start or
completion condition. Multiple materially different paths are never merged.
`INFERRED` may identify a likely mechanism but must not invent a command. Shell metacharacters, downloads piped to
interpreters, privilege escalation, destructive operations, credential literals, or unclear interpolation mark
the path `UNSAFE_OR_AMBIGUOUS`; the bytes remain inert and are not executed.

### 13.5 Compatibility

Compatibility evidence classes are exactly:

```text
AI_ARK_TEST
SOURCE_DECLARATION
CREATOR_DECLARATION
COMMUNITY_REPORT
FORMAT_INFERENCE
UNKNOWN
```

M03 cannot create `AI_ARK_TEST`; no controlled runtime testing exists in this milestone. Repository and manifest
text may produce `SOURCE_DECLARATION`; a statement explicitly attributable to a creator remains
`CREATOR_DECLARATION`. Format recognition may produce only `FORMAT_INFERENCE`, never functional compatibility.
Community reports are not acquired by M01 and therefore cannot be newly created by M03. Unknown remains explicit.

### 13.6 Categories, capabilities, Tasks, outcomes, users, and use cases

AI may normalize only source-grounded proposals. Controlled taxonomy matches retain taxonomy IDs and mapping
version. An unmatched but supported concept becomes `TAXONOMY_CANDIDATE`, never an invented canonical taxonomy
node. Each proposal is concise, non-promotional, contains no verification/superlative claim, and cites at least one
local source reference. Empty support yields `MISSING` or `REVIEW_REQUIRED`, not generic filler.

`BEST_FOR` proposals target only `target_user_candidates.bestFor`; `TARGET_USER` proposals target only
`target_user_candidates.targetUsers`. `NOT_IDEAL_FOR` proposals are represented twice from one proposal identity:
the exact proposal appears in `target_user_candidates.notIdealFor`, and a typed `LimitationValueV1` with kind
`NOT_IDEAL_FOR` references the same proposal/source references in `limitations`. This cross-field projection is
deterministic, does not create a second AI claim, and must be byte-consistent. Any other `targetFieldKey` for these
proposal kinds fails output validation.

The projection above occurs only at confidence `>= 0.60`. Below `0.60`, neither asserted value is selected; both
`target_user_candidates` and `limitations` apply the deterministic-preservation precedence in Section 11.5 and
carry `LOW_CONFIDENCE`; only a target lacking deterministic truth becomes empty `REVIEW_REQUIRED`. The one proposal
remains bundle-level evidence only. `BEST_FOR` and `TARGET_USER` below the threshold affect only
`target_user_candidates` under the same precedence.

### 13.7 Limitations and maintenance

Explicit limitations are preserved. AI may synthesize a limitation only from cited constraints or conflicts.
No known limitation in the eligible corpus is not proof of no limitation; the empty list carries
`NO_KNOWN_LIMITATION_NOT_PROVEN`. Maintenance signals report the exact provider archived state, changelog
presence/current entry, and explicit deprecation markers. Provider last-update and matching release/tag dates are
null with `PREDECESSOR_METADATA_INSUFFICIENT` under frozen M01 v1. Null does not mean no update/release. No signal is
interpreted as quality or abandonment.

## 14. AI-assisted normalization boundary

### 14.1 Allowed operations

The only M03 analysis operation is `NORMALIZE_STRUCTURED_EXTRACTION`, with sub-operation values:

```text
NORMALIZE_CAPABILITIES
MAP_TASKS
SYNTHESIZE_OUTCOME
PROPOSE_USE_CASES
PROPOSE_TARGET_USERS
SYNTHESIZE_BEST_FOR_NOT_IDEAL
SYNTHESIZE_LIMITATIONS
INFER_PERMISSIONS_FROM_STATIC_EVIDENCE
DETECT_AMBIGUITY
```

AI must not extract exact versions, licenses, commands, dependencies, source revisions, creator identities, or
organization identities when deterministic candidates exist. It cannot browse, call GitHub, access databases,
read files, execute tools, approve, publish, contact services, or issue commands.

### 14.2 Provider neutrality and required gates

Production provider selection remains unresolved and outside M03. Contracts record provider, model, operation,
prompt bundle, output contract, deterministic settings, input/output fingerprints, token counts if available,
duration, status, and error code. Required automated gates use a deterministic offline fake only and require no
credential or network access.

### 14.3 Bounded analysis bundle

The planned field set is derived exactly from the ordered sub-operation plan:

| Sub-operation                            | Candidate/conflict field membership                                 |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `NORMALIZE_CAPABILITIES`                 | `capabilities`                                                      |
| `MAP_TASKS`                              | `tasks`                                                             |
| `SYNTHESIZE_OUTCOME`                     | `outcome_candidate`                                                 |
| `PROPOSE_USE_CASES`                      | `use_cases`                                                         |
| `PROPOSE_TARGET_USERS`                   | `target_user_candidates`                                            |
| `SYNTHESIZE_BEST_FOR_NOT_IDEAL`          | `target_user_candidates`, `limitations`                             |
| `SYNTHESIZE_LIMITATIONS`                 | `limitations`                                                       |
| `INFER_PERMISSIONS_FROM_STATIC_EVIDENCE` | `permissions`                                                       |
| `DETECT_AMBIGUITY`                       | the union of fields owned by every other operation in the same plan |

`operationInputs` contains exactly nine entries in plan order. Each entry serializes the complete candidates and
conflicts for its table row plus the canonical source-reference allowlist reachable from those members and the
operation-specific documentation selectors below; nothing else is selected and no partition is sampled or
truncated. `DETECT_AMBIGUITY` receives the complete union defined by its
row. The single provider envelope exposes the partitions, but output validation authorizes each proposal and each
referenced candidate/conflict ID only against its named partition and each source ID only against that partition's
`citableAIReferenceIds`. Cross-partition use is
invalid output, except `DETECT_AMBIGUITY.interpretedProposalOrdinals`, which may reference field proposals whose
target field belongs to its declared union and whose source references are in that union partition. Thus isolation
is representable as data/validation authority even though one combined provider call
can physically see the complete envelope. The exact nine partitions are fingerprinted as `operationInputs`.

Operation-specific documentation inputs are candidate-independent `LINE_RANGE` references to each exact nonempty
Section 12.3 paragraph/list-item/table-row selection under the listed ATX headings in eligible `README.md` and the
exact `SKILL.md` Markdown body. Heading comparison uses `textKey(headingSourceText)`; context ends at the next
equal/lower heading. Absolute line mapping, overlap/deduplication, and raw inline behavior are exactly Section 12.3. References sort by
candidate-owned before shared, path, start line, end line, then ID.

| Operation                                | Exact heading keys                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `NORMALIZE_CAPABILITIES`                 | `capabilities`, `features`, `what it does`                                   |
| `MAP_TASKS`                              | `tasks`, `workflow`, `what it does`                                          |
| `SYNTHESIZE_OUTCOME`                     | `overview`, `summary`, `purpose`                                             |
| `PROPOSE_USE_CASES`                      | `use cases`, `examples`                                                      |
| `PROPOSE_TARGET_USERS`                   | `target users`, `audience`, `who is this for`                                |
| `SYNTHESIZE_BEST_FOR_NOT_IDEAL`          | `best for`, `not ideal for`, `limitations`                                   |
| `SYNTHESIZE_LIMITATIONS`                 | `limitations`, `known issues`, `not ideal for`                               |
| `INFER_PERMISSIONS_FROM_STATIC_EVIDENCE` | no documentation-only additions; exact permission candidates/references only |
| `DETECT_AMBIGUITY`                       | canonical union of every preceding operation's complete reference allowlist  |

Absence of deterministic candidates does not remove these references. A source proposal may cite only a reference
in its operation's `citableAIReferenceIds`. Candidate-free documentation fixtures prove every semantic operation.

For secret/contact-sensitive candidate-independent documentation, evaluate each reference occurrence before bounding.
Its affected-field set is the canonical field-registry-order union of the candidate/conflict field-membership row
for every non-`DETECT_AMBIGUITY` partition in which the reference occurs. `DETECT_AMBIGUITY` contributes no new
field and observes that already computed union. The unique reference remains in `allReferenceIds` with
`OMITTED_SENSITIVE`, has null excerpt/hash, and is absent from `citableAIReferenceIds`. After deduplicating all
reference/partition occurrences, each affected field emits `SECRET_LIKE_VALUE_WITHHELD` exactly once iff the
secret classifier matched and `PERSONAL_CONTACT_WITHHELD` exactly once iff the contact classifier matched. A pre-AI field in
`EXPLICIT`, `STRONGLY_SUPPORTED`, `INFERRED`, or `CONFLICTING` preserves its exact
status/value/support/evidence/conflicts and claim class with only the warning added. Every other affected pre-AI
status becomes its exact empty `REVIEW_REQUIRED`/`NO_CLAIM` arm. The sensitive reference is not added to evidence for
a preserved deterministic value. This operation-to-field rule has precedence over the generic source-display
no-candidate route in Section 12.6 and leaves no discretionary “owning field.”

Each partition is exactly `OperationInputV1` from Section 11.5 and distinguishes `allReferenceIds` from
`citableAIReferenceIds`. The latter is exactly: (a) a reference
reachable from a serialized nonsensitive candidate/conflict value actually supplied in that partition, even when a
metadata/TREE_PATH reference has null excerpt, but never a `SENSITIVE_LOCATOR`; plus (b) a candidate-independent document reference whose
`excerptOrNull` is non-null and whose excerpt is actually supplied. Withheld/secret candidate values and every
omitted, bounded-out, invalid, or null-excerpt candidate-independent reference are not citable. Output validation
rejects any proposal reference outside `citableAIReferenceIds`; `allReferenceIds` exists only for deterministic
completeness/audit and grants no provider citation authority.

Each operation partition contains structured deterministic candidates plus at most 64 source excerpts, each at most 2,000
Unicode scalar values and at most 64,000 total scalar values across the complete envelope. Excerpts are selected
deterministically by the minimum owning field's Section 10 registry ordinal, candidate-owned before shared,
canonical path, locator canonical bytes, then source-reference ID. Secret-like
values, credential-bearing lines, binary encodings, raw HTML/script bodies, and commands beyond the exact bounded
context needed for classification are omitted and replaced only by safe typed indicators.

Source content is wrapped as untrusted data. The trusted prompt says source instructions must not be followed,
tools are unavailable, uncertainty/conflicts are mandatory, and evidence references must come from the supplied
allowlist. Provider/model text is never accepted as a repository or system instruction.

### 14.4 Output validation and bounded repair

Validation order is JSON parse, exact schema, closed enums, size/count bounds, field/sub-operation authorization,
confidence range, claim-class consistency, allowlisted source-reference ownership, locator existence, prohibited
claim scan, and deterministic-conflict preservation.

One repair call is permitted only for syntactic/schema-shape defects, using the same immutable input and a repair
prompt that contains no new source content. It creates a separate attributed analysis attempt. Semantic defects,
invented references, forbidden claims, tool requests, hidden conflicts, or a second invalid response are not
repairable: reject the proposal, emit `AI_OUTPUT_REJECTED`, and route affected fields to
`REVIEW_REQUIRED` under the exact affected-field rule below. A rejected AI response never erases valid
deterministic results. An unrecovered response-wide analysis error affects the exact complete enabled-plan field
union above. A field already resolved as deterministic `EXPLICIT` or `CONFLICTING`
retains that result; every other affected field uses its exact empty `REVIEW_REQUIRED` arm. This applies to material
and nonmaterial AI-owned fields alike.

When the primary response is syntactically/schema-shape invalid and the single repair succeeds, the primary
remains `INVALID_OUTPUT`, the ordinal-1 repair attempt is `SUCCEEDED`, and only the repair's validated
proposals participate in normal field reconciliation. Recovery is the derived pair predicate
`attempts[0].status = INVALID_OUTPUT && attempts[0].invalidityClass = SYNTACTIC_OR_SCHEMA_SHAPE &&
attempts[1].status = SUCCEEDED`; it is not serialized into either immutable
attempt and cannot affect their IDs. The bundle emits `AI_OUTPUT_REPAIRED` but does not route a field or aggregate
to review merely because the recovered primary is retained. If the repair is invalid, times out, fails, or cannot
be made, that pair predicate is false; the retained analysis error is unrecovered and the exact affected-field rule
above applies. No attempt record is mutated after either invocation.

## 15. StructuredExtractionBundleV1

```text
{
  schemaVersion,
  extractionId,
  requestFingerprint,
  inputFingerprint,
  outputFingerprint,
  m02: {
    handoffMarkerId,
    controllingM02JobId,
    identityDecisionId,
    m02ReviewStateId,
    resourceCandidateId,
    resourceIdentityId,
    resourceVersionIdentityId,
    resourceVersionObservationId,
    resourceSourceLinkId,
    sourceRepositoryId,
    candidateRootId,
    sourceSnapshotId,
    sourceRevision,
    candidateContentFingerprint,
    firstObservedSourceSnapshotId,
    firstObservedSourceRevision
  },
  expectedPredecessorState,
  policyVersions,
  analysisConfiguration,
  analysisConfigurationFingerprint,
  analysisResultFingerprint,
  sourceInventoryFingerprint,
  sourceReferences,
  extractorRefs,
  deterministicCandidates,
  conflicts,
  analysisAttempts,
  aiProposals,
  fields,
  aggregateStatus,
  m04Bindability: BINDABLE,
  laterProgressionBlockers,
  warningCodes,
  createdAt
}
```

`bundle.sourceReferences` is exactly the unique canonical-ID-sorted union `R_support ∪ R_routing ∪ R_operation ∪
R_ai`, where:

- `R_support` is every reference ID recursively reachable from every serialized deterministic candidate, conflict
  member, field value, field `evidenceIds`, and M03-created source-revision support;
- `R_routing` is every locator-only or metadata/absence reference that an exact Section 8, 10.6, 11.4, 12, or 13
  warning/review constructor explicitly retains when it creates no candidate, including invalid declarations,
  untyped/secret-or-contact-withheld values, privacy-safe sensitive locators, and exact empty installation/maintenance routes that name a reference;
- `R_operation` is every ID in every `OperationInputV1.allReferenceIds`, including candidate-independent,
  bounded-out, invalid, and sensitive locator-only references; and
- `R_ai` is every reference reachable from every retained final AI proposal or ambiguity signal.

Each ID resolves to exactly one complete `ExtractionSourceReferenceV1` record; same-ID/different-bytes is
`CONTENT_DERIVED_ID_COLLISION`. No record outside the union may appear, and every ID in the union must appear, so
extras, dangling IDs, duplicate records, and omitted records invalidate the bundle. Conflict, proposal, field, and
operation arrays may repeat an ID as a reference, but the registry record appears once. Source-reference count
limits, registry ordering, `outputFingerprint`, and fixture equality all use this exact union after
secret/contact-sensitive value, excerpt, and locator withholding and before bundle serialization.

Fingerprint formulas are exact:

`bundle.analysisConfiguration` is the byte-exact Section 7.1 request projection containing mode, adapter/provider,
model, deterministic settings, and complete plan. Its recomputed fingerprint must equal both
`bundle.analysisConfigurationFingerprint` and every retained attempt's `analysisConfigurationFingerprint`.
Provider/model/setting/plan attribution is therefore serialized, identity-bound, replayed, and collision-checked;
no fingerprint stands in for an unavailable projection.

```text
sourceInventoryPreimage = canonical {
  sourceSnapshotId,
  resourceVersionObservationId,
  resourceSourceLinkId,
  providerMetadataCanonicalPayload,
  documents: canonical-sort [{sourceEntryId, sourceDocumentId, ownership, normalizedPath,
                              exactContent: ByteStringV1}]
}
sourceInventoryFingerprint = SHA-256(sourceInventoryPreimage)

inputFingerprint = SHA-256(canonical {
  schemaVersion,
  m02InputProjection,
  expectedPredecessorState,
  candidateRootCanonicalPayload,
  candidateContentExactOwnedBytes,
  sourceInventoryPreimage,
  policyArtifactsCanonicalPayloads,
  analysisConfigurationCanonicalPayload
})

analysisResultFingerprint = SHA-256(canonical {
  analysisConfigurationFingerprint,
  validatedProposalPayloads: canonical-sort complete AIProposalV1 identity payloads,
  logicalAttemptPayloads: canonical-sort complete AnalysisAttemptV1 identity payloads
})

extractionId = "ext_" + SHA-256(canonical {
  schemaVersion,
  resourceVersionIdentityId,
  resourceVersionObservationId,
  inputFingerprint,
  analysisResultFingerprint
})

outputFingerprint = SHA-256(canonical bundle excluding exactly
  {outputFingerprint, createdAt, analysisAttempts[*].durationMsOrNull,
   analysisAttempts[*].tokenCountsOrNull, analysisAttempts[*].providerRequestIdOrNull})
```

`ByteStringV1` is the JSON object `{byteLength:nonnegativeInteger, base64:string}` where `base64` is canonical RFC
4648 Base64 with the standard alphabet, required `=` padding, no whitespace, and decode length exactly
`byteLength`; re-encoding decoded bytes must reproduce the member byte-for-byte. Every otherwise-raw byte member in
an input/preimage uses `ByteStringV1`. `candidateContentExactOwnedBytes` is the canonical-sort array
`[{normalizedPath,ownership,content:ByteStringV1}]`. `policyArtifactsCanonicalPayloads` has exactly these four
members in this order and no others:

1. `{artifactName:M03_POLICY_LITERAL, artifactVersion:m03-policy-artifact-v1, content}` where content is the exact
   marker-delimited bytes and its SHA-256 is `48efb226368bf9ed5cdae77ca629c2cab93dbd08250b6a12d88a2a4e08ecaaa9`;
2. `{artifactName:FIELD_REGISTRY, artifactVersion:m03-fields-v1, content}` where content is the 2,124-byte
   `JSON.stringify`/RFC-8785-equivalent canonical JSON of the exact nested marker block, SHA-256
   `6cadc39a636f11df3443593dc1b224dc1a4e6941c9f5926166ba29ae42e39dd4`;
3. `{artifactName:TAXONOMY_REGISTRY, artifactVersion:m03-taxonomy-empty-v1, content}` where content is exactly the
   two bytes `[]` and SHA-256 `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`;
4. `{artifactName:EXTRACTOR_REGISTRY, artifactVersion:m03-extractors-v1, content}` where content is canonical JSON
   of the complete Section 11.0 registry in extractor canonical order.

Each `content` is `ByteStringV1`; and each canonical predecessor/provider/configuration
payload is a `ByteStringV1` of its canonical JSON bytes. Ordering uses the declared canonical path or registry
order, never hash order.

Frozen M02 fingerprint fields, including original-job `m02Job.inputFingerprint`, are explicitly opaque scalar
predecessor facts: M03 neither reconstructs nor claims collision resistance for unavailable preimages. Instead,
`m02InputProjection` embeds the complete exact M03-required row/set projections declared below independently, and the M03 parent preimage
includes both those row bytes and the opaque fingerprint strings, so an opaque collision alone cannot collapse
distinct current M03 input. Replacement-job payload bytes are included only when frozen M02 already retains them;
original-job payload remains absent exactly as M02 requires. All M03-created nested hashes require preimage
comparison. `candidateRootCanonicalPayload`, the canonical ordered owned content bytes, every complete policy
artifact's canonical bytes, `providerMetadataCanonicalPayload`, every acquired document's exact bounded bytes, and
`analysisConfigurationCanonicalPayload` are retained in the authorized in-memory collision store beside their
individual hashes and are embedded as bytes, not nested hashes, in the input preimage. The orchestrator retains all
of those preimages for process lifetime. Before any parent hash, derived ID, tuple lookup, concurrent join, or
replay accepts equality, every nested preimage and parent preimage must compare byte-for-byte. A mismatch returns
`FAILED/INPUT_FINGERPRINT_COLLISION`, never joins, never replays, and performs no AI call or output mutation. Test
adapters may inject collisions at every nested and parent hash layer only to prove this fail-closed branch. This
check precedes content-derived-ID collision checks, which remain separate and occur after a unique input preimage
is established. Exact source/provider/configuration preimages never enter the bundle, diagnostics, or logs.
This collision store is the same closed transient exception defined in Section 12.6; secret/contact-bearing source bytes
may be present only as already-read M01 preimages required for equality and receive the same access, lifecycle, and
zero-observability guarantees.

`m02InputProjection` is exactly:

```text
{
  handoff: {id, resourceCandidateId, resourceIdentityId, resourceVersionIdentityId,
    controllingM02JobId, sourceSnapshotId, identityDecisionId, originType, logicalKey, state, recordVersion},
  acquisitionJob: {id, status, currentStage, sourceSnapshotId, cancellationRequested, recordVersion},
  m02Job: {id, jobLineageId, sourceSnapshotId, operationScope, currentStage, reviewState,
    supersessionState, supersededByJobIdOrNull, supersessionSequence, controllingClassificationDecisionIdOrNull,
    jobScopeKey, inputFingerprint, classificationPolicyVersion, identityPolicyVersion, analysisPolicyVersion,
    parserProfileVersion, promptBundleVersion, analysisProviderAdapterIdOrNull, analysisModelIdOrNull,
    analysisMethodologyVersionOrNull, recordVersion,
    replacement:
      {kind: ORIGINAL, reasonCodeOrNull:null, inputPayloadOrNull:null, inputFingerprintOrNull:null,
       sourceJobIdOrNull:null, sourceOperationScopeOrNull:null, requestedOperationScopeOrNull:null,
       predecessorJobIds:[], originalSourceSnapshotIdOrNull:null, replacementSourceSnapshotIdOrNull:null} |
      {kind: REPLACEMENT, reasonCode, inputPayloadOrNull:ByteStringV1, inputFingerprintOrNull:lowercaseHex[64],
       sourceJobIdOrNull, sourceOperationScopeOrNull, requestedOperationScopeOrNull,
       predecessorJobIds:unique canonical-sort string[], originalSourceSnapshotIdOrNull,
       replacementSourceSnapshotIdOrNull}},
  candidate: {id, sourceSnapshotId, candidateRootId, candidateRootFingerprint,
    candidateContentFingerprint, reconciledClassificationRunId, classificationPolicyVersion,
    identityPolicyVersion, identityOutcome, status, resourceIdentityId, resourceVersionIdentityId, recordVersion},
  resourceIdentity: {id, resourceType, status, reliableIdentityTokenOrNull,
    reliableTokenEvidenceIdOrNull, guardAnchorCandidateId, recordVersion},
  resourceVersionIdentity: {id, resourceIdentityId, contentFingerprint,
    firstObservedSourceSnapshotId, firstObservedCandidateRootId, firstObservedSourceRevision,
    observationLabel, status, recordVersion},
  observation: {id, resourceVersionIdentityId, sourceSnapshotId, candidateRootId,
    resourceSourceLinkId, sourceRepositoryId, provider, providerRepositoryId,
    normalizedRootPath, immutableRevision, observedAt},
  sourceLink: {id, sourceRepositoryId, normalizedRootPath, targetResourceVersionId,
    relationship, decisionId, state, recordVersion},
  sourceRepository: {id, provider, providerRepositoryId, firstObservedSourceSnapshotId, recordVersion},
  identityDecision: {id, resourceCandidateId, outcome, matchedTierOrNull, confidenceOrNull,
    identityPolicyVersion, decisionSource, state, recordVersion},
  candidateReviewState: {id, groupIdOrNull, resourceCandidateId, reviewState,
    supersededByReviewIdOrNull, recordVersion},
  candidateRoot: {id, groupId, classificationRunId, sourceSnapshotId, normalizedRootPath,
    candidateRootFingerprint, candidateContentFingerprint, state, recordVersion}
}
```

The replacement discriminator is `ORIGINAL` iff every frozen replacement column is null/empty and `REPLACEMENT`
otherwise; its members map one-to-one to the frozen columns and preserve their nullability. No phrase such as
“complete tuple” or “validated payload” adds hidden fields: the projections above and exact type
definitions are the entire byte domains. `AnalysisAttemptV1 identity payload` excludes only provider request ID,
token counts, and duration; it includes invocation/attempt IDs, ordinal, purpose, configuration/input fingerprints,
status, output fingerprint/null, safe error/null, and `invalidityClass` for invalid attempts. `AIProposalV1 identity
payload` is the complete proposal including its derived IDs and excludes no field.

`createdAt` is metadata and cannot change logical identity. M03 v1 authorizes only the deterministic fake adapter;
identical request/configuration bytes replay the original result and do not call the adapter again. There is no
same-input reanalysis command, sequence, supersession, or second effective result in M03 v1. Reanalysis requires a
changed versioned configuration/policy, which changes `inputFingerprint`, or a future approved specification
amendment with persistence/concurrency authority. Fresh required-fixture runs therefore reproduce the same
extraction ID and output fingerprint. A production provider or nondeterministic same-input retry is outside scope.
Different parser, taxonomy, prompt, adapter, provider, model, methodology, deterministic setting, source bytes,
observation, or M02 controller changes input identity. Every lookup by a derived ID also compares the canonical
identity bytes defined by that ID's formula (using the same explicit metadata exclusions); byte-distinct identity
equality under the same ID is `CONTENT_DERIVED_ID_COLLISION`.

Bundle array order is exact: source references by ID; extractor refs by ID; deterministic candidates by Section 11.2 order; conflicts by
field-registry ordinal/reason/candidate IDs/conflict ID; analysis attempts by ordinal; AI proposals by
`(targetFieldRegistryOrdinal, subOperationEnumOrdinal, kindOrdinal FIELD_PROPOSAL before AMBIGUITY_SIGNAL,
canonical final proposal payload bytes excluding id/proposalFingerprint, id)`; fields in the exact Section 10
registry order; and warnings in the Section 11.4 enum order. This comparator applies to permission and every other
proposal without assuming a `normalizedValue` member. Set-like nested values use Section 10.5 ordering.

### 15.1 Aggregate status

Closed bundle aggregate values:

```text
COMPLETED
COMPLETED_WITH_CONFLICTS
COMPLETED_REVIEW_REQUIRED
UNSUPPORTED
```

Every bundle has `m04Bindability = BINDABLE`. Bindability requires all 20 field schemas, reference ownership,
fingerprints, limits, exact source revision, no secret echo, and a still-active current observation/handoff at the
final guard. It does not require fields to be conflict-free. Aggregate selection is the following exhaustive
first-match table:

| Predicate over the 20 fields                                                                           | Aggregate                   |
| ------------------------------------------------------------------------------------------------------ | --------------------------- |
| at least one yes-material field is `UNSUPPORTED`, including the attribution-group composite rule below | `UNSUPPORTED`               |
| otherwise, at least one field is `REVIEW_REQUIRED`                                                     | `COMPLETED_REVIEW_REQUIRED` |
| otherwise, at least one field is `CONFLICTING`                                                         | `COMPLETED_WITH_CONFLICTS`  |
| otherwise                                                                                              | `COMPLETED`                 |

There is no separate “M03-wide unsupported condition” in v1. `MISSING` and a nonmaterial-only `UNSUPPORTED` field
therefore produce `COMPLETED` when no earlier row matches; the exact field statuses and progression blockers still
preserve those facts. This table is total for all combinations and defines precedence without an implicit fifth
state.

`laterProgressionBlockers` is the canonical list of exactly every yes-material field whose status is `MISSING`,
`CONFLICTING`, `UNSUPPORTED`, or `REVIEW_REQUIRED`, projected as `{blockerKey: fieldKey, status}`. Attribution uses
one composite rule: `ATTRIBUTION_GROUP` is blocked when both creator and organization are missing/unsupported, or
when either is conflicting/review-required; one positive explicit/supported/inferred side satisfies the group when
the other is merely missing/unsupported. The composite blocker is `{blockerKey: ATTRIBUTION_GROUP, status}` using
precedence `REVIEW_REQUIRED > CONFLICTING > UNSUPPORTED > MISSING`. Field blockers follow registry order and the
composite attribution blocker occupies the creator-field position. The list may be nonempty for aggregate
`COMPLETED` solely because truthful `MISSING` does not make extraction incomplete. It is empty only when every
material predicate has positive support. M03 has no command to clear or override it.

M04 MUST be able to bind every valid bundle, including conflicts, missing values, unsupported values, and review
states, into its later approved Claim/Evidence/Conflict structures. Material missing, conflicting, unsupported, and
review-required values block M05+/editorial/publication progression after M04; they do not block M04 itself.
`BINDABLE` is not M04 completion, editorial readiness, approval, or publication authority.

### 15.2 ExtractionAttemptResultV1

```text
ExtractionCommandResultV1 =
  {kind: INVALID_REQUEST, rawRequestDigest, errorCode: REQUEST_SCHEMA_INVALID,
   safeContext: {phase: REQUEST_VALIDATION}} |
  ExtractionAttemptResultV1

ExtractionAttemptResultV1 =
  {kind: BUNDLE, requestFingerprint, extractionId, bundle} |
  {kind: REJECTED, requestFingerprint, errorCode: EligibilityErrorV1, safeContext: SafeContextV1} |
  {kind: FAILED, requestFingerprint, errorCode: ProcessingErrorV1, diagnostic} |
  {kind: CANCELLED, requestFingerprint, errorCode: CANCELLED, diagnostic} |
  {kind: SUPERSEDED_INPUT, requestFingerprint, errorCode: SUPERSEDED_INPUT, diagnostic}

ExtractionDiagnosticV1 = {
  lastCompletedStageOrNull: null | ELIGIBILITY | INVENTORY | DETERMINISTIC | ANALYSIS | MERGE | FINAL_GUARD,
  sourceInventoryFingerprintOrNull,
  deterministicCandidateCount: nonnegativeInteger,
  sourceReferenceCount: nonnegativeInteger,
  conflictCount: nonnegativeInteger,
  retainedAnalysisAttempts: AnalysisAttemptV1[0..2],
  warningCodes: unique enum-order WarningCode[],
  observedCounts: ObservedCountsV1,
  safeContext: SafeContextV1
}

SafeContextV1 = {
  phase: REQUEST_VALIDATION | ELIGIBILITY | INVENTORY | DETERMINISTIC | ANALYSIS | MERGE | FINAL_GUARD,
  requestId,
  handoffMarkerIdOrNull,
  resourceCandidateIdOrNull,
  resourceVersionObservationIdOrNull,
  fieldKeyOrNull: FieldKey | null,
  recordKindOrNull: ACQUISITION_JOB | M02_JOB | HANDOFF | CANDIDATE | RESOURCE_IDENTITY |
                    RESOURCE_VERSION_IDENTITY | OBSERVATION | SOURCE_LINK | SOURCE_REPOSITORY |
                    IDENTITY_DECISION | REVIEW_STATE | REVIEW_STATE_SET | CANDIDATE_ROOT |
                    SNAPSHOT | ACQUISITION_RESULT | OWNERSHIP_TOPOLOGY | PROVIDER_METADATA |
                    FIELD | LIMIT,
  expectedVersionOrNull: positiveBigInt | null,
  actualVersionOrNull: positiveBigInt | null,
  expectedFingerprintOrNull: lowercaseHex[64] | null,
  actualFingerprintOrNull: lowercaseHex[64] | null,
  limitNameOrNull: SOURCE_REFERENCES | EXTRACTOR_REFERENCES | DETERMINISTIC_CANDIDATES | CONFLICTS |
                   WARNING_REFERENCES | FIELD_RESULTS | LIST_ITEMS | EXACT_COMMANDS |
                   EXACT_COMMAND_CHARACTERS | AI_PROPOSAL_CHARACTERS | AI_PROPOSALS |
                   AI_CALLS | AI_INPUT_EXCERPTS | AI_INPUT_CHARACTERS |
                   VALUE_SCHEMA_BOUND | null,
  limitOrNull: nonnegativeInteger | null,
  observedOrNull: nonnegativeInteger | null
}
```

For `kind: BUNDLE`, outer `requestFingerprint` must byte-equal `bundle.requestFingerprint` and outer
`extractionId` must byte-equal `bundle.extractionId`; mismatch is `FIELD_SCHEMA_INVALID` before return. Every final
proposal's `analysisAttemptId` must equal the `id` of the unique retained `AnalysisAttemptV1` that produced it. No
terminal envelope duplicates a value without this equality invariant.

Only `BUNDLE` contains fields, extraction ID, output fingerprint, or an M04-bindable payload. Diagnostics contain
counts, hashes, closed statuses, and attributed analysis attempts but no field values, excerpts, command text, or
AI output. `REJECTED` is used only for schema-valid eligibility/idempotency failure before accepted work and has no diagnostic.
`FAILED` is used for deterministic/parser/schema/reference/collision/limit failure. Cancellation or supersession at
any boundary discards a provisional bundle and returns the matching terminal union arm. AI-only failure is not
terminal when deterministic output remains structurally valid: retain its attempt and return a
`COMPLETED_REVIEW_REQUIRED` bundle with affected fields routed to review.

`lastCompletedStageOrNull` is null when cancellation/supersession occurs before eligibility completes. The
inventory fingerprint is null exactly when inventory did not complete. Counts describe completed safe records only;
they do not authorize returning their values. `SafeContextV1` has exactly the listed keys, uses null for inapplicable
fields, and contains no source text, command, excerpt, person/contact value, prompt, or provider/model output.

## 16. Orchestration, idempotency, cancellation, and stale work

The implementation is a bounded orchestrator over pure deterministic parsers and an analysis port. V1 permits at
most one effective extraction attempt per
`(resourceVersionIdentityId, resourceVersionObservationId, inputFingerprint)`.

- identical idempotent replay returns the originally stored complete union arm byte-for-byte, including its
  original `createdAt`, provider request ID, token, and duration metadata; it never refreshes those values;
- idempotency-key reuse with different request fingerprint fails;
- concurrent identical work has one controller and may join/replay its result;
- a new M02 controlling handoff or changed source/policy/prompt/model/configuration creates a new input/extraction
  identity and leaves prior output immutable; same-input reanalysis is prohibited;
- cancellation is checked before/after an AI call and before final return/persistence by a later owner;
- a handoff superseded during work yields `SUPERSEDED_INPUT`; and
- partial deterministic candidates are represented only as safe counts/hashes in diagnostics; attributed failed
  analysis attempts may appear in diagnostics or a valid review-required bundle under Section 15.2.

Every accepted idempotency key retains its terminal union arm in the orchestrator's authorized in-memory result
store for the process lifetime. `REJECTED` results caused by invalid/missing eligibility are replayable for the same
request fingerprint but do not reserve the effective-attempt tuple; a fresh key may validate again, and any changed
expected predecessor/configuration bytes create a new request/input fingerprint. Once work passes eligibility, its
tuple is permanently reserved for the process lifetime regardless of terminal arm. `BUNDLE`, `FAILED`, `CANCELLED`,
and `SUPERSEDED_INPUT` therefore replay the original complete arm across every later key with that same tuple; a new
key alone never executes same-input work. Retry execution requires a changed predecessor/source/policy/analysis
configuration that changes `inputFingerprint` and therefore creates a new tuple. Concurrent identical callers join
the same attempt; different request fingerprints do not join unless their computed effective tuple is already
reserved, in which case they replay that tuple's result.

No durable job table, queue, or migration is authorized by M03. If later implementation requires persistence,
that is a specification amendment and separate migration authorization, unless an already approved later
milestone explicitly owns it.

## 17. Error contract

Closed v1 errors:

```text
REQUEST_SCHEMA_INVALID
M02_HANDOFF_NOT_FOUND
M02_HANDOFF_NOT_ACTIVE
M02_JOB_NOT_CONTROLLING
M02_CANDIDATE_NOT_RESOLVED
M02_REVIEW_ACTIVE
M02_IDENTITY_TUPLE_INVALID
M02_OBSERVATION_NOT_FOUND
M02_OBSERVATION_TUPLE_INVALID
M02_SOURCE_LINK_NOT_ACTIVE
M02_IDENTITY_DECISION_NOT_CONTROLLING
SOURCE_SNAPSHOT_MISMATCH
SOURCE_REVISION_MISMATCH
SOURCE_CORPUS_INVALID
EXPECTED_VERSION_SET_INVALID
STALE_RECORD_VERSION
IDEMPOTENCY_KEY_REUSED
INPUT_FINGERPRINT_COLLISION
CONTENT_DERIVED_ID_COLLISION
SOURCE_REFERENCE_INVALID
FIELD_SCHEMA_INVALID
FIELD_REGISTRY_INCOMPLETE
DETERMINISTIC_PARSER_FAILED
DETERMINISTIC_LIMIT_EXCEEDED
ANALYSIS_CALL_PLAN_INVALID
ANALYSIS_LIMIT_EXCEEDED
ANALYSIS_TIMED_OUT
ANALYSIS_OUTPUT_INVALID
ANALYSIS_FAILED
CANCELLED
SUPERSEDED_INPUT
```

Arm membership is exact:

```text
PreDomainErrorV1 = REQUEST_SCHEMA_INVALID

EligibilityErrorV1 =
  M02_HANDOFF_NOT_FOUND | M02_HANDOFF_NOT_ACTIVE | M02_JOB_NOT_CONTROLLING |
  M02_CANDIDATE_NOT_RESOLVED | M02_REVIEW_ACTIVE | M02_IDENTITY_TUPLE_INVALID |
  M02_OBSERVATION_NOT_FOUND | M02_OBSERVATION_TUPLE_INVALID |
  M02_SOURCE_LINK_NOT_ACTIVE | M02_IDENTITY_DECISION_NOT_CONTROLLING |
  SOURCE_SNAPSHOT_MISMATCH | SOURCE_REVISION_MISMATCH | SOURCE_CORPUS_INVALID |
  EXPECTED_VERSION_SET_INVALID | STALE_RECORD_VERSION | IDEMPOTENCY_KEY_REUSED

ProcessingErrorV1 =
  INPUT_FINGERPRINT_COLLISION | CONTENT_DERIVED_ID_COLLISION |
  SOURCE_REFERENCE_INVALID | FIELD_SCHEMA_INVALID | FIELD_REGISTRY_INCOMPLETE |
  DETERMINISTIC_PARSER_FAILED | DETERMINISTIC_LIMIT_EXCEEDED | ANALYSIS_CALL_PLAN_INVALID

AnalysisErrorV1 =
  ANALYSIS_LIMIT_EXCEEDED | ANALYSIS_TIMED_OUT | ANALYSIS_OUTPUT_INVALID | ANALYSIS_FAILED

TerminalControlErrorV1 = CANCELLED | SUPERSEDED_INPUT
```

Analysis errors occur only in the matching `AnalysisAttemptV1` status arm. A primary `INVALID_OUTPUT` immediately
followed by the single `SUCCEEDED` repair is retained evidence but is not a terminal analysis outcome. Every other
unrecovered analysis error
leads to a bindable `COMPLETED_REVIEW_REQUIRED` bundle when deterministic output is valid. Analysis errors cannot
appear in `REJECTED` or `FAILED`. `ANALYSIS_CALL_PLAN_INVALID` is instead an internal deterministic orchestration
contract failure: it occurs before the prohibited invocation, has no matching attempt, and appears only in
`FAILED`.
`CANCELLED` and `SUPERSEDED_INPUT` occur only in their identically named extraction-result arms. No error belongs to
more than one subset. `PreDomainErrorV1` occurs only in `INVALID_REQUEST`, before a request fingerprint exists; it
is never an eligibility or processing result.

Errors expose codes and safe identifiers only. They never echo unrestricted source text, commands, secrets,
provider payloads, prompts, or model output.

## 18. Security and privacy invariants

1. Acquired content is permanently untrusted data and cannot alter instructions, policy, tool access, or scope.
2. No acquired command, code, hook, binary, container, package manager, interpreter, dynamic import, or remote URL
   is executed or fetched.
3. M03 uses only eligible M01 bytes; it does not clone, check out, restore exclusions, or contact GitHub.
4. AI has no tools, secrets, credentials, network destinations, database access, or publication authority.
5. Logs and errors exclude source excerpts, exact commands, personal contact data, credentials, tokens, and
   unrestricted model output. Approved local diagnostic objects use hashes and safe reason codes.
6. Creator/organization candidates are public-source attribution proposals, not verified identity or personal
   profiles; personal emails and contact details are neither extracted nor retained.
7. Static permission indicators are not runtime facts, verification, or security assessment.
8. License extraction is not legal advice or public-use clearance.
9. Every limit fails closed with explicit state; truncation cannot become absence.
10. M03 output has no approval, editorial, publication, release, deployment, or external-action authority.

## 19. Determinism and limits

M03 inherits M01 acquisition ceilings and never expands the source corpus. Additional v1 output ceilings are:

| Item                                         |    Maximum |
| -------------------------------------------- | ---------: |
| source references                            |      4,096 |
| extractor references                         |        128 |
| deterministic candidates                     |      8,192 |
| conflicts                                    |      1,024 |
| warning-code references across all records   |      2,048 |
| field results                                | exactly 20 |
| items in any one list field                  |        256 |
| exact commands across all installation paths |        256 |
| characters in one retained exact command     |      8,000 |
| characters in one normalized AI proposal     |      1,000 |
| AI proposals across all sub-operations       |        512 |
| AI calls including repair                    |          2 |
| AI input excerpts                            |         64 |
| characters per AI excerpt                    |      2,000 |
| total AI excerpt characters                  |     64,000 |

`deterministicListItemsByField` and `aiProjectedListItemsByField` use one exhaustive counting rule. An ordinary
registry list counts its top-level members. `target_user_candidates` counts
`targetUsers.length + bestFor.length + notIdealFor.length`; each leaf list and that sum must be at most 256.
`installation` counts `paths.length + sum(path.prerequisites.length) + sum(path.commands.length)`; each paths,
prerequisites, and commands array and that sum must be at most 256. All scalar/resolution/maintenance/source-revision
fields count zero. Source-reference, warning, safety-indicator, and extractor arrays are excluded because their own
global or closed-enum limits govern them. `exactCommands` independently counts commands across all installation
paths. Deterministic counts are computed before AI; projected counts apply the same rule to the complete proposed
merge. Any nested array or aggregate sum one over selects the owner-specific failure row below; no nesting can
evade the ceiling.

Limit behavior is closed:

| Owner/stage                   | Limit family                                                                                                                                    | At limit                         | One over                            | Exact result                                                                                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| deterministic/pre-AI          | source/extractor references, deterministic candidates, pre-AI conflicts, pre-AI warning references, exact commands, or deterministic list items | accept complete canonical set    | stop before AI/bundle               | `FAILED/DETERMINISTIC_LIMIT_EXCEEDED`; diagnostic records observed count/ceiling; no subset is complete                                                                                   |
| field assembly                | exactly 20 field results                                                                                                                        | accept                           | missing/duplicate/extra key         | `FAILED/FIELD_REGISTRY_INCOMPLETE` for missing/duplicate; `FAILED/FIELD_SCHEMA_INVALID` for extra                                                                                         |
| AI raw response               | one proposal text or total AI proposals                                                                                                         | accept whole response            | reject whole response               | retained `AnalysisAttemptV1` is `LIMIT_EXCEEDED/ANALYSIS_LIMIT_EXCEEDED`; deterministic result becomes bindable `COMPLETED_REVIEW_REQUIRED`; no AI proposal retained                      |
| AI projection/merge preflight | AI-added list items, conflicts, warning references, or their contribution to a merged global ceiling                                            | accept whole projected response  | reject whole response before merge  | same analysis-limit result; all deterministic values retained; affected AI-owned fields review-required; no partial AI merge                                                              |
| analysis calls                | actual provider invocations                                                                                                                     | primary plus one repair accepted | orchestration requests a third call | third call is not made; `FAILED/ANALYSIS_CALL_PLAN_INVALID`; safe context records limit `2`, requested ordinal/count `3`, while retained attempts and actual `aiCalls` remain at most `2` |
| AI input selection            | excerpts/characters                                                                                                                             | deterministic bounded selection  | additional eligible excerpt exists  | omit only from AI input, emit `AI_INPUT_BOUNDED`, retain all deterministic records; omission cannot support absence                                                                       |

The AI-bundle selection is the only permitted canonical bounding operation and follows Section 14.3 order.
Everything else is whole-attempt or whole-response failure—never arbitrary truncation. The AI response validator
computes its full projected merged counts before accepting any proposal; therefore no post-merge overflow state is
reachable.

The orchestrator is structurally limited to ordinal `0` primary and ordinal `1` repair. A request for ordinal `2`
is detected before constructing an invocation ID or calling the adapter; consequently it cannot fabricate an
`AnalysisAttemptV1`, provider-response fingerprint, or `ANALYSIS_LIMIT_EXCEEDED` response. Tests assert both the
closed failure arm and adapter call count of at most two.

The field-assembly row applies only after deterministic/accepted-AI merge under trusted M03 code. An AI response
that itself invents, omits, or duplicates field keys is `INVALID_OUTPUT/ANALYSIS_OUTPUT_INVALID` and follows the
bounded repair/review-required rule; it never reaches trusted field assembly.

`ObservedCountsV1` has exactly `{sourceReferences, extractorReferences, deterministicCandidates, deterministicConflicts,
deterministicWarningReferences, deterministicListItemsByField, exactCommands, aiProposalCharactersMaximum,
aiProposals, aiProjectedConflicts, aiProjectedWarningReferences, aiProjectedListItemsByField, aiCalls,
aiInputExcerpts, aiInputCharacters}`. Both `*ListItemsByField` values are exact 20-key field maps in registry order;
all values are nonnegative integers and non-applicable counters are zero. Diagnostics and retained analysis attempts
report the owner-specific counts that selected their exact error arm. Sorting, Unicode normalization, case handling,
path handling, taxonomy matching, and command newline normalization are versioned and fixture-covered.

Every numeric string/list bound declared in Section 10.4 is also a schema ceiling. A deterministic candidate one
over such a ceiling fails the attempt with `DETERMINISTIC_LIMIT_EXCEEDED`; an AI value one over fails the complete
AI response with `ANALYSIS_LIMIT_EXCEEDED`. Exact-at-limit and one-over fixtures cover each distinct ceiling value
and both deterministic/AI ownership where applicable.

## 20. Required fixture matrix

Fixtures remain inert synthetic repository snapshots. Each fixture declares expected owned/shared paths, field
states, source-reference IDs, conflicts, warnings, aggregate status, and output fingerprint.

| Fixture                                | Required assertion                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `explicit-version`                     | exact manifest/Skill version resolves and retains lower candidates                                                                  |
| `unproven-release-signal`              | M01 tag/latest-release strings cannot claim target/date; warning plus lower tier/fallback                                           |
| `conflicting-versions`                 | conflict visible; no canonical version; M04 bindable; later progression blocked                                                     |
| `no-version`                           | deterministic source-revision fallback                                                                                              |
| `explicit-license`                     | confirmed SPDX/text provenance                                                                                                      |
| `missing-license`                      | explicit missing, no default, M04 bindable                                                                                          |
| `custom-license`                       | custom state, no invented SPDX                                                                                                      |
| `conflicting-license`                  | all sources retained; M04 bindable; later progression blocked                                                                       |
| `complete-installation`                | ordered exact ordinary commands and context                                                                                         |
| `partial-installation`                 | partial status and missing-context warning                                                                                          |
| `multiple-install-paths`               | separate authored paths, no merge                                                                                                   |
| `secret-like-install-command`          | literal retained only in M01 plus closed transient buffer; serialized M03 uses locator/hash/withheld state; no echo                 |
| `network-dependent-skill`              | external-service record and network permission remain distinct                                                                      |
| `shell-access-requirement`             | shell permission explicit/indicated                                                                                                 |
| `undocumented-permission`              | no false absence; static indicator retained                                                                                         |
| `unsupported-compatibility-claim`      | no functional/tested claim                                                                                                          |
| `archived-skill`                       | archived maintenance signal plus unavailable-date warning                                                                           |
| `no-known-limitation`                  | empty value with qualified warning                                                                                                  |
| `multi-skill-shared-doc`               | candidate ownership isolation and shared provenance                                                                                 |
| `snapshot-metadata-reference`          | metadata reference has fingerprint and no entry/document/excerpt fields                                                             |
| `provider-license-fork-metadata`       | license/fork locators are eligible and bind the complete provider-metadata fingerprint                                              |
| `provider-license-precedence`          | provider SPDX candidate/reference/key and text/manifest conflicts follow exact tiers                                                |
| `incomplete-m01-corpus`                | relevant field routes to review, not missing                                                                                        |
| `unsupported-static-language`          | explicit warning and no absence claim                                                                                               |
| `taxonomy-gap`                         | `TAXONOMY_CANDIDATE`, no invented taxonomy ID                                                                                       |
| `semantic-proposal-mapping`            | outcome/capability/Task/use-case/target/Best-for/Not-ideal/limitation target fields exact                                           |
| `attribution-role-ambiguity`           | cross-field role ambiguity routes both attribution fields to empty review without fabricated conflict                               |
| `provider-owner-only`                  | owner string populates neither attribution field; exact insufficiency warnings                                                      |
| `configuration-secret`                 | secret setting name retained, default value absent, no secret echo                                                                  |
| `dependency-service-separation`        | direct package dependency and external service are separately typed                                                                 |
| `same-input-repeat`                    | deterministic fake reproduces extraction ID and logical fingerprint                                                                 |
| `changed-analysis-configuration`       | model/methodology/setting/plan change produces distinct input/extraction identity                                                   |
| `attempt-result-identity-unit`         | same invocation with status/raw-output differences yields distinct attempt-result IDs                                               |
| `repair-attempt-identity`              | recovered invalid primary plus successful repair use only repaired proposals and do not force review                                |
| `repair-attempt-unrecovered`           | failed/invalid repair retains both attempts and routes affected fields to review                                                    |
| `third-analysis-call-blocked`          | ordinal 2 is never invoked; exact failed arm, safe count, and adapter count at most two                                             |
| `same-input-reanalysis-prohibited`     | identical input replays; adapter is not called again; no second effective result                                                    |
| `content-derived-id-collision`         | same derived ID with byte-distinct payload fails whole attempt                                                                      |
| `later-snapshot-exact-repeat`          | current observation eligible although version first-observed snapshot differs                                                       |
| `mirror-alternate-observation`         | active alternate source link/current observation eligible and correctly bound                                                       |
| `superseded-m02-handoff`               | `SUPERSEDED_INPUT`; no bundle or M04 bindability                                                                                    |
| `m02-review-state-drift`               | candidate/group review row mutation or phantom insertion is rejected/superseded exactly                                             |
| `m02-topology-phantom-drift`           | ownership/root-order insertion, deletion, or mutation changes the exact set fingerprint                                             |
| `positive-bigint-canonicalization`     | decimal-string versions round-trip; JSON numbers/leading zeroes/signs fail                                                          |
| `multi-support-confidence`             | scalar/list/object outer confidence is the exact minimum and support classes/IDs are exact                                          |
| `review-value-closure`                 | AI review fields are empty/`NO_CLAIM`; deterministic install/maintenance exceptions are exact                                       |
| `raw-analysis-local-references`        | raw ordinals resolve after raw hash/attempt ID and reproduce final ambiguity IDs                                                    |
| `analysis-input-membership`            | each operation receives exactly its declared complete candidate/conflict field set                                                  |
| `candidate-normalized-key-matrix`      | all 20 field/value variants reproduce exact keys and reject mismatches/collisions                                                   |
| `identity-status-drift`                | inactive Resource or unresolved version rejects initially and supersedes after eligibility                                          |
| `eligibility-simultaneous-failures`    | every simultaneous-failure case selects the first exact eligibility error                                                           |
| `terminal-tuple-replay-new-key`        | unchanged tuple/new key replays failed/cancelled/superseded result without work                                                     |
| `taxonomy-state-xor`                   | categories/Tasks/capabilities share registry-bound match/candidate XOR                                                              |
| `deterministic-support-provenance`     | exact/inferential nature and claim classes select exact field status/support rules                                                  |
| `license-value-xor`                    | SPDX and custom-hash candidate/selected values enforce exact XOR                                                                    |
| `deterministic-excerpt-construction`   | locator bytes, sensitive omission, clipping, and excerpt hash reproduce exactly                                                     |
| `operation-input-partitions`           | nine serialized partitions and cross-partition-reference rejection reproduce                                                        |
| `terminal-envelope-equality`           | outer/inner IDs and proposal attempt references must match exactly                                                                  |
| `normalization-reconciliation-matrix`  | every derived normalized member and same-key family outcome reproduces                                                              |
| `repair-pair-recovery`                 | recovery derives from invalid-primary/succeeded-repair pair without changing primary ID                                             |
| `exact-command-hash-safety-order`      | command-substring hash and unique enum-order indicators reproduce                                                                   |
| `extractor-registry-integrity`         | complete parser sets resolve; dangling/collision/ownership/129th-ref cases fail exactly                                             |
| `analysis-attribution-projection`      | provider/model/settings/plan bytes and fingerprint equal request/bundle/attempts                                                    |
| `locator-boundary-matrix`              | line/newline/EOF, pointer, file-metadata, and release-ordinal boundaries reproduce                                                  |
| `semantic-provenance-reconciliation`   | semantic equality, provenance retention, version agreement, and name tie-break reproduce                                            |
| `ai-reference-union`                   | nested/enclosing refs equal; interpretation ignores citations; conflicts use exact union                                            |
| `repair-invalidity-class`              | syntactic repair allowed; semantic invalidity makes zero repair calls                                                               |
| `bundle-warning-union`                 | nested and exact event warnings plus occurrence ceiling reproduce                                                                   |
| `empty-taxonomy-registry`              | arbitrary IDs rejected across categories/Tasks/capabilities; candidates bind empty artifact                                         |
| `embedded-policy-artifacts`            | SPDX/release/secret/permission/prohibited-claim tables and fingerprint reproduce                                                    |
| `ai-semantic-failure`                  | deterministic fields retained in bindable review-required bundle                                                                    |
| `ambiguity-with-candidates`            | deterministic/AI disagreement creates exact conflict and outer `CONFLICTING`                                                        |
| `ambiguity-multiple-ai`                | two AI interpretations create exact AI-only conflict and outer `CONFLICTING`                                                        |
| `ambiguity-without-candidates`         | one low-confidence AI interpretation creates outer `REVIEW_REQUIRED` without conflict                                               |
| `material-missing-progression`         | bindable completed bundle has the exact later-progression blocker                                                                   |
| `nonmaterial-unsupported-progression`  | aggregate is `COMPLETED`; unsupported nonmaterial field adds no later blocker by itself                                             |
| `bare-cr-line-locator`                 | bare CR remains content while LF/CRLF/EOF-tail line ranges reproduce frozen M01 semantics                                           |
| `equivalent-spdx-spelling`             | equivalent SPDX casing/parenthesization collapses semantically while exact provenance remains                                       |
| `malformed-request-envelope`           | invalid bytes/schema return only digest-bound `INVALID_REQUEST/REQUEST_SCHEMA_INVALID`                                              |
| `request-input-hash-collision`         | injected equal-hash/distinct-preimage request and input paths fail before join/replay/AI                                            |
| `warning-issuer-matrix`                | every candidate/proposal/orchestrator/field warning has exactly one authorized issuance path                                        |
| `static-permission-false-positive`     | qualified rules match; `window.open`, `RegExp.exec`, and user-defined names do not                                                  |
| `unauthorized-analysis-tuple`          | every enabled tuple except the exact deterministic fake is request-schema invalid                                                   |
| `extractor-status-matrix`              | every field status uses exactly the Section 11.0 parser-set rule                                                                    |
| `compound-list-boundary`               | each target-user/install leaf and aggregate accepts 256 and fails at 257 by exact owner                                             |
| `nested-fingerprint-collision`         | source/provider/configuration/policy/raw-output collisions compare exact retained preimages                                         |
| `conflict-preference-closure`          | every version/license conflict serializes null preference and false guidance                                                        |
| `command-boundary-safety-matrix`       | physical/continued commands and every ordered indicator/overlap/near-miss reproduce                                                 |
| `deterministic-parser-artifact`        | exact selectors/pointers/shapes plus unrecognized/changelog/license boundaries reproduce                                            |
| `maintenance-cartesian`                | all boolean/null/current-entry/reference/support combinations accept or fail exactly                                                |
| `opaque-m02-job-fingerprint`           | original/replacement jobs embed current rows and only available payload bytes without invented preimage                             |
| `bytestring-input-golden`              | padded Base64/length plus non-ASCII/newline bytes reproduce source/input hashes                                                     |
| `selector-constructor-matrix`          | every parser member/declaration builds the exact typed value or exact review route                                                  |
| `policy-literal-fingerprint`           | exact bytes between policy markers reproduce request artifact fingerprint                                                           |
| `safe-partial-installation`            | partial typed path is retained only in outer review with context warning                                                            |
| `command-transform-tokenizer`          | original/normalized/safety transforms and every finite tokenizer rejection reproduce                                                |
| `source-affinity-matrix`               | every disposition/path class affects exactly the declared field set                                                                 |
| `inventory-absence-proof`              | no-file versus empty/invalid/excluded changelog/deprecation branches use exact absence reference                                    |
| `provider-spdx-boundary`               | null/NONE/NOASSERTION/invalid/unallowlisted/allowlisted signals select exact candidate/review route                                 |
| `candidate-free-semantic-docs`         | each semantic operation receives exact heading evidence without prerequisite field candidates                                       |
| `command-byte-range`                   | source byte range, transform, original hash, normalized value, safety input, and tokenizer reproduce                                |
| `m02-original-replacement-projection`  | every frozen job lineage/replacement column maps to exact discriminator and bytes/null                                              |
| `policy-artifact-registry`             | exact four-member names/versions/order/bytes reproduce input identity                                                               |
| `m01-disposition-affinity`             | every frozen disposition/reason/path-extension combination selects exact fields/warning/error                                       |
| `deprecation-resolution`               | absent/invalid/false/true/conflicting declarations select exact absence/review/value/support route                                  |
| `total-deterministic-constructors`     | title/provenance/class/source/extractor and all installation path states reproduce                                                  |
| `all-tier-license-signals`             | every Skill/manifest/file/provider license arm shares one total classifier                                                          |
| `provider-owner-attribution-status`    | provider-only stays missing; untyped explicit attribution routes both fields review                                                 |
| `terminal-empty-line-locator`          | final LF creates an addressable empty terminal line with null excerpt                                                               |
| `disposition-reason-matrix`            | every legal/illegal frozen disposition and sorted reason-array shape selects exact route                                            |
| `empty-installation-review`            | unavailable/invalid install input yields typed empty review with no support                                                         |
| `maintenance-false-provenance`         | provider false, explicit false, and declaration-absent false use distinct exact references                                          |
| `field-registry-byte-literal`          | 20-row JSON canonical bytes and declared SHA reproduce                                                                              |
| `command-indent-transform`             | 0–3 spaces, tabs, mixed indent, prompt/comment/blank/CRLF/continuation byte goldens reproduce                                       |
| `ambiguity-confidence-closure`         | ambiguity signals are 1.0/no-warning; low-confidence field and cross-projection routes reproduce                                    |
| `ai-citable-reference-set`             | supplied candidate-backed or non-null excerpt refs are citable; withheld/omitted refs reject                                        |
| `constructor-edge-provenance`          | absence/fallback/license locators and pyproject file missing/invalid/excluded branches reproduce                                    |
| `static-scan-granularity`              | per-line nonoverlap/overlap/anchor/reference semantics reproduce                                                                    |
| `source-revision-negative-levels`      | attempt mismatch and contract-only invalid field shape remain distinct                                                              |
| `personal-contact-withholding`         | email/phone matches and near misses route every source/default/excerpt/command/AI surface exactly                                   |
| `yaml-toml-data-pointers`              | safe parsed YAML/TOML pointer resolution, invalid formats, and canonical excerpts reproduce                                         |
| `equal-version-spdx-selection`         | equal semantic candidates select exact tier/byte/ID winner or canonical SPDX output                                                 |
| `maintenance-claim-class`              | all maintenance candidates and aggregate field use `REPOSITORY_METADATA`                                                            |
| `low-ai-deterministic-coexistence`     | low/AI-only ambiguity preserves deterministic value/status/support and adds warning only                                            |
| `ambiguity-reference-union`            | every signal reference set equals exact candidate/interpreted-proposal union                                                        |
| `static-regexp-cursor`                 | per-M01-line `giu` UTF-16 lastIndex behavior and whole-line locator mapping reproduce                                               |
| `continuation-state-machine`           | every IDLE/CONTINUING with blank/comment/EOF combination selects exact command or empty review                                      |
| `source-revision-reference-boundary`   | snapshot refs plus serialized observation/link IDs bind provenance without invented locator                                         |
| `whole-document-invalidity`            | each JSON/YAML/TOML/requirements invalidity selects first exact field/warning route                                                 |
| `operation-input-envelope`             | exact all/citable/source-input states, occurrence counts, omissions, and fingerprint reproduce                                      |
| `mixed-completeness-install-paths`     | multiple safe command-bearing paths with any incomplete member retain all paths as explicit partial review                          |
| `configuration-sensitivity-matrix`     | every type/name/secret/contact/default overlap selects exact sensitivity, retention, warnings, and status                           |
| `contact-operation-routing`            | repeated sensitive documentation references map through operation rows, dedupe fields, and preserve deterministic truth             |
| `transient-contact-collision-buffer`   | restricted source/raw-output collision buffers reject contact without record, persistence, or observability echo                    |
| `source-reference-registry-union`      | exact support/routing/operation/AI union includes each record once and rejects extra, missing, dangling, or colliding records       |
| `parser-profile-frontmatter-boundary`  | YAML 1.2.2/TOML 1.0.0/pointer and opener/closer/invalid/unclosed Markdown-body outcomes reproduce exactly                           |
| `installation-path-cartesian`          | complete/partial/inferred/invalid/unsafe/mixed paths plus equal/divergent same-label groups select the total first-match row        |
| `configuration-type-token-matrix`      | every accepted case-folded TYPE, exact unknown, rejected alias, and default-sensitivity combination reproduces                      |
| `markdown-raw-source-locators`         | inline markup/entities/links/closing hashes/nested lists/tables/duplicate headings/front-matter offsets map exactly                 |
| `secret-like-value-withholding`        | every source-derived string family plus candidate-independent/AI paths suppresses secret matches with locator/hash only             |
| `inferred-installation-provenance`     | exact paragraph locator, extractor/source, inferential class, 0.70 confidence, key, and warning behavior reproduce                  |
| `installation-label-discriminator`     | null versus literal `<unlabeled>` and equal/divergent same-label groups never collide or merge incorrectly                          |
| `configuration-invalid-sensitive`      | invalid TYPE crossed with safe/contact names and absent/secret/contact/both defaults yields exact warning/reference sets            |
| `sensitive-locator-privacy`            | path/pointer-token secret/contact matches serialize only typed coordinates/enums plus digest and reject locator collisions          |
| `installation-review-claim-class`      | exact-only, inferred-only, and mixed deterministic nonempty review paths derive truthful closed claim classes                       |
| `sensitive-warning-occurrences`        | command/config/suppressed/operation/locator surfaces produce exact candidate, field, and bundle occurrence counts                   |
| `sensitive-reference-precedence`       | positive/unsupported/review and deterministic/AI conflict fields preserve or route exactly; installation retains unsafe typed paths |
| `retained-candidate-sensitive-excerpt` | safe static/deterministic candidate with unrelated secret/contact line text nulls excerpt and fixes candidate/field counts          |
| `locator-preimage-lifecycle`           | ordinary sensitive locator preimages exist only in the authorized transient store and are collision-compared/discarded              |

### 20.1 Per-field golden coverage

Each field-present row requires exact complete-object equality for the mapped value schema, status, claim class,
confidence, candidate/proposal/reference/conflict/warning IDs, aggregate status, bindability, and fingerprints.
`source_revision` alone uses an attempt-level mismatch rejection (no field exists) plus a separate contract-only
`source-revision-invalid-field-shape` negative that rejects a malformed field object with `FIELD_SCHEMA_INVALID`.

| Field                     | Positive golden fixture         | Negative/unknown golden fixture                                                               |
| ------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------- |
| `canonical_skill_name`    | `all-fields-explicit`           | `incomplete-m01-corpus`                                                                       |
| `creator_candidates`      | `all-fields-explicit`           | `attribution-role-ambiguity`                                                                  |
| `organization_candidates` | `all-fields-explicit`           | `attribution-role-ambiguity`                                                                  |
| `version`                 | `explicit-version`              | `conflicting-versions` and `no-version`                                                       |
| `source_revision`         | `all-fields-explicit`           | `source-revision-mismatch` (attempt) and `source-revision-invalid-field-shape` (field schema) |
| `license`                 | `explicit-license`              | `missing-license` and `conflicting-license`                                                   |
| `categories`              | `all-fields-explicit`           | `taxonomy-gap`                                                                                |
| `outcome_candidate`       | `semantic-proposal-mapping`     | `semantic-no-support`                                                                         |
| `capabilities`            | `semantic-proposal-mapping`     | `semantic-no-support`                                                                         |
| `tasks`                   | `semantic-proposal-mapping`     | `taxonomy-gap`                                                                                |
| `use_cases`               | `semantic-proposal-mapping`     | `semantic-no-support`                                                                         |
| `target_user_candidates`  | `semantic-proposal-mapping`     | `semantic-no-support`                                                                         |
| `installation`            | `complete-installation`         | `partial-installation` and `secret-like-install-command`                                      |
| `configuration`           | `all-fields-explicit`           | `configuration-secret`                                                                        |
| `dependencies`            | `dependency-service-separation` | `incomplete-m01-corpus`                                                                       |
| `external_services`       | `dependency-service-separation` | `semantic-no-support`                                                                         |
| `permissions`             | `shell-access-requirement`      | `undocumented-permission` and `unsupported-static-language`                                   |
| `compatibility`           | `all-fields-explicit`           | `unsupported-compatibility-claim`                                                             |
| `limitations`             | `semantic-proposal-mapping`     | `no-known-limitation`                                                                         |
| `maintenance_signals`     | `archived-skill`                | `unproven-release-signal`                                                                     |

`all-fields-explicit` contains a schema-valid positive value for all 20 fields. `semantic-no-support` contains a
complete eligible corpus with no support for semantic proposals and proves exact empty/null `MISSING` forms.
`source-revision-mismatch` proves eligibility rejection before parsing or AI.

An exact resolution-state Cartesian fixture covers every permitted and prohibited
`VersionResolutionV1`/`LicenseResolutionV1`/`InstallationResolutionV1` outer-status, selected/null, preferred/null,
path-count, claim-class, confidence, and ID-array combination. Configuration fixtures cover every
`defaultPresent × secretSensitivity × defaultValueOrNull` combination. Confidence fixtures assert `0.599999` routes
to review, `0.60` and `0.849999` are inferred, `0.85` and `1.0` are strongly supported, and values outside `[0,1]`
fail schema.

### 20.2 Boundary and lifecycle matrix

Every numeric ceiling in Section 19 has an exact-at-limit fixture and a one-over fixture. The at-limit case must
produce the complete expected bundle; the one-over case must produce the exact union arm/error/diagnostic and no
arbitrarily truncated bundle. Additional phase fixtures cover cancellation and handoff supersession at
`ELIGIBILITY`, `INVENTORY`, `DETERMINISTIC`, `ANALYSIS` before/after each of the two calls, `MERGE`, and
`FINAL_GUARD`; idempotent replay of every terminal union arm; and concurrent identical join versus different-input
isolation.

The boundary matrix separately exercises deterministic-owned and AI-owned pressure on list, conflict, warning, and
merged global ceilings. AI-caused overflow must reject the whole AI response and retain a bindable review-required
deterministic bundle; deterministic overflow must return `FAILED/DETERMINISTIC_LIMIT_EXCEEDED` with no bundle.

The predecessor matrix covers the exact complete expected key set; every key missing/extra; zero/negative versions;
independent acquisition-job versus M02-job drift; immutable observation/snapshot/acquisition-result/topology/
metadata fingerprint drift; valid observation without a record version; unchanged internal read retry; and final-
guard drift. The fingerprint matrix changes one field at a time in every canonical projection, including metadata
key/ordinal, analysis input, attempt status/raw-output hash, repair linkage, proposal payload, and output exclusions.

## 21. Adversarial fixtures

Required adversarial cases include source text that asks the system/model to ignore instructions, reveal secrets,
execute installation, publish, mark verified/tested, fabricate references, hide limitations, contact a service,
modify another candidate, read sibling files, or treat marketing as runtime evidence. Also include:

- fenced-code delimiter confusion, raw HTML/script, Unicode confusables, bidi controls, null-like text, and very
  long lines;
- path/ownership attempts that cite a sibling candidate or excluded M01 entry;
- malicious YAML tags/aliases and JSON prototype-like keys;
- command substitution, pipe-to-shell, privilege escalation, destructive commands, and embedded credential text;
- attempts to copy a withheld credential-like command into a bundle, excerpt, AI input, diagnostic, log, or M04
  payload;
- email/phone contact matches and classifier near misses in attribution, configuration names/defaults, semantic
  declarations, excerpts, commands, AI raw output, diagnostics, logs, and M04 payloads;
- secret/contact matches and near misses in normalized path segments and JSON/YAML/TOML member-pointer tokens,
  including injected locator-digest collisions and proof that ordinary locator bytes never serialize;
- fabricated/duplicate/out-of-snapshot source-reference IDs in AI output;
- metadata references with document fields, document references with metadata fingerprints, and every invalid
  locator-key combination;
- AI enum, confidence, count, field-ownership, and output-size violations;
- AI attempts to overwrite deterministic version/license/command facts;
- proposal kinds with the wrong target field, including Best-for/Not-ideal cross-field inconsistency;
- current-observation/source-link/decision tuple mismatch and valid first-observed/current-observation divergence;
- every derived-ID byte-collision path and every exact-at-limit/one-over behavior;
- invalid first response plus valid syntactic repair, invalid semantic response, and invalid second response; and
- cancellation/supersession before call, during call, after call, and before final return.

Every case asserts no execution, no external side effect, no secret echo, no sibling data leak, deterministic
facts preserved, and the exact error/warning/aggregate state.

## 22. Contract, unit, fixture, and integration test responsibilities

- `contracts`: all 20 discriminated value schemas, nested-state mapping, closed enums, canonical serialization,
  every ID/fingerprint formula, document/metadata reference XOR, attempt-result union, limits, and invalid-shape
  rejection.
- `extraction` unit tests: each parser, normalization rule, resolution policy, sorting, limits, and pure
  determinism.
- `analysis` contract tests: provider-neutral operation, bounded bundle, provenance, invalid output, one syntactic
  repair, timeout/failure, and no tool authority.
- extraction contract tests: active M02 current-observation/source-link/decision eligibility, first-observed
  divergence, ownership isolation, immutable tuple preservation, bindability, idempotency, collision, cancellation,
  and supersession.
- fixture tests: every Section 20 expected field/reference/conflict/fingerprint.
- adversarial tests: every Section 21 invariant.
- integration tests: in-memory M01 snapshot → M02 active handoff → M03 output using the deterministic fake; no
  database or live provider.
- regression tests: all M00–M02 suites remain green and their frozen authority documents remain byte-identical.

## 23. Acceptance criteria and traceability

| ID           | Acceptance criterion                                                                                                                                                                                      | Required evidence                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `M03-AC-01`  | Only a current active identity-resolved M02 handoff is eligible                                                                                                                                           | contract/integration/adversarial tests          |
| `M03-AC-02`  | Every request binds the current observation/source link/decision plus stable Resource/version identities without equating current and first-observed snapshots                                            | exact-repeat/mirror schemas and mismatch tests  |
| `M03-AC-03`  | Exactly all 20 registry fields validate against the closed discriminated value schemas and mapping matrix                                                                                                 | per-field positive/negative golden schema tests |
| `M03-AC-04`  | Deterministic candidates remain distinguishable from AI proposals                                                                                                                                         | provenance and merge tests                      |
| `M03-AC-05`  | Unknown, missing, unsupported, conflicting, and review states are explicit                                                                                                                                | fixture matrix                                  |
| `M03-AC-06`  | Exact commands and authored order are preserved and never executed/invented                                                                                                                               | command unit/adversarial tests                  |
| `M03-AC-07`  | Version precedence is deterministic and conflicts remain visible                                                                                                                                          | version fixtures                                |
| `M03-AC-08`  | License states are exact and no license/default is invented                                                                                                                                               | license fixtures                                |
| `M03-AC-09`  | Permissions are never declared absent from silence or unsupported inspection                                                                                                                              | permission fixtures/adversarial tests           |
| `M03-AC-10`  | Compatibility evidence class never overstates format/source evidence as tested                                                                                                                            | compatibility tests                             |
| `M03-AC-11`  | Dependencies are direct-only and incompleteness remains explicit                                                                                                                                          | dependency tests                                |
| `M03-AC-12`  | AI is bounded, tool-free, provider-neutral, attributable, and cannot overwrite deterministic truth                                                                                                        | analysis contract/adversarial tests             |
| `M03-AC-13`  | Document and snapshot-metadata references satisfy their exact XOR/locator/ownership contract and are not M04 EvidenceItems                                                                                | contract and boundary tests                     |
| `M03-AC-14`  | Fixed fake-provider fixtures reproduce IDs/fingerprints; attempt-result formulas distinguish output/status while identical effective input replays without a second call                                  | repeatability/identity tests                    |
| `M03-AC-15`  | Every success/rejection/failure/cancellation/supersession boundary returns the exact closed union arm and replays exactly                                                                                 | orchestration transition matrix                 |
| `M03-AC-16`  | Incomplete/excluded source cannot become an absence claim                                                                                                                                                 | incomplete-corpus tests                         |
| `M03-AC-17`  | Required safety/size ceilings fail closed without secret or source-text echo                                                                                                                              | limit/redaction tests                           |
| `M03-AC-18`  | M03 creates no canonical Graph promotion, durable migration, Claim/EvidenceItem, draft, approval, or publication                                                                                          | whole-diff/source-safety review                 |
| `M03-AC-19`  | M00–M02 behavior and authority bytes remain unchanged                                                                                                                                                     | regression and hash checks                      |
| `M03-AC-20`  | The complete required gate set passes under pinned runtime without live credentials                                                                                                                       | command evidence and clean-checkout replay      |
| `M03-AC-21`  | Conflict/missing/unsupported/review bundles remain M04-bindable while later progression stays blocked where required                                                                                      | M04 boundary contract tests                     |
| `M03-AC-22`  | Analysis configuration and every derived ID/fingerprint use exact canonical formulas plus byte-equality collision checks                                                                                  | fingerprint/collision tests                     |
| `M03-AC-23`  | Frozen M01 metadata insufficiency remains explicit; unproven release targets/dates never become exact facts                                                                                               | predecessor-metadata fixtures                   |
| `M03-AC-24`  | Best-for and Not-ideal proposals have exact target-field and cross-field projection semantics                                                                                                             | semantic mapping fixtures                       |
| `M03-AC-25`  | Secret-like command bytes remain only in restricted M01 source plus the closed transient buffer; serialized M03 preserves locator/hash without echo                                                       | secret-command adversarial fixtures             |
| `M03-AC-26`  | Every numeric limit passes at-limit and fails/contains exactly one-over without arbitrary truncation                                                                                                      | boundary matrix                                 |
| `M03-AC-27`  | Every field has positive and negative/unknown exact golden coverage                                                                                                                                       | Section 20.1 golden matrix                      |
| `M03-AC-28`  | Every mutable predecessor row, including candidate review state, has an exact decimal-string version; immutable and complete topology/review sets have exact canonical fingerprints                       | predecessor expectation/drift matrix            |
| `M03-AC-29`  | Every outer field status and nested state enforces exact value/null/empty/support-ID/conflict-ID/claim/confidence invariants, including deterministic mixed-support derivation                            | Cartesian schema matrix                         |
| `M03-AC-30`  | Deterministic and AI-owned overflows select different exact result arms without partial merge                                                                                                             | owner-partitioned boundary matrix               |
| `M03-AC-31`  | Provider-owner-only, ambiguity with/without candidates, material missing, and nonmaterial unsupported branches have exact outcomes                                                                        | focused golden fixtures                         |
| `M03-AC-32`  | Repository/release/tag/license/fork metadata eligibility, locators, and aggregate fingerprints are one consistent closed contract                                                                         | metadata-reference fixtures                     |
| `M03-AC-33`  | Every ambiguity reason/cardinality combination has an exact valid route or invalid-response outcome and one deterministic outer status                                                                    | ambiguity Cartesian matrix                      |
| `M03-AC-34`  | Successful syntactic repair is distinguishable from unrecovered analysis error and does not itself force review                                                                                           | repair transition tests                         |
| `M03-AC-35`  | Two actual AI calls are accepted; a requested third call is never invoked or represented as a provider attempt and returns the exact deterministic failure arm                                            | call-limit/adapter-spy tests                    |
| `M03-AC-36`  | AI-owned review fields use exact empty values/supports and `NO_CLAIM`; deterministic installation/maintenance exceptions retain typed values with truthful claim class                                    | review-value Cartesian tests                    |
| `M03-AC-37`  | Raw local proposal ordinals resolve in the exact hash/attempt/field-ID/ambiguity-ID order without provider-supplied derived IDs                                                                           | raw-response derivation tests                   |
| `M03-AC-38`  | Every sub-operation receives exactly the complete declared deterministic candidate/conflict membership and fingerprint                                                                                    | analysis-input membership tests                 |
| `M03-AC-39`  | Every field/value candidate has one exact normalized-key formula; mismatches fail and equal-key distinct values remain visible                                                                            | normalized-key matrix                           |
| `M03-AC-40`  | Provider SPDX metadata has an executable candidate/reference/key rule and deterministic precedence/conflict behavior                                                                                      | provider-license fixtures                       |
| `M03-AC-41`  | Resource/version current statuses and every simultaneous eligibility failure select exact initial/final outcomes                                                                                          | eligibility-order matrix                        |
| `M03-AC-42`  | Accepted terminal tuples replay across new keys; retry execution requires an input-identity change                                                                                                        | tuple reservation/concurrency tests             |
| `M03-AC-43`  | Categories, Tasks, capabilities, and all semantic values share the exact registry-bound taxonomy-ID XOR                                                                                                   | taxonomy discriminated-union tests              |
| `M03-AC-44`  | Deterministic candidates encode exact/inferential support nature and single/mixed deterministic claim class; unsupported/conflicting support unions are closed                                            | support-provenance Cartesian tests              |
| `M03-AC-45`  | Every license value enforces SPDX/custom-hash XOR in candidates and resolutions                                                                                                                           | license union tests                             |
| `M03-AC-46`  | Every retained/null excerpt follows exact locator, sensitive-omission, clipping, priority, and hash rules                                                                                                 | excerpt golden/boundary tests                   |
| `M03-AC-47`  | The complete enabled plan has nine exact fingerprinted operation partitions and rejects cross-partition references                                                                                        | operation partition tests                       |
| `M03-AC-48`  | Attempt/proposal/terminal IDs satisfy exact equality invariants and every proposal variant has a total comparator                                                                                         | identity/envelope/comparator tests              |
| `M03-AC-49`  | Normalized members follow exact Unicode/ecosystem/SPDX/SemVer transforms and every field family has deterministic same-key reconciliation                                                                 | normalization/reconciliation matrix             |
| `M03-AC-50`  | Recovered analysis derives only from the invalid-primary/succeeded-repair pair without later-dependent attempt identity                                                                                   | repair identity tests                           |
| `M03-AC-51`  | Exact commands hash only command-substring bytes and use unique enum-ordered safety indicators                                                                                                            | command identity/safety tests                   |
| `M03-AC-52`  | The bounded bundle extractor registry closes every candidate/proposal/field reference, ownership set, parser set, order, fingerprint, and collision                                                       | extractor registry matrix                       |
| `M03-AC-53`  | Bundle analysis attribution serializes exact provider/adapter/model/settings/plan bytes and matches request/attempt fingerprints                                                                          | analysis attribution tests                      |
| `M03-AC-54`  | Every locator has exact scalar domains, owning-record vocabulary, line/newline/EOF behavior, and release-ordinal bounds                                                                                   | locator boundary/adversarial matrix             |
| `M03-AC-55`  | Semantic identity, provenance identity, within/cross-tier reconciliation, agreeing versions, and canonical-name ties are deterministic                                                                    | reconciliation matrix                           |
| `M03-AC-56`  | AI nested/enclosing references are equal, interpretation equality excludes provenance, and conflict references are the exact member union                                                                 | proposal/conflict provenance tests              |
| `M03-AC-57`  | Invalid attempts carry identity-bound invalidity class; only syntactic/schema-shape invalidity authorizes one repair                                                                                      | repair authorization tests                      |
| `M03-AC-58`  | Bundle warnings are the exact nested/event union and the global occurrence ceiling is deterministic                                                                                                       | warning union/limit tests                       |
| `M03-AC-59`  | Every taxonomy-bearing value binds the exact empty v1 registry and rejects arbitrary matched IDs                                                                                                          | taxonomy artifact tests                         |
| `M03-AC-60`  | SPDX, release-channel, secret, permission, and prohibited-claim policy tables have executable bytes/fingerprint and exact boundary fixtures                                                               | policy artifact/adversarial tests               |
| `M03-AC-61`  | Line locators exactly preserve frozen M01 LF/CRLF/bare-CR/EOF-tail semantics                                                                                                                              | locator byte-golden tests                       |
| `M03-AC-62`  | License semantic identity canonicalizes equivalent SPDX expressions while retaining exact source provenance                                                                                               | equivalent-SPDX reconciliation tests            |
| `M03-AC-63`  | Malformed request bytes have one digest-bound pre-domain terminal arm without request identity, predecessor access, or AI work                                                                            | request-boundary contract tests                 |
| `M03-AC-64`  | Equal request/input hashes require byte-equal retained preimages before idempotency, join, or tuple replay                                                                                                | injected-collision/concurrency tests            |
| `M03-AC-65`  | Candidate, proposal, field, and orchestrator warning issuers, propagation, and per-surface occurrence counts are exact and reject unauthorized codes                                                      | warning issuer Cartesian tests                  |
| `M03-AC-66`  | Static permission rules bind engine/language/default semantics in policy identity and reject named false positives                                                                                        | static-rule positive/negative tests             |
| `M03-AC-67`  | Enabled analysis accepts only the exact authorized deterministic-fake tuple, settings, and nine-operation plan                                                                                            | request-schema tuple matrix                     |
| `M03-AC-68`  | Extractor references follow one status-discriminated parser-set contract with no contradictory fallback                                                                                                   | extractor/status Cartesian tests                |
| `M03-AC-69`  | Compound target-user and installation leaf/aggregate list counts accept at 256 and select the exact deterministic/AI failure at 257                                                                       | compound-list owner boundary tests              |
| `M03-AC-70`  | Every nested source/provider/configuration/policy/raw-output hash compares its retained exact preimage before parent identity, join, replay, or merge                                                     | injected nested-collision matrix                |
| `M03-AC-71`  | Version/license conflicts always serialize null preferred candidate and false noncanonical-guidance state                                                                                                 | conflict preference golden tests                |
| `M03-AC-72`  | Exact command boundaries, continuations, ordered safety indicators, overlaps, and near misses are policy-fingerprinted and deterministic                                                                  | command grammar/safety matrix                   |
| `M03-AC-73`  | Deterministic manifest, Skill, documentation, changelog, and license parsing uses only the exact fingerprinted selector/pointer/shape artifact                                                            | deterministic parser artifact matrix            |
| `M03-AC-74`  | Maintenance signals enforce exact boolean/null/current-entry/source-reference/support cross-field invariants                                                                                              | maintenance Cartesian tests                     |
| `M03-AC-75`  | Frozen original and replacement M02 job fingerprints are handled as available opaque/payload-bound facts without requiring nonexistent preimages                                                          | original/replacement handoff tests              |
| `M03-AC-76`  | Every raw byte member uses canonical padded Base64/length JSON shapes and reproduces non-ASCII/newline golden fingerprints                                                                                | byte-encoding golden tests                      |
| `M03-AC-77`  | Every deterministic selector/member/declaration has one exact typed constructor, locator, support class, confidence, and invalid-shape route                                                              | selector-constructor Cartesian tests            |
| `M03-AC-78`  | The policy fingerprint hashes the exact approved-spec bytes between fixed markers with unambiguous LF boundaries                                                                                          | policy literal hash test                        |
| `M03-AC-79`  | Safe partial installation retains its typed path only in `REVIEW_REQUIRED` with exact context warning                                                                                                     | partial-installation mapping tests              |
| `M03-AC-80`  | Original command bytes, normalized serialized text, safety input, continuation grouping, and finite tokenizer failures are exact                                                                          | command transform/tokenizer tests               |
| `M03-AC-81`  | M01 disposition and path classes map to exactly the declared affected fields and warnings                                                                                                                 | source-affinity Cartesian tests                 |
| `M03-AC-82`  | Complete-corpus absence uses inventory/topology-bound references and distinguishes absent, empty, invalid, and excluded changelog/deprecation inputs                                                      | inventory-absence boundary tests                |
| `M03-AC-83`  | Provider SPDX null/sentinel/invalid/unallowlisted/allowlisted cases select exact no-candidate/candidate/review behavior                                                                                   | provider SPDX boundary tests                    |
| `M03-AC-84`  | Semantic operations receive exact candidate-independent README/Skill section references and can produce fully attributable proposals                                                                      | candidate-free semantic fixtures                |
| `M03-AC-85`  | Command byte ranges, extraction transform, original hash, normalized value, safety input, and escaped-state tokenizer are unambiguous                                                                     | byte-range/command golden tests                 |
| `M03-AC-86`  | Original/replacement M02 jobs project every required lineage/replacement column with exact discriminator and available payload bytes/null                                                                 | M02 job projection Cartesian tests              |
| `M03-AC-87`  | Input identity contains exactly the ordered policy literal, field registry, taxonomy registry, and extractor registry artifact bytes                                                                      | policy artifact registry tests                  |
| `M03-AC-88`  | Frozen M01 dispositions/reason codes and exact supported/unsupported extension classes map to one closed field-affinity warning/error route                                                               | M01 disposition-affinity tests                  |
| `M03-AC-89`  | Maintenance deprecation absence, invalidity, false, true, and disagreement have exact nullable-value/support/warning/status behavior                                                                      | deprecation resolution matrix                   |
| `M03-AC-90`  | Every deterministic route has exact extractor/source/support/class/confidence/locator construction plus title and installation grammars                                                                   | total constructor/path tests                    |
| `M03-AC-91`  | Skill, manifest, license-file, and provider license signals use one total null/sentinel/invalid/unallowlisted/allowlisted/custom classifier                                                               | all-tier license classifier tests               |
| `M03-AC-92`  | Provider-owner-only attribution stays missing while explicit untyped attribution routes both fields to review, without cross-field conflicts                                                              | attribution status fixtures                     |
| `M03-AC-93`  | Frozen M01 empty/nonempty/LF/CRLF/bare-CR line counts include an addressable empty terminal line after final LF                                                                                           | terminal-line locator tests                     |
| `M03-AC-94`  | Every frozen disposition and unique-sorted reason-array shape has one literal legal warning route or eligibility failure                                                                                  | disposition/reason Cartesian tests              |
| `M03-AC-95`  | Unavailable or invalid installation input has one empty typed review arm with `NO_CLAIM` and empty support/evidence                                                                                       | empty installation review tests                 |
| `M03-AC-96`  | Archived false, explicit deprecated false, and no-declaration false use provider, document, and inventory-absence provenance respectively                                                                 | maintenance false-provenance tests              |
| `M03-AC-97`  | Field registry content is the exact canonical 2,124-byte 20-row JSON literal with its declared SHA-256                                                                                                    | field registry byte/hash test                   |
| `M03-AC-98`  | Command extraction has exact opening-indent, per-line removal, console prompt, blank/comment, CRLF, continuation, and mixed-indent behavior                                                               | command transform byte goldens                  |
| `M03-AC-99`  | Ambiguity signals are fixed-confidence/no-warning and low-confidence field proposals route every deterministic projection target exactly                                                                  | ambiguity/confidence projection tests           |
| `M03-AC-100` | AI citations are limited to supplied nonsensitive candidate-backed references and candidate-independent non-null excerpts                                                                                 | citable-reference negative tests                |
| `M03-AC-101` | Inventory absence, repository/source fallbacks, license locator variants, and pyproject file-reference edge cases have truthful total provenance                                                          | constructor edge-provenance tests               |
| `M03-AC-102` | Static permission scans are per-line, deterministic nonoverlapping within rule, overlap-preserving across rules, and line-locator-bound                                                                   | static scan semantics tests                     |
| `M03-AC-103` | Source-revision mismatch is attempt-level while malformed source-revision field shape is separately rejected by contract schema                                                                           | source-revision negative tests                  |
| `M03-AC-104` | Policy-fingerprinted contact detection prevents email/phone-like value or locator bytes entering fields, excerpts, commands, AI boundaries, diagnostics, persistence, or M04 payloads                     | contact withholding/near-miss tests             |
| `M03-AC-105` | YAML-front-matter and TOML members use exact safe `DATA_POINTER` resolution and canonical value excerpts                                                                                                  | YAML/TOML pointer contract tests                |
| `M03-AC-106` | Semantically equal version/SPDX candidates select one deterministic tier/byte/ID winner or canonical SPDX value while preserving provenance                                                               | equal-value selection goldens                   |
| `M03-AC-107` | Every maintenance candidate and positive aggregate uses one exact `REPOSITORY_METADATA` claim class                                                                                                       | maintenance claim-class Cartesian tests         |
| `M03-AC-108` | Low-confidence or AI-only ambiguity preserves deterministic values/status/support/evidence/conflicts and routes review only without deterministic truth                                                   | AI/deterministic coexistence tests              |
| `M03-AC-109` | Every ambiguity signal cites exactly the union of its listed candidate and interpreted-proposal references                                                                                                | ambiguity reference-union tests                 |
| `M03-AC-110` | Static matching uses exact M01 lines, `giu` UTF-16 `lastIndex`, nonoverlap/overlap rules, and whole-line reference mapping                                                                                | static RegExp cursor goldens                    |
| `M03-AC-111` | Command IDLE/CONTINUING transitions define every blank/comment/indent/EOF continuation outcome                                                                                                            | continuation state-machine tests                |
| `M03-AC-112` | Source revision uses representable snapshot references while observation/source-link provenance remains identity-bound in value/projection                                                                | source-revision provenance tests                |
| `M03-AC-113` | Whole-document JSON/YAML/TOML/requirements invalidity selects one first-match warning and literal affected-field set                                                                                      | parser invalidity matrix                        |
| `M03-AC-114` | `OperationInputV1` serializes exact all/citable reference sets, source-input states, duplicate occurrences, omissions, bounds, and analysis fingerprint                                                   | operation-input envelope tests                  |
| `M03-AC-115` | One or more coherent command-bearing paths with any incomplete member use the representable `EXPLICIT_PARTIAL` review arm and retain every safe authored path                                             | mixed-completeness installation tests           |
| `M03-AC-116` | Configuration declared type, sensitive name, secret/contact defaults, retention, and exact candidate/field warning occurrences follow one precedence-ordered cross-product                                | configuration sensitivity Cartesian tests       |
| `M03-AC-117` | Contact-bearing candidate-independent references map through non-ambiguity operation rows, deduplicate affected fields, preserve deterministic truth, and remain noncitable                               | contact operation-routing tests                 |
| `M03-AC-118` | Secret/contact source, locator, and raw-output bytes may occupy only the closed Sections 11.1/11.5/16 transient exception and never cross record, persistence, provider, observability, or M04 boundaries | transient privacy/collision tests               |
| `M03-AC-119` | Bundle source references equal the canonical unique support/routing/operation/AI union, with no extra, missing, dangling, duplicate, or byte-colliding record                                             | source-reference registry-union tests           |
| `M03-AC-120` | Frozen YAML 1.2.2, TOML 1.0.0, CommonMark/GFM, front-matter delimiter/body, and literal DATA_POINTER rules yield deterministic downstream candidates and AI inputs                                        | parser-profile/front-matter boundary tests      |
| `M03-AC-121` | Installation paths serialize construction facts and a total table covers label/path mixtures while review claim class truthfully reflects exact/inferred deterministic supports                           | installation path Cartesian tests               |
| `M03-AC-122` | Configuration TYPE uses a closed `textKey` token map, rejects aliases, represents exact `UNKNOWN`, and deterministically routes every default/sensitivity overlap                                         | configuration type-token tests                  |
| `M03-AC-123` | Raw Markdown heading/block selection, inline-literal behavior, nested/duplicate ranges, and post-front-matter absolute line/byte mapping reproduce exact references                                       | Markdown raw-source locator goldens             |
| `M03-AC-124` | Every source-derived value and locator string/token is secret/contact scanned before construction; matched bytes use privacy-safe references and remain noncitable across all surfaces                    | global sensitive-value family tests             |
| `M03-AC-125` | Inferred installation mechanisms use exact Markdown provenance, `INFERENTIAL`/`FORMAT_INFERENCE`/`0.70`, structural key, exact warning behavior, and truthful review aggregation                          | inferred installation provenance tests          |
| `M03-AC-126` | Installation grouping uses discriminated null/labeled keys, preventing literal-sentinel collision while deterministically merging equal and conflicting divergent paths                                   | installation label-discriminator tests          |
| `M03-AC-127` | Configuration first-match routing covers recognized/unknown/invalid TYPE crossed with name secret/contact and default secret/contact, with exact candidate, warning, and reference outcomes               | configuration full Cartesian tests              |
| `M03-AC-128` | Sensitive locator bytes serialize only typed safe data/digest; deterministic or AI conflicts remain complete while other fields follow exact sensitive-reference precedence                               | sensitive locator privacy/adversarial tests     |
| `M03-AC-129` | Nonempty installation review claim class is `SOURCE_FACT`, `FORMAT_INFERENCE`, or `MIXED_DETERMINISTIC_SUPPORT` exactly from retained deterministic support classes                                       | installation review claim-class tests           |
| `M03-AC-130` | Sensitive warning equations fix exact candidate/field/bundle occurrences for commands, configurations, suppressed values, candidate excerpts, operation inputs, and locators                              | sensitive warning occurrence tests              |
| `M03-AC-131` | Shared sensitive-reference precedence preserves complete deterministic/AI conflicts, routes ordinary states to empty review, and retains installation/maintenance typed review safely                     | sensitive reference-precedence tests            |
| `M03-AC-132` | A safe retained candidate with unrelated sensitive excerpt uses null excerpt, `OMITTED_SENSITIVE`, no citability, exact candidate/field warnings, and conflict-preserving precedence                      | retained-candidate sensitive-excerpt tests      |
| `M03-AC-133` | Complete ordinary sensitive-locator preimages are authorized only for Section 11.1 collision checks under the same restricted transient lifecycle and zero-observability guarantees                       | locator-preimage lifecycle/collision tests      |

## 24. Persistence and migration boundary

M03 v1 defines pure contracts and an immutable returned bundle but no database tables. The existing M02 handoff
and identity rows are read-only inputs. Implementation must not update, delete, promote, or add columns to them.
No `003` migration is in scope. `pnpm db:migrate` and `pnpm db:validate` are not M03 gates unless implementation
changes a schema, which would require a separately approved specification amendment and migration authorization.

Fixture serialization on disk is test input/expected output, not production persistence. Test snapshots and
fingerprints must contain only synthetic public data and no secrets or personal contact details.

## 25. Observability

Safe events may record extraction ID, request/input/output fingerprints, opaque predecessor IDs, stage, counts,
durations, policy versions, aggregate status, and closed errors/warnings. Metrics may count attempts, parser
failures, review routing, invalid AI output, repair attempts, cancellations, and superseded inputs.

Logs/events must not contain source excerpts, exact installation commands, file contents, AI prompts/responses,
creator contact data, secrets, tokens, credentials, or unrestricted provider errors. Observability is diagnostic
and has no record or approval authority.

## 26. Implementation sequence when separately authorized

1. Reconfirm the approved whole-file SHA-256 and human implementation authorization.
2. Reinventory branch, worktree, instructions, pinned runtime, and frozen M02 hashes.
3. Add/extend versioned contracts and negative schema tests.
4. Add the real `extraction` package and dependency-boundary entry.
5. Implement deterministic parsers and fixtures before AI-assisted behavior.
6. Extend the provider-neutral analysis operation and deterministic fake.
7. Implement eligibility/orchestration, merging, limits, and immutable bundle output.
8. Run targeted tests, full regressions, security review, and the complete Section 28 gates.
9. Perform a separate independent whole-patch review.
10. Prepare an M03 report only after implementation evidence exists.

This sequence is informative until separate implementation authorization is granted. It grants no authority to
perform any step now.

## 27. Specification review gates

Before human SHA approval, the exact candidate bytes require:

1. authority-chain and scope review;
2. M02→M03 handoff consistency review;
3. field/status/claim/source-reference schema completeness review;
4. deterministic-versus-AI boundary and prompt-injection surface review;
5. version/license/install/dependency/permission/compatibility policy review;
6. idempotency, fingerprint, cancellation, supersession, and limit review;
7. M03/M04 boundary and migration-exclusion review;
8. acceptance-to-test traceability review;
9. formatting, Markdown integrity, Git diff, and secret/personal-data scan; and
10. a genuinely independent read-only verdict over the exact whole-file SHA-256.

Any blocker requires spec-only remediation and a fresh independent review of new exact bytes. Reviewers must not
edit repository files or infer human approval or implementation authorization.

## 28. Required implementation verification

When and only when implementation is separately authorized, run from repository root using Node `22.23.1`, pnpm
`11.7.0`, and the repository lockfile:

```bash
pnpm test:unit -- extraction
mkdir -p coverage/contract/extraction && pnpm test:contract -- extraction
pnpm test:fixtures -- extraction
pnpm test:adversarial -- extraction
pnpm test:integration -- extraction
pnpm test:unit -- acquisition classification identity
pnpm test:contract -- acquisition classification identity
pnpm test:fixtures -- acquisition classification identity
pnpm test:adversarial -- acquisition classification identity
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm verify
git diff --check
```

The implementation review must also run the complete existing repository test suite, validate exact fixture
counts rather than relying on an empty filtered suite, scan for secrets and unsafe acquired-source execution,
verify authority-document hashes, and inspect the whole branch diff against local `main`. A clean checkout replay
is required before `GO — M03 COMMIT READY`. A check not run is `UNPROVEN`, never a pass.

The explicit `mkdir` is permitted only during separately authorized implementation verification because the
existing contract command writes coverage output. It is not a production persistence or migration action.

## 29. GO / NO-GO rules

### 29.1 Specification readiness

`GO — M03 SPECIFICATION READY FOR HUMAN APPROVAL` requires exact-byte independent approval and all Section 27
gates. It does not authorize implementation.

Any unresolved material ambiguity, authority conflict, missing invariant, untraceable acceptance criterion,
unsafe boundary, hidden M04+ scope, or reviewer blocker is
`NO-GO — M03 SPECIFICATION NOT READY FOR HUMAN APPROVAL`.

### 29.2 Implementation readiness

After exact-SHA human approval and separate implementation authorization, `GO — M03 COMMIT READY` additionally
requires complete scoped implementation, every Section 28 gate, M00–M02 regressions, whole-diff review, and a
separate independent whole-patch approval. Green tests alone do not grant GO.

Any failed/unrun required gate, schema or source-execution violation, silent conflict/unknown, false permission or
compatibility claim, non-reproducible output, M02 mutation, migration change without authority, M04+ expansion,
secret exposure, or review blocker is `NO-GO`.

## 30. Human approval and authorization boundary

The next permitted terminal action after independent specification approval is to report:

1. the exact whole-file SHA-256 of `docs/milestones/M03_SPEC.md`;
2. the independent verdict and findings;
3. the repository diff and verification evidence; and
4. an explicit request for human approval of those exact bytes.

Only an explicit human statement approving that exact SHA-256 changes specification status. Even then,
implementation remains prohibited until the human separately authorizes M03 implementation. Specification
approval does not authorize migration changes, commit, push, pull request, merge, release, deploy, publication,
or M04+ work. Those boundaries remain separate and must be reported separately.
