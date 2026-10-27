# M03/M04 Alternate-Unique Conflict Clarification Amendment

Status: **PROPOSED — NOT APPROVED; NO IMPLEMENTATION AUTHORITY**  
Date: 2026-10-20

## 1. Authority and narrow scope

This proposed tenth document clarifies an incompatibility between approved `M04_SPEC.md` Section 16's `CONTENT_HASH_COLLISION` diagnostic, which requires the same claimed SHA-256 in both fingerprint fields, and approved `M03_M04_PERSISTENCE_CORRECTION_AMENDMENT.md` Section 5's mandatory alternate-unique preflight. An alternate unique tuple can collide even when the two valid records claim different record fingerprints. Returning an unrelated fingerprint as an equal hash is false.

The nine predecessor documents and their SHA-256 values are:

| Document                                             | SHA-256                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| `M03_SPEC.md`                                        | `3946c15149d08b15e50697dc83d746979f0b2a8a87abeb5dbb25a78809949f80` |
| `M04_SPEC.md`                                        | `f4de3bd80f5ace68def7399944b8778e9817991a036d985be089392e72999569` |
| `M03_M04_HANDOFF_AMENDMENT.md`                       | `74e30585b84efc23b11bf58aac3cb4b95850ace32761e75067f29185759e574c` |
| `M03_M04_PERSISTENCE_CORRECTION_AMENDMENT.md`        | `e4888a93074d9d0104ac6933571c7d888bf9704a0603f5c962cd2db7fc73cfe8` |
| `M03_M04_AUTHORITY_OID_AMENDMENT.md`                 | `3d41b58f33d111fd1e61a72bcbbc8eb2883a1e5a2cfb5b8196c8b6bb5054a504` |
| `M03_M04_PRIVILEGE_NECESSITY_AMENDMENT.md`           | `0e9108751bd91cfb5b7d7c3b335a34ec667185658ceed6faefa688510049fd97` |
| `M03_M04_ROW_LOCK_PRIVILEGE_CORRECTION_AMENDMENT.md` | `c07897efdbaf18bf2cedc9521b4ab39e969713267d3f77ad99f45ffa8ba6e317` |
| `M03_M04_CANONICAL_NUMBER_CORRECTION_AMENDMENT.md`   | `58ecea477613ddc08ec878973393f5aa6410b2f776f3c27c5b3816b818c605ec` |
| `M03_M04_IDEMPOTENCY_KEY_TEXT_ENCODING_AMENDMENT.md` | `7a5bfd6cc303b5fa50114ad86552f59a734815ea38801b3eaef16501fd3a68c1` |

This amendment does not change M03 extraction semantics, M04 success identities, any existing terminal result formula, migrations `001`/`002`, migration `003` table/index shape, SQL function signatures or security modes, the 180-cell privilege manifest, or any publication boundary. It authorizes nothing until its exact final SHA-256 is approved and implementation is separately authorized.

## 2. Two distinct conflict arms

`CONTENT_HASH_COLLISION` remains the `REJECTED` result for a validated equal claimed SHA-256 (including a content-addressed ID suffix) with byte-distinct canonical domain preimages. Its current diagnostic code, subject, equal SHA-256 fingerprint fields, precedence, and result-ID formula remain unchanged.

Add `ALTERNATE_UNIQUE_KEY_CONFLICT` as a `REJECTED` eligibility error only when a validated incumbent and validated incoming record have the same frozen alternate unique tuple, are not an authorized exact replay, and have incompatible validated records. Their fingerprints may differ; equality alone is not a reason to relabel an alternate-key conflict as a content-hash collision. A true equal-claimed-hash/byte-distinct-preimage collision is handled by the preceding content-hash pass. Its diagnostic has:

- `code: "UNIQUE_KEY_CONFLICT"`;
- `stage: "PERSISTENCE"` for request/result associations and `"PROJECTION"` for EvidenceItem, Claim, link, and completeness records;
- the existing closed `subjectKind` for the record family and `subjectIdOrNull` equal to the incumbent opaque record ID;
- `expectedFingerprintOrNull` equal to the incoming validated authoritative fingerprint and `actualFingerprintOrNull` equal to the incumbent validated authoritative fingerprint: `recordFingerprint` for EvidenceItem, Claim, link, and completeness, or `resultFingerprint` for a binding result; they are not required to match;
- `alternateKeyKind` equal to exactly one enum member in Section 3;
- `observedCountOrNull` and `limitOrNull` both null.

