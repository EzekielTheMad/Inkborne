-- Hosted rollback smoke for mapper-version staging and schema-known repairs.
-- Replace __UAT_EMAIL__ in memory before execution. Never commit credentials.

BEGIN;
SET LOCAL statement_timeout = '30s';

CREATE TEMP TABLE smoke_context (
  actor_id uuid NOT NULL,
  system_id uuid NOT NULL,
  token text NOT NULL
) ON COMMIT DROP;

INSERT INTO smoke_context (actor_id, system_id, token)
SELECT
  user_record.id,
  system.id,
  pg_catalog.md5(pg_catalog.clock_timestamp()::text || pg_catalog.random()::text)
FROM auth.users AS user_record
CROSS JOIN public.game_systems AS system
WHERE pg_catalog.lower(user_record.email) = pg_catalog.lower('__UAT_EMAIL__')
  AND system.slug = 'dnd-5e-2014'
  AND system.status = 'published';

DO $check$
BEGIN
  IF (SELECT pg_catalog.count(*) FROM smoke_context) <> 1 THEN
    RAISE EXCEPTION 'Smoke prerequisites are missing or ambiguous';
  END IF;
END
$check$;

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  (SELECT actor_id::text FROM smoke_context),
  true
);
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.jsonb_build_object(
    'sub', (SELECT actor_id::text FROM smoke_context),
    'role', 'authenticated'
  )::text,
  true
);

CREATE FUNCTION pg_temp.stage_repair_case(
  case_key text,
  mapper_release text,
  registry_name text,
  candidate_type text,
  candidate_data jsonb,
  candidate_effects jsonb,
  issues jsonb
)
RETURNS uuid
LANGUAGE sql
AS $fn$
  SELECT public.stage_mpmb_import(
    context.system_id,
    case_key || '-smoke.mpmb',
    pg_catalog.md5(case_key || context.token)
      || pg_catalog.md5(case_key || ':2:' || context.token),
    1,
    'hosted-smoke-parser-v1',
    mapper_release,
    NULL,
    '[]'::jsonb,
    '[]'::jsonb,
    pg_catalog.jsonb_build_object(
      'valid', 0,
      'needsInfo', 1,
      'unsupported', 0,
      'blockingIssues', pg_catalog.jsonb_array_length(issues)
    ),
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'registry', registry_name,
        'sourceKey', case_key || '.item.0',
        'contentType', candidate_type,
        'location', pg_catalog.jsonb_build_object('line', 1, 'column', 1),
        'status', 'needs_info',
        'candidate', pg_catalog.jsonb_build_object(
          'content_type', candidate_type,
          'name', 'Codex Repair ' || case_key,
          'slug', 'codex-repair-' || case_key,
          'data', candidate_data,
          'effects', candidate_effects
        ),
        'sourceRefs', '[]'::jsonb,
        'issues', issues
      )
    ),
    'private_use_v1'
  )
  FROM pg_temp.smoke_context AS context
$fn$;

DO $smoke$
DECLARE
  v_token text := (SELECT token FROM smoke_context);
  v_spell_import_id uuid;
  v_same_import_id uuid;
  v_new_mapper_import_id uuid;
  v_spell_item_id uuid;
  v_feat_import_id uuid;
  v_feat_item_id uuid;
  v_unbound_import_id uuid;
  v_unbound_item_id uuid;
  v_revision integer;
  v_status text;
  v_selected boolean;
  v_caught boolean;
  v_error_state text;
  v_spell_issues jsonb := pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object(
      'code', 'spell.concentration.invalid',
      'severity', 'blocking',
      'kind', 'invalid_value',
      'path', 'concentration',
      'message', 'repair concentration'
    ),
    pg_catalog.jsonb_build_object(
      'code', 'spell.ritual.invalid',
      'severity', 'blocking',
      'kind', 'invalid_value',
      'path', 'ritual',
      'message', 'repair ritual'
    )
  );
  v_feat_issues jsonb := pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object(
      'code', 'feat.prerequisite.compound',
      'severity', 'blocking',
      'kind', 'not_automated',
      'path', 'prerequisite',
      'message', 'repair prerequisites'
    ),
    pg_catalog.jsonb_build_object(
      'code', 'feat.action.invalid',
      'severity', 'blocking',
      'kind', 'invalid_value',
      'path', 'action',
      'message', 'repair action'
    ),
    pg_catalog.jsonb_build_object(
      'code', 'feat.recovery.invalid',
      'severity', 'blocking',
      'kind', 'invalid_value',
      'path', 'recovery',
      'message', 'repair recovery'
    ),
    pg_catalog.jsonb_build_object(
      'code', 'feat.spellcastingAbility.invalid',
      'severity', 'blocking',
      'kind', 'invalid_value',
      'path', 'spellcastingAbility',
      'message', 'repair spellcasting ability'
    ),
    pg_catalog.jsonb_build_object(
      'code', 'feat.prereqeval.not_automated',
      'severity', 'warning',
      'kind', 'not_automated',
      'path', 'prereqeval',
      'message', 'executable prerequisite remains unavailable'
    )
  );
