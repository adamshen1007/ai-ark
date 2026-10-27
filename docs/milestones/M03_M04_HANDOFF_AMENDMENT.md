# M03/M04 Amendment — Verifiable M02 Input Projection Handoff

## 1. Status and authorization

- Document status: `CANDIDATE FOR INDEPENDENT REVIEW`.
- Amendment-preparation authorization: `GRANTED` on `2026-09-15`.
- First candidate SHA-256: `388d4fc10cde106accc13ab82b99ddd40436d36dca317bf6566e859cfb1c1887`.
- First independent-review decision: `NO-GO — M03/M04 HANDOFF AMENDMENT NOT READY FOR HUMAN APPROVAL`.
- First-review blocker closure: exact two-part predecessor validation, exhaustive V1/V2 versioning, replay/freshness
  ordering, cross-M02 transaction fencing, and truthful internal source-derived-token privacy semantics.
- Second candidate SHA-256: `d1946d9f89f217532d1cae77313cb2b4409c555f9070d16290bcc13dec917060`.
- Second independent-review decision: `NO-GO — M03/M04 HANDOFF AMENDMENT NOT READY FOR HUMAN APPROVAL`.
- Second-review blocker closure: explicit base-clause supersession and V1 rejection, complete request/projection tuple
  equality, six-arm V1/V2 result and cross-version replay matrix, and an exact singleton/trigger/ACL/lock contract.
- Third candidate SHA-256: `ab347c117bd255a6b57319c8830044e892226886b3245ca06f4ded06dff5ab87`.
- Third independent-review decision: `NO-GO — M03/M04 HANDOFF AMENDMENT NOT READY FOR HUMAN APPROVAL`.
- Third-review blocker closure: executable schema-local definer lock functions and exact role ACLs, explicit M02
  transaction-protocol supersession, and a complete strict projection schema and equality/predicate matrix.
- Fourth candidate SHA-256: `aa67d19eb0624b99d8e6e30ddc66e0c96e4a37890b3ed75bab0a51777788d165`.
- Fourth independent-review decision: `NO-GO — M03/M04 HANDOFF AMENDMENT NOT READY FOR HUMAN APPROVAL`.
- Fourth-review blocker closure: exact replacement-job canonical-payload invariants, frozen analysis/token
  constraints, closed schema-name/OID/quoting rules, transitive actual-session-role privilege validation, and
  unambiguous six-arm request/bundle precedence.
- Current-candidate independent amendment review: `AUTHORIZED; NOT YET PERFORMED`.
- Human approval of this exact whole-file SHA-256: `NOT YET GRANTED`.
- Amendment implementation authorization: `NOT GRANTED`.
- Migration modification authorization: `NOT GRANTED`.
- Commit, push, pull-request, merge, release, deployment, publication, and M05+ authorization: `NOT GRANTED`.

This document is specification-only. It does not authorize implementation, migration changes, staging, publication,
or later-milestone work. Implementation may resume only after the human product owner approves this document's
exact final whole-file SHA-256 and separately authorizes implementation against the complete authority tuple in
Section 3.

## 2. Defect and objective

Approved M04 Section 9.1 requires M04 to compare the complete M02 input projection originally consumed by M03 with
a fresh, same-transaction reconstruction of current M01/M02 predecessor state. The approved M03 bundle retains the
compound `inputFingerprint` but does not retain the complete `m02InputProjection` committed inside that fingerprint.
The durable M01/M02 schema also does not retain every byte in the compound M03 input-fingerprint preimage. M04
therefore cannot prove which M02 projection the accepted M03 bundle originally consumed.

This is an evidence-integrity defect in the M03-to-M04 handoff, not permission to weaken M04 freshness. The
amendment's objective is to make the original projection explicit, immutable, canonically hashed, included in the
M03 output fingerprint, and available for byte-for-byte same-transaction comparison by M04.

## 3. Normative authority and precedence

This amendment supplements these approved specifications:

- `docs/milestones/M03_SPEC.md`, SHA-256
  `3946c15149d08b15e50697dc83d746979f0b2a8a87abeb5dbb25a78809949f80`;
- `docs/milestones/M04_SPEC.md`, SHA-256
  `f4de3bd80f5ace68def7399944b8778e9817991a036d985be089392e72999569`.

After exact-SHA approval, the active authority is the ordered tuple `(approved M03 specification, approved M04
specification, approved amendment)`. This amendment controls only the conflicts and additions it names. All other
requirements, exclusions, bounds, error precedence, acceptance criteria, and authorization boundaries in the two
base specifications remain unchanged.

The following base requirements are superseded narrowly:

1. M03's request, command-result, and canonical output contracts gain the versioned V2 forms in Section 5.
2. Newly produced, M04-bindable requests use `M03_EXTRACTION_REQUEST_V2`; their bundles use
   `M03_EXTRACTION_V2`.
3. M04 accepts only `M03_EXTRACTION_V2` for a new binding after this amendment. Historical V1 output remains valid
   M03 evidence but is not M04-bindable.
4. M04 Section 9.1 uses the exact branch algorithm and fence in Sections 7 and 8.
5. M04's durable bundle schema and identity formulas include the V2 projection members without otherwise
   changing M04 semantics.

The following exact base clauses are also superseded; no generic preservation clause overrides this list:

| Base authority                                                                                              | Narrow supersession after amendment approval                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M03 Section 15.1 `m04Bindability: BINDABLE` for V1                                                          | Remains a historical V1 field recording the original downstream intent; it is not actionable eligibility under amended M04. V2 retains `m04Bindability: BINDABLE` with actionable amended semantics.                                                                                                                      |
| `M03-AC-21`                                                                                                 | Applies to V2 for M04 actionability. V1 conflict/missing/unsupported/review bundles remain historically valid M03 evidence but are rejected by amended M04.                                                                                                                                                               |
| M04 Section 8 “Every schema-valid M03 bundle must remain bindable” and its V1 bound row                     | Means every schema-valid `StructuredExtractionBundleV2`; the durable-byte bound uses `StructuredExtractionBundleV2Schema`.                                                                                                                                                                                                |
| M04 Section 9 V1 schema literal/eligibility                                                                 | Replaced with the strict V2 schema and literal defined here.                                                                                                                                                                                                                                                              |
| `M04-AC-32`                                                                                                 | M00-M02 remain unchanged; M03 V1 historical contracts/behavior remain unchanged; only the new versioned M03 V2 command/output and M04 V2 input behavior authorized here are exceptions.                                                                                                                                   |
| M02 Section 15.4 step 7 and its claim that the listed 22-step sequence is the only command-attempt sequence | Replaced only for transactions that can mutate a Section 8.1 covered relation: revised step 7 acquires the schema-local exclusive predecessor fence immediately after `BEGIN ISOLATION LEVEL SERIALIZABLE`, before the idempotency claim and advisory locks; steps 1-6 and 8-22 otherwise retain their order and meaning. |
| M00/M01/M02 unchanged wording in `M04-AC-32` and this amendment                                             | Excludes only the Section 8.1 fence objects, role prerequisites, and first-lock calls required for covered M01/M02 writers. All caller-visible command contracts, identities, results, attempt bounds, and domain semantics remain unchanged.                                                                             |

After—and only after—the supplied M04 request passes the frozen raw-byte, JSON, and strict request-schema gates,
supplying a schema-valid `StructuredExtractionBundleV1` to amended M04 returns exactly `REJECTED` with error
`M03_BUNDLE_SCHEMA_INVALID` and the frozen diagnostic `{code:"SCHEMA_INVALID", stage:"BUNDLE",
subjectKind:"EXTRACTION", subjectIdOrNull:null, expectedFingerprintOrNull:null,
actualFingerprintOrNull:null, observedCountOrNull:null, limitOrNull:null}`. It performs no collision lookup,
predecessor read, replay, association, or canonical write because it fails the common V2 schema gate. The
`M03_NOT_BINDABLE` arm remains reserved for a schema-valid V2 value whose V2 bindability predicate fails under a
future separately approved schema; V1 never selects that arm.

A malformed M04 request returns its earlier frozen `INVALID_REQUEST` result without parsing or accessing the
supplied bundle; therefore the V1 rejection rule never competes with malformed-request precedence.

No wording in this amendment retroactively changes the bytes, verdict, or historical evidence of the completed M03
V1 milestone.

## 4. Scope and non-goals

This amendment includes only:

- one strict canonical schema for the complete M02 input projection already defined by M03;
- one domain-separated projection fingerprint;
- two required V2 bundle members;
- V2 output-fingerprint and extraction-identity formulas;
- M04 request, validation, durable-storage, replay, collision, and freshness deltas required by those members;
- deterministic contract, mutation, collision, persistence, recovery, and regression evidence.

