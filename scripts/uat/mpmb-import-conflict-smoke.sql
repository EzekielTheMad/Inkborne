-- Hosted rollback smoke for MPMB import conflict resolution.
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

CREATE FUNCTION pg_temp.stage_one(
  case_key text,
  registry_name text,
  candidate_type text,
  candidate_name text,
  candidate_slug text,
  candidate_data jsonb
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
    'hosted-smoke-mapper-v1',
    NULL,
    '[]'::jsonb,
    '[]'::jsonb,
    '{"valid":1,"needsInfo":0,"unsupported":0,"blockingIssues":0}'::jsonb,
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'registry', registry_name,
        'sourceKey', case_key || '.item.0',
        'contentType', candidate_type,
        'location', pg_catalog.jsonb_build_object('line', 1, 'column', 1),
        'status', 'valid',
        'candidate', pg_catalog.jsonb_build_object(
          'content_type', candidate_type,
          'name', candidate_name,
          'slug', candidate_slug,
          'data', candidate_data,
          'effects', '[]'::jsonb
        ),
        'sourceRefs', '[]'::jsonb,
        'issues', '[]'::jsonb
      )
    ),
    'private_use_v1'
  )
  FROM pg_temp.smoke_context AS context
$fn$;

CREATE FUNCTION pg_temp.stage_two(
  case_key text,
  first_name text,
  first_slug text,
  second_name text,
  second_slug text
)
RETURNS uuid
LANGUAGE sql
AS $fn$
  SELECT public.stage_mpmb_import(
    context.system_id,
    case_key || '-smoke.mpmb',
    pg_catalog.md5(case_key || context.token)
      || pg_catalog.md5(case_key || ':2:' || context.token),
    2,
    'hosted-smoke-parser-v1',
    'hosted-smoke-mapper-v1',
    NULL,
    '[]'::jsonb,
    '[]'::jsonb,
    '{"valid":2,"needsInfo":0,"unsupported":0,"blockingIssues":0}'::jsonb,
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'registry', 'FeatsList',
        'sourceKey', case_key || '.item.0',
        'contentType', 'feat',
        'location', pg_catalog.jsonb_build_object('line', 1, 'column', 1),
        'status', 'valid',
        'candidate', pg_catalog.jsonb_build_object(
          'content_type', 'feat',
          'name', first_name,
          'slug', first_slug,
          'data', '{"value":"first-new"}'::jsonb,
          'effects', '[]'::jsonb
        ),
        'sourceRefs', '[]'::jsonb,
        'issues', '[]'::jsonb
      ),
      pg_catalog.jsonb_build_object(
        'registry', 'FeatsList',
        'sourceKey', case_key || '.item.1',
        'contentType', 'feat',
        'location', pg_catalog.jsonb_build_object('line', 2, 'column', 1),
        'status', 'valid',
        'candidate', pg_catalog.jsonb_build_object(
          'content_type', 'feat',
          'name', second_name,
          'slug', second_slug,
          'data', '{"value":"second-new"}'::jsonb,
          'effects', '[]'::jsonb
        ),
        'sourceRefs', '[]'::jsonb,
        'issues', '[]'::jsonb
      )
    ),
    'private_use_v1'
  )
  FROM pg_temp.smoke_context AS context
$fn$;

DO $smoke$
DECLARE
  v_actor_id uuid := (SELECT actor_id FROM smoke_context);
  v_system_id uuid := (SELECT system_id FROM smoke_context);
  v_token text := (SELECT token FROM smoke_context);
  v_target_id uuid;
  v_target_slug text;
  v_import_id uuid;
  v_item_id uuid;
  v_item_two_id uuid;
  v_result_id uuid;
  v_retry_id uuid;
  v_character_id uuid;
  v_campaign_id uuid;
  v_blocker_id uuid;
  v_revision integer;
  v_version integer;
  v_retry_version integer;
  v_completed_revision integer;
  v_caught boolean;
  v_error_state text;
  v_error_message text;
  v_name text;
  v_second_name text;
  v_blocker_slug text;
