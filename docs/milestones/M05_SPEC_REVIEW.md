# M05 specification independent review record

Date: 2026-10-27. Independent review decision: **GO — M05 SPECIFICATION READY FOR HUMAN APPROVAL**.

Subsequent owner decision, 2026-10-27: the owner approved the exact final hash below and separately authorized M05 implementation against it. This dated authorization supersedes the historical pending-approval statements in this review record and the frozen specification; it does not change their reviewed bytes or grant publication/deployment authority. Implementation progress is recorded separately in [M05_REPORT.md](M05_REPORT.md).

Final independently reviewed whole-file SHA-256 of `M05_SPEC.md`: `dd92ed72cab610298c66918137acd9e959795801bd85b4f1b51bbe630fa72a1d`.

The owner authorized M04 governance closeout and preparation/independent review of the M05 specification only. Neither exact-hash approval nor implementation authorization has been granted.

The fresh read-only reviewer is independent of the specification author. Review covers upstream authority, the existing M04 read/persistence gap, evidence integrity, provider authority, durability, least privilege, canonical identity, replay/concurrency/recovery, and testability. It is specification review, not implementation verification or a GitHub code-review approval.

Initial review candidate: `M05_SPEC.md` whole-file SHA-256 `ee66892cdfe445f00aa936483512d76698af618a66ced3fc62603cde0e292216`. Findings, remediation, and the final exact reviewed hash will be recorded after review. No proposed M05 tests have been executed or claimed to exist.

## First-pass material findings and corrections

The initial candidate was not ready for approval. The independent reviewer identified four material gaps:

| Finding                                                               | Correction in revised candidate                                                                                                                                      |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fingerprint preimages and nested canonical schemas were ambiguous     | Exact accepted envelope, M04 binding preimage/suffix, policy artifacts, metrics, provenance index, input manifest, and stored result schemas are enumerated          |
| Unicode/NUL-capable keys lacked a database encoding contract          | Existing strict M04 lowercase UTF-8 hex codec and C collation are mandatory; raw keys/tokens stay in bytea; advisory inputs are ASCII encoded key or generation hash |
| BLOCKED result omitted promised completeness identity                 | Closed result now includes completeness ID and record fingerprint with registry-ordered safe blocker keys                                                            |
| Provider “sanitized labels” lacked a verifiable transmission boundary | Provider receives only opaque atom IDs and closed section/field/class metadata, never source-derived free text; captured fake-provider payload is the leakage oracle |

Author self-review also clarified semantic-request alias lookup and retained historical policy validation so accepted replay can work without a live source/provider. This is specification work only, not evidence of implemented behavior.

Revised review candidate: `df497622a328e852e0bfa560b012bf3a597ba498d4b4affc3bb408ec453239b3`. Independent rereview closed the four original findings, then identified three remaining clarifications:

- The request policy tuple must resolve immutably to exact artifact/configuration bytes; otherwise concurrent equal semantic requests could produce different generation identities. The corrected contract freezes version/config mappings, preserves historical mappings, rejects substitution with AUTHORITY_INVALID, and mandates both-order registry-change tests.
- The prohibition on raw prompt persistence conflicted with deliberate retention of trusted prompt artifacts. The corrected text prohibits assembled requests, source-bearing prompts, and raw responses while explicitly retaining only the trusted version-controlled artifact.
- Unsafe omission records need opaque candidate IDs without making unsafe content eligible for display/transmission. The corrected text defines this private identifier-only distinction.

Final-review candidate: `dd92ed72cab610298c66918137acd9e959795801bd85b4f1b51bbe630fa72a1d`. The independent reviewer verified this exact whole-file hash and returned **GO — M05 SPECIFICATION READY FOR HUMAN APPROVAL**, with no material findings remaining. It separately checked targeted formatting, raw new-file whitespace, authority/code traceability, and governance status. Its review is local read-only agent evidence, not a GitHub review or implementation qualification.

## Preparation verification and remaining boundary

- Public M04 PR #2, merge identity, and both PR/main CI successes were rechecked through GitHub.
- All eleven approved M03/M04 specification hashes remain unchanged; SQL 003 and the 180-cell manifest hashes also match the merged baseline.
- Runtime files under packages/scripts/fixtures, package manifest, and lockfile remain byte-identical to HEAD. No M05 package, application code, database migration, provider call, or runtime test implementation was added.
- `pnpm format:check` and `git diff --check` passed. A temporary-index full proposed-document diff check includes the new untracked documents and passes without a new whitespace exception; the real index remains unstaged.
- Local Markdown links in the changed documentation resolve. Existing runtime suites were not rerun for documentation-only changes; their historical M04 results are not represented as new M05 evidence.
- Changed files: AGENTS.md, README.md, governance/TRACEABILITY.md, M04_REPORT.md; added M04_GOVERNANCE_CLOSEOUT.md, M05_SPEC.md, and this review record. No files removed.

The draft proposes metadata-guided AI selection rather than free-form factual prose, a strict M04 eligibility gate, an explicit verified durable source-read bridge, and isolated append-only M05 persistence. These are proposed product/architecture choices for owner approval, not already implemented behavior.

Next: owner approval must identify the exact hash above. Implementation requires a separate authorization. No commit, push, PR, merge, deployment, release, production migration, M06+, or live-provider use is authorized by this review. The current governance/specification changes remain local and uncommitted.
