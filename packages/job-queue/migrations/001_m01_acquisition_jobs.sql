-- M01 only: durable acquisition stages and immutable snapshot identity.
CREATE TABLE source_snapshots (
  id text PRIMARY KEY,
  identity_key text NOT NULL UNIQUE,
  provider text NOT NULL,
  provider_repository_id text NOT NULL,
  immutable_revision text NOT NULL,
  acquisition_policy_version text NOT NULL,
  acquired_at timestamptz NOT NULL
);

CREATE TABLE acquisition_jobs (
  id text PRIMARY KEY,
  submission_id text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL CHECK (
    status IN ('ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED', 'OPERATOR_REVIEW_REQUIRED')
  ),
  current_stage text NOT NULL CHECK (
    current_stage IN ('RECEIVED', 'VALIDATING_SOURCE', 'ACQUIRING_SOURCE', 'INVENTORYING_SOURCE')
  ),
  attempt integer NOT NULL CHECK (attempt > 0),
  source_snapshot_id text REFERENCES source_snapshots(id),
  completed_stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  failure jsonb,
  cancellation_requested boolean NOT NULL DEFAULT false,
  record_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE acquisition_results (
  job_id text PRIMARY KEY REFERENCES acquisition_jobs(id),
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL
);
