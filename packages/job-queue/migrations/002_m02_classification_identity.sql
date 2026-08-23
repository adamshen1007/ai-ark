-- M02 only: durable classification, identity resolution, review, and job supersession.
-- Forward-only by design. Corrections require a later reviewed migration.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE FUNCTION m02_canonical_json(value jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  result text;
BEGIN
  CASE jsonb_typeof(value)
    WHEN 'null' THEN RETURN 'null';
    WHEN 'boolean' THEN RETURN value::text;
    WHEN 'number' THEN
      IF value::text !~ '^-?(0|[1-9][0-9]*)$' THEN
        RETURN NULL;
      END IF;
      RETURN value::text;
    WHEN 'string' THEN RETURN to_jsonb(value #>> '{}')::text;
    WHEN 'array' THEN
      SELECT '[' || COALESCE(string_agg(m02_canonical_json(item), ',' ORDER BY ordinal), '') || ']'
      INTO result
      FROM jsonb_array_elements(value) WITH ORDINALITY AS element(item, ordinal);
      RETURN result;
    WHEN 'object' THEN
      SELECT '{' || COALESCE(
        string_agg(to_jsonb(key)::text || ':' || m02_canonical_json(item), ',' ORDER BY convert_to(key, 'UTF8')),
        ''
      ) || '}'
      INTO result
      FROM jsonb_each(value) AS member(key, item);
      RETURN result;
    ELSE
      RETURN NULL;
  END CASE;
END;
$$;

CREATE FUNCTION m02_payload_is_canonical_json(payload bytea) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  decoded text;
  parsed jsonb;
  canonical text;
BEGIN
  decoded := convert_from(payload, 'UTF8');
  parsed := decoded::jsonb;
  canonical := m02_canonical_json(parsed);
  RETURN canonical IS NOT NULL AND decoded = canonical;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE FUNCTION m02_payload_matches_json(payload bytea, authority jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT m02_payload_is_canonical_json(payload)
    AND payload = convert_to(m02_canonical_json(authority), 'UTF8');
$$;

CREATE FUNCTION m02_jsonb_has_exact_keys(value jsonb, required_keys text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT jsonb_typeof(value) = 'object'
    AND value ?& required_keys
    AND value - required_keys = '{}'::jsonb;
$$;

CREATE FUNCTION m02_jsonb_nonempty_string(value jsonb, key_name text) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT jsonb_typeof(value->key_name) = 'string'
    AND octet_length(value->>key_name) BETWEEN 1 AND 2000;
$$;

CREATE FUNCTION m02_resource_identity_guard_ref_valid(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT m02_jsonb_has_exact_keys(value, ARRAY['kind', 'originCandidateId'])
    AND value->>'kind' = 'RESOURCE_IDENTITY_ANCHOR'
    AND m02_jsonb_nonempty_string(value, 'originCandidateId');
$$;

CREATE FUNCTION m02_resource_version_guard_ref_valid(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT m02_jsonb_has_exact_keys(
      value, ARRAY['kind', 'resourceIdentityRef', 'contentFingerprint']
    )
    AND value->>'kind' = 'RESOURCE_VERSION_ANCHOR'
    AND m02_resource_identity_guard_ref_valid(value->'resourceIdentityRef')
    AND jsonb_typeof(value->'contentFingerprint') = 'string'
    AND value->>'contentFingerprint' ~ '^[0-9a-f]{64}$';
$$;

CREATE FUNCTION m02_source_repository_guard_ref_valid(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT m02_jsonb_has_exact_keys(value, ARRAY['provider', 'providerRepositoryId'])
    AND m02_jsonb_nonempty_string(value, 'provider')
    AND m02_jsonb_nonempty_string(value, 'providerRepositoryId');
$$;

CREATE FUNCTION m02_source_link_guard_ref_valid(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT m02_jsonb_has_exact_keys(
      value, ARRAY['provider', 'providerRepositoryId', 'normalizedRootPath']
    )
    AND m02_jsonb_nonempty_string(value, 'provider')
    AND m02_jsonb_nonempty_string(value, 'providerRepositoryId')
    AND m02_jsonb_nonempty_string(value, 'normalizedRootPath');
$$;

CREATE FUNCTION m02_relationship_endpoint_guard_ref_valid(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT CASE value->>'kind'
    WHEN 'CANDIDATE' THEN
      m02_jsonb_has_exact_keys(value, ARRAY['kind', 'candidateId'])
      AND m02_jsonb_nonempty_string(value, 'candidateId')
    WHEN 'RESOURCE_VERSION' THEN
      m02_jsonb_has_exact_keys(value, ARRAY['kind', 'versionRef'])
      AND m02_resource_version_guard_ref_valid(value->'versionRef')
    WHEN 'SOURCE_REPOSITORY' THEN
      m02_jsonb_has_exact_keys(value, ARRAY['kind', 'repositoryRef'])
      AND m02_source_repository_guard_ref_valid(value->'repositoryRef')
    ELSE false
  END;
$$;

CREATE FUNCTION m02_guard_payload_valid(expected_guard_type text, payload bytea) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  value jsonb;
  components jsonb;
BEGIN
  IF NOT m02_payload_is_canonical_json(payload) THEN
    RETURN false;
  END IF;
  value := convert_from(payload, 'UTF8')::jsonb;
  IF NOT m02_jsonb_has_exact_keys(value, ARRAY['guardType', 'components'])
    OR value->>'guardType' <> expected_guard_type
    OR jsonb_typeof(value->'components') <> 'object'
  THEN
    RETURN false;
  END IF;
  components := value->'components';

  RETURN CASE expected_guard_type
    WHEN 'GROUP_KEY' THEN
      m02_jsonb_has_exact_keys(components, ARRAY['sourceSnapshotId', 'classificationPolicyVersion'])
      AND m02_jsonb_nonempty_string(components, 'sourceSnapshotId')
      AND m02_jsonb_nonempty_string(components, 'classificationPolicyVersion')
    WHEN 'GROUP_MEMBERSHIP' THEN
      m02_jsonb_has_exact_keys(components, ARRAY['predecessorGroupId'])
      AND m02_jsonb_nonempty_string(components, 'predecessorGroupId')
    WHEN 'ROOT_KEY' THEN
      m02_jsonb_has_exact_keys(components, ARRAY['sourceSnapshotId', 'rootFingerprint', 'contentFingerprint'])
      AND m02_jsonb_nonempty_string(components, 'sourceSnapshotId')
      AND components->>'rootFingerprint' ~ '^[0-9a-f]{64}$'
      AND components->>'contentFingerprint' ~ '^[0-9a-f]{64}$'
    WHEN 'CANDIDATE_KEY' THEN
      m02_jsonb_has_exact_keys(components, ARRAY['sourceSnapshotId', 'rootFingerprint', 'contentFingerprint'])
      AND m02_jsonb_nonempty_string(components, 'sourceSnapshotId')
      AND components->>'rootFingerprint' ~ '^[0-9a-f]{64}$'
      AND components->>'contentFingerprint' ~ '^[0-9a-f]{64}$'
    WHEN 'RESOURCE_SOURCE' THEN
      m02_jsonb_has_exact_keys(components, ARRAY['provider', 'providerRepositoryId', 'normalizedRootPath'])
      AND m02_jsonb_nonempty_string(components, 'provider')
      AND m02_jsonb_nonempty_string(components, 'providerRepositoryId')
      AND m02_jsonb_nonempty_string(components, 'normalizedRootPath')
    WHEN 'SOURCE_REPOSITORY' THEN
      m02_jsonb_has_exact_keys(components, ARRAY['repositoryRef'])
      AND m02_source_repository_guard_ref_valid(components->'repositoryRef')
    WHEN 'RESOURCE_VERSION' THEN
      m02_jsonb_has_exact_keys(components, ARRAY['resourceIdentityRef', 'contentFingerprint'])
      AND m02_resource_identity_guard_ref_valid(components->'resourceIdentityRef')
      AND components->>'contentFingerprint' ~ '^[0-9a-f]{64}$'
    WHEN 'OBSERVATION' THEN
      m02_jsonb_has_exact_keys(
        components,
        ARRAY['resourceVersionRef', 'sourceSnapshotId', 'candidateRootId', 'sourceLinkRef']
      )
      AND m02_resource_version_guard_ref_valid(components->'resourceVersionRef')
      AND m02_jsonb_nonempty_string(components, 'sourceSnapshotId')
      AND m02_jsonb_nonempty_string(components, 'candidateRootId')
      AND m02_source_link_guard_ref_valid(components->'sourceLinkRef')
    WHEN 'DUPLICATE_DISPOSITION' THEN
      m02_jsonb_has_exact_keys(components, ARRAY['candidateId'])
      AND m02_jsonb_nonempty_string(components, 'candidateId')
    WHEN 'DUPLICATE_PROPOSAL_SET' THEN
      m02_jsonb_has_exact_keys(components, ARRAY['candidateId'])
      AND m02_jsonb_nonempty_string(components, 'candidateId')
    WHEN 'DUPLICATE_PROPOSAL_PAIR' THEN
      m02_jsonb_has_exact_keys(components, ARRAY['candidateId', 'targetVersionRef'])
      AND m02_jsonb_nonempty_string(components, 'candidateId')
      AND m02_resource_version_guard_ref_valid(components->'targetVersionRef')
    WHEN 'FORK_LINEAGE' THEN
      m02_jsonb_has_exact_keys(components, ARRAY['forkVersionRef'])
      AND m02_resource_version_guard_ref_valid(components->'forkVersionRef')
    WHEN 'MIRROR_LINEAGE' THEN
      m02_jsonb_has_exact_keys(components, ARRAY['mirrorRepositoryRef'])
      AND m02_source_repository_guard_ref_valid(components->'mirrorRepositoryRef')
    WHEN 'RELATIONSHIP_PAIR' THEN
      m02_jsonb_has_exact_keys(
        components, ARRAY['relationshipType', 'sourceEndpointRef', 'targetEndpointRef']
      )
      AND components->>'relationshipType' IN ('DUPLICATE_OF', 'FORK_OF', 'MIRROR_OF')
      AND m02_relationship_endpoint_guard_ref_valid(components->'sourceEndpointRef')
      AND m02_relationship_endpoint_guard_ref_valid(components->'targetEndpointRef')
    WHEN 'CLARIFICATION_OPEN' THEN
      m02_jsonb_has_exact_keys(components, ARRAY['reviewId', 'questionCode'])
      AND m02_jsonb_nonempty_string(components, 'reviewId')
      AND m02_jsonb_nonempty_string(components, 'questionCode')
    WHEN 'CLARIFICATION_TARGET' THEN
      m02_jsonb_has_exact_keys(components, ARRAY['targetType', 'targetId'])
      AND components->>'targetType' IN ('RESOURCE_CANDIDATE', 'CANDIDATE_GROUP', 'IDENTITY_DECISION')
      AND m02_jsonb_nonempty_string(components, 'targetId')
    WHEN 'REJECTION_DECISION' THEN
      m02_jsonb_has_exact_keys(components, ARRAY['candidateId'])
      AND m02_jsonb_nonempty_string(components, 'candidateId')
    WHEN 'HANDOFF' THEN
      m02_jsonb_has_exact_keys(components, ARRAY['candidateId'])
      AND m02_jsonb_nonempty_string(components, 'candidateId')
    WHEN 'JOB_SCOPE_CONTROLLER' THEN
      m02_jsonb_has_exact_keys(components, ARRAY['jobLineageId', 'operationScope'])
      AND m02_jsonb_nonempty_string(components, 'jobLineageId')
      AND components->>'operationScope' IN ('CLASSIFICATION', 'IDENTITY_RESOLUTION', 'FULL_PIPELINE')
    WHEN 'JOB_REPLACEMENT_INPUT' THEN
      m02_jsonb_has_exact_keys(
        components, ARRAY['sourceJobId', 'requestedScope', 'replacementInputFingerprint']
      )
      AND m02_jsonb_nonempty_string(components, 'sourceJobId')
      AND components->>'requestedScope' IN ('CLASSIFICATION', 'IDENTITY_RESOLUTION', 'FULL_PIPELINE')
      AND components->>'replacementInputFingerprint' ~ '^[0-9a-f]{64}$'
    ELSE false
  END;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE FUNCTION m02_uuid_array_is_canonical(value uuid[]) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT array_position(value, NULL) IS NULL
    AND cardinality(value) = (SELECT count(DISTINCT item) FROM unnest(value) AS item)
    AND NOT EXISTS (
      SELECT 1
      FROM (
        SELECT ordinal, convert_to(item::text, 'UTF8') AS sort_key,
          lag(convert_to(item::text, 'UTF8')) OVER (ORDER BY ordinal) AS prior_key
        FROM unnest(value) WITH ORDINALITY AS member(item, ordinal)
      ) ordered_items
      WHERE prior_key IS NOT NULL AND prior_key >= sort_key
    );
$$;

CREATE FUNCTION m02_text_array_is_canonical(value text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT array_position(value, NULL) IS NULL
    AND cardinality(value) = (SELECT count(DISTINCT item) FROM unnest(value) AS item)
    AND NOT EXISTS (
      SELECT 1
      FROM (
        SELECT ordinal, convert_to(item, 'UTF8') AS sort_key,
          lag(convert_to(item, 'UTF8')) OVER (ORDER BY ordinal) AS prior_key
        FROM unnest(value) WITH ORDINALITY AS member(item, ordinal)
      ) ordered_items
      WHERE octet_length(convert_from(sort_key, 'UTF8')) NOT BETWEEN 1 AND 2000
        OR (prior_key IS NOT NULL AND prior_key >= sort_key)
    );
$$;

CREATE FUNCTION m02_tier_sequence_valid(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT jsonb_typeof(value) = 'array'
    AND jsonb_array_length(value) = 6
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(value) WITH ORDINALITY AS tier(item, ordinal)
      WHERE NOT m02_jsonb_has_exact_keys(item, ARRAY['tier', 'evaluationDisposition'])
        OR item->>'tier' <> ('P' || ordinal::text)
        OR item->>'evaluationDisposition' NOT IN (
          'MATCH', 'NO_MATCH', 'CONFLICT', 'MULTIPLE_TARGETS', 'NOT_APPLICABLE'
        )
        OR (ordinal = 1 AND item->>'evaluationDisposition' = 'NOT_APPLICABLE')
        OR (
          item->>'evaluationDisposition' <> 'NOT_APPLICABLE'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(value) WITH ORDINALITY AS earlier(prior_item, prior_ordinal)
            WHERE prior_ordinal < ordinal
              AND prior_item->>'evaluationDisposition' = 'NOT_APPLICABLE'
          )
        )
    );
$$;

CREATE FUNCTION m02_audit_state_valid(value text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  parsed jsonb;
BEGIN
  IF value IS NULL THEN RETURN true; END IF;
  IF octet_length(value) > 16384 THEN RETURN false; END IF;
  IF NOT m02_payload_is_canonical_json(convert_to(value, 'UTF8')) THEN RETURN false; END IF;
  parsed := value::jsonb;
  RETURN jsonb_typeof(parsed) = 'object'
    AND parsed - ARRAY[
      'state', 'status', 'reviewState', 'currentStage', 'recordVersion',
      'identityOutcome',
      'resourceIdentityId', 'resourceVersionIdentityId', 'sourceRepositoryId',
      'targetResourceVersionId', 'supersededById', 'supersededByDecisionId',
      'supersededByHandoffMarkerId', 'supersededByJobId', 'terminalReasonCode'
    ] = '{}'::jsonb;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE FUNCTION m02_replacement_metadata_shape_valid(subject_name text, value jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT CASE subject_name
    WHEN 'ROOT_REPLACEMENT' THEN CASE value->>'replacementKind'
      WHEN 'CREATED' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'successorRootId'])
        AND m02_jsonb_nonempty_string(value, 'successorRootId')
      WHEN 'OVERRIDE' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'successorRootId'])
        AND m02_jsonb_nonempty_string(value, 'successorRootId')
      WHEN 'RETIRED' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'predecessorRootId'])
        AND m02_jsonb_nonempty_string(value, 'predecessorRootId')
      WHEN 'SPLIT' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'predecessorRootId', 'successorRootId'])
        AND m02_jsonb_nonempty_string(value, 'predecessorRootId')
        AND m02_jsonb_nonempty_string(value, 'successorRootId')
      WHEN 'MERGE' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'predecessorRootId', 'successorRootId'])
        AND m02_jsonb_nonempty_string(value, 'predecessorRootId')
        AND m02_jsonb_nonempty_string(value, 'successorRootId')
      WHEN 'RETAINED' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'predecessorRootId', 'successorRootId'])
        AND m02_jsonb_nonempty_string(value, 'predecessorRootId')
        AND m02_jsonb_nonempty_string(value, 'successorRootId')
      WHEN 'REASSIGNED' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'predecessorRootId', 'successorRootId'])
        AND m02_jsonb_nonempty_string(value, 'predecessorRootId')
        AND m02_jsonb_nonempty_string(value, 'successorRootId')
      ELSE false END
    WHEN 'CANDIDATE_REPLACEMENT' THEN CASE value->>'replacementKind'
      WHEN 'CREATED' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'successorCandidateId'])
        AND m02_jsonb_nonempty_string(value, 'successorCandidateId')
      WHEN 'OVERRIDE' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'successorCandidateId'])
        AND m02_jsonb_nonempty_string(value, 'successorCandidateId')
      WHEN 'RETIRED' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'predecessorCandidateId'])
        AND m02_jsonb_nonempty_string(value, 'predecessorCandidateId')
      WHEN 'SPLIT' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'predecessorCandidateId', 'successorCandidateId'])
        AND m02_jsonb_nonempty_string(value, 'predecessorCandidateId')
        AND m02_jsonb_nonempty_string(value, 'successorCandidateId')
      WHEN 'MERGE' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'predecessorCandidateId', 'successorCandidateId'])
        AND m02_jsonb_nonempty_string(value, 'predecessorCandidateId')
        AND m02_jsonb_nonempty_string(value, 'successorCandidateId')
      WHEN 'RETAINED' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'predecessorCandidateId', 'successorCandidateId'])
        AND m02_jsonb_nonempty_string(value, 'predecessorCandidateId')
        AND m02_jsonb_nonempty_string(value, 'successorCandidateId')
      WHEN 'REASSIGNED' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'predecessorCandidateId', 'successorCandidateId'])
        AND m02_jsonb_nonempty_string(value, 'predecessorCandidateId')
        AND m02_jsonb_nonempty_string(value, 'successorCandidateId')
      ELSE false END
    WHEN 'OWNERSHIP_REPLACEMENT' THEN CASE value->>'replacementKind'
      WHEN 'CREATED' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'successorOwnershipId'])
        AND m02_jsonb_nonempty_string(value, 'successorOwnershipId')
      WHEN 'RETIRED' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'predecessorOwnershipId'])
        AND m02_jsonb_nonempty_string(value, 'predecessorOwnershipId')
      WHEN 'RETAINED' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'predecessorOwnershipId', 'successorOwnershipId'])
        AND m02_jsonb_nonempty_string(value, 'predecessorOwnershipId')
        AND m02_jsonb_nonempty_string(value, 'successorOwnershipId')
      WHEN 'REASSIGNED' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'predecessorOwnershipId', 'successorOwnershipId'])
        AND m02_jsonb_nonempty_string(value, 'predecessorOwnershipId')
        AND m02_jsonb_nonempty_string(value, 'successorOwnershipId')
      ELSE false END
    WHEN 'GROUP_EDGE_REPLACEMENT' THEN CASE value->>'replacementKind'
      WHEN 'CREATED' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'successorEdgeId'])
        AND m02_jsonb_nonempty_string(value, 'successorEdgeId')
      WHEN 'RETIRED' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'predecessorEdgeId'])
        AND m02_jsonb_nonempty_string(value, 'predecessorEdgeId')
      WHEN 'RETAINED' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'predecessorEdgeId', 'successorEdgeId'])
        AND m02_jsonb_nonempty_string(value, 'predecessorEdgeId')
        AND m02_jsonb_nonempty_string(value, 'successorEdgeId')
      WHEN 'REASSIGNED' THEN m02_jsonb_has_exact_keys(value, ARRAY['replacementKind', 'predecessorEdgeId', 'successorEdgeId'])
        AND m02_jsonb_nonempty_string(value, 'predecessorEdgeId')
        AND m02_jsonb_nonempty_string(value, 'successorEdgeId')
      ELSE false END
    ELSE false
  END;
$$;

CREATE FUNCTION m02_audit_metadata_valid(
  action_name text, subject_name text, origin_name text, value jsonb
) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT jsonb_typeof(value) = 'object'
    AND octet_length(m02_canonical_json(value)) <= 16384
    AND (
      (action_name = 'COMMAND_ACCEPTED' AND value = '{}'::jsonb)
      OR (action_name = 'SYSTEM_OPERATION_ACCEPTED'
        AND origin_name = 'SYSTEM_IDENTITY_OPERATION'
        AND subject_name = 'SYSTEM_IDENTITY_OPERATION'
        AND m02_jsonb_has_exact_keys(
          value,
          ARRAY['evaluatedTierSequence', 'automaticProjectorModeId', 'identityDecisionInputFingerprint']
        )
        AND m02_tier_sequence_valid(value->'evaluatedTierSequence')
        AND value->>'identityDecisionInputFingerprint' ~ '^[0-9a-f]{64}$')
      OR (action_name LIKE 'SUBJECT_%'
        AND (
          (subject_name = 'IDENTITY_DECISION' AND origin_name = 'SYSTEM_IDENTITY_OPERATION'
            AND m02_jsonb_has_exact_keys(
              value,
              ARRAY['evaluatedTierSequence', 'automaticProjectorModeId', 'identityDecisionInputFingerprint']
            )
            AND m02_tier_sequence_valid(value->'evaluatedTierSequence')
            AND value->>'identityDecisionInputFingerprint' ~ '^[0-9a-f]{64}$')
          OR (subject_name = 'IDENTITY_DECISION' AND origin_name = 'HUMAN_COMMAND'
            AND m02_jsonb_has_exact_keys(value, ARRAY['evaluatedTierSequence'])
            AND m02_tier_sequence_valid(value->'evaluatedTierSequence'))
          OR (subject_name IN ('ROOT_REPLACEMENT', 'CANDIDATE_REPLACEMENT',
              'OWNERSHIP_REPLACEMENT', 'GROUP_EDGE_REPLACEMENT')
            AND action_name = 'SUBJECT_CREATED'
            AND origin_name = 'HUMAN_COMMAND'
            AND m02_replacement_metadata_shape_valid(subject_name, value))
          OR (subject_name IN ('FORK_RELATIONSHIP', 'SOURCE_REPOSITORY_RELATIONSHIP')
            AND m02_jsonb_has_exact_keys(
              value, ARRAY['relationshipType', 'sourceEndpointId', 'targetEndpointId']
            )
            AND value->>'relationshipType' IN ('FORK_OF', 'MIRROR_OF'))
          OR (subject_name = 'M02_CLARIFICATION_REQUEST'
            AND m02_jsonb_has_exact_keys(
              value, ARRAY['clarificationTargetType', 'clarificationTargetId']
            ))
          OR (action_name = 'SUBJECT_SUPERSEDED'
            AND m02_jsonb_has_exact_keys(value, ARRAY['successorId']))
          OR (subject_name = 'M02_JOB'
            AND m02_jsonb_has_exact_keys(value, ARRAY['scope', 'guardKey']))
          OR (value = '{}'::jsonb AND subject_name IN (
            'REPOSITORY_CANDIDATE_GROUP', 'REPOSITORY_CLASSIFICATION_RUN', 'CANDIDATE_ROOT',
            'CANDIDATE_ROOT_OWNERSHIP', 'REPOSITORY_CANDIDATE_ROOT_ORDER',
            'REPOSITORY_GROUP_RELATIONSHIP', 'RESOURCE_CANDIDATE', 'RESOURCE_IDENTITY',
            'RESOURCE_VERSION_IDENTITY', 'SOURCE_REPOSITORY_IDENTITY', 'SOURCE_REPOSITORY_URL',
            'RESOURCE_SOURCE_LINK', 'RESOURCE_VERSION_OBSERVATION', 'DUPLICATE_CANDIDATE',
            'IDENTITY_DECISION_TIER_EVALUATION', 'IDENTITY_DECISION_SIGNAL',
            'IDENTITY_DECISION_SIGNAL_EVIDENCE', 'IDENTITY_DECISION_CONFLICT',
            'IDENTITY_DECISION_CONFLICT_TARGET', 'IDENTITY_DECISION_CONFLICT_EVIDENCE',
            'M02_REVIEW_STATE', 'M02_REJECTION_DECISION', 'M02_IDENTITY_HANDOFF',
            'ACQUISITION_JOB'
          ))
        ))
    );
$$;

CREATE FUNCTION m02_expected_versions_valid(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(value) = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_each(value) AS entry(key, version)
      WHERE jsonb_typeof(version) NOT IN ('number', 'null')
        OR (
          jsonb_typeof(version) = 'number'
          AND (
            version::text !~ '^[1-9][0-9]*$'
            OR (version::text)::numeric > 9007199254740991
          )
        )
    );
$$;

CREATE FUNCTION m02_system_rejection_targets_valid(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(value) = 'array'
    AND jsonb_array_length(value) <= 128
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(value) WITH ORDINALITY AS target(item, ordinal)
      WHERE jsonb_typeof(item) <> 'object'
        OR item - ARRAY['targetType', 'targetValue'] <> '{}'::jsonb
        OR item->>'targetType' NOT IN (
          'RESOURCE_CANDIDATE', 'REVIEW_STATE', 'ACQUISITION_JOB', 'M02_JOB',
          'IDENTITY_DECISION', 'HANDOFF', 'CLARIFICATION_REQUEST', 'CONCURRENCY_GUARD',
          'RESOURCE_IDENTITY', 'RESOURCE_VERSION', 'SOURCE_REPOSITORY', 'SOURCE_LINK',
          'OBSERVATION', 'DUPLICATE_CANDIDATE'
        )
        OR jsonb_typeof(item->'targetValue') <> 'string'
        OR octet_length(item->>'targetValue') NOT BETWEEN 1 AND 2000
    )
    AND NOT EXISTS (
      SELECT 1
      FROM (
        SELECT ordinal,
          convert_to((item->>'targetType') || E'\\x1f' || (item->>'targetValue'), 'UTF8') AS sort_key,
          lag(convert_to((item->>'targetType') || E'\\x1f' || (item->>'targetValue'), 'UTF8'))
            OVER (ORDER BY ordinal) AS prior_key
        FROM jsonb_array_elements(value) WITH ORDINALITY AS target(item, ordinal)
      ) ordered_targets
      WHERE prior_key IS NOT NULL AND prior_key >= sort_key
    );
$$;

ALTER TABLE source_snapshots
ADD CONSTRAINT source_snapshots_id_provider_repository_unique
UNIQUE (id, provider, provider_repository_id);

ALTER TABLE source_snapshots
ADD CONSTRAINT source_snapshots_id_revision_unique UNIQUE (id, immutable_revision);

CREATE TABLE m01_source_entries (
  id text PRIMARY KEY,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  original_path text NOT NULL,
  normalized_path text,
  entry_kind text NOT NULL CHECK (entry_kind IN ('file', 'symlink', 'submodule')),
  byte_length bigint NOT NULL CHECK (byte_length >= 0),
  disposition text NOT NULL CHECK (disposition IN ('SELECTED', 'ACQUIRED', 'SKIPPED', 'QUARANTINED', 'REJECTED')),
  reason_codes jsonb NOT NULL CHECK (jsonb_typeof(reason_codes) = 'array'),
  content_fingerprint text CHECK (content_fingerprint IS NULL OR content_fingerprint ~ '^[0-9a-f]{64}$'),
  UNIQUE (source_snapshot_id, normalized_path),
  UNIQUE (id, source_snapshot_id)
);

CREATE TABLE m01_source_documents (
  id text PRIMARY KEY,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  source_entry_id text NOT NULL REFERENCES m01_source_entries(id) ON DELETE RESTRICT,
  document_type text NOT NULL CHECK (document_type = 'UTF8_TEXT'),
  encoding text NOT NULL CHECK (encoding = 'utf-8'),
  line_count bigint NOT NULL CHECK (line_count >= 0),
  content_fingerprint text NOT NULL CHECK (content_fingerprint ~ '^[0-9a-f]{64}$'),
  UNIQUE (source_snapshot_id, source_entry_id, document_type),
  UNIQUE (id, source_snapshot_id),
  FOREIGN KEY (source_entry_id, source_snapshot_id)
    REFERENCES m01_source_entries(id, source_snapshot_id) ON DELETE RESTRICT
);

-- Materialize the immutable M01 evidence projection required by M02. The M01 result remains
-- untouched and authoritative; these rows are restrictive-FK targets for classification evidence.
INSERT INTO m01_source_entries (
  id,
  source_snapshot_id,
  original_path,
  normalized_path,
  entry_kind,
  byte_length,
  disposition,
  reason_codes,
  content_fingerprint
)
SELECT
  entry->>'id',
  acquisition_result.source_snapshot_id,
  entry->>'originalPath',
  entry->>'normalizedPath',
  entry->>'entryType',
  (entry->>'byteLength')::bigint,
  entry->>'disposition',
  COALESCE(entry->'reasonCodes', '[]'::jsonb),
  entry->>'sha256'
FROM acquisition_results acquisition_result
CROSS JOIN LATERAL jsonb_array_elements(acquisition_result.result->'entries') AS entry
ON CONFLICT (id) DO NOTHING;

INSERT INTO m01_source_documents (
  id,
  source_snapshot_id,
  source_entry_id,
  document_type,
  encoding,
  line_count,
  content_fingerprint
)
SELECT
  document->>'id',
  acquisition_result.source_snapshot_id,
  document->>'sourceEntryId',
  'UTF8_TEXT',
  document->>'encoding',
  (document->>'lineCount')::bigint,
  document->>'contentHash'
FROM acquisition_results acquisition_result
CROSS JOIN LATERAL jsonb_array_elements(acquisition_result.result->'documents') AS document
WHERE document->>'contentHash' ~ '^[0-9a-f]{64}$'
ON CONFLICT (id) DO NOTHING;

CREATE TABLE repository_candidate_groups (
  id text PRIMARY KEY,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  classification_policy_version text NOT NULL,
  group_key text NOT NULL,
  group_fingerprint text NOT NULL CHECK (group_fingerprint ~ '^[0-9a-f]{64}$'),
  classification text NOT NULL CHECK (classification IN ('SINGLE_SKILL', 'MULTIPLE_SKILLS', 'SKILL_COLLECTION', 'SKILL_PLUS_APPLICATION', 'NON_SKILL', 'AMBIGUOUS', 'UNSUPPORTED')),
  confidence numeric CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  ordered_candidate_root_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(ordered_candidate_root_ids) = 'array'),
  ordered_evidence_reference_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(ordered_evidence_reference_ids) = 'array'),
  ordered_warning_codes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(ordered_warning_codes) = 'array'),
  ordered_reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(ordered_reason_codes) = 'array'),
  review_state text NOT NULL DEFAULT 'NOT_REQUIRED' CHECK (review_state IN ('NOT_REQUIRED', 'CLASSIFICATION_REVIEW_REQUIRED', 'IDENTITY_REVIEW_REQUIRED', 'CLARIFICATION_REQUESTED', 'RESOLVED', 'REJECTED')),
  identity_policy_version text NOT NULL,
  parser_profile_version text NOT NULL,
  analysis_policy_version text NOT NULL,
  prompt_bundle_version text NOT NULL,
  state text NOT NULL CHECK (state IN ('ACTIVE', 'SUPERSEDED')),
  supersedes_group_id text REFERENCES repository_candidate_groups(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL,
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
  UNIQUE (id, source_snapshot_id)
);

CREATE UNIQUE INDEX repository_candidate_groups_one_active_key
ON repository_candidate_groups (group_key) WHERE state = 'ACTIVE';

CREATE TABLE analysis_runs (
  id text PRIMARY KEY,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  operation text NOT NULL CHECK (operation = 'CLASSIFY_REPOSITORY'),
  provider_id text NOT NULL,
  adapter_id text NOT NULL,
  model_or_fake_id text NOT NULL,
  prompt_bundle_version text NOT NULL,
  classification_policy_version text NOT NULL,
  identity_policy_version text NOT NULL,
  analysis_policy_version text NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  response_fingerprint text CHECK (response_fingerprint IS NULL OR response_fingerprint ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('SUCCEEDED', 'INVALID_OUTPUT', 'LIMIT_EXCEEDED', 'TIMED_OUT', 'FAILED')),
  temperature numeric CHECK (temperature IS NULL OR temperature BETWEEN 0 AND 1),
  validation_repair_outcome text NOT NULL,
  repair_count integer NOT NULL CHECK (repair_count BETWEEN 0 AND 1),
  provider_attempt_count integer NOT NULL CHECK (provider_attempt_count BETWEEN 0 AND 2),
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  attempt integer NOT NULL CHECK (attempt > 0),
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  bounded_usage jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(bounded_usage) = 'object'),
  created_at timestamptz NOT NULL,
  UNIQUE (id, source_snapshot_id),
  UNIQUE (id, source_snapshot_id, request_fingerprint, response_fingerprint)
);

CREATE TABLE repository_classification_runs (
  id text PRIMARY KEY,
  group_id text NOT NULL REFERENCES repository_candidate_groups(id) ON DELETE RESTRICT,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  analysis_run_id text REFERENCES analysis_runs(id) ON DELETE RESTRICT,
  run_source text NOT NULL CHECK (run_source IN ('DETERMINISTIC', 'AI_ASSISTED', 'RECONCILED', 'HUMAN_OVERRIDE')),
  classification text NOT NULL CHECK (classification IN ('SINGLE_SKILL', 'MULTIPLE_SKILLS', 'SKILL_COLLECTION', 'SKILL_PLUS_APPLICATION', 'NON_SKILL', 'AMBIGUOUS', 'UNSUPPORTED')),
  confidence numeric CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  ordered_candidate_root_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(ordered_candidate_root_ids) = 'array'),
  ordered_evidence_reference_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(ordered_evidence_reference_ids) = 'array'),
  ordered_warning_codes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(ordered_warning_codes) = 'array'),
  ordered_reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(ordered_reason_codes) = 'array'),
  review_state text NOT NULL DEFAULT 'NOT_REQUIRED' CHECK (review_state IN ('NOT_REQUIRED', 'CLASSIFICATION_REVIEW_REQUIRED', 'IDENTITY_REVIEW_REQUIRED', 'CLARIFICATION_REQUESTED', 'RESOLVED', 'REJECTED')),
  classification_policy_version text NOT NULL,
  identity_policy_version text NOT NULL,
  analysis_policy_version text NOT NULL,
  prompt_bundle_version text NOT NULL,
  parser_profile_version text NOT NULL,
  methodology_version text NOT NULL,
  input_fingerprint text NOT NULL CHECK (input_fingerprint ~ '^[0-9a-f]{64}$'),
  output_fingerprint text NOT NULL CHECK (output_fingerprint ~ '^[0-9a-f]{64}$'),
  supersedes_run_id text REFERENCES repository_classification_runs(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL,
  UNIQUE (id, source_snapshot_id),
  UNIQUE (id, group_id, source_snapshot_id),
  UNIQUE (id, source_snapshot_id, input_fingerprint, output_fingerprint),
  FOREIGN KEY (group_id, source_snapshot_id)
    REFERENCES repository_candidate_groups(id, source_snapshot_id) ON DELETE RESTRICT,
  FOREIGN KEY (analysis_run_id, source_snapshot_id)
    REFERENCES analysis_runs(id, source_snapshot_id) ON DELETE RESTRICT
);

CREATE TABLE classification_evidence_references (
  id text PRIMARY KEY,
  classification_run_id text NOT NULL REFERENCES repository_classification_runs(id) ON DELETE RESTRICT,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  source_entry_id text REFERENCES m01_source_entries(id) ON DELETE RESTRICT,
  source_document_id text REFERENCES m01_source_documents(id) ON DELETE RESTRICT,
  evidence_order integer NOT NULL CHECK (evidence_order >= 0),
  CHECK (source_entry_id IS NOT NULL OR source_document_id IS NOT NULL),
  UNIQUE (classification_run_id, evidence_order),
  FOREIGN KEY (classification_run_id, source_snapshot_id)
    REFERENCES repository_classification_runs(id, source_snapshot_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_entry_id, source_snapshot_id)
    REFERENCES m01_source_entries(id, source_snapshot_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_document_id, source_snapshot_id)
    REFERENCES m01_source_documents(id, source_snapshot_id) ON DELETE RESTRICT
);

CREATE TABLE candidate_roots (
  id text PRIMARY KEY,
  group_id text NOT NULL REFERENCES repository_candidate_groups(id) ON DELETE RESTRICT,
  classification_run_id text NOT NULL REFERENCES repository_classification_runs(id) ON DELETE RESTRICT,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  normalized_root_path text NOT NULL,
  candidate_root_fingerprint text NOT NULL CHECK (candidate_root_fingerprint ~ '^[0-9a-f]{64}$'),
  candidate_content_fingerprint text NOT NULL CHECK (candidate_content_fingerprint ~ '^[0-9a-f]{64}$'),
  canonical_root_payload bytea NOT NULL,
  canonical_content_payload bytea NOT NULL,
  root_idempotency_key text NOT NULL UNIQUE,
  state text NOT NULL CHECK (state IN ('ACTIVE', 'SUPERSEDED')),
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
  UNIQUE (id, source_snapshot_id),
  UNIQUE (id, source_snapshot_id, classification_run_id),
  UNIQUE (id, source_snapshot_id, normalized_root_path),
  UNIQUE (
    id,
    source_snapshot_id,
    classification_run_id,
    candidate_root_fingerprint,
    candidate_content_fingerprint
  ),
  FOREIGN KEY (classification_run_id, group_id, source_snapshot_id)
    REFERENCES repository_classification_runs(id, group_id, source_snapshot_id) ON DELETE RESTRICT
);

CREATE TABLE candidate_root_ownership (
  id text PRIMARY KEY,
  candidate_root_id text NOT NULL REFERENCES candidate_roots(id) ON DELETE RESTRICT,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  source_entry_id text NOT NULL REFERENCES m01_source_entries(id) ON DELETE RESTRICT,
  ownership text NOT NULL CHECK (ownership IN ('OWNED', 'SHARED', 'EXCLUDED')),
  UNIQUE (candidate_root_id, source_entry_id),
  UNIQUE (id, source_entry_id),
  FOREIGN KEY (candidate_root_id, source_snapshot_id)
    REFERENCES candidate_roots(id, source_snapshot_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_entry_id, source_snapshot_id)
    REFERENCES m01_source_entries(id, source_snapshot_id) ON DELETE RESTRICT
);

CREATE TABLE repository_candidate_root_order (
  id text PRIMARY KEY,
  group_id text NOT NULL REFERENCES repository_candidate_groups(id) ON DELETE RESTRICT,
  classification_run_id text NOT NULL REFERENCES repository_classification_runs(id) ON DELETE RESTRICT,
  candidate_root_id text NOT NULL REFERENCES candidate_roots(id) ON DELETE RESTRICT,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  root_ordinal integer NOT NULL CHECK (root_ordinal >= 0),
  created_at timestamptz NOT NULL,
  UNIQUE (group_id, root_ordinal),
  UNIQUE (group_id, candidate_root_id),
  FOREIGN KEY (classification_run_id, group_id, source_snapshot_id)
    REFERENCES repository_classification_runs(id, group_id, source_snapshot_id) ON DELETE RESTRICT
);

CREATE TABLE resource_identities (
  id text PRIMARY KEY,
  resource_type text NOT NULL DEFAULT 'SKILL' CHECK (resource_type = 'SKILL'),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'AMBIGUOUS', 'REJECTED')),
  reliable_identity_token text,
  reliable_token_evidence_id text,
  created_at timestamptz NOT NULL,
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
  CHECK ((reliable_identity_token IS NULL) = (reliable_token_evidence_id IS NULL)),
  CHECK (reliable_identity_token IS NULL OR octet_length(reliable_identity_token) BETWEEN 1 AND 2000)
);

CREATE TABLE resource_version_identities (
  id text PRIMARY KEY,
  resource_identity_id text NOT NULL REFERENCES resource_identities(id) ON DELETE RESTRICT,
  content_fingerprint text NOT NULL CHECK (content_fingerprint ~ '^[0-9a-f]{64}$'),
  canonical_payload bytea NOT NULL,
  first_observed_source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  first_observed_candidate_root_id text NOT NULL REFERENCES candidate_roots(id) ON DELETE RESTRICT,
  first_observed_source_revision text NOT NULL,
  observation_label text NOT NULL CHECK (observation_label ~ '^snapshot:[0-9a-f]{12}$'),
  status text NOT NULL CHECK (status IN ('IDENTITY_RESOLVED', 'SUPERSEDED', 'REJECTED')),
  created_at timestamptz NOT NULL,
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
  UNIQUE (resource_identity_id, content_fingerprint),
  UNIQUE (id, resource_identity_id),
  FOREIGN KEY (first_observed_source_snapshot_id, first_observed_source_revision)
    REFERENCES source_snapshots(id, immutable_revision) ON DELETE RESTRICT,
  FOREIGN KEY (first_observed_candidate_root_id, first_observed_source_snapshot_id)
    REFERENCES candidate_roots(id, source_snapshot_id) ON DELETE RESTRICT
);

CREATE TABLE resource_candidates (
  id text PRIMARY KEY,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  candidate_root_id text NOT NULL REFERENCES candidate_roots(id) ON DELETE RESTRICT,
  candidate_root_fingerprint text NOT NULL CHECK (candidate_root_fingerprint ~ '^[0-9a-f]{64}$'),
  candidate_content_fingerprint text NOT NULL CHECK (candidate_content_fingerprint ~ '^[0-9a-f]{64}$'),
  reconciled_classification_run_id text NOT NULL REFERENCES repository_classification_runs(id) ON DELETE RESTRICT,
  classification_policy_version text NOT NULL,
  identity_policy_version text NOT NULL,
  identity_outcome text CHECK (identity_outcome IS NULL OR identity_outcome IN ('NEW_RESOURCE', 'EXACT_REPEAT_REUSE', 'EXISTING_RESOURCE_NEW_VERSION', 'AMBIGUOUS_IDENTITY', 'POSSIBLE_DUPLICATE', 'FORK_OF_EXISTING_RESOURCE', 'MIRROR')),
  identity_confidence numeric CHECK (identity_confidence IS NULL OR identity_confidence BETWEEN 0 AND 1),
  ordered_provenance jsonb NOT NULL CHECK (jsonb_typeof(ordered_provenance) = 'array'),
  candidate_idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('CLASSIFIED', 'IDENTITY_REVIEW_REQUIRED', 'IDENTITY_RESOLVED', 'REJECTED', 'SUPERSEDED')),
  resource_identity_id text REFERENCES resource_identities(id) ON DELETE RESTRICT,
  resource_version_identity_id text REFERENCES resource_version_identities(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
  CHECK (
    (status = 'IDENTITY_RESOLVED' AND resource_identity_id IS NOT NULL AND resource_version_identity_id IS NOT NULL)
    OR (status = 'IDENTITY_REVIEW_REQUIRED' AND (
      (resource_identity_id IS NULL AND resource_version_identity_id IS NULL)
      OR (identity_outcome = 'AMBIGUOUS_IDENTITY'
        AND resource_identity_id IS NOT NULL AND resource_version_identity_id IS NOT NULL)
    ))
    OR (status NOT IN ('IDENTITY_RESOLVED', 'IDENTITY_REVIEW_REQUIRED')
      AND resource_identity_id IS NULL AND resource_version_identity_id IS NULL)
  ),
  UNIQUE (id, resource_identity_id, resource_version_identity_id),
  UNIQUE (id, source_snapshot_id),
  UNIQUE (id, source_snapshot_id, reconciled_classification_run_id),
  UNIQUE (id, source_snapshot_id, resource_identity_id, resource_version_identity_id),
  FOREIGN KEY (
    candidate_root_id,
    source_snapshot_id,
    reconciled_classification_run_id,
    candidate_root_fingerprint,
    candidate_content_fingerprint
  ) REFERENCES candidate_roots (
    id,
    source_snapshot_id,
    classification_run_id,
    candidate_root_fingerprint,
    candidate_content_fingerprint
  ) ON DELETE RESTRICT,
  FOREIGN KEY (resource_version_identity_id, resource_identity_id)
    REFERENCES resource_version_identities(id, resource_identity_id) ON DELETE RESTRICT
);

ALTER TABLE resource_identities
ADD COLUMN guard_anchor_candidate_id text NOT NULL REFERENCES resource_candidates(id) ON DELETE RESTRICT,
ADD CONSTRAINT resource_identities_id_anchor_unique UNIQUE (id, guard_anchor_candidate_id);

CREATE TABLE repository_group_relationships (
  id text PRIMARY KEY,
  parent_group_id text NOT NULL REFERENCES repository_candidate_groups(id) ON DELETE RESTRICT,
  child_candidate_id text NOT NULL REFERENCES resource_candidates(id) ON DELETE RESTRICT,
  relationship_type text NOT NULL CHECK (relationship_type IN ('INCLUDES', 'BUNDLES')),
  relationship_order integer NOT NULL CHECK (relationship_order >= 0),
  UNIQUE (parent_group_id, relationship_type, relationship_order, child_candidate_id)
);

CREATE TABLE source_repository_identities (
  id text PRIMARY KEY,
  provider text NOT NULL,
  provider_repository_id text NOT NULL,
  created_at timestamptz NOT NULL,
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
  first_observed_source_snapshot_id text NOT NULL,
  UNIQUE (provider, provider_repository_id),
  UNIQUE (id, provider, provider_repository_id),
  FOREIGN KEY (first_observed_source_snapshot_id, provider, provider_repository_id)
    REFERENCES source_snapshots(id, provider, provider_repository_id) ON DELETE RESTRICT
);

CREATE TABLE source_repository_urls (
  id text PRIMARY KEY,
  source_repository_id text NOT NULL REFERENCES source_repository_identities(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  provider_repository_id text NOT NULL,
  canonical_url text NOT NULL,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  observed_at timestamptz NOT NULL,
  supersedes_url_id text REFERENCES source_repository_urls(id) ON DELETE RESTRICT,
  state text NOT NULL CHECK (state IN ('ACTIVE', 'SUPERSEDED')),
  UNIQUE (source_repository_id, canonical_url, source_snapshot_id),
  UNIQUE (id, source_repository_id),
  FOREIGN KEY (source_repository_id, provider, provider_repository_id)
    REFERENCES source_repository_identities(id, provider, provider_repository_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_snapshot_id, provider, provider_repository_id)
    REFERENCES source_snapshots(id, provider, provider_repository_id) ON DELETE RESTRICT,
  FOREIGN KEY (supersedes_url_id, source_repository_id)
    REFERENCES source_repository_urls(id, source_repository_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX source_repository_urls_one_active
ON source_repository_urls (source_repository_id) WHERE state = 'ACTIVE';

CREATE TABLE external_identifiers (
  id text PRIMARY KEY,
  resource_identity_id text NOT NULL REFERENCES resource_identities(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider = 'github'),
  identifier_type text NOT NULL CHECK (identifier_type IN ('PROVIDER_REPOSITORY_ID', 'DECLARED_MANIFEST_ID')),
  issuer text NOT NULL,
  namespace text NOT NULL,
  normalized_value text NOT NULL,
  normalization_policy_version text NOT NULL CHECK (normalization_policy_version = 'external-id-v1'),
  evidence_reference_id text NOT NULL REFERENCES classification_evidence_references(id) ON DELETE RESTRICT,
  canonical_key_hash text NOT NULL CHECK (canonical_key_hash ~ '^[0-9a-f]{64}$'),
  canonical_key_payload bytea NOT NULL,
  provenance text NOT NULL CHECK (provenance IN ('M01_PROVIDER_ASSERTED', 'HUMAN_VERIFIED_SOURCE_DECLARATION')),
  review_state text NOT NULL CHECK (review_state IN ('UNREVIEWED', 'VERIFIED', 'REJECTED', 'SUPERSEDED')),
  supersedes_identifier_id text REFERENCES external_identifiers(id) ON DELETE RESTRICT,
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
  CHECK (octet_length(normalized_value) BETWEEN 1 AND 2000),
  CONSTRAINT external_identifiers_namespace_canonical CHECK (
    namespace ~ '^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$'
  ),
  CONSTRAINT external_identifiers_issuer_canonical CHECK (
    issuer ~ '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$'
      AND issuer !~ '\.\.' AND issuer !~ '^[0-9.]+$'
  ),
  CONSTRAINT external_identifiers_canonical_key_valid CHECK (
    m02_payload_matches_json(
      canonical_key_payload,
      jsonb_build_object(
        'provider', provider,
        'issuer', issuer,
        'namespace', namespace,
        'identifierType', identifier_type,
        'normalizedValue', normalized_value,
        'normalizationPolicyVersion', normalization_policy_version
      )
    )
    AND encode(digest(canonical_key_payload, 'sha256'), 'hex') = canonical_key_hash
  )
);

CREATE UNIQUE INDEX external_identifiers_one_active_scoped_key
ON external_identifiers (
  provider,
  namespace,
  identifier_type,
  issuer,
  normalized_value,
  normalization_policy_version
)
WHERE review_state IN ('UNREVIEWED', 'VERIFIED');

CREATE TABLE resource_source_links (
  id text PRIMARY KEY,
  source_repository_id text NOT NULL REFERENCES source_repository_identities(id) ON DELETE RESTRICT,
  normalized_root_path text NOT NULL,
  target_resource_version_id text NOT NULL REFERENCES resource_version_identities(id) ON DELETE RESTRICT,
  relationship text NOT NULL CHECK (relationship IN ('PRIMARY', 'ALTERNATE')),
  evidence_ids jsonb NOT NULL CHECK (jsonb_typeof(evidence_ids) = 'array'),
  decision_id text NOT NULL,
  reason text NOT NULL CHECK (octet_length(reason) BETWEEN 1 AND 2000),
  actor_id text NOT NULL,
  created_at timestamptz NOT NULL,
  state text NOT NULL CHECK (state IN ('ACTIVE', 'SUPERSEDED')),
  supersedes_source_link_id text REFERENCES resource_source_links(id) ON DELETE RESTRICT,
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
  UNIQUE (id, source_repository_id, target_resource_version_id),
  UNIQUE (id, source_repository_id, normalized_root_path, target_resource_version_id)
);

CREATE UNIQUE INDEX resource_source_links_one_active_binding
ON resource_source_links (source_repository_id, normalized_root_path) WHERE state = 'ACTIVE';

CREATE TABLE resource_version_observations (
  id text PRIMARY KEY,
  resource_version_identity_id text NOT NULL REFERENCES resource_version_identities(id) ON DELETE RESTRICT,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  candidate_root_id text NOT NULL REFERENCES candidate_roots(id) ON DELETE RESTRICT,
  resource_source_link_id text NOT NULL REFERENCES resource_source_links(id) ON DELETE RESTRICT,
  source_repository_id text NOT NULL REFERENCES source_repository_identities(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  provider_repository_id text NOT NULL,
  normalized_root_path text NOT NULL,
  immutable_revision text NOT NULL,
  observed_at timestamptz NOT NULL,
  UNIQUE (resource_version_identity_id, source_snapshot_id, candidate_root_id, resource_source_link_id),
  FOREIGN KEY (source_snapshot_id, immutable_revision)
    REFERENCES source_snapshots(id, immutable_revision) ON DELETE RESTRICT,
  FOREIGN KEY (source_snapshot_id, provider, provider_repository_id)
    REFERENCES source_snapshots(id, provider, provider_repository_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_repository_id, provider, provider_repository_id)
    REFERENCES source_repository_identities(id, provider, provider_repository_id) ON DELETE RESTRICT,
  FOREIGN KEY (candidate_root_id, source_snapshot_id, normalized_root_path)
    REFERENCES candidate_roots(id, source_snapshot_id, normalized_root_path) ON DELETE RESTRICT,
  FOREIGN KEY (
    resource_source_link_id,
    source_repository_id,
    normalized_root_path,
    resource_version_identity_id
  ) REFERENCES resource_source_links (
    id,
    source_repository_id,
    normalized_root_path,
    target_resource_version_id
  ) ON DELETE RESTRICT
);

CREATE TABLE duplicate_candidates (
  id text PRIMARY KEY,
  resource_candidate_id text NOT NULL REFERENCES resource_candidates(id) ON DELETE RESTRICT,
  target_resource_version_id text NOT NULL REFERENCES resource_version_identities(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('PROPOSED', 'CONFIRMED', 'REJECTED', 'SUPERSEDED')),
  evidence_ids jsonb NOT NULL CHECK (jsonb_typeof(evidence_ids) = 'array'),
  decision_id text NOT NULL,
  reason text NOT NULL CHECK (octet_length(reason) BETWEEN 1 AND 2000),
  actor_id text NOT NULL,
  created_at timestamptz NOT NULL,
  supersedes_duplicate_id text REFERENCES duplicate_candidates(id) ON DELETE RESTRICT,
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0)
);

CREATE UNIQUE INDEX duplicate_candidates_one_active_disposition
ON duplicate_candidates (resource_candidate_id) WHERE status = 'CONFIRMED';

CREATE FUNCTION enforce_duplicate_content_equality() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  candidate_content text;
  version_content text;
BEGIN
  IF NEW.status = 'CONFIRMED' THEN
    SELECT candidate_content_fingerprint INTO candidate_content
    FROM resource_candidates WHERE id = NEW.resource_candidate_id;
    SELECT content_fingerprint INTO version_content
    FROM resource_version_identities WHERE id = NEW.target_resource_version_id;
    IF candidate_content IS NULL OR version_content IS NULL OR candidate_content <> version_content THEN
      RAISE EXCEPTION 'DUPLICATE_CONTENT_MISMATCH';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER duplicate_candidates_content_guard
BEFORE INSERT OR UPDATE ON duplicate_candidates
FOR EACH ROW EXECUTE FUNCTION enforce_duplicate_content_equality();

CREATE UNIQUE INDEX duplicate_candidates_one_active_pair
ON duplicate_candidates (resource_candidate_id, target_resource_version_id)
WHERE status = 'CONFIRMED';

CREATE UNIQUE INDEX duplicate_candidates_one_active_proposal_set
ON duplicate_candidates (resource_candidate_id)
WHERE status = 'PROPOSED';

CREATE UNIQUE INDEX duplicate_candidates_one_active_proposal_pair
ON duplicate_candidates (resource_candidate_id, target_resource_version_id)
WHERE status = 'PROPOSED';

CREATE TABLE fork_relationships (
  id text PRIMARY KEY,
  fork_resource_version_id text NOT NULL REFERENCES resource_version_identities(id) ON DELETE RESTRICT,
  origin_resource_version_id text NOT NULL REFERENCES resource_version_identities(id) ON DELETE RESTRICT,
  state text NOT NULL CHECK (state IN ('ACTIVE', 'REJECTED', 'SUPERSEDED')),
  evidence_ids jsonb NOT NULL CHECK (jsonb_typeof(evidence_ids) = 'array'),
  decision_id text NOT NULL,
  reason text NOT NULL CHECK (octet_length(reason) BETWEEN 1 AND 2000),
  actor_id text NOT NULL,
  created_at timestamptz NOT NULL,
  supersedes_relationship_id text REFERENCES fork_relationships(id) ON DELETE RESTRICT,
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
  CHECK (fork_resource_version_id <> origin_resource_version_id)
);

CREATE UNIQUE INDEX fork_relationships_one_active_origin
ON fork_relationships (fork_resource_version_id) WHERE state = 'ACTIVE';

CREATE TABLE source_repository_relationships (
  id text PRIMARY KEY,
  mirror_source_repository_id text NOT NULL REFERENCES source_repository_identities(id) ON DELETE RESTRICT,
  origin_source_repository_id text NOT NULL REFERENCES source_repository_identities(id) ON DELETE RESTRICT,
  state text NOT NULL CHECK (state IN ('ACTIVE', 'REJECTED', 'SUPERSEDED')),
  target_resource_version_id text NOT NULL REFERENCES resource_version_identities(id) ON DELETE RESTRICT,
  delivery_source_link_id text NOT NULL,
  evidence_ids jsonb NOT NULL CHECK (jsonb_typeof(evidence_ids) = 'array'),
  decision_id text NOT NULL,
  reason text NOT NULL CHECK (octet_length(reason) BETWEEN 1 AND 2000),
  actor_id text NOT NULL,
  created_at timestamptz NOT NULL,
  supersedes_relationship_id text REFERENCES source_repository_relationships(id) ON DELETE RESTRICT,
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
  CHECK (mirror_source_repository_id <> origin_source_repository_id),
  FOREIGN KEY (
    delivery_source_link_id,
    mirror_source_repository_id,
    target_resource_version_id
  ) REFERENCES resource_source_links (
    id,
    source_repository_id,
    target_resource_version_id
  ) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX source_repository_relationships_one_active_origin
ON source_repository_relationships (mirror_source_repository_id) WHERE state = 'ACTIVE';

CREATE TABLE identity_decisions (
  id text PRIMARY KEY,
  resource_candidate_id text NOT NULL REFERENCES resource_candidates(id) ON DELETE RESTRICT,
  outcome text NOT NULL CHECK (outcome IN ('NEW_RESOURCE', 'EXACT_REPEAT_REUSE', 'EXISTING_RESOURCE_NEW_VERSION', 'AMBIGUOUS_IDENTITY', 'POSSIBLE_DUPLICATE', 'FORK_OF_EXISTING_RESOURCE', 'MIRROR')),
  matched_tier text CHECK (matched_tier IS NULL OR matched_tier IN ('P1', 'P2', 'P3', 'P4', 'P5', 'P6')),
  confidence numeric CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  identity_policy_version text NOT NULL,
  decision_source text NOT NULL CHECK (decision_source IN ('DETERMINISTIC', 'AI_ASSISTED', 'HUMAN_COMMAND')),
  signals jsonb NOT NULL CHECK (jsonb_typeof(signals) = 'array'),
  rejected_lower_tier_signals jsonb NOT NULL CHECK (jsonb_typeof(rejected_lower_tier_signals) = 'array'),
  conflicts jsonb NOT NULL CHECK (jsonb_typeof(conflicts) = 'array'),
  audit_fingerprint text NOT NULL CHECK (audit_fingerprint ~ '^[0-9a-f]{64}$'),
  state text NOT NULL CHECK (state IN ('ACTIVE', 'SUPERSEDED')),
  supersedes_decision_id text REFERENCES identity_decisions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL,
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
  UNIQUE (id, resource_candidate_id)
);

CREATE UNIQUE INDEX identity_decisions_one_active_decision
ON identity_decisions (resource_candidate_id) WHERE state = 'ACTIVE';

ALTER TABLE resource_source_links
ADD CONSTRAINT resource_source_links_decision_fk FOREIGN KEY (decision_id) REFERENCES identity_decisions(id) ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE duplicate_candidates
ADD CONSTRAINT duplicate_candidates_decision_fk FOREIGN KEY (decision_id) REFERENCES identity_decisions(id) ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fork_relationships
ADD CONSTRAINT fork_relationships_decision_fk FOREIGN KEY (decision_id) REFERENCES identity_decisions(id) ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE source_repository_relationships
ADD CONSTRAINT source_repository_relationships_decision_fk FOREIGN KEY (decision_id) REFERENCES identity_decisions(id) ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

CREATE TABLE manual_resolution_commands (
  id text PRIMARY KEY,
  request_id text NOT NULL,
  command_type text NOT NULL CHECK (command_type IN ('CREATE_RESOURCE', 'ATTACH_NEW_VERSION', 'MARK_FORK', 'MARK_MIRROR', 'MARK_DUPLICATE', 'REJECT_CANDIDATE', 'SPLIT_ROOTS', 'MERGE_ROOTS', 'OVERRIDE_NON_SKILL', 'REQUEST_CLARIFICATION', 'RESOLVE_AMBIGUITY', 'REPLACE_M02_JOB')),
  idempotency_scope text NOT NULL,
  idempotency_key text NOT NULL,
  actor_id text NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('ADMIN', 'EDITOR', 'TECHNICAL_REVIEWER')),
  expected_versions jsonb NOT NULL CHECK (m02_expected_versions_valid(expected_versions)),
  caller_expected_versions_payload bytea NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  result_fingerprint text CHECK (result_fingerprint IS NULL OR result_fingerprint ~ '^[0-9a-f]{64}$'),
  reason_code text NOT NULL,
  reason text NOT NULL CHECK (octet_length(reason) BETWEEN 1 AND 2000),
  target_candidate_id text,
  target_group_id text,
  evidence_ids jsonb CHECK (evidence_ids IS NULL OR jsonb_typeof(evidence_ids) = 'array'),
  decision_ids jsonb CHECK (decision_ids IS NULL OR jsonb_typeof(decision_ids) = 'array'),
  command_payload jsonb CHECK (command_payload IS NULL OR jsonb_typeof(command_payload) = 'object'),
  request_payload bytea NOT NULL,
  result_payload jsonb CHECK (result_payload IS NULL OR jsonb_typeof(result_payload) = 'object'),
  isolation_level text NOT NULL DEFAULT 'SERIALIZABLE' CHECK (isolation_level = 'SERIALIZABLE'),
  created_at timestamptz NOT NULL,
  CHECK (m02_payload_matches_json(caller_expected_versions_payload, expected_versions)),
  CHECK (m02_payload_is_canonical_json(request_payload)),
  CHECK (encode(digest(request_payload, 'sha256'), 'hex') = request_fingerprint),
  UNIQUE (idempotency_scope, idempotency_key)
);

-- Optional diagnostic mirror only. No canonical read, FK, result, guard, lock, postcondition,
-- or accepted command path is permitted to depend on this table.
-- m02_command_domain_records is non-authoritative compatibility storage.
CREATE TABLE m02_command_domain_records (
  record_key text PRIMARY KEY,
  record_type text NOT NULL CHECK (record_type ~ '^[a-z][a-z0-9-]*$'),
  opaque_id text NOT NULL CHECK (opaque_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$'),
  value jsonb NOT NULL CHECK (jsonb_typeof(value) = 'object'),
  record_version bigint NOT NULL CHECK (record_version > 0),
  UNIQUE (record_type, opaque_id)
);

CREATE TABLE m02_review_states (
  id text PRIMARY KEY,
  group_id text REFERENCES repository_candidate_groups(id) ON DELETE RESTRICT,
  resource_candidate_id text REFERENCES resource_candidates(id) ON DELETE RESTRICT,
  review_state text NOT NULL CHECK (review_state IN ('NOT_REQUIRED', 'CLASSIFICATION_REVIEW_REQUIRED', 'IDENTITY_REVIEW_REQUIRED', 'CLARIFICATION_REQUESTED', 'RESOLVED', 'REJECTED', 'SUPERSEDED')),
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
  CHECK (group_id IS NOT NULL OR resource_candidate_id IS NOT NULL)
);

CREATE TABLE m02_manual_command_results (
  id text PRIMARY KEY,
  command_id text NOT NULL UNIQUE REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
  request_id text NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  mutation_plan_fingerprint text NOT NULL CHECK (mutation_plan_fingerprint ~ '^[0-9a-f]{64}$'),
  result_fingerprint text NOT NULL CHECK (result_fingerprint ~ '^[0-9a-f]{64}$'),
  ordered_target_ids jsonb NOT NULL CHECK (jsonb_typeof(ordered_target_ids) = 'array'),
  record_versions jsonb NOT NULL CHECK (m02_expected_versions_valid(record_versions)),
  result_payload jsonb NOT NULL CHECK (jsonb_typeof(result_payload) = 'object'),
  identity_projection_mode_id text,
  identity_outcome text CHECK (identity_outcome IS NULL OR identity_outcome IN (
    'NEW_RESOURCE', 'EXACT_REPEAT_REUSE', 'EXISTING_RESOURCE_NEW_VERSION',
    'AMBIGUOUS_IDENTITY', 'POSSIBLE_DUPLICATE', 'FORK_OF_EXISTING_RESOURCE', 'MIRROR'
  )),
  resource_identity_id text REFERENCES resource_identities(id) ON DELETE RESTRICT,
  resource_version_identity_id text REFERENCES resource_version_identities(id) ON DELETE RESTRICT,
  created_resource_identity_ids text[] NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (m02_text_array_is_canonical(created_resource_identity_ids)),
  reused_resource_identity_ids text[] NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (m02_text_array_is_canonical(reused_resource_identity_ids)),
  created_resource_version_identity_ids text[] NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (m02_text_array_is_canonical(created_resource_version_identity_ids)),
  reused_resource_version_identity_ids text[] NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (m02_text_array_is_canonical(reused_resource_version_identity_ids)),
  created_at timestamptz NOT NULL,
  UNIQUE (id, command_id),
  UNIQUE (id, command_id, request_id)
  ,FOREIGN KEY (resource_version_identity_id, resource_identity_id)
    REFERENCES resource_version_identities(id, resource_identity_id) ON DELETE RESTRICT
);

CREATE TABLE m02_audit_events (
  id text PRIMARY KEY,
  origin_type text NOT NULL CHECK (origin_type IN ('HUMAN_COMMAND', 'SYSTEM_IDENTITY_OPERATION')),
  command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
  result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
  actor_type text NOT NULL DEFAULT 'HUMAN' CHECK (actor_type IN ('HUMAN', 'SYSTEM')),
  actor_id text NOT NULL,
  actor_role text CHECK (actor_role IS NULL OR actor_role IN ('ADMIN', 'EDITOR', 'TECHNICAL_REVIEWER')),
  action text NOT NULL CHECK (action IN ('COMMAND_ACCEPTED', 'SYSTEM_OPERATION_ACCEPTED', 'SUBJECT_CREATED', 'SUBJECT_UPDATED', 'SUBJECT_SUPERSEDED')),
  subject_type text NOT NULL CHECK (subject_type IN (
    'MANUAL_RESOLUTION_COMMAND', 'SYSTEM_IDENTITY_OPERATION',
    'REPOSITORY_CANDIDATE_GROUP', 'REPOSITORY_CLASSIFICATION_RUN',
    'CANDIDATE_ROOT', 'CANDIDATE_ROOT_OWNERSHIP', 'REPOSITORY_CANDIDATE_ROOT_ORDER',
    'REPOSITORY_GROUP_RELATIONSHIP', 'RESOURCE_CANDIDATE', 'RESOURCE_IDENTITY',
    'RESOURCE_VERSION_IDENTITY', 'SOURCE_REPOSITORY_IDENTITY', 'SOURCE_REPOSITORY_URL',
    'RESOURCE_SOURCE_LINK', 'RESOURCE_VERSION_OBSERVATION', 'DUPLICATE_CANDIDATE',
    'FORK_RELATIONSHIP', 'SOURCE_REPOSITORY_RELATIONSHIP',
    'IDENTITY_DECISION', 'IDENTITY_DECISION_TIER_EVALUATION', 'IDENTITY_DECISION_SIGNAL',
    'IDENTITY_DECISION_SIGNAL_EVIDENCE', 'IDENTITY_DECISION_CONFLICT',
    'IDENTITY_DECISION_CONFLICT_TARGET', 'IDENTITY_DECISION_CONFLICT_EVIDENCE',
    'M02_REVIEW_STATE', 'M02_REJECTION_DECISION', 'M02_CLARIFICATION_REQUEST',
    'M02_IDENTITY_HANDOFF', 'ACQUISITION_JOB', 'M02_JOB', 'ROOT_REPLACEMENT', 'CANDIDATE_REPLACEMENT',
    'OWNERSHIP_REPLACEMENT', 'GROUP_EDGE_REPLACEMENT'
  )),
  subject_id text NOT NULL,
  request_id text NOT NULL,
  idempotency_scope text NOT NULL,
  idempotency_key text NOT NULL,
  reason_code text NOT NULL,
  reason_text text NOT NULL CHECK (octet_length(reason_text) BETWEEN 1 AND 2000),
  before_version bigint CHECK (before_version IS NULL OR before_version > 0),
  after_version bigint CHECK (after_version IS NULL OR after_version > 0),
  before_state text,
  after_state text,
  metadata_schema_version text NOT NULL DEFAULT '1' CHECK (metadata_schema_version = '1'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_snapshot_id text REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  controlling_job_id text,
  occurred_at timestamptz NOT NULL,
  event_type text GENERATED ALWAYS AS (action) STORED,
  target_type text GENERATED ALWAYS AS (subject_type) STORED,
  target_id text GENERATED ALWAYS AS (subject_id) STORED,
  bounded_detail jsonb GENERATED ALWAYS AS (metadata) STORED,
  created_at timestamptz GENERATED ALWAYS AS (occurred_at) STORED,
  CHECK (m02_audit_metadata_valid(action, subject_type, origin_type, metadata)),
  CHECK (m02_audit_state_valid(before_state) AND m02_audit_state_valid(after_state)),
  CHECK (
    (action IN ('COMMAND_ACCEPTED', 'SYSTEM_OPERATION_ACCEPTED')
      AND before_version IS NULL AND after_version IS NULL
      AND before_state IS NULL AND after_state IS NULL)
    OR (action = 'SUBJECT_CREATED' AND before_version IS NULL AND before_state IS NULL
      AND ((after_version IS NULL AND after_state IS NULL)
        OR (after_version = 1 AND after_state IS NOT NULL)))
    OR (action IN ('SUBJECT_UPDATED', 'SUBJECT_SUPERSEDED')
      AND before_version IS NOT NULL AND after_version = before_version + 1
      AND before_state IS NOT NULL AND after_state IS NOT NULL)
  ),
  CHECK (
    (origin_type = 'HUMAN_COMMAND' AND actor_type = 'HUMAN' AND actor_role IS NOT NULL)
    OR (origin_type = 'SYSTEM_IDENTITY_OPERATION' AND actor_type = 'SYSTEM' AND actor_role IS NULL)
  ),
  CHECK (
    (action = 'COMMAND_ACCEPTED' AND subject_type = 'MANUAL_RESOLUTION_COMMAND' AND subject_id = command_id)
    OR (action = 'SYSTEM_OPERATION_ACCEPTED' AND subject_type = 'SYSTEM_IDENTITY_OPERATION')
    OR (action IN ('SUBJECT_CREATED', 'SUBJECT_UPDATED', 'SUBJECT_SUPERSEDED')
      AND subject_type NOT IN ('MANUAL_RESOLUTION_COMMAND', 'SYSTEM_IDENTITY_OPERATION'))
  )
);

CREATE TABLE m02_rejected_command_audits (
  id bigserial PRIMARY KEY,
  command_id text NOT NULL,
  request_id text NOT NULL,
  idempotency_scope text NOT NULL CHECK (idempotency_scope = 'M02'),
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  actor_id text NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('ADMIN', 'EDITOR', 'TECHNICAL_REVIEWER')),
  error_code text NOT NULL CHECK (error_code IN (
    'ROLE_NOT_AUTHORIZED', 'TRANSITION_PROHIBITED', 'REFERENCE_INVALID',
    'RECORD_NOT_FOUND', 'STALE_RECORD_VERSION', 'RECORD_ALREADY_EXISTS',
    'EXPECTED_VERSION_SET_INVALID', 'PHANTOM_CONFLICT', 'MUTATION_PLAN_CHANGED',
    'FINGERPRINT_COLLISION', 'CONCURRENCY_GUARD_COLLISION', 'IDEMPOTENCY_KEY_REUSED',
    'CALLER_CONTROLLED_ID_PROHIBITED', 'JOB_SUPERSEDED', 'SERIALIZATION_RETRY_EXHAUSTED',
    'UNSUPPORTED_OVERRIDE_PROHIBITED', 'RELATIONSHIP_SELF_EDGE', 'RELATIONSHIP_CYCLE',
    'RELATIONSHIP_CONTENT_MISMATCH', 'RELATIONSHIP_ENDPOINT_INVALID',
    'REPLACEMENT_INPUT_UNCHANGED', 'OVERLAPPING_CONTROLLER_CONFLICT'
  )),
  target_candidate_id text REFERENCES resource_candidates(id) ON DELETE RESTRICT,
  target_group_id text REFERENCES repository_candidate_groups(id) ON DELETE RESTRICT,
  review_id text REFERENCES m02_review_states(id) ON DELETE RESTRICT,
  job_id text,
  created_at timestamptz NOT NULL,
  UNIQUE (idempotency_scope, idempotency_key, request_fingerprint, error_code)
);

ALTER TABLE acquisition_jobs
ADD CONSTRAINT acquisition_jobs_id_source_snapshot_unique UNIQUE (id, source_snapshot_id);
ALTER TABLE acquisition_jobs
ADD CONSTRAINT acquisition_jobs_id_submission_unique UNIQUE (id, submission_id);

CREATE TABLE m02_jobs (
  id text PRIMARY KEY REFERENCES acquisition_jobs(id) ON DELETE RESTRICT,
  job_lineage_id text NOT NULL,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  operation_scope text NOT NULL CHECK (operation_scope IN ('CLASSIFICATION', 'IDENTITY_RESOLUTION', 'FULL_PIPELINE')),
  current_stage text NOT NULL CHECK (current_stage IN ('CLASSIFYING_REPOSITORY', 'RESOLVING_IDENTITY')),
  review_state text NOT NULL CHECK (review_state IN ('NOT_REQUIRED', 'CLASSIFICATION_REVIEW_REQUIRED', 'IDENTITY_REVIEW_REQUIRED', 'CLARIFICATION_REQUESTED', 'RESOLVED', 'REJECTED')),
  supersession_state text NOT NULL CHECK (supersession_state IN ('CONTROLLING', 'SUPERSEDED')),
  superseded_by_job_id text,
  supersession_sequence bigint NOT NULL CHECK (supersession_sequence > 0),
  controlling_classification_decision_id text REFERENCES repository_classification_runs(id) ON DELETE RESTRICT,
  job_scope_key text NOT NULL CHECK (job_scope_key ~ '^[0-9a-f]{64}$'),
  input_fingerprint text NOT NULL CHECK (input_fingerprint ~ '^[0-9a-f]{64}$'),
  classification_policy_version text NOT NULL,
  identity_policy_version text NOT NULL,
  analysis_policy_version text NOT NULL,
  parser_profile_version text NOT NULL DEFAULT 'parser-v1',
  prompt_bundle_version text NOT NULL,
  replacement_reason_code text CHECK (replacement_reason_code IS NULL OR replacement_reason_code IN ('FAILED_STAGE_REPLACEMENT', 'RETRY_EXHAUSTED', 'NEW_SUPPORTED_SNAPSHOT', 'POLICY_OR_METHODOLOGY_CHANGE', 'ADMINISTRATIVE_CORRECTION')),
  replacement_input_payload bytea,
  replacement_input_fingerprint text CHECK (
    replacement_input_fingerprint IS NULL OR replacement_input_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  replacement_source_job_id text,
  replacement_source_operation_scope text CHECK (
    replacement_source_operation_scope IS NULL
    OR replacement_source_operation_scope IN ('CLASSIFICATION', 'IDENTITY_RESOLUTION', 'FULL_PIPELINE')
  ),
  replacement_requested_operation_scope text CHECK (
    replacement_requested_operation_scope IS NULL
    OR replacement_requested_operation_scope IN ('CLASSIFICATION', 'IDENTITY_RESOLUTION', 'FULL_PIPELINE')
  ),
  replacement_predecessor_job_ids text[],
  replacement_original_source_snapshot_id text REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  replacement_source_snapshot_id text REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  analysis_provider_adapter_id text,
  analysis_model_id text,
  analysis_methodology_version text,
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
  FOREIGN KEY (superseded_by_job_id) REFERENCES m02_jobs(id) ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE,
  FOREIGN KEY (replacement_source_job_id, job_lineage_id)
    REFERENCES m02_jobs(id, job_lineage_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (id, source_snapshot_id) REFERENCES acquisition_jobs(id, source_snapshot_id) ON DELETE RESTRICT,
  FOREIGN KEY (id, job_lineage_id) REFERENCES acquisition_jobs(id, submission_id) ON DELETE RESTRICT,
  UNIQUE (job_lineage_id, supersession_sequence),
  UNIQUE (id, job_lineage_id),
  UNIQUE (id, supersession_state),
  CHECK (
    (replacement_reason_code IS NULL AND replacement_input_payload IS NULL
      AND replacement_input_fingerprint IS NULL AND replacement_source_job_id IS NULL
      AND replacement_source_operation_scope IS NULL AND replacement_requested_operation_scope IS NULL
      AND replacement_predecessor_job_ids IS NULL AND replacement_original_source_snapshot_id IS NULL
      AND replacement_source_snapshot_id IS NULL AND analysis_provider_adapter_id IS NULL
      AND analysis_model_id IS NULL AND analysis_methodology_version IS NULL)
    OR (replacement_reason_code IS NOT NULL AND replacement_input_payload IS NOT NULL
      AND replacement_input_fingerprint IS NOT NULL AND replacement_source_job_id IS NOT NULL
      AND replacement_source_operation_scope IS NOT NULL
      AND replacement_requested_operation_scope = operation_scope
      AND replacement_predecessor_job_ids IS NOT NULL
      AND replacement_original_source_snapshot_id IS NOT NULL
      AND cardinality(replacement_predecessor_job_ids) > 0)
  ),
  CHECK (
    (analysis_provider_adapter_id IS NULL AND analysis_model_id IS NULL
      AND analysis_methodology_version IS NULL)
    OR (analysis_provider_adapter_id IS NOT NULL AND analysis_model_id IS NOT NULL
      AND analysis_methodology_version IS NOT NULL)
  ),
  CHECK (
    replacement_input_payload IS NULL
    OR (
      m02_text_array_is_canonical(replacement_predecessor_job_ids)
      AND m02_payload_matches_json(
        replacement_input_payload,
        jsonb_build_object(
          'schemaVersion', '1',
          'jobLineageId', job_lineage_id,
          'sourceJobId', replacement_source_job_id,
          'sourceOperationScope', replacement_source_operation_scope,
          'requestedOperationScope', replacement_requested_operation_scope,
          'predecessorJobIds', to_jsonb(replacement_predecessor_job_ids),
          'sourceSnapshotId', replacement_original_source_snapshot_id,
          'replacementSourceSnapshotIdOrNull', replacement_source_snapshot_id,
          'classificationPolicyVersion', classification_policy_version,
          'identityPolicyVersion', identity_policy_version,
          'analysisPolicyVersion', analysis_policy_version,
          'parserProfileVersion', parser_profile_version,
          'promptBundleVersion', prompt_bundle_version,
          'analysisProviderAdapterIdOrNull', analysis_provider_adapter_id,
          'analysisModelIdOrNull', analysis_model_id,
          'analysisMethodologyVersionOrNull', analysis_methodology_version,
          'controllingClassificationDecisionIdOrNull', controlling_classification_decision_id
        )
      )
      AND encode(digest(replacement_input_payload, 'sha256'), 'hex') = replacement_input_fingerprint
    )
  )
);

CREATE UNIQUE INDEX m02_jobs_one_controlling_scope
ON m02_jobs (job_lineage_id, operation_scope) WHERE supersession_state = 'CONTROLLING';

ALTER TABLE m02_jobs
ADD CONSTRAINT m02_jobs_id_snapshot_unique UNIQUE (id, source_snapshot_id);

ALTER TABLE m02_rejected_command_audits
ADD CONSTRAINT m02_rejected_command_audits_job_fk
FOREIGN KEY (job_id) REFERENCES m02_jobs(id) ON DELETE RESTRICT;

CREATE TABLE m02_system_identity_operations (
  id text PRIMARY KEY,
  operation_kind text NOT NULL DEFAULT 'SYSTEM_IDENTITY_PROJECTION'
    CHECK (operation_kind = 'SYSTEM_IDENTITY_PROJECTION'),
  automatic_projector_mode_id text NOT NULL CHECK (automatic_projector_mode_id IN (
    'S1_R0_JC', 'S1_R0_JR', 'S1_R1_JC', 'S1_R1_JR',
    'S2_JC', 'S2_JR', 'S3_JC', 'S3_JR',
    'S4_R0_JC', 'S4_R0_JR', 'S4_R1_JC', 'S4_R1_JR',
    'S5_R0_JC', 'S5_R0_JR', 'S5_R1_JC', 'S5_R1_JR',
    'S6_JR', 'S7_JR', 'S8_JR', 'S9_JC', 'S9_JR', 'S10_JR'
  )),
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  candidate_id text NOT NULL REFERENCES resource_candidates(id) ON DELETE RESTRICT,
  controlling_job_id text NOT NULL REFERENCES m02_jobs(id) ON DELETE RESTRICT,
  reconciled_classification_run_id text NOT NULL REFERENCES repository_classification_runs(id) ON DELETE RESTRICT,
  classification_run_input_fingerprint text NOT NULL CHECK (classification_run_input_fingerprint ~ '^[0-9a-f]{64}$'),
  classification_run_output_fingerprint text NOT NULL CHECK (classification_run_output_fingerprint ~ '^[0-9a-f]{64}$'),
  classification_policy_version text NOT NULL,
  identity_policy_version text NOT NULL,
  analysis_policy_version text NOT NULL,
  parser_profile_version text NOT NULL,
  prompt_bundle_version text NOT NULL,
  analysis_run_id text REFERENCES analysis_runs(id) ON DELETE RESTRICT,
  analysis_run_request_fingerprint text CHECK (
    analysis_run_request_fingerprint IS NULL OR analysis_run_request_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  analysis_run_response_fingerprint text CHECK (
    analysis_run_response_fingerprint IS NULL OR analysis_run_response_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  identity_decision_input_payload bytea NOT NULL,
  identity_decision_input_fingerprint text NOT NULL CHECK (
    identity_decision_input_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  system_replay_locator_payload bytea NOT NULL,
  system_replay_lookup_key text NOT NULL UNIQUE CHECK (system_replay_lookup_key ~ '^[0-9a-f]{64}$'),
  idempotency_scope text NOT NULL DEFAULT 'M02_SYSTEM_IDENTITY_PROJECTION_V1'
    CHECK (idempotency_scope = 'M02_SYSTEM_IDENTITY_PROJECTION_V1'),
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[0-9a-f]{64}$'),
  idempotency_payload bytea NOT NULL,
  system_expected_versions jsonb NOT NULL CHECK (m02_expected_versions_valid(system_expected_versions)),
  system_expected_versions_payload bytea NOT NULL,
  system_operation_request_payload bytea NOT NULL,
  system_operation_fingerprint text NOT NULL CHECK (system_operation_fingerprint ~ '^[0-9a-f]{64}$'),
  system_actor_id text NOT NULL CHECK (octet_length(system_actor_id) BETWEEN 1 AND 2000),
  actor_type text NOT NULL DEFAULT 'SYSTEM' CHECK (actor_type = 'SYSTEM'),
  actor_role text CHECK (actor_role IS NULL),
  created_at timestamptz NOT NULL,
  CHECK (m02_payload_is_canonical_json(identity_decision_input_payload)),
  CHECK (m02_payload_is_canonical_json(system_replay_locator_payload)),
  CHECK (m02_payload_is_canonical_json(idempotency_payload)),
  CHECK (m02_payload_matches_json(system_expected_versions_payload, system_expected_versions)),
  CHECK (m02_payload_is_canonical_json(system_operation_request_payload)),
  CHECK (encode(digest(identity_decision_input_payload, 'sha256'), 'hex') = identity_decision_input_fingerprint),
  CHECK (encode(digest(system_replay_locator_payload, 'sha256'), 'hex') = system_replay_lookup_key),
  CHECK (encode(digest(idempotency_payload, 'sha256'), 'hex') = idempotency_key),
  CHECK (encode(digest(system_operation_request_payload, 'sha256'), 'hex') = system_operation_fingerprint),
  CHECK (
    (analysis_run_id IS NULL AND analysis_run_request_fingerprint IS NULL
      AND analysis_run_response_fingerprint IS NULL)
    OR (analysis_run_id IS NOT NULL AND analysis_run_request_fingerprint IS NOT NULL
      AND analysis_run_response_fingerprint IS NOT NULL)
  ),
  UNIQUE (idempotency_scope, idempotency_key),
  UNIQUE (system_replay_lookup_key, system_replay_locator_payload),
  FOREIGN KEY (candidate_id, source_snapshot_id, reconciled_classification_run_id)
    REFERENCES resource_candidates(id, source_snapshot_id, reconciled_classification_run_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (
    reconciled_classification_run_id, source_snapshot_id,
    classification_run_input_fingerprint, classification_run_output_fingerprint
  ) REFERENCES repository_classification_runs (
    id, source_snapshot_id, input_fingerprint, output_fingerprint
  ) ON DELETE RESTRICT,
  FOREIGN KEY (controlling_job_id, source_snapshot_id)
    REFERENCES m02_jobs(id, source_snapshot_id) ON DELETE RESTRICT,
  FOREIGN KEY (analysis_run_id, source_snapshot_id)
    REFERENCES analysis_runs(id, source_snapshot_id) ON DELETE RESTRICT,
  FOREIGN KEY (
    analysis_run_id, source_snapshot_id,
    analysis_run_request_fingerprint, analysis_run_response_fingerprint
  ) REFERENCES analysis_runs (
    id, source_snapshot_id, request_fingerprint, response_fingerprint
  ) ON DELETE RESTRICT
);

CREATE TABLE m02_system_identity_results (
  id text PRIMARY KEY,
  system_operation_id text NOT NULL UNIQUE REFERENCES m02_system_identity_operations(id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  status text NOT NULL DEFAULT 'ACCEPTED' CHECK (status = 'ACCEPTED'),
  automatic_projector_mode_id text NOT NULL CHECK (automatic_projector_mode_id IN (
    'S1_R0_JC', 'S1_R0_JR', 'S1_R1_JC', 'S1_R1_JR',
    'S2_JC', 'S2_JR', 'S3_JC', 'S3_JR',
    'S4_R0_JC', 'S4_R0_JR', 'S4_R1_JC', 'S4_R1_JR',
    'S5_R0_JC', 'S5_R0_JR', 'S5_R1_JC', 'S5_R1_JR',
    'S6_JR', 'S7_JR', 'S8_JR', 'S9_JC', 'S9_JR', 'S10_JR'
  )),
  mutation_plan_payload bytea NOT NULL,
  mutation_plan_fingerprint text NOT NULL CHECK (mutation_plan_fingerprint ~ '^[0-9a-f]{64}$'),
  candidate_id text NOT NULL REFERENCES resource_candidates(id) ON DELETE RESTRICT,
  controlling_job_id text NOT NULL REFERENCES m02_jobs(id) ON DELETE RESTRICT,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  identity_decision_id text NOT NULL REFERENCES identity_decisions(id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  resource_identity_id text REFERENCES resource_identities(id) ON DELETE RESTRICT,
  resource_version_identity_id text REFERENCES resource_version_identities(id) ON DELETE RESTRICT,
  duplicate_candidate_id text REFERENCES duplicate_candidates(id) ON DELETE RESTRICT,
  handoff_marker_id text,
  created_source_repository_ids uuid[] NOT NULL,
  created_source_repository_url_ids uuid[] NOT NULL,
  created_resource_identity_ids uuid[] NOT NULL,
  created_resource_version_identity_ids uuid[] NOT NULL,
  created_source_link_ids uuid[] NOT NULL,
  created_observation_ids uuid[] NOT NULL,
  created_duplicate_candidate_ids uuid[] NOT NULL,
  created_identity_decision_ids uuid[] NOT NULL,
  created_handoff_marker_ids uuid[] NOT NULL,
  reused_source_repository_ids uuid[] NOT NULL,
  reused_resource_identity_ids uuid[] NOT NULL,
  reused_resource_version_identity_ids uuid[] NOT NULL,
  reused_source_link_ids uuid[] NOT NULL,
  reused_observation_ids uuid[] NOT NULL,
  updated_resource_candidate_ids uuid[] NOT NULL,
  updated_review_state_ids uuid[] NOT NULL,
  updated_acquisition_job_ids uuid[] NOT NULL,
  updated_m02_job_ids uuid[] NOT NULL,
  superseded_source_link_ids uuid[] NOT NULL,
  superseded_identity_decision_ids uuid[] NOT NULL,
  superseded_handoff_marker_ids uuid[] NOT NULL,
  superseded_duplicate_candidate_ids uuid[] NOT NULL,
  created_identity_decision_tier_evaluation_ids uuid[] NOT NULL,
  created_identity_decision_signal_ids uuid[] NOT NULL,
  created_identity_decision_signal_evidence_ids uuid[] NOT NULL,
  created_identity_decision_conflict_ids uuid[] NOT NULL,
  created_identity_decision_conflict_target_ids uuid[] NOT NULL,
  created_identity_decision_conflict_evidence_ids uuid[] NOT NULL,
  final_candidate_state jsonb NOT NULL CHECK (
    m02_jsonb_has_exact_keys(final_candidate_state, ARRAY[
      'status', 'identityOutcome', 'resourceIdentityId', 'resourceVersionIdentityId', 'recordVersion'
    ])
    AND final_candidate_state->>'status' IN ('IDENTITY_RESOLVED', 'IDENTITY_REVIEW_REQUIRED')
    AND jsonb_typeof(final_candidate_state->'recordVersion') = 'number'
    AND (final_candidate_state->>'recordVersion')::bigint > 0
  ),
  final_review_state text NOT NULL CHECK (final_review_state IN ('RESOLVED', 'IDENTITY_REVIEW_REQUIRED')),
  final_acquisition_job_status text NOT NULL CHECK (final_acquisition_job_status IN ('COMPLETED', 'OPERATOR_REVIEW_REQUIRED')),
  final_m02_job_status text NOT NULL CHECK (final_m02_job_status IN ('COMPLETED', 'OPERATOR_REVIEW_REQUIRED')),
  final_m02_stage text NOT NULL CHECK (final_m02_stage = 'RESOLVING_IDENTITY'),
  accepted_audit_event_id text NOT NULL REFERENCES m02_audit_events(id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  accepted_at timestamptz NOT NULL,
  CHECK (m02_payload_is_canonical_json(mutation_plan_payload)),
  CHECK (encode(digest(mutation_plan_payload, 'sha256'), 'hex') = mutation_plan_fingerprint),
  CHECK (
    m02_uuid_array_is_canonical(created_source_repository_ids)
    AND m02_uuid_array_is_canonical(created_source_repository_url_ids)
    AND m02_uuid_array_is_canonical(created_resource_identity_ids)
    AND m02_uuid_array_is_canonical(created_resource_version_identity_ids)
    AND m02_uuid_array_is_canonical(created_source_link_ids)
    AND m02_uuid_array_is_canonical(created_observation_ids)
    AND m02_uuid_array_is_canonical(created_duplicate_candidate_ids)
    AND m02_uuid_array_is_canonical(created_identity_decision_ids)
    AND m02_uuid_array_is_canonical(created_handoff_marker_ids)
    AND m02_uuid_array_is_canonical(reused_source_repository_ids)
    AND m02_uuid_array_is_canonical(reused_resource_identity_ids)
    AND m02_uuid_array_is_canonical(reused_resource_version_identity_ids)
    AND m02_uuid_array_is_canonical(reused_source_link_ids)
    AND m02_uuid_array_is_canonical(reused_observation_ids)
    AND m02_uuid_array_is_canonical(updated_resource_candidate_ids)
    AND m02_uuid_array_is_canonical(updated_review_state_ids)
    AND m02_uuid_array_is_canonical(updated_acquisition_job_ids)
    AND m02_uuid_array_is_canonical(updated_m02_job_ids)
    AND m02_uuid_array_is_canonical(superseded_source_link_ids)
    AND m02_uuid_array_is_canonical(superseded_identity_decision_ids)
    AND m02_uuid_array_is_canonical(superseded_handoff_marker_ids)
    AND m02_uuid_array_is_canonical(superseded_duplicate_candidate_ids)
    AND m02_uuid_array_is_canonical(created_identity_decision_tier_evaluation_ids)
    AND m02_uuid_array_is_canonical(created_identity_decision_signal_ids)
    AND m02_uuid_array_is_canonical(created_identity_decision_signal_evidence_ids)
    AND m02_uuid_array_is_canonical(created_identity_decision_conflict_ids)
    AND m02_uuid_array_is_canonical(created_identity_decision_conflict_target_ids)
    AND m02_uuid_array_is_canonical(created_identity_decision_conflict_evidence_ids)
  ),
  CHECK (
    (automatic_projector_mode_id IN ('S1_R0_JC', 'S1_R0_JR', 'S1_R1_JC', 'S1_R1_JR',
      'S2_JC', 'S2_JR', 'S3_JC', 'S3_JR', 'S4_R0_JC', 'S4_R0_JR', 'S4_R1_JC',
      'S4_R1_JR', 'S5_R0_JC', 'S5_R0_JR', 'S5_R1_JC', 'S5_R1_JR', 'S9_JC', 'S9_JR')
      AND resource_identity_id IS NOT NULL AND resource_version_identity_id IS NOT NULL
      AND handoff_marker_id IS NOT NULL AND duplicate_candidate_id IS NULL)
    OR (automatic_projector_mode_id = 'S7_JR' AND duplicate_candidate_id IS NOT NULL
      AND resource_identity_id IS NULL AND resource_version_identity_id IS NULL AND handoff_marker_id IS NULL)
    OR (automatic_projector_mode_id IN ('S6_JR', 'S8_JR') AND duplicate_candidate_id IS NULL
      AND resource_identity_id IS NULL AND resource_version_identity_id IS NULL AND handoff_marker_id IS NULL)
    OR (automatic_projector_mode_id = 'S10_JR' AND duplicate_candidate_id IS NULL
      AND resource_identity_id IS NOT NULL AND resource_version_identity_id IS NOT NULL
      AND handoff_marker_id IS NULL)
  ),
  FOREIGN KEY (resource_version_identity_id, resource_identity_id)
    REFERENCES resource_version_identities(id, resource_identity_id) ON DELETE RESTRICT,
  FOREIGN KEY (candidate_id, source_snapshot_id)
    REFERENCES resource_candidates(id, source_snapshot_id) ON DELETE RESTRICT,
  FOREIGN KEY (controlling_job_id, source_snapshot_id)
    REFERENCES m02_jobs(id, source_snapshot_id) ON DELETE RESTRICT
);

CREATE TABLE m02_rejected_system_identity_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL CHECK (phase IN ('PRE_PROJECTOR', 'POST_PROJECTOR_PRE_ALLOCATION', 'TRANSACTION_ATTEMPT')),
  candidate_id text NOT NULL REFERENCES resource_candidates(id) ON DELETE RESTRICT,
  controlling_job_id text NOT NULL REFERENCES m02_jobs(id) ON DELETE RESTRICT,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  system_actor_id text NOT NULL CHECK (octet_length(system_actor_id) BETWEEN 1 AND 2000),
  system_replay_locator_payload bytea NOT NULL,
  system_replay_lookup_key text NOT NULL CHECK (system_replay_lookup_key ~ '^[0-9a-f]{64}$'),
  error_code text NOT NULL CHECK (error_code IN (
    'JOB_SUPERSEDED', 'CANCELLED', 'EXPECTED_VERSION_SET_INVALID', 'STALE_RECORD_VERSION',
    'MUTATION_PLAN_CHANGED', 'SERIALIZATION_RETRY_EXHAUSTED', 'FINGERPRINT_COLLISION',
    'CONCURRENCY_GUARD_COLLISION'
  )),
  existing_targets jsonb NOT NULL CHECK (m02_system_rejection_targets_valid(existing_targets)),
  automatic_projector_mode_id text CHECK (automatic_projector_mode_id IS NULL OR automatic_projector_mode_id IN (
    'S1_R0_JC', 'S1_R0_JR', 'S1_R1_JC', 'S1_R1_JR',
    'S2_JC', 'S2_JR', 'S3_JC', 'S3_JR',
    'S4_R0_JC', 'S4_R0_JR', 'S4_R1_JC', 'S4_R1_JR',
    'S5_R0_JC', 'S5_R0_JR', 'S5_R1_JC', 'S5_R1_JR',
    'S6_JR', 'S7_JR', 'S8_JR', 'S9_JC', 'S9_JR', 'S10_JR'
  )),
  identity_decision_input_fingerprint text CHECK (
    identity_decision_input_fingerprint IS NULL OR identity_decision_input_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  idempotency_scope text,
  idempotency_key text CHECK (idempotency_key IS NULL OR idempotency_key ~ '^[0-9a-f]{64}$'),
  system_operation_fingerprint text CHECK (
    system_operation_fingerprint IS NULL OR system_operation_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  attempted_system_operation_id text,
  rejection_context_payload bytea NOT NULL,
  rejection_fingerprint text NOT NULL UNIQUE CHECK (rejection_fingerprint ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz NOT NULL,
  CHECK (m02_payload_is_canonical_json(system_replay_locator_payload)),
  CHECK (m02_payload_is_canonical_json(rejection_context_payload)),
  CHECK (encode(digest(system_replay_locator_payload, 'sha256'), 'hex') = system_replay_lookup_key),
  CHECK (encode(digest(rejection_context_payload, 'sha256'), 'hex') = rejection_fingerprint),
  CHECK (
    (phase = 'PRE_PROJECTOR'
      AND automatic_projector_mode_id IS NULL AND identity_decision_input_fingerprint IS NULL
      AND idempotency_scope IS NULL AND idempotency_key IS NULL
      AND system_operation_fingerprint IS NULL AND attempted_system_operation_id IS NULL
      AND error_code IN ('JOB_SUPERSEDED', 'CANCELLED'))
    OR (phase = 'POST_PROJECTOR_PRE_ALLOCATION'
      AND automatic_projector_mode_id IS NOT NULL AND identity_decision_input_fingerprint IS NOT NULL
      AND idempotency_scope = 'M02_SYSTEM_IDENTITY_PROJECTION_V1' AND idempotency_key IS NOT NULL
      AND system_operation_fingerprint IS NOT NULL AND attempted_system_operation_id IS NULL
      AND error_code IN ('EXPECTED_VERSION_SET_INVALID', 'STALE_RECORD_VERSION', 'FINGERPRINT_COLLISION'))
    OR (phase = 'TRANSACTION_ATTEMPT'
      AND automatic_projector_mode_id IS NOT NULL AND identity_decision_input_fingerprint IS NOT NULL
      AND idempotency_scope = 'M02_SYSTEM_IDENTITY_PROJECTION_V1' AND idempotency_key IS NOT NULL
      AND system_operation_fingerprint IS NOT NULL AND attempted_system_operation_id IS NOT NULL)
  ),
  FOREIGN KEY (candidate_id, source_snapshot_id)
    REFERENCES resource_candidates(id, source_snapshot_id) ON DELETE RESTRICT,
  FOREIGN KEY (controlling_job_id, source_snapshot_id)
    REFERENCES m02_jobs(id, source_snapshot_id) ON DELETE RESTRICT
);

CREATE TABLE identity_decision_tier_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_decision_id text NOT NULL REFERENCES identity_decisions(id) ON DELETE RESTRICT,
  ordinal integer NOT NULL CHECK (ordinal BETWEEN 0 AND 5),
  tier text NOT NULL CHECK (tier IN ('P1', 'P2', 'P3', 'P4', 'P5', 'P6')),
  evaluation_disposition text NOT NULL CHECK (
    evaluation_disposition IN ('MATCH', 'NO_MATCH', 'CONFLICT', 'MULTIPLE_TARGETS', 'NOT_APPLICABLE')
  ),
  audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL,
  UNIQUE (identity_decision_id, ordinal),
  UNIQUE (identity_decision_id, tier),
  CHECK (
    (ordinal = 0 AND tier = 'P1') OR (ordinal = 1 AND tier = 'P2')
    OR (ordinal = 2 AND tier = 'P3') OR (ordinal = 3 AND tier = 'P4')
    OR (ordinal = 4 AND tier = 'P5') OR (ordinal = 5 AND tier = 'P6')
  )
);

CREATE TABLE identity_decision_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_decision_id text NOT NULL REFERENCES identity_decisions(id) ON DELETE RESTRICT,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  tier text NOT NULL CHECK (tier IN ('P1', 'P2', 'P3', 'P4', 'P5', 'P6')),
  signal_type text NOT NULL CHECK (signal_type IN (
    'P1_ACTIVE_SOURCE_LINK', 'P2_TRUSTED_EXTERNAL_IDENTIFIER',
    'P3_REVIEWED_MIRROR_PROVENANCE', 'P3_REVIEWED_FORK_PROVENANCE',
    'P3_REVIEWED_UPSTREAM_PROVENANCE', 'P3_PROVIDER_DECLARED_FORK_PROVENANCE',
    'P4_CANDIDATE_CONTENT_FINGERPRINT', 'P5_SOURCE_NAME', 'P5_CREATOR_IDENTITY',
    'P5_ORGANIZATION_IDENTITY', 'P6_WEAK_SIMILAR_NAME'
  )),
  target_type text CHECK (target_type IS NULL OR target_type IN (
    'RESOURCE_IDENTITY', 'RESOURCE_VERSION', 'SOURCE_REPOSITORY'
  )),
  resource_identity_id text REFERENCES resource_identities(id) ON DELETE RESTRICT,
  resource_version_id text REFERENCES resource_version_identities(id) ON DELETE RESTRICT,
  source_repository_id text REFERENCES source_repository_identities(id) ON DELETE RESTRICT,
  audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL,
  UNIQUE (identity_decision_id, ordinal),
  CHECK (
    (target_type IS NULL
      AND num_nonnulls(resource_identity_id, resource_version_id, source_repository_id) = 0)
    OR (target_type = 'RESOURCE_IDENTITY' AND resource_identity_id IS NOT NULL
      AND num_nonnulls(resource_identity_id, resource_version_id, source_repository_id) = 1)
    OR (target_type = 'RESOURCE_VERSION' AND resource_version_id IS NOT NULL
      AND num_nonnulls(resource_identity_id, resource_version_id, source_repository_id) = 1)
    OR (target_type = 'SOURCE_REPOSITORY' AND source_repository_id IS NOT NULL
      AND num_nonnulls(resource_identity_id, resource_version_id, source_repository_id) = 1)
  )
);

CREATE TABLE identity_decision_signal_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id uuid NOT NULL REFERENCES identity_decision_signals(id) ON DELETE RESTRICT,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  evidence_reference_id text NOT NULL REFERENCES classification_evidence_references(id) ON DELETE RESTRICT,
  audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL,
  UNIQUE (signal_id, ordinal),
  UNIQUE (signal_id, evidence_reference_id)
);

CREATE TABLE identity_decision_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_decision_id text NOT NULL REFERENCES identity_decisions(id) ON DELETE RESTRICT,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  conflict_code text NOT NULL CHECK (conflict_code IN (
    'MISSING_OR_UNRELIABLE_IDENTITY_TOKEN', 'TRUSTED_IDENTIFIER_SOURCE_LINK_CONFLICT',
    'EXTERNAL_IDENTIFIER_COLLISION', 'MULTIPLE_CANONICAL_TARGETS',
    'DIVERGENT_MIRROR_CONTENT', 'CONTENT_FINGERPRINT_PAYLOAD_COLLISION',
    'PROVENANCE_SIGNAL_CONFLICT'
  )),
  audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL,
  UNIQUE (identity_decision_id, ordinal)
);

CREATE TABLE identity_decision_conflict_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conflict_id uuid NOT NULL REFERENCES identity_decision_conflicts(id) ON DELETE RESTRICT,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  target_type text NOT NULL CHECK (target_type IN (
    'RESOURCE_IDENTITY', 'RESOURCE_VERSION', 'SOURCE_REPOSITORY'
  )),
  resource_identity_id text REFERENCES resource_identities(id) ON DELETE RESTRICT,
  resource_version_id text REFERENCES resource_version_identities(id) ON DELETE RESTRICT,
  source_repository_id text REFERENCES source_repository_identities(id) ON DELETE RESTRICT,
  audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL,
  UNIQUE (conflict_id, ordinal),
  UNIQUE NULLS NOT DISTINCT (
    conflict_id, target_type, resource_identity_id, resource_version_id, source_repository_id
  ),
  CHECK (
    num_nonnulls(resource_identity_id, resource_version_id, source_repository_id) = 1
    AND ((target_type = 'RESOURCE_IDENTITY' AND resource_identity_id IS NOT NULL)
      OR (target_type = 'RESOURCE_VERSION' AND resource_version_id IS NOT NULL)
      OR (target_type = 'SOURCE_REPOSITORY' AND source_repository_id IS NOT NULL))
  )
);

CREATE TABLE identity_decision_conflict_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conflict_id uuid NOT NULL REFERENCES identity_decision_conflicts(id) ON DELETE RESTRICT,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  evidence_reference_id text NOT NULL REFERENCES classification_evidence_references(id) ON DELETE RESTRICT,
  audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL,
  UNIQUE (conflict_id, ordinal),
  UNIQUE (conflict_id, evidence_reference_id)
);

ALTER TABLE m02_system_identity_operations
ADD CONSTRAINT m02_system_identity_operations_projection_unique
UNIQUE (id, automatic_projector_mode_id, candidate_id, controlling_job_id, source_snapshot_id);

ALTER TABLE m02_system_identity_results
ADD CONSTRAINT m02_system_identity_results_operation_projection_fk
FOREIGN KEY (
  system_operation_id, automatic_projector_mode_id, candidate_id, controlling_job_id, source_snapshot_id
) REFERENCES m02_system_identity_operations (
  id, automatic_projector_mode_id, candidate_id, controlling_job_id, source_snapshot_id
) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT m02_system_identity_results_id_operation_unique
UNIQUE (id, system_operation_id),
ADD CONSTRAINT m02_system_identity_results_identity_pair_unique
UNIQUE (id, system_operation_id, identity_decision_id);

ALTER TABLE m02_audit_events
ADD COLUMN system_operation_id text REFERENCES m02_system_identity_operations(id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN system_result_id text REFERENCES m02_system_identity_results(id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT m02_audit_events_origin_xor CHECK (
  (origin_type = 'HUMAN_COMMAND' AND command_id IS NOT NULL AND result_id IS NOT NULL
    AND system_operation_id IS NULL AND system_result_id IS NULL)
  OR (origin_type = 'SYSTEM_IDENTITY_OPERATION' AND command_id IS NULL AND result_id IS NULL
    AND system_operation_id IS NOT NULL AND system_result_id IS NOT NULL)
),
ADD CONSTRAINT m02_audit_events_system_acceptance_subject CHECK (
  action <> 'SYSTEM_OPERATION_ACCEPTED' OR subject_id = system_operation_id
),
ADD CONSTRAINT m02_audit_events_human_result_origin_fk
FOREIGN KEY (result_id, command_id) REFERENCES m02_manual_command_results(id, command_id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT m02_audit_events_system_result_origin_fk
FOREIGN KEY (system_result_id, system_operation_id)
  REFERENCES m02_system_identity_results(id, system_operation_id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE UNIQUE INDEX m02_audit_events_one_system_acceptance
ON m02_audit_events (system_operation_id)
WHERE action = 'SYSTEM_OPERATION_ACCEPTED';

ALTER TABLE m02_audit_events
ADD CONSTRAINT m02_audit_events_controlling_job_fk
FOREIGN KEY (controlling_job_id) REFERENCES m02_jobs(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE resource_candidates
ADD COLUMN terminal_reason_code text,
ADD COLUMN superseded_by_candidate_id text REFERENCES resource_candidates(id) ON DELETE RESTRICT,
ADD COLUMN creation_command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
ADD COLUMN creation_result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
ADD COLUMN creation_audit_event_id text REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT resource_candidates_creation_origin_shape CHECK (
  num_nonnulls(creation_command_id, creation_result_id, creation_audit_event_id) IN (0, 3)
),
ADD CONSTRAINT resource_candidates_creation_result_origin_fk
FOREIGN KEY (creation_result_id, creation_command_id)
REFERENCES m02_manual_command_results(id, command_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE m02_review_states
ADD COLUMN source_snapshot_id text REFERENCES source_snapshots(id) ON DELETE RESTRICT,
ADD COLUMN controlling_job_id text REFERENCES m02_jobs(id) ON DELETE RESTRICT,
ADD COLUMN terminal_reason_code text,
ADD COLUMN superseded_by_review_id text REFERENCES m02_review_states(id) ON DELETE RESTRICT,
ADD CONSTRAINT m02_review_states_lineage_unique
UNIQUE (id, source_snapshot_id, controlling_job_id);

CREATE TABLE m02_candidate_rejection_decisions (
  id text PRIMARY KEY,
  resource_candidate_id text NOT NULL REFERENCES resource_candidates(id) ON DELETE RESTRICT,
  controlling_job_id text NOT NULL REFERENCES m02_jobs(id) ON DELETE RESTRICT,
  classification_run_id text NOT NULL REFERENCES repository_classification_runs(id) ON DELETE RESTRICT,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  command_id text NOT NULL REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
  result_id text NOT NULL REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
  audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  evidence_ids jsonb NOT NULL CHECK (jsonb_typeof(evidence_ids) = 'array'),
  actor_id text NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('ADMIN', 'EDITOR', 'TECHNICAL_REVIEWER')),
  reason_code text NOT NULL,
  reason_text text NOT NULL CHECK (octet_length(reason_text) BETWEEN 1 AND 2000),
  state text NOT NULL CHECK (state IN ('ACTIVE', 'SUPERSEDED')),
  supersedes_rejection_decision_id text REFERENCES m02_candidate_rejection_decisions(id) ON DELETE RESTRICT,
  superseded_by_rejection_decision_id text REFERENCES m02_candidate_rejection_decisions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL,
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
  UNIQUE (id, resource_candidate_id, source_snapshot_id),
  CHECK ((state = 'ACTIVE') = (superseded_by_rejection_decision_id IS NULL)),
  FOREIGN KEY (resource_candidate_id, source_snapshot_id, classification_run_id)
    REFERENCES resource_candidates(id, source_snapshot_id, reconciled_classification_run_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (controlling_job_id, source_snapshot_id)
    REFERENCES m02_jobs(id, source_snapshot_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX m02_candidate_rejection_decisions_one_active
ON m02_candidate_rejection_decisions (resource_candidate_id) WHERE state = 'ACTIVE';

CREATE TABLE m02_clarification_requests (
  id text PRIMARY KEY,
  command_id text NOT NULL REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
  result_id text NOT NULL REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
  audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  review_id text NOT NULL REFERENCES m02_review_states(id) ON DELETE RESTRICT,
  controlling_job_id text NOT NULL REFERENCES m02_jobs(id) ON DELETE RESTRICT,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  target_classification_run_id text REFERENCES repository_classification_runs(id) ON DELETE RESTRICT,
  target_identity_decision_id text REFERENCES identity_decisions(id) ON DELETE RESTRICT,
  target_rejection_decision_id text REFERENCES m02_candidate_rejection_decisions(id) ON DELETE RESTRICT,
  resource_candidate_id text REFERENCES resource_candidates(id) ON DELETE RESTRICT,
  candidate_group_id text REFERENCES repository_candidate_groups(id) ON DELETE RESTRICT,
  question_code text NOT NULL,
  reason_code text NOT NULL,
  question_payload bytea NOT NULL CHECK (octet_length(question_payload) BETWEEN 1 AND 4096),
  evidence_ids jsonb NOT NULL CHECK (jsonb_typeof(evidence_ids) = 'array'),
  evidence_gaps jsonb NOT NULL CHECK (jsonb_typeof(evidence_gaps) = 'array'),
  requested_responder_class text NOT NULL CHECK (requested_responder_class IN ('ADMIN', 'EDITOR', 'TECHNICAL_REVIEWER')),
  actor_id text NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('ADMIN', 'EDITOR', 'TECHNICAL_REVIEWER')),
  state text NOT NULL CHECK (state IN ('OPEN', 'RESOLVED', 'SUPERSEDED')),
  resolution_command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
  resolution_result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
  resolution_audit_event_id text REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  superseded_by_command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL,
  resolved_at timestamptz,
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
  CHECK (num_nonnulls(target_classification_run_id, target_identity_decision_id, target_rejection_decision_id) = 1),
  CHECK (
    (target_classification_run_id IS NOT NULL AND candidate_group_id IS NOT NULL AND resource_candidate_id IS NULL)
    OR (target_classification_run_id IS NULL AND candidate_group_id IS NOT NULL AND resource_candidate_id IS NOT NULL)
  ),
  CHECK (
    (state = 'OPEN' AND resolution_command_id IS NULL AND resolution_result_id IS NULL
      AND resolution_audit_event_id IS NULL AND superseded_by_command_id IS NULL AND resolved_at IS NULL)
    OR (state = 'RESOLVED' AND resolution_command_id IS NOT NULL AND resolution_result_id IS NOT NULL
      AND resolution_audit_event_id IS NOT NULL AND superseded_by_command_id IS NULL AND resolved_at IS NOT NULL)
    OR (state = 'SUPERSEDED' AND resolution_command_id IS NOT NULL AND resolution_result_id IS NOT NULL
      AND resolution_audit_event_id IS NOT NULL AND superseded_by_command_id IS NOT NULL AND resolved_at IS NOT NULL)
  ),
  FOREIGN KEY (review_id, source_snapshot_id, controlling_job_id)
    REFERENCES m02_review_states(id, source_snapshot_id, controlling_job_id) ON DELETE RESTRICT,
  FOREIGN KEY (controlling_job_id, source_snapshot_id)
    REFERENCES m02_jobs(id, source_snapshot_id) ON DELETE RESTRICT,
  FOREIGN KEY (candidate_group_id, source_snapshot_id)
    REFERENCES repository_candidate_groups(id, source_snapshot_id) ON DELETE RESTRICT,
  FOREIGN KEY (resource_candidate_id, source_snapshot_id)
    REFERENCES resource_candidates(id, source_snapshot_id) ON DELETE RESTRICT,
  FOREIGN KEY (target_classification_run_id, candidate_group_id, source_snapshot_id)
    REFERENCES repository_classification_runs(id, group_id, source_snapshot_id) ON DELETE RESTRICT,
  FOREIGN KEY (target_identity_decision_id, resource_candidate_id)
    REFERENCES identity_decisions(id, resource_candidate_id) ON DELETE RESTRICT,
  FOREIGN KEY (target_rejection_decision_id, resource_candidate_id, source_snapshot_id)
    REFERENCES m02_candidate_rejection_decisions(id, resource_candidate_id, source_snapshot_id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX m02_clarification_requests_one_open_question
ON m02_clarification_requests (review_id, question_code) WHERE state = 'OPEN';
CREATE INDEX m02_clarification_requests_controlling_job_open
ON m02_clarification_requests (controlling_job_id, id) WHERE state = 'OPEN';

CREATE TABLE m02_root_replacements (
  id text PRIMARY KEY,
  predecessor_root_id text REFERENCES candidate_roots(id) ON DELETE RESTRICT,
  successor_root_id text REFERENCES candidate_roots(id) ON DELETE RESTRICT,
  replacement_kind text NOT NULL CHECK (replacement_kind IN (
    'SPLIT', 'MERGE', 'OVERRIDE', 'RETAINED', 'REASSIGNED', 'CREATED', 'RETIRED'
  )),
  command_id text NOT NULL REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
  result_id text NOT NULL REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  predecessor_ordinal integer CHECK (predecessor_ordinal IS NULL OR predecessor_ordinal >= 0),
  successor_ordinal integer CHECK (successor_ordinal IS NULL OR successor_ordinal >= 0),
  reason text NOT NULL CHECK (octet_length(reason) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL,
  CHECK (predecessor_root_id IS NOT NULL OR successor_root_id IS NOT NULL),
  CHECK (
    (replacement_kind = 'CREATED' AND predecessor_root_id IS NULL AND successor_root_id IS NOT NULL)
    OR (replacement_kind = 'RETIRED' AND predecessor_root_id IS NOT NULL AND successor_root_id IS NULL)
    OR (replacement_kind IN ('SPLIT', 'MERGE', 'RETAINED', 'REASSIGNED')
      AND predecessor_root_id IS NOT NULL AND successor_root_id IS NOT NULL)
    OR (replacement_kind = 'OVERRIDE' AND predecessor_root_id IS NULL AND successor_root_id IS NOT NULL)
  ),
  CHECK ((predecessor_root_id IS NULL) = (predecessor_ordinal IS NULL)),
  CHECK ((successor_root_id IS NULL) = (successor_ordinal IS NULL)),
  UNIQUE NULLS NOT DISTINCT (command_id, predecessor_root_id, successor_root_id)
);

CREATE TABLE m02_candidate_replacements (
  id text PRIMARY KEY,
  predecessor_candidate_id text REFERENCES resource_candidates(id) ON DELETE RESTRICT,
  successor_candidate_id text REFERENCES resource_candidates(id) ON DELETE RESTRICT,
  replacement_kind text NOT NULL CHECK (replacement_kind IN (
    'SPLIT', 'MERGE', 'OVERRIDE', 'RETAINED', 'REASSIGNED', 'CREATED', 'RETIRED'
  )),
  command_id text NOT NULL REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
  result_id text NOT NULL REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  reason text NOT NULL CHECK (octet_length(reason) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL,
  CHECK (predecessor_candidate_id IS NOT NULL OR successor_candidate_id IS NOT NULL),
  CHECK (
    (replacement_kind = 'CREATED' AND predecessor_candidate_id IS NULL AND successor_candidate_id IS NOT NULL)
    OR (replacement_kind = 'RETIRED' AND predecessor_candidate_id IS NOT NULL AND successor_candidate_id IS NULL)
    OR (replacement_kind IN ('SPLIT', 'MERGE', 'RETAINED', 'REASSIGNED')
      AND predecessor_candidate_id IS NOT NULL AND successor_candidate_id IS NOT NULL)
    OR (replacement_kind = 'OVERRIDE' AND predecessor_candidate_id IS NULL AND successor_candidate_id IS NOT NULL)
  ),
  UNIQUE NULLS NOT DISTINCT (command_id, predecessor_candidate_id, successor_candidate_id)
);

CREATE TABLE m02_ownership_replacements (
  id text PRIMARY KEY,
  predecessor_ownership_id text REFERENCES candidate_root_ownership(id) ON DELETE RESTRICT,
  successor_ownership_id text REFERENCES candidate_root_ownership(id) ON DELETE RESTRICT,
  replacement_kind text NOT NULL CHECK (replacement_kind IN ('RETAINED', 'REASSIGNED', 'CREATED', 'RETIRED')),
  command_id text NOT NULL REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
  result_id text NOT NULL REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL,
  CHECK (predecessor_ownership_id IS NOT NULL OR successor_ownership_id IS NOT NULL),
  CHECK (
    (replacement_kind = 'CREATED' AND predecessor_ownership_id IS NULL AND successor_ownership_id IS NOT NULL)
    OR (replacement_kind = 'RETIRED' AND predecessor_ownership_id IS NOT NULL AND successor_ownership_id IS NULL)
    OR (replacement_kind IN ('RETAINED', 'REASSIGNED')
      AND predecessor_ownership_id IS NOT NULL AND successor_ownership_id IS NOT NULL)
  ),
  UNIQUE NULLS NOT DISTINCT (command_id, predecessor_ownership_id, successor_ownership_id)
);

CREATE TABLE m02_group_edge_replacements (
  id text PRIMARY KEY,
  predecessor_group_edge_id text REFERENCES repository_group_relationships(id) ON DELETE RESTRICT,
  successor_group_edge_id text REFERENCES repository_group_relationships(id) ON DELETE RESTRICT,
  replacement_kind text NOT NULL CHECK (replacement_kind IN ('RETAINED', 'REASSIGNED', 'CREATED', 'RETIRED')),
  command_id text NOT NULL REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
  result_id text NOT NULL REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL,
  CHECK (predecessor_group_edge_id IS NOT NULL OR successor_group_edge_id IS NOT NULL),
  CHECK (
    (replacement_kind = 'CREATED' AND predecessor_group_edge_id IS NULL AND successor_group_edge_id IS NOT NULL)
    OR (replacement_kind = 'RETIRED' AND predecessor_group_edge_id IS NOT NULL AND successor_group_edge_id IS NULL)
    OR (replacement_kind IN ('RETAINED', 'REASSIGNED')
      AND predecessor_group_edge_id IS NOT NULL AND successor_group_edge_id IS NOT NULL)
  ),
  UNIQUE NULLS NOT DISTINCT (command_id, predecessor_group_edge_id, successor_group_edge_id)
);

ALTER TABLE repository_candidate_groups
ADD COLUMN superseded_by_group_id text REFERENCES repository_candidate_groups(id) ON DELETE RESTRICT,
ADD COLUMN replacement_command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
ADD COLUMN replacement_result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
ADD COLUMN replacement_audit_event_id text REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CHECK (
  (state = 'ACTIVE' AND superseded_by_group_id IS NULL)
  OR (state = 'SUPERSEDED' AND superseded_by_group_id IS NOT NULL
      AND replacement_command_id IS NOT NULL AND replacement_result_id IS NOT NULL
      AND replacement_audit_event_id IS NOT NULL)
),
ADD CHECK (
  supersedes_group_id IS NULL
  OR (replacement_command_id IS NOT NULL AND replacement_result_id IS NOT NULL
      AND replacement_audit_event_id IS NOT NULL)
);

ALTER TABLE repository_classification_runs
ADD COLUMN replacement_command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
ADD COLUMN replacement_result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
ADD COLUMN replacement_audit_event_id text REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CHECK (
  supersedes_run_id IS NULL
  OR (replacement_command_id IS NOT NULL AND replacement_result_id IS NOT NULL
      AND replacement_audit_event_id IS NOT NULL)
);

ALTER TABLE candidate_roots
ADD COLUMN superseded_by_root_id text REFERENCES candidate_roots(id) ON DELETE RESTRICT,
ADD COLUMN replacement_command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
ADD COLUMN replacement_result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
ADD COLUMN replacement_audit_event_id text REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CHECK (
  (state = 'ACTIVE' AND superseded_by_root_id IS NULL)
  OR (state = 'SUPERSEDED' AND superseded_by_root_id IS NOT NULL
      AND replacement_command_id IS NOT NULL AND replacement_result_id IS NOT NULL
      AND replacement_audit_event_id IS NOT NULL)
);

ALTER TABLE candidate_root_ownership
ADD COLUMN command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT;
ALTER TABLE repository_candidate_root_order
ADD COLUMN command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT;
ALTER TABLE repository_group_relationships
ADD COLUMN command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT;

ALTER TABLE resource_candidates
ADD COLUMN replacement_command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
ADD COLUMN replacement_result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
ADD COLUMN replacement_audit_event_id text REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CHECK (
  status <> 'SUPERSEDED'
  OR (superseded_by_candidate_id IS NOT NULL AND replacement_command_id IS NOT NULL
      AND replacement_result_id IS NOT NULL AND replacement_audit_event_id IS NOT NULL)
);

ALTER TABLE m02_review_states
ADD COLUMN replacement_command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
ADD COLUMN replacement_result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
ADD COLUMN replacement_audit_event_id text REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CHECK (
  review_state <> 'SUPERSEDED'
  OR (terminal_reason_code = 'TOPOLOGY_SUPERSEDED' AND replacement_command_id IS NOT NULL
      AND replacement_result_id IS NOT NULL AND replacement_audit_event_id IS NOT NULL)
);

ALTER TABLE identity_decisions
ADD COLUMN origin_type text NOT NULL CHECK (origin_type IN ('HUMAN_COMMAND', 'SYSTEM_IDENTITY_OPERATION')),
ADD COLUMN command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
ADD COLUMN result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
ADD COLUMN system_operation_id text REFERENCES m02_system_identity_operations(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN system_result_id text REFERENCES m02_system_identity_results(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN replacement_command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
ADD COLUMN replacement_result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
ADD COLUMN replacement_system_operation_id text REFERENCES m02_system_identity_operations(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN replacement_system_result_id text REFERENCES m02_system_identity_results(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN replacement_audit_event_id text REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN superseded_by_decision_id text REFERENCES identity_decisions(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT identity_decisions_origin_xor CHECK (
  (origin_type = 'HUMAN_COMMAND' AND command_id IS NOT NULL AND result_id IS NOT NULL
    AND system_operation_id IS NULL AND system_result_id IS NULL AND decision_source = 'HUMAN_COMMAND')
  OR (origin_type = 'SYSTEM_IDENTITY_OPERATION' AND command_id IS NULL AND result_id IS NULL
    AND system_operation_id IS NOT NULL AND system_result_id IS NOT NULL
    AND decision_source IN ('DETERMINISTIC', 'AI_ASSISTED'))
),
ADD CONSTRAINT identity_decisions_state_lineage CHECK (
  (state = 'ACTIVE' AND superseded_by_decision_id IS NULL
    AND replacement_command_id IS NULL AND replacement_result_id IS NULL
    AND replacement_system_operation_id IS NULL AND replacement_system_result_id IS NULL
    AND replacement_audit_event_id IS NULL)
  OR (state = 'SUPERSEDED' AND replacement_audit_event_id IS NOT NULL
    AND ((replacement_command_id IS NOT NULL AND replacement_result_id IS NOT NULL
      AND replacement_system_operation_id IS NULL AND replacement_system_result_id IS NULL)
      OR (replacement_command_id IS NULL AND replacement_result_id IS NULL
        AND replacement_system_operation_id IS NOT NULL AND replacement_system_result_id IS NOT NULL)))
);

ALTER TABLE identity_decisions
ADD CONSTRAINT identity_decisions_system_result_lineage_fk
FOREIGN KEY (system_result_id, system_operation_id, id)
REFERENCES m02_system_identity_results(id, system_operation_id, identity_decision_id)
ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE resource_source_links
ADD COLUMN origin_type text NOT NULL CHECK (origin_type IN ('HUMAN_COMMAND', 'SYSTEM_IDENTITY_OPERATION')),
ADD COLUMN command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
ADD COLUMN result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
ADD COLUMN system_operation_id text REFERENCES m02_system_identity_operations(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN system_result_id text REFERENCES m02_system_identity_results(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT resource_source_links_origin_xor CHECK (
  (origin_type = 'HUMAN_COMMAND' AND command_id IS NOT NULL AND result_id IS NOT NULL
    AND system_operation_id IS NULL AND system_result_id IS NULL)
  OR (origin_type = 'SYSTEM_IDENTITY_OPERATION' AND command_id IS NULL AND result_id IS NULL
    AND system_operation_id IS NOT NULL AND system_result_id IS NOT NULL)
);
ALTER TABLE resource_identities
ADD COLUMN origin_type text NOT NULL CHECK (origin_type IN ('HUMAN_COMMAND', 'SYSTEM_IDENTITY_OPERATION')),
ADD COLUMN command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
ADD COLUMN result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
ADD COLUMN system_operation_id text REFERENCES m02_system_identity_operations(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN system_result_id text REFERENCES m02_system_identity_results(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT resource_identities_origin_xor CHECK (
  (origin_type = 'HUMAN_COMMAND' AND command_id IS NOT NULL AND result_id IS NOT NULL
    AND system_operation_id IS NULL AND system_result_id IS NULL)
  OR (origin_type = 'SYSTEM_IDENTITY_OPERATION' AND command_id IS NULL AND result_id IS NULL
    AND system_operation_id IS NOT NULL AND system_result_id IS NOT NULL)
);
ALTER TABLE resource_version_identities
ADD COLUMN origin_type text NOT NULL CHECK (origin_type IN ('HUMAN_COMMAND', 'SYSTEM_IDENTITY_OPERATION')),
ADD COLUMN command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
ADD COLUMN result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
ADD COLUMN system_operation_id text REFERENCES m02_system_identity_operations(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN system_result_id text REFERENCES m02_system_identity_results(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT resource_version_identities_origin_xor CHECK (
  (origin_type = 'HUMAN_COMMAND' AND command_id IS NOT NULL AND result_id IS NOT NULL
    AND system_operation_id IS NULL AND system_result_id IS NULL)
  OR (origin_type = 'SYSTEM_IDENTITY_OPERATION' AND command_id IS NULL AND result_id IS NULL
    AND system_operation_id IS NOT NULL AND system_result_id IS NOT NULL)
);
ALTER TABLE resource_version_observations
ADD COLUMN origin_type text NOT NULL CHECK (origin_type IN ('HUMAN_COMMAND', 'SYSTEM_IDENTITY_OPERATION')),
ADD COLUMN command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
ADD COLUMN result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
ADD COLUMN system_operation_id text REFERENCES m02_system_identity_operations(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN system_result_id text REFERENCES m02_system_identity_results(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT resource_version_observations_origin_xor CHECK (
  (origin_type = 'HUMAN_COMMAND' AND command_id IS NOT NULL AND result_id IS NOT NULL
    AND system_operation_id IS NULL AND system_result_id IS NULL)
  OR (origin_type = 'SYSTEM_IDENTITY_OPERATION' AND command_id IS NULL AND result_id IS NULL
    AND system_operation_id IS NOT NULL AND system_result_id IS NOT NULL)
);
ALTER TABLE source_repository_identities
ADD COLUMN origin_type text NOT NULL CHECK (origin_type IN ('HUMAN_COMMAND', 'SYSTEM_IDENTITY_OPERATION')),
ADD COLUMN command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
ADD COLUMN result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
ADD COLUMN system_operation_id text REFERENCES m02_system_identity_operations(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN system_result_id text REFERENCES m02_system_identity_results(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT source_repository_identities_origin_xor CHECK (
  (origin_type = 'HUMAN_COMMAND' AND command_id IS NOT NULL AND result_id IS NOT NULL
    AND system_operation_id IS NULL AND system_result_id IS NULL)
  OR (origin_type = 'SYSTEM_IDENTITY_OPERATION' AND command_id IS NULL AND result_id IS NULL
    AND system_operation_id IS NOT NULL AND system_result_id IS NOT NULL)
);
ALTER TABLE source_repository_urls
ADD COLUMN origin_type text NOT NULL CHECK (origin_type IN ('HUMAN_COMMAND', 'SYSTEM_IDENTITY_OPERATION')),
ADD COLUMN command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
ADD COLUMN result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
ADD COLUMN system_operation_id text REFERENCES m02_system_identity_operations(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN system_result_id text REFERENCES m02_system_identity_results(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT source_repository_urls_origin_xor CHECK (
  (origin_type = 'HUMAN_COMMAND' AND command_id IS NOT NULL AND result_id IS NOT NULL
    AND system_operation_id IS NULL AND system_result_id IS NULL)
  OR (origin_type = 'SYSTEM_IDENTITY_OPERATION' AND command_id IS NULL AND result_id IS NULL
    AND system_operation_id IS NOT NULL AND system_result_id IS NOT NULL)
);
ALTER TABLE duplicate_candidates
ADD COLUMN origin_type text NOT NULL CHECK (origin_type IN ('HUMAN_COMMAND', 'SYSTEM_IDENTITY_OPERATION')),
ADD COLUMN command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
ADD COLUMN result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
ADD COLUMN system_operation_id text REFERENCES m02_system_identity_operations(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN system_result_id text REFERENCES m02_system_identity_results(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD COLUMN audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT duplicate_candidates_origin_xor CHECK (
  (origin_type = 'HUMAN_COMMAND' AND command_id IS NOT NULL AND result_id IS NOT NULL
    AND system_operation_id IS NULL AND system_result_id IS NULL)
  OR (origin_type = 'SYSTEM_IDENTITY_OPERATION' AND command_id IS NULL AND result_id IS NULL
    AND system_operation_id IS NOT NULL AND system_result_id IS NOT NULL)
);
ALTER TABLE fork_relationships
ADD COLUMN command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
ADD COLUMN result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
ADD COLUMN audit_event_id text REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE source_repository_relationships
ADD COLUMN command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
ADD COLUMN result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT,
ADD COLUMN audit_event_id text REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE m02_system_identity_results
ADD CONSTRAINT m02_system_identity_results_duplicate_unique
UNIQUE (id, system_operation_id, duplicate_candidate_id);

ALTER TABLE duplicate_candidates
ADD CONSTRAINT duplicate_candidates_system_result_lineage_fk
FOREIGN KEY (system_result_id, system_operation_id, id)
REFERENCES m02_system_identity_results(id, system_operation_id, duplicate_candidate_id)
ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE resource_identities
ADD CONSTRAINT resource_identities_human_origin_fk
FOREIGN KEY (result_id, command_id) REFERENCES m02_manual_command_results(id, command_id)
ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT resource_identities_system_origin_fk
FOREIGN KEY (system_result_id, system_operation_id)
REFERENCES m02_system_identity_results(id, system_operation_id)
ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE resource_version_identities
ADD CONSTRAINT resource_version_identities_human_origin_fk
FOREIGN KEY (result_id, command_id) REFERENCES m02_manual_command_results(id, command_id)
ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT resource_version_identities_system_origin_fk
FOREIGN KEY (system_result_id, system_operation_id)
REFERENCES m02_system_identity_results(id, system_operation_id)
ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE source_repository_identities
ADD CONSTRAINT source_repository_identities_human_origin_fk
FOREIGN KEY (result_id, command_id) REFERENCES m02_manual_command_results(id, command_id)
ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT source_repository_identities_system_origin_fk
FOREIGN KEY (system_result_id, system_operation_id)
REFERENCES m02_system_identity_results(id, system_operation_id)
ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE source_repository_urls
ADD CONSTRAINT source_repository_urls_human_origin_fk
FOREIGN KEY (result_id, command_id) REFERENCES m02_manual_command_results(id, command_id)
ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT source_repository_urls_system_origin_fk
FOREIGN KEY (system_result_id, system_operation_id)
REFERENCES m02_system_identity_results(id, system_operation_id)
ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE resource_source_links
ADD CONSTRAINT resource_source_links_human_origin_fk
FOREIGN KEY (result_id, command_id) REFERENCES m02_manual_command_results(id, command_id)
ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT resource_source_links_system_origin_fk
FOREIGN KEY (system_result_id, system_operation_id)
REFERENCES m02_system_identity_results(id, system_operation_id)
ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE resource_version_observations
ADD CONSTRAINT resource_version_observations_human_origin_fk
FOREIGN KEY (result_id, command_id) REFERENCES m02_manual_command_results(id, command_id)
ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
ADD CONSTRAINT resource_version_observations_system_origin_fk
FOREIGN KEY (system_result_id, system_operation_id)
REFERENCES m02_system_identity_results(id, system_operation_id)
ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE duplicate_candidates
ADD CONSTRAINT duplicate_candidates_human_origin_fk
FOREIGN KEY (result_id, command_id) REFERENCES m02_manual_command_results(id, command_id)
ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE identity_decisions
ADD CONSTRAINT identity_decisions_human_origin_fk
FOREIGN KEY (result_id, command_id) REFERENCES m02_manual_command_results(id, command_id)
ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE m02_ownership_replacements
ADD COLUMN source_entry_id text NOT NULL REFERENCES m01_source_entries(id) ON DELETE RESTRICT,
ADD CONSTRAINT m02_ownership_replacements_predecessor_source_fk
FOREIGN KEY (predecessor_ownership_id, source_entry_id)
REFERENCES candidate_root_ownership(id, source_entry_id) ON DELETE RESTRICT,
ADD CONSTRAINT m02_ownership_replacements_successor_source_fk
FOREIGN KEY (successor_ownership_id, source_entry_id)
REFERENCES candidate_root_ownership(id, source_entry_id) ON DELETE RESTRICT;

CREATE TABLE m02_identity_handoff_markers (
  id text PRIMARY KEY,
  resource_candidate_id text NOT NULL REFERENCES resource_candidates(id) ON DELETE RESTRICT,
  resource_identity_id text NOT NULL REFERENCES resource_identities(id) ON DELETE RESTRICT,
  resource_version_identity_id text NOT NULL REFERENCES resource_version_identities(id) ON DELETE RESTRICT,
  controlling_m02_job_id text NOT NULL,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  identity_decision_id text NOT NULL REFERENCES identity_decisions(id) ON DELETE RESTRICT,
  origin_type text NOT NULL CHECK (origin_type IN ('HUMAN_COMMAND', 'SYSTEM_IDENTITY_OPERATION')),
  command_id text REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
  result_id text REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  system_operation_id text REFERENCES m02_system_identity_operations(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  system_result_id text REFERENCES m02_system_identity_results(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  logical_key text NOT NULL,
  controlling_job_state text DEFAULT 'CONTROLLING',
  state text NOT NULL CHECK (state IN ('ACTIVE', 'SUPERSEDED')),
  supersedes_handoff_marker_id text REFERENCES m02_identity_handoff_markers(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL,
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
  FOREIGN KEY (resource_version_identity_id, resource_identity_id)
    REFERENCES resource_version_identities(id, resource_identity_id) ON DELETE RESTRICT,
  FOREIGN KEY (identity_decision_id, resource_candidate_id)
    REFERENCES identity_decisions(id, resource_candidate_id) ON DELETE RESTRICT,
  FOREIGN KEY (controlling_m02_job_id, source_snapshot_id)
    REFERENCES m02_jobs(id, source_snapshot_id) ON DELETE RESTRICT,
  FOREIGN KEY (controlling_m02_job_id, controlling_job_state)
    REFERENCES m02_jobs(id, supersession_state) ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT m02_identity_handoff_markers_origin_xor CHECK (
    (origin_type = 'HUMAN_COMMAND' AND command_id IS NOT NULL AND result_id IS NOT NULL
      AND system_operation_id IS NULL AND system_result_id IS NULL)
    OR (origin_type = 'SYSTEM_IDENTITY_OPERATION' AND command_id IS NULL AND result_id IS NULL
      AND system_operation_id IS NOT NULL AND system_result_id IS NOT NULL)
  ),
  CHECK (
    (state = 'ACTIVE' AND controlling_job_state = 'CONTROLLING')
    OR (state = 'SUPERSEDED' AND controlling_job_state IS NULL)
  )
);

ALTER TABLE m02_system_identity_results
ADD CONSTRAINT m02_system_identity_results_handoff_unique
UNIQUE (id, system_operation_id, handoff_marker_id),
ADD CONSTRAINT m02_system_identity_results_handoff_fk
FOREIGN KEY (handoff_marker_id) REFERENCES m02_identity_handoff_markers(id)
ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE m02_identity_handoff_markers
ADD CONSTRAINT m02_identity_handoff_markers_system_result_lineage_fk
FOREIGN KEY (system_result_id, system_operation_id, id)
REFERENCES m02_system_identity_results(id, system_operation_id, handoff_marker_id)
ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE m02_identity_handoff_markers
ADD CONSTRAINT m02_identity_handoff_markers_human_origin_fk
FOREIGN KEY (result_id, command_id) REFERENCES m02_manual_command_results(id, command_id)
ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE UNIQUE INDEX m02_identity_handoff_markers_one_active_candidate
ON m02_identity_handoff_markers (resource_candidate_id) WHERE state = 'ACTIVE';

CREATE FUNCTION enforce_active_handoff_candidate_identity_tuple() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM m02_identity_handoff_markers handoff
    JOIN resource_candidates candidate ON candidate.id = handoff.resource_candidate_id
    WHERE handoff.state = 'ACTIVE'
      AND (handoff.resource_identity_id, handoff.resource_version_identity_id)
        IS DISTINCT FROM (candidate.resource_identity_id, candidate.resource_version_identity_id)
  ) THEN
    RAISE EXCEPTION 'ACTIVE_HANDOFF_CANDIDATE_IDENTITY_TUPLE_MISMATCH';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER active_handoff_candidate_identity_tuple_from_handoff
AFTER INSERT OR UPDATE ON m02_identity_handoff_markers
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_active_handoff_candidate_identity_tuple();

CREATE CONSTRAINT TRIGGER active_handoff_candidate_identity_tuple_from_candidate
AFTER INSERT OR UPDATE ON resource_candidates
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_active_handoff_candidate_identity_tuple();
CREATE UNIQUE INDEX m02_identity_handoff_markers_one_active_logical_key
ON m02_identity_handoff_markers (logical_key) WHERE state = 'ACTIVE';

CREATE FUNCTION reject_m02_overlapping_controller() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.supersession_state = 'CONTROLLING' AND EXISTS (
    SELECT 1
    FROM m02_jobs existing
    WHERE existing.job_lineage_id = NEW.job_lineage_id
      AND existing.id <> NEW.id
      AND existing.supersession_state = 'CONTROLLING'
      AND (
        existing.operation_scope = 'FULL_PIPELINE'
        OR NEW.operation_scope = 'FULL_PIPELINE'
        OR NEW.operation_scope = existing.operation_scope
      )
  ) THEN
    RAISE EXCEPTION 'OVERLAPPING_M02_CONTROLLER';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER m02_jobs_overlapping_controller_guard
BEFORE INSERT OR UPDATE ON m02_jobs
FOR EACH ROW EXECUTE FUNCTION reject_m02_overlapping_controller();

CREATE FUNCTION enforce_m02_record_version_increment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD AND NEW.record_version <> OLD.record_version + 1 THEN
    RAISE EXCEPTION 'M02_RECORD_VERSION_INCREMENT_REQUIRED';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION enforce_external_identifier_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.resource_identity_id IS DISTINCT FROM OLD.resource_identity_id
    OR NEW.provider IS DISTINCT FROM OLD.provider
    OR NEW.identifier_type IS DISTINCT FROM OLD.identifier_type
    OR NEW.issuer IS DISTINCT FROM OLD.issuer
    OR NEW.namespace IS DISTINCT FROM OLD.namespace
    OR NEW.normalized_value IS DISTINCT FROM OLD.normalized_value
    OR NEW.normalization_policy_version IS DISTINCT FROM OLD.normalization_policy_version
    OR NEW.evidence_reference_id IS DISTINCT FROM OLD.evidence_reference_id
    OR NEW.canonical_key_hash IS DISTINCT FROM OLD.canonical_key_hash
    OR NEW.canonical_key_payload IS DISTINCT FROM OLD.canonical_key_payload
    OR NEW.provenance IS DISTINCT FROM OLD.provenance
    OR NEW.supersedes_identifier_id IS DISTINCT FROM OLD.supersedes_identifier_id
    OR NEW.record_version <> OLD.record_version + 1
    OR OLD.review_state IN ('REJECTED', 'SUPERSEDED')
    OR (OLD.review_state = 'VERIFIED' AND NEW.review_state <> 'SUPERSEDED')
    OR (OLD.review_state = 'UNREVIEWED'
      AND NEW.review_state NOT IN ('VERIFIED', 'REJECTED', 'SUPERSEDED'))
  THEN
    RAISE EXCEPTION 'EXTERNAL_IDENTIFIER_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER external_identifiers_update_guard
BEFORE UPDATE ON external_identifiers
FOR EACH ROW EXECUTE FUNCTION enforce_external_identifier_update();

CREATE FUNCTION reject_external_identifier_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'EXTERNAL_IDENTIFIER_IMMUTABLE';
END;
$$;

CREATE TRIGGER external_identifiers_delete_guard
BEFORE DELETE ON external_identifiers
FOR EACH ROW EXECUTE FUNCTION reject_external_identifier_delete();

CREATE FUNCTION enforce_m02_clarification_lineage() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  derived_group_id text;
BEGIN
  IF NEW.resource_candidate_id IS NOT NULL THEN
    SELECT root.group_id INTO derived_group_id
    FROM resource_candidates candidate
    JOIN candidate_roots root ON root.id = candidate.candidate_root_id
    WHERE candidate.id = NEW.resource_candidate_id
      AND candidate.source_snapshot_id = NEW.source_snapshot_id;
    IF derived_group_id IS NULL OR derived_group_id <> NEW.candidate_group_id THEN
      RAISE EXCEPTION 'INVALID_M02_CLARIFICATION_LINEAGE';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER m02_clarification_requests_lineage_guard
BEFORE INSERT OR UPDATE ON m02_clarification_requests
FOR EACH ROW EXECUTE FUNCTION enforce_m02_clarification_lineage();

CREATE TRIGGER m02_jobs_record_version_guard
BEFORE UPDATE ON m02_jobs
FOR EACH ROW EXECUTE FUNCTION enforce_m02_record_version_increment();

CREATE TRIGGER m02_command_domain_records_version_guard
BEFORE UPDATE ON m02_command_domain_records
FOR EACH ROW EXECUTE FUNCTION enforce_m02_record_version_increment();

CREATE TABLE m02_job_supersessions (
  id text PRIMARY KEY,
  command_id text NOT NULL REFERENCES manual_resolution_commands(id) ON DELETE RESTRICT,
  result_id text NOT NULL REFERENCES m02_manual_command_results(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  audit_event_id text NOT NULL REFERENCES m02_audit_events(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  guard_key text NOT NULL,
  source_job_id text NOT NULL,
  replacement_job_id text NOT NULL,
  job_lineage_id text NOT NULL,
  operation_scope text NOT NULL CHECK (operation_scope IN ('CLASSIFICATION', 'IDENTITY_RESOLUTION', 'FULL_PIPELINE')),
  supersession_state text NOT NULL CHECK (supersession_state IN ('CONTROLLING', 'SUPERSEDED')),
  reason_code text NOT NULL CHECK (reason_code IN ('FAILED_STAGE_REPLACEMENT', 'RETRY_EXHAUSTED', 'NEW_SUPPORTED_SNAPSHOT', 'POLICY_OR_METHODOLOGY_CHANGE', 'ADMINISTRATIVE_CORRECTION')),
  actor_id text NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('ADMIN', 'EDITOR', 'TECHNICAL_REVIEWER')),
  evidence_ids jsonb NOT NULL CHECK (
    jsonb_typeof(evidence_ids) = 'array'
    AND (reason_code <> 'ADMINISTRATIVE_CORRECTION' OR jsonb_array_length(evidence_ids) > 0)
  ),
  supersession_sequence bigint NOT NULL CHECK (supersession_sequence > 0),
  created_at timestamptz NOT NULL,
  CHECK (source_job_id <> replacement_job_id),
  UNIQUE (source_job_id),
  FOREIGN KEY (source_job_id, job_lineage_id) REFERENCES m02_jobs(id, job_lineage_id) ON DELETE RESTRICT,
  FOREIGN KEY (replacement_job_id, job_lineage_id) REFERENCES m02_jobs(id, job_lineage_id) ON DELETE RESTRICT
);

CREATE FUNCTION enforce_m02_supersession_sequence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  source_sequence bigint;
  replacement_sequence bigint;
  source_scope text;
  replacement_scope text;
  source_state text;
  replacement_state text;
  source_successor text;
  source_acquisition_status text;
  requested_source_job_id text;
BEGIN
  SELECT job.supersession_sequence, job.operation_scope, job.supersession_state,
    job.superseded_by_job_id, acquisition.status
  INTO source_sequence, source_scope, source_state, source_successor, source_acquisition_status
  FROM m02_jobs job JOIN acquisition_jobs acquisition ON acquisition.id = job.id
  WHERE job.id = NEW.source_job_id;
  SELECT supersession_sequence, operation_scope, supersession_state
  INTO replacement_sequence, replacement_scope, replacement_state
  FROM m02_jobs WHERE id = NEW.replacement_job_id;
  SELECT command_payload ->> 'sourceJobId' INTO requested_source_job_id
  FROM manual_resolution_commands WHERE id = NEW.command_id;
  IF source_sequence IS NULL
    OR replacement_sequence IS NULL
    OR replacement_sequence <= source_sequence
    OR NEW.supersession_sequence <> replacement_sequence
    OR NEW.operation_scope <> source_scope
    OR NEW.supersession_state <> 'SUPERSEDED'
    OR source_state <> 'SUPERSEDED'
    OR source_successor <> NEW.replacement_job_id
    OR replacement_state <> 'CONTROLLING'
    OR NOT (
      replacement_scope = source_scope
      OR replacement_scope = 'FULL_PIPELINE'
      OR (replacement_scope = 'CLASSIFICATION' AND source_scope = 'IDENTITY_RESOLUTION')
    )
    OR (NEW.source_job_id = requested_source_job_id AND NOT (
      (NEW.reason_code = 'ADMINISTRATIVE_CORRECTION' AND NEW.actor_role = 'ADMIN')
      OR (NEW.reason_code = 'FAILED_STAGE_REPLACEMENT' AND source_acquisition_status = 'FAILED')
      OR (NEW.reason_code = 'RETRY_EXHAUSTED' AND source_acquisition_status = 'OPERATOR_REVIEW_REQUIRED')
      OR (
        NEW.reason_code IN ('NEW_SUPPORTED_SNAPSHOT', 'POLICY_OR_METHODOLOGY_CHANGE')
        AND source_acquisition_status = 'COMPLETED'
        AND NEW.actor_role IN ('ADMIN', 'EDITOR')
      )
    ))
  THEN
    RAISE EXCEPTION 'INVALID_M02_SUPERSESSION_SEQUENCE';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER m02_job_supersessions_sequence_guard
BEFORE INSERT OR UPDATE ON m02_job_supersessions
FOR EACH ROW EXECUTE FUNCTION enforce_m02_supersession_sequence();

CREATE FUNCTION enforce_m02_superseded_job_successor() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.supersession_state = 'SUPERSEDED' AND (
    NEW.superseded_by_job_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM m02_job_supersessions edge
      WHERE edge.source_job_id = NEW.id
        AND edge.replacement_job_id = NEW.superseded_by_job_id
    )
  ) THEN
    RAISE EXCEPTION 'ORPHAN_M02_SUPERSEDED_JOB';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER m02_jobs_successor_guard
AFTER INSERT OR UPDATE ON m02_jobs
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_superseded_job_successor();

CREATE TABLE m02_concurrency_guards (
  guard_key text PRIMARY KEY,
  guard_type text NOT NULL CHECK (guard_type IN (
    'GROUP_KEY', 'GROUP_MEMBERSHIP', 'ROOT_KEY', 'CANDIDATE_KEY',
    'RESOURCE_SOURCE', 'SOURCE_REPOSITORY', 'RESOURCE_VERSION', 'OBSERVATION',
    'DUPLICATE_DISPOSITION', 'DUPLICATE_PROPOSAL_SET', 'DUPLICATE_PROPOSAL_PAIR',
    'FORK_LINEAGE', 'MIRROR_LINEAGE', 'RELATIONSHIP_PAIR', 'CLARIFICATION_OPEN',
    'CLARIFICATION_TARGET', 'REJECTION_DECISION', 'HANDOFF',
    'JOB_SCOPE_CONTROLLER', 'JOB_REPLACEMENT_INPUT'
  )),
  canonical_payload bytea NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
  UNIQUE NULLS NOT DISTINCT (guard_type, payload_hash),
  CHECK (m02_guard_payload_valid(guard_type, canonical_payload)),
  CHECK (encode(digest(canonical_payload, 'sha256'), 'hex') = payload_hash),
  CHECK (
    guard_key = 'guard:' || guard_type || ':' ||
      rtrim(
        translate(
          replace(encode(digest(canonical_payload, 'sha256'), 'base64'), chr(10), ''),
          '+/',
          '-_'
        ),
        '='
      )
  )
);

CREATE FUNCTION enforce_m02_concurrency_guard_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.guard_key IS DISTINCT FROM OLD.guard_key
    OR NEW.guard_type IS DISTINCT FROM OLD.guard_type
    OR NEW.canonical_payload IS DISTINCT FROM OLD.canonical_payload
    OR NEW.payload_hash IS DISTINCT FROM OLD.payload_hash
    OR NEW.record_version <> OLD.record_version + 1
  THEN
    RAISE EXCEPTION 'M02_CONCURRENCY_GUARD_IDENTITY_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER m02_concurrency_guards_version_guard
BEFORE UPDATE ON m02_concurrency_guards
FOR EACH ROW EXECUTE FUNCTION enforce_m02_concurrency_guard_update();

CREATE TRIGGER repository_candidate_groups_version_guard
BEFORE UPDATE ON repository_candidate_groups
FOR EACH ROW EXECUTE FUNCTION enforce_m02_record_version_increment();
CREATE TRIGGER candidate_roots_version_guard
BEFORE UPDATE ON candidate_roots
FOR EACH ROW EXECUTE FUNCTION enforce_m02_record_version_increment();
CREATE TRIGGER resource_candidates_version_guard
BEFORE UPDATE ON resource_candidates
FOR EACH ROW EXECUTE FUNCTION enforce_m02_record_version_increment();
CREATE FUNCTION enforce_m02_candidate_creation_origin_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.creation_command_id IS DISTINCT FROM OLD.creation_command_id
    OR NEW.creation_result_id IS DISTINCT FROM OLD.creation_result_id
    OR NEW.creation_audit_event_id IS DISTINCT FROM OLD.creation_audit_event_id
  THEN RAISE EXCEPTION 'M02_CANDIDATE_CREATION_ORIGIN_IMMUTABLE'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER resource_candidates_creation_origin_immutable
BEFORE UPDATE ON resource_candidates
FOR EACH ROW EXECUTE FUNCTION enforce_m02_candidate_creation_origin_immutable();
CREATE TRIGGER resource_identities_version_guard
BEFORE UPDATE ON resource_identities
FOR EACH ROW EXECUTE FUNCTION enforce_m02_record_version_increment();
CREATE TRIGGER resource_version_identities_version_guard
BEFORE UPDATE ON resource_version_identities
FOR EACH ROW EXECUTE FUNCTION enforce_m02_record_version_increment();
CREATE TRIGGER source_repository_identities_version_guard
BEFORE UPDATE ON source_repository_identities
FOR EACH ROW EXECUTE FUNCTION enforce_m02_record_version_increment();
CREATE TRIGGER resource_source_links_version_guard
BEFORE UPDATE ON resource_source_links
FOR EACH ROW EXECUTE FUNCTION enforce_m02_record_version_increment();
CREATE TRIGGER duplicate_candidates_version_guard
BEFORE UPDATE ON duplicate_candidates
FOR EACH ROW EXECUTE FUNCTION enforce_m02_record_version_increment();
CREATE TRIGGER fork_relationships_version_guard
BEFORE UPDATE ON fork_relationships
FOR EACH ROW EXECUTE FUNCTION enforce_m02_record_version_increment();
CREATE TRIGGER source_repository_relationships_version_guard
BEFORE UPDATE ON source_repository_relationships
FOR EACH ROW EXECUTE FUNCTION enforce_m02_record_version_increment();
CREATE TRIGGER identity_decisions_version_guard
BEFORE UPDATE ON identity_decisions
FOR EACH ROW EXECUTE FUNCTION enforce_m02_record_version_increment();
CREATE TRIGGER m02_review_states_version_guard
BEFORE UPDATE ON m02_review_states
FOR EACH ROW EXECUTE FUNCTION enforce_m02_record_version_increment();
CREATE TRIGGER m02_candidate_rejection_decisions_version_guard
BEFORE UPDATE ON m02_candidate_rejection_decisions
FOR EACH ROW EXECUTE FUNCTION enforce_m02_record_version_increment();
CREATE TRIGGER m02_clarification_requests_version_guard
BEFORE UPDATE ON m02_clarification_requests
FOR EACH ROW EXECUTE FUNCTION enforce_m02_record_version_increment();
CREATE TRIGGER m02_identity_handoff_markers_version_guard
BEFORE UPDATE ON m02_identity_handoff_markers
FOR EACH ROW EXECUTE FUNCTION enforce_m02_record_version_increment();

ALTER TABLE m02_job_supersessions
ADD CONSTRAINT m02_job_supersessions_guard_fk
FOREIGN KEY (guard_key) REFERENCES m02_concurrency_guards(guard_key) ON DELETE RESTRICT;

CREATE FUNCTION enforce_m02_supersession_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  expected_source_version bigint;
  expected_acquisition_version bigint;
  expected_guard_version bigint;
BEGIN
  SELECT (command.expected_versions ->> ('row:m02_jobs:' || NEW.source_job_id))::bigint,
    (command.expected_versions ->> ('row:acquisition_jobs:' || NEW.source_job_id))::bigint,
    (command.expected_versions ->> NEW.guard_key)::bigint
  INTO expected_source_version, expected_acquisition_version, expected_guard_version
  FROM manual_resolution_commands command
  WHERE command.id = NEW.command_id;

  IF expected_source_version IS NULL
    OR expected_acquisition_version IS NULL
    OR expected_guard_version IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM manual_resolution_commands command
      JOIN m02_jobs source ON source.id = NEW.source_job_id
      JOIN acquisition_jobs acquisition ON acquisition.id = NEW.source_job_id
      JOIN m02_concurrency_guards guard ON guard.guard_key = NEW.guard_key
      JOIN m02_audit_events audit ON audit.id = NEW.audit_event_id
      JOIN m02_manual_command_results result ON result.id = NEW.result_id
      WHERE command.id = NEW.command_id
        AND command.command_type = 'REPLACE_M02_JOB'
        AND command.idempotency_scope = 'M02'
        AND command.actor_id = NEW.actor_id
        AND command.actor_role = NEW.actor_role
        AND command.reason_code = NEW.reason_code
        AND command.result_fingerprint IS NOT NULL
        AND source.record_version = expected_source_version + 1
        AND acquisition.record_version = expected_acquisition_version + 1
        AND guard.guard_type = 'JOB_SCOPE_CONTROLLER'
        AND guard.record_version = expected_guard_version + 1
        AND convert_from(guard.canonical_payload, 'UTF8')::jsonb = jsonb_build_object(
          'components', jsonb_build_object(
            'jobLineageId', NEW.job_lineage_id,
            'operationScope', NEW.operation_scope
          ),
          'guardType', 'JOB_SCOPE_CONTROLLER'
        )
        AND guard.guard_key LIKE 'guard:JOB_SCOPE_CONTROLLER:%'
        AND audit.command_id = NEW.command_id
        AND audit.result_id = NEW.result_id
        AND audit.action = 'SUBJECT_SUPERSEDED'
        AND audit.subject_type = 'M02_JOB'
        AND audit.subject_id = NEW.source_job_id
        AND audit.before_version = expected_source_version
        AND audit.after_version = expected_source_version + 1
        AND result.command_id = NEW.command_id
    )
    OR EXISTS (
      SELECT 1 FROM m02_job_supersessions edge
      WHERE edge.replacement_job_id = NEW.replacement_job_id
        AND edge.id <> NEW.id
        AND (
          edge.command_id <> NEW.command_id
          OR
          edge.actor_id <> NEW.actor_id
          OR edge.actor_role <> NEW.actor_role
          OR edge.reason_code <> NEW.reason_code
          OR edge.job_lineage_id <> NEW.job_lineage_id
        )
    )
  THEN
    RAISE EXCEPTION 'UNAUTHORIZED_M02_SUPERSESSION';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER m02_job_supersessions_authorization_guard
AFTER INSERT ON m02_job_supersessions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_supersession_authorization();

CREATE FUNCTION reject_m02_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'M02_HISTORY_IMMUTABLE';
END;
$$;

CREATE FUNCTION enforce_m02_domain_origin_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  row_value jsonb := to_jsonb(NEW);
  expected_subject_type text;
  expected_after_state text;
  versioned_subject boolean := false;
BEGIN
  expected_subject_type := CASE TG_TABLE_NAME
    WHEN 'resource_identities' THEN 'RESOURCE_IDENTITY'
    WHEN 'resource_version_identities' THEN 'RESOURCE_VERSION_IDENTITY'
    WHEN 'source_repository_identities' THEN 'SOURCE_REPOSITORY_IDENTITY'
    WHEN 'source_repository_urls' THEN 'SOURCE_REPOSITORY_URL'
    WHEN 'resource_source_links' THEN 'RESOURCE_SOURCE_LINK'
    WHEN 'resource_version_observations' THEN 'RESOURCE_VERSION_OBSERVATION'
    WHEN 'duplicate_candidates' THEN 'DUPLICATE_CANDIDATE'
    WHEN 'identity_decisions' THEN 'IDENTITY_DECISION'
    WHEN 'm02_identity_handoff_markers' THEN 'M02_IDENTITY_HANDOFF'
    ELSE NULL
  END;

  IF expected_subject_type IS NULL THEN
    RAISE EXCEPTION 'M02_DOMAIN_ORIGIN_TABLE_UNSUPPORTED';
  END IF;
  IF TG_TABLE_NAME IN (
    'resource_identities', 'resource_version_identities', 'source_repository_identities',
    'resource_source_links', 'duplicate_candidates', 'identity_decisions',
    'm02_identity_handoff_markers'
  ) THEN
    versioned_subject := true;
    expected_after_state := m02_canonical_json(
      CASE TG_TABLE_NAME
        WHEN 'resource_identities' THEN jsonb_build_object(
          'recordVersion', (row_value->>'record_version')::bigint, 'status', row_value->>'status'
        )
        WHEN 'resource_version_identities' THEN jsonb_build_object(
          'recordVersion', (row_value->>'record_version')::bigint, 'status', row_value->>'status'
        )
        WHEN 'source_repository_identities' THEN jsonb_build_object(
          'recordVersion', (row_value->>'record_version')::bigint
        )
        WHEN 'resource_source_links' THEN jsonb_build_object(
          'recordVersion', (row_value->>'record_version')::bigint, 'state', row_value->>'state'
        )
        WHEN 'duplicate_candidates' THEN jsonb_build_object(
          'recordVersion', (row_value->>'record_version')::bigint, 'status', row_value->>'status'
        )
        WHEN 'identity_decisions' THEN jsonb_build_object(
          'recordVersion', (row_value->>'record_version')::bigint, 'state', row_value->>'state'
        )
        ELSE jsonb_build_object(
          'recordVersion', (row_value->>'record_version')::bigint, 'state', row_value->>'state'
        )
      END
    );
  END IF;
  IF TG_TABLE_NAME = 'duplicate_candidates'
    AND row_value->>'origin_type' = 'SYSTEM_IDENTITY_OPERATION'
    AND row_value->>'status' <> 'PROPOSED'
  THEN
    RAISE EXCEPTION 'M02_SYSTEM_DUPLICATE_MUST_BEGIN_PROPOSED';
  END IF;
  IF TG_TABLE_NAME = 'duplicate_candidates'
    AND row_value->>'origin_type' = 'HUMAN_COMMAND'
    AND row_value->>'status' = 'PROPOSED'
  THEN
    RAISE EXCEPTION 'M02_HUMAN_DUPLICATE_CANNOT_BEGIN_PROPOSED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM m02_audit_events audit
    WHERE audit.id = row_value->>'audit_event_id'
      AND audit.origin_type = row_value->>'origin_type'
      AND audit.command_id IS NOT DISTINCT FROM NULLIF(row_value->>'command_id', '')
      AND audit.result_id IS NOT DISTINCT FROM NULLIF(row_value->>'result_id', '')
      AND audit.system_operation_id IS NOT DISTINCT FROM NULLIF(row_value->>'system_operation_id', '')
      AND audit.system_result_id IS NOT DISTINCT FROM NULLIF(row_value->>'system_result_id', '')
      AND audit.action = 'SUBJECT_CREATED'
      AND audit.subject_type = expected_subject_type
      AND audit.subject_id = row_value->>'id'
      AND audit.before_version IS NULL AND audit.before_state IS NULL
      AND (
        (versioned_subject AND audit.after_version = 1 AND audit.after_state = expected_after_state)
        OR (NOT versioned_subject AND audit.after_version IS NULL AND audit.after_state IS NULL)
      )
  ) THEN
    RAISE EXCEPTION 'M02_DOMAIN_ORIGIN_AUDIT_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION enforce_m02_origin_columns_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_value jsonb := to_jsonb(OLD);
  new_value jsonb := to_jsonb(NEW);
BEGIN
  IF old_value->'origin_type' IS DISTINCT FROM new_value->'origin_type'
    OR old_value->'command_id' IS DISTINCT FROM new_value->'command_id'
    OR old_value->'result_id' IS DISTINCT FROM new_value->'result_id'
    OR old_value->'system_operation_id' IS DISTINCT FROM new_value->'system_operation_id'
    OR old_value->'system_result_id' IS DISTINCT FROM new_value->'system_result_id'
    OR old_value->'audit_event_id' IS DISTINCT FROM new_value->'audit_event_id'
  THEN
    RAISE EXCEPTION 'M02_CREATION_ORIGIN_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION enforce_resource_identity_guard_anchor_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.guard_anchor_candidate_id IS DISTINCT FROM OLD.guard_anchor_candidate_id THEN
    RAISE EXCEPTION 'M02_GUARD_ANCHOR_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER resource_identities_guard_anchor_immutable
BEFORE UPDATE ON resource_identities
FOR EACH ROW EXECUTE FUNCTION enforce_resource_identity_guard_anchor_immutable();

CREATE CONSTRAINT TRIGGER resource_identities_origin_audit_guard
AFTER INSERT ON resource_identities DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_domain_origin_audit();
CREATE CONSTRAINT TRIGGER resource_version_identities_origin_audit_guard
AFTER INSERT ON resource_version_identities DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_domain_origin_audit();
CREATE CONSTRAINT TRIGGER source_repository_identities_origin_audit_guard
AFTER INSERT ON source_repository_identities DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_domain_origin_audit();
CREATE CONSTRAINT TRIGGER source_repository_urls_origin_audit_guard
AFTER INSERT ON source_repository_urls DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_domain_origin_audit();
CREATE CONSTRAINT TRIGGER resource_source_links_origin_audit_guard
AFTER INSERT ON resource_source_links DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_domain_origin_audit();
CREATE CONSTRAINT TRIGGER resource_version_observations_origin_audit_guard
AFTER INSERT ON resource_version_observations DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_domain_origin_audit();
CREATE CONSTRAINT TRIGGER duplicate_candidates_origin_audit_guard
AFTER INSERT ON duplicate_candidates DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_domain_origin_audit();
CREATE CONSTRAINT TRIGGER identity_decisions_origin_audit_guard
AFTER INSERT ON identity_decisions DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_domain_origin_audit();
CREATE CONSTRAINT TRIGGER m02_identity_handoff_markers_origin_audit_guard
AFTER INSERT ON m02_identity_handoff_markers DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_domain_origin_audit();

CREATE TRIGGER resource_identities_origin_immutable
BEFORE UPDATE ON resource_identities
FOR EACH ROW EXECUTE FUNCTION enforce_m02_origin_columns_immutable();
CREATE TRIGGER resource_version_identities_origin_immutable
BEFORE UPDATE ON resource_version_identities
FOR EACH ROW EXECUTE FUNCTION enforce_m02_origin_columns_immutable();
CREATE TRIGGER source_repository_identities_origin_immutable
BEFORE UPDATE ON source_repository_identities
FOR EACH ROW EXECUTE FUNCTION enforce_m02_origin_columns_immutable();
CREATE TRIGGER resource_source_links_origin_immutable
BEFORE UPDATE ON resource_source_links
FOR EACH ROW EXECUTE FUNCTION enforce_m02_origin_columns_immutable();
CREATE TRIGGER duplicate_candidates_origin_immutable
BEFORE UPDATE ON duplicate_candidates
FOR EACH ROW EXECUTE FUNCTION enforce_m02_origin_columns_immutable();
CREATE TRIGGER m02_identity_handoff_markers_origin_immutable
BEFORE UPDATE ON m02_identity_handoff_markers
FOR EACH ROW EXECUTE FUNCTION enforce_m02_origin_columns_immutable();
CREATE TRIGGER source_repository_urls_immutable
BEFORE UPDATE OR DELETE ON source_repository_urls
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();
CREATE TRIGGER acquisition_results_immutable
BEFORE UPDATE OR DELETE ON acquisition_results
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();
CREATE TRIGGER classification_evidence_references_immutable
BEFORE UPDATE OR DELETE ON classification_evidence_references
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();
CREATE TRIGGER resource_version_observations_immutable
BEFORE UPDATE OR DELETE ON resource_version_observations
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();

CREATE FUNCTION enforce_identity_decision_six_tiers() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  decision_key text;
  decision_origin text;
  tier_count integer;
BEGIN
  IF TG_TABLE_NAME = 'identity_decisions' THEN
    decision_key := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  ELSE
    decision_key := CASE
      WHEN TG_OP = 'DELETE' THEN OLD.identity_decision_id ELSE NEW.identity_decision_id
    END;
  END IF;

  SELECT origin_type INTO decision_origin FROM identity_decisions WHERE id = decision_key;
  SELECT count(*) INTO tier_count
  FROM identity_decision_tier_evaluations WHERE identity_decision_id = decision_key;

  IF decision_origin = 'SYSTEM_IDENTITY_OPERATION' AND tier_count <> 6 THEN
    RAISE EXCEPTION 'IDENTITY_DECISION_REQUIRES_EXACT_SIX_TIERS';
  END IF;
  IF decision_origin = 'HUMAN_COMMAND' AND tier_count <> 0 THEN
    RAISE EXCEPTION 'HUMAN_DECISION_CANNOT_IMPERSONATE_SYSTEM_INPUT';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION m02_identity_signal_sort_key(signal_key uuid) RETURNS bytea[]
LANGUAGE sql STABLE STRICT AS $$
  SELECT ARRAY[
    convert_to(signal.tier, 'UTF8'),
    convert_to(signal.signal_type, 'UTF8'),
    convert_to(COALESCE(signal.target_type, ''), 'UTF8'),
    convert_to(COALESCE(
      signal.resource_identity_id, signal.resource_version_id, signal.source_repository_id, ''
    ), 'UTF8'),
    decode('00', 'hex')
  ] || COALESCE((
    SELECT array_agg(convert_to(evidence.evidence_reference_id, 'UTF8') ORDER BY evidence.ordinal)
    FROM identity_decision_signal_evidence evidence WHERE evidence.signal_id = signal.id
  ), ARRAY[]::bytea[])
  FROM identity_decision_signals signal WHERE signal.id = signal_key;
$$;

CREATE FUNCTION m02_identity_conflict_target_sort_key(target_key uuid) RETURNS bytea[]
LANGUAGE sql STABLE STRICT AS $$
  SELECT ARRAY[
    convert_to(target.target_type, 'UTF8'),
    convert_to(COALESCE(
      target.resource_identity_id, target.resource_version_id, target.source_repository_id
    ), 'UTF8')
  ]
  FROM identity_decision_conflict_targets target WHERE target.id = target_key;
$$;

CREATE FUNCTION m02_identity_conflict_semantic_key(conflict_key uuid) RETURNS bytea[]
LANGUAGE sql STABLE STRICT AS $$
  SELECT ARRAY[convert_to(conflict.conflict_code, 'UTF8'), decode('00', 'hex')]
    || COALESCE((
      SELECT array_agg(convert_to(m02_canonical_json(jsonb_build_array(
        target.target_type,
        COALESCE(target.resource_identity_id, target.resource_version_id, target.source_repository_id)
      )), 'UTF8') ORDER BY target.ordinal)
      FROM identity_decision_conflict_targets target WHERE target.conflict_id = conflict.id
    ), ARRAY[]::bytea[])
  FROM identity_decision_conflicts conflict WHERE conflict.id = conflict_key;
$$;

CREATE FUNCTION m02_identity_conflict_sort_key(conflict_key uuid) RETURNS bytea[]
LANGUAGE sql STABLE STRICT AS $$
  SELECT m02_identity_conflict_semantic_key(conflict_key);
$$;

CREATE FUNCTION enforce_identity_decision_child_order() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  decision_key text;
BEGIN
  IF TG_TABLE_NAME IN (
    'identity_decision_tier_evaluations', 'identity_decision_signals', 'identity_decision_conflicts'
  ) THEN
    decision_key := CASE WHEN TG_OP = 'DELETE' THEN OLD.identity_decision_id ELSE NEW.identity_decision_id END;
  ELSIF TG_TABLE_NAME = 'identity_decision_signal_evidence' THEN
    SELECT identity_decision_id INTO decision_key FROM identity_decision_signals
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.signal_id ELSE NEW.signal_id END;
  ELSE
    SELECT identity_decision_id INTO decision_key FROM identity_decision_conflicts
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.conflict_id ELSE NEW.conflict_id END;
  END IF;

  IF EXISTS (
    SELECT 1 FROM (
      SELECT ordinal, row_number() OVER (ORDER BY ordinal) - 1 AS expected_ordinal
      FROM identity_decision_signals WHERE identity_decision_id = decision_key
    ) rows WHERE ordinal <> expected_ordinal
  ) OR EXISTS (
    SELECT 1 FROM (
      SELECT evidence.ordinal, row_number() OVER (
        PARTITION BY evidence.signal_id ORDER BY evidence.ordinal
      ) - 1 AS expected_ordinal
      FROM identity_decision_signal_evidence evidence
      JOIN identity_decision_signals signal ON signal.id = evidence.signal_id
      WHERE signal.identity_decision_id = decision_key
    ) rows WHERE ordinal <> expected_ordinal
  ) OR EXISTS (
    SELECT 1 FROM (
      SELECT ordinal, row_number() OVER (ORDER BY ordinal) - 1 AS expected_ordinal
      FROM identity_decision_conflicts WHERE identity_decision_id = decision_key
    ) rows WHERE ordinal <> expected_ordinal
  ) OR EXISTS (
    SELECT 1 FROM (
      SELECT target.ordinal, row_number() OVER (
        PARTITION BY target.conflict_id ORDER BY target.ordinal
      ) - 1 AS expected_ordinal
      FROM identity_decision_conflict_targets target
      JOIN identity_decision_conflicts conflict ON conflict.id = target.conflict_id
      WHERE conflict.identity_decision_id = decision_key
    ) rows WHERE ordinal <> expected_ordinal
  ) OR EXISTS (
    SELECT 1 FROM (
      SELECT evidence.ordinal, row_number() OVER (
        PARTITION BY evidence.conflict_id ORDER BY evidence.ordinal
      ) - 1 AS expected_ordinal
      FROM identity_decision_conflict_evidence evidence
      JOIN identity_decision_conflicts conflict ON conflict.id = evidence.conflict_id
      WHERE conflict.identity_decision_id = decision_key
    ) rows WHERE ordinal <> expected_ordinal
  ) THEN
    RAISE EXCEPTION 'IDENTITY_DECISION_CHILD_ORDINAL_GAP';
  END IF;

  IF EXISTS (
    SELECT 1 FROM (
      SELECT ordinal, m02_identity_signal_sort_key(id) AS sort_key,
        lag(m02_identity_signal_sort_key(id)) OVER (ORDER BY ordinal) AS prior_key
      FROM identity_decision_signals signal WHERE identity_decision_id = decision_key
    ) ordered WHERE prior_key IS NOT NULL AND prior_key >= sort_key
  ) OR EXISTS (
    SELECT 1 FROM (
      SELECT ordinal, convert_to(evidence_reference_id, 'UTF8') AS sort_key,
        lag(convert_to(evidence_reference_id, 'UTF8')) OVER (
          PARTITION BY signal_id ORDER BY ordinal
        ) AS prior_key
      FROM identity_decision_signal_evidence evidence
      WHERE EXISTS (
        SELECT 1 FROM identity_decision_signals signal
        WHERE signal.id = evidence.signal_id AND signal.identity_decision_id = decision_key
      )
    ) ordered WHERE prior_key IS NOT NULL AND prior_key >= sort_key
  ) OR EXISTS (
    SELECT 1 FROM (
      SELECT target.ordinal, m02_identity_conflict_target_sort_key(target.id) AS sort_key,
        lag(m02_identity_conflict_target_sort_key(target.id)) OVER (
            PARTITION BY target.conflict_id ORDER BY target.ordinal
          ) AS prior_key
      FROM identity_decision_conflict_targets target
      JOIN identity_decision_conflicts conflict ON conflict.id = target.conflict_id
      WHERE conflict.identity_decision_id = decision_key
    ) ordered WHERE prior_key IS NOT NULL AND prior_key >= sort_key
  ) OR EXISTS (
    SELECT 1 FROM (
      SELECT ordinal, convert_to(evidence_reference_id, 'UTF8') AS sort_key,
        lag(convert_to(evidence_reference_id, 'UTF8')) OVER (
          PARTITION BY conflict_id ORDER BY ordinal
        ) AS prior_key
      FROM identity_decision_conflict_evidence evidence
      WHERE EXISTS (
        SELECT 1 FROM identity_decision_conflicts conflict
        WHERE conflict.id = evidence.conflict_id AND conflict.identity_decision_id = decision_key
      )
    ) ordered WHERE prior_key IS NOT NULL AND prior_key >= sort_key
  ) OR EXISTS (
    SELECT 1 FROM (
      SELECT conflict.ordinal, m02_identity_conflict_sort_key(conflict.id) AS sort_key,
        lag(m02_identity_conflict_sort_key(conflict.id)) OVER (ORDER BY conflict.ordinal) AS prior_key
      FROM identity_decision_conflicts conflict WHERE identity_decision_id = decision_key
    ) ordered WHERE prior_key IS NOT NULL AND prior_key > sort_key
  ) THEN
    RAISE EXCEPTION 'IDENTITY_DECISION_CHILD_ORDER_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM identity_decision_conflicts conflict
    WHERE conflict.identity_decision_id = decision_key
    GROUP BY m02_identity_conflict_semantic_key(conflict.id)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'IDENTITY_DECISION_CONFLICT_SEMANTIC_DUPLICATE';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER identity_decisions_exact_six_tiers
AFTER INSERT OR UPDATE ON identity_decisions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_six_tiers();

CREATE CONSTRAINT TRIGGER identity_decision_tier_evaluations_exact_six
AFTER INSERT OR UPDATE OR DELETE ON identity_decision_tier_evaluations
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_six_tiers();

CREATE CONSTRAINT TRIGGER identity_decision_children_order_guard
AFTER INSERT OR UPDATE OR DELETE ON identity_decision_signals
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_child_order();
CREATE CONSTRAINT TRIGGER identity_decision_children_order_guard
AFTER INSERT OR UPDATE OR DELETE ON identity_decision_signal_evidence
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_child_order();
CREATE CONSTRAINT TRIGGER identity_decision_children_order_guard
AFTER INSERT OR UPDATE OR DELETE ON identity_decision_conflicts
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_child_order();
CREATE CONSTRAINT TRIGGER identity_decision_children_order_guard
AFTER INSERT OR UPDATE OR DELETE ON identity_decision_conflict_targets
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_child_order();
CREATE CONSTRAINT TRIGGER identity_decision_children_order_guard
AFTER INSERT OR UPDATE OR DELETE ON identity_decision_conflict_evidence
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_child_order();

CREATE FUNCTION enforce_identity_decision_signal_semantics() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  decision_key text;
  decision_row identity_decisions%ROWTYPE;
  terminal_count integer;
  stop_ordinal integer;
  matched text;
BEGIN
  IF TG_TABLE_NAME = 'identity_decisions' THEN
    decision_key := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  ELSE
    decision_key := CASE
      WHEN TG_OP = 'DELETE' THEN OLD.identity_decision_id ELSE NEW.identity_decision_id
    END;
  END IF;
  SELECT * INTO decision_row FROM identity_decisions WHERE id = decision_key;
  IF decision_row.id IS NULL OR decision_row.origin_type <> 'SYSTEM_IDENTITY_OPERATION' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT count(*), min(ordinal), min(tier) FILTER (WHERE evaluation_disposition = 'MATCH')
  INTO terminal_count, stop_ordinal, matched
  FROM identity_decision_tier_evaluations
  WHERE identity_decision_id = decision_key
    AND evaluation_disposition IN ('MATCH', 'CONFLICT', 'MULTIPLE_TARGETS');

  IF terminal_count > 1
    OR decision_row.matched_tier IS DISTINCT FROM matched
    OR (stop_ordinal IS NULL AND EXISTS (
      SELECT 1 FROM identity_decision_tier_evaluations
      WHERE identity_decision_id = decision_key AND evaluation_disposition = 'NOT_APPLICABLE'
    ))
    OR (stop_ordinal IS NOT NULL AND EXISTS (
      SELECT 1 FROM identity_decision_tier_evaluations
      WHERE identity_decision_id = decision_key
        AND ((ordinal <= stop_ordinal AND evaluation_disposition = 'NOT_APPLICABLE')
          OR (ordinal > stop_ordinal AND evaluation_disposition <> 'NOT_APPLICABLE'))
    ))
    OR EXISTS (
      SELECT 1
      FROM identity_decision_signals signal
      LEFT JOIN identity_decision_tier_evaluations tier
        ON tier.identity_decision_id = signal.identity_decision_id AND tier.tier = signal.tier
      WHERE signal.identity_decision_id = decision_key
        AND (
          tier.evaluation_disposition <> 'MATCH'
          OR signal.tier <> CASE
            WHEN starts_with(signal.signal_type, 'P1_') THEN 'P1'
            WHEN starts_with(signal.signal_type, 'P2_') THEN 'P2'
            WHEN starts_with(signal.signal_type, 'P3_') THEN 'P3'
            WHEN starts_with(signal.signal_type, 'P4_') THEN 'P4'
            WHEN starts_with(signal.signal_type, 'P5_') THEN 'P5'
            WHEN starts_with(signal.signal_type, 'P6_') THEN 'P6'
          END
          OR (signal.signal_type = 'P1_ACTIVE_SOURCE_LINK'
            AND signal.target_type <> 'RESOURCE_VERSION')
          OR (signal.signal_type = 'P2_TRUSTED_EXTERNAL_IDENTIFIER'
            AND signal.target_type NOT IN ('RESOURCE_IDENTITY', 'RESOURCE_VERSION'))
          OR (signal.signal_type = 'P3_REVIEWED_FORK_PROVENANCE'
            AND signal.target_type <> 'RESOURCE_VERSION')
          OR (signal.signal_type IN (
              'P3_REVIEWED_MIRROR_PROVENANCE', 'P3_REVIEWED_UPSTREAM_PROVENANCE',
              'P3_PROVIDER_DECLARED_FORK_PROVENANCE'
            ) AND signal.target_type <> 'SOURCE_REPOSITORY')
          OR (signal.signal_type = 'P4_CANDIDATE_CONTENT_FINGERPRINT'
            AND signal.target_type <> 'RESOURCE_VERSION')
          OR (signal.signal_type IN (
              'P5_SOURCE_NAME', 'P5_CREATOR_IDENTITY', 'P5_ORGANIZATION_IDENTITY',
              'P6_WEAK_SIMILAR_NAME'
            ) AND signal.target_type NOT IN ('RESOURCE_IDENTITY', 'RESOURCE_VERSION'))
        )
    )
    OR EXISTS (
      SELECT 1 FROM identity_decision_tier_evaluations tier
      WHERE tier.identity_decision_id = decision_key AND tier.evaluation_disposition = 'MATCH'
        AND NOT EXISTS (
          SELECT 1 FROM identity_decision_signals signal
          WHERE signal.identity_decision_id = tier.identity_decision_id AND signal.tier = tier.tier
        )
    )
    OR (
      decision_row.outcome = 'NEW_RESOURCE' AND matched IS NOT NULL AND matched <> 'P6'
    )
    OR (
      decision_row.outcome IN ('EXACT_REPEAT_REUSE', 'EXISTING_RESOURCE_NEW_VERSION')
      AND matched NOT IN ('P1', 'P2')
    )
    OR (decision_row.outcome = 'POSSIBLE_DUPLICATE' AND matched NOT IN ('P4', 'P5'))
    OR (decision_row.outcome = 'FORK_OF_EXISTING_RESOURCE' AND matched <> 'P3')
    OR (decision_row.outcome = 'AMBIGUOUS_IDENTITY' AND matched IS NOT NULL AND matched <> 'P6')
    OR (decision_row.outcome <> 'AMBIGUOUS_IDENTITY' AND EXISTS (
      SELECT 1 FROM identity_decision_conflicts WHERE identity_decision_id = decision_key
    ))
    OR (decision_row.outcome = 'AMBIGUOUS_IDENTITY' AND NOT EXISTS (
      SELECT 1 FROM identity_decision_conflicts WHERE identity_decision_id = decision_key
    ))
  THEN
    RAISE EXCEPTION 'IDENTITY_DECISION_SIGNAL_SEMANTICS_INVALID';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER identity_decision_signal_semantics_guard
AFTER INSERT ON identity_decisions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_signal_semantics();
CREATE CONSTRAINT TRIGGER identity_decision_signal_semantics_guard
AFTER INSERT OR UPDATE OR DELETE ON identity_decision_tier_evaluations
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_signal_semantics();
CREATE CONSTRAINT TRIGGER identity_decision_signal_semantics_guard
AFTER INSERT OR UPDATE OR DELETE ON identity_decision_signals
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_signal_semantics();
CREATE CONSTRAINT TRIGGER identity_decision_signal_semantics_guard
AFTER INSERT OR UPDATE OR DELETE ON identity_decision_conflicts
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_signal_semantics();

CREATE FUNCTION m02_identity_decision_input_json(
  operation_key text, decision_key text
) RETURNS jsonb
LANGUAGE sql STABLE STRICT AS $$
  SELECT jsonb_build_object(
    'schemaVersion', '1',
    'sourceSnapshotId', operation.source_snapshot_id,
    'candidateId', operation.candidate_id,
    'candidateRootFingerprint', candidate.candidate_root_fingerprint,
    'candidateContentFingerprint', candidate.candidate_content_fingerprint,
    'reconciledClassificationRunId', operation.reconciled_classification_run_id,
    'classificationRunInputFingerprint', operation.classification_run_input_fingerprint,
    'classificationRunOutputFingerprint', operation.classification_run_output_fingerprint,
    'analysisRunIdOrNull', operation.analysis_run_id,
    'analysisRunRequestFingerprintOrNull', operation.analysis_run_request_fingerprint,
    'analysisRunResponseFingerprintOrNull', operation.analysis_run_response_fingerprint,
    'classificationPolicyVersion', operation.classification_policy_version,
    'identityPolicyVersion', operation.identity_policy_version,
    'analysisPolicyVersion', operation.analysis_policy_version,
    'parserProfileVersion', operation.parser_profile_version,
    'promptBundleVersion', operation.prompt_bundle_version,
    'evaluatedTierSequence', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'tier', tier.tier,
        'evaluationDisposition', tier.evaluation_disposition
      ) ORDER BY tier.ordinal)
      FROM identity_decision_tier_evaluations tier
      WHERE tier.identity_decision_id = decision_key
    ), '[]'::jsonb),
    'trustedSignals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'tier', signal.tier,
        'signalType', signal.signal_type,
        'targetTypeOrNull', signal.target_type,
        'targetIdOrNull', COALESCE(
          signal.resource_identity_id, signal.resource_version_id, signal.source_repository_id
        ),
        'evidenceReferenceIds', COALESCE((
          SELECT jsonb_agg(evidence.evidence_reference_id ORDER BY convert_to(evidence.evidence_reference_id, 'UTF8'))
          FROM identity_decision_signal_evidence evidence WHERE evidence.signal_id = signal.id
        ), '[]'::jsonb)
      ) ORDER BY signal.ordinal)
      FROM identity_decision_signals signal
      WHERE signal.identity_decision_id = decision_key
    ), '[]'::jsonb),
    'conflicts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'code', conflict.conflict_code,
        'targets', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'targetType', target.target_type,
            'targetId', COALESCE(
              target.resource_identity_id, target.resource_version_id, target.source_repository_id
            )
          ) ORDER BY target.ordinal)
          FROM identity_decision_conflict_targets target WHERE target.conflict_id = conflict.id
        ), '[]'::jsonb),
        'evidenceReferenceIds', COALESCE((
          SELECT jsonb_agg(evidence.evidence_reference_id ORDER BY convert_to(evidence.evidence_reference_id, 'UTF8'))
          FROM identity_decision_conflict_evidence evidence WHERE evidence.conflict_id = conflict.id
        ), '[]'::jsonb)
      ) ORDER BY conflict.ordinal)
      FROM identity_decision_conflicts conflict
      WHERE conflict.identity_decision_id = decision_key
    ), '[]'::jsonb)
  )
  FROM m02_system_identity_operations operation
  JOIN resource_candidates candidate ON candidate.id = operation.candidate_id
  WHERE operation.id = operation_key;
$$;

CREATE FUNCTION m02_system_result_mutation_plan_json(result_key text) RETURNS jsonb
LANGUAGE sql STABLE STRICT AS $$
  SELECT jsonb_build_object(
    'schemaVersion', '1',
    'automaticProjectorModeId', result.automatic_projector_mode_id,
    'candidateId', result.candidate_id,
    'controllingJobId', result.controlling_job_id,
    'sourceSnapshotId', result.source_snapshot_id,
    'identityDecisionId', result.identity_decision_id,
    'resourceIdentityIdOrNull', result.resource_identity_id,
    'resourceVersionIdentityIdOrNull', result.resource_version_identity_id,
    'duplicateCandidateIdOrNull', result.duplicate_candidate_id,
    'handoffMarkerIdOrNull', result.handoff_marker_id,
    'createdSourceRepositoryIds', to_jsonb(result.created_source_repository_ids),
    'createdSourceRepositoryUrlIds', to_jsonb(result.created_source_repository_url_ids),
    'createdResourceIdentityIds', to_jsonb(result.created_resource_identity_ids),
    'createdResourceVersionIdentityIds', to_jsonb(result.created_resource_version_identity_ids),
    'createdSourceLinkIds', to_jsonb(result.created_source_link_ids),
    'createdObservationIds', to_jsonb(result.created_observation_ids),
    'createdDuplicateCandidateIds', to_jsonb(result.created_duplicate_candidate_ids),
    'createdIdentityDecisionIds', to_jsonb(result.created_identity_decision_ids),
    'createdHandoffMarkerIds', to_jsonb(result.created_handoff_marker_ids),
    'reusedSourceRepositoryIds', to_jsonb(result.reused_source_repository_ids),
    'reusedResourceIdentityIds', to_jsonb(result.reused_resource_identity_ids),
    'reusedResourceVersionIdentityIds', to_jsonb(result.reused_resource_version_identity_ids),
    'reusedSourceLinkIds', to_jsonb(result.reused_source_link_ids),
    'reusedObservationIds', to_jsonb(result.reused_observation_ids),
    'updatedResourceCandidateIds', to_jsonb(result.updated_resource_candidate_ids),
    'updatedReviewStateIds', to_jsonb(result.updated_review_state_ids),
    'updatedAcquisitionJobIds', to_jsonb(result.updated_acquisition_job_ids),
    'updatedM02JobIds', to_jsonb(result.updated_m02_job_ids),
    'supersededSourceLinkIds', to_jsonb(result.superseded_source_link_ids),
    'supersededIdentityDecisionIds', to_jsonb(result.superseded_identity_decision_ids),
    'supersededHandoffMarkerIds', to_jsonb(result.superseded_handoff_marker_ids),
    'supersededDuplicateCandidateIds', to_jsonb(result.superseded_duplicate_candidate_ids),
    'createdIdentityDecisionTierEvaluationIds', to_jsonb(result.created_identity_decision_tier_evaluation_ids),
    'createdIdentityDecisionSignalIds', to_jsonb(result.created_identity_decision_signal_ids),
    'createdIdentityDecisionSignalEvidenceIds', to_jsonb(result.created_identity_decision_signal_evidence_ids),
    'createdIdentityDecisionConflictIds', to_jsonb(result.created_identity_decision_conflict_ids),
    'createdIdentityDecisionConflictTargetIds', to_jsonb(result.created_identity_decision_conflict_target_ids),
    'createdIdentityDecisionConflictEvidenceIds', to_jsonb(result.created_identity_decision_conflict_evidence_ids),
    'finalCandidateState', result.final_candidate_state,
    'finalReviewState', result.final_review_state,
    'finalAcquisitionJobStatus', result.final_acquisition_job_status,
    'finalM02JobStatus', result.final_m02_job_status,
    'finalM02Stage', result.final_m02_stage
  )
  FROM m02_system_identity_results result WHERE result.id = result_key;
$$;

CREATE FUNCTION m02_system_plan_row_values_match(
  table_key text,
  row_key text,
  planned_values jsonb
) RETURNS boolean LANGUAGE plpgsql STABLE STRICT AS $$
DECLARE
  matches boolean := false;
  allowed_tables constant text[] := ARRAY[
    'identity_decisions', 'identity_decision_tier_evaluations',
    'identity_decision_signals', 'identity_decision_signal_evidence',
    'identity_decision_conflicts', 'identity_decision_conflict_targets',
    'identity_decision_conflict_evidence', 'source_repository_identities',
    'source_repository_urls', 'resource_identities', 'resource_version_identities',
    'resource_source_links', 'resource_version_observations', 'duplicate_candidates',
    'm02_identity_handoff_markers', 'resource_candidates', 'm02_review_states',
    'acquisition_jobs', 'm02_jobs', 'm02_system_identity_operations',
    'm02_system_identity_results'
  ];
BEGIN
  IF table_key <> ALL(allowed_tables) OR jsonb_typeof(planned_values) <> 'object' THEN
    RETURN false;
  END IF;
  EXECUTE format(
    'SELECT (($2 - ARRAY[''created_at'',''observed_at'',''updated_at'',''occurred_at'',''accepted_at''])
       <@ (to_jsonb(row_value) - ARRAY[''created_at'',''observed_at'',''updated_at'',''occurred_at'',''accepted_at'']))
       AND (NOT ($2 ? ''created_at'') OR
         ($2->>''created_at'')::timestamptz = (to_jsonb(row_value)->>''created_at'')::timestamptz)
       AND (NOT ($2 ? ''observed_at'') OR
         ($2->>''observed_at'')::timestamptz = (to_jsonb(row_value)->>''observed_at'')::timestamptz)
       AND (NOT ($2 ? ''updated_at'') OR
         ($2->>''updated_at'')::timestamptz = (to_jsonb(row_value)->>''updated_at'')::timestamptz)
       AND (NOT ($2 ? ''occurred_at'') OR
         ($2->>''occurred_at'')::timestamptz = (to_jsonb(row_value)->>''occurred_at'')::timestamptz)
       AND (NOT ($2 ? ''accepted_at'') OR
         ($2->>''accepted_at'')::timestamptz = (to_jsonb(row_value)->>''accepted_at'')::timestamptz)
     FROM %I row_value WHERE row_value.id::text=$1',
    table_key
  ) INTO matches USING row_key, planned_values;
  RETURN COALESCE(matches, false);
END;
$$;

CREATE FUNCTION m02_system_plan_before_values_match(
  result_key text,
  table_key text,
  row_key text,
  planned_values jsonb
) RETURNS boolean LANGUAGE plpgsql STABLE STRICT AS $$
DECLARE
  result_row m02_system_identity_results%ROWTYPE;
  operation_row m02_system_identity_operations%ROWTYPE;
  expected_action text;
  expected_subject_type text;
  expected_state jsonb;
  expected_version text;
  matches boolean := false;
BEGIN
  SELECT * INTO result_row FROM m02_system_identity_results WHERE id=result_key;
  SELECT * INTO operation_row FROM m02_system_identity_operations
    WHERE id=result_row.system_operation_id;
  IF result_row.id IS NULL OR operation_row.id IS NULL
    OR jsonb_typeof(planned_values) <> 'object'
  THEN RETURN false; END IF;

  CASE table_key
    WHEN 'resource_candidates' THEN
      IF NOT m02_jsonb_has_exact_keys(planned_values, ARRAY[
        'status','identity_outcome','resource_identity_id','resource_version_identity_id','record_version'
      ]) THEN RETURN false; END IF;
      expected_action := 'SUBJECT_UPDATED';
      expected_subject_type := 'RESOURCE_CANDIDATE';
      expected_state := jsonb_build_object(
        'status', planned_values->'status',
        'identityOutcome', planned_values->'identity_outcome',
        'resourceIdentityId', planned_values->'resource_identity_id',
        'resourceVersionIdentityId', planned_values->'resource_version_identity_id',
        'recordVersion', planned_values->'record_version'
      );
    WHEN 'm02_review_states' THEN
      IF NOT m02_jsonb_has_exact_keys(
        planned_values, ARRAY['review_state','record_version']
      ) THEN RETURN false; END IF;
      expected_action := 'SUBJECT_UPDATED';
      expected_subject_type := 'M02_REVIEW_STATE';
      expected_state := jsonb_build_object(
        'reviewState', planned_values->'review_state',
        'recordVersion', planned_values->'record_version'
      );
    WHEN 'acquisition_jobs' THEN
      IF NOT m02_jsonb_has_exact_keys(
        planned_values, ARRAY['status','record_version']
      ) THEN RETURN false; END IF;
      expected_action := 'SUBJECT_UPDATED';
      expected_subject_type := 'ACQUISITION_JOB';
      expected_state := jsonb_build_object(
        'status', planned_values->'status',
        'recordVersion', planned_values->'record_version'
      );
    WHEN 'm02_jobs' THEN
      IF NOT m02_jsonb_has_exact_keys(
        planned_values, ARRAY['current_stage','review_state','record_version']
      ) THEN RETURN false; END IF;
      expected_action := 'SUBJECT_UPDATED';
      expected_subject_type := 'M02_JOB';
      expected_state := jsonb_build_object(
        'currentStage', planned_values->'current_stage',
        'reviewState', planned_values->'review_state',
        'recordVersion', planned_values->'record_version'
      );
    WHEN 'resource_source_links' THEN
      IF NOT m02_jsonb_has_exact_keys(
        planned_values, ARRAY['state','record_version']
      ) THEN RETURN false; END IF;
      expected_action := 'SUBJECT_SUPERSEDED';
      expected_subject_type := 'RESOURCE_SOURCE_LINK';
      expected_state := jsonb_build_object(
        'state', planned_values->'state',
        'recordVersion', planned_values->'record_version'
      );
    WHEN 'identity_decisions' THEN
      IF NOT m02_jsonb_has_exact_keys(
        planned_values, ARRAY['state','record_version']
      ) THEN RETURN false; END IF;
      expected_action := 'SUBJECT_SUPERSEDED';
      expected_subject_type := 'IDENTITY_DECISION';
      expected_state := jsonb_build_object(
        'state', planned_values->'state',
        'recordVersion', planned_values->'record_version'
      );
    ELSE RETURN false;
  END CASE;

  expected_version := operation_row.system_expected_versions->>
    ('row:' || table_key || ':' || row_key);
  IF expected_version IS NULL
    OR jsonb_typeof(planned_values->'record_version') <> 'number'
    OR expected_version::bigint <> (planned_values->>'record_version')::bigint
  THEN RETURN false; END IF;

  SELECT EXISTS (
    SELECT 1 FROM m02_audit_events audit
    WHERE audit.system_operation_id=result_row.system_operation_id
      AND audit.system_result_id=result_row.id
      AND audit.action=expected_action
      AND audit.subject_type=expected_subject_type
      AND audit.subject_id=row_key
      AND audit.before_version=(planned_values->>'record_version')::bigint
      AND audit.before_state::jsonb=expected_state
  ) INTO matches;
  RETURN matches;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE FUNCTION m02_system_plan_values_shape_valid(
  table_key text,
  mutation_kind text,
  planned_values jsonb
) RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN
  IF jsonb_typeof(planned_values) <> 'object' THEN RETURN false; END IF;
  IF mutation_kind = 'CREATE' THEN
    RETURN CASE table_key
      WHEN 'identity_decisions' THEN m02_jsonb_has_exact_keys(planned_values, ARRAY[
        'id','resource_candidate_id','outcome','matched_tier','confidence','identity_policy_version',
        'decision_source','signals','rejected_lower_tier_signals','conflicts','audit_fingerprint',
        'state','supersedes_decision_id','created_at','record_version','origin_type',
        'system_operation_id','system_result_id','audit_event_id'
      ])
      WHEN 'identity_decision_tier_evaluations' THEN m02_jsonb_has_exact_keys(
        planned_values, ARRAY[
          'id','identity_decision_id','ordinal','tier','evaluation_disposition','audit_event_id','created_at'
        ]
      )
      WHEN 'identity_decision_signals' THEN m02_jsonb_has_exact_keys(planned_values, ARRAY[
        'id','identity_decision_id','ordinal','tier','signal_type','target_type',
        'resource_identity_id','resource_version_id','source_repository_id','audit_event_id','created_at'
      ])
      WHEN 'identity_decision_signal_evidence' THEN m02_jsonb_has_exact_keys(
        planned_values, ARRAY[
          'id','signal_id','ordinal','evidence_reference_id','audit_event_id','created_at'
        ]
      )
      WHEN 'identity_decision_conflicts' THEN m02_jsonb_has_exact_keys(
        planned_values, ARRAY[
          'id','identity_decision_id','ordinal','conflict_code','audit_event_id','created_at'
        ]
      )
      WHEN 'identity_decision_conflict_targets' THEN m02_jsonb_has_exact_keys(
        planned_values, ARRAY[
          'id','conflict_id','ordinal','target_type','resource_identity_id','resource_version_id',
          'source_repository_id','audit_event_id','created_at'
        ]
      )
      WHEN 'identity_decision_conflict_evidence' THEN m02_jsonb_has_exact_keys(
        planned_values, ARRAY[
          'id','conflict_id','ordinal','evidence_reference_id','audit_event_id','created_at'
        ]
      )
      WHEN 'source_repository_identities' THEN m02_jsonb_has_exact_keys(planned_values, ARRAY[
        'id','provider','provider_repository_id','created_at','record_version',
        'first_observed_source_snapshot_id','origin_type','system_operation_id','system_result_id',
        'audit_event_id'
      ])
      WHEN 'source_repository_urls' THEN m02_jsonb_has_exact_keys(planned_values, ARRAY[
        'id','source_repository_id','provider','provider_repository_id','canonical_url',
        'source_snapshot_id','observed_at','state','origin_type','system_operation_id',
        'system_result_id','audit_event_id'
      ])
      WHEN 'resource_identities' THEN m02_jsonb_has_exact_keys(planned_values, ARRAY[
        'id','status','reliable_identity_token','reliable_token_evidence_id','created_at',
        'record_version','guard_anchor_candidate_id','origin_type','system_operation_id',
        'system_result_id','audit_event_id'
      ])
      WHEN 'resource_version_identities' THEN m02_jsonb_has_exact_keys(planned_values, ARRAY[
        'id','resource_identity_id','content_fingerprint','canonical_payload',
        'first_observed_source_snapshot_id','first_observed_candidate_root_id',
        'first_observed_source_revision','observation_label','status','created_at','record_version',
        'origin_type','system_operation_id','system_result_id','audit_event_id'
      ])
      WHEN 'resource_source_links' THEN m02_jsonb_has_exact_keys(planned_values, ARRAY[
        'id','source_repository_id','normalized_root_path','target_resource_version_id','relationship',
        'evidence_ids','decision_id','reason','actor_id','created_at','state',
        'supersedes_source_link_id','record_version','origin_type','system_operation_id',
        'system_result_id','audit_event_id'
      ])
      WHEN 'resource_version_observations' THEN m02_jsonb_has_exact_keys(planned_values, ARRAY[
        'id','resource_version_identity_id','source_snapshot_id','candidate_root_id',
        'resource_source_link_id','source_repository_id','provider','provider_repository_id',
        'normalized_root_path','immutable_revision','observed_at','origin_type','system_operation_id',
        'system_result_id','audit_event_id'
      ])
      WHEN 'duplicate_candidates' THEN m02_jsonb_has_exact_keys(planned_values, ARRAY[
        'id','resource_candidate_id','target_resource_version_id','status','evidence_ids','decision_id',
        'reason','actor_id','created_at','record_version','origin_type','system_operation_id',
        'system_result_id','audit_event_id'
      ])
      WHEN 'm02_identity_handoff_markers' THEN m02_jsonb_has_exact_keys(planned_values, ARRAY[
        'id','resource_candidate_id','resource_identity_id','resource_version_identity_id',
        'controlling_m02_job_id','source_snapshot_id','identity_decision_id','origin_type',
        'system_operation_id','system_result_id','audit_event_id','logical_key','state','created_at',
        'record_version'
      ])
      ELSE false
    END;
  ELSIF mutation_kind = 'UPDATE_AFTER' THEN
    RETURN CASE table_key
      WHEN 'resource_candidates' THEN m02_jsonb_has_exact_keys(planned_values, ARRAY[
        'status','identity_outcome','resource_identity_id','resource_version_identity_id',
        'updated_at','record_version'
      ])
      WHEN 'm02_review_states' THEN m02_jsonb_has_exact_keys(
        planned_values, ARRAY['review_state','record_version']
      )
      WHEN 'acquisition_jobs' THEN m02_jsonb_has_exact_keys(
        planned_values, ARRAY['status','record_version']
      )
      WHEN 'm02_jobs' THEN m02_jsonb_has_exact_keys(
        planned_values, ARRAY['current_stage','review_state','record_version']
      )
      ELSE false
    END;
  ELSIF mutation_kind = 'SUPERSEDE_AFTER' THEN
    RETURN CASE table_key
      WHEN 'resource_source_links' THEN m02_jsonb_has_exact_keys(
        planned_values, ARRAY['state','record_version']
      )
      WHEN 'identity_decisions' THEN m02_jsonb_has_exact_keys(planned_values, ARRAY[
        'state','replacement_system_operation_id','replacement_system_result_id',
        'replacement_audit_event_id','superseded_by_decision_id','record_version'
      ])
      ELSE false
    END;
  END IF;
  RETURN false;
END;
$$;

CREATE FUNCTION m02_system_mutation_plan_body_matches(
  result_key text,
  plan_value jsonb
) RETURNS boolean LANGUAGE plpgsql STABLE STRICT AS $$
DECLARE
  result_row m02_system_identity_results%ROWTYPE;
  domain_value jsonb;
  expected_allocated jsonb;
  row_value jsonb;
  audit_value jsonb;
  rows_match boolean;
BEGIN
  SELECT * INTO result_row FROM m02_system_identity_results WHERE id=result_key;
  IF result_row.id IS NULL THEN RETURN false; END IF;
  domain_value := plan_value->'domainMutationPlan';
  IF NOT (
    m02_jsonb_has_exact_keys(plan_value, ARRAY['schemaVersion','concurrencyPlan','domainMutationPlan'])
    AND plan_value->>'schemaVersion'='1'
    AND m02_jsonb_has_exact_keys(domain_value, ARRAY[
      'schemaVersion','allocatedIds','operation','creates','updates','supersedes','audits','result',
      'postconditions'
    ])
    AND domain_value->>'schemaVersion'='1'
    AND jsonb_typeof(domain_value->'allocatedIds')='array'
    AND jsonb_typeof(domain_value->'creates')='array'
    AND jsonb_typeof(domain_value->'updates')='array'
    AND jsonb_typeof(domain_value->'supersedes')='array'
    AND jsonb_typeof(domain_value->'audits')='array'
    AND m02_jsonb_has_exact_keys(domain_value->'operation', ARRAY['id','values'])
    AND m02_jsonb_has_exact_keys(domain_value->'result', ARRAY['id','values'])
    AND m02_jsonb_has_exact_keys(domain_value->'operation'->'values', ARRAY[
      'operation_kind','automatic_projector_mode_id','source_snapshot_id','candidate_id',
      'controlling_job_id','reconciled_classification_run_id',
      'classification_run_input_fingerprint','classification_run_output_fingerprint',
      'classification_policy_version','identity_policy_version','analysis_policy_version',
      'parser_profile_version','prompt_bundle_version','analysis_run_id',
      'analysis_run_request_fingerprint','analysis_run_response_fingerprint',
      'identity_decision_input_payload','identity_decision_input_fingerprint',
      'system_replay_locator_payload','system_replay_lookup_key','idempotency_scope',
      'idempotency_key','idempotency_payload','system_expected_versions',
      'system_expected_versions_payload','system_operation_request_payload',
      'system_operation_fingerprint','system_actor_id','actor_type','actor_role','created_at'
    ])
    AND m02_jsonb_has_exact_keys(domain_value->'result'->'values', ARRAY[
      'system_operation_id','status','automatic_projector_mode_id','candidate_id',
      'controlling_job_id','source_snapshot_id','identity_decision_id','resource_identity_id',
      'resource_version_identity_id','duplicate_candidate_id','handoff_marker_id',
      'accepted_audit_event_id','accepted_at'
    ])
    AND domain_value->'operation'->>'id'=result_row.system_operation_id
    AND domain_value->'result'->>'id'=result_row.id
    AND domain_value->'postconditions'=m02_system_result_mutation_plan_json(result_key)
    AND m02_system_plan_row_values_match(
      'm02_system_identity_operations', result_row.system_operation_id,
      domain_value->'operation'->'values'
    )
    AND m02_system_plan_row_values_match(
      'm02_system_identity_results', result_row.id, domain_value->'result'->'values'
    )
  ) THEN
    RETURN false;
  END IF;

  WITH allocated(id) AS (
    SELECT result_row.system_operation_id UNION ALL SELECT result_row.id
    UNION ALL SELECT unnest(result_row.created_source_repository_ids)::text
    UNION ALL SELECT unnest(result_row.created_source_repository_url_ids)::text
    UNION ALL SELECT unnest(result_row.created_resource_identity_ids)::text
    UNION ALL SELECT unnest(result_row.created_resource_version_identity_ids)::text
    UNION ALL SELECT unnest(result_row.created_source_link_ids)::text
    UNION ALL SELECT unnest(result_row.created_observation_ids)::text
    UNION ALL SELECT unnest(result_row.created_duplicate_candidate_ids)::text
    UNION ALL SELECT unnest(result_row.created_identity_decision_ids)::text
    UNION ALL SELECT unnest(result_row.created_handoff_marker_ids)::text
    UNION ALL SELECT unnest(result_row.created_identity_decision_tier_evaluation_ids)::text
    UNION ALL SELECT unnest(result_row.created_identity_decision_signal_ids)::text
    UNION ALL SELECT unnest(result_row.created_identity_decision_signal_evidence_ids)::text
    UNION ALL SELECT unnest(result_row.created_identity_decision_conflict_ids)::text
    UNION ALL SELECT unnest(result_row.created_identity_decision_conflict_target_ids)::text
    UNION ALL SELECT unnest(result_row.created_identity_decision_conflict_evidence_ids)::text
    UNION ALL SELECT audit.id FROM m02_audit_events audit
      WHERE audit.system_operation_id=result_row.system_operation_id
        AND audit.system_result_id=result_row.id
  )
  SELECT COALESCE(jsonb_agg(id ORDER BY convert_to(id,'UTF8')), '[]'::jsonb)
  INTO expected_allocated FROM allocated;
  IF domain_value->'allocatedIds' <> expected_allocated THEN RETURN false; END IF;

  WITH expected(table_name,primary_key) AS (
    SELECT 'source_repository_identities', unnest(result_row.created_source_repository_ids)::text
    UNION ALL SELECT 'source_repository_urls', unnest(result_row.created_source_repository_url_ids)::text
    UNION ALL SELECT 'resource_identities', unnest(result_row.created_resource_identity_ids)::text
    UNION ALL SELECT 'resource_version_identities', unnest(result_row.created_resource_version_identity_ids)::text
    UNION ALL SELECT 'resource_source_links', unnest(result_row.created_source_link_ids)::text
    UNION ALL SELECT 'resource_version_observations', unnest(result_row.created_observation_ids)::text
    UNION ALL SELECT 'duplicate_candidates', unnest(result_row.created_duplicate_candidate_ids)::text
    UNION ALL SELECT 'identity_decisions', unnest(result_row.created_identity_decision_ids)::text
    UNION ALL SELECT 'm02_identity_handoff_markers', unnest(result_row.created_handoff_marker_ids)::text
    UNION ALL SELECT 'identity_decision_tier_evaluations', unnest(result_row.created_identity_decision_tier_evaluation_ids)::text
    UNION ALL SELECT 'identity_decision_signals', unnest(result_row.created_identity_decision_signal_ids)::text
    UNION ALL SELECT 'identity_decision_signal_evidence', unnest(result_row.created_identity_decision_signal_evidence_ids)::text
    UNION ALL SELECT 'identity_decision_conflicts', unnest(result_row.created_identity_decision_conflict_ids)::text
    UNION ALL SELECT 'identity_decision_conflict_targets', unnest(result_row.created_identity_decision_conflict_target_ids)::text
    UNION ALL SELECT 'identity_decision_conflict_evidence', unnest(result_row.created_identity_decision_conflict_evidence_ids)::text
  ), planned AS (
    SELECT entry->>'tableName' table_name, entry->>'primaryKey' primary_key
    FROM jsonb_array_elements(domain_value->'creates') entry
  )
  SELECT NOT EXISTS (SELECT * FROM expected EXCEPT SELECT * FROM planned)
    AND NOT EXISTS (SELECT * FROM planned EXCEPT SELECT * FROM expected)
    AND (SELECT count(*) FROM expected)=(SELECT count(*) FROM planned)
  INTO rows_match;
  IF NOT rows_match THEN RETURN false; END IF;
  FOR row_value IN SELECT value FROM jsonb_array_elements(domain_value->'creates') LOOP
    IF NOT m02_jsonb_has_exact_keys(row_value, ARRAY['tableName','primaryKey','values'])
      OR NOT m02_system_plan_values_shape_valid(
        row_value->>'tableName', 'CREATE', row_value->'values'
      )
      OR NOT m02_system_plan_row_values_match(
        row_value->>'tableName', row_value->>'primaryKey', row_value->'values'
      )
    THEN RETURN false; END IF;
  END LOOP;

  WITH expected(table_name,primary_key) AS (
    SELECT 'resource_candidates', unnest(result_row.updated_resource_candidate_ids)::text
    UNION ALL SELECT 'm02_review_states', unnest(result_row.updated_review_state_ids)::text
    UNION ALL SELECT 'acquisition_jobs', unnest(result_row.updated_acquisition_job_ids)::text
    UNION ALL SELECT 'm02_jobs', unnest(result_row.updated_m02_job_ids)::text
  ), planned AS (
    SELECT entry->>'tableName', entry->>'primaryKey'
    FROM jsonb_array_elements(domain_value->'updates') entry
  )
  SELECT NOT EXISTS (SELECT * FROM expected EXCEPT SELECT * FROM planned)
    AND NOT EXISTS (SELECT * FROM planned EXCEPT SELECT * FROM expected)
    AND (SELECT count(*) FROM expected)=(SELECT count(*) FROM planned)
  INTO rows_match;
  IF NOT rows_match THEN RETURN false; END IF;
  FOR row_value IN SELECT value FROM jsonb_array_elements(domain_value->'updates') LOOP
    IF NOT m02_jsonb_has_exact_keys(row_value, ARRAY['tableName','primaryKey','beforeValues','afterValues'])
      OR NOT m02_system_plan_before_values_match(
        result_key, row_value->>'tableName', row_value->>'primaryKey', row_value->'beforeValues'
      )
      OR NOT m02_system_plan_values_shape_valid(
        row_value->>'tableName', 'UPDATE_AFTER', row_value->'afterValues'
      )
      OR NOT m02_system_plan_row_values_match(
        row_value->>'tableName', row_value->>'primaryKey', row_value->'afterValues'
      )
    THEN RETURN false; END IF;
  END LOOP;

  WITH expected(table_name,primary_key) AS (
    SELECT 'resource_source_links', unnest(result_row.superseded_source_link_ids)::text
    UNION ALL SELECT 'identity_decisions', unnest(result_row.superseded_identity_decision_ids)::text
    UNION ALL SELECT 'm02_identity_handoff_markers', unnest(result_row.superseded_handoff_marker_ids)::text
    UNION ALL SELECT 'duplicate_candidates', unnest(result_row.superseded_duplicate_candidate_ids)::text
  ), planned AS (
    SELECT entry->>'tableName', entry->>'primaryKey'
    FROM jsonb_array_elements(domain_value->'supersedes') entry
  )
  SELECT NOT EXISTS (SELECT * FROM expected EXCEPT SELECT * FROM planned)
    AND NOT EXISTS (SELECT * FROM planned EXCEPT SELECT * FROM expected)
    AND (SELECT count(*) FROM expected)=(SELECT count(*) FROM planned)
  INTO rows_match;
  IF NOT rows_match THEN RETURN false; END IF;
  FOR row_value IN SELECT value FROM jsonb_array_elements(domain_value->'supersedes') LOOP
    IF NOT m02_jsonb_has_exact_keys(row_value, ARRAY['tableName','primaryKey','beforeValues','afterValues'])
      OR NOT m02_system_plan_before_values_match(
        result_key, row_value->>'tableName', row_value->>'primaryKey', row_value->'beforeValues'
      )
      OR NOT m02_system_plan_values_shape_valid(
        row_value->>'tableName', 'SUPERSEDE_AFTER', row_value->'afterValues'
      )
      OR NOT m02_system_plan_row_values_match(
        row_value->>'tableName', row_value->>'primaryKey', row_value->'afterValues'
      )
    THEN RETURN false; END IF;
  END LOOP;

  IF (SELECT count(*) FROM jsonb_array_elements(domain_value->'audits')) <>
    (SELECT count(*) FROM m02_audit_events audit
     WHERE audit.system_operation_id=result_row.system_operation_id
       AND audit.system_result_id=result_row.id)
  THEN RETURN false; END IF;
  FOR audit_value IN SELECT value FROM jsonb_array_elements(domain_value->'audits') LOOP
    IF NOT m02_jsonb_has_exact_keys(audit_value, ARRAY[
      'id','action','subjectType','subjectId','beforeVersion','afterVersion','beforeState','afterState',
      'metadata','originType','actorType','actorId','actorRole','requestId','idempotencyScope',
      'idempotencyKey','reasonCode','reasonText','sourceSnapshotId','controllingJobId','occurredAt',
      'systemOperationId','systemResultId'
    ]) OR NOT EXISTS (
      SELECT 1 FROM m02_audit_events audit WHERE audit.id=audit_value->>'id'
        AND audit.system_operation_id=result_row.system_operation_id
        AND audit.system_result_id=result_row.id
        AND audit.system_operation_id=audit_value->>'systemOperationId'
        AND audit.system_result_id=audit_value->>'systemResultId'
        AND audit.action=audit_value->>'action'
        AND audit.subject_type=audit_value->>'subjectType'
        AND audit.subject_id=audit_value->>'subjectId'
        AND audit.before_version IS NOT DISTINCT FROM (audit_value->>'beforeVersion')::bigint
        AND audit.after_version IS NOT DISTINCT FROM (audit_value->>'afterVersion')::bigint
        AND audit.before_state IS NOT DISTINCT FROM audit_value->>'beforeState'
        AND audit.after_state IS NOT DISTINCT FROM audit_value->>'afterState'
        AND audit.metadata=audit_value->'metadata'
        AND audit.origin_type=audit_value->>'originType'
        AND audit.actor_type=audit_value->>'actorType'
        AND audit.actor_id=audit_value->>'actorId'
        AND audit.actor_role IS NOT DISTINCT FROM audit_value->>'actorRole'
        AND audit.request_id=audit_value->>'requestId'
        AND audit.idempotency_scope=audit_value->>'idempotencyScope'
        AND audit.idempotency_key=audit_value->>'idempotencyKey'
        AND audit.reason_code=audit_value->>'reasonCode'
        AND audit.reason_text=audit_value->>'reasonText'
        AND audit.source_snapshot_id=audit_value->>'sourceSnapshotId'
        AND audit.controlling_job_id=audit_value->>'controllingJobId'
        AND audit.occurred_at=(audit_value->>'occurredAt')::timestamptz
    ) THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE FUNCTION m02_system_mutation_plan_payload_matches(
  result_key text,
  candidate_payload bytea
) RETURNS boolean LANGUAGE plpgsql STABLE STRICT AS $$
DECLARE
  result_row m02_system_identity_results%ROWTYPE;
  plan_value jsonb;
BEGIN
  SELECT * INTO result_row FROM m02_system_identity_results WHERE id=result_key;
  IF result_row.id IS NULL
    OR candidate_payload <> result_row.mutation_plan_payload
    OR NOT m02_payload_is_canonical_json(candidate_payload)
    OR encode(digest(candidate_payload, 'sha256'), 'hex') <> result_row.mutation_plan_fingerprint
  THEN
    RETURN false;
  END IF;
  plan_value := convert_from(candidate_payload, 'UTF8')::jsonb;
  RETURN m02_system_mutation_plan_body_matches(result_key, plan_value);
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE FUNCTION enforce_m02_system_operation_payloads() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  decision_key text;
  expected_input jsonb;
BEGIN
  SELECT identity_decision_id INTO decision_key
  FROM m02_system_identity_results WHERE system_operation_id = NEW.id;
  IF decision_key IS NULL THEN
    RAISE EXCEPTION 'M02_SYSTEM_OPERATION_REQUIRES_RESULT';
  END IF;

  expected_input := m02_identity_decision_input_json(NEW.id, decision_key);
  IF expected_input IS NULL
    OR NOT m02_payload_matches_json(NEW.identity_decision_input_payload, expected_input)
    OR NOT m02_payload_matches_json(
      NEW.system_replay_locator_payload,
      jsonb_build_object(
        'schemaVersion', '1',
        'replayScope', 'M02_SYSTEM_IDENTITY_REPLAY_V1',
        'sourceSnapshotId', NEW.source_snapshot_id,
        'candidateId', NEW.candidate_id,
        'controllingJobId', NEW.controlling_job_id,
        'reconciledClassificationRunId', NEW.reconciled_classification_run_id,
        'classificationPolicyVersion', NEW.classification_policy_version,
        'identityPolicyVersion', NEW.identity_policy_version,
        'systemActorId', NEW.system_actor_id
      )
    )
    OR NOT m02_payload_matches_json(
      NEW.idempotency_payload,
      jsonb_build_object(
        'schemaVersion', '1',
        'sourceSnapshotId', NEW.source_snapshot_id,
        'candidateId', NEW.candidate_id,
        'controllingJobId', NEW.controlling_job_id,
        'reconciledClassificationRunId', NEW.reconciled_classification_run_id,
        'identityDecisionInputFingerprint', NEW.identity_decision_input_fingerprint,
        'identityPolicyVersion', NEW.identity_policy_version,
        'automaticProjectorModeId', NEW.automatic_projector_mode_id
      )
    )
    OR NOT m02_payload_matches_json(
      NEW.system_operation_request_payload,
      jsonb_build_object(
        'schemaVersion', '1',
        'operationKind', NEW.operation_kind,
        'automaticProjectorModeId', NEW.automatic_projector_mode_id,
        'sourceSnapshotId', NEW.source_snapshot_id,
        'candidateId', NEW.candidate_id,
        'controllingJobId', NEW.controlling_job_id,
        'reconciledClassificationRunId', NEW.reconciled_classification_run_id,
        'identityDecisionInputFingerprint', NEW.identity_decision_input_fingerprint,
        'identityPolicyVersion', NEW.identity_policy_version,
        'idempotencyScope', NEW.idempotency_scope,
        'idempotencyKey', NEW.idempotency_key,
        'systemReplayLookupKey', NEW.system_replay_lookup_key,
        'SystemExpectedVersions', NEW.system_expected_versions,
        'systemActorId', NEW.system_actor_id
      )
    )
  THEN
    RAISE EXCEPTION 'M02_SYSTEM_OPERATION_CANONICAL_PAYLOAD_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER m02_system_identity_operations_payload_guard
AFTER INSERT ON m02_system_identity_operations
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_system_operation_payloads();

CREATE FUNCTION enforce_m02_rejection_payload() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  replay_value jsonb := convert_from(NEW.system_replay_locator_payload, 'UTF8')::jsonb;
BEGIN
  IF EXISTS (
    SELECT 1 FROM m02_system_identity_operations accepted
    WHERE accepted.system_replay_lookup_key = NEW.system_replay_lookup_key
  ) OR NOT (
    m02_jsonb_has_exact_keys(replay_value, ARRAY[
      'schemaVersion', 'replayScope', 'sourceSnapshotId', 'candidateId', 'controllingJobId',
      'reconciledClassificationRunId', 'classificationPolicyVersion', 'identityPolicyVersion',
      'systemActorId'
    ])
    AND replay_value->>'schemaVersion' = '1'
    AND replay_value->>'replayScope' = 'M02_SYSTEM_IDENTITY_REPLAY_V1'
    AND replay_value->>'sourceSnapshotId' = NEW.source_snapshot_id
    AND replay_value->>'candidateId' = NEW.candidate_id
    AND replay_value->>'controllingJobId' = NEW.controlling_job_id
    AND replay_value->>'systemActorId' = NEW.system_actor_id
    AND octet_length(replay_value->>'reconciledClassificationRunId') > 0
    AND octet_length(replay_value->>'classificationPolicyVersion') > 0
    AND octet_length(replay_value->>'identityPolicyVersion') > 0
  ) OR NOT m02_payload_matches_json(
    NEW.rejection_context_payload,
    jsonb_build_object(
      'schemaVersion', '1',
      'phase', NEW.phase,
      'candidateId', NEW.candidate_id,
      'controllingJobId', NEW.controlling_job_id,
      'sourceSnapshotId', NEW.source_snapshot_id,
      'systemActorId', NEW.system_actor_id,
      'systemReplayLookupKey', NEW.system_replay_lookup_key,
      'errorCode', NEW.error_code,
      'existingTargets', NEW.existing_targets,
      'automaticProjectorModeIdOrNull', NEW.automatic_projector_mode_id,
      'identityDecisionInputFingerprintOrNull', NEW.identity_decision_input_fingerprint,
      'idempotencyScopeOrNull', NEW.idempotency_scope,
      'idempotencyKeyOrNull', NEW.idempotency_key,
      'systemOperationFingerprintOrNull', NEW.system_operation_fingerprint,
      'attemptedSystemOperationIdOrNull', NEW.attempted_system_operation_id
    )
  ) THEN
    RAISE EXCEPTION 'M02_SYSTEM_REJECTION_CANONICAL_PAYLOAD_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER m02_rejected_system_identity_audits_payload_guard
AFTER INSERT ON m02_rejected_system_identity_audits
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_rejection_payload();

CREATE FUNCTION m02_system_s8_tier_semantics_valid(decision_key text) RETURNS boolean
LANGUAGE sql STABLE STRICT AS $$
  SELECT EXISTS (
    SELECT 1
    FROM identity_decisions decision
    WHERE decision.id = decision_key
      AND decision.outcome = 'FORK_OF_EXISTING_RESOURCE'
      AND decision.matched_tier = 'P3'
      AND (SELECT count(*) FROM identity_decision_signals signal
           WHERE signal.identity_decision_id = decision.id) = 1
      AND EXISTS (
        SELECT 1 FROM identity_decision_signals signal
        WHERE signal.identity_decision_id = decision.id
          AND signal.tier = 'P3'
          AND signal.signal_type = 'P3_PROVIDER_DECLARED_FORK_PROVENANCE'
          AND signal.target_type = 'SOURCE_REPOSITORY'
          AND signal.source_repository_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM identity_decision_signal_evidence evidence
            WHERE evidence.signal_id = signal.id
          )
      )
      AND EXISTS (
        SELECT 1 FROM identity_decision_tier_evaluations tier
        WHERE tier.identity_decision_id = decision.id
        GROUP BY tier.identity_decision_id
        HAVING jsonb_agg(jsonb_build_object(
          'tier', tier.tier, 'evaluationDisposition', tier.evaluation_disposition
        ) ORDER BY tier.ordinal) = jsonb_build_array(
          jsonb_build_object('tier', 'P1', 'evaluationDisposition', 'NO_MATCH'),
          jsonb_build_object('tier', 'P2', 'evaluationDisposition', 'NO_MATCH'),
          jsonb_build_object('tier', 'P3', 'evaluationDisposition', 'MATCH'),
          jsonb_build_object('tier', 'P4', 'evaluationDisposition', 'NOT_APPLICABLE'),
          jsonb_build_object('tier', 'P5', 'evaluationDisposition', 'NOT_APPLICABLE'),
          jsonb_build_object('tier', 'P6', 'evaluationDisposition', 'NOT_APPLICABLE')
        )
      )
  );
$$;

CREATE FUNCTION enforce_m02_system_identity_result_postconditions() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  actual uuid[];
  accepted_count integer;
  expected_audit_count bigint;
  expected_outcome text;
  operation_row m02_system_identity_operations%ROWTYPE;
  mutation_plan_value jsonb;
  concurrency_plan_value jsonb;
  domain_mutation_plan_value jsonb;
BEGIN
  SELECT * INTO operation_row FROM m02_system_identity_operations WHERE id = NEW.system_operation_id;
  mutation_plan_value := convert_from(NEW.mutation_plan_payload, 'UTF8')::jsonb;
  concurrency_plan_value := mutation_plan_value->'concurrencyPlan';
  domain_mutation_plan_value := mutation_plan_value->'domainMutationPlan';
  IF NOT (
    m02_jsonb_has_exact_keys(
      mutation_plan_value,
      ARRAY['schemaVersion', 'concurrencyPlan', 'domainMutationPlan']
    )
    AND mutation_plan_value->>'schemaVersion' = '1'
    AND jsonb_typeof(concurrency_plan_value) = 'object'
    AND jsonb_typeof(domain_mutation_plan_value) = 'object'
    AND m02_jsonb_has_exact_keys(
      domain_mutation_plan_value,
      ARRAY[
        'schemaVersion', 'allocatedIds', 'operation', 'creates', 'updates', 'supersedes',
        'audits', 'result', 'postconditions'
      ]
    )
    AND domain_mutation_plan_value->>'schemaVersion' = '1'
    AND m02_jsonb_has_exact_keys(
      concurrency_plan_value,
      ARRAY[
        'schemaVersion', 'automaticProjectorModeId', 'authorityFingerprint',
        'identityDecisionInputFingerprint', 'systemOperationFingerprint',
        'systemExpectedVersions', 'guards', 'affectedRows'
      ]
    )
    AND concurrency_plan_value->>'schemaVersion' = '1'
    AND concurrency_plan_value->>'automaticProjectorModeId' = NEW.automatic_projector_mode_id
    AND concurrency_plan_value->>'authorityFingerprint' ~ '^[0-9a-f]{64}$'
    AND concurrency_plan_value->>'identityDecisionInputFingerprint' =
      operation_row.identity_decision_input_fingerprint
    AND concurrency_plan_value->>'systemOperationFingerprint' =
      operation_row.system_operation_fingerprint
    AND concurrency_plan_value->'systemExpectedVersions' = operation_row.system_expected_versions
    AND jsonb_typeof(concurrency_plan_value->'guards') = 'array'
    AND jsonb_typeof(concurrency_plan_value->'affectedRows') = 'array'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(concurrency_plan_value->'guards') guard
      WHERE NOT (
        m02_jsonb_has_exact_keys(
          guard,
          ARRAY['guardKey', 'guardType', 'canonicalPayload', 'payloadHash', 'mutation']
        )
        AND starts_with(guard->>'guardKey', 'guard:')
        AND octet_length(guard->>'guardType') > 0
        AND jsonb_typeof(guard->'canonicalPayload') = 'string'
        AND guard->>'payloadHash' ~ '^[0-9a-f]{64}$'
        AND encode(digest(convert_to(guard->>'canonicalPayload', 'UTF8'), 'sha256'), 'hex') =
          guard->>'payloadHash'
        AND guard->>'mutation' IN ('READ_ONLY', 'ACTIVE_SET_CHANGE')
        AND operation_row.system_expected_versions ? (guard->>'guardKey')
      )
    )
    AND (
      SELECT count(*) = count(DISTINCT guard->>'guardKey')
      FROM jsonb_array_elements(concurrency_plan_value->'guards') guard
    )
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_each(operation_row.system_expected_versions) expected(key, value)
      WHERE starts_with(expected.key, 'guard:')
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(concurrency_plan_value->'guards') guard
          WHERE guard->>'guardKey' = expected.key
        )
    )
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(concurrency_plan_value->'affectedRows') affected
      WHERE NOT (
        m02_jsonb_has_exact_keys(affected, ARRAY['rowKey', 'recordVersion'])
        AND starts_with(affected->>'rowKey', 'row:')
        AND jsonb_typeof(affected->'recordVersion') = 'number'
        AND (affected->>'recordVersion')::numeric > 0
        AND operation_row.system_expected_versions->(affected->>'rowKey') =
          affected->'recordVersion'
      )
    )
    AND (
      SELECT count(*) = count(DISTINCT affected->>'rowKey')
      FROM jsonb_array_elements(concurrency_plan_value->'affectedRows') affected
    )
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_each(operation_row.system_expected_versions) expected(key, value)
      WHERE starts_with(expected.key, 'row:')
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(concurrency_plan_value->'affectedRows') affected
          WHERE affected->>'rowKey' = expected.key
        )
    )
  ) THEN
    RAISE EXCEPTION 'M02_SYSTEM_MUTATION_PLAN_ENVELOPE_MISMATCH';
  END IF;
  expected_outcome := CASE
    WHEN starts_with(NEW.automatic_projector_mode_id, 'S1_') THEN 'NEW_RESOURCE'
    WHEN starts_with(NEW.automatic_projector_mode_id, 'S2_') OR starts_with(NEW.automatic_projector_mode_id, 'S5_')
      THEN 'EXISTING_RESOURCE_NEW_VERSION'
    WHEN starts_with(NEW.automatic_projector_mode_id, 'S3_') OR starts_with(NEW.automatic_projector_mode_id, 'S4_')
      OR starts_with(NEW.automatic_projector_mode_id, 'S9_') THEN 'EXACT_REPEAT_REUSE'
    WHEN NEW.automatic_projector_mode_id IN ('S6_JR', 'S10_JR') THEN 'AMBIGUOUS_IDENTITY'
    WHEN NEW.automatic_projector_mode_id = 'S7_JR' THEN 'POSSIBLE_DUPLICATE'
    WHEN NEW.automatic_projector_mode_id = 'S8_JR' THEN 'FORK_OF_EXISTING_RESOURCE'
  END;

  IF NOT EXISTS (
    SELECT 1 FROM identity_decisions decision
    WHERE decision.id = NEW.identity_decision_id
      AND decision.resource_candidate_id = NEW.candidate_id
      AND decision.origin_type = 'SYSTEM_IDENTITY_OPERATION'
      AND decision.system_operation_id = NEW.system_operation_id
      AND decision.system_result_id = NEW.id
      AND decision.outcome = CASE
        WHEN starts_with(NEW.automatic_projector_mode_id, 'S1_') THEN 'NEW_RESOURCE'
        WHEN starts_with(NEW.automatic_projector_mode_id, 'S2_')
          OR starts_with(NEW.automatic_projector_mode_id, 'S5_')
          THEN 'EXISTING_RESOURCE_NEW_VERSION'
        WHEN starts_with(NEW.automatic_projector_mode_id, 'S3_')
          OR starts_with(NEW.automatic_projector_mode_id, 'S4_')
          OR starts_with(NEW.automatic_projector_mode_id, 'S9_')
          THEN 'EXACT_REPEAT_REUSE'
        WHEN NEW.automatic_projector_mode_id IN ('S6_JR', 'S10_JR') THEN 'AMBIGUOUS_IDENTITY'
        WHEN NEW.automatic_projector_mode_id = 'S7_JR' THEN 'POSSIBLE_DUPLICATE'
        WHEN NEW.automatic_projector_mode_id = 'S8_JR' THEN 'FORK_OF_EXISTING_RESOURCE'
      END
  ) THEN
    RAISE EXCEPTION 'M02_SYSTEM_DECISION_RESULT_MISMATCH';
  END IF;

  IF NEW.automatic_projector_mode_id = 'S8_JR'
    AND NOT m02_system_s8_tier_semantics_valid(NEW.identity_decision_id)
  THEN
    RAISE EXCEPTION 'M02_SYSTEM_S8_TIER_SEMANTICS_MISMATCH';
  END IF;

  IF (
    starts_with(NEW.automatic_projector_mode_id, 'S1_')
    AND (NEW.resource_identity_id::uuid <> NEW.created_resource_identity_ids[1]
      OR NEW.resource_version_identity_id::uuid <> NEW.created_resource_version_identity_ids[1])
  ) OR (
    starts_with(NEW.automatic_projector_mode_id, 'S2_')
    AND (NEW.resource_identity_id::uuid <> NEW.reused_resource_identity_ids[1]
      OR NEW.resource_version_identity_id::uuid <> NEW.created_resource_version_identity_ids[1])
  ) OR (
    (starts_with(NEW.automatic_projector_mode_id, 'S3_')
      OR starts_with(NEW.automatic_projector_mode_id, 'S4_')
      OR starts_with(NEW.automatic_projector_mode_id, 'S9_')
      OR NEW.automatic_projector_mode_id = 'S10_JR')
    AND (NEW.resource_identity_id::uuid <> NEW.reused_resource_identity_ids[1]
      OR NEW.resource_version_identity_id::uuid <> NEW.reused_resource_version_identity_ids[1])
  ) OR (
    starts_with(NEW.automatic_projector_mode_id, 'S5_')
    AND (NEW.resource_identity_id::uuid <> NEW.reused_resource_identity_ids[1]
      OR NEW.resource_version_identity_id::uuid <> NEW.created_resource_version_identity_ids[1])
  ) OR (
    NEW.automatic_projector_mode_id = 'S7_JR'
    AND NEW.duplicate_candidate_id::uuid <> NEW.created_duplicate_candidate_ids[1]
  ) OR (
    NEW.automatic_projector_mode_id NOT IN ('S6_JR', 'S7_JR', 'S8_JR', 'S10_JR')
    AND NEW.handoff_marker_id::uuid <> NEW.created_handoff_marker_ids[1]
  ) THEN
    RAISE EXCEPTION 'M02_SYSTEM_RESULT_SCALAR_ARRAY_MISMATCH';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM resource_candidates candidate
    WHERE candidate.id = NEW.candidate_id
      AND candidate.identity_outcome = expected_outcome
      AND candidate.resource_identity_id IS NOT DISTINCT FROM NEW.resource_identity_id
      AND candidate.resource_version_identity_id IS NOT DISTINCT FROM NEW.resource_version_identity_id
      AND NEW.final_candidate_state = jsonb_build_object(
        'status', candidate.status,
        'identityOutcome', candidate.identity_outcome,
        'resourceIdentityId', candidate.resource_identity_id,
        'resourceVersionIdentityId', candidate.resource_version_identity_id,
        'recordVersion', candidate.record_version
      )
  ) THEN
    RAISE EXCEPTION 'M02_SYSTEM_CANDIDATE_PROJECTION_MISMATCH';
  END IF;

  SELECT COALESCE(array_agg(id::uuid ORDER BY convert_to(id, 'UTF8')), '{}'::uuid[]) INTO actual
  FROM source_repository_identities
  WHERE system_operation_id = NEW.system_operation_id AND system_result_id = NEW.id;
  IF actual <> NEW.created_source_repository_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(id::uuid ORDER BY convert_to(id, 'UTF8')), '{}'::uuid[]) INTO actual
  FROM source_repository_urls
  WHERE system_operation_id = NEW.system_operation_id AND system_result_id = NEW.id;
  IF actual <> NEW.created_source_repository_url_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(id::uuid ORDER BY convert_to(id, 'UTF8')), '{}'::uuid[]) INTO actual
  FROM resource_identities
  WHERE system_operation_id = NEW.system_operation_id AND system_result_id = NEW.id;
  IF actual <> NEW.created_resource_identity_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(id::uuid ORDER BY convert_to(id, 'UTF8')), '{}'::uuid[]) INTO actual
  FROM resource_version_identities
  WHERE system_operation_id = NEW.system_operation_id AND system_result_id = NEW.id;
  IF actual <> NEW.created_resource_version_identity_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(id::uuid ORDER BY convert_to(id, 'UTF8')), '{}'::uuid[]) INTO actual
  FROM resource_source_links
  WHERE system_operation_id = NEW.system_operation_id AND system_result_id = NEW.id;
  IF actual <> NEW.created_source_link_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(id::uuid ORDER BY convert_to(id, 'UTF8')), '{}'::uuid[]) INTO actual
  FROM resource_version_observations
  WHERE system_operation_id = NEW.system_operation_id AND system_result_id = NEW.id;
  IF actual <> NEW.created_observation_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(id::uuid ORDER BY convert_to(id, 'UTF8')), '{}'::uuid[]) INTO actual
  FROM duplicate_candidates
  WHERE system_operation_id = NEW.system_operation_id AND system_result_id = NEW.id;
  IF actual <> NEW.created_duplicate_candidate_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(id::uuid ORDER BY convert_to(id, 'UTF8')), '{}'::uuid[]) INTO actual
  FROM identity_decisions
  WHERE system_operation_id = NEW.system_operation_id AND system_result_id = NEW.id;
  IF actual <> NEW.created_identity_decision_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(id::uuid ORDER BY convert_to(id, 'UTF8')), '{}'::uuid[]) INTO actual
  FROM m02_identity_handoff_markers
  WHERE system_operation_id = NEW.system_operation_id AND system_result_id = NEW.id;
  IF actual <> NEW.created_handoff_marker_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;

  SELECT COALESCE(array_agg(id ORDER BY id), '{}'::uuid[]) INTO actual
  FROM identity_decision_tier_evaluations WHERE identity_decision_id = NEW.identity_decision_id;
  IF actual <> NEW.created_identity_decision_tier_evaluation_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(id ORDER BY id), '{}'::uuid[]) INTO actual
  FROM identity_decision_signals WHERE identity_decision_id = NEW.identity_decision_id;
  IF actual <> NEW.created_identity_decision_signal_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(evidence.id ORDER BY evidence.id), '{}'::uuid[]) INTO actual
  FROM identity_decision_signal_evidence evidence
  JOIN identity_decision_signals signal ON signal.id = evidence.signal_id
  WHERE signal.identity_decision_id = NEW.identity_decision_id;
  IF actual <> NEW.created_identity_decision_signal_evidence_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(id ORDER BY id), '{}'::uuid[]) INTO actual
  FROM identity_decision_conflicts WHERE identity_decision_id = NEW.identity_decision_id;
  IF actual <> NEW.created_identity_decision_conflict_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(target.id ORDER BY target.id), '{}'::uuid[]) INTO actual
  FROM identity_decision_conflict_targets target
  JOIN identity_decision_conflicts conflict ON conflict.id = target.conflict_id
  WHERE conflict.identity_decision_id = NEW.identity_decision_id;
  IF actual <> NEW.created_identity_decision_conflict_target_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(evidence.id ORDER BY evidence.id), '{}'::uuid[]) INTO actual
  FROM identity_decision_conflict_evidence evidence
  JOIN identity_decision_conflicts conflict ON conflict.id = evidence.conflict_id
  WHERE conflict.identity_decision_id = NEW.identity_decision_id;
  IF actual <> NEW.created_identity_decision_conflict_evidence_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;

  SELECT COALESCE(array_agg(subject_id::uuid ORDER BY convert_to(subject_id, 'UTF8')), '{}'::uuid[])
  INTO actual FROM m02_audit_events
  WHERE system_operation_id = NEW.system_operation_id AND system_result_id = NEW.id
    AND action = 'SUBJECT_UPDATED' AND subject_type = 'RESOURCE_CANDIDATE';
  IF actual <> NEW.updated_resource_candidate_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(subject_id::uuid ORDER BY convert_to(subject_id, 'UTF8')), '{}'::uuid[])
  INTO actual FROM m02_audit_events
  WHERE system_operation_id = NEW.system_operation_id AND system_result_id = NEW.id
    AND action = 'SUBJECT_UPDATED' AND subject_type = 'M02_REVIEW_STATE';
  IF actual <> NEW.updated_review_state_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(subject_id::uuid ORDER BY convert_to(subject_id, 'UTF8')), '{}'::uuid[])
  INTO actual FROM m02_audit_events
  WHERE system_operation_id = NEW.system_operation_id AND system_result_id = NEW.id
    AND action = 'SUBJECT_UPDATED' AND subject_type = 'ACQUISITION_JOB';
  IF actual <> NEW.updated_acquisition_job_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(subject_id::uuid ORDER BY convert_to(subject_id, 'UTF8')), '{}'::uuid[])
  INTO actual FROM m02_audit_events
  WHERE system_operation_id = NEW.system_operation_id AND system_result_id = NEW.id
    AND action = 'SUBJECT_UPDATED' AND subject_type = 'M02_JOB';
  IF actual <> NEW.updated_m02_job_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(subject_id::uuid ORDER BY convert_to(subject_id, 'UTF8')), '{}'::uuid[])
  INTO actual FROM m02_audit_events
  WHERE system_operation_id = NEW.system_operation_id AND system_result_id = NEW.id
    AND action = 'SUBJECT_SUPERSEDED' AND subject_type = 'RESOURCE_SOURCE_LINK';
  IF actual <> NEW.superseded_source_link_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(subject_id::uuid ORDER BY convert_to(subject_id, 'UTF8')), '{}'::uuid[])
  INTO actual FROM m02_audit_events
  WHERE system_operation_id = NEW.system_operation_id AND system_result_id = NEW.id
    AND action = 'SUBJECT_SUPERSEDED' AND subject_type = 'IDENTITY_DECISION';
  IF actual <> NEW.superseded_identity_decision_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(subject_id::uuid ORDER BY convert_to(subject_id, 'UTF8')), '{}'::uuid[])
  INTO actual FROM m02_audit_events
  WHERE system_operation_id = NEW.system_operation_id AND system_result_id = NEW.id
    AND action = 'SUBJECT_SUPERSEDED' AND subject_type = 'M02_IDENTITY_HANDOFF';
  IF actual <> NEW.superseded_handoff_marker_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  SELECT COALESCE(array_agg(subject_id::uuid ORDER BY convert_to(subject_id, 'UTF8')), '{}'::uuid[])
  INTO actual FROM m02_audit_events
  WHERE system_operation_id = NEW.system_operation_id AND system_result_id = NEW.id
    AND action = 'SUBJECT_SUPERSEDED' AND subject_type = 'DUPLICATE_CANDIDATE';
  IF actual <> NEW.superseded_duplicate_candidate_ids THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;

  SELECT count(*) INTO accepted_count FROM m02_audit_events audit
  WHERE audit.system_operation_id = NEW.system_operation_id
    AND audit.system_result_id = NEW.id
    AND audit.id = NEW.accepted_audit_event_id
    AND audit.origin_type = 'SYSTEM_IDENTITY_OPERATION'
    AND audit.actor_type = 'SYSTEM'
    AND audit.actor_id = operation_row.system_actor_id
    AND audit.actor_role IS NULL
    AND audit.action = 'SYSTEM_OPERATION_ACCEPTED'
    AND audit.subject_type = 'SYSTEM_IDENTITY_OPERATION'
    AND audit.subject_id = NEW.system_operation_id;
  IF accepted_count <> 1 THEN RAISE EXCEPTION 'M02_SYSTEM_ACCEPTED_AUDIT_MISMATCH'; END IF;
  IF (SELECT count(*) FROM m02_audit_events audit
      WHERE audit.system_operation_id = NEW.system_operation_id
        AND audit.action = 'SYSTEM_OPERATION_ACCEPTED') <> 1 THEN
    RAISE EXCEPTION 'M02_SYSTEM_ACCEPTED_AUDIT_NOT_UNIQUE';
  END IF;

  expected_audit_count := 1
    + cardinality(NEW.created_source_repository_ids)
    + cardinality(NEW.created_source_repository_url_ids)
    + cardinality(NEW.created_resource_identity_ids)
    + cardinality(NEW.created_resource_version_identity_ids)
    + cardinality(NEW.created_source_link_ids)
    + cardinality(NEW.created_observation_ids)
    + cardinality(NEW.created_duplicate_candidate_ids)
    + cardinality(NEW.created_identity_decision_ids)
    + cardinality(NEW.created_handoff_marker_ids)
    + cardinality(NEW.created_identity_decision_tier_evaluation_ids)
    + cardinality(NEW.created_identity_decision_signal_ids)
    + cardinality(NEW.created_identity_decision_signal_evidence_ids)
    + cardinality(NEW.created_identity_decision_conflict_ids)
    + cardinality(NEW.created_identity_decision_conflict_target_ids)
    + cardinality(NEW.created_identity_decision_conflict_evidence_ids)
    + cardinality(NEW.updated_resource_candidate_ids)
    + cardinality(NEW.updated_review_state_ids)
    + cardinality(NEW.updated_acquisition_job_ids)
    + cardinality(NEW.updated_m02_job_ids)
    + cardinality(NEW.superseded_source_link_ids)
    + cardinality(NEW.superseded_identity_decision_ids)
    + cardinality(NEW.superseded_handoff_marker_ids)
    + cardinality(NEW.superseded_duplicate_candidate_ids);
  IF (SELECT count(*) FROM m02_audit_events audit
      WHERE audit.system_operation_id = NEW.system_operation_id
        AND audit.system_result_id = NEW.id) <> expected_audit_count
    OR EXISTS (
      SELECT 1 FROM m02_audit_events audit
      WHERE audit.system_operation_id = NEW.system_operation_id
        AND audit.system_result_id = NEW.id
        AND (audit.source_snapshot_id IS DISTINCT FROM NEW.source_snapshot_id
          OR audit.controlling_job_id IS DISTINCT FROM NEW.controlling_job_id)
    )
  THEN
    RAISE EXCEPTION 'M02_SYSTEM_RESULT_AUDIT_FORMULA_MISMATCH';
  END IF;

  IF EXISTS (
    SELECT 1 FROM m02_audit_events audit
    JOIN resource_candidates candidate ON candidate.id = audit.subject_id
    WHERE audit.system_operation_id = NEW.system_operation_id AND audit.system_result_id = NEW.id
      AND audit.action = 'SUBJECT_UPDATED' AND audit.subject_type = 'RESOURCE_CANDIDATE'
      AND (audit.after_version <> candidate.record_version
        OR audit.before_version <> candidate.record_version - 1
        OR audit.after_state <> m02_canonical_json(jsonb_build_object(
          'identityOutcome', candidate.identity_outcome,
          'recordVersion', candidate.record_version,
          'resourceIdentityId', candidate.resource_identity_id,
          'resourceVersionIdentityId', candidate.resource_version_identity_id,
          'status', candidate.status
        ))
        OR audit.before_state <> m02_canonical_json(jsonb_build_object(
          'identityOutcome', CASE
            WHEN NEW.automatic_projector_mode_id IN ('S9_JC', 'S9_JR', 'S10_JR') THEN (
              SELECT predecessor.outcome
              FROM identity_decisions successor
              JOIN identity_decisions predecessor ON predecessor.id = successor.supersedes_decision_id
              WHERE successor.id = NEW.identity_decision_id
            ) ELSE NULL END,
          'recordVersion', candidate.record_version - 1,
          'resourceIdentityId', CASE
            WHEN NEW.automatic_projector_mode_id IN ('S9_JC', 'S9_JR', 'S10_JR')
              THEN NEW.resource_identity_id ELSE NULL END,
          'resourceVersionIdentityId', CASE
            WHEN NEW.automatic_projector_mode_id IN ('S9_JC', 'S9_JR', 'S10_JR')
              THEN NEW.resource_version_identity_id ELSE NULL END,
          'status', CASE WHEN NEW.automatic_projector_mode_id IN ('S9_JC', 'S9_JR', 'S10_JR')
            THEN 'IDENTITY_RESOLVED' ELSE 'CLASSIFIED' END
        )))
  ) OR EXISTS (
    SELECT 1 FROM m02_audit_events audit
    JOIN m02_review_states review ON review.id = audit.subject_id
    WHERE audit.system_operation_id = NEW.system_operation_id AND audit.system_result_id = NEW.id
      AND audit.action = 'SUBJECT_UPDATED' AND audit.subject_type = 'M02_REVIEW_STATE'
      AND (audit.after_version <> review.record_version
        OR audit.before_version <> review.record_version - 1
        OR audit.after_state <> m02_canonical_json(jsonb_build_object(
          'recordVersion', review.record_version, 'reviewState', review.review_state
        ))
        OR audit.before_state <> m02_canonical_json(jsonb_build_object(
          'recordVersion', review.record_version - 1,
          'reviewState', CASE WHEN NEW.automatic_projector_mode_id IN ('S9_JC', 'S9_JR', 'S10_JR')
            THEN 'RESOLVED' ELSE 'NOT_REQUIRED' END
        )))
  ) OR EXISTS (
    SELECT 1 FROM m02_audit_events audit
    JOIN acquisition_jobs job ON job.id = audit.subject_id
    WHERE audit.system_operation_id = NEW.system_operation_id AND audit.system_result_id = NEW.id
      AND audit.action = 'SUBJECT_UPDATED' AND audit.subject_type = 'ACQUISITION_JOB'
      AND (audit.after_version <> job.record_version
        OR audit.before_version <> job.record_version - 1
        OR audit.after_state <> m02_canonical_json(jsonb_build_object(
          'recordVersion', job.record_version, 'status', job.status
        ))
        OR audit.before_state <> m02_canonical_json(jsonb_build_object(
          'recordVersion', job.record_version - 1, 'status', 'ACTIVE'
        )))
  ) OR EXISTS (
    SELECT 1 FROM m02_audit_events audit
    JOIN m02_jobs job ON job.id = audit.subject_id
    WHERE audit.system_operation_id = NEW.system_operation_id AND audit.system_result_id = NEW.id
      AND audit.action = 'SUBJECT_UPDATED' AND audit.subject_type = 'M02_JOB'
      AND (audit.after_version <> job.record_version
        OR audit.before_version <> job.record_version - 1
        OR audit.after_state <> m02_canonical_json(jsonb_build_object(
          'currentStage', job.current_stage, 'recordVersion', job.record_version,
          'reviewState', job.review_state
        ))
        OR audit.before_state <> m02_canonical_json(jsonb_build_object(
          'currentStage', 'RESOLVING_IDENTITY', 'recordVersion', job.record_version - 1,
          'reviewState', CASE WHEN NEW.automatic_projector_mode_id IN ('S9_JC', 'S9_JR', 'S10_JR')
            THEN 'RESOLVED' ELSE 'NOT_REQUIRED' END
        )))
  ) THEN
    RAISE EXCEPTION 'M02_SYSTEM_RESULT_AUDIT_FORMULA_MISMATCH';
  END IF;

  IF EXISTS (
    SELECT 1 FROM m02_audit_events audit
    LEFT JOIN resource_source_links link ON link.id = audit.subject_id
    WHERE audit.system_operation_id = NEW.system_operation_id AND audit.system_result_id = NEW.id
      AND audit.action = 'SUBJECT_SUPERSEDED' AND audit.subject_type = 'RESOURCE_SOURCE_LINK'
      AND (link.id IS NULL OR link.state <> 'SUPERSEDED'
        OR audit.after_version <> link.record_version
        OR audit.before_version <> link.record_version - 1
        OR audit.after_state <> m02_canonical_json(jsonb_build_object(
          'recordVersion', link.record_version, 'state', link.state,
          'supersededById', (
            SELECT successor.id FROM resource_source_links successor
            WHERE successor.supersedes_source_link_id = link.id
              AND successor.system_operation_id = NEW.system_operation_id
              AND successor.system_result_id = NEW.id
          )
        ))
        OR audit.metadata <> jsonb_build_object(
          'successorId', (
            SELECT successor.id FROM resource_source_links successor
            WHERE successor.supersedes_source_link_id = link.id
              AND successor.system_operation_id = NEW.system_operation_id
              AND successor.system_result_id = NEW.id
          )
        )
        OR audit.before_state <> m02_canonical_json(jsonb_build_object(
          'recordVersion', link.record_version - 1, 'state', 'ACTIVE'
        )))
  ) OR EXISTS (
    SELECT 1 FROM m02_audit_events audit
    LEFT JOIN identity_decisions decision ON decision.id = audit.subject_id
    WHERE audit.system_operation_id = NEW.system_operation_id AND audit.system_result_id = NEW.id
      AND audit.action = 'SUBJECT_SUPERSEDED' AND audit.subject_type = 'IDENTITY_DECISION'
      AND (decision.id IS NULL OR decision.state <> 'SUPERSEDED'
        OR audit.after_version <> decision.record_version
        OR audit.before_version <> decision.record_version - 1
        OR audit.after_state <> m02_canonical_json(jsonb_build_object(
          'recordVersion', decision.record_version, 'state', decision.state,
          'supersededByDecisionId', decision.superseded_by_decision_id
        ))
        OR audit.before_state <> m02_canonical_json(jsonb_build_object(
          'recordVersion', decision.record_version - 1, 'state', 'ACTIVE'
        )))
  ) OR EXISTS (
    SELECT 1 FROM m02_audit_events audit
    LEFT JOIN m02_identity_handoff_markers handoff ON handoff.id = audit.subject_id
    WHERE audit.system_operation_id = NEW.system_operation_id AND audit.system_result_id = NEW.id
      AND audit.action = 'SUBJECT_SUPERSEDED' AND audit.subject_type = 'M02_IDENTITY_HANDOFF'
      AND (handoff.id IS NULL OR handoff.state <> 'SUPERSEDED'
        OR audit.after_version <> handoff.record_version
        OR audit.before_version <> handoff.record_version - 1
        OR audit.after_state <> m02_canonical_json(jsonb_build_object(
          'recordVersion', handoff.record_version, 'state', handoff.state
        ))
        OR audit.before_state <> m02_canonical_json(jsonb_build_object(
          'recordVersion', handoff.record_version - 1, 'state', 'ACTIVE'
        )))
  ) OR EXISTS (
    SELECT 1 FROM m02_audit_events audit
    LEFT JOIN duplicate_candidates duplicate ON duplicate.id = audit.subject_id
    WHERE audit.system_operation_id = NEW.system_operation_id AND audit.system_result_id = NEW.id
      AND audit.action = 'SUBJECT_SUPERSEDED' AND audit.subject_type = 'DUPLICATE_CANDIDATE'
      AND (duplicate.id IS NULL OR duplicate.status <> 'SUPERSEDED'
        OR audit.after_version <> duplicate.record_version
        OR audit.before_version <> duplicate.record_version - 1
        OR audit.after_state <> m02_canonical_json(jsonb_build_object(
          'recordVersion', duplicate.record_version, 'status', duplicate.status
        )))
  ) THEN
    RAISE EXCEPTION 'M02_SYSTEM_RESULT_AUDIT_FORMULA_MISMATCH';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM resource_candidates candidate
    WHERE candidate.id = NEW.candidate_id AND candidate.status = NEW.final_candidate_state->>'status'
  ) OR NOT EXISTS (
    SELECT 1 FROM m02_review_states review
    WHERE review.id::uuid = ANY(NEW.updated_review_state_ids)
      AND review.resource_candidate_id = NEW.candidate_id
      AND review.review_state = NEW.final_review_state
  ) OR NOT EXISTS (
    SELECT 1 FROM acquisition_jobs job
    WHERE job.id = NEW.controlling_job_id AND job.status = NEW.final_acquisition_job_status
      AND NEW.final_m02_job_status = NEW.final_acquisition_job_status
  ) OR NOT EXISTS (
    SELECT 1 FROM m02_jobs job
    WHERE job.id = NEW.controlling_job_id AND job.current_stage = NEW.final_m02_stage
      AND job.review_state = NEW.final_review_state
  ) THEN
    RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH';
  END IF;

  IF cardinality(NEW.updated_resource_candidate_ids) <> 1
    OR NEW.candidate_id::uuid <> ALL(NEW.updated_resource_candidate_ids)
    OR cardinality(NEW.updated_review_state_ids) <> 1
    OR cardinality(NEW.updated_acquisition_job_ids) <> 1
    OR NEW.controlling_job_id::uuid <> ALL(NEW.updated_acquisition_job_ids)
    OR cardinality(NEW.updated_m02_job_ids) <> 1
    OR NEW.controlling_job_id::uuid <> ALL(NEW.updated_m02_job_ids)
    OR cardinality(NEW.created_identity_decision_ids) <> 1
    OR NEW.identity_decision_id::uuid <> ALL(NEW.created_identity_decision_ids)
    OR cardinality(NEW.created_identity_decision_tier_evaluation_ids) <> 6
  THEN
    RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH';
  END IF;

  IF right(NEW.automatic_projector_mode_id, 3) = '_JC' AND NOT (
    NEW.final_candidate_state->>'status' = 'IDENTITY_RESOLVED'
    AND NEW.final_review_state = 'RESOLVED'
    AND NEW.final_acquisition_job_status = 'COMPLETED'
    AND NEW.final_m02_job_status = 'COMPLETED'
  ) THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  IF NEW.automatic_projector_mode_id IN (
    'S1_R0_JR', 'S1_R1_JR', 'S2_JR', 'S3_JR', 'S4_R0_JR', 'S4_R1_JR',
    'S5_R0_JR', 'S5_R1_JR', 'S9_JR'
  ) AND NOT (
    NEW.final_candidate_state->>'status' = 'IDENTITY_RESOLVED'
    AND NEW.final_review_state = 'RESOLVED'
    AND NEW.final_acquisition_job_status = 'OPERATOR_REVIEW_REQUIRED'
    AND NEW.final_m02_job_status = 'OPERATOR_REVIEW_REQUIRED'
  ) THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  IF NEW.automatic_projector_mode_id IN ('S6_JR', 'S7_JR', 'S8_JR', 'S10_JR') AND NOT (
    NEW.final_candidate_state->>'status' = 'IDENTITY_REVIEW_REQUIRED'
    AND NEW.final_review_state = 'IDENTITY_REVIEW_REQUIRED'
    AND NEW.final_acquisition_job_status = 'OPERATOR_REVIEW_REQUIRED'
    AND NEW.final_m02_job_status = 'OPERATOR_REVIEW_REQUIRED'
  ) THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;

  IF (
    NEW.automatic_projector_mode_id IN ('S1_R0_JC', 'S1_R0_JR', 'S4_R0_JC', 'S4_R0_JR', 'S5_R0_JC', 'S5_R0_JR')
    AND cardinality(NEW.created_source_repository_url_ids) <> 1
  ) OR (
    NEW.automatic_projector_mode_id NOT IN ('S1_R0_JC', 'S1_R0_JR', 'S4_R0_JC', 'S4_R0_JR', 'S5_R0_JC', 'S5_R0_JR')
    AND cardinality(NEW.created_source_repository_url_ids) <> 0
  ) THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(NEW.reused_source_repository_ids) reused(id)
    LEFT JOIN source_repository_identities row_value ON row_value.id = reused.id::text
    WHERE row_value.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM unnest(NEW.reused_resource_identity_ids) reused(id)
    LEFT JOIN resource_identities row_value ON row_value.id = reused.id::text
    WHERE row_value.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM unnest(NEW.reused_resource_version_identity_ids) reused(id)
    LEFT JOIN resource_version_identities row_value ON row_value.id = reused.id::text
    WHERE row_value.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM unnest(NEW.reused_source_link_ids) reused(id)
    LEFT JOIN resource_source_links row_value ON row_value.id = reused.id::text
    WHERE row_value.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM unnest(NEW.reused_observation_ids) reused(id)
    LEFT JOIN resource_version_observations row_value ON row_value.id = reused.id::text
    WHERE row_value.id IS NULL
  ) THEN
    RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH';
  END IF;

  IF NEW.automatic_projector_mode_id IN ('S1_R0_JC', 'S1_R0_JR') AND NOT (
    cardinality(NEW.created_source_repository_ids) = 1
    AND cardinality(NEW.created_resource_identity_ids) = 1
    AND cardinality(NEW.created_resource_version_identity_ids) = 1
    AND cardinality(NEW.created_source_link_ids) = 1
    AND cardinality(NEW.created_observation_ids) = 1
    AND cardinality(NEW.created_handoff_marker_ids) = 1
    AND cardinality(NEW.reused_source_repository_ids) = 0
    AND cardinality(NEW.reused_resource_identity_ids) = 0
    AND cardinality(NEW.reused_resource_version_identity_ids) = 0
    AND cardinality(NEW.reused_source_link_ids) = 0
    AND cardinality(NEW.reused_observation_ids) = 0
    AND cardinality(NEW.created_duplicate_candidate_ids) = 0
    AND cardinality(NEW.superseded_source_link_ids) = 0
    AND cardinality(NEW.superseded_identity_decision_ids) = 0
    AND cardinality(NEW.superseded_handoff_marker_ids) = 0
    AND cardinality(NEW.superseded_duplicate_candidate_ids) = 0
  ) THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  IF NEW.automatic_projector_mode_id IN ('S1_R1_JC', 'S1_R1_JR') AND NOT (
    cardinality(NEW.created_source_repository_ids) = 0
    AND cardinality(NEW.reused_source_repository_ids) = 1
    AND cardinality(NEW.created_resource_identity_ids) = 1
    AND cardinality(NEW.created_resource_version_identity_ids) = 1
    AND cardinality(NEW.created_source_link_ids) = 1
    AND cardinality(NEW.created_observation_ids) = 1
    AND cardinality(NEW.created_handoff_marker_ids) = 1
    AND cardinality(NEW.reused_resource_identity_ids) = 0
    AND cardinality(NEW.reused_resource_version_identity_ids) = 0
    AND cardinality(NEW.reused_source_link_ids) = 0
    AND cardinality(NEW.reused_observation_ids) = 0
    AND cardinality(NEW.created_duplicate_candidate_ids) = 0
    AND cardinality(NEW.superseded_source_link_ids) = 0
    AND cardinality(NEW.superseded_identity_decision_ids) = 0
    AND cardinality(NEW.superseded_handoff_marker_ids) = 0
    AND cardinality(NEW.superseded_duplicate_candidate_ids) = 0
  ) THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  IF NEW.automatic_projector_mode_id IN ('S2_JC', 'S2_JR') AND NOT (
    cardinality(NEW.reused_source_repository_ids) = 1
    AND cardinality(NEW.reused_resource_identity_ids) = 1
    AND cardinality(NEW.reused_resource_version_identity_ids) = 1
    AND cardinality(NEW.created_resource_version_identity_ids) = 1
    AND cardinality(NEW.created_source_link_ids) = 1
    AND cardinality(NEW.created_observation_ids) = 1
    AND cardinality(NEW.created_handoff_marker_ids) = 1
    AND cardinality(NEW.superseded_source_link_ids) = 1
    AND cardinality(NEW.created_source_repository_ids) = 0
    AND cardinality(NEW.created_resource_identity_ids) = 0
    AND cardinality(NEW.created_duplicate_candidate_ids) = 0
    AND cardinality(NEW.reused_source_link_ids) = 0
    AND cardinality(NEW.reused_observation_ids) = 0
    AND cardinality(NEW.superseded_identity_decision_ids) = 0
    AND cardinality(NEW.superseded_handoff_marker_ids) = 0
    AND cardinality(NEW.superseded_duplicate_candidate_ids) = 0
  ) THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  IF NEW.automatic_projector_mode_id IN ('S3_JC', 'S3_JR') AND NOT (
    cardinality(NEW.reused_source_repository_ids) = 1
    AND cardinality(NEW.reused_resource_identity_ids) = 1
    AND cardinality(NEW.reused_resource_version_identity_ids) = 1
    AND cardinality(NEW.reused_source_link_ids) = 1
    AND cardinality(NEW.created_observation_ids) = 1
    AND cardinality(NEW.created_handoff_marker_ids) = 1
    AND cardinality(NEW.created_source_repository_ids) = 0
    AND cardinality(NEW.created_resource_identity_ids) = 0
    AND cardinality(NEW.created_resource_version_identity_ids) = 0
    AND cardinality(NEW.created_source_link_ids) = 0
    AND cardinality(NEW.created_duplicate_candidate_ids) = 0
    AND cardinality(NEW.reused_observation_ids) = 0
    AND cardinality(NEW.superseded_source_link_ids) = 0
    AND cardinality(NEW.superseded_identity_decision_ids) = 0
    AND cardinality(NEW.superseded_handoff_marker_ids) = 0
    AND cardinality(NEW.superseded_duplicate_candidate_ids) = 0
  ) THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  IF NEW.automatic_projector_mode_id IN ('S4_R0_JC', 'S4_R0_JR', 'S4_R1_JC', 'S4_R1_JR') AND NOT (
    cardinality(NEW.reused_resource_identity_ids) = 1
    AND cardinality(NEW.reused_resource_version_identity_ids) = 1
    AND cardinality(NEW.created_source_link_ids) = 1
    AND cardinality(NEW.created_observation_ids) = 1
    AND cardinality(NEW.created_handoff_marker_ids) = 1
    AND cardinality(NEW.created_source_repository_ids) = CASE WHEN starts_with(NEW.automatic_projector_mode_id, 'S4_R0_') THEN 1 ELSE 0 END
    AND cardinality(NEW.reused_source_repository_ids) = CASE WHEN starts_with(NEW.automatic_projector_mode_id, 'S4_R1_') THEN 1 ELSE 0 END
    AND cardinality(NEW.created_resource_identity_ids) = 0
    AND cardinality(NEW.created_resource_version_identity_ids) = 0
    AND cardinality(NEW.created_duplicate_candidate_ids) = 0
    AND cardinality(NEW.reused_source_link_ids) = 0
    AND cardinality(NEW.reused_observation_ids) = 0
    AND cardinality(NEW.superseded_source_link_ids) = 0
    AND cardinality(NEW.superseded_identity_decision_ids) = 0
    AND cardinality(NEW.superseded_handoff_marker_ids) = 0
    AND cardinality(NEW.superseded_duplicate_candidate_ids) = 0
  ) THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  IF NEW.automatic_projector_mode_id IN ('S5_R0_JC', 'S5_R0_JR', 'S5_R1_JC', 'S5_R1_JR') AND NOT (
    cardinality(NEW.reused_resource_identity_ids) = 1
    AND cardinality(NEW.created_resource_version_identity_ids) = 1
    AND cardinality(NEW.created_source_link_ids) = 1
    AND cardinality(NEW.created_observation_ids) = 1
    AND cardinality(NEW.created_handoff_marker_ids) = 1
    AND cardinality(NEW.created_source_repository_ids) = CASE WHEN starts_with(NEW.automatic_projector_mode_id, 'S5_R0_') THEN 1 ELSE 0 END
    AND cardinality(NEW.reused_source_repository_ids) = CASE WHEN starts_with(NEW.automatic_projector_mode_id, 'S5_R1_') THEN 1 ELSE 0 END
    AND cardinality(NEW.created_resource_identity_ids) = 0
    AND cardinality(NEW.reused_resource_version_identity_ids) = 0
    AND cardinality(NEW.reused_source_link_ids) = 0
    AND cardinality(NEW.reused_observation_ids) = 0
    AND cardinality(NEW.created_duplicate_candidate_ids) = 0
    AND cardinality(NEW.superseded_source_link_ids) = 0
    AND cardinality(NEW.superseded_identity_decision_ids) = 0
    AND cardinality(NEW.superseded_handoff_marker_ids) = 0
    AND cardinality(NEW.superseded_duplicate_candidate_ids) = 0
  ) THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  IF NEW.automatic_projector_mode_id = 'S6_JR' AND (
    cardinality(NEW.created_source_repository_ids) <> 0
    OR cardinality(NEW.created_resource_identity_ids) <> 0
    OR cardinality(NEW.created_resource_version_identity_ids) <> 0
    OR cardinality(NEW.created_source_link_ids) <> 0
    OR cardinality(NEW.created_observation_ids) <> 0
    OR cardinality(NEW.created_duplicate_candidate_ids) <> 0
    OR cardinality(NEW.created_handoff_marker_ids) <> 0
    OR cardinality(NEW.reused_source_repository_ids) <> 0
    OR cardinality(NEW.reused_resource_identity_ids) <> 0
    OR cardinality(NEW.reused_resource_version_identity_ids) <> 0
    OR cardinality(NEW.reused_source_link_ids) <> 0
    OR cardinality(NEW.reused_observation_ids) <> 0
    OR cardinality(NEW.superseded_source_link_ids) <> 0
    OR cardinality(NEW.superseded_identity_decision_ids) <> 0
    OR cardinality(NEW.superseded_handoff_marker_ids) <> 0
    OR cardinality(NEW.superseded_duplicate_candidate_ids) <> 0
    OR NEW.resource_identity_id IS NOT NULL OR NEW.resource_version_identity_id IS NOT NULL
    OR NEW.duplicate_candidate_id IS NOT NULL OR NEW.handoff_marker_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH';
  END IF;
  IF NEW.automatic_projector_mode_id = 'S7_JR' AND (
    cardinality(NEW.created_duplicate_candidate_ids) <> 1
    OR NEW.duplicate_candidate_id::uuid <> ALL(NEW.created_duplicate_candidate_ids)
    OR cardinality(NEW.created_source_repository_ids) <> 0
    OR cardinality(NEW.created_resource_identity_ids) <> 0
    OR cardinality(NEW.created_resource_version_identity_ids) <> 0
    OR cardinality(NEW.created_source_link_ids) <> 0
    OR cardinality(NEW.created_observation_ids) <> 0
    OR cardinality(NEW.created_handoff_marker_ids) <> 0
    OR cardinality(NEW.reused_source_repository_ids) <> 0
    OR cardinality(NEW.reused_resource_identity_ids) <> 0
    OR cardinality(NEW.reused_resource_version_identity_ids) <> 0
    OR cardinality(NEW.reused_source_link_ids) <> 0
    OR cardinality(NEW.reused_observation_ids) <> 0
    OR cardinality(NEW.superseded_source_link_ids) <> 0
    OR cardinality(NEW.superseded_identity_decision_ids) <> 0
    OR cardinality(NEW.superseded_handoff_marker_ids) <> 0
    OR cardinality(NEW.superseded_duplicate_candidate_ids) <> 0
  ) THEN
    RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH';
  END IF;
  IF NEW.automatic_projector_mode_id = 'S8_JR' AND (
    cardinality(NEW.created_source_repository_ids) <> 0
    OR cardinality(NEW.created_resource_identity_ids) <> 0
    OR cardinality(NEW.created_resource_version_identity_ids) <> 0
    OR cardinality(NEW.created_source_link_ids) <> 0
    OR cardinality(NEW.created_observation_ids) <> 0
    OR cardinality(NEW.created_duplicate_candidate_ids) <> 0
    OR cardinality(NEW.created_handoff_marker_ids) <> 0
    OR cardinality(NEW.reused_source_repository_ids) <> 0
    OR cardinality(NEW.reused_resource_identity_ids) <> 0
    OR cardinality(NEW.reused_resource_version_identity_ids) <> 0
    OR cardinality(NEW.reused_source_link_ids) <> 0
    OR cardinality(NEW.reused_observation_ids) <> 0
    OR cardinality(NEW.superseded_source_link_ids) <> 0
    OR cardinality(NEW.superseded_identity_decision_ids) <> 0
    OR cardinality(NEW.superseded_handoff_marker_ids) <> 0
    OR cardinality(NEW.superseded_duplicate_candidate_ids) <> 0
  ) THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  IF NEW.automatic_projector_mode_id IN ('S9_JC', 'S9_JR') AND NOT (
    cardinality(NEW.reused_resource_identity_ids) = 1
    AND cardinality(NEW.reused_resource_version_identity_ids) = 1
    AND cardinality(NEW.created_handoff_marker_ids) = 1
    AND cardinality(NEW.superseded_identity_decision_ids) = 1
    AND cardinality(NEW.created_source_repository_ids) = 0
    AND cardinality(NEW.created_resource_identity_ids) = 0
    AND cardinality(NEW.created_resource_version_identity_ids) = 0
    AND cardinality(NEW.created_source_link_ids) = 0
    AND cardinality(NEW.created_observation_ids) = 0
    AND cardinality(NEW.created_duplicate_candidate_ids) = 0
    AND cardinality(NEW.reused_source_repository_ids) = 0
    AND cardinality(NEW.reused_source_link_ids) = 0
    AND cardinality(NEW.reused_observation_ids) = 0
    AND cardinality(NEW.superseded_source_link_ids) = 0
    AND cardinality(NEW.superseded_handoff_marker_ids) = 0
    AND cardinality(NEW.superseded_duplicate_candidate_ids) = 0
  ) THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  IF NEW.automatic_projector_mode_id = 'S10_JR' AND NOT (
    cardinality(NEW.reused_resource_identity_ids) = 1
    AND cardinality(NEW.reused_resource_version_identity_ids) = 1
    AND cardinality(NEW.created_handoff_marker_ids) = 0
    AND cardinality(NEW.superseded_identity_decision_ids) = 1
    AND cardinality(NEW.created_source_repository_ids) = 0
    AND cardinality(NEW.created_resource_identity_ids) = 0
    AND cardinality(NEW.created_resource_version_identity_ids) = 0
    AND cardinality(NEW.created_source_link_ids) = 0
    AND cardinality(NEW.created_observation_ids) = 0
    AND cardinality(NEW.created_duplicate_candidate_ids) = 0
    AND cardinality(NEW.reused_source_repository_ids) = 0
    AND cardinality(NEW.reused_source_link_ids) = 0
    AND cardinality(NEW.reused_observation_ids) = 0
    AND cardinality(NEW.superseded_source_link_ids) = 0
    AND cardinality(NEW.superseded_handoff_marker_ids) = 0
    AND cardinality(NEW.superseded_duplicate_candidate_ids) = 0
  ) THEN RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH'; END IF;
  IF domain_mutation_plan_value->'postconditions' <>
      m02_system_result_mutation_plan_json(NEW.id)
    OR NOT m02_system_mutation_plan_payload_matches(NEW.id, NEW.mutation_plan_payload)
  THEN
    RAISE EXCEPTION 'M02_SYSTEM_RESULT_POSTCONDITION_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER m02_system_identity_results_postconditions_guard
AFTER INSERT ON m02_system_identity_results
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_system_identity_result_postconditions();

CREATE TRIGGER m02_system_identity_operations_immutable
BEFORE UPDATE OR DELETE ON m02_system_identity_operations
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();

CREATE TRIGGER m02_system_identity_results_immutable
BEFORE UPDATE OR DELETE ON m02_system_identity_results
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();

CREATE FUNCTION enforce_m02_replacement_mapping_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  expected_subject_type text;
  expected_metadata jsonb;
BEGIN
  IF TG_TABLE_NAME = 'm02_root_replacements' THEN
    expected_subject_type := 'ROOT_REPLACEMENT';
    expected_metadata := jsonb_strip_nulls(jsonb_build_object(
      'predecessorRootId', NEW.predecessor_root_id,
      'successorRootId', NEW.successor_root_id,
      'replacementKind', NEW.replacement_kind
    ));
  ELSIF TG_TABLE_NAME = 'm02_candidate_replacements' THEN
    expected_subject_type := 'CANDIDATE_REPLACEMENT';
    expected_metadata := jsonb_strip_nulls(jsonb_build_object(
      'predecessorCandidateId', NEW.predecessor_candidate_id,
      'successorCandidateId', NEW.successor_candidate_id,
      'replacementKind', NEW.replacement_kind
    ));
  ELSIF TG_TABLE_NAME = 'm02_ownership_replacements' THEN
    expected_subject_type := 'OWNERSHIP_REPLACEMENT';
    expected_metadata := jsonb_strip_nulls(jsonb_build_object(
      'predecessorOwnershipId', NEW.predecessor_ownership_id,
      'successorOwnershipId', NEW.successor_ownership_id,
      'replacementKind', NEW.replacement_kind
    ));
  ELSE
    expected_subject_type := 'GROUP_EDGE_REPLACEMENT';
    expected_metadata := jsonb_strip_nulls(jsonb_build_object(
      'predecessorEdgeId', NEW.predecessor_group_edge_id,
      'successorEdgeId', NEW.successor_group_edge_id,
      'replacementKind', NEW.replacement_kind
    ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM m02_audit_events audit
    WHERE audit.id = NEW.audit_event_id
      AND audit.origin_type = 'HUMAN_COMMAND'
      AND audit.command_id = NEW.command_id
      AND audit.result_id = NEW.result_id
      AND audit.action = 'SUBJECT_CREATED'
      AND audit.subject_type = expected_subject_type
      AND audit.subject_id = NEW.id
      AND audit.before_version IS NULL AND audit.after_version IS NULL
      AND audit.before_state IS NULL AND audit.after_state IS NULL
      AND audit.metadata = expected_metadata
  ) THEN
    RAISE EXCEPTION 'M02_REPLACEMENT_MAPPING_AUDIT_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER m02_root_replacements_audit_guard
AFTER INSERT ON m02_root_replacements DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_replacement_mapping_audit();
CREATE CONSTRAINT TRIGGER m02_candidate_replacements_audit_guard
AFTER INSERT ON m02_candidate_replacements DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_replacement_mapping_audit();
CREATE CONSTRAINT TRIGGER m02_ownership_replacements_audit_guard
AFTER INSERT ON m02_ownership_replacements DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_replacement_mapping_audit();
CREATE CONSTRAINT TRIGGER m02_group_edge_replacements_audit_guard
AFTER INSERT ON m02_group_edge_replacements DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_replacement_mapping_audit();

CREATE FUNCTION enforce_m02_human_candidate_audit_projection(
  command_key text, result_key text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  target record;
  target_count integer := 0;
  candidate_audit_count integer;
  predecessor_audit_count integer;
  expected_before_state text;
  expected_after_state text;
  expected_action text;
BEGIN
  SELECT count(*) INTO candidate_audit_count
  FROM m02_audit_events audit
  WHERE audit.command_id = command_key AND audit.result_id = result_key
    AND audit.subject_type = 'RESOURCE_CANDIDATE';

  IF EXISTS (
    SELECT 1
    FROM m02_candidate_replacements replacement
    JOIN resource_candidates successor ON successor.id = replacement.successor_candidate_id
    WHERE replacement.command_id = command_key AND replacement.result_id = result_key
      AND replacement.successor_candidate_id IS NOT NULL
      AND (successor.creation_command_id IS DISTINCT FROM command_key
        OR successor.creation_result_id IS DISTINCT FROM result_key
        OR successor.creation_audit_event_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'M02_HUMAN_CANDIDATE_AUDIT_MISMATCH';
  END IF;

  FOR target IN
    SELECT candidate.id, candidate.status, candidate.identity_outcome,
      candidate.resource_identity_id, candidate.resource_version_identity_id,
      candidate.record_version, candidate.superseded_by_candidate_id,
      candidate.terminal_reason_code, candidate.replacement_audit_event_id,
      candidate.creation_audit_event_id,
      CASE WHEN mutation.mutation_kind = 'CREATED'
        THEN candidate.creation_audit_event_id
        WHEN mutation.mutation_kind = 'TOPOLOGY'
        THEN candidate.replacement_audit_event_id
        ELSE NULL END AS selected_audit_event_id,
      mutation.mutation_kind
    FROM (
      SELECT decision.resource_candidate_id AS candidate_id, 'IDENTITY'::text AS mutation_kind
      FROM identity_decisions decision
      WHERE decision.command_id = command_key AND decision.result_id = result_key
        AND decision.state = 'ACTIVE'
      UNION ALL
      SELECT rejection.resource_candidate_id, 'REJECTION'::text
      FROM m02_candidate_rejection_decisions rejection
      WHERE rejection.command_id = command_key AND rejection.result_id = result_key
        AND rejection.state = 'ACTIVE'
      UNION ALL
      SELECT DISTINCT replacement.predecessor_candidate_id, 'TOPOLOGY'::text
      FROM m02_candidate_replacements replacement
      JOIN resource_candidates predecessor ON predecessor.id = replacement.predecessor_candidate_id
      WHERE replacement.command_id = command_key AND replacement.result_id = result_key
        AND replacement.predecessor_candidate_id IS NOT NULL
        AND predecessor.status = 'SUPERSEDED'
        AND predecessor.replacement_command_id = command_key
        AND predecessor.replacement_result_id = result_key
      UNION ALL
      SELECT DISTINCT replacement.successor_candidate_id, 'CREATED'::text AS mutation_kind
      FROM m02_candidate_replacements replacement
      JOIN resource_candidates successor ON successor.id = replacement.successor_candidate_id
      WHERE replacement.command_id = command_key AND replacement.result_id = result_key
        AND replacement.successor_candidate_id IS NOT NULL
        AND successor.creation_command_id = command_key
        AND successor.creation_result_id = result_key
    ) mutation
    JOIN resource_candidates candidate ON candidate.id = mutation.candidate_id
  LOOP
    target_count := target_count + 1;
    IF target.mutation_kind = 'CREATED' THEN
      expected_after_state := m02_canonical_json(jsonb_build_object(
        'identityOutcome', target.identity_outcome,
        'recordVersion', target.record_version,
        'resourceIdentityId', target.resource_identity_id,
        'resourceVersionIdentityId', target.resource_version_identity_id,
        'status', target.status
      ));
      IF target.record_version <> 1 OR
        (SELECT count(*) FROM m02_audit_events audit
         WHERE audit.id = target.selected_audit_event_id
           AND audit.command_id = command_key AND audit.result_id = result_key
           AND audit.subject_type = 'RESOURCE_CANDIDATE' AND audit.subject_id = target.id
           AND audit.action = 'SUBJECT_CREATED'
           AND audit.before_version IS NULL AND audit.before_state IS NULL
           AND audit.after_version = target.record_version
           AND audit.after_state = expected_after_state
           AND audit.metadata = '{}'::jsonb) <> 1
      THEN
        RAISE EXCEPTION 'M02_HUMAN_CANDIDATE_AUDIT_MISMATCH';
      END IF;
      CONTINUE;
    END IF;

    SELECT count(*), min(predecessor_audit.after_state)
    INTO predecessor_audit_count, expected_before_state
    FROM identity_decisions predecessor
    JOIN m02_audit_events predecessor_audit
      ON predecessor_audit.subject_type = 'RESOURCE_CANDIDATE'
     AND predecessor_audit.subject_id = predecessor.resource_candidate_id
     AND predecessor_audit.action = 'SUBJECT_UPDATED'
     AND predecessor_audit.command_id IS NOT DISTINCT FROM predecessor.command_id
     AND predecessor_audit.result_id IS NOT DISTINCT FROM predecessor.result_id
     AND predecessor_audit.system_operation_id IS NOT DISTINCT FROM predecessor.system_operation_id
     AND predecessor_audit.system_result_id IS NOT DISTINCT FROM predecessor.system_result_id
    WHERE predecessor.resource_candidate_id = target.id
      AND predecessor.state = 'SUPERSEDED'
      AND predecessor.replacement_command_id = command_key
      AND predecessor.replacement_result_id = result_key;

    IF predecessor_audit_count > 1
      OR (predecessor_audit_count = 1 AND expected_before_state IS NULL)
      OR (target.mutation_kind = 'TOPOLOGY' AND predecessor_audit_count <> 1)
    THEN
      RAISE EXCEPTION 'M02_HUMAN_CANDIDATE_AUDIT_MISMATCH: M02_HUMAN_CANDIDATE_BEFORE_STATE_MISMATCH';
    END IF;
    IF predecessor_audit_count = 0 THEN
      expected_before_state := m02_canonical_json(jsonb_build_object(
        'identityOutcome', NULL,
        'recordVersion', target.record_version - 1,
        'resourceIdentityId', NULL,
        'resourceVersionIdentityId', NULL,
        'status', 'CLASSIFIED'
      ));
    END IF;

    IF target.mutation_kind = 'TOPOLOGY' THEN
      expected_action := 'SUBJECT_SUPERSEDED';
      expected_after_state := m02_canonical_json(jsonb_build_object(
        'identityOutcome', target.identity_outcome,
        'recordVersion', target.record_version,
        'resourceIdentityId', target.resource_identity_id,
        'resourceVersionIdentityId', target.resource_version_identity_id,
        'status', target.status,
        'supersededById', target.superseded_by_candidate_id,
        'terminalReasonCode', target.terminal_reason_code
      ));
    ELSE
      expected_action := 'SUBJECT_UPDATED';
      expected_after_state := m02_canonical_json(jsonb_build_object(
        'identityOutcome', target.identity_outcome,
        'recordVersion', target.record_version,
        'resourceIdentityId', target.resource_identity_id,
        'resourceVersionIdentityId', target.resource_version_identity_id,
        'status', target.status
      ));
    END IF;

    IF (SELECT count(*) FROM m02_audit_events audit
        WHERE audit.command_id = command_key AND audit.result_id = result_key
          AND (target.selected_audit_event_id IS NULL
            OR audit.id = target.selected_audit_event_id)
          AND audit.subject_type = 'RESOURCE_CANDIDATE' AND audit.subject_id = target.id
          AND audit.action = expected_action
          AND audit.before_version = target.record_version - 1
          AND audit.after_version = target.record_version
          AND audit.before_state = expected_before_state
          AND audit.after_state = expected_after_state
          AND audit.metadata = CASE WHEN target.mutation_kind = 'TOPOLOGY'
            THEN jsonb_build_object('successorId', target.superseded_by_candidate_id)
            ELSE '{}'::jsonb END) <> 1
    THEN
      RAISE EXCEPTION 'M02_HUMAN_CANDIDATE_AUDIT_MISMATCH';
    END IF;
  END LOOP;

  IF candidate_audit_count <> target_count THEN
    RAISE EXCEPTION 'M02_HUMAN_CANDIDATE_AUDIT_MISMATCH';
  END IF;
END;
$$;

CREATE FUNCTION enforce_m02_human_identity_result_projection() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  command_row manual_resolution_commands%ROWTYPE;
  expected_outcome text;
  identity_writer boolean;
  actual_created_identity_ids text[];
  actual_created_version_ids text[];
BEGIN
  SELECT * INTO command_row FROM manual_resolution_commands WHERE id = NEW.command_id;
  PERFORM enforce_m02_human_candidate_audit_projection(NEW.command_id, NEW.id);
  identity_writer := command_row.command_type IN (
    'CREATE_RESOURCE', 'ATTACH_NEW_VERSION', 'MARK_FORK', 'MARK_MIRROR', 'MARK_DUPLICATE'
  ) OR (
    command_row.command_type = 'RESOLVE_AMBIGUITY'
    AND command_row.target_candidate_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM m02_candidate_rejection_decisions rejection
      WHERE rejection.command_id = NEW.command_id AND rejection.result_id = NEW.id
        AND rejection.resource_candidate_id = command_row.target_candidate_id
        AND rejection.state = 'ACTIVE'
    )
    AND NOT EXISTS (
      SELECT 1 FROM m02_candidate_replacements replacement
      WHERE replacement.command_id = NEW.command_id AND replacement.result_id = NEW.id
    )
  );

  IF command_row.command_type = 'REJECT_CANDIDATE' OR (
    command_row.command_type = 'RESOLVE_AMBIGUITY' AND EXISTS (
      SELECT 1 FROM m02_candidate_rejection_decisions rejection
      WHERE rejection.command_id = NEW.command_id AND rejection.result_id = NEW.id
        AND rejection.state = 'ACTIVE'
    )
  ) THEN
    IF NEW.identity_projection_mode_id IS NOT NULL OR NEW.identity_outcome IS NOT NULL
      OR NEW.resource_identity_id IS NOT NULL OR NEW.resource_version_identity_id IS NOT NULL
      OR cardinality(NEW.created_resource_identity_ids) <> 0
      OR cardinality(NEW.reused_resource_identity_ids) <> 0
      OR cardinality(NEW.created_resource_version_identity_ids) <> 0
      OR cardinality(NEW.reused_resource_version_identity_ids) <> 0
      OR EXISTS (
        SELECT 1 FROM identity_decisions decision
        WHERE decision.command_id = NEW.command_id AND decision.result_id = NEW.id
      )
      OR NOT EXISTS (
        SELECT 1 FROM m02_candidate_rejection_decisions rejection
        WHERE rejection.command_id = NEW.command_id AND rejection.result_id = NEW.id
          AND rejection.state = 'ACTIVE'
      )
    THEN RAISE EXCEPTION 'M02_REJECTION_IDENTITY_SURFACE_PROHIBITED'; END IF;
    RETURN NEW;
  END IF;

  IF NOT identity_writer THEN
    IF NEW.identity_projection_mode_id IS NOT NULL OR NEW.identity_outcome IS NOT NULL
      OR NEW.resource_identity_id IS NOT NULL OR NEW.resource_version_identity_id IS NOT NULL
      OR cardinality(NEW.created_resource_identity_ids) <> 0
      OR cardinality(NEW.reused_resource_identity_ids) <> 0
      OR cardinality(NEW.created_resource_version_identity_ids) <> 0
      OR cardinality(NEW.reused_resource_version_identity_ids) <> 0
      OR EXISTS (
        SELECT 1 FROM identity_decisions decision
        WHERE decision.command_id = NEW.command_id AND decision.result_id = NEW.id
      )
    THEN RAISE EXCEPTION 'M02_HUMAN_IDENTITY_RESULT_MISMATCH'; END IF;
    RETURN NEW;
  END IF;

  IF NEW.identity_projection_mode_id IS NULL OR NEW.identity_outcome IS NULL THEN
    RAISE EXCEPTION 'M02_HUMAN_IDENTITY_RESULT_REQUIRED';
  END IF;

  expected_outcome := CASE
    WHEN NEW.identity_projection_mode_id = 'CREATE_RESOURCE' THEN 'NEW_RESOURCE'
    WHEN NEW.identity_projection_mode_id = 'ATTACH_NEW_VERSION_A1' THEN 'EXISTING_RESOURCE_NEW_VERSION'
    WHEN NEW.identity_projection_mode_id IN ('ATTACH_NEW_VERSION_A2', 'ATTACH_NEW_VERSION_A3')
      THEN 'EXACT_REPEAT_REUSE'
    WHEN NEW.identity_projection_mode_id = 'MARK_FORK' THEN 'FORK_OF_EXISTING_RESOURCE'
    WHEN NEW.identity_projection_mode_id = 'MARK_MIRROR' THEN 'MIRROR'
    WHEN NEW.identity_projection_mode_id = 'MARK_DUPLICATE' THEN 'POSSIBLE_DUPLICATE'
  END;
  IF expected_outcome IS NULL OR NEW.identity_outcome <> expected_outcome
    OR command_row.command_type NOT IN (
      split_part(NEW.identity_projection_mode_id, '_A', 1), 'RESOLVE_AMBIGUITY'
    )
  THEN RAISE EXCEPTION 'M02_HUMAN_IDENTITY_RESULT_MISMATCH'; END IF;

  SELECT COALESCE(array_agg(id ORDER BY convert_to(id, 'UTF8')), ARRAY[]::text[])
  INTO actual_created_identity_ids
  FROM resource_identities
  WHERE origin_type = 'HUMAN_COMMAND' AND command_id = NEW.command_id AND result_id = NEW.id;
  IF actual_created_identity_ids <> NEW.created_resource_identity_ids THEN
    RAISE EXCEPTION 'M02_HUMAN_IDENTITY_CREATED_SET_MISMATCH';
  END IF;
  SELECT COALESCE(array_agg(id ORDER BY convert_to(id, 'UTF8')), ARRAY[]::text[])
  INTO actual_created_version_ids
  FROM resource_version_identities
  WHERE origin_type = 'HUMAN_COMMAND' AND command_id = NEW.command_id AND result_id = NEW.id;
  IF actual_created_version_ids <> NEW.created_resource_version_identity_ids THEN
    RAISE EXCEPTION 'M02_HUMAN_IDENTITY_CREATED_SET_MISMATCH';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(NEW.reused_resource_identity_ids) reused(id)
    LEFT JOIN resource_identities identity_row ON identity_row.id = reused.id
    WHERE identity_row.id IS NULL
      OR (identity_row.origin_type = 'HUMAN_COMMAND'
        AND identity_row.command_id = NEW.command_id AND identity_row.result_id = NEW.id)
  ) OR EXISTS (
    SELECT 1 FROM unnest(NEW.reused_resource_version_identity_ids) reused(id)
    LEFT JOIN resource_version_identities version_row ON version_row.id = reused.id
    WHERE version_row.id IS NULL
      OR (version_row.origin_type = 'HUMAN_COMMAND'
        AND version_row.command_id = NEW.command_id AND version_row.result_id = NEW.id)
  ) THEN
    RAISE EXCEPTION 'M02_HUMAN_IDENTITY_REUSED_SET_MISMATCH';
  END IF;

  IF (expected_outcome = 'NEW_RESOURCE' AND NOT (
      cardinality(NEW.created_resource_identity_ids) = 1
      AND cardinality(NEW.created_resource_version_identity_ids) = 1
      AND NEW.resource_identity_id = NEW.created_resource_identity_ids[1]
      AND NEW.resource_version_identity_id = NEW.created_resource_version_identity_ids[1]
      AND cardinality(NEW.reused_resource_identity_ids) = 0
      AND cardinality(NEW.reused_resource_version_identity_ids) = 0
    )) OR (expected_outcome = 'FORK_OF_EXISTING_RESOURCE' AND NOT (
      (
        cardinality(NEW.created_resource_identity_ids) = 1
        AND cardinality(NEW.created_resource_version_identity_ids) = 1
        AND NEW.resource_identity_id = NEW.created_resource_identity_ids[1]
        AND NEW.resource_version_identity_id = NEW.created_resource_version_identity_ids[1]
        AND cardinality(NEW.reused_resource_identity_ids) = 0
        AND cardinality(NEW.reused_resource_version_identity_ids) = 0
      ) OR (
        cardinality(NEW.created_resource_identity_ids) = 0
        AND cardinality(NEW.created_resource_version_identity_ids) = 0
        AND cardinality(NEW.reused_resource_identity_ids) = 1
        AND cardinality(NEW.reused_resource_version_identity_ids) = 1
        AND NEW.resource_identity_id = NEW.reused_resource_identity_ids[1]
        AND NEW.resource_version_identity_id = NEW.reused_resource_version_identity_ids[1]
      )
    )) OR (NEW.identity_projection_mode_id = 'ATTACH_NEW_VERSION_A1' AND NOT (
      cardinality(NEW.created_resource_identity_ids) = 0
      AND cardinality(NEW.reused_resource_identity_ids) = 1
      AND cardinality(NEW.created_resource_version_identity_ids) = 1
      AND cardinality(NEW.reused_resource_version_identity_ids) = 0
      AND NEW.resource_identity_id = NEW.reused_resource_identity_ids[1]
      AND NEW.resource_version_identity_id = NEW.created_resource_version_identity_ids[1]
    )) OR (expected_outcome = 'EXACT_REPEAT_REUSE' AND NOT (
      cardinality(NEW.created_resource_identity_ids) = 0
      AND cardinality(NEW.created_resource_version_identity_ids) = 0
      AND cardinality(NEW.reused_resource_identity_ids) = 1
      AND cardinality(NEW.reused_resource_version_identity_ids) = 1
      AND NEW.resource_identity_id = NEW.reused_resource_identity_ids[1]
      AND NEW.resource_version_identity_id = NEW.reused_resource_version_identity_ids[1]
    )) OR (expected_outcome = 'MIRROR' AND NOT (
      cardinality(NEW.created_resource_identity_ids) = 0
      AND cardinality(NEW.created_resource_version_identity_ids) = 0
      AND cardinality(NEW.reused_resource_identity_ids) = 1
      AND cardinality(NEW.reused_resource_version_identity_ids) = 1
      AND NEW.resource_identity_id = NEW.reused_resource_identity_ids[1]
      AND NEW.resource_version_identity_id = NEW.reused_resource_version_identity_ids[1]
    )) OR (expected_outcome IN ('POSSIBLE_DUPLICATE', 'AMBIGUOUS_IDENTITY') AND NOT (
      NEW.resource_identity_id IS NULL AND NEW.resource_version_identity_id IS NULL
      AND cardinality(NEW.created_resource_identity_ids) = 0
      AND cardinality(NEW.created_resource_version_identity_ids) = 0
      AND cardinality(NEW.reused_resource_identity_ids) = 0
      AND cardinality(NEW.reused_resource_version_identity_ids) = 0
    )) THEN RAISE EXCEPTION 'M02_HUMAN_IDENTITY_RESULT_MISMATCH'; END IF;

  IF command_row.target_candidate_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM resource_candidates candidate
    WHERE candidate.id = command_row.target_candidate_id
      AND candidate.identity_outcome = NEW.identity_outcome
      AND candidate.resource_identity_id IS NOT DISTINCT FROM NEW.resource_identity_id
      AND candidate.resource_version_identity_id IS NOT DISTINCT FROM NEW.resource_version_identity_id
  ) OR NOT EXISTS (
    SELECT 1 FROM identity_decisions decision
    WHERE decision.resource_candidate_id = command_row.target_candidate_id
      AND decision.command_id = NEW.command_id AND decision.result_id = NEW.id
      AND decision.outcome = NEW.identity_outcome AND decision.state = 'ACTIVE'
  ) OR (SELECT count(*) FROM identity_decisions decision
        WHERE decision.command_id = NEW.command_id AND decision.result_id = NEW.id) <> 1
  THEN RAISE EXCEPTION 'M02_HUMAN_IDENTITY_RESULT_MISMATCH'; END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER m02_manual_command_results_identity_projection_guard
AFTER INSERT ON m02_manual_command_results
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_human_identity_result_projection();

CREATE FUNCTION enforce_m02_candidate_identity_projection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM m02_system_identity_results result
    JOIN identity_decisions decision ON decision.id = result.identity_decision_id
    WHERE result.candidate_id = NEW.id
      AND decision.resource_candidate_id = NEW.id
      AND decision.state = 'ACTIVE'
      AND decision.system_operation_id = result.system_operation_id
      AND decision.system_result_id = result.id
      AND (
        NEW.identity_outcome IS DISTINCT FROM decision.outcome
        OR NEW.resource_identity_id IS DISTINCT FROM result.resource_identity_id
        OR NEW.resource_version_identity_id IS DISTINCT FROM result.resource_version_identity_id
        OR result.final_candidate_state <> jsonb_build_object(
          'status', NEW.status,
          'identityOutcome', NEW.identity_outcome,
          'resourceIdentityId', NEW.resource_identity_id,
          'resourceVersionIdentityId', NEW.resource_version_identity_id,
          'recordVersion', NEW.record_version
        )
      )
  ) THEN
    RAISE EXCEPTION 'M02_SYSTEM_CANDIDATE_PROJECTION_MISMATCH';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM m02_manual_command_results result
    JOIN manual_resolution_commands command ON command.id = result.command_id
    JOIN identity_decisions decision
      ON decision.command_id = command.id AND decision.result_id = result.id
    WHERE command.target_candidate_id = NEW.id
      AND decision.resource_candidate_id = NEW.id
      AND decision.state = 'ACTIVE'
      AND result.identity_outcome IS NOT NULL
      AND (NEW.identity_outcome IS DISTINCT FROM decision.outcome
        OR NEW.identity_outcome IS DISTINCT FROM result.identity_outcome
        OR NEW.resource_identity_id IS DISTINCT FROM result.resource_identity_id
        OR NEW.resource_version_identity_id IS DISTINCT FROM result.resource_version_identity_id)
  ) THEN
    RAISE EXCEPTION 'M02_HUMAN_IDENTITY_RESULT_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER resource_candidates_identity_projection_guard
AFTER INSERT OR UPDATE ON resource_candidates
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_candidate_identity_projection();

CREATE TRIGGER m02_rejected_system_identity_audits_append_only
BEFORE UPDATE OR DELETE ON m02_rejected_system_identity_audits
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();

CREATE TRIGGER identity_decision_children_immutable
BEFORE UPDATE OR DELETE ON identity_decision_tier_evaluations
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();
CREATE TRIGGER identity_decision_children_immutable
BEFORE UPDATE OR DELETE ON identity_decision_signals
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();
CREATE TRIGGER identity_decision_children_immutable
BEFORE UPDATE OR DELETE ON identity_decision_signal_evidence
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();
CREATE TRIGGER identity_decision_children_immutable
BEFORE UPDATE OR DELETE ON identity_decision_conflicts
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();
CREATE TRIGGER identity_decision_children_immutable
BEFORE UPDATE OR DELETE ON identity_decision_conflict_targets
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();
CREATE TRIGGER identity_decision_children_immutable
BEFORE UPDATE OR DELETE ON identity_decision_conflict_evidence
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();

CREATE FUNCTION enforce_m02_audit_origin_semantics() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  expected_system_metadata jsonb;
BEGIN
  IF NEW.origin_type = 'HUMAN_COMMAND' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM manual_resolution_commands command
      JOIN m02_manual_command_results result ON result.command_id = command.id
      WHERE command.id = NEW.command_id
        AND result.id = NEW.result_id
        AND command.request_id = NEW.request_id
        AND command.idempotency_scope = NEW.idempotency_scope
        AND command.idempotency_key = NEW.idempotency_key
        AND command.actor_id = NEW.actor_id
        AND command.actor_role = NEW.actor_role
        AND command.reason_code = NEW.reason_code
        AND command.reason = NEW.reason_text
    ) THEN
      RAISE EXCEPTION 'INVALID_M02_HUMAN_AUDIT_ORIGIN';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM m02_system_identity_operations operation
      JOIN m02_system_identity_results result ON result.system_operation_id = operation.id
      WHERE operation.id = NEW.system_operation_id
        AND result.id = NEW.system_result_id
        AND operation.id = NEW.request_id
        AND operation.idempotency_scope = NEW.idempotency_scope
        AND operation.idempotency_key = NEW.idempotency_key
        AND operation.system_actor_id = NEW.actor_id
        AND operation.automatic_projector_mode_id = NEW.reason_code
        AND operation.automatic_projector_mode_id = NEW.reason_text
        AND result.automatic_projector_mode_id = operation.automatic_projector_mode_id
        AND (NEW.action <> 'SYSTEM_OPERATION_ACCEPTED' OR result.accepted_audit_event_id = NEW.id)
    ) THEN
      RAISE EXCEPTION 'INVALID_M02_SYSTEM_AUDIT_ORIGIN';
    END IF;
    IF NEW.action = 'SYSTEM_OPERATION_ACCEPTED' OR NEW.subject_type = 'IDENTITY_DECISION' THEN
      SELECT jsonb_build_object(
        'evaluatedTierSequence',
          convert_from(operation.identity_decision_input_payload, 'UTF8')::jsonb->'evaluatedTierSequence',
        'automaticProjectorModeId', operation.automatic_projector_mode_id,
        'identityDecisionInputFingerprint', operation.identity_decision_input_fingerprint
      ) INTO expected_system_metadata
      FROM m02_system_identity_operations operation WHERE operation.id = NEW.system_operation_id;
      IF NEW.metadata <> expected_system_metadata THEN
        RAISE EXCEPTION 'M02_SYSTEM_AUDIT_METADATA_MISMATCH';
      END IF;
    ELSIF NEW.subject_type = 'RESOURCE_SOURCE_LINK' AND NEW.action = 'SUBJECT_SUPERSEDED' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM resource_source_links predecessor
        JOIN resource_source_links successor ON successor.supersedes_source_link_id = predecessor.id
        WHERE predecessor.id = NEW.subject_id
          AND successor.system_operation_id = NEW.system_operation_id
          AND successor.system_result_id = NEW.system_result_id
          AND NEW.metadata = jsonb_build_object('successorId', successor.id)
      ) THEN
        RAISE EXCEPTION 'M02_SYSTEM_AUDIT_METADATA_MISMATCH';
      END IF;
    ELSIF NEW.subject_type = 'M02_JOB' THEN
      IF NOT EXISTS (
        SELECT 1 FROM m02_jobs job
        WHERE job.id = NEW.subject_id
          AND NEW.metadata = jsonb_build_object(
            'scope', job.operation_scope, 'guardKey', job.job_scope_key
          )
      ) THEN
        RAISE EXCEPTION 'M02_SYSTEM_AUDIT_METADATA_MISMATCH';
      END IF;
    ELSIF NEW.metadata <> '{}'::jsonb THEN
      RAISE EXCEPTION 'M02_SYSTEM_AUDIT_METADATA_MISMATCH';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER m02_audit_events_origin_semantics_guard
AFTER INSERT ON m02_audit_events
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_audit_origin_semantics();

CREATE FUNCTION enforce_m02_system_audit_formula() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  result_row m02_system_identity_results%ROWTYPE;
  expected_count bigint;
BEGIN
  IF NEW.origin_type <> 'SYSTEM_IDENTITY_OPERATION' THEN RETURN NEW; END IF;
  SELECT * INTO result_row FROM m02_system_identity_results WHERE id = NEW.system_result_id;
  IF result_row.id IS NULL THEN RETURN NEW; END IF;
  expected_count := 1
    + cardinality(result_row.created_source_repository_ids)
    + cardinality(result_row.created_source_repository_url_ids)
    + cardinality(result_row.created_resource_identity_ids)
    + cardinality(result_row.created_resource_version_identity_ids)
    + cardinality(result_row.created_source_link_ids)
    + cardinality(result_row.created_observation_ids)
    + cardinality(result_row.created_duplicate_candidate_ids)
    + cardinality(result_row.created_identity_decision_ids)
    + cardinality(result_row.created_handoff_marker_ids)
    + cardinality(result_row.created_identity_decision_tier_evaluation_ids)
    + cardinality(result_row.created_identity_decision_signal_ids)
    + cardinality(result_row.created_identity_decision_signal_evidence_ids)
    + cardinality(result_row.created_identity_decision_conflict_ids)
    + cardinality(result_row.created_identity_decision_conflict_target_ids)
    + cardinality(result_row.created_identity_decision_conflict_evidence_ids)
    + cardinality(result_row.updated_resource_candidate_ids)
    + cardinality(result_row.updated_review_state_ids)
    + cardinality(result_row.updated_acquisition_job_ids)
    + cardinality(result_row.updated_m02_job_ids)
    + cardinality(result_row.superseded_source_link_ids)
    + cardinality(result_row.superseded_identity_decision_ids)
    + cardinality(result_row.superseded_handoff_marker_ids)
    + cardinality(result_row.superseded_duplicate_candidate_ids);
  IF (SELECT count(*) FROM m02_audit_events audit
      WHERE audit.system_operation_id = result_row.system_operation_id
        AND audit.system_result_id = result_row.id) <> expected_count THEN
    RAISE EXCEPTION 'M02_SYSTEM_RESULT_AUDIT_FORMULA_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER m02_audit_events_system_formula_guard
AFTER INSERT ON m02_audit_events
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_m02_system_audit_formula();

CREATE FUNCTION enforce_identity_decision_child_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  decision_key text;
  expected_subject_type text;
  expected_audit_id text;
BEGIN
  IF TG_TABLE_NAME = 'identity_decision_tier_evaluations' THEN
    decision_key := NEW.identity_decision_id;
    expected_subject_type := 'IDENTITY_DECISION_TIER_EVALUATION';
    expected_audit_id := NEW.audit_event_id;
  ELSIF TG_TABLE_NAME = 'identity_decision_signals' THEN
    decision_key := NEW.identity_decision_id;
    expected_subject_type := 'IDENTITY_DECISION_SIGNAL';
    expected_audit_id := NEW.audit_event_id;
  ELSIF TG_TABLE_NAME = 'identity_decision_signal_evidence' THEN
    SELECT signal.identity_decision_id INTO decision_key
    FROM identity_decision_signals signal WHERE signal.id = NEW.signal_id;
    expected_subject_type := 'IDENTITY_DECISION_SIGNAL_EVIDENCE';
    expected_audit_id := NEW.audit_event_id;
  ELSIF TG_TABLE_NAME = 'identity_decision_conflicts' THEN
    decision_key := NEW.identity_decision_id;
    expected_subject_type := 'IDENTITY_DECISION_CONFLICT';
    expected_audit_id := NEW.audit_event_id;
  ELSIF TG_TABLE_NAME = 'identity_decision_conflict_targets' THEN
    SELECT conflict.identity_decision_id INTO decision_key
    FROM identity_decision_conflicts conflict WHERE conflict.id = NEW.conflict_id;
    expected_subject_type := 'IDENTITY_DECISION_CONFLICT_TARGET';
    expected_audit_id := NEW.audit_event_id;
  ELSE
    SELECT conflict.identity_decision_id INTO decision_key
    FROM identity_decision_conflicts conflict WHERE conflict.id = NEW.conflict_id;
    expected_subject_type := 'IDENTITY_DECISION_CONFLICT_EVIDENCE';
    expected_audit_id := NEW.audit_event_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM identity_decisions decision
    JOIN m02_audit_events audit ON audit.id = expected_audit_id
    WHERE decision.id = decision_key
      AND decision.origin_type = 'SYSTEM_IDENTITY_OPERATION'
      AND audit.origin_type = 'SYSTEM_IDENTITY_OPERATION'
      AND audit.system_operation_id = decision.system_operation_id
      AND audit.system_result_id = decision.system_result_id
      AND audit.action = 'SUBJECT_CREATED'
      AND audit.subject_type = expected_subject_type
      AND audit.subject_id = NEW.id::text
      AND audit.before_version IS NULL AND audit.after_version IS NULL
      AND audit.before_state IS NULL AND audit.after_state IS NULL
  ) THEN
    RAISE EXCEPTION 'INVALID_IDENTITY_DECISION_CHILD_AUDIT';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM identity_decisions decision
    JOIN m02_system_identity_results result ON result.id = decision.system_result_id
    WHERE decision.id = decision_key
      AND CASE TG_TABLE_NAME
        WHEN 'identity_decision_tier_evaluations' THEN NEW.id = ANY(result.created_identity_decision_tier_evaluation_ids)
        WHEN 'identity_decision_signals' THEN NEW.id = ANY(result.created_identity_decision_signal_ids)
        WHEN 'identity_decision_signal_evidence' THEN NEW.id = ANY(result.created_identity_decision_signal_evidence_ids)
        WHEN 'identity_decision_conflicts' THEN NEW.id = ANY(result.created_identity_decision_conflict_ids)
        WHEN 'identity_decision_conflict_targets' THEN NEW.id = ANY(result.created_identity_decision_conflict_target_ids)
        ELSE NEW.id = ANY(result.created_identity_decision_conflict_evidence_ids)
      END
  ) THEN
    RAISE EXCEPTION 'IDENTITY_DECISION_CHILD_NOT_IN_SYSTEM_RESULT';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER identity_decision_tier_evaluations_audit_guard
AFTER INSERT ON identity_decision_tier_evaluations DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_child_audit();
CREATE CONSTRAINT TRIGGER identity_decision_signals_audit_guard
AFTER INSERT ON identity_decision_signals DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_child_audit();
CREATE CONSTRAINT TRIGGER identity_decision_signal_evidence_audit_guard
AFTER INSERT ON identity_decision_signal_evidence DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_child_audit();
CREATE CONSTRAINT TRIGGER identity_decision_conflicts_audit_guard
AFTER INSERT ON identity_decision_conflicts DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_child_audit();
CREATE CONSTRAINT TRIGGER identity_decision_conflict_targets_audit_guard
AFTER INSERT ON identity_decision_conflict_targets DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_child_audit();
CREATE CONSTRAINT TRIGGER identity_decision_conflict_evidence_audit_guard
AFTER INSERT ON identity_decision_conflict_evidence DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_child_audit();

CREATE FUNCTION enforce_identity_decision_immutable_fields() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state <> 'ACTIVE' OR NEW.state <> 'SUPERSEDED'
    OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.resource_candidate_id IS DISTINCT FROM OLD.resource_candidate_id
    OR NEW.outcome IS DISTINCT FROM OLD.outcome
    OR NEW.matched_tier IS DISTINCT FROM OLD.matched_tier
    OR NEW.confidence IS DISTINCT FROM OLD.confidence
    OR NEW.identity_policy_version IS DISTINCT FROM OLD.identity_policy_version
    OR NEW.decision_source IS DISTINCT FROM OLD.decision_source
    OR NEW.signals IS DISTINCT FROM OLD.signals
    OR NEW.rejected_lower_tier_signals IS DISTINCT FROM OLD.rejected_lower_tier_signals
    OR NEW.conflicts IS DISTINCT FROM OLD.conflicts
    OR NEW.audit_fingerprint IS DISTINCT FROM OLD.audit_fingerprint
    OR NEW.supersedes_decision_id IS DISTINCT FROM OLD.supersedes_decision_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.origin_type IS DISTINCT FROM OLD.origin_type
    OR NEW.command_id IS DISTINCT FROM OLD.command_id
    OR NEW.result_id IS DISTINCT FROM OLD.result_id
    OR NEW.system_operation_id IS DISTINCT FROM OLD.system_operation_id
    OR NEW.system_result_id IS DISTINCT FROM OLD.system_result_id
    OR NEW.audit_event_id IS DISTINCT FROM OLD.audit_event_id
  THEN
    RAISE EXCEPTION 'M02_IDENTITY_DECISION_IMMUTABLE_FIELDS';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER identity_decisions_immutable_fields_guard
BEFORE UPDATE ON identity_decisions
FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_immutable_fields();

CREATE FUNCTION enforce_identity_decision_supersession_lineage() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state <> 'SUPERSEDED' THEN RETURN NEW; END IF;
  IF NEW.superseded_by_decision_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM identity_decisions successor
      WHERE successor.id = NEW.superseded_by_decision_id
        AND successor.supersedes_decision_id = NEW.id
        AND (
          (successor.origin_type = 'HUMAN_COMMAND'
            AND successor.command_id = NEW.replacement_command_id
            AND successor.result_id = NEW.replacement_result_id
            AND NEW.replacement_system_operation_id IS NULL
            AND NEW.replacement_system_result_id IS NULL)
          OR (successor.origin_type = 'SYSTEM_IDENTITY_OPERATION'
            AND successor.system_operation_id = NEW.replacement_system_operation_id
            AND successor.system_result_id = NEW.replacement_system_result_id
            AND NEW.replacement_command_id IS NULL AND NEW.replacement_result_id IS NULL)
        )
    ) THEN RAISE EXCEPTION 'M02_IDENTITY_DECISION_SUCCESSOR_LINEAGE_MISMATCH'; END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM manual_resolution_commands command
    JOIN m02_manual_command_results result ON result.command_id = command.id
    WHERE command.id = NEW.replacement_command_id
      AND result.id = NEW.replacement_result_id
      AND command.command_type IN (
        'REJECT_CANDIDATE', 'SPLIT_ROOTS', 'MERGE_ROOTS', 'OVERRIDE_NON_SKILL',
        'RESOLVE_AMBIGUITY'
      )
      AND NOT EXISTS (
        SELECT 1 FROM identity_decisions successor
        WHERE successor.command_id = command.id AND successor.result_id = result.id
      )
  ) THEN
    RAISE EXCEPTION 'M02_IDENTITY_DECISION_TERMINAL_SUPERSESSION_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER identity_decisions_supersession_lineage_guard
AFTER UPDATE ON identity_decisions DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_supersession_lineage();

CREATE FUNCTION enforce_identity_decision_system_precedence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.origin_type = 'HUMAN_COMMAND' AND EXISTS (
    SELECT 1 FROM identity_decisions successor
    WHERE successor.id = NEW.superseded_by_decision_id
      AND successor.origin_type = 'SYSTEM_IDENTITY_OPERATION'
  ) THEN
    RAISE EXCEPTION 'SYSTEM_OPERATION_CANNOT_SUPERSEDE_HUMAN_DECISION';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER identity_decisions_system_precedence_guard
AFTER UPDATE ON identity_decisions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_identity_decision_system_precedence();

CREATE TRIGGER m02_job_supersessions_immutable
BEFORE UPDATE OR DELETE ON m02_job_supersessions
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();

CREATE TRIGGER m02_audit_events_append_only
BEFORE UPDATE OR DELETE ON m02_audit_events
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();

CREATE TRIGGER manual_resolution_commands_immutable
BEFORE UPDATE OR DELETE ON manual_resolution_commands
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();

CREATE TRIGGER m02_manual_command_results_immutable
BEFORE UPDATE OR DELETE ON m02_manual_command_results
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();

CREATE TRIGGER repository_candidate_root_order_immutable
BEFORE UPDATE OR DELETE ON repository_candidate_root_order
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();
CREATE TRIGGER m02_root_replacements_immutable
BEFORE UPDATE OR DELETE ON m02_root_replacements
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();
CREATE TRIGGER m02_candidate_replacements_immutable
BEFORE UPDATE OR DELETE ON m02_candidate_replacements
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();
CREATE TRIGGER m02_ownership_replacements_immutable
BEFORE UPDATE OR DELETE ON m02_ownership_replacements
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();
CREATE TRIGGER m02_group_edge_replacements_immutable
BEFORE UPDATE OR DELETE ON m02_group_edge_replacements
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();

CREATE TRIGGER m02_rejected_command_audits_append_only
BEFORE UPDATE OR DELETE ON m02_rejected_command_audits
FOR EACH ROW EXECUTE FUNCTION reject_m02_history_mutation();

CREATE FUNCTION reject_m02_job_supersession_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE successors(job_id) AS (
      SELECT NEW.replacement_job_id
      UNION
      SELECT edge.replacement_job_id
      FROM m02_job_supersessions edge JOIN successors current ON edge.source_job_id = current.job_id
    )
    SELECT 1 FROM successors WHERE job_id = NEW.source_job_id
  ) THEN
    RAISE EXCEPTION 'M02_JOB_SUPERSESSION_CYCLE';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER m02_job_supersession_cycle_guard
BEFORE INSERT OR UPDATE ON m02_job_supersessions
FOR EACH ROW EXECUTE FUNCTION reject_m02_job_supersession_cycle();

CREATE FUNCTION reject_m02_fork_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (
    SELECT fork.resource_identity_id = origin.resource_identity_id
    FROM resource_version_identities fork, resource_version_identities origin
    WHERE fork.id = NEW.fork_resource_version_id AND origin.id = NEW.origin_resource_version_id
  ) THEN
    RAISE EXCEPTION 'FORK_REQUIRES_DISTINCT_RESOURCES';
  END IF;
  IF EXISTS (
    WITH RECURSIVE lineage(version_id) AS (
      SELECT NEW.origin_resource_version_id
      UNION
      SELECT f.origin_resource_version_id
      FROM fork_relationships f JOIN lineage l ON f.fork_resource_version_id = l.version_id
      WHERE f.state = 'ACTIVE'
    )
    SELECT 1 FROM lineage WHERE version_id = NEW.fork_resource_version_id
  ) THEN
    RAISE EXCEPTION 'FORK_LINEAGE_CYCLE';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER fork_relationship_cycle_guard
BEFORE INSERT OR UPDATE ON fork_relationships
FOR EACH ROW WHEN (NEW.state = 'ACTIVE') EXECUTE FUNCTION reject_m02_fork_cycle();

CREATE FUNCTION reject_m02_mirror_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE lineage(repository_id) AS (
      SELECT NEW.origin_source_repository_id
      UNION
      SELECT r.origin_source_repository_id
      FROM source_repository_relationships r JOIN lineage l ON r.mirror_source_repository_id = l.repository_id
      WHERE r.state = 'ACTIVE'
    )
    SELECT 1 FROM lineage WHERE repository_id = NEW.mirror_source_repository_id
  ) THEN
    RAISE EXCEPTION 'MIRROR_LINEAGE_CYCLE';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER source_repository_relationship_cycle_guard
BEFORE INSERT OR UPDATE ON source_repository_relationships
FOR EACH ROW WHEN (NEW.state = 'ACTIVE') EXECUTE FUNCTION reject_m02_mirror_cycle();