This amendment does not authorize or define:

- retention of acquired source-document bytes in the M03 bundle or M04 database;
- a signature, MAC, external attestation service, or new secret/key;
- changes to the M03 extraction field registry, extraction meaning, AI policy, source-reference policy, or M04
  Claim/EvidenceItem projection;
- compatibility binding of historical `M03_EXTRACTION_V1` bundles;
- mutation of migrations `001` or `002`;
- migration `004`, production migration execution, data backfill, or conversion of historical V1 bundles;
- M05 drafts, editorial approval, publication, UI, search, deployment, or release.

## 5. Amended M03 output contract

### 5.1 Reused complete projection type

`M03M02InputProjectionV1` is the complete type and canonical projection already defined normatively by approved M03
Sections 7.2 and 15. The amendment does not create a second partial projection. The exported contract schema must
encode every field, enum, nullability rule, nested replacement variant, array membership rule, and ordering rule in
that authority. Unknown or missing members fail closed.

The implementation must expose one shared `M03M02InputProjectionV1Schema` and inferred type from the inward-owned
contracts package. The M03 predecessor reader, M03 bundle schema, M04 request schema where applicable, M04
persistence adapter, and tests must import that same authority. Copying a subset or independently maintained mirror
is prohibited.

#### 5.1.1 Exhaustive strict field schema

To remove the permissive `string` placeholders in the historical implementation interface, the shared schema uses
the following exact scalar domains. `text` means any JSON string; `nonemptyText` means a JSON string containing at
least one Unicode scalar value. Those two domains add no normalization or per-member length ceiling that was absent
from the original M03 projection; their enclosing request/input/bundle limits remain the only aggregate byte bounds.
`id` is `nonemptyText`. `sha256` is `/^[0-9a-f]{64}$/`; `gitRevision` is `/^[0-9a-f]{40}$/`; `positiveBigInt` is the
canonical JSON string `/^[1-9][0-9]*$/`; `confidence` is a finite canonical JSON number in `[0,1]`; and `rfc3339` is
the exact timestamp domain already used by M03 Section 7.2. `ByteStringV1` retains the exact M03 Section 15
Base64/decoded-length contract. Every object below is strict, every listed member is required, and no unknown member
is accepted.

| Projection object         | Exact member schema                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handoff`                 | `id:id`; `resourceCandidateId:id`; `resourceIdentityId:id`; `resourceVersionIdentityId:id`; `controllingM02JobId:id`; `sourceSnapshotId:id`; `identityDecisionId:id`; `originType:HUMAN_COMMAND \| SYSTEM_IDENTITY_OPERATION`; `logicalKey:nonemptyText`; `state:ACTIVE \| SUPERSEDED`; `recordVersion:positiveBigInt`                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `acquisitionJob`          | `id:id`; `status:ACTIVE \| COMPLETED \| FAILED \| CANCELLED \| OPERATOR_REVIEW_REQUIRED`; `currentStage:RECEIVED \| VALIDATING_SOURCE \| ACQUIRING_SOURCE \| INVENTORYING_SOURCE`; `sourceSnapshotId:id`; `cancellationRequested:boolean`; `recordVersion:positiveBigInt`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `m02Job`                  | `id:id`; `jobLineageId:id`; `sourceSnapshotId:id`; `operationScope:CLASSIFICATION \| IDENTITY_RESOLUTION \| FULL_PIPELINE`; `currentStage:CLASSIFYING_REPOSITORY \| RESOLVING_IDENTITY`; `reviewState:NOT_REQUIRED \| CLASSIFICATION_REVIEW_REQUIRED \| IDENTITY_REVIEW_REQUIRED \| CLARIFICATION_REQUESTED \| RESOLVED \| REJECTED`; `supersessionState:CONTROLLING \| SUPERSEDED`; `supersededByJobIdOrNull:id \| null`; `supersessionSequence:positiveBigInt`; `controllingClassificationDecisionIdOrNull:id \| null`; `jobScopeKey:sha256`; `inputFingerprint:sha256`; each policy/profile/version member is `nonemptyText`; each analysis adapter/model/methodology member is `nonemptyText \| null`; `recordVersion:positiveBigInt`; `replacement` is exactly one discriminator arm below |
| `candidate`               | `id:id`; `sourceSnapshotId:id`; `candidateRootId:id`; `candidateRootFingerprint:sha256`; `candidateContentFingerprint:sha256`; `reconciledClassificationRunId:id`; both policy versions are `nonemptyText`; `identityOutcome:NEW_RESOURCE \| EXACT_REPEAT_REUSE \| EXISTING_RESOURCE_NEW_VERSION \| AMBIGUOUS_IDENTITY \| POSSIBLE_DUPLICATE \| FORK_OF_EXISTING_RESOURCE \| MIRROR`; `status:CLASSIFIED \| IDENTITY_REVIEW_REQUIRED \| IDENTITY_RESOLVED \| REJECTED \| SUPERSEDED`; `resourceIdentityId:id`; `resourceVersionIdentityId:id`; `recordVersion:positiveBigInt`                                                                                                                                                                                                                   |
| `resourceIdentity`        | `id:id`; `resourceType:SKILL`; `status:ACTIVE \| AMBIGUOUS \| REJECTED`; `reliableIdentityTokenOrNull:normalizedIdentityTokenV1 \| null`; `reliableTokenEvidenceIdOrNull:id \| null`; `guardAnchorCandidateId:id`; `recordVersion:positiveBigInt`; the two reliable-token members are both null or both non-null                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `resourceVersionIdentity` | `id:id`; `resourceIdentityId:id`; `contentFingerprint:sha256`; `firstObservedSourceSnapshotId:id`; `firstObservedCandidateRootId:id`; `firstObservedSourceRevision:gitRevision`; `observationLabel:/^snapshot:[0-9a-f]{12}$/`; `status:IDENTITY_RESOLVED \| SUPERSEDED \| REJECTED`; `recordVersion:positiveBigInt`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `observation`             | `id:id`; `resourceVersionIdentityId:id`; `sourceSnapshotId:id`; `candidateRootId:id`; `resourceSourceLinkId:id`; `sourceRepositoryId:id`; `provider:github`; `providerRepositoryId:nonemptyText`; `normalizedRootPath:text`; `immutableRevision:gitRevision`; `observedAt:rfc3339`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `sourceLink`              | `id:id`; `sourceRepositoryId:id`; `normalizedRootPath:text`; `targetResourceVersionId:id`; `relationship:PRIMARY \| ALTERNATE`; `decisionId:id`; `state:ACTIVE \| SUPERSEDED`; `recordVersion:positiveBigInt`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `sourceRepository`        | `id:id`; `provider:github`; `providerRepositoryId:nonemptyText`; `firstObservedSourceSnapshotId:id`; `recordVersion:positiveBigInt`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `identityDecision`        | `id:id`; `resourceCandidateId:id`; `outcome:NEW_RESOURCE \| EXACT_REPEAT_REUSE \| EXISTING_RESOURCE_NEW_VERSION \| AMBIGUOUS_IDENTITY \| POSSIBLE_DUPLICATE \| FORK_OF_EXISTING_RESOURCE \| MIRROR`; `matchedTierOrNull:P1 \| P2 \| P3 \| P4 \| P5 \| P6 \| null`; `confidenceOrNull:confidence \| null`; `identityPolicyVersion:nonemptyText`; `decisionSource:DETERMINISTIC \| AI_ASSISTED \| HUMAN_COMMAND`; `state:ACTIVE \| SUPERSEDED`; `recordVersion:positiveBigInt`                                                                                                                                                                                                                                                                                                                    |
| `candidateReviewState`    | `id:id`; `groupIdOrNull:id \| null`; `resourceCandidateId:id`; `reviewState:NOT_REQUIRED \| CLASSIFICATION_REVIEW_REQUIRED \| IDENTITY_REVIEW_REQUIRED \| CLARIFICATION_REQUESTED \| RESOLVED \| REJECTED \| SUPERSEDED`; `supersededByReviewIdOrNull:id \| null`; `recordVersion:positiveBigInt`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `candidateRoot`           | `id:id`; `groupId:id`; `classificationRunId:id`; `sourceSnapshotId:id`; `normalizedRootPath:text`; `candidateRootFingerprint:sha256`; `candidateContentFingerprint:sha256`; `state:ACTIVE \| SUPERSEDED`; `recordVersion:positiveBigInt`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

For `m02Job`, the policy/profile/version members are exactly `classificationPolicyVersion`,
`identityPolicyVersion`, `analysisPolicyVersion`, `parserProfileVersion`, and `promptBundleVersion`; the nullable
analysis members are exactly `analysisProviderAdapterIdOrNull`, `analysisModelIdOrNull`, and
`analysisMethodologyVersionOrNull`. Those three analysis members are either all null or all non-null.
`normalizedIdentityTokenV1` is an already-normalized value under frozen M02 Section 6.2: Unicode NFKC plus Unicode
15.1 Default Case Folding, White_Space/ASCII underscore/ASCII hyphen runs mapped to one ASCII hyphen, trimmed of
leading/trailing hyphens, containing only Unicode letters, Unicode decimal numbers, or ASCII hyphen, and containing
exactly `1..128` Unicode scalar values. The `replacement` discriminator is exhaustive:

- `ORIGINAL` has `kind:ORIGINAL`; `reasonCodeOrNull`, `inputPayloadOrNull`, `inputFingerprintOrNull`,
  `sourceJobIdOrNull`, `sourceOperationScopeOrNull`, `requestedOperationScopeOrNull`,
  `originalSourceSnapshotIdOrNull`, and `replacementSourceSnapshotIdOrNull` all exactly `null`; and
  `predecessorJobIds` exactly `[]`.
- `REPLACEMENT` has `kind:REPLACEMENT`; `reasonCode` exactly one of `FAILED_STAGE_REPLACEMENT`,
  `RETRY_EXHAUSTED`, `NEW_SUPPORTED_SNAPSHOT`, `POLICY_OR_METHODOLOGY_CHANGE`, or
  `ADMINISTRATIVE_CORRECTION`; `inputPayloadOrNull:ByteStringV1`; `inputFingerprintOrNull:sha256`;
  `sourceJobIdOrNull:id`; both operation-scope members use the exact three-value `operationScope` union;
  `requestedOperationScopeOrNull = m02Job.operationScope`; `predecessorJobIds` is a nonempty unique canonical-sort
  array of `id`; `originalSourceSnapshotIdOrNull:id`; and `replacementSourceSnapshotIdOrNull:id | null`.

For `REPLACEMENT`, decoded `inputPayloadOrNull` bytes must be canonical JSON for exactly the frozen
`JobReplacementInputV1` object: `{schemaVersion:"1", jobLineageId, sourceJobId, sourceOperationScope,
requestedOperationScope, predecessorJobIds, sourceSnapshotId, replacementSourceSnapshotIdOrNull,
classificationPolicyVersion, identityPolicyVersion, analysisPolicyVersion, parserProfileVersion,
promptBundleVersion, analysisProviderAdapterIdOrNull, analysisModelIdOrNull, analysisMethodologyVersionOrNull,
controllingClassificationDecisionIdOrNull}`. Every member byte-equals the same-named `m02Job` member, except
`sourceJobId = sourceJobIdOrNull`, `sourceOperationScope = sourceOperationScopeOrNull`,
`requestedOperationScope = requestedOperationScopeOrNull`, `sourceSnapshotId = originalSourceSnapshotIdOrNull`,
and `replacementSourceSnapshotIdOrNull = replacementSourceSnapshotIdOrNull`. SHA-256 of those decoded exact bytes
must equal `inputFingerprintOrNull`. Any parse, canonicality, equality, list-order, or hash failure is schema-invalid.

The strict schema must also enforce the complete Section 5.5 equality/predicate matrix. A field mutation test is
required for every scalar, discriminator, nullability relation, enum member family, regex/bound, equality, and
eligibility predicate; testing only representative rows is insufficient.

### 5.2 Projection fingerprint

The canonical projection preimage is exactly:

```ts
type M03M02InputProjectionFingerprintPreimageV1 = {
  schemaVersion: "M03_M02_INPUT_PROJECTION_FINGERPRINT_V1";
  m02InputProjection: M03M02InputProjectionV1;
};
```

The formula is:

```text
m02InputProjectionCanonicalBytes = canonicalJsonM03({
  schemaVersion: "M03_M02_INPUT_PROJECTION_FINGERPRINT_V1",
  m02InputProjection
})

