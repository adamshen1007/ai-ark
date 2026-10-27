# M04 numeric canonicalization — implementation proof notes

Status: **candidate analysis; M04 NO-GO**. This document neither amends the approved specifications nor authorizes publication. Numeric component review does not replace the full unchanged-candidate gates or independent whole-patch R2 review. Exact candidate hashes and executed results belong in [M04_REPORT.md](M04_REPORT.md).

## Obligation and authority

The [canonical-payload correction amendment](M03_M04_CANONICAL_NUMBER_CORRECTION_AMENDMENT.md) requires independently enforced raw-byte canonicality for every schema-reachable finite number, including subnormal confidence values. The implementation proves a generic finite-binary64 conversion rather than narrowing schemas to sampled numbers. The standard is the pinned JavaScript serializer's finite-number spelling, unsigned UTF-8 key order, and original array order.

The sole numeric predicate remains `m04_payload_is_canonical_json(bytea)` inside local migration `003`. No additional migrated/production SQL function, grant, manifest cell, provider, libc, or production environment is required. The forced-fallback test creates a disposable test-only function. PostgreSQL's platform decimal parser may propose bits but is not the acceptance oracle.

## Exact representation and input bounds

A positive finite binary64 value has the exact form `M × 2^E`. For normal values, `M = 2^52 + fraction` and `E = exponentBits − 1023 − 52`. For subnormals, `M = fraction` and `E = −1074`. Integer arithmetic represents the same number as an integer coefficient divided by a power of ten: for negative `E`, use `M × 5^(−E) / 10^(−E)`; otherwise use `M × 2^E`. There is no approximate division in the comparison oracle.

Input decimal tokens are parsed into an integer coefficient and base-ten exponent. Canonical finite JavaScript spellings have at most 25 ASCII bytes: the longest fixed fractional form is the sign, `0.`, five leading fractional zeros, and 17 significant digits. Scientific forms and large fixed forms are shorter. The explicit boundary `-0.0000010000000000000002` must remain accepted.

For a nonzero canonical token the coefficient exponent lies in `[-324, 308]`. Normal binary64 values need at most 17 significant digits; near the smallest normal value this yields exponent `−324`. Each subnormal rounding interval has width `2^-1074 > 10^-324`, so contains an integer multiple of `10^-324`. The maximum subnormal divided by `10^-324` is below `2.23 × 10^16`, so that coefficient has at most 17 digits; stripping zeros yields a coefficient exponent at least `−324`. The upper bound follows from `q = e − (k − 1) ≤ e ≤ 308`, where `e` is the first decimal exponent and `k` the significant-digit count. Tokens with enormous exponents are rejected before power arithmetic. Zero alternatives still compare against the sole canonical spelling `0`.

These bounds are fail-closed lexical work bounds, not narrower M03/M04 value domains. A numeric token longer than 25 bytes or outside those exponent bounds cannot be a canonical finite JavaScript number. The full raw JSON syntax check remains independent of these checks.

## Correct rounding without a libc assumption

For each proposed positive finite bit pattern, the algorithm constructs exact midpoints between that value and its adjacent representable values. Membership in the interval between those midpoints determines round-to-nearest; midpoint inclusion is determined by even significand parity.

The implementation handles zero/subnormal adjacency, the minimum-normal transition, asymmetric spacing below normal powers of two, and the maximum-finite overflow midpoint explicitly. Negative values use the same magnitude rule, followed by the sign. A platform `float8` parse is accepted only after exact interval certification of its suggested bits.

If that suggestion is absent or uncertified, a monotone search over positive finite binary64 bit patterns finds the neighboring values using exact comparisons. There are fewer than `2^63` such patterns, so 63 bisection steps suffice. The floor and next pattern are then checked by the same exact midpoint membership rule. No success decision depends on the platform parser's rounding. The disposable wrong-hint test deliberately substitutes a wrong suggestion so this fallback is exercised even on a correctly rounded libc.

## Shortest representation and formatting

