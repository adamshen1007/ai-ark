# M05 — Evidence-bound Skill draft generation

Version: 1.0. Date: 2026-10-27.

Status: **PROPOSED — NOT APPROVED; NO IMPLEMENTATION AUTHORITY**.

The owner has authorized preparation and independent review only. Approval must identify the exact final whole-file SHA-256; implementation requires a separate authorization. The hash is recorded outside this file to avoid a self-referential identity. Formatting after review changes the approval target.

## 1. Objective and authority

Produce concise, immutable, unapproved Skill-page draft revisions from a verified durable M04 accepted binding. Drafts are rebuildable projections, never canonical Claims, evidence, editorial decisions, or publication snapshots. Persist their complete input provenance and accepted output so restart/recovery does not depend on an in-memory M03/M04 service or a repeat provider call.

Authority: Technical Alpha execution prompt §14; Technical Alpha architecture §20; Technical Alpha PRD §§11 and M05; ADR-007/008/011; the eleven-document M03/M04 authority chain pinned in `M04_REPORT.md`. The M04 baseline is merge `e9b62f80f2c5dd2402d145df5e4afda403691f2f`; see `M04_GOVERNANCE_CLOSEOUT.md`. This proposal cannot retroactively modify those specifications or weaken their guarantees.

The broad pipeline specification §31 includes marketplace, rankings, public cards, and editorial state transitions. The narrower Technical Alpha milestone takes precedence: none is implemented here. Execution-prompt illustrative `--filter` commands are replaced by the repository's supported Vitest positional forms.

## 2. Scope and non-goals

In scope after approval: strict versioned contracts; `@ai-ark/draft-generation`; deterministic composition; optional bounded provider-neutral AI selection/composition; trusted prompt bundle; verified M04 read port; durable draft/input/request storage; forward migration 004; tests, fixtures, runbook, and traceability.

Not in scope: UI, HTTP/API service, authentication vendor, autonomous worker scheduling, live provider configuration/use, source acquisition, source execution, new Claims/EvidenceItems, conflict resolution, editor decisions, approval/publication, search/directory, badges/ranks/scores, M06+, deployment, or production migrations. M05 owns only an internal application API and projection records. It must not create `INTERNAL_APPROVED` or imply human review occurred.

AI assistance is deliberately extractive: selection and arrangement of validated claim-derived atoms through a closed template vocabulary, not arbitrary factual paraphrases. This is the proposed M05 product boundary, not a claim that semantic entailment can be proven by checking citation IDs. Future free-form synthesis requires separately approved scope.

## 3. Architecture and upstream boundary

Contracts remain inward-owned. Draft generation depends on contracts and evidence-domain validation, not PostgreSQL/provider SDKs. Infrastructure adapters stay in `@ai-ark/job-queue`; the new feature package is explicitly registered in dependency checks. No new dependency/runtime upgrade is required; any unavoidable change must be justified before implementation.

Current M04 `EvidencePersistencePortV1` exposes only `persistAccepted`. An `ACCEPTED` result does not contain the evidence needed to generate a draft. M05 therefore adds an explicit `AcceptedBindingReadPortV1`, with `readAcceptedBinding(bindingId, expectedExtractionId, expectedBindingFingerprint)` returning a verified immutable envelope or a typed error. It may not simulate a read by invoking `persistAccepted`, invent a request/idempotency key, or accept caller-supplied Claims as authority.

The read adapter runs inside the existing trusted evidence infrastructure using the existing M04 LOGIN and unchanged grants; draft-generation receives only the port, never that connection or writer methods. Its implementation may add a read-only method/shared verifier without changing existing M04 method results. No new principal receives M04 object privileges. SQL must be parameterized, schema-qualified, read-only, and exercised under the actual existing LOGIN. This is an explicit reuse of a privileged upstream component, not a claim that the M04 LOGIN becomes read-only. M05 persistence uses a separate least-privilege LOGIN (§12).

If existing grants cannot implement this read without weakening authority checks, stop with a specification blocker before adding grants. Migrations 001–003, the 180-cell manifest, and all approved M03/M04 specification bytes remain frozen.

### 3.1 Accepted envelope and validation

`AcceptedBindingSnapshotV1` contains the accepted binding core/result (without transient replay flag), one canonical M03 V2 bundle, its exact retained M02 projection, all projected EvidenceItems, Claims, links, completeness, and the canonical semantic M04 request (all request fields except idempotencyKey). All stored associations for that binding must validate and derive the same semantic request before it is exported; no request key, alias count, or request-row ordering enters the envelope. Later aliases therefore cannot change its fingerprint. Envelope identities include Resource, ResourceVersion, SourceSnapshot/revision, extraction ID/output fingerprint, binding ID, completeness ID, and each record fingerprint.

Read one consistent repeatable-read transaction, with the existing authority/source/OID checks and administrative-DDL exclusion. Validate canonical byte equality, all ID/fingerprint preimages, association-to-bundle lineage, binding/result identity, complete projected sets and order, locators/source-reference ownership, and the immutable source lineage already required on M04 accepted replay. Recompute `projectEvidenceBinding` and compare every stored projected record. Extra, missing, duplicate, cross-binding, coherent-rehash-but-wrong-lineage, or byte-distinct same-hash records fail closed. Do not re-adjudicate mutable predecessor freshness on an already accepted historical binding. Do not fall back to current repository content or an earlier valid subset.

The envelope is private persistence input. It is never provider input, preview output, a log field, or a public evidence API. Excerpts remain `INTERNAL_EVIDENCE / NOT_GRANTED`; copying an internal envelope confers no display or provider-transmission authority.

