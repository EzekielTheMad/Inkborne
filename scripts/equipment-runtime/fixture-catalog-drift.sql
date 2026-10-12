-- G2 only: privileged postgres edits only this synthetic platform definition.
BEGIN;
DO $drift$
DECLARE r jsonb := current_setting('inkborne.r07.roots')::jsonb; evidence jsonb := current_setting('inkborne.r07.state')::jsonb;
  original jsonb; revision jsonb := current_setting('inkborne.r07.feature_v2')::jsonb; before_snapshot jsonb; after_snapshot jsonb; affected integer;
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres' THEN RAISE EXCEPTION 'Catalog drift edit actor mismatch'; END IF;
  SELECT value INTO original FROM jsonb_array_elements(current_setting('inkborne.r07.definitions')::jsonb) WHERE value->>'id'=r->>'feature';
  IF NOT EXISTS (SELECT FROM public.content_definitions WHERE id=(r->>'feature')::uuid AND version=1 AND data=original->'data' AND effects=original->'effects') THEN RAISE EXCEPTION 'Original current feature drift'; END IF;
  SELECT to_jsonb(v) INTO before_snapshot FROM public.content_versions v WHERE content_id=(r->>'feature')::uuid AND version=1;
  UPDATE public.content_definitions SET data=revision->'data',effects=revision->'effects' WHERE id=(r->>'feature')::uuid AND version=1;
  GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'Finite feature update mismatch'; END IF;
  IF NOT EXISTS (SELECT FROM public.content_definitions WHERE id=(r->>'feature')::uuid AND version=2 AND data=revision->'data' AND effects=revision->'effects'
      AND system_id=(r->>'system')::uuid AND slug=original->>'slug' AND source='srd' AND scope='platform' AND owner_id IS NULL)
    OR NOT EXISTS (SELECT FROM public.content_versions WHERE content_id=(r->>'feature')::uuid AND version=2 AND data_snapshot=revision->'data' AND effects_snapshot=revision->'effects') THEN RAISE EXCEPTION 'Real v2 snapshot trigger mismatch'; END IF;
  SELECT to_jsonb(v) INTO after_snapshot FROM public.content_versions v WHERE content_id=(r->>'feature')::uuid AND version=1;
  IF before_snapshot IS NULL OR before_snapshot IS DISTINCT FROM after_snapshot OR NOT EXISTS (SELECT FROM public.character_feature_grants WHERE character_id=(evidence->>'source')::uuid AND feature_content_id=(r->>'feature')::uuid AND feature_version=1)
    OR NOT EXISTS (SELECT FROM public.character_content_refs WHERE character_id=(evidence->>'source')::uuid AND content_id=(r->>'feature')::uuid AND content_version=1 AND feature_grant_id IS NOT NULL) THEN RAISE EXCEPTION 'Catalog update changed historical pin/grant'; END IF;
END $drift$;
COMMIT;
