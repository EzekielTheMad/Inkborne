-- Administrative, read-only evidence for the actual browser story. Invoke with
-- psql -v character_id=<public character UUID>; no credential belongs in args.
-- This does not replace real Auth/session/foreign-owner browser acceptance.
BEGIN READ ONLY;
WITH
target AS (
  SELECT * FROM public.characters WHERE id=:'character_id'::uuid
),
proof AS (
  SELECT t.id,private.builder_original_occurrence_v1(t.id) AS original,
    private.builder_class_roles_v1(t.id) AS projection,
    private.builder_protected_graph_v1(t.id) AS graph,
    private.character_ability_scores(t.id,NULL,NULL,NULL) AS effective_scores
  FROM target t
),
ordering AS (
  SELECT pg_catalog.to_jsonb(o) AS value FROM private.character_projection_order_v1 o JOIN target t ON t.id=o.character_id
),
class_rows AS (
  SELECT t.id AS character_id,t.user_id,c.value AS choice,o.id AS occurrence_id,o.class_slug,
    (c.value->>'level')::integer AS class_level,o.lifecycle,o.controller_ref_id,o.subclass_ref_id,
    r.content_id,r.content_version,pg_catalog.to_jsonb(r) AS controller,pg_catalog.to_jsonb(v) AS definition,
    subclass.slug_snapshot AS subclass_slug,sc.value AS role_source,
    CASE WHEN o.id::text=p.original->>'id' THEN 'original' ELSE 'secondary' END AS expected_role
  FROM target t CROSS JOIN proof p
  CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(t.choices->'classes') c(value)
  JOIN private.character_class_occurrences_v1 o ON o.character_id=t.id AND o.id=(c.value->>'occurrence_id')::uuid
  JOIN public.character_content_refs r ON r.id=o.controller_ref_id AND r.character_id=t.id
  JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
  LEFT JOIN public.character_content_refs subref ON subref.id=o.subclass_ref_id AND subref.character_id=t.id
  LEFT JOIN public.content_versions subclass ON subclass.content_id=subref.content_id AND subclass.version=subref.content_version
  JOIN LATERAL pg_catalog.jsonb_array_elements(p.projection->'class_sources') sc(value)
    ON sc.value->>'controller_ref_id'=r.id::text
),
physical_domains AS (
  SELECT 'pins'::text AS domain,COALESCE(pg_catalog.array_agg(r.id ORDER BY r.id),'{}'::uuid[]) AS ids
    FROM public.character_content_refs r JOIN target t ON t.id=r.character_id
  UNION ALL SELECT 'inventory',COALESCE(pg_catalog.array_agg(r.id ORDER BY r.id),'{}'::uuid[])
    FROM public.character_inventory r JOIN target t ON t.id=r.character_id
  UNION ALL SELECT 'spells',COALESCE(pg_catalog.array_agg(r.id ORDER BY r.id),'{}'::uuid[])
    FROM public.character_spells r JOIN target t ON t.id=r.character_id
  UNION ALL SELECT 'feature_grants',COALESCE(pg_catalog.array_agg(r.id ORDER BY r.id),'{}'::uuid[])
    FROM public.character_feature_grants r JOIN target t ON t.id=r.character_id
  UNION ALL SELECT 'spell_grants',COALESCE(pg_catalog.array_agg(r.id ORDER BY r.id),'{}'::uuid[])
    FROM public.character_spell_grants r JOIN target t ON t.id=r.character_id
),
domain_checks AS (
  SELECT d.domain,cardinality(d.ids) AS physical_count,
    pg_catalog.jsonb_array_length(o.value->d.domain) AS ordered_count,
    d.ids=(SELECT COALESCE(pg_catalog.array_agg(value::uuid ORDER BY value::uuid),'{}'::uuid[])
      FROM pg_catalog.jsonb_array_elements_text(o.value->d.domain))
      AND pg_catalog.jsonb_array_length(o.value->d.domain)=(SELECT count(DISTINCT value)
        FROM pg_catalog.jsonb_array_elements_text(o.value->d.domain)) AS bijection
  FROM physical_domains d CROSS JOIN ordering o
),
role_checks AS (
  SELECT cr.*,
    cr.role_source->>'occurrence_id'=cr.occurrence_id::text
      AND cr.role_source->>'role'=cr.expected_role
      AND cr.role_source->>'content_id'=cr.content_id::text
      AND cr.role_source->>'content_version'=cr.content_version::text
      AND cr.role_source->'raw_data'=cr.definition->'data_snapshot'
      AND cr.role_source->'raw_effects'=cr.definition->'effects_snapshot'
      AND cr.role_source->'evaluation_data'=private.builder_class_role_profile_v1(cr.definition,cr.expected_role)->'evaluation_data'
      AND cr.role_source->'evaluation_effects'=private.builder_class_role_profile_v1(cr.definition,cr.expected_role)->'evaluation_effects'
      AND cr.definition->>'content_type_snapshot'='class'
      AND cr.definition->>'slug_snapshot'=cr.class_slug
      AND cr.controller->'context'='{"source":"class","level":1}'::jsonb AS exact_frozen_role_projection,
    NOT EXISTS(SELECT 1 FROM public.character_feature_grants g WHERE g.character_id=cr.character_id
      AND g.controller_ref_id IN (cr.controller_ref_id,cr.subclass_ref_id)
      AND ((g.unlock_level<=cr.class_level AND NOT EXISTS(SELECT 1 FROM public.character_content_refs r
          WHERE r.character_id=cr.character_id AND r.feature_grant_id=g.id))
        OR (g.unlock_level>cr.class_level AND EXISTS(SELECT 1 FROM public.character_content_refs r
          WHERE r.character_id=cr.character_id AND r.feature_grant_id=g.id)))) AS feature_activation_exact,
    NOT EXISTS(SELECT 1 FROM public.character_spells s WHERE s.character_id=cr.character_id AND s.class_slug=cr.class_slug
      AND s.source='selection' AND (s.custom_data->>'builder_class_controller_ref_id' IS DISTINCT FROM cr.controller_ref_id::text
        OR NOT s.is_known OR s.always_prepared OR s.spell_grant_id IS NOT NULL)) AS selected_spell_provenance_exact,
    COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('content_id',s.content_id,'content_version',s.content_version,
      'prepared',s.is_prepared) ORDER BY s.content_id,s.content_version) FROM public.character_spells s
      WHERE s.character_id=cr.character_id AND s.class_slug=cr.class_slug AND s.source='selection'),'[]'::jsonb)
      =COALESCE((SELECT pg_catalog.jsonb_agg(value ORDER BY value->>'content_id',value->>'content_version')
        FROM target t CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(COALESCE(t.choices#>ARRAY['class_spell_selections',cr.class_slug],'[]')) selection(value)),'[]'::jsonb)
      AS selection_choices_match_physical_rows,
    NOT EXISTS(SELECT 1 FROM public.character_spells s WHERE s.character_id=cr.character_id AND s.class_slug=cr.class_slug AND s.source='feature'
      AND NOT EXISTS(SELECT 1 FROM public.character_spell_grants g WHERE g.id=s.spell_grant_id AND g.character_id=cr.character_id
        AND g.controller_ref_id IN (cr.controller_ref_id,cr.subclass_ref_id) AND g.class_slug=cr.class_slug AND g.unlock_level<=cr.class_level
        AND g.spell_content_id=s.content_id AND g.spell_version=s.content_version)) AS granted_spell_provenance_exact,
    NOT EXISTS(SELECT 1 FROM public.character_spell_grants g WHERE g.character_id=cr.character_id
      AND g.controller_ref_id IN (cr.controller_ref_id,cr.subclass_ref_id) AND g.unlock_level<=cr.class_level
      AND NOT EXISTS(SELECT 1 FROM public.character_spells s WHERE s.character_id=cr.character_id AND s.class_slug=g.class_slug
        AND s.content_id=g.spell_content_id AND s.source='feature')) AS active_spell_grants_projected
  FROM class_rows cr
),
acquisitions AS (
  SELECT a.*,h.before_graph,h.after_graph,h.before_parent,h.after_parent,h.receipt,h.command,
    b.request,b.receipt AS stored_receipt
  FROM private.character_builder_class_acquisitions_v1 a JOIN target t ON t.id=a.character_id
  LEFT JOIN private.character_builder_progression_history_v1 h ON h.actor_id=a.actor_id AND h.operation_id=a.operation_id
  LEFT JOIN private.character_builder_receipts_v1 b ON b.actor_id=a.actor_id AND b.operation_id=a.operation_id AND b.character_id=a.character_id
),
acquisition_checks AS (
  SELECT a.operation_id,a.occurrence_id,a.controller_ref_id,
    a.actor_id=t.user_id AND a.command='add_class' AND a.request->>'command'='add_class' AND a.receipt=a.stored_receipt
      AND a.request#>>'{fields,class_id}'=a.content_id::text AND a.request#>>'{fields,class_version}'=a.content_version::text
      AND a.request#>>'{fields,expected_action_revision}'=a.before_parent->>'action_revision'
      AND (a.after_parent->>'action_revision')::bigint=(a.before_parent->>'action_revision')::bigint+1
      AND (a.after_parent->>'level')::integer=(a.before_parent->>'level')::integer+1
      AND a.after_graph->'origin'=a.before_graph->'origin' AND a.after_graph->'commands'=a.before_graph->'commands'
      AND a.after_graph->'inventory'=a.before_graph->'inventory'
      AND pg_catalog.jsonb_array_length(a.after_graph->'occurrences')=pg_catalog.jsonb_array_length(a.before_graph->'occurrences')+1
      AND a.profile=private.builder_class_role_profile_v1(cr.definition,'secondary')
      AND cr.expected_role='secondary' AND cr.lifecycle='accepted' AS authentic_atomic_acquisition,
    NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(a.before_graph->'occurrences') old(value)
      WHERE NOT (a.after_graph->'occurrences') @> pg_catalog.jsonb_build_array(old.value)) AS retained_original_occurrence,
    NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(a.before_graph->'refs') old(value)
      WHERE NOT (a.after_graph->'refs') @> pg_catalog.jsonb_build_array(old.value)) AS retained_original_pins,
    (a.before_parent->'choices') IS NOT DISTINCT FROM ((a.after_parent->'choices')-ARRAY['classes','hp_rolls'])
      ||pg_catalog.jsonb_build_object('classes',a.before_parent#>'{choices,classes}')
      ||CASE WHEN a.before_parent->'choices' ? 'hp_rolls' THEN pg_catalog.jsonb_build_object('hp_rolls',a.before_parent#>'{choices,hp_rolls}') ELSE '{}'::jsonb END
      AS prior_choices_retained
  FROM acquisitions a JOIN target t ON t.id=a.character_id
  LEFT JOIN class_rows cr ON cr.occurrence_id=a.occurrence_id AND cr.controller_ref_id=a.controller_ref_id
),
starting_award AS (
  SELECT g.* FROM public.character_starting_grants g JOIN target t ON t.id=g.character_id WHERE g.grant_kind='starting_equipment'
),
globals AS (
  SELECT (SELECT count(*) FROM private.character_writer_readiness_v1) AS readiness_count,
    (SELECT count(*) FROM private.character_writer_readiness_v1 WHERE ready) AS ready_count,
    (SELECT count(*) FROM private.character_builder_capabilities_v1) AS capability_count,
    NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
      AND NOT EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) AS class_and_hit_die_gates_closed,
    NOT pg_catalog.has_schema_privilege('service_role','private','USAGE') AS service_private_closed,
    pg_catalog.has_function_privilege('authenticated','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
      AND pg_catalog.has_function_privilege('authenticated','public.character_builder_class_role_projection_v1(jsonb,uuid)','EXECUTE')
      AND NOT pg_catalog.has_function_privilege('anon','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
      AND NOT pg_catalog.has_function_privilege('service_role','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
      AND NOT pg_catalog.has_function_privilege('anon','public.character_builder_class_role_projection_v1(jsonb,uuid)','EXECUTE')
      AND NOT pg_catalog.has_function_privilege('service_role','public.character_builder_class_role_projection_v1(jsonb,uuid)','EXECUTE')
      AND NOT pg_catalog.has_table_privilege('authenticated','private.character_builder_class_acquisitions_v1','SELECT,INSERT,UPDATE,DELETE')
      AS finite_entry_privileges_closed
),
dynamic AS (
  SELECT t.id,t.level,t.action_revision,p.effective_scores,
    private.builder_multiclass_max_hp_v1(t.id,t.choices,p.graph) AS max_hp,
    (SELECT pg_catalog.jsonb_object_agg(class_slug,pg_catalog.jsonb_build_object('level',class_level,'subclass',subclass_slug)) FROM class_rows) AS classes,
    (SELECT count(*) FROM private.character_class_occurrences_v1 o WHERE o.character_id=t.id AND o.lifecycle<>'ended') AS active_occurrences,
    (SELECT count(*) FROM private.character_class_commands_v1 c WHERE c.character_id=t.id) AS original_class_receipt_count,
    (SELECT count(*) FROM private.character_builder_receipts_v1 b WHERE b.character_id=t.id AND b.request->>'command'='add_class') AS accepted_add_receipt_count,
    (SELECT count(*) FROM private.character_builder_progression_history_v1 h WHERE h.character_id=t.id AND h.command='add_class') AS accepted_add_history_count,
    (SELECT count(*) FROM acquisitions) AS secondary_profile_count,
    NOT EXISTS(SELECT 1 FROM class_rows WHERE class_slug='rogue')
      AND NOT EXISTS(SELECT 1 FROM public.character_content_refs r JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
        WHERE r.character_id=t.id AND v.content_type_snapshot='class' AND v.slug_snapshot='rogue') AS rejected_stale_rogue_absent,
    (SELECT producer_revision=t.action_revision FROM private.character_projection_order_v1 WHERE character_id=t.id) AS parent_order_revision_equal,
    p.projection->>'action_revision'=t.action_revision::text
      AND p.projection->'source_order'=(SELECT value->'pins' FROM ordering) AS role_projection_revision_and_order_exact,
    COALESCE(t.choices->'asi_choices','{}')='{}'::jsonb AS retired_fighter_asi_absent,
    t.state->'current_hp' AS stored_current_hp,t.state#>'{currency,gp}' AS gp
  FROM target t JOIN proof p ON p.id=t.id
)
SELECT pg_catalog.jsonb_pretty(pg_catalog.jsonb_build_object(
  'evidence_kind','administrative_native_readback_after_real_app_story',
  'does_not_replace_real_session_browser_evidence',true,
  'character_id',:'character_id'::uuid,
  'target_count',(SELECT count(*) FROM target),
  'observed',(SELECT pg_catalog.to_jsonb(d) FROM dynamic d),
  'bounded_story_expectations',pg_catalog.jsonb_build_object(
    'expected_classes','{"fighter":{"level":3,"subclass":"champion"},"cleric":{"level":2,"subclass":"life"}}'::jsonb,
    'expected_total_level',5,'expected_strength',16,'expected_max_hp',37,'expected_gp',15,
    'matches',(SELECT d.classes='{"fighter":{"level":3,"subclass":"champion"},"cleric":{"level":2,"subclass":"life"}}'::jsonb
      AND d.level=5 AND d.effective_scores->'strength'='16'::jsonb AND d.max_hp=37 AND d.gp='15'::jsonb
      AND d.active_occurrences=2 AND d.original_class_receipt_count=1 AND d.accepted_add_receipt_count=1
      AND d.accepted_add_history_count=1 AND d.secondary_profile_count=1 AND d.rejected_stale_rogue_absent
      AND d.parent_order_revision_equal AND d.role_projection_revision_and_order_exact AND d.retired_fighter_asi_absent FROM dynamic d)),
  'order_domains',(SELECT pg_catalog.jsonb_object_agg(domain,pg_catalog.jsonb_build_object('physical_count',physical_count,'ordered_count',ordered_count,'bijection',bijection)) FROM domain_checks),
  'all_five_order_bijections',(SELECT count(*)=5 AND bool_and(bijection) FROM domain_checks),
  'class_sources',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'class_slug',class_slug,'level',class_level,'subclass_slug',subclass_slug,'role',expected_role,
    'occurrence_id',occurrence_id,'controller_ref_id',controller_ref_id,'subclass_ref_id',subclass_ref_id,
    'exact_frozen_role_projection',exact_frozen_role_projection,'feature_activation_exact',feature_activation_exact,
    'selected_spell_provenance_exact',selected_spell_provenance_exact,'selection_choices_match_physical_rows',selection_choices_match_physical_rows,
    'granted_spell_provenance_exact',granted_spell_provenance_exact,'active_spell_grants_projected',active_spell_grants_projected,
    'ordinary_spell_count',(SELECT count(*) FROM public.character_spells s WHERE s.character_id=rc.character_id AND s.class_slug=rc.class_slug AND s.source='selection'),
    'granted_spell_count',(SELECT count(*) FROM public.character_spells s WHERE s.character_id=rc.character_id AND s.class_slug=rc.class_slug AND s.source='feature'),
    'evaluated_starting_save_stats',(SELECT COALESCE(pg_catalog.jsonb_agg(e.value->'stat' ORDER BY e.value->>'stat'),'[]')
      FROM pg_catalog.jsonb_array_elements(rc.role_source->'evaluation_effects') e(value)
      WHERE e.value->>'type'='grant' AND (e.value->>'stat' LIKE 'save_%' OR e.value->>'stat' LIKE 'saving_throw_%'))
    ) ORDER BY class_slug) FROM role_checks rc),
  'all_class_source_checks',(SELECT count(*)=2 AND bool_and(exact_frozen_role_projection AND feature_activation_exact
    AND selected_spell_provenance_exact AND selection_choices_match_physical_rows AND granted_spell_provenance_exact AND active_spell_grants_projected) FROM role_checks),
  'secondary_acquisitions',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(ac)),'[]') FROM acquisition_checks ac),
  'all_acquisition_checks',(SELECT count(*)=1 AND bool_and(authentic_atomic_acquisition AND retained_original_occurrence AND retained_original_pins AND prior_choices_retained) FROM acquisition_checks),
  'starting_award',pg_catalog.jsonb_build_object('count',(SELECT count(*) FROM starting_award),'awarded',(SELECT status='awarded' FROM starting_award),
    'all_inventory_has_award_provenance',NOT EXISTS(SELECT 1 FROM public.character_inventory i JOIN target t ON t.id=i.character_id
      WHERE NOT EXISTS(SELECT 1 FROM starting_award g WHERE g.id=i.starting_grant_id AND g.receipt->'inventory_ids' @> pg_catalog.jsonb_build_array(i.id)))),
  'closed_runtime_boundaries',(SELECT pg_catalog.to_jsonb(g) FROM globals g),
  'all_runtime_boundaries_closed',(SELECT readiness_count=13 AND ready_count=0 AND capability_count=0
    AND class_and_hit_die_gates_closed AND service_private_closed AND finite_entry_privileges_closed FROM globals)
));
ROLLBACK;