BEGIN
  -- Same bytes and mapper are idempotent; a new mapper stages a fresh review.
  v_spell_import_id := pg_temp.stage_repair_case(
    'spell-' || v_token,
    'hosted-smoke-mapper-v1',
    'SpellsList',
    'spell',
    '{"components":["V"],"concentration":false,"ritual":false}'::jsonb,
    '[{"type":"narrative","text":"unchanged"}]'::jsonb,
    v_spell_issues
  );
  v_same_import_id := pg_temp.stage_repair_case(
    'spell-' || v_token,
    'hosted-smoke-mapper-v1',
    'SpellsList',
    'spell',
    '{"components":["V"],"concentration":false,"ritual":false}'::jsonb,
    '[{"type":"narrative","text":"unchanged"}]'::jsonb,
    v_spell_issues
  );
  v_new_mapper_import_id := pg_temp.stage_repair_case(
    'spell-' || v_token,
    'hosted-smoke-mapper-v2',
    'SpellsList',
    'spell',
    '{"components":["V"],"concentration":false,"ritual":false}'::jsonb,
    '[{"type":"narrative","text":"unchanged"}]'::jsonb,
    v_spell_issues
  );

  IF v_same_import_id IS DISTINCT FROM v_spell_import_id
    OR v_new_mapper_import_id = v_spell_import_id
  THEN
    RAISE EXCEPTION 'Mapper-version import deduplication failed';
  END IF;

  SELECT item.id INTO v_spell_item_id
  FROM public.content_import_items AS item
  WHERE item.import_id = v_spell_import_id;

  UPDATE public.content_imports AS import_record
  SET
    preview_validated_revision = import_record.revision,
    preview_validated_at = pg_catalog.now()
  WHERE import_record.id = v_spell_import_id;

  SELECT repaired.revision, repaired.mapping_status, repaired.selected
  INTO v_revision, v_status, v_selected
  FROM public.repair_mpmb_import_spell_item(
    v_spell_import_id,
    v_spell_item_id,
    1,
    '{"concentration":true,"ritual":true}'::jsonb
  ) AS repaired;

  IF v_revision <> 2 OR v_status <> 'valid' OR NOT v_selected
    OR NOT EXISTS (
      SELECT 1
      FROM public.content_import_items AS item
      WHERE item.id = v_spell_item_id
        AND item.candidate_data -> 'concentration' = 'true'::jsonb
        AND item.candidate_data -> 'ritual' = 'true'::jsonb
        AND item.candidate_effects =
          '[{"type":"narrative","text":"unchanged"}]'::jsonb
        AND item.diagnostics = '[]'::jsonb
        AND pg_catalog.jsonb_array_length(item.resolved_diagnostics) = 2
        AND item.user_edited_fields = ARRAY['concentration', 'ritual']::text[]
    )
    OR NOT EXISTS (
      SELECT 1
      FROM public.content_imports AS import_record
      WHERE import_record.id = v_spell_import_id
        AND import_record.mapping_summary ->> 'valid' = '1'
        AND import_record.mapping_summary ->> 'needsInfo' = '0'
        AND import_record.mapping_summary ->> 'blockingIssues' = '0'
        AND import_record.preview_validated_revision IS NULL
        AND import_record.preview_validated_at IS NULL
    )
  THEN
    RAISE EXCEPTION 'Spell finite-field repair failed';
  END IF;

  v_caught := false;
  BEGIN
    PERFORM public.repair_mpmb_import_spell_item(
      v_spell_import_id,
      v_spell_item_id,
      1,
      '{"ritual":false}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
    IF v_error_state <> 'P0001' THEN RAISE; END IF;
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'Spell stale revision remained retryable or was accepted';
  END IF;

  -- Strict finite values and diagnostic binding reject without mutation.
  v_feat_import_id := pg_temp.stage_repair_case(
    'feat-' || v_token,
    'hosted-smoke-mapper-v1',
    'FeatsList',
    'feat',
    '{"description":"repair feat","prerequisites":[],"action":null,"recovery":null}'::jsonb,
    '[{"type":"narrative","text":"repair feat","tag":"Feat"}]'::jsonb,
    v_feat_issues
  );
  SELECT item.id INTO v_feat_item_id
  FROM public.content_import_items AS item
  WHERE item.import_id = v_feat_import_id;

  FOREACH v_status IN ARRAY ARRAY['bad_action', 'unknown_key']
  LOOP
    v_caught := false;
    BEGIN
      CASE v_status
        WHEN 'bad_action' THEN
          PERFORM public.repair_mpmb_import_feat_item(
            v_feat_import_id, v_feat_item_id, 1, '{"action":"immediate"}'::jsonb
          );
        WHEN 'unknown_key' THEN
          PERFORM public.repair_mpmb_import_feat_item(
            v_feat_import_id, v_feat_item_id, 1, '{"description":"no"}'::jsonb
          );
      END CASE;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
      IF v_error_state <> '22023' THEN RAISE; END IF;
      v_caught := true;
    END;
    IF NOT v_caught THEN
      RAISE EXCEPTION 'Invalid feat repair was accepted: %', v_status;
    END IF;
  END LOOP;

  v_unbound_import_id := pg_temp.stage_repair_case(
    'unbound-' || v_token,
    'hosted-smoke-mapper-v1',
    'FeatsList',
    'feat',
    '{"description":"unbound","prerequisites":[],"action":null,"recovery":null}'::jsonb,
    '[]'::jsonb,
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'code', 'feat.action.invalid',
        'severity', 'blocking',
        'kind', 'invalid_value',
        'path', 'action',
        'message', 'repair action'
      )
    )
  );
  SELECT item.id INTO v_unbound_item_id
  FROM public.content_import_items AS item
  WHERE item.import_id = v_unbound_import_id;

  v_caught := false;
  BEGIN
    PERFORM public.repair_mpmb_import_feat_item(
      v_unbound_import_id,
      v_unbound_item_id,
      1,
      '{"recovery":null}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
    IF v_error_state <> '22023' THEN RAISE; END IF;
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'Feat repair without its diagnostic was accepted';
  END IF;

  UPDATE public.content_imports AS import_record
  SET
    preview_validated_revision = import_record.revision,
    preview_validated_at = pg_catalog.now()
  WHERE import_record.id = v_feat_import_id;

  SELECT repaired.revision, repaired.mapping_status, repaired.selected
  INTO v_revision, v_status, v_selected
  FROM public.repair_mpmb_import_feat_item(
    v_feat_import_id,
    v_feat_item_id,
    1,
    '{"prerequisites":[{"stat":"wisdom","op":"gte","value":13}],"action":"bonus action","recovery":"long rest","spellcastingAbility":null}'::jsonb
  ) AS repaired;

  IF v_revision <> 2 OR v_status <> 'valid' OR NOT v_selected
    OR NOT EXISTS (
      SELECT 1
      FROM public.content_import_items AS item
      WHERE item.id = v_feat_item_id
        AND item.mapping_status = 'valid'
        AND item.selected
        AND item.candidate_data -> 'prerequisites' =
          '[{"stat":"wisdom","op":"gte","value":13}]'::jsonb
        AND item.candidate_data ->> 'action' = 'bonus action'
        AND item.candidate_data ->> 'recovery' = 'long rest'
        AND NOT (item.candidate_data ? 'spellcastingAbility')
        AND item.candidate_effects =
          '[{"type":"narrative","text":"repair feat","tag":"Feat"}]'::jsonb
        AND item.diagnostics = '[]'::jsonb
        AND pg_catalog.jsonb_array_length(item.resolved_diagnostics) = 5
        AND item.user_edited_fields = ARRAY[
          'prerequisites', 'action', 'recovery', 'spellcastingAbility'
        ]::text[]
    )
    OR NOT EXISTS (
      SELECT 1
      FROM public.content_imports AS import_record
      WHERE import_record.id = v_feat_import_id
        AND import_record.mapping_summary ->> 'valid' = '1'
        AND import_record.mapping_summary ->> 'needsInfo' = '0'
        AND import_record.mapping_summary ->> 'blockingIssues' = '0'
        AND import_record.preview_validated_revision IS NULL
        AND import_record.preview_validated_at IS NULL
    )
  THEN
    RAISE EXCEPTION 'Feat finite-field repair failed';
  END IF;

  v_caught := false;
  BEGIN
    PERFORM public.repair_mpmb_import_feat_item(
      v_feat_import_id,
      v_feat_item_id,
      1,
      '{"action":"action"}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
    IF v_error_state <> 'P0001' THEN RAISE; END IF;
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'Feat stale revision remained retryable or was accepted';
  END IF;
END
$smoke$;

ROLLBACK;
SELECT 'mpmb_schema_known_guided_repairs_smoke_ok' AS result;
