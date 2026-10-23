-- Read-only administrative evidence for one real-app family draft.
-- Supply only its public UUID: psql -v character_id=<UUID> -f this-file.sql.
-- Auth/browser evidence and catalog/character before-after fingerprints are
-- separate evidence; this query does not assert them from current row counts.
BEGIN READ ONLY;
WITH target AS (
  SELECT * FROM public.characters WHERE id=:'character_id'::uuid
), proof AS (
  SELECT t.id,private.builder_class_roles_v1(t.id) AS roles,
    private.builder_protected_graph_v1(t.id) AS graph FROM target t
), refs AS (
  SELECT r.*,v.slug_snapshot AS slug,v.content_type_snapshot AS kind,v.system_id_snapshot AS system_id,
    v.source_snapshot AS source,v.scope_snapshot AS scope,v.owner_id_snapshot AS owner_id,
    v.data_snapshot AS data,v.effects_snapshot AS effects,pg_catalog.to_jsonb(v) AS snapshot,
    v.content_id IS NOT NULL AS exact_version_found
  FROM public.character_content_refs r JOIN target t ON t.id=r.character_id
  LEFT JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
), classes AS (
  SELECT c.value AS choice,o.id AS occurrence_id,o.class_slug,(c.value->>'level')::integer AS class_level,
    o.controller_ref_id,o.subclass_ref_id,sub.slug AS subclass_slug,sub.content_version AS subclass_version
  FROM target t CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(t.choices->'classes') c(value)
  JOIN private.character_class_occurrences_v1 o ON o.id=(c.value->>'occurrence_id')::uuid AND o.character_id=t.id
  LEFT JOIN refs sub ON sub.id=o.subclass_ref_id
), controller_levels AS (
  SELECT controller_ref_id AS id,class_slug,class_level FROM classes
  UNION ALL SELECT subclass_ref_id,class_slug,class_level FROM classes WHERE subclass_ref_id IS NOT NULL
), feature_grants AS (
  SELECT g.*,cl.class_level,cl.class_slug,r.kind AS controller_kind,r.slug AS pinned_controller_slug,
    v.content_id IS NOT NULL AND v.content_type_snapshot='feature' AS exact_feature_version
  FROM public.character_feature_grants g JOIN target t ON t.id=g.character_id
  LEFT JOIN controller_levels cl ON cl.id=g.controller_ref_id LEFT JOIN refs r ON r.id=g.controller_ref_id
  LEFT JOIN public.content_versions v ON v.content_id=g.feature_content_id AND v.version=g.feature_version
), active_sources AS (
  SELECT r.* FROM refs r JOIN feature_grants g ON g.id=r.feature_grant_id AND g.feature_content_id=r.content_id
    AND g.feature_version=r.content_version AND g.unlock_level<=g.class_level
  WHERE r.kind='feature'
), spell_grants AS (
  SELECT g.*,cl.class_level,cl.class_slug AS owner_class_slug,r.kind AS controller_kind,r.slug AS pinned_controller_slug,
    v.content_id IS NOT NULL AND v.content_type_snapshot='spell' AS exact_spell_version
  FROM public.character_spell_grants g JOIN target t ON t.id=g.character_id
  LEFT JOIN controller_levels cl ON cl.id=g.controller_ref_id LEFT JOIN refs r ON r.id=g.controller_ref_id
  LEFT JOIN public.content_versions v ON v.content_id=g.spell_content_id AND v.version=g.spell_version
), spell_rows AS (
  SELECT s.id,s.content_id,s.content_version,s.class_slug,s.source,v.slug_snapshot AS slug,
    s.is_known,s.is_prepared,s.always_prepared,s.in_spellbook,s.spell_grant_id,
    v.content_id IS NOT NULL AND v.system_id_snapshot=t.system_id AND v.content_type_snapshot='spell' AS exact_spell_version,
    CASE s.source WHEN 'selection' THEN s.is_known AND NOT s.always_prepared AND s.spell_grant_id IS NULL
      AND EXISTS(SELECT 1 FROM classes c WHERE c.class_slug=s.class_slug
        AND s.custom_data->>'builder_class_controller_ref_id'=c.controller_ref_id::text)
      WHEN 'feature' THEN s.is_prepared AND s.always_prepared
        AND EXISTS(SELECT 1 FROM spell_grants g WHERE g.id=s.spell_grant_id AND g.spell_content_id=s.content_id
          AND g.spell_version=s.content_version AND g.class_slug=s.class_slug AND g.unlock_level<=g.class_level)
      WHEN 'racial_trait' THEN s.is_known AND s.is_prepared AND s.always_prepared AND NOT s.in_spellbook AND s.spell_grant_id IS NULL
        AND EXISTS(SELECT 1 FROM refs source_pin JOIN refs root_pin ON root_pin.id::text=s.custom_data->>'builder_root_ref_id'
          WHERE source_pin.id::text=s.custom_data->>'builder_source_pin_id' AND root_pin.kind IN ('race','subrace')
            AND s.class_slug='race:'||root_pin.slug AND s.custom_data->>'spellcasting_ability' IN ('strength','dexterity','constitution','intelligence','wisdom','charisma'))
      ELSE false END AS native_provenance_valid
  FROM public.character_spells s JOIN target t ON t.id=s.character_id
  LEFT JOIN public.content_versions v ON v.content_id=s.content_id AND v.version=s.content_version
), feature_choices AS (
  SELECT s.id AS source_ref_id,s.slug AS source_slug,s.data AS source_data,e.value AS effect,
    e.value->>'choice_id' AS choice_id,e.value->>'grant_type' AS grant_type,
    COALESCE(t.choices#>ARRAY['resolved_choices',e.value->>'choice_id'],'[]') AS selected,
    CASE WHEN e.value->>'grant_type'='invocation' THEN
      (SELECT (tier.value#>>'{class_specific,invocations_known}')::integer FROM classes c JOIN refs class_pin ON class_pin.id=c.controller_ref_id
        CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(class_pin.data->'levels') tier(value)
        WHERE c.class_slug='warlock' AND tier.value->>'level'=c.class_level::text)
      ELSE (e.value->>'choose')::integer END AS capacity
  FROM active_sources s CROSS JOIN target t CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(s.effects) e(value)
  WHERE e.value->>'type'='choice' AND e.value->>'grant_type' IN ('feature','invocation','favored_terrain','expertise')
), choice_checks AS (
  SELECT f.*,
    (SELECT count(*) FROM refs r CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(r.effects) e(value)
      WHERE e.value->>'type'='choice' AND e.value->>'choice_id'=f.choice_id)=1
      AND pg_catalog.jsonb_typeof(f.selected)='array' AND f.capacity>=1
      AND pg_catalog.jsonb_array_length(f.selected)<=f.capacity
      AND (SELECT count(DISTINCT value) FROM pg_catalog.jsonb_array_elements(f.selected))=pg_catalog.jsonb_array_length(f.selected)
      AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(f.selected) picked(value)
        WHERE pg_catalog.jsonb_typeof(picked.value)<>'string' OR NOT (f.effect->'from') @> pg_catalog.jsonb_build_array(picked.value)) AS finite_unique_choice,
    f.grant_type NOT IN ('feature','invocation') OR NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(f.selected) picked(value)
      WHERE (SELECT count(*) FROM refs child WHERE child.context->>'source_ref_id'=f.source_ref_id::text
        AND child.context->>'choice_id'=f.choice_id AND child.slug=picked.value#>>'{}'
        AND child.choice_source LIKE 'builder:feature-choice:%')<>1) AS selected_children_present
  FROM feature_choices f
), children AS (
  SELECT child.id,child.slug,child.content_id,child.content_version,child.choice_source,child.context,
    parent.id AS source_ref_id,parent.slug AS source_slug,child.context->>'choice_id' AS choice_id,
    parent.id IS NOT NULL AND child.kind='feature' AND child.feature_grant_id IS NULL
      AND child.context->>'source'='class_feature_choice'
      AND child.context->>'class'=parent.data->>'class' AND child.context->>'feature'=parent.slug
      AND child.system_id=parent.system_id AND child.data->'class' IS NOT DISTINCT FROM parent.data->'class'
      AND child.data->'subclass' IS NOT DISTINCT FROM parent.data->'subclass'
      AND (SELECT count(*) FROM choice_checks f WHERE f.source_ref_id=parent.id AND f.choice_id=child.context->>'choice_id'
        AND f.finite_unique_choice AND f.grant_type IN ('feature','invocation')
        AND f.selected @> pg_catalog.jsonb_build_array(child.slug) AND (f.effect->'from') @> pg_catalog.jsonb_build_array(child.slug))=1
      AND EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(COALESCE(parent.data->'choices','[]')) manifest(value)
        WHERE manifest.value->'options' @> pg_catalog.jsonb_build_array(child.slug))
      AND private.builder_feature_option_eligible_v1(t.id,t.choices,p.graph,parent.snapshot,child.snapshot) AS finite_parent_authority,
    child.choice_source='builder:feature-choice:'||parent.id||':'||(child.context->>'choice_id') AS retained_legacy_tag,
    child.choice_source='builder:feature-choice:'||parent.id||':'||(child.context->>'choice_id')||':'||child.content_id||':'||child.content_version AS exact_child_version_tag
  FROM refs child CROSS JOIN target t CROSS JOIN proof p
  LEFT JOIN active_sources parent ON parent.id::text=child.context->>'source_ref_id'
  WHERE child.choice_source LIKE 'builder:feature-choice:%'
), sibling_checks AS (
  SELECT source_ref_id,choice_id,count(*) AS child_count,count(DISTINCT choice_source)=count(*) AS unique_tags,
    count(*) FILTER(WHERE retained_legacy_tag)<=1 AS at_most_one_legacy_tag,
    bool_and(finite_parent_authority AND (retained_legacy_tag OR exact_child_version_tag)) AS all_children_authorized
  FROM children GROUP BY source_ref_id,choice_id
), favored_rows AS (
  SELECT saved.key AS source_slug,saved.value AS candidate,s.id AS source_ref_id,s.data AS source_data,s.source AS source_origin,
    s.id IS NOT NULL AND s.data->>'class'='ranger' AND s.data->>'feature_type'='favored_enemy'
      AND private.builder_exact_keys_v1(saved.value,ARRAY['selection','language'])
      AND pg_catalog.jsonb_typeof(saved.value->'language') IN ('string','null')
      AND CASE saved.value#>>'{selection,mode}' WHEN 'type' THEN
        private.builder_exact_keys_v1(saved.value->'selection',ARRAY['mode','enemy_type'])
          AND (s.data#>'{favored_enemy,enemy_types}') @> pg_catalog.jsonb_build_array(saved.value#>'{selection,enemy_type}')
        WHEN 'humanoids' THEN private.builder_exact_keys_v1(saved.value->'selection',ARRAY['mode','races'])
          AND pg_catalog.jsonb_array_length(saved.value#>'{selection,races}')=2
          AND (SELECT count(DISTINCT value) FROM pg_catalog.jsonb_array_elements(saved.value#>'{selection,races}'))=2
          AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(saved.value#>'{selection,races}') race(value)
            WHERE NOT (s.data#>'{favored_enemy,humanoid_races}') @> pg_catalog.jsonb_build_array(race.value))
        ELSE false END AS finite_earned_selection,
    CASE WHEN saved.value->'language'='null'::jsonb THEN
      NOT EXISTS(SELECT 1 FROM refs language WHERE language.choice_source='builder:favored-enemy:'||saved.key)
      ELSE (SELECT count(*) FROM refs language WHERE language.choice_source='builder:favored-enemy:'||saved.key
        AND language.kind='language' AND language.slug=saved.value->>'language')=1 END AS language_projection_exact
  FROM target t CROSS JOIN LATERAL pg_catalog.jsonb_each(COALESCE(t.choices->'favored_enemies','{}')) saved(key,value)
  LEFT JOIN active_sources s ON s.slug=saved.key AND s.data->>'feature_type'='favored_enemy'
), favored_languages AS (
  SELECT r.id,r.slug,r.content_id,r.content_version,r.choice_source,r.context,
    f.source_ref_id IS NOT NULL AND f.finite_earned_selection AND f.language_projection_exact
      AND f.candidate->>'language'=r.slug AND r.kind='language' AND r.scope='platform' AND r.source=f.source_origin
      AND r.system_id=t.system_id AND r.feature_grant_id IS NULL
      AND r.choice_source='builder:favored-enemy:'||f.source_slug
      AND r.context=pg_catalog.jsonb_build_object('source','favored_enemy','feature_slug',f.source_slug) AS exact_owned_language
  FROM refs r CROSS JOIN target t LEFT JOIN favored_rows f ON f.source_slug=r.context->>'feature_slug'
  WHERE r.choice_source LIKE 'builder:favored-enemy:%'
), domains AS (
  SELECT 'pins'::text AS domain,COALESCE(pg_catalog.array_agg(id ORDER BY id),'{}'::uuid[]) AS ids FROM refs
  UNION ALL SELECT 'inventory',COALESCE(pg_catalog.array_agg(r.id ORDER BY r.id),'{}'::uuid[]) FROM public.character_inventory r JOIN target t ON t.id=r.character_id
  UNION ALL SELECT 'spells',COALESCE(pg_catalog.array_agg(r.id ORDER BY r.id),'{}'::uuid[]) FROM public.character_spells r JOIN target t ON t.id=r.character_id
  UNION ALL SELECT 'feature_grants',COALESCE(pg_catalog.array_agg(id ORDER BY id),'{}'::uuid[]) FROM feature_grants
  UNION ALL SELECT 'spell_grants',COALESCE(pg_catalog.array_agg(r.id ORDER BY r.id),'{}'::uuid[]) FROM public.character_spell_grants r JOIN target t ON t.id=r.character_id
), order_checks AS (
  SELECT d.domain,cardinality(d.ids) AS physical_count,pg_catalog.jsonb_array_length(pg_catalog.to_jsonb(o)->d.domain) AS ordered_count,
    d.ids=(SELECT COALESCE(pg_catalog.array_agg(value::uuid ORDER BY value::uuid),'{}'::uuid[]) FROM pg_catalog.jsonb_array_elements_text(pg_catalog.to_jsonb(o)->d.domain))
      AND pg_catalog.jsonb_array_length(pg_catalog.to_jsonb(o)->d.domain)=(SELECT count(DISTINCT value)
        FROM pg_catalog.jsonb_array_elements_text(pg_catalog.to_jsonb(o)->d.domain)) AS bijection
  FROM domains d CROSS JOIN target t JOIN private.character_projection_order_v1 o ON o.character_id=t.id
), summary AS (
  SELECT t.id,t.level,t.action_revision,COALESCE(t.choices->'resolved_choices','{}') AS resolved_choices,
    COALESCE(t.choices->'favored_enemies','{}') AS favored_enemies,private.character_ability_scores(t.id,NULL,NULL,NULL) AS effective_scores,
    (SELECT count(*) FROM classes) AS class_count,(SELECT min(class_slug) FROM classes) AS sole_family,
    (SELECT pg_catalog.jsonb_object_agg(class_slug,pg_catalog.jsonb_build_object('level',class_level,'subclass',subclass_slug,'subclass_version',subclass_version)) FROM classes) AS classes,
    (SELECT producer_revision=t.action_revision FROM private.character_projection_order_v1 WHERE character_id=t.id) AS parent_order_revision_equal,
    p.roles->>'action_revision'=t.action_revision::text AND p.roles->'source_order'=(SELECT pg_catalog.to_jsonb(o)->'pins'
      FROM private.character_projection_order_v1 o WHERE character_id=t.id) AS role_order_revision_exact,
    private.normalize_builder_expertise_v1(t.id,t.choices,(SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r))
      FROM public.character_content_refs r WHERE r.character_id=t.id),NULL) IS NOT DISTINCT FROM t.choices AS expertise_choices_valid
  FROM target t JOIN proof p ON p.id=t.id
), boundaries AS (
  SELECT (SELECT count(*) FROM private.character_builder_capabilities_v1) AS capabilities,
    (SELECT count(*) FROM private.character_writer_readiness_v1) AS readiness_rows,
    (SELECT count(*) FROM private.character_writer_readiness_v1 WHERE ready) AS ready_rows,
    NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled) AND NOT EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) AS gates_closed,
    NOT pg_catalog.has_schema_privilege('service_role','private','USAGE') AS service_private_closed,
    NOT pg_catalog.has_function_privilege('authenticated','private.prepare_builder_class_feature_choices_v1(uuid,jsonb,jsonb,text,jsonb)','EXECUTE')
      AND NOT pg_catalog.has_function_privilege('anon','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
      AND NOT pg_catalog.has_function_privilege('service_role','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE') AS private_entries_closed
)
SELECT pg_catalog.jsonb_pretty(pg_catalog.jsonb_build_object(
  'evidence_kind','administrative_readback_after_real_app_family_draft','character_id',:'character_id'::uuid,
  'target_count',(SELECT count(*) FROM target),'draft_choices_only',true,'does_not_replace_auth_browser_or_before_after_fingerprints',true,
  'observed',(SELECT pg_catalog.to_jsonb(s) FROM summary s),
  'browser_story_expectations_separate_from_dynamic_checks',(SELECT CASE sole_family
    WHEN 'bard' THEN '{"final_level":10,"subclass":"lore","scope":"Expertise at class levels 3 and 10"}'::jsonb
    WHEN 'ranger' THEN '{"final_level":1,"subclass":null,"scope":"First terrain and beasts retained; later Hunter picks and Orc language pruned"}'::jsonb
    WHEN 'sorcerer' THEN '{"final_level":10,"subclass":"draconic","scope":"Gold ancestry; Quickened, Subtle and Careful Metamagic children"}'::jsonb
    WHEN 'warlock' THEN '{"final_level":5,"subclass":"fiend","scope":"Chain pact; Beguiling Influence and Agonizing Blast; Thirsting Blade pruned"}'::jsonb
    WHEN 'druid' THEN '{"final_level":2,"subclass":"land","scope":"Forest child selected through the published Land manifest; bonus spells separate"}'::jsonb
    ELSE '{"scope":"No family browser expectation encoded"}'::jsonb END FROM summary),
  'exact_frozen_pins',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',id,'kind',kind,'slug',slug,
    'content_id',content_id,'content_version',content_version,'feature_grant_id',feature_grant_id,'choice_source',choice_source) ORDER BY kind,slug,id),'[]') FROM refs),
  'all_pinned_versions_exact',(SELECT COALESCE(bool_and(r.exact_version_found AND r.system_id=t.system_id),false) FROM refs r CROSS JOIN target t),
  'feature_grants_exact',(SELECT COALESCE(bool_and(g.exact_feature_version AND g.controller_kind=g.controller_type
    AND g.pinned_controller_slug=g.controller_slug AND g.class_level IS NOT NULL),false) FROM feature_grants g),
  'physical_feature_grant_links_exact',NOT EXISTS(SELECT 1 FROM refs r WHERE r.feature_grant_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM feature_grants g WHERE g.id=r.feature_grant_id AND g.feature_content_id=r.content_id AND g.feature_version=r.content_version AND g.unlock_level<=g.class_level)),
  'active_feature_projections_exact',NOT EXISTS(SELECT 1 FROM feature_grants g WHERE
    (g.unlock_level<=g.class_level AND (SELECT count(*) FROM refs r WHERE r.feature_grant_id=g.id)<>1)
    OR (g.unlock_level>g.class_level AND EXISTS(SELECT 1 FROM refs r WHERE r.feature_grant_id=g.id))),
  'spell_grants_exact',(SELECT COALESCE(bool_and(g.exact_spell_version AND g.controller_kind=g.controller_type
    AND g.pinned_controller_slug=g.controller_slug AND g.class_slug=g.owner_class_slug AND g.class_level IS NOT NULL),true) FROM spell_grants g),
  'spell_rows',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(s) ORDER BY class_slug,slug,id),'[]') FROM spell_rows s),
  'all_spell_rows_exact',(SELECT COALESCE(bool_and(exact_spell_version AND native_provenance_valid),true) FROM spell_rows),
  'active_spell_grants_projected',NOT EXISTS(SELECT 1 FROM spell_grants g WHERE g.unlock_level<=g.class_level
    AND NOT EXISTS(SELECT 1 FROM spell_rows s WHERE s.source='feature' AND s.class_slug=g.class_slug AND s.content_id=g.spell_content_id)),
  'finite_feature_choices',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('source_ref_id',source_ref_id,
    'source_slug',source_slug,'choice_id',choice_id,'grant_type',grant_type,'selected',selected,'capacity',capacity,
    'finite_unique_choice',finite_unique_choice,'selected_children_present',selected_children_present) ORDER BY choice_id),'[]') FROM choice_checks),
  'all_choice_checks',(SELECT COALESCE(bool_and(finite_unique_choice AND selected_children_present),true) FROM choice_checks),
  'materialized_children',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) ORDER BY slug,id),'[]') FROM children c),
  'sibling_tag_checks',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(s) ORDER BY source_ref_id,choice_id),'[]') FROM sibling_checks s),
  'all_child_checks',(SELECT COALESCE(bool_and(unique_tags AND at_most_one_legacy_tag AND all_children_authorized),true) FROM sibling_checks),
  'favored_selections',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('source_slug',source_slug,'candidate',candidate,
    'source_ref_id',source_ref_id,'finite_earned_selection',finite_earned_selection,'language_projection_exact',language_projection_exact) ORDER BY source_slug),'[]') FROM favored_rows),
  'favored_language_pins',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(f) ORDER BY slug,id),'[]') FROM favored_languages f),
  'all_favored_checks',(SELECT COALESCE(bool_and(finite_earned_selection AND language_projection_exact),true) FROM favored_rows)
    AND (SELECT COALESCE(bool_and(exact_owned_language),true) FROM favored_languages)
    AND (SELECT count(*)=count(DISTINCT candidate#>>'{selection,enemy_type}') FROM favored_rows WHERE candidate#>>'{selection,mode}'='type')
    AND (SELECT count(*)=count(DISTINCT race.value) FROM favored_rows f CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
      CASE WHEN f.candidate#>>'{selection,mode}'='humanoids' THEN f.candidate#>'{selection,races}' ELSE '[]' END) race(value)),
  'order_domains',(SELECT pg_catalog.jsonb_object_agg(domain,pg_catalog.jsonb_build_object('physical_count',physical_count,'ordered_count',ordered_count,'bijection',bijection)) FROM order_checks),
  'all_five_order_bijections',(SELECT count(*)=5 AND bool_and(bijection) FROM order_checks),
  'runtime_boundaries',(SELECT pg_catalog.to_jsonb(b) FROM boundaries b),
  'all_boundaries_closed',(SELECT capabilities=0 AND readiness_rows=13 AND ready_rows=0 AND gates_closed AND service_private_closed AND private_entries_closed FROM boundaries),
  'catalog_counts_observed',(SELECT pg_catalog.jsonb_build_object('definitions',(SELECT count(*) FROM public.content_definitions),
    'versions',(SELECT count(*) FROM public.content_versions),'version_one_rows',(SELECT count(*) FROM public.content_versions WHERE version=1)))
));
ROLLBACK;
