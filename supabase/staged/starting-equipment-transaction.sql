-- LOCAL REVIEW STAGING ONLY. Not a generated migration; never auto-applied.
-- Requires the current migration chain through 20261003223324.
-- No legacy backfill, grant/security application or hosted execution authorized.
BEGIN;
CREATE TABLE public.character_starting_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  grant_kind text NOT NULL DEFAULT 'starting_equipment' CHECK (grant_kind = 'starting_equipment'),
  status text NOT NULL CHECK (status IN ('eligible', 'awarded', 'inherited_completion')),
  canonical_intent jsonb,
  receipt jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (character_id, grant_kind),
  UNIQUE (id, character_id),
  CHECK ((status = 'eligible' AND canonical_intent IS NULL AND receipt IS NULL AND completed_at IS NULL)
    OR (status = 'awarded' AND canonical_intent IS NOT NULL AND receipt IS NOT NULL AND completed_at IS NOT NULL)
    OR (status = 'inherited_completion' AND canonical_intent IS NULL AND receipt IS NULL AND completed_at IS NOT NULL))
);
ALTER TABLE public.character_starting_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.character_starting_grants FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.character_starting_grants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.character_starting_grants TO service_role;
CREATE POLICY starting_grants_owner_read ON public.character_starting_grants
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = (SELECT auth.uid())
  ));
ALTER TABLE public.character_inventory ADD COLUMN starting_grant_id uuid;
ALTER TABLE public.character_inventory ADD CONSTRAINT inventory_starting_grant_character_fkey
  FOREIGN KEY (starting_grant_id, character_id) REFERENCES public.character_starting_grants(id, character_id);

CREATE FUNCTION private.preserve_starting_grant_receipt() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF OLD.status <> 'eligible' OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.character_id IS DISTINCT FROM OLD.character_id
    OR NEW.grant_kind IS DISTINCT FROM OLD.grant_kind
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Completed starting grants are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.preserve_starting_grant_receipt() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER preserve_starting_grant_receipt BEFORE UPDATE ON public.character_starting_grants
  FOR EACH ROW EXECUTE FUNCTION private.preserve_starting_grant_receipt();

-- Pin DML participates in the character lock used by create/copy/award. Lock
-- old/new parents in deterministic order, including directly reparented refs.
CREATE FUNCTION private.lock_starting_equipment_refs() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_parent uuid; new_parent uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_parent := OLD.character_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_parent := NEW.character_id; END IF;
  PERFORM c.id FROM public.characters c WHERE c.id IN (old_parent, new_parent) ORDER BY c.id FOR UPDATE;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.lock_starting_equipment_refs() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER aaa_lock_starting_equipment_refs BEFORE INSERT OR UPDATE OR DELETE ON public.character_content_refs
  FOR EACH ROW EXECUTE FUNCTION private.lock_starting_equipment_refs();

-- Owners may consume/delete inventory, but may not forge, strip or reparent
-- award provenance. Copy runs its established definer transaction.
CREATE FUNCTION private.protect_starting_inventory_provenance() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.starting_grant_id IS NOT NULL AND
    (NEW.starting_grant_id IS DISTINCT FROM OLD.starting_grant_id OR NEW.character_id IS DISTINCT FROM OLD.character_id) THEN
    RAISE EXCEPTION 'Starting grant provenance is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.starting_grant_id IS NOT NULL AND current_user IN ('authenticated', 'anon') AND
    (TG_OP = 'INSERT' OR NEW.starting_grant_id IS DISTINCT FROM OLD.starting_grant_id) THEN
    RAISE EXCEPTION 'Starting provenance requires trusted creation' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.protect_starting_inventory_provenance() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER protect_starting_inventory_provenance BEFORE INSERT OR UPDATE ON public.character_inventory
  FOR EACH ROW EXECUTE FUNCTION private.protect_starting_inventory_provenance();

