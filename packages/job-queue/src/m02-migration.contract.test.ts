import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const requiredTables = [
  "repository_candidate_groups",
  "repository_group_relationships",
  "repository_classification_runs",
  "classification_evidence_references",
  "analysis_runs",
  "candidate_roots",
  "candidate_root_ownership",
  "resource_candidates",
  "external_identifiers",
  "resource_identities",
  "resource_version_identities",
  "resource_version_observations",
  "source_repository_identities",
  "source_repository_urls",
  "resource_source_links",
  "duplicate_candidates",
  "fork_relationships",
  "source_repository_relationships",
  "identity_decisions",
  "manual_resolution_commands",
  "m02_review_states",
  "m02_audit_events",
  "m02_job_supersessions",
  "m02_concurrency_guards",
  "m02_identity_handoff_markers",
  "m02_system_identity_operations",
  "m02_system_identity_results",
  "m02_rejected_system_identity_audits",
  "identity_decision_tier_evaluations",
  "identity_decision_signals",
  "identity_decision_signal_evidence",
  "identity_decision_conflicts",
  "identity_decision_conflict_targets",
  "identity_decision_conflict_evidence",
] as const;

const systemProjectorModes = [
  "S1_R0_JC",
  "S1_R0_JR",
  "S1_R1_JC",
  "S1_R1_JR",
  "S2_JC",
  "S2_JR",
  "S3_JC",
  "S3_JR",
  "S4_R0_JC",
  "S4_R0_JR",
  "S4_R1_JC",
  "S4_R1_JR",
  "S5_R0_JC",
  "S5_R0_JR",
  "S5_R1_JC",
  "S5_R1_JR",
  "S6_JR",
  "S7_JR",
  "S8_JR",
  "S9_JC",
  "S9_JR",
  "S10_JR",
] as const;