For precisions 1 through 17, the implementation considers the decimal floor and floor-plus-one around the exact value at that precision. The rounding interval is contiguous and contains the represented value, so if a farther same-grid candidate is admitted, the nearer floor or ceiling candidate is admitted too. Binary64 guarantees an admitted representation by 17 significant digits. The algorithm selects the first precision with a candidate in the exact rounding interval, then the candidate with the smaller exact distance to the represented value, using even decimal significand parity for a tie.

The candidate interval tests do not cast candidate text to `float8`. Midpoints, the exact center, and decimal candidates are compared on a common integer decimal scale. Multiplication by the same positive power of ten preserves membership, distance order, and ties. The chosen scale covers the smallest exponent generated while searching all 17 precisions; it is not restricted merely to the accepted input-token exponent bound. Precomputed powers amortize this work without changing the comparison.

After removing trailing significand zeros and adjusting the exponent, the formatter uses fixed notation when the first decimal exponent is between −6 and 20, otherwise scientific notation with the canonical exponent sign. The final rendered text must equal the original token byte-for-byte. Alternate spellings such as `1e0`, `-0`, `1.0`, leading zeros, uppercase exponents, and overflow/underflow alternatives cannot pass merely because they describe a nearby value.

The small integer fast path accepts only `0|[1-9][0-9]{0,8}`. Every integer in that conservative range is exactly representable and has identical JavaScript fixed decimal spelling. It does not admit signs, leading zeros, decimals, or exponents.

## Authoritative call sites

| Persisted surface        | Raw-byte numeric enforcement                                        | Downstream identity rule                                                |
| ------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Reconstructed M03 bundle | Chunk closure invokes the predicate on reconstructed original bytes | Original canonical bytes and byte-preserving logical/output projections |
| Request association      | `request_canonical_payload` CHECK                                   | Original request bytes and preserved semantic projection                |
| EvidenceItem             | `canonical_payload` CHECK                                           | Original bytes and preserved identity/fingerprint projections           |
| Claim                    | `canonical_payload` CHECK                                           | Original bytes and preserved identity/fingerprint projections           |
| Claim–Evidence link      | `canonical_payload` CHECK                                           | Original bytes and preserved identity/fingerprint projections           |
| Completeness             | `canonical_payload` CHECK                                           | Independently recomputed bounded integer/status projection              |
| Accepted result          | `canonical_payload` CHECK                                           | Independently recomputed string-ID/status projection                    |

The ordinary `m04_canonical_json(jsonb)` helper is not the general numeric acceptance oracle. Its authoritative recomputation uses bounded integer completeness counts/basis points and string-ID/status structures. Arbitrary retained M03/Claim number tokens must remain in the validated byte-preserving path. The [canonical closure inventory](M04_CANONICAL_CLOSURE_INVENTORY.md) maps the wider projection boundary; this numeric argument does not itself certify all string/projection paths.

## Evidence and remaining gates

### String-domain boundary

This is not a claim of equivalence with `JSON.stringify` for arbitrary JavaScript UTF-16 strings. For example, `JSON.stringify("\ud800")` emits a lone-surrogate escape that the SQL predicate deliberately rejects. The authoritative domain is Unicode scalar strings:

- `StructuredExtractionBundleV2Schema` recursively rejects invalid scalar strings and keys through `containsOnlyUnicodeScalarStrings`; the retained M02 projection has the same recursive check.
- The approved [idempotency-key amendment](M03_M04_IDEMPOTENCY_KEY_TEXT_ENCODING_AMENDMENT.md), Section 2, explicitly requires rejecting unpaired high/low surrogates before byte measurement/canonicalization/persistence while allowing NUL and paired supplementary scalars. The request key predicate implements this rule.
- Other free expected identity strings must match the scalar-validated bundle exactly before the public service constructs a persistence candidate. Claim values use the field-specific M03 value schemas. Durable projections remain closed over the validated bundle rather than accepting independent arbitrary source strings.
- SQL raw-byte validation independently rejects invalid scalar escape sequences. Temporary NUL/private-use encoding in projection functions does not grant a wider input domain.