m02InputProjectionFingerprint = lowercaseHex(
  SHA-256(UTF-8(m02InputProjectionCanonicalBytes))
)
```

`canonicalJsonM03` is the frozen M03 canonical JSON authority. The schema-version member is the domain separator.
No wall clock, request idempotency key, database sequence, or mutable M04 value enters this formula. Equal hashes
never substitute for byte equality when both preimages are available.

### 5.3 Exact two-part predecessor validation

The eleven mutable versions and the six immutable/set fingerprint expectations are separate authorities. Mutable
versions are derived from `m02InputProjection`; fingerprint expectations are verified from their own canonical
preimages. Neither authority may be inferred from the other.

The mutable-version mapping is exhaustive:

| Expected version key       | Exact `m02InputProjection` source       |
| -------------------------- | --------------------------------------- |
| `acquisitionJob`           | `acquisitionJob.recordVersion`          |
| `controllingM02Job`        | `m02Job.recordVersion`                  |
| `handoffMarker`            | `handoff.recordVersion`                 |
| `candidate`                | `candidate.recordVersion`               |
| `resourceIdentity`         | `resourceIdentity.recordVersion`        |
| `resourceVersionIdentity`  | `resourceVersionIdentity.recordVersion` |
| `resourceSourceLink`       | `sourceLink.recordVersion`              |
| `sourceRepositoryIdentity` | `sourceRepository.recordVersion`        |
| `identityDecision`         | `identityDecision.recordVersion`        |
| `candidateReviewState`     | `candidateReviewState.recordVersion`    |
| `candidateRoot`            | `candidateRoot.recordVersion`           |

Every mapped value must byte-equal the corresponding
`bundle.expectedPredecessorState.mutableRecordVersions` member.

The six `bundle.expectedPredecessorState.fingerprintExpectations` values remain the exact output-bound fingerprints
already required by approved M03 Section 7.2. They are not derived from `m02InputProjection`, and this amendment does
not retain their original canonical preimages. For a new M04 binding, the shared reader reconstructs each complete
current Section 7.2 preimage independently from durable M01/M02 state, hashes it with the frozen formula, and compares
that hash with the same-named retained expectation. This preserves the existing M03 privacy boundary: provider
metadata strings and exact set preimages do not cross into the M03 output or M04 persistence.

The retained expected fingerprints are cryptographically bound by the existing V2 output-fingerprint formula.
Collision checking compares byte preimages whenever both are available. The six original preimages are intentionally
unavailable at M04 and remain opaque committed fingerprint expectations under the same explicit unavailable-preimage
rule already used by approved M03; M04 must not claim original-preimage byte equality for them.

### 5.4 V2 request and command-result version matrix

The frozen V1 schemas and behavior remain byte-semantic historical authorities. V2 adds new named schemas; no V1
schema becomes a V1/V2 union.

| Concern                        | Historical V1                                                         | New M04-bindable V2                                                   |
| ------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Request schema/type            | `ExtractionRequestV1Schema` / `ExtractionRequestV1`                   | `ExtractionRequestV2Schema` / `ExtractionRequestV2`                   |
| Request literal                | `M03_EXTRACTION_V1`                                                   | `M03_EXTRACTION_REQUEST_V2`                                           |
| Basic request schema/type      | `BasicExtractionRequestV1Schema` / `BasicExtractionRequestV1`         | `BasicExtractionRequestV2Schema` / `BasicExtractionRequestV2`         |
| Input-preimage `schemaVersion` | `M03_EXTRACTION_V1`                                                   | `M03_EXTRACTION_REQUEST_V2`                                           |
| Bundle schema/type             | `StructuredExtractionBundleV1Schema` / `StructuredExtractionBundleV1` | `StructuredExtractionBundleV2Schema` / `StructuredExtractionBundleV2` |
| Bundle literal                 | `M03_EXTRACTION_V1`                                                   | `M03_EXTRACTION_V2`                                                   |
| Extraction-ID `schemaVersion`  | `M03_EXTRACTION_V1`                                                   | `M03_EXTRACTION_V2`                                                   |
| Outer result schema/type       | `ExtractionCommandResultV1Schema` / `ExtractionCommandResultV1`       | `ExtractionCommandResultV2Schema` / `ExtractionCommandResultV2`       |
| M04 new-binding eligibility    | prohibited                                                            | required                                                              |

`ExtractionRequestV2` is exactly V1 with only the request literal replaced. Its request-fingerprint and compound
input-fingerprint formulas use `M03_EXTRACTION_REQUEST_V2` from the request. `ExtractionCommandResultV2` has the
same five post-schema attempt arms plus the pre-domain `INVALID_REQUEST` arm, for exactly six outer arms with the
same error codes, safe diagnostics, and cross-field rules as V1; its `BUNDLE`
variant contains only `StructuredExtractionBundleV2`; every variant's request fingerprint is computed from the V2
request. The V2 command entry point accepts only V2 requests and returns only V2 results.

V1 and V2 idempotency, request-fingerprint, effective-tuple, and terminal-replay namespaces cannot join because the
request schema literal participates in all request/input identities. A V1 idempotency key used with V2 is treated
under the existing exact idempotency-key-reuse rule; it does not upgrade or replay V1 output. The historical V1
entry point, schemas, fixtures, and result parser remain available and unchanged.

`ExtractionCommandResultV2` has exactly these six outer arms:

```text
{kind: INVALID_REQUEST, rawRequestDigest, errorCode: REQUEST_SCHEMA_INVALID,
 safeContext: {phase: REQUEST_VALIDATION}} |
{kind: BUNDLE, requestFingerprint, extractionId, bundle: StructuredExtractionBundleV2} |
{kind: REJECTED, requestFingerprint, errorCode: EligibilityErrorV1, safeContext: SafeContextV1} |
{kind: FAILED, requestFingerprint, errorCode: ProcessingErrorV1, diagnostic: ExtractionDiagnosticV1} |
{kind: CANCELLED, requestFingerprint, errorCode: CANCELLED, diagnostic: ExtractionDiagnosticV1} |
{kind: SUPERSEDED_INPUT, requestFingerprint, errorCode: SUPERSEDED_INPUT,
 diagnostic: ExtractionDiagnosticV1}
