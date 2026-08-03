# Technical Alpha implementation traceability

| Requirement                              | Architecture component                      |                           Milestone | Tests/evidence                                   |
| ---------------------------------------- | ------------------------------------------- | ----------------------------------: | ------------------------------------------------ |
| No acquired-source execution             | quarantine, isolated workers, safety policy | M00 foundation; M01/M04 enforcement | `lint:source-safety`; later adversarial tests    |
| Provider neutrality                      | inward-owned ports                          |                                 M00 | provider contract tests                          |
| Canonical enum and primitive vocabulary  | contracts                                   |                                 M00 | contract unit tests and schema policy            |
| Deterministic offline gates              | testing/config/CI                           |                                 M00 | `pnpm verify`, CI workflow                       |
| Safe acquisition and immutable snapshots | source provider/acquisition/storage         |                                 M01 | acquisition contract, fixture, adversarial tests |
| Stable Skill identity                    | classification/identity/domain              |                                 M02 | classification and identity fixtures             |
| Explicit structured extraction           | extraction                                  |                                 M03 | parser, schema, and fixture tests                |
| Evidence-bound material claims           | evidence/security                           |                                 M04 | forgery and injection adversarial tests          |
| Drafts remain projections                | draft generation                            |                                 M05 | provenance and regeneration tests                |
| Human-only internal publication          | editorial/publication/auth/audit            |                                 M06 | authorization and bypass tests                   |
| Approved-only directory                  | projection/directory/search                 |                                 M07 | projection and E2E tests                         |
| Reproducible technical metrics           | validation harness                          |                                 M08 | fixed corpus and report tests                    |
| Real-user outcomes remain distinct       | validation records/analytics                |                                 M09 | privacy, authorization, calculation tests        |