The envelope's exhaustive closed schema is `{schemaVersion:"M05_ACCEPTED_BINDING_SNAPSHOT_V1",bindingPreimage,acceptedResultRecord,bundle,semanticRequest,evidenceItems,claims,links,completeness}`. `bundle` is the unchanged `StructuredExtractionBundleV2Schema` value (including its retained M02 projection); `semanticRequest` is `EvidenceBindingRequestV1Schema` with only idempotencyKey removed. Evidence/Claim/link/completeness records use their exact existing M04 V1 schemas. EvidenceItems are unsigned-UTF-8 ID sorted; Claims follow M03 field registry order; links follow Claim order then ordinal. Duplicate records are rejected, not deduplicated. `bindingPreimage` is exactly `{schemaVersion:"M04_BINDING_ID_V1",extractionId,logicalPayloadSha256,evidencePolicyVersion,materialFieldRegistryVersion,evidenceItemIds,claimIds,linkIds,completenessId}` from M04 §17, including its prescribed array orders. `acceptedResultRecord` is exactly `{schemaVersion:"M04_RESULT_V1",resultId,kind:"ACCEPTED",bindingId,extractionId,completenessId}`; recompute its M04 result ID/fingerprint, do not export the transport completeness expansion or replay flag as an alternative canonical form.

`expectedBindingFingerprint = H(C(bindingPreimage))`, exactly the 64-hex suffix of bindingId; it is not the accepted resultFingerprint, completeness fingerprint, or snapshot fingerprint. Compare both this hash and the complete validated preimage/lineage when adopting stored records. Adding a request alias cannot change the semanticRequest or any envelope field. The only M02 projection is the one inside bundle; no second independently editable copy is introduced.

## 4. Eligibility and failure precedence

For a new generation: parse request → check exact accepted-request replay or semantic-request alias → resolve trusted policy → load/validate durable source → compare expected identities → evaluate completeness → build safe atoms → optionally call AI → validate composition → persist atomically. Accepted replay validates its retained historical input/policy and does not require a currently enabled provider or live M04 connection. It never uses an unchecked object/hash cache.

`m05Progression` must equal `ELIGIBLE`, all eleven requirements must be covered, no blocking keys and no unresolved conflicts. Otherwise return `BLOCKED` with the immutable completeness IDs and safe blocker keys; create no draft/input/request/provider attempt. Missing license, unsupported material fields, conflicting purpose, or no qualifying limitation are rejection fixtures, not partial success drafts. This preserves M04-AC-14 even though broader draft documents discuss partial previews. A future partial-preview mode requires explicit authority; it is absent here.

Optional missing fields may produce explicit section placeholders. Sensitive/unsafe material needed for a required section causes `BLOCKED / MATERIAL_CONTENT_WITHHELD`, not a claim that no dependency/permission/limitation exists. All failures preserve the absence of side effects unless an accepted transaction already committed.

## 5. Request and result contracts

All objects are strict, reject unknown keys, reject duplicate JSON member names before parsing, accept only Unicode scalar strings, and have literal schema versions. No numeric coercion, NaN, infinity, or unpaired surrogate is accepted. Existing M04 values retain their original contract, including U+0000; display projection may withhold controls without changing source bytes.

`GenerateDraftRequestV1` has exactly:

| Field                      | Contract                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| schemaVersion              | `M05_GENERATE_DRAFT_REQUEST_V1`                                                                         |
| idempotencyKey             | Existing M04 scalar/UTF-8 key contract, 1–200 bytes; opaque, never logged                               |
| bindingId, extractionId    | Existing `bnd_` / `ext_` content-ID syntax                                                              |
| expectedBindingFingerprint | 64 lowercase hex SHA-256 of the exact M04_BINDING_ID_V1 preimage in §3.1                                |
| mode                       | `DETERMINISTIC` or `AI_ASSISTED`                                                                        |
| regenerationToken          | Scalar opaque 1–200 UTF-8 bytes; caller-controlled generation intent, not an authenticated-editor claim |
| policyVersion              | `m05-draft-policy-v1`                                                                                   |
| methodologyVersion         | `m05-draft-methodology-v1`                                                                              |
| promptBundleVersion        | `m05-draft-prompt-v1` (also recorded for deterministic mode)                                            |
| providerConfigIdOrNull     | Null iff deterministic; otherwise trusted configured registry key, not a URL/model supplied by source   |

Raw request ceiling: 16,384 UTF-8 bytes. JSON whitespace/key order is semantically irrelevant after strict parsing; canonical request bytes define equality. Methodology/prompt changes require a new supported version in an approved implementation; arbitrary caller labels do not change behavior. Source/extraction change requires a different binding; explicit regeneration requires a different token. Same input/token/policy reuses a revision. No “latest” inference or clock-driven regeneration.

Results are closed discriminated arms: `ACCEPTED {revisionId,inputFingerprint,outputFingerprint,recordFingerprint,replayed}`; `BLOCKED {requestFingerprint,code,completenessId,completenessRecordFingerprint,blockingRequirementKeys}`; `REJECTED {requestFingerprint,code}`; `FAILED {requestFingerprintOrNull,code}`; `MALFORMED {rawRequestSha256,code}`. Each has a `kind` discriminator equal to the arm name and schemaVersion `M05_GENERATE_DRAFT_RESULT_V1`; all unspecified fields are forbidden. Completeness identifiers come from the validated immutable snapshot. For withheld material on an otherwise eligible source, blockingRequirementKeys lists the affected M04 material registry keys in registry order, without rewriting the source completeness. Codes are fixed enums, never raw exception strings.