```

`INVALID_REQUEST` alone has no request fingerprint, extraction ID, or bundle. The other five post-schema arms carry
the V2 request fingerprint. `BUNDLE` outer identities byte-equal its V2 bundle identities. All inherited V1 error,
diagnostic, safe-context, nullability, and provisional-output-discard rules remain exact in V2.

Cross-version behavior is exhaustive:

| Existing retained state                                          | Supplied input                   | Result                                                               |
| ---------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| none                                                             | malformed V1 or V2 request bytes | matching version's `INVALID_REQUEST`; no retained state              |
| V1 key or request fingerprint                                    | V1 request                       | frozen V1 replay/join/terminal behavior                              |
| V2 key or request fingerprint                                    | V2 request                       | amended V2 replay/join/terminal behavior                             |
| V1 idempotency key                                               | V2 request                       | V2 post-schema `REJECTED/IDEMPOTENCY_KEY_REUSED`; no V1 join or work |
| V2 idempotency key                                               | V1 request                       | V1 post-schema `REJECTED/IDEMPOTENCY_KEY_REUSED`; no V2 join or work |
| V1 effective tuple only                                          | V2 request                       | namespaces differ; execute V2 normally, never join V1 output         |
| V2 effective tuple only                                          | V1 request                       | execute/replay only under frozen V1 rules, never join V2 output      |
| equal injected hash across versions with byte-distinct preimages | either version                   | that version's exact collision failure before key/tuple replay       |

Direct tests must cover every table row for same key, new key, same/different effective tuple, each of the six
terminal arms, and injected equal-hash/different-byte preimages in both directions.

### 5.5 StructuredExtractionBundleV2

`StructuredExtractionBundleV2` is the complete approved `StructuredExtractionBundleV1` shape with these exact
changes and no others:

```ts
type StructuredExtractionBundleV2 = Omit<
  StructuredExtractionBundleV1,
  "schemaVersion" | "outputFingerprint"
> & {
  schemaVersion: "M03_EXTRACTION_V2";
  m02InputProjection: M03M02InputProjectionV1;
  m02InputProjectionFingerprint: Sha256;
  outputFingerprint: Sha256;
};
```

The members `m02InputProjection` and `m02InputProjectionFingerprint` are required and non-null. They appear in the
human-readable contract after `inputFingerprint` and before `outputFingerprint`; canonical object-key sorting
remains authoritative for bytes.

The V2 `m02` summary mapping is exhaustive:

| `bundle.m02` member             | Exact retained projection source and required cross-equality                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handoffMarkerId`               | `handoff.id`                                                                                                                                                                                |
| `controllingM02JobId`           | `handoff.controllingM02JobId` = `m02Job.id`                                                                                                                                                 |
| `identityDecisionId`            | `handoff.identityDecisionId` = `identityDecision.id`                                                                                                                                        |
| `m02ReviewStateId`              | `candidateReviewState.id`                                                                                                                                                                   |
| `resourceCandidateId`           | `handoff.resourceCandidateId` = `candidate.id` = `identityDecision.resourceCandidateId`                                                                                                     |
| `resourceIdentityId`            | `handoff.resourceIdentityId` = `candidate.resourceIdentityId` = `resourceIdentity.id` = `resourceVersionIdentity.resourceIdentityId`                                                        |
| `resourceVersionIdentityId`     | `handoff.resourceVersionIdentityId` = `candidate.resourceVersionIdentityId` = `resourceVersionIdentity.id` = `observation.resourceVersionIdentityId` = `sourceLink.targetResourceVersionId` |
| `resourceVersionObservationId`  | `observation.id`                                                                                                                                                                            |
| `resourceSourceLinkId`          | `observation.resourceSourceLinkId` = `sourceLink.id`                                                                                                                                        |
| `sourceRepositoryId`            | `observation.sourceRepositoryId` = `sourceLink.sourceRepositoryId` = `sourceRepository.id`                                                                                                  |
| `candidateRootId`               | `candidate.candidateRootId` = `candidateRoot.id` = `observation.candidateRootId`                                                                                                            |
| `sourceSnapshotId`              | `handoff.sourceSnapshotId` = `m02Job.sourceSnapshotId` = `candidate.sourceSnapshotId` = `candidateRoot.sourceSnapshotId` = `observation.sourceSnapshotId`                                   |
| `sourceRevision`                | `observation.immutableRevision`; it also equals the source-snapshot immutable revision reconstructed for the same eligibility read                                                          |
| `candidateContentFingerprint`   | `candidate.candidateContentFingerprint` = `candidateRoot.candidateContentFingerprint`                                                                                                       |
| `firstObservedSourceSnapshotId` | `resourceVersionIdentity.firstObservedSourceSnapshotId`                                                                                                                                     |
| `firstObservedSourceRevision`   | `resourceVersionIdentity.firstObservedSourceRevision`                                                                                                                                       |

Every equality in this table is mandatory. The request's corresponding identity and lineage fields must also
byte-equal this summary under the approved M03 request-to-bundle rules.

The V2 request-to-projection mapping is exhaustive:

| V2 request member                                  | Exact retained projection equality                                                                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `m02HandoffMarkerId`                               | `handoff.id`                                                                                                                                              |
| `controllingM02JobId`                              | `handoff.controllingM02JobId` = `m02Job.id`                                                                                                               |
| `identityDecisionId`                               | `handoff.identityDecisionId` = `identityDecision.id`                                                                                                      |
| `m02ReviewStateId`                                 | `candidateReviewState.id`                                                                                                                                 |
| `resourceCandidateId`                              | `handoff.resourceCandidateId` = `candidate.id`                                                                                                            |
| `resourceIdentityId`                               | `handoff.resourceIdentityId` = `candidate.resourceIdentityId` = `resourceIdentity.id`                                                                     |
| `resourceVersionIdentityId`                        | `handoff.resourceVersionIdentityId` = `candidate.resourceVersionIdentityId` = `resourceVersionIdentity.id`                                                |
| `resourceVersionObservationId`                     | `observation.id`                                                                                                                                          |
| `resourceSourceLinkId`                             | `observation.resourceSourceLinkId` = `sourceLink.id`                                                                                                      |
| `sourceRepositoryId`                               | `observation.sourceRepositoryId` = `sourceLink.sourceRepositoryId` = `sourceRepository.id`                                                                |
| `sourceSnapshotId`                                 | `handoff.sourceSnapshotId` = `m02Job.sourceSnapshotId` = `candidate.sourceSnapshotId` = `candidateRoot.sourceSnapshotId` = `observation.sourceSnapshotId` |
| `sourceRevision`                                   | `observation.immutableRevision` and the same-read source-snapshot immutable revision                                                                      |
| `candidateRootId`                                  | `candidate.candidateRootId` = `candidateRoot.id` = `observation.candidateRootId`                                                                          |
| `candidateRootFingerprint`                         | `candidate.candidateRootFingerprint` = `candidateRoot.candidateRootFingerprint`                                                                           |
| `candidateContentFingerprint`                      | `candidate.candidateContentFingerprint` = `candidateRoot.candidateContentFingerprint` = `resourceVersionIdentity.contentFingerprint`                      |
| `expectedPredecessorState.mutableRecordVersions`   | exact Section 5.3 eleven-member mapping                                                                                                                   |
| `expectedPredecessorState.fingerprintExpectations` | independently recomputed same-read Section 7.2 fingerprints                                                                                               |

