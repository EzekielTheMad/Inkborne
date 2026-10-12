-- R09.3a REVIEW TEXT ONLY. Not a migration; never auto-applied.
-- The production dependency reader ALWAYS raises unavailable. No enable API.
-- Writer fences/global locking/semantic order/lifecycle and G2 are prerequisites.
-- Entire deployment must remain one transaction, including ownership and ACLs.
BEGIN;
CREATE ROLE inkborne_hit_die_kernel_owner NOLOGIN NOBYPASSRLS NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT USAGE ON SCHEMA public, private TO inkborne_hit_die_kernel_owner;
-- Deployment authority alone creates/transfers objects; runtime owner has no
-- schema CREATE and no caller receives membership in this role.
DO $$ BEGIN
  IF pg_catalog.has_schema_privilege('inkborne_hit_die_kernel_owner', 'public', 'CREATE')
    OR pg_catalog.has_schema_privilege('inkborne_hit_die_kernel_owner', 'private', 'CREATE') THEN
    RAISE EXCEPTION 'Inherited schema CREATE must be reconciled by deployment review' USING ERRCODE = '42501';
  END IF;
END $$;
ALTER TABLE public.characters ADD COLUMN action_revision bigint NOT NULL DEFAULT 0 CHECK (action_revision >= 0);
CREATE TABLE private.hit_die_gate_v1 (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false
);
INSERT INTO private.hit_die_gate_v1(singleton, enabled) VALUES (true, false);
ALTER TABLE private.hit_die_gate_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.hit_die_gate_v1 FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON private.hit_die_gate_v1 TO inkborne_hit_die_kernel_owner;
CREATE POLICY hit_die_kernel_gate_read ON private.hit_die_gate_v1
  FOR SELECT TO inkborne_hit_die_kernel_owner USING (true);

CREATE TABLE private.character_action_receipts (
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  canonical_intent text NOT NULL,
  intent_json jsonb NOT NULL,
  dependency_fingerprint text NOT NULL CHECK (dependency_fingerprint ~ '^[a-f0-9]{64}$'),
  before_revision bigint NOT NULL CHECK (before_revision >= 0),
  after_revision bigint NOT NULL CHECK (after_revision > before_revision),
  verified_actor_id uuid NOT NULL, -- deliberately no profile cascade
  linked_roll_id uuid NOT NULL UNIQUE,
  native_evaluated_at timestamptz NOT NULL,
  accepted_at timestamptz NOT NULL,
  valid_until timestamptz,
  receipt jsonb NOT NULL CHECK (jsonb_typeof(receipt) = 'object'),
  PRIMARY KEY (character_id, operation_id),
  CHECK (accepted_at >= native_evaluated_at),
  CHECK (valid_until IS NULL OR accepted_at < valid_until)
);
ALTER TABLE private.character_action_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.character_action_receipts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON private.character_action_receipts TO inkborne_hit_die_kernel_owner;
CREATE POLICY hit_die_kernel_receipt_read ON private.character_action_receipts
  FOR SELECT TO inkborne_hit_die_kernel_owner USING (true);
CREATE POLICY hit_die_kernel_receipt_insert ON private.character_action_receipts
  FOR INSERT TO inkborne_hit_die_kernel_owner WITH CHECK (true);
GRANT SELECT ON public.characters TO inkborne_hit_die_kernel_owner;
GRANT UPDATE (state, action_revision) ON public.characters TO inkborne_hit_die_kernel_owner;
CREATE POLICY hit_die_kernel_character_read ON public.characters
  FOR SELECT TO inkborne_hit_die_kernel_owner USING (true);
CREATE POLICY hit_die_kernel_character_update ON public.characters
  FOR UPDATE TO inkborne_hit_die_kernel_owner USING (true) WITH CHECK (true);

