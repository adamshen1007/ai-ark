# M02 — Skill Detection and Resource Identity

## 1. Status and authorization

- Document status: `APPROVED`.
- Implementation status: `AUTHORIZED; REMEDIATION IN PROGRESS`.
- Authorized predecessor: M01 `GO` at `2c55488357b31d9780a56d96488dad419f7195f3`.
- Governance baseline: `85198bcfb62caaaf637271c02398f4b7390d4e6e`.
- Previous specification decision: `APPROVED`.
- Previous approved substantive specification SHA-256:
  `c30e395708f5e6ddc3596b6c18b7b8d8c0410c9e60105e116cd151967a3316fb`.
- Previous post-approval-record SHA-256:
  `6216a4a7687581833f50f373ee2c383e4e8524e5b90f517ce0200a4653044489`.
- First-amended rejected specification SHA-256:
  `dee6b63c7590e3a50398191b25fbe21337bd71dde923b157f573ef7aeb04f191`.
- First-amended independent-review decision: `REJECT`.
- First-amended human-approval recommendation: `NO-GO — AMENDED SPECIFICATION NOT READY`.
- Second-amendment reason: close `M02-AR-B01` through `M02-AR-B06` without implementation changes.
- Second-amended rejected specification SHA-256:
  `fe71b8d1afcc95af53a49e98dd81238fdebb7a2a58a0f8bcb872d6d20816b5a6`.
- Second-amended independent-review decision: `REJECT`.
- Second-amended human-approval recommendation: `NO-GO — SECOND-AMENDED SPECIFICATION NOT READY`.
- Third-amendment reason: close `M02-SAR-01` through `M02-SAR-05` and their direct consistency consequences
  without implementation changes.
- Third-amended rejected specification SHA-256:
  `22de049fd1cf12c1e35034476ffc5c4aa6ef5b722871ae3d6fb989b25c83a345`.
- Third-amended independent-review decision: `REJECT`.
- Third-amended human-approval recommendation: `NO-GO — THIRD-AMENDED SPECIFICATION NOT READY`.
- Fourth-amendment reason: close the remaining `M02-SAR-01` first-use guard lifecycle defect without
  implementation changes.
- Fourth-amended rejected specification SHA-256:
  `78047af8b51d1ba4c8a41a3e6e13ed9cdcff9615f729485af14e9ef598ecab10`.
- Fourth-amended independent-review decision: `REJECT`.
- Fourth-amended human-approval recommendation: `NO-GO — FOURTH-AMENDED SPECIFICATION NOT READY`.
- Fifth-amendment reason: close `M02-FAR-01` by specifying bounded fresh-transaction retries for stale
  PostgreSQL Serializable attempts without implementation changes.
- Fifth-amended rejected specification SHA-256:
  `46851139f4caaf94ee637088b6d4201356566b932f862d5c4b6eaa7d49e04280`.
- Fifth-amended independent-review decision: `REJECT`.
- Fifth-amended human-approval recommendation: `NO-GO — FIFTH-AMENDED SPECIFICATION NOT READY`.
- Sixth-amendment reason: close `M02-FIR-01` by preserving immutable caller concurrency expectations across
  fresh PostgreSQL transaction attempts without implementation changes.
- Sixth-amended substantive specification SHA-256:
  `fc7fa5de5640a461f927cde5be74a0b9faadb2da7db88b3ea7b1b4c3d059b284`.
- Sixth-amended independent-review decision: `APPROVE`.
- Sixth-amended human-approval recommendation: `GO — SIXTH-AMENDED M02 SPECIFICATION READY FOR HUMAN APPROVAL`.
- Sixth-amended human approval: `GRANTED`.
- Sixth-amended implementation authorization:
  `HISTORICAL — SUSPENDED AFTER APPROVED-SPECIFICATION DEFECT DISCOVERY`.
- Approved-specification defect: `M02-SID-01 — CALLER-AUTHORIZED GUARD KEYS DEPEND ON FUTURE SERVER-ALLOCATED IDS`.
- Seventh-amendment reason: make every caller-authorized concurrency guard identity allocation-independent while
  preserving the single immutable-request architecture and all previously closed contracts.
- Seventh-amendment regression preservation: `M02-FIR-01`, `M02-FAR-01`, `M02-SAR-01` through `M02-SAR-05`,
  `M02-AR-B06`, RV-02, topology, clarification, audit, handoff, job replacement, exact 256-mode count, and M03
  exclusion remain closed/unchanged except for the guard-identity correction required by `M02-SID-01`.
- Seventh-amended rejected specification SHA-256:
  `33d18bbc9b83721ed6e628b47e4a688c7033950cb287500718f30bfe461a781c`.
- Seventh-amended independent-review decision: `REJECT`.
- Seventh-amended blocker: `M02-SGR-01 — PLANNED/EXISTING TAGGED GUARD REFS ARE NOT LIFECYCLE-STABLE`.
- Eighth-amendment reason: replace creation-state-tagged identity/version guard references with one immutable
  lifecycle anchor whose canonical bytes persist from first-use absence through every later positive use.
- Eighth-amendment regression preservation: `M02-SID-01`, `M02-FIR-01`, `M02-FAR-01`, `M02-SAR-01` through
  `M02-SAR-05`, `M02-AR-B06`, RV-02, topology, clarification, audit, handoff, job replacement, exact 256-mode
  count, and M03 exclusion remain closed/unchanged.
- Eighth-amended rejected specification SHA-256:
  `8d40d57f99863029cebf292ba172bfdd17f345c0a7d2c9e094256d6f31bb36ab`.
- Eighth-amended independent-review decision: `REJECT`.
- Eighth-amended closure: `M02-SGR-01` is `CLOSED`.
- Eighth-amended blocker: `M02-AIP-01 — AUTOMATIC IDENTITY-RESOLUTION PERSISTENCE HAS NO CLOSED CANONICAL
  TRANSACTION/GUARD/AUDIT PROJECTION`.
- Ninth-amendment reason: define one closed typed system-origin identity operation, finite projector matrix,
  immutable expectations, canonical transaction, result, audit, Decision, handoff and human-interoperation
  contract for every Section 13 outcome.
- Ninth-amendment regression preservation: `M02-SGR-01`, `M02-SID-01`, `M02-FIR-01`, `M02-FAR-01`,
  `M02-SAR-01` through `M02-SAR-05`, `M02-AR-B06`, RV-02, topology, clarification, manual audit/handoff, job
  replacement, exactly 256 manual modes, and M03 exclusion remain closed/unchanged.
- Ninth-amended rejected specification SHA-256:
  `a2ca4e690f29f27308cc6b960f77d6e83ebc20052af7cc989bd565535162defe`.
- Ninth-amended independent-review decision: `REJECT`.
- Ninth-amended architectural closure: `M02-AIP-01` is `CLOSED`.
- Ninth-amended blocker set: `M02-SPM-01 — SYSTEM PROJECTOR MATRIX IS NOT STRUCTURALLY EXHAUSTIVE`;
  `M02-SAP-01 — SYSTEM AUDIT/REJECTION SEMANTICS ARE NOT CLOSED`; and
  `M02-SPV-01 — SYSTEM PROVENANCE/FINGERPRINT/ID SEQUENCING IS INCOMPLETE`.
- Tenth-amendment reason: close the exact 22-mode projector, S7 proposal, S9/S10 reanalysis, conditional
  AnalysisRun, decision-input/request fingerprints and post-freeze ID order, accepted/rejected audit semantics,
  tier metadata, and human-Decision precedence together.
- Tenth-amendment regression preservation: all prior closed blockers, the typed system authority/transaction,
  exactly 256 human modes, topology, clarification, job replacement, M03 exclusion and non-spec bytes remain
  closed/unchanged.
- Tenth-amended rejected specification SHA-256:
  `88e256c7f28ed9e01e1f41eb4eb1b847560807eb7873af55422f514fa132b231`.
- Tenth-amended independent-review decision: `REJECT`.
- Tenth-amended remaining blocker family: proposal-to-confirmation guard continuity, canonical authoritative run/
  signal fingerprint vocabulary, replacement-job-to-S9/S10 handoff reachability, and pre-allocation rejected-
  system attempt sequencing.
- Eleventh-amendment reason: close those four linked lifecycle/fingerprint defects without changing the exact 22
  system or 256 human modes.
- Eleventh-amended rejected specification SHA-256:
  `094b5e81c84376f185a30b2723cfa350b15e6e9def62d9107b0ab18c03942168`.
- Eleventh-amended independent-review decision: `REJECT`.
- Eleventh-amended blocker set: `M02-DPL-01`, `M02-RJC-01`, `M02-RSA-02`, and `M02-DIC-02`.
- Twelfth-amendment reason: close optional proposal provenance, canonical replacement input/current-controller
  aggregate semantics, phase-aware rejected-system identity, and the complete typed Decision-input vocabulary
  together without changing the exact 22 system or 256 human modes.
- Twelfth-amended rejected specification SHA-256:
  `1a3a0ffa3f33d6985e87bf01219e98877bb4b3736333fbe08f56d245609956ce`.
- Twelfth-amended independent-review decision: `REJECT`.
- Twelfth-amended blocker set: system replay/idempotency ordering; cross-writer S7 proposal cleanup; canonical
  Decision-child row identity/auditing; and S8 provider-fork signal representability.
- Thirteenth-amendment reason: close those four cross-section gaps with a pre-projector replay locator, universal
  P1 proposal cleanup, exact typed Decision-child rows/audits, and an exact S8 provider-fork signal.
- Thirteenth-amended substantive specification SHA-256:
  `da48d430f6f4c205806a337b57f19666ea47a0aa3c93c6fb2f8db7a4bc665542`.
- Thirteenth-amended independent-review decision: `APPROVE`.
- Thirteenth-amended independent-review recommendation:
  `GO — THIRTEENTH-AMENDED M02 SPECIFICATION READY FOR HUMAN APPROVAL`.
- Specification decision: `APPROVED`.
- Human approval: `GRANTED FOR THIRTEENTH-AMENDED SHA`.
- Thirteenth-amended human approval date: `2026-08-15`.
- Approved-specification defect: `M02-ERO-01 — EXACT RESOURCEVERSION REUSE HAS NO CLOSED IDENTITY OUTCOME`.
- Fourteenth-amendment reason: add the exact `EXACT_REPEAT_REUSE` outcome and bind system S3/S4/S9 plus human
  `ATTACH_NEW_VERSION(A2/A3)`/ambiguity-dispatch Decisions, candidate state, result postconditions, audits,
  persistence and verification to same-I/V reuse without creating or implying a new ResourceVersion.
- Fourteenth-amended substantive specification SHA-256:
  `4549470853202ea7c5a6c1ac831d66fa71ac089cd39abb5ed033f6d5791dde27`.
- Fourteenth-amended independent-review decision: `APPROVE`.
- Fourteenth-amended independent-review recommendation:
  `GO — FOURTEENTH-AMENDED M02 SPECIFICATION READY FOR HUMAN APPROVAL`.
- Fourteenth-amended human approval: `GRANTED`.
- Fourteenth-amended human approval date: `2026-08-15`.
- Sixth-amended human approval date: `2026-08-11`.
- Implementation authorization: `GRANTED FOR FOURTEENTH-AMENDED SHA`.
- Historical approval authority: Human product owner / repository owner.
- Historical approval date: `2026-08-09`.

The fourteenth-amended substantive SHA-256 received fresh independent approval and explicit human authorization.
Implementation and migration remediation may proceed only against those approved substantive bytes. M02 consumes only immutable, completed M01
`SourceSnapshot` results. It never restores or interprets skipped, quarantined, rejected, missing, mutable,
or otherwise unavailable evidence.

## 2. Objective

For one immutable M01 `SourceSnapshot`, M02 must deterministically produce and retain:

1. one repository classification;
2. zero or more independently rooted `ResourceCandidate` records;
3. repository-level collection/application context;
4. an explicit identity decision for every candidate; and
5. an identity-resolved handoff marker for only the candidates safe to enter M03.

No descriptive or semantic generation may begin before stable identity resolution.

## 3. Scope and exclusions

M02 includes deterministic classification and root detection, provider-neutral AI-assisted proposals using
only an offline deterministic fake for required gates, reconciliation, explicit non-Skill/ambiguous/
unsupported outcomes, stable identity shells, version reuse, duplicate/fork/mirror analysis, manual
resolution contracts, durable job/review state, persistence/migration contracts, and deterministic tests.

M02 excludes Capability, Task, installation, dependency, permission, compatibility, license-meaning,
creator-identity, version-meaning, purpose, outcome, target-user, use-case, summary, and all other semantic
extraction. It also excludes production AI integration, live-provider-required gates, checkout, execution,
package installation, dynamic import, runtime verification, Claims, drafts, approval, publication, UI,
directory, search, ranking, mirroring services, deployment, `M02_REPORT.md`, and all M03+ behavior.

Classification evidence is M02 decision provenance, not an M04 `EvidenceItem` and not publication evidence.

## 4. Terminology and canonical serialization

The following identities are separate and MUST NOT be substituted for one another:

| Term               | Meaning                                                              | Includes methodology?            |
| ------------------ | -------------------------------------------------------------------- | -------------------------------- |
| Content identity   | Candidate-owned and explicitly shared acquired bytes                 | No                               |
| Source identity    | Provider repository ID, immutable snapshot, and normalized root      | No classifier data               |
| Location identity  | Candidate root and owned/shared topology inside one snapshot         | No content bytes beyond hashes   |
| Analysis identity  | Exact bounded inputs and the methodology/prompt used to analyze them | Yes                              |
| Record idempotency | Key for one persistence operation or immutable decision              | Only inputs owned by that record |

All fingerprints use SHA-256 of UTF-8 RFC 8785-style canonical JSON: object keys sorted by Unicode code
point; arrays kept in the order mandated here; strings normalized to NFC; integers in base-10; booleans and
`null` canonical; no insignificant whitespace; no floating-point values in fingerprint payloads. Hash values
are lowercase 64-character hexadecimal strings. A hash match is only an index lookup: reuse additionally
requires byte-exact equality of the stored canonical payload. A domain evidence/content lookup collision writes
no identity association, retains the attempted evidence, and is represented by accepted blocking S6 conflict
`CONTENT_FINGERPRINT_PAYLOAD_COLLISION`. A collision in infrastructure command/operation/request/idempotency or
guard payload identity returns rejected `FINGERPRINT_COLLISION`. Neither path may be implementation-selected,
and both require operator review.

## 5. Repository classification contract

The canonical `RepositoryClassification` values remain:

| Value                    | Exact meaning                                                                     | Progression                                       |
| ------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------- |
| `SINGLE_SKILL`           | Exactly one independently usable Skill root; no application or collection context | Identity resolution                               |
| `MULTIPLE_SKILLS`        | Two or more independent Skill roots; no collection index or application context   | Each root independently                           |
| `SKILL_COLLECTION`       | Two or more independent roots are explicitly enumerated by a collection index     | Children only; collection is not a Skill Resource |
| `SKILL_PLUS_APPLICATION` | One or more independent roots coexist with an application boundary                | Skill roots only                                  |
| `NON_SKILL`              | No eligible positive Skill signal exists and evidence coverage is complete        | Complete M02 with zero candidates                 |
| `AMBIGUOUS`              | Material evidence, root, class, or ownership conflict remains                     | Blocking review                                   |
| `UNSUPPORTED`            | M01 evidence coverage or a hard M02 policy limit prevents safe classification     | Terminal until a new supported observation        |

Every immutable `RepositoryClassificationRun` records source snapshot, classification, nullable confidence,
source (`DETERMINISTIC`, `AI_ASSISTED`, `RECONCILED`, or `HUMAN_OVERRIDE`), ordered evidence and root
references, warning/ambiguity codes, review state, and the exact policy/methodology/prompt version fields required
by its declared run source, plus input and
output fingerprints, analysis-run ID when applicable, superseded-run ID, and timestamp. Deterministic runs
use `confidence = null`; their result follows the exact algorithm rather than a score. AI confidence is a
proposal only and cannot override a contradiction or any review rule.

## 6. Deterministic pre-classifier algorithm

### 6.1 Input eligibility and exact predicates

Only M01 entries with disposition `ACQUIRED`, verified content hashes, safe normalized POSIX paths, and
bounded UTF-8 `SourceDocument` text may be positive evidence. The classifier evaluates these predicates in
the stated order:

1. `HARD_UNSUPPORTED`: the snapshot is incomplete, any M01 required inventory/content limit was hit, an
   otherwise candidate-bearing `SKILL.md` is unavailable, a case/path collision exists, or an M02 analysis
   hard ceiling in Section 18 would be exceeded without evidence-preserving truncation.
2. `EXCLUDED_PATH`: a path has a segment exactly equal, case-insensitively, to `docs`, `doc`, `examples`,
   `example`, `templates`, `template`, `tests`, `test`, `fixtures`, `fixture`, `vendor`, `vendored`,
   `generated`, `dist`, `build`, or `tutorials`.
3. `SKILL_DECLARATION`: basename is exactly `SKILL.md`, the path is not `EXCLUDED_PATH`, the file is
   acquired UTF-8, and its first YAML front-matter block has a non-empty scalar `name` field of at most 128
   Unicode scalar values. Front matter begins on line 1 with `---`, ends at the next line exactly `---`, is
   at most 50 lines/8,192 UTF-8 bytes, permits only scalar keys, and duplicate keys are invalid.
4. `EXAMPLE_DECLARATION`: basename is exactly `SKILL.md` and the path is `EXCLUDED_PATH`; it is negative
   evidence and never creates a root.
5. `COLLECTION_INDEX`: an acquired root-level `README.md` or `SKILLS.md` contains a heading exactly
   `Skills` or `Skill collection` (ASCII case-insensitive) followed before the next heading by links to at
   least two distinct discovered roots; link targets normalize exactly to those roots.
6. `APPLICATION_BOUNDARY`: outside every discovered root, an acquired root-level manifest is exactly one
   of `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, or `pom.xml`, and either acquired root-level
   source directory `src`, `app`, `apps`, `web`, or `server` contains at least one acquired regular file.
7. `ROOT_WARNING`: malformed front matter, two declarations mapping to the same root with conflicting names,
   parent/child declarations, a declaration reachable only through shared ownership, or collection links
   that name a missing/extra root.

The root for a `SKILL_DECLARATION` is `.` for root `SKILL.md`; otherwise it is the declaration's parent
directory. One valid `SKILL_DECLARATION` is the minimum positive evidence. README text, topics, descriptions,
filenames other than an eligible `SKILL.md`, archived status, or provider fork metadata cannot create a root.
The same bounded front matter may expose exact scalar `id`, `external_id`, `creator_id`, or `organization_id`
tokens for identity matching. Those tokens are inert strings, cannot create a root, undergo no semantic creator
extraction, and are ignored if duplicated, malformed, or unsupported by an exact evidence reference.

### 6.2 Deterministic parser profile v1

All implementations use the same versioned parser profile; changing any rule creates a new classification
policy/methodology version.

**Front matter.** The bytes between the exact delimiter lines are parsed as YAML 1.2.2 using the Core schema,
with these additional restrictions: the document is one top-level mapping; keys are plain ASCII matching
`[A-Za-z_][A-Za-z0-9_-]*`; values are single-line string scalars only; comments are allowed under YAML 1.2.2;
directives, explicit tags, anchors, aliases, merge keys, flow/block collections, document markers inside the
block, multiline scalars, tabs used as indentation, duplicate keys, and non-string/null/boolean/numeric values
are forbidden. Single- and double-quoted strings follow YAML 1.2.2 escaping; plain strings are trimmed only as
specified below. Any parse error or forbidden construct produces `MALFORMED_FRONT_MATTER`, no positive signal,
and `ROOT_WARNING`; it is never repaired or interpreted by AI.

**Markdown.** Collection indexes use CommonMark 0.31.2 block/inline parsing. Only ATX heading nodes at levels
1–6 and non-image inline link nodes are recognized; Setext headings, raw HTML, autolinks, and bare URLs do not
count. A heading matches after inline text is concatenated, CommonMark escapes/entities are decoded, ASCII
whitespace is collapsed to one space and trimmed, and ASCII case-folding equals `skills` or
`skill collection`. Only relative link destinations are eligible. Schemes, protocol-relative forms, authority,
query, and absolute paths are rejected; fragments are removed; percent-encoded unreserved URI bytes are
decoded; remaining percent escapes are uppercased; dot segments are resolved under M01 path rules; and a
target must resolve exactly to a discovered root or its `SKILL.md`. Link labels and titles do not affect the
target. Eligible targets are de-duplicated and sorted by normalized root order.

**Identity-token normalization.** Decode UTF-8, normalize with Unicode NFKC, apply Unicode Default Case
Folding version 15.1, trim Unicode White_Space code points, map every maximal run of White_Space, ASCII `_`,
or ASCII `-` to one ASCII `-`, and trim leading/trailing `-`. Letters and decimal numbers from any script and
ASCII `-` are retained; any other punctuation/symbol/control code point makes the token invalid. The result
must contain 1–128 Unicode scalar values. Thus `" React-Agent "` becomes `react-agent`. The original scalar,
normalized token, Unicode policy version, and evidence reference are retained.

### 6.3 Root discovery and class derivation

The algorithm is total and ordered:

1. If `HARD_UNSUPPORTED`, return `UNSUPPORTED`, retain all available evidence/reasons, and create no root.
2. Discover, normalize, de-duplicate, and order roots from all `SKILL_DECLARATION` signals.
3. If any `ROOT_WARNING` cannot be resolved by the ownership rules in Section 7, return `AMBIGUOUS` with the
   proposed roots retained but create no candidate.
4. If there are zero roots, return `NON_SKILL` and retain example/negative evidence.
5. If `COLLECTION_INDEX` is true, there must be at least two roots and the linked set must equal the root set;
   return `SKILL_COLLECTION`.
6. Otherwise, if `APPLICATION_BOUNDARY` is true, return `SKILL_PLUS_APPLICATION` for one or more roots.
7. Otherwise return `SINGLE_SKILL` for one root or `MULTIPLE_SKILLS` for two or more roots.

There are no deterministic weights, confidence thresholds, ties, or implementation-selected signals.
Changing a predicate, path list, parser bound, class order, or ownership rule requires a new classification
policy/methodology version and full fixture revalidation. AI assistance is invoked only for a valid but
materially ambiguous result or an explicitly configured comparison run; it cannot make `HARD_UNSUPPORTED`
supported. Deterministic/AI disagreement follows Section 10 and never resolves by score.

## 7. Candidate roots, ownership, and fingerprints

### 7.1 Normalization and ownership

Repository root is `.`. Nested roots are relative normalized POSIX paths without leading/trailing slash.
M01 traversal, absolute path, backslash, null, ambiguous segment, case-collision, symlink, and submodule rules
remain controlling.

For ordered discovered roots `R`:

- an acquired regular file is `OWNED` by the deepest root that is its path-segment ancestor;
- the root's own eligible `SKILL.md` is always `OWNED` by that root;
- a file outside all nested roots is not owned by them;
- for root `.`, descendants under a nested root are excluded from `.` ownership;
- an outer root and nested root cannot both own one path;
- duplicate path records are invalid, and ordering never changes ownership.

A repository-level acquired file may be `SHARED` only if it is outside every nested root, is one of
`README.md`, `LICENSE`, `LICENSE.md`, `CHANGELOG.md`, or `SECURITY.md`, and a retained evidence reference
explicitly associates it with two or more root IDs. Shared association is stored as an ordered pair of path
and sorted distinct root IDs. A file cannot be both owned and shared. Any other overlap or parent/child Skill
declaration is `AMBIGUOUS`. Excluded/example paths never become owned or shared candidate content.

Changing root sets recomputes ownership. If an entry moves between owned, shared, or excluded topology, the
location/root fingerprint changes. If an included owned/shared file hash changes, the content fingerprint
changes. Reordering identical inputs changes neither.

### 7.2 Fingerprint model

For each `ResourceCandidateRoot`, define these immutable canonical payloads:

```text
candidateContentPayload = {
  schemaVersion,
  owned: [{ pathRelativeToRoot, contentSha256 }],
  shared: [{ repositoryPath, contentSha256 }]
}

candidateRootPayload = {
  schemaVersion,
  normalizedRoot,
  ownedRepositoryPaths: [string],
  sharedRepositoryPaths: [string]
}

