-- A4 read-only evidence after genuine app saves, never a fixture writer.
-- psql -v character_id=<UUID> -v control_id=<old Hill Dwarf UUID> -f this-file.sql
-- The paired story proves Auth, all six Saved steps, sheet values and reload.
BEGIN READ ONLY;
WITH target AS (
 SELECT * FROM public.characters WHERE id=:'character_id'::uuid
), proof AS (
 SELECT t.id,private.builder_protected_graph_v1(t.id) AS graph,
   private.builder_original_occurrence_v1(t.id) AS original,private.builder_class_roles_v1(t.id) AS roles,
   private.character_ability_scores(t.id,NULL,NULL,NULL) AS scores
 FROM target t
), refs AS (
 SELECT r.*,v.content_type_snapshot AS kind,v.slug_snapshot AS slug,v.data_snapshot AS data,v.effects_snapshot AS effects,
   v.content_id IS NOT NULL AS exact_version,v.system_id_snapshot AS system_id,v.source_snapshot AS source,
   v.scope_snapshot AS scope,v.owner_id_snapshot AS owner_id,md5(to_jsonb(v)::text) AS snapshot_fingerprint
 FROM public.character_content_refs r JOIN target t ON t.id=r.character_id
 LEFT JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
), selected_class AS (
 SELECT c.value AS choice,o.*,root.content_id AS pinned_content_id,root.content_version AS pinned_version,
   root.slug,root.data,sub.id AS subclass_pin_id,sub.slug AS subclass_slug,sub.data AS subclass_data,
   sub.context AS subclass_context,sub.choice_source AS subclass_choice_source
 FROM target t CROSS JOIN LATERAL jsonb_array_elements(t.choices->'classes') c(value)
 JOIN private.character_class_occurrences_v1 o ON o.character_id=t.id AND o.id=(c.value->>'occurrence_id')::uuid
 JOIN refs root ON root.id=o.controller_ref_id AND root.kind='class'
 LEFT JOIN refs sub ON sub.id=o.subclass_ref_id AND sub.kind='subclass'
), ancestry AS (
 SELECT r.id AS race_pin_id,s.id AS subrace_pin_id,s.content_id AS subrace_content_id,s.content_version AS subrace_version,
   r.data AS race_data,s.data AS subrace_data
 FROM refs r CROSS JOIN refs s WHERE r.kind='race' AND r.slug='dwarf' AND s.kind='subrace' AND s.slug='hill-dwarf'
), inventory AS (
 SELECT i.*,v.slug_snapshot AS slug,v.content_type_snapshot AS kind,v.system_id_snapshot AS system_id,
   v.source_snapshot AS source,v.scope_snapshot AS scope,v.owner_id_snapshot AS owner_id,
   v.content_id IS NOT NULL AS exact_version,md5(to_jsonb(v)::text) AS snapshot_fingerprint
 FROM public.character_inventory i JOIN target t ON t.id=i.character_id
 LEFT JOIN public.content_versions v ON v.content_id=i.content_id AND v.version=i.content_version
), awards AS (
 SELECT a.* FROM public.character_starting_grants a JOIN target t ON t.id=a.character_id WHERE a.grant_kind='starting_equipment'
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
), fingerprints AS (
 SELECT t.id,md5(jsonb_build_array(to_jsonb(t),private.builder_progression_full_graph_v1(t.id),
   (SELECT to_jsonb(o) FROM private.character_projection_order_v1 o WHERE o.character_id=t.id),
   (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]') FROM awards a),
   (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.operation_id),'[]') FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id),
   (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.occurrence_id,d.level),'[]') FROM private.character_builder_hp_draws_v1 d WHERE d.character_id=t.id),
   (SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY h.operation_id),'[]') FROM private.character_builder_progression_history_v1 h WHERE h.character_id=t.id),
   (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',r.id,'snapshot',r.snapshot_fingerprint) ORDER BY r.id),'[]') FROM refs r))::text) AS complete_fingerprint
 FROM target t
), old_control AS (
 SELECT c.id,c.user_id,s.content_version AS subrace_version,
   private.builder_multiclass_max_hp_v1(c.id,c.choices,private.builder_protected_graph_v1(c.id)) AS maximum_hp,
   md5(jsonb_build_array(to_jsonb(c),private.builder_progression_full_graph_v1(c.id),
     (SELECT to_jsonb(o) FROM private.character_projection_order_v1 o WHERE o.character_id=c.id),
     (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]') FROM public.character_starting_grants a WHERE a.character_id=c.id),
     (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.operation_id),'[]') FROM private.character_builder_receipts_v1 r WHERE r.character_id=c.id),
     (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.occurrence_id,d.level),'[]') FROM private.character_builder_hp_draws_v1 d WHERE d.character_id=c.id),
     (SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY h.operation_id),'[]') FROM private.character_builder_progression_history_v1 h WHERE h.character_id=c.id),
     (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',r.id,'snapshot',md5(to_jsonb(v)::text)) ORDER BY r.id),'[]')
       FROM public.character_content_refs r JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version WHERE r.character_id=c.id))::text) AS fingerprint
 FROM public.characters c JOIN public.character_content_refs s ON s.character_id=c.id
 JOIN public.content_versions v ON v.content_id=s.content_id AND v.version=s.content_version AND v.content_type_snapshot='subrace' AND v.slug_snapshot='hill-dwarf'
 WHERE c.id=:'control_id'::uuid
), calculations AS (
 -- Independent fixed A4 arithmetic: original d12, CON+3 each level,
 -- explicit later raw dice, and new-root Toughness once per CHARACTER level.
 SELECT t.id,12+3*t.level+CASE WHEN t.level>=2 THEN (t.choices#>>'{hp_rolls,barbarian-2,value}')::integer ELSE 0 END
   +CASE WHEN t.level>=3 THEN (t.choices#>>'{hp_rolls,barbarian-3,value}')::integer ELSE 0 END
   +CASE WHEN a.subrace_version=2 THEN t.level ELSE 0 END AS independent_max_hp,
   private.builder_multiclass_max_hp_v1(t.id,t.choices,p.graph) AS native_max_hp
 FROM target t JOIN proof p ON p.id=t.id CROSS JOIN ancestry a
)
SELECT jsonb_build_object(
 'evidenceKind','read_only_after_actual_ancestry_hp_app_actions','characterId',t.id,'actorId',t.user_id,
 'level',t.level,'actionRevision',t.action_revision::text,'maximumHp',calc.native_max_hp,'independentMaximumHp',calc.independent_max_hp,
 'currentHp',t.state->'current_hp','hasStoredCurrentHp',t.state?'current_hp','baseScores',t.base_stats,'effectiveScores',p.scores,
 'originalOccurrenceId',p.original->>'id','barbarianOccurrenceId',b.id,'classControllerRefId',b.controller_ref_id,'subclassPinId',b.subclass_pin_id,
 'racePinId',a.race_pin_id,'subracePinId',a.subrace_pin_id,'subraceContentId',a.subrace_content_id,'subraceVersion',a.subrace_version,
 'ancestryHpBonus',a.subrace_data->'hit_points_bonus_per_character_level','hpRolls',COALESCE(t.choices->'hp_rolls','{}'),
 'hpDraws',COALESCE((SELECT jsonb_agg(jsonb_build_object('operationId',operation_id,'actorId',actor_id,'occurrenceId',occurrence_id,
   'level',level,'die',die,'value',value,'createdAt',created_at) ORDER BY occurrence_id,level) FROM private.character_builder_hp_draws_v1 WHERE character_id=t.id),'[]'),
 'pins',(SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'slug',slug,'contentId',content_id,'version',content_version,
   'context',context,'choiceSource',choice_source,'featureGrantId',feature_grant_id,'snapshotFingerprint',snapshot_fingerprint) ORDER BY kind,slug,id) FROM refs),
 'inventory',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'slug',slug,'contentId',content_id,'version',content_version,
   'equipped',equipped,'quantity',quantity,'startingGrantId',starting_grant_id,'snapshotFingerprint',snapshot_fingerprint) ORDER BY id) FROM inventory),'[]'),
 'graphFingerprint',md5(p.graph::text),'completeFingerprint',f.complete_fingerprint,
 'receiptCount',(SELECT count(*) FROM private.character_builder_receipts_v1 WHERE character_id=t.id),
 'progressionHistoryCount',(SELECT count(*) FROM private.character_builder_progression_history_v1 WHERE character_id=t.id),
 'oldControl',(SELECT jsonb_build_object('characterId',id,'actorId',user_id,'maximumHp',maximum_hp,'subraceVersion',subrace_version,'fingerprint',fingerprint) FROM old_control),
 'catalog',jsonb_build_object('definitions',(SELECT count(*) FROM public.content_definitions),'versions',(SELECT count(*) FROM public.content_versions),
   'hillDwarf',(SELECT jsonb_build_object('contentId',id,'version',version) FROM public.content_definitions WHERE content_type='subrace' AND slug='hill-dwarf'),
   'hillSnapshots',(SELECT jsonb_agg(jsonb_build_object('version',version,'fingerprint',md5(to_jsonb(v)::text),
     'hpBonus',data_snapshot->'hit_points_bonus_per_character_level') ORDER BY version) FROM public.content_versions v WHERE content_type_snapshot='subrace' AND slug_snapshot='hill-dwarf'),
   'toughnessSnapshots',(SELECT jsonb_agg(jsonb_build_object('version',version,'fingerprint',md5(to_jsonb(v)::text)) ORDER BY version)
     FROM public.content_versions v WHERE content_type_snapshot='trait' AND slug_snapshot='dwarven-toughness')),
 'checks',jsonb_build_object(
  'oneOwnedTargetAndControl',(SELECT count(*)=1 FROM target) AND (SELECT count(*)=1 AND bool_and(user_id=t.user_id AND maximum_hp=35 AND subrace_version=1) FROM old_control),
  'originalBarbarianProvenance',(SELECT count(*)=1 FROM selected_class) AND jsonb_array_length(t.choices->'classes')=1
    AND b.slug='barbarian' AND b.lifecycle='accepted' AND b.id=(p.original->>'id')::uuid AND b.controller_ref_id=(p.original->>'controller_ref_id')::uuid
    AND b.content_id=b.pinned_content_id AND b.content_version=b.pinned_version AND b.data->'hit_die'='12'::jsonb
    AND (SELECT count(*)=1 FROM private.character_class_commands_v1 WHERE character_id=t.id)
    AND NOT EXISTS(SELECT 1 FROM private.character_builder_class_acquisitions_v1 WHERE character_id=t.id)
    AND p.roles->>'status'='available' AND p.roles->>'original_occurrence_id'=b.id::text
    AND jsonb_array_length(p.roles->'class_sources')=1 AND p.roles#>>'{class_sources,0,role}'='original'
    AND p.roles#>>'{class_sources,0,occurrence_id}'=b.id::text AND p.roles#>>'{class_sources,0,controller_ref_id}'=b.controller_ref_id::text
    AND p.roles#>>'{class_sources,0,content_id}'=b.content_id::text AND p.roles#>>'{class_sources,0,content_version}'=b.content_version::text
    AND ARRAY(SELECT value FROM jsonb_array_elements_text(p.roles#>'{class_sources,0,evaluation_data,saving_throws}') ORDER BY value)=ARRAY['constitution','strength'],
  'exactSelectedAncestry',(SELECT count(*)=1 FROM ancestry) AND t.choices->>'race'='dwarf' AND t.choices->>'subrace'='hill-dwarf'
    AND (SELECT count(*)=2 FROM refs WHERE kind IN ('race','subrace')) AND a.subrace_data->>'parent_race'='dwarf'
    AND NOT EXISTS(SELECT 1 FROM refs WHERE kind IN ('race','subrace') AND (context IS DISTINCT FROM jsonb_build_object('source',kind) OR choice_source IS NOT NULL OR feature_grant_id IS NOT NULL))
    AND a.subrace_version IN (1,2) AND CASE WHEN a.subrace_version=1 THEN NOT(a.subrace_data?'hit_points_bonus_per_character_level') ELSE a.subrace_data->'hit_points_bonus_per_character_level'='1'::jsonb END,
  'allFrozenSrdPinsExact',(SELECT COALESCE(bool_and(exact_version AND system_id=t.system_id AND source='srd' AND scope='platform' AND owner_id IS NULL),false) FROM refs),
  'exactOwnedAncestryTraits',ARRAY(SELECT slug FROM refs WHERE kind='trait' ORDER BY slug)=ARRAY['darkvision','dwarven-combat-training','dwarven-resilience','dwarven-toughness','stonecunning','tool-proficiency']
    AND a.subrace_data->'traits' @> '["dwarven-toughness"]'::jsonb
    AND NOT EXISTS(SELECT 1 FROM refs child WHERE child.kind='trait' AND (child.feature_grant_id IS NOT NULL OR child.choice_source IS DISTINCT FROM 'builder:racial-trait:'||child.slug
      OR NOT EXISTS(SELECT 1 FROM refs root WHERE root.kind IN ('race','subrace') AND child.context=jsonb_build_object('source','racial_trait','root_controller_ref_id',root.id::text)
        AND root.data->'traits' @> jsonb_build_array(child.slug)))),
  'standardArrayAndScores',t.choices->>'ability_method'='standard_array'
    AND t.base_stats='{"strength":15,"dexterity":13,"constitution":14,"intelligence":8,"wisdom":12,"charisma":10}'::jsonb
    AND p.scores='{"strength":15,"dexterity":13,"constitution":16,"intelligence":8,"wisdom":13,"charisma":10}'::jsonb,
  'savedChoicesAndRequiredFeatures',NOT EXISTS(SELECT 1 FROM jsonb_each('{"barbarian-proficiency-choice-0":["skill-athletics","skill-perception"],"tool-proficiency-proficiency-choice":["smiths-tools"],"acolyte-language-choice":["celestial","elvish"]}'::jsonb) e(key,value)
    WHERE ARRAY(SELECT value FROM jsonb_array_elements_text(COALESCE(t.choices#>ARRAY['resolved_choices',e.key],'[]')) ORDER BY value) IS DISTINCT FROM ARRAY(SELECT value FROM jsonb_array_elements_text(e.value) ORDER BY value))
    AND t.choices->>'background'='acolyte' AND (SELECT count(*)=1 FROM refs WHERE kind='background' AND slug='acolyte')
    AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['rage','barbarian-unarmored-defense','reckless-attack','danger-sense']||CASE WHEN t.level=3 THEN ARRAY['frenzy'] ELSE '{}'::text[] END) expected_slug
      WHERE (SELECT count(*) FROM refs WHERE kind='feature' AND slug=expected_slug)<>1),
  'finiteSubclassAndHpRecords',t.level IN (2,3) AND (b.choice->>'level')::integer=t.level
    AND CASE WHEN t.level=3 THEN b.subclass_slug='berserker' AND b.subclass_data->>'parent_class'='barbarian'
      AND b.subclass_context='{"source":"subclass","class":"barbarian"}'::jsonb AND b.subclass_choice_source='builder:subclass:'||b.id::text
      AND (SELECT count(*)=1 FROM refs WHERE kind='subclass') ELSE b.subclass_ref_id IS NULL AND NOT EXISTS(SELECT 1 FROM refs WHERE kind='subclass') END
    AND t.choices#>'{hp_rolls,barbarian-2,method}' IN ('"average"'::jsonb,'"rolled"'::jsonb)
    AND (t.choices#>>'{hp_rolls,barbarian-2,value}')::integer BETWEEN 1 AND 12
    AND (t.choices#>>'{hp_rolls,barbarian-2,method}'<>'average' OR t.choices#>'{hp_rolls,barbarian-2,value}'='7'::jsonb)
    AND CASE WHEN t.level=3 THEN t.choices#>'{hp_rolls,barbarian-3}'='{"method":"average","value":7}'::jsonb ELSE NOT(COALESCE(t.choices->'hp_rolls','{}')?'barbarian-3') END,
  'maximumHpMatchesIndependent2014',calc.native_max_hp=calc.independent_max_hp,
  'drawsBindOriginalReceipts',(SELECT count(*)<=1 FROM private.character_builder_hp_draws_v1 WHERE character_id=t.id)
    AND NOT EXISTS(SELECT 1 FROM private.character_builder_hp_draws_v1 d WHERE d.character_id=t.id AND (d.actor_id<>t.user_id OR d.occurrence_id<>b.id OR d.die<>12 OR d.level<>2 OR d.value NOT BETWEEN 1 AND 12
      OR NOT EXISTS(SELECT 1 FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id AND r.actor_id=d.actor_id AND r.operation_id=d.operation_id
        AND r.request->>'command'='save_hp_roll' AND r.request#>>'{fields,class_slug}'='barbarian' AND r.request#>>'{fields,level}'='2'
        AND r.request#>>'{fields,method}'='rolled' AND r.request#>'{fields,value}'='null'::jsonb
        AND r.receipt#>'{saved_choices,hp_rolls,barbarian-2}'=jsonb_build_object('method','rolled','value',d.value))))
    AND (t.choices#>>'{hp_rolls,barbarian-2,method}'<>'rolled' OR EXISTS(SELECT 1 FROM private.character_builder_hp_draws_v1 d WHERE d.character_id=t.id AND d.value=(t.choices#>>'{hp_rolls,barbarian-2,value}')::integer)),
  'oneNativeStartingAward',(SELECT count(*)=1 FROM awards) AND t.choices#>'{starting_equipment,confirmed}'='true'::jsonb AND t.state#>'{currency,gp}'='15'::jsonb
    AND (SELECT count(*)=1 FROM private.character_builder_receipts_v1 WHERE character_id=t.id AND request->>'command'='award_equipment')
    AND NOT EXISTS(SELECT 1 FROM awards award WHERE award.canonical_intent#>>'{sources,class,id}' IS DISTINCT FROM b.content_id::text OR award.canonical_intent#>>'{sources,class,version}' IS DISTINCT FROM b.content_version::text
      OR NOT EXISTS(SELECT 1 FROM refs bg WHERE bg.kind='background' AND bg.slug='acolyte' AND award.canonical_intent#>>'{sources,background,id}'=bg.content_id::text AND award.canonical_intent#>>'{sources,background,version}'=bg.content_version::text)),
  'inventoryFromAcceptedAward',(SELECT count(*)>0 FROM inventory) AND NOT EXISTS(SELECT 1 FROM inventory i WHERE NOT i.exact_version OR i.kind NOT IN ('item','weapon','armor') OR i.system_id<>t.system_id OR i.source<>'srd' OR i.scope<>'platform' OR i.owner_id IS NOT NULL OR i.quantity<=0
    OR NOT EXISTS(SELECT 1 FROM awards award WHERE award.id=i.starting_grant_id AND award.status='awarded' AND award.completed_at IS NOT NULL AND award.receipt->>'grant_id'=award.id::text
      AND award.receipt->'inventory_ids' @> jsonb_build_array(i.id) AND jsonb_array_length(award.receipt->'inventory_ids')=(SELECT count(*) FROM inventory)
      AND (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(award.receipt->'inventory_ids'))=(SELECT count(*) FROM inventory)
      AND EXISTS(SELECT 1 FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id AND r.actor_id=t.user_id AND r.request->>'command'='award_equipment' AND r.request->'canonical_intent'=award.canonical_intent AND r.receipt=award.receipt))),
  'noSpellsOrEquippedGear',NOT EXISTS(SELECT 1 FROM inventory WHERE equipped) AND NOT EXISTS(SELECT 1 FROM public.character_spells WHERE character_id=t.id) AND NOT EXISTS(SELECT 1 FROM public.character_spell_grants WHERE character_id=t.id),
  'detailsConfirmed',t.choices->'details_confirmed'='true'::jsonb AND t.choices->>'alignment'='Neutral Good' AND t.name LIKE 'Hill Toughness %',
  'ownedReceiptsAndHistory',EXISTS(SELECT 1 FROM private.character_builder_progression_history_v1 WHERE character_id=t.id AND command='set_class_level')
    AND NOT EXISTS(SELECT 1 FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id AND (r.actor_id IS DISTINCT FROM t.user_id OR (r.request->>'command'<>'award_equipment' AND
      (r.receipt->>'actor_id' IS DISTINCT FROM t.user_id::text OR r.receipt->>'character_id' IS DISTINCT FROM t.id::text OR r.receipt->>'operation_id' IS DISTINCT FROM r.operation_id::text OR r.receipt->>'command' IS DISTINCT FROM r.request->>'command'))))
    AND NOT EXISTS(SELECT 1 FROM private.character_builder_progression_history_v1 h WHERE h.character_id=t.id AND (h.actor_id IS DISTINCT FROM t.user_id OR h.receipt->'saved_choices' IS DISTINCT FROM h.after_parent->'choices'
      OR h.receipt->>'action_revision' IS DISTINCT FROM h.after_parent->>'action_revision' OR NOT EXISTS(SELECT 1 FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id AND r.actor_id=h.actor_id AND r.operation_id=h.operation_id AND r.request->>'command'=h.command AND r.receipt=h.receipt))),
  'fiveOrderBijections',(SELECT count(*)=5 AND bool_and(bijection) FROM order_checks),
  'currentParentAndRoleOrder',(SELECT producer_revision=t.action_revision FROM private.character_projection_order_v1 WHERE character_id=t.id)
    AND p.roles->>'action_revision'=t.action_revision::text AND p.roles->'source_order'=(SELECT to_jsonb(o)->'pins' FROM private.character_projection_order_v1 o WHERE o.character_id=t.id),
  'boundariesClosed',(SELECT count(*)=0 FROM private.character_builder_capabilities_v1) AND (SELECT count(*)=0 FROM private.character_parent_admissions_v1)
    AND (SELECT count(*)=13 FROM private.character_writer_readiness_v1) AND NOT EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    AND NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled) AND NOT EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
    AND NOT has_schema_privilege('service_role','private','USAGE')
 )) FROM target t JOIN proof p ON p.id=t.id JOIN calculations calc ON calc.id=t.id JOIN fingerprints f ON f.id=t.id CROSS JOIN selected_class b CROSS JOIN ancestry a;
ROLLBACK;