The new diagnostic is a distinct strict union arm; do not add a new required member to existing `SafeDiagnosticV1` values or alter their canonical bytes. Never expose raw alternate tuple values, request idempotency keys, canonical payloads, excerpts, or personal data in the diagnostic. The new `REJECTED` result uses the existing terminal-result canonical result-ID and result-fingerprint formulas with this new error and diagnostic as inputs; no new hash algorithm is introduced. No existing accepted or previously defined terminal-result identity changes.

## 3. Frozen alternate unique kinds and deterministic selection

Only these migration-`003` alternate constraints are in scope, in this order by record family and then key kind:

| Record family    | `alternateKeyKind`              | Tuple                                     |
| ---------------- | ------------------------------- | ----------------------------------------- |
| `EVIDENCE`       | `EVIDENCE_EXTRACTION_REFERENCE` | `(extraction_id,m03_source_reference_id)` |
| `CLAIM`          | `CLAIM_EXTRACTION_FIELD`        | `(extraction_id,field_key)`               |
| `LINK`           | `LINK_CLAIM_EVIDENCE`           | `(claim_id,evidence_item_id)`             |
| `LINK`           | `LINK_CLAIM_ORDINAL`            | `(claim_id,ordinal)`                      |
| `COMPLETENESS`   | `COMPLETENESS_EXTRACTION`       | `extraction_id`                           |
| `BINDING_RESULT` | `RESULT_EXTRACTION`             | `extraction_id`                           |
| `BINDING_RESULT` | `RESULT_COMPLETENESS`           | `completeness_id`                         |

`BINDING_RESULT.binding_id` is the eighth non-primary, non-fingerprint physical unique constraint among these record families. It is content-addressed from the approved binding preimage and remains governed by the existing `CONTENT_HASH_COLLISION` and exact-replay rules: equal ID with byte-distinct preimages is selected in the first pass; equal ID with identical validated preimage is not a conflict. `REQUEST_ASSOCIATION.idempotency_key` retains its specialized `IDEMPOTENCY_KEY_REUSED` behavior. Primary content IDs and fingerprint columns remain content-hash domains. A valid equal tuple alone does not establish an error when the already-approved exact replay rules accept the byte-identical record and complete retained closure.

Complete all required byte and relational validation first. On one serializable candidate/incumbent snapshot, scan all retained record families for true equal-hash/byte-distinct `CONTENT_HASH_COLLISION` cases; if any exists, return the first in the approved family order: bundle, request association, EvidenceItem, Claim, link, completeness, binding result. Within a family, M03 canonical reference/field/ordinal order precedes opaque-ID tie breaking. Only when no content-hash collision exists anywhere in that same snapshot, scan for alternate-unique conflicts in the same family and canonical-position order. For multiple alternate kinds at one position, use the table order above; for multiple incumbent rows, use unsigned UTF-8 byte order of their opaque IDs (`pg_catalog."C"` in PostgreSQL). Finish the complete collision preflight before same-key/semantic replay, predecessor freshness, or a new write, as already required by the approved correction. A `23505` race retries the whole serializable transaction and reclassifies against the same deterministic preflight; a stable alternate conflict cannot become `SERIALIZATION_RETRY_EXHAUSTED`. No rejected row or audit/domain side effect commits.

## 4. Required exact tests and completion boundary

Contract, integration, concurrency, and recovery tests must prove:

1. Equal claimed SHA with byte-distinct canonical preimages retains exact `CONTENT_HASH_COLLISION` diagnostics and IDs.
2. Each listed alternate kind with unequal valid record fingerprints yields exact `ALTERNATE_UNIQUE_KEY_CONFLICT` diagnostic and result-ID goldens; neither fingerprint is fabricated or replaced with a tuple hash.
3. Valid exact replay on the same alternate tuple retains the existing replay result and writes no duplicate.
4. Simultaneous content and alternate conflicts, including in different record families, select the content collision; multiple alternate kinds/rows select the specified kind and incumbent regardless of insert/query order.
5. Concurrent stable conflicts are retried/reclassified without committed partial domain or audit effects.
6. All existing success and previously defined failure goldens, function signatures, catalog identity, SQL authority, and the 180-cell manifest remain unchanged.

The full unchanged-candidate gates, schema-bounded canonical-number proof, combined-maximum fixtures, and independent whole-patch R2 review remain separate requirements. A green specification review is not implementation, commit, publication, production-migration, or M05 authority.