candidateAnalysisPayload = {
  schemaVersion,
  sourceSnapshotId,
  candidateRootFingerprint,
  candidateContentFingerprint,
  classificationPolicyVersion,
  identityPolicyVersion,
  promptBundleVersion,
  boundedInputFingerprint
}
```

`boundedInputFingerprint` is SHA-256 of this `BoundedClassificationInputV1` canonical payload:

```text
{
  schemaVersion: "1",
  snapshot: {
    sourceSnapshotId,
    provider,
    providerRepositoryId,
    immutableRevision,
    acquisitionPolicyVersion
  },
  files: [{ normalizedPath, entryKind, disposition, byteLength, contentSha256 }],
  exclusions: [{ normalizedPath, disposition, reasonCode, contentSha256OrNull }],
  excerpts: [{ evidenceReferenceId, normalizedPath, locator, utf8ByteLength,
               unicodeScalarLength, excerptSha256, excerptUtf8 }],
  truncation: [{ subjectType, subjectKey, originalCountOrBytes, retainedCountOrBytes,
                 orderingBoundaryOrNull, reasonCode }],
  limits: {
    fileTreeEntries, candidateRoots, evidenceReferencesTotal, evidenceReferencesPerCandidate,
    excerptsTotal, excerptsPerCandidate, bytesPerExcerpt, scalarsPerExcerpt,
    totalRequestBytes, estimatedInputTokens, responseBytes, warningCodes,
    ambiguityReasonCodes, repairAttempts, providerAttempts, attemptTimeoutMs, totalTimeoutMs
  },
  policy: {
    classificationPolicyVersion, identityPolicyVersion, parserProfileVersion,
    analysisPolicyVersion, promptBundleVersion
  },
  deterministicAnalyzer: {
    inputEvidenceReferenceIds, classification, candidateRootFingerprints,
    warningCodes, ambiguityReasonCodes, requiresAiAssistance
  }
}
```

Arrays use these orders: `files` and `exclusions` by normalized path, then disposition/reason/hash;
`excerpts` by evidence-reference ID, path, locator, then excerpt hash; `truncation` by subject type/key/reason;
analyzer evidence IDs/root fingerprints/warnings/reasons by byte-exact value. File and exclusion sets are
disjoint and together enumerate every M01 inventory entry visible to the classifier. `excerptUtf8` is the exact
post-truncation text; its hash and lengths are verified before hashing. Limits contain the exact Section 18
integer values, not implementation defaults. `estimatedInputTokens` is the enforced integer ceiling, not a
provider-reported measurement.

The payload uses Section 4 canonical JSON and UTF-8 hashing. It excludes database row IDs other than stable
snapshot/evidence references, timestamps, job/run/request IDs, adapter/provider-model identity, attempts,
duration, usage results, AI output, and confidence. A hash match is accepted only after byte-exact equality of
the stored canonical payload; mismatch raises `FINGERPRINT_COLLISION`. Because selected bytes, exclusions,
ordering, excerpts, truncation, limits, policies, and deterministic inputs are all covered, two conforming
implementations must produce identical bytes and fingerprints.

`owned` sorts by `pathRelativeToRoot`, then hash. `shared` sorts by repository path, then hash. Root payload
arrays sort by byte-exact path. `candidateContentFingerprint` excludes provider, repository, snapshot, root
location, ownership methodology, classifier/prompt/model, timestamps, confidence, and record IDs.
`candidateRootFingerprint` expresses location/topology. `candidateAnalysisFingerprint` expresses one analysis.

Distinct roots or repositories containing byte-identical relative owned/shared content MUST have the same
content fingerprint while remaining distinct candidates. The candidate idempotency key is SHA-256 of
`{schemaVersion, sourceSnapshotId, candidateRootFingerprint, candidateContentFingerprint}`. A methodology-
only reanalysis creates a new decision/run, not a duplicate candidate.

## 8. Repository classification group and collection relationships

Each snapshot creates or reuses one non-public `RepositoryCandidateGroup` keyed by
`{sourceSnapshotId, classificationPolicyVersion}`. It stores the reconciled classification, ordered candidate
root IDs, ordered repository evidence/warnings, group fingerprint, and supersession link.

For `SKILL_COLLECTION`, the group has an ordered `INCLUDES` edge to every child candidate. For
`SKILL_PLUS_APPLICATION`, it records one `APPLICATION_CONTEXT` node containing only evidence references and
ordered application paths and has `BUNDLES` edges to each Skill candidate. These nodes are classification
context, never `Resource` identities. Edge order is candidate-root order; the group fingerprint covers class,
ordered child root fingerprints, relationship types/order, warning codes, and evidence-reference IDs.
Repeated processing is idempotent; a changed group payload supersedes rather than mutates the prior group.

## 9. Provider-neutral AI analysis boundary

M02 defines operation `CLASSIFY_REPOSITORY`. Required tests use a deterministic fake adapter only. The
canonical run source is `AI_ASSISTED`, never `FAKE_AI`; fake/production identity is adapter provenance.

An immutable `AnalysisRun` records operation, provider/adapter ID, model or deterministic-fake ID,
prompt-bundle version, classification and identity policy versions, nullable temperature, request and response
fingerprints, bounded usage (input/output bytes and tokens when available), duration milliseconds, attempt,
status (`SUCCEEDED`, `INVALID_OUTPUT`, `LIMIT_EXCEEDED`, `TIMED_OUT`, `FAILED`), validation/repair outcome,
repair count, provider-attempt count, and timestamps.

The request contains only the untrusted-source marker, snapshot/reference IDs, bounded file-tree records,
deterministic output, bounded labelled excerpts, schema/policy versions, and valid evidence IDs. The response
contains schema-only class, ordered roots, nullable confidence, evidence IDs, warning codes, and ambiguity
codes. It has no free-form authority field. Unknown enums, invented/foreign evidence, out-of-envelope roots,
duplicates, invalid order, limit violations, or source-instruction actions fail closed.

The adapter receives no tool, network/GitHub, shell, filesystem, database, queue, object-store, editorial,
approval, or publication authority. AI output cannot create or mutate candidates, identities, versions,
relationships, commands, or approvals.

## 10. Reconciliation

Reconciliation is deterministic and policy-versioned:

1. M01 safety/disposition and Section 18 limits always win.
2. Normalized paths, hashes, provider IDs/fork metadata, and exact bounded manifest fields win over AI text.
3. Agreement on class and exact ordered roots may finalize if no blocking warning exists; both provenances remain.
4. Different root sets, materially different classes, or Skill versus `NON_SKILL` conflict yields `AMBIGUOUS`.
5. `UNSUPPORTED` cannot be overridden by AI or by a human command.
6. Invalid AI output produces an immutable failed run and cannot be partially accepted.
7. A warning involving root ownership, example-only declaration, conflicting exact identity, or limit truncation
   yields review, regardless of confidence.
8. A human resolution creates a new decision linked by `supersedesDecisionId`; prior decision payload is
   immutable and only its explicitly typed active/superseded state plus record version may transition.

Confidence never overrides a higher-precedence exact signal or contradiction.

## 11. NON_SKILL and UNSUPPORTED supersession

Both outcomes retain the snapshot, group, runs, evidence, warnings, reason codes, and audit trail; create no
candidate or identity automatically; prohibit identity resolution and M03; and are idempotent.

`OVERRIDE_NON_SKILL` may supersede `NON_SKILL` only by selecting roots already supported by acquired eligible
evidence and passing all current ownership/limit rules. `UNSUPPORTED` has no override command. It can be
superseded only by a different completed `SourceSnapshot` with supported evidence or a new policy/methodology
run that can process the same immutable evidence without exceeding safety ceilings. Neither path may restore
skipped, quarantined, rejected, missing, unsafe, or mutable M01 evidence. Attempts return
`UNSUPPORTED_OVERRIDE_PROHIBITED`, write a rejected-command audit event, and make no state change.

## 12. ResourceCandidate and identity shells

### 12.1 ResourceCandidate

Each candidate stores opaque ID, source snapshot, root ID/path and root/content fingerprints, reconciled run,
classification/identity policy versions, nullable identity outcome/confidence, nullable target
`ResourceIdentity` ID, status (`CLASSIFIED`, `IDENTITY_REVIEW_REQUIRED`, `IDENTITY_RESOLVED`, `REJECTED`,
`SUPERSEDED`), ordered provenance, record version, and timestamps. It binds to exactly one snapshot/root and
cannot enter M03 unless resolved to exactly one Resource identity and one ResourceVersion identity. It stores
no descriptive/semantic fields. Its non-null identity outcome is one exact Section 13 `IdentityOutcomeV1`
value; successful same-version attachment is `EXACT_REPEAT_REUSE`, never
`EXISTING_RESOURCE_NEW_VERSION`.

### 12.2 Canonical graph compatibility decision

M02 uses distinct non-public `ResourceIdentity` and `ResourceVersionIdentity` shells. It does **not** create a
partially invalid canonical Graph `Resource` or `ResourceVersion`. This resolves the canonical Graph's required
`canonical_name`, `slug`, `display_name`, description, version label, release channel, lifecycle, and editorial
fields without inventing placeholders or public slugs before M03 extraction.

`ResourceIdentity` requires opaque ID, type `SKILL`, status (`ACTIVE`, `AMBIGUOUS`, `REJECTED`), immutable
non-null `guardAnchorCandidateId`, exact source-derived identity token and provenance when available (nullable
when identity is otherwise exact), created timestamp, and record version. `guardAnchorCandidateId` is an FK to
the `ResourceCandidate` that first created the identity shell and never changes when later candidates attach,
Decisions change, or relationships are corrected/superseded. It is internal provenance/concurrency metadata,
not a public identity, name, slug, or version field. An existing identity without this anchor is non-conforming
M02 state and every read, migration, and command fails closed; no anchor may be inferred or invented. The
identity token is only a normalized exact `SKILL.md` front-matter
`name`; it is not a canonical/public name. If no reliable name exists, automatic new-identity creation is
prohibited and review must either cite a reliable acquired exact token or reject the candidate.

`ResourceVersionIdentity` requires opaque ID, Resource identity ID, candidate content fingerprint, immutable
first-observed source revision/snapshot/root references, internal non-public observation label
`snapshot:<first 12 lowercase commit-SHA characters>`, status (`IDENTITY_RESOLVED`, `SUPERSEDED`, `REJECTED`),
created timestamp, and record version. The label is provenance, not a semantic/public version label.
Its stable concurrency reference is deterministically reconstructed from the parent identity's immutable
`guardAnchorCandidateId` plus `candidateContentFingerprint`; it needs no random guard-anchor column. A stored
derived reference/hash is permitted only as byte-reproducible enforcement data and never as independent
authority.

M03 may atomically promote shells into canonical Graph records using the same opaque IDs only after it derives
and validates every required canonical field with provenance. Promotion records field provenance and a
supersession/audit event; the M02 token/observation label never silently becomes `canonical_name`, public
`slug`, `display_name`, description, or `version_label`. Until promotion, canonical Graph foreign keys cannot
target these shells.

The authority mapping is fixed:

| M02 shell field                   | Technical Alpha / canonical Graph destination        | Promotion rule                                                  |
| --------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| `ResourceIdentity.id`             | `Resource.id`                                        | Preserve exactly                                                |
| `guardAnchorCandidateId`          | No canonical/public destination                      | Retain as immutable internal provenance/concurrency metadata     |
| type `SKILL`                      | `Resource.resource_type`                             | Preserve exactly                                                |
| exact identity token/provenance   | Candidate input to `canonical_name` / `display_name` | M03 must validate and provenance-bind; no direct copy guarantee |
| `ResourceIdentity.status`         | Input to lifecycle/editorial state                   | M03 maps under its approved policy; never publication approval  |
| `ResourceVersionIdentity.id`      | `ResourceVersion.id`                                 | Preserve exactly                                                |
| parent identity ID                | `ResourceVersion.resource_id`                        | Preserve exactly                                                |
| candidate content fingerprint     | `ResourceVersion.content_fingerprint`                | Preserve exactly after collision equality check                 |
| first observed immutable revision | `source_revision` / `source_commit_sha`              | Preserve exact provider value                                   |
| internal observation label        | No canonical destination                             | Never promoted as `version_label`                               |
| observations/source links         | `ResourceSource` and version-source provenance       | M03 maps without losing any observation                         |

Canonical fields not listed as exact destinations—including slug, names, descriptions, version label, release
channel/source, dates, current/publication/editorial/lifecycle values, language, creator/organization, and
primary pointers—remain absent from M02 shells and must be supplied or explicitly nullable only under the
approved M03 canonical contract.

### 12.3 ResourceVersion reuse

The canonical ResourceVersion identity key is SHA-256 of
`{schemaVersion, resourceIdentityId, candidateContentFingerprint}`. It excludes snapshot, root, repository,
methodology, prompt, model, timestamps, and confidence. Reuse requires the same Resource identity, identical
content fingerprint, and byte-exact canonical content payload.

- Same snapshot/root/content reuses candidate and version identity.
- A later snapshot or another mirror location with identical content adds an immutable
  `ResourceVersionObservation`; it does not create a version.
- Changed content on exact source continuity yields `EXISTING_RESOURCE_NEW_VERSION` and a new version identity.
- Methodology/prompt/model-only reanalysis is authorized only by a completed canonical `REPLACE_M02_JOB` whose
  byte-distinct `JobReplacementInputV1` fingerprint is retained. It creates an immutable `AnalysisRun` when
  applicable (or explicit null deterministic provenance), then S9/S10 atomically creates the superseding
  `IdentityDecision` while reusing the candidate/version identity; changed decision input is never replay.
- Every observation binds provider repository ID, snapshot, immutable revision, normalized root, source-link
  ID, observed timestamp, and evidence references.

No descriptive generation may occur before shell attachment and an identity-resolved handoff marker.

## 13. Identity resolution precedence and complete matrix

An `ExternalIdentifier` is an immutable scoped tuple:

```text
{
  provider,
  namespace,
  identifierType,
  issuer,
  normalizedValue,
  normalizationPolicyVersion,
  evidenceReferenceId,
  provenanceType,
  reviewState
}
```

`provider` is the canonical source-provider enum. `namespace` is the provider account/organization scope or,
for globally unique provider IDs, the provider name. `identifierType` is `PROVIDER_REPOSITORY_ID` or
`DECLARED_MANIFEST_ID`; arbitrary `id` fields never default to either type. `issuer` is the provider for a
provider ID or the exact manifest format plus declaring organization namespace for a manifest ID.
`normalizedValue` for provider IDs is the exact M01 provider-issued opaque string after NFC and rejection of
leading/trailing whitespace or controls. A manifest ID uses the Section 6.2 identity-token normalization unless
a versioned issuer policy defines a stricter case-sensitive NFC form. Empty or unscoped values are invalid.

External-identifier normalization policy `external-id-v1` is closed to provider `github` for M02. Namespace
input comes only from the M01 provider-asserted `SourceReference.owner` or a human-verified declaration of the
same GitHub owner. It is decoded as UTF-8, normalized with Unicode NFKC 15.1, trimmed of Unicode 15.1
White_Space, rejected if it contains internal whitespace/control/non-ASCII code points, ASCII-lowercased, and
must match `[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?`. ASCII `-` is preserved and never collapsed or exchanged
with `.`, `_`, whitespace, or another separator; every other separator is invalid. Thus `Anthropic` becomes
`anthropic`. Future providers require a new normalization-policy version and cannot reuse this rule implicitly.

Issuer input is an absolute URL parsed under the WHATWG URL Standard 2024. It must use `https`, contain no
credentials, query, or fragment, have an empty path or `/`, and use a DNS hostname rather than an IP literal.
The hostname is normalized by Unicode UTS #46 version 15.1 non-transitional processing with STD3 rules,
converted to lowercase ASCII A-labels, and stripped of one terminal root dot. An absent port or explicit `443`
normalizes to no port; every other port is invalid. The canonical issuer is the hostname alone, so
`https://github.com/` becomes `github.com`. Invalid, empty, relative, or non-canonicalizable issuer input creates
no `ExternalIdentifier` and records `INVALID_EXTERNAL_IDENTIFIER_ISSUER`.

The matching payload contains exactly these non-null strings:

```text
{
  provider,
  issuer,
  namespace,
  identifierType,
  normalizedValue,
  normalizationPolicyVersion
}
```

It is serialized with Section 4 canonical JSON (therefore lexicographically sorted object keys), UTF-8 encoded,
and hashed as `externalIdentifierKeyFingerprint = SHA-256(canonicalBytes)`. No field is omitted and `null` is
forbidden. Provenance/evidence/review state are deliberately excluded from the matching key but remain required
on the record and control whether that key is trusted. Reuse requires byte-exact equality of the stored
canonical payload after a hash lookup. Mismatch blocks association; system identity discovery records accepted
blocking S6 `CONTENT_FINGERPRINT_PAYLOAD_COLLISION`, while a direct infrastructure write attempt rejects with
`FINGERPRINT_COLLISION` under Section 4.

The identity lookup/uniqueness key is
`(provider, namespace, identifierType, issuer, normalizedValue, normalizationPolicyVersion)`. It never matches
on value alone. `provenanceType` is `M01_PROVIDER_ASSERTED` or `HUMAN_VERIFIED_SOURCE_DECLARATION`;
`reviewState` is `UNREVIEWED`, `VERIFIED`, `REJECTED`, or `SUPERSEDED`. Human verification records actor,
role, reason, evidence, expected versions, command, and audit event. Only M01 provider-asserted identifiers or
active `VERIFIED` declarations may participate in automatic association, and only when the scoped key selects
exactly one active Resource identity and no P1–P3 contradiction exists. Unreviewed manifest values can only
propose `POSSIBLE_DUPLICATE`. A scoped key resolving to multiple identities or two trusted keys resolving to
different identities produces `EXTERNAL_IDENTIFIER_COLLISION`, no mutation, and identity review. Correction
supersedes the identifier record; it never rewrites prior decisions.

Signals, strongest first, are: (P1) exact active source link by provider repository ID plus normalized root,
with exact canonical URL as corroboration and never as a substitute for a contradictory provider ID; (P2)
exact trusted scoped `ExternalIdentifier`; (P3) reviewed mirror/fork provenance plus exact upstream
source; (P4) exact candidate content fingerprint; (P5) exact normalized source name token plus bounded exact
creator/organization token evidence already present in Section 6; (P6) weak/similar name. Prior source links,
existing identity/version matches, and provider fork metadata are always retained. P1–P3 contradictions or
multiple targets force review. P4 can propose a duplicate but never merge. P5 requires review cross-source.
P6 never links identities. Confidence cannot override these rules.

| Case                                                  | Required outcome                                          | Automatic?                  | Resource/version behavior                                                                        |
| ----------------------------------------------------- | --------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| No match; reliable exact name token                   | `NEW_RESOURCE`                                            | Yes if no contradiction     | Create identity and version shell                                                                |
| No match; missing/unreliable token                    | `AMBIGUOUS_IDENTITY`                                      | No                          | No identity; review                                                                              |
| Exact active source/root; same content                | `EXACT_REPEAT_REUSE`                                      | Yes                         | Reuse identity/version; add observation if snapshot is new                                       |
| Exact active source/root; changed content             | `EXISTING_RESOURCE_NEW_VERSION`                           | Yes                         | Reuse identity; create new version shell                                                         |
| Exact trusted scoped external ID; one target          | Same-content reuse or new version                         | Yes if no contradiction     | Attach to unique target                                                                          |
| Trusted scoped external ID conflicts with source link | `AMBIGUOUS_IDENTITY`                                      | No                          | No mutation                                                                                      |
| Cross-source identical content; no mirror proof       | `POSSIBLE_DUPLICATE`                                      | No                          | Propose candidate-to-exact-version `DuplicateCandidate`; no merge                                |
| Provider-declared fork; no reviewed disposition       | `FORK_OF_EXISTING_RESOURCE`                               | No                          | Review; no target mutation                                                                       |
| Reviewed independent fork                             | `FORK_OF_EXISTING_RESOURCE`                               | Human command               | New identity/version B plus directed B-to-origin-version-A `FORK_OF`                             |
| Reviewed mirror; same content                         | `MIRROR`                                                  | Human command               | Repository `MIRROR_OF` upstream repository; source link targets existing version; no new version |
| Reviewed mirror; divergent content                    | `AMBIGUOUS_IDENTITY`                                      | No                          | Mirror prohibited; review fork/new-version choice                                                |
| Weak or similar name only                             | `NEW_RESOURCE` if reliable own token, otherwise ambiguity | Only new identity path      | Never attach by name similarity                                                                  |
| Exact name plus creator/org; one cross-source match   | `POSSIBLE_DUPLICATE`                                      | No                          | Review; no merge                                                                                 |
| Any signal resolves to multiple targets               | `AMBIGUOUS_IDENTITY`                                      | No                          | Blocking review                                                                                  |
| Similar name, different content, no exact identifier  | `NEW_RESOURCE`                                            | Yes with reliable own token | Separate identity/version                                                                        |
| Same repository, multiple roots                       | Evaluate each independently                               | Yes only per other rows     | Never merge roots automatically                                                                  |
| Content hash match but canonical payload mismatch     | `AMBIGUOUS_IDENTITY` plus domain conflict `CONTENT_FINGERPRINT_PAYLOAD_COLLISION` | No | Accepted blocking S6 Decision; no identity association mutation |

### 13.1 Closed system-origin identity projection

Every `Automatic?` outcome above is persistence-authoritative only through
`SystemIdentityMutationOperationV1`. It is a typed internal operation, not an externally callable command and
not a human role. No Section 13 outcome has an implementation-defined write path. The automatically resolved
families are expanded into the exact modes below. `JC` means every locked sibling is resolved and at least one
candidate is resolved after projection, so the controlling job completes. `JR` means at least one locked sibling
remains unresolved, so the job is/becomes `OPERATOR_REVIEW_REQUIRED`. Blocking modes use only `JR`. Therefore:

The closed M02 `IdentityOutcomeV1` vocabulary is exactly `NEW_RESOURCE`, `EXACT_REPEAT_REUSE`,
`EXISTING_RESOURCE_NEW_VERSION`, `POSSIBLE_DUPLICATE`, `FORK_OF_EXISTING_RESOURCE`, `MIRROR`, and
`AMBIGUOUS_IDENTITY`. `EXACT_REPEAT_REUSE` means a successful Decision attaches the candidate to one existing
Resource identity and the byte-identical existing ResourceVersion identity. It requires both identity/version
FKs, creates no ResourceIdentity or ResourceVersionIdentity, and never aliases or implies
`EXISTING_RESOURCE_NEW_VERSION`. The closed automatic mapping is S1=`NEW_RESOURCE`;
S2/S5=`EXISTING_RESOURCE_NEW_VERSION`; S3/S4/S9=`EXACT_REPEAT_REUSE`;
S6/S10=`AMBIGUOUS_IDENTITY`; S7=`POSSIBLE_DUPLICATE`; and S8=`FORK_OF_EXISTING_RESOURCE`.

```text
S1 4 + S2 2 + S3 2 + S4 4 + S5 4 + S6 1 + S7 1 + S8 1 + S9 2 + S10 1 = 22
Human manual command modes = 256
System identity projector modes = 22
```

The counts are disjoint: a system projector has a server-origin operation/result and null human command origin;
a manual projector has a human command/result and null system origin. Same-snapshot already-accepted replay is
idempotency, not another mode. Human-only relationship resolution and per-root redispatch are not system
projectors.

| System projector | Count | Eligibility and exact structural projection |
| --- | ---: | --- |
| `S1_R0_JC` / `S1_R0_JR` | `2` | Initial CLASSIFIED state; no match, reliable own token, no contradiction, repository absent. Create repository, identity with `guardAnchorCandidateId=candidateId`, version, PRIMARY link, observation, Decision, result, handoff; update candidate/review/jobs per J. |
| `S1_R1_JC` / `S1_R1_JR` | `2` | Same S1 predicate with exact repository present. Reuse repository; create identity/version/link/observation/Decision/result/handoff; update candidate/review/jobs per J. |
| `S2_JC` / `S2_JR` | `2` | Initial state; P1 proves repository, old active link and old target version present; changed content proves new version absent. Reuse repository/identity; create new version/replacement link/observation/Decision/result/handoff; supersede old link; update candidate/review/jobs per J. |
| `S3_JC` / `S3_JR` | `2` | Initial state; P1 proves repository/link/identity/version present and current observation absent. Reuse them; create `EXACT_REPEAT_REUSE` Decision/result, observation and handoff; update candidate/review/jobs per J. Existing observation plus changed input dispatches S9/S10; byte-equal accepted input is replay. |
| `S4_R0_JC` / `S4_R0_JR` | `2` | Initial state; P2 exact trusted ID selects one identity/version, P1 did not win, so current link/observation are absent; repository absent. Create repository/link/observation, `EXACT_REPEAT_REUSE` Decision/result and handoff; reuse I/V; update candidate/review/jobs per J. |
| `S4_R1_JC` / `S4_R1_JR` | `2` | Same S4 predicate with repository present. Reuse repository/I/V; create link/observation, `EXACT_REPEAT_REUSE` Decision/result and handoff; update candidate/review/jobs per J. |
| `S5_R0_JC` / `S5_R0_JR` | `2` | Initial state; P2 trusted ID selects identity, P1 did not win, current link/observation absent, changed content, repository absent. Create repository/version/link/observation/Decision/result/handoff; reuse identity; update candidate/review/jobs per J. |
| `S5_R1_JC` / `S5_R1_JR` | `2` | Same S5 predicate with repository present. Reuse repository/identity; create version/link/observation/Decision/result/handoff; update candidate/review/jobs per J. |
| `S6_REVIEW_AMBIGUOUS_IDENTITY` | `JR = 1` | Missing/unreliable token; trusted-source contradiction; multiple targets; divergent mirror; content-payload collision; or any other matrix ambiguity. Create a SYSTEM ambiguity Decision and exact evidence/audit, update candidate/review/controller to blocking identity review, create no identity/version/source association/handoff. Collision retains its exact error code. |
| `S7_REVIEW_POSSIBLE_DUPLICATE` | `JR = 1` | Initial state; exact target version. Create `DuplicateCandidate(status=PROPOSED)`, SYSTEM `POSSIBLE_DUPLICATE` Decision/result/evidence/audits and blocking review/job state. Do not confirm/merge/attach/create source I/V/handoff. |
| `S8_REVIEW_FORK_CANDIDATE` | `JR = 1` | Provider-declared fork without reviewed disposition. Create only a SYSTEM fork-review Decision/evidence/audit and blocking review/job state; no fork relationship, identity attachment or handoff. |
| `S9_JC` / `S9_JR` | `2` | Replacement-job reanalysis pre-state with active prior SYSTEM Decision, replacement-superseded predecessor handoff and changed input; same I/V resolution. Reuse canonical facts; create `EXACT_REPEAT_REUSE` Decision/result and new-controller handoff; supersede prior Decision only; set the candidate outcome to `EXACT_REPEAT_REUSE` while retaining the same I/V and resolved state; jobs follow J. |
| `S10_JR` | `1` | Same reachable replacement-job pre-state; new input conflicts or would change resolved I/V. Reuse historical facts; create ambiguity Decision/result; supersede prior SYSTEM Decision; candidate/review identity-review-required; job operator-review-required; predecessor handoff stays superseded and no active handoff is created. |

The suffixes are authoritative guard/create-set dimensions. `R0` requires
null `SOURCE_REPOSITORY(repositoryRef:SourceRepositoryGuardRefV1)` and creates the repository plus guard version 1; `R1`
requires the byte-identical positive repository guard and reuses the row. R applies only to S1/S4/S5. S2/S3's
P1 predicate proves repository/link presence; S4/S5's failure of P1 proves current link/observation absence.
Every listed created, reused, updated and superseded set is exhaustive; an extra or missing row changes the
projector/expectation/plan and cannot be hidden behind wildcard prose, upsert or implementation branching.
An R0 repository row derives every required provider ID, canonical URL/history value and provenance field from
the immutable M01 snapshot/repository input under the fixed source policy; missing or contradictory input routes
to S6 and cannot be invented. The trusted `ExternalIdentifier` row/evidence is always a pre-existing positively
guarded eligibility input for S4/S5, never another conditional system write.

S7 positively versions the exact target ResourceVersion and requires null
`DUPLICATE_PROPOSAL_SET(candidateId)` and
`DUPLICATE_PROPOSAL_PAIR(candidateId,targetVersionRef)`. It creates the PROPOSED row plus both proposal guards
at version 1 but does not claim or increment `DUPLICATE_DISPOSITION` or
`RELATIONSHIP_PAIR(DUPLICATE_OF,...)`; those remain null for human confirmation. Exact system replay returns the proposal. A conflicting proposal follows the
deterministic ambiguity rules; S7 never creates an ACTIVE confirmed relationship.

The final enum is exactly:

| Mode ID | Exact pre-state and source state | Exact typed projection and post-state |
| --- | --- | --- |
| `S1_R0_JC` | Initial; repository/link/observation/I/V/Decision/handoff absent; all siblings resolved after | R0 create repository + S1 creates I/V/link/observation/Decision/result/handoff; candidate/review resolved; jobs completed |
| `S1_R0_JR` | Initial; same absent set; unresolved sibling remains | Same creates; candidate/review resolved; jobs operator-review-required |
| `S1_R1_JC` | Initial; repository positive, remaining S1 set absent; all siblings resolved | Reuse repository; S1 creates remaining set; resolved/completed |
| `S1_R1_JR` | Initial; repository positive, remaining set absent; unresolved sibling | Reuse repository; same creates; resolved/operator-review-required |
| `S2_JC` | Initial; repository/I/old V/old active link positive; new V/observation/Decision/handoff absent | Reuse repository/I/old V; create V/link/observation/Decision/result/handoff; supersede old link; resolved/completed |
| `S2_JR` | Same exact source state; unresolved sibling | Same reuse/create/supersede; resolved/operator-review-required |
| `S3_JC` | Initial; repository/I/V/link positive; current observation/Decision/handoff absent | Reuse repository/I/V/link; create observation/`EXACT_REPEAT_REUSE` Decision/result/handoff; candidate outcome/FKs equal exact reused I/V; resolved/completed |
| `S3_JR` | Same exact source state; unresolved sibling | Same exact-reuse outcome/reuse/create; resolved/operator-review-required |
| `S4_R0_JC` | Initial; target I/V positive; repository/link/observation/Decision/handoff absent | Create repository/link/observation/`EXACT_REPEAT_REUSE` Decision/result/handoff; candidate outcome/FKs equal exact reused I/V; resolved/completed |
| `S4_R0_JR` | Same absent set; unresolved sibling | Same exact-reuse outcome/create/reuse; resolved/operator-review-required |
| `S4_R1_JC` | Initial; repository/target I/V positive; link/observation/Decision/handoff absent | Reuse repository/I/V; create link/observation/`EXACT_REPEAT_REUSE` Decision/result/handoff; candidate outcome/FKs equal exact reused I/V; resolved/completed |
| `S4_R1_JR` | Same exact state; unresolved sibling | Same exact-reuse outcome/reuse/create; resolved/operator-review-required |
| `S5_R0_JC` | Initial; target I positive; repository/link/observation/new V/Decision/handoff absent | Create repository/V/link/observation/Decision/result/handoff; reuse I; resolved/completed |
| `S5_R0_JR` | Same absent set; unresolved sibling | Same create/reuse; resolved/operator-review-required |
| `S5_R1_JC` | Initial; repository/target I positive; link/observation/new V/Decision/handoff absent | Reuse repository/I; create V/link/observation/Decision/result/handoff; resolved/completed |
| `S5_R1_JR` | Same exact state; unresolved sibling | Same reuse/create; resolved/operator-review-required |
| `S6_JR` | Initial; blocking ambiguity; no Decision/handoff | Create ambiguity Decision/result; update candidate/review/jobs to identity/operator review; no I/V/source/handoff |
| `S7_JR` | Initial; exact target V positive; proposal-set, proposal-pair, confirmed disposition and confirmed pair null | Create PROPOSED duplicate + set/pair guards + Decision/result; update blocking review/jobs; no source I/V/handoff |
| `S8_JR` | Initial; provider fork proposal; no Decision/handoff | Create fork-review Decision/result; update blocking review/jobs; no relationship/I/V/handoff |
| `S9_JC` | Replacement controller; active prior SYSTEM Decision; predecessor handoff already replacement-superseded; same I/V; all siblings resolved | Reuse facts; create `EXACT_REPEAT_REUSE` Decision/result/new handoff; supersede Decision only; candidate outcome becomes exact-repeat with unchanged I/V; retain resolved; jobs completed |
| `S9_JR` | Same reachable replacement state; unresolved sibling | Same exact-reuse outcome/reuse/create/Decision supersession; candidate I/V unchanged; retain resolved; jobs operator-review-required |
| `S10_JR` | Same reachable replacement state; blocking/different resolution | Reuse facts; create ambiguity Decision/result; supersede Decision; prior handoff remains terminal; identity/operator review; no active handoff |

For each row, reads/locks are exactly its named rows plus candidate, review, controlling acquisition/M02 jobs,
classification/run/evidence and byte-sorted siblings. Positive/null row and guard sets are exactly those stated
above plus the shared V2/natural guards for each named reused/absent protected set. Provisional IDs are exactly
the named created rows plus operation/result/formula-derived audits. Result arrays equal those named created/
reused/updated/superseded sets. Audit subjects are exactly the Section 15.11 formula over them; unchanged reuse
has no audit. Any extra/missing row, guard, ID, handoff effect, conflict or post-state is
`MUTATION_PLAN_CHANGED`. These statements are normative expansions of every field, not runtime wildcards.

The Section 13 rows map exhaustively as follows:

| Section 13 row | Required projector or explicit non-system outcome |
| --- | --- |
| No match; reliable exact name token | S1_R0_JC/JR or S1_R1_JC/JR by repository and sibling state |
| No match; missing/unreliable token | `S6_REVIEW_AMBIGUOUS_IDENTITY` |
| Exact active source/root; same content | S3_JC/JR when current observation absent; S9/S10 when observation exists and Decision input changed; replay only for byte-equal accepted input/result |
| Exact active source/root; changed content | S2_JC/JR; P1 proves repository/active predecessor binding |
| Exact trusted scoped external ID; one target | Same content S4_R0/R1 × J; changed content S5_R0/R1 × J; P1 non-match proves current link/observation absent |
| Trusted scoped external ID conflicts with source link | `S6_REVIEW_AMBIGUOUS_IDENTITY` |
| Cross-source identical content; no mirror proof | `S7_REVIEW_POSSIBLE_DUPLICATE` |
| Provider-declared fork; no reviewed disposition | `S8_REVIEW_FORK_CANDIDATE` |
| Reviewed independent fork | Existing human `MARK_FORK`; no system operation |
| Reviewed mirror; same content | Existing human `MARK_MIRROR`; no system operation |
| Reviewed mirror; divergent content | `S6_REVIEW_AMBIGUOUS_IDENTITY` |
| Weak or similar name only | S1 R0/R1 × J only with independently reliable own token; otherwise S6 |
| Exact name plus creator/org; one cross-source match | `S7_REVIEW_POSSIBLE_DUPLICATE` |
| Any signal resolves to multiple targets | `S6_REVIEW_AMBIGUOUS_IDENTITY` |
| Similar name, different content, no exact identifier | S1 R0/R1 × J only with reliable own token |
| Same repository, multiple roots | Independently redispatch each candidate to exactly one other row; no separate projector and never merge roots |
| Content hash match but canonical payload mismatch | `S6_REVIEW_AMBIGUOUS_IDENTITY` with `CONTENT_FINGERPRINT_PAYLOAD_COLLISION`; infrastructure payload collision remains rejected `FINGERPRINT_COLLISION` |

S1–S8 require exactly candidate `CLASSIFIED`, review `NOT_REQUIRED`, no active IdentityDecision, no rejection
Decision, no active handoff, no OPEN clarification, and a current non-cancelled controlling job. S9/S10 require
candidate `IDENTITY_RESOLVED`, review `RESOLVED`, one active predecessor `SYSTEM_IDENTITY_OPERATION` Decision,
and exactly one predecessor handoff for that I/V/Decision chain already `SUPERSEDED` by the current controlling
`REPLACE_M02_JOB` result/edge. The replacement binds changed methodology/policy and the same candidate/content/
I/V through the exact retained `JobReplacementInputV1` bytes/fingerprint; there is no active handoff under the
replacement controller. The prior handoff row/version and positive
`HANDOFF` active-set guard are mandatory expectations. A controlling `HUMAN_COMMAND` Decision is never system-reanalysis eligible. Every
evidence reference and V2 guard/expected row must be valid. An unresolved sibling forces `JR`; one resolved
sibling never hides another.

For every J calculation, a sibling counts as resolved only when it has the complete current-controller chain:
candidate `IDENTITY_RESOLVED`, one identity Decision whose `controllingJobId` is the effective current
controller, and one active handoff under that same controller whose I/V/Decision chain is valid. Candidate status
alone is insufficient. After replacement, a predecessor-controller or superseded handoff makes that sibling
unresolved until S9 creates its current-controller handoff; S10 explicitly leaves it blocking. This predicate
applies to the complete locked sibling set, so an early reanalysis cannot select `JC` or complete the replacement
controller while another sibling lacks its current-controller chain.

System review/job transitions are closed: S1–S5 move the selected candidate to `IDENTITY_RESOLVED`, its review
to `RESOLVED`, and create exactly one active handoff from the required absent pre-state. Under `JC`, every locked sibling is resolved,
both controlling acquisition/M02 job views become `COMPLETED`, and the M02 stage remains durably
`RESOLVING_IDENTITY` as the completed terminal stage. Under `JR`, the selected candidate/review remains resolved
but at least one locked sibling is unresolved; both controlling job views become or remain
`OPERATOR_REVIEW_REQUIRED`. S6–S8 move the selected candidate to `IDENTITY_REVIEW_REQUIRED`, its review to
`IDENTITY_REVIEW_REQUIRED`, both controlling job views to `OPERATOR_REVIEW_REQUIRED`, and create no handoff.
Every transition locks and positively versions the candidate, review, acquisition-job and M02-job rows, increments
each mutable row exactly once, and records exact before/after audits. A terminal rejection, superseded topology,
OPEN clarification, cancelled job or non-controlling job is ineligible and cannot be rewritten by a system mode.
S9 retains resolved candidate/review state, supersedes only the prior SYSTEM Decision, creates the replacement-
controller handoff while the predecessor handoff remains terminal, and applies JC/JR. S10 supersedes the prior
SYSTEM Decision, leaves the predecessor handoff terminal and historical I/V/source/observation facts unchanged,
blocks candidate/review, uses JR and leaves no active handoff. A reanalysis
that would select a different resolved I/V always uses S10; it never automatically reattaches.

Every decision persists the matched tier, exact signals, rejected lower-tier signals, conflicts, outcome,
nullable confidence, policy version, actor/source, and audit fingerprint.

For every accepted system mode, the immutable Decision outcome, `resource_candidates.identity_outcome`,
candidate `resource_identity_id`/`resource_version_identity_id`, result scalar identity/version IDs, typed
created/reused arrays, and canonical candidate before/after audit state must agree exactly with the mode mapping
above. The candidate audit state includes status, identity outcome, both nullable identity/version FKs and
record version. S3/S4/S9 therefore prove `EXACT_REPEAT_REUSE`, positive reused I/V IDs, empty created I/V arrays,
the exact reused I/V arrays, and no ResourceVersion creation audit. S9's before-state retains the predecessor
outcome and same I/V; its after-state changes only the outcome when needed, retains those I/V FKs, increments the
candidate record version exactly once, and is audited byte-exactly. A mismatched outcome, target I/V, result,
array, state, version or audit is `MUTATION_PLAN_CHANGED` and rolls back.

Deterministic automatic and human-command decisions use `confidence = null`: their authority comes from exact
rules or an accountable command, not a fabricated score. An AI-assisted proposal may carry schema-valid
`0..1` confidence, but reconciliation retains it only as provenance. No threshold changes the matrix,
authorizes an automatic link, or defeats a contradiction. Every table row requires evidence IDs for every
positive and conflicting signal and an audit record containing the evaluated tier sequence; missing required
evidence changes the result to `AMBIGUOUS_IDENTITY`.

## 14. Duplicate, fork, mirror, and source-link persistence

`ResourceCandidateRoot` is the persisted Section 7 root plus immutable owned/shared membership rows and
root/content fingerprints. `SourceRepositoryIdentity` is the source aggregate keyed by provider plus M01
provider repository ID; it retains canonical URL history but URL is not its identity. `ResourceSourceLink`
connects a Source repository/root to a ResourceVersion identity and records relationship (`PRIMARY` or
`ALTERNATE`), observations, evidence, status, and supersession.

The canonical relationship contracts are:

| Relationship   | Source aggregate/FK                                        | Target aggregate/FK                                               | Direction and uniqueness                                                                                                                                                                       |
| -------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DUPLICATE_OF` | `ResourceCandidate` / `source_candidate_id`                | `ResourceVersionIdentity` / non-null `target_resource_version_id` | Candidate to exact existing content version; one active confirmed duplicate disposition per source candidate; unique active `(source_candidate_id, target_resource_version_id)`                |
| `FORK_OF`      | `ResourceVersionIdentity` / `fork_resource_version_id`     | `ResourceVersionIdentity` / `origin_resource_version_id`          | New independent fork version B to exact origin version A; versions only; Resources must differ; one active origin per fork version; unique active ordered pair; no self-edge or directed cycle |
| `MIRROR_OF`    | `SourceRepositoryIdentity` / `mirror_source_repository_id` | `SourceRepositoryIdentity` / `origin_source_repository_id`        | Mirror repository to original repository; source repositories only; one active origin per mirror; unique active ordered pair; no self-edge or directed cycle                                   |

Repository-level `MIRROR_OF` is canonical because a repository mirror is delivery/source provenance, not a new
logical content version. After human confirmation, its `ResourceSourceLink` attaches the mirror repository/root
and observation to the already canonical target ResourceVersion. Identical content therefore reuses the
version key in Section 12.3. Material divergence prohibits `MIRROR_OF` and routes to fork/new-identity review.

A `DuplicateCandidate` may exist before its source candidate owns any Resource identity, but its target version
is mandatory. Status is `PROPOSED`, `CONFIRMED`, `REJECTED`, or `SUPERSEDED`. Confirming it sets candidate
disposition `DUPLICATE_OF_TARGET`, creates no source Resource/version, and preserves all candidate/source
history. A reviewed independent fork first creates the fork Resource/version, then atomically writes
version-to-version `FORK_OF`. A confirmed mirror writes repository-to-repository `MIRROR_OF`, the target-version
source link/observation, and no new Resource/version.

Every relationship records evidence IDs, decision ID, reason, actor/source, status (`ACTIVE`, `REJECTED`,
`SUPERSEDED`), created timestamp, record version, and nullable `supersedes_relationship_id`. `MARK_DUPLICATE`,
`MARK_FORK`, or `MARK_MIRROR` corrects only its own relationship type by requiring the prior relationship ID
and its entry in `expectedVersions`, writing a replacement, and setting the prior row `SUPERSEDED` in one
transaction. A
correction never mutates endpoints/history or reuses an idempotency key. Rejection likewise appends a decision
and audit event. All automatic proposals remain non-authoritative; no fingerprint, name, URL, or provider fork
metadata automatically creates, merges, confirms, or corrects a relationship.

Every `IdentityDecision` has `originType` equal to `HUMAN_COMMAND` or `SYSTEM_IDENTITY_OPERATION` and exactly
one complete immutable origin chain. Human origin requires non-null `commandId`, `commandResultId` and
`auditEventId` and prohibits system operation/result IDs. System origin requires non-null `systemOperationId`,
`systemResultId` and `auditEventId` and prohibits command/result IDs. Both and neither are invalid. A human
correction may supersede a system Decision, and a later eligible system operation may supersede a prior system
Decision, but neither path rewrites the predecessor payload or origin.

Every `M02IdentityHandoffMarker` contains candidate, identity, version, controlling-job, snapshot, controlling
Decision and accepted-audit FKs plus exactly one result origin: non-null `humanCommandResultId` with null
`systemIdentityResultId`, or non-null `systemIdentityResultId` with null `humanCommandResultId`. Both and neither
are invalid. Handoff eligibility and supersession rules are identical across origins; origin never grants
controller authority.

## 15. Manual command contracts and canonical typed projection

### 15.1 Envelope, authority, and typed-persistence rule

Every command has `commandId`, `requestId`, `idempotencyScope`, unique `idempotencyKey`, authenticated actor
ID/role, target candidate/group/review/job IDs required by its mode, `expectedVersions`, reason code, non-empty
reason (1–2,000 UTF-8 bytes), referenced evidence/decision IDs, timestamp, and command-specific payload. The
server re-authorizes the role and derives the command mode, affected rows, guards, IDs, plan, and postconditions.
The caller cannot supply a mode, mutation plan, authoritative new-row ID, affected-row set, or guard set.

Every accepted command MUST project all authoritative effects into canonical typed rows in one PostgreSQL
`SERIALIZABLE` transaction. Generic key/value ledgers, opaque JSON mutation stores,
`m02_command_domain_records`, process-local maps, and in-memory transactions are non-authoritative diagnostic or
test support only. None can satisfy a command result, FK, uniqueness rule, version guard, lineage, audit,
controller, or handoff postcondition.

The canonical envelope, canonical request bytes, request fingerprint, and caller-supplied `expectedVersions` map
are immutable for the entire logical command execution. Transaction retries MUST NOT rewrite, add, remove,
upgrade, downgrade, refresh, or otherwise substitute caller concurrency expectations. This immutable map is
`CallerExpectedVersions`. It maps `row:<table>:<existing-id>` and already-materialized server guard keys to
positive integers and contains `null` natural guards for caller-observed required absence. It never contains a
random new-row ID. `CallerExpectedVersions` and `RequiredCurrentExpectations` contain only pre-request existing
row keys and allocation-independent logical guard keys. The caller never needs a provisional/final new-row UUID,
result ID, or audit ID to authorize a command.

Every fresh optimistic discovery derives `RequiredCurrentExpectations`: the complete server-derived expectation
map for the current Section 15.9 mode. It is recomputed on every outer retry and is never substituted into the
request. Before the initial mutation attempt and before every fresh retry attempt, its key set, null/positive
classification, and positive integers must exactly equal `CallerExpectedVersions`. Extra, missing, alternate, or
changed-null-classification keys return `EXPECTED_VERSION_SET_INVALID`; the same positive key at a different
integer returns `STALE_RECORD_VERSION`. No mutation transaction opens for a preflight mismatch. Locked
reproduction then rechecks the identical caller-authorized set and values inside that attempt.

Every guard key in either expectation map MUST be derivable entirely from immutable request-visible values and
pre-existing canonical state. No opaque ID allocated after submission of the immutable request may appear,
directly or indirectly, in a guard key or canonical guard payload. An existing row ID is allowed only when that
row predates the immutable request and its identity is already caller-visible canonical state. Server allocation
cannot change expectation bytes or itself cause `EXPECTED_VERSION_SET_INVALID`.

A future request may carry an existing domain UUID only to locate canonical state. Before computing
`RequiredCurrentExpectations`, the server resolves the identity/version and derives its V2 guard ref from the
identity's immutable `guardAnchorCandidateId` and, for a version, its content fingerprint. Caller-visible
canonical concurrency state MUST expose the resulting stable key/payload/version needed to construct
`CallerExpectedVersions`; it never asks the caller to invent or replace the stored anchor. A fresh retry cannot
change the identity/version anchor or expectation key merely because provisional IDs changed.

### 15.2 Role authorization

| Command | ADMIN | EDITOR | TECHNICAL_REVIEWER |
| --- | --- | --- | --- |
| `CREATE_RESOURCE` | Allow | Allow | Deny |
| `ATTACH_NEW_VERSION` | Allow | Allow | Deny |
| `MARK_FORK` | Allow | Allow | Deny |
| `MARK_MIRROR` | Allow | Allow | Deny |
| `MARK_DUPLICATE` | Allow | Allow | Deny |
| `REJECT_CANDIDATE` | Allow | Allow | Allow |
| `SPLIT_ROOTS` | Allow | Deny | Deny |
| `MERGE_ROOTS` | Allow | Deny | Deny |
| `OVERRIDE_NON_SKILL` | Allow | Allow | Deny |
| `REQUEST_CLARIFICATION` | Allow | Allow | Allow |
| `RESOLVE_AMBIGUITY` | Allow | Allow | Deny |
| `REPLACE_M02_JOB` | Section 16 matrix | Section 16 matrix | Section 16 matrix |

There is no `OVERRIDE_UNSUPPORTED` command.

### 15.3 Server IDs and `CommandMutationPlanV1`

The application command service allocates UUIDv7-compatible opaque IDs only after immutable input/role
validation, the read-only idempotency lookup, optimistic expansion discovery, derivation of the complete
allocation-independent guard/expectation set, and exact comparison with immutable `CallerExpectedVersions`.
Allocation occurs before the domain mutation portion of the provisional plan is finalized. The service allocates
one ID for each created
group, run, evidence reference, root, root-order row, ownership row, topology lineage row, candidate, group edge,
identity, version, repository/URL, external identifier, source link, observation, duplicate/fork/mirror row,
identity/rejection decision, clarification, review, handoff, acquisition/M02 job, job-supersession edge, command
result, and accepted audit. `manual_resolution_commands.id = commandId` is the sole caller-origin identity and
cannot be used as another row's ID or lock key.

The allocation set binds to `(idempotencyScope,idempotencyKey,requestFingerprint)` and to the create-row set and
canonical plan identity derived by its transaction attempt. A fresh retry may reuse a rolled-back attempt's IDs
only when it derives the same create-row set and canonical plan identity for those IDs. If durable state changes
the executable mode, create set, or plan identity, the unused provisional IDs may be abandoned and the fresh
attempt allocates and binds the required set under the same command/idempotency identity. No abandoned ID becomes
canonical state or forces a stale mode. A pre-commit crash/rollback may likewise abandon unused IDs because no
accepted state exists. Concurrent identical requests allocate provisionally, but only the winner's set commits;
a fresh loser lookup returns that committed result and IDs. Replay after commit allocates nothing. Changed-payload
reuse returns `IDEMPOTENCY_KEY_REUSED`.

The request fingerprint covers caller `expectedVersions` but no future server ID. Allocated IDs bind only to
server-side idempotency execution state. Different provisional UUID choices before commit do not alter immutable
request or guard bytes; a rolled-back attempt may abandon them without a changed request/guard set. Exact
same-idempotency accepted replay returns the committed result and committed IDs.

No provisional-plan or ID-reuse rule overrides `CallerExpectedVersions`. A fresh plan with a different required
expectation map cannot proceed merely because its create set or allocated IDs remain valid. After exact map
equality, the existing same-create-set/same-plan ID reuse rule applies; if expectations match but an otherwise
permitted create set or plan identity changes, the fresh-allocation rule applies.

`CommandMutationPlanV1` has two explicit canonical portions:

- `concurrencyPlan`: expansion ID; allocation-independent guard references and keys; immutable
  `CallerExpectedVersions`; freshly derived `RequiredCurrentExpectations`; and every pre-existing typed row to
  version or lock; and
- `domainMutationPlan`: allocated IDs; exact typed `creates`, `updates`, `supersedes`, mappings and final FKs;
  clarification, handoff and job/controller effects; result; audit events; and typed postconditions.

`completeTypedValues` lists every required typed column. The full plan fingerprint covers both portions and every
sorted row/guard/audit list. Changing provisional UUID values may change the full fingerprint and domain portion,
but MUST NOT change `concurrencyPlan` guard keys or either expected-version map. Inside one transaction,
authoritative reproduction uses the same provisional allocation and reproduces both portions byte-for-byte.

#### 15.3.1 `LifecycleStableGuardRefV2`

`LifecycleStableGuardRefV2` is a closed Section 4 canonical-JSON vocabulary used only to derive concurrency
guard identity. It is not a domain FK and does not replace final typed domain IDs. Creation state is never part
of guard identity: one logical protected set has one byte-exact reference before allocation, after commit, and
through reuse, correction, supersession, and retry.

```text
ResourceIdentityGuardRefV2 =
  {kind:"RESOURCE_IDENTITY_ANCHOR",originCandidateId}

ResourceVersionGuardRefV2 =
  {
    kind:"RESOURCE_VERSION_ANCHOR",
    resourceIdentityRef:ResourceIdentityGuardRefV2,
    contentFingerprint
  }

SourceRepositoryGuardRefV1 = {provider,providerRepositoryId}

SourceLinkGuardRefV1 = {provider,providerRepositoryId,normalizedRootPath}

RelationshipEndpointGuardRefV2 =
  {kind:"CANDIDATE",candidateId}
  | {kind:"RESOURCE_VERSION",versionRef:ResourceVersionGuardRefV2}
  | {kind:"SOURCE_REPOSITORY",repositoryRef:SourceRepositoryGuardRefV1}
```

For `CREATE_RESOURCE` or first `MARK_FORK`, `originCandidateId` is the current `candidateId`; one candidate may
create at most one ResourceIdentity in one accepted expansion. The created identity persists exactly that value
as immutable `guardAnchorCandidateId`. For every later command, the server may locate an existing identity by
opaque ID but MUST derive its guard ref from `resourceIdentity.guardAnchorCandidateId`. For an existing version,
the server follows `resourceVersion.resourceIdentityId` to that parent anchor and combines it with
`resourceVersion.candidateContentFingerprint`. Neither identity nor version opaque ID enters the hashed guard
payload. Thus the reference bytes derived before creation MUST equal those reconstructed after commit for the
same identity/version.

Repository and source-link natural references remain stable whether their typed rows pre-exist or are created
by the command. A ResourceVersion relationship endpoint always embeds `ResourceVersionGuardRefV2`, so first
fork creation, later correction, and an existing duplicate target reproduce the same endpoint bytes. Endpoint
references are concurrency identities only; final relationship rows still use server-resolved or allocated
typed FK IDs. The hashed payload normatively prohibits any planned/existing lifecycle tag or equivalent
creation-state distinction. There is no guard-key promotion, alias, rename, dual row, or fallback lookup.

### 15.4 Authoritative command execution and transaction-attempt sequence

There are two authoritative lock categories. A **logical/advisory guard identity** is the deterministic natural
concurrency identity and derived advisory-lock key for one protected active set. It exists as a lockable identity
even when no typed guard row has yet been persisted. A **typed guard row** is the durable canonical
`m02_concurrency_guards` row for that identity. Logical/advisory guard locking begins at step 7. Existing typed
guard rows and other existing mutable typed domain rows are row-locked only at step 8. Optimistic reads before
step 7 are non-authoritative and grant no write authority.

A **command execution** is one logical API invocation identified by its immutable request and idempotency identity. It may
contain one, two, or three database **transaction attempts**. A transaction attempt is one complete PostgreSQL
`SERIALIZABLE` transaction beginning at step 7 and ending in commit or rollback. Each retry begins a new
Serializable transaction with a fresh PostgreSQL snapshot. The repository M02 bound is three total attempts: one
initial attempt plus at most two retries. `attemptCount` counts only opened PostgreSQL Serializable mutation
transactions. Read-only idempotency lookup, optimistic discovery, plan derivation, and expectation comparison do
not consume an attempt; restarting discovery never resets the counter. There is never an unbounded retry loop.

The following 22-step sequence is the only command-attempt sequence:

1. Validate the immutable envelope, authentication, role, referenced snapshot/evidence formats, and request
   fingerprint.
2. Perform the read-only idempotency lookup. Return the committed result for identical replay and reject changed
   payload reuse.
3. Perform non-authoritative optimistic discovery of only the canonical rows needed to select one Section 15.9
   expansion and its candidate affected logical identities.
4. Derive the complete allocation-independent `concurrencyPlan`, including its exact expansion ID, guard
   references/keys, `RequiredCurrentExpectations`, and pre-existing affected rows. Compare the required map to
   immutable `CallerExpectedVersions`: exact key set, null/positive classification, and positive integers must
   match. A mismatch opens no transaction and allocates no authoritative new-row ID.
5. Allocate the complete provisional server-ID set under Section 15.3.
6. Finalize the provisional `CommandMutationPlanV1` by combining the already authorized `concurrencyPlan` with
   the exact `domainMutationPlan`, including allocated IDs, typed rows/FKs, audits, clarification,
   handoff/job effects, postconditions, and canonical fingerprint. Re-deriving guard keys after allocation MUST
   reproduce byte-identical guard bytes because allocated IDs are not inputs.
7. Begin one PostgreSQL `SERIALIZABLE` transaction, claim
   `(idempotencyScope,idempotencyKey,requestFingerprint)`, derive every advisory-lock key from the logical guard
   identity, and acquire those locks in byte-exact guard-key order. Do not insert, materialize, increment, or
   otherwise mutate a typed guard row or domain state at this step. The claim or another statement may establish
   this attempt's fixed snapshot before a contending advisory lock is granted; waiting never refreshes it.
8. Acquire every existing mutable typed domain-row lock, including each existing positive-version typed guard
   row, in byte-exact `(tableName,primaryKey)` order. A logical guard whose provisional expectation is `null`
   remains physically absent while its advisory lock is held. No synthetic, placeholder, sentinel, zero-version,
   or preseed typed guard row is permitted.
9. Reread every plan input under the authoritative locks. An existing typed guard is reread at its positive
   pre-mutation version; an absent typed guard is reread as physically absent.
10. Reproduce both authoritative plan portions from the locked rows, reusing the provisional server-ID allocation.
11. Require byte-exact equality of provisional and authoritative canonical plan bytes, including expansion ID,
    affected rows, IDs, guards, the `null`-versus-positive guard classification, versions, provenance, audits,
    clarification, job/handoff effects, and postconditions. Any difference returns `MUTATION_PLAN_CHANGED`
    before expectation recheck.
12. Only after plan equality, recheck the exact positive/null expected-version set: every positive typed guard
    must still exist at exactly version N and every null typed guard must still be physically absent.
13. Revalidate authorization, controlling job, cancellation, FK, canonical-payload equality, uniqueness,
    topology, cycle, evidence, snapshot, and lineage invariants.
14. Begin the canonical write phase: insert the command shell and all immutable prerequisite/new typed domain
    rows; insert each planned absent typed guard at version 1; and apply each planned existing guard update from
    N to N+1 exactly once when its protected active set changes. A typed-guard uniqueness or serialization
    failure aborts the complete transaction.
15. Insert correction, supersession, relationship, and topology-lineage rows and update only the explicitly
    mutable predecessor state/version/linkage columns.
16. Apply candidate, review, acquisition/M02-job, controller, and job-supersession transitions.
17. Apply the exact Section 15.7 clarification transitions.
18. Apply handoff creation, reuse, or supersession after final eligibility and controller state is fixed.
19. Insert `m02_manual_command_results` with the plan fingerprint, nullable typed `identityOutcome`, nullable
    identity/version scalar IDs, and ordered canonical created/reused/updated/superseded target-ID arrays. A
    Decision-producing result requires the exact mapped outcome and I/V equality; a non-identity projector
    requires null identity outcome/scalars. A2/A3 and their ambiguity-dispatch equivalents require
    `EXACT_REPEAT_REUSE`, zero created I/V IDs and the exact reused I/V IDs.
20. Insert the exact Section 15.8 accepted AuditEvents.
21. Re-evaluate every typed postcondition and validate every immediate or deferred constraint.
22. Commit.

A Serializable attempt MUST NOT assume that waiting for an advisory or row lock advances its transaction
snapshot. The authoritative reread is authoritative only relative to that attempt's fixed PostgreSQL snapshot.
A concurrent commit visible only after that snapshot was established requires rollback and a new attempt before
the newly committed state can be observed.

The closed retryable stale-snapshot class is:

- PostgreSQL SQLSTATE `40001` serialization failure;
- SQLSTATE `23505` at a canonical write that expected a `null` typed guard or canonical natural key, but only
  after rollback and a fresh read proves that the conflicting key is the same canonical logical identity and its
  stored canonical payload is byte-equal; and
- an idempotency-claim uniqueness conflict only for the exact same
  `(idempotencyScope,idempotencyKey,requestFingerprint)` tuple.

No other uniqueness violation is blindly retried. A same-key/different-payload guard remains
`CONCURRENCY_GUARD_COLLISION`; changed-payload idempotency remains `IDEMPOTENCY_KEY_REUSED`; other canonical
uniqueness conflicts retain their existing deterministic domain errors. Classification of a `23505` conflict is
performed only after the failed attempt has rolled back, never by relying on its stale snapshot.

On a retryable outcome, rollback the complete attempt and thereby release every transaction-level advisory and
row lock. Preserve no accepted command, typed guard, domain, result, or accepted-audit write. Restart at the
read-only idempotency lookup and fresh optimistic discovery, then rederive the mode, affected rows,
allocation-independent guards, versions and create set from current durable state. If an identical
same-idempotency winner has committed, return its result/IDs immediately. Otherwise compare the fresh
`RequiredCurrentExpectations` to immutable `CallerExpectedVersions` before allocating fresh provisional IDs or
consuming another attempt. Only exact equality permits server-ID allocation and a new Serializable transaction;
audit subjects, handoff/job effects, postconditions and the full plan are then finalized. The new plan is not required to equal the
rolled-back stale plan; it is authorized only by the expectation-map gate. This outer retry is not
`MUTATION_PLAN_CHANGED`; that error remains the step-11 result for plan drift within one attempt.

If the competing winner used the same idempotency identity, the fresh read-only lookup returns its committed
result and IDs with no second mutation or new accepted audit. This replay takes precedence over current
expected-version mismatch because it is the same accepted logical request, not a new mutation. If the winner used
a different idempotency identity for the same protected logical identity, fresh discovery may identify the
current Section 15.9 mode, but the original command may mutate under it only when its
`RequiredCurrentExpectations` remain byte-equal to immutable `CallerExpectedVersions`. A null-to-positive or
positive-to-absent/key-set change returns `EXPECTED_VERSION_SET_INVALID`; the same positive key changing N to
another integer returns `STALE_RECORD_VERSION`. The server MUST NOT silently adopt the winner's versions. An
otherwise applicable domain conflict such as `RECORD_ALREADY_EXISTS` is evaluated only after the expectation map
remains valid.

The expectation-preflight precedence is closed: (1) an exact same-idempotency accepted lookup returns its
committed result; (2) canonical key/hash payload mismatch returns its existing collision error; (3) key-set or
null/positive classification mismatch returns `EXPECTED_VERSION_SET_INVALID`; (4) equal positive keys with any
integer mismatch return `STALE_RECORD_VERSION`; (5) exact map equality may consume the next attempt and only then
may domain-mode conflicts be evaluated. No new error code is introduced.

After three failed transaction attempts, return `SERIALIZATION_RETRY_EXHAUSTED`. The last attempt is fully rolled
back and the command has no accepted state. The owning job then uses the existing Section 16 retry-exhaustion/
`OPERATOR_REVIEW_REQUIRED` failure path in its separate durable failure transaction; this cannot imply command
acceptance. Section 15.10 may record its one bounded rejected-attempt audit.

`MUTATION_PLAN_CHANGED` at step 11 rolls back the complete transaction, including the idempotency claim. It
creates no command, typed guard, domain, result, or accepted-audit row. A later failure after a write-phase typed
guard insertion or update also rolls that guard write back, so a failed first use leaves the typed guard absent.
After rollback, the separate
Section 15.10 rejected-command-audit transaction may append exactly its one idempotent bounded rejection row;
that row cannot imply an accepted mutation. Any later failure before commit has the same accepted-state rollback
semantics. Deferrable FKs may be deferred only inside this transaction and must validate at step 21.

### 15.5 Exact logical guards

Every guard key is
`guard:<guardType>:<base64url(SHA-256(canonicalJson({guardType,components})))>` with the full canonical payload
stored and byte-compared. Hash/payload mismatch is `CONCURRENCY_GUARD_COLLISION`.

| Guard type | Exact components |
| --- | --- |
| `GROUP_KEY` | sourceSnapshotId, classificationPolicyVersion |
| `GROUP_MEMBERSHIP` | predecessorGroupId |
| `ROOT_KEY` | sourceSnapshotId, rootFingerprint, contentFingerprint |
| `CANDIDATE_KEY` | sourceSnapshotId, rootFingerprint, contentFingerprint |
| `RESOURCE_SOURCE` | provider, providerRepositoryId, normalizedRootPath |
| `SOURCE_REPOSITORY` | repositoryRef: `SourceRepositoryGuardRefV1` |
| `RESOURCE_VERSION` | resourceIdentityRef: `ResourceIdentityGuardRefV2`, contentFingerprint |
| `OBSERVATION` | resourceVersionRef: `ResourceVersionGuardRefV2`, sourceSnapshotId, candidateRootId, sourceLinkRef: `SourceLinkGuardRefV1` |
| `DUPLICATE_DISPOSITION` | candidateId |
| `DUPLICATE_PROPOSAL_SET` | candidateId |
| `DUPLICATE_PROPOSAL_PAIR` | candidateId, targetVersionRef: `ResourceVersionGuardRefV2` |
| `FORK_LINEAGE` | forkVersionRef: `ResourceVersionGuardRefV2` |
| `MIRROR_LINEAGE` | mirrorRepositoryRef: `SourceRepositoryGuardRefV1` |
| `RELATIONSHIP_PAIR` | relationshipType, sourceEndpointRef: `RelationshipEndpointGuardRefV2`, targetEndpointRef: `RelationshipEndpointGuardRefV2` |
| `CLARIFICATION_OPEN` | reviewId, questionCode |
| `CLARIFICATION_TARGET` | targetType, targetId |
| `REJECTION_DECISION` | candidateId |
| `HANDOFF` | candidateId |
| `JOB_SCOPE_CONTROLLER` | jobLineageId, operationScope |
| `JOB_REPLACEMENT_INPUT` | sourceJobId, requestedScope, replacementInputFingerprint |

Absent logical identity uses `null`; an existing guard uses its positive version. A protected active set change
increments its guard once. No opaque ID allocated after submission of the immutable command request may appear
anywhere in a guard key, guard canonical payload, `CallerExpectedVersions`, or
`RequiredCurrentExpectations`. Future IDs may not be hashed indirectly, hidden inside endpoint/reference objects,
or encoded into a natural-guard alias; a hash of a future ID is still prohibited. Existing row IDs are permitted
only for guard types whose fixed natural identity explicitly includes that pre-existing row ID; identity/version
refs and ResourceVersion relationship endpoints never do. Guard canonical-payload equality is independent from
final domain FK IDs. PK/unique constraints alone enforce a new random row ID's nonexistence.

For `CREATE_RESOURCE`, identityRef is `RESOURCE_IDENTITY_ANCHOR(candidateId)` and versionRef is
`RESOURCE_VERSION_ANCHOR(identityRef,candidateContentFingerprint)` before ID allocation. `RESOURCE_VERSION` and
`OBSERVATION` use those exact bytes. After commit, a later read reconstructs them from
`guardAnchorCandidateId` plus the version content fingerprint. `ATTACH_NEW_VERSION A1` derives identityRef from
the existing parent's stored anchor; A1 creation and A2/A3 reuse use the same version-ref form. First-use fork
uses the same versionRef for `RESOURCE_VERSION`, `OBSERVATION`, `FORK_LINEAGE`, and the relationship source
endpoint; correction reconstructs that byte-identical ref from the stored identity anchor and fingerprint. A
duplicate target endpoint is reconstructed the same way. Mirror lineage and repository endpoints retain their
lifecycle-stable provider/repository natural refs. No newly created repository, identity, version, source-link,
observation, or relationship row UUID affects these guard bytes.

Every typed persistent concurrency guard has exactly one canonical logical key for its entire lifetime. First
use is `null`, the accepted first write inserts version 1 under that same key, and every later request expects
positive N under the same key and canonical payload. Creation state, server UUID allocation, retries, later
domain-row lookup, Decision changes, correction, and supersession MUST NOT change it. There is no promotion,
alias, rename, dual-row representation, lifecycle-tag substitution, or transaction-local fallback.

Positive and null expectations always describe the durable **pre-mutation** state. For an existing typed guard,
the provisional plan expects positive N; step 7 acquires its advisory lock without mutation, step 8 row-locks it,
steps 9–12 reproduce and recheck N, and only the write phase may increment it to N+1. For a first-use logical
guard, the provisional plan expects `null`; step 7 acquires its advisory lock without inserting a row, no row is
available to lock at step 8, and the guard remains physically absent through locked reread, plan reproduction,
byte equality, null recheck, and invariant validation. Only the write phase may insert its typed row at version 1.
There is no transaction-local exception that treats a row inserted earlier in the same transaction as absent.

The idempotency claim is distinct from every logical/advisory guard and typed guard row. Claiming it neither
materializes nor changes a guard and cannot convert `null` to positive. If authoritative plan bytes differ,
`MUTATION_PLAN_CHANGED` takes precedence over expected-version errors. If the plans are equal, an existing row
where `null` was required or an absent/differently versioned row where positive N was required fails the exact
expectation recheck. Any typed-guard uniqueness or serialization failure aborts the transaction; rollback removes
every uncommitted version-1 guard insertion.

For a losing first-use attempt, the fixed snapshot may continue to report absence after its advisory-lock wait.
That stale absence is not evidence that no winner committed. If write-time uniqueness or SSI validation produces
one of the closed retryable outcomes above, the attempt rolls back and a fresh attempt observes the current
positive/present state. It is prohibited to require same-transaction visibility of the winner's later commit.
That fresh positive state does not authorize the original command if its immutable caller map expected `null`;
the preflight returns `EXPECTED_VERSION_SET_INVALID` before another mutation transaction opens. A same-
idempotency accepted winner remains the replay exception described in Section 15.4.

The mandatory first-use lifecycle oracle is:

- `G0`: optimistic discovery and the provisional plan observe the typed guard as absent and record `null`;
- `G1`: step 7 acquires the logical identity's advisory lock without inserting or mutating a typed row;
- `G2`: step 8 finds no typed guard row to lock, and steps 9–11 reproduce the same physical absence and `null`;
- `G3`: step 12 rechecks physical absence and step 13 validates all invariants without a typed guard row;
- `G4`: only the canonical write phase inserts the typed guard at version 1 together with the planned mutation;
- `G5`: commit makes both durable atomically; any pre-commit failure rolls both back, leaving the guard absent.

`G0`–`G5` describe the winning attempt. A competing loser may follow `G0`–`G3` under its own stale snapshot, but
must then rollback on an approved concurrency outcome and restart in a fresh transaction; it never completes a
second `G4`–`G5` first-use mutation.

The positive/null rule is universal: if a canonical logical row or guard exists, its stored positive version is
required; if a canonical logical row is required to be absent before creation, its natural guard is required with
`null`. A null creation guard is prohibited for an existing logical row, and a positive expectation is prohibited
for an absent row. For relationship correction, the old active pair guard is positive. An absent new pair guard
is null; an existing new pair is never silently reused and returns `RECORD_ALREADY_EXISTS`. Replay is handled
only by the idempotency claim. Present handoff, source-link, observation, decision, rejection, clarification, and
relationship rows always contribute positive expectations; their absent creation identities contribute the
corresponding null natural guards only when that expansion creates them.

### 15.6 Topology immutability, ordering, and lineage

Classification runs, evidence references, ownership rows, root-order rows, group edges, and topology lineage
rows are immutable facts. They have no mutable control state and no state transition; replacement is represented
only by successor control rows and typed mapping rows. `repository_candidate_groups` and `candidate_roots` each
have the closed control state `ACTIVE` or `SUPERSEDED`, a positive `recordVersion`, nullable `supersededById`,
and nullable replacement command/result/audit FKs. Other row types use only their table-specific vocabularies.

Topology commands use the following exhaustive transition matrix. Every listed mutable predecessor is positively
versioned, each transition increments `recordVersion` exactly once, and every successor mutable control row starts
at version 1. A state or row combination not listed is `TRANSITION_PROHIBITED`.

| Row type | Command/source predicate | Successor/current state | Predecessor terminal state | Replacement linkage |
| --- | --- | --- | --- | --- |
| Repository group | Split/merge: `ACTIVE` ambiguous group; override: `ACTIVE` `NON_SKILL` group | New successor group `ACTIVE` | `SUPERSEDED` | Predecessor `supersededById`; successor `supersedesGroupId`; command/result/audit FKs |
| Candidate root | Split/merge: every predecessor root is `ACTIVE`; override has no predecessor root | Every successor root `ACTIVE` | Split/merge predecessors `SUPERSEDED` | Predecessor `supersededById`; root replacement mapping rows and command/result/audit FKs |
| ResourceCandidate | Split/merge: `IDENTITY_REVIEW_REQUIRED`; override has no predecessor candidate | Every successor `IDENTITY_REVIEW_REQUIRED` | Split/merge predecessors `SUPERSEDED` | Nullable predecessor `supersededByCandidateId`; candidate replacement rows and command/result/audit FKs |
| Review | Split/merge identity review: `IDENTITY_REVIEW_REQUIRED` or `CLARIFICATION_REQUESTED`; override classification review: `CLASSIFICATION_REVIEW_REQUIRED` or `CLARIFICATION_REQUESTED` | One new `IDENTITY_REVIEW_REQUIRED` review per successor candidate | Predecessor review changes to `SUPERSEDED` with terminal reason `TOPOLOGY_SUPERSEDED` | `supersededByReviewId` is non-null for one-to-one review replacement and otherwise replacement command/result/audit FKs plus candidate mappings identify successors |
| Identity Decision | Split/merge requires exactly one active ambiguity Decision per predecessor candidate; override has none | No successor identity Decision | Prior Decision control state `SUPERSEDED` | Replacement command/result/audit FKs; successor candidates require new resolution later |
| Rejection Decision | Must be absent for split, merge, and override | None | None | Presence is `TRANSITION_PROHIBITED` |
| Handoff | Must be absent for split, merge, and override because permitted predecessor candidates are unresolved | None | None | Presence is `TRANSITION_PROHIBITED` |
| Clarification | K0/K1 has no matching OPEN row; K2 is the complete non-empty set selected by Section 15.7 | None | `OPEN` to `SUPERSEDED` | Resolution command/result IDs, `supersededByCommandId`, resolved timestamp, audit FK |

`IDENTITY_RESOLVED`, `REJECTED`, or already `SUPERSEDED` candidates cannot be split or merged. `RESOLVED` or
`REJECTED` reviews cannot be topology predecessors. Topology commands never reinterpret a resolved identity,
rejection, or active handoff. A future correction of those facts requires a separately approved command contract.

Each successor group has `supersedesGroupId` pointing to the one predecessor group and stores the replacement
command/result/audit IDs. Each successor run has `supersedesRunId` pointing to the one predecessor run and the
same replacement provenance. These successor-side FKs are the typed group/run replacement mapping; predecessor
group/run payloads never point forward.

`repository_candidate_root_order` contains `id`, `groupId`, `classificationRunId`, `candidateRootId`, zero-based
`ordinal`, `commandId`, and `createdAt`; it is unique on `(groupId,ordinal)` and `(groupId,candidateRootId)`.

Typed pair mappings provide the remaining lineage:

| Mapping | Mandatory fields and cardinality |
| --- | --- |
| `m02_root_replacements` | ID, nullable predecessorRootId, nullable successorRootId, replacementKind, command/result/audit IDs, nullable predecessorOrdinal, nullable successorOrdinal, reason, createdAt; at least one endpoint; one row per non-null predecessor-successor pair; unique null-safe endpoint pair. |
| `m02_candidate_replacements` | ID, nullable predecessorCandidateId, nullable successorCandidateId, replacementKind, command/result/audit IDs, reason, createdAt; at least one endpoint; one row per non-null pair; unique null-safe endpoint pair. |
| `m02_ownership_replacements` | ID, nullable predecessorOwnershipId, nullable successorOwnershipId, replacementKind, command/result/audit IDs, sourceEntryId, createdAt; at least one endpoint; `CREATED` requires only successor, `RETIRED` only predecessor, other kinds both; unique null-safe endpoint pair. |
| `m02_group_edge_replacements` | ID, nullable predecessorEdgeId, nullable successorEdgeId, replacementKind, command/result/audit IDs, createdAt; same endpoint rules as ownership mappings. |

For root, candidate, ownership, and edge mappings, `CREATED` requires null predecessor and non-null successor;
`RETIRED` requires non-null predecessor and null successor; every other kind requires both endpoints.
`replacementKind` is `SPLIT`, `MERGE`, `OVERRIDE`, `RETAINED`, `REASSIGNED`, `CREATED`, or `RETIRED`.
`SPLIT` writes one mapping for every predecessor→successor pair and allows one predecessor to many successors.
`MERGE` writes one mapping for every predecessor→successor pair and allows many predecessors to one successor;
the successor canonical provenance stores predecessor IDs sorted byte-exactly. `OVERRIDE` has no predecessor
root/candidate, so its root/candidate rows use `CREATED`; the predecessor group/run relationship remains explicit.
Every predecessor ownership/edge receives at least one mapping, including `RETIRED`; every successor ownership/
edge receives at least one mapping, including `CREATED`. Historical ownership remains queryable through the old
root plus these mappings.

### 15.7 Clarification target and lifecycle

`m02_clarification_requests` has ID; command/result IDs; review ID; controlling job and snapshot IDs; nullable
`targetClassificationRunId`, `targetIdentityDecisionId`, and `targetRejectionDecisionId`; nullable candidate and
group IDs; actor/role; question/reason codes; question payload (1–4,096 bytes); responder class; evidence IDs;
state; resolution command/result/audit IDs; nullable `supersededByCommandId`; record version; created/resolved
timestamps.

Exactly one target FK is non-null. Classification target requires its group ID and null candidate. Identity or
rejection target requires its candidate ID and group derived by FK; target, review, job, and snapshot must share
one lineage. States are `OPEN`, `RESOLVED`, and `SUPERSEDED`. `OPEN` is non-terminal. `RESOLVED` means the target
ambiguity received a controlling decision. `SUPERSEDED` means topology/job replacement made the target historical.
Only `state`, resolution IDs/time, and record version are mutable; transition increments once and is terminal.

`REQUEST_CLARIFICATION` creates version 1 `OPEN` under `CLARIFICATION_OPEN(reviewId,questionCode)` and
`CLARIFICATION_TARGET(targetType,targetId)`. An identical replay returns it; another open request with the same
review/question returns `RECORD_ALREADY_EXISTS`.

Every resolving mode discovers and positively versions the complete byte-sorted set of `OPEN` clarification rows
for its target. Identity/resource/duplicate/fork/mirror/rejection modes transition them to `RESOLVED`. Split,
merge, override, and job replacement transition them to `SUPERSEDED`. `RESOLVE_AMBIGUITY` applies the selected
projector's rule. No M02 command creates `CANCELLED`; adding cancellation requires a future approved command.

For `REPLACE_M02_JOB`, the exact selection predicate is the SQL-equivalent of
`state = 'OPEN' AND controllingJobId = ANY(byteSortedPredecessorJobIds)`. The three-way target FK remains
authoritative provenance but neither expands nor narrows this set: `controllingJobId` has precedence even when
the same target entity is referenced by a clarification controlled by a non-predecessor job. Every selected row
is positively versioned, included in optimistic discovery, authoritative locking, plan reproduction, result,
postconditions, and audit derivation, and transitions `OPEN` to `SUPERSEDED` with resolution command/result/audit
IDs, `supersededByCommandId`, resolved timestamp, and one version increment. Clarifications whose
`controllingJobId` is outside the predecessor set remain byte-identical. `Z0` denotes no matching OPEN row and
therefore no clarification write or audit; `Z1` denotes the complete non-empty byte-sorted matching set. These
are the only replacement clarification branches.

### 15.8 Canonical AuditEvent

`m02_audit_events` maps directly to the Architecture `AuditEvent` and Graph `audit_event`. Required typed columns
are: `id`, `originType` (`HUMAN_COMMAND` or `SYSTEM_IDENTITY_OPERATION`), nullable `commandId`, nullable
`resultId`, nullable `systemOperationId`, nullable `systemResultId`, `actorType` (`HUMAN` or `SYSTEM`), `actorId`, nullable `actorRole`, `action`,
`subjectType`, `subjectId`, `requestId`, `idempotencyScope`, `idempotencyKey`, `reasonCode`, bounded `reasonText`,
nullable `beforeVersion`, nullable `afterVersion`, nullable canonical `beforeState`, nullable canonical
`afterState`, `metadataSchemaVersion`, bounded canonical `metadata`, nullable `sourceSnapshotId`, nullable
`controllingJobId`, and `occurredAt`. `HUMAN_COMMAND` requires command/result and prohibits system operation/result;
`SYSTEM_IDENTITY_OPERATION` requires system operation/result and prohibits command/result. Neither both nor neither
origin pair is valid. For system origin, `requestId=systemOperationId`, `reasonCode=automaticProjectorModeId`,
and `reasonText=automaticProjectorModeId`; all subject audits use that operation's same idempotency/reason values.
For human origin they equal the authenticated command fields. These values
are stored directly and equality-constrained, not derived only through an origin FK.

Audit values depend only on the typed subject category:

- creation of an immutable row with no `recordVersion` or mutable state uses `SUBJECT_CREATED` with all four
  before/after version/state columns null;
- creation of a versioned control row uses `SUBJECT_CREATED`, null before version/state, `afterVersion = 1`, and
  its exact initial state in `afterState`;
- a non-superseding mutable update from version N uses `SUBJECT_UPDATED`, versions N/N+1, and exact prior/next
  state;
- a versioned mutable supersession from version N uses `SUBJECT_SUPERSEDED`, versions N/N+1, and exact prior/
  terminal state plus replacement linkage; and
- every immutable topology replacement mapping row uses one `SUBJECT_CREATED` audit whose subject type is
  `ROOT_REPLACEMENT`, `CANDIDATE_REPLACEMENT`, `OWNERSHIP_REPLACEMENT`, or `GROUP_EDGE_REPLACEMENT`, whose subject
  ID is the mapping-row primary key, whose four version/state values are null, and whose metadata contains its
  non-null predecessor/successor IDs and `replacementKind`.

Thus split one-to-many emits one mapping audit for every predecessor-successor mapping row, and merge many-to-one
does the same. `CREATED` and `RETIRED` mappings also receive one mapping-row `SUBJECT_CREATED` audit and represent
their null endpoint by omission, never by an array or fabricated state. The separate supersession audit for a
mutable predecessor is emitted once for its state transition; it omits `successorId` when more than one mapping
identifies its successors. Idempotent replay returns existing audits and creates none. Accepted audit multiplicity
is exact:

```text
1 COMMAND_ACCEPTED audit for the human command
+ 1 SUBJECT_CREATED audit for each created canonical domain row
+ 1 SUBJECT_UPDATED audit for each existing row updated without supersession
+ 1 SUBJECT_SUPERSEDED audit for each versioned mutable predecessor row transitioned to its terminal state
```

The closed `action` vocabulary is `COMMAND_ACCEPTED`, `SYSTEM_OPERATION_ACCEPTED`, `SUBJECT_CREATED`,
`SUBJECT_UPDATED`, and `SUBJECT_SUPERSEDED`. `COMMAND_ACCEPTED` has subject type
`MANUAL_RESOLUTION_COMMAND` and subject ID `commandId`; `SYSTEM_OPERATION_ACCEPTED` has subject type
`SYSTEM_IDENTITY_OPERATION` and subject ID `systemOperationId`. Human-origin audits require `actorType=HUMAN`,
the authenticated role and the human origin pair. System-origin audits require `actorType=SYSTEM`, the stable
resolver service principal, null role and the system origin pair. Every subject action uses the canonical typed
row type and primary key of the created, updated, or superseded row. No aggregate or implementation-selected
audit subject is permitted.

Human command/result, system operation/result, audit and guard rows are excluded from `SUBJECT_CREATED`;
`SYSTEM_OPERATION_ACCEPTED` is the sole audit for creating the infrastructure operation/result pair. Topology order, ownership and lineage rows,
clarification, decisions, relationships, handoffs, and jobs are domain rows and included. A superseded predecessor
receives only `SUBJECT_SUPERSEDED`, not an additional update audit. `REPLACE_M02_JOB` therefore has one
`SUBJECT_SUPERSEDED` audit with subject type `M02_JOB` per predecessor in addition to the formula's command and
replacement-job creation audits. Metadata uses only `successorId`, `relationshipType`, `replacementKind`, `scope`, `guardKey`,
`sourceEndpointId`, `targetEndpointId`, `predecessorRootId`, `successorRootId`, `predecessorCandidateId`,
`successorCandidateId`, `predecessorOwnershipId`, `successorOwnershipId`, `predecessorEdgeId`, `successorEdgeId`,
`clarificationTargetType`, `clarificationTargetId`, `evaluatedTierSequence`, `automaticProjectorModeId`, and
`identityDecisionInputFingerprint`; the last three are allowed only for identity-Decision/system-operation audits.
`evaluatedTierSequence` is the exact six-entry P1→P6 array of
`{tier,evaluationDisposition}` defined by `IdentityDecisionInputV1`; tiers through the controlling stop are
evaluated and every lower tier is present as `NOT_APPLICABLE`. It must byte-equal `IdentityDecisionInputV1`.
Absent or null-endpoint keys are omitted and no other key
is allowed. Before/after state is canonical JSON limited to the subject's state/status, FK identities, replacement
linkage, and version, maximum 16,384 UTF-8 bytes. `m02_manual_command_results` and
`m02_system_identity_results` are not domain audit subjects and do not receive separate audits; their
accepted-origin action binds the applicable mandatory result FK.

### 15.9 Closed command-mode projection matrix

Every accepted expansion reads the immutable snapshot, evidence FKs, controlling acquisition/M02 job pair,
command claim, and the rows selected below; creates one command shell and result; allocates the server IDs for
every created row and formula-derived audit; and returns byte-sorted created, reused, updated, and superseded IDs.
Set-valued IDs such as siblings, ownership facts, a clarification set, or the explicitly declared
`activeDuplicateProposalOrNull` predecessor slot are canonical parameters, not hidden branches: optimistic discovery and
locked reproduction must select the identical complete byte-sorted/null set, and its cardinality feeds the audit
formula. A declared optional predecessor may add its positive guard and supersession audit without changing the
projector's created postcondition row classes; it is not an implicit Cartesian dimension. Different structural
dimension values below are distinct executable modes even when their final domain outcome is similar.

Every human IdentityDecision writer has one closed outcome mapping: `CREATE_RESOURCE` writes `NEW_RESOURCE`;
`ATTACH_NEW_VERSION(A1)` writes `EXISTING_RESOURCE_NEW_VERSION`; `ATTACH_NEW_VERSION(A2/A3)` writes
`EXACT_REPEAT_REUSE`; `MARK_FORK` writes `FORK_OF_EXISTING_RESOURCE`; `MARK_MIRROR` writes `MIRROR`; and
`MARK_DUPLICATE` writes `POSSIBLE_DUPLICATE`. `RESOLVE_AMBIGUITY` reproduces the byte-identical outcome of its
selected direct expansion. Rejection, clarification, topology and job-replacement projectors do not create an
IdentityDecision and cannot invent an identity outcome. This mapping applies to every P/K/J/A/M/correction
combination without changing the family arithmetic.

The closed expansion dimensions are:

| Code | Exact predicate and effect |
| --- | --- |
| `P0` | Candidate `CLASSIFIED`; no active identity/rejection Decision and no handoff. |
| `P1` | Candidate `IDENTITY_REVIEW_REQUIRED`; exactly one positively versioned active ambiguity Decision; no rejection Decision or handoff. |
| `P2` | Candidate `IDENTITY_RESOLVED`; exactly one positively versioned controlling identity Decision and active handoff with a valid identity/version/controller chain. |
| `K0` | No OPEN clarification for the command target and `CLARIFICATION_TARGET` guard absent/null. |
| `K1` | No OPEN clarification for the target and its historical `CLARIFICATION_TARGET` guard present/positive. |
| `K2` | Complete non-empty OPEN clarification set for the target; target guard and every row positive; transition set to `RESOLVED` for identity/rejection projectors or `SUPERSEDED` for topology projectors. |
| `JC` | Locked siblings contain no unresolved candidate and at least one resolved candidate, where resolved requires candidate `IDENTITY_RESOLVED` plus a Decision and valid active handoff both bound to the effective current controller; jobs `COMPLETED`, the selected resolved review is `RESOLVED`, and active current-controller handoffs exactly equal resolved candidates. |
| `JR` | Locked siblings contain at least one candidate without that complete current-controller Decision/handoff chain; predecessor-controller or superseded handoffs never count; jobs `OPERATOR_REVIEW_REQUIRED`. The selected review follows its family: `RESOLVED` for identity-resolution success, `IDENTITY_REVIEW_REQUIRED` for ambiguity, or `REJECTED` for rejection/confirmed duplicate. |
| `JE` | All locked siblings are rejected; jobs `COMPLETED`, review `REJECTED`, no active handoff. |
| `A1` | New content version absent, prior active source link positive; create version, replacement link, and observation; new version/observation guards null and source guard positive. |
| `A2` | Exact version and active source link positive, observation absent/null; reuse version/link and create observation. |
| `A3` | Exact version, active source link, and observation all present/positive; reuse all three. |
| `M1` | Mirror delivery link/observation absent; source/observation guards null and both rows are created. |
| `M2` | Exact mirror delivery link/observation present/positive and both rows are reused. |
| `T0`/`T1` | Clarification target guard absent/null or present/positive before `REQUEST_CLARIFICATION`; `CLARIFICATION_OPEN` is always absent/null. |
| `Z0`/`Z1` | Replacement has zero or a complete non-empty Section 15.7 predecessor-controlled OPEN clarification set. |

`P1` creation of a handoff uses null `HANDOFF`; `P2` replacement or preservation of its active handoff uses the
positive stored `HANDOFF` guard and row version. Handoff-without-Decision, rejection-with-handoff, and every other
P combination are prohibited. `K2` necessarily has a positive target guard. For `K0`, `K1`, and `K2`, the guard
and row sets shown are exact; there is no fourth clarification state.

Every human P1 resolver has the same mandatory canonical `activeDuplicateProposalOrNull` predecessor slot:
`CREATE_RESOURCE(P1)`, `ATTACH_NEW_VERSION(P1)`, `MARK_FORK(FIRST)`, `MARK_MIRROR(FIRST)`,
`MARK_DUPLICATE(FIRST)`, and `REJECT_CANDIDATE(P1)`; `RESOLVE_AMBIGUITY` inherits the selected direct rule.
Discovery and locked reproduction read the complete zero-or-one active S7 proposal under
`DUPLICATE_PROPOSAL_SET(candidateId)`. When present, the proposal row, candidate proposal-set guard and its
`DUPLICATE_PROPOSAL_PAIR` guard are positive; the transaction increments both guards, supersedes the proposal,
and adds exactly one `SUBJECT_SUPERSEDED` audit. When absent, the set guard is required at its current null or
historical-positive version, no pair guard or proposal row is invented, and no proposal write/audit occurs.
Every successful P1 resolution therefore ends with no active proposal. The nullable predecessor slot changes
only the exact predecessor/audit cardinality, never a family mode count or created postcondition class.

Each family below expands as the Cartesian product in its `Dimensions` column. `C`, `U`, `S`, and `L` denote the
exact created, updated-without-supersession, versioned-superseded, and immutable-lineage-mapping sets produced by
that expansion. The accepted audit count is always `1 + |C| + |U| + |S|`; `L` is a subset of `C`, not an extra
term. Rows named present/reused are positive; rows named absent/created use their exact Section 15.5 null guard.

| Family | Dimensions and count | Exact projection, guards, transitions, and final postcondition |
| --- | ---: | --- |
| `CREATE_RESOURCE` | `P0/P1 × K0/K1/K2 × JC/JR = 12` | ADMIN/EDITOR. Read/lock candidate, group, root, run, review, jobs, repository, P1 Decision, K2 rows and the universal P1 proposal slot. Create identity with `guardAnchorCandidateId=candidateId`, version, PRIMARY link, observation, Decision, handoff; update candidate/review/jobs; supersede P1 Decision, K2 rows and optional proposal. Null `RESOURCE_VERSION` and observation use lifecycle-stable V2 identity/version anchors plus natural `SourceLinkGuardRefV1`; a later request reconstructs byte-identical keys and positive versions from the stored anchor/fingerprint. Source/handoff guards are allocation-independent. All read mutable rows are positive. Final resolved candidate with one active I/V/link/observation/Decision/handoff, no active proposal, and selected J outcome. |
| `ATTACH_NEW_VERSION` | `A1/A2/A3 × P1/P2 × K0/K1/K2 × JC/JR = 36` | ADMIN/EDITOR. Read/lock identity, A rows, candidate/group/root/review/jobs, current Decision, P2 handoff, K2 rows and the universal P1 proposal slot. Apply A projection; create Decision and handoff; update candidate/review/jobs; supersede old Decision, K2 rows, P1 optional proposal, A1 prior link, and P2 handoff. P1 handoff guard null; P2 handoff guard/row positive. A1 derives the parent identity ref from immutable `guardAnchorCandidateId`; its created version and observation use the same V2 version ref later reconstructed by A2/A3 from existing rows plus natural source-link ref. A later candidate attaching to an identity created by another candidate uses the original stored anchor, never its own candidate ID. A1 source guard is positive because its old logical link exists. Final one active link/observation/Decision/handoff to exact version and no active proposal. |
| `MARK_FORK` | `FIRST/CORRECTION × K0/K1/K2 × JC/JR = 12` | ADMIN/EDITOR. FIRST requires P1, reads the existing origin version and universal proposal slot, and creates identity/version/link/observation/fork/Decision/handoff with null new version/source/observation/lineage/pair/handoff guards. Its identity persists `guardAnchorCandidateId=candidateId`; version, observation, fork-lineage and pair-source use one V2 version ref, while the origin endpoint reconstructs the existing target's V2 ref. It supersedes ambiguity Decision/K2/optional proposal. CORRECTION requires P2 plus active fork, preserves I/V/link/observation/handoff, reconstructs byte-identical positive lineage/old-pair keys from the stored anchor/fingerprint, creates replacement fork/Decision, and supersedes old fork/Decision/K2; handoff and preserved rows are positive, while the absent new pair uses V2 endpoint refs. Existing new pair conflicts. Final directed, distinct-Resource, acyclic fork with one origin and no active proposal. |
| `MARK_MIRROR` | `(FIRST × M1/M2 × K0/K1/K2 × JC/JR) + (CORRECTION × K0/K1/K2 × JC/JR) = 18` | ADMIN/EDITOR. FIRST requires P1, repositories/target version and the universal proposal slot; M1 creates link/observation, M2 reuses positive link/observation; both create mirror/Decision/handoff, supersede ambiguity Decision/K2/optional proposal, and use null lineage/new-pair/handoff. M1 lineage, source, observation and repository pair guards use lifecycle-stable `SourceRepositoryGuardRefV1`/`SourceLinkGuardRefV1`; any ResourceVersion endpoint uses V2 anchor reconstruction, never an opaque version ID. CORRECTION reproduces byte-identical old lineage/pair/source keys, creates replacement mirror/link/observation/Decision/handoff, supersedes old mirror/link/Decision/handoff/K2, and keeps old observation immutable; old lineage/pair/source/handoff are positive, new pair and observation allocation-independent/null, source active-set guard positive. Existing new pair conflicts. Final one active mirror/link/Decision/handoff, exact observation and no active proposal. |
| `MARK_DUPLICATE` | `FIRST/CORRECTION × K0/K1/K2 × JC/JR/JE = 18` | ADMIN/EDITOR. FIRST requires P1 and an exact target version and applies the universal optional proposal cleanup above. A proposal may name the selected target or a different prior target; every guard actually read is included exactly, while the confirmed `DUPLICATE_DISPOSITION(candidateId)` and selected `RELATIONSHIP_PAIR` must remain null. FIRST creates the CONFIRMED row plus human Decision, supersedes the system ambiguity Decision/K2 and optional proposal, updates candidate/review/jobs to rejection, and creates no I/V/handoff. Proposal presence changes only predecessor/audit provenance, never the FIRST mode identity or 18-mode count. CORRECTION requires rejected candidate, active confirmed duplicate/Decision and no handoff; it guards old pair, creates replacement duplicate/Decision, supersedes old duplicate/Decision/K2, and uses null new pair. Final one active confirmed target and no active proposal/handoff. |
| `REJECT_CANDIDATE` | `P0/P1 × K0/K1/K2 × JC/JR/JE = 18` | ADMIN/EDITOR/TECHNICAL_REVIEWER. Rejection Decision and guard must be absent/null; read/lock P1 Decision, K2 rows and universal P1 proposal slot when present; create rejection Decision, update candidate/review/jobs, supersede P1 Decision/K2/optional proposal, create no handoff. Any prior rejection Decision or handoff conflicts. Final rejected candidate, one active rejection Decision, no identity Decision/handoff/proposal. |
| `SPLIT_ROOTS` | `K0/K1/K2 = 3` | ADMIN. Exact Section 15.6 split predecessor graph; create successor group/run, two-or-more ordered roots, complete ownership/order/edges/candidates/reviews and every pair mapping; supersede permitted mutable group/root/candidate/review/Decision and K2 rows; immutable predecessors unchanged. Existing rows/guards positive, successor group/membership/root/candidate guards null. Jobs become operator review. No I/V/relationship/handoff. |
| `MERGE_ROOTS` | `K0/K1/K2 = 3` | ADMIN. Exact Section 15.6 merge graph with two-or-more roots/candidates and sorted predecessor provenance; create one successor graph and complete pair mappings; supersede permitted mutable predecessors and K2 rows; immutable predecessors unchanged. Existing rows/guards positive and successor natural guards null. Jobs become operator review. No I/V/relationship/handoff. |
| `OVERRIDE_NON_SKILL` | `K0/K1/K2 = 3` | ADMIN/EDITOR. Active NON_SKILL group/run and permitted classification review; create HUMAN_OVERRIDE successor group/run, 1..64 canonical roots, complete topology/candidates/reviews and CREATED mappings; supersede group/review/K2 rows; immutable prior run/evidence unchanged. Existing predecessors positive and every successor natural guard null. Jobs become operator review. No I/V/relationship/handoff. |
| `REQUEST_CLARIFICATION` | `CLASSIFICATION/IDENTITY/REJECTION × T0/T1 = 6` | Authorized roles in Section 15.2. Read/lock exact target, review, group/candidate lineage, jobs, positive target guard for T1; create one OPEN clarification and update review/jobs. Open guard null; target guard null for T0 or positive for T1. No identity/topology/handoff mutation. Final exactly one OPEN typed-target row. |
| `RESOLVE_AMBIGUITY` | `123 selected direct expansions = 123` | ADMIN/EDITOR. Closed dispatch to one of the 123 direct CREATE/ATTACH/FORK/MIRROR/DUPLICATE/REJECT/SPLIT/MERGE/OVERRIDE expansions. The outer command ID is the sole command identity; the selected expansion's outcome, rows, guards, IDs, transitions, audits, conflicts, and postconditions are reproduced byte-for-byte with no inner command/result/audit. |
| `REPLACE_M02_JOB` | `SINGLE/MULTIPLE predecessor × Z0/Z1 = 4` | Section 16 roles/states. Read/lock every predecessor acquisition/M02 row, active handoff selected by `controllingJobId`, and Z1 clarification; create one complete acquisition/M02 replacement and one edge per predecessor; supersede each predecessor M02 controller, selected handoff, and Z1 clarification. Controller guards positive for present scopes and null only for absent protected scopes; replacement-input guard null; random replacement ID is never a guard. Final one controller, preserved history, and only outside-predecessor clarifications unchanged. |

The outcome mapping above is part of every family's exact projection. `CREATE_RESOURCE` creates and attaches one
I/V under `NEW_RESOURCE`. `ATTACH_NEW_VERSION(A1)` creates exactly one new V and uses
`EXISTING_RESOURCE_NEW_VERSION`; `ATTACH_NEW_VERSION(A2)` creates only the absent observation, and A3 creates no
I/V/link/observation row; A2/A3 both use `EXACT_REPEAT_REUSE`. For A2/A3, candidate outcome and exact I/V FKs,
the new human Decision, the manual result, created/reused arrays, postcondition and canonical candidate
before/after audit state are equality-bound: created I/V arrays and I/V creation audits are empty, while reused
I/V arrays contain exactly the selected existing rows. A1 instead has exactly one created version/result ID and
one ResourceVersion creation audit. `MARK_FORK`, `MARK_MIRROR`, and `MARK_DUPLICATE` equality-bind their mapped
outcomes in the same candidate/Decision/result/audit surfaces. `RESOLVE_AMBIGUITY` reproduces these bytes and
cardinalities from its selected expansion; a different outcome or I/V projection is `MUTATION_PLAN_CHANGED`.

The direct projector count is `12 + 36 + 12 + 18 + 18 + 18 + 3 + 3 + 3 = 123`. Therefore:

```text
Total executable modes = 123 direct + 6 clarification + 123 ambiguity-dispatch + 4 replacement = 256
```

For all 256 expansions, every guard component MUST be one of: immutable request data; a canonical source/content
fingerprint; a lifecycle-stable V2 anchor reconstructed from immutable canonical state; or the ID of a row that
predates the request only where that guard type's fixed natural identity explicitly permits it. Discovery and
locked reproduction reject any future-ID injection into a guard payload, endpoint/reference object, alias, or
hashed key with `CALLER_CONTROLLED_ID_PROHIBITED`. For every persistent guard the scan proves pre-allocation
constructibility where creation is possible; first-use key equality with every later reuse/correction key for
the same logical protected set; invariance under provisional UUID changes; exclusion of identity/version opaque
IDs from guard bytes; and positive expectations against the exact key originally created by the null guard. This
universal audit introduces no new accepted mode and applies equally to direct and ambiguity-dispatched
expansions. The accepted total remains exactly 256.

The exhaustive no-future-ID and lifecycle-continuity guard audit is:

| Family / modes | Allocation-independent provenance and lifetime continuity |
| --- | --- |
| `CREATE_RESOURCE` / 12 | Candidate/snapshot/root/source natural values plus V2 identity/version anchors; created identity persists the candidate anchor; later reads reproduce identical version/observation keys and find positive versions; no created I/V/link/observation/Decision/handoff ID |
| `ATTACH_NEW_VERSION` / 36 | Existing parent's original anchor plus content fingerprint; A1 first-use version/observation keys equal A2/A3 existing-row keys, including cross-candidate attachment; no new version ID enters guard bytes |
| `MARK_FORK` / 12 | Candidate anchor for first fork and stored original anchor for correction; identical version/observation/lineage/old-pair source bytes, V2 origin endpoint, null-to-version1-to-positive continuity; no created fork/link/observation/Decision ID |
| `MARK_MIRROR` / 18 | Provider/repository/root natural refs are identical across FIRST/CORRECTION; V2 target-version endpoints are reconstructed without version UUIDs; first null lineage/pair keys become later positive keys; no created repository/link/observation/mirror/Decision ID |
| `MARK_DUPLICATE` / 18 | Candidate ref plus target V2 version ref; FIRST accepts canonical zero-or-one active proposal provenance, positively versions/supersedes it when present, and uses null confirmed disposition/pair guards either way; FIRST null confirmed pair becomes CORRECTION positive old-pair; proposal presence is provenance, not a mode; target domain UUID is lookup-only and absent from hashed endpoint; no created duplicate/Decision ID |
| `REJECT_CANDIDATE` / 18 | Candidate/review/job/clarification natural refs; no created rejection-Decision ID |
| `SPLIT_ROOTS` / 3 | Existing predecessor rows plus snapshot/policy/fingerprint successor natural refs; no successor group/root/candidate/mapping ID |
| `MERGE_ROOTS` / 3 | Existing predecessor rows plus snapshot/policy/fingerprint successor natural refs; no successor group/root/candidate/mapping ID |
| `OVERRIDE_NON_SKILL` / 3 | Existing predecessor rows plus snapshot/policy/fingerprint successor natural refs; no successor group/root/candidate/mapping ID |
| `REQUEST_CLARIFICATION` / 6 | Existing typed target/review/job plus question code; no created clarification ID |
| `RESOLVE_AMBIGUITY` / 123 | Byte-identical provenance and lifetime proof of its selected direct expansion; no inner/future ID and no lifecycle discontinuity |
| `REPLACE_M02_JOB` / 4 | Existing lineage/scope controller values and source/requested-scope/input fingerprint; no replacement job/edge/result/audit ID |

Duplicate replay is resolved before mode selection by the idempotency lookup and is not an accepted executable
mode. A relationship correction whose new pair already exists, a conflicting source link/observation, or a row
combination outside the closed dimensions is a deterministic rejected conflict, not an extra mode.

Every row above also uses `ROLE_NOT_AUTHORIZED`, `TRANSITION_PROHIBITED`, `REFERENCE_INVALID`,
`RECORD_NOT_FOUND`, `STALE_RECORD_VERSION`, `RECORD_ALREADY_EXISTS`, `EXPECTED_VERSION_SET_INVALID`,
`PHANTOM_CONFLICT`, `MUTATION_PLAN_CHANGED`, `FINGERPRINT_COLLISION`, `CONCURRENCY_GUARD_COLLISION`,
`IDEMPOTENCY_KEY_REUSED`, `CALLER_CONTROLLED_ID_PROHIBITED`, `JOB_SUPERSEDED`, and
`SERIALIZATION_RETRY_EXHAUSTED` when its named invariant or bounded execution rule is violated. Relationship
modes additionally use `RELATIONSHIP_SELF_EDGE`, `RELATIONSHIP_CYCLE`,
`RELATIONSHIP_CONTENT_MISMATCH`, or `RELATIONSHIP_ENDPOINT_INVALID`; job modes additionally use
`REPLACEMENT_INPUT_UNCHANGED` and `OVERLAPPING_CONTROLLER_CONFLICT`.

### 15.10 Rejected-command audit

After an accepted transaction ends or rolls back, a deterministic rejection may create one append-only
`m02_rejected_command_audits` row in a separate transaction. It stores server ID; command/request/idempotency
identities; request fingerprint; actor/role; error code; existing target IDs; and timestamp. Unique
`(idempotencyScope,idempotencyKey,requestFingerprint,errorCode)` makes replay idempotent. It contains no
uncommitted allocated ID, accepted result FK, before/after accepted state, or implication of domain mutation.

### 15.11 System identity mutation operation and canonical transaction

`SystemIdentityMutationOperationV1` is the sole authority for the 22 Section 13.1 system modes. First define the
exact canonical decision input:

```text
IdentityDecisionInputV1 = {
  schemaVersion: "1", sourceSnapshotId, candidateId, candidateRootFingerprint,
  candidateContentFingerprint, reconciledClassificationRunId,
  classificationRunInputFingerprint, classificationRunOutputFingerprint,
  analysisRunIdOrNull, analysisRunRequestFingerprintOrNull, analysisRunResponseFingerprintOrNull, classificationPolicyVersion,
  identityPolicyVersion, analysisPolicyVersion, parserProfileVersion, promptBundleVersion,
  evaluatedTierSequence: [{tier,evaluationDisposition}],
  trustedSignals: [{tier,signalType,targetTypeOrNull,targetIdOrNull,evidenceReferenceIds}],
  conflicts: [{code,targets:[{targetType,targetId}],evidenceReferenceIds}]
}
```

`IdentitySignalTypeV1` is exactly `P1_ACTIVE_SOURCE_LINK`, `P2_TRUSTED_EXTERNAL_IDENTIFIER`,
`P3_REVIEWED_MIRROR_PROVENANCE`, `P3_REVIEWED_FORK_PROVENANCE`,
`P3_REVIEWED_UPSTREAM_PROVENANCE`, `P3_PROVIDER_DECLARED_FORK_PROVENANCE`,
`P4_CANDIDATE_CONTENT_FINGERPRINT`, `P5_SOURCE_NAME`,
`P5_CREATOR_IDENTITY`, `P5_ORGANIZATION_IDENTITY`, or `P6_WEAK_SIMILAR_NAME`. No aggregate
source-provenance or name/creator/organization alias is permitted.

`IdentitySignalTargetTypeV1` is exactly `RESOURCE_IDENTITY`, `RESOURCE_VERSION`, or `SOURCE_REPOSITORY`.
For each trusted signal, `targetTypeOrNull` and `targetIdOrNull` are either both null or both non-null; a
non-null ID is validated against the typed table named by the discriminator. A P1/P2/P4/P5/P6 canonical target
is a Resource identity or version as proved by that signal; P3 reviewed mirror/upstream and provider-declared
fork target the exact source/upstream repository, while P3 reviewed fork targets an origin ResourceVersion. S8
must contain `P3_PROVIDER_DECLARED_FORK_PROVENANCE`, with P1/P2 evaluated before it and P4–P6 explicitly
`NOT_APPLICABLE`; the provider fork signal cannot be represented by a reviewed-provenance alias. An
implementation may not compare or sort untyped opaque IDs.
Persistence uses nullable `resourceIdentityId`, `resourceVersionId`, and `sourceRepositoryId` typed FKs with
exactly one non-null when the canonical target is non-null and all three null otherwise; the discriminator must
equal the non-null FK type. The canonical `targetIdOrNull` is derived from that FK, never stored as an
unconstrained substitute.

`IdentityDecisionConflictCodeV1` is exactly `MISSING_OR_UNRELIABLE_IDENTITY_TOKEN`,
`TRUSTED_IDENTIFIER_SOURCE_LINK_CONFLICT`, `EXTERNAL_IDENTIFIER_COLLISION`, `MULTIPLE_CANONICAL_TARGETS`,
`DIVERGENT_MIRROR_CONTENT`, `CONTENT_FINGERPRINT_PAYLOAD_COLLISION`, or
`PROVENANCE_SIGNAL_CONFLICT`. Every conflict target uses the same closed target-type enum and a non-null typed
ID. Conflict-target persistence uses the same exactly-one typed-FK XOR and derives canonical target bytes from
it. The content-payload collision is accepted blocking S6 evidence; a hash/payload collision in an infrastructure
operation/request record is instead rejected as `FINGERPRINT_COLLISION` and is never implementation-selected.

`evaluatedTierSequence` contains exactly six entries, once each in strict P1→P6 order. Its
`evaluationDisposition` is exactly `MATCH`, `NO_MATCH`, `CONFLICT`, `MULTIPLE_TARGETS`, or `NOT_APPLICABLE`.
Every tier through the controlling stop is evaluated and never `NOT_APPLICABLE`; every lower tier after that
stop is present as `NOT_APPLICABLE`. Omission, duplicate tiers, or a different lower-tier representation is
invalid. Arrays use Section 4 canonical JSON: signals sort by tier, signal type, target type, target ID and
evidence sequence; conflicts sort by code then typed target sequence; typed targets sort by target type then
ID; all evidence IDs are byte-sorted.

The retained system-origin Decision input has one exact normalized relational projection. The rows are
append-only canonical domain children, not aggregate-internal JSON and not independently mutable:

| Table | Server-controlled row identity and exact uniqueness |
| --- | --- |
| `identity_decision_tier_evaluations` | UUID PK allocated after request freeze; `(identityDecisionId,ordinal)` and `(identityDecisionId,tier)` unique; ordinals exactly 0..5 map P1..P6 |
| `identity_decision_signals` | UUID PK allocated after freeze; `(identityDecisionId,ordinal)` unique; ordinal follows canonical signal order; closed signal/tier plus exactly-one typed target FK or all-null target |
| `identity_decision_signal_evidence` | UUID PK allocated after freeze; `(signalId,ordinal)` and `(signalId,evidenceReferenceId)` unique; ordinal follows byte-sorted evidence IDs; typed evidence FK |
| `identity_decision_conflicts` | UUID PK allocated after freeze; `(identityDecisionId,ordinal)` unique; ordinal follows canonical conflict order; closed conflict code |
| `identity_decision_conflict_targets` | UUID PK allocated after freeze; `(conflictId,ordinal)` and typed target uniqueness; ordinal follows target-type/ID order; exactly-one typed target FK |
| `identity_decision_conflict_evidence` | UUID PK allocated after freeze; `(conflictId,ordinal)` and `(conflictId,evidenceReferenceId)` unique; ordinal follows byte-sorted evidence IDs; typed evidence FK |

The system mutation plan allocates every child UUID only after the complete input/request/expectation freeze,
lists each typed child-ID array in `m02_system_identity_results`, and includes every child row in `C`. Each child
therefore receives exactly one `SUBJECT_CREATED` audit with null before/after version/state and its exact table
subject type; none receives an extra aggregate audit. The parent `identity_decisions` row receives its own
creation audit. Rollback removes parent, children, result and all audits atomically; exact replay creates none.
Human-origin Decisions retain their existing command/evidence projection and do not impersonate these
system-input child rows. No child ID enters Decision-input, idempotency, request, guard or expectation bytes.

Non-applicable AnalysisRun fields are explicit null. The classification fingerprints are the exact stored
input/output fingerprints required by Section 5; analysis fingerprints are the exact stored AnalysisRun
request/response fingerprints from Section 9. No undefined aggregate run fingerprint is permitted. Timestamps,
future operation/result/audit IDs, duration and provider noise are prohibited.
`identityDecisionInputFingerprint = SHA-256(canonicalJson(IdentityDecisionInputV1))`; hash match requires
byte-exact stored payload equality or infrastructure `FINGERPRINT_COLLISION`.

`analysisRunId` and request/response fingerprints are nullable. A deterministic classification/reconciliation
whose identity input does not depend on an AnalysisRun uses null/null/null. A dependent AI-assisted/configured
comparison path uses the exact immutable ID/request/response fingerprints. No dummy AnalysisRun is created.
The operation row stores those three nullable values, equality-bound to retained `IdentityDecisionInputV1`.

The exact pre-allocation request is:

```text
SystemIdentityOperationRequestV1 = {
  schemaVersion: "1", operationKind: "SYSTEM_IDENTITY_PROJECTION", automaticProjectorModeId,
  sourceSnapshotId, candidateId, controllingJobId, reconciledClassificationRunId,
  identityDecisionInputFingerprint, identityPolicyVersion, idempotencyScope, idempotencyKey,
  systemReplayLookupKey, SystemExpectedVersions, systemActorId
}
systemOperationFingerprint = SHA-256(canonicalJson(SystemIdentityOperationRequestV1))
```

Byte equality is mandatory. `systemOperationId` and every other future ID are excluded. After the expectation
preflight and request/fingerprint freeze, the server allocates `systemOperationId` and other provisional IDs,
then creates the immutable operation row from allocated ID, frozen request/payload/fingerprint and `createdAt`.
Changing provisional IDs cannot change idempotency, expectations, guards or either fingerprint.

Every field is server-derived. `systemActorId` is a stable resolver service principal; actor type is SYSTEM and
role null. Source content, AI proposals and external callers cannot invoke or choose the operation.

Accepted replay has a separately defined pre-projector locator that excludes the not-yet-selected mode and
Decision input:

```text
SystemIdentityReplayLocatorV1 = {
  schemaVersion: "1", replayScope: "M02_SYSTEM_IDENTITY_REPLAY_V1",
  sourceSnapshotId, candidateId, controllingJobId, reconciledClassificationRunId,
  classificationPolicyVersion, identityPolicyVersion, systemActorId
}
systemReplayLookupKey = SHA-256(canonicalJson(SystemIdentityReplayLocatorV1))
```

Every field is available from immutable candidate/run/controller/policy context before projector selection.
Accepted operation rows retain the locator bytes/key and enforce one accepted operation per key. A byte-equal
lookup returns the committed result before current-state eligibility checks, so replay remains possible after
the original mutation changed candidate/Decision/handoff state. Hash match with unequal locator bytes is
`FINGERPRINT_COLLISION`. A different methodology, policy, snapshot, run, or reanalysis must use the applicable
new run/replacement controller and therefore a different locator; no second logical system operation may reuse
an accepted locator. The locator is only for accepted replay discovery and never substitutes for the full
idempotency payload, request fingerprint or locked plan reproduction.

The system idempotency payload is:

```text
{
  schemaVersion: "1", sourceSnapshotId, candidateId, controllingJobId,
  reconciledClassificationRunId, identityDecisionInputFingerprint, identityPolicyVersion,
  automaticProjectorModeId
}
```

Its Section 4 canonical-JSON SHA-256 is `idempotencyKey` under the fixed scope
`M02_SYSTEM_IDENTITY_PROJECTION_V1`. Hash lookup requires byte-exact payload equality or
`FINGERPRINT_COLLISION`. `automaticProjectorModeId` is one exact final 22-mode ID, never a base family. One candidate/projector/input identity has one accepted result. Exact replay returns
the committed result and IDs without new writes/audits; rollback leaves no accepted operation/result; restart
replay is durable.

`m02_system_identity_results` is immutable and has one row per accepted operation. Its required typed columns
are `id`, unique non-null `systemOperationId`, fixed `status=ACCEPTED`, `automaticProjectorModeId`,
`mutationPlanFingerprint`, `candidateId`,
`controllingJobId`, `sourceSnapshotId`, `identityDecisionId`, nullable `resourceIdentityId`, nullable
`resourceVersionIdentityId`, nullable `duplicateCandidateId`, nullable `handoffMarkerId`, exact byte-sorted typed created/reused/updated/
superseded target-ID arrays, plus exact typed arrays for tier-evaluation, signal, signal-evidence, conflict,
conflict-target and conflict-evidence child IDs, `finalCandidateState`, `finalReviewState`, `finalAcquisitionJobStatus`,
`finalM02JobStatus`, `finalM02Stage`, `acceptedAuditEventId`, and `acceptedAt`. Each target array is a typed PostgreSQL UUID array whose
subject table is fixed by its column name, not an unconstrained JSON list. S1–S5 and S9 require identity/version/
handoff; S7 requires only duplicateCandidateId among those nullable targets; S6/S8 prohibit all four; S10
requires identity/version and prohibits active handoff/duplicate. The result's typed IDs must equal the transaction's
postcondition and cannot be satisfied by a generic record or unconstrained JSON payload.

`finalCandidateState` is not a status alias: it is canonical typed state containing candidate status,
`identityOutcome`, nullable `resourceIdentityId`, nullable `resourceVersionIdentityId`, and `recordVersion`.
The system result validator equality-binds those fields to the persisted candidate, Decision, scalar IDs and
mode-specific created/reused arrays. For S3/S4/S9 it requires `identityOutcome=EXACT_REPEAT_REUSE`, non-null
identity/version IDs equal to the exact reused rows, and zero created identity/version IDs. A result or audit
claiming `EXISTING_RESOURCE_NEW_VERSION` without creating and attaching a new version is prohibited.

`SystemExpectedVersions` is the immutable server-owned analogue of, but never a substitute for, human
`CallerExpectedVersions`. The resolver performs current discovery, selects one projector, derives the complete
row/V2-guard requirement map, freezes that exact map and operation fingerprint, and only then allocates new-row
IDs. It cannot silently refresh the map within that logical operation. A fresh attempt whose required current
map has a changed key/null-positive classification terminates with `EXPECTED_VERSION_SET_INVALID`; a changed
positive integer terminates with `STALE_RECORD_VERSION`. The controlling resolver may begin a new logical system
operation from current durable state only after rerunning the complete Section 13 decision and only if it remains
automatically eligible. Human FIR-01 semantics are unchanged.

The system path uses PostgreSQL 17.6 `SERIALIZABLE` and exactly the following order:

1. derive `SystemIdentityReplayLocatorV1` from immutable pre-projector context and perform the read-only durable
   accepted-replay lookup; byte-equal hit returns the committed result, and otherwise processing continues;
2. pre-projector current-controller/cancellation checks, then optimistic deterministic/reconciled identity
   discovery and one exact 22-mode projector selection;
3. derive/freeze `IdentityDecisionInputV1`, full idempotency bytes/key, `SystemExpectedVersions`, V2 guards,
   `SystemIdentityOperationRequestV1` and `systemOperationFingerprint`; exact preflight succeeds;
4. perform the read-only durable full-system-idempotency lookup now that its exact key/payload exist; byte-equal
   hit must reference the same replay locator and returns the committed result, collision rejects, otherwise
   allocate `systemOperationId` and all other provisional parent/child/audit IDs, create immutable operation bytes and derive the
   complete canonical system mutation plan;
5. begin a Serializable transaction and claim system idempotency;
6. acquire the shared Section 15.5 advisory guards in byte order, then lock existing mutable rows in canonical
   `(tableName,primaryKey)` order;
7. locked reread, reproduce projector/plan, require byte equality, recheck the frozen expectation map, and
   revalidate current controlling job, cancellation, clarification, Decision and eligibility predicates;
8. perform canonical typed writes, guard version-1 inserts/positive increments, typed system result, exact
   audits and postconditions atomically; and
9. commit.

The three-total-attempt bound, full-transaction `40001` retry, carefully verified same-logical-identity `23505`,
fresh snapshot per attempt, transaction-level advisory-lock release, first-use guard rollback, and prohibition
on same-transaction post-wait snapshot refresh are identical to Sections 15.4–15.5. Any changed projector,
typed row, provenance, audit, result, handoff, J outcome or postcondition is `MUTATION_PLAN_CHANGED` and rolls
back. A stale/non-controlling/cancelled job produces no accepted system mutation and follows the existing owning
job failure/re-resolution path.

System and human projectors share the same Section 15.5 guard namespace and V2 bytes. S1 sets
`guardAnchorCandidateId=candidateId`. A system first-use null guard becomes version 1 and a later human command
must observe that exact positive key; a human-created version/link/observation later used by S2–S5 must yield the
same positive key to the system operation. No system-prefixed guard, alias, fabricated command ID, or adaptive
expectation refresh exists.

System accepted audit multiplicity is exact:

```text
1 SYSTEM_OPERATION_ACCEPTED audit for the system operation
+ 1 SUBJECT_CREATED audit for each created canonical domain row
+ 1 SUBJECT_UPDATED audit for each existing row updated without supersession
+ 1 SUBJECT_SUPERSEDED audit for each versioned mutable predecessor transitioned terminal
```

The system operation, system result, audit and guard rows are infrastructure and are excluded from every
`SUBJECT_CREATED` term; `SYSTEM_OPERATION_ACCEPTED` is the operation/result acceptance audit and never receives
a second subject audit. S6–S8 apply the same formula to their exact Decision/review/job/evidence creates/updates and have no identity,
version, source-association, relationship or handoff subjects. Replay creates no audit. Subject, before/after,
metadata and formula semantics are otherwise exactly Section 15.8.

Failed/preflight system attempts use append-only `m02_rejected_system_identity_audits`, never accepted
`m02_audit_events`. `SystemIdentityRejectionPhaseV1` is exactly `PRE_PROJECTOR`,
`POST_PROJECTOR_PRE_ALLOCATION`, or `TRANSACTION_ATTEMPT`. Every row retains canonical
`SystemIdentityRejectionContextV1` bytes and
`rejectionFingerprint = SHA-256(canonicalJson(SystemIdentityRejectionContextV1))`:

```text
SystemIdentityRejectionContextV1 = {
  schemaVersion: "1", phase, candidateId, controllingJobId, sourceSnapshotId, systemActorId,
  systemReplayLookupKey,
  errorCode, existingTargets:[{targetType,targetValue}],
  automaticProjectorModeIdOrNull, identityDecisionInputFingerprintOrNull,
  idempotencyScopeOrNull, idempotencyKeyOrNull, systemOperationFingerprintOrNull,
  attemptedSystemOperationIdOrNull
}
```

`SystemIdentityRejectionTargetTypeV1` is exactly `RESOURCE_CANDIDATE`, `REVIEW_STATE`,
`ACQUISITION_JOB`, `M02_JOB`, `IDENTITY_DECISION`, `HANDOFF`, `CLARIFICATION_REQUEST`,
`CONCURRENCY_GUARD`, `RESOURCE_IDENTITY`, `RESOURCE_VERSION`, `SOURCE_REPOSITORY`, `SOURCE_LINK`,
`OBSERVATION`, or `DUPLICATE_CANDIDATE`. `targetValue` is the typed row primary key, except
`CONCURRENCY_GUARD`, whose value is the canonical guard key. Targets sort by type then value and are bounded; an
untyped opaque existing-target list is invalid. At
`PRE_PROJECTOR`, cancellation/stale-controller checks may reject before exact projector selection, so mode,
Decision-input fingerprint, idempotency values, operation fingerprint and attempted operation ID are all null.
At `POST_PROJECTOR_PRE_ALLOCATION`, the exact projector, Decision-input/idempotency/request fingerprints are
frozen and non-null, but attempted operation ID is null. At `TRANSACTION_ATTEMPT`, all those fields and the
provisional attempted operation ID are non-null even though the operation row rolls back. A row violating these
phase/nullability implications is invalid.

`systemReplayLookupKey` is non-null in every phase and equals the byte-verified retained
`SystemIdentityReplayLocatorV1`; an accepted replay lookup always precedes rejected-attempt insertion and
therefore prevents a rejection row for an already accepted locator.

Required columns are `id`, `phase`, every context field above, retained canonical context bytes,
`rejectionFingerprint`, and `occurredAt`; `UNIQUE(rejectionFingerprint)` makes replay idempotent at every phase.
The attempted operation/result need not commit; the row has no accepted-result FK and implies no accepted
mutation. The rejected row is inserted only in a separate transaction after pre-projector/pre-allocation failure
or complete rollback; accepted-idempotency replay takes precedence and creates none. The closed errors are
`JOB_SUPERSEDED`, `CANCELLED`, `EXPECTED_VERSION_SET_INVALID`, `STALE_RECORD_VERSION`,
`MUTATION_PLAN_CHANGED`, `SERIALIZATION_RETRY_EXHAUSTED`, `FINGERPRINT_COLLISION`, and
`CONCURRENCY_GUARD_COLLISION`. Domain content/payload collision is accepted blocking S6 with
`CONTENT_FINGERPRINT_PAYLOAD_COLLISION`; infrastructure canonical hash/payload collision uses rejected
`FINGERPRINT_COLLISION`. Phase/error legality is closed: `PRE_PROJECTOR` permits only `JOB_SUPERSEDED` or
`CANCELLED`; `POST_PROJECTOR_PRE_ALLOCATION` permits only `EXPECTED_VERSION_SET_INVALID`,
`STALE_RECORD_VERSION`, or `FINGERPRINT_COLLISION`; `TRANSACTION_ATTEMPT` permits the complete set because
controller/expectation/fingerprint checks are repeated and additionally permits plan drift, retry exhaustion and
guard collision. Any addition requires a future approved contract.

A `SYSTEM_IDENTITY_OPERATION` may supersede only a prior controlling system-origin Decision under S9/S10. It
must never supersede a controlling `HUMAN_COMMAND` Decision. A human winner makes an in-flight system plan/
expectation/Decision recheck fail and fully roll back; fresh system discovery does not select S9/S10 against it.
Human commands may supersede system Decisions under the existing positive-version contracts.

## 16. Job and review state machine

M02 preserves the exact M01 `AcquisitionJobStatus` values: `ACTIVE`, `COMPLETED`, `FAILED`, `CANCELLED`, and
`OPERATOR_REVIEW_REQUIRED`. It extends only the stage sequence after the M01 stages:

```text
RECEIVED -> VALIDATING_SOURCE -> ACQUIRING_SOURCE -> INVENTORYING_SOURCE
         -> CLASSIFYING_REPOSITORY -> RESOLVING_IDENTITY
```

`FAILED_CLASSIFICATION` and `FAILED_IDENTITY` are existing failure codes, not job statuses. Durable M02 review
state is `NOT_REQUIRED`, `CLASSIFICATION_REVIEW_REQUIRED`, `IDENTITY_REVIEW_REQUIRED`,
`CLARIFICATION_REQUESTED`, `RESOLVED`, `REJECTED`, or `SUPERSEDED`. `SUPERSEDED` is terminal and is used only
for a historical review invalidated by a Section 15.6 topology replacement; job replacement does not rewrite a
predecessor job's retained review state.

Job supersession is an orthogonal durable state so the exact M01 status enum remains backward-compatible. The
closed `M02OperationScope` vocabulary is:

| Scope                 | Owned work and overlap rule                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `CLASSIFICATION`      | Deterministic/AI classification, reconciliation, roots, groups, and candidates; upstream of and therefore overlaps both scopes |
| `IDENTITY_RESOLUTION` | Identity decisions/relationships for one controlling classification; overlaps itself and any classification replacement        |
| `FULL_PIPELINE`       | Both M02 stages; overlaps every scope and has replacement precedence over both                                                 |

`ANALYSIS` is not an independent job scope; it is an immutable run within `CLASSIFICATION`. A new
`CLASSIFICATION` or `FULL_PIPELINE` controller supersedes every controlling identity job derived from the prior
classification. An `IDENTITY_RESOLUTION` replacement cannot supersede or run ahead of an active classification
controller and must bind its controlling classification decision ID. Precedence is `FULL_PIPELINE`, then
`CLASSIFICATION`, then `IDENTITY_RESOLUTION`; precedence resolves effective stage control, never authorization.

Every M02 job stores immutable `jobLineageId` inherited from the original M01 submission/job lineage,
`operationScope`, `supersessionState` (`CONTROLLING` or `SUPERSEDED`), nullable `supersededByJobId`, monotonic
`supersessionSequence`, controlling-classification decision ID when required, and
`jobScopeKey = SHA-256(canonicalJson({jobLineageId, operationScope}))`. A replacement may bind a different
completed M01 `SourceSnapshot`; using lineage rather than snapshot keeps the supersession chain continuous.

`REPLACE_M02_JOB` is the only replacement operation. Its canonical request requires command/request IDs,
`sourceJobId`, `operationScope`, optional replacement completed-snapshot ID,
replacement classification/identity/analysis policy and prompt versions, reason code, non-empty reason,
authenticated actor ID/role, complete Section 15 `expectedVersions`, idempotency key, and timestamp. Allowed
reason codes are `FAILED_STAGE_REPLACEMENT`, `RETRY_EXHAUSTED`, `NEW_SUPPORTED_SNAPSHOT`,
`POLICY_OR_METHODOLOGY_CHANGE`, and `ADMINISTRATIVE_CORRECTION`. The requested scope must equal the source
scope, except `FULL_PIPELINE` may replace either narrower scope and `CLASSIFICATION` may additionally supersede
dependent identity jobs.

Before command ID or replacement-job allocation, the server derives and retains the exact semantic input:

```text
JobReplacementInputV1 = {
  schemaVersion: "1", jobLineageId, sourceJobId, sourceOperationScope, requestedOperationScope,
  predecessorJobIds, sourceSnapshotId, replacementSourceSnapshotIdOrNull,
  classificationPolicyVersion, identityPolicyVersion, analysisPolicyVersion,
  parserProfileVersion, promptBundleVersion,
  analysisProviderAdapterIdOrNull, analysisModelIdOrNull, analysisMethodologyVersionOrNull,
  controllingClassificationDecisionIdOrNull
}
replacementInputFingerprint = SHA-256(canonicalJson(JobReplacementInputV1))
```

`predecessorJobIds` is the complete byte-sorted invalidated controller set. Nullable analysis fields are all
null for deterministic-only replacement input and otherwise equal the configured immutable analysis inputs.
Every version/ID is read from the authoritative source/replacement snapshot, policy, configuration or current
controller rows. Command/request/replacement/result/audit IDs, actor/role, reason code/text, timestamp,
idempotency, expected versions and runtime/provider noise are excluded because they do not change semantic
replacement input. Retained payload-byte equality is mandatory on hash match or `FINGERPRINT_COLLISION`.
Exactly these bytes determine completed-job input difference and S9/S10 methodology/policy eligibility; no
implementation-selected snapshot, prompt, model or analysis field may be added or omitted.

| Replacement action/source state                                                                | ADMIN | EDITOR | TECHNICAL_REVIEWER |
| ---------------------------------------------------------------------------------------------- | ----- | ------ | ------------------ |
| `FAILED` with `FAILED_STAGE_REPLACEMENT`, or `OPERATOR_REVIEW_REQUIRED` with `RETRY_EXHAUSTED` | Allow | Allow  | Allow              |
| `COMPLETED` job with a different supported snapshot or policy/methodology input                | Allow | Allow  | Deny               |
| Active, cancelled, or any job using `ADMINISTRATIVE_CORRECTION`                                | Allow | Deny   | Deny               |

The source must be current `CONTROLLING` and in the stated M01 status; a superseded source returns
`JOB_SUPERSEDED`. Replacing `COMPLETED` requires a byte-distinct snapshot/policy/analysis input fingerprint;
otherwise `REPLACEMENT_INPUT_UNCHANGED`. `NEW_SUPPORTED_SNAPSHOT` requires a completed safe M01 snapshot in the
same lineage. Administrative correction requires evidence and cannot restore unsafe evidence.

The command follows Section 15 authorization, canonical locking, per-attempt `SERIALIZABLE` transaction, retry,
and audit rules.
It positively versions and locks the source acquisition/M02 rows plus every controlling overlapping-scope
acquisition/M02 row. It locks `JOB_SCOPE_CONTROLLER(jobLineageId,operationScope)` for every invalidated scope and
`JOB_REPLACEMENT_INPUT(sourceJobId,requestedScope,replacementInputFingerprint)`. The input guard is `null` for a
new canonical replacement request; each controller guard is positive when its scope has a controller and null
only for a genuinely absent scope. The provisionally allocated replacement ID is neither a guard nor an
expected-version key. It participates in authoritative plan equality and expectation recheck through Section
15.4 step 12, but the replacement row is inserted only in the canonical write phase. PK/unique constraints
enforce its absence. A fresh retry reuses that ID only under the Section 15.3 same-create-set/same-plan rule.

The transaction creates replacement B at record version 1 and sequence `max + 1`, marks source A and every
invalidated downstream controller `SUPERSEDED`, writes one immutable `SUPERSEDED_BY` link and one predecessor
audit for each affected job, then makes B the sole effective controller under the precedence rules. One job has
at most one direct successor; chains are linear, sequence-increasing, self/cycle-free, and visible in full.

When retained `JobReplacementInputV1` changes methodology/prompt/model/policy for an already system-resolved
candidate, the
replacement result durably lists the predecessor system Decision and I/V chain plus the handoff that this
transaction superseded. That exact terminal handoff plus replacement edge/result is the sole S9/S10 provenance; no active
predecessor handoff is expected. A human-origin Decision or a handoff not superseded by this exact replacement
is ineligible.

For the replacement-era J aggregate, every locked sibling lacking a Decision plus active handoff both bound to
this effective replacement controller is unresolved even when its candidate/review row still says
`IDENTITY_RESOLVED`. A superseded predecessor handoff never satisfies the aggregate. S9 restores one sibling's
current-controller chain; only the transaction restoring the last required chain may select `JC`. S10 leaves
the sibling unresolved/blocking and therefore uses `JR`.

Idempotency scope is `(sourceJobId, operationScope, idempotencyKey)`. Repeating the identical canonical request
returns the original replacement result; reusing that tuple with a different reason, target, snapshot, policy,
or expected-version map returns `IDEMPOTENCY_KEY_REUSED`. A conflict follows Section 15 retry rules and writes no
job/link/audit mutation.

Only the effective controlling job may write current candidate/group/decision state or M03 handoff markers. A
superseded job retains its original M01 status, stages, immutable results, evidence, failures, and audit history
for queries, but its results are historical/non-controlling, handoff markers are ignored, retry/cancel/
resolution commands return `JOB_SUPERSEDED`, and stale workers fail before every write. Operators see the full
chain, scope, controller, supersession reason/actor/time, input changes, and every candidate result disposition.

| Event/outcome                                              | Job status/stage and durable result                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Skill-bearing class, all identities resolved               | `COMPLETED`; stage `RESOLVING_IDENTITY`; ready set contains every non-rejected candidate                                 |
| `NON_SKILL`                                                | `COMPLETED`; stage `CLASSIFYING_REPOSITORY`; zero candidates; explicit reason                                            |
| `UNSUPPORTED`                                              | `COMPLETED`; classification terminal; zero candidates; unsupported reason; not M03-ready                                 |
| Classification ambiguity                                   | `OPERATOR_REVIEW_REQUIRED`; classification review visible                                                                |
| Identity ambiguity                                         | `OPERATOR_REVIEW_REQUIRED`; all unresolved candidates visible                                                            |
| Candidate rejection                                        | Candidate `REJECTED`; aggregate freshly derived from the locked sibling set; evidence retained                            |
| Superseding decision                                       | Prior decision retained; new decision controls; stale work rejected                                                      |
| Replacement job supersedes controlling job                 | Prior job keeps M01 status/results but `supersessionState` becomes `SUPERSEDED`; successor alone controls writes/handoff |
| Mixed candidate outcomes                                   | `OPERATOR_REVIEW_REQUIRED` while any candidate unresolved; resolved/rejected siblings remain visible                     |
| All candidates resolved or rejected, at least one resolved | `COMPLETED`; only resolved candidates in M03-ready set                                                                   |
| All candidates rejected                                    | `COMPLETED`; empty M03-ready set and explicit rejected aggregate                                                         |
| Retryable stage failure below limit                        | `FAILED` with stage failure code; retry reuses immutable outputs                                                         |
| Retry exhaustion                                           | `OPERATOR_REVIEW_REQUIRED`; partial evidence retained                                                                    |
| Non-retryable classification/identity failure              | `FAILED` with exact stage failure code; partial evidence retained                                                        |
| Cancellation at any boundary                               | `CANCELLED`; no later writes or M03 marker                                                                               |

Cancellation is checked before and after the fake-provider call and before every write. Cancellation after a
completed analysis retains that immutable run but prohibits reconciliation writes. Retries key immutable stage
outputs by snapshot and analysis fingerprint. Partial failure never rolls back completed evidence. Aggregate
success cannot hide an unresolved sibling. Only a candidate with current `IDENTITY_RESOLVED`, exactly one
identity/version attachment, no active review, and an explicit handoff marker may enter M03. M03 stages do not
exist in M02.

## 17. Persistence and migration contract

When implementation is separately authorized, one forward-only migration after
`001_m01_acquisition_jobs.sql` must work from zero and from M01. Package/adapter placement is an implementation
choice only; the following behavior is fixed.

| Record/table                             | Required constraints                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `repository_candidate_groups`            | Unique active group key; immutable fingerprint; `ACTIVE/SUPERSEDED`, version, backward/forward replacement FKs from Section 15.6 |
| `repository_group_relationships`         | Ordered `INCLUDES`/`BUNDLES`; unique group/type/order/child                    |
| `repository_classification_runs`         | Immutable; snapshot, source, class, policies, fingerprints, supersession       |
| `classification_evidence_references`     | Snapshot/entry/document FKs; unique ordered reference per run                  |
| `analysis_runs`                          | Provider-neutral provenance, bounded metrics/status, immutable fingerprints    |
| `candidate_roots` / `candidate_root_ownership` | Root has unique key, `ACTIVE/SUPERSEDED`, version and replacement FKs; ownership is immutable owned/shared/excluded history |
| `repository_candidate_root_order`        | Immutable group/run/root/zero-based ordinal; unique group/ordinal and group/root |
| `m02_root_replacements` / `m02_candidate_replacements` | Nullable-endpoint CREATED/RETIRED rules; pairwise split/merge/override lineage; command/result/audit FKs |
| `m02_ownership_replacements` / `m02_group_edge_replacements` | Complete null-safe predecessor/successor mapping for retained/reassigned/created/retired facts |
| `resource_candidates`                    | Unique candidate idempotency key; exact Section 12.1 states, optimistic version, nullable identity and topology replacement linkage |
| `external_identifiers`                   | Canonical key payload/hash, scoped uniqueness, provenance/review/supersession  |
| `resource_identities`                    | Stable opaque identity shell; non-null immutable `guard_anchor_candidate_id` FK to its creation candidate; reliable-token provenance invariant |
| `resource_version_identities`            | Unique Resource/content key and exact canonical-payload collision check        |
| `resource_version_observations`          | Unique version/snapshot/root/source link; immutable revision                   |
| `source_repository_identities`           | Unique provider/repository identity; canonical URL history                     |
| `resource_source_links`                  | Source repository/root to exact version; one active delivery binding           |
| `duplicate_candidates`                   | Candidate/exact target; S7 PROPOSED under candidate-set/pair proposal guards; every human P1 resolver reads the complete zero-or-one active proposal and supersedes it when present; MARK_DUPLICATE FIRST keeps confirmed pair/disposition null before confirmation; one active proposal-or-disposition lineage |
| `fork_relationships`                     | Version B to version A; distinct Resources; one origin; no self/cycle          |
| `source_repository_relationships`        | Repository mirror to origin; one origin; no self/cycle                         |
| `identity_decisions` plus all six Section 15.11 normalized child tables | Immutable seven-value `IdentityOutcomeV1`, including `EXACT_REPEAT_REUSE`; outcome/signals/source; server UUID + parent/ordinal natural uniqueness; closed signal/target/conflict enums; exactly-one typed target FK; exact six-tier sequence; typed evidence joins; child result arrays and one creation audit per row; Section 14 origin XOR; exactly one active Decision via supersession |
| `m02_candidate_rejection_decisions`      | Typed rejection Decision, complete candidate/job/run/snapshot/evidence/actor/audit lineage; one active per candidate |
| `m02_clarification_requests`             | Three target FKs/XOR; controllingJobId index; OPEN/RESOLVED/SUPERSEDED state/version; resolution/superseded-by linkage; review/job/snapshot/actor/result/audit lineage; one open logical question |
| `manual_resolution_commands` / `m02_manual_command_results` | Unique idempotency claim; immutable canonical request/request fingerprint and retained or reproducibly bound caller `expectedVersions` bytes; immutable mutation-plan fingerprint; no accepted result from substituted expectations; one typed result with nullable closed identity outcome/scalars and canonical created/reused/updated/superseded target arrays; exact human writer outcome/I/V equality, including A2/A3 `EXACT_REPEAT_REUSE` |
| `m02_system_identity_operations` / `m02_system_identity_results` | Exact 22-mode enum; unique retained `SystemIdentityReplayLocatorV1`; retained canonical Decision-input/request bytes/fingerprints; nullable analysis-run provenance; frozen expectations; accepted typed parent/child result arrays/postconditions |
| `m02_rejected_system_identity_audits`    | Section 15.11 phase enum/nullability, retained canonical rejection context/fingerprint, typed bounded targets, closed errors/uniqueness; no accepted-result implication |
| `m02_review_states`                      | Exact Section 16 vocabulary, guarded version transitions, terminal reason and topology replacement linkage |
| `acquisition_jobs` / `m02_jobs`          | Complete replacement rows; lineage/scope/controller state; retained canonical `JobReplacementInputV1` bytes/fingerprint; current-controller aggregate inputs |
| `m02_audit_events`                       | Section 15.8 human/system origin XOR, direct columns, closed actions/subject types/metadata, nullable immutable-row version/state values; immutable and append-only |
| `m02_job_supersessions`                  | Lineage/scope precedence; linear controlling chain; immutable successor/audit  |
| `m02_concurrency_guards`                 | Canonical lifecycle-stable V2 anchor payload and key collision check; no identity/version opaque ID or creation-state tag in hashed payload; no post-request UUID directly/indirectly in payload/key; advisory-lockable absence without synthetic/placeholder/sentinel/zero/preseed rows; null remains physically absent through locked reproduction/recheck and inserts version 1 only in the write phase; positive N uses the same lifetime key and updates only in the write phase; uniqueness/serialization abort and rollback |
| `m02_identity_handoff_markers`            | Candidate/identity/version/controller/snapshot/decision/audit FKs plus human-result/system-result XOR; logical key, active/superseded lineage and version |

Foreign keys use restrictive deletion. Enums/check constraints match this specification. Reasons and identity
tokens are bounded and non-empty when required. Canonical identity fields are columns, not unconstrained JSON;
versioned bounded JSON is allowed only for ordered extension codes. State, command result, decision,
relationship, audit, and aggregate job changes are transactional. Migration tests must reject invalid FKs,
duplicate active links, collisions, incomplete expected-version maps, stale/phantom writes, destructive
deletes, self/cyclic fork or mirror lineage, duplicate targets that are not exact versions, invalid mirror
source/version delivery bindings, identifier canonicalization/scope collisions, concurrent first-use guard
creation, non-linear/overlapping job supersession, unauthorized replacement, and bypassed authorization.
Correction uses a reviewed forward migration, never destructive rollback.

The canonical migration contract additionally requires:

- `resource_identities.guard_anchor_candidate_id` is non-null,
  references the candidate that originally created the shell, is immutable after creation, is available to
  optimistic command discovery, and remains unchanged across later Decisions, attachments, corrections and
  supersessions. A zero/M01 migration creates conforming anchors transactionally; any pre-existing M02 identity
  without a provable persisted creation anchor fails migration/verification explicitly rather than receiving an
  invented value;
- `resource_version_identities` reconstructs its V2 guard ref exactly from the parent identity anchor plus
  `candidate_content_fingerprint`; any stored derived ref/hash must be byte-reproducible and cannot become an
  independent authority;
- `m02_concurrency_guards` stores byte-exact Section 15.3.1 V2 anchor refs independently from final typed FKs,
  rejects future-UUID injection and canonical payload collisions, contains no planned/existing lifecycle tag,
  and never migrates, promotes, aliases, renames, duplicates, or falls back between guard keys after domain-row
  creation;
- final domain rows continue to use normal typed FKs to server-resolved/allocated IDs; server final-ID allocation
  is independent from caller expectation bytes, and no two-phase command-draft table/token is authorized;
- every authoritative new row type in Sections 15.6–15.9 has a typed table and server-controlled primary key;
- `m02_system_identity_operations` and `m02_system_identity_results` implement the immutable Section 15.11
  operation, exact 22-mode projector identity, retained canonical input/request payloads and fingerprints,
  pre-projector replay-locator bytes/key/uniqueness, nullable analysis provenance, canonical idempotency, frozen `SystemExpectedVersions`, accepted result and typed
  postconditions; `m02_rejected_system_identity_audits` implements only the closed failed-attempt contract;
  neither a manual command row nor a generic ledger may impersonate them;
- every mutable row named in a positive expected-version check has a guarded positive `record_version`;
- group/root controls implement only `ACTIVE/SUPERSEDED`; candidates and reviews implement their exact existing
  vocabularies and Section 15.6 transition checks, including topology replacement linkage and terminal reason;
- immutable run, ownership, observation, decision, human command/result, system operation/result, audit, and supersession payloads are
  append-only; correction changes only explicitly mutable state/version columns and inserts replacement rows;
- every ordered topology membership is represented by typed FK rows (including root order and shared ownership),
  not only a JSON array; bounded JSON code arrays never replace identity, provenance, or relationship columns;
- source links, observations, clarification requests, rejection Decisions, topology mappings, and job
  supersessions have mandatory command/result/audit and snapshot/controller lineage specified in Sections
  15.6–15.9; system-created identity rows use the mandatory system operation/result/audit lineage in Section
  15.11; handoffs enforce the Section 14 human-result/system-result XOR;
- clarification constraints enforce the three-target XOR, target-specific candidate/group rule, lineage equality,
  guarded terminal transitions, no `CANCELLED` state, an indexed `controllingJobId`, and the exact predecessor-job
  selection plus resolution/superseded-by fields in Section 15.7;
- audit columns and constraints implement the human-command/system-operation origin XOR, direct canonical mapping, exact before/after semantics, closed
  metadata keys and mapping subject types, nullable immutable-row version/state semantics, replay behavior, and
  applicable multiplicity formula in Sections 15.8 and 15.11;
- system audit constraints enforce requestId/mode reason equality, canonical tier-sequence metadata, exactly one
  SYSTEM_OPERATION_ACCEPTED, zero operation/result subject audits, and the accepted-versus-rejected audit split;
- S7 persists a typed `DuplicateCandidate(status=PROPOSED)` with exact target-version/proposal-pair guards and never a
  confirmed disposition, identity attachment or handoff;
- S7 uses only proposal-set/pair guards; every human P1 resolver canonically binds zero-or-one active proposal,
  increments its set/pair guards and supersedes it when present; confirmed disposition/relationship-pair guards
  remain null until MARK_DUPLICATE, so proposal provenance neither collides with nor survives human resolution;
- system Decision precedence permits S9/S10 to supersede only a controlling system-origin Decision and rejects
  any attempt to supersede a human-origin Decision;
- `IdentityDecisionInputV1` uses exact classification input/output and AnalysisRun request/response fingerprint
  columns; real-granularity closed signal, target-type and conflict-code enums; typed target XOR; and exactly six
  evaluated-tier records with canonical `NOT_APPLICABLE`; S8 has an exact provider-declared-fork signal;
  undefined aggregate run fingerprints are prohibited;
- system Decision tier/signal/signal-evidence/conflict/conflict-target/conflict-evidence children use the exact
  Section 15.11 UUID/natural keys, typed FKs, result arrays and one-row/one-audit treatment; they are never hidden
  JSON or unaudited aggregate internals;
- S9/S10 require the exact predecessor handoff already superseded by their current `REPLACE_M02_JOB` result/edge
  and retained `JobReplacementInputV1`; replacement J resolution requires each sibling's complete
  current-controller Decision/handoff chain;
- rejected-system rows use the exact phase-aware rejection context/fingerprint: pre-projector fields are
  explicitly null, post-projector fields are frozen with null attempted ID, and transaction-attempt rows include
  the rolled-back provisional ID;
- active uniqueness scopes match every Section 15.5 guard, including topology, relationship pair/lineage,
  clarification, rejection, handoff, source-link/observation, and overlapping job controller; old relationship
  pairs/source active sets are positive while absent new pairs/observations use null allocation-independent
  natural guards;
- system and human mutations share the same lifecycle-stable V2 guard rows, payload bytes, advisory-lock order,
  null-to-version-1-to-positive continuity and collision checks; no origin-prefixed alias or independent guard
  namespace is permitted;
- system source-repository first use uses the shared `SOURCE_REPOSITORY(repositoryRef:SourceRepositoryGuardRefV1)` natural
  guard: R0 is physically absent/null until write-phase repository plus version-1 guard insertion, and R1 is the
  byte-identical positive lifetime key; repository upsert without this expectation is prohibited;
- `REPLACE_M02_JOB` uses only `JOB_SCOPE_CONTROLLER` and `JOB_REPLACEMENT_INPUT` natural conflict guards; the
  latter hashes retained canonical `JobReplacementInputV1` bytes, and the random replacement ID is prohibited
  from expected-version and logical-guard keys;
- one replacement job consists of a complete `acquisition_jobs` row and its controlling `m02_jobs` row, and
  every affected predecessor has a distinct supersession edge and distinct audit FK;
- the database rejects a generic ledger write as satisfaction of a typed FK/postcondition; a generic command-
  domain table, if retained, has no authority to drive canonical reads or meet an acceptance criterion.

Before implementation resumes, migration 002 MUST be reviewed and amended in a separately authorized task.
Its current form is not presumed conforming: in particular the amended contract requires typed clarification
requests, typed rejection Decisions, typed command results, complete handoff provenance, complete topology
membership/order, and command/result/audit lineage that the implementation must prove column by column. This
specification amendment neither writes SQL nor authorizes migration changes.

## 18. ClassificationAnalysisPolicy v1 hard limits

Required defaults equal hard ceilings; an implementation may lower them only under a new policy version.

| Dimension                         |      v1 default and hard ceiling |
| --------------------------------- | -------------------------------: |
| File-tree entries                 |                           10,000 |
| Candidate roots                   |                               64 |
| Evidence references               |      512 total; 32 per candidate |
| Excerpts                          |       128 total; 8 per candidate |
| UTF-8 bytes per excerpt           |                            4,096 |
| Unicode scalar values per excerpt |                            4,096 |
| Total serialized request bytes    |                        1,048,576 |
| Estimated input tokens            |                          200,000 |
| Serialized response bytes         |                          262,144 |
| Warning codes                     |                              128 |
| Ambiguity reason codes            |                               64 |
| Repair attempts                   |                                1 |
| Provider attempts                 | 2 total, including first attempt |
| Per-attempt timeout               |                        30,000 ms |
| Total operation timeout           |                        60,000 ms |

Evidence references and excerpts are separate bounded collections. A valid evidence reference may have no
excerpt. Excerpts are an optional subset keyed to retained evidence references; their absence never deletes or
invalidates the reference. The independent ceilings remain 512 total evidence references, 32 evidence
references per candidate, 128 total excerpts, and 8 excerpts per candidate.

File-tree records and evidence are sorted before truncation. Evidence-preserving truncation retains all
positive declarations, conflicts, unavailable-evidence markers, and every reference used by a proposed result;
then fills remaining capacity in canonical order. Excerpts truncate only at a Unicode scalar boundary and
record original hash/size, retained size, and `TRUNCATED` warning. If mandatory evidence cannot fit, candidate
roots exceed the ceiling, response exceeds limits, or truncation could change `UNSUPPORTED`, `AMBIGUOUS`, or
Skill/non-Skill disposition, the result is `UNSUPPORTED`/`LIMIT_EXCEEDED`; it never becomes a definitive class.
No omitted evidence reference may support an output. Exact-boundary input is accepted; one-unit-over input
follows these fail-closed rules. Repair cannot add evidence or expand limits.

## 19. Security and governance invariants

- No checkout, source execution, interpreter, shell, subprocess, binary, hook, container, package manager,
  dynamic import/evaluation, or arbitrary network access.
- Acquired content remains labelled bounded untrusted data; source instructions have no authority.
- AI receives no tools and cannot mutate records or authorize review/publication.
- Secrets, participant identity, unrestricted bodies, and credentials are excluded from payloads/logs.
- Every new boundary has negative tests and remains covered by the source-safety scanner.
- Required gates are deterministic and offline after dependency installation.
- Fixture, live-provider, and real-user evidence are never represented as interchangeable.

## 20. Fixture matrix

The synthetic offline manifest must include fixed expected fingerprints, records, decisions, and audit states:

| Fixture ID                         | Required scenario/evidence                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `F01-single-root`                  | Exact algorithm yields `SINGLE_SKILL`                                                                 |
| `F02-multiple`                     | Ordered independent roots and `MULTIPLE_SKILLS`                                                       |
| `F03-collection`                   | Exact collection index, `INCLUDES`, group context survives candidates                                 |
| `F04-skill-app`                    | Application predicate, `BUNDLES`, application context retained                                        |
| `F05-non-skill`                    | No positive signal, durable zero-candidate completion                                                 |
| `F06-ambiguous-overlap`            | Parent/child ownership blocks both                                                                    |
| `F07-unsupported`                  | Missing/unsafe evidence and prohibited override                                                       |
| `F08-example-only`                 | Excluded `SKILL.md` creates no candidate                                                              |
| `F09-same-content-roots`           | Different roots, same content fingerprint, distinct root/candidate IDs                                |
| `F10-same-content-repositories`    | Same content fingerprint, distinct source candidates                                                  |
| `F11-shared-root-files`            | Nested roots plus root shared file; deterministic ownership                                           |
| `F12-reordered-input`              | Identical fingerprints/ordering                                                                       |
| `F13-overlap-change`               | Ownership/topology change changes root fingerprint                                                    |
| `F14-shared-change`                | Shared file content change changes content fingerprint                                                |
| `F15-methodology-only`             | Superseding decision/run; no duplicate candidate/version                                              |
| `F16-same-content-new-snapshot`    | Observation added; version reused                                                                     |
| `F17-changed-source`               | Exact continuity and new version shell                                                                |
| `F18-identity-matrix`              | Every Section 13 row, precedence, contradiction, multi-match                                          |
| `F19-minimum-shells`               | Required shell fields and M03 promotion mapping; no placeholders                                      |
| `F20-duplicate-no-source-resource` | Candidate-to-mandatory-target-version duplicate; no source identity                                   |
| `F21-independent-fork`             | New version B points to exact origin version A with directed `FORK_OF`                                |
| `F22-mirror`                       | Mirror repository points to origin; delivery targets existing version                                 |
| `F23-relationship-correction`      | Wrong target superseded; endpoint uniqueness/cycles rejected                                          |
| `F24-command-roles`                | Every allow/deny matrix cell, prohibited transition, and exact human Decision-writer outcome/I/V mapping |
| `F25-mixed-job`                    | Resolved, rejected, ambiguous siblings; aggregate remains review                                      |
| `F26-stale-worker`                 | Human/cancellation decision cannot be overwritten                                                     |
| `F27-partial-failure`              | Completed evidence retained without partial identity write                                            |
| `F28-limits`                       | Every exact boundary accepted and every one-over case fails closed                                    |
| `F29-collision`                    | Same hash/different canonical payload blocks reuse                                                    |
| `F30-hostile-source`               | Prompt injection/invented reference/tool request inert and rejected                                   |
| `F31-parser-profile`               | YAML/CommonMark/token conformance and every forbidden construct                                       |
| `F32-bounded-input-fingerprint`    | Golden canonical payload; reordered input equal; one-field change differs                             |
| `F33-external-identifiers`         | GitHub namespace/issuer golden normalization, trusted match, collision, and cross-namespace reuse     |
| `F34-command-concurrency`          | Null first-use to version 1, integer update, lock order, stale/phantom, competing creator, and exact outcome/I/V plan stability |
| `F35-job-supersession`             | Scope precedence, role/state matrix, idempotent A-to-B replacement, stale worker, and visible history |
| `F36-lock-categories`              | Winner G0–G5; fixed-snapshot loser rollback/fresh retry; immutable caller-vs-required expectation preflight; same-idempotency replay; different-idempotency null-to-positive invalidation; positive N-to-N+1 stale rejection; unchanged-map retry; exactly one version-1 guard; plan-drift boundary |
| `F37-mode-expansion`               | Golden enumeration of all 256 P/K/J/A/M/T/Z expansions and positive/null guard sets                  |
| `F38-topology-control`             | Every per-table split/merge/override state, immutable fact, mapping, and ownership-history rule       |
| `F39-replacement-clarifications`   | Z0, one/multiple predecessor-controlled OPEN rows, and non-predecessor row unchanged                  |
| `F40-audit-multiplicity`           | Split/merge mapping audits plus immutable-create, mutable-create/update/supersede audit semantics     |
| `F41-server-id-independent-guards` | GID-01–GID-11: pre-allocation/future-ID independence, V2 identity/version/observation/fork continuity, cross-candidate original-anchor reuse, lifecycle-tag exclusion, and complete 256-mode lifetime scan |
| `F42-system-identity-projection` | All exact 22 modes; universal P1 S7-proposal cleanup; canonical replacement input/current-controller aggregate; pre-projector replay locator and post-freeze full idempotency lookup; exact audited Decision children; S8 provider-fork signal; conditional AnalysisRun; closed input/rejection/audit/precedence/shared-V2 retry on PostgreSQL 17.6 |

## 21. Required implementation test suites

- Unit: exact YAML/CommonMark/token parser profile, predicates/class derivation, ownership/order, canonical
  bounded-input/fingerprint golden vectors, limit boundaries, reconciliation, scoped external identifiers,
  identity matrix, version reuse, relationship endpoints, and aggregate/job-supersession transitions.
- Contract: all schemas/enums, provider-neutral analysis, shell-to-canonical promotion mapping, relationship
  endpoint/FK/direction contracts, persistence, complete expected-version maps, authorization/idempotency/
  conflicts/audit, job supersession, and M00/M01 backward compatibility.
- Integration/fixture: completed M01 snapshot through every Section 20 fixture, collection persistence, mixed
  outcomes, from-zero and M01-upgrade migrations.
- Adversarial: hostile source/parser constructs, forged references, unscoped/colliding external IDs,
  path/root/limit attacks, fingerprint collision, duplicate/fork/mirror endpoint and cycle attacks,
  stale/phantom/cancellation/supersession races, and attempted authority escalation.
- Concurrency/audit: competing workers/commands, incomplete expected-version maps, predicate phantoms, and
  replacement jobs produce one controlling canonical result; every accepted/rejected command, relationship
  correction, and supersession is complete and append-only.
- System identity projection: all 22 finite Section 13.1 modes and every Section 12.3/13 dispatch row use the typed
  Section 15.11 operation/result transaction, frozen `SystemExpectedVersions`, SYSTEM service principal, exact
  audits, Decision/handoff origin XOR, shared V2 guards, controlling-job transitions and no external invocation.
- Guard-ID independence: before allocating any new UUID, GID-01 derives `CREATE_RESOURCE`'s exact null guards and
  proves caller/required map equality; GID-02 proves first-fork V2 identity/version, lineage, pair and observation
  guards contain no allocated UUID; GID-03 proves A1 guard stability with an existing parent identity and V2
  version anchor; GID-04 proves M1 repository/source/observation natural refs; GID-05 rejects future-ID
  injection with `CALLER_CONTROLLED_ID_PROHIBITED`; and GID-06 scans all 256 expansions with zero future IDs.
  For GID-01–GID-04, two distinct hypothetical provisional UUID sets MUST yield byte-identical guard keys and
  expectation maps while producing different domain mutation IDs.
- Guard-lifecycle continuity: GID-07 derives CREATE's null `RESOURCE_VERSION` key before allocation, commits the
  identity/version and version-1 guard, then derives from the existing identity's `guardAnchorCandidateId` and
  requires byte-identical key plus positive version 1. GID-08 performs the same first-observation-to-A3 existing
  `OBSERVATION` key proof. GID-09 commits first-fork null lineage/pair guards, then requires correction to derive
  byte-identical positive old-lineage/old-pair keys from the existing fork version. GID-10 attaches a later
  candidate to an identity created by a different candidate and requires the original stored anchor, never the
  later candidate ID. GID-11 golden canonical guard bytes for identity/version endpoints contain no
  planned/existing lifecycle distinction. GID-07–GID-11 also prove null-to-version-1-to-positive continuity on
  one canonical payload with no key promotion, alias, rename, dual row, or fallback.

PostgreSQL 17.6 durable-adapter integration is mandatory. A production-shaped fixture must include a completed
M01 acquisition/snapshot with entries/documents, source repository, active group/run/root/ownership/candidate,
review and controlling acquisition/M02 job. For each of all twelve commands, tests assert the command/result/
audit rows and the exact Section 15.8 typed-table postcondition directly. The suite must separately prove:

1. all 256 executable Section 15.9 expansions, including P/K/J/A/M/T/Z dimensions, every attach/mirror reuse
   combination, first/correction, positive-present/null-absent handoff outcome, and single/multiple replacement
   predecessor count, with exact created, reused, updated, superseded, result, audit-subject, and final typed-row
   sets; all Decision-producing direct and ambiguity-dispatch modes assert the closed human outcome mapping,
   candidate/Decision/result/audit I/V equality, A1 exactly-one-created-version behavior, and A2/A3
   `EXACT_REPEAT_REUSE` with zero created/exact reused I/V arrays;
2. first-use natural-key `null` remains physically absent through advisory locking, typed-row locking, locked
   reread, plan reproduction/equality, expectation recheck, and invariant validation, then inserts exactly one
   version-1 typed guard only in the canonical write phase; an existing positive N guard is row-locked and reread
   at N and updates only in the write phase; random new-row IDs and synthetic/placeholder/sentinel/zero/preseed
   guards are rejected;
3. in two independent database sessions, A forms a provisional-null plan, starts a Serializable attempt, obtains
   the advisory lock, rereads absence, reproduces/rechecks null, inserts version 1, and commits. B may form a
   provisional-null plan and establish its own fixed snapshot before waiting for A's transaction-level advisory
   lock. After acquiring the lock, B is not required to see A's commit in that attempt; write-time uniqueness or
   SSI validation yields an approved retryable outcome and B rolls back completely. B restarts optimistic
   discovery, sees A's committed positive/present state, and derives positive X while B's immutable caller map
   still contains null X. B returns `EXPECTED_VERSION_SET_INVALID` before another transaction opens and never
   silently adopts X version 1. Exactly one domain mutation and one version-1 typed guard exist. A separate
   competing-positive-update case has caller N/current N+1 and returns `STALE_RECORD_VERSION` before another
   transaction, so the durable guard/domain version increments exactly once;
4. authoritative logical/advisory guard locking begins at step 7 without typed writes, existing typed-row locking
   begins only at step 8, and optimistic discovery followed by locked reproduction yields byte-identical plan
   bytes including null-versus-positive guard state. Any changed branch, affected row, guard state/version,
   provenance, audit, handoff, job effect, or postcondition returns `MUTATION_PLAN_CHANGED` before expectation
   recheck and with no accepted writes;
5. SQLSTATE `40001` and byte-equal same-logical-identity first-use `23505` outcomes are normalized to the bounded
   retry class, while unrelated uniqueness and payload collisions are not; the stale attempt releases
   transaction-level locks on rollback and fresh discovery derives a new required map. A forced `40001` whose
   caller-relevant map remains identical may consume the next attempt; a verified first-use `23505` whose map
   changes terminates stale. IDs are reused only after expectation equality and the same create set/plan identity.
   Injected failure after write-phase version-1 guard insertion but before result/audit leaves the guard absent and
   no domain/result/accepted-audit row; restart replay returns the same durable result and IDs without duplicate
   state;
6. same idempotency payload replays existing result/audits without a new audit; changed payload rejects with
   exactly one bounded rejected-attempt audit and no accepted-domain implication;
7. duplicate/fork/mirror correction positively guards its old pair and uses a null absent-new-pair guard, rejects
   an existing new pair, preserves prior payload, inserts the exact replacement, supersedes only permitted
   predecessor state/version/link/decision rows, and satisfies the exact Section 15.8 audit formula;
8. split/merge/override enforce every Section 15.6 per-table predecessor state, create complete group/run/root/
   order/ownership/candidate/edge graphs with fresh canonical hashes and pairwise lineage, leave immutable facts
   unchanged, keep ownership history queryable, and assert every mapping and audit FK;
9. clarification tests cover all three target FKs and XOR failures, K0/K1/K2 and T0/T1 guards, exact OPEN
   uniqueness, positive-version resolution/supersession, and terminal immutability; replacement separately covers
   Z0, one match, multiple matches, and a non-predecessor-controlled row that remains unchanged; rejection creates
   the typed rejection Decision and leaves no active handoff;
10. audit tests query every mandatory typed column, immutable-create null version/state, mutable-create version 1,
    update/supersession before/after semantics, one mapping-row creation audit per split/merge/created/retired
    mapping, closed metadata keys, exact formula-derived count/subjects for each expansion, and one predecessor
    audit per replaced job;
11. handoff can exist only with one resolved candidate/I/V/controller/snapshot/decision chain and is blocked or
   superseded for ambiguity, rejection, topology replacement, or stale/non-controlling job;
12. `REPLACE_M02_JOB` creates complete acquisition/M02 replacement rows, retains golden
    `JobReplacementInputV1` bytes/fingerprint, uses only natural controller/input guards, creates one edge and
    audit per predecessor, preserves handoff/controller history, leaves one controller, applies the complete
    current-controller Decision/handoff sibling aggregate, and rejects
    stale/non-controlling/unchanged-input/overlap conflicts; and
13. a generic-ledger-only assertion fails the test: every success is queried through canonical typed tables and
    validated against their FKs, uniqueness, versions, supersession, and append-only constraints; and
14. F41/GID-01–GID-11 prove pre-allocation constructibility, byte-identical guard/expectation maps across distinct
    provisional UUID sets, distinct domain mutation IDs, future-ID injection rejection, identity/version and
    observation/fork/pair lifetime continuity, cross-candidate original-anchor reuse, lifecycle-tag exclusion,
    and a complete all-256-expansion scan in which every persistent guard's first-use null key equals every later
    positive existing/reuse/correction key for the same protected set; and
15. F42 executes all 22 exact projector IDs and every Section 12.3/13 row directly on PostgreSQL 17.6, asserting
    the closed seven-value outcome vocabulary and exact mapping, including `EXACT_REPEAT_REUSE` candidate/
    Decision/result/audit equality with reused-not-created I/V for S3/S4/S9; S1/S4/S5 R0/R1×J, S2/S3×J,
    S6/S7/S8, S9×J and S10; every human P1 resolver with absent, matching and
    different active S7 proposal provenance/guard cleanup while counts stay unchanged; replacement-superseded predecessor handoff, golden
    replacement-input bytes and multi-sibling current-controller JC/JR progression to reachable S9/S10;
    conditional AnalysisRun; authoritative run fingerprint fields, real-granularity signal enum including exact
    S8 provider fork, typed targets,
    closed conflict enum and exact six-tier sequence; golden input/request fingerprints and provisional-ID
    independence; pre-projector replay after mutated state, post-freeze full-idempotency lookup, locator collision
    and new-controller separation; exact child-row IDs/ordinals/FKs/result arrays/audit counts/rollback/replay;
    all three rejected-attempt phases/nullability plus `MUTATION_PLAN_CHANGED`; canonical request/reason/tier metadata;
    rejected-system audit; exactly one acceptance audit and no subject audit for operation/result/audit/guard;
    exact typed operation/result/Decision/audit/handoff and domain postconditions; resolved `JC/JR`, blocking
    `JR`, same-operation replay, S9/S10 reanalysis, human-Decision blocking/system-to-human correction races,
    changed-input new-operation eligibility, rollback before accepted result,
    three-attempt retry limits, frozen-map mismatch termination, stale/cancelled/non-controlling job rejection,
    one shared guard version increment, and system-to-human plus human-to-system origin/guard continuity.

The concurrency suite additionally proves immutable canonical request/fingerprint/`expectedVersions` bytes across
all attempts; exact caller-versus-required preflight before the initial and every retry mutation transaction;
same-idempotency winner replay; different-idempotency null-to-positive invalidation; positive N-to-N+1 staleness;
unchanged-map `40001` retry; verified `23505` changed-map termination; no transaction after preflight mismatch; no
server-side expectation refresh; automatic transaction-lock release; and exactly one durable first-use mutation.
Only retries whose fresh maps remain exact may reach the three-attempt maximum and
`SERIALIZATION_RETRY_EXHAUSTED`. A lock wait never refreshes a transaction snapshot, and read-only retry preflight
does not consume or reset `attemptCount`.

No in-memory adapter, process-local map, process-local synchronization, generic JSON record, scenario registry,
or test count substitutes for these database assertions. Tests must inject a failure between canonical writes
and result/audit insertion and must use two real database sessions for concurrency evidence.

An empty or undiscovered suite is not a pass.

## 22. Acceptance criteria and traceability

| ID          | Criterion                                                                                                                                                                                                                       | Fixtures/tests and required evidence                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `M02-AC-01` | Parser-profile v1 plus the exact deterministic algorithm produces all seven classes without implementation-selected parsing or weights                                                                                          | F01–F08/F31; parser conformance plus unit/fixture class, root, token, and reason assertions                                                                      |
| `M02-AC-02` | Content, root, bounded-input, analysis, and idempotency fingerprints have complete canonical payloads, ordering, exclusions, and collision checks                                                                               | F09–F16/F29/F32; cross-implementation golden canonical bytes/hashes and mutation tests                                                                           |
| `M02-AC-03` | Same content across roots/repos remains content-equal but candidate-distinct                                                                                                                                                    | F09/F10; persistence uniqueness assertions                                                                                                                       |
| `M02-AC-04` | Ownership/shared rules are order-independent and fail closed on overlap                                                                                                                                                         | F06/F11–F14; unit/adversarial evidence                                                                                                                           |
| `M02-AC-05` | Same-content new observation uses S3 with `EXACT_REPEAT_REUSE` and without duplicating a version; canonical replacement-input methodology change uses S9 with `EXACT_REPEAT_REUSE` to supersede the system Decision and create a new-controller handoff at the same I/V, or S10 to block; replacement-era JC requires every sibling's current-controller chain; never replay/auto-reattach | F15/F16/F42; exact-reuse S3/S9 outcome/candidate/result/audit binding, golden replacement input, multi-sibling reachable S9/S10, Decision/handoff lineage, integration/concurrency counts |
| `M02-AC-06` | Canonical shell minimum fields and M03 promotion mapping contain no invented public values                                                                                                                                      | F19; schema/contract tests                                                                                                                                       |
| `M02-AC-07` | Identity precedence uses canonical trusted external IDs; S4 exact-content branches emit `EXACT_REPEAT_REUSE`, S5 changed-content branches emit `EXISTING_RESOURCE_NEW_VERSION`, both dispatch exact R0/R1 branches, and ambiguity blocks; all 22 modes bind the closed seven-value outcome vocabulary, candidate/result/audit equality, conditional AnalysisRun and canonical `IdentityDecisionInputV1` with authoritative run fields, real-granularity signals including S8 provider fork, typed targets, closed conflicts, exactly six tiers and exact audited child rows | F18/F33/F42; exact outcome mapping and same-I/V reuse, normalization/scope/provenance/domain-vs-infrastructure collision, R branches, S8 signal, nullable analysis, child persistence/audits, golden input bytes and blocking tests |
| `M02-AC-08` | A duplicate candidate may lack a source Resource but targets one exact existing version; S7 creates typed PROPOSED only under candidate-set/pair proposal guards, with no confirmation/merge/attachment/handoff; every human P1 resolver canonically supersedes zero-or-one active proposal, and MARK_DUPLICATE confirmed guards start null | F20/F42; every resolver with proposal-absent/matching/different FK/set/pair guards, mandatory-target, disposition and history tests |
| `M02-AC-09` | Fork is version-B-to-version-A and mirror is source-repository-to-source-repository with exact target-version delivery binding                                                                                                  | F21/F22; endpoint/FK/direction/postcondition integration tests                                                                                                   |
| `M02-AC-10` | All 48 direct relationship expansions project exact typed state; universal P1 proposal cleanup adds no mode, MARK_DUPLICATE FIRST starts confirmed disposition/pair null, and no non-duplicate resolution strands an active proposal; correction, endpoint, audit/history and generic-ledger prohibitions remain exact | F20–F23/F42; cross-writer proposal cleanup, confirmation, typed FK/direction/first/correction/K/J/audit/rollback/replay/concurrency assertions |
| `M02-AC-11` | All nine split/merge/override expansions enforce the Section 15.6 per-table state matrix and persist complete typed group/run/root/order/ownership/candidate/edge graphs with fresh fingerprints, immutable facts, pairwise lineage, and one audit per mapping row | F03/F04 plus all topology K expansions; PostgreSQL state/FK/fingerprint/order/pair-mapping/history/audit assertions |
| `M02-AC-12` | All 256 modes derive the complete caller-authorized guard/expectation set and exact human Decision-writer outcome/I/V projection before future-ID allocation, using lifecycle-stable V2 anchors, one immutable caller request/`CallerExpectedVersions` map per logical command and fresh server `RequiredCurrentExpectations` per attempt. A1 is new-version and A2/A3 are `EXACT_REPEAT_REUSE`; ambiguity dispatch is byte-identical. Every persistent guard proves first-use null to version 1 to later positive N continuity on one byte-identical key/payload reconstructed from immutable anchors; domain/provisional UUIDs, creation state, retry, reuse and correction cannot change it. Exact key/null-positive/positive-integer equality is required before every mutation transaction and before new-row allocation; no substitution is allowed. Same-idempotency accepted replay takes precedence; key/classification mismatch is `EXPECTED_VERSION_SET_INVALID`, positive integer mismatch is `STALE_RECORD_VERSION`. Each attempt remains one fixed-snapshot Serializable transaction, with at most three attempts and unchanged FIR-01/FAR-01 retry semantics | F24/F34/F36/F41; every expansion and exact outcome/I/V mapping plus GID-01–GID-11, two provisional UUID sets, V2 anchor reconstruction, lifecycle continuity, immutable request bytes, initial/retry preflight, same-idempotency replay, different-idempotency null-to-positive rejection, N-to-N+1 rejection, unchanged-map `40001`, careful `23505`, attempt accounting, plan-change boundary, rollback and exactly-one-mutation tests |
| `M02-AC-13` | `UNSUPPORTED` cannot be overridden or restore unavailable evidence                                                                                                                                                              | F07; adversarial rejected-command/audit evidence                                                                                                                 |
| `M02-AC-14` | All four `REPLACE_M02_JOB` predecessor/Z expansions retain canonical `JobReplacementInputV1`, use only controller/input guards, positively version every predecessor and selected handoff/clarification, project complete typed replacement rows and one edge/audit per predecessor, preserve M01 history, leave outside-predecessor clarifications unchanged, and leave exactly one authorized controller | F05/F07/F25–F27/F35/F42; golden input/hash, PostgreSQL Z0/one/multiple/outside-set, natural-guard, random-ID rejection, overlap, role/state/reason, replay, stale-controller, per-predecessor history assertions |
| `M02-AC-15` | Every 256 human and 22 system modes declares exact handoff effect; replacement already supersedes predecessor handoff, replacement-era resolution requires every sibling's current-controller chain, S9 creates its new handoff and S10 leaves none; result-origin XOR and human precedence hold | F18/F25/F42; every branch, multi-sibling replacement-to-reanalysis progression, origin-XOR, positive/null, precedence/stale tests |
| `M02-AC-16` | Analysis provenance is provider-neutral, complete, bounded, and offline                                                                                                                                                         | F28/F30; analysis contract/no-network tests                                                                                                                      |
| `M02-AC-17` | Every exact AI policy boundary passes and every one-over case fails closed without silent class change                                                                                                                          | F28; parameterized boundary/adversarial tests                                                                                                                    |
| `M02-AC-18` | Migration implements prior constraints plus the exact seven-value `IdentityOutcomeV1` and 22-mode enum; system and human candidate/Decision/result/audit outcome and I/V equality, including A1 new-version and A2/A3 exact-repeat constraints; proposal-set/pair/shared guards; replay locator plus full idempotency; phase-aware rejection; retained canonical Decision/replacement payloads; exact typed Decision children/results/audits; nullable AnalysisRun; universal P1 proposal cleanup; current-controller S9/S10 aggregate; precedence/handoff XOR; generic JSON is insufficient | F20–F24/F29/F33–F36/F41/F42; zero/M01 schema, direct/ambiguity-dispatch exact-repeat positive/negative constraints, golden bytes/collision, replay order, child rows/audits, phase sequencing, cross-writer proposal cleanup, replacement reachability, origin/precedence, rollback/concurrency PostgreSQL tests |
| `M02-AC-19` | M00/M01 contracts, tests, source safety, and cancellation remain intact                                                                                                                                                         | Full regression commands and counts                                                                                                                              |
| `M02-AC-20` | Authority documents remain byte-identical and formatter-excluded                                                                                                                                                                | Four `cmp`/SHA-256 pairs, file-info, Git diff                                                                                                                    |
| `M02-AC-21` | No M03 semantics, publication, UI, live provider, or execution path exists                                                                                                                                                      | Whole-worktree diff and source-safety review                                                                                                                     |
| `M02-AC-22` | All gates pass offline with direct PostgreSQL 17.6 evidence for 256 human and 22 system modes, the exact seven outcomes, every human Decision writer and ambiguity dispatch, A1 new-version, A2/A3 and S3/S4/S9 `EXACT_REPEAT_REUSE` persistence/audit projection, every F41/F42 case, pre-projector accepted replay, fully canonical Decision/replacement inputs and child rows, provisional-ID independence, all rejection phases, conditional AnalysisRun, universal P1 proposal cleanup, current-controller S9/S10 progression, accepted/rejected audit semantics, precedence, shared guards and bounded retry/rollback | Exact commands; zero skipped cases; generic ledgers, process-local synchronization, expectation substitution, invented outcome aliases, origin aliases, guard promotion/fallback or same-transaction post-wait visibility are insufficient |

Blocker-to-gate crosswalk:

| Review blocker | Controlling sections | Fixture/test mapping                                    | Acceptance gate    |
| -------------- | -------------------- | ------------------------------------------------------- | ------------------ |
| `M02-B01`      | 4, 7                 | F09–F16; fingerprint unit golden tests                  | AC-02–AC-04        |
| `M02-B02`      | 12.3                 | F15–F17; identity integration/concurrency tests         | AC-05              |
| `M02-B03`      | 5–6                  | F01–F08; classification unit/fixture tests              | AC-01              |
| `M02-B04`      | 13                   | F18; table-driven identity unit/integration tests       | AC-07              |
| `M02-B05`      | 12.2                 | F19; shell/promotion schema contract tests              | AC-06              |
| `M02-B06`      | 14, 17               | F20–F23; relationship/migration/adversarial tests       | AC-08–AC-10, AC-18 |
| `M02-B07`      | 7                    | F06, F09, F11–F14; ownership unit/adversarial tests     | AC-02–AC-04        |
| `M02-B08`      | 15                   | F24; per-command role/transaction/audit contract tests  | AC-12              |
| `M02-B09`      | 11, 15               | F07; rejected-command adversarial/audit tests           | AC-13              |
| `M02-B10`      | 8, 17                | F03–F04; group persistence integration tests            | AC-11              |
| `M02-B11`      | 16                   | F05, F07, F25–F27; job integration/concurrency tests    | AC-14–AC-15        |
| `M02-B12`      | 9                    | F28, F30; analysis provenance/no-network contract tests | AC-16              |
| `M02-B13`      | 18                   | F28; exact-boundary/one-over parameterized tests        | AC-17              |

Final-remediation crosswalk:

| Review finding | Controlling sections | Fixture/test mapping                                      | Acceptance gate    |
| -------------- | -------------------- | --------------------------------------------------------- | ------------------ |
| `M02-R01`      | 13–15, 17            | F20–F23; endpoint/FK/direction/correction/audit tests     | AC-08–AC-10, AC-18 |
| `M02-R02`      | 7.2, 9, 18           | F29/F32; canonical-byte golden/collision/mutation tests   | AC-02, AC-22       |
| `M02-R03`      | 6.1–6.3              | F01–F08/F31; YAML/CommonMark/token conformance tests      | AC-01, AC-22       |
| `M02-R04`      | 6.2, 13              | F18/F33; scope/normalization/provenance/collision tests   | AC-07, AC-18       |
| `M02-R05`      | 15, 17               | F24/F34; version-set/lock/stale/phantom/transaction tests | AC-12, AC-18       |
| `M02-R06`      | 16–17                | F25–F27/F35; controlling-chain/retry/stale/history tests  | AC-14, AC-18       |

Second-amendment independent-review crosswalk:

| Review blocker | Controlling sections | Required direct evidence | Acceptance gate |
| --- | --- | --- | --- |
| `M02-AR-B01` | 15.3–15.5, 21 | Provisional/locked plan equality and every plan-change abort dimension | AC-12, AC-18, AC-22 |
| `M02-AR-B02` | 15.8–15.9, 21 | All 256 executable modes with exact typed sets, guards, result, audits and postconditions | AC-10–AC-12, AC-14–AC-15, AC-18, AC-22 |
| `M02-AR-B03` | 15.6, 17, 21 | Split/merge/override order plus group/run and pairwise root/candidate/ownership/edge lineage | AC-11, AC-18, AC-22 |
| `M02-AR-B04` | 15.7, 17, 21 | Three-target XOR, OPEN uniqueness, every K2 terminal transition and stale-version rejection | AC-12, AC-18, AC-22 |
| `M02-AR-B05` | 15.8–15.9, 17, 21 | Direct typed canonical fields, exact before/after, closed metadata and formula-derived subjects/count | AC-10, AC-12, AC-14, AC-18, AC-22 |
| `M02-AR-B06` | 15.3–15.5, 15.9, 16–17, 21 | Natural controller/input null guards, positive predecessors, random-ID guard rejection and retry ID reuse | AC-12, AC-14, AC-18, AC-22 |

Third-amendment remediation crosswalk:

| Review blocker | Controlling sections | Required direct evidence | Acceptance gate |
| --- | --- | --- | --- |
| `M02-SAR-01` | 15.4–15.5, 17, 21 | F36 G0–G5 null guard stays absent through locked reproduction/recheck, write-phase version 1, positive N path, rollback/replay and two-session loser reproduction | AC-12, AC-18, AC-22 |
| `M02-SAR-02` | 15.5, 15.9, 21 | F37 exact 256-mode enumeration, present-positive/absent-null guards, A/M branches, old/new pairs and P/K/J effects | AC-10, AC-12, AC-15, AC-18, AC-22 |
| `M02-SAR-03` | 15.6, 17, 21 | F38 per-table topology transitions, immutable facts, complete mappings, root order and ownership history | AC-11, AC-18, AC-22 |
| `M02-SAR-04` | 15.7, 15.9, 17, 21 | F39 exact controlling-job predicate, Z0/one/multiple matches, outside-predecessor preservation | AC-12, AC-14, AC-18, AC-22 |
| `M02-SAR-05` | 15.8–15.9, 17, 21 | F40 mapping-row cardinality, immutable/mutable before-after values and exact formula-derived subjects/count | AC-10–AC-12, AC-14, AC-18, AC-22 |

Fourth-amendment remediation crosswalk:

| Review blocker | Controlling sections | Required direct evidence | Acceptance gate |
| --- | --- | --- | --- |
| `M02-SAR-01` | 15.4–15.5, 17, 21 | First-use advisory lock without typed insertion; physical absence through equality/recheck/invariants; write-phase version 1; positive N path; rollback/replay; two-session winner/loser oracle | AC-12, AC-18, AC-22 |

Fifth-amendment remediation crosswalk:

| Review blocker | Controlling sections | Required direct evidence | Acceptance gate |
| --- | --- | --- | --- |
| `M02-FAR-01` | 15.3–15.5, 16–17, 20–21 | Fixed PostgreSQL snapshot; stale loser rollback; bounded fresh Serializable retry; current-state plan/ID derivation; same/different idempotency; exactly one first-use mutation | AC-12, AC-18, AC-22 |

Sixth-amendment remediation crosswalk:

| Review blocker | Controlling sections | Required direct evidence | Acceptance gate |
| --- | --- | --- | --- |
| `M02-FIR-01` | 15.1, 15.3–15.5, 17, 20–21 | Immutable caller map; fresh required map; exact initial/retry preflight; mismatch precedence; same/different idempotency; N-to-N+1; retry accounting; no silent substitution | AC-12, AC-18, AC-22 |

Seventh-amendment remediation crosswalk:

| Review blocker | Controlling sections | Required direct evidence | Acceptance gate |
| --- | --- | --- | --- |
| `M02-SID-01` | 15.1, 15.3–15.5, 15.9, 17, 20–21 | F41/GID-01–GID-06; pre-allocation CREATE/A1/first-fork/M1 construction; two-UUID-set byte stability; future-ID injection rejection; complete 256-mode guard scan | AC-12, AC-18, AC-22 |

Eighth-amendment remediation crosswalk:

| Review blocker | Controlling sections | Required direct evidence | Acceptance gate |
| --- | --- | --- | --- |
| `M02-SGR-01` | 12.2–12.3, 15.3–15.5, 15.9, 17, 20–21 | F41/GID-07–GID-11; immutable original-candidate anchor; CREATE/A1/fork/observation/pair null-to-version1-to-positive byte continuity; cross-candidate reconstruction; no lifecycle tag; full 256-mode lifetime scan | AC-12, AC-18, AC-22 |

Ninth-amendment remediation crosswalk:

| Review blocker | Controlling sections | Direct evidence | Acceptance gate |
| -------------- | -------------------- | --------------- | --------------- |
| `M02-AIP-01` | 13.1, 14, 15.8, 15.11, 17, 20–21 | F42; exact 22-mode system matrix; immutable system operation/result; frozen expectations; transaction; origins; shared guards | AC-05, AC-07, AC-15, AC-18, AC-22 |

Tenth-amendment remediation crosswalk:

| Review blocker | Controlling sections | Direct evidence | Acceptance gate |
| -------------- | -------------------- | --------------- | --------------- |
| `M02-SPM-01` | 12.3, 13.1, 15.11, 20–21 | F42 exact 22 IDs; R0/R1; S1–S5 closed rows; S7 PROPOSED duplicate; S9/S10 | AC-05, AC-07, AC-08, AC-15, AC-18, AC-22 |
| `M02-SAP-01` | 13.1, 15.8, 15.11, 17, 20–21 | Canonical request/reason/tier metadata; acceptance exclusion/formula; rejected-system audit | AC-07, AC-18, AC-22 |
| `M02-SPV-01` | 13.1, 14, 15.11, 17, 20–21 | Conditional AnalysisRun; golden decision-input/request fingerprints; post-freeze operation ID; human precedence | AC-05, AC-07, AC-15, AC-18, AC-22 |

Eleventh-amendment remediation crosswalk:

| Remaining lifecycle/fingerprint defect | Controlling sections | Direct evidence | Acceptance gate |
| --- | --- | --- | --- |
| S7 proposal-confirmation guard collision | 13.1, 15.5, 15.9, 17, 20–21 | Proposal-only guard; MARK_DUPLICATE FIRST positive proposal/supersession; confirmed guards null | AC-08, AC-10, AC-18, AC-22 |
| Undefined run/signal fingerprint vocabulary | 13, 15.11, 17, 20–21 | Stored classification input/output and analysis request/response fields; closed P1–P6 signal enum/goldens | AC-07, AC-18, AC-22 |
| Replacement-to-S9/S10 unreachable handoff | 13.1, 15.11, 16–17, 20–21 | Exact replacement-superseded predecessor handoff/result/edge provenance and new-controller outcomes | AC-05, AC-15, AC-18, AC-22 |
| Rejected-system pre-allocation ID sequencing | 15.11, 17, 20–21 | Null-before/allocation-ID-after rule, frozen fingerprint, post-rollback separate transaction/replay | AC-18, AC-22 |

Twelfth-amendment remediation crosswalk:

| Review blocker | Controlling sections | Direct evidence | Acceptance gate |
| --- | --- | --- | --- |
| `M02-DPL-01` | 13.1, 15.5, 15.9, 17, 20–21 | MARK_DUPLICATE FIRST with zero/matching/different active proposal provenance; confirmed guards null; still 18 modes | AC-08, AC-10, AC-18, AC-22 |
| `M02-RJC-01` | 12.3, 13.1, 15.5, 15.11, 16–17, 20–21 | Golden `JobReplacementInputV1`; multi-sibling current-controller Decision/handoff aggregate; last-chain-only JC | AC-05, AC-14, AC-15, AC-18, AC-22 |
| `M02-RSA-02` | 15.11, 17, 20–21 | Three rejection phases, exact nullability/context fingerprint, `MUTATION_PLAN_CHANGED`, domain/infrastructure collision routing | AC-18, AC-22 |
| `M02-DIC-02` | 13, 15.8, 15.11, 17, 20–21 | Real-granularity signal enum, typed targets/XOR, closed conflicts, exact six-tier canonical bytes | AC-07, AC-18, AC-22 |

Thirteenth-amendment remediation crosswalk:

| Review blocker | Controlling sections | Direct evidence | Acceptance gate |
| --- | --- | --- | --- |
| `M02-SRO-01` | 15.11, 17, 20–21 | Pre-projector `SystemIdentityReplayLocatorV1`; accepted replay before mutable eligibility; full request/idempotency only after projector/input freeze; collision and changed-input cases | AC-18, AC-22 |
| `M02-PCL-01` | 13.1, 15.5, 15.9, 17, 20–21 | Candidate-set/pair proposal guards; complete zero-or-one proposal discovery; every P1 resolver supersedes a present proposal with exact guard/audit effects and leaves none active | AC-08, AC-10, AC-18, AC-22 |
| `M02-DCP-01` | 13, 15.8, 15.11, 17, 20–21 | Six typed Decision-child tables with server IDs, parent/ordinal uniqueness, typed evidence/targets, result arrays, one creation audit per row, rollback and replay | AC-07, AC-18, AC-22 |
| `M02-S8S-01` | 13, 15.11, 17, 20–21 | Closed `P3_PROVIDER_DECLARED_FORK_PROVENANCE` signal, exact repository target, P1/P2 precedence and P4–P6 `NOT_APPLICABLE` golden bytes | AC-07, AC-18, AC-22 |

Fourteenth-amendment remediation crosswalk:

| Review blocker | Controlling sections | Direct evidence | Acceptance gate |
| --- | --- | --- | --- |
| `M02-ERO-01` | 12.3, 13–13.1, 15.8–15.9, 15.11, 17, 20–21 | Closed seven-value `IdentityOutcomeV1`; system S3/S4/S9 and human A2/A3/ambiguity-dispatch exact-repeat mapping; every human writer outcome; candidate/Decision/result/audit I/V equality; A1 exact new version; A2/A3 zero created and exact reused I/V arrays; mismatch rollback; PostgreSQL positive/negative cases | AC-05, AC-07, AC-12, AC-18, AC-22 |

## 23. Required implementation verification

The future authorized implementation must map tests to the suites above and run:

```bash
pnpm test:unit -- classification
pnpm test:unit -- identity
pnpm test:unit -- parser-profile
pnpm test:unit -- fingerprints
pnpm test:contract -- ai-analysis
pnpm test:contract -- identity-relationships
pnpm test:contract -- manual-resolution
pnpm test:contract -- migration
pnpm test:integration -- classification-identity
pnpm test:integration -- job-supersession
pnpm test:fixtures -- classification
pnpm test:fixtures -- identity
pnpm test:adversarial -- classification
pnpm test:adversarial -- command-concurrency
pnpm test:adversarial -- source-safety
pnpm lint
pnpm format:check
pnpm typecheck
pnpm build
pnpm verify
node scripts/check-dependency-boundaries.mjs
node scripts/check-source-safety.mjs
git diff --check
git status --short
git diff --stat
git diff --name-status
git diff main...HEAD
git diff
```

The implementation report must additionally record explicit concurrency/audit/no-network results,
migration-from-zero and M01-upgrade results, secret scan, authority `cmp`/SHA-256 and formatter-exclusion
evidence, and the complete staged/unstaged/untracked worktree. M02-specific commands are specification gates,
not claims that those currently nonexistent suites pass.

## 24. Risks and assumptions

| Risk                         | Fixed control                                                       | Readiness impact                      |
| ---------------------------- | ------------------------------------------------------------------- | ------------------------------------- |
| False positives/examples     | Exact eligible declaration and excluded paths                       | Any bypass is `NO-GO`                 |
| Unconventional layout        | Explicit `UNSUPPORTED`/review; no guessing                          | Gap remains visible                   |
| Root contamination           | Deepest-owner/shared algorithm and overlap blocking                 | Cross-root contamination is `NO-GO`   |
| Identity/version duplication | Separate keys, exact-payload equality, transactional uniqueness     | Duplicate canonical record is `NO-GO` |
| False merge                  | No automatic merge by hash/name                                     | Uncontrolled merge is `NO-GO`         |
| AI injection/forgery         | Bounded IDs/schema/no tools                                         | Accepted forged evidence is `NO-GO`   |
| Stale worker                 | Expected versions, cancellation checks, append-only human decisions | Overwrite is `NO-GO`                  |
| Canonical graph placeholders | Identity shells and explicit M03 promotion                          | Invented canonical field is `NO-GO`   |
| Scope expansion              | Handoff marker only; whole-diff review                              | M03+ behavior is `NO-GO`              |

Assumptions: M01's immutable snapshot, disposition, job, and provider identity contracts remain authoritative;
exact `SKILL.md` front-matter `name` is the only M02 source-derived identity token; production AI/provider,
OIDC, database/object-storage vendor, package split, and live corpus remain unresolved and out of scope. Adapter
and package selection may vary only while every contract above remains unchanged.

## 25. GO / NO-GO rules

The fourteenth-amended substantive specification is approved for M02 implementation and migration remediation at
SHA-256 `4549470853202ea7c5a6c1ac831d66fa71ac089cd39abb5ed033f6d5791dde27`.
Partial implementation, green tests, draft presence, or an earlier approval never grants commit, publication,
release, deployment, or M03 authority.

Future M02 implementation `GO` requires every acceptance criterion, M02 suite, M00/M01 regression,
migration, offline/security, authority-integrity, and whole-diff gate to pass with exact evidence and no
blocking/high-severity review finding. Any source execution, unsafe AI/tool boundary, forged reference,
ambiguous automatic progression, uncontrolled identity/version duplication or merge, stale overwrite,
migration failure, authority rewrite, required-gate failure, or M03+ expansion is `NO-GO`.

Use `BLOCKED` only for a mandatory unavailable external prerequisite with no deterministic substitute.
Production/live providers are not mandatory M02 gates and cannot conceal an implementation defect.

## 26. Approval record

```text
Historical specification decision: APPROVED
Historical approved substantive specification SHA-256: c30e395708f5e6ddc3596b6c18b7b8d8c0410c9e60105e116cd151967a3316fb
Historical post-approval-record SHA-256: 6216a4a7687581833f50f373ee2c383e4e8524e5b90f517ce0200a4653044489
Historical human approval: GRANTED
Historical implementation authorization: GRANTED FOR THE PREVIOUS SUBSTANTIVE SHA ONLY
Historical approval authority: Human product owner / repository owner
Historical approval date: 2026-08-09

First amendment reason: APPROVED-SPECIFICATION DEFECT DISCOVERED DURING RV-01 DURABLE POSTGRESQL COMMAND-PATH REMEDIATION
First-amended rejected specification SHA-256: dee6b63c7590e3a50398191b25fbe21337bd71dde923b157f573ef7aeb04f191
First-amended independent-review decision: REJECT
First-amended human-approval recommendation: NO-GO — AMENDED SPECIFICATION NOT READY
Second amendment reason: CLOSE M02-AR-B01 THROUGH M02-AR-B06 WITHOUT IMPLEMENTATION CHANGES
Second-amended rejected specification SHA-256: fe71b8d1afcc95af53a49e98dd81238fdebb7a2a58a0f8bcb872d6d20816b5a6
Second-amended independent-review decision: REJECT
Second-amended human-approval recommendation: NO-GO — SECOND-AMENDED SPECIFICATION NOT READY
Second-amended blockers: M02-SAR-01, M02-SAR-02, M02-SAR-03, M02-SAR-04, M02-SAR-05
Third amendment reason: CLOSE M02-SAR-01 THROUGH M02-SAR-05 AND DIRECT CONSISTENCY CONSEQUENCES WITHOUT IMPLEMENTATION CHANGES
Third-amended rejected specification SHA-256: 22de049fd1cf12c1e35034476ffc5c4aa6ef5b722871ae3d6fb989b25c83a345
Third-amended independent-review decision: REJECT
Third-amended human-approval recommendation: NO-GO — THIRD-AMENDED SPECIFICATION NOT READY
Third-amended remaining blocker: M02-SAR-01 FIRST-USE TYPED-GUARD MATERIALIZATION PRECEDED LOCKED PLAN REPRODUCTION
Fourth amendment reason: CLOSE THE REMAINING M02-SAR-01 FIRST-USE GUARD LIFECYCLE DEFECT WITHOUT IMPLEMENTATION CHANGES
Fourth-amended rejected specification SHA-256: 78047af8b51d1ba4c8a41a3e6e13ed9cdcff9615f729485af14e9ef598ecab10
Fourth-amended independent-review decision: REJECT
Fourth-amended human-approval recommendation: NO-GO — FOURTH-AMENDED SPECIFICATION NOT READY
Fourth-amended remaining blocker: M02-FAR-01 SERIALIZABLE SNAPSHOT PREVENTS THE SPECIFIED LOSER REREAD
Fifth amendment reason: CLOSE M02-FAR-01 WITH BOUNDED FRESH-SERIALIZABLE-TRANSACTION RETRIES WITHOUT IMPLEMENTATION CHANGES
Fifth-amended rejected specification SHA-256: 46851139f4caaf94ee637088b6d4201356566b932f862d5c4b6eaa7d49e04280
Fifth-amended independent-review decision: REJECT
Fifth-amended human-approval recommendation: NO-GO — FIFTH-AMENDED SPECIFICATION NOT READY
Fifth-amended remaining blocker: M02-FIR-01 FRESH RETRY RE-DERIVATION CONFLICTS WITH IMMUTABLE CALLER EXPECTEDVERSIONS
Sixth amendment reason: CLOSE M02-FIR-01 BY PRESERVING IMMUTABLE CALLER EXPECTATIONS ACROSS FRESH TRANSACTION ATTEMPTS WITHOUT IMPLEMENTATION CHANGES
Sixth-approved substantive SHA-256: fc7fa5de5640a461f927cde5be74a0b9faadb2da7db88b3ea7b1b4c3d059b284
Sixth-amended independent decision: APPROVE
Sixth-amended independent recommendation: GO — SIXTH-AMENDED M02 SPECIFICATION READY FOR HUMAN APPROVAL
Sixth-amended human approval: GRANTED
Sixth-amended human approval date: 2026-08-11
Sixth-amended implementation authorization: HISTORICAL — SUSPENDED AFTER APPROVED-SPECIFICATION DEFECT DISCOVERY
Approved-specification defect: M02-SID-01 CALLER-AUTHORIZED GUARD KEYS DEPEND ON FUTURE SERVER-ALLOCATED IDS
Seventh amendment reason: REPLACE FUTURE-ID-DEPENDENT GUARDS WITH ALLOCATION-INDEPENDENT TAGGED REFERENCES WITHOUT A TWO-PHASE COMMAND PROTOCOL
Seventh-amended rejected specification SHA-256: 33d18bbc9b83721ed6e628b47e4a688c7033950cb287500718f30bfe461a781c
Seventh-amended independent-review decision: REJECT
Seventh-amended blocker: M02-SGR-01 PLANNED/EXISTING TAGGED GUARD REFS ARE NOT LIFECYCLE-STABLE
Eighth amendment reason: REPLACE CREATION-STATE-TAGGED GUARDS WITH LIFECYCLE-STABLE IDENTITY AND VERSION ANCHORS
Eighth-amended rejected specification SHA-256: 8d40d57f99863029cebf292ba172bfdd17f345c0a7d2c9e094256d6f31bb36ab
Eighth-amended independent-review decision: REJECT
Eighth-amended blocker: M02-AIP-01 AUTOMATIC IDENTITY-RESOLUTION PERSISTENCE HAS NO CLOSED CANONICAL TRANSACTION/GUARD/AUDIT PROJECTION
Ninth amendment reason: CLOSE M02-AIP-01 WITH A FINITE TYPED SYSTEM-IDENTITY OPERATION, TRANSACTION, ORIGIN, GUARD, AUDIT AND HANDOFF CONTRACT
Ninth-amended rejected specification SHA-256: a2ca4e690f29f27308cc6b960f77d6e83ebc20052af7cc989bd565535162defe
Ninth-amended independent-review decision: REJECT
Ninth-amended architectural closure: M02-AIP-01 CLOSED
Ninth-amended blocker set: M02-SPM-01, M02-SAP-01, M02-SPV-01
Tenth amendment reason: CLOSE THE EXACT 22-MODE PROJECTOR, PROVENANCE, FINGERPRINT, ACCEPTED/REJECTED AUDIT, S7 PROPOSAL, S9/S10 REANALYSIS AND HUMAN-PRECEDENCE CONTRACTS
Tenth-amended rejected specification SHA-256: 88e256c7f28ed9e01e1f41eb4eb1b847560807eb7873af55422f514fa132b231
Tenth-amended independent-review decision: REJECT
Eleventh amendment reason: CLOSE S7 PROPOSAL-TO-CONFIRMATION GUARD CONTINUITY, AUTHORITATIVE RUN/SIGNAL FINGERPRINT VOCABULARY, REPLACEMENT-JOB S9/S10 REACHABILITY, AND REJECTED-ATTEMPT ID SEQUENCING
Eleventh-amended rejected specification SHA-256: 094b5e81c84376f185a30b2723cfa350b15e6e9def62d9107b0ab18c03942168
Eleventh-amended independent-review decision: REJECT
Eleventh-amended blocker set: M02-DPL-01, M02-RJC-01, M02-RSA-02, M02-DIC-02
Twelfth amendment reason: CLOSE OPTIONAL PROPOSAL PROVENANCE, CANONICAL REPLACEMENT INPUT/CURRENT-CONTROLLER AGGREGATE, PHASE-AWARE REJECTED-SYSTEM IDENTITY, AND COMPLETE TYPED DECISION-INPUT VOCABULARY
Twelfth-amended rejected specification SHA-256: 1a3a0ffa3f33d6985e87bf01219e98877bb4b3736333fbe08f56d245609956ce
Twelfth-amended independent-review decision: REJECT
Twelfth-amended blocker set: SYSTEM REPLAY/IDEMPOTENCY ORDERING; CROSS-WRITER S7 PROPOSAL CLEANUP; CANONICAL DECISION-CHILD ROW IDENTITY/AUDITING; S8 PROVIDER-FORK SIGNAL REPRESENTABILITY
Thirteenth amendment reason: CLOSE PRE-PROJECTOR REPLAY ORDERING, UNIVERSAL P1 PROPOSAL CLEANUP, EXACT TYPED DECISION-CHILD PERSISTENCE/AUDITING, AND S8 PROVIDER-FORK SIGNAL REPRESENTATION
Thirteenth-approved substantive specification SHA-256: da48d430f6f4c205806a337b57f19666ea47a0aa3c93c6fb2f8db7a4bc665542
Thirteenth-amended independent-review decision: APPROVE
Thirteenth-amended independent recommendation: GO — THIRTEENTH-AMENDED M02 SPECIFICATION READY FOR HUMAN APPROVAL
Thirteenth-amended human approval: GRANTED
Thirteenth-amended human approval date: 2026-08-15
Approved-specification defect: M02-ERO-01 EXACT RESOURCEVERSION REUSE HAS NO CLOSED IDENTITY OUTCOME
Fourteenth amendment reason: ADD EXACT_REPEAT_REUSE AND BIND SYSTEM S3/S4/S9 PLUS HUMAN A2/A3/AMBIGUITY-DISPATCH CANDIDATE, DECISION, RESULT, AUDIT, PERSISTENCE AND TEST SEMANTICS
Fourteenth-amended substantive specification SHA-256: 4549470853202ea7c5a6c1ac831d66fa71ac089cd39abb5ed033f6d5791dde27
Fourteenth-amended independent-review decision: APPROVE
Fourteenth-amended independent recommendation: GO — FOURTEENTH-AMENDED M02 SPECIFICATION READY FOR HUMAN APPROVAL
Fourteenth-amended human approval: GRANTED
Fourteenth-amended human approval date: 2026-08-15
Specification decision: APPROVED
Implementation authorization: GRANTED FOR FOURTEENTH-AMENDED SHA
Implementation status: AUTHORIZED; REMEDIATION IN PROGRESS
Required next gate: COMPLETE IMPLEMENTATION/VERIFICATION, THEN FRESH INDEPENDENT WHOLE-PATCH REVIEW
```