`policyVersions`, `analysisConfiguration`, and `analysisConfigurationFingerprint` retain their frozen request/input/
bundle mappings and are not M02 projection members.

The retained projection's complete internal equality matrix is:

1. `handoff.resourceCandidateId = candidate.id`;
2. `handoff.resourceIdentityId = candidate.resourceIdentityId = resourceIdentity.id`;
3. `handoff.resourceVersionIdentityId = candidate.resourceVersionIdentityId = resourceVersionIdentity.id`;
4. `handoff.controllingM02JobId = m02Job.id`;
5. `handoff.identityDecisionId = identityDecision.id`;
6. `handoff.sourceSnapshotId = m02Job.sourceSnapshotId = candidate.sourceSnapshotId = candidateRoot.sourceSnapshotId = observation.sourceSnapshotId`;
7. `candidate.candidateRootId = candidateRoot.id = observation.candidateRootId`;
8. `candidate.candidateRootFingerprint = candidateRoot.candidateRootFingerprint`;
9. `candidate.reconciledClassificationRunId = candidateRoot.classificationRunId`;
10. `candidate.classificationPolicyVersion = m02Job.classificationPolicyVersion`;
11. `candidate.identityPolicyVersion = m02Job.identityPolicyVersion = identityDecision.identityPolicyVersion`;
12. `candidate.candidateContentFingerprint = candidateRoot.candidateContentFingerprint = resourceVersionIdentity.contentFingerprint`;
13. `resourceVersionIdentity.resourceIdentityId = resourceIdentity.id`;
14. `observation.resourceVersionIdentityId = resourceVersionIdentity.id = sourceLink.targetResourceVersionId`;
15. `observation.resourceSourceLinkId = sourceLink.id`;
16. `observation.sourceRepositoryId = sourceLink.sourceRepositoryId = sourceRepository.id`;
17. `observation.normalizedRootPath = sourceLink.normalizedRootPath = candidateRoot.normalizedRootPath`;
18. `observation.provider = sourceRepository.provider` and
    `observation.providerRepositoryId = sourceRepository.providerRepositoryId`;
19. `sourceLink.decisionId = identityDecision.id`;
20. `identityDecision.resourceCandidateId = candidate.id`;
21. `candidateReviewState.resourceCandidateId = candidate.id`;
22. `acquisitionJob.id = m02Job.id = handoff.controllingM02JobId`;
23. `acquisitionJob.sourceSnapshotId = m02Job.sourceSnapshotId = handoff.sourceSnapshotId =
observation.sourceSnapshotId`;
24. `m02Job.controllingClassificationDecisionIdOrNull = candidate.reconciledClassificationRunId =
candidateRoot.classificationRunId` for an eligible V2 projection, so the controller is non-null;
25. `candidate.identityOutcome = identityDecision.outcome`.

The projection-level predicate matrix is also exhaustive for V2 eligibility: `handoff.state=ACTIVE`;
`acquisitionJob.status=COMPLETED`; `acquisitionJob.cancellationRequested=false`;
`m02Job.supersessionState=CONTROLLING`; `candidate.status=IDENTITY_RESOLVED`;
`resourceIdentity.status=ACTIVE`; `resourceVersionIdentity.status=IDENTITY_RESOLVED`; `sourceLink.state=ACTIVE`;
`identityDecision.state=ACTIVE`; `candidateReviewState.reviewState` is exactly `NOT_REQUIRED` or `RESOLVED` and
`candidateReviewState.supersededByReviewIdOrNull=null`; `candidateRoot.state=ACTIVE`; the current review row is
unique for the candidate and no candidate- or controlling-group-scoped active review row exists. The complete
ownership/root-order topology and same-read source snapshot/acquisition result/provider metadata predicates remain
the independently reconstructed six-fingerprint authority in Section 5.3. Each equality and predicate is a
separate required negative mutation test.

The same-read source-snapshot projection must match `observation.provider`, `observation.providerRepositoryId`,
`observation.immutableRevision`, and the common current snapshot ID before its fingerprint comparison. The
ResourceVersion's `firstObservedSourceSnapshotId`, `firstObservedCandidateRootId`, and
`firstObservedSourceRevision`, and the source repository's `firstObservedSourceSnapshotId`, are historical lineage.
They must match their own retained/request summary fields where specified but need not equal the current observation
snapshot, root, or revision. This is the intentional exact-repeat/reuse exception; no implementation may impose a
false current-equals-first-observed rule.

The V2 schema must refine all of the following:

1. recomputing Section 5.2 over `m02InputProjection` byte-equals
   `m02InputProjectionFingerprint`;
2. every identity and lineage member in `bundle.m02` byte-equals its authoritative value in
   `m02InputProjection`;
3. the eleven mutable versions match the exact Section 5.3 mapping;
4. all six `expectedPredecessorState.fingerprintExpectations` remain strict lowercase SHA-256 values and are not
   falsely derived from the row projection;
5. `bundle.inputFingerprint` uses the unchanged compound formula with the V2 request literal explicitly supplied
   as its preimage `schemaVersion`;
6. the complete bundle satisfies every existing M03 registry, cross-reference, sorting, bound, privacy, and
   bindability invariant.

### 5.6 V2 output and extraction identity

For V2, the approved M03 formulas remain unchanged except for their explicit V2 inputs:

```text
extractionId = "ext_" + SHA-256(canonicalJsonM03({
  schemaVersion: "M03_EXTRACTION_V2",
  resourceVersionIdentityId,
  resourceVersionObservationId,
  inputFingerprint,
  analysisResultFingerprint
}))

outputFingerprint = SHA-256(canonicalJsonM03(
  complete StructuredExtractionBundleV2 excluding exactly {
    outputFingerprint,
    createdAt,
    analysisAttempts[*].durationMsOrNull,
    analysisAttempts[*].tokenCountsOrNull,
    analysisAttempts[*].providerRequestIdOrNull
  }
))
```

Because the complete `m02InputProjection` and `m02InputProjectionFingerprint` are not excluded, both are bound by
the V2 output fingerprint, together with the already-retained complete `expectedPredecessorState`. M03 must recompute
the projection and output fingerprints before emitting a bundle. Same-hash/different-byte retained preimages fail
closed whenever both preimages are available.

## 6. M03 production and compatibility behavior

After separately authorized implementation:

1. The V2 command path validates only `ExtractionRequestV2`.
2. M03's authoritative predecessor reader constructs and schema-validates the complete projection and independently
   recomputes all six Section 7.2 expectations in one consistent eligibility read.
3. That exact projection instance and the request's exact expected state are used in the existing compound
   `inputFingerprint` preimage with `schemaVersion: "M03_EXTRACTION_REQUEST_V2"`.
4. The same projection instance is placed in the V2 bundle without reconstruction or field picking; the six
   fingerprint preimages remain transient and do not enter the bundle.
5. M03 computes the projection fingerprint, extraction ID, and output fingerprint in that order.
6. M03 parses the complete V2 bundle and `ExtractionCommandResultV2` before returning them.

The V1 schema and type remain exported only for historical parsing and frozen M03 evidence. The normal M03 command
path emits V2 after implementation. After a schema-valid M04 request, M04 returns exactly the Section 3
`REJECTED/M03_BUNDLE_SCHEMA_INVALID` result for V1 input and writes nothing. No automatic V1-to-V2 upgrade is
permitted because the missing original projection cannot be recovered from V1 bytes.

V2 does not retain raw or unbounded acquired source-document bytes in the output. Those bytes remain committed by
the compound `inputFingerprint`; the projection required for M04 freshness is independently retained and
bound by the V2 output fingerprint.

## 7. Amended M04 validation and freshness algorithm

The frozen M04 collision-before-idempotency and accepted-replay-before-current-freshness rules remain authoritative.
M04 uses the following exhaustive branches; no implementation may interleave their ordering.

### 7.1 Common pre-transaction validation

For every request, before database access:

1. execute the frozen M04 raw-request bound, JSON, and strict request-schema precedence;
2. validate `StructuredExtractionBundleV2` before inspecting bindability or M04 bounds;
3. recompute the supplied V2 extraction identity, projection fingerprint, output fingerprint, and existing
   logical/canonical payload hashes;
4. compare every supplied internal cross-equality and all simultaneously available retained preimage bytes;
5. derive the complete request, semantic-request, bundle, projection, output, logical, canonical, EvidenceItem,
   Claim, link, completeness, binding, and result identities needed for database collision queries.