ALTER TABLE public.character_rolls ADD COLUMN action_operation_id uuid;
ALTER TABLE public.character_rolls ADD CONSTRAINT hit_die_roll_identity UNIQUE (id, character_id, action_operation_id);
CREATE UNIQUE INDEX hit_die_roll_one_per_operation ON public.character_rolls(character_id, action_operation_id)
  WHERE action_operation_id IS NOT NULL;
ALTER TABLE public.character_rolls ADD CONSTRAINT hit_die_roll_receipt_fk
  FOREIGN KEY (character_id, action_operation_id) REFERENCES private.character_action_receipts(character_id, operation_id)
  DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE private.character_action_receipts ADD CONSTRAINT hit_die_receipt_linked_roll_fk
  FOREIGN KEY (linked_roll_id, character_id, operation_id) REFERENCES public.character_rolls(id, character_id, action_operation_id)
  DEFERRABLE INITIALLY DEFERRED;
-- Restrictive policy composes with existing permissive owner insert policy.
CREATE POLICY hit_die_normal_roll_unlinked ON public.character_rolls AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (action_operation_id IS NULL);
GRANT SELECT, INSERT ON public.character_rolls TO inkborne_hit_die_kernel_owner;
CREATE POLICY hit_die_kernel_roll_read ON public.character_rolls
  FOR SELECT TO inkborne_hit_die_kernel_owner USING (true);
CREATE POLICY hit_die_kernel_roll_insert ON public.character_rolls
  FOR INSERT TO inkborne_hit_die_kernel_owner WITH CHECK (action_operation_id IS NOT NULL);