Malformed codes: `REQUEST_TOO_LARGE`, `REQUEST_JSON_INVALID`, `REQUEST_SCHEMA_INVALID`. Blocked codes: `M04_PROGRESSION_BLOCKED`, `MATERIAL_CONTENT_WITHHELD`. Rejected codes: `POLICY_UNSUPPORTED`, `BINDING_NOT_FOUND`, `EXPECTED_BINDING_MISMATCH`, `IDEMPOTENCY_KEY_REUSED`. Failed codes: `SOURCE_INTEGRITY_FAILED`, `AUTHORITY_INVALID`, `CAPACITY_EXCEEDED`, `PROVIDER_UNAVAILABLE`, `PROVIDER_TIMEOUT`, `PROVIDER_OUTPUT_INVALID`, `DEADLINE_EXCEEDED`, `PERSISTENCE_UNAVAILABLE`, `PERSISTENCE_INTEGRITY_FAILED`, `CONTENT_HASH_COLLISION`, `SERIALIZATION_RETRY_EXHAUSTED`.

Malformed/unaccepted results are not durably stored. They may be retried after correcting the cause. Only accepted requests get durable idempotency. Diagnostics/logs contain codes and opaque content hashes, not raw keys, source strings, provider errors, prompts/responses, or credentials.

## 6. Draft shape and required section registry

Every successful `DraftRevisionV1` carries schemaVersion `M05_DRAFT_REVISION_V1`, state `UNAPPROVED`, and the exact visible label **AI-generated draft — human review required**. It always has these fourteen sections in order:

| Section             | Permitted M03/M04 field keys                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Identity            | canonical_skill_name, creator_candidates, organization_candidates, version, source_revision, license, categories |
| Outcome statement   | outcome_candidate                                                                                                |
| Best for            | target_user_candidates, tasks, use_cases                                                                         |
| Not ideal for       | limitations only; no logical inversion of capability/target-user absence                                         |
| Capabilities        | capabilities                                                                                                     |
| Suggested Tasks     | tasks                                                                                                            |
| Use cases           | use_cases                                                                                                        |
| Installation        | installation, configuration; no command execution or invented first-use step                                     |
| Compatibility       | compatibility                                                                                                    |
| Dependencies        | dependencies, external_services                                                                                  |
| Permissions         | permissions                                                                                                      |
| Limitations         | limitations plus explicit source warnings/unknowns                                                               |
| Maintenance         | maintenance_signals                                                                                              |
| Source and evidence | binding lineage and evidence-ID index, never raw excerpts                                                        |

Identity/source metadata not present in a Claim may only come from verified envelope lineage, tagged `PROVENANCE_METADATA`, not presented as a creator/license Claim. Missing category, release date, first-use instruction, or optional target-user field stays `NOT_PROVIDED`; never infer it. “No limitation identified” is not proof of no limitations and cannot cure a blocked M04 binding.

Each section is `{key,state,items,omittedItemCount}` with state `PRESENT`, `NOT_PROVIDED`, or `WITHHELD`; placeholder text is fixed trusted copy, not model output. Each item is `{atomId,templateId,text,claimIds,evidenceLinkIds,evidenceItemIds,originalClaimClasses,originalStatuses,displayClass,qualifierCodes}`. IDs are closed over this revision input; ordered evidence associations remain in the private provenance manifest even when preview references are compacted.

## 7. Safe atom registry, support classes, and concision

Atoms are deterministic views of validated Claim values, not a new Claim type. Each atom identifies exactly one Claim and one whole typed value/subrecord by RFC6901 pointer. Enumerate atoms by section order, source field registry order, original array index, then UTF-8 pointer order. Atom ID is `dat_` plus SHA-256 of canonical `{claimId,pointer,templateId,policyVersion}`. Provider-generated pointers, text, IDs, evidence links, qualifiers, or support classifications are forbidden.

The implementation must provide a total field-to-atom table covering every union arm in `ExtractionValueSchemaByFieldV1`. Identity strings use their existing display fields; list records retain their complete identity and qualifiers; install paths retain their grouping/context; structured permissions/dependencies/compatibility retain unknowns and static-only status. No generic JSON-to-text fallback or `.toString()` rendering of an unknown arm is allowed. Whole-value omission is preferable to truncating meaning. The table and fixtures are a required implementation gate, not license to broaden the section/field mapping.

Closed templates are `SOURCE_DECLARATION`, `METADATA_VALUE`, `QUALIFIED_INDICATION`, `INFERRED_SUITABILITY`, `LIMITATION`, `INSTALLATION_PATH`, and `PROVENANCE`. Each inserts only complete validated atom fields into neutral literal copy. No template may add tested/verified/secure/best/production-ready assertions. `INFERRED_SUITABILITY` is restricted to Best for and must visibly say “Suggested fit — inference; human review required”; it preserves the originating Claim class. Not ideal for uses only explicit limitation atoms.

| Original class              | Display classification and required treatment                       |
| --------------------------- | ------------------------------------------------------------------- |
| SOURCE_FACT                 | `SOURCE_FACT`; source declaration, not independently tested fact    |
| REPOSITORY_METADATA         | `REPOSITORY_METADATA`                                               |
| STATIC_CODE_INDICATOR       | `STATIC_INDICATION`; “static indication; not runtime verified”      |
| FORMAT_INFERENCE            | `AI_OR_RULE_INFERENCE`; explicitly rule-inferred, not model-derived |
| AI_INFERENCE                | `AI_OR_RULE_INFERENCE`; explicitly AI-inferred                      |
| MIXED_DETERMINISTIC_SUPPORT | `MIXED_SUPPORT`; preserve constituent classes from the bundle       |
| MIXED_SUPPORT               | `MIXED_SUPPORT`; preserve AI/deterministic provenance               |

