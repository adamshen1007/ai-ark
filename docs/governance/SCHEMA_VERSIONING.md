# Contract and schema versioning policy

Canonical TypeScript contracts begin at `0.1.0` and export `CONTRACT_SCHEMA_VERSION`.

- Patch: clarification or additive behavior that does not change serialized meaning.
- Minor: backward-compatible enum or optional-field addition; consumers must tolerate explicitly documented new values before adoption.
- Major: removal, rename, type change, or semantic reinterpretation.

Stored canonical records must carry their schema version. Migrations are forward-only. Published snapshots retain the schema with which they were created. Provider response formats never become canonical contracts directly.

The Technical Alpha execution prompt and PRD names are canonical. Broader-spec aliases such as `NEW_VERSION` versus `EXISTING_RESOURCE_NEW_VERSION`, or `NEW_RESOURCE` versus a fuller long-term identity state machine, are translated at future adapter boundaries rather than added silently to M00 enums.
