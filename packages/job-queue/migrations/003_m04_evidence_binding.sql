CREATE FUNCTION m04_canonical_json(value jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE ordinary_result text;
BEGIN
  CASE jsonb_typeof(value)
    WHEN 'null' THEN RETURN 'null';
    WHEN 'boolean' THEN RETURN value::text;
    WHEN 'number' THEN RETURN value::text;
    WHEN 'string' THEN RETURN to_jsonb(value #>> '{}')::text;
    WHEN 'array' THEN
      SELECT '[' || coalesce(string_agg(<S>.m04_canonical_json(item), ',' ORDER BY ordinal), '') || ']'
        INTO ordinary_result FROM jsonb_array_elements(value) WITH ORDINALITY AS element(item, ordinal);
      RETURN ordinary_result;
    WHEN 'object' THEN
      SELECT '{' || coalesce(string_agg(to_jsonb(key)::text || ':' || <S>.m04_canonical_json(item),
        ',' ORDER BY convert_to(key, 'UTF8')), '') || '}'
        INTO ordinary_result FROM jsonb_each(value) AS member(key, item);
      RETURN ordinary_result;
    ELSE RAISE EXCEPTION 'unsupported ordinary value';
  END CASE;
END;
$$;

CREATE FUNCTION m04_payload_is_canonical_json(payload bytea) RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  raw_text text;
  total_length integer := octet_length(payload);
  tokenized_length bigint := 0;
  token_match text[];
  token text;
  token_ordinal bigint;
  previous_token text;
  string_value text;
  escape_remainder text;
  string_has_escape boolean;
  key_bytes bytea;
  key_cursor integer;
  byte_value integer;
  escape_value integer;
  codepoint integer;
  unicode_hex text;
  string_bytes bytea;
  key_hex text;
  previous_key_hex text[] := ARRAY[]::text[];
  container_types text[] := ARRAY[]::text[];
  nesting integer := 0;
  number_token text;
  canonical_number text;
  fast_value jsonb;
  fast_claim_id text;
  fast_evidence_id text;
  fast_id text;
  fast_source_reference_id text;
  fast_ordinal text;
  fast_fingerprint text;
  fast_relationship text;
  fast_expected text;
BEGIN
  raw_text := convert_from(payload, 'UTF8');
  -- A fixed, unescaped ASCII Link can be reconstructed byte-for-byte without
  -- the general token walk. This branch is deliberately narrow: nonmatches
  -- retain the complete grammar and number validator below.
  IF total_length < 1024 AND octet_length(raw_text) = length(raw_text)
    AND strpos(raw_text, chr(92)) = 0
    AND left(raw_text, 16) = '{"claimId":"clm_'
    AND right(raw_text, length('","schemaVersion":"M04_CLAIM_EVIDENCE_LINK_V1"}'))
      = '","schemaVersion":"M04_CLAIM_EVIDENCE_LINK_V1"}'
  THEN
    fast_value := raw_text::jsonb;
    fast_claim_id := fast_value->>'claimId';
    fast_evidence_id := fast_value->>'evidenceItemId';
    fast_id := fast_value->>'id';
    fast_source_reference_id := fast_value->>'m03SourceReferenceId';
    fast_ordinal := fast_value->>'ordinal';
    fast_fingerprint := fast_value->>'recordFingerprint';
    fast_relationship := fast_value->>'relationship';
    IF length(fast_claim_id) = 68 AND left(fast_claim_id, 4) = 'clm_'
      AND translate(substr(fast_claim_id, 5), '0123456789abcdef', '') = ''
      AND length(fast_evidence_id) = 68 AND left(fast_evidence_id, 4) = 'evi_'
      AND translate(substr(fast_evidence_id, 5), '0123456789abcdef', '') = ''
      AND length(fast_id) = 68 AND left(fast_id, 4) = 'cel_'
      AND translate(substr(fast_id, 5), '0123456789abcdef', '') = ''
      AND length(fast_source_reference_id) = 68 AND left(fast_source_reference_id, 4) = 'src_'
      AND translate(substr(fast_source_reference_id, 5), '0123456789abcdef', '') = ''
      AND jsonb_typeof(fast_value->'ordinal') = 'number'
      AND (fast_ordinal = '0' OR (length(fast_ordinal) BETWEEN 1 AND 9
        AND left(fast_ordinal, 1) BETWEEN '1' AND '9'
        AND translate(fast_ordinal, '0123456789', '') = ''))
      AND length(fast_fingerprint) = 64
      AND translate(fast_fingerprint, '0123456789abcdef', '') = ''
      AND fast_relationship IN ('SUPPORTS', 'QUALIFIES', 'CONTEXT_ONLY')
      AND fast_value->>'schemaVersion' = 'M04_CLAIM_EVIDENCE_LINK_V1'
    THEN
      fast_expected := '{"claimId":"'||fast_claim_id||'","evidenceItemId":"'||fast_evidence_id
        ||'","id":"'||fast_id||'","m03SourceReferenceId":"'||fast_source_reference_id
        ||'","ordinal":'||fast_ordinal||',"recordFingerprint":"'||fast_fingerprint
        ||'","relationship":"'||fast_relationship
        ||'","schemaVersion":"M04_CLAIM_EVIDENCE_LINK_V1"}';
      IF raw_text = fast_expected THEN RETURN true; END IF;
    END IF;
  END IF;
  -- The fixed-shape branch above cannot accept a noncanonical JSON spelling;
  -- all other inputs still use the general grammar oracle before tokenization.
  PERFORM raw_text::json;
  FOR token_match, token_ordinal IN
    SELECT matched, ordinality
      FROM regexp_matches(raw_text,
        $token$"(?:[^"\\]|\\.)*"|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|[{}\[\],:]|true|false|null|[ \t\n\r]+$token$, 'g')
        WITH ORDINALITY AS tokens(matched, ordinality)
      ORDER BY ordinality
  LOOP
    token := token_match[1];
    tokenized_length := tokenized_length + octet_length(token);
    IF token ~ '^[ \t\n\r]+$' THEN RETURN false; END IF;
    IF token = '{' OR token = '[' THEN
      nesting := nesting + 1;
      container_types[nesting] := CASE WHEN token = '{' THEN 'object' ELSE 'array' END;
      previous_key_hex[nesting] := NULL;
    ELSIF token = '}' OR token = ']' THEN
      nesting := nesting - 1;
    ELSIF left(token, 1) = '"' THEN
      string_value := substr(token, 2, length(token) - 2);
      string_has_escape := strpos(string_value, chr(92)) > 0;
      IF string_has_escape THEN
        escape_remainder := regexp_replace(string_value,
          $escape$\\(?:"|\\|[bfnrt]|u00(?:0[0-7bef]|1[0-9a-f]))$escape$, '', 'g');
        IF strpos(escape_remainder, chr(92)) > 0 THEN RETURN false; END IF;
      END IF;
      IF nesting >= 1 AND container_types[nesting] = 'object'
        AND previous_token IN ('{', ',') THEN
        IF NOT string_has_escape THEN
          key_hex := encode(convert_to(string_value, 'UTF8'), 'hex');
        ELSE
          key_bytes := convert_to(string_value, 'UTF8');
          string_bytes := ''::bytea;
          key_cursor := 0;
          WHILE key_cursor < octet_length(key_bytes) LOOP
            byte_value := get_byte(key_bytes, key_cursor);
            IF byte_value = 92 THEN
              key_cursor := key_cursor + 1;
              escape_value := get_byte(key_bytes, key_cursor);
              CASE escape_value
                WHEN 34 THEN string_bytes := string_bytes || decode('22','hex');
                WHEN 92 THEN string_bytes := string_bytes || decode('5c','hex');
                WHEN 98 THEN string_bytes := string_bytes || decode('08','hex');
                WHEN 102 THEN string_bytes := string_bytes || decode('0c','hex');
                WHEN 110 THEN string_bytes := string_bytes || decode('0a','hex');
                WHEN 114 THEN string_bytes := string_bytes || decode('0d','hex');
                WHEN 116 THEN string_bytes := string_bytes || decode('09','hex');
                WHEN 117 THEN
                  unicode_hex := convert_from(substring(key_bytes from key_cursor + 2 for 4),
                    'UTF8');
                  codepoint := get_byte(decode(substr(unicode_hex, 3, 2), 'hex'), 0);
                  string_bytes := string_bytes || set_byte(decode('00','hex'), 0, codepoint);
                  key_cursor := key_cursor + 4;
              END CASE;
            ELSE
              string_bytes := string_bytes || substring(key_bytes from key_cursor + 1 for 1);
            END IF;
            key_cursor := key_cursor + 1;
          END LOOP;
          key_hex := encode(string_bytes, 'hex');
        END IF;
        IF previous_key_hex[nesting] IS NOT NULL AND
          key_hex COLLATE "C" <= previous_key_hex[nesting] COLLATE "C" THEN RETURN false; END IF;
        previous_key_hex[nesting] := key_hex;
      END IF;
    ELSIF token ~ '^-?[0-9]' THEN
      number_token := token;
      <<numeric_block>>
      DECLARE
  bits bytea;
  number_parts text[];
  input_coefficient numeric;
  input_decimal_exponent integer;
  token_is_negative boolean;
  hint_pattern bigint;
  candidate_pattern bigint;
  resolved_pattern bigint;
  fallback_floor bigint;
  search_low bigint;
  search_high bigint;
  search_mid bigint;
  fallback_computed boolean := false;
  fallback_try_upper boolean := false;
  pattern_member boolean;
  byte_index integer;
  exponent_bits integer;
  fraction_bits bigint;
  mantissa bigint;
  binary_exponent integer;
  neighbor_pattern bigint;
  neighbor_exponent_bits integer;
  neighbor_fraction_bits bigint;
  neighbor_mantissa bigint;
  neighbor_binary_exponent integer;
  lower_coefficient numeric;
  lower_binary_exponent integer;
  upper_coefficient numeric;
  upper_binary_exponent integer;
  lower_comparison integer;
  upper_comparison integer;
  target_is_even boolean;
  common_two_exponent integer;
  common_five_exponent integer;
  left_scaled numeric;
  right_scaled numeric;
  coefficient numeric;
  coefficient_digits text;
  decimal_scale integer;
  decimal_exponent integer;
  significant_digits integer;
  token_exponent integer;
  base_candidate numeric;
  candidate numeric;
  interval_scale integer;
  scale_power_five numeric;
  lower_scaled numeric;
  upper_scaled numeric;
  exact_scaled numeric;
  candidate_scaled numeric;
  candidate_scale_factor numeric;
  distance numeric;
  best_distance numeric;
  best_candidate numeric;
  selected_candidate numeric;
  selected_exponent integer;
  selected_digits text;
  point_position integer;
  first_exponent integer;
  result text;
  is_negative boolean;
      BEGIN
  -- Every integer in this conservative range is exactly representable in
  -- binary64 and JSON.stringify emits these same decimal digits. This is a
  -- lexical fast path only: all other tokens retain the full number validation.
  IF number_token ~ '^(0|[1-9][0-9]{0,8})$' THEN
    canonical_number := number_token;
    EXIT numeric_block;
  END IF;

  -- Canonical JavaScript finite-number spellings are at most 25 bytes. Bound
  -- all exact-integer work before parsing a hostile alternative spelling.
  IF length(number_token) > 25 THEN RAISE EXCEPTION 'oversized number token'; END IF;
  number_parts := regexp_match(number_token,
    '^(-?)(0|[1-9][0-9]*)(\.([0-9]+))?([eE]([+-]?[0-9]+))?$');
  IF number_parts IS NULL THEN RAISE EXCEPTION 'invalid number token'; END IF;
  token_is_negative := number_parts[1] = '-';
  input_coefficient := (number_parts[2] || coalesce(number_parts[4], ''))::numeric;
  input_decimal_exponent := coalesce(number_parts[6], '0')::integer -
    length(coalesce(number_parts[4], ''));
  is_negative := token_is_negative;
  IF input_coefficient = 0 THEN canonical_number := '0'; EXIT numeric_block; END IF;
  IF input_decimal_exponent NOT BETWEEN -324 AND 308 THEN
    RAISE EXCEPTION 'number exponent outside finite canonical range';
  END IF;

  -- The platform strtod result is only a hint. It becomes authoritative only
  -- after exact interval certification below; parser disagreement falls back
  -- to a bounded monotonic search over all positive finite binary64 patterns.
  hint_pattern := NULL;
  BEGIN
    bits := pg_catalog.float8send(number_token::float8);
    hint_pattern := (get_byte(bits, 0) & 127)::bigint;
    FOR byte_index IN 1..7 LOOP
      hint_pattern := hint_pattern * 256 + get_byte(bits, byte_index);
    END LOOP;
    IF hint_pattern >= 9218868437227405312 THEN hint_pattern := NULL; END IF;
  EXCEPTION WHEN OTHERS THEN
    hint_pattern := NULL;
  END;
  candidate_pattern := hint_pattern;

  LOOP
    IF candidate_pattern IS NULL THEN
      search_low := 0;
      search_high := 9218868437227405311;
      FOR significant_digits IN 1..63 LOOP
        EXIT WHEN search_low >= search_high;
        search_mid := search_low + (search_high - search_low + 1) / 2;
        exponent_bits := (search_mid >> 52)::integer;
        fraction_bits := search_mid & 4503599627370495;
        IF exponent_bits = 0 THEN
          mantissa := fraction_bits;
          binary_exponent := -1074;
        ELSE
          mantissa := 4503599627370496 + fraction_bits;
          binary_exponent := exponent_bits - 1023 - 52;
        END IF;
        common_two_exponent := least(input_decimal_exponent, binary_exponent);
        common_five_exponent := least(input_decimal_exponent, 0);
        left_scaled := input_coefficient *
          power(2::numeric, input_decimal_exponent - common_two_exponent) *
          power(5::numeric, input_decimal_exponent - common_five_exponent);
        right_scaled := mantissa::numeric *
          power(2::numeric, binary_exponent - common_two_exponent) *
          power(5::numeric, -common_five_exponent);
        IF left_scaled >= right_scaled THEN search_low := search_mid;
        ELSE search_high := search_mid - 1;
        END IF;
      END LOOP;
      fallback_floor := search_low;
      fallback_computed := true;
      fallback_try_upper := false;
      candidate_pattern := fallback_floor;
    END IF;

    -- Derive the exact rounding interval from adjacent dyadic values. Natural
    -- neighbor spacing handles subnormals, min-normal, and asymmetric normal
    -- powers of two. The max-finite successor is the exact value 2^1024.
    IF candidate_pattern = 0 THEN
      mantissa := 0;
      binary_exponent := -1074;
      target_is_even := true;
      lower_coefficient := 0;
      lower_binary_exponent := -1075;
      upper_coefficient := 1;
      upper_binary_exponent := -1075;
      lower_comparison := 1;
    ELSE
      exponent_bits := (candidate_pattern >> 52)::integer;
      fraction_bits := candidate_pattern & 4503599627370495;
      IF exponent_bits = 0 THEN
        mantissa := fraction_bits;
        binary_exponent := -1074;
      ELSE
        mantissa := 4503599627370496 + fraction_bits;
        binary_exponent := exponent_bits - 1023 - 52;
      END IF;
      target_is_even := mod(mantissa, 2) = 0;

      neighbor_pattern := candidate_pattern - 1;
      IF neighbor_pattern = 0 THEN
        neighbor_mantissa := 0;
        neighbor_binary_exponent := binary_exponent;
      ELSE
        neighbor_exponent_bits := (neighbor_pattern >> 52)::integer;
        neighbor_fraction_bits := neighbor_pattern & 4503599627370495;
        IF neighbor_exponent_bits = 0 THEN
          neighbor_mantissa := neighbor_fraction_bits;
          neighbor_binary_exponent := -1074;
        ELSE
          neighbor_mantissa := 4503599627370496 + neighbor_fraction_bits;
          neighbor_binary_exponent := neighbor_exponent_bits - 1023 - 52;
        END IF;
      END IF;
      lower_binary_exponent := least(binary_exponent, neighbor_binary_exponent) - 1;
      lower_coefficient := mantissa::numeric *
          power(2::numeric, binary_exponent - lower_binary_exponent - 1) +
        neighbor_mantissa::numeric *
          power(2::numeric, neighbor_binary_exponent - lower_binary_exponent - 1);

      common_two_exponent := least(input_decimal_exponent, lower_binary_exponent);
      common_five_exponent := least(input_decimal_exponent, 0);
      left_scaled := input_coefficient *
        power(2::numeric, input_decimal_exponent - common_two_exponent) *
        power(5::numeric, input_decimal_exponent - common_five_exponent);
      right_scaled := lower_coefficient *
        power(2::numeric, lower_binary_exponent - common_two_exponent) *
        power(5::numeric, -common_five_exponent);
      lower_comparison := CASE WHEN left_scaled < right_scaled THEN -1
        WHEN left_scaled > right_scaled THEN 1 ELSE 0 END;

      neighbor_pattern := candidate_pattern + 1;
      IF candidate_pattern = 9218868437227405311 THEN
        neighbor_mantissa := 1;
        neighbor_binary_exponent := 1024;
      ELSE
        neighbor_exponent_bits := (neighbor_pattern >> 52)::integer;
        neighbor_fraction_bits := neighbor_pattern & 4503599627370495;
        IF neighbor_exponent_bits = 0 THEN
          neighbor_mantissa := neighbor_fraction_bits;
          neighbor_binary_exponent := -1074;
        ELSE
          neighbor_mantissa := 4503599627370496 + neighbor_fraction_bits;
          neighbor_binary_exponent := neighbor_exponent_bits - 1023 - 52;
        END IF;
      END IF;
      upper_binary_exponent := least(binary_exponent, neighbor_binary_exponent) - 1;
      upper_coefficient := mantissa::numeric *
          power(2::numeric, binary_exponent - upper_binary_exponent - 1) +
        neighbor_mantissa::numeric *
          power(2::numeric, neighbor_binary_exponent - upper_binary_exponent - 1);
    END IF;

    common_two_exponent := least(input_decimal_exponent, upper_binary_exponent);
    common_five_exponent := least(input_decimal_exponent, 0);
    left_scaled := input_coefficient *
      power(2::numeric, input_decimal_exponent - common_two_exponent) *
      power(5::numeric, input_decimal_exponent - common_five_exponent);
    right_scaled := upper_coefficient *
      power(2::numeric, upper_binary_exponent - common_two_exponent) *
      power(5::numeric, -common_five_exponent);
    upper_comparison := CASE WHEN left_scaled < right_scaled THEN -1
      WHEN left_scaled > right_scaled THEN 1 ELSE 0 END;
    pattern_member := (lower_comparison > 0 OR
        (lower_comparison = 0 AND target_is_even)) AND
      (upper_comparison < 0 OR (upper_comparison = 0 AND target_is_even));
    IF pattern_member THEN
      resolved_pattern := candidate_pattern;
      EXIT;
    END IF;
    IF NOT fallback_computed THEN
      candidate_pattern := NULL;
    ELSIF NOT fallback_try_upper AND fallback_floor < 9218868437227405311 THEN
      candidate_pattern := fallback_floor + 1;
      fallback_try_upper := true;
    ELSE
      RAISE EXCEPTION 'no binary64 rounding interval contains number token';
    END IF;
  END LOOP;

  IF resolved_pattern = 0 THEN canonical_number := '0'; EXIT numeric_block; END IF;
  exponent_bits := (resolved_pattern >> 52)::integer;
  fraction_bits := resolved_pattern & 4503599627370495;
  IF exponent_bits = 0 THEN
    mantissa := fraction_bits;
    binary_exponent := -1074;
  ELSE
    mantissa := 4503599627370496 + fraction_bits;
    binary_exponent := exponent_bits - 1023 - 52;
  END IF;
  IF binary_exponent >= 0 THEN
    coefficient := mantissa::numeric * power(2::numeric, binary_exponent);
    decimal_scale := 0;
  ELSE
    coefficient := mantissa::numeric * power(5::numeric, -binary_exponent);
    decimal_scale := -binary_exponent;
  END IF;
  interval_scale := greatest(340, -lower_binary_exponent, -upper_binary_exponent,
    decimal_scale);
  scale_power_five := power(5::numeric, interval_scale);
  lower_scaled := lower_coefficient *
    power(2::numeric, lower_binary_exponent + interval_scale) * scale_power_five;
  upper_scaled := upper_coefficient *
    power(2::numeric, upper_binary_exponent + interval_scale) * scale_power_five;
  exact_scaled := coefficient * power(10::numeric, interval_scale - decimal_scale);
  coefficient_digits := trunc(coefficient)::text;
  IF coefficient_digits !~ '^[0-9]+$' THEN RAISE EXCEPTION 'noninteger coefficient %', coefficient_digits; END IF;
  decimal_exponent := length(coefficient_digits) - decimal_scale - 1;
  candidate_scale_factor := power(10::numeric, interval_scale + decimal_exponent);
  FOR significant_digits IN 1..17 LOOP
    token_exponent := decimal_exponent - significant_digits + 1;
    IF length(coefficient_digits) >= significant_digits THEN
      base_candidate := substr(coefficient_digits, 1, significant_digits)::numeric;
    ELSE
      base_candidate := (coefficient_digits || repeat('0', significant_digits - length(coefficient_digits)))::numeric;
    END IF;
    best_candidate := NULL;
    best_distance := NULL;
    FOR candidate IN SELECT base_candidate UNION ALL SELECT base_candidate + 1 LOOP
      candidate_scaled := candidate * candidate_scale_factor;
      IF NOT ((candidate_scaled > lower_scaled OR
          (candidate_scaled = lower_scaled AND target_is_even)) AND
        (candidate_scaled < upper_scaled OR
          (candidate_scaled = upper_scaled AND target_is_even))) THEN CONTINUE; END IF;
      distance := abs(exact_scaled - candidate_scaled);
      IF best_distance IS NULL OR distance < best_distance OR
        (distance = best_distance AND mod(candidate, 2) = 0 AND mod(best_candidate, 2) <> 0) THEN
        best_distance := distance;
        best_candidate := candidate;
      END IF;
    END LOOP;
    IF best_candidate IS NOT NULL THEN
      selected_candidate := best_candidate;
      selected_exponent := token_exponent;
      EXIT;
    END IF;
    candidate_scale_factor := candidate_scale_factor / 10;
  END LOOP;
  IF selected_candidate IS NULL THEN RAISE EXCEPTION 'no shortest decimal found for bits %, coefficient %, scale %', encode(bits, 'hex'), coefficient_digits, decimal_scale; END IF;
  WHILE mod(selected_candidate, 10) = 0 LOOP
    selected_candidate := trunc(selected_candidate / 10);
    selected_exponent := selected_exponent + 1;
  END LOOP;
  selected_digits := trunc(selected_candidate)::text;
  first_exponent := length(selected_digits) + selected_exponent - 1;
  IF first_exponent BETWEEN -6 AND 20 THEN
    IF selected_exponent >= 0 THEN
      result := selected_digits || repeat('0', selected_exponent);
    ELSE
      point_position := length(selected_digits) + selected_exponent;
      IF point_position > 0 THEN
        result := substr(selected_digits, 1, point_position) || '.' || substr(selected_digits, point_position + 1);
      ELSE
        result := '0.' || repeat('0', -point_position) || selected_digits;
      END IF;
    END IF;
  ELSE
    result := substr(selected_digits, 1, 1);
    IF length(selected_digits) > 1 THEN result := result || '.' || substr(selected_digits, 2); END IF;
    result := result || 'e' || CASE WHEN first_exponent >= 0 THEN '+' ELSE '' END || first_exponent::text;
  END IF;
  canonical_number := CASE WHEN is_negative THEN '-' ELSE '' END || result;
      END numeric_block;
      IF number_token <> canonical_number THEN RETURN false; END IF;
    END IF;
    previous_token := token;
  END LOOP;
  RETURN tokenized_length = total_length AND nesting = 0;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE TABLE schema_migrations (
  version text PRIMARY KEY CHECK (version ~ '^[0-9]{3}$'),
  filename text NOT NULL UNIQUE,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz NOT NULL
);

ALTER TABLE m01_source_documents
  ADD CONSTRAINT m01_source_documents_lineage_unique
  UNIQUE (id, source_entry_id, source_snapshot_id);

CREATE TABLE m03_extraction_bundles (
  extraction_id text PRIMARY KEY CHECK (extraction_id ~ '^ext_[0-9a-f]{64}$'),
  resource_identity_id text NOT NULL REFERENCES resource_identities(id) ON DELETE RESTRICT,
  resource_version_identity_id text NOT NULL REFERENCES resource_version_identities(id) ON DELETE RESTRICT,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  source_revision text NOT NULL CHECK (source_revision ~ '^[0-9a-f]{40}$'),
  m02_input_projection_fingerprint text NOT NULL
    CHECK (m02_input_projection_fingerprint ~ '^[0-9a-f]{64}$'),
  m03_input_fingerprint text NOT NULL CHECK (m03_input_fingerprint ~ '^[0-9a-f]{64}$'),
  m03_output_fingerprint text NOT NULL UNIQUE CHECK (m03_output_fingerprint ~ '^[0-9a-f]{64}$'),
  logical_payload_sha256 text NOT NULL UNIQUE CHECK (logical_payload_sha256 ~ '^[0-9a-f]{64}$'),
  canonical_payload_sha256 text NOT NULL UNIQUE CHECK (canonical_payload_sha256 ~ '^[0-9a-f]{64}$'),
  canonical_payload_byte_length bigint NOT NULL CHECK (canonical_payload_byte_length > 0),
  canonical_payload_chunk_count integer NOT NULL CHECK (canonical_payload_chunk_count > 0),
  persisted_at timestamptz NOT NULL,
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version = 1),
  UNIQUE (extraction_id, resource_version_identity_id, resource_identity_id),
  UNIQUE (extraction_id, source_snapshot_id, source_revision),
  FOREIGN KEY (resource_version_identity_id, resource_identity_id)
    REFERENCES resource_version_identities(id, resource_identity_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_snapshot_id, source_revision)
    REFERENCES source_snapshots(id, immutable_revision) ON DELETE RESTRICT
);
CREATE INDEX m03_extraction_bundles_projection_idx
  ON m03_extraction_bundles(m02_input_projection_fingerprint);
CREATE INDEX m03_extraction_bundles_input_idx ON m03_extraction_bundles(m03_input_fingerprint);

CREATE TABLE m03_extraction_bundle_chunks (
  extraction_id text NOT NULL REFERENCES m03_extraction_bundles(extraction_id) ON DELETE RESTRICT,
  chunk_ordinal integer NOT NULL CHECK (chunk_ordinal >= 0),
  chunk_bytes bytea NOT NULL CHECK (octet_length(chunk_bytes) BETWEEN 1 AND 1048576),
  chunk_sha256 text NOT NULL CHECK (chunk_sha256 ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY (extraction_id, chunk_ordinal),
  CHECK (encode(digest(chunk_bytes, 'sha256'), 'hex') = chunk_sha256)
);

CREATE TABLE m04_evidence_items (
  id text PRIMARY KEY CHECK (id ~ '^evi_[0-9a-f]{64}$'),
  extraction_id text NOT NULL REFERENCES m03_extraction_bundles(extraction_id) ON DELETE RESTRICT,
  m03_source_reference_id text NOT NULL,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(id) ON DELETE RESTRICT,
  source_revision text NOT NULL CHECK (source_revision ~ '^[0-9a-f]{40}$'),
  source_entry_id text,
  source_document_id text,
  evidence_type text NOT NULL CHECK (evidence_type IN (
    'SOURCE_TEXT','MANIFEST_FIELD','REPOSITORY_METADATA','RELEASE_METADATA','FILE_STRUCTURE','INVENTORY_ABSENCE'
  )),
  canonical_payload bytea NOT NULL CHECK (m04_payload_is_canonical_json(canonical_payload)),
  record_fingerprint text NOT NULL UNIQUE CHECK (record_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL,
  UNIQUE (extraction_id, m03_source_reference_id),
  FOREIGN KEY (source_snapshot_id, source_revision)
    REFERENCES source_snapshots(id, immutable_revision) ON DELETE RESTRICT,
  FOREIGN KEY (source_entry_id, source_snapshot_id)
    REFERENCES m01_source_entries(id, source_snapshot_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_document_id, source_entry_id, source_snapshot_id)
    REFERENCES m01_source_documents(id, source_entry_id, source_snapshot_id) ON DELETE RESTRICT,
  FOREIGN KEY (extraction_id, source_snapshot_id, source_revision)
    REFERENCES m03_extraction_bundles(extraction_id, source_snapshot_id, source_revision) ON DELETE RESTRICT,
  CHECK ((evidence_type IN ('SOURCE_TEXT','MANIFEST_FIELD','FILE_STRUCTURE')) =
    (source_entry_id IS NOT NULL AND source_document_id IS NOT NULL))
);

CREATE TABLE m04_claims (
  id text PRIMARY KEY CHECK (id ~ '^clm_[0-9a-f]{64}$'),
  extraction_id text NOT NULL REFERENCES m03_extraction_bundles(extraction_id) ON DELETE RESTRICT,
  resource_identity_id text NOT NULL REFERENCES resource_identities(id) ON DELETE RESTRICT,
  resource_version_identity_id text NOT NULL REFERENCES resource_version_identities(id) ON DELETE RESTRICT,
  field_key text NOT NULL CHECK (field_key IN (
    'canonical_skill_name','creator_candidates','organization_candidates','version','source_revision',
    'license','categories','outcome_candidate','capabilities','tasks','use_cases',
    'target_user_candidates','installation','configuration','dependencies','external_services',
    'permissions','compatibility','limitations','maintenance_signals'
  )),
  status text NOT NULL CHECK (status IN ('SUPPORTED','SUPPORTED_WITH_QUALIFIER','AMBIGUOUS','REVIEW_REQUIRED')),
  claim_class text NOT NULL CHECK (claim_class IN (
    'SOURCE_FACT','REPOSITORY_METADATA','STATIC_CODE_INDICATOR','FORMAT_INFERENCE','AI_INFERENCE',
    'MIXED_DETERMINISTIC_SUPPORT','MIXED_SUPPORT'
  )),
  canonical_payload bytea NOT NULL CHECK (m04_payload_is_canonical_json(canonical_payload)),
  record_fingerprint text NOT NULL UNIQUE CHECK (record_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL,
  UNIQUE (extraction_id, field_key),
  FOREIGN KEY (resource_version_identity_id, resource_identity_id)
    REFERENCES resource_version_identities(id, resource_identity_id) ON DELETE RESTRICT,
  FOREIGN KEY (extraction_id, resource_version_identity_id, resource_identity_id)
    REFERENCES m03_extraction_bundles(extraction_id, resource_version_identity_id, resource_identity_id)
    ON DELETE RESTRICT
);

CREATE TABLE m04_claim_evidence_links (
  id text PRIMARY KEY CHECK (id ~ '^cel_[0-9a-f]{64}$'),
  claim_id text NOT NULL REFERENCES m04_claims(id) ON DELETE RESTRICT,
  evidence_item_id text NOT NULL REFERENCES m04_evidence_items(id) ON DELETE RESTRICT,
  m03_source_reference_id text NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal BETWEEN 0 AND 4095),
  relationship text NOT NULL CHECK (relationship IN ('SUPPORTS','QUALIFIES','CONTEXT_ONLY')),
  canonical_payload bytea NOT NULL CHECK (m04_payload_is_canonical_json(canonical_payload)),
  record_fingerprint text NOT NULL UNIQUE CHECK (record_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL,
  UNIQUE (claim_id, evidence_item_id),
  UNIQUE (claim_id, ordinal)
);

CREATE TABLE m04_completeness_snapshots (
  id text PRIMARY KEY CHECK (id ~ '^cmp_[0-9a-f]{64}$'),
  extraction_id text NOT NULL UNIQUE REFERENCES m03_extraction_bundles(extraction_id) ON DELETE RESTRICT,
  canonical_payload bytea NOT NULL CHECK (m04_payload_is_canonical_json(canonical_payload)),
  coverage_basis_points integer NOT NULL CHECK (coverage_basis_points BETWEEN 0 AND 10000),
  m05_progression text NOT NULL CHECK (m05_progression IN ('ELIGIBLE','BLOCKED')),
  record_fingerprint text NOT NULL UNIQUE CHECK (record_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL
);

CREATE TABLE m04_binding_results (
  id text PRIMARY KEY CHECK (id ~ '^m4r_[0-9a-f]{64}$'),
  kind text NOT NULL CHECK (kind = 'ACCEPTED'),
  binding_id text NOT NULL UNIQUE CHECK (binding_id ~ '^bnd_[0-9a-f]{64}$'),
  extraction_id text NOT NULL UNIQUE REFERENCES m03_extraction_bundles(extraction_id) ON DELETE RESTRICT,
  completeness_id text NOT NULL UNIQUE REFERENCES m04_completeness_snapshots(id) ON DELETE RESTRICT,
  canonical_payload bytea NOT NULL CHECK (m04_payload_is_canonical_json(canonical_payload)),
  result_fingerprint text NOT NULL UNIQUE CHECK (result_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL,
  UNIQUE (id, binding_id)
);

CREATE TABLE m04_binding_requests (
  id text PRIMARY KEY CHECK (id ~ '^m4q_[0-9a-f]{64}$'),
  idempotency_key text COLLATE "C" NOT NULL UNIQUE CHECK (
    octet_length(idempotency_key) BETWEEN 2 AND 400
    AND mod(octet_length(idempotency_key), 2) = 0
    AND idempotency_key ~ '^[0-9a-f]+$'
  ),
  request_fingerprint text NOT NULL UNIQUE CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  semantic_request_fingerprint text NOT NULL CHECK (semantic_request_fingerprint ~ '^[0-9a-f]{64}$'),
  request_payload_sha256 text NOT NULL CHECK (request_payload_sha256 ~ '^[0-9a-f]{64}$'),
  request_payload_byte_length integer NOT NULL CHECK (request_payload_byte_length BETWEEN 1 AND 262144),
  request_canonical_payload bytea NOT NULL CHECK (m04_payload_is_canonical_json(request_canonical_payload)),
  binding_id text NOT NULL,
  result_id text NOT NULL,
  created_at timestamptz NOT NULL,
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version = 1),
  CHECK (octet_length(request_canonical_payload) = request_payload_byte_length),
  CHECK (encode(digest(request_canonical_payload, 'sha256'), 'hex') = request_payload_sha256),
  CHECK (request_fingerprint = request_payload_sha256),
  FOREIGN KEY (result_id, binding_id) REFERENCES m04_binding_results(id, binding_id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX m04_binding_requests_semantic_idx ON m04_binding_requests(semantic_request_fingerprint);

CREATE FUNCTION <S>.m04_reject_immutable_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'M04_IMMUTABLE_RECORD';
END;
$$;

CREATE FUNCTION <S>.m04_validate_bundle_chunks() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent <S>.m03_extraction_bundles%ROWTYPE;
  actual_count integer;
  actual_length bigint;
  reconstructed bytea;
  value jsonb;
  safe_payload text;
  logical_safe text := '{';
  output_safe text := '{';
  logical_payload bytea;
  output_preimage_payload bytea;
  root_member record;
  attempt_member record;
  attempt_safe text;
  attempts_safe text;
  part text;
  resource_id_hex text;
  version_id_hex text;
  snapshot_id_hex text;
BEGIN
  -- The parent constraint validates all chunks at commit. A later transaction
  -- cannot append chunks to a sealed binding. This AFTER trigger runs after
  -- the nondeferrable parent FK check (including any wait for its creator).
  IF TG_TABLE_NAME='m03_extraction_bundle_chunks' THEN
    IF EXISTS (SELECT 1 FROM <S>.m04_binding_results WHERE extraction_id=NEW.extraction_id) THEN
      RAISE EXCEPTION 'M04_IMMUTABLE_RECORD';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO parent FROM <S>.m03_extraction_bundles WHERE extraction_id = NEW.extraction_id;
  SELECT count(*)::integer, coalesce(sum(octet_length(chunk_bytes)), 0), string_agg(chunk_bytes, ''::bytea ORDER BY chunk_ordinal)
    INTO actual_count, actual_length, reconstructed
    FROM <S>.m03_extraction_bundle_chunks WHERE extraction_id = NEW.extraction_id;
  IF actual_count <> parent.canonical_payload_chunk_count
    OR actual_length <> parent.canonical_payload_byte_length
    OR EXISTS (
      SELECT 1 FROM <S>.m03_extraction_bundle_chunks chunks
      WHERE chunks.extraction_id = NEW.extraction_id
        AND chunks.chunk_ordinal <> parent.canonical_payload_chunk_count - 1
        AND octet_length(chunks.chunk_bytes) <> 1048576
    )
    OR EXISTS (
      SELECT ordinal FROM generate_series(0, parent.canonical_payload_chunk_count - 1) ordinal
      EXCEPT SELECT chunk_ordinal FROM <S>.m03_extraction_bundle_chunks WHERE extraction_id = NEW.extraction_id
    )
    OR encode(digest(reconstructed, 'sha256'), 'hex') <> parent.canonical_payload_sha256
    OR NOT <S>.m04_payload_is_canonical_json(reconstructed)
  THEN
    RAISE EXCEPTION 'M04_BUNDLE_CHUNK_CLOSURE_INVALID';
  END IF;
  -- Canonical bytes remain authoritative. The prefix code only permits JSON
  -- navigation through PostgreSQL without decoding U+0000 into a text value.
  safe_payload := regexp_replace(
    replace(convert_from(reconstructed, 'UTF8'), chr(57344), chr(57344)||chr(57345)),
    '(?<!\\)((?:\\\\)*)\\u0000', '\1'||chr(57344)||chr(57344), 'g');
  value := safe_payload::jsonb;
  FOR root_member IN SELECT key, element::text raw_value
    FROM json_each(safe_payload::json) WITH ORDINALITY AS member(key, element, ordinal)
    ORDER BY ordinal
  LOOP
    IF root_member.key = 'createdAt' THEN CONTINUE; END IF;
    IF root_member.key = 'analysisAttempts' THEN
      attempts_safe := '[';
      FOR attempt_member IN SELECT element::text raw_value
        FROM json_array_elements(root_member.raw_value::json) WITH ORDINALITY AS attempt(element, ordinal)
        ORDER BY ordinal
      LOOP
        SELECT '{'||coalesce(string_agg(to_jsonb(key)::text||':'||element::text,
          ',' ORDER BY ordinal),'')||'}' INTO attempt_safe
          FROM json_each(attempt_member.raw_value::json) WITH ORDINALITY AS member(key, element, ordinal)
          WHERE key NOT IN ('durationMsOrNull','tokenCountsOrNull','providerRequestIdOrNull');
        IF length(attempts_safe)>1 THEN attempts_safe := attempts_safe||','; END IF;
        attempts_safe := attempts_safe||attempt_safe;
      END LOOP;
      part := attempts_safe||']';
    ELSE
      part := root_member.raw_value;
    END IF;
    part := to_jsonb(root_member.key)::text||':'||part;
    IF length(logical_safe)>1 THEN logical_safe := logical_safe||','; END IF;
    logical_safe := logical_safe||part;
    IF root_member.key <> 'outputFingerprint' THEN
      IF length(output_safe)>1 THEN output_safe := output_safe||','; END IF;
      output_safe := output_safe||part;
    END IF;
  END LOOP;
  logical_safe := logical_safe||'}';
  output_safe := output_safe||'}';
  logical_payload := convert_to(replace(replace(logical_safe,
    chr(57344)||chr(57344), chr(92)||'u0000'),
    chr(57344)||chr(57345), chr(57344)), 'UTF8');
  output_preimage_payload := convert_to(replace(replace(output_safe,
    chr(57344)||chr(57344), chr(92)||'u0000'),
    chr(57344)||chr(57345), chr(57344)), 'UTF8');
  resource_id_hex := replace(replace(encode(convert_to(value#>>'{m02,resourceIdentityId}','UTF8'),'hex'),
    'ee8080ee8080','00'),'ee8080ee8081','ee8080');
  version_id_hex := replace(replace(encode(convert_to(value#>>'{m02,resourceVersionIdentityId}','UTF8'),'hex'),
    'ee8080ee8080','00'),'ee8080ee8081','ee8080');
  snapshot_id_hex := replace(replace(encode(convert_to(value#>>'{m02,sourceSnapshotId}','UTF8'),'hex'),
    'ee8080ee8080','00'),'ee8080ee8081','ee8080');
  IF value->>'extractionId' IS DISTINCT FROM parent.extraction_id
    OR resource_id_hex IS DISTINCT FROM encode(convert_to(parent.resource_identity_id,'UTF8'),'hex')
    OR version_id_hex IS DISTINCT FROM encode(convert_to(parent.resource_version_identity_id,'UTF8'),'hex')
    OR snapshot_id_hex IS DISTINCT FROM encode(convert_to(parent.source_snapshot_id,'UTF8'),'hex')
    OR value#>>'{m02,sourceRevision}' IS DISTINCT FROM parent.source_revision
    OR value->>'m02InputProjectionFingerprint' IS DISTINCT FROM parent.m02_input_projection_fingerprint
    OR value->>'inputFingerprint' IS DISTINCT FROM parent.m03_input_fingerprint
    OR value->>'outputFingerprint' IS DISTINCT FROM parent.m03_output_fingerprint
    OR encode(digest(output_preimage_payload, 'sha256'), 'hex')
      IS DISTINCT FROM parent.m03_output_fingerprint
    OR encode(digest(logical_payload, 'sha256'), 'hex')
      IS DISTINCT FROM parent.logical_payload_sha256
  THEN
    RAISE EXCEPTION 'M04_BUNDLE_PARENT_INTEGRITY_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER m04_bundle_parent_closure
AFTER INSERT ON m03_extraction_bundles DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION m04_validate_bundle_chunks();
CREATE TRIGGER m04_bundle_chunks_closure
AFTER INSERT ON m03_extraction_bundle_chunks
FOR EACH ROW EXECUTE FUNCTION m04_validate_bundle_chunks();

CREATE FUNCTION <S>.m04_validate_canonical_record() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  value jsonb;
  row_value jsonb;
  computed text;
  computed_id text;
  id_prefix text;
  safe_payload text;
  fingerprint_safe text := '{';
  id_safe text := '{';
  member record;
  part text;
  link_claim text;
  link_evidence text;
  link_id text;
  link_reference text;
  link_relationship text;
  link_ordinal text;
BEGIN
  IF TG_TABLE_NAME = 'm04_claim_evidence_links' THEN
    -- The closed link schema has only fixed scalar fields. Reconstruct its
    -- exact canonical bytes and both identity preimages without per-row JSON
    -- member iteration; the table CHECK still validates canonical JSON.
    link_claim := to_json(NEW.claim_id)::text;
    link_evidence := to_json(NEW.evidence_item_id)::text;
    link_id := to_json(NEW.id)::text;
    link_reference := to_json(NEW.m03_source_reference_id)::text;
    link_relationship := to_json(NEW.relationship)::text;
    link_ordinal := NEW.ordinal::text;
    id_safe := '{"claimId":'||link_claim||',"evidenceItemId":'||link_evidence||
      ',"m03SourceReferenceId":'||link_reference||',"ordinal":'||link_ordinal||
      ',"relationship":'||link_relationship||',"schemaVersion":"M04_CLAIM_EVIDENCE_LINK_V1"}';
    computed_id := 'cel_'||encode(digest(convert_to(id_safe,'UTF8'),'sha256'),'hex');
    fingerprint_safe := '{"claimId":'||link_claim||',"evidenceItemId":'||link_evidence||
      ',"id":'||link_id||',"m03SourceReferenceId":'||link_reference||
      ',"ordinal":'||link_ordinal||',"relationship":'||link_relationship||
      ',"schemaVersion":"M04_CLAIM_EVIDENCE_LINK_V1"}';
    computed := encode(digest(convert_to(fingerprint_safe,'UTF8'),'sha256'),'hex');
    IF NEW.id <> computed_id OR NEW.record_fingerprint <> computed OR
      NEW.canonical_payload <> convert_to(
        '{"claimId":'||link_claim||',"evidenceItemId":'||link_evidence||
        ',"id":'||link_id||',"m03SourceReferenceId":'||link_reference||
        ',"ordinal":'||link_ordinal||',"recordFingerprint":'||to_json(NEW.record_fingerprint)::text||
        ',"relationship":'||link_relationship||',"schemaVersion":"M04_CLAIM_EVIDENCE_LINK_V1"}',
        'UTF8') THEN
      RAISE EXCEPTION 'M04_CANONICAL_RECORD_INTEGRITY_INVALID';
    END IF;
    RETURN NEW;
  END IF;
  row_value := to_jsonb(NEW);
  safe_payload := regexp_replace(
    replace(convert_from(NEW.canonical_payload, 'UTF8'), chr(57344), chr(57344)||chr(57345)),
    '(?<!\\)((?:\\\\)*)\\u0000', '\1'||chr(57344)||chr(57344), 'g');
  value := safe_payload::jsonb;
  FOR member IN SELECT key, element::text raw_value
    FROM json_each(safe_payload::json) WITH ORDINALITY AS entry(key, element, ordinal)
    ORDER BY ordinal
  LOOP
    part := to_jsonb(member.key)::text||':'||member.raw_value;
    IF member.key <> 'recordFingerprint' THEN
      IF length(fingerprint_safe)>1 THEN fingerprint_safe := fingerprint_safe||','; END IF;
      fingerprint_safe := fingerprint_safe||part;
      IF member.key <> 'id' THEN
        IF length(id_safe)>1 THEN id_safe := id_safe||','; END IF;
        id_safe := id_safe||part;
      END IF;
    END IF;
  END LOOP;
  fingerprint_safe := fingerprint_safe||'}';
  id_safe := id_safe||'}';
  computed := encode(digest(convert_to(replace(replace(fingerprint_safe,
    chr(57344)||chr(57344), chr(92)||'u0000'),
    chr(57344)||chr(57345), chr(57344)), 'UTF8'), 'sha256'), 'hex');
  id_prefix := CASE TG_TABLE_NAME
    WHEN 'm04_evidence_items' THEN 'evi_'
    WHEN 'm04_claims' THEN 'clm_'
    WHEN 'm04_claim_evidence_links' THEN 'cel_'
    WHEN 'm04_completeness_snapshots' THEN 'cmp_'
  END;
  computed_id := id_prefix || encode(digest(convert_to(replace(replace(id_safe,
    chr(57344)||chr(57344), chr(92)||'u0000'),
    chr(57344)||chr(57345), chr(57344)), 'UTF8'), 'sha256'), 'hex');
  IF value->>'id' <> row_value->>'id' OR value->>'recordFingerprint' <> row_value->>'record_fingerprint'
    OR computed <> row_value->>'record_fingerprint' OR computed_id <> row_value->>'id' THEN
    RAISE EXCEPTION 'M04_CANONICAL_RECORD_INTEGRITY_INVALID';
  END IF;
  IF TG_TABLE_NAME = 'm04_evidence_items' AND (
    value->>'extractionId' <> row_value->>'extraction_id' OR
    replace(replace(encode(convert_to(value->>'sourceSnapshotId','UTF8'),'hex'),
      'ee8080ee8080','00'),'ee8080ee8081','ee8080')
      <> encode(convert_to(row_value->>'source_snapshot_id','UTF8'),'hex')
    OR value->>'sourceRevision' <> row_value->>'source_revision' OR value->>'evidenceType' <> row_value->>'evidence_type'
    OR value->>'m03SourceReferenceId' <> row_value->>'m03_source_reference_id'
    OR (CASE WHEN value->>'sourceEntryIdOrNull' IS NULL THEN NULL ELSE
      replace(replace(encode(convert_to(value->>'sourceEntryIdOrNull','UTF8'),'hex'),
      'ee8080ee8080','00'),'ee8080ee8081','ee8080') END)
      IS DISTINCT FROM (CASE WHEN row_value->>'source_entry_id' IS NULL THEN NULL ELSE
        encode(convert_to(row_value->>'source_entry_id','UTF8'),'hex') END)
    OR (CASE WHEN value->>'sourceDocumentIdOrNull' IS NULL THEN NULL ELSE
      replace(replace(encode(convert_to(value->>'sourceDocumentIdOrNull','UTF8'),'hex'),
      'ee8080ee8080','00'),'ee8080ee8081','ee8080') END)
      IS DISTINCT FROM (CASE WHEN row_value->>'source_document_id' IS NULL THEN NULL ELSE
        encode(convert_to(row_value->>'source_document_id','UTF8'),'hex') END)
  ) THEN RAISE EXCEPTION 'M04_EVIDENCE_SCALAR_MISMATCH'; END IF;
  IF TG_TABLE_NAME = 'm04_claims' AND (
    value->>'extractionId' <> row_value->>'extraction_id' OR
    replace(replace(encode(convert_to(value->>'resourceIdentityId','UTF8'),'hex'),
      'ee8080ee8080','00'),'ee8080ee8081','ee8080')
      <> encode(convert_to(row_value->>'resource_identity_id','UTF8'),'hex')
    OR replace(replace(encode(convert_to(value->>'resourceVersionIdentityId','UTF8'),'hex'),
      'ee8080ee8080','00'),'ee8080ee8081','ee8080')
      <> encode(convert_to(row_value->>'resource_version_identity_id','UTF8'),'hex')
    OR value->>'fieldKey' <> row_value->>'field_key' OR value->>'status' <> row_value->>'status'
    OR value->>'claimClass' <> row_value->>'claim_class'
  ) THEN RAISE EXCEPTION 'M04_CLAIM_SCALAR_MISMATCH'; END IF;
  IF TG_TABLE_NAME = 'm04_claim_evidence_links' AND (
    value->>'claimId' <> row_value->>'claim_id' OR value->>'evidenceItemId' <> row_value->>'evidence_item_id'
    OR value->>'m03SourceReferenceId' <> row_value->>'m03_source_reference_id'
    OR (value->>'ordinal')::integer <> (row_value->>'ordinal')::integer
    OR value->>'relationship' <> row_value->>'relationship'
  ) THEN RAISE EXCEPTION 'M04_LINK_SCALAR_MISMATCH'; END IF;
  IF TG_TABLE_NAME = 'm04_completeness_snapshots' AND (
    value->>'extractionId' <> row_value->>'extraction_id'
    OR (value->>'coverageBasisPoints')::integer <> (row_value->>'coverage_basis_points')::integer
    OR value->>'m05Progression' <> row_value->>'m05_progression'
  ) THEN RAISE EXCEPTION 'M04_COMPLETENESS_SCALAR_MISMATCH'; END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER m04_evidence_payload_guard AFTER INSERT ON m04_evidence_items
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION m04_validate_canonical_record();
CREATE CONSTRAINT TRIGGER m04_claim_payload_guard AFTER INSERT ON m04_claims
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION m04_validate_canonical_record();
CREATE CONSTRAINT TRIGGER m04_link_payload_guard AFTER INSERT ON m04_claim_evidence_links
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION m04_validate_canonical_record();
CREATE CONSTRAINT TRIGGER m04_completeness_payload_guard AFTER INSERT ON m04_completeness_snapshots
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION m04_validate_canonical_record();

CREATE FUNCTION <S>.m04_validate_accepted_result() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE core jsonb; computed_id text; computed_fingerprint text;
BEGIN
  core := jsonb_build_object(
    'kind', 'ACCEPTED', 'bindingId', NEW.binding_id,
    'extractionId', NEW.extraction_id, 'completenessId', NEW.completeness_id
  );
  computed_id := 'm4r_' || encode(digest(
    convert_to(<S>.m04_canonical_json(core), 'UTF8'), 'sha256'
  ), 'hex');
  computed_fingerprint := encode(digest(convert_to(<S>.m04_canonical_json(
    jsonb_build_object('schemaVersion', 'M04_RESULT_V1', 'resultId', computed_id)
      || core
  ), 'UTF8'), 'sha256'), 'hex');
  IF NEW.canonical_payload <> convert_to(<S>.m04_canonical_json(core), 'UTF8')
    OR NEW.id <> computed_id OR NEW.result_fingerprint <> computed_fingerprint THEN
    RAISE EXCEPTION 'M04_ACCEPTED_RESULT_INTEGRITY_INVALID';
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER m04_accepted_result_guard AFTER INSERT ON m04_binding_results
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION m04_validate_accepted_result();

CREATE FUNCTION <S>.m04_validate_link_lineage() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE claim_extraction text; evidence_extraction text; evidence_reference text;
BEGIN
  SELECT claim.extraction_id, item.extraction_id, item.m03_source_reference_id
    INTO claim_extraction, evidence_extraction, evidence_reference
    FROM <S>.m04_claims claim JOIN <S>.m04_evidence_items item ON item.id=NEW.evidence_item_id
    WHERE claim.id=NEW.claim_id;
  IF claim_extraction IS NULL OR claim_extraction <> evidence_extraction
    OR evidence_reference <> NEW.m03_source_reference_id THEN
    RAISE EXCEPTION 'M04_LINK_LINEAGE_INVALID';
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER m04_link_lineage_guard AFTER INSERT ON m04_claim_evidence_links
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION m04_validate_link_lineage();

CREATE FUNCTION m04_assert_binding_closure(target_extraction_id text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  bundle_value jsonb;
  completeness_value jsonb;
  expected_value jsonb;
  requirement jsonb;
  field_keys jsonb;
  requirement_status text;
  requirements_value jsonb := '[]'::jsonb;
  claim_ids jsonb;
  evidence_ids jsonb;
  blockers jsonb := '[]'::jsonb;
  unresolved jsonb;
  covered integer := 0;
  expected_completeness_id text;
  expected_completeness_fingerprint text;
  request_row record;
  current_request_payload jsonb;
  safe_request text;
  semantic_request text;
  expected_binding_id text;
BEGIN
  SELECT regexp_replace(replace(convert_from(string_agg(chunk_bytes, ''::bytea ORDER BY chunk_ordinal),'UTF8'),chr(57344),chr(57344)||chr(57345)),
    '(?<!\\)((?:\\\\)*)\\u0000','\1'||chr(57344)||chr(57344),'g')::jsonb
    INTO bundle_value
    FROM <S>.m03_extraction_bundle_chunks
   WHERE extraction_id=target_extraction_id;
  IF bundle_value IS NULL THEN RAISE EXCEPTION 'M04_FULL_CLOSURE_BUNDLE_MISSING'; END IF;

  IF (SELECT count(*) FROM <S>.m04_evidence_items WHERE extraction_id=target_extraction_id)
       <> jsonb_array_length(bundle_value->'sourceReferences')
    OR EXISTS (
      SELECT 1
        FROM jsonb_array_elements(bundle_value->'sourceReferences') reference
        LEFT JOIN <S>.m04_evidence_items item
          ON item.extraction_id=target_extraction_id
         AND item.m03_source_reference_id=reference->>'id'
       WHERE item.id IS NULL OR regexp_replace(replace(convert_from(item.canonical_payload,'UTF8'),chr(57344),chr(57344)||chr(57345)),
    '(?<!\\)((?:\\\\)*)\\u0000','\1'||chr(57344)||chr(57344),'g')::jsonb IS DISTINCT FROM
        jsonb_build_object(
          'schemaVersion','M04_EVIDENCE_ITEM_V1',
          'id',item.id,
          'extractionId',target_extraction_id,
          'm03SourceReferenceId',reference->>'id',
          'sourceSnapshotId',reference->>'sourceSnapshotId',
          'sourceRevision',bundle_value#>>'{m02,sourceRevision}',
          'evidenceType',CASE
            WHEN reference->>'kind'='INVENTORY_ABSENCE' THEN 'INVENTORY_ABSENCE'
            WHEN reference->>'kind'='SNAPSHOT_METADATA' AND reference#>>'{locator,type}'='RELEASE_FIELD' THEN 'RELEASE_METADATA'
            WHEN reference->>'kind'='SNAPSHOT_METADATA' THEN 'REPOSITORY_METADATA'
            WHEN coalesce(reference#>>'{locator,originalType}',reference#>>'{locator,type}') IN ('JSON_POINTER','DATA_POINTER') THEN 'MANIFEST_FIELD'
            WHEN coalesce(reference#>>'{locator,originalType}',reference#>>'{locator,type}') IN ('TREE_PATH','FILE_METADATA') THEN 'FILE_STRUCTURE'
            ELSE 'SOURCE_TEXT' END,
          'locatorOrNull',CASE WHEN reference->>'kind'='INVENTORY_ABSENCE' THEN 'null'::jsonb ELSE reference->'locator' END,
          'sourceEntryIdOrNull',CASE WHEN reference->>'kind'='DOCUMENT' THEN reference->'sourceEntryId' ELSE 'null'::jsonb END,
          'sourceDocumentIdOrNull',CASE WHEN reference->>'kind'='DOCUMENT' THEN reference->'sourceDocumentId' ELSE 'null'::jsonb END,
          'contentFingerprint',reference->>'contentHash',
          'excerptState',CASE
            WHEN reference#>>'{locator,type}'='SENSITIVE_LOCATOR' THEN 'OMITTED'
            WHEN coalesce(reference#>>'{locator,originalType}',reference#>>'{locator,type}') IN ('TREE_PATH','FILE_METADATA') THEN 'NOT_APPLICABLE'
            WHEN reference->>'kind' IN ('SNAPSHOT_METADATA','INVENTORY_ABSENCE') THEN 'NOT_APPLICABLE'
            WHEN reference->'excerptOrNull' <> 'null'::jsonb THEN 'RETAINED_INTERNAL'
            ELSE 'OMITTED' END,
          'excerptOrNull',CASE
            WHEN reference->>'kind'='DOCUMENT' AND reference#>>'{locator,type}'<>'SENSITIVE_LOCATOR'
              AND coalesce(reference#>>'{locator,originalType}',reference#>>'{locator,type}') NOT IN ('TREE_PATH','FILE_METADATA')
              AND reference->'excerptOrNull'<>'null'::jsonb THEN reference->'excerptOrNull'
            ELSE 'null'::jsonb END,
          'visibility','INTERNAL_EVIDENCE',
          'displayAuthorization','NOT_GRANTED',
          'recordFingerprint',item.record_fingerprint))
  THEN RAISE EXCEPTION 'M04_FULL_CLOSURE_EVIDENCE_INVALID'; END IF;

  IF (SELECT count(*) FROM <S>.m04_claims WHERE extraction_id=target_extraction_id)
       <> (SELECT count(*) FROM jsonb_array_elements(bundle_value->'fields') field
            WHERE field->>'claimClass'<>'NO_CLAIM' AND field->>'status' NOT IN ('MISSING','UNSUPPORTED'))
    OR EXISTS (
      SELECT 1
        FROM jsonb_array_elements(bundle_value->'fields') WITH ORDINALITY AS fields(field,ordinal)
        LEFT JOIN <S>.m04_claims claim ON claim.extraction_id=target_extraction_id
          AND claim.field_key=field->>'fieldKey'
       WHERE field->>'claimClass'<>'NO_CLAIM' AND field->>'status' NOT IN ('MISSING','UNSUPPORTED')
         AND (claim.id IS NULL OR regexp_replace(replace(convert_from(claim.canonical_payload,'UTF8'),chr(57344),chr(57344)||chr(57345)),
    '(?<!\\)((?:\\\\)*)\\u0000','\1'||chr(57344)||chr(57344),'g')::jsonb IS DISTINCT FROM
          jsonb_build_object(
            'schemaVersion','M04_CLAIM_V1','id',claim.id,'extractionId',target_extraction_id,
            'resourceIdentityId',bundle_value#>>'{m02,resourceIdentityId}',
            'resourceVersionIdentityId',bundle_value#>>'{m02,resourceVersionIdentityId}',
            'fieldKey',field->>'fieldKey','value',field->'value','claimClass',field->>'claimClass',
            'status',CASE field->>'status' WHEN 'INFERRED' THEN 'SUPPORTED_WITH_QUALIFIER'
              WHEN 'CONFLICTING' THEN 'AMBIGUOUS' WHEN 'REVIEW_REQUIRED' THEN 'REVIEW_REQUIRED'
              ELSE 'SUPPORTED' END,
            'confidenceOrNull',field->'confidence',
            'deterministicCandidateIds',field->'deterministicCandidateIds',
            'aiProposalIds',field->'aiProposalIds','conflictIds',field->'conflictIds',
            'warningCodes',field->'warningCodes','recordFingerprint',claim.record_fingerprint)))
  THEN RAISE EXCEPTION 'M04_FULL_CLOSURE_CLAIM_INVALID'; END IF;

  IF (SELECT count(*) FROM <S>.m04_claim_evidence_links link JOIN <S>.m04_claims claim ON claim.id=link.claim_id
       WHERE claim.extraction_id=target_extraction_id)
       <> (SELECT coalesce(sum(jsonb_array_length(field->'evidenceIds')),0)
             FROM jsonb_array_elements(bundle_value->'fields') field
            WHERE field->>'claimClass'<>'NO_CLAIM' AND field->>'status' NOT IN ('MISSING','UNSUPPORTED'))
    OR EXISTS (
      SELECT 1
        FROM jsonb_array_elements(bundle_value->'fields') field
        JOIN <S>.m04_claims claim ON claim.extraction_id=target_extraction_id AND claim.field_key=field->>'fieldKey'
        CROSS JOIN LATERAL (
          SELECT count(*) link_count,
            coalesce(jsonb_agg(item.m03_source_reference_id ORDER BY link.ordinal),'[]'::jsonb) reference_ids,
            min(link.ordinal) first_ordinal,max(link.ordinal) last_ordinal,
            coalesce(bool_or(
              item.id IS NULL OR item.extraction_id IS DISTINCT FROM target_extraction_id
              OR link.m03_source_reference_id IS DISTINCT FROM item.m03_source_reference_id
              OR link.relationship IS DISTINCT FROM CASE field->>'status'
                   WHEN 'CONFLICTING' THEN 'CONTEXT_ONLY' WHEN 'INFERRED' THEN 'QUALIFIES'
                   WHEN 'REVIEW_REQUIRED' THEN 'QUALIFIES' ELSE 'SUPPORTS' END
              OR link.canonical_payload IS DISTINCT FROM convert_to(
                '{"claimId":'||to_json(claim.id)::text||
                ',"evidenceItemId":'||to_json(item.id)::text||
                ',"id":'||to_json(link.id)::text||
                ',"m03SourceReferenceId":'||to_json(item.m03_source_reference_id)::text||
                ',"ordinal":'||link.ordinal::text||
                ',"recordFingerprint":'||to_json(link.record_fingerprint)::text||
                ',"relationship":'||to_json(CASE field->>'status' WHEN 'CONFLICTING' THEN 'CONTEXT_ONLY'
                  WHEN 'INFERRED' THEN 'QUALIFIES' WHEN 'REVIEW_REQUIRED' THEN 'QUALIFIES' ELSE 'SUPPORTS' END)::text||
                ',"schemaVersion":"M04_CLAIM_EVIDENCE_LINK_V1"}', 'UTF8')),
              false) invalid_link
            FROM <S>.m04_claim_evidence_links link
            LEFT JOIN <S>.m04_evidence_items item ON item.id=link.evidence_item_id
           WHERE link.claim_id=claim.id
        ) actual
       WHERE field->>'claimClass'<>'NO_CLAIM' AND field->>'status' NOT IN ('MISSING','UNSUPPORTED')
         AND (actual.link_count <> jsonb_array_length(field->'evidenceIds')
           OR actual.reference_ids IS DISTINCT FROM field->'evidenceIds'
           OR (actual.link_count>0 AND (actual.first_ordinal<>0
             OR actual.last_ordinal<>actual.link_count-1))
           OR actual.invalid_link)
    )
  THEN RAISE EXCEPTION 'M04_FULL_CLOSURE_LINK_INVALID'; END IF;

  FOR requirement IN SELECT value FROM jsonb_array_elements(
    '[["identity",["canonical_skill_name"]],["attribution",["creator_candidates","organization_candidates"]],
      ["version",["version"]],["license",["license"]],["purpose",["outcome_candidate"]],
      ["capabilities",["capabilities"]],["installation",["installation"]],
      ["dependencies",["dependencies"]],["permissions",["permissions"]],
      ["compatibility",["compatibility"]],["limitations",["limitations"]]]'::jsonb)
  LOOP
    field_keys := requirement->1;
    WITH eligible AS (
      SELECT claim.id,keys.field_ordinal
        FROM jsonb_array_elements_text(field_keys) WITH ORDINALITY keys(field_key,field_ordinal)
        JOIN <S>.m04_claims claim ON claim.extraction_id=target_extraction_id AND claim.field_key=keys.field_key
         AND claim.status IN ('SUPPORTED','SUPPORTED_WITH_QUALIFIER')
         AND jsonb_array_length(regexp_replace(replace(convert_from(claim.canonical_payload,'UTF8'),chr(57344),chr(57344)||chr(57345)),
    '(?<!\\)((?:\\\\)*)\\u0000','\1'||chr(57344)||chr(57344),'g')::jsonb->'conflictIds')=0
       WHERE EXISTS (SELECT 1 FROM <S>.m04_claim_evidence_links WHERE claim_id=claim.id)
    )
    SELECT coalesce(jsonb_agg(id ORDER BY field_ordinal),'[]'::jsonb)
      INTO claim_ids FROM eligible;
    WITH eligible AS (
      SELECT claim.id,keys.field_ordinal
        FROM jsonb_array_elements_text(field_keys) WITH ORDINALITY keys(field_key,field_ordinal)
        JOIN <S>.m04_claims claim ON claim.extraction_id=target_extraction_id AND claim.field_key=keys.field_key
         AND claim.status IN ('SUPPORTED','SUPPORTED_WITH_QUALIFIER')
         AND jsonb_array_length(regexp_replace(replace(convert_from(claim.canonical_payload,'UTF8'),chr(57344),chr(57344)||chr(57345)),
    '(?<!\\)((?:\\\\)*)\\u0000','\1'||chr(57344)||chr(57344),'g')::jsonb->'conflictIds')=0
    )
    SELECT coalesce(jsonb_agg(link.evidence_item_id ORDER BY eligible.field_ordinal,link.ordinal),'[]'::jsonb)
      INTO evidence_ids FROM eligible JOIN <S>.m04_claim_evidence_links link ON link.claim_id=eligible.id;
    IF jsonb_array_length(claim_ids)>0 THEN
      requirement_status := 'COVERED'; covered := covered+1;
    ELSE
      SELECT CASE WHEN bool_or(field->>'status'='CONFLICTING') THEN 'AMBIGUOUS'
                  WHEN bool_or(field->>'status'='REVIEW_REQUIRED') THEN 'REVIEW_REQUIRED'
                  WHEN bool_or(field->>'status'='UNSUPPORTED') THEN 'UNSUPPORTED' ELSE 'MISSING' END
        INTO requirement_status
        FROM jsonb_array_elements(bundle_value->'fields') field
       WHERE field->>'fieldKey' IN (SELECT jsonb_array_elements_text(field_keys));
      blockers := blockers || jsonb_build_array(requirement->0);
    END IF;
    requirements_value := requirements_value || jsonb_build_array(jsonb_build_object(
      'key',requirement->0,'status',requirement_status,'claimIds',claim_ids,'evidenceItemIds',evidence_ids));
  END LOOP;
  SELECT coalesce(jsonb_agg(value ORDER BY convert_to(value#>>'{}','UTF8')), '[]'::jsonb)
    INTO unresolved FROM (SELECT DISTINCT value FROM <S>.m04_claims claim,
      jsonb_array_elements(regexp_replace(replace(convert_from(claim.canonical_payload,'UTF8'),chr(57344),chr(57344)||chr(57345)),
    '(?<!\\)((?:\\\\)*)\\u0000','\1'||chr(57344)||chr(57344),'g')::jsonb->'conflictIds') value
      WHERE claim.extraction_id=target_extraction_id) conflicts;
  expected_value := jsonb_build_object(
    'schemaVersion','M04_EVIDENCE_COMPLETENESS_V1','registryVersion','m04-material-fields-v1',
    'totalRequirements',11,'coveredRequirements',covered,
    'coverageBasisPoints',floor(covered*10000/11.0)::integer,'requirements',requirements_value,
    'unresolvedConflictIds',unresolved,'blockingRequirementKeys',blockers,
    'm05Progression',CASE WHEN covered=11 AND jsonb_array_length(unresolved)=0 THEN 'ELIGIBLE' ELSE 'BLOCKED' END);
  expected_completeness_id := 'cmp_' || encode(digest(convert_to(<S>.m04_canonical_json(expected_value),'UTF8'),'sha256'),'hex');
  expected_completeness_fingerprint := encode(digest(convert_to(<S>.m04_canonical_json(
    expected_value || jsonb_build_object('id',expected_completeness_id)),'UTF8'),'sha256'),'hex');
  SELECT regexp_replace(replace(convert_from(canonical_payload,'UTF8'),chr(57344),chr(57344)||chr(57345)),
    '(?<!\\)((?:\\\\)*)\\u0000','\1'||chr(57344)||chr(57344),'g')::jsonb INTO completeness_value
    FROM <S>.m04_completeness_snapshots WHERE extraction_id=target_extraction_id;
  IF completeness_value IS NULL OR completeness_value IS DISTINCT FROM
       (expected_value || jsonb_build_object('id',expected_completeness_id,
         'recordFingerprint',expected_completeness_fingerprint))
  THEN RAISE EXCEPTION 'M04_FULL_CLOSURE_COMPLETENESS_INVALID'; END IF;

  FOR request_row IN SELECT * FROM <S>.m04_binding_requests request
    JOIN <S>.m04_binding_results result ON result.id=request.result_id AND result.binding_id=request.binding_id
    WHERE result.extraction_id=target_extraction_id
  LOOP
    current_request_payload := regexp_replace(replace(convert_from(request_row.request_canonical_payload,'UTF8'),chr(57344),chr(57344)||chr(57345)),
    '(?<!\\)((?:\\\\)*)\\u0000','\1'||chr(57344)||chr(57344),'g')::jsonb;
    safe_request := regexp_replace(
      replace(convert_from(request_row.request_canonical_payload,'UTF8'),chr(57344),chr(57344)||chr(57345)),
      '(?<!\\)((?:\\\\)*)\\u0000','\1'||chr(57344)||chr(57344),'g');
    SELECT '{'||coalesce(string_agg(to_jsonb(key)::text||':'||element::text,
      ',' ORDER BY ordinal),'')||'}' INTO semantic_request
      FROM json_each(safe_request::json) WITH ORDINALITY AS member(key,element,ordinal)
      WHERE key <> 'idempotencyKey';
    IF (SELECT array_agg(key ORDER BY convert_to(key,'UTF8')) FROM jsonb_object_keys(current_request_payload) key)
         <> ARRAY['evidencePolicyVersion','expectedM03OutputFingerprint','expectedPredecessorState',
                  'expectedResourceIdentityId','expectedResourceVersionIdentityId',
                  'expectedSourceRevision','expectedSourceSnapshotId','extractionId','idempotencyKey',
                  'materialFieldRegistryVersion','schemaVersion']
      OR current_request_payload->>'schemaVersion' <> 'M04_EVIDENCE_BINDING_REQUEST_V1'
      OR replace(replace(encode(convert_to(current_request_payload->>'idempotencyKey','UTF8'),'hex'),
        'ee8080ee8080','00'),'ee8080ee8081','ee8080') <> request_row.idempotency_key
      OR current_request_payload->>'extractionId' <> target_extraction_id
      OR current_request_payload->>'expectedM03OutputFingerprint' <> bundle_value->>'outputFingerprint'
      OR current_request_payload->>'expectedResourceIdentityId' <> bundle_value#>>'{m02,resourceIdentityId}'
      OR current_request_payload->>'expectedResourceVersionIdentityId' <> bundle_value#>>'{m02,resourceVersionIdentityId}'
      OR current_request_payload->>'expectedSourceSnapshotId' <> bundle_value#>>'{m02,sourceSnapshotId}'
      OR current_request_payload->>'expectedSourceRevision' <> bundle_value#>>'{m02,sourceRevision}'
      OR current_request_payload->'expectedPredecessorState' IS DISTINCT FROM bundle_value->'expectedPredecessorState'
      OR current_request_payload->>'evidencePolicyVersion' <> 'm04-evidence-policy-v1'
      OR current_request_payload->>'materialFieldRegistryVersion' <> 'm04-material-fields-v1'
      OR request_row.request_payload_byte_length <> octet_length(request_row.request_canonical_payload)
      OR request_row.request_payload_sha256 <> encode(digest(request_row.request_canonical_payload,'sha256'),'hex')
      OR request_row.request_fingerprint <> request_row.request_payload_sha256
      OR request_row.semantic_request_fingerprint <> encode(digest(convert_to(replace(replace(semantic_request,
        chr(57344)||chr(57344),chr(92)||'u0000'),
        chr(57344)||chr(57345),chr(57344)),'UTF8'),'sha256'),'hex')
      OR request_row.id <> 'm4q_' || encode(digest(convert_to(<S>.m04_canonical_json(jsonb_build_object(
        'schemaVersion','M04_REQUEST_RECORD_ID_V1','requestFingerprint',request_row.request_fingerprint)),'UTF8'),'sha256'),'hex')
    THEN RAISE EXCEPTION 'M04_FULL_CLOSURE_REQUEST_INVALID'; END IF;
  END LOOP;
  IF NOT FOUND THEN RAISE EXCEPTION 'M04_FULL_CLOSURE_REQUEST_MISSING'; END IF;

  SELECT 'bnd_' || encode(digest(convert_to(<S>.m04_canonical_json(jsonb_build_object(
    'schemaVersion','M04_BINDING_ID_V1','extractionId',target_extraction_id,
    'logicalPayloadSha256',bundle.logical_payload_sha256,
    'evidencePolicyVersion',request_payload->>'evidencePolicyVersion',
    'materialFieldRegistryVersion',request_payload->>'materialFieldRegistryVersion',
    'evidenceItemIds',coalesce((SELECT jsonb_agg(id ORDER BY convert_to(id,'UTF8')) FROM <S>.m04_evidence_items WHERE extraction_id=target_extraction_id),'[]'::jsonb),
    'claimIds',coalesce((SELECT jsonb_agg(claim.id ORDER BY field_ordinal) FROM jsonb_array_elements(bundle_value->'fields') WITH ORDINALITY field(value,field_ordinal)
      JOIN <S>.m04_claims claim ON claim.extraction_id=target_extraction_id AND claim.field_key=field.value->>'fieldKey'),'[]'::jsonb),
    'linkIds',coalesce((SELECT jsonb_agg(link.id ORDER BY field_ordinal,link.ordinal) FROM jsonb_array_elements(bundle_value->'fields') WITH ORDINALITY field(value,field_ordinal)
      JOIN <S>.m04_claims claim ON claim.extraction_id=target_extraction_id AND claim.field_key=field.value->>'fieldKey'
      JOIN <S>.m04_claim_evidence_links link ON link.claim_id=claim.id),'[]'::jsonb),
    'completenessId',expected_completeness_id)),'UTF8'),'sha256'),'hex')
    INTO expected_binding_id
    FROM <S>.m03_extraction_bundles bundle,
      LATERAL (SELECT regexp_replace(replace(convert_from(request_canonical_payload,'UTF8'),chr(57344),chr(57344)||chr(57345)),
    '(?<!\\)((?:\\\\)*)\\u0000','\1'||chr(57344)||chr(57344),'g')::jsonb request_payload
        FROM <S>.m04_binding_requests request JOIN <S>.m04_binding_results result ON result.id=request.result_id
        WHERE result.extraction_id=target_extraction_id ORDER BY request.created_at LIMIT 1) request
   WHERE bundle.extraction_id=target_extraction_id;
  IF NOT EXISTS (SELECT 1 FROM <S>.m04_binding_results WHERE extraction_id=target_extraction_id
      AND binding_id=expected_binding_id AND completeness_id=expected_completeness_id)
  THEN RAISE EXCEPTION 'M04_FULL_CLOSURE_BINDING_INVALID'; END IF;
END;
$$;

CREATE FUNCTION <S>.m04_validate_full_binding_closure() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_extraction_id text;
BEGIN
  IF TG_TABLE_NAME='m04_binding_requests' THEN
    SELECT extraction_id INTO target_extraction_id FROM <S>.m04_binding_results WHERE id=NEW.result_id;
  ELSIF TG_TABLE_NAME='m04_claim_evidence_links' THEN
    SELECT extraction_id INTO target_extraction_id FROM <S>.m04_claims WHERE id=NEW.claim_id;
  ELSE
    target_extraction_id := NEW.extraction_id;
  END IF;
  -- Child inserts run this guard immediately AFTER their nondeferrable FKs.
  -- New bundles retain parent/result/request deferred whole-binding checks;
  -- already sealed bindings reject any child extension.
  IF TG_TABLE_NAME IN ('m04_evidence_items','m04_claims','m04_claim_evidence_links','m04_completeness_snapshots') THEN
    IF EXISTS (SELECT 1 FROM <S>.m04_binding_results WHERE extraction_id=target_extraction_id) THEN
      RAISE EXCEPTION 'M04_IMMUTABLE_RECORD';
    END IF;
    RETURN NEW;
  END IF;
  PERFORM <S>.m04_assert_binding_closure(target_extraction_id);
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER m04_full_bundle_closure AFTER INSERT ON m03_extraction_bundles
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION m04_validate_full_binding_closure();
CREATE CONSTRAINT TRIGGER m04_full_request_closure AFTER INSERT ON m04_binding_requests
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION m04_validate_full_binding_closure();
CREATE TRIGGER m04_full_evidence_closure AFTER INSERT ON m04_evidence_items
FOR EACH ROW EXECUTE FUNCTION m04_validate_full_binding_closure();
CREATE TRIGGER m04_full_claim_closure AFTER INSERT ON m04_claims
FOR EACH ROW EXECUTE FUNCTION m04_validate_full_binding_closure();
CREATE TRIGGER m04_full_link_closure AFTER INSERT ON m04_claim_evidence_links
FOR EACH ROW EXECUTE FUNCTION m04_validate_full_binding_closure();
CREATE TRIGGER m04_full_completeness_closure AFTER INSERT ON m04_completeness_snapshots
FOR EACH ROW EXECUTE FUNCTION m04_validate_full_binding_closure();
CREATE CONSTRAINT TRIGGER m04_full_result_closure AFTER INSERT ON m04_binding_results
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION m04_validate_full_binding_closure();

CREATE TRIGGER schema_migrations_immutable BEFORE UPDATE OR DELETE ON schema_migrations
FOR EACH ROW EXECUTE FUNCTION m04_reject_immutable_mutation();
CREATE TRIGGER source_snapshots_m04_immutable BEFORE UPDATE OR DELETE ON source_snapshots
FOR EACH ROW EXECUTE FUNCTION m04_reject_immutable_mutation();
CREATE TRIGGER acquisition_results_m04_immutable BEFORE UPDATE OR DELETE ON acquisition_results
FOR EACH ROW EXECUTE FUNCTION m04_reject_immutable_mutation();
CREATE TRIGGER m01_source_entries_m04_immutable BEFORE UPDATE OR DELETE ON m01_source_entries
FOR EACH ROW EXECUTE FUNCTION m04_reject_immutable_mutation();
CREATE TRIGGER m01_source_documents_m04_immutable BEFORE UPDATE OR DELETE ON m01_source_documents
FOR EACH ROW EXECUTE FUNCTION m04_reject_immutable_mutation();
CREATE TRIGGER resource_version_observations_m04_immutable BEFORE UPDATE OR DELETE ON resource_version_observations
FOR EACH ROW EXECUTE FUNCTION m04_reject_immutable_mutation();

CREATE TRIGGER m03_extraction_bundles_immutable BEFORE UPDATE OR DELETE ON m03_extraction_bundles
FOR EACH ROW EXECUTE FUNCTION m04_reject_immutable_mutation();
CREATE TRIGGER m03_extraction_bundle_chunks_immutable BEFORE UPDATE OR DELETE ON m03_extraction_bundle_chunks
FOR EACH ROW EXECUTE FUNCTION m04_reject_immutable_mutation();
CREATE TRIGGER m04_binding_requests_immutable BEFORE UPDATE OR DELETE ON m04_binding_requests
FOR EACH ROW EXECUTE FUNCTION m04_reject_immutable_mutation();
CREATE TRIGGER m04_evidence_items_immutable BEFORE UPDATE OR DELETE ON m04_evidence_items
FOR EACH ROW EXECUTE FUNCTION m04_reject_immutable_mutation();
CREATE TRIGGER m04_claims_immutable BEFORE UPDATE OR DELETE ON m04_claims
FOR EACH ROW EXECUTE FUNCTION m04_reject_immutable_mutation();
CREATE TRIGGER m04_claim_evidence_links_immutable BEFORE UPDATE OR DELETE ON m04_claim_evidence_links
FOR EACH ROW EXECUTE FUNCTION m04_reject_immutable_mutation();
CREATE TRIGGER m04_completeness_snapshots_immutable BEFORE UPDATE OR DELETE ON m04_completeness_snapshots
FOR EACH ROW EXECUTE FUNCTION m04_reject_immutable_mutation();
CREATE TRIGGER m04_binding_results_immutable BEFORE UPDATE OR DELETE ON m04_binding_results
FOR EACH ROW EXECUTE FUNCTION m04_reject_immutable_mutation();

DO $m04_function_search_path$
DECLARE function_row record; owning_schema text := current_schema();
BEGIN
  FOR function_row IN
    SELECT p.oid::regprocedure signature
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname=owning_schema
       AND NOT EXISTS (SELECT 1 FROM pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
         WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO %I, public', function_row.signature, owning_schema);
  END LOOP;
END;
$m04_function_search_path$;

DO $m03_m04_role_prerequisites$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
     WHERE rolname = 'ai_ark_m04_runtime' AND NOT rolcanlogin AND NOT rolsuper
       AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_roles
     WHERE rolname = 'ai_ark_m01_m02_writer' AND NOT rolcanlogin AND NOT rolsuper
       AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication
  ) OR current_user IN ('ai_ark_m04_runtime', 'ai_ark_m01_m02_writer')
    OR EXISTS (
      SELECT 1 FROM pg_auth_members membership
      JOIN pg_roles parent_role ON parent_role.oid = membership.roleid
      JOIN pg_roles member_role ON member_role.oid = membership.member
      WHERE (parent_role.rolname, member_role.rolname) IN (
        ('ai_ark_m04_runtime', 'ai_ark_m01_m02_writer'),
        ('ai_ark_m01_m02_writer', 'ai_ark_m04_runtime')
      )
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'M03_M04_ROLE_PREREQUISITE_INVALID';
  END IF;
END;
$m03_m04_role_prerequisites$;

CREATE TABLE <S>.m03_m04_predecessor_fence (
  singleton_key boolean PRIMARY KEY DEFAULT true CHECK (singleton_key = true),
  epoch bigint NOT NULL CHECK (epoch >= 1)
);

INSERT INTO <S>.m03_m04_predecessor_fence (singleton_key, epoch) VALUES (true, 1);

CREATE FUNCTION <S>.m03_m04_lock_predecessor_shared() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  locked_epoch bigint;
  affected_rows bigint;
BEGIN
  SELECT epoch INTO locked_epoch
  FROM <S>.m03_m04_predecessor_fence
  WHERE singleton_key = true
  FOR SHARE;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'M03_M04_PREDECESSOR_FENCE_INVALID';
  END IF;
  RETURN locked_epoch;
END;
$$;

CREATE FUNCTION <S>.m03_m04_lock_predecessor_exclusive() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  locked_epoch bigint;
  affected_rows bigint;
BEGIN
  SELECT epoch INTO locked_epoch
  FROM <S>.m03_m04_predecessor_fence
  WHERE singleton_key = true
  FOR UPDATE;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'M03_M04_PREDECESSOR_FENCE_INVALID';
  END IF;
  RETURN locked_epoch;
END;
$$;

CREATE FUNCTION <S>.m03_m04_bump_predecessor_epoch() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE affected_rows bigint;
BEGIN
  UPDATE <S>.m03_m04_predecessor_fence
  SET epoch = epoch + 1
  WHERE singleton_key = true;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'M03_M04_PREDECESSOR_FENCE_INVALID';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER m03_m04_fence_acquisition_jobs_stmt BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON acquisition_jobs FOR EACH STATEMENT EXECUTE FUNCTION <S>.m03_m04_bump_predecessor_epoch();
CREATE TRIGGER m03_m04_fence_acquisition_results_stmt BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON acquisition_results FOR EACH STATEMENT EXECUTE FUNCTION <S>.m03_m04_bump_predecessor_epoch();
CREATE TRIGGER m03_m04_fence_candidate_root_ownership_stmt BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON candidate_root_ownership FOR EACH STATEMENT EXECUTE FUNCTION <S>.m03_m04_bump_predecessor_epoch();
CREATE TRIGGER m03_m04_fence_candidate_roots_stmt BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON candidate_roots FOR EACH STATEMENT EXECUTE FUNCTION <S>.m03_m04_bump_predecessor_epoch();
CREATE TRIGGER m03_m04_fence_identity_decisions_stmt BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON identity_decisions FOR EACH STATEMENT EXECUTE FUNCTION <S>.m03_m04_bump_predecessor_epoch();
CREATE TRIGGER m03_m04_fence_m01_source_documents_stmt BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON m01_source_documents FOR EACH STATEMENT EXECUTE FUNCTION <S>.m03_m04_bump_predecessor_epoch();
CREATE TRIGGER m03_m04_fence_m01_source_entries_stmt BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON m01_source_entries FOR EACH STATEMENT EXECUTE FUNCTION <S>.m03_m04_bump_predecessor_epoch();
CREATE TRIGGER m03_m04_fence_m02_identity_handoff_markers_stmt BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON m02_identity_handoff_markers FOR EACH STATEMENT EXECUTE FUNCTION <S>.m03_m04_bump_predecessor_epoch();
CREATE TRIGGER m03_m04_fence_m02_jobs_stmt BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON m02_jobs FOR EACH STATEMENT EXECUTE FUNCTION <S>.m03_m04_bump_predecessor_epoch();
CREATE TRIGGER m03_m04_fence_m02_review_states_stmt BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON m02_review_states FOR EACH STATEMENT EXECUTE FUNCTION <S>.m03_m04_bump_predecessor_epoch();
CREATE TRIGGER m03_m04_fence_repository_candidate_root_order_stmt BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON repository_candidate_root_order FOR EACH STATEMENT EXECUTE FUNCTION <S>.m03_m04_bump_predecessor_epoch();
CREATE TRIGGER m03_m04_fence_resource_candidates_stmt BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON resource_candidates FOR EACH STATEMENT EXECUTE FUNCTION <S>.m03_m04_bump_predecessor_epoch();
CREATE TRIGGER m03_m04_fence_resource_identities_stmt BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON resource_identities FOR EACH STATEMENT EXECUTE FUNCTION <S>.m03_m04_bump_predecessor_epoch();
CREATE TRIGGER m03_m04_fence_resource_source_links_stmt BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON resource_source_links FOR EACH STATEMENT EXECUTE FUNCTION <S>.m03_m04_bump_predecessor_epoch();
CREATE TRIGGER m03_m04_fence_resource_version_identities_stmt BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON resource_version_identities FOR EACH STATEMENT EXECUTE FUNCTION <S>.m03_m04_bump_predecessor_epoch();
CREATE TRIGGER m03_m04_fence_resource_version_observations_stmt BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON resource_version_observations FOR EACH STATEMENT EXECUTE FUNCTION <S>.m03_m04_bump_predecessor_epoch();
CREATE TRIGGER m03_m04_fence_source_repository_identities_stmt BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON source_repository_identities FOR EACH STATEMENT EXECUTE FUNCTION <S>.m03_m04_bump_predecessor_epoch();
CREATE TRIGGER m03_m04_fence_source_snapshots_stmt BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON source_snapshots FOR EACH STATEMENT EXECUTE FUNCTION <S>.m03_m04_bump_predecessor_epoch();

REVOKE ALL ON <S>.m03_m04_predecessor_fence FROM PUBLIC, ai_ark_m04_runtime, ai_ark_m01_m02_writer;
REVOKE ALL ON SCHEMA <S> FROM PUBLIC, ai_ark_m04_runtime, ai_ark_m01_m02_writer;
GRANT USAGE ON SCHEMA <S> TO ai_ark_m04_runtime, ai_ark_m01_m02_writer;
REVOKE EXECUTE ON FUNCTION <S>.m03_m04_lock_predecessor_shared() FROM PUBLIC, ai_ark_m04_runtime, ai_ark_m01_m02_writer;
REVOKE EXECUTE ON FUNCTION <S>.m03_m04_lock_predecessor_exclusive() FROM PUBLIC, ai_ark_m04_runtime, ai_ark_m01_m02_writer;
REVOKE EXECUTE ON FUNCTION <S>.m03_m04_bump_predecessor_epoch() FROM PUBLIC, ai_ark_m04_runtime, ai_ark_m01_m02_writer;
GRANT EXECUTE ON FUNCTION <S>.m03_m04_lock_predecessor_shared() TO ai_ark_m04_runtime;
GRANT EXECUTE ON FUNCTION <S>.m03_m04_lock_predecessor_exclusive() TO ai_ark_m01_m02_writer;

REVOKE EXECUTE ON FUNCTION <S>.m04_canonical_json(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION <S>.m04_payload_is_canonical_json(bytea) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION <S>.m04_reject_immutable_mutation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION <S>.m04_validate_bundle_chunks() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION <S>.m04_validate_canonical_record() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION <S>.m04_validate_accepted_result() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION <S>.m04_validate_link_lineage() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION <S>.m04_assert_binding_closure(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION <S>.m04_validate_full_binding_closure() FROM PUBLIC;

DO $$
DECLARE function_row record;
BEGIN
  FOR function_row IN
    SELECT format('%I.%I(%s)', n.nspname,p.proname,oidvectortypes(p.proargtypes)) signature
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.oid='<S>'::regnamespace
       AND NOT EXISTS (
         SELECT 1 FROM pg_depend d
          WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e'
       )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', function_row.signature);
  END LOOP;
END;
$$;

<M04_RUNTIME_GRANTS>