`EDITORIAL_INTERPRETATION`, `TEST_RESULT`, and `CREATOR_DECLARATION` remain distinct conceptual classes from the execution prompt, but are not constructible in M05: no authenticated editorial/test/creator input exists. Proposed copy is not an accepted editorial interpretation. A future contract extension must establish those authorities first.

`SUPPORTED_WITH_QUALIFIER` always retains qualifiers; optional `AMBIGUOUS` or `REVIEW_REQUIRED` Claims are withheld with safe reason codes, never selected as supported copy. `CONTEXT_ONLY` links never support an assertion. Selecting an atom retains its entire ordered Claim evidence closure; convenient-looking subsets cannot replace it.

Limits for visible projection: at most 14 sections, 64 items, 12 items/section; at most 6 Capabilities (show fewer than 3 honestly when fewer exist); 400 Unicode scalars/item and 12,000 scalars total including headings/labels/qualifiers. Outcome statement ≤240 scalars. Whole-atom selection follows stable order; all limitations/mandatory qualifiers must remain, and overflow that would hide one returns `CAPACITY_EXCEEDED`. Optional excess is omitted with an exact count, never counted as evidence failure. No mid-string truncation of commands, version expressions, limitations, or safety qualifiers. Evidence panels/UI are M06 work; M05 exports separate preview/provenance objects.

Credentials, personal-contact values, sensitive locators, withheld command text/defaults, control characters, HTML/active markup, or prompt-like instructions cannot become eligible/rendered/provider atoms. Private candidate IDs may be derived solely from Claim ID, typed pointer, template ID, and policy version before safety filtering, so UNSAFE omissions can name an opaque candidate without retaining or rendering its unsafe text. All references to selected atoms/provider catalog entries mean eligible atoms only; an omitted candidate grants no display or transmission authority. Reuse established M03 safety classifications and add deterministic output checks; these are fail-closed filters, not a guarantee of semantic prompt-injection detection. Commands remain inert internal data and are omitted from provider input. Preview serialization is plain text structured JSON; no HTML/Markdown execution or auto-linking authority is granted.

## 8. AI port and trusted prompt bundle

`DraftCompositionProviderPortV1` receives exactly `{schemaVersion:"M05_PROVIDER_INPUT_V1",catalog:[{atomId,sectionKey,fieldKey,displayClass,mandatory}],promptBundleVersion}` plus the immutable trusted system instruction. Catalog labels are solely the closed section/field/class enums specified here; there is no free-text label. No atom text, excerpt, source path, installation command, Claim JSON, credential, or private envelope is transmitted. This limits AI assistance to metadata-guided arrangement/selection, not semantic rewriting. Catalog limit 64 atom-section entries and 32,768 UTF-8 bytes; required entries count toward this bound. Over-budget required content fails before provider invocation, rather than silently dropping safety content.

The prompt declares the catalog data non-authoritative, prohibits tools/egress/source instructions, prohibits new claims/IDs/approval/badges/ranks, and requires only `{schemaVersion:"M05_COMPOSITION_V1",selections:[{sectionKey,atomIds}]}`. Exactly fourteen unique sections in fixed order; no duplicate IDs within a section; IDs must be eligible for that section; all mandatory material/limitation/qualifier atoms are retained. The model can order permitted optional atoms, not invent or paraphrase facts. The renderer reconstructs all text, evidence references, labels, and classifications independently. Poisoned source text may never appear in a captured provider request; fake-provider payload inspection is the executable oracle, not a heuristic assertion of sanitization.

One call, no repair or implicit fallback. Timeout 30 seconds, response ceiling 32,768 UTF-8 bytes, total application deadline 240 seconds excluding explicit caller retries; the ordinary-fixture performance target remains 60 seconds (§13). Abort and ignore late responses. Invalid/malicious output is `PROVIDER_OUTPUT_INVALID` with zero accepted writes. Deterministic mode is explicitly requested, not silent provider-failure recovery. Tests inject fake provider/clock; live vendor, cost, credentials and outbound-network qualification are not part of milestone GO.

Provider and model identifiers come from a trusted bounded registry (1–100 scalar characters each, no credentials/URLs). Persist its canonical artifact fingerprint, prompt artifact SHA-256, model, provider, attempt count (0 or 1), durationMs and input/output token metrics. Unknown token metrics are null, not zero. Deterministic mode uses null provider/model and null tokens, attempt count 0. No assembled provider request, source-bearing prompt, or raw provider response is persisted; the trusted version-controlled prompt artifact alone is deliberately retained below.

The exact persisted policy artifact is `{schemaVersion:"M05_POLICY_ARTIFACTS_V1",policyVersion,methodologyVersion,promptBundleVersion,promptUtf8Hex,atomTemplateUtf8Hex,providerConfigOrNull}`. Both hex fields are lowercase even-length UTF-8 encodings of trusted, version-controlled artifact bytes (1–65,536 decoded bytes each); reject malformed UTF-8 or mismatched trusted registry bytes. The template artifact contains the total mapping and literal templates, not acquired instructions, and is retained for provenance, never dynamically executed from storage. Provider config is null iff deterministic, otherwise exactly `{providerConfigId,provider,model,configurationRevision,selectionProfile:"M05_SELECTION_ONLY_V1"}` with each identifier 1–100 ASCII characters from `[A-Za-z0-9._-]`. It contains no endpoint, secret, arbitrary generation parameter, or executable content. Fingerprints are H(decoded artifact bytes) for prompt/template and H(C(providerConfig)) for provider config. Runtime adapters resolve credentials outside this stored registry.

