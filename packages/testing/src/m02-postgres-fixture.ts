import { createHash } from "node:crypto";

import { canonicalJson } from "@ai-ark/contracts";
import { createExternalIdentifierKey, manualResolutionPayloadKeys } from "@ai-ark/identity";
import {
  PostgresManualResolutionAdapter,
  canonicalGuard,
  type ManualResolutionEnvelope,
  type SystemIdentityProjectorModeId,
} from "@ai-ark/job-queue";
import type { Pool, PoolClient } from "pg";

const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);
const SYSTEM_EXTERNAL_IDENTIFIER_KEY = createExternalIdentifierKey({
  provider: "github",
  issuer: "https://github.com/",
  namespace: "system",
  identifierType: "DECLARED_MANIFEST_ID",
  normalizedValue: "system-skill",
  normalizationPolicyVersion: "external-id-v1",
});
const CHANGED_SYSTEM_EXTERNAL_IDENTIFIER_KEY = createExternalIdentifierKey({
  provider: "github",
  issuer: "https://github.com/",
  namespace: "system",
  identifierType: "DECLARED_MANIFEST_ID",
  normalizedValue: "changed-system-skill",
  normalizationPolicyVersion: "external-id-v1",
});

export async function seedM02ProductionGraph(pool: Pool, schema: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${schema}, public`);
    await seed(client);
  } finally {
    client.release();
  }
}

async function seed(client: PoolClient): Promise<void> {
  await client.query(
    `INSERT INTO source_snapshots
       (id, identity_key, provider, provider_repository_id, immutable_revision,
        acquisition_policy_version, acquired_at)
     VALUES
       ('snapshot-1','github:repo-1:rev-1','github','repo-1','rev-1','acquisition-v1',now()),
       ('snapshot-origin','github:repo-origin:rev-1','github','repo-origin','rev-1','acquisition-v1',now()),
       ('snapshot-mirror','github:repo-mirror:rev-1','github','repo-mirror','rev-1','acquisition-v1',now()),
       ('snapshot-replacement','github:repo-1:rev-2','github','repo-1','rev-2','acquisition-v1',now())`,
  );
  await client.query(
    `INSERT INTO acquisition_jobs
       (id, submission_id, idempotency_key, status, current_stage, attempt,
        source_snapshot_id, completed_stages, warnings, cancellation_requested, record_version)
     VALUES
       ('job-1','lineage-normal','acq-job-1','OPERATOR_REVIEW_REQUIRED','INVENTORYING_SOURCE',1,
        'snapshot-1','["ACQUIRED"]','[]',false,1)`,
  );
  await client.query(
    `INSERT INTO m01_source_entries
       (id, source_snapshot_id, original_path, normalized_path, entry_kind, byte_length,
        disposition, reason_codes, content_fingerprint)
     VALUES
       ('entry-1','snapshot-1','skills/demo/SKILL.md','skills/demo/SKILL.md','file',128,'ACQUIRED','[]',$1),
       ('entry-a','snapshot-1','skills/a/SKILL.md','skills/a/SKILL.md','file',64,'ACQUIRED','[]',$2),
       ('entry-b','snapshot-1','skills/b/SKILL.md','skills/b/SKILL.md','file',64,'ACQUIRED','[]',$3)`,
    [A, B, C],
  );
  await client.query(
    `INSERT INTO m01_source_documents
       (id, source_snapshot_id, source_entry_id, document_type, encoding, line_count, content_fingerprint)
     VALUES ('document-1','snapshot-1','entry-1','UTF8_TEXT','utf-8',8,$1)`,
    [A],
  );
  await client.query(
    `INSERT INTO repository_candidate_groups
       (id, source_snapshot_id, classification_policy_version, group_key, group_fingerprint,
        classification, ordered_candidate_root_ids, ordered_evidence_reference_ids,
        ordered_warning_codes, ordered_reason_codes, review_state, identity_policy_version,
        parser_profile_version, analysis_policy_version, prompt_bundle_version, state,
        created_at, record_version)
     VALUES ('group-1','snapshot-1','classification-v1','snapshot-1:classification-v1',$1,
       'SINGLE_SKILL','["root-1"]','["evidence-1"]','[]','[]','IDENTITY_REVIEW_REQUIRED',
       'identity-v1','parser-v1','analysis-v1','prompt-v1','ACTIVE',now(),1)`,
    [A],
  );
  await client.query(
    `INSERT INTO repository_classification_runs
       (id, group_id, source_snapshot_id, run_source, classification, ordered_candidate_root_ids,
        ordered_evidence_reference_ids, ordered_warning_codes, ordered_reason_codes, review_state,
        classification_policy_version, identity_policy_version, analysis_policy_version,
        prompt_bundle_version, parser_profile_version, methodology_version, input_fingerprint,
        output_fingerprint, created_at)
     VALUES ('run-1','group-1','snapshot-1','RECONCILED','SINGLE_SKILL','["root-1"]',
       '["evidence-1"]','[]','[]','IDENTITY_REVIEW_REQUIRED','classification-v1','identity-v1',
       'analysis-v1','prompt-v1','parser-v1','methodology-v1',$1,$2,now())`,
    [A, B],
  );
  await client.query(
    `INSERT INTO classification_evidence_references
       (id, classification_run_id, source_snapshot_id, source_entry_id, source_document_id, evidence_order)
     VALUES ('evidence-1','run-1','snapshot-1','entry-1','document-1',0)`,
  );
  await client.query(
    `INSERT INTO candidate_roots
       (id, group_id, classification_run_id, source_snapshot_id, normalized_root_path,
        candidate_root_fingerprint, candidate_content_fingerprint, canonical_root_payload,
        canonical_content_payload, root_idempotency_key, state, record_version)
     VALUES ('root-1','group-1','run-1','snapshot-1','.', $1,$2,
       convert_to('{"normalizedRootPath":"."}','UTF8'),
       convert_to('{"content":"demo"}','UTF8'),'root-key-1','ACTIVE',1)`,
    [B, A],
  );
  await client.query(
    `INSERT INTO candidate_root_ownership
       (id, candidate_root_id, source_snapshot_id, source_entry_id, ownership)
     VALUES ('ownership-1','root-1','snapshot-1','entry-1','OWNED')`,
  );
  await client.query(
    `INSERT INTO repository_candidate_root_order
       (id, group_id, classification_run_id, candidate_root_id, source_snapshot_id, root_ordinal, created_at)
     VALUES ('root-order-1','group-1','run-1','root-1','snapshot-1',0,now())`,
  );
  await client.query(
    `INSERT INTO resource_candidates
       (id, source_snapshot_id, candidate_root_id, candidate_root_fingerprint,
        candidate_content_fingerprint, reconciled_classification_run_id,
        classification_policy_version, identity_policy_version, ordered_provenance,
        candidate_idempotency_key, status, created_at, updated_at, record_version)
     VALUES ('candidate-1','snapshot-1','root-1',$1,$2,'run-1','classification-v1',
       'identity-v1','[]','candidate-key-1','IDENTITY_REVIEW_REQUIRED',now(),now(),1)`,
    [B, A],
  );
  await client.query(
    `INSERT INTO repository_group_relationships
       (id, parent_group_id, child_candidate_id, relationship_type, relationship_order)
     VALUES ('group-edge-1','group-1','candidate-1','INCLUDES',0)`,
  );
  await client.query(
    `INSERT INTO manual_resolution_commands
       (id, request_id, command_type, idempotency_scope, idempotency_key, actor_id,
        actor_role, expected_versions, caller_expected_versions_payload, request_fingerprint,
        reason_code, reason, request_payload, created_at)
     VALUES ('command-seed', 'request-seed', 'RESOLVE_AMBIGUITY', 'M02', 'fixture-seed',
       'fixture-editor', 'EDITOR', '{}'::jsonb, convert_to('{}', 'UTF8'),
       encode(digest(convert_to('{}', 'UTF8'), 'sha256'), 'hex'),
       'IDENTITY_AMBIGUITY_RESOLVED', 'Canonical PostgreSQL fixture seed',
       convert_to('{}', 'UTF8'), now())`,
  );
  await client.query(
    `INSERT INTO m02_manual_command_results
       (id, command_id, request_id, request_fingerprint, mutation_plan_fingerprint,
        result_fingerprint, ordered_target_ids, record_versions, result_payload, created_at)
     VALUES ('result-seed', 'command-seed', 'request-seed',
       encode(digest(convert_to('{}', 'UTF8'), 'sha256'), 'hex'), $1, $2,
       '[]', '{}', '{}', now())`,
    [A, B],
  );
  await client.query(
    `INSERT INTO m02_audit_events
       (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role, action,
        subject_type, subject_id, request_id, idempotency_scope, idempotency_key,
        reason_code, reason_text, occurred_at)
     VALUES ('audit-command-seed', 'HUMAN_COMMAND', 'command-seed', 'result-seed',
       'HUMAN', 'fixture-editor', 'EDITOR', 'COMMAND_ACCEPTED',
       'MANUAL_RESOLUTION_COMMAND', 'command-seed', 'request-seed', 'M02', 'fixture-seed',
       'IDENTITY_AMBIGUITY_RESOLVED', 'Canonical PostgreSQL fixture seed', now())`,
  );
  await client.query(
    `INSERT INTO m02_audit_events
       (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role, action,
        subject_type, subject_id, request_id, idempotency_scope, idempotency_key,
        reason_code, reason_text, after_version, after_state, occurred_at)
     VALUES
       ('audit-source-main', 'HUMAN_COMMAND', 'command-seed', 'result-seed', 'HUMAN',
        'fixture-editor', 'EDITOR', 'SUBJECT_CREATED', 'SOURCE_REPOSITORY_IDENTITY',
        'source-main', 'request-seed', 'M02', 'fixture-seed', 'IDENTITY_AMBIGUITY_RESOLVED',
        'Canonical PostgreSQL fixture seed', 1, '{"recordVersion":1}', now()),
       ('audit-source-origin', 'HUMAN_COMMAND', 'command-seed', 'result-seed', 'HUMAN',
        'fixture-editor', 'EDITOR', 'SUBJECT_CREATED', 'SOURCE_REPOSITORY_IDENTITY',
        'source-origin', 'request-seed', 'M02', 'fixture-seed', 'IDENTITY_AMBIGUITY_RESOLVED',
        'Canonical PostgreSQL fixture seed', 1, '{"recordVersion":1}', now()),
       ('audit-source-mirror', 'HUMAN_COMMAND', 'command-seed', 'result-seed', 'HUMAN',
        'fixture-editor', 'EDITOR', 'SUBJECT_CREATED', 'SOURCE_REPOSITORY_IDENTITY',
        'source-mirror', 'request-seed', 'M02', 'fixture-seed', 'IDENTITY_AMBIGUITY_RESOLVED',
        'Canonical PostgreSQL fixture seed', 1, '{"recordVersion":1}', now()),
       ('audit-resource-existing', 'HUMAN_COMMAND', 'command-seed', 'result-seed', 'HUMAN',
        'fixture-editor', 'EDITOR', 'SUBJECT_CREATED', 'RESOURCE_IDENTITY',
        'resource-existing', 'request-seed', 'M02', 'fixture-seed',
        'IDENTITY_AMBIGUITY_RESOLVED', 'Canonical PostgreSQL fixture seed', 1,
        '{"recordVersion":1,"status":"ACTIVE"}', now()),
       ('audit-resource-origin', 'HUMAN_COMMAND', 'command-seed', 'result-seed', 'HUMAN',
        'fixture-editor', 'EDITOR', 'SUBJECT_CREATED', 'RESOURCE_IDENTITY',
        'resource-origin', 'request-seed', 'M02', 'fixture-seed',
        'IDENTITY_AMBIGUITY_RESOLVED', 'Canonical PostgreSQL fixture seed', 1,
        '{"recordVersion":1,"status":"ACTIVE"}', now()),
       ('audit-version-prior', 'HUMAN_COMMAND', 'command-seed', 'result-seed', 'HUMAN',
        'fixture-editor', 'EDITOR', 'SUBJECT_CREATED', 'RESOURCE_VERSION_IDENTITY',
        'version-prior', 'request-seed', 'M02', 'fixture-seed',
        'IDENTITY_AMBIGUITY_RESOLVED', 'Canonical PostgreSQL fixture seed', 1,
        '{"recordVersion":1,"status":"IDENTITY_RESOLVED"}', now()),
       ('audit-version-target', 'HUMAN_COMMAND', 'command-seed', 'result-seed', 'HUMAN',
        'fixture-editor', 'EDITOR', 'SUBJECT_CREATED', 'RESOURCE_VERSION_IDENTITY',
        'version-target', 'request-seed', 'M02', 'fixture-seed',
        'IDENTITY_AMBIGUITY_RESOLVED', 'Canonical PostgreSQL fixture seed', 1,
        '{"recordVersion":1,"status":"IDENTITY_RESOLVED"}', now()),
       ('audit-version-origin', 'HUMAN_COMMAND', 'command-seed', 'result-seed', 'HUMAN',
        'fixture-editor', 'EDITOR', 'SUBJECT_CREATED', 'RESOURCE_VERSION_IDENTITY',
        'version-origin', 'request-seed', 'M02', 'fixture-seed',
        'IDENTITY_AMBIGUITY_RESOLVED', 'Canonical PostgreSQL fixture seed', 1,
        '{"recordVersion":1,"status":"IDENTITY_RESOLVED"}', now())`,
  );
  await client.query(
    `INSERT INTO m02_audit_events
       (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role, action,
        subject_type, subject_id, request_id, idempotency_scope, idempotency_key,
        reason_code, reason_text, after_version, after_state, metadata, occurred_at)
     VALUES ('audit-decision-seed', 'HUMAN_COMMAND', 'command-seed', 'result-seed', 'HUMAN',
       'fixture-editor', 'EDITOR', 'SUBJECT_CREATED', 'IDENTITY_DECISION',
       'decision-seed', 'request-seed', 'M02', 'fixture-seed',
       'IDENTITY_AMBIGUITY_RESOLVED', 'Canonical PostgreSQL fixture seed', 1,
       '{"recordVersion":1,"state":"ACTIVE"}',
       '{"evaluatedTierSequence":[{"evaluationDisposition":"NO_MATCH","tier":"P1"},{"evaluationDisposition":"NO_MATCH","tier":"P2"},{"evaluationDisposition":"NO_MATCH","tier":"P3"},{"evaluationDisposition":"NO_MATCH","tier":"P4"},{"evaluationDisposition":"NO_MATCH","tier":"P5"},{"evaluationDisposition":"NO_MATCH","tier":"P6"}]}'::jsonb,
       now())`,
  );
  await client.query(
    `INSERT INTO source_repository_identities
       (id, provider, provider_repository_id, created_at, record_version,
        first_observed_source_snapshot_id, origin_type, command_id, result_id, audit_event_id)
     VALUES
       ('source-main','github','repo-1',now(),1,'snapshot-1','HUMAN_COMMAND',
        'command-seed','result-seed','audit-source-main'),
       ('source-origin','github','repo-origin',now(),1,'snapshot-origin','HUMAN_COMMAND',
        'command-seed','result-seed','audit-source-origin'),
       ('source-mirror','github','repo-mirror',now(),1,'snapshot-mirror','HUMAN_COMMAND',
        'command-seed','result-seed','audit-source-mirror')`,
  );
  await client.query(
    `INSERT INTO resource_identities
       (id, status, created_at, record_version, guard_anchor_candidate_id,
        origin_type, command_id, result_id, audit_event_id)
     VALUES
       ('resource-existing','ACTIVE',now(),1,'candidate-1','HUMAN_COMMAND',
        'command-seed','result-seed','audit-resource-existing'),
       ('resource-origin','ACTIVE',now(),1,'candidate-1','HUMAN_COMMAND',
        'command-seed','result-seed','audit-resource-origin')`,
  );
  await client.query(
    `INSERT INTO resource_version_identities
       (id, resource_identity_id, content_fingerprint, canonical_payload,
        first_observed_source_snapshot_id, first_observed_candidate_root_id,
        first_observed_source_revision, observation_label, status, created_at, record_version,
        origin_type, command_id, result_id, audit_event_id)
     VALUES
       ('version-prior','resource-existing',$1,convert_to('{"prior":true}','UTF8'),
        'snapshot-1','root-1','rev-1','snapshot:000000000001','IDENTITY_RESOLVED',now(),1,
        'HUMAN_COMMAND','command-seed','result-seed','audit-version-prior'),
       ('version-target','resource-existing',$2,convert_to('{"target":true}','UTF8'),
        'snapshot-1','root-1','rev-1','snapshot:000000000002','IDENTITY_RESOLVED',now(),1,
        'HUMAN_COMMAND','command-seed','result-seed','audit-version-target'),
       ('version-origin','resource-origin',$3,convert_to('{"origin":true}','UTF8'),
        'snapshot-1','root-1','rev-1','snapshot:000000000003','IDENTITY_RESOLVED',now(),1,
        'HUMAN_COMMAND','command-seed','result-seed','audit-version-origin')`,
    [C, A, B],
  );
  await client.query(
    `INSERT INTO identity_decisions
       (id, resource_candidate_id, outcome, identity_policy_version, decision_source,
        signals, rejected_lower_tier_signals, conflicts, audit_fingerprint, state,
        created_at, record_version, origin_type, command_id, result_id, audit_event_id)
     VALUES ('decision-seed','candidate-1','AMBIGUOUS_IDENTITY','identity-v1','HUMAN_COMMAND',
       '[]','[]','[]',$1,'ACTIVE',now(),1,'HUMAN_COMMAND','command-seed','result-seed',
       'audit-decision-seed')`,
    [C],
  );
  await client.query(
    `INSERT INTO m02_jobs
       (id, job_lineage_id, source_snapshot_id, operation_scope, current_stage, review_state,
        supersession_state, supersession_sequence, job_scope_key, input_fingerprint,
        classification_policy_version, identity_policy_version, analysis_policy_version,
        prompt_bundle_version, record_version)
     VALUES
       ('job-1','lineage-normal','snapshot-1','CLASSIFICATION','RESOLVING_IDENTITY',
        'IDENTITY_REVIEW_REQUIRED','CONTROLLING',1,$1,$2,'classification-v1','identity-v1',
        'analysis-v1','prompt-v1',1)`,
    [A, A],
  );
  await client.query(
    `INSERT INTO m02_review_states
       (id, group_id, resource_candidate_id, review_state, record_version,
        source_snapshot_id, controlling_job_id)
     VALUES ('review-1','group-1','candidate-1','IDENTITY_REVIEW_REQUIRED',1,'snapshot-1','job-1')`,
  );
}

export interface M02SystemIdentityFixture {
  readonly snapshotId: string;
  readonly candidateId: string;
  readonly rootId: string;
  readonly runId: string;
  readonly evidenceId: string;
  readonly reviewId: string;
  readonly jobId: string;
  readonly sourceRepositoryId: string;
  readonly resourceIdentityId: string;
  readonly exactResourceVersionId: string;
  readonly priorResourceVersionId: string;
  readonly activeSourceLinkId: string;
  readonly siblingCandidateId: string | null;
}

const SYSTEM_FIXTURE_IDS = {
  snapshotId: "00000000-0000-7000-8000-000000004001",
  entryId: "00000000-0000-7000-8000-000000004002",
  documentId: "00000000-0000-7000-8000-000000004003",
  groupId: "00000000-0000-7000-8000-000000004004",
  runId: "00000000-0000-7000-8000-000000004005",
  evidenceId: "00000000-0000-7000-8000-000000004006",
  rootId: "00000000-0000-7000-8000-000000004007",
  ownershipId: "00000000-0000-7000-8000-000000004008",
  rootOrderId: "00000000-0000-7000-8000-000000004009",
  candidateId: "00000000-0000-7000-8000-000000004010",
  groupEdgeId: "00000000-0000-7000-8000-000000004011",
  reviewId: "00000000-0000-7000-8000-000000004012",
  jobId: "00000000-0000-7000-8000-000000004013",
  sourceRepositoryId: "00000000-0000-7000-8000-000000004014",
  sourceRepositoryUrlId: "00000000-0000-7000-8000-000000004015",
  resourceIdentityId: "00000000-0000-7000-8000-000000004016",
  exactResourceVersionId: "00000000-0000-7000-8000-000000004017",
  priorResourceVersionId: "00000000-0000-7000-8000-000000004018",
  activeSourceLinkId: "00000000-0000-7000-8000-000000004019",
  externalIdentifierId: "00000000-0000-7000-8000-000000004020",
  siblingRootId: "00000000-0000-7000-8000-000000004021",
  siblingRootOrderId: "00000000-0000-7000-8000-000000004022",
  siblingCandidateId: "00000000-0000-7000-8000-000000004023",
  siblingReviewId: "00000000-0000-7000-8000-000000004024",
  forkSourceRepositoryId: "00000000-0000-7000-8000-000000004026",
  replacementJobId: "00000000-0000-7000-8000-000000004050",
} as const;

/**
 * Adds one UUID-only production-shaped graph for direct F42 projector tests. Existing seed rows remain
 * available for the human/system-origin continuity assertions; trigger bypass is fixture-only and all
 * adapter mutations execute with the complete production trigger set enabled.
 */
export async function seedM02SystemIdentityGraph(
  pool: Pool,
  schema: string,
  mode: SystemIdentityProjectorModeId,
): Promise<M02SystemIdentityFixture> {
  if (!/^[a-z][a-z0-9_]{0,62}$/u.test(schema)) throw new Error("INVALID_SCHEMA");
  const ids = SYSTEM_FIXTURE_IDS;
  const jr = mode.endsWith("_JR") && !["S6_JR", "S7_JR", "S8_JR", "S10_JR"].includes(mode);
  const repositoryPresent =
    mode.includes("_R1_") || mode.startsWith("S2_") || mode.startsWith("S3_") || mode === "S8_JR";
  const identityPresent =
    mode.startsWith("S2_") ||
    mode.startsWith("S3_") ||
    mode.startsWith("S4_") ||
    mode.startsWith("S5_") ||
    mode === "S7_JR";
  const exactVersionPresent = mode.startsWith("S3_") || mode.startsWith("S4_") || mode === "S7_JR";
  const priorVersionPresent = mode.startsWith("S2_") || mode.startsWith("S5_");
  const sourceLinkPresent = mode.startsWith("S2_") || mode.startsWith("S3_");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL search_path TO ${schema}, public`);
    await client.query("SET LOCAL session_replication_role = 'replica'");
    await client.query(
      `INSERT INTO source_snapshots
         (id,identity_key,provider,provider_repository_id,immutable_revision,
          acquisition_policy_version,acquired_at)
       VALUES ($1,'github:system-repo:0123456789abcdef0123456789abcdef01234567','github',
         'system-repo','0123456789abcdef0123456789abcdef01234567','acquisition-v1',now())`,
      [ids.snapshotId],
    );
    await client.query(
      `INSERT INTO acquisition_jobs
         (id,submission_id,idempotency_key,status,current_stage,attempt,source_snapshot_id,
          completed_stages,warnings,cancellation_requested,record_version)
       VALUES ($1,'lineage-system','system-acquisition','ACTIVE','INVENTORYING_SOURCE',1,$2,
         '["ACQUIRED"]','[]',false,1)`,
      [ids.jobId, ids.snapshotId],
    );
    await client.query(
      `INSERT INTO acquisition_results (job_id,source_snapshot_id,result,created_at)
       VALUES ($1,$2,jsonb_build_object(
         'sourceReference',jsonb_build_object(
           'id','system-source-reference','provider','github',
           'canonicalUrl','https://github.com/system/repo','owner','system','repository','repo'),
         'identityDiscovery',jsonb_build_object(
         'reliableIdentityTokenOrNull',$3::text,
         'providerDeclaredForkRepositoryIdOrNull',$4::text,
         'trustedExternalIdentifierOrNull',$5::jsonb
       )),now())`,
      [
        ids.jobId,
        ids.snapshotId,
        mode === "S6_JR" ? null : "system-skill",
        mode === "S8_JR" ? "source-origin" : null,
        mode.startsWith("S4_") || mode.startsWith("S5_")
          ? JSON.stringify(SYSTEM_EXTERNAL_IDENTIFIER_KEY.payload)
          : null,
      ],
    );
    await client.query(
      `INSERT INTO m01_source_entries
         (id,source_snapshot_id,original_path,normalized_path,entry_kind,byte_length,
          disposition,reason_codes,content_fingerprint)
       VALUES ($1,$2,'SKILL.md','SKILL.md','file',64,'ACQUIRED','[]',$3)`,
      [ids.entryId, ids.snapshotId, A],
    );
    await client.query(
      `INSERT INTO m01_source_documents
         (id,source_snapshot_id,source_entry_id,document_type,encoding,line_count,content_fingerprint)
       VALUES ($1,$2,$3,'UTF8_TEXT','utf-8',4,$4)`,
      [ids.documentId, ids.snapshotId, ids.entryId, A],
    );
    await client.query(
      `INSERT INTO repository_candidate_groups
         (id,source_snapshot_id,classification_policy_version,group_key,group_fingerprint,
          classification,ordered_candidate_root_ids,ordered_evidence_reference_ids,
          ordered_warning_codes,ordered_reason_codes,review_state,identity_policy_version,
          parser_profile_version,analysis_policy_version,prompt_bundle_version,state,created_at,record_version)
       VALUES ($1,$2,'classification-v1','system-group',$3,'SINGLE_SKILL',jsonb_build_array($4::text),
         jsonb_build_array($5::text),'[]','[]','NOT_REQUIRED','identity-v1','parser-v1','analysis-v1',
         'prompt-v1','ACTIVE',now(),1)`,
      [ids.groupId, ids.snapshotId, B, ids.rootId, ids.evidenceId],
    );
    await client.query(
      `INSERT INTO repository_classification_runs
         (id,group_id,source_snapshot_id,run_source,classification,ordered_candidate_root_ids,
          ordered_evidence_reference_ids,ordered_warning_codes,ordered_reason_codes,review_state,
          classification_policy_version,identity_policy_version,analysis_policy_version,
          prompt_bundle_version,parser_profile_version,methodology_version,input_fingerprint,
          output_fingerprint,created_at)
       VALUES ($1,$2,$3,'RECONCILED','SINGLE_SKILL',jsonb_build_array($4::text),jsonb_build_array($5::text),
         '[]','[]','NOT_REQUIRED','classification-v1','identity-v1','analysis-v1','prompt-v1',
         'parser-v1','methodology-v1',$6,$7,now())`,
      [ids.runId, ids.groupId, ids.snapshotId, ids.rootId, ids.evidenceId, A, B],
    );
    await client.query(
      `INSERT INTO classification_evidence_references
         (id,classification_run_id,source_snapshot_id,source_entry_id,source_document_id,evidence_order)
       VALUES ($1,$2,$3,$4,$5,0)`,
      [ids.evidenceId, ids.runId, ids.snapshotId, ids.entryId, ids.documentId],
    );
    await client.query(
      `INSERT INTO candidate_roots
         (id,group_id,classification_run_id,source_snapshot_id,normalized_root_path,
          candidate_root_fingerprint,candidate_content_fingerprint,canonical_root_payload,
          canonical_content_payload,root_idempotency_key,state,record_version)
       VALUES ($1,$2,$3,$4,'.',$5,$6,convert_to('{"normalizedRootPath":"."}','UTF8'),
         convert_to('{"content":"system"}','UTF8'),'system-root-key','ACTIVE',1)`,
      [ids.rootId, ids.groupId, ids.runId, ids.snapshotId, B, A],
    );
    await client.query(
      `INSERT INTO candidate_root_ownership
         (id,candidate_root_id,source_snapshot_id,source_entry_id,ownership)
       VALUES ($1,$2,$3,$4,'OWNED')`,
      [ids.ownershipId, ids.rootId, ids.snapshotId, ids.entryId],
    );
    await client.query(
      `INSERT INTO repository_candidate_root_order
         (id,group_id,classification_run_id,candidate_root_id,source_snapshot_id,root_ordinal,created_at)
       VALUES ($1,$2,$3,$4,$5,0,now())`,
      [ids.rootOrderId, ids.groupId, ids.runId, ids.rootId, ids.snapshotId],
    );
    await client.query(
      `INSERT INTO resource_candidates
         (id,source_snapshot_id,candidate_root_id,candidate_root_fingerprint,
          candidate_content_fingerprint,reconciled_classification_run_id,
          classification_policy_version,identity_policy_version,ordered_provenance,
          candidate_idempotency_key,status,created_at,updated_at,record_version)
       VALUES ($1,$2,$3,$4,$5,$6,'classification-v1','identity-v1','[]','system-candidate-key',
         'CLASSIFIED',now(),now(),1)`,
      [ids.candidateId, ids.snapshotId, ids.rootId, B, A, ids.runId],
    );
    await client.query(
      `INSERT INTO repository_group_relationships
         (id,parent_group_id,child_candidate_id,relationship_type,relationship_order)
       VALUES ($1,$2,$3,'INCLUDES',0)`,
      [ids.groupEdgeId, ids.groupId, ids.candidateId],
    );
    await client.query(
      `INSERT INTO m02_jobs
         (id,job_lineage_id,source_snapshot_id,operation_scope,current_stage,review_state,
          supersession_state,supersession_sequence,controlling_classification_decision_id,
          job_scope_key,input_fingerprint,classification_policy_version,identity_policy_version,
          analysis_policy_version,parser_profile_version,prompt_bundle_version,record_version)
       VALUES ($1,'lineage-system',$2,'IDENTITY_RESOLUTION','RESOLVING_IDENTITY','NOT_REQUIRED',
         'CONTROLLING',1,$3,$4,$5,'classification-v1','identity-v1','analysis-v1','parser-v1',
         'prompt-v1',1)`,
      [ids.jobId, ids.snapshotId, ids.runId, A, B],
    );
    await client.query(
      `INSERT INTO m02_review_states
         (id,group_id,resource_candidate_id,review_state,record_version,source_snapshot_id,controlling_job_id)
       VALUES ($1,$2,$3,'NOT_REQUIRED',1,$4,$5)`,
      [ids.reviewId, ids.groupId, ids.candidateId, ids.snapshotId, ids.jobId],
    );

    if (repositoryPresent) {
      await client.query(
        `INSERT INTO source_repository_identities
           (id,provider,provider_repository_id,created_at,record_version,
            first_observed_source_snapshot_id,origin_type,command_id,result_id,audit_event_id)
         VALUES ($1,'github','system-repo',now(),1,$2,'HUMAN_COMMAND','command-seed',
           'result-seed','audit-command-seed')`,
        [ids.sourceRepositoryId, ids.snapshotId],
      );
      await client.query(
        `INSERT INTO source_repository_urls
           (id,source_repository_id,provider,provider_repository_id,canonical_url,source_snapshot_id,
            observed_at,state,origin_type,command_id,result_id,audit_event_id)
         VALUES ($1,$2,'github','system-repo','https://github.com/system/repo',$3,now(),'ACTIVE',
           'HUMAN_COMMAND','command-seed','result-seed','audit-command-seed')`,
        [ids.sourceRepositoryUrlId, ids.sourceRepositoryId, ids.snapshotId],
      );
    }
    if (mode === "S8_JR")
      await client.query(
        `INSERT INTO source_repository_identities
           (id,provider,provider_repository_id,created_at,record_version,
            first_observed_source_snapshot_id,origin_type,command_id,result_id,audit_event_id)
         VALUES ($1,'github','source-origin',now(),1,$2,'HUMAN_COMMAND','command-seed',
           'result-seed','audit-command-seed')`,
        [ids.forkSourceRepositoryId, ids.snapshotId],
      );
    if (identityPresent) {
      await client.query(
        `INSERT INTO resource_identities
           (id,status,reliable_identity_token,reliable_token_evidence_id,created_at,record_version,
            guard_anchor_candidate_id,origin_type,command_id,result_id,audit_event_id)
         VALUES ($1,'ACTIVE','system-skill',$2,now(),1,$3,'HUMAN_COMMAND','command-seed',
           'result-seed','audit-command-seed')`,
        [ids.resourceIdentityId, ids.evidenceId, ids.candidateId],
      );
    }
    for (const [present, id, content, label] of [
      [exactVersionPresent, ids.exactResourceVersionId, A, "snapshot:0123456789ab"],
      [priorVersionPresent, ids.priorResourceVersionId, C, "snapshot:0123456789ac"],
    ] as const) {
      if (!present) continue;
      await client.query(
        `INSERT INTO resource_version_identities
           (id,resource_identity_id,content_fingerprint,canonical_payload,
            first_observed_source_snapshot_id,first_observed_candidate_root_id,
            first_observed_source_revision,observation_label,status,created_at,record_version,
            origin_type,command_id,result_id,audit_event_id)
         VALUES ($1,$2,$3,convert_to($7,'UTF8'),$4,$5,
           '0123456789abcdef0123456789abcdef01234567',$6,'IDENTITY_RESOLVED',now(),1,
           'HUMAN_COMMAND','command-seed','result-seed','audit-command-seed')`,
        [
          id,
          ids.resourceIdentityId,
          content,
          ids.snapshotId,
          ids.rootId,
          label,
          present === exactVersionPresent && id === ids.exactResourceVersionId
            ? '{"content":"system"}'
            : '{"content":"prior"}',
        ],
      );
    }
    if (mode.startsWith("S4_") || mode.startsWith("S5_")) {
      await client.query(
        `INSERT INTO external_identifiers
           (id,resource_identity_id,provider,identifier_type,issuer,namespace,normalized_value,
            normalization_policy_version,evidence_reference_id,canonical_key_hash,
            canonical_key_payload,provenance,review_state,record_version)
         VALUES ($1,$2,'github','DECLARED_MANIFEST_ID','github.com','system','system-skill',
           'external-id-v1',$3,$4,$5,'HUMAN_VERIFIED_SOURCE_DECLARATION',
           'VERIFIED',1)`,
        [
          ids.externalIdentifierId,
          ids.resourceIdentityId,
          ids.evidenceId,
          SYSTEM_EXTERNAL_IDENTIFIER_KEY.fingerprint,
          Buffer.from(SYSTEM_EXTERNAL_IDENTIFIER_KEY.canonicalPayload),
        ],
      );
    }
    if (sourceLinkPresent) {
      const target = mode.startsWith("S2_")
        ? ids.priorResourceVersionId
        : ids.exactResourceVersionId;
      await client.query(
        `INSERT INTO resource_source_links
           (id,source_repository_id,normalized_root_path,target_resource_version_id,relationship,
            evidence_ids,decision_id,reason,actor_id,created_at,state,record_version,
            origin_type,command_id,result_id,audit_event_id)
         VALUES ($1,$2,'.',$3,'PRIMARY',jsonb_build_array($4::text),'decision-seed','fixture continuity',
           'fixture-editor',now(),'ACTIVE',1,'HUMAN_COMMAND','command-seed','result-seed',
           'audit-command-seed')`,
        [ids.activeSourceLinkId, ids.sourceRepositoryId, target, ids.evidenceId],
      );
    }
    const retainedGuards: ReturnType<typeof canonicalGuard>[] = [];
    if (repositoryPresent)
      retainedGuards.push(
        canonicalGuard("SOURCE_REPOSITORY", {
          repositoryRef: { provider: "github", providerRepositoryId: "system-repo" },
        }),
      );
    if (mode === "S8_JR")
      retainedGuards.push(
        canonicalGuard("SOURCE_REPOSITORY", {
          repositoryRef: { provider: "github", providerRepositoryId: "source-origin" },
        }),
      );
    if (sourceLinkPresent)
      retainedGuards.push(
        canonicalGuard("RESOURCE_SOURCE", {
          provider: "github",
          providerRepositoryId: "system-repo",
          normalizedRootPath: ".",
        }),
      );
    for (const [present, contentFingerprint] of [
      [exactVersionPresent, A],
      [priorVersionPresent, C],
    ] as const) {
      if (!present) continue;
      retainedGuards.push(
        canonicalGuard("RESOURCE_VERSION", {
          resourceIdentityRef: {
            kind: "RESOURCE_IDENTITY_ANCHOR",
            originCandidateId: ids.candidateId,
          },
          contentFingerprint,
        }),
      );
    }
    for (const guard of retainedGuards)
      await client.query(
        `INSERT INTO m02_concurrency_guards
           (guard_key,guard_type,canonical_payload,payload_hash,record_version)
         VALUES ($1,$2,$3,$4,1) ON CONFLICT (guard_key) DO NOTHING`,
        [guard.key, guard.guardType, Buffer.from(guard.canonicalPayload), guard.payloadHash],
      );
    if (jr) {
      await client.query(
        `INSERT INTO candidate_roots
           (id,group_id,classification_run_id,source_snapshot_id,normalized_root_path,
            candidate_root_fingerprint,candidate_content_fingerprint,canonical_root_payload,
            canonical_content_payload,root_idempotency_key,state,record_version)
         VALUES ($1,$2,$3,$4,'sibling',$5,$6,convert_to('{"normalizedRootPath":"sibling"}','UTF8'),
           convert_to('{"content":"sibling"}','UTF8'),'system-sibling-root','ACTIVE',1)`,
        [ids.siblingRootId, ids.groupId, ids.runId, ids.snapshotId, C, B],
      );
      await client.query(
        `INSERT INTO repository_candidate_root_order
           (id,group_id,classification_run_id,candidate_root_id,source_snapshot_id,root_ordinal,created_at)
         VALUES ($1,$2,$3,$4,$5,1,now())`,
        [ids.siblingRootOrderId, ids.groupId, ids.runId, ids.siblingRootId, ids.snapshotId],
      );
      await client.query(
        `INSERT INTO resource_candidates
           (id,source_snapshot_id,candidate_root_id,candidate_root_fingerprint,
            candidate_content_fingerprint,reconciled_classification_run_id,
            classification_policy_version,identity_policy_version,ordered_provenance,
            candidate_idempotency_key,status,created_at,updated_at,record_version)
         VALUES ($1,$2,$3,$4,$5,$6,'classification-v1','identity-v1','[]','system-sibling-candidate',
           'CLASSIFIED',now(),now(),1)`,
        [ids.siblingCandidateId, ids.snapshotId, ids.siblingRootId, C, B, ids.runId],
      );
      await client.query(
        `INSERT INTO m02_review_states
           (id,group_id,resource_candidate_id,review_state,record_version,source_snapshot_id,controlling_job_id)
         VALUES ($1,$2,$3,'NOT_REQUIRED',1,$4,$5)`,
        [ids.siblingReviewId, ids.groupId, ids.siblingCandidateId, ids.snapshotId, ids.jobId],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return {
    snapshotId: ids.snapshotId,
    candidateId: ids.candidateId,
    rootId: ids.rootId,
    runId: ids.runId,
    evidenceId: ids.evidenceId,
    reviewId: ids.reviewId,
    jobId: ids.jobId,
    sourceRepositoryId: ids.sourceRepositoryId,
    resourceIdentityId: ids.resourceIdentityId,
    exactResourceVersionId: ids.exactResourceVersionId,
    priorResourceVersionId: ids.priorResourceVersionId,
    activeSourceLinkId: ids.activeSourceLinkId,
    siblingCandidateId: jr ? ids.siblingCandidateId : null,
  };
}

/** Converts an accepted initial SYSTEM projection into the exact reachable replacement-controller pre-state. */
export async function seedM02SystemReanalysisGraph(
  pool: Pool,
  schema: string,
  fixture: M02SystemIdentityFixture,
  mode: "S9_JC" | "S9_JR" | "S10_JR",
  replacementReasonCode:
    "POLICY_OR_METHODOLOGY_CHANGE" | "RETRY_EXHAUSTED" = "POLICY_OR_METHODOLOGY_CHANGE",
): Promise<M02SystemIdentityFixture> {
  if (!/^[a-z][a-z0-9_]{0,62}$/u.test(schema)) throw new Error("INVALID_SCHEMA");
  const replacementInputPayload = Buffer.from(
    canonicalJson({
      schemaVersion: "1",
      jobLineageId: "lineage-system",
      sourceJobId: fixture.jobId,
      sourceOperationScope: "IDENTITY_RESOLUTION",
      requestedOperationScope: "IDENTITY_RESOLUTION",
      predecessorJobIds: [fixture.jobId],
      sourceSnapshotId: fixture.snapshotId,
      replacementSourceSnapshotIdOrNull: null,
      classificationPolicyVersion: "classification-v1",
      identityPolicyVersion: "identity-v1",
      analysisPolicyVersion: "analysis-v2",
      parserProfileVersion: "parser-v1",
      promptBundleVersion: "prompt-v1",
      analysisProviderAdapterIdOrNull: null,
      analysisModelIdOrNull: null,
      analysisMethodologyVersionOrNull: null,
      controllingClassificationDecisionIdOrNull: fixture.runId,
    }),
    "utf8",
  );
  const replacementInputFingerprint = createHash("sha256")
    .update(replacementInputPayload)
    .digest("hex");
  const fullPayload = {
    auditId: "00000000-0000-7000-8000-000000004051",
    analysisPolicyVersion: "analysis-v2",
    classificationPolicyVersion: "classification-v1",
    identityPolicyVersion: "identity-v1",
    promptBundleVersion: "prompt-v1",
    replacementInputFingerprint,
    replacementJobId: SYSTEM_FIXTURE_IDS.replacementJobId,
    requestedOperationScope: "IDENTITY_RESOLUTION",
    sourceJobId: fixture.jobId,
  };
  const payload = Object.fromEntries(
    manualResolutionPayloadKeys("REPLACE_M02_JOB", undefined, false, false).map((key) => [
      key,
      fullPayload[key as keyof typeof fullPayload],
    ]),
  ) as Record<string, string>;
  const provisional: ManualResolutionEnvelope = {
    commandId: "00000000-0000-7000-8000-000000004052",
    requestId: "00000000-0000-7000-8000-000000004053",
    idempotencyKey: `system-reanalysis-${mode.toLowerCase()}`,
    actorId: "m02-fixture-admin",
    actorRole: "ADMIN",
    command: "REPLACE_M02_JOB",
    targetCandidateId: fixture.candidateId,
    targetGroupId: SYSTEM_FIXTURE_IDS.groupId,
    expectedVersions: {},
    reasonCode: replacementReasonCode,
    reason:
      replacementReasonCode === "RETRY_EXHAUSTED"
        ? "Replace the review-blocked identity controller after its retry was exhausted."
        : "Re-run identity resolution under the changed analysis policy.",
    evidenceIds: [fixture.evidenceId],
    decisionIds: [],
    timestamp: "2026-08-22T00:00:00.000Z",
    payload,
  };
  const adapter = new PostgresManualResolutionAdapter(pool, { schema });
  const command: ManualResolutionEnvelope = {
    ...provisional,
    expectedVersions: { ...(await adapter.discoverRequiredCurrentExpectations(provisional)) },
  };
  await adapter.execute(command);
  const replacement = await pool.query<{ id: string }>(
    `SELECT id FROM ${schema}.m02_jobs
     WHERE replacement_source_job_id=$1 AND supersession_state='CONTROLLING'`,
    [fixture.jobId],
  );
  const replacementJobId = replacement.rows[0]?.id;
  if (replacementJobId === undefined) throw new Error("SYSTEM_REANALYSIS_REPLACEMENT_MISSING");
  await pool.query(
    `UPDATE ${schema}.m02_jobs
     SET current_stage='RESOLVING_IDENTITY',review_state='RESOLVED',record_version=record_version+1
     WHERE id=$1`,
    [replacementJobId],
  );
  await pool.query(
    `INSERT INTO ${schema}.acquisition_results (job_id,source_snapshot_id,result,created_at)
     VALUES ($1,$2,jsonb_build_object(
       'sourceReference',jsonb_build_object(
         'id','system-source-reference','provider','github',
         'canonicalUrl','https://github.com/system/repo','owner','system','repository','repo'),
       'identityDiscovery',jsonb_build_object(
       'reliableIdentityTokenOrNull',$3::text,
       'providerDeclaredForkRepositoryIdOrNull',NULL,
       'trustedExternalIdentifierOrNull',$4::jsonb
     )),now())`,
    [
      replacementJobId,
      fixture.snapshotId,
      mode === "S10_JR" ? "changed-system-skill" : "system-skill",
      mode === "S10_JR" ? JSON.stringify(CHANGED_SYSTEM_EXTERNAL_IDENTIFIER_KEY.payload) : null,
    ],
  );
  if (mode === "S9_JR") {
    await pool.query(
      `INSERT INTO ${schema}.candidate_roots
         (id,group_id,classification_run_id,source_snapshot_id,normalized_root_path,
          candidate_root_fingerprint,candidate_content_fingerprint,canonical_root_payload,
          canonical_content_payload,root_idempotency_key,state,record_version)
       VALUES ($1,$2,$3,$4,'skills/unresolved',$5,$6,
         convert_to('{"normalizedRootPath":"skills/unresolved"}','UTF8'),
         convert_to('{"content":"unresolved"}','UTF8'),'system-reanalysis-root-key','ACTIVE',1)`,
      [
        SYSTEM_FIXTURE_IDS.siblingRootId,
        SYSTEM_FIXTURE_IDS.groupId,
        fixture.runId,
        fixture.snapshotId,
        C,
        B,
      ],
    );
    await pool.query(
      `INSERT INTO ${schema}.repository_candidate_root_order
         (id,group_id,classification_run_id,candidate_root_id,source_snapshot_id,root_ordinal,created_at)
       VALUES ($1,$2,$3,$4,$5,1,now())`,
      [
        SYSTEM_FIXTURE_IDS.siblingRootOrderId,
        SYSTEM_FIXTURE_IDS.groupId,
        fixture.runId,
        SYSTEM_FIXTURE_IDS.siblingRootId,
        fixture.snapshotId,
      ],
    );
    await pool.query(
      `INSERT INTO ${schema}.resource_candidates
         (id,source_snapshot_id,candidate_root_id,candidate_root_fingerprint,
          candidate_content_fingerprint,reconciled_classification_run_id,
          classification_policy_version,identity_policy_version,ordered_provenance,
          candidate_idempotency_key,status,created_at,updated_at,record_version)
       VALUES ($1,$2,$3,$4,$5,$6,'classification-v1','identity-v1','[]',
         'system-reanalysis-candidate-key','CLASSIFIED',now(),now(),1)`,
      [
        SYSTEM_FIXTURE_IDS.siblingCandidateId,
        fixture.snapshotId,
        SYSTEM_FIXTURE_IDS.siblingRootId,
        C,
        B,
        fixture.runId,
      ],
    );
    await pool.query(
      `INSERT INTO ${schema}.repository_group_relationships
         (id,parent_group_id,child_candidate_id,relationship_type,relationship_order)
       VALUES ($1,$2,$3,'INCLUDES',1)`,
      [
        "00000000-0000-7000-8000-000000004025",
        SYSTEM_FIXTURE_IDS.groupId,
        SYSTEM_FIXTURE_IDS.siblingCandidateId,
      ],
    );
    await pool.query(
      `INSERT INTO ${schema}.m02_review_states
         (id,group_id,resource_candidate_id,review_state,record_version,source_snapshot_id,controlling_job_id)
       VALUES ($1,$2,$3,'NOT_REQUIRED',1,$4,$5)`,
      [
        SYSTEM_FIXTURE_IDS.siblingReviewId,
        SYSTEM_FIXTURE_IDS.groupId,
        SYSTEM_FIXTURE_IDS.siblingCandidateId,
        fixture.snapshotId,
        replacementJobId,
      ],
    );
  }
  if (mode === "S10_JR") {
    await pool.query(
      `INSERT INTO ${schema}.m02_audit_events
         (id,origin_type,command_id,result_id,actor_type,actor_id,actor_role,action,
          subject_type,subject_id,request_id,idempotency_scope,idempotency_key,reason_code,
          reason_text,after_version,after_state,metadata_schema_version,metadata,
          source_snapshot_id,controlling_job_id,occurred_at)
       VALUES ('00000000-0000-7000-8000-000000004056','HUMAN_COMMAND','command-seed',
         'result-seed','HUMAN','fixture-editor','EDITOR','SUBJECT_CREATED','RESOURCE_IDENTITY',
         '00000000-0000-7000-8000-000000004054','request-seed','M02','fixture-seed',
         'IDENTITY_AMBIGUITY_RESOLVED','Canonical PostgreSQL fixture seed',1,
         '{"recordVersion":1,"status":"ACTIVE"}','1','{}',$1,$2,now())`,
      [fixture.snapshotId, fixture.jobId],
    );
    await pool.query(
      `INSERT INTO ${schema}.resource_identities
         (id,status,reliable_identity_token,reliable_token_evidence_id,created_at,record_version,
          guard_anchor_candidate_id,origin_type,command_id,result_id,audit_event_id)
       VALUES ($1,'ACTIVE','changed-system-skill',$2,now(),1,$3,'HUMAN_COMMAND','command-seed',
         'result-seed','00000000-0000-7000-8000-000000004056')`,
      ["00000000-0000-7000-8000-000000004054", fixture.evidenceId, fixture.candidateId],
    );
    await pool.query(
      `INSERT INTO ${schema}.external_identifiers
         (id,resource_identity_id,provider,identifier_type,issuer,namespace,normalized_value,
          normalization_policy_version,evidence_reference_id,canonical_key_hash,
          canonical_key_payload,provenance,review_state,record_version)
       VALUES ($1,$2,'github','DECLARED_MANIFEST_ID','github.com','system',
         'changed-system-skill','external-id-v1',$3,$4,$5,
         'HUMAN_VERIFIED_SOURCE_DECLARATION','VERIFIED',1)`,
      [
        "00000000-0000-7000-8000-000000004055",
        "00000000-0000-7000-8000-000000004054",
        fixture.evidenceId,
        CHANGED_SYSTEM_EXTERNAL_IDENTIFIER_KEY.fingerprint,
        Buffer.from(CHANGED_SYSTEM_EXTERNAL_IDENTIFIER_KEY.canonicalPayload),
      ],
    );
  }
  return { ...fixture, jobId: replacementJobId };
}
