-- Read-only evidence after genuine local app actions. No fixture writes.
-- psql -v character_id=<UUID> -v control_id=<old Draconic UUID> -f this-file.sql
BEGIN READ ONLY;
WITH target AS (
 SELECT * FROM public.characters WHERE id=:'character_id'::uuid
), control AS (
 SELECT c.*,private.builder_protected_graph_v1(c.id) AS graph
 FROM public.characters c WHERE id=:'control_id'::uuid
), proof AS (
 SELECT t.id,private.builder_protected_graph_v1(t.id) AS graph,
   private.builder_original_occurrence_v1(t.id) AS original,
   private.builder_class_roles_v1(t.id) AS roles,
   private.character_ability_scores(t.id,NULL,NULL,NULL) AS scores
 FROM target t
), refs AS (
 SELECT r.*,v.content_type_snapshot AS kind,v.slug_snapshot AS slug,v.data_snapshot AS data,
   v.effects_snapshot AS effects,v.content_id IS NOT NULL AS exact_version,
   v.system_id_snapshot AS system_id,v.source_snapshot AS source,v.scope_snapshot AS scope,
   v.owner_id_snapshot AS owner_id,md5(to_jsonb(v)::text) AS snapshot_fingerprint
 FROM public.character_content_refs r JOIN target t ON t.id=r.character_id
 LEFT JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
), classes AS (
 SELECT c.value AS choice,o.*,r.content_id AS pinned_content_id,r.content_version AS pinned_version,r.slug
 FROM target t CROSS JOIN LATERAL jsonb_array_elements(t.choices->'classes') c(value)
 JOIN private.character_class_occurrences_v1 o ON o.character_id=t.id AND o.id=(c.value->>'occurrence_id')::uuid
 JOIN refs r ON r.id=o.controller_ref_id AND r.kind='class'
), sorcerer AS (
 SELECT o.*,s.id AS subclass_pin_id,s.content_id AS subclass_content_id,s.content_version AS subclass_version,
   s.data AS subclass_data,s.effects AS subclass_effects,s.context AS subclass_context,s.choice_source AS subclass_choice_source
 FROM classes o JOIN refs s ON s.id=o.subclass_ref_id AND s.kind='subclass' AND s.slug='draconic'
 WHERE o.slug='sorcerer'
), inventory AS (
 SELECT i.*,v.slug_snapshot AS slug,v.content_id IS NOT NULL AS exact_version,
   v.content_type_snapshot AS kind,v.system_id_snapshot AS system_id,
   v.data_snapshot AS data,md5(to_jsonb(v)::text) AS snapshot_fingerprint
 FROM public.character_inventory i JOIN target t ON t.id=i.character_id
 LEFT JOIN public.content_versions v ON v.content_id=i.content_id AND v.version=i.content_version
), domains AS (
 SELECT 'pins' AS domain,COALESCE(array_agg(id ORDER BY id),'{}'::uuid[]) AS ids FROM refs
 UNION ALL SELECT 'inventory',COALESCE(array_agg(id ORDER BY id),'{}'::uuid[]) FROM inventory
 UNION ALL SELECT 'spells',COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[]) FROM public.character_spells r JOIN target t ON t.id=r.character_id
 UNION ALL SELECT 'feature_grants',COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[]) FROM public.character_feature_grants r JOIN target t ON t.id=r.character_id
 UNION ALL SELECT 'spell_grants',COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[]) FROM public.character_spell_grants r JOIN target t ON t.id=r.character_id
), order_checks AS (
 SELECT d.domain,cardinality(d.ids)=jsonb_array_length(to_jsonb(o)->d.domain)
   AND d.ids=ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(to_jsonb(o)->d.domain) ORDER BY value::uuid)
   AND cardinality(d.ids)=(SELECT count(DISTINCT value) FROM jsonb_array_elements_text(to_jsonb(o)->d.domain)) AS bijection
 FROM domains d CROSS JOIN target t JOIN private.character_projection_order_v1 o ON o.character_id=t.id
)
SELECT jsonb_build_object(
 'evidenceKind','read_only_after_actual_draconic_app_actions','characterId',t.id,'actorId',t.user_id,
 'level',t.level,'actionRevision',t.action_revision::text,'baseScores',t.base_stats,'effectiveScores',p.scores,
 'maximumHp',private.builder_multiclass_max_hp_v1(t.id,t.choices,p.graph),
 'hpRolls',COALESCE(t.choices->'hp_rolls','{}'),'graphFingerprint',md5(p.graph::text),
 'originalOccurrenceId',p.original->>'id','sorcererOccurrenceId',s.id,'sorcererLevel',(s.choice->>'level')::integer,
 'subclassPinId',s.subclass_pin_id,'subclassContentId',s.subclass_content_id,'subclassVersion',s.subclass_version,
 'subclassHpBonus',s.subclass_data->'hit_points_bonus_per_class_level','subclassEffects',s.subclass_effects,
 'classRoots',(SELECT jsonb_agg(jsonb_build_object('occurrenceId',id,'controllerRefId',controller_ref_id,
   'slug',slug,'level',(choice->>'level')::integer,'contentId',pinned_content_id,'version',pinned_version) ORDER BY slug) FROM classes),
 'pins',(SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'slug',slug,'contentId',content_id,
   'version',content_version,'snapshotFingerprint',snapshot_fingerprint) ORDER BY kind,slug,id) FROM refs),
 'inventory',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'slug',slug,'name',name,'version',content_version,
   'contentId',content_id,'equipped',equipped,'quantity',quantity,'startingGrantId',starting_grant_id,
   'snapshotFingerprint',snapshot_fingerprint,'armorCategory',data->'armor_category','armorClass',data->'armor_class') ORDER BY id) FROM inventory),'[]'),
 'startingAwards',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'receipt',receipt) ORDER BY id)
   FROM public.character_starting_grants WHERE character_id=t.id),'[]'),
 'hpDraws',COALESCE((SELECT jsonb_agg(jsonb_build_object('operationId',operation_id,'actorId',actor_id,
   'occurrenceId',occurrence_id,'level',level,'die',die,'value',value,'createdAt',created_at) ORDER BY occurrence_id,level)
   FROM private.character_builder_hp_draws_v1 WHERE character_id=t.id),'[]'),
 'receiptCount',(SELECT count(*) FROM private.character_builder_receipts_v1 WHERE character_id=t.id),
 'progressionHistoryCount',(SELECT count(*) FROM private.character_builder_progression_history_v1 WHERE character_id=t.id),
 'oldControl',(SELECT jsonb_build_object('characterId',c.id,'actorId',c.user_id,'maximumHp',private.builder_multiclass_max_hp_v1(c.id,c.choices,c.graph),
   'subclassVersion',(SELECT r.content_version FROM public.character_content_refs r JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
     WHERE r.character_id=c.id AND v.content_type_snapshot='subclass' AND v.slug_snapshot='draconic'),
   'fingerprint',md5(jsonb_build_array(to_jsonb(c)-'graph',c.graph,
     (SELECT to_jsonb(o) FROM private.character_projection_order_v1 o WHERE character_id=c.id),
     (SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]') FROM public.character_inventory i WHERE i.character_id=c.id),
     (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.operation_id),'[]') FROM private.character_builder_receipts_v1 r WHERE r.character_id=c.id),
     (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.occurrence_id,d.level),'[]') FROM private.character_builder_hp_draws_v1 d WHERE d.character_id=c.id),
     (SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY h.operation_id),'[]') FROM private.character_builder_progression_history_v1 h WHERE h.character_id=c.id))::text)) FROM control c),
 'catalog',jsonb_build_object('definitions',(SELECT count(*) FROM public.content_definitions),'versions',(SELECT count(*) FROM public.content_versions),
   'draconic',(SELECT jsonb_build_object('contentId',id,'version',version) FROM public.content_definitions WHERE content_type='subclass' AND slug='draconic'),
   'draconicSnapshots',(SELECT jsonb_agg(jsonb_build_object('version',version,'fingerprint',md5(to_jsonb(v)::text),
     'hpBonus',data_snapshot->'hit_points_bonus_per_class_level','effects',effects_snapshot) ORDER BY version)
     FROM public.content_versions v WHERE content_type_snapshot='subclass' AND slug_snapshot='draconic'),
   'resilienceSnapshots',(SELECT jsonb_agg(jsonb_build_object('version',version,'fingerprint',md5(to_jsonb(v)::text)) ORDER BY version)
     FROM public.content_versions v WHERE content_type_snapshot='feature' AND slug_snapshot='draconic-resilience')),
 'checks',jsonb_build_object(
   'oneOwnedTargetAndOldControl',(SELECT count(*)=1 FROM target) AND (SELECT count(*)=1 AND bool_and(user_id=t.user_id) FROM control),
   'oneEarnedDraconicSorcerer',(SELECT count(*)=1 FROM sorcerer) AND s.lifecycle='accepted' AND (s.choice->>'level')::integer BETWEEN 1 AND 20,
   'exactSelectedClassRoots',(SELECT count(*) FROM classes)=jsonb_array_length(t.choices->'classes')
     AND NOT EXISTS(SELECT 1 FROM classes WHERE content_id<>pinned_content_id OR content_version<>pinned_version OR lifecycle<>'accepted'),
   'originalProofAndCurrentRoles',EXISTS(SELECT 1 FROM classes WHERE id=(p.original->>'id')::uuid AND controller_ref_id=(p.original->>'controller_ref_id')::uuid)
     AND p.roles->>'action_revision'=t.action_revision::text AND p.roles->'source_order'=(SELECT to_jsonb(o)->'pins' FROM private.character_projection_order_v1 o WHERE character_id=t.id),
   'exactFrozenSubclassOwner',s.subclass_data->>'parent_class'='sorcerer' AND s.subclass_context='{"source":"subclass","class":"sorcerer"}'::jsonb
     AND s.subclass_choice_source='builder:subclass:'||s.id::text,
   'everyPinHasExactSrdSnapshot',(SELECT COALESCE(bool_and(exact_version AND system_id=t.system_id AND source='srd' AND scope='platform' AND owner_id IS NULL),false) FROM refs),
   'humanStandardArray',t.choices->>'race'='human' AND NOT(t.choices ? 'subrace') AND t.choices->>'ability_method'='standard_array',
   'drawsBindOriginalReceipts',NOT EXISTS(SELECT 1 FROM private.character_builder_hp_draws_v1 d WHERE d.character_id=t.id AND
     (d.actor_id<>t.user_id OR d.occurrence_id<>s.id OR d.die<>6 OR d.level<>2 OR d.value NOT BETWEEN 1 AND 6
       OR NOT EXISTS(SELECT 1 FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id AND r.actor_id=d.actor_id AND r.operation_id=d.operation_id
         AND r.request->>'command'='save_hp_roll' AND r.request#>>'{fields,class_slug}'='sorcerer' AND r.request#>>'{fields,level}'='2'
         AND r.request#>>'{fields,method}'='rolled' AND r.request#>'{fields,value}'='null'::jsonb
         AND r.receipt#>ARRAY['saved_choices','hp_rolls','sorcerer-2']=jsonb_build_object('method','rolled','value',d.value)))),
   'inventoryFromAcceptedStartingAward',NOT EXISTS(SELECT 1 FROM inventory i WHERE NOT exact_version OR kind<>'armor' AND kind NOT IN ('item','weapon')
     OR system_id<>t.system_id OR NOT EXISTS(SELECT 1 FROM public.character_starting_grants a WHERE a.character_id=t.id AND a.id=i.starting_grant_id
       AND a.status='awarded' AND a.grant_kind='starting_equipment' AND a.completed_at IS NOT NULL
       AND a.receipt->>'grant_id'=a.id::text AND a.receipt->'inventory_ids' @> jsonb_build_array(i.id)
       AND EXISTS(SELECT 1 FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id AND r.actor_id=t.user_id
         AND r.request->>'command'='award_equipment' AND r.request->'canonical_intent'=a.canonical_intent AND r.receipt=a.receipt))),
   'fiveOrderBijections',(SELECT count(*)=5 AND bool_and(bijection) FROM order_checks),
   'parentOrderRevision',(SELECT producer_revision=t.action_revision FROM private.character_projection_order_v1 WHERE character_id=t.id),
   'boundariesClosed',(SELECT count(*)=0 FROM private.character_builder_capabilities_v1)
     AND (SELECT count(*)=13 FROM private.character_writer_readiness_v1) AND NOT EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
     AND NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled) AND NOT EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
     AND NOT has_schema_privilege('service_role','private','USAGE')
 )) FROM target t JOIN proof p ON p.id=t.id CROSS JOIN sorcerer s;
ROLLBACK;