CREATE FUNCTION private.hit_die_exact_keys_v1(value jsonb, keys text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN pg_catalog.jsonb_typeof(value) = 'object' THEN
    value ?& keys AND (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(value)) = pg_catalog.cardinality(keys)
    ELSE false END
$$;
CREATE FUNCTION private.hit_die_intent_v1(request jsonb, canonical text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE intent jsonb; revision bigint;
BEGIN
  IF NOT private.hit_die_exact_keys_v1(request, ARRAY['contract_version','character_id','operation_id','command','class_slug','expected_revision','dependency_fingerprint'])
    OR request->'contract_version' IS DISTINCT FROM '1'::jsonb OR request->>'command' IS DISTINCT FROM 'spend_hit_die'
    OR pg_catalog.jsonb_typeof(request->'class_slug') IS DISTINCT FROM 'string' OR pg_catalog.length(request->>'class_slug') NOT BETWEEN 1 AND 200
    OR pg_catalog.jsonb_typeof(request->'expected_revision') IS DISTINCT FROM 'string' OR (request->>'expected_revision') !~ '^(0|[1-9][0-9]{0,18})$'
    OR pg_catalog.jsonb_typeof(request->'dependency_fingerprint') IS DISTINCT FROM 'string' OR (request->>'dependency_fingerprint') !~ '^[a-f0-9]{64}$'
    OR pg_catalog.jsonb_typeof(request->'character_id') IS DISTINCT FROM 'string' OR pg_catalog.jsonb_typeof(request->'operation_id') IS DISTINCT FROM 'string'
    OR canonical IS NULL THEN RETURN NULL; END IF;
  PERFORM (request->>'character_id')::uuid, (request->>'operation_id')::uuid;
  revision := (request->>'expected_revision')::bigint;
  intent := (request - 'operation_id') || '{"canonical_version":1}'::jsonb;
  IF canonical::jsonb IS DISTINCT FROM intent THEN RETURN NULL; END IF;
  RETURN intent;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN NULL;
END $$;

CREATE FUNCTION private.hit_die_millis_v1(instant timestamptz) RETURNS text
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT pg_catalog.to_char(pg_catalog.date_trunc('milliseconds', instant) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;
CREATE FUNCTION private.hit_die_native_v1(instant timestamptz) RETURNS text
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT pg_catalog.to_char(instant AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
$$;
CREATE FUNCTION private.hit_die_deadline_v1(state jsonb, evaluated_at timestamptz) RETURNS timestamptz
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE effect jsonb; raw text; expiry timestamptz; deadline timestamptz;
BEGIN
  IF NOT pg_catalog.isfinite(evaluated_at) OR evaluated_at < '0001-01-01T00:00:00Z'::timestamptz
    OR evaluated_at >= '10000-01-01T00:00:00Z'::timestamptz THEN
    RAISE EXCEPTION 'Unsupported evaluation instant' USING ERRCODE = '22023'; END IF;
  IF state ? 'active_effects' AND pg_catalog.jsonb_typeof(state->'active_effects') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Unreadable active effects' USING ERRCODE = '22023'; END IF;
  FOR effect IN SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(state->'active_effects', '[]'::jsonb)) LOOP
    IF pg_catalog.jsonb_typeof(effect) IS DISTINCT FROM 'object' OR NOT effect ? 'expires_at' THEN
      RAISE EXCEPTION 'Unreadable expiry' USING ERRCODE = '22023'; END IF;
    IF effect->'expires_at' = 'null'::jsonb THEN CONTINUE; END IF;
    raw := effect->>'expires_at';
    IF pg_catalog.jsonb_typeof(effect->'expires_at') IS DISTINCT FROM 'string'
      OR raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' OR pg_catalog.left(raw, 4) = '0000' THEN
      RAISE EXCEPTION 'Unsupported expiry precision/profile' USING ERRCODE = '22023'; END IF;
    expiry := raw::timestamptz;
    IF NOT pg_catalog.isfinite(expiry) OR private.hit_die_millis_v1(expiry) IS DISTINCT FROM raw
      OR expiry IS DISTINCT FROM pg_catalog.date_trunc('milliseconds', expiry) THEN
      RAISE EXCEPTION 'Unsupported expiry round trip' USING ERRCODE = '22023'; END IF;
    IF expiry > evaluated_at AND (deadline IS NULL OR expiry < deadline) THEN deadline := expiry; END IF;
  END LOOP;
  RETURN deadline;
END $$;

CREATE FUNCTION private.read_locked_hit_die_dependencies_v1(p_character_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
BEGIN
  -- UNAVAILABLE BY DESIGN: never substitute caller JSON, mutable catalog data,
  -- an empty access array, or a separately requested/cached snapshot here.
  RAISE EXCEPTION 'Hit-die dependency authority, writer fences and lock protocol unavailable' USING ERRCODE = 'P0001';
END $$;

CREATE FUNCTION private.preserve_hit_die_receipt_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR EXISTS (SELECT 1 FROM public.characters WHERE id = OLD.character_id) THEN
    RAISE EXCEPTION 'Character-lifetime hit-die receipt is immutable' USING ERRCODE = '23514'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER preserve_hit_die_receipt BEFORE UPDATE OR DELETE ON private.character_action_receipts
  FOR EACH ROW EXECUTE FUNCTION private.preserve_hit_die_receipt_v1();
CREATE FUNCTION private.preserve_hit_die_roll_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.action_operation_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM private.character_action_receipts r WHERE r.character_id = NEW.character_id
        AND r.operation_id = NEW.action_operation_id AND r.linked_roll_id = NEW.id
        AND r.verified_actor_id = NEW.user_id AND r.receipt->'roll' = NEW.result) THEN
      RAISE EXCEPTION 'Accepted action link requires its immutable receipt' USING ERRCODE = '23514'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.action_operation_id IS NOT NULL AND (TG_OP = 'UPDATE' OR EXISTS (SELECT 1 FROM public.characters WHERE id = OLD.character_id)) THEN
    -- Existing profile cascade can now fail safely while character survives.
    -- Profile/transfer/character cascade lifecycle compatibility remains G2.
    RAISE EXCEPTION 'Accepted action roll is immutable' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.action_operation_id IS NOT NULL THEN RAISE EXCEPTION 'Cannot attach an existing roll' USING ERRCODE = '23514'; END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER preserve_hit_die_roll BEFORE INSERT OR UPDATE OR DELETE ON public.character_rolls
  FOR EACH ROW EXECUTE FUNCTION private.preserve_hit_die_roll_v1();

CREATE FUNCTION public.read_hit_die_receipt_v1(p_actor_id uuid, p_request jsonb, p_canonical_intent text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.characters%ROWTYPE; r private.character_action_receipts%ROWTYPE; intent jsonb;
BEGIN
  intent := private.hit_die_intent_v1(p_request, p_canonical_intent);
  IF intent IS NULL THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
  SELECT * INTO c FROM public.characters WHERE id = (p_request->>'character_id')::uuid AND user_id = p_actor_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"status":"inaccessible"}'::jsonb; END IF;
  SELECT * INTO r FROM private.character_action_receipts WHERE character_id = c.id AND operation_id = (p_request->>'operation_id')::uuid;
  IF NOT FOUND THEN RETURN '{"status":"absent"}'::jsonb; END IF;
  IF r.canonical_intent IS DISTINCT FROM p_canonical_intent THEN RETURN '{"status":"operation_conflict"}'::jsonb; END IF;
  RETURN pg_catalog.jsonb_build_object('status', 'replayed', 'receipt', r.receipt);
END $$;

CREATE FUNCTION public.resolve_hit_die_snapshot_v1(p_actor_id uuid, p_character_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.characters%ROWTYPE; snapshot jsonb; native_evaluation timestamptz; deadline timestamptz;
BEGIN
  SELECT * INTO c FROM public.characters WHERE id = p_character_id AND user_id = p_actor_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"status":"inaccessible"}'::jsonb; END IF;
  IF NOT COALESCE((SELECT enabled FROM private.hit_die_gate_v1 WHERE singleton), false) THEN RETURN '{"status":"disabled"}'::jsonb; END IF;
  IF c.archived THEN RETURN '{"status":"unavailable"}'::jsonb; END IF;
  snapshot := private.read_locked_hit_die_dependencies_v1(c.id); -- unconditional unavailable in this stage
  native_evaluation := pg_catalog.clock_timestamp();
  deadline := private.hit_die_deadline_v1(snapshot#>'{character,state}', native_evaluation);
  RETURN pg_catalog.jsonb_build_object('status', 'resolved', 'snapshot', snapshot,
    'native_evaluated_at', private.hit_die_native_v1(native_evaluation), 'evaluated_at', private.hit_die_millis_v1(native_evaluation),
    'valid_until', CASE WHEN deadline IS NULL THEN NULL ELSE private.hit_die_millis_v1(deadline) END);
END $$;

CREATE FUNCTION public.commit_hit_die_v1(p_actor_id uuid, p_request jsonb, p_snapshot jsonb, p_candidate jsonb,
  p_canonical_intent text, p_native_evaluated_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.characters%ROWTYPE; lookup jsonb; intent jsonb; current_snapshot jsonb;
  deadline timestamptz; accepted timestamptz; evaluated text; checked timestamptz;
  cls jsonb; class_pin jsonb; pool_count integer; class_count integer; die numeric; spent numeric; current_hp numeric; max_hp numeric;
  con numeric; modifier numeric; face numeric; total numeric; healed numeric; next_hp numeric; roll jsonb; expected_patch jsonb; next_state jsonb;
  linked_id uuid; receipt jsonb; expression text; source_revision bigint;
BEGIN
  intent := private.hit_die_intent_v1(p_request, p_canonical_intent);
  IF intent IS NULL THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
  SELECT * INTO c FROM public.characters WHERE id = (p_request->>'character_id')::uuid AND user_id = p_actor_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"status":"inaccessible"}'::jsonb; END IF;
  -- Same parent lock/transaction. Replay deliberately precedes gate, pins,
  -- candidate/time validation and every mutation; no old state application.
  lookup := public.read_hit_die_receipt_v1(p_actor_id, p_request, p_canonical_intent);
  IF lookup->>'status' <> 'absent' THEN RETURN lookup; END IF;
  IF NOT COALESCE((SELECT enabled FROM private.hit_die_gate_v1 WHERE singleton), false) THEN RETURN '{"status":"disabled"}'::jsonb; END IF;
  IF c.archived THEN RETURN '{"status":"unavailable"}'::jsonb; END IF;
  source_revision := (p_request->>'expected_revision')::bigint;
  IF source_revision IS DISTINCT FROM c.action_revision THEN RETURN '{"status":"revision_conflict"}'::jsonb; END IF;
  IF c.action_revision = 9223372036854775807 THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
  current_snapshot := private.read_locked_hit_die_dependencies_v1(c.id); -- NEVER trusts p_snapshot as reader
  IF current_snapshot IS DISTINCT FROM p_snapshot OR current_snapshot#>>'{character,id}' IS DISTINCT FROM c.id::text
    OR current_snapshot#>>'{character,owner_id}' IS DISTINCT FROM p_actor_id::text
    OR current_snapshot#>>'{character,revision}' IS DISTINCT FROM c.action_revision::text
    OR current_snapshot#>'{character,state}' IS DISTINCT FROM c.state THEN RETURN '{"status":"revision_conflict"}'::jsonb; END IF;
  -- Only this pre-write validation block converts parse/domain errors to invalid.
  -- There is deliberately NO catch around receipt/state/roll mutations.
  BEGIN
    IF NOT private.hit_die_exact_keys_v1(p_candidate, ARRAY['status','request','canonical_intent','dependency_fingerprint','baseline_constitution','live_constitution','max_hp','evaluated_at','acceptance_checked_at','valid_until','roll','patch'])
      OR p_candidate->>'status' IS DISTINCT FROM 'planned' OR p_candidate->'request' IS DISTINCT FROM p_request
      OR p_candidate->>'canonical_intent' IS DISTINCT FROM p_canonical_intent
      OR p_candidate->>'dependency_fingerprint' IS DISTINCT FROM p_request->>'dependency_fingerprint' THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
    evaluated := p_candidate->>'evaluated_at';
    IF p_native_evaluated_at IS NULL OR NOT pg_catalog.isfinite(p_native_evaluated_at)
      OR evaluated IS DISTINCT FROM private.hit_die_millis_v1(p_native_evaluated_at)
      OR evaluated !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
    deadline := private.hit_die_deadline_v1(c.state, p_native_evaluated_at);
    IF p_candidate->'valid_until' IS DISTINCT FROM COALESCE(pg_catalog.to_jsonb(private.hit_die_millis_v1(deadline)), 'null'::jsonb)
      OR pg_catalog.jsonb_typeof(p_candidate->'acceptance_checked_at') IS DISTINCT FROM 'string'
      OR p_candidate->>'acceptance_checked_at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
    checked := (p_candidate->>'acceptance_checked_at')::timestamptz;
    IF checked < evaluated::timestamptz OR (deadline IS NOT NULL AND checked >= deadline)
      OR private.hit_die_millis_v1(checked) IS DISTINCT FROM p_candidate->>'acceptance_checked_at' THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
    SELECT pg_catalog.count(*) INTO class_count FROM pg_catalog.jsonb_array_elements(current_snapshot#>'{character,choices,classes}') entry WHERE entry->>'slug' = p_request->>'class_slug';
    SELECT entry INTO cls FROM pg_catalog.jsonb_array_elements(current_snapshot#>'{character,choices,classes}') entry WHERE entry->>'slug' = p_request->>'class_slug';
    SELECT pg_catalog.count(*) INTO pool_count FROM pg_catalog.jsonb_array_elements(current_snapshot->'pins') entry WHERE entry#>>'{resolved,content_type}' = 'class' AND entry#>>'{resolved,slug}' = p_request->>'class_slug';
    SELECT entry INTO class_pin FROM pg_catalog.jsonb_array_elements(current_snapshot->'pins') entry WHERE entry#>>'{resolved,content_type}' = 'class' AND entry#>>'{resolved,slug}' = p_request->>'class_slug';
    IF class_count <> 1 OR pool_count <> 1 OR class_pin#>>'{resolved,id}' IS DISTINCT FROM class_pin->>'content_id'
      OR class_pin#>'{resolved,version}' IS DISTINCT FROM class_pin->'content_version' THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
    die := (class_pin#>>'{resolved,data,hit_die}')::numeric;
    IF pg_catalog.jsonb_typeof(class_pin#>'{resolved,data,hit_die}') IS DISTINCT FROM 'number'
      OR pg_catalog.jsonb_typeof(cls->'level') IS DISTINCT FROM 'number'
      OR pg_catalog.jsonb_typeof(c.state->'current_hp') IS DISTINCT FROM 'number'
      OR pg_catalog.jsonb_typeof(c.state->'hit_dice_spent') IS DISTINCT FROM 'object'
      OR pg_catalog.jsonb_typeof(c.state->'hit_dice_spent'->(p_request->>'class_slug')) IS DISTINCT FROM 'number'
      OR pg_catalog.jsonb_typeof(p_candidate->'max_hp') IS DISTINCT FROM 'number'
      OR pg_catalog.jsonb_typeof(p_candidate->'live_constitution') IS DISTINCT FROM 'number'
      OR pg_catalog.jsonb_typeof(p_candidate->'baseline_constitution') IS DISTINCT FROM 'number'
      OR (p_candidate->>'baseline_constitution')::numeric <> pg_catalog.trunc((p_candidate->>'baseline_constitution')::numeric)
      OR pg_catalog.abs((p_candidate->>'baseline_constitution')::numeric) > 9007199254740991 THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
    spent := (c.state->'hit_dice_spent'->>(p_request->>'class_slug'))::numeric;
    current_hp := (c.state->>'current_hp')::numeric; max_hp := (p_candidate->>'max_hp')::numeric;
    con := (p_candidate->>'live_constitution')::numeric; modifier := pg_catalog.floor((con - 10) / 2);
    roll := p_candidate->'roll';
    IF NOT private.hit_die_exact_keys_v1(roll, ARRAY['request','groups','modifier','total','rolled_at'])
      OR NOT private.hit_die_exact_keys_v1(roll->'request', ARRAY['kind','label','expression','meta'])
      OR NOT private.hit_die_exact_keys_v1(roll#>'{request,meta}', ARRAY['class_slug','con_mod'])
      OR pg_catalog.jsonb_typeof(roll->'groups') IS DISTINCT FROM 'array' OR pg_catalog.jsonb_array_length(roll->'groups') <> 1
      OR NOT private.hit_die_exact_keys_v1(roll#>'{groups,0}', ARRAY['sides','rolls','kept'])
      OR pg_catalog.jsonb_array_length(roll#>'{groups,0,rolls}') <> 1 OR pg_catalog.jsonb_array_length(roll#>'{groups,0,kept}') <> 1 THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
    IF pg_catalog.jsonb_typeof(roll->'modifier') IS DISTINCT FROM 'number' OR pg_catalog.jsonb_typeof(roll->'total') IS DISTINCT FROM 'number'
      OR pg_catalog.jsonb_typeof(roll#>'{groups,0,sides}') IS DISTINCT FROM 'number'
      OR pg_catalog.jsonb_typeof(roll#>'{groups,0,rolls,0}') IS DISTINCT FROM 'number'
      OR pg_catalog.jsonb_typeof(roll#>'{groups,0,kept,0}') IS DISTINCT FROM 'number'
      OR pg_catalog.jsonb_typeof(roll#>'{request,meta,con_mod}') IS DISTINCT FROM 'number' THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
    face := (roll#>>'{groups,0,rolls,0}')::numeric; total := (roll->>'total')::numeric;
    -- INT4 total range is checked before writes/casts; never narrow intermediates.
    IF total IS NULL OR total <> pg_catalog.trunc(total) OR total NOT BETWEEN -2147483648 AND 2147483647
      OR die IS NULL OR die <> pg_catalog.trunc(die) OR die NOT BETWEEN 1 AND 1000
      OR spent IS NULL OR spent <> pg_catalog.trunc(spent) OR spent < 0 OR spent >= (cls->>'level')::numeric
      OR (cls->>'level')::numeric NOT BETWEEN 1 AND 20
      OR current_hp IS NULL OR current_hp <> pg_catalog.trunc(current_hp) OR current_hp < 0 OR current_hp >= max_hp
      OR max_hp IS NULL OR max_hp <> pg_catalog.trunc(max_hp) OR max_hp NOT BETWEEN 1 AND 9007199254740991
      OR con IS NULL OR con <> pg_catalog.trunc(con) OR pg_catalog.abs(con) > 9007199254740991
      OR face IS NULL OR face <> pg_catalog.trunc(face) OR face NOT BETWEEN 1 AND die
      OR (roll#>>'{groups,0,sides}')::numeric IS DISTINCT FROM die
      OR (roll#>>'{groups,0,kept,0}')::numeric IS DISTINCT FROM face
      OR (roll->>'modifier')::numeric IS DISTINCT FROM modifier OR total IS DISTINCT FROM face + modifier
      OR roll#>>'{request,kind}' IS DISTINCT FROM 'hit_die' OR roll#>>'{request,meta,class_slug}' IS DISTINCT FROM p_request->>'class_slug'
      OR (roll#>>'{request,meta,con_mod}')::numeric IS DISTINCT FROM modifier OR roll->>'rolled_at' IS DISTINCT FROM evaluated
      OR pg_catalog.jsonb_typeof(roll#>'{request,label}') IS DISTINCT FROM 'string' OR pg_catalog.length(roll#>>'{request,label}') < 1 THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
    expression := '1d' || die::bigint::text || CASE WHEN modifier > 0 THEN '+' || modifier::bigint::text WHEN modifier < 0 THEN modifier::bigint::text ELSE '' END;
    IF roll#>>'{request,expression}' IS DISTINCT FROM expression THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
    healed := GREATEST(0, total); next_hp := LEAST(max_hp, current_hp + healed);
    expected_patch := pg_catalog.jsonb_build_object('current_hp', next_hp, 'hit_dice_spent',
      pg_catalog.jsonb_set(c.state->'hit_dice_spent', ARRAY[p_request->>'class_slug'], pg_catalog.to_jsonb(spent + 1), false));
    IF current_hp = 0 AND next_hp > 0 THEN expected_patch := expected_patch || '{"death_saves":{"successes":0,"failures":0}}'::jsonb; END IF;
    IF p_candidate->'patch' IS DISTINCT FROM expected_patch THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR invalid_parameter_value OR datetime_field_overflow THEN
    RETURN '{"status":"invalid"}'::jsonb;
  END;
  -- Native clock sampled AFTER all locks/validation, never transaction now().
  accepted := pg_catalog.clock_timestamp();
  IF p_native_evaluated_at > accepted OR checked > accepted THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
  IF deadline IS NOT NULL AND accepted >= deadline THEN RETURN '{"status":"expired"}'::jsonb; END IF;
  linked_id := pg_catalog.gen_random_uuid(); next_state := c.state || expected_patch;
  receipt := pg_catalog.jsonb_build_object('contract_version', 1, 'canonical_version', 1, 'request', p_request,
    'canonical_intent', p_canonical_intent, 'verified_actor_id', p_actor_id, 'dependency_snapshot', current_snapshot,
    'dependency_fingerprint', p_request->>'dependency_fingerprint', 'before_revision', c.action_revision::text,
    'after_revision', (c.action_revision + 1)::text, 'linked_roll_id', linked_id, 'roll', roll, 'patch', expected_patch,
    'evaluated_at', evaluated, 'native_evaluated_at', private.hit_die_native_v1(p_native_evaluated_at),
    'accepted_at', private.hit_die_native_v1(accepted), 'valid_until', CASE WHEN deadline IS NULL THEN NULL ELSE private.hit_die_millis_v1(deadline) END);
  INSERT INTO private.character_action_receipts(character_id, operation_id, canonical_intent, intent_json, dependency_fingerprint,
    before_revision, after_revision, verified_actor_id, linked_roll_id, native_evaluated_at, accepted_at, valid_until, receipt)
    VALUES (c.id, (p_request->>'operation_id')::uuid, p_canonical_intent, intent, p_request->>'dependency_fingerprint',
      c.action_revision, c.action_revision + 1, p_actor_id, linked_id, p_native_evaluated_at, accepted, deadline, receipt);
  UPDATE public.characters SET state = next_state, action_revision = c.action_revision + 1 WHERE id = c.id;
  INSERT INTO public.character_rolls(id, character_id, user_id, kind, label, expression, result, total, rolled_at, action_operation_id)
    VALUES (linked_id, c.id, p_actor_id, 'hit_die', roll#>>'{request,label}', expression, roll, total::integer, evaluated::timestamptz, (p_request->>'operation_id')::uuid);
  RETURN pg_catalog.jsonb_build_object('status', 'committed', 'receipt', receipt);
END $$;

-- Explicit ownership/ACL statements are inside the same installation transaction.
ALTER FUNCTION private.hit_die_exact_keys_v1(jsonb, text[]) OWNER TO inkborne_hit_die_kernel_owner;
ALTER FUNCTION private.hit_die_intent_v1(jsonb, text) OWNER TO inkborne_hit_die_kernel_owner;
ALTER FUNCTION private.hit_die_millis_v1(timestamptz) OWNER TO inkborne_hit_die_kernel_owner;
ALTER FUNCTION private.hit_die_native_v1(timestamptz) OWNER TO inkborne_hit_die_kernel_owner;
ALTER FUNCTION private.hit_die_deadline_v1(jsonb, timestamptz) OWNER TO inkborne_hit_die_kernel_owner;
ALTER FUNCTION private.read_locked_hit_die_dependencies_v1(uuid) OWNER TO inkborne_hit_die_kernel_owner;
ALTER FUNCTION private.preserve_hit_die_receipt_v1() OWNER TO inkborne_hit_die_kernel_owner;
ALTER FUNCTION private.preserve_hit_die_roll_v1() OWNER TO inkborne_hit_die_kernel_owner;
ALTER FUNCTION public.read_hit_die_receipt_v1(uuid, jsonb, text) OWNER TO inkborne_hit_die_kernel_owner;
ALTER FUNCTION public.resolve_hit_die_snapshot_v1(uuid, uuid) OWNER TO inkborne_hit_die_kernel_owner;
ALTER FUNCTION public.commit_hit_die_v1(uuid, jsonb, jsonb, jsonb, text, timestamptz) OWNER TO inkborne_hit_die_kernel_owner;
REVOKE ALL ON FUNCTION private.hit_die_exact_keys_v1(jsonb, text[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.hit_die_intent_v1(jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.hit_die_millis_v1(timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.hit_die_native_v1(timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.hit_die_deadline_v1(jsonb, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.read_locked_hit_die_dependencies_v1(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.preserve_hit_die_receipt_v1() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.preserve_hit_die_roll_v1() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.read_hit_die_receipt_v1(uuid, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.resolve_hit_die_snapshot_v1(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.commit_hit_die_v1(uuid, jsonb, jsonb, jsonb, text, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_hit_die_receipt_v1(uuid, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_hit_die_snapshot_v1(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_hit_die_v1(uuid, jsonb, jsonb, jsonb, text, timestamptz) TO service_role;
COMMIT;
