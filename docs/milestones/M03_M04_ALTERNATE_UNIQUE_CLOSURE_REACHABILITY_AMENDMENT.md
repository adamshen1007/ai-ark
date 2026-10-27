# M03/M04 Alternate-Unique Closure Reachability Clarification

Status: **PROPOSED — NOT APPROVED; NO IMPLEMENTATION AUTHORITY**  
Date: 2026-10-21

## 1. Authority and scope

This proposed eleventh document clarifies the positive-test obligation in the approved tenth clarification without weakening complete retained-closure validation or changing its collision taxonomy. It has no force until its exact final SHA-256 receives independent specification review and product-owner approval, followed by separate implementation authorization.

The approved predecessor tuple is:

| Document                                                       | SHA-256                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `M03_SPEC.md`                                                  | `3946c15149d08b15e50697dc83d746979f0b2a8a87abeb5dbb25a78809949f80` |
| `M04_SPEC.md`                                                  | `f4de3bd80f5ace68def7399944b8778e9817991a036d985be089392e72999569` |
| `M03_M04_HANDOFF_AMENDMENT.md`                                 | `74e30585b84efc23b11bf58aac3cb4b95850ace32761e75067f29185759e574c` |
| `M03_M04_PERSISTENCE_CORRECTION_AMENDMENT.md`                  | `e4888a93074d9d0104ac6933571c7d888bf9704a0603f5c962cd2db7fc73cfe8` |
| `M03_M04_AUTHORITY_OID_AMENDMENT.md`                           | `3d41b58f33d111fd1e61a72bcbbc8eb2883a1e5a2cfb5b8196c8b6bb5054a504` |
| `M03_M04_PRIVILEGE_NECESSITY_AMENDMENT.md`                     | `0e9108751bd91cfb5b7d7c3b335a34ec667185658ceed6faefa688510049fd97` |
| `M03_M04_ROW_LOCK_PRIVILEGE_CORRECTION_AMENDMENT.md`           | `c07897efdbaf18bf2cedc9521b4ab39e969713267d3f77ad99f45ffa8ba6e317` |
| `M03_M04_CANONICAL_NUMBER_CORRECTION_AMENDMENT.md`             | `58ecea477613ddc08ec878973393f5aa6410b2f776f3c27c5b3816b818c605ec` |
| `M03_M04_IDEMPOTENCY_KEY_TEXT_ENCODING_AMENDMENT.md`           | `7a5bfd6cc303b5fa50114ad86552f59a734815ea38801b3eaef16501fd3a68c1` |
| `M03_M04_ALTERNATE_UNIQUE_CONFLICT_CLARIFICATION_AMENDMENT.md` | `44f6d6a8577ecd95eb8689446bd5e05d75fbdf52341b26d67e8477a409380e87` |

Only the tenth clarification's Section 4 item 2 positive-test interpretation is narrowed below. Its seven-key enum, diagnostic schema and meanings, global content-before-alternate order, result-ID formula, exact replay, and concurrency obligations remain unchanged. The persistence correction's Section 5 complete-retained-closure requirement continues to govern every matched row.

## 2. Validity before classification

A matched incumbent is validated only when its canonical bytes, schema, content-derived ID and fingerprint, relational columns, and complete retained M03/M04 binding closure pass the approved checks. A record inserted with closure enforcement bypassed is not presumed valid merely because its individual canonical row and fingerprint are valid. A missing, orphaned, incomplete, or corrupt matched incumbent produces the existing `PERSISTENCE_INTEGRITY_FAILED` outcome before either collision classification; it cannot establish an `ALTERNATE_UNIQUE_KEY_CONFLICT` or authorized replay. Incoming records must satisfy their applicable complete deterministic projection checks before a positive alternate-conflict claim.

## 3. Seven-key reachability and exact tests

The approved conditional `ALTERNATE_UNIQUE_KEY_CONFLICT` behavior remains defined for each of the seven key kinds. The following distinguishes fully closed persistence witnesses from isolated comparator tests:

| Key kind                        | Fully closed unequal-fingerprint witness                                                                                        | Required evidence                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `EVIDENCE_EXTRACTION_REFERENCE` | Not reachable under one immutable extraction and its unique source reference                                                    | Isolated deterministic classifier contract; orphan/corrupt incumbent integration must fail integrity |
| `CLAIM_EXTRACTION_FIELD`        | Not reachable under one immutable extraction and unique field-registry entry                                                    | Same                                                                                                 |
| `LINK_CLAIM_EVIDENCE`           | Not reachable under deterministic claim, evidence, relationship, and unique evidence ordering                                   | Same                                                                                                 |
| `LINK_CLAIM_ORDINAL`            | Not reachable under deterministic claim and one evidence ID at that ordinal                                                     | Same                                                                                                 |
| `COMPLETENESS_EXTRACTION`       | Not reachable under one immutable extraction and its deterministic material-requirement projection                              | Same                                                                                                 |
| `RESULT_EXTRACTION`             | Not reachable under one immutable extraction, literal policy versions, deterministic projected IDs, and binding/result formulas | Same                                                                                                 |
| `RESULT_COMPLETENESS`           | Reachable across different valid extractions that produce the same canonical completeness object, which omits extraction ID     | Mandatory genuine complete-closure PostgreSQL integration witness                                    |

For `RESULT_COMPLETENESS`, construct two distinct valid M03 V2 extractions with identical canonical completeness records but distinct accepted binding/result preimages. First prove that each extraction independently commits a complete accepted binding under normal constraints and closure enforcement in separate disposable PostgreSQL databases. In the conflict database, retain the fully committed first binding and submit the second through the actual M04 LOGIN. The second binding is prospectively valid, not a second binding that can coexist with the first: its completeness row has the same content-derived primary ID, while its extraction ownership differs. The approved collision preflight runs before any second write, so its global content-hash pass must observe identical completeness canonical bytes rather than invent a hash collision, and its alternate pass must select the incompatible result's `RESULT_COMPLETENESS` key before the competing completeness primary-key insert is attempted. If that precedence cannot be demonstrated, this witness is not satisfied and the specification must be reconciled before a `GO` claim. The validated incoming `resultFingerprint` and completely closed incumbent's validated `resultFingerprint` must appear in the exact alternate-conflict diagnostic, with the approved terminal result-ID golden and zero partial writes. Verify that neither an authorized exact replay nor another earlier approved failure is misclassified. Recovery and concurrent retry/reclassification evidence must preserve this behavior.

For the other six kinds, test the conditional key comparator, global content-before-alternate precedence, authentic fingerprint propagation, kind/row ordering, and result-ID formula through isolated, explicitly labelled classifier-contract tests. Such tests may model an already-validated incumbent but do not establish that two incompatible records can coexist under full retained closure. Integration fixtures that bypass closure enforcement must instead prove `PERSISTENCE_INTEGRITY_FAILED`, no misleading alternate diagnostic, and no committed domain or audit side effect. Genuine accepted binding and replay remain required separately.

If a fully closed unequal-fingerprint witness is later found for any of the six currently single-valued kinds, that kind immediately requires a genuine PostgreSQL positive integration test under the existing conditional rule; the isolated classifier test is not a substitute. No test may weaken closure enforcement to manufacture a positive accepted-state witness.

## 4. Preserved boundaries

This clarification does not change M03 extraction semantics, any accepted or previously defined terminal identity, existing error/diagnostic meanings, migrations `001`/`002`, migration `003` table/index shape, SQL function signatures/security modes, the 180-cell privilege manifest, or publication authority. It does not waive full unchanged-candidate gates, schema-bounded canonical-number proof, combined-maximum fixtures, recovery, independent whole-patch R2 review, or predecessor diagnostic correctness. Commit, push, PR, merge, production migration, deployment, release, publication, and M05+ remain unauthorized.