The complete request policy tuple `(policyVersion,methodologyVersion,promptBundleVersion,mode,providerConfigIdOrNull)` maps immutably and one-to-one to exact prompt/template bytes and the complete provider config including configurationRevision. Reusing any version/config ID to substitute different artifact bytes or a different config is `AUTHORITY_INVALID`, before provider work or accepted writes. Changes require a new supported version/config ID, never an in-place registry update; retain all historical mappings for accepted read/replay validation. Freeze a resolved mapping before asynchronous work and revalidate it before commit. Concurrent same-semantic requests must resolve the same source/policy/input and generationFingerprint; test registry replacement before and during generation, both first-caller orders, and post-restart replay. A collision or conflicting mapping is not an alternate valid winner.

The closed `metrics` record is `{providerOrNull,modelOrNull,attemptCount,durationMs,inputTokensOrNull,outputTokensOrNull}`. durationMs is a nonnegative safe integer; tokens are nonnegative safe integers or null. attemptCount is 0 iff deterministic, else 1. Provider/model equal the retained config or are both null. For deterministic mode durationMs is measured local composition time and token fields are null; a measurement failure fails the request, not a fabricated zero.

## 9. Fingerprints and immutable revision semantics

`C(x)` is exact UTF-8 `canonicalJsonM03(x)`; `H` is lowercase SHA-256. Do not replace JavaScript number/string canonicalization with PostgreSQL JSONB rendering. No Unicode normalization of upstream strings is introduced. Arrays have the exact registry/source ordering specified here; identifiers use fixed lowercase-hex syntax.

- `sourceFingerprint = H(C(AcceptedBindingSnapshotV1))`.
- `policyFingerprint = H(C({policyVersion,methodologyVersion,promptBundleVersion,promptArtifactSha256,atomTemplateArtifactSha256,providerConfigFingerprintOrNull}))`.
- `inputFingerprint = H(C({schemaVersion:"M05_INPUT_V1",sourceFingerprint,policyFingerprint}))`.
- `generationFingerprint = H(C({schemaVersion:"M05_GENERATION_V1",inputFingerprint,mode,regenerationToken}))`.
- `outputFingerprint = H(C({schemaVersion:"M05_OUTPUT_V1",label,state,sections,provenanceIndex}))`.
- `revisionId = "drv_" + H(C({schemaVersion:"M05_REVISION_ID_V1",generationFingerprint,outputFingerprint}))`.
- `recordFingerprint = H(C(complete DraftRevisionV1 excluding only recordFingerprint))`.
- `requestFingerprint = H(C(GenerateDraftRequestV1))`.
- `semanticRequestFingerprint = H(C(GenerateDraftRequestV1 excluding only idempotencyKey))`.

`DraftRevisionV1` contains exactly revisionId, recordFingerprint, inputFingerprint, generationFingerprint, outputFingerprint, bindingId, extractionId, sourceFingerprint, policyFingerprint, mode, regenerationToken, label, state, sections, provenanceIndex, generatedAt, metrics, and schemaVersion. `generatedAt` is trusted application UTC ISO8601 milliseconds; metrics is the closed §8 record. These observational fields are included in recordFingerprint but excluded from semantic identity. First committed winner retains them on every replay; never synthesize a new timestamp or metric on read.

`provenanceIndex` contains complete ordered selected Claim/Link/Evidence IDs, original classes/statuses/qualifiers, source lineage, and policy/prompt/provider identity/fingerprints; it contains no excerpt. Persist the full verified input separately so all IDs and omissions are independently reconstructable. Reordering optional atoms by AI can change outputFingerprint; exact deterministic mode must be byte-repeatable. Accepted AI replay is stable without asserting that a fresh provider call is deterministic.

Its exact shape is `{schemaVersion:"M05_PROVENANCE_INDEX_V1",lineage,policy,claimBindings,omissions}`. `lineage` is exactly `{bindingId,extractionId,resourceIdentityId,resourceVersionIdentityId,sourceSnapshotId,sourceRevision,m03OutputFingerprint,completenessId,completenessRecordFingerprint}` from the verified envelope. `policy` is exactly `{policyVersion,methodologyVersion,promptBundleVersion,promptArtifactSha256,atomTemplateArtifactSha256,providerConfigFingerprintOrNull,providerOrNull,modelOrNull}` from the retained policy artifact. `claimBindings` has one entry per selected Claim in M03 registry order: `{claimId,fieldKey,originalClass,originalStatus,qualifierCodes,evidenceLinkIds,evidenceItemIds}`; all link/associated evidence IDs retain original ordinal order, including permitted repeated evidence occurrences. `omissions` has entries `{sectionKey,atomIds,reason}` in section order then reason order `OPTIONAL_LIMIT`, `UNSAFE`, `OPTIONAL_UNRESOLVED`, with atom IDs in original atom order. Empty entries are omitted; omittedItemCount equals the number of omitted atoms for the section. No omissions are inferred from another binding. Placeholder sections with no atoms have count zero. qualifierCodes is the original M03 warningCodes order followed by applicable fixed M05 codes in the order `NOT_RUNTIME_VERIFIED`, `RULE_INFERENCE`, `AI_INFERENCE`, `MIXED_PROVENANCE`, `INFERRED_SUITABILITY`; duplicates are rejected. The same rule controls per-item qualifiers. Unknown enums/keys or nonregistry order reject.

