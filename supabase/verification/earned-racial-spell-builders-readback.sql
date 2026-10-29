-- A6 read-only proof after actual builder actions. No fixture/state writes.
-- psql -v character_id=<UUID> -v control_id=<old UUID> -v stage=complete|trimmed-five|wizard-one|below-three|restored-four
--       -v spell_phase=baseline|concurrent -v root_version=1|2 -f this-file.sql
-- current_catalog=1 is only for a fresh current-v1 control and target; default 0 preserves historical publication checks.
\if :{?current_catalog}
\else
\set current_catalog 0
\endif
BEGIN READ ONLY;
WITH stage_oracles(stage,bard_level,wizard_level,total_level,max_hp,bard_known,book_count,prepared_count) AS (
 VALUES ('complete',3,2,5,31,6,8,4),('trimmed-five',3,2,5,31,6,6,3),('wizard-one',3,1,4,26,6,6,3),
   ('below-three',1,1,2,14,4,6,3),('restored-four',3,1,4,26,6,6,3)
), expected AS (
 SELECT s.*,:'spell_phase'::text AS phase,:'root_version'::integer AS root_version,:'current_catalog'::integer AS current_catalog,
  '{"version":1,"source_trait":"infernal-legacy","spellcasting_ability":"charisma","grants":[{"character_level":3,"spell":"hellish-rebuke","spell_level":1,"cast_level":2},{"character_level":5,"spell":"darkness","spell_level":2,"cast_level":2}]}'::jsonb AS declaration
 FROM stage_oracles s WHERE stage=:'stage'
), target AS (SELECT * FROM public.characters WHERE id=:'character_id'::uuid), proof AS (
 SELECT t.id,private.builder_protected_graph_v1(t.id) AS graph,private.builder_original_occurrence_v1(t.id) AS original,
  private.builder_class_roles_v1(t.id) AS roles,private.character_ability_scores(t.id,NULL,NULL,NULL) AS scores FROM target t
), refs AS (
 SELECT r.*,v.slug_snapshot AS slug,v.content_type_snapshot AS kind,v.data_snapshot AS data,v.effects_snapshot AS effects,
  v.content_id IS NOT NULL AS exact_version,v.system_id_snapshot AS system_id,v.source_snapshot AS source,v.scope_snapshot AS scope,
  v.owner_id_snapshot AS owner_id,v.created_at AS snapshot_created,md5(to_jsonb(v)::text) AS snapshot_fingerprint
 FROM public.character_content_refs r JOIN target t ON t.id=r.character_id LEFT JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
), classes AS (
 SELECT c.value AS choice,c.value->>'slug' AS slug,(c.value->>'level')::integer AS own_level,o.*,root.content_id AS pinned_content_id,
  root.content_version AS pinned_version,root.data AS data,to_jsonb(o) AS occurrence,sub.id AS subclass_pin_id,sub.slug AS subclass_slug,sub.data AS subclass_data,
  sub.context AS subclass_context,sub.choice_source AS subclass_choice_source
 FROM target t CROSS JOIN LATERAL jsonb_array_elements(t.choices->'classes') c(value)
 JOIN private.character_class_occurrences_v1 o ON o.character_id=t.id AND o.id=(c.value->>'occurrence_id')::uuid
 JOIN refs root ON root.id=o.controller_ref_id AND root.kind='class' LEFT JOIN refs sub ON sub.id=o.subclass_ref_id AND sub.kind='subclass'
), ancestry AS (
 SELECT root.id AS race_pin_id,root.content_id AS root_content_id,root.content_version AS root_version,root.data AS root_data,
  root.snapshot_created AS root_created,trait.id AS trait_pin_id,trait.content_id AS trait_content_id,trait.content_version AS trait_version,
  trait.data AS trait_data,trait.effects AS trait_effects,trait.snapshot_created AS trait_created
 FROM refs root CROSS JOIN refs trait WHERE root.kind='race' AND root.slug='tiefling' AND trait.kind='trait' AND trait.slug='infernal-legacy'
), spells AS (
 SELECT s.*,v.slug_snapshot AS slug,(v.data_snapshot->>'level')::integer AS spell_level,v.data_snapshot AS data,
  md5(to_jsonb(v)::text) AS snapshot_fingerprint,v.content_id IS NOT NULL AND v.content_type_snapshot='spell'
    AND v.system_id_snapshot=t.system_id AND v.source_snapshot='srd' AND v.scope_snapshot='platform' AND v.owner_id_snapshot IS NULL AS exact_version
 FROM public.character_spells s JOIN target t ON t.id=s.character_id LEFT JOIN public.content_versions v ON v.content_id=s.content_id AND v.version=s.content_version
), ordinary_oracles AS (
 SELECT 'bard'::text AS slug,'["minor-illusion","vicious-mockery"]'::jsonb AS cantrips,
  (CASE WHEN e.phase='concurrent' THEN '["animal-friendship","cure-wounds","detect-magic","healing-word"]'::jsonb ELSE '["charm-person","cure-wounds","detect-magic","healing-word"]'::jsonb END)
    ||CASE WHEN e.bard_level=3 THEN '["hold-person","shatter"]'::jsonb ELSE '[]'::jsonb END AS ordinary,'[]'::jsonb AS prepared
 FROM expected e UNION ALL
 SELECT 'wizard','["fire-bolt","light","mage-hand"]',
  '["burning-hands","charm-person","comprehend-languages","detect-magic","magic-missile","shield"]'::jsonb
    ||CASE WHEN e.book_count=8 THEN CASE WHEN e.phase='concurrent' THEN '["feather-fall","alarm"]'::jsonb ELSE '["feather-fall","identify"]'::jsonb END ELSE '[]'::jsonb END,
  '["burning-hands","magic-missile","shield"]'::jsonb||CASE WHEN e.prepared_count=4 THEN '["charm-person"]'::jsonb ELSE '[]'::jsonb END FROM expected e
), wanted_dependencies(kind,slug,spell_level,character_level) AS (
 VALUES ('trait','infernal-legacy',NULL::integer,0),('spell','thaumaturgy',0,0),('spell','hellish-rebuke',1,3),('spell','darkness',2,5)
), dependencies AS (
 -- Read-only equivalent of the existing immutable dependency resolver's SRD
 -- candidate/order/access predicate. Do not call its FOR SHARE helper inside a
 -- READ ONLY receipt. Legacy cantrip cutoff is its trait; earned tiers use ROOT.
 SELECT wanted.*,candidate.content_id,candidate.version,candidate.name_snapshot,candidate.owner_id_snapshot AS owner_id
 FROM wanted_dependencies wanted CROSS JOIN target t CROSS JOIN ancestry a
 LEFT JOIN LATERAL (SELECT v.* FROM public.content_versions v WHERE v.system_id_snapshot=t.system_id
   AND v.content_type_snapshot=wanted.kind AND v.slug_snapshot=wanted.slug AND v.source_snapshot='srd' AND v.scope_snapshot='platform'
   AND v.created_at<=CASE WHEN wanted.slug='thaumaturgy' THEN a.trait_created ELSE a.root_created END
   AND private.character_can_access_content_version(t.id,v.content_id,v.version)
   ORDER BY (v.owner_id_snapshot IS NULL) DESC,(v.scope_snapshot='platform') DESC,v.created_at DESC,v.version DESC,v.content_id LIMIT 1) candidate ON true
), racial_expected AS (
 SELECT d.*,jsonb_build_object('builder_source_pin_id',a.trait_pin_id::text,'builder_root_ref_id',a.race_pin_id::text,
   'builder_choice_id',NULL,'spellcasting_ability','charisma')||CASE WHEN d.character_level>0 THEN
   jsonb_build_object('builder_earned_racial_spell',jsonb_build_object('contract_version',1,'grant_key','infernal-legacy:'||d.character_level||':'||d.slug,
     'character_level',d.character_level,'spell_level',d.spell_level,'cast_level',2)) ELSE '{}'::jsonb END AS metadata
 FROM dependencies d CROSS JOIN ancestry a CROSS JOIN expected e WHERE d.kind='spell'
   AND (d.character_level=0 OR (e.current_catalog=1 OR e.root_version=2) AND d.character_level<=e.total_level)
), inventory AS (
 SELECT i.*,v.slug_snapshot AS slug,v.content_type_snapshot AS kind,v.system_id_snapshot AS system_id,v.source_snapshot AS source,
  v.scope_snapshot AS scope,v.owner_id_snapshot AS owner_id,v.content_id IS NOT NULL AS exact_version,md5(to_jsonb(v)::text) AS snapshot_fingerprint
 FROM public.character_inventory i JOIN target t ON t.id=i.character_id LEFT JOIN public.content_versions v ON v.content_id=i.content_id AND v.version=i.content_version
), awards AS (SELECT a.* FROM public.character_starting_grants a JOIN target t ON t.id=a.character_id WHERE a.grant_kind='starting_equipment'), domains AS (
 SELECT 'pins' AS domain,COALESCE(array_agg(id ORDER BY id),'{}'::uuid[]) AS ids FROM refs
 UNION ALL SELECT 'inventory',COALESCE(array_agg(id ORDER BY id),'{}'::uuid[]) FROM inventory UNION ALL SELECT 'spells',COALESCE(array_agg(id ORDER BY id),'{}'::uuid[]) FROM spells
 UNION ALL SELECT 'feature_grants',COALESCE(array_agg(g.id ORDER BY g.id),'{}'::uuid[]) FROM public.character_feature_grants g JOIN target t ON t.id=g.character_id
 UNION ALL SELECT 'spell_grants',COALESCE(array_agg(g.id ORDER BY g.id),'{}'::uuid[]) FROM public.character_spell_grants g JOIN target t ON t.id=g.character_id
), order_checks AS (
 SELECT d.domain,cardinality(d.ids)=jsonb_array_length(to_jsonb(o)->d.domain)
  AND d.ids=ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(to_jsonb(o)->d.domain) ORDER BY value::uuid)
  AND cardinality(d.ids)=(SELECT count(DISTINCT value) FROM jsonb_array_elements_text(to_jsonb(o)->d.domain)) AS bijection
 FROM domains d CROSS JOIN target t JOIN private.character_projection_order_v1 o ON o.character_id=t.id
), old_control AS (
 SELECT c.id,c.user_id,r.content_version AS root_version,v.data_snapshot AS root_data,private.builder_multiclass_max_hp_v1(c.id,c.choices,private.builder_protected_graph_v1(c.id)) AS maximum_hp,
  ARRAY(SELECT v.slug_snapshot FROM public.character_spells s JOIN public.content_versions v ON v.content_id=s.content_id AND v.version=s.content_version WHERE s.character_id=c.id AND s.source='racial_trait' ORDER BY v.slug_snapshot) AS racial_slugs,
  md5(jsonb_build_array(to_jsonb(c),private.builder_progression_full_graph_v1(c.id),(SELECT to_jsonb(o) FROM private.character_projection_order_v1 o WHERE o.character_id=c.id),
    (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.character_starting_grants a WHERE a.character_id=c.id),
    (SELECT jsonb_agg(to_jsonb(receipt) ORDER BY receipt.operation_id) FROM private.character_builder_receipts_v1 receipt WHERE receipt.character_id=c.id),
    (SELECT jsonb_agg(to_jsonb(h) ORDER BY h.operation_id) FROM private.character_builder_progression_history_v1 h WHERE h.character_id=c.id),
    (SELECT jsonb_agg(jsonb_build_array(pin.id,to_jsonb(v)) ORDER BY pin.id) FROM public.character_content_refs pin JOIN public.content_versions v ON v.content_id=pin.content_id AND v.version=pin.content_version WHERE pin.character_id=c.id))::text) AS fingerprint
 FROM public.characters c JOIN public.character_content_refs r ON r.character_id=c.id JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version AND v.content_type_snapshot='race' AND v.slug_snapshot='tiefling'
 WHERE c.id=:'control_id'::uuid
), observed AS (
 SELECT t.id,private.builder_multiclass_max_hp_v1(t.id,t.choices,p.graph) AS maximum_hp,
  md5(jsonb_build_array(to_jsonb(t),private.builder_progression_full_graph_v1(t.id),(SELECT to_jsonb(o) FROM private.character_projection_order_v1 o WHERE o.character_id=t.id),
    (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM awards a),(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.operation_id) FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id),
    (SELECT jsonb_agg(to_jsonb(h) ORDER BY h.operation_id) FROM private.character_builder_progression_history_v1 h WHERE h.character_id=t.id))::text) AS fingerprint FROM target t JOIN proof p ON p.id=t.id
)
SELECT jsonb_build_object(
 'evidenceKind','read_only_after_actual_A6_earned_racial_app_actions','characterId',t.id,'actorId',t.user_id,'level',t.level,'actionRevision',t.action_revision::text,
 'originalOccurrenceId',p.original->>'id','maximumHp',o.maximum_hp,'hasStoredCurrentHp',t.state?'current_hp','choices',t.choices,'state',t.state,
 'classRoots',(SELECT jsonb_agg(jsonb_build_object('slug',slug,'level',own_level,'occurrenceId',id,'controllerRefId',controller_ref_id,'contentId',content_id,'version',content_version,'subclassPinId',subclass_pin_id) ORDER BY slug) FROM classes),
 'rootVersion',a.root_version,'racePinId',a.race_pin_id,'traitPinId',a.trait_pin_id,
 'pins',(SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'slug',slug,'contentId',content_id,'version',content_version,'context',context,'choiceSource',choice_source,'featureGrantId',feature_grant_id,'snapshotFingerprint',snapshot_fingerprint) ORDER BY kind,slug,id) FROM refs),
 'inventory',(SELECT jsonb_agg(jsonb_build_object('id',id,'slug',slug,'contentId',content_id,'version',content_version,'equipped',equipped,'quantity',quantity,'startingGrantId',starting_grant_id,'snapshotFingerprint',snapshot_fingerprint) ORDER BY id) FROM inventory),
 'spells',(SELECT jsonb_agg(jsonb_build_object('id',id,'slug',slug,'classSlug',class_slug,'contentId',content_id,'version',content_version,'level',spell_level,'source',source,'known',is_known,'prepared',is_prepared,'alwaysPrepared',always_prepared,'book',in_spellbook,'grantId',spell_grant_id,'custom',custom_data,'createdAt',created_at,'snapshotFingerprint',snapshot_fingerprint) ORDER BY class_slug,slug,id) FROM spells),
 'receipts',(SELECT jsonb_agg(jsonb_build_object('operationId',operation_id,'actorId',actor_id,'characterId',character_id,'command',request->>'command','actionRevision',receipt->>'action_revision','fields',request->'fields','request',request,'receipt',receipt) ORDER BY (receipt->>'action_revision')::bigint,operation_id) FROM private.character_builder_receipts_v1 WHERE character_id=t.id),
 'historyCount',(SELECT count(*) FROM private.character_builder_progression_history_v1 WHERE character_id=t.id),'completeFingerprint',o.fingerprint,
 'oldControl',(SELECT jsonb_build_object('characterId',id,'actorId',user_id,'rootVersion',root_version,'rootDeclaration',root_data->'earned_racial_spells','maximumHp',maximum_hp,'racialSlugs',racial_slugs,'fingerprint',fingerprint) FROM old_control),
 'catalog',jsonb_build_object('definitions',(SELECT count(*) FROM public.content_definitions),'versions',(SELECT count(*) FROM public.content_versions),
  'tiefling',(SELECT jsonb_build_object('contentId',id,'version',version) FROM public.content_definitions WHERE content_type='race' AND slug='tiefling'),
  'rootSnapshots',(SELECT jsonb_agg(jsonb_build_object('version',version,'fingerprint',md5(to_jsonb(v)::text),'declaration',data_snapshot->'earned_racial_spells') ORDER BY version) FROM public.content_versions v WHERE content_type_snapshot='race' AND slug_snapshot='tiefling'),
  'traitSnapshots',(SELECT jsonb_agg(jsonb_build_object('version',version,'fingerprint',md5(to_jsonb(v)::text)) ORDER BY version) FROM public.content_versions v WHERE content_type_snapshot='trait' AND slug_snapshot='infernal-legacy')),
 'checks',jsonb_build_object(
  'oneExpectedCharacterAndOldControl',(SELECT count(*)=1 FROM target) AND (SELECT count(*)=1 FROM expected) AND e.phase IN ('baseline','concurrent') AND e.root_version IN (1,2) AND t.level=e.total_level
    AND e.current_catalog IN (0,1) AND (e.current_catalog=0 OR (e.root_version=1 AND (SELECT count(*)=1535 FROM public.content_definitions) AND (SELECT count(*)=1535 FROM public.content_versions)))
    AND (SELECT count(*)=1 AND bool_and(user_id=t.user_id AND root_version=1 AND maximum_hp=31
      AND racial_slugs=CASE WHEN e.current_catalog=1 THEN ARRAY['darkness','hellish-rebuke','thaumaturgy'] ELSE ARRAY['thaumaturgy'] END
      AND CASE WHEN e.current_catalog=1 THEN root_data->'earned_racial_spells'=e.declaration ELSE NOT(root_data?'earned_racial_spells') END) FROM old_control),
  'exactOriginalAndSecondaryRoles',(SELECT count(*)=2 FROM classes) AND jsonb_array_length(t.choices->'classes')=2 AND (SELECT count(*)=1 FROM private.character_class_commands_v1 WHERE character_id=t.id)
    AND (SELECT count(*)=1 FROM private.character_builder_class_acquisitions_v1 WHERE character_id=t.id) AND p.roles->>'status'='available' AND p.roles->>'character_id'=t.id::text AND p.roles->>'original_occurrence_id'=p.original->>'id'
    AND EXISTS(SELECT 1 FROM classes WHERE slug='bard' AND id=(p.original->>'id')::uuid AND controller_ref_id=(p.original->>'controller_ref_id')::uuid)
    AND jsonb_array_length(p.roles->'class_sources')=2 AND NOT EXISTS(SELECT 1 FROM classes c WHERE c.lifecycle<>CASE WHEN c.id=(p.original->>'id')::uuid THEN 'provisional' ELSE 'accepted' END
      OR (c.id=(p.original->>'id')::uuid AND c.occurrence IS DISTINCT FROM p.original)
      OR c.content_id<>c.pinned_content_id OR c.content_version<>c.pinned_version OR NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements(p.roles->'class_sources') role(value) WHERE role.value->>'occurrence_id'=c.id::text AND role.value->>'controller_ref_id'=c.controller_ref_id::text AND role.value->>'content_id'=c.content_id::text AND role.value->>'content_version'=c.content_version::text
      AND role.value->>'role'=CASE WHEN c.slug='bard' THEN 'original' ELSE 'secondary' END AND CASE WHEN c.slug='bard' THEN ARRAY(SELECT value FROM jsonb_array_elements_text(role.value#>'{evaluation_data,saving_throws}') ORDER BY value)=ARRAY['charisma','dexterity']
        ELSE role.value#>'{evaluation_data,saving_throws}'='[]'::jsonb AND role.value#>'{evaluation_data,equipment}'='""'::jsonb END)),
  'exactClassAndSubclassPins',(SELECT jsonb_object_agg(slug,own_level) FROM classes)=jsonb_build_object('bard',e.bard_level,'wizard',e.wizard_level)
    AND (SELECT count(*) FROM refs WHERE kind='subclass')=CASE WHEN e.bard_level=3 THEN 1 ELSE 0 END+CASE WHEN e.wizard_level=2 THEN 1 ELSE 0 END
    AND NOT EXISTS(SELECT 1 FROM classes c WHERE CASE WHEN c.slug='bard' AND e.bard_level<3 OR c.slug='wizard' AND e.wizard_level<2 THEN c.subclass_ref_id IS NOT NULL
      ELSE c.subclass_slug IS DISTINCT FROM CASE c.slug WHEN 'bard' THEN 'lore' ELSE 'evocation' END OR c.subclass_data->>'parent_class' IS DISTINCT FROM c.slug
        OR c.subclass_context IS DISTINCT FROM jsonb_build_object('source','subclass','class',c.slug) OR c.subclass_choice_source IS DISTINCT FROM 'builder:subclass:'||c.id::text END),
  'allFrozenSrdPinsExact',(SELECT COALESCE(bool_and(exact_version AND system_id=t.system_id AND source='srd' AND scope='platform' AND owner_id IS NULL),false) FROM refs),
  'allFrozenSpellRowsExact',(SELECT COALESCE(bool_and(exact_version),false) FROM spells),
  'exactTieflingInfernalSource',(SELECT count(*)=1 FROM ancestry) AND a.root_version=e.root_version AND t.choices->>'race'='tiefling' AND NOT(t.choices?'subrace')
    AND (SELECT count(*)=1 FROM refs WHERE kind='race') AND NOT EXISTS(SELECT 1 FROM refs WHERE kind='subrace') AND ARRAY(SELECT slug FROM refs WHERE kind='trait' ORDER BY slug)=ARRAY['darkvision','hellish-resistance','infernal-legacy']
    AND EXISTS(SELECT 1 FROM refs root WHERE id=a.race_pin_id AND context='{"source":"race"}'::jsonb AND choice_source IS NULL AND feature_grant_id IS NULL
      AND ARRAY(SELECT value FROM jsonb_array_elements_text(root.data->'traits') ORDER BY value)=ARRAY['darkvision','hellish-resistance','infernal-legacy'])
    AND NOT EXISTS(SELECT 1 FROM refs trait WHERE trait.kind='trait' AND (trait.context IS DISTINCT FROM jsonb_build_object('source','racial_trait','root_controller_ref_id',a.race_pin_id::text) OR trait.choice_source IS DISTINCT FROM 'builder:racial-trait:'||trait.slug OR trait.feature_grant_id IS NOT NULL))
    AND a.trait_data->'races'='["tiefling"]'::jsonb AND COALESCE(a.trait_data->'subraces','[]')='[]'::jsonb
    AND a.trait_effects @> '[{"type":"grant","stat":"spell","value":"thaumaturgy"},{"type":"grant","stat":"spellcasting_ability","value":"charisma"}]'::jsonb
    AND (SELECT count(*)=1 FROM jsonb_array_elements(a.trait_effects) effect(value) WHERE effect.value->>'type'='grant' AND effect.value->>'stat'='spell')
    AND (SELECT count(*)=1 FROM jsonb_array_elements(a.trait_effects) effect(value) WHERE effect.value->>'type'='grant' AND effect.value->>'stat'='spellcasting_ability')
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a.trait_effects) effect(value) WHERE effect.value->>'type'='grant' AND effect.value->>'stat' IN ('spell','spellcasting_ability')
      AND (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(effect.value) keys(key)) IS DISTINCT FROM ARRAY['stat','type','value'])
    AND EXISTS(SELECT 1 FROM dependencies WHERE kind='trait' AND content_id=a.trait_content_id AND version=a.trait_version AND owner_id IS NULL)
    AND CASE WHEN e.current_catalog=0 AND e.root_version=1 THEN NOT(a.root_data?'earned_racial_spells') ELSE a.root_data->'earned_racial_spells'=e.declaration END
    AND (e.current_catalog=0 OR EXISTS(SELECT 1 FROM public.content_definitions d WHERE d.id=a.root_content_id AND d.version=1 AND NOT d.is_retired
      AND d.system_id=t.system_id AND d.content_type='race' AND d.slug='tiefling' AND d.data=a.root_data
      AND d.data->'earned_racial_spells'=e.declaration)),
  'standardArrayAndScores',t.choices->>'ability_method'='standard_array' AND t.base_stats='{"strength":8,"dexterity":13,"constitution":12,"intelligence":14,"wisdom":10,"charisma":15}'::jsonb
    AND p.scores='{"strength":8,"dexterity":13,"constitution":12,"intelligence":15,"wisdom":10,"charisma":17}'::jsonb,
  'finiteClassChoicesAndFeatures',t.choices->>'background'='acolyte' AND (SELECT count(*)=1 FROM refs WHERE kind='background' AND slug='acolyte')
    AND NOT EXISTS(SELECT 1 FROM jsonb_each('{"bard-proficiency-choice-0":["skill-arcana","skill-perception","skill-stealth"],"bard-proficiency-choice-1":["drum","flute","lute"],"acolyte-language-choice":["celestial","elvish"]}'::jsonb) item(key,value)
      WHERE ARRAY(SELECT value FROM jsonb_array_elements_text(COALESCE(t.choices#>ARRAY['resolved_choices',item.key],'[]')) ORDER BY value) IS DISTINCT FROM ARRAY(SELECT value FROM jsonb_array_elements_text(item.value) ORDER BY value))
    AND (e.bard_level<3 OR (t.choices#>'{resolved_choices,bard-expertise-1}'='["skill-perception","skill-stealth"]'::jsonb
      AND ARRAY(SELECT value FROM jsonb_array_elements_text(t.choices#>'{resolved_choices,bonus-proficiencies}') ORDER BY value)=ARRAY['skill-athletics','skill-medicine','skill-nature']))
    AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['bardic-inspiration-d6']||CASE WHEN e.bard_level=3 THEN ARRAY['jack-of-all-trades','bard-expertise-1','bonus-proficiencies','cutting-words'] ELSE '{}'::text[] END
      ||CASE WHEN e.wizard_level=2 THEN ARRAY['arcane-recovery','evocation-savant','sculpt-spells'] ELSE ARRAY['arcane-recovery'] END) wanted WHERE (SELECT count(*) FROM refs WHERE kind='feature' AND slug=wanted)<>1),
  'ordinaryBudgetsAndRowsExact',NOT EXISTS(SELECT 1 FROM ordinary_oracles owner WHERE ARRAY(SELECT slug FROM spells WHERE source='selection' AND class_slug=owner.slug AND spell_level=0 ORDER BY slug) IS DISTINCT FROM ARRAY(SELECT value FROM jsonb_array_elements_text(owner.cantrips) ORDER BY value)
    OR ARRAY(SELECT slug FROM spells WHERE source='selection' AND class_slug=owner.slug AND spell_level>0 ORDER BY slug) IS DISTINCT FROM ARRAY(SELECT value FROM jsonb_array_elements_text(owner.ordinary) ORDER BY value)
    OR ARRAY(SELECT slug FROM spells WHERE source='selection' AND class_slug=owner.slug AND spell_level>0 AND is_prepared ORDER BY slug) IS DISTINCT FROM ARRAY(SELECT value FROM jsonb_array_elements_text(owner.prepared) ORDER BY value))
    AND NOT EXISTS(SELECT 1 FROM spells WHERE source='selection' AND (class_slug NOT IN ('bard','wizard') OR spell_level>CASE WHEN class_slug='bard' AND e.bard_level=3 THEN 2 ELSE 1 END OR in_spellbook IS DISTINCT FROM (class_slug='wizard' AND spell_level>0))),
  'ordinaryRowsHaveExactController',NOT EXISTS(SELECT 1 FROM spells s WHERE s.source='selection' AND (NOT s.exact_version OR NOT s.is_known OR s.always_prepared OR s.spell_grant_id IS NOT NULL
    OR (s.spell_level=0 AND NOT s.is_prepared) OR NOT EXISTS(SELECT 1 FROM classes c WHERE c.slug=s.class_slug AND s.custom_data=jsonb_build_object('builder_class_controller_ref_id',c.controller_ref_id::text)))),
  'earnedRacialRowsExact',NOT EXISTS(SELECT 1 FROM racial_expected wanted WHERE wanted.content_id IS NULL OR wanted.owner_id IS NOT NULL OR (SELECT count(*) FROM spells s WHERE s.source='racial_trait' AND s.class_slug='race:tiefling'
      AND s.content_id=wanted.content_id AND s.content_version=wanted.version AND s.name=wanted.name_snapshot AND s.spell_level=wanted.spell_level AND s.custom_data=wanted.metadata
      AND s.exact_version AND s.is_known AND s.is_prepared AND s.always_prepared AND NOT s.in_spellbook AND s.spell_grant_id IS NULL)<>1)
    AND NOT EXISTS(SELECT 1 FROM spells s WHERE s.source='racial_trait' AND NOT EXISTS(SELECT 1 FROM racial_expected wanted WHERE s.class_slug='race:tiefling' AND s.content_id=wanted.content_id AND s.content_version=wanted.version
      AND s.name=wanted.name_snapshot AND s.spell_level=wanted.spell_level AND s.custom_data=wanted.metadata AND s.exact_version AND s.is_known AND s.is_prepared AND s.always_prepared AND NOT s.in_spellbook AND s.spell_grant_id IS NULL)),
  'exactCantripAndNoOtherGrants',(SELECT count(*) FROM spells WHERE source='racial_trait')=(SELECT count(*) FROM racial_expected) AND NOT EXISTS(SELECT 1 FROM spells WHERE source NOT IN ('selection','racial_trait'))
    AND NOT EXISTS(SELECT 1 FROM public.character_spell_grants WHERE character_id=t.id) AND COALESCE(t.choices->'bonus_spells','{}')='{}'::jsonb,
  'independentOwnCastingInputs',NOT EXISTS(SELECT 1 FROM classes c WHERE c.data#>>'{spellcasting,type}'<>'full' OR c.data#>>'{spellcasting,ability}'<>CASE c.slug WHEN 'bard' THEN 'charisma' ELSE 'intelligence' END
    OR (SELECT count(*) FROM jsonb_array_elements(c.data->'levels') level_entry(value) WHERE (value->>'level')::integer=c.own_level)<>1
    OR (SELECT value#>'{spellcasting,spell_slots}' FROM jsonb_array_elements(c.data->'levels') level_entry(value) WHERE (value->>'level')::integer=c.own_level)
      IS DISTINCT FROM CASE WHEN c.slug='bard' AND e.bard_level=3 THEN '[4,2,0,0,0,0,0,0,0]'::jsonb WHEN c.slug='wizard' AND e.wizard_level=2 THEN '[3,0,0,0,0,0,0,0,0]'::jsonb ELSE '[2,0,0,0,0,0,0,0,0]'::jsonb END
    OR (c.data#>>ARRAY['spellcastingKnown','cantrips',(c.own_level-1)::text])::integer<>CASE c.slug WHEN 'bard' THEN 2 ELSE 3 END
    OR CASE c.slug WHEN 'bard' THEN (c.data#>>ARRAY['spellcastingKnown','spells',(c.own_level-1)::text])::integer<>e.bard_known ELSE NOT(c.data#>'{spellcastingKnown,prepared}'='true'::jsonb) END),
  'explicitAverageHpAndMaximum',o.maximum_hp=e.max_hp AND NOT(t.state?'current_hp') AND NOT EXISTS(SELECT 1 FROM private.character_builder_hp_draws_v1 WHERE character_id=t.id)
    AND t.choices->'hp_rolls'=('{"wizard-1":{"method":"average","value":4}}'::jsonb||CASE WHEN e.wizard_level=2 THEN '{"wizard-2":{"method":"average","value":4}}'::jsonb ELSE '{}'::jsonb END
      ||CASE WHEN e.bard_level=3 THEN '{"bard-2":{"method":"average","value":5},"bard-3":{"method":"average","value":5}}'::jsonb ELSE '{}'::jsonb END),
  'oneOriginalNativeAward',(SELECT count(*)=1 FROM awards) AND t.choices#>'{starting_equipment,confirmed}'='true'::jsonb AND t.state#>'{currency,gp}'='15'::jsonb AND (SELECT count(*)=1 FROM private.character_builder_receipts_v1 WHERE character_id=t.id AND request->>'command'='award_equipment')
    AND NOT EXISTS(SELECT 1 FROM awards award WHERE NOT EXISTS(SELECT 1 FROM classes c WHERE c.slug='bard' AND c.id=(p.original->>'id')::uuid AND award.canonical_intent#>>'{sources,class,id}'=c.content_id::text AND award.canonical_intent#>>'{sources,class,version}'=c.content_version::text)
      OR NOT EXISTS(SELECT 1 FROM refs bg WHERE bg.kind='background' AND bg.slug='acolyte' AND award.canonical_intent#>>'{sources,background,id}'=bg.content_id::text AND award.canonical_intent#>>'{sources,background,version}'=bg.content_version::text)),
  'inventoryFromAcceptedAward',(SELECT count(*)>0 FROM inventory) AND NOT EXISTS(SELECT 1 FROM inventory i WHERE i.equipped OR i.quantity<=0
    OR (CASE WHEN i.content_id IS NULL THEN i.content_version IS NULL
      ELSE i.exact_version AND i.kind IN ('item','weapon','armor') AND i.kind=i.content_type
        AND i.system_id=t.system_id AND i.source='srd' AND i.scope='platform' AND i.owner_id IS NULL END) IS DISTINCT FROM true
    OR NOT EXISTS(SELECT 1 FROM public.character_starting_grants a WHERE a.character_id=t.id AND a.id=i.starting_grant_id
      AND a.status='awarded' AND a.grant_kind='starting_equipment' AND a.completed_at IS NOT NULL
      AND a.receipt->>'grant_id'=a.id::text AND a.receipt->'plan'=a.canonical_intent->'plan'
      AND jsonb_array_length(a.receipt->'inventory_ids')=(SELECT count(*) FROM inventory)
      AND jsonb_array_length(a.receipt#>'{plan,items}')=(SELECT count(*) FROM inventory)
      AND (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(a.receipt->'inventory_ids'))=(SELECT count(*) FROM inventory)
      -- Award insertion appends each created row ID alongside the same plan
      -- item. Match that exact position, including named noncatalog items.
      AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(a.receipt->'inventory_ids') WITH ORDINALITY line(id,position)
        WHERE line.id=i.id::text AND a.receipt#>ARRAY['plan','items',(line.position-1)::text]=jsonb_build_object(
          'content_id',i.content_id,'content_version',i.content_version,'name',i.name,'content_type',i.content_type,'quantity',i.quantity))
      AND EXISTS(SELECT 1 FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id AND r.actor_id=t.user_id
        AND r.request->>'command'='award_equipment' AND r.request->'canonical_intent'=a.canonical_intent AND r.receipt=a.receipt))),
  'detailsConfirmed',t.choices->'details_confirmed'='true'::jsonb AND t.choices->>'alignment'='Neutral Good' AND t.name LIKE 'Earned A6 %',
  'ownedReceiptsAndHistory',EXISTS(SELECT 1 FROM private.character_builder_progression_history_v1 WHERE character_id=t.id AND command='set_class_level')
    AND NOT EXISTS(SELECT 1 FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id AND (r.actor_id IS DISTINCT FROM t.user_id OR (r.request->>'command'<>'award_equipment' AND
      (r.receipt->>'actor_id' IS DISTINCT FROM t.user_id::text OR r.receipt->>'character_id' IS DISTINCT FROM t.id::text OR r.receipt->>'operation_id' IS DISTINCT FROM r.operation_id::text OR r.receipt->>'command' IS DISTINCT FROM r.request->>'command' OR r.receipt->'fields' IS DISTINCT FROM r.request->'fields'))))
    AND NOT EXISTS(SELECT 1 FROM private.character_builder_progression_history_v1 h WHERE h.character_id=t.id AND (h.actor_id IS DISTINCT FROM t.user_id OR h.receipt->'saved_choices' IS DISTINCT FROM h.after_parent->'choices' OR h.receipt->>'action_revision' IS DISTINCT FROM h.after_parent->>'action_revision'
      OR NOT EXISTS(SELECT 1 FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id AND r.actor_id=h.actor_id AND r.operation_id=h.operation_id AND r.request->>'command'=h.command AND r.receipt=h.receipt))),
  'fiveOrderBijections',(SELECT count(*)=5 AND bool_and(bijection) FROM order_checks),
  'currentParentAndRoleOrder',(SELECT producer_revision=t.action_revision FROM private.character_projection_order_v1 WHERE character_id=t.id) AND p.roles->>'action_revision'=t.action_revision::text AND p.roles->'source_order'=(SELECT to_jsonb(ordering)->'pins' FROM private.character_projection_order_v1 ordering WHERE ordering.character_id=t.id),
  'boundariesClosed',(SELECT count(*)=0 FROM private.character_builder_capabilities_v1) AND (SELECT count(*)=0 FROM private.character_parent_admissions_v1) AND (SELECT count(*)=13 FROM private.character_writer_readiness_v1)
    AND NOT EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready) AND NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled) AND NOT EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) AND NOT has_schema_privilege('service_role','private','USAGE')
 )) FROM target t JOIN proof p ON p.id=t.id JOIN observed o ON o.id=t.id CROSS JOIN expected e CROSS JOIN ancestry a;
ROLLBACK;
