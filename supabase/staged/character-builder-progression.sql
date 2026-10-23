-- Draft builder progression only. Install after character-builder-catalog.sql.
-- Original first-acquisition occurrence/lifecycle/origin ledger stays historical.
-- A separate append-only native builder history records accepted draft edits.
BEGIN;
DO $preflight$
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR pg_catalog.to_regprocedure('private.apply_builder_catalog_command_v1(uuid,text,jsonb)') IS NULL
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_progression_installation_unavailable' USING ERRCODE='42501'; END IF;
END $preflight$;
ALTER TABLE private.character_builder_capabilities_v1 ADD COLUMN expected_choices jsonb,
  ADD COLUMN expected_level integer CHECK(expected_level BETWEEN 1 AND 20), ADD COLUMN expected_state jsonb;
CREATE TABLE private.character_builder_progression_history_v1 (
  actor_id uuid NOT NULL,operation_id uuid NOT NULL,character_id uuid NOT NULL,command text NOT NULL,
  before_parent jsonb NOT NULL,after_parent jsonb NOT NULL,before_graph jsonb NOT NULL,after_graph jsonb NOT NULL,
  before_order jsonb NOT NULL,after_order jsonb NOT NULL,receipt jsonb NOT NULL,created_at timestamptz NOT NULL,
  PRIMARY KEY(actor_id,operation_id),
  FOREIGN KEY(actor_id,operation_id) REFERENCES private.character_builder_receipts_v1(actor_id,operation_id),
  CHECK(command IN ('set_class_level','save_hp_roll','select_asi','select_class_spells')),
  CHECK(pg_catalog.octet_length(pg_catalog.to_jsonb(ROW(before_parent,after_parent,before_graph,after_graph,before_order,after_order,receipt))::text)<=16777216)
);
CREATE TABLE private.character_builder_hp_draws_v1 (
  character_id uuid NOT NULL,occurrence_id uuid NOT NULL,level integer NOT NULL CHECK(level BETWEEN 2 AND 20),
  actor_id uuid NOT NULL,operation_id uuid NOT NULL,die integer NOT NULL CHECK(die IN (4,6,8,10,12)),
  value integer NOT NULL CHECK(value BETWEEN 1 AND die),created_at timestamptz NOT NULL,
  PRIMARY KEY(character_id,occurrence_id,level),
  FOREIGN KEY(actor_id,operation_id) REFERENCES private.character_builder_receipts_v1(actor_id,operation_id) DEFERRABLE INITIALLY DEFERRED
);
DO $tables$
DECLARE relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['character_builder_progression_history_v1','character_builder_hp_draws_v1'] LOOP
    EXECUTE pg_catalog.format('ALTER TABLE private.%I OWNER TO postgres',relation_name);
    EXECUTE pg_catalog.format('ALTER TABLE private.%I ENABLE ROW LEVEL SECURITY',relation_name);
    EXECUTE pg_catalog.format('ALTER TABLE private.%I FORCE ROW LEVEL SECURITY',relation_name);
    EXECUTE pg_catalog.format('CREATE POLICY builder_progression_internal ON private.%I TO postgres USING(true) WITH CHECK(true)',relation_name);
    EXECUTE pg_catalog.format('REVOKE ALL ON private.%I FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner',relation_name);
  END LOOP;
END $tables$;
CREATE FUNCTION private.builder_progression_history_immutable_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
  RAISE EXCEPTION 'builder_progression_history_immutable' USING ERRCODE='42501';
END $$;
CREATE TRIGGER builder_progression_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON private.character_builder_progression_history_v1
  FOR EACH STATEMENT EXECUTE FUNCTION private.builder_progression_history_immutable_v1();
CREATE TRIGGER builder_hp_draws_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON private.character_builder_hp_draws_v1
  FOR EACH STATEMENT EXECUTE FUNCTION private.builder_progression_history_immutable_v1();

-- Only the draft level ceiling changes. Genuine original acquisition, current
-- session, class-origin revision one and unchanged identity/history stay required.
DO $catalog_level_profile$
DECLARE source text; next_source text; definition text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef('private.mint_builder_step_v1(jsonb,public.characters,text)'::pg_catalog.regprocedure),prosrc
    INTO definition,source FROM pg_catalog.pg_proc WHERE oid='private.mint_builder_step_v1(jsonb,public.characters,text)'::pg_catalog.regprocedure;
  next_source:=pg_catalog.replace(source,'parent.level<>1','parent.level NOT BETWEEN 1 AND 20');
  IF next_source=source THEN RAISE EXCEPTION 'builder_progression_mint_drift' USING ERRCODE='42501'; END IF;
  EXECUTE pg_catalog.replace(definition,source,next_source);
  SELECT pg_catalog.pg_get_functiondef('private.apply_builder_catalog_command_v1(uuid,text,jsonb)'::pg_catalog.regprocedure),prosrc
    INTO definition,source FROM pg_catalog.pg_proc WHERE oid='private.apply_builder_catalog_command_v1(uuid,text,jsonb)'::pg_catalog.regprocedure;
  next_source:=pg_catalog.replace(source,'parent.choices#>''{classes,0,level}'' IS DISTINCT FROM ''1''::jsonb',
    'parent.choices#>''{classes,0,level}'' IS DISTINCT FROM pg_catalog.to_jsonb(parent.level)');
  next_source:=pg_catalog.replace(next_source,'g.unlock_level<=1','g.unlock_level<=parent.level');
  next_source:=pg_catalog.replace(next_source,'IF unlock_level<=1 THEN','IF unlock_level<=parent.level THEN');
  next_source:=pg_catalog.replace(next_source,'(g.value->>''unlock_level'')::integer<=1','(g.value->>''unlock_level'')::integer<=parent.level');
  next_source:=pg_catalog.replace(next_source,'l.value->>''level''=''1''','(l.value->>''level'')::integer<=parent.level');
  next_source:=pg_catalog.replace(next_source,'  next_occurrence:=occurrence||', $catalog_asi$
  IF next_choices ? 'asi_choices' THEN
    SELECT COALESCE(pg_catalog.jsonb_object_agg(a.key,a.value),'{}') INTO normalized
      FROM pg_catalog.jsonb_each(next_choices->'asi_choices') a(key,value)
      WHERE EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(features) g(value)
        WHERE g.value->>'feature_slug'=a.key AND (g.value->>'unlock_level')::integer<=parent.level);
    next_choices:=pg_catalog.jsonb_set(next_choices,'{asi_choices}',normalized,true);
    SELECT COALESCE(pg_catalog.jsonb_agg(r.value),'[]') INTO refs FROM pg_catalog.jsonb_array_elements(refs) r(value)
      WHERE COALESCE(r.value->>'choice_source','') NOT LIKE 'choice:asi:%'
        OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(features) g(value)
          WHERE r.value->>'choice_source'='choice:asi:'||(g.value->>'id') AND (g.value->>'unlock_level')::integer<=parent.level);
  END IF;
  next_occurrence:=occurrence||$catalog_asi$);
  -- The catalog compiler has no normalized local before this profile.
  next_source:=pg_catalog.replace(next_source,'  casting_ability text;', '  normalized jsonb; casting_ability text;');
  next_source:=pg_catalog.replace(next_source,'SET expected_graph=expected,expected_classes=next_choices->''classes''',
    'SET expected_graph=expected,expected_classes=next_choices->''classes'',expected_choices=next_choices');
  IF next_source=source THEN RAISE EXCEPTION 'builder_progression_catalog_drift' USING ERRCODE='42501'; END IF;
  EXECUTE pg_catalog.replace(definition,source,next_source);
END $catalog_level_profile$;