BEGIN
  -- Replace: preserve identity/slug, append v2, retain a v1 character pin,
  -- record exact provenance, then prove completed retry remains on v2.
  v_name := 'Codex Replace ' || v_token;
  v_target_slug := 'codex-replace-' || v_token;
  INSERT INTO public.content_definitions (
    system_id, content_type, slug, name, data, effects, source, scope, owner_id
  ) VALUES (
    v_system_id, 'feat', v_target_slug, v_name, '{"value":"old"}'::jsonb,
    '[]'::jsonb, 'homebrew', 'personal', v_actor_id
  ) RETURNING id INTO v_target_id;

  INSERT INTO public.characters (user_id, system_id, name)
  VALUES (v_actor_id, v_system_id, 'Codex Pin ' || v_token)
  RETURNING id INTO v_character_id;

  INSERT INTO public.character_content_refs (
    character_id, content_id, content_version, context
  ) VALUES (v_character_id, v_target_id, 1, '{}'::jsonb);

  v_import_id := pg_temp.stage_one(
    'replace-' || v_token, 'FeatsList', 'feat', v_name,
    'codex-replace-candidate-' || v_token, '{"value":"new"}'::jsonb
  );
  SELECT item.id INTO v_item_id
  FROM public.content_import_items AS item
  WHERE item.import_id = v_import_id
  ORDER BY item.ordinal
  LIMIT 1;
  SELECT import_record.revision INTO v_revision
  FROM public.content_imports AS import_record
  WHERE import_record.id = v_import_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.list_mpmb_import_item_conflicts(v_import_id) AS conflict
    WHERE conflict.import_item_id = v_item_id
      AND conflict.content_id = v_target_id
      AND conflict.version = 1
      AND conflict.scope = 'personal'
      AND conflict.shared_campaign_count = 0
      AND conflict.replaceable
  ) THEN
    RAISE EXCEPTION 'Replace conflict listing failed';
  END IF;

  SELECT resolution.revision INTO v_revision
  FROM public.resolve_mpmb_import_item_conflict(
    v_import_id, v_item_id, v_revision, 'replace', v_target_id, 1
  ) AS resolution;
  SELECT committed.content_id, committed.version
  INTO v_result_id, v_version
  FROM public.commit_mpmb_import(v_import_id, v_revision) AS committed;

  IF v_result_id IS DISTINCT FROM v_target_id OR v_version IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Replace identity/version failed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.content_definitions AS definition
    WHERE definition.id = v_target_id
      AND definition.slug = v_target_slug
      AND definition.version = 2
      AND definition.data = '{"value":"new"}'::jsonb
      AND definition.scope = 'personal'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.content_versions AS snapshot
    WHERE snapshot.content_id = v_target_id
      AND snapshot.version = 1
      AND snapshot.data_snapshot = '{"value":"old"}'::jsonb
  ) OR NOT EXISTS (
    SELECT 1 FROM public.character_content_refs AS ref
    WHERE ref.character_id = v_character_id
      AND ref.content_id = v_target_id
      AND ref.content_version = 1
  ) OR NOT EXISTS (
    SELECT 1 FROM public.content_import_origins AS origin
    WHERE origin.import_item_id = v_item_id
      AND origin.content_id = v_target_id
      AND origin.content_version = 2
      AND origin.disposition = 'replaced'
      AND origin.replaced_from_version = 1
      AND origin.sharing_rights_status = 'private_only'
  ) THEN
    RAISE EXCEPTION 'Replace history, pin, or provenance failed';
  END IF;

  SELECT import_record.revision INTO v_completed_revision
  FROM public.content_imports AS import_record
  WHERE import_record.id = v_import_id;
  UPDATE public.content_definitions AS definition
  SET data = '{"value":"post-completion"}'::jsonb
  WHERE definition.id = v_target_id;
  SELECT committed.content_id, committed.version
  INTO v_retry_id, v_retry_version
  FROM public.commit_mpmb_import(v_import_id, 1) AS committed;

  IF v_retry_id IS DISTINCT FROM v_target_id
    OR v_retry_version IS DISTINCT FROM 2
    OR (
      SELECT import_record.revision FROM public.content_imports AS import_record
      WHERE import_record.id = v_import_id
    ) IS DISTINCT FROM v_completed_revision
    OR (
      SELECT pg_catalog.count(*) FROM public.content_import_origins AS origin
      WHERE origin.import_item_id = v_item_id
    ) <> 1
  THEN
    RAISE EXCEPTION 'Completed retry exact-version history failed';
  END IF;

  -- Keep both: distinct private v1 with deterministic collision-safe slug.
  v_name := 'Codex Keep Both ' || v_token;
  INSERT INTO public.content_definitions (
    system_id, content_type, slug, name, data, effects, source, scope, owner_id
  ) VALUES (
    v_system_id, 'feat', 'codex-keep-original-' || v_token, v_name,
    '{"value":"old"}'::jsonb, '[]'::jsonb,
    'homebrew', 'personal', v_actor_id
  ) RETURNING id INTO v_target_id;

  v_import_id := pg_temp.stage_one(
    'keep-' || v_token, 'FeatsList', 'feat', v_name,
    'codex-keep-candidate-' || v_token, '{"value":"new"}'::jsonb
  );
  SELECT item.id INTO v_item_id
  FROM public.content_import_items AS item
  WHERE item.import_id = v_import_id
  ORDER BY item.ordinal
  LIMIT 1;
  SELECT import_record.revision INTO v_revision
  FROM public.content_imports AS import_record
  WHERE import_record.id = v_import_id;
  SELECT resolution.revision INTO v_revision
  FROM public.resolve_mpmb_import_item_conflict(
    v_import_id, v_item_id, v_revision, 'keep_both', NULL, NULL
  ) AS resolution;
  SELECT committed.content_id, committed.version
  INTO v_result_id, v_version
  FROM public.commit_mpmb_import(v_import_id, v_revision) AS committed;

  IF v_result_id = v_target_id OR v_version <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.content_definitions AS definition
    WHERE definition.id = v_result_id
      AND definition.scope = 'personal'
      AND definition.owner_id = v_actor_id
      AND definition.slug =
        pg_catalog.left('codex-keep-candidate-' || v_token, 110)
        || '-'
        || pg_catalog.substr(
          pg_catalog.replace(v_item_id::text, '-', ''),
          1,
          8
        )
  ) OR NOT EXISTS (
    SELECT 1 FROM public.content_import_origins AS origin
    WHERE origin.import_item_id = v_item_id
      AND origin.content_id = v_result_id
      AND origin.content_version = 1
      AND origin.disposition = 'created'
      AND origin.replaced_from_version IS NULL
  ) THEN
    RAISE EXCEPTION 'Keep-both identity/provenance failed';
  END IF;

  -- A real campaign share makes the target non-replaceable and denied.
  v_name := 'Codex Shared ' || v_token;
  INSERT INTO public.content_definitions (
    system_id, content_type, slug, name, data, effects, source, scope, owner_id
  ) VALUES (
    v_system_id, 'spell', 'codex-shared-' || v_token, v_name,
    '{"value":"old"}'::jsonb, '[]'::jsonb,
    'homebrew', 'personal', v_actor_id
  ) RETURNING id INTO v_target_id;
  INSERT INTO public.campaigns (system_id, owner_id, name)
  VALUES (v_system_id, v_actor_id, 'Codex Share Campaign ' || v_token)
  RETURNING id INTO v_campaign_id;
  PERFORM public.set_content_campaign_share(
    v_target_id, v_campaign_id, true, 1
  );

  v_import_id := pg_temp.stage_one(
    'shared-' || v_token, 'SpellsList', 'spell', v_name,
    'codex-shared-candidate-' || v_token, '{"value":"new"}'::jsonb
  );
  SELECT item.id INTO v_item_id
  FROM public.content_import_items AS item
  WHERE item.import_id = v_import_id
  ORDER BY item.ordinal
  LIMIT 1;
  SELECT import_record.revision INTO v_revision
  FROM public.content_imports AS import_record
  WHERE import_record.id = v_import_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.list_mpmb_import_item_conflicts(v_import_id) AS conflict
    WHERE conflict.content_id = v_target_id
      AND conflict.version = 2
      AND conflict.scope = 'shared'
      AND conflict.shared_campaign_count = 1
      AND NOT conflict.replaceable
  ) THEN
    RAISE EXCEPTION 'Shared conflict listing failed';
  END IF;

  v_caught := false;
  BEGIN
    PERFORM public.resolve_mpmb_import_item_conflict(
      v_import_id, v_item_id, v_revision, 'replace', v_target_id, 2
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_error_state = RETURNED_SQLSTATE,
      v_error_message = MESSAGE_TEXT;
    IF v_error_state <> '42501'
      OR v_error_message <> 'Shared content must be unshared before replacement'
    THEN
      RAISE;
    END IF;
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'Shared replacement was accepted'; END IF;

  -- Stale import and exact target revisions reject without mutation.
  v_name := 'Codex Stale ' || v_token;
  INSERT INTO public.content_definitions (
    system_id, content_type, slug, name, data, effects, source, scope, owner_id
  ) VALUES (
    v_system_id, 'feat', 'codex-stale-' || v_token, v_name,
    '{"value":"old"}'::jsonb, '[]'::jsonb,
    'homebrew', 'personal', v_actor_id
  ) RETURNING id INTO v_target_id;
  v_import_id := pg_temp.stage_one(
    'stale-' || v_token, 'FeatsList', 'feat', v_name,
    'codex-stale-candidate-' || v_token, '{"value":"new"}'::jsonb
  );
  SELECT item.id INTO v_item_id
  FROM public.content_import_items AS item
  WHERE item.import_id = v_import_id
  ORDER BY item.ordinal
  LIMIT 1;
  PERFORM public.set_mpmb_import_item_selected(v_import_id, v_item_id, false, 1);
  PERFORM public.set_mpmb_import_item_selected(v_import_id, v_item_id, true, 2);

  v_caught := false;
  BEGIN
    PERFORM public.resolve_mpmb_import_item_conflict(
      v_import_id, v_item_id, 1, 'keep_both', NULL, NULL
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
    IF v_error_state <> '40001' THEN RAISE; END IF;
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'Stale import revision was accepted'; END IF;

  UPDATE public.content_definitions AS definition
  SET data = '{"value":"changed"}'::jsonb
  WHERE definition.id = v_target_id;

  v_caught := false;
  BEGIN
    PERFORM public.resolve_mpmb_import_item_conflict(
      v_import_id, v_item_id, 3, 'replace', v_target_id, 1
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
    IF v_error_state <> '40001' THEN RAISE; END IF;
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'Stale target version was accepted'; END IF;
  IF (
    SELECT import_record.revision FROM public.content_imports AS import_record
    WHERE import_record.id = v_import_id
  ) <> 3 OR EXISTS (
    SELECT 1 FROM public.content_import_items AS item
    WHERE item.id = v_item_id AND item.conflict_resolution IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Stale resolution mutated import state';
  END IF;

  -- A disappeared replace intent normalizes and creates a new private v1.
  v_name := 'Codex Vanish ' || v_token;
  INSERT INTO public.content_definitions (
    system_id, content_type, slug, name, data, effects, source, scope, owner_id
  ) VALUES (
    v_system_id, 'feat', 'codex-vanish-' || v_token, v_name,
    '{"value":"old"}'::jsonb, '[]'::jsonb,
    'homebrew', 'personal', v_actor_id
  ) RETURNING id INTO v_target_id;
  v_import_id := pg_temp.stage_one(
    'vanish-' || v_token, 'FeatsList', 'feat', v_name,
    'codex-vanish-candidate-' || v_token, '{"value":"new"}'::jsonb
  );
  SELECT item.id INTO v_item_id
  FROM public.content_import_items AS item
  WHERE item.import_id = v_import_id
  ORDER BY item.ordinal
  LIMIT 1;
  SELECT resolution.revision INTO v_revision
  FROM public.resolve_mpmb_import_item_conflict(
    v_import_id, v_item_id, 1, 'replace', v_target_id, 1
  ) AS resolution;
  UPDATE public.content_definitions AS definition
  SET name = definition.name || ' Renamed'
  WHERE definition.id = v_target_id;
  SELECT committed.content_id, committed.version
  INTO v_result_id, v_version
  FROM public.commit_mpmb_import(v_import_id, v_revision) AS committed;

  IF v_result_id = v_target_id OR v_version <> 1 OR EXISTS (
    SELECT 1 FROM public.content_import_items AS item
    WHERE item.id = v_item_id
      AND (
        item.conflict_resolution IS NOT NULL
        OR item.replacement_content_id IS NOT NULL
        OR item.replacement_expected_version IS NOT NULL
        OR item.conflict_resolved_at IS NOT NULL
      )
  ) OR NOT EXISTS (
    SELECT 1 FROM public.content_import_origins AS origin
    WHERE origin.import_item_id = v_item_id
      AND origin.content_id = v_result_id
      AND origin.disposition = 'created'
  ) THEN
    RAISE EXCEPTION 'Disappearing conflict fallback failed';
  END IF;

  -- Roll back a real first replacement write when the second item hits its
  -- pre-created exact identity after preflight.
  v_name := 'Codex Atomic First ' || v_token;
  v_second_name := 'Codex Atomic Second ' || v_token;
  INSERT INTO public.content_definitions (
    system_id, content_type, slug, name, data, effects, source, scope, owner_id
  ) VALUES (
    v_system_id, 'feat', 'codex-atomic-target-' || v_token, v_name,
    '{"value":"first-old"}'::jsonb, '[]'::jsonb,
    'homebrew', 'personal', v_actor_id
  ) RETURNING id INTO v_target_id;

  v_import_id := pg_temp.stage_two(
    'atomic-' || v_token,
    v_name,
    'codex-atomic-first-candidate-' || v_token,
    v_second_name,
    'codex-atomic-second-candidate-' || v_token
  );
  SELECT item.id INTO v_item_id
  FROM public.content_import_items AS item
  WHERE item.import_id = v_import_id AND item.ordinal = 0;
  SELECT item.id INTO v_item_two_id
  FROM public.content_import_items AS item
  WHERE item.import_id = v_import_id AND item.ordinal = 1;
  v_blocker_slug :=
    pg_catalog.left('codex-atomic-second-candidate-' || v_token, 110)
    || '-'
    || pg_catalog.substr(
      pg_catalog.replace(v_item_two_id::text, '-', ''),
      1,
      8
    );
  INSERT INTO public.content_definitions (
    system_id, content_type, slug, name, data, effects, source, scope, owner_id
  ) VALUES (
    v_system_id, 'feat', v_blocker_slug, 'Codex Slug Blocker ' || v_token,
    '{"value":"blocker"}'::jsonb, '[]'::jsonb,
    'homebrew', 'personal', v_actor_id
  ) RETURNING id INTO v_blocker_id;

  SELECT resolution.revision INTO v_revision
  FROM public.resolve_mpmb_import_item_conflict(
    v_import_id, v_item_id, 1, 'replace', v_target_id, 1
  ) AS resolution;

  v_caught := false;
  BEGIN
    PERFORM public.commit_mpmb_import(v_import_id, v_revision);
  EXCEPTION WHEN unique_violation THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'Expected late unique violation did not occur';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.content_definitions AS definition
    WHERE definition.id = v_target_id
      AND definition.version = 1
      AND definition.data = '{"value":"first-old"}'::jsonb
  ) OR EXISTS (
    SELECT 1 FROM public.content_import_items AS item
    WHERE item.import_id = v_import_id
      AND item.committed_content_id IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.content_import_origins AS origin
    WHERE origin.import_id = v_import_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.content_imports AS import_record
    WHERE import_record.id = v_import_id
      AND import_record.status = 'review'
      AND import_record.revision = v_revision
      AND import_record.completed_at IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.content_definitions AS definition
    WHERE definition.id = v_blocker_id
  ) THEN
    RAISE EXCEPTION 'Late failure was not fully atomic';
  END IF;
END
$smoke$;

ROLLBACK;
SELECT 'mpmb_conflict_resolution_smoke_ok' AS result;