-- Actor-aware immutable-version access: service clients have no owner JWT.
-- Reproduces platform/owner/shared campaign-owner-or-member use semantics.
CREATE FUNCTION private.starting_grant_can_use_version(actor_id uuid, target_character_id uuid, target_content_id uuid, target_version integer)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT actor_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.characters c JOIN public.content_versions v
      ON v.content_id = target_content_id AND v.version = target_version AND v.system_id_snapshot = c.system_id
    WHERE c.id = target_character_id AND c.user_id = actor_id AND (
      v.scope_snapshot = 'platform' OR v.owner_id_snapshot = actor_id OR (
        v.scope_snapshot = 'shared' AND EXISTS (
          SELECT 1 FROM public.content_shares s WHERE s.content_id = v.content_id AND s.campaign_id = c.campaign_id
        ) AND (EXISTS (SELECT 1 FROM public.campaigns campaign WHERE campaign.id = c.campaign_id AND campaign.owner_id = actor_id)
          OR EXISTS (SELECT 1 FROM public.campaign_members m WHERE m.campaign_id = c.campaign_id AND m.user_id = actor_id))
      )
    )
  );
$$;
REVOKE ALL ON FUNCTION private.starting_grant_can_use_version(uuid, uuid, uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.starting_grant_can_use_version(uuid, uuid, uuid, integer) TO service_role;

CREATE FUNCTION public.create_character_with_starting_grant(actor_id uuid, character_name text, target_system_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE new_id uuid;
BEGIN
  IF actor_id IS NULL OR length(btrim(character_name)) NOT BETWEEN 1 AND 100 OR NOT EXISTS (
    SELECT 1 FROM public.game_systems s WHERE s.id = target_system_id AND s.status = 'published'
  ) THEN RAISE EXCEPTION 'Invalid character creation' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.characters(user_id, system_id, name) VALUES (actor_id, target_system_id, btrim(character_name)) RETURNING id INTO new_id;
  INSERT INTO public.character_starting_grants(character_id, status) VALUES (new_id, 'eligible');
  RETURN new_id;
END; $$;
REVOKE ALL ON FUNCTION public.create_character_with_starting_grant(uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_character_with_starting_grant(uuid, text, uuid) TO service_role;

-- Terminal resolution intentionally does not consult current pins/catalog or
-- inventory. Current ownership is checked under the same parent lock first.
CREATE FUNCTION public.resolve_starting_equipment(actor_id uuid, target_character_id uuid, request_intent jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE c public.characters%ROWTYPE; g public.character_starting_grants%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.characters WHERE id = target_character_id AND user_id = actor_id FOR UPDATE;
  IF NOT FOUND OR actor_id IS NULL THEN RAISE EXCEPTION 'Character unavailable' USING ERRCODE = '42501'; END IF;
  SELECT * INTO g FROM public.character_starting_grants WHERE character_id = c.id AND grant_kind = 'starting_equipment';
  IF FOUND AND g.status = 'awarded' THEN
    IF g.canonical_intent - 'plan' = request_intent THEN
      RETURN jsonb_build_object('status', 'awarded', 'receipt', g.receipt);
    END IF;
    RETURN jsonb_build_object('status', 'conflict');
  END IF;
  IF g.status = 'inherited_completion' OR
    (jsonb_typeof(c.choices->'starting_equipment') = 'string' AND btrim(c.choices->>'starting_equipment') <> '') OR
    c.choices->'starting_equipment'->>'confirmed' = 'true' THEN
    RETURN jsonb_build_object('status', 'already_completed');
  END IF;
  RETURN jsonb_build_object('status', CASE WHEN g.status = 'eligible' THEN 'eligible' ELSE 'not_eligible' END);
END; $$;
REVOKE ALL ON FUNCTION public.resolve_starting_equipment(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_starting_equipment(uuid, uuid, jsonb) TO service_role;

CREATE FUNCTION public.commit_starting_equipment(actor_id uuid, target_character_id uuid, expected_choices jsonb, expected_refs jsonb, canonical_intent jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE c public.characters%ROWTYPE; g public.character_starting_grants%ROWTYPE;
  resolution jsonb; actual_refs jsonb; entry jsonb; item_id uuid;
  inventory_ids jsonb := '[]'; delta jsonb; next_currency jsonb;
  next_state jsonb; next_choices jsonb; award_receipt jsonb; unit text; amount numeric;
  next_sort integer; source record;
BEGIN
  -- resolve also takes the lock; held until this entire transaction finishes.
  resolution := public.resolve_starting_equipment(actor_id, target_character_id, canonical_intent - 'plan');
  IF resolution->>'status' = 'awarded' THEN
    -- Independent concurrent plans may have identical browser request intent.
    -- Only exact canonical plans may replay at the internal commit boundary.
    IF NOT EXISTS (SELECT 1 FROM public.character_starting_grants grant_row
      WHERE grant_row.character_id = target_character_id AND grant_row.canonical_intent = commit_starting_equipment.canonical_intent) THEN
      RETURN jsonb_build_object('status', 'conflict');
    END IF;
    RETURN resolution;
  END IF;
  IF resolution->>'status' <> 'eligible' THEN RETURN resolution; END IF;
  SELECT * INTO c FROM public.characters WHERE id = target_character_id AND user_id = actor_id FOR UPDATE;
  SELECT * INTO g FROM public.character_starting_grants WHERE character_id = c.id AND grant_kind = 'starting_equipment' FOR UPDATE;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('content_id', r.content_id, 'content_version', r.content_version)
    ORDER BY r.content_id, r.content_version), '[]'::jsonb) INTO actual_refs FROM public.character_content_refs r WHERE r.character_id = c.id;
  IF c.choices IS DISTINCT FROM expected_choices OR actual_refs IS DISTINCT FROM expected_refs
    OR jsonb_build_object('selections', c.choices->'starting_equipment'->'selections', 'picks', c.choices->'starting_equipment'->'picks')
      IS DISTINCT FROM canonical_intent->'selections' THEN RETURN jsonb_build_object('status', 'conflict'); END IF;
  -- Check pinned sources and every ref's access in the locked snapshot.
  FOR source IN SELECT r.*, v.content_type_snapshot, v.slug_snapshot FROM public.character_content_refs r
    JOIN public.content_versions v ON v.content_id = r.content_id AND v.version = r.content_version WHERE r.character_id = c.id LOOP
    IF NOT private.starting_grant_can_use_version(actor_id, c.id, source.content_id, source.content_version) THEN
      RETURN jsonb_build_object('status', 'conflict');
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.character_content_refs r JOIN public.content_versions v ON v.content_id = r.content_id AND v.version = r.content_version
    WHERE r.character_id = c.id AND v.content_type_snapshot = 'class' AND v.slug_snapshot = c.choices->'classes'->0->>'slug'
      AND r.content_id = (canonical_intent->'sources'->'class'->>'id')::uuid AND r.content_version = (canonical_intent->'sources'->'class'->>'version')::integer) <> 1 THEN
    RETURN jsonb_build_object('status', 'conflict');
  END IF;
  IF c.choices->>'background' IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.character_content_refs r JOIN public.content_versions v ON v.content_id = r.content_id AND v.version = r.content_version
    WHERE r.character_id = c.id AND v.content_type_snapshot = 'background' AND v.slug_snapshot = c.choices->>'background'
      AND r.content_id = (canonical_intent->'sources'->'background'->>'id')::uuid AND r.content_version = (canonical_intent->'sources'->'background'->>'version')::integer
  ) THEN RETURN jsonb_build_object('status', 'conflict'); END IF;
  IF jsonb_typeof(canonical_intent->'plan'->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(canonical_intent->'plan'->'items') > 200
    OR jsonb_typeof(canonical_intent->'plan'->'currency') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid equipment plan' USING ERRCODE = '22023';
  END IF;
  next_state := COALESCE(c.state, '{}'::jsonb);
  IF jsonb_typeof(next_state) <> 'object' THEN RAISE EXCEPTION 'Invalid character state' USING ERRCODE = '22023'; END IF;
  next_currency := COALESCE(next_state->'currency', '{}'::jsonb);
  IF jsonb_typeof(next_currency) <> 'object' THEN RAISE EXCEPTION 'Invalid currency state' USING ERRCODE = '22023'; END IF;
  delta := canonical_intent->'plan'->'currency';
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(delta) k WHERE k NOT IN ('cp','sp','ep','gp','pp')) THEN
    RAISE EXCEPTION 'Invalid currency unit' USING ERRCODE = '22023'; END IF;
  FOREACH unit IN ARRAY ARRAY['cp','sp','ep','gp','pp'] LOOP
    IF (next_currency ? unit AND (jsonb_typeof(next_currency->unit) <> 'number' OR (next_currency->>unit)::numeric <> trunc((next_currency->>unit)::numeric)))
      OR (delta ? unit AND jsonb_typeof(delta->unit) <> 'number') THEN RAISE EXCEPTION 'Invalid currency' USING ERRCODE = '22023'; END IF;
    amount := COALESCE((delta->>unit)::numeric, 0);
    IF amount < 0 OR amount > 1000000 OR amount <> trunc(amount) THEN RAISE EXCEPTION 'Invalid currency delta' USING ERRCODE = '22023'; END IF;
    next_currency := jsonb_set(next_currency, ARRAY[unit], to_jsonb(COALESCE((next_currency->>unit)::numeric, 0) + amount));
  END LOOP;
  SELECT COALESCE(max(sort_order), -1) + 1 INTO next_sort FROM public.character_inventory WHERE character_id = c.id;
  FOR entry IN SELECT value FROM jsonb_array_elements(canonical_intent->'plan'->'items') LOOP
    IF jsonb_typeof(entry->'quantity') <> 'number' OR (entry->>'quantity')::numeric NOT BETWEEN 1 AND 10000
      OR (entry->>'quantity')::numeric <> trunc((entry->>'quantity')::numeric)
      OR length(entry->>'name') NOT BETWEEN 1 AND 500 OR entry->>'content_type' NOT IN ('weapon','armor','item')
      OR ((entry->>'content_id') IS NULL) <> ((entry->>'content_version') IS NULL) THEN
      RAISE EXCEPTION 'Invalid equipment item' USING ERRCODE = '22023'; END IF;
    IF entry->>'content_id' IS NOT NULL AND (
      NOT private.starting_grant_can_use_version(actor_id, c.id, (entry->>'content_id')::uuid, (entry->>'content_version')::integer)
      OR NOT EXISTS (SELECT 1 FROM public.content_versions v WHERE v.content_id = (entry->>'content_id')::uuid AND v.version = (entry->>'content_version')::integer
        AND v.content_type_snapshot = entry->>'content_type' AND v.name_snapshot = entry->>'name')
    ) THEN RAISE EXCEPTION 'Equipment content unavailable' USING ERRCODE = '42501'; END IF;
    INSERT INTO public.character_inventory(character_id, content_id, content_version, name, content_type, quantity, sort_order, starting_grant_id)
      VALUES (c.id, (entry->>'content_id')::uuid, (entry->>'content_version')::integer, entry->>'name', entry->>'content_type', (entry->>'quantity')::integer, next_sort, g.id)
      RETURNING id INTO item_id;
    inventory_ids := inventory_ids || jsonb_build_array(item_id); next_sort := next_sort + 1;
  END LOOP;
  next_state := jsonb_set(next_state, '{currency}', next_currency);
  next_choices := jsonb_set(c.choices, '{starting_equipment}', (c.choices->'starting_equipment') || '{"confirmed":true}'::jsonb);
  UPDATE public.characters SET state = next_state, choices = next_choices WHERE id = c.id;
  award_receipt := jsonb_build_object('grant_id', g.id, 'inventory_ids', inventory_ids, 'plan', canonical_intent->'plan', 'awarded_at', now());
  UPDATE public.character_starting_grants SET status = 'awarded', canonical_intent = commit_starting_equipment.canonical_intent,
    receipt = award_receipt, completed_at = now() WHERE id = g.id;
  RETURN jsonb_build_object('status', 'awarded', 'receipt', award_receipt);
END; $$;
REVOKE ALL ON FUNCTION public.commit_starting_equipment(uuid, uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.commit_starting_equipment(uuid, uuid, jsonb, jsonb, jsonb) TO service_role;

-- Latest copy retains every existing guard and child copy.
CREATE OR REPLACE FUNCTION public.copy_character(
  source_character_id uuid,
  target_campaign_id uuid DEFAULT NULL,
  copied_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  source_character public.characters%ROWTYPE;
  new_character_id uuid;
  resolved_name text;
  source_grant public.character_starting_grants%ROWTYPE;
  target_grant_id uuid;
  inherited boolean := false;
  source_asi_ref record;
  destination_grant public.character_feature_grants%ROWTYPE;
  destination_grant_ids uuid[];
  stored_feat_choice_count integer := 0;
  source_asi_ref_count integer := 0;
  inserted_asi_ref_count integer := 0;
  previous_asi_rpc_setting text := pg_catalog.current_setting(
    'inkborne.asi_choice_rpc',
    true
  );
  previous_background_rpc_setting text := pg_catalog.current_setting(
    'inkborne.background_choice_rpc',
    true
  );
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT character.* INTO source_character
  FROM public.characters AS character
  WHERE character.id = source_character_id
    AND character.user_id = actor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Character not found or not owned by caller'
      USING ERRCODE = '42501';
  END IF;

  resolved_name := pg_catalog.btrim(
    COALESCE(NULLIF(copied_name, ''), source_character.name || ' (Copy)')
  );
  IF pg_catalog.char_length(resolved_name) < 1
    OR pg_catalog.char_length(resolved_name) > 100
  THEN
    RAISE EXCEPTION 'Character name must be between 1 and 100 characters'
      USING ERRCODE = '22023';
  END IF;

  IF target_campaign_id IS NOT NULL
    AND NOT private.can_assign_character_to_campaign(
      target_campaign_id,
      source_character.system_id
    )
  THEN
    RAISE EXCEPTION 'Campaign is unavailable or uses a different game system'
      USING ERRCODE = '42501';
  END IF;

  -- A privileged copy must never bless a malformed legacy background state.
  IF (
    SELECT pg_catalog.count(*)
    FROM public.character_content_refs AS ref
    JOIN public.content_versions AS version
      ON version.content_id = ref.content_id
     AND version.version = ref.content_version
     AND version.content_type_snapshot = 'background'
    WHERE ref.character_id = source_character_id
  ) > 1
    OR EXISTS (
      SELECT 1
      FROM public.character_content_refs AS ref
      JOIN public.content_versions AS version
        ON version.content_id = ref.content_id
       AND version.version = ref.content_version
       AND version.content_type_snapshot = 'background'
      WHERE ref.character_id = source_character_id
        AND (
          ref.choice_source IS DISTINCT FROM 'choice:background'
          OR ref.context IS DISTINCT FROM
            pg_catalog.jsonb_build_object('source', 'background')
          OR ref.feature_grant_id IS NOT NULL
          OR source_character.choices->>'background'
            IS DISTINCT FROM version.slug_snapshot
        )
    )
    OR (
      pg_catalog.btrim(COALESCE(source_character.choices->>'background', '')) <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM public.character_content_refs AS ref
        JOIN public.content_versions AS version
          ON version.content_id = ref.content_id
         AND version.version = ref.content_version
         AND version.content_type_snapshot = 'background'
        WHERE ref.character_id = source_character_id
          AND ref.choice_source = 'choice:background'
          AND version.slug_snapshot = source_character.choices->>'background'
      )
    )
  THEN
    RAISE EXCEPTION 'Character contains a noncanonical background that cannot be copied'
      USING ERRCODE = '23514';
  END IF;

  PERFORM pg_catalog.set_config('inkborne.asi_choice_rpc', 'on', true);
  PERFORM pg_catalog.set_config('inkborne.background_choice_rpc', 'on', true);

  INSERT INTO public.characters (
    user_id, system_id, campaign_id, name, visibility, archived, level,
    base_stats, choices, state, narrative, narrative_rich, primary_color
  ) VALUES (
    actor_id, source_character.system_id, target_campaign_id, resolved_name,
    'private', false, source_character.level, source_character.base_stats,
    source_character.choices, source_character.state, source_character.narrative,
    source_character.narrative_rich, source_character.primary_color
  ) RETURNING id INTO new_character_id;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT ref.content_id, ref.content_version
      FROM public.character_content_refs AS ref
      WHERE ref.character_id = source_character_id
        AND ref.feature_grant_id IS NULL

      UNION ALL

      SELECT item.content_id, item.content_version
      FROM public.character_inventory AS item
      WHERE item.character_id = source_character_id
        AND item.content_id IS NOT NULL

      UNION ALL

      SELECT spell.content_id, spell.content_version
      FROM public.character_spells AS spell
      WHERE spell.character_id = source_character_id
        AND spell.content_id IS NOT NULL
    ) AS linked
    WHERE private.can_use_content_version(
      new_character_id,
      linked.content_id,
      linked.content_version
    ) IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Character contains content unavailable to the target campaign'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.character_content_refs AS ref
    JOIN public.content_versions AS version
      ON version.content_id = ref.content_id
     AND version.version = ref.content_version
    WHERE ref.character_id = source_character_id
      AND ref.feature_grant_id IS NULL
      AND version.content_type_snapshot = 'feat'
      AND (
        ref.choice_source IS NULL
        OR ref.choice_source NOT LIKE 'choice:asi:%'
      )
  ) THEN
    RAISE EXCEPTION 'Character contains a noncanonical feat ref that cannot be copied'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.character_dm_notes (character_id, content)
  SELECT new_character_id, note.content
  FROM public.character_dm_notes AS note
  WHERE note.character_id = source_character_id;

  INSERT INTO public.character_timeline_events (
    character_id, created_by, title, date_label, description, visibility,
    sort_order
  ) SELECT
    new_character_id, actor_id, event.title, event.date_label,
    event.description, 'dm_only', event.sort_order
  FROM public.character_timeline_events AS event
  WHERE event.character_id = source_character_id
    AND event.created_by = actor_id;

  SELECT pg_catalog.count(*)::integer
  INTO stored_feat_choice_count
  FROM pg_catalog.jsonb_each(
    CASE
      WHEN pg_catalog.jsonb_typeof(source_character.choices->'asi_choices') = 'object'
        THEN source_character.choices->'asi_choices'
      ELSE '{}'::jsonb
    END
  ) AS choice(key, value)
  WHERE choice.value->>'mode' = 'feat';

  SELECT pg_catalog.count(*)::integer
  INTO source_asi_ref_count
  FROM public.character_content_refs AS ref
  WHERE ref.character_id = source_character_id
    AND ref.feature_grant_id IS NULL
    AND ref.choice_source LIKE 'choice:asi:%';

  INSERT INTO public.character_content_refs (
    character_id, content_id, content_version, context, choice_source
  ) SELECT
    new_character_id, ref.content_id, ref.content_version, ref.context, ref.choice_source
  FROM public.character_content_refs AS ref
  WHERE ref.character_id = source_character_id
    AND ref.feature_grant_id IS NULL
    AND (
      ref.choice_source IS NULL
      OR ref.choice_source NOT LIKE 'choice:asi:%'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.content_versions AS version
      WHERE version.content_id = ref.content_id
        AND version.version = ref.content_version
        AND version.content_type_snapshot = 'feat'
    );

  FOR source_asi_ref IN
    SELECT
      ref.content_id,
      ref.content_version,
      source_grant.controller_type,
      source_grant.controller_slug,
      source_grant.feature_slug,
      source_grant.feature_content_id,
      source_grant.feature_version,
      source_grant.unlock_level,
      source_controller.content_id AS controller_content_id,
      source_controller.content_version AS controller_content_version,
      source_controller.context AS controller_context,
      source_controller.choice_source AS controller_choice_source
    FROM public.character_content_refs AS ref
    JOIN public.character_feature_grants AS source_grant
      ON source_grant.id = CASE
        WHEN pg_catalog.substr(
          ref.choice_source,
          pg_catalog.char_length('choice:asi:') + 1
        ) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN pg_catalog.substr(
          ref.choice_source,
          pg_catalog.char_length('choice:asi:') + 1
        )::uuid
        ELSE NULL
      END
     AND source_grant.character_id = source_character_id
    JOIN public.character_content_refs AS source_controller
      ON source_controller.id = source_grant.controller_ref_id
     AND source_controller.character_id = source_character_id
    WHERE ref.character_id = source_character_id
      AND ref.feature_grant_id IS NULL
      AND ref.choice_source LIKE 'choice:asi:%'
      AND pg_catalog.jsonb_extract_path_text(
        source_character.choices,
        'asi_choices',
        source_grant.feature_slug,
        'mode'
      ) = 'feat'
      AND pg_catalog.jsonb_extract_path_text(
        source_character.choices,
        'asi_choices',
        source_grant.feature_slug,
        'featId'
      ) = ref.content_id::text
      AND pg_catalog.jsonb_extract_path(
        source_character.choices,
        'asi_choices',
        source_grant.feature_slug,
        'featVersion'
      ) = pg_catalog.to_jsonb(ref.content_version)
  LOOP
    SELECT pg_catalog.array_agg(grant_row.id ORDER BY grant_row.id)
    INTO destination_grant_ids
    FROM public.character_feature_grants AS grant_row
    JOIN public.character_content_refs AS destination_controller
      ON destination_controller.id = grant_row.controller_ref_id
     AND destination_controller.character_id = new_character_id
    WHERE grant_row.character_id = new_character_id
      AND grant_row.controller_type = source_asi_ref.controller_type
      AND grant_row.controller_slug = source_asi_ref.controller_slug
      AND grant_row.feature_slug = source_asi_ref.feature_slug
      AND grant_row.feature_content_id = source_asi_ref.feature_content_id
      AND grant_row.feature_version = source_asi_ref.feature_version
      AND grant_row.unlock_level = source_asi_ref.unlock_level
      AND destination_controller.content_id = source_asi_ref.controller_content_id
      AND destination_controller.content_version = source_asi_ref.controller_content_version
      AND destination_controller.context IS NOT DISTINCT FROM source_asi_ref.controller_context
      AND destination_controller.choice_source IS NOT DISTINCT FROM
        source_asi_ref.controller_choice_source;

    IF COALESCE(pg_catalog.cardinality(destination_grant_ids), 0) <> 1 THEN
      RAISE EXCEPTION 'Copied ASI feat could not be mapped to one destination grant'
        USING ERRCODE = '23514';
    END IF;

    SELECT grant_row.*
    INTO destination_grant
    FROM public.character_feature_grants AS grant_row
    WHERE grant_row.id = destination_grant_ids[1];

    IF private.is_character_feature_grant_active(destination_grant.id) IS NOT TRUE THEN
      RAISE EXCEPTION 'Copied ASI feat maps to an inactive destination grant'
        USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.character_content_refs (
      character_id,
      content_id,
      content_version,
      context,
      choice_source,
      feature_grant_id
    ) VALUES (
      new_character_id,
      source_asi_ref.content_id,
      source_asi_ref.content_version,
      pg_catalog.jsonb_build_object(
        'source', 'asi_feat',
        'feature_slug', destination_grant.feature_slug,
        'feature_grant_id', destination_grant.id,
        'feature_level', destination_grant.unlock_level,
        'controller_type', destination_grant.controller_type,
        'controller_slug', destination_grant.controller_slug
      ),
      'choice:asi:' || destination_grant.id::text,
      NULL
    );

    inserted_asi_ref_count := inserted_asi_ref_count + 1;
  END LOOP;

  IF stored_feat_choice_count <> source_asi_ref_count
    OR source_asi_ref_count <> inserted_asi_ref_count
  THEN
    RAISE EXCEPTION 'Source ASI feat choices and exact pins are inconsistent'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO source_grant FROM public.character_starting_grants
    WHERE character_id = source_character_id AND grant_kind = 'starting_equipment';
  inherited := COALESCE(source_grant.status IN ('awarded', 'inherited_completion'), false)
    OR (jsonb_typeof(source_character.choices->'starting_equipment') = 'string'
      AND btrim(source_character.choices->>'starting_equipment') <> '')
    OR COALESCE(source_character.choices->'starting_equipment'->>'confirmed' = 'true', false);
  IF inherited THEN
    INSERT INTO public.character_starting_grants(character_id, status, completed_at)
      VALUES (new_character_id, 'inherited_completion', now()) RETURNING id INTO target_grant_id;
    -- A stale direct choices writer cannot turn completed copies into reawards.
    IF jsonb_typeof(source_character.choices->'starting_equipment') = 'object' THEN
      UPDATE public.characters SET choices = jsonb_set(choices, '{starting_equipment,confirmed}', 'true') WHERE id = new_character_id;
    END IF;
  ELSIF source_grant.status = 'eligible' THEN
    INSERT INTO public.character_starting_grants(character_id, status)
      VALUES (new_character_id, 'eligible') RETURNING id INTO target_grant_id;
  END IF;
  -- Absent source marker stays legacy/unresolved. No fabricated award receipt.

  INSERT INTO public.character_inventory (
    character_id, content_id, content_version, name, content_type, quantity,
    equipped, attuned, sort_order, notes, custom_data, starting_grant_id
  ) SELECT
    new_character_id, item.content_id, item.content_version, item.name,
    item.content_type, item.quantity, item.equipped, item.attuned,
    item.sort_order, item.notes, item.custom_data,
    CASE WHEN item.starting_grant_id = source_grant.id THEN target_grant_id ELSE NULL END
  FROM public.character_inventory AS item
  WHERE item.character_id = source_character_id;

  INSERT INTO public.character_spells (
    character_id, content_id, content_version, name, class_slug, is_known,
    is_prepared, always_prepared, in_spellbook, source, custom_data
  ) SELECT
    new_character_id, spell.content_id, spell.content_version, spell.name,
    spell.class_slug, spell.is_known, spell.is_prepared, spell.always_prepared,
    spell.in_spellbook, spell.source, spell.custom_data
  FROM public.character_spells AS spell
  WHERE spell.character_id = source_character_id;

  INSERT INTO public.npcs (
    character_id, created_by, name, description, relationship, visibility,
    portrait_url, metadata
  ) SELECT
    new_character_id, actor_id, npc.name, npc.description, npc.relationship,
    'dm_only', npc.portrait_url, npc.metadata
  FROM public.npcs AS npc
  WHERE npc.character_id = source_character_id
    AND npc.created_by = actor_id;

  PERFORM pg_catalog.set_config(
    'inkborne.asi_choice_rpc',
    COALESCE(previous_asi_rpc_setting, 'off'),
    true
  );
  PERFORM pg_catalog.set_config(
    'inkborne.background_choice_rpc',
    COALESCE(previous_background_rpc_setting, 'off'),
    true
  );

  RETURN new_character_id;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_character(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.copy_character(uuid, uuid, text)
  TO authenticated;

COMMIT;
