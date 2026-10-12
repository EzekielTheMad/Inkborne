BEGIN;
SET LOCAL ROLE authenticated;
DO $copy$
DECLARE r jsonb := current_setting('inkborne.r07.roots')::jsonb; evidence jsonb := current_setting('inkborne.r07.state')::jsonb; s uuid := (evidence->>'source')::uuid;
  destination uuid; source_before jsonb; source_after jsonb; source_rows jsonb; after_rows jsonb; original jsonb; inherited uuid; resolved_name text := current_setting('inkborne.r07.run')||'-copy';
BEGIN
  PERFORM set_config('request.jwt.claim.sub',r->>'owner',true); PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',r->>'owner','role','authenticated')::text,true);
  IF current_user <> 'authenticated' OR auth.uid() IS DISTINCT FROM (r->>'owner')::uuid THEN RAISE EXCEPTION 'Copy claims mismatch'; END IF;
  SELECT to_jsonb(c) INTO source_before FROM public.characters c WHERE id=s;
  SELECT value INTO original FROM jsonb_array_elements(current_setting('inkborne.r07.definitions')::jsonb) WHERE value->>'id'=r->>'feature';
  IF NOT EXISTS (SELECT FROM public.content_definitions WHERE id=(r->>'feature')::uuid AND version=2 AND data=current_setting('inkborne.r07.feature_v2')::jsonb->'data' AND effects=current_setting('inkborne.r07.feature_v2')::jsonb->'effects') THEN RAISE EXCEPTION 'Copy must face real canonical v2 catalog drift'; END IF;
  SELECT jsonb_build_object('refs',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.character_content_refs x WHERE character_id=s),'features',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.character_feature_grants x WHERE character_id=s),'spellgrants',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.character_spell_grants x WHERE character_id=s),'spells',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.character_spells x WHERE character_id=s),'inventory',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.character_inventory x WHERE character_id=s),'marker',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.character_starting_grants x WHERE character_id=s)) INTO source_rows;
  destination := public.copy_character(s,NULL,resolved_name);
  IF destination=s OR destination IS NULL THEN RAISE EXCEPTION 'Copy identity missing'; END IF;
  -- Copy materializes controller grants and remaps copied spells; ordinary owner sync materializes feature refs.
  IF (SELECT count(*) FROM public.character_content_refs WHERE character_id=destination) <> 1 THEN RAISE EXCEPTION 'Unexpected direct copy pins'; END IF;
  PERFORM public.sync_character_feature_refs(destination);
  PERFORM public.sync_character_spell_grants(destination);
  IF NOT EXISTS (SELECT FROM public.character_feature_grants g JOIN public.character_content_refs ref ON ref.feature_grant_id=g.id AND ref.character_id=g.character_id
      JOIN public.content_versions v ON v.content_id=ref.content_id AND v.version=ref.content_version WHERE g.character_id=destination AND g.feature_content_id=(r->>'feature')::uuid
      AND g.feature_version=1 AND ref.content_version=1 AND v.data_snapshot=original->'data' AND v.effects_snapshot=original->'effects'
      AND NOT EXISTS (SELECT FROM public.character_feature_grants old WHERE old.character_id=s AND old.id=g.id)) THEN RAISE EXCEPTION 'Latest feature substitution changed copied immutable data/effects'; END IF;
  SELECT id INTO inherited FROM public.character_starting_grants WHERE character_id=destination AND status='inherited_completion' AND receipt IS NULL AND canonical_intent IS NULL;
  IF inherited IS NULL OR inherited=(evidence->'receipt'->>'grant_id')::uuid THEN RAISE EXCEPTION 'Inherited marker mismatch'; END IF;
  IF NOT EXISTS (SELECT FROM public.characters c WHERE id=destination AND user_id=(r->>'owner')::uuid AND system_id=(r->>'system')::uuid AND campaign_id IS NULL
      AND choices=source_before->'choices' AND state=source_before->'state' AND base_stats=source_before->'base_stats' AND level=4 AND visibility='private' AND NOT archived)
    OR NOT EXISTS (SELECT FROM public.character_inventory WHERE character_id=destination AND content_id=(r->>'item')::uuid AND content_version=1 AND quantity=1 AND starting_grant_id=inherited)
    OR (SELECT count(*) FROM public.character_inventory WHERE character_id=destination) <> 1 THEN RAISE EXCEPTION 'Copy state/provenance mismatch'; END IF;
  IF (SELECT jsonb_agg(jsonb_build_array(content_id,content_version) ORDER BY content_id,content_version) FROM public.character_content_refs WHERE character_id=destination)
      IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_array(content_id,content_version) ORDER BY content_id,content_version) FROM public.character_content_refs WHERE character_id=s) THEN RAISE EXCEPTION 'Exact copied pins mismatch'; END IF;
  IF (SELECT jsonb_agg(jsonb_build_array(controller_type,controller_slug,feature_slug,feature_content_id,feature_version,unlock_level) ORDER BY feature_slug) FROM public.character_feature_grants WHERE character_id=destination)
      IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_array(controller_type,controller_slug,feature_slug,feature_content_id,feature_version,unlock_level) ORDER BY feature_slug) FROM public.character_feature_grants WHERE character_id=s)
    OR EXISTS (SELECT FROM public.character_feature_grants d JOIN public.character_feature_grants o ON d.id=o.id WHERE d.character_id=destination AND o.character_id=s)
    OR EXISTS (SELECT FROM public.character_content_refs x JOIN public.character_feature_grants g ON g.id=x.feature_grant_id WHERE x.character_id=destination AND g.character_id<>destination) THEN RAISE EXCEPTION 'Copied feature grants not remapped'; END IF;
  IF (SELECT jsonb_agg(jsonb_build_array(controller_type,controller_slug,class_slug,spell_slug,spell_content_id,spell_version,unlock_level) ORDER BY spell_slug) FROM public.character_spell_grants WHERE character_id=destination)
      IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_array(controller_type,controller_slug,class_slug,spell_slug,spell_content_id,spell_version,unlock_level) ORDER BY spell_slug) FROM public.character_spell_grants WHERE character_id=s)
    OR NOT EXISTS (SELECT FROM public.character_spells x JOIN public.character_spell_grants g ON g.id=x.spell_grant_id AND g.character_id=x.character_id WHERE x.character_id=destination AND x.content_id=(r->>'spell')::uuid AND x.content_version=1 AND x.source='feature' AND x.always_prepared AND x.is_prepared)
    OR (SELECT count(*) FROM public.character_spells WHERE character_id=destination) <> 1 THEN RAISE EXCEPTION 'Copied exact spell/grant mismatch'; END IF;
  SELECT to_jsonb(c) INTO source_after FROM public.characters c WHERE id=s;
  SELECT jsonb_build_object('refs',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.character_content_refs x WHERE character_id=s),'features',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.character_feature_grants x WHERE character_id=s),'spellgrants',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.character_spell_grants x WHERE character_id=s),'spells',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.character_spells x WHERE character_id=s),'inventory',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.character_inventory x WHERE character_id=s),'marker',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.character_starting_grants x WHERE character_id=s)) INTO after_rows;
  IF source_before IS DISTINCT FROM source_after OR source_rows IS DISTINCT FROM after_rows THEN RAISE EXCEPTION 'Copy mutated source'; END IF;
  PERFORM set_config('inkborne.r07.copy',destination::text,false);
END $copy$;
COMMIT;
