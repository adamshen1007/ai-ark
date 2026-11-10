DO $m05_role_prerequisites$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ai_ark_m05_writer' AND NOT rolcanlogin)
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='<M05_LOGIN>' AND rolcanlogin)
    OR NOT pg_has_role('<M05_LOGIN>', 'ai_ark_m05_writer', 'MEMBER')
  THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='M05_ROLE_PREREQUISITE_INVALID';
  END IF;
END;
$m05_role_prerequisites$;

CREATE SCHEMA ai_ark_m05;
REVOKE ALL ON SCHEMA ai_ark_m05 FROM PUBLIC, ai_ark_m05_writer;
GRANT USAGE ON SCHEMA ai_ark_m05 TO ai_ark_m05_writer;

CREATE TABLE ai_ark_m05.inputs (
  input_fingerprint text COLLATE "C" PRIMARY KEY CHECK (input_fingerprint ~ '^[0-9a-f]{64}$'),
  source_fingerprint text COLLATE "C" NOT NULL CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'),
  policy_fingerprint text COLLATE "C" NOT NULL CHECK (policy_fingerprint ~ '^[0-9a-f]{64}$'),
  binding_id text COLLATE "C" NOT NULL CHECK (binding_id ~ '^bnd_[0-9a-f]{64}$'),
  extraction_id text COLLATE "C" NOT NULL CHECK (extraction_id ~ '^ext_[0-9a-f]{64}$'),
  byte_length bigint NOT NULL CHECK (byte_length BETWEEN 1 AND 268435456),
  chunk_count integer NOT NULL CHECK (chunk_count BETWEEN 1 AND 4096 AND chunk_count=((byte_length+65535)/65536)),
  canonical_manifest bytea NOT NULL CHECK (octet_length(canonical_manifest) BETWEEN 1 AND 1048576),
  manifest_sha256 text COLLATE "C" NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE TABLE ai_ark_m05.input_chunks (
  input_fingerprint text COLLATE "C" NOT NULL REFERENCES ai_ark_m05.inputs(input_fingerprint),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  payload bytea NOT NULL CHECK (octet_length(payload) BETWEEN 1 AND 65536),
  payload_sha256 text COLLATE "C" NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY (input_fingerprint, ordinal)
);

CREATE TABLE ai_ark_m05.revisions (
  revision_id text COLLATE "C" PRIMARY KEY CHECK (revision_id ~ '^drv_[0-9a-f]{64}$'),
  generation_fingerprint text COLLATE "C" NOT NULL UNIQUE CHECK (generation_fingerprint ~ '^[0-9a-f]{64}$'),
  input_fingerprint text COLLATE "C" NOT NULL REFERENCES ai_ark_m05.inputs(input_fingerprint),
  output_fingerprint text COLLATE "C" NOT NULL CHECK (output_fingerprint ~ '^[0-9a-f]{64}$'),
  record_fingerprint text COLLATE "C" NOT NULL UNIQUE CHECK (record_fingerprint ~ '^[0-9a-f]{64}$'),
  canonical_payload bytea NOT NULL CHECK (octet_length(canonical_payload) BETWEEN 1 AND 268435456),
  UNIQUE (generation_fingerprint, revision_id)
);

CREATE TABLE ai_ark_m05.requests (
  encoded_key text COLLATE "C" PRIMARY KEY CHECK (encoded_key ~ '^(?:[0-9a-f]{2}){1,200}$'),
  request_fingerprint text COLLATE "C" NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  semantic_request_fingerprint text COLLATE "C" NOT NULL CHECK (semantic_request_fingerprint ~ '^[0-9a-f]{64}$'),
  canonical_request bytea NOT NULL CHECK (octet_length(canonical_request) BETWEEN 1 AND 16384),
  generation_fingerprint text COLLATE "C" NOT NULL,
  revision_id text COLLATE "C" NOT NULL,
  canonical_result bytea NOT NULL CHECK (octet_length(canonical_result) BETWEEN 1 AND 65536),
  result_sha256 text COLLATE "C" NOT NULL CHECK (result_sha256 ~ '^[0-9a-f]{64}$'),
  FOREIGN KEY (generation_fingerprint,revision_id)
    REFERENCES ai_ark_m05.revisions(generation_fingerprint,revision_id)
);
CREATE INDEX requests_semantic_request_fingerprint_idx
  ON ai_ark_m05.requests (semantic_request_fingerprint COLLATE "C");

CREATE FUNCTION ai_ark_m05.m05_reject_immutable_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='M05_IMMUTABLE_RECORD';
END;
$$;

CREATE FUNCTION ai_ark_m05.m05_validate_input_closure() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE target text; parent record; chunks record; manifest json;
BEGIN
  target := CASE WHEN TG_TABLE_NAME='inputs' THEN NEW.input_fingerprint ELSE NEW.input_fingerprint END;
  SELECT * INTO parent FROM ai_ark_m05.inputs WHERE input_fingerprint=target;
  SELECT count(*) count_value,min(ordinal) min_ordinal,max(ordinal) max_ordinal,
         sum(octet_length(payload)) total_bytes,
         bool_and(encode(sha256(payload),'hex')=payload_sha256) hashes_valid,
         string_agg(payload,''::bytea ORDER BY ordinal) full_payload
    INTO chunks FROM ai_ark_m05.input_chunks WHERE input_fingerprint=target;
  manifest := convert_from(parent.canonical_manifest,'UTF8')::json;
  IF parent.input_fingerprint IS NULL OR chunks.count_value<>parent.chunk_count
    OR chunks.min_ordinal<>0 OR chunks.max_ordinal<>parent.chunk_count-1
    OR chunks.total_bytes<>parent.byte_length OR NOT chunks.hashes_valid
    OR encode(sha256(chunks.full_payload),'hex') IS DISTINCT FROM
       (manifest->>'payloadSha256')
    OR encode(sha256(parent.canonical_manifest),'hex')<>parent.manifest_sha256
    OR (manifest->>'schemaVersion') IS DISTINCT FROM 'M05_INPUT_MANIFEST_V1'
    OR (manifest->>'inputFingerprint') IS DISTINCT FROM parent.input_fingerprint
    OR (manifest->>'sourceFingerprint') IS DISTINCT FROM parent.source_fingerprint
    OR (manifest->>'policyFingerprint') IS DISTINCT FROM parent.policy_fingerprint
    OR ((manifest->>'byteLength')::bigint) IS DISTINCT FROM parent.byte_length
    OR ((manifest->>'chunkCount')::integer) IS DISTINCT FROM parent.chunk_count
    OR json_array_length(manifest->'chunkHashes') IS DISTINCT FROM parent.chunk_count
    OR EXISTS (SELECT 1 FROM ai_ark_m05.input_chunks c WHERE c.input_fingerprint=target
               AND c.ordinal<parent.chunk_count-1 AND octet_length(c.payload)<>65536)
    OR NOT EXISTS (
      SELECT 1 FROM ai_ark_m05.revisions r
      JOIN ai_ark_m05.requests q
        ON q.generation_fingerprint=r.generation_fingerprint AND q.revision_id=r.revision_id
      WHERE r.input_fingerprint=target)
  THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='M05_INPUT_CLOSURE_INVALID'; END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION ai_ark_m05.m05_validate_revision_closure() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE raw_payload text; safe_payload text; payload jsonb; parent record; root_keys text[];
BEGIN
  raw_payload := convert_from(NEW.canonical_payload,'UTF8');
  IF raw_payload ~ '(?<!\\)(?:\\\\)*\\u[eE]00[01]'
  THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='M05_REVISION_SENTINEL_ESCAPE_INVALID'; END IF;
  safe_payload := regexp_replace(
    replace(raw_payload,chr(57344),chr(57344)||chr(57345)),
    '(?<!\\)((?:\\\\)*)\\u0000','\1'||chr(57344)||chr(57344),'g');
  payload := safe_payload::jsonb;
  SELECT array_agg(key ORDER BY ordinal) INTO root_keys
    FROM json_each(safe_payload::json) WITH ORDINALITY AS member(key,value,ordinal);
  SELECT * INTO parent FROM ai_ark_m05.inputs WHERE input_fingerprint=NEW.input_fingerprint;
  IF root_keys IS DISTINCT FROM ARRAY['bindingId','extractionId','generatedAt',
       'generationFingerprint','inputFingerprint','label','metrics','mode','outputFingerprint',
       'policyFingerprint','provenanceIndex','recordFingerprint','regenerationToken','revisionId',
       'schemaVersion','sections','sourceFingerprint','state']
    OR payload->>'schemaVersion' IS DISTINCT FROM 'M05_DRAFT_REVISION_V1'
    OR payload->>'revisionId' IS DISTINCT FROM NEW.revision_id
    OR payload->>'generationFingerprint' IS DISTINCT FROM NEW.generation_fingerprint
    OR payload->>'inputFingerprint' IS DISTINCT FROM NEW.input_fingerprint
    OR payload->>'outputFingerprint' IS DISTINCT FROM NEW.output_fingerprint
    OR payload->>'recordFingerprint' IS DISTINCT FROM NEW.record_fingerprint
    OR parent.input_fingerprint IS NULL
    OR payload->>'bindingId' IS DISTINCT FROM parent.binding_id
    OR payload->>'extractionId' IS DISTINCT FROM parent.extraction_id
    OR payload->>'sourceFingerprint' IS DISTINCT FROM parent.source_fingerprint
    OR payload->>'policyFingerprint' IS DISTINCT FROM parent.policy_fingerprint
    OR NOT EXISTS (
      SELECT 1 FROM ai_ark_m05.requests q
      WHERE q.generation_fingerprint=NEW.generation_fingerprint
        AND q.revision_id=NEW.revision_id)
  THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='M05_REVISION_CLOSURE_INVALID'; END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION ai_ark_m05.m05_validate_input_chunk() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE parent record; expected_hash text;
BEGIN
  SELECT * INTO parent FROM ai_ark_m05.inputs WHERE input_fingerprint=NEW.input_fingerprint;
  expected_hash := convert_from(parent.canonical_manifest,'UTF8')::jsonb
    ->'chunkHashes'->>NEW.ordinal;
  IF parent.input_fingerprint IS NULL OR NEW.ordinal>=parent.chunk_count
    OR (NEW.ordinal<parent.chunk_count-1 AND octet_length(NEW.payload)<>65536)
    OR encode(sha256(NEW.payload),'hex')<>NEW.payload_sha256
    OR expected_hash IS NULL OR expected_hash<>NEW.payload_sha256
  THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='M05_INPUT_CHUNK_INVALID'; END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION ai_ark_m05.m05_validate_request_closure() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE raw_request text; raw_result text; raw_revision text;
        safe_request text; safe_result text; safe_revision text;
        request_payload jsonb; result_payload jsonb; revision_payload jsonb;
        request_keys text[]; result_keys text[]; semantic_request text;
BEGIN
  raw_request := convert_from(NEW.canonical_request,'UTF8');
  raw_result := convert_from(NEW.canonical_result,'UTF8');
  SELECT convert_from(r.canonical_payload,'UTF8') INTO raw_revision
    FROM ai_ark_m05.revisions r
   WHERE r.generation_fingerprint=NEW.generation_fingerprint AND r.revision_id=NEW.revision_id;
  IF raw_request ~ '(?<!\\)(?:\\\\)*\\u[eE]00[01]'
    OR raw_result ~ '(?<!\\)(?:\\\\)*\\u[eE]00[01]'
    OR raw_revision ~ '(?<!\\)(?:\\\\)*\\u[eE]00[01]'
  THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='M05_REQUEST_SENTINEL_ESCAPE_INVALID'; END IF;
  safe_request := regexp_replace(
    replace(raw_request,chr(57344),chr(57344)||chr(57345)),
    '(?<!\\)((?:\\\\)*)\\u0000','\1'||chr(57344)||chr(57344),'g');
  safe_result := regexp_replace(
    replace(raw_result,chr(57344),chr(57344)||chr(57345)),
    '(?<!\\)((?:\\\\)*)\\u0000','\1'||chr(57344)||chr(57344),'g');
  safe_revision := regexp_replace(
    replace(raw_revision,chr(57344),chr(57344)||chr(57345)),
    '(?<!\\)((?:\\\\)*)\\u0000','\1'||chr(57344)||chr(57344),'g');
  request_payload := safe_request::jsonb;
  result_payload := safe_result::jsonb;
  revision_payload := safe_revision::jsonb;
  SELECT array_agg(key ORDER BY ordinal),
         '{'||string_agg(to_jsonb(key)::text||':'||value::text,',' ORDER BY ordinal)
           FILTER (WHERE key<>'idempotencyKey')||'}'
    INTO request_keys,semantic_request
    FROM json_each(safe_request::json) WITH ORDINALITY AS member(key,value,ordinal);
  SELECT array_agg(key ORDER BY ordinal) INTO result_keys
    FROM json_each(safe_result::json) WITH ORDINALITY AS member(key,value,ordinal);
  IF encode(sha256(NEW.canonical_request),'hex')<>NEW.request_fingerprint
    OR encode(sha256(NEW.canonical_result),'hex')<>NEW.result_sha256
    OR encode(sha256(convert_to(replace(replace(semantic_request,
         chr(57344)||chr(57344),chr(92)||'u0000'),
         chr(57344)||chr(57345),chr(57344)),'UTF8')),'hex')
       IS DISTINCT FROM NEW.semantic_request_fingerprint
    OR request_keys IS DISTINCT FROM ARRAY['bindingId','expectedBindingFingerprint','extractionId',
       'idempotencyKey','methodologyVersion','mode','policyVersion','promptBundleVersion',
       'providerConfigIdOrNull','regenerationToken','schemaVersion']
    OR result_keys IS DISTINCT FROM ARRAY['inputFingerprint','kind','outputFingerprint',
       'recordFingerprint','replayed','revisionId','schemaVersion']
    OR replace(replace(encode(convert_to(request_payload->>'idempotencyKey','UTF8'),'hex'),
       'ee8080ee8080','00'),'ee8080ee8081','ee8080') IS DISTINCT FROM NEW.encoded_key
    OR request_payload->>'schemaVersion' IS DISTINCT FROM 'M05_GENERATE_DRAFT_REQUEST_V1'
    OR request_payload->>'bindingId' IS DISTINCT FROM revision_payload->>'bindingId'
    OR request_payload->>'extractionId' IS DISTINCT FROM revision_payload->>'extractionId'
    OR request_payload->>'expectedBindingFingerprint' IS DISTINCT FROM right(request_payload->>'bindingId',64)
    OR request_payload->>'mode' IS DISTINCT FROM revision_payload->>'mode'
    OR request_payload->'regenerationToken' IS DISTINCT FROM revision_payload->'regenerationToken'
    OR result_payload->>'schemaVersion' IS DISTINCT FROM 'M05_GENERATE_DRAFT_RESULT_V1'
    OR result_payload->>'kind' IS DISTINCT FROM 'ACCEPTED'
    OR result_payload->>'revisionId' IS DISTINCT FROM NEW.revision_id
    OR result_payload->>'inputFingerprint' IS DISTINCT FROM revision_payload->>'inputFingerprint'
    OR result_payload->>'outputFingerprint' IS DISTINCT FROM revision_payload->>'outputFingerprint'
    OR result_payload->>'recordFingerprint' IS DISTINCT FROM revision_payload->>'recordFingerprint'
    OR result_payload->>'replayed' IS DISTINCT FROM 'false'
  THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='M05_REQUEST_CLOSURE_INVALID'; END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER inputs_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON ai_ark_m05.inputs FOR EACH STATEMENT EXECUTE FUNCTION ai_ark_m05.m05_reject_immutable_mutation();
CREATE TRIGGER input_chunks_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON ai_ark_m05.input_chunks FOR EACH STATEMENT EXECUTE FUNCTION ai_ark_m05.m05_reject_immutable_mutation();
CREATE TRIGGER revisions_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON ai_ark_m05.revisions FOR EACH STATEMENT EXECUTE FUNCTION ai_ark_m05.m05_reject_immutable_mutation();
CREATE TRIGGER requests_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON ai_ark_m05.requests FOR EACH STATEMENT EXECUTE FUNCTION ai_ark_m05.m05_reject_immutable_mutation();
CREATE TRIGGER input_chunks_validate BEFORE INSERT ON ai_ark_m05.input_chunks FOR EACH ROW EXECUTE FUNCTION ai_ark_m05.m05_validate_input_chunk();
CREATE CONSTRAINT TRIGGER inputs_closure AFTER INSERT ON ai_ark_m05.inputs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ai_ark_m05.m05_validate_input_closure();
CREATE CONSTRAINT TRIGGER revisions_closure AFTER INSERT ON ai_ark_m05.revisions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ai_ark_m05.m05_validate_revision_closure();
CREATE CONSTRAINT TRIGGER requests_closure AFTER INSERT ON ai_ark_m05.requests DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ai_ark_m05.m05_validate_request_closure();

REVOKE ALL ON ALL TABLES IN SCHEMA ai_ark_m05 FROM PUBLIC, ai_ark_m05_writer;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ai_ark_m05 FROM PUBLIC, ai_ark_m05_writer;
<M05_RUNTIME_GRANTS>