A supplied schema, canonicalization, lineage, or internal fingerprint failure returns its frozen exact terminal arm
without database write. This phase does not read mutable predecessor state.

### 7.2 Common transaction collision phase

M04 begins a Serializable transaction, acquires the frozen M04 transaction-scoped locks, then queries every primary,
alternate-unique, fingerprint, logical, canonical, projection, output, binding, and result domain that can match a
retained row. Equal hashes/IDs are accepted only after byte-equality of their complete retained canonical preimages.
Any same-hash/different-byte value returns `CONTENT_HASH_COLLISION` and rolls back before idempotency, replay,
freshness, or association insertion. This phase also detects collisions in corrupt stored rows before a replay can
mask them.

### 7.3 Exact-key accepted replay

If the idempotency key already names an accepted request with byte-identical complete request bytes:

1. load the complete stored V2 bundle, child projection, completeness, binding, result, and request association;
2. validate every stored schema, canonical byte sequence, hash, ID, relational tuple, formula, and cross-reference;
3. compare the supplied request/bundle semantic identity with the stored accepted identity under frozen M04 replay
   rules;
4. roll back on any corruption or mismatch; otherwise commit no write and return the stored result with
   `replayed: true`.

This branch does not acquire the predecessor fence or re-adjudicate mutable predecessor state.

If the key exists with different complete request bytes, return the frozen exact `IDEMPOTENCY_KEY_REUSED` arm after
the common collision phase and write nothing.

### 7.4 New-key, same-semantic accepted replay

If no key match exists but the semantic request identifies an accepted binding:

1. load and validate the same complete stored closure required by Section 7.3;
2. validate the supplied V2 identity against that stored closure;
3. only after validation, insert the new request association inside the current transaction;
4. reload and byte-validate the inserted association and unchanged accepted closure;
5. commit and return the stored result with `replayed: true`.

This branch does not acquire the predecessor fence or re-adjudicate mutable predecessor state. Any validation or
insert/round-trip failure rolls back, leaving row counts unchanged.

### 7.5 Existing-content non-replay branch

If retained content/binding rows match an extraction, input, projection, output, logical, or canonical identity but
the request is neither an exact nor semantic replay, M04 validates the complete stored closure and applies the frozen
M04 existing-binding mismatch/collision precedence. It never joins unequal semantic requests merely because one
hash or extraction ID matches. This branch writes nothing unless it resolves to Section 7.4.

### 7.6 New canonical binding

Only when Sections 7.3 through 7.5 find no accepted replay or existing-content terminal result does M04:

1. acquire the predecessor fence in Section 8.1;
2. use the shared complete M03 predecessor reader to reconstruct the current row projection and all six exact
   canonical fingerprint preimages under that fenced transaction snapshot;
3. schema-validate and canonicalize the reconstructed values;
4. compare all eleven current mutable versions with the original retained projection and expected versions;
5. recompute all six current fingerprints from their complete current Section 7.2 preimages and compare each with
   the same-named output-bound expected fingerprint;
6. byte-compare the complete current and original `m02InputProjection` canonical bytes and projection fingerprints;
7. re-evaluate every approved M03 eligibility/controller predicate and every M04 eligibility rule;
8. repeat collision preflight for every identity derived from the fenced reconstruction;
9. persist and round-trip-validate the complete M04 closure before commit.

Any absent row, schema failure, predicate failure, fingerprint mismatch, or projection byte mismatch returns the
existing exact `PREDECESSOR_NOT_CURRENT`, `M03_BUNDLE_SCHEMA_INVALID`, `LINEAGE_MISMATCH`, or
`CONTENT_HASH_COLLISION` arm according to frozen M04 precedence. This amendment adds no public terminal code.
Failure rolls back every canonical row and request association.

## 8. Durable M04 storage and collision closure

Migration `003` remains the M04-owned forward-only migration. Any amendment implementation change to its candidate
bytes requires the normal exact hash, migration-contract, clean-database, interruption, catalog, recovery, and
independent-review gates. Migrations `001` and `002` remain byte-frozen.

### 8.1 Cross-M02 predecessor fence

Let `S` be the configured target schema already selected by the migration runner. Its exact accepted byte domain is
ASCII `/^[a-z][a-z0-9_]{0,62}$/`; its UTF-8 byte length is therefore `1..63`. Values beginning `pg_`, the exact
`information_schema`, every `pg_temp_*`/`pg_toast*` spelling, NUL, non-ASCII, uppercase, quote, whitespace,
punctuation, overlength value, or value that PostgreSQL would truncate or alias are rejected before connection or
SQL construction as `M04_DATABASE_SCHEMA_INVALID`. `public` remains valid.

The one quote algorithm is: validate the preceding byte domain, then surround the unchanged ASCII bytes with
double-quote bytes, doubling any internal double quote (the validated domain contains none). No driver-default,
`search_path`, server encoding, locale, or identifier truncation may alter it. After connecting, the migration
runner resolves exactly one non-system `pg_namespace` row whose `nspname` byte-equals `S`, retains its OID, and
requires every renderer, adapter, ACL query, catalog expectation, dump, and restore check to name that same OID and
byte-equal `nspname`. Zero/multiple rows, an OID/name change, or a system/temporary namespace fails closed. Nothing
in this contract is hard-coded to `public`, and no untrusted value is concatenated into executable SQL.

The migration renderer captures `S` once before applying `003` and renders each `<S>` token below as that exact
quoted identifier. The rendered migration bytes and `S` are recorded by migration evidence. Migration `003` must
add one internal singleton row in `S`:

```sql
CREATE TABLE <S>.m03_m04_predecessor_fence (
  singleton_key boolean PRIMARY KEY DEFAULT true CHECK (singleton_key = true),
  epoch bigint NOT NULL CHECK (epoch >= 1)
);

INSERT INTO <S>.m03_m04_predecessor_fence (singleton_key, epoch) VALUES (true, 1);
```

Exactly one row with `singleton_key = true` is inserted by the migration. The table and row are internal concurrency
authority, not product data. The exact prerequisite NOLOGIN group roles are `ai_ark_m04_runtime` and
`ai_ark_m01_m02_writer`; they must already exist, must not be superusers, migration owners, or members of each
other, and must be `NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION`. Environment-specific LOGIN
roles receive membership outside this migration.
Absence or privilege drift of either group role makes migration/catalog validation fail closed.
Both group roles have `USAGE` but not `CREATE` on `S`; `PUBLIC` has no `CREATE` on `S`. Those schema ACL predicates
are validated without otherwise changing unrelated schema grants.

The database validator requires exact configuration values `AI_ARK_M04_DATABASE_LOGIN_ROLE` and
`AI_ARK_M01_M02_DATABASE_LOGIN_ROLE`. Each uses the same ASCII `1..63` identifier domain as `S`, must resolve to
one distinct LOGIN role, and must equal the session role used by its corresponding adapter. The M04 LOGIN has one
direct inheritable membership in `ai_ark_m04_runtime` and no membership/`SET ROLE` path to
`ai_ark_m01_m02_writer`; the writer LOGIN has the converse. Neither LOGIN nor any recursively reachable role may
be superuser, `BYPASSRLS`, `CREATEROLE`, `CREATEDB`, replication-enabled, the migration owner, an owner of `S` or
any fence object, or able to `SET ROLE` to such a role. Recursive membership validation covers both inherited and
settable paths, not only direct grants.

For each actual LOGIN, the validator uses PostgreSQL effective-privilege functions in a transaction entered as that
session role. Both must have `USAGE` and not `CREATE` on `S`; neither may have any direct or inherited fence-table
privilege or bump-function execution. The M04 LOGIN must execute only the shared lock function and must be denied
the exclusive function; the writer LOGIN must execute only the exclusive function and must be denied the shared
function. A hostile third LOGIN with only `PUBLIC` privileges must be denied the table and all three functions.
Any direct grant, transitive membership, role attribute, owner path, schema privilege, or effective-privilege drift
fails migration validation and prevents application startup.

Migration `003` creates these exact schema-local functions, both `LANGUAGE plpgsql SECURITY DEFINER`, owned by the
migration owner and declared `SET search_path = pg_catalog`:

- `<S>.m03_m04_lock_predecessor_shared()` returns `bigint`, performs the schema-qualified singleton `SELECT epoch
... FOR SHARE`, raises SQLSTATE `55000` with exact message `M03_M04_PREDECESSOR_FENCE_INVALID` unless exactly one
  row is found, and otherwise returns that epoch;
- `<S>.m03_m04_lock_predecessor_exclusive()` returns `bigint`, performs the same schema-qualified singleton
  `SELECT epoch ... FOR UPDATE`, applies the same exact closed error, and otherwise returns that epoch.