describe("M02 PostgreSQL migration", () => {
  it("is one forward-only migration with the complete durable record set", async () => {
    const migration = await readFile(
      new URL("../migrations/002_m02_classification_identity.sql", import.meta.url),
      "utf8",
    );
    for (const table of requiredTables) {
      expect(migration).toContain(`CREATE TABLE ${table}`);
    }
    expect(migration).toContain("REFERENCES source_snapshots(id) ON DELETE RESTRICT");
    expect(migration).toContain(
      "record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0)",
    );
    expect(migration).toContain("DEFERRABLE INITIALLY IMMEDIATE");
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE)\b/iu);
  });

  it("encodes fail-closed relationship, command, and job invariants", async () => {
    const migration = await readFile(
      new URL("../migrations/002_m02_classification_identity.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain("target_resource_version_id text NOT NULL");
    expect(migration).toContain("CHECK (fork_resource_version_id <> origin_resource_version_id)");
    expect(migration).toContain(
      "CHECK (mirror_source_repository_id <> origin_source_repository_id)",
    );
    expect(migration).toContain("expected_versions jsonb NOT NULL");
    expect(migration).toContain("isolation_level text NOT NULL DEFAULT 'SERIALIZABLE'");
    expect(migration).toContain(
      "idempotency_scope text NOT NULL CHECK (idempotency_scope = 'M02')",
    );
    expect(migration).toContain(
      "UNIQUE (idempotency_scope, idempotency_key, request_fingerprint, error_code)",
    );
    expect(migration).toContain(
      "target_candidate_id text REFERENCES resource_candidates(id) ON DELETE RESTRICT",
    );
    expect(migration).toContain(
      "target_group_id text REFERENCES repository_candidate_groups(id) ON DELETE RESTRICT",
    );
    expect(migration).toContain(
      "review_id text REFERENCES m02_review_states(id) ON DELETE RESTRICT",
    );
    expect(migration).toContain("m02_rejected_command_audits_job_fk");
    expect(migration).toContain("FOREIGN KEY (job_id) REFERENCES m02_jobs(id) ON DELETE RESTRICT");
    expect(migration).toContain("error_code text NOT NULL CHECK (error_code IN (");
    expect(migration).toContain("supersession_state IN ('CONTROLLING', 'SUPERSEDED')");
    expect(migration).toContain(
      "operation_scope IN ('CLASSIFICATION', 'IDENTITY_RESOLUTION', 'FULL_PIPELINE')",
    );
    expect(migration).toContain("UNIQUE NULLS NOT DISTINCT");
    expect(migration).toContain(
      "child_candidate_id text NOT NULL REFERENCES resource_candidates(id) ON DELETE RESTRICT",
    );
    expect(migration).not.toContain("child_group_id");
    expect(migration).toContain(
      "current_stage text NOT NULL CHECK (current_stage IN ('CLASSIFYING_REPOSITORY', 'RESOLVING_IDENTITY'))",
    );
    expect(migration).toContain("classification_policy_version text NOT NULL");
    expect(migration).toContain("identity_policy_version text NOT NULL");
    expect(migration).toContain("analysis_policy_version text NOT NULL");
    expect(migration).toContain("prompt_bundle_version text NOT NULL");
    expect(migration).toContain("evidence_ids jsonb NOT NULL");
    expect(migration).toContain("provider_id text NOT NULL");
    expect(migration).toContain("adapter_id text NOT NULL");
    expect(migration).toContain("model_or_fake_id text NOT NULL");
    expect(migration).toContain("prompt_bundle_version text NOT NULL");
    expect(migration).toContain("classification_policy_version text NOT NULL");
    expect(migration).toContain("identity_policy_version text NOT NULL");
    expect(migration).toContain("analysis_policy_version text NOT NULL");
    expect(migration).toContain("bounded_usage jsonb NOT NULL");
    expect(migration).toContain("validation_repair_outcome text NOT NULL");
    expect(migration).toContain("controlling_job_state text DEFAULT 'CONTROLLING'");
    expect(migration).toContain("state = 'SUPERSEDED' AND controlling_job_state IS NULL");
    expect(migration).toContain("REFERENCES m02_jobs(id, supersession_state)");
    expect(migration).toContain("source_snapshot_id text NOT NULL REFERENCES source_snapshots(id)");
    expect(migration).toContain(
      "FOREIGN KEY (id, source_snapshot_id) REFERENCES acquisition_jobs(id, source_snapshot_id)",
    );
    expect(migration).toContain(
      "FOREIGN KEY (id, job_lineage_id) REFERENCES acquisition_jobs(id, submission_id)",
    );
    expect(migration).toContain("REFERENCES repository_candidate_groups(id, source_snapshot_id)");
    expect(migration).toContain(
      "REFERENCES repository_classification_runs(id, source_snapshot_id)",
    );
    expect(migration).toContain("REFERENCES m01_source_entries(id, source_snapshot_id)");
    expect(migration).toContain("REFERENCES m01_source_documents(id, source_snapshot_id)");
    expect(migration).toContain(
      "REFERENCES source_snapshots(id, provider, provider_repository_id)",
    );
    expect(migration).toContain("REFERENCES m02_jobs(id, job_lineage_id)");
    expect(migration).toContain(
      "command_id text NOT NULL REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT",
    );
    expect(migration).toContain("UNAUTHORIZED_M02_SUPERSESSION");
    expect(migration).toContain(
      "command.expected_versions ->> ('row:m02_jobs:' || NEW.source_job_id)",
    );
    expect(migration).toContain(
      "command.expected_versions ->> ('row:acquisition_jobs:' || NEW.source_job_id)",
    );
    expect(migration).not.toContain("command.expected_versions ->> ('job:' || NEW.source_job_id)");
    expect(migration).toMatch(
      /'components',\s*jsonb_build_object\(\s*'jobLineageId', NEW\.job_lineage_id,\s*'operationScope', NEW\.operation_scope\s*\)/iu,
    );
    expect(migration).not.toContain(
      "'components', jsonb_build_array(NEW.job_lineage_id, NEW.operation_scope)",
    );
    expect(migration).toContain("ORPHAN_M02_SUPERSEDED_JOB");
    expect(migration).toContain("OR NEW.operation_scope = existing.operation_scope");
    expect(migration).not.toContain("NEW.operation_scope <> existing.operation_scope");
    expect(migration).toContain(
      "REFERENCES source_repository_urls(id, source_repository_id) ON DELETE RESTRICT",
    );
    expect(migration).toMatch(
      /REFERENCES candidate_roots \(\s*id,\s*source_snapshot_id,\s*classification_run_id,\s*candidate_root_fingerprint,\s*candidate_content_fingerprint/iu,
    );
    expect(migration).toContain(
      "REFERENCES repository_classification_runs(id, group_id, source_snapshot_id)",
    );
    expect(migration).not.toContain("UNIQUE (replacement_job_id)");
    expect(migration).toContain("INVALID_M02_SUPERSESSION_SEQUENCE");
    expect(migration).toContain("source_successor <> NEW.replacement_job_id");
    expect(migration).toContain("source_acquisition_status = 'OPERATOR_REVIEW_REQUIRED'");
    expect(migration).toContain(
      "REFERENCES resource_version_identities(id, resource_identity_id) ON DELETE RESTRICT",
    );
    expect(migration).toContain("enforce_active_handoff_candidate_identity_tuple");
    expect(migration).toContain("REFERENCES resource_version_identities(id, resource_identity_id)");
    expect(migration).toContain("duplicate_candidates_one_active_pair");
    expect(migration).toContain("DUPLICATE_CONTENT_MISMATCH");
    expect(migration).toContain("audit_event_id text NOT NULL REFERENCES m02_audit_events(id)");
    expect(migration).toContain("M02_HISTORY_IMMUTABLE");
    expect(migration).toContain("REFERENCES source_snapshots(id, immutable_revision)");
  });

  it("persists the exact canonical M02 shell, classification, identifier, and decision fields", async () => {
    const migration = await readFile(
      new URL("../migrations/002_m02_classification_identity.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain(
      "classification IN ('SINGLE_SKILL', 'MULTIPLE_SKILLS', 'SKILL_COLLECTION', 'SKILL_PLUS_APPLICATION', 'NON_SKILL', 'AMBIGUOUS', 'UNSUPPORTED')",
    );
    expect(migration).not.toContain("'MALFORMED'");
    expect(migration).toContain(
      "resource_type text NOT NULL DEFAULT 'SKILL' CHECK (resource_type = 'SKILL')",
    );
    expect(migration).toContain("candidate_root_fingerprint text NOT NULL");
    expect(migration).toContain("candidate_content_fingerprint text NOT NULL");
    expect(migration).toContain("first_observed_source_snapshot_id text NOT NULL");
    expect(migration).toContain("first_observed_candidate_root_id text NOT NULL");
    expect(migration).toContain("first_observed_source_revision text NOT NULL");
    expect(migration).toContain(
      "observation_label text NOT NULL CHECK (observation_label ~ '^snapshot:[0-9a-f]{12}$')",
    );
    expect(migration).toContain("provider text NOT NULL CHECK (provider = 'github')");
    expect(migration).toContain("issuer text NOT NULL");
    expect(migration).toContain("namespace text NOT NULL");
    expect(migration).toContain(
      "normalization_policy_version text NOT NULL CHECK (normalization_policy_version = 'external-id-v1')",
    );
    expect(migration).toContain(
      "outcome IN ('NEW_RESOURCE', 'EXACT_REPEAT_REUSE', 'EXISTING_RESOURCE_NEW_VERSION', 'AMBIGUOUS_IDENTITY', 'POSSIBLE_DUPLICATE', 'FORK_OF_EXISTING_RESOURCE', 'MIRROR')",
    );
  });

  it("projects populated immutable M01 evidence without rewriting acquisition history", async () => {
    const migration = await readFile(
      new URL("../migrations/002_m02_classification_identity.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain("FROM acquisition_results acquisition_result");
    expect(migration).toContain(
      "CROSS JOIN LATERAL jsonb_array_elements(acquisition_result.result->'entries')",
    );
    expect(migration).toContain(
      "CROSS JOIN LATERAL jsonb_array_elements(acquisition_result.result->'documents')",
    );
    expect(migration).not.toMatch(/UPDATE\s+acquisition_results/iu);
  });

  it("persists the closed system identity operation, replay, result, and rejection contracts", async () => {
    const migration = await readFile(
      new URL("../migrations/002_m02_classification_identity.sql", import.meta.url),
      "utf8",
    );
    for (const mode of systemProjectorModes) expect(migration).toContain(`'${mode}'`);
    expect(migration).toContain(
      "operation_kind text NOT NULL DEFAULT 'SYSTEM_IDENTITY_PROJECTION'",
    );
    expect(migration).toContain("system_replay_locator_payload bytea NOT NULL");
    expect(migration).toContain("system_replay_lookup_key text NOT NULL UNIQUE");
    expect(migration).toContain("identity_decision_input_payload bytea NOT NULL");
    expect(migration).toContain("system_operation_request_payload bytea NOT NULL");
    expect(migration).toContain("system_expected_versions jsonb NOT NULL");
    expect(migration).toContain("created_identity_decision_tier_evaluation_ids uuid[] NOT NULL");
    expect(migration).toContain("created_identity_decision_conflict_evidence_ids uuid[] NOT NULL");
    expect(migration).toContain(
      "phase text NOT NULL CHECK (phase IN ('PRE_PROJECTOR', 'POST_PROJECTOR_PRE_ALLOCATION', 'TRANSACTION_ATTEMPT'))",
    );
    expect(migration).toContain("rejection_fingerprint text NOT NULL UNIQUE");
    expect(migration).toContain("m02_system_identity_operations_immutable");
    expect(migration).toContain("m02_system_identity_results_immutable");
    expect(migration).toContain("m02_rejected_system_identity_audits_append_only");
  });

  it("normalizes canonical Decision children with typed targets, evidence, order, and history", async () => {
    const migration = await readFile(
      new URL("../migrations/002_m02_classification_identity.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain("id uuid PRIMARY KEY DEFAULT gen_random_uuid()");
    expect(migration).toContain("UNIQUE (identity_decision_id, ordinal)");
    expect(migration).toContain("UNIQUE (identity_decision_id, tier)");
    expect(migration).toContain("UNIQUE (signal_id, evidence_reference_id)");
    expect(migration).toContain("UNIQUE (conflict_id, evidence_reference_id)");
    expect(migration).toContain("P3_PROVIDER_DECLARED_FORK_PROVENANCE");
    expect(migration).toContain("CONTENT_FINGERPRINT_PAYLOAD_COLLISION");
    expect(migration).toContain(
      "num_nonnulls(resource_identity_id, resource_version_id, source_repository_id) = 1",
    );
    expect(migration).toContain("identity_decision_children_immutable");
    expect(migration).toContain("enforce_identity_decision_six_tiers");
  });

  it("closes shared guards, origin XORs, proposal lineage, and typed handoff provenance", async () => {
    const migration = await readFile(
      new URL("../migrations/002_m02_classification_identity.sql", import.meta.url),
      "utf8",
    );
    for (const guardType of [
      "SOURCE_REPOSITORY",
      "DUPLICATE_PROPOSAL_SET",
      "DUPLICATE_PROPOSAL_PAIR",
    ]) {
      expect(migration).toContain(`'${guardType}'`);
    }
    expect(migration).toContain("duplicate_candidates_one_active_proposal_set");
    expect(migration).toContain("duplicate_candidates_one_active_proposal_pair");
    expect(migration).toContain(
      "origin_type text NOT NULL CHECK (origin_type IN ('HUMAN_COMMAND', 'SYSTEM_IDENTITY_OPERATION'))",
    );
    expect(migration).toContain("SYSTEM_OPERATION_ACCEPTED");
    expect(migration).toContain(
      "system_operation_id text REFERENCES m02_system_identity_operations(id) ON DELETE RESTRICT",
    );
    expect(migration).toContain(
      "system_result_id text REFERENCES m02_system_identity_results(id) ON DELETE RESTRICT",
    );
    expect(migration).toContain("m02_identity_handoff_markers_origin_xor");
    expect(migration).toContain("enforce_active_handoff_candidate_identity_tuple");
    expect(migration).toContain("FOREIGN KEY (resource_version_identity_id, resource_identity_id)");
    expect(migration).not.toContain(
      "FOREIGN KEY (resource_candidate_id, resource_identity_id, resource_version_identity_id)",
    );
    expect(migration).toContain("m02_command_domain_records is non-authoritative");
    expect(migration).toContain(
      "encode(digest(canonical_payload, 'sha256'), 'hex') = payload_hash",
    );
    expect(migration).toContain("guard_key = 'guard:' || guard_type || ':'");
  });

  it("binds every retained canonical payload to typed authority and exact guard shapes", async () => {
    const migration = await readFile(
      new URL("../migrations/002_m02_classification_identity.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain("CREATE FUNCTION m02_canonical_json(value jsonb)");
    expect(migration).toContain("CREATE FUNCTION m02_payload_is_canonical_json(payload bytea)");
    expect(migration).toContain(
      "CREATE FUNCTION m02_guard_payload_valid(expected_guard_type text, payload bytea)",
    );
    expect(migration).toContain(
      "m02_payload_matches_json(system_expected_versions_payload, system_expected_versions)",
    );
    expect(migration).toContain("enforce_m02_system_operation_payloads");
    expect(migration).toContain("enforce_m02_rejection_payload");
    expect(migration).toContain("CHECK (m02_guard_payload_valid(guard_type, canonical_payload))");
  });

  it("requires exact system result sets, accepted audit lineage, and relational postconditions", async () => {
    const migration = await readFile(
      new URL("../migrations/002_m02_classification_identity.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain("CREATE FUNCTION m02_uuid_array_is_canonical(value uuid[])");
    expect(migration).not.toMatch(/created_[a-z_]+_ids uuid\[\] NOT NULL DEFAULT/iu);
    expect(migration).toContain(
      "CREATE FUNCTION enforce_m02_system_identity_result_postconditions()",
    );
    expect(migration).toContain("M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH");
    expect(migration).toContain("M02_SYSTEM_ACCEPTED_AUDIT_MISMATCH");
    expect(migration).toContain("m02_system_identity_results_postconditions_guard");
  });

  it("closes system-created row lineage and immutable identity anchors", async () => {
    const migration = await readFile(
      new URL("../migrations/002_m02_classification_identity.sql", import.meta.url),
      "utf8",
    );
    for (const table of [
      "resource_identities",
      "resource_version_identities",
      "source_repository_identities",
      "source_repository_urls",
      "resource_source_links",
      "resource_version_observations",
      "duplicate_candidates",
      "identity_decisions",
      "m02_identity_handoff_markers",
    ]) {
      expect(migration).toContain(`CREATE CONSTRAINT TRIGGER ${table}_origin_audit_guard`);
    }
    expect(migration).toContain("CREATE FUNCTION enforce_m02_domain_origin_audit()");
    expect(migration).toContain("resource_identities_guard_anchor_immutable");
    expect(migration).toContain("M02_GUARD_ANCHOR_IMMUTABLE");
  });

  it("uses only canonical audit subjects and validates closed metadata/state semantics", async () => {
    const migration = await readFile(
      new URL("../migrations/002_m02_classification_identity.sql", import.meta.url),
      "utf8",
    );
    expect(migration).not.toContain("'MIRROR_RELATIONSHIP'");
    expect(migration).not.toContain("'M02_ROOT_REPLACEMENT'");
    expect(migration).not.toContain("'M02_CANDIDATE_REPLACEMENT'");
    expect(migration).not.toContain("'M02_OWNERSHIP_REPLACEMENT'");
    expect(migration).not.toContain("'M02_GROUP_EDGE_REPLACEMENT'");
    expect(migration).toContain("CREATE FUNCTION m02_audit_metadata_valid(");
    expect(migration).toContain("CREATE FUNCTION m02_audit_state_valid(");
    expect(migration).toContain("M02_SYSTEM_ACCEPTED_AUDIT_NOT_UNIQUE");
  });

  it("deferred-validates gap-free canonical Decision-child ordering", async () => {
    const migration = await readFile(
      new URL("../migrations/002_m02_classification_identity.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain("CREATE FUNCTION enforce_identity_decision_child_order()");
    expect(migration).toContain("IDENTITY_DECISION_CHILD_ORDINAL_GAP");
    expect(migration).toContain("IDENTITY_DECISION_CHILD_ORDER_INVALID");
    expect(migration).toContain("identity_decision_children_order_guard");
  });

  it("binds system Decisions, scalars, audits, and URL rows to exact result semantics", async () => {
    const migration = await readFile(
      new URL("../migrations/002_m02_classification_identity.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain("created_source_repository_url_ids uuid[] NOT NULL");
    expect(migration).toContain("M02_SYSTEM_DECISION_RESULT_MISMATCH");
    expect(migration).toContain("M02_SYSTEM_RESULT_SCALAR_ARRAY_MISMATCH");
    expect(migration).toContain("M02_SYSTEM_RESULT_AUDIT_FORMULA_MISMATCH");
    expect(migration).toContain("M02_SYSTEM_AUDIT_METADATA_MISMATCH");
  });

  it("freezes guard identity and uses schema version 1 with collision-free child ordering", async () => {
    const migration = await readFile(
      new URL("../migrations/002_m02_classification_identity.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain("CREATE FUNCTION enforce_m02_concurrency_guard_update()");
    expect(migration).toContain("M02_CONCURRENCY_GUARD_IDENTITY_IMMUTABLE");
    expect(migration).toContain("metadata_schema_version text NOT NULL DEFAULT '1' CHECK");
    expect(migration).not.toContain("metadata_schema_version text NOT NULL DEFAULT 'm02-audit-v1'");
    expect(migration).toContain("m02_identity_signal_sort_key(");
    expect(migration).toContain("m02_identity_conflict_sort_key(");
  });

  it("binds the approved seven outcomes across system and human identity projections", async () => {
    const migration = await readFile(
      new URL("../migrations/002_m02_classification_identity.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain("'EXACT_REPEAT_REUSE'");
    expect(migration).toContain("identity_outcome text CHECK");
    expect(migration).toContain("resource_identity_id text REFERENCES resource_identities(id)");
    expect(migration).toContain(
      "resource_version_identity_id text REFERENCES resource_version_identities(id)",
    );
    expect(migration).toContain("created_resource_identity_ids text[] NOT NULL");
    expect(migration).toContain("reused_resource_identity_ids text[] NOT NULL");
    expect(migration).toContain("created_resource_version_identity_ids text[] NOT NULL");
    expect(migration).toContain("reused_resource_version_identity_ids text[] NOT NULL");
    expect(migration).toContain("enforce_m02_human_identity_result_projection");
    expect(migration).toContain("M02_HUMAN_IDENTITY_RESULT_MISMATCH");
    expect(migration).toContain("M02_SYSTEM_CANDIDATE_PROJECTION_MISMATCH");
  });

  it("requires exact S8 tiers and conflict semantic uniqueness independent of evidence", async () => {
    const migration = await readFile(
      new URL("../migrations/002_m02_classification_identity.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain("M02_SYSTEM_S8_TIER_SEMANTICS_MISMATCH");
    expect(migration).toContain("P3_PROVIDER_DECLARED_FORK_PROVENANCE");
    expect(migration).toContain("CREATE FUNCTION m02_identity_conflict_semantic_key(");
    expect(migration).toContain("IDENTITY_DECISION_CONFLICT_SEMANTIC_DUPLICATE");
    expect(migration).toContain("'identityOutcome'");
  });

  it("requires complete human identity writers and validates only active candidate lineage", async () => {
    const migration = await readFile(
      new URL("../migrations/002_m02_classification_identity.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain("M02_HUMAN_IDENTITY_RESULT_REQUIRED");
    expect(migration).toContain("M02_HUMAN_IDENTITY_CREATED_SET_MISMATCH");
    expect(migration).toContain("M02_HUMAN_IDENTITY_REUSED_SET_MISMATCH");
    expect(migration).toContain("M02_HUMAN_CANDIDATE_BEFORE_STATE_MISMATCH");
    expect(migration).toContain("enforce_m02_human_candidate_audit_projection");
    expect(migration).toContain("M02_HUMAN_CANDIDATE_AUDIT_MISMATCH");
    expect(migration).toContain("'CREATED'::text AS mutation_kind");
    expect(migration).toContain("candidate.creation_audit_event_id");
    expect(migration).toContain("candidate.replacement_audit_event_id");
    expect(migration).toContain("audit.id = target.selected_audit_event_id");
    expect(migration).toContain("'SUBJECT_SUPERSEDED'");
    expect(migration).toContain("decision.state = 'ACTIVE'");
    expect(migration).toContain("M02_REJECTION_IDENTITY_SURFACE_PROHIBITED");
  });

  it("equality-binds replacement mapping audit endpoints and retained/reassigned kinds", async () => {
    const migration = await readFile(
      new URL("../migrations/002_m02_classification_identity.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain("CREATE FUNCTION enforce_m02_replacement_mapping_audit()");
    expect(migration).toContain("M02_REPLACEMENT_MAPPING_AUDIT_MISMATCH");
    expect(migration).toContain("'RETAINED', 'REASSIGNED'");
    expect(migration).toContain("m02_root_replacements_audit_guard");
    expect(migration).toContain("m02_candidate_replacements_audit_guard");
    expect(migration).toContain("m02_ownership_replacements_audit_guard");
    expect(migration).toContain("m02_group_edge_replacements_audit_guard");
  });
});