Editorial decisions are not accepted in this schema. The execution prompt's “accepted editorial decisions update preview” trigger belongs to M06 and will require an approved versioned extension, not mutable M05 records. Historical revisions remain readable if a later extraction or identity becomes current; they carry their fixed historical lineage and make no current-version claim.

## 10. Durable persistence boundary

`DraftPersistencePortV1` exposes accepted lookup by canonical request, atomic accepted write, and read by revision ID. In-memory implementations are tests only. Milestone completion requires real PostgreSQL persistence and restart/backup-restore reconstruction of source/provenance/revision/request equality.

Migration `004_m05_draft_projection.sql` creates a separate schema `ai_ark_m05` and these four tables, with all ID/key text columns using `COLLATE "C"`:

| Table        | Required relational shape                                                                                                                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| inputs       | input_fingerprint PK; source_fingerprint; policy_fingerprint; binding_id; extraction_id; byte_length; chunk_count; canonical manifest bytea; manifest_sha256                                                                     |
| input_chunks | (input_fingerprint FK, ordinal) PK; payload bytea; payload_sha256; ordinal ≥0, payload length 1–65,536                                                                                                                           |
| revisions    | revision_id PK; generation_fingerprint UNIQUE; input_fingerprint FK; output_fingerprint; record_fingerprint UNIQUE; canonical_payload bytea                                                                                      |
| requests     | encoded_key PK; request_fingerprint; semantic_request_fingerprint with nonunique lookup index; canonical_request bytea; generation_fingerprint FK to revisions unique key; revision_id FK; canonical_result bytea; result_sha256 |

Input bytes are `C({schemaVersion:"M05_PERSISTED_INPUT_V1",source:envelope,policy:trustedPolicyArtifacts})`. The manifest records byte length, chunk count, full byte SHA-256, ordered chunk hashes, input/source/policy fingerprints; it contains no second independent unbound value. Chunks are exactly 65,536 bytes except the final nonempty chunk, continuous ordinals from 0, no extra chunks. Reassembled bytes must be canonical and derive every indexed identity. Maximum input capacity is 268,435,456 bytes; a valid larger upstream input returns `CAPACITY_EXCEEDED`, not “invalid M04.” No lower aggregate limit is added to M04 itself. Required M04 combined-maximum fixture must fit and succeed in M05 or specification acceptance fails.

All four tables are append-only: no runtime UPDATE/DELETE/TRUNCATE, supersession flag, mutable current pointer, or mutable attempt record. Schema checks/FKs/unique constraints, immutable triggers, and a deferred closure trigger enforce complete input chunks, byte hashes, indexed-parent consistency, and request/revision linkage. Application validators additionally check strict canonical schemas and regenerate the projection on every accepted read/write. Database JSONB is never the canonical payload. Privileged administrator rewriting coherent history is outside the inherited administrative-DDL exclusion, not silently claimed detectable without an external trust anchor.

`encoded_key` is exactly `encodeM04IdempotencyKeyForDatabase(idempotencyKey)`: reversible lowercase UTF-8 hex, 2–400 characters, even length, `COLLATE "C"`; decode with the existing strict decoder and require re-encoding equality plus equality to the canonical request key on every read. The raw key exists only in canonical bytea payloads, never a PostgreSQL text or advisory-lock parameter. regenerationToken likewise remains only in canonical bytea; lock keys use ASCII generationFingerprint. Advisory-lock inputs are ASCII `M05_KEY:` plus encoded_key or `M05_GENERATION:` plus generationFingerprint, fed to the same fixed server hash function; sort the complete ASCII inputs bytewise before locking. Hash collisions only serialize unrelated requests and cannot establish identity. Explicit NUL, composed/decomposed Unicode, surrogate rejection, numeric-ICU control, and both-key replay cases are required.

Stored canonical_result is precisely the ACCEPTED arm with replayed false. Returned replayed true is transport metadata and never rewrites the stored result. Validate its identifiers against the referenced immutable revision, not only its hash. The requests generation_fingerprint/revision_id pair must target the same revision (a composite FK/unique target), not two unrelated individually valid rows. Manifest schema is exactly `{schemaVersion:"M05_INPUT_MANIFEST_V1",byteLength,chunkCount,payloadSha256,chunkHashes,inputFingerprint,sourceFingerprint,policyFingerprint}` with positive safe-integer byteLength/chunkCount, chunkHashes in ordinal order, and chunkCount = ceil(byteLength/65536). The revision canonical bytea ceiling is 268,435,456 bytes; exceeding it fails capacity before writes without dropping provenance.

The same-key stored incumbent is fully integrity-validated before any `IDEMPOTENCY_KEY_REUSED` return. Same key/same canonical request returns original accepted result with replayed true, without provider call or mutable-predecessor recheck. Different key/same generation adopts the committed winner only after verifying identical canonical input/policy/generation intent and the winner's valid projection; it may add one request association. Different key/different regenerationToken creates a new revision even if output prose is identical. Same key/different request rejects with no new rows.

For a new key, before live source/policy resolution, query accepted requests by semanticRequestFingerprint and validate every matching request, input, and revision closure. Compare the canonical request bytes with only idempotencyKey removed. All byte-equal matches must resolve to the same generation/revision; mismatches or inconsistent winners fail integrity/collision, never choose the first convenient row. An exact semantic alias adopts the retained policy/input/winner and adds only the new request row under key/generation locks; this permits alias replay while the upstream database/provider is unavailable. In the absence of such a validated alias, first generation requires the live verified source. Version-controlled historical artifact registries must remain available to validate previously accepted policy bytes, but no current provider credential/configuration activation is needed to replay them.