Each lock function is rendered from this exact body, substituting only function name and `SHARE` versus `UPDATE`:

```sql
DECLARE
  locked_epoch bigint;
  affected_rows bigint;
BEGIN
  SELECT epoch INTO locked_epoch
  FROM <S>.m03_m04_predecessor_fence
  WHERE singleton_key = true
  FOR <SHARE_OR_UPDATE>;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'M03_M04_PREDECESSOR_FENCE_INVALID';
  END IF;
  RETURN locked_epoch;
END;
```

The rendered function bodies contain the quoted literal schema identifier captured as `S`; they do not resolve an
object from caller `search_path`, accept a schema/table argument, or use caller-controlled dynamic SQL. Before any
predecessor read in the new-canonical-binding branch, M04 calls exactly
`SELECT <S>.m03_m04_lock_predecessor_shared()`. Its row lock is held through commit or rollback. M01/M02 covered
writers call exactly `SELECT <S>.m03_m04_lock_predecessor_exclusive()` at the position defined below.

Migration `003` installs statement-level mutation triggers for `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE` on this
exact closed predecessor relation set:

```text
acquisition_jobs
acquisition_results
candidate_root_ownership
candidate_roots
identity_decisions
m01_source_documents
m01_source_entries
m02_identity_handoff_markers
m02_jobs
m02_review_states
repository_candidate_root_order
resource_candidates
resource_identities
resource_source_links
resource_version_identities
resource_version_observations
source_repository_identities
source_snapshots
```

The shared reader's declared dependency list must byte-equal this list in unsigned UTF-8 order. Adding a reader
relation without amending the list, or omitting/adding a trigger relative to the list, fails the contract and exact
catalog validator. The list covers all eleven mutable-row owners plus every relation contributing snapshot,
acquisition-result, observation, provider-metadata, ownership-topology, root-order, review-state-set, source-entry,
and source-document projections.

For table `<relation>`, the exact trigger name is `m03_m04_fence_<relation>_stmt`. Each is a `BEFORE INSERT OR
UPDATE OR DELETE OR TRUNCATE FOR EACH STATEMENT` trigger executing the single shared function
`<S>.m03_m04_bump_predecessor_epoch()`.

The function is `SECURITY DEFINER`, owned by the migration-owner role, and declares
`SET search_path = pg_catalog`. Its table reference is schema-qualified and its body executes:

```sql
UPDATE <S>.m03_m04_predecessor_fence
SET epoch = epoch + 1
WHERE singleton_key = true;
GET DIAGNOSTICS affected_rows = ROW_COUNT;
IF affected_rows <> 1 THEN
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'M03_M04_PREDECESSOR_FENCE_INVALID';
END IF;
RETURN NULL;
```

The function emits no row value, SQL text, relation name, or source data. A missing/duplicate/invalid singleton thus
rolls back the predecessor mutation with one closed safe error rather than silently updating zero rows.

The migration revokes every table privilege from `PUBLIC`, `ai_ark_m04_runtime`, and
`ai_ark_m01_m02_writer`; neither group role receives direct `SELECT`, `UPDATE`, or other table authority. It revokes
execution of all three functions from `PUBLIC` and both group roles, then grants only `EXECUTE` on the shared-lock
function to `ai_ark_m04_runtime` and only `EXECUTE` on the exclusive-lock function to
`ai_ark_m01_m02_writer`. Neither application role receives direct execution of the bump function. Trigger
invocation uses the locked-down definer authority. The migration owner is not an application runtime role, and no
application LOGIN role owns or can alter the schema, table, functions, or triggers. Function ownership,
`SECURITY DEFINER`, exact schema-qualified bodies, fixed search path, role attributes/membership separation, ACLs,
trigger definitions, and singleton row/value are exact catalog validation.

The amendment authorizes these existing first-party writer surfaces to add the exclusive call and no other behavior
change: `PostgresManualResolutionAdapter` and `PostgresSystemIdentityAdapter`. There is no current first-party M01
PostgreSQL application writer; any migration/bootstrap/test helper and any future M01 writer that mutates a covered
relation is nevertheless a covered writer and must use `ai_ark_m01_m02_writer` plus the exclusive function. Direct
SQL without the voluntary call remains fenced by the trigger backstop.

For the two current M02 adapters, approved M02 Section 15.4 remains a 22-step protocol, but step 7 is replaced
exactly with: begin one PostgreSQL `SERIALIZABLE` transaction; immediately call the exclusive fence function as the
transaction's first locking statement; then claim `(idempotencyScope,idempotencyKey,requestFingerprint)`; then
derive and acquire the existing advisory locks in their frozen byte-exact order. Steps 1-6 and 8-22 are unchanged.
The immutable caller expectations, optimistic discovery, provisional allocation, retry count, result/error
mapping, and command identity remain unchanged; waiting never refreshes them. Any other covered M01/M02 writer
calls the exclusive function immediately after `BEGIN`, before its first covered read, mutation, advisory lock, or
row lock.

M04's new-binding branch acquires its frozen M04 advisory locks first, then calls the shared-lock function, then
performs any predecessor read/lock. M01/M02 writers never acquire M04 advisory locks. This is the one global lock
order. An application role that calls the wrong function receives PostgreSQL `42501`; that whole transaction rolls
back and the adapter returns its existing closed authorization/persistence failure without retrying the statement.

Each trigger's update requires a conflicting row lock. Consequently:

- if M04 holds `FOR SHARE`, every covered M02 mutation waits until M04 commits or rolls back;
- if a covered mutation updates the epoch first, M04 waits, then reads only after that mutation commits or rolls back;
- multi-row statements increment the epoch once, while transaction atomicity makes the exact increment count
  irrelevant;
- rollback restores the epoch and source mutation together;
- direct SQL, current application writers, and future writers are fenced without relying on voluntary advisory-lock
  calls.

SQLSTATE `40P01` or `40001` at either side rolls back the complete transaction. M04 uses its frozen whole-transaction
three-attempt serialization retry and exact exhaustion result. M01/M02 writers use their existing complete-
transaction retry policy where defined; otherwise they return their existing closed persistence/concurrency failure
without partial mutation. No caller retries a statement inside a failed transaction. Tests force inverse raw-SQL
lock order to prove PostgreSQL aborts one transaction and never permits a stale M04 commit.

The fence table, trigger function, and complete trigger set are included in exact catalog validation, dump/restore,
least-privilege, and drift tests. M04 never refreshes caller expectations after waiting for the fence.

This global fence deliberately serializes predecessor mutations against new M04 bindings. That bounded Technical
Alpha tradeoff is preferred to an incomplete per-resource key that could miss a cross-row or phantom-set mutation.

The durable M03 bundle record must retain the complete V2 canonical bytes. It must also expose these redundant
indexed columns, each constrained to equal the value reconstructed from canonical bytes:

- `m02_input_projection_fingerprint`;
- `m03_input_fingerprint`;
- `m03_output_fingerprint`;
- existing extraction, Resource, ResourceVersion, snapshot, revision, policy, logical-payload, and canonical-payload
  identity columns.

The exact original projection need not be duplicated in a second JSON/SQL column because it is present in immutable
canonical V2 bundle bytes. Every read must reconstruct it from those bytes, validate the V2 schema, recompute its
fingerprint, and compare the redundant fingerprint column before returning an accepted result.

Collision preflight must cover every primary, foreign, alternate-unique, logical, canonical, input, projection,
output, binding, and result identity/fingerprint domain. For any equal hash with byte-distinct retained preimages,
the transaction returns the existing exact `CONTENT_HASH_COLLISION` result before replay or insertion.

## 9. Security and privacy invariants

The complete M02 input projection contains internal identifiers, versions, policy names, status values, canonical
replacement byte wrappers, controller state, and the bounded normalized `resourceIdentity.reliableIdentityTokenOrNull`.
That token may be source-derived under frozen M02 policy and must be retained byte-exactly for integrity comparison.
The complete projection is internal evidence data and must never be exposed through a public API, public Claim
excerpt, log, diagnostic, metric label, or M05 prose.

The projection must contain no raw or unbounded acquired document bytes, source excerpt, credential, personal-
contact value, provider response, connection string, unrestricted SQL error, or AI prompt. The bounded identity token
is not a general exception for source text: it is the one already-authorized normalized M02 field, remains subject to
its frozen length/character policy, and cannot be logged or published. Existing M03 source-safety, privacy-withholding,
prompt-injection, bounded-input, and no-execution rules remain mandatory.

Diagnostics may name only the approved closed field/guard identifiers and fingerprints. They must not serialize
the projection or any canonical preimage. Hashes are integrity evidence, not authorization or approval.