-- The SQL prerequisite calculator now includes the same finite source-owned
-- ability choice bonus as the app (Half-Elf), rather than trusting picked text.
ALTER FUNCTION private.character_ability_scores(uuid,uuid,text,text) RENAME TO character_ability_scores_before_builder_progression_v1;
CREATE FUNCTION private.character_ability_scores(target_character_id uuid,excluded_content_id uuid DEFAULT NULL,
  excluded_asi_key text DEFAULT NULL,excluded_choice_source text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE scores jsonb; item record; picked jsonb; choices jsonb; selections jsonb; choice_count integer;
BEGIN
  scores:=private.character_ability_scores_before_builder_progression_v1(target_character_id,excluded_content_id,excluded_asi_key,excluded_choice_source);
  SELECT c.choices INTO choices FROM public.characters c WHERE c.id=target_character_id;
  FOR item IN SELECT e.value AS effect FROM public.character_content_refs r JOIN public.content_versions v
    ON v.content_id=r.content_id AND v.version=r.content_version CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(v.effects_snapshot) e(value)
    WHERE r.character_id=target_character_id AND (excluded_content_id IS NULL OR r.content_id<>excluded_content_id)
      AND (excluded_choice_source IS NULL OR r.choice_source IS DISTINCT FROM excluded_choice_source)
      AND e.value->>'type'='choice' AND e.value->>'grant_type'='ability_bonus' LOOP
    IF COALESCE(item.effect->>'choose','') !~ '^[1-9][0-9]{0,2}$' OR pg_catalog.jsonb_typeof(item.effect->'from') IS DISTINCT FROM 'array'
      OR pg_catalog.jsonb_typeof(item.effect->'choice_id') IS DISTINCT FROM 'string' THEN CONTINUE; END IF;
    selections:=choices#>ARRAY['resolved_choices',item.effect->>'choice_id'];
    IF pg_catalog.jsonb_typeof(selections) IS DISTINCT FROM 'array' THEN CONTINUE; END IF;
    SELECT count(*) INTO choice_count FROM public.character_content_refs r JOIN public.content_versions v
      ON v.content_id=r.content_id AND v.version=r.content_version CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(v.effects_snapshot) e(value)
      WHERE r.character_id=target_character_id AND e.value->>'type'='choice' AND e.value->>'choice_id'=item.effect->>'choice_id';
    IF choice_count<>1 OR pg_catalog.jsonb_array_length(selections)>(item.effect->>'choose')::integer
      OR (SELECT count(DISTINCT value) FROM pg_catalog.jsonb_array_elements(selections))<>pg_catalog.jsonb_array_length(selections)
      OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(selections) s(value)
        WHERE pg_catalog.jsonb_typeof(s.value) IS DISTINCT FROM 'string'
          OR s.value#>>'{}' NOT IN ('strength','dexterity','constitution','intelligence','wisdom','charisma')
          OR NOT (item.effect->'from') @> pg_catalog.jsonb_build_array(s.value)) THEN CONTINUE; END IF;
    FOR picked IN SELECT value FROM pg_catalog.jsonb_array_elements(selections) LOOP
      scores:=pg_catalog.jsonb_set(scores,ARRAY[picked#>>'{}'],pg_catalog.to_jsonb((scores->>(picked#>>'{}'))::numeric+1));
    END LOOP;
  END LOOP;
  RETURN scores;
END $$;

CREATE FUNCTION private.builder_progression_asi_write_v1(before_row jsonb,after_row jsonb,domain text) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; identity_row jsonb;
BEGIN
  identity_row:=COALESCE(after_row,before_row);
  SELECT * INTO cap FROM private.character_builder_capabilities_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id()
      AND character_id=(CASE domain WHEN 'parent' THEN identity_row->>'id' ELSE identity_row->>'character_id' END)::uuid;
  IF NOT FOUND OR cap.command NOT IN ('set_class_level','select_asi','select_subclass') OR cap.expected_choices IS NULL THEN RETURN false; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap.context,cap.character_id);
  IF domain='parent' THEN
    RETURN after_row->'choices'->'asi_choices' IS NOT DISTINCT FROM cap.expected_choices->'asi_choices';
  END IF;
  RETURN (before_row IS NULL OR (cap.protected_graph->'refs') @> pg_catalog.jsonb_build_array(before_row))
    AND (after_row IS NULL OR (cap.expected_graph->'refs') @> pg_catalog.jsonb_build_array(after_row));
END $$;
DO $asi_boundaries$
DECLARE source text; next_source text; definition text; signature text; prefix text;
BEGIN
  FOREACH signature IN ARRAY ARRAY['private.enforce_asi_choice_map_boundary()','private.enforce_asi_choice_ref_boundary()'] LOOP
    SELECT pg_catalog.pg_get_functiondef(signature::pg_catalog.regprocedure),prosrc INTO definition,source
      FROM pg_catalog.pg_proc WHERE oid=signature::pg_catalog.regprocedure;
    prefix:=CASE WHEN signature LIKE '%map_boundary%' THEN
      E'BEGIN\n  IF private.builder_progression_asi_write_v1(pg_catalog.to_jsonb(OLD),pg_catalog.to_jsonb(NEW),''parent'') THEN RETURN NEW; END IF;'
      ELSE E'BEGIN\n  IF private.builder_progression_asi_write_v1(CASE WHEN TG_OP<>''INSERT'' THEN pg_catalog.to_jsonb(OLD) END,CASE WHEN TG_OP<>''DELETE'' THEN pg_catalog.to_jsonb(NEW) END,''refs'') THEN IF TG_OP=''DELETE'' THEN RETURN OLD; END IF; RETURN NEW; END IF;' END;
    next_source:=pg_catalog.regexp_replace(source,E'\\mBEGIN\\M',prefix);
    IF next_source=source THEN RAISE EXCEPTION 'builder_progression_asi_boundary_drift' USING ERRCODE='42501'; END IF;
    EXECUTE pg_catalog.replace(definition,source,next_source);
  END LOOP;
END $asi_boundaries$;

CREATE FUNCTION private.builder_progression_spell_guard_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE before_row jsonb; after_row jsonb; identity_row jsonb; cap private.character_builder_capabilities_v1%ROWTYPE;
BEGIN
  IF TG_OP<>'INSERT' THEN before_row:=pg_catalog.to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN after_row:=pg_catalog.to_jsonb(NEW); END IF;
  IF before_row#>'{custom_data,builder_class_controller_ref_id}' IS NOT NULL
    OR after_row#>'{custom_data,builder_class_controller_ref_id}' IS NOT NULL THEN
    identity_row:=COALESCE(after_row,before_row);
    SELECT * INTO cap FROM private.character_builder_capabilities_v1
      WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=(identity_row->>'character_id')::uuid;
    IF NOT FOUND OR (before_row IS NOT NULL AND NOT (cap.protected_graph->'spells') @> pg_catalog.jsonb_build_array(before_row))
      OR (after_row IS NOT NULL AND NOT (cap.expected_graph->'spells') @> pg_catalog.jsonb_build_array(after_row)) THEN
      RAISE EXCEPTION 'builder_class_spell_provenance_required' USING ERRCODE='42501'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER builder_progression_spell_provenance BEFORE INSERT OR UPDATE OR DELETE ON public.character_spells
  FOR EACH ROW EXECUTE FUNCTION private.builder_progression_spell_guard_v1();

CREATE FUNCTION private.builder_progression_scores_v1(target uuid,pending_choices jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE scores jsonb; before_choices jsonb; ability text; old_bonus numeric; new_bonus numeric; old_feat_bonus numeric; new_feat_bonus numeric;
BEGIN
  scores:=private.character_ability_scores(target,NULL,NULL,NULL);
  SELECT c.choices INTO before_choices FROM public.characters c WHERE c.id=target;
  FOREACH ability IN ARRAY ARRAY['strength','dexterity','constitution','intelligence','wisdom','charisma'] LOOP
    SELECT COALESCE(sum((a.value->>'amount')::numeric),0) INTO old_bonus
      FROM pg_catalog.jsonb_each(COALESCE(before_choices->'asi_choices','{}')) c(key,value)
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(COALESCE(c.value->'allocations','[]')) a(value)
      WHERE c.value->>'mode'='asi' AND a.value->>'ability'=ability;
    SELECT COALESCE(sum((a.value->>'amount')::numeric),0) INTO new_bonus
      FROM pg_catalog.jsonb_each(COALESCE(pending_choices->'asi_choices','{}')) c(key,value)
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(COALESCE(c.value->'allocations','[]')) a(value)
      WHERE c.value->>'mode'='asi' AND a.value->>'ability'=ability;
    SELECT COALESCE(sum((e.value->>'value')::numeric),0) INTO old_feat_bonus
      FROM public.character_content_refs r JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(v.effects_snapshot) e(value)
      WHERE r.character_id=target AND r.choice_source LIKE 'choice:asi:%' AND v.content_type_snapshot='feat'
        AND e.value->>'type'='mechanical' AND e.value->>'op'='add' AND e.value->>'stat'=ability
        AND pg_catalog.jsonb_typeof(e.value->'value')='number';
    SELECT COALESCE(sum((e.value->>'value')::numeric),0) INTO new_feat_bonus
      FROM pg_catalog.jsonb_each(COALESCE(pending_choices->'asi_choices','{}')) c(key,value)
      JOIN public.content_versions v ON v.content_id=(c.value->>'featId')::uuid AND v.version=(c.value->>'featVersion')::integer
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(v.effects_snapshot) e(value)
      WHERE c.value->>'mode'='feat' AND v.content_type_snapshot='feat'
        AND e.value->>'type'='mechanical' AND e.value->>'op'='add' AND e.value->>'stat'=ability
        AND pg_catalog.jsonb_typeof(e.value->'value')='number';
    scores:=pg_catalog.jsonb_set(scores,ARRAY[ability],pg_catalog.to_jsonb((scores->>ability)::numeric-old_bonus+new_bonus-old_feat_bonus+new_feat_bonus));
  END LOOP;
  RETURN scores;
END $$;

CREATE FUNCTION private.builder_progression_spells_v1(target uuid,choices jsonb,level integer,requested jsonb,prior jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE class_slug text; controller jsonb; definition jsonb; row_config jsonb; known jsonb; spell_list jsonb;
  max_spell_level integer:=0; cantrip_limit integer; known_limit integer; prepared_limit integer; casting_ability text;
  scores jsonb; cantrips integer:=0; learned integer:=0; prepared_count integer:=0; entry jsonb; existing jsonb; result jsonb:='[]';
  selected public.content_versions%ROWTYPE; spell_row public.character_spells%ROWTYPE; spell_level integer; prepare boolean; wizard boolean; prepared_caster boolean;
BEGIN
  class_slug:=choices#>>'{classes,0,slug}';
  SELECT pg_catalog.to_jsonb(r),pg_catalog.to_jsonb(v) INTO controller,definition FROM public.character_content_refs r JOIN public.content_versions v
    ON v.content_id=r.content_id AND v.version=r.content_version WHERE r.character_id=target AND v.content_type_snapshot='class' AND v.slug_snapshot=class_slug;
  SELECT value->'spellcasting' INTO row_config FROM pg_catalog.jsonb_array_elements(definition#>'{data_snapshot,levels}') WHERE value->>'level'=level::text;
  IF row_config IS NULL OR row_config='null'::jsonb THEN
    IF requested<>'[]'::jsonb THEN RAISE EXCEPTION 'builder_class_cannot_cast' USING ERRCODE='22023'; END IF; RETURN result;
  END IF;
  SELECT COALESCE(max(position::integer),0) INTO max_spell_level
    FROM pg_catalog.jsonb_array_elements(row_config->'spell_slots') WITH ORDINALITY slots(value,position) WHERE (value#>>'{}')::integer>0;
  known:=definition#>'{data_snapshot,spellcastingKnown}'; spell_list:=COALESCE(definition#>'{data_snapshot,spellcastingList}',pg_catalog.jsonb_build_object('class',class_slug,'level',ARRAY[0,9]));
  cantrip_limit:=COALESCE((known#>>ARRAY['cantrips',(level-1)::text])::integer,0);
  prepared_caster:=known->'prepared'='true'::jsonb; wizard:=class_slug='wizard';
  IF known->'spells'='"all"'::jsonb OR known->'spells' IS NULL THEN known_limit:=200;
  ELSE known_limit:=COALESCE((known#>>ARRAY['spells',(level-1)::text])::integer,0); END IF;
  IF wizard THEN known_limit:=6+2*(level-1); END IF;
  casting_ability:=definition#>>'{data_snapshot,spellcasting,ability}';
  scores:=private.builder_progression_scores_v1(target,choices);
  IF prepared_caster THEN
    IF NOT scores ? casting_ability THEN RAISE EXCEPTION 'builder_casting_ability_unavailable' USING ERRCODE='22023'; END IF;
    prepared_limit:=GREATEST(1,CASE WHEN class_slug='paladin' THEN level/2 ELSE level END+floor(((scores->>casting_ability)::numeric-10)/2)::integer);
  ELSE prepared_limit:=0; END IF;
  IF pg_catalog.jsonb_typeof(requested)<>'array' OR pg_catalog.jsonb_array_length(requested)>200
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(requested) p(value) GROUP BY value->>'content_id' HAVING count(*)<>1) THEN
    RAISE EXCEPTION 'builder_invalid_spell_selection' USING ERRCODE='22023'; END IF;
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(requested) LOOP
    IF NOT private.builder_exact_keys_v1(entry,ARRAY['content_id','content_version','prepared'])
      OR NOT private.builder_uuid_v1(entry->>'content_id') OR pg_catalog.jsonb_typeof(entry->'content_version')<>'number'
      OR entry->>'content_version' !~ '^[1-9][0-9]{0,9}$' OR (entry->>'content_version')::numeric>2147483647
      OR pg_catalog.jsonb_typeof(entry->'prepared')<>'boolean' THEN RAISE EXCEPTION 'builder_invalid_spell_selection' USING ERRCODE='22023'; END IF;
    SELECT v.* INTO selected FROM public.content_versions v JOIN public.content_definitions d ON d.id=v.content_id
      WHERE v.content_id=(entry->>'content_id')::uuid AND v.version=(entry->>'content_version')::integer AND NOT d.is_retired
        AND v.content_type_snapshot='spell' AND v.system_id_snapshot=(definition->>'system_id_snapshot')::uuid
        AND (d.version=v.version OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(prior) p(value)
          WHERE p.value->'content_id'=entry->'content_id' AND p.value->'content_version'=entry->'content_version' AND p.value->>'class_slug'=class_slug))
        AND private.character_can_access_content_version(target,v.content_id,v.version) FOR SHARE OF v,d;
    IF NOT FOUND THEN RAISE EXCEPTION 'builder_spell_unavailable' USING ERRCODE='42501'; END IF;
    spell_level:=(selected.data_snapshot->>'level')::integer; prepare:=(entry->>'prepared')::boolean;
    IF NOT COALESCE(selected.data_snapshot->'classes','[]') @> pg_catalog.jsonb_build_array(spell_list->>'class')
      OR spell_level>max_spell_level OR spell_level<(spell_list#>>'{level,0}')::integer OR spell_level>(spell_list#>>'{level,1}')::integer THEN
      RAISE EXCEPTION 'builder_spell_not_on_current_list' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(prior) p(value)
      WHERE p.value->'content_id'=entry->'content_id' AND p.value->>'class_slug'=class_slug AND p.value->>'source'<>'selection') THEN
      RAISE EXCEPTION 'builder_spell_already_granted' USING ERRCODE='22023'; END IF;
    IF spell_level=0 THEN cantrips:=cantrips+1; prepare:=true;
    ELSE learned:=learned+1; IF prepare THEN prepared_count:=prepared_count+1; END IF;
      IF NOT prepared_caster AND prepare THEN RAISE EXCEPTION 'builder_known_spell_preparation_unavailable' USING ERRCODE='22023'; END IF;
    END IF;
    SELECT p.value INTO existing FROM pg_catalog.jsonb_array_elements(prior) p(value)
      WHERE p.value->'content_id'=entry->'content_id' AND p.value->'content_version'=entry->'content_version'
        AND p.value->>'class_slug'=class_slug AND p.value->>'source'='selection'
        AND p.value#>>'{custom_data,builder_class_controller_ref_id}'=controller->>'id';
    IF existing IS NULL THEN
      spell_row.id:=pg_catalog.gen_random_uuid(); spell_row.character_id:=target; spell_row.content_id:=selected.content_id; spell_row.content_version:=selected.version;
      spell_row.name:=selected.name_snapshot; spell_row.class_slug:=class_slug; spell_row.is_known:=true; spell_row.is_prepared:=prepare;
      spell_row.always_prepared:=false; spell_row.in_spellbook:=wizard AND spell_level>0; spell_row.source:='selection';
      spell_row.custom_data:=pg_catalog.jsonb_build_object('builder_class_controller_ref_id',controller->>'id');
      spell_row.created_at:=pg_catalog.transaction_timestamp(); spell_row.spell_grant_id:=NULL; existing:=pg_catalog.to_jsonb(spell_row);
    ELSE existing:=existing||pg_catalog.jsonb_build_object('is_prepared',prepare); END IF;
    result:=result||pg_catalog.jsonb_build_array(existing);
  END LOOP;
  IF cantrips>cantrip_limit OR learned>known_limit OR prepared_count>prepared_limit THEN
    RAISE EXCEPTION 'builder_spell_selection_budget_exceeded' USING ERRCODE='22023'; END IF;
  RETURN result;
END $$;

CREATE FUNCTION private.builder_progression_hp_v1(target uuid,occurrence uuid,selected_level integer,die integer,
  method text,requested_value jsonb,actor uuid,operation uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE accepted integer; sample integer; draw private.character_builder_hp_draws_v1%ROWTYPE;
BEGIN
  IF selected_level NOT BETWEEN 2 AND 20 OR die NOT IN (4,6,8,10,12) OR method IS NULL OR method NOT IN ('average','manual','rolled') THEN
    RAISE EXCEPTION 'builder_invalid_hp_selection' USING ERRCODE='22023'; END IF;
  IF method='average' THEN
    accepted:=die/2+1;
    IF requested_value IS DISTINCT FROM 'null'::jsonb AND requested_value IS DISTINCT FROM pg_catalog.to_jsonb(accepted) THEN
      RAISE EXCEPTION 'builder_invalid_hp_average' USING ERRCODE='22023'; END IF;
  ELSIF method='manual' THEN
    IF pg_catalog.jsonb_typeof(requested_value)<>'number' OR requested_value#>>'{}' !~ '^[1-9][0-9]?$'
      OR (requested_value#>>'{}')::integer>die THEN RAISE EXCEPTION 'builder_invalid_hp_manual' USING ERRCODE='22023'; END IF;
    accepted:=(requested_value#>>'{}')::integer;
  ELSE
    IF requested_value IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'builder_hp_roll_is_server_generated' USING ERRCODE='22023'; END IF;
    SELECT * INTO draw FROM private.character_builder_hp_draws_v1 WHERE character_id=target AND occurrence_id=occurrence AND level=selected_level;
    IF FOUND THEN
      IF draw.die<>die OR draw.actor_id<>actor THEN RAISE EXCEPTION 'builder_hp_draw_identity_changed' USING ERRCODE='23514'; END IF;
      accepted:=draw.value;
    ELSE
      -- UUID v4 byte zero is an unmodified uniformly random byte. Rejection
      -- sampling avoids modulo bias; the accepted draw is retained permanently.
      LOOP
        sample:=pg_catalog.get_byte(pg_catalog.decode(pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''),'hex'),0);
        EXIT WHEN sample<256-mod(256,die);
      END LOOP;
      accepted:=1+mod(sample,die);
      INSERT INTO private.character_builder_hp_draws_v1(character_id,occurrence_id,level,actor_id,operation_id,die,value,created_at)
        VALUES(target,occurrence,selected_level,actor,operation,die,accepted,pg_catalog.transaction_timestamp());
    END IF;
  END IF;
  RETURN pg_catalog.jsonb_build_object('method',method,'value',accepted);
END $$;

CREATE FUNCTION private.apply_builder_progression_graph_v1(target uuid,choices jsonb,state jsonb,level integer) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; expected jsonb; entry jsonb;
  pin public.character_content_refs%ROWTYPE; spell public.character_spells%ROWTYPE; current_occurrence jsonb; expected_occurrence jsonb;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND OR cap.expected_choices IS DISTINCT FROM choices OR cap.expected_level IS DISTINCT FROM level
    OR cap.expected_state IS DISTINCT FROM state THEN RAISE EXCEPTION 'builder_progression_plan_required' USING ERRCODE='42501'; END IF;
  expected:=cap.expected_graph;
  DELETE FROM public.character_spells r WHERE r.character_id=target AND NOT EXISTS(
    SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'spells') p(value) WHERE p.value->>'id'=r.id::text);
  DELETE FROM public.character_content_refs r WHERE r.character_id=target AND NOT EXISTS(
      SELECT 1 FROM public.content_versions v WHERE v.content_id=r.content_id AND v.version=r.content_version AND v.content_type_snapshot IN ('race','subrace','background'))
    AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'refs') p(value) WHERE p.value->>'id'=r.id::text);
  UPDATE public.characters SET choices=apply_builder_progression_graph_v1.choices,state=apply_builder_progression_graph_v1.state,
    level=apply_builder_progression_graph_v1.level WHERE id=target AND user_id=cap.actor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'builder_character_unavailable' USING ERRCODE='42501'; END IF;
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(expected->'refs') LOOP
    IF NOT EXISTS(SELECT 1 FROM public.character_content_refs r WHERE r.id=(entry->>'id')::uuid) THEN
      pin:=pg_catalog.jsonb_populate_record(NULL::public.character_content_refs,entry);
      INSERT INTO public.character_content_refs(id,character_id,content_id,content_version,context,choice_source,created_at,feature_grant_id)
        VALUES(pin.id,pin.character_id,pin.content_id,pin.content_version,pin.context,pin.choice_source,pin.created_at,pin.feature_grant_id);
    END IF;
  END LOOP;
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(expected->'spells') LOOP
    SELECT * INTO spell FROM public.character_spells r WHERE r.id=(entry->>'id')::uuid;
    IF FOUND THEN
      IF pg_catalog.to_jsonb(spell) IS DISTINCT FROM entry THEN
        UPDATE public.character_spells SET is_known=(entry->>'is_known')::boolean,is_prepared=(entry->>'is_prepared')::boolean,
          in_spellbook=(entry->>'in_spellbook')::boolean WHERE id=(entry->>'id')::uuid AND character_id=target;
      END IF;
    ELSE
      spell:=pg_catalog.jsonb_populate_record(NULL::public.character_spells,entry);
      INSERT INTO public.character_spells(id,character_id,content_id,content_version,name,class_slug,is_known,is_prepared,always_prepared,in_spellbook,source,custom_data,created_at,spell_grant_id)
        VALUES(spell.id,spell.character_id,spell.content_id,spell.content_version,spell.name,spell.class_slug,spell.is_known,spell.is_prepared,
          spell.always_prepared,spell.in_spellbook,spell.source,spell.custom_data,spell.created_at,spell.spell_grant_id);
    END IF;
  END LOOP;
  current_occurrence:=cap.protected_graph->'occurrences'->0; expected_occurrence:=expected->'occurrences'->0;
  IF current_occurrence IS DISTINCT FROM expected_occurrence THEN
    PERFORM private.apply_builder_subclass_link_v1(target,(current_occurrence->>'id')::uuid,(expected_occurrence->>'subclass_ref_id')::uuid);
  END IF;
END $$;

CREATE FUNCTION private.prepare_builder_progression_v1(target uuid,operation uuid,command text,fields jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; parent public.characters%ROWTYPE;
  controller jsonb; class_version jsonb; occurrence jsonb; expected jsonb; refs jsonb; spells jsonb; next_choices jsonb; next_state jsonb;
  chosen_level integer; selected_class_slug text; die integer; hp jsonb; key text; item jsonb; picked jsonb; definition jsonb; pin jsonb; grant_value jsonb;
  normalized jsonb; allocations jsonb; points integer; scores jsonb; feat public.content_versions%ROWTYPE; prereq record; count_grants integer;
  selected_grant jsonb; feature_source text; source jsonb; spell public.character_spells%ROWTYPE; new_spells jsonb; selected_subclass jsonb;
  subclass_gate integer; removed_subclass uuid; affected text[]; domain text; con_mod integer; max_hp integer:=0; contribution integer;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND OR cap.command<>command THEN RAISE EXCEPTION 'builder_capability_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap.context,target);
  SELECT * INTO parent FROM public.characters c WHERE c.id=target AND c.user_id=cap.actor_id;
  IF NOT FOUND OR pg_catalog.jsonb_array_length(parent.choices->'classes')<>1 THEN
    RAISE EXCEPTION 'builder_single_class_required' USING ERRCODE='42501'; END IF;
  selected_class_slug:=parent.choices#>>'{classes,0,slug}'; chosen_level:=parent.level;
  occurrence:=cap.protected_graph->'occurrences'->0;
  IF occurrence->>'lifecycle'<>'provisional' OR occurrence->>'id' IS DISTINCT FROM parent.choices#>>'{classes,0,occurrence_id}'
    OR parent.choices#>'{classes,0,level}' IS DISTINCT FROM pg_catalog.to_jsonb(parent.level) THEN
    RAISE EXCEPTION 'builder_draft_occurrence_required' USING ERRCODE='42501'; END IF;
  SELECT pg_catalog.to_jsonb(r),pg_catalog.to_jsonb(v) INTO controller,class_version FROM public.character_content_refs r JOIN public.content_versions v
    ON v.content_id=r.content_id AND v.version=r.content_version WHERE r.id=(occurrence->>'controller_ref_id')::uuid AND r.character_id=target;
  IF class_version->>'slug_snapshot' IS DISTINCT FROM selected_class_slug THEN RAISE EXCEPTION 'builder_class_pin_unavailable' USING ERRCODE='23514'; END IF;
  die:=(class_version#>>'{data_snapshot,hit_die}')::integer;
  next_choices:=pg_catalog.jsonb_set(parent.choices,'{resolved_choices}',COALESCE(parent.choices->'resolved_choices','{}'),true);
  next_state:=parent.state; expected:=cap.protected_graph; refs:=expected->'refs'; spells:=expected->'spells';
  IF command='set_class_level' THEN
    IF NOT (private.builder_exact_keys_v1(fields,ARRAY['class_slug','level']) OR private.builder_exact_keys_v1(fields,ARRAY['class_slug','level','hp_roll']))
      OR fields->>'class_slug' IS DISTINCT FROM selected_class_slug OR pg_catalog.jsonb_typeof(fields->'level')<>'number'
      OR fields->>'level' !~ '^([1-9]|1[0-9]|20)$' THEN RAISE EXCEPTION 'builder_invalid_class_level' USING ERRCODE='22023'; END IF;
    chosen_level:=(fields->>'level')::integer;
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(class_version#>'{data_snapshot,levels}') WHERE value->>'level'=chosen_level::text) THEN
      RAISE EXCEPTION 'builder_class_level_unavailable' USING ERRCODE='22023'; END IF;
    next_choices:=pg_catalog.jsonb_set(next_choices,'{classes,0,level}',pg_catalog.to_jsonb(chosen_level));
    normalized:='{}';
    FOR points IN 2..chosen_level LOOP
      key:=selected_class_slug||'-'||points;
      hp:=parent.choices#>ARRAY['hp_rolls',key];
      IF hp IS NULL THEN SELECT h.after_parent#>ARRAY['choices','hp_rolls',key] INTO hp
        FROM private.character_builder_progression_history_v1 h WHERE h.character_id=target AND h.after_parent#>ARRAY['choices','hp_rolls',key] IS NOT NULL
        ORDER BY h.created_at DESC,h.operation_id DESC LIMIT 1; END IF;
      hp:=COALESCE(hp,pg_catalog.jsonb_build_object('method','average','value',die/2+1));
      normalized:=normalized||pg_catalog.jsonb_build_object(key,hp);
    END LOOP;
    IF fields ? 'hp_roll' AND fields->'hp_roll'<>'null'::jsonb THEN
      IF chosen_level<=parent.level OR NOT private.builder_exact_keys_v1(fields->'hp_roll',ARRAY['method','value']) THEN
        RAISE EXCEPTION 'builder_invalid_hp_selection' USING ERRCODE='22023'; END IF;
      hp:=private.builder_progression_hp_v1(target,(occurrence->>'id')::uuid,chosen_level,die,
        fields#>>'{hp_roll,method}',fields#>'{hp_roll,value}',cap.actor_id,operation);
      normalized:=normalized||pg_catalog.jsonb_build_object(selected_class_slug||'-'||chosen_level,hp);
    END IF;
    next_choices:=pg_catalog.jsonb_set(next_choices,'{hp_rolls}',normalized,true);
    -- Downgrades retire a now-unearned subclass selection and all its physical
    -- projections; the previous immutable source rows remain in history.
    SELECT min((l.value->>'level')::integer) INTO subclass_gate FROM pg_catalog.jsonb_array_elements(class_version#>'{data_snapshot,levels}') l(value)
      WHERE l.value->'subclass_level'='true'::jsonb;
    IF occurrence->'subclass_ref_id'<>'null'::jsonb AND chosen_level<COALESCE(subclass_gate,20) THEN
      removed_subclass:=(occurrence->>'subclass_ref_id')::uuid;
      next_choices:=pg_catalog.jsonb_set(next_choices,'{classes,0}',(next_choices#>'{classes,0}')-'subclass');
      expected:=pg_catalog.jsonb_set(expected,'{occurrences}',pg_catalog.jsonb_build_array(occurrence||'{"subclass_ref_id":null}'::jsonb));
      SELECT COALESCE(pg_catalog.jsonb_agg(value),'[]') INTO item FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') WHERE value->>'controller_ref_id'<>removed_subclass::text;
      expected:=pg_catalog.jsonb_set(expected,'{feature_grants}',item);
      SELECT COALESCE(pg_catalog.jsonb_agg(value),'[]') INTO item FROM pg_catalog.jsonb_array_elements(expected->'spell_grants') WHERE value->>'controller_ref_id'<>removed_subclass::text;
      expected:=pg_catalog.jsonb_set(expected,'{spell_grants}',item);
    END IF;
    SELECT COALESCE(array_agg(DISTINCT e.value->>'choice_id'),'{}') INTO affected FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'refs') r(value)
      JOIN public.content_versions v ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(v.effects_snapshot) e(value)
      WHERE e.value->>'type'='choice' AND (r.value->>'id'=removed_subclass::text OR EXISTS(
        SELECT 1 FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'feature_grants') g(value)
          WHERE g.value->'id'=r.value->'feature_grant_id' AND ((g.value->>'unlock_level')::integer>chosen_level OR g.value->>'controller_ref_id'=removed_subclass::text)));
    next_choices:=pg_catalog.jsonb_set(next_choices,'{resolved_choices}',(next_choices->'resolved_choices')-affected,true);
    SELECT COALESCE(pg_catalog.jsonb_object_agg(a.key,a.value),'{}') INTO normalized FROM pg_catalog.jsonb_each(COALESCE(next_choices->'asi_choices','{}')) a(key,value)
      WHERE EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') g(value)
        WHERE g.value->>'feature_slug'=a.key AND (g.value->>'unlock_level')::integer<=chosen_level);
    next_choices:=pg_catalog.jsonb_set(next_choices,'{asi_choices}',normalized,true);
  ELSIF command='save_hp_roll' THEN
    IF NOT private.builder_exact_keys_v1(fields,ARRAY['class_slug','level','method','value']) OR fields->>'class_slug' IS DISTINCT FROM selected_class_slug
      OR pg_catalog.jsonb_typeof(fields->'level')<>'number' OR fields->>'level' !~ '^([2-9]|1[0-9]|20)$'
      OR (fields->>'level')::integer>chosen_level THEN RAISE EXCEPTION 'builder_invalid_hp_selection' USING ERRCODE='22023'; END IF;
    hp:=private.builder_progression_hp_v1(target,(occurrence->>'id')::uuid,(fields->>'level')::integer,die,fields->>'method',fields->'value',cap.actor_id,operation);
    next_choices:=pg_catalog.jsonb_set(next_choices,'{hp_rolls}',COALESCE(next_choices->'hp_rolls','{}')||pg_catalog.jsonb_build_object(selected_class_slug||'-'||(fields->>'level'),hp),true);
  ELSIF command='select_asi' THEN
    IF NOT private.builder_exact_keys_v1(fields,ARRAY['feature_slug','choice']) OR pg_catalog.jsonb_typeof(fields->'feature_slug')<>'string'
      OR pg_catalog.jsonb_typeof(fields->'choice')<>'object' THEN RAISE EXCEPTION 'builder_invalid_asi' USING ERRCODE='22023'; END IF;
    SELECT count(*),pg_catalog.jsonb_agg(g.value)->0 INTO count_grants,selected_grant FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') g(value)
      JOIN public.content_versions v ON v.content_id=(g.value->>'feature_content_id')::uuid AND v.version=(g.value->>'feature_version')::integer
      WHERE g.value->>'feature_slug'=fields->>'feature_slug' AND (g.value->>'unlock_level')::integer<=chosen_level AND v.data_snapshot->>'feature_type'='asi';
    IF count_grants<>1 THEN RAISE EXCEPTION 'builder_earned_asi_required' USING ERRCODE='22023'; END IF;
    feature_source:='choice:asi:'||(selected_grant->>'id');
    SELECT COALESCE(pg_catalog.jsonb_agg(value),'[]') INTO refs FROM pg_catalog.jsonb_array_elements(refs) WHERE value->>'choice_source' IS DISTINCT FROM feature_source;
    IF fields#>>'{choice,mode}'='asi' THEN
      allocations:=fields#>'{choice,allocations}';
      IF NOT private.builder_exact_keys_v1(fields->'choice',ARRAY['mode','allocations']) OR pg_catalog.jsonb_typeof(allocations)<>'array'
        OR pg_catalog.jsonb_array_length(allocations) NOT BETWEEN 1 AND 2 OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(allocations) a(value)
          WHERE NOT private.builder_exact_keys_v1(a.value,ARRAY['ability','amount']) OR pg_catalog.jsonb_typeof(a.value->'ability') IS DISTINCT FROM 'string' OR a.value->>'ability' NOT IN ('strength','dexterity','constitution','intelligence','wisdom','charisma')
            OR a.value->'amount' NOT IN ('1'::jsonb,'2'::jsonb))
        OR (SELECT count(DISTINCT value->>'ability') FROM pg_catalog.jsonb_array_elements(allocations))<>pg_catalog.jsonb_array_length(allocations)
        OR (SELECT sum((value->>'amount')::integer) FROM pg_catalog.jsonb_array_elements(allocations))<>2 THEN
        RAISE EXCEPTION 'builder_invalid_asi_allocations' USING ERRCODE='22023'; END IF;
      scores:=private.character_ability_scores(target,NULL,fields->>'feature_slug',feature_source);
      IF EXISTS(SELECT 1 FROM pg_catalog.unnest(ARRAY['strength','dexterity','constitution','intelligence','wisdom','charisma']) a(name)
        WHERE pg_catalog.jsonb_typeof(parent.base_stats->a.name) IS DISTINCT FROM 'number') THEN
        RAISE EXCEPTION 'builder_complete_base_scores_required' USING ERRCODE='22023'; END IF;
      IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(allocations) a(value)
        WHERE (scores->>(a.value->>'ability'))::numeric+(a.value->>'amount')::integer>20) THEN
        RAISE EXCEPTION 'builder_asi_cap_exceeded' USING ERRCODE='22023'; END IF;
      SELECT pg_catalog.jsonb_agg(value ORDER BY value->>'ability') INTO allocations FROM pg_catalog.jsonb_array_elements(allocations);
      normalized:=pg_catalog.jsonb_build_object('mode','asi','allocations',allocations);
    ELSIF fields#>>'{choice,mode}'='feat' THEN
      IF NOT private.builder_exact_keys_v1(fields->'choice',ARRAY['mode','feat_id','feat_version']) OR NOT private.builder_uuid_v1(fields#>>'{choice,feat_id}')
        OR pg_catalog.jsonb_typeof(fields#>'{choice,feat_version}')<>'number' OR fields#>>'{choice,feat_version}' !~ '^[1-9][0-9]{0,9}$' THEN
        RAISE EXCEPTION 'builder_invalid_feat' USING ERRCODE='22023'; END IF;
      SELECT v.* INTO feat FROM public.content_versions v JOIN public.content_definitions d ON d.id=v.content_id AND d.version=v.version
        WHERE v.content_id=(fields#>>'{choice,feat_id}')::uuid AND v.version=(fields#>>'{choice,feat_version}')::integer AND NOT d.is_retired
          AND v.system_id_snapshot=parent.system_id AND v.content_type_snapshot='feat' AND private.character_can_access_content_version(target,v.content_id,v.version) FOR SHARE OF v,d;
      IF NOT FOUND THEN RAISE EXCEPTION 'builder_feat_unavailable' USING ERRCODE='42501'; END IF;
      IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_each(COALESCE(next_choices->'asi_choices','{}')) a(key,value)
        WHERE a.key<>fields->>'feature_slug' AND a.value->>'featId'=feat.content_id::text) THEN
        RAISE EXCEPTION 'builder_duplicate_feat' USING ERRCODE='22023'; END IF;
      SELECT * INTO prereq FROM private.feat_prerequisite_status(target,feat.data_snapshot,feat.content_id,feature_source);
      IF prereq.prerequisite_met IS NOT TRUE THEN RAISE EXCEPTION 'builder_feat_prerequisite_unmet' USING ERRCODE='22023'; END IF;
      scores:=private.character_ability_scores(target,feat.content_id,fields->>'feature_slug',feature_source);
      IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(COALESCE(feat.data_snapshot->'prerequisites','[]')) p(value)
        WHERE (scores->>(p.value->>'stat'))::numeric<(p.value->>'value')::numeric) THEN
        RAISE EXCEPTION 'builder_feat_prerequisite_unmet' USING ERRCODE='22023'; END IF;
      normalized:=pg_catalog.jsonb_build_object('mode','feat','featId',feat.content_id,'featVersion',feat.version,'featName',feat.name_snapshot);
      pin:=private.builder_catalog_pin_v1(target,pg_catalog.to_jsonb(feat),pg_catalog.jsonb_build_object('source','asi_feat','feature_slug',selected_grant->>'feature_slug',
        'feature_grant_id',selected_grant->>'id','feature_level',selected_grant->'unlock_level','controller_type',selected_grant->>'controller_type','controller_slug',selected_grant->>'controller_slug'),
        feature_source,NULL,cap.protected_graph->'refs');
      refs:=refs||pg_catalog.jsonb_build_array(pin);
    ELSE RAISE EXCEPTION 'builder_invalid_asi' USING ERRCODE='22023'; END IF;
    next_choices:=pg_catalog.jsonb_set(next_choices,'{asi_choices}',COALESCE(next_choices->'asi_choices','{}')||pg_catalog.jsonb_build_object(fields->>'feature_slug',normalized),true);
  ELSIF command='select_class_spells' THEN
    IF NOT private.builder_exact_keys_v1(fields,ARRAY['class_slug','spells']) OR fields->>'class_slug' IS DISTINCT FROM selected_class_slug THEN
      RAISE EXCEPTION 'builder_invalid_spell_selection' USING ERRCODE='22023'; END IF;
    new_spells:=private.builder_progression_spells_v1(target,next_choices,chosen_level,fields->'spells',spells);
    SELECT COALESCE(pg_catalog.jsonb_agg(value),'[]') INTO spells FROM pg_catalog.jsonb_array_elements(spells)
      WHERE NOT (value->>'class_slug'=selected_class_slug AND value->>'source'='selection');
    spells:=spells||new_spells;
    next_choices:=pg_catalog.jsonb_set(next_choices,'{class_spell_selections}',COALESCE(next_choices->'class_spell_selections','{}')||
      pg_catalog.jsonb_build_object(selected_class_slug,fields->'spells'),true);
  ELSE RAISE EXCEPTION 'builder_progression_command_unavailable' USING ERRCODE='22023'; END IF;

  -- Activate only grant-backed immutable manifests earned at this exact level.
  SELECT COALESCE(pg_catalog.jsonb_agg(r.value),'[]') INTO refs FROM pg_catalog.jsonb_array_elements(refs) r(value)
    WHERE r.value->>'id' IS DISTINCT FROM removed_subclass::text
      AND (r.value->'feature_grant_id'='null'::jsonb OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') g(value)
        WHERE g.value->'id'=r.value->'feature_grant_id' AND (g.value->>'unlock_level')::integer<=chosen_level))
      AND (COALESCE(r.value->>'choice_source','') NOT LIKE 'choice:asi:%' OR EXISTS(
        SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') g(value)
          WHERE r.value->>'choice_source'='choice:asi:'||(g.value->>'id') AND (g.value->>'unlock_level')::integer<=chosen_level))
      AND (COALESCE(r.value->>'choice_source','') NOT LIKE 'builder:fighting-style:%' OR EXISTS(
        SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') g(value)
          WHERE g.value->>'feature_slug'=r.value#>>'{context,feature}' AND (g.value->>'unlock_level')::integer<=chosen_level));
  FOR grant_value IN SELECT value FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') WHERE (value->>'unlock_level')::integer<=chosen_level LOOP
    IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(refs) r(value) WHERE r.value->'feature_grant_id'=grant_value->'id') THEN CONTINUE; END IF;
    SELECT pg_catalog.to_jsonb(v) INTO definition FROM public.content_versions v
      WHERE v.content_id=(grant_value->>'feature_content_id')::uuid AND v.version=(grant_value->>'feature_version')::integer;
    pin:=private.builder_catalog_pin_v1(target,definition,pg_catalog.jsonb_build_object('source','class_feature','controller_type',grant_value->>'controller_type',
      'controller_slug',grant_value->>'controller_slug','feature_slug',grant_value->>'feature_slug','feature_level',grant_value->'unlock_level'),
      'auto:feature-grant:'||(grant_value->>'id'),(grant_value->>'id')::uuid,cap.protected_graph->'refs');
    refs:=refs||pg_catalog.jsonb_build_array(pin);
  END LOOP;
  SELECT COALESCE(pg_catalog.jsonb_agg(s.value),'[]') INTO spells FROM pg_catalog.jsonb_array_elements(spells) s(value)
    WHERE s.value->>'source'<>'feature' OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'spell_grants') g(value)
      WHERE g.value->'id'=s.value->'spell_grant_id' AND (g.value->>'unlock_level')::integer<=chosen_level);
  FOR grant_value IN SELECT DISTINCT ON (value->>'spell_content_id',value->>'class_slug') value FROM pg_catalog.jsonb_array_elements(expected->'spell_grants')
    WHERE (value->>'unlock_level')::integer<=chosen_level ORDER BY value->>'spell_content_id',value->>'class_slug',(value->>'unlock_level')::integer,value->>'controller_ref_id',value->>'id' LOOP
    IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(spells) s(value) WHERE s.value->'content_id'=grant_value->'spell_content_id' AND s.value->'class_slug'=grant_value->'class_slug') THEN CONTINUE; END IF;
    spell.id:=pg_catalog.gen_random_uuid(); spell.character_id:=target; spell.content_id:=(grant_value->>'spell_content_id')::uuid;
    spell.content_version:=(grant_value->>'spell_version')::integer; spell.name:=grant_value->>'spell_name'; spell.class_slug:=grant_value->>'class_slug';
    spell.is_known:=false; spell.is_prepared:=true; spell.always_prepared:=true; spell.in_spellbook:=false; spell.source:='feature'; spell.custom_data:=NULL;
    spell.created_at:=pg_catalog.transaction_timestamp(); spell.spell_grant_id:=(grant_value->>'id')::uuid; spells:=spells||pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(spell));
  END LOOP;
  IF command IN ('set_class_level','select_asi') THEN
    -- Capacity reductions keep a deterministic valid subset. Retired draft
    -- acquisitions and selections remain in the accepted history.
    normalized:='[]'; new_spells:='[]';
    FOR item IN SELECT s.value FROM pg_catalog.jsonb_array_elements(spells) s(value)
      WHERE s.value->>'source'='selection' AND s.value->>'class_slug'=selected_class_slug ORDER BY s.value->>'id' LOOP
      picked:=pg_catalog.jsonb_build_object('content_id',item->'content_id','content_version',item->'content_version','prepared',item->'is_prepared');
      BEGIN
        source:=private.builder_progression_spells_v1(target,next_choices,chosen_level,normalized||pg_catalog.jsonb_build_array(picked),spells);
        normalized:=normalized||pg_catalog.jsonb_build_array(picked); new_spells:=source;
      EXCEPTION WHEN SQLSTATE '22023' THEN
        IF SQLERRM NOT IN ('builder_class_cannot_cast','builder_spell_not_on_current_list','builder_spell_selection_budget_exceeded') THEN RAISE; END IF;
      END;
    END LOOP;
    SELECT COALESCE(pg_catalog.jsonb_agg(value),'[]') INTO spells FROM pg_catalog.jsonb_array_elements(spells)
      WHERE NOT (value->>'source'='selection' AND value->>'class_slug'=selected_class_slug);
    spells:=spells||new_spells;
    next_choices:=pg_catalog.jsonb_set(next_choices,'{class_spell_selections}',COALESCE(next_choices->'class_spell_selections','{}')||
      pg_catalog.jsonb_build_object(selected_class_slug,normalized),true);
  END IF;
  expected:=expected||pg_catalog.jsonb_build_object('refs',refs,'spells',spells);
  FOREACH domain IN ARRAY ARRAY['refs','feature_grants','spell_grants','spells','occurrences'] LOOP
    SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value->>'id')::uuid),'[]') INTO item FROM pg_catalog.jsonb_array_elements(expected->domain);
    expected:=pg_catalog.jsonb_set(expected,ARRAY[domain],item);
  END LOOP;
  -- The draft can contain a stored current HP value. Clamp it to the same
  -- per-level die-plus-CON formula used by computeMaxHp, preserving missing HP.
  IF next_state ? 'current_hp' THEN
    scores:=private.builder_progression_scores_v1(target,next_choices);
    con_mod:=floor(((scores->>'constitution')::numeric-10)/2)::integer;
    FOR points IN 1..chosen_level LOOP
      contribution:=CASE WHEN points=1 THEN die ELSE COALESCE((next_choices#>>ARRAY['hp_rolls',selected_class_slug||'-'||points,'value'])::integer,die/2+1) END;
      max_hp:=max_hp+GREATEST(1,contribution+con_mod);
    END LOOP;
    next_state:=pg_catalog.jsonb_set(next_state,'{current_hp}',pg_catalog.to_jsonb(LEAST((next_state->>'current_hp')::integer,max_hp)));
  END IF;
  IF pg_catalog.octet_length(expected::text)>8388608 THEN RAISE EXCEPTION 'builder_progression_graph_bound' USING ERRCODE='54000'; END IF;
  UPDATE private.character_builder_capabilities_v1 SET expected_graph=expected,expected_classes=next_choices->'classes',expected_choices=next_choices,
    expected_level=chosen_level,expected_state=next_state WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  PERFORM private.apply_builder_progression_graph_v1(target,next_choices,next_state,chosen_level);
END $$;


DO $subclass_downgrade_profile$
DECLARE source text; next_source text; definition text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef('private.builder_catalog_occurrence_transition_v1(jsonb,jsonb)'::pg_catalog.regprocedure),prosrc
    INTO definition,source FROM pg_catalog.pg_proc WHERE oid='private.builder_catalog_occurrence_transition_v1(jsonb,jsonb)'::pg_catalog.regprocedure;
  next_source:=pg_catalog.replace(source,'cap.command=''select_subclass''',
    '(cap.command=''select_subclass'' OR cap.command=''set_class_level'' AND after_row->''subclass_ref_id''=''null''::jsonb AND cap.expected_level<(cap.before_parent->>''level'')::integer)');
  IF next_source=source THEN RAISE EXCEPTION 'builder_progression_occurrence_guard_drift' USING ERRCODE='42501'; END IF;
  EXECUTE pg_catalog.replace(definition,source,next_source);
  SELECT pg_catalog.pg_get_functiondef('private.apply_builder_subclass_link_v1(uuid,uuid,uuid)'::pg_catalog.regprocedure),prosrc
    INTO definition,source FROM pg_catalog.pg_proc WHERE oid='private.apply_builder_subclass_link_v1(uuid,uuid,uuid)'::pg_catalog.regprocedure;
  next_source:=pg_catalog.replace(source,'cap->>''command''<>''select_subclass''','cap->>''command'' NOT IN (''select_subclass'',''set_class_level'')');
  IF next_source=source THEN RAISE EXCEPTION 'builder_progression_occurrence_bridge_drift' USING ERRCODE='42501'; END IF;
  EXECUTE pg_catalog.replace(definition,source,next_source);
END $subclass_downgrade_profile$;

CREATE OR REPLACE FUNCTION private.finish_builder_step_v1(context jsonb,target uuid) RETURNS public.characters
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; parent public.characters%ROWTYPE;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND THEN RAISE EXCEPTION 'builder_capability_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(context,target);
  PERFORM private.assert_builder_catalog_graph_v1(target,true);
  SELECT * INTO parent FROM public.characters WHERE id=target AND user_id=cap.actor_id;
  IF NOT FOUND OR parent.name IS DISTINCT FROM cap.expected_name
    OR parent.level IS DISTINCT FROM COALESCE(cap.expected_level,(cap.before_parent->>'level')::integer)
    OR (cap.expected_choices IS NOT NULL AND parent.choices IS DISTINCT FROM cap.expected_choices)
    OR (pg_catalog.to_jsonb(parent)-ARRAY['name','level','choices','base_stats','state','action_revision'])
      IS DISTINCT FROM (cap.before_parent-ARRAY['name','level','choices','base_stats','state','action_revision'])
    OR cap.command<>'save_abilities' AND pg_catalog.to_jsonb(parent.base_stats) IS DISTINCT FROM cap.before_parent->'base_stats'
    OR (cap.expected_state IS NOT NULL AND pg_catalog.to_jsonb(parent.state) IS DISTINCT FROM cap.expected_state)
    OR (cap.expected_state IS NULL AND cap.command<>'award_equipment' AND pg_catalog.to_jsonb(parent.state) IS DISTINCT FROM cap.before_parent->'state')
    OR cap.command<>'award_equipment' AND (SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) ORDER BY i.id),'[]') FROM public.character_inventory i WHERE i.character_id=target)
      IS DISTINCT FROM cap.before_inventory THEN
    RAISE EXCEPTION 'builder_protected_state_changed' USING ERRCODE='23514'; END IF;
  PERFORM private.apply_builder_step_order_v1(target);
  DELETE FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  RETURN parent;
END $$;

CREATE FUNCTION private.builder_progression_full_graph_v1(target uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT private.builder_protected_graph_v1(target)||pg_catalog.jsonb_build_object(
    'refs',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') FROM public.character_content_refs r WHERE character_id=target),
    'inventory',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') FROM public.character_inventory r WHERE character_id=target))
$$;
CREATE FUNCTION private.check_builder_progression_history_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE current_parent jsonb; current_order jsonb; stored private.character_builder_receipts_v1%ROWTYPE; domain text; ids jsonb;
BEGIN
  SELECT pg_catalog.to_jsonb(c) INTO current_parent FROM public.characters c WHERE c.id=NEW.character_id AND c.user_id=NEW.actor_id;
  SELECT pg_catalog.to_jsonb(o) INTO current_order FROM private.character_projection_order_v1 o WHERE o.character_id=NEW.character_id;
  SELECT * INTO stored FROM private.character_builder_receipts_v1 WHERE actor_id=NEW.actor_id AND operation_id=NEW.operation_id;
  IF NOT FOUND OR stored.character_id<>NEW.character_id OR stored.receipt IS DISTINCT FROM NEW.receipt
    OR stored.request->>'command' IS DISTINCT FROM NEW.command OR NEW.before_parent->>'user_id'<>NEW.actor_id::text
    OR current_parent IS DISTINCT FROM NEW.after_parent OR current_order IS DISTINCT FROM NEW.after_order
    OR private.builder_progression_full_graph_v1(NEW.character_id) IS DISTINCT FROM NEW.after_graph
    OR NEW.receipt->'saved_choices' IS DISTINCT FROM current_parent->'choices'
    OR NEW.receipt->>'action_revision' IS DISTINCT FROM current_parent->>'action_revision'
    OR NEW.after_graph->'origin' IS DISTINCT FROM NEW.before_graph->'origin'
    OR NEW.after_graph->'commands' IS DISTINCT FROM NEW.before_graph->'commands'
    OR NEW.after_graph#>>'{occurrences,0,id}' IS DISTINCT FROM NEW.before_graph#>>'{occurrences,0,id}'
    OR current_order->>'producer_revision' IS DISTINCT FROM current_parent->>'action_revision' THEN
    RAISE EXCEPTION 'builder_progression_history_closure_failed' USING ERRCODE='23514'; END IF;
  FOREACH domain IN ARRAY ARRAY['refs','inventory','spells','feature_grants','spell_grants'] LOOP
    SELECT COALESCE(pg_catalog.jsonb_agg(value->'id' ORDER BY (value->>'id')::uuid),'[]') INTO ids FROM pg_catalog.jsonb_array_elements(NEW.after_graph->domain);
    IF ids IS DISTINCT FROM (SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value#>>'{}')::uuid),'[]')
      FROM pg_catalog.jsonb_array_elements(current_order->(CASE domain WHEN 'refs' THEN 'pins' ELSE domain END))) THEN
      RAISE EXCEPTION 'builder_progression_order_bijection_failed' USING ERRCODE='23514'; END IF;
  END LOOP;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER builder_progression_history_closure AFTER INSERT ON private.character_builder_progression_history_v1
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.check_builder_progression_history_v1();

ALTER FUNCTION public.character_builder_command_v1(jsonb,jsonb) RENAME TO character_builder_command_before_progression_v1;
REVOKE ALL ON FUNCTION public.character_builder_command_before_progression_v1(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.character_builder_command_v1(p_context jsonb,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid; operation uuid; command text; parent public.characters%ROWTYPE; saved public.characters%ROWTYPE;
  stored private.character_builder_receipts_v1%ROWTYPE; receipt jsonb; before_graph jsonb; after_graph jsonb; before_order jsonb; after_order jsonb;
BEGIN
  command:=p_request->>'command';
  IF command IS NULL OR command NOT IN ('set_class_level','save_hp_roll','select_asi','select_class_spells') THEN
    RETURN public.character_builder_command_before_progression_v1(p_context,p_request);
  END IF;
  IF NOT private.builder_exact_keys_v1(p_request,ARRAY['contract_version','character_id','operation_id','command','fields'])
    OR p_request->'contract_version' IS DISTINCT FROM '1'::jsonb OR pg_catalog.octet_length(p_request::text)>524288
    OR NOT private.builder_uuid_v1(p_request->>'character_id') OR NOT private.builder_uuid_v1(p_request->>'operation_id')
    OR pg_catalog.jsonb_typeof(p_request->'command')<>'string' OR pg_catalog.jsonb_typeof(p_request->'fields')<>'object' THEN
    RAISE EXCEPTION 'builder_invalid_request' USING ERRCODE='22023'; END IF;
  target:=(p_request->>'character_id')::uuid; operation:=(p_request->>'operation_id')::uuid;
  parent:=private.begin_builder_step_v1(p_context,target,command,true);
  SELECT * INTO stored FROM private.character_builder_receipts_v1 WHERE actor_id=parent.user_id AND operation_id=operation;
  IF FOUND THEN
    IF stored.character_id<>target OR stored.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'builder_operation_intent_conflict' USING ERRCODE='23505'; END IF;
    RETURN pg_catalog.jsonb_build_object('status','replayed','receipt',stored.receipt);
  END IF;
  PERFORM private.mint_builder_step_v1(p_context,parent,command);
  before_graph:=private.builder_progression_full_graph_v1(target);
  SELECT c.before_order INTO before_order FROM private.character_builder_capabilities_v1 c WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  PERFORM private.prepare_builder_progression_v1(target,operation,command,p_request->'fields');
  saved:=private.finish_builder_step_v1(p_context,target);
  receipt:=pg_catalog.jsonb_build_object('operation_id',operation,'character_id',target,'actor_id',parent.user_id,'command',command,'fields',p_request->'fields',
    'saved_choices',saved.choices,'saved_scores',saved.base_stats,'action_revision',saved.action_revision::text);
  INSERT INTO private.character_builder_receipts_v1(actor_id,operation_id,character_id,request,receipt,created_at)
    VALUES(parent.user_id,operation,target,p_request,receipt,pg_catalog.transaction_timestamp());
  after_graph:=private.builder_progression_full_graph_v1(target);
  SELECT pg_catalog.to_jsonb(o) INTO after_order FROM private.character_projection_order_v1 o WHERE o.character_id=target;
  INSERT INTO private.character_builder_progression_history_v1(actor_id,operation_id,character_id,command,before_parent,after_parent,
    before_graph,after_graph,before_order,after_order,receipt,created_at)
    VALUES(parent.user_id,operation,target,command,pg_catalog.to_jsonb(parent),pg_catalog.to_jsonb(saved),before_graph,after_graph,before_order,after_order,receipt,pg_catalog.transaction_timestamp());
  PERFORM private.lock_builder_character_rows_v1(p_context,target);
  RETURN pg_catalog.jsonb_build_object('status','applied','receipt',receipt);
END $$;

DO $closure$
DECLARE signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'private.builder_progression_history_immutable_v1()','private.character_ability_scores(uuid,uuid,text,text)',
    'private.builder_progression_asi_write_v1(jsonb,jsonb,text)','private.builder_progression_spell_guard_v1()',
    'private.builder_progression_spells_v1(uuid,jsonb,integer,jsonb,jsonb)','private.builder_progression_scores_v1(uuid,jsonb)',
    'private.builder_progression_hp_v1(uuid,uuid,integer,integer,text,jsonb,uuid,uuid)',
    'private.apply_builder_progression_graph_v1(uuid,jsonb,jsonb,integer)','private.prepare_builder_progression_v1(uuid,uuid,text,jsonb)',
    'private.builder_progression_full_graph_v1(uuid)','private.check_builder_progression_history_v1()',
    'public.character_builder_command_v1(jsonb,jsonb)'
  ] LOOP
    EXECUTE pg_catalog.format('ALTER FUNCTION %s OWNER TO postgres',signature);
    EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner',signature);
  END LOOP;
END $closure$;
GRANT EXECUTE ON FUNCTION public.character_builder_command_v1(jsonb,jsonb) TO authenticated;
DO $closed$
BEGIN
  IF pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR pg_catalog.has_function_privilege('anon','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('service_role','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('authenticated','public.character_builder_command_before_progression_v1(jsonb,jsonb)','EXECUTE')
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_progression_privilege_closure_failed' USING ERRCODE='42501'; END IF;
END $closed$;
COMMIT;