Transactions serialize same keys/generations using transaction-scoped advisory locks, ordered by unsigned UTF-8 key bytes with distinct namespaces for key/generation. No SQL UPDATE permission is needed for advisory locks. Recheck after lock acquisition. Hash equality never replaces byte equality; same content ID with byte-distinct canonical input/output is `CONTENT_HASH_COLLISION`, not reuse. Compare each matched incumbent before choosing one; alternate unique conflicts fail closed. Raw unique/SQL errors are translated to safe errors, never accepted success. At most three transaction attempts total for serialization/deadlock; other errors are not retried. Provider work is outside the write transaction and not repeated during transaction retries; concurrent callers may each call a fake/provider once, but only one committed generation wins.

Crashes before commit leave no partial accepted graph. An uncertain commit is resolved by accepted lookup before another provider call. If the database is unavailable, return a failure rather than inventing a new accepted result. Restored corruption fails before replay or preview; do not return an unchecked cache. Input snapshots are self-contained for historical replay, so later M04 unavailability does not prevent a valid accepted replay; first-generation reads require verified live upstream persistence.

## 11. Source snapshot stability across generation

Only immutable accepted source is used. There is no transaction spanning a provider call and the M04 source database. The read port produces a fully verified immutable snapshot; the draft service copies it into immutable local bytes before asynchronous work, preventing caller mutation. Durable source identity is checked again against the candidate at write and on every read. The new schema does not create a foreign key or grant into M04 tables. This is a copied, cryptographically closed projection of an accepted historical binding, not a transaction that approves current mutable identity state.

## 12. Authority and migration process

M05 migration owner is separate from runtime and is never used by application/provider code. New `M05_WRITER_GROUP` is NOLOGIN; configured M05 LOGIN has only membership in that group and ordinary connection capability. It must not be superuser, owner, BYPASSRLS, CREATEROLE, CREATEDB, REPLICATION, or have inbound/outbound elevated membership paths. M01/M02/M04 roles receive no M05 privileges; M05 roles receive no M01–M04 privileges. Shared PUBLIC database connection does not imply object rights.

Within `ai_ark_m05`, the complete runtime allowlist is: schema USAGE; SELECT and INSERT on inputs, input_chunks, revisions, requests. No sequence exists. No explicit application-function EXECUTE, schema CREATE, grant option, TEMP-based authority, table REFERENCES/TRIGGER, UPDATE, DELETE, TRUNCATE, ownership, default privilege, or SECURITY DEFINER path. Trigger functions are SECURITY INVOKER, fixed search_path, no helper callable by runtime; revoke PUBLIC EXECUTE/CREATE/USAGE on all M05-owned objects. PostgreSQL implicit trigger invocation must be tested under actual LOGIN rather than assuming it needs a new EXECUTE grant. Any additional grant is a spec blocker.

Freeze a canonical `004_m05_runtime_privileges.json` allowlist and SQL+manifest composite hash in migration tooling when implementation stabilizes. Every allowed cell needs a named application path and denied-cell tests. Validate both existing and new LOGINs, membership closure, direct/effective/third-role/PUBLIC/default privileges, owned object inventory/OIDs, function source/security settings and trigger bindings at startup and checkout. No blanket bypass for unknown tables/functions or third roles. M04's existing validator/manifest checks remain active and unchanged in meaning; the M05 namespace must be separately inventoried, not mistaken for an authorized extension of the M04 namespace.

Extend existing migration runner/validator only for an exact forward 004 step and its own ledger identity, not rewriting 001–003 or their ledger values. Test blank apply, exact prefixes, existing 003 upgrade, interruption/retry, repeat no-op, wrong hash, missing/extra object, invalid ACL and canonical payload. Installation/setup may seed fixtures only as the separately scoped disposable test owner. Production credentials/targets remain forbidden. Carry forward the stop-admission/drain/change/validate/reopen procedure for all three adapter classes; no owner DDL overlaps runtime transactions. Actual production admission enforcement remains future deployment work and blocks go-live, not this local implementation milestone.

## 13. Budgets and operational semantics

All byte counts are UTF-8, scalar counts count Unicode scalars. Source input budget and chunking are §10; provider/draft/request budgets are §§5/7/8. Provenance can reference all 4,096 EvidenceItems, 20 Claims, and 81,920 links independently of 64 preview items. Never truncate provenance to satisfy preview budgets. Input/source validation cannot be replaced by schema-only checks for speed.

Fixture maximum must reconstruct all selected evidence and complete source closure after restart and backup/restore. Separate measured tests for source-read, projection, persistence, and replay; a 240-second test timeout applies to each full maximum operation, not one artificially tiny batch. The 60-second application/provider target is measured on the bounded ordinary draft fixture; maximum-load latency is separately reported, not falsely labeled ≤60 seconds. No timing-based assertion is waived by increasing a timeout after failure without review. No live-provider latency/cost claim is made from fake tests.

## 14. Required fixture, hostile, and concurrency matrix

Every row requires a named test and executed receipt in `M05_REPORT.md`; filtered subsets/skips never count as the full gate.