## 10. Implementation boundary after separate authorization

The minimum authorized implementation surface will be:

- `packages/contracts`: shared complete M02 projection schema/type and V2 bundle schema/type;
- `packages/extraction`: emit and fully validate V2 from the same projection instance used by the input fingerprint;
- `packages/evidence`: accept V2 and preserve existing deterministic M04 domain behavior;
- `packages/job-queue`: complete same-transaction projection reconstruction, V2 durable validation, and migration
  `003` adjustments, schema rendering, exact role prerequisites, and the exclusive calls in both current M02
  PostgreSQL adapters;
- `packages/testing`: genuine V2 fixture plus mutation, collision, persistence, recovery, and compatibility evidence;
- M03/M04 reports and architecture documentation only where behavior or evidence changes.

No package, dependency, migration beyond `003`, application, endpoint, UI, or future-milestone abstraction may be
added for this amendment.

## 11. Required verification matrix

| Area                      | Required direct evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projection schema         | every scalar/field/variant and every equality/predicate accepted at exact valid shape; one direct mutation test per scalar, discriminator, nullability relation, enum family, regex/bound, equality, and predicate; every missing, extra, wrong-type, wrong-enum, wrong-null, duplicate, and misordered-set case rejected                                                                                                                                                                                                                                                       |
| Projection fingerprint    | stable canonical fixture; key-order independence; every nested-field mutation changes fingerprint; injected same-hash/different-byte collision fails closed                                                                                                                                                                                                                                                                                                                                                                                                                     |
| V2 bundle closure         | exact projection-to-`m02` and mutable-version mapping; six independently recomputed current-preimage-to-expected-fingerprint comparisons; V2 output-fingerprint recomputation; malformed projection and wrong fingerprint rejection                                                                                                                                                                                                                                                                                                                                             |
| M03 same-instance handoff | the projection value fingerprinted in the compound input preimage is byte-identical to the value serialized in the returned V2 bundle; six fingerprint preimages remain transient                                                                                                                                                                                                                                                                                                                                                                                               |
| V1/V2 compatibility       | all six outer arms per version; every V1×V2 same-key/new-key/effective-tuple/collision permutation; V1 remains historically parseable; M04 returns the exact V1 schema rejection without write; no fabricated upgrade path                                                                                                                                                                                                                                                                                                                                                      |
| Freshness                 | mutation of every field, nested variant, set member, version, fingerprint, and controller predicate in the current database returns the exact failure and writes nothing                                                                                                                                                                                                                                                                                                                                                                                                        |
| Race safety               | each of the 18 canonically ordered triggers; exact epoch/schema-OID/role/recursive-membership/effective-ACL/function catalog; valid non-`public` schema; rejection of every invalid/system/temp/quoted/Unicode/overlength/truncation-alias schema name; hostile `search_path`; actual-LOGIN and wrong-role calls; direct/transitive table/function denial; missing singleton; zero-row update; both current M02 writers' revised step 7; compliant lock order; inverse raw-SQL deadlock; mutation between phases; update/delete/truncate/phantom insert; and concurrent binding |
| Replay                    | exact replay validates stored V2 closure; new-key semantic replay validates before association write; corrupt stored projection/fingerprint cannot gain a new association                                                                                                                                                                                                                                                                                                                                                                                                       |
| Collision                 | injected collision for input, projection, output, logical, canonical, and all existing M04 identity/fingerprint domains returns exact `CONTENT_HASH_COLLISION`                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Persistence               | restart and dump/restore reproduce byte-identical V2 canonical bundle and projection fingerprint with complete relational closure                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Privacy                   | projection/preimages absent from logs, diagnostics, metrics, Claim excerpts, and reports; hostile identifiers cannot escape closed diagnostics                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Regression                | all approved M00-M03 V1 historical gates remain green; M03 V2, M04, migration, integration, fixture, adversarial, and repository gates pass                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Required commands use pinned Node `22.23.1` and pnpm `11.7.0`. At minimum they include targeted amended-contract
tests, M03 extraction integration, M04 PostgreSQL persistence/migration/recovery tests, `pnpm test:fixtures`,
`pnpm test:adversarial`, `pnpm test:integration`, unfiltered `pnpm test`, `pnpm verify`, `git diff --check`, exact
authority/migration hashes, whole-candidate diff review, secret/privacy review, and a fresh source-only checkout
reproduction. Empty or skipped suites are not passing evidence.

## 12. Acceptance criteria

| ID            | Requirement                                                                                                                                                                                                                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AMEND-AC-01` | The approved M03 and M04 base specification files remain byte-identical to the hashes in Section 3.                                                                                                                                                                                                                                       |
| `AMEND-AC-02` | One shared strict schema represents the complete approved M03 M02-input projection with no partial mirror.                                                                                                                                                                                                                                |
| `AMEND-AC-03` | V2 retains the exact projection instance used by M03's compound input-fingerprint preimage; the six fingerprint preimages remain transient under the existing privacy boundary.                                                                                                                                                           |
| `AMEND-AC-04` | The domain-separated projection fingerprint is recomputable from the retained canonical projection bytes.                                                                                                                                                                                                                                 |
| `AMEND-AC-05` | The V2 output fingerprint cryptographically binds the complete projection and its fingerprint.                                                                                                                                                                                                                                            |
| `AMEND-AC-06` | Every V2 `m02` identity and all eleven expected mutable versions map exactly to the retained projection; all six expected fingerprints compare with independently recomputed complete current Section 7.2 preimages.                                                                                                                      |
| `AMEND-AC-07` | M04 compares the complete internally consistent retained original projection with a complete same-transaction reconstruction under the exact global fence before any new-binding write.                                                                                                                                                   |
| `AMEND-AC-08` | Every projection field, internal equality, variant, member, version, fingerprint, predicate, and each of the 18 fenced relation classes has a direct mutation/omission test that fails atomically.                                                                                                                                        |
| `AMEND-AC-09` | Exact replay and new-key semantic replay validate complete stored V2 closure before any association write.                                                                                                                                                                                                                                |
| `AMEND-AC-10` | All equal-hash/different-byte domains, including projection/input/output fingerprints, fail as `CONTENT_HASH_COLLISION`.                                                                                                                                                                                                                  |
| `AMEND-AC-11` | V1 remains historical evidence but is not M04-bindable and cannot be automatically upgraded.                                                                                                                                                                                                                                              |
| `AMEND-AC-12` | Durable restart and dump/restore reproduce identical V2 bundle bytes and projection fingerprint.                                                                                                                                                                                                                                          |
| `AMEND-AC-13` | The retained projection never enters public evidence, prose, logs, metrics, or diagnostics.                                                                                                                                                                                                                                               |
| `AMEND-AC-14` | Migrations `001` and `002` remain byte-identical; any changed migration `003` receives full forward-only migration and recovery evidence.                                                                                                                                                                                                 |
| `AMEND-AC-15` | All amendment, inherited M03/M04, security, integration, repository, and fresh-checkout gates pass under the pinned runtime.                                                                                                                                                                                                              |
| `AMEND-AC-16` | The amendment creates no M05 behavior and authorizes no publication or production migration.                                                                                                                                                                                                                                              |
| `AMEND-AC-17` | All six V1 and V2 result arms and every cross-version key, tuple, replay, join, and collision permutation have exact direct evidence.                                                                                                                                                                                                     |
| `AMEND-AC-18` | Migration `003` creates exactly one schema-local epoch-1 singleton, the three exact locked-down definer functions, the two exact NOLOGIN role prerequisites/ACLs, and the exact ordered 18-trigger set; configurable/hostile schema, wrong-role, row, privilege, lock-order, deadlock, rollback, catalog, and recovery cases fail closed. |

## 13. GO / NO-GO rules

`GO — M03/M04 HANDOFF AMENDMENT READY FOR HUMAN APPROVAL` requires:

1. exact hashes for both unchanged base specifications and this amendment;
2. a genuinely independent read-only review of this complete amendment against the repository and both base specs;
3. no unresolved ambiguity, missing preimage, circular fingerprint, partial projection, compatibility fiction,
   security regression, migration ambiguity, or acceptance-evidence gap;
4. deterministic documentation/hash validation and a secret/personal-data review.

Any substantive amendment change after review invalidates that verdict and requires a new whole-file hash and fresh
independent review.

Even after specification `GO`, implementation remains prohibited until the human product owner:

1. approves the exact final amendment SHA-256; and
2. separately authorizes implementation against the complete three-document authority tuple.

Commit, push, pull request, merge, release, deployment, publication, production-data change, and M05+ work remain
separately gated.