The general scanner applies UTF-8 decoding and PostgreSQL's `json` grammar check, then tokenizes native text with disjoint leading token forms. Token byte lengths must sum to the original payload length, so skipped bytes cannot disappear. Whitespace tokens reject. Nonoverlapping removal of allowed escape pairs followed by a remaining-backslash check distinguishes a literal escaped backslash followed by `u0041` from a forbidden Unicode escape. Canonical controls accept the short escapes or lowercase `u00(0[0-7bef]|1[0-9a-f])` only. Given valid JSON grammar, a string following `{` or `,` at object depth is a key; decoded key bytes, including NUL, are compared in unsigned UTF-8 order. Values need no byte-at-a-time decoded allocation. This preserves the previous scalar-string domain without making `jsonb` a whole-payload oracle.

A bounded fast path follows UTF-8 decoding for the exact ASCII Claim–Evidence link spelling. Its fixed keys are already in canonical order, its strings contain only unescaped ASCII literals/lowercase-hex IDs, and its ordinal is `0|[1-9][0-9]{0,8}`, an exactly representable canonical integer. PostgreSQL absolute `\A`/`\Z` anchors and C collation make the match whole-input and locale-independent. This pattern itself defines a complete valid JSON grammar for its fixed object: every delimiter, quoted key, colon, comma and value is explicit. Therefore a match requires no additional JSON parse. Every nonmatch still passes PostgreSQL's JSON grammar check before entering the unchanged general scanner, including canonical negative/fractional/longer numbers, shorter or uppercase IDs, Unicode/NUL strings, and extra sorted keys. The length bound only selects this optimization; it does not narrow the generic canonical-byte domain or bypass schema/identity/lineage checks on stored records. Differential tests compare this path with a disposable copy that disables the fast branch.

`packages/testing/src/m04-unicode-domain.integration.test.ts` exercises the public service with a genuine orchestrator-produced V2 bundle and a persistence spy. A NUL plus paired supplementary scalar key reaches the port; lone high, low, and embedded surrogates in the bundle identity, key, and each free expected identity field never reach it. The focused test passed 1/1 in 1.50 seconds. This establishes that selected boundary regression, not an unrestricted-string serializer promise or a whole-patch verdict.

### Review and executable evidence

The full-binding link projection separately constructs exact expected bytes in fixed canonical key order with native JSON quoting. Its complete domain is ASCII ID/fingerprint strings, fixed ASCII relationship/schema literals and a bounded integer ordinal; it does not serialize arbitrary Claim values or numeric confidences. This avoids recursive canonical-helper calls without widening the raw canonical predicate or omitting full-payload equality. Null/missing joins remain rejecting through explicit checks and `IS DISTINCT FROM`; owner-only disposable corruption probes alter relationship, ordinal and evidence ID, require direct closure rejection, roll back and confirm valid closure afterward.

Read-only component analysis checked midpoint arithmetic, tie parity, exact coefficient construction, bounded fallback, exponent bounds, shortest selection, and formatting. It identified and prompted correction of both the unchecked platform parser assumption and the huge-exponent work bound. This is an inspectable argument, not formal-machine verification or a whole-patch verdict.

Required executable evidence remains the named boundary and hostile cases, forced wrong-hint fallback, full existing deterministic numeric/string matrix within its unchanged 120-second limit, real-LOGIN persistence/replay/recovery, maximum-cardinality persistence within its unchanged limit, all regression gates, and independent whole-patch review. A sample pass is not the proof, and the proof does not erase a timeout or unrun gate.

Relevant standards and implementation references: [ECMAScript Number::toString](https://262.ecma-international.org/12.0/#sec-numeric-types-number-tostring), [PostgreSQL 17 float input](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/utils/adt/float.c), and [PostgreSQL 17 numeric integer powers](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/utils/adt/numeric.c). The provider-neutral argument must not be replaced with an assumption about the local container's libc.