1. Complete deterministic and AI-derived eligible bindings; all fourteen sections; exact label; minimum/fewer/more-than-six capabilities; multiple installation paths with preserved grouping.
2. Each of eleven material requirements missing/unsupported/ambiguous/review-required; conflicting purpose, missing license, no qualifying limitation: blocked, zero provider calls/writes. Optional absence, inferred target user, marketing text, unsafe commands, and unknown maintenance remain explicit without invented facts.
3. Every field-value union arm; pointer eligibility; class/status/qualifier mapping; mixed support; context-only links; no editorial/test/creator authority; zero badge/score/rank.
4. Foreign/missing/duplicate/reordered evidence; full-input and child hash mismatch; coherent wrong-lineage rehash; wrong expected binding; forged accepted envelope; corrupted private cache; array mutation during await; incomplete/extra chunks; direct SQL bypass attempts.
5. Prompt injection, fabricated IDs, added prose, unknown section/template, duplicate JSON keys, invalid UTF-8/surrogates, exponent numbers, U+0000, SQL/shell/HTML text, credential/contact fixtures, provider error echo, timeout/late response, oversized output; no tool or network execution, no leakage, no accepted writes.
6. Every numeric/byte/scalar/count limit exactly-at and one-over, combined maximum and nested projections; bounded optional omissions do not omit limitations or weaken evidence closure.
7. Exact replay and alias key reuse after restart and source unavailability; explicit regeneration; source/prompt/methodology changes; same key/different input and forced byte-distinct hash collisions including stored incumbent corruption.
8. Both arrival orders for same-key/same-generation, same-key/different-generation, different-key/same-generation with different AI selections, different-token generation; injected failure before each table/chunk stage, serialization/deadlock retries/exhaustion, uncertain commit reconciliation, restore and replay.
9. Every allowed grant exercised through its named adapter path; every denied grant rejected under actual LOGIN; peer-role elevation, membership, third-role ACL, default privilege, owner/function/trigger/OID drift, pool checkout after drift. Existing M04 180-cell manifest and actual-LOGIN regression remain unchanged.
10. Migration/recovery cases §12; ensure rejected/failed attempts leave zero accepted rows and logs contain only safe identifiers/codes. PostgreSQL is disposable; external services are fakes.

## 15. Acceptance mapping and required gates

| ID        | Acceptance                                                     | Implementation/test evidence required                           |
| --------- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| M05-AC-01 | Verified durable M04 handoff, no raw source/rebind shortcut    | read-port integration + forged/corrupt envelope negatives       |
| M05-AC-02 | M04 blockers preserved                                         | all material requirement matrix, zero writes/calls              |
| M05-AC-03 | Fourteen sections, concise outcome-led unapproved output       | deterministic/AI fixture and scalar-bound tests                 |
| M05-AC-04 | Claims/classes/qualifiers/evidence remain attributable         | total typed atom mapping + adverse support cases                |
| M05-AC-05 | AI cannot invent content or acquire authority                  | closed selection output, injection/forgery tests                |
| M05-AC-06 | Immutable durable provenance/revision/idempotency              | actual PostgreSQL, crash/replay/restore matrix                  |
| M05-AC-07 | Exact canonical bytes and complete Unicode/number domain       | nested round-trip, chunks, canonical rejection, collision tests |
| M05-AC-08 | Least privilege; no predecessor authority regression           | frozen manifests, named grant matrix, all LOGIN/drift tests     |
| M05-AC-09 | Forward migration and recoverable failures                     | prefixes, ledger drift, no-op and atomic-failure tests          |
| M05-AC-10 | Explicit regeneration and first-winner concurrency             | both-order concurrency and provider-metric replay tests         |
| M05-AC-11 | Bounded output, no silent truncation/leakage                   | all exact/one-over and maximum tests                            |
| M05-AC-12 | No M06+, publication, UI, live-provider or production behavior | whole-diff/dependency/source-safety review                      |

Implementation gates under pinned Node 22.23.1 / pnpm 11.7.0:

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm test:fixtures
pnpm test:adversarial
pnpm test:integration
pnpm test
git diff --check
git diff --cached --check
```

Also run the new exact M05 integration/migration/recovery files using `pnpm exec vitest run --config vitest.integration.config.ts <actual-file>`, inspect selected files, retain commands/results, and verify a source-only copy with frozen install and verify. Database runner tests use only disposable targets. Empty suites, filter skips, missing Docker, unavailable provider, or passed subsets are not acceptance. No E2E/UI pass is claimed because no UI exists.

Before implementation GO: freeze an inventory of all tracked/nonignored files including new files (exclude only the mutable report, document algorithm); rerun full applicable gates unchanged; review the whole diff including staged/unstaged/untracked content and scan secrets; independently review at R2. Raw whitespace checks cover new files using a non-mutating temporary index or equivalent full-patch check. The M04 two-line exception applies only to those unchanged approved files, never new M05 files. Security, provenance, authority, migration, or gate gaps mean NO-GO.

## 16. Specification approval gate and implementation sequence

Specification readiness requires a fresh independent read-only review of this exact whole-file hash against upstream authority/code, resolution of all material findings, formatter/path checks, and a separate review record. Review readiness is not implementation authorization or a claim that proposed tests exist/pass.

After exact-hash approval AND separate implementation authorization: contracts/fixtures first; verified M04 read bridge; deterministic safe atom/rendering layer; provider selection port; migration/manifest and durable adapter; concurrency/recovery/authority matrix; unchanged-candidate gates and whole-patch review. Any inability to meet the frozen upstream contracts or approved grant boundary returns to specification review; do not improvise amendments in code.

Commit, push, PR, merge, deployment, release, production migration, M06+, or live provider use each remains separately authorized. No manual secrets, account setup, or production changes are required for this specification review.
