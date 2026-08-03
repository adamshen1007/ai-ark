# Technical Alpha validation plan

## Purpose

Separate deterministic implementation evidence from future real-repository and real-user evidence. M00 validates only the engineering foundation.

## M00 gates

- deterministic frozen install;
- formatting, lint, dependency-boundary, and source-safety checks;
- strict TypeScript;
- unit tests for schemas, canonical serialization, configuration, and test utilities;
- contract tests for provider-neutral ports and fake providers;
- package build;
- CI containing no live-provider call.

## Later technical evidence

M01–M07 add fixture, adversarial, integration, recovery, accessibility, and E2E evidence for their behavior. M08 owns the versioned corpus manifest, independently known expected outcomes, metric definitions, denominators, report generation, and optional separately authorized live profile.

## Later user evidence

M09 owns pseudonymous participant records and outcome calculations. Real participant outcomes must never be fabricated from fixtures.

## Decision discipline

Reports distinguish implemented capability, deterministic fixture evidence, live-repository evidence, real-user evidence, and pending measurements. A missing external measurement is `PENDING`, not zero and not a pass.
