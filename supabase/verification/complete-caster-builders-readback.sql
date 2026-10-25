-- Independent level-three 2014 caster expectations after real application saves.
-- Read-only administrative evidence; not a substitute for Auth/browser proof.
-- psql -v character_id=<public UUID> -f this-file.sql
BEGIN READ ONLY;
WITH target AS (
 SELECT * FROM public.characters WHERE id=:'character_id'::uuid
), proof AS (
 SELECT t.id,private.builder_protected_graph_v1(t.id) AS graph,
   private.builder_original_occurrence_v1(t.id) AS original,
   private.builder_class_roles_v1(t.id) AS roles,
   private.character_ability_scores(t.id,NULL,NULL,NULL) AS effective_scores
 FROM target t
), refs AS (
 SELECT r.*,v.slug_snapshot AS slug,v.content_type_snapshot AS kind,v.system_id_snapshot AS system_id,
   v.source_snapshot AS source,v.scope_snapshot AS scope,v.owner_id_snapshot AS owner_id,
   v.data_snapshot AS data,v.content_id IS NOT NULL AS exact_version,md5(to_jsonb(v)::text) AS snapshot_fingerprint
 FROM public.character_content_refs r JOIN target t ON t.id=r.character_id
 LEFT JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
), selected_class AS (
 SELECT c.value AS choice,c.value->>'slug' AS slug,(c.value->>'level')::integer AS class_level,
   o.*,root.content_id AS pinned_class_id,root.content_version AS pinned_class_version,
   sub.slug AS subclass_slug
 FROM target t CROSS JOIN LATERAL jsonb_array_elements(t.choices->'classes') c(value)
 JOIN private.character_class_occurrences_v1 o ON o.character_id=t.id AND o.id=(c.value->>'occurrence_id')::uuid
 JOIN refs root ON root.id=o.controller_ref_id AND root.kind='class'
 LEFT JOIN refs sub ON sub.id=o.subclass_ref_id AND sub.kind='subclass'
), oracles(class_slug,subclass_slug,hit_die,max_hp,cantrips,ordinary,prepared,fixed,bonus,required_features,expected_choices,base_scores,effective_scores) AS (
 VALUES
 ('bard','lore',8,24,
  ARRAY['mage-hand','vicious-mockery'],ARRAY['animal-friendship','charm-person','cure-wounds','detect-magic','healing-word','shatter'],ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[],
  ARRAY['bardic-inspiration-d6','jack-of-all-trades','bard-expertise-1','bonus-proficiencies','cutting-words'],
  '{"bard-proficiency-choice-0":["skill-arcana","skill-perception","skill-stealth"],"bard-proficiency-choice-1":["drum","flute","lute"],"bard-expertise-1":["skill-perception","skill-stealth"],"bonus-proficiencies":["skill-athletics","skill-medicine","skill-nature"]}'::jsonb,
  '{"strength":8,"dexterity":13,"constitution":14,"intelligence":12,"wisdom":10,"charisma":15}'::jsonb,
  '{"strength":9,"dexterity":14,"constitution":15,"intelligence":13,"wisdom":11,"charisma":16}'::jsonb),
 ('cleric','life',8,24,
  ARRAY['guidance','resistance','sacred-flame'],ARRAY['bane','command','detect-magic','guiding-bolt','healing-word','hold-person'],
  ARRAY['bane','command','detect-magic','guiding-bolt','healing-word','hold-person'],ARRAY['bless','cure-wounds','lesser-restoration','spiritual-weapon'],ARRAY[]::text[],
  ARRAY['disciple-of-life','channel-divinity-preserve-life'],
  '{"cleric-proficiency-choice-0":["skill-history","skill-medicine"]}'::jsonb,
  '{"strength":10,"dexterity":13,"constitution":14,"intelligence":12,"wisdom":15,"charisma":8}'::jsonb,
  '{"strength":11,"dexterity":14,"constitution":15,"intelligence":13,"wisdom":16,"charisma":9}'::jsonb),
 ('druid','land',8,24,
  ARRAY['produce-flame','shillelagh'],ARRAY['animal-friendship','entangle','faerie-fire','goodberry','healing-word','flaming-sphere'],
  ARRAY['animal-friendship','entangle','faerie-fire','goodberry','healing-word','flaming-sphere'],ARRAY['barkskin','spider-climb'],ARRAY['guidance'],
  ARRAY['druidic','natural-recovery','circle-of-the-land-forest'],
  '{"druid-proficiency-choice-0":["skill-nature","skill-perception"],"circle-of-the-land":["circle-of-the-land-forest"]}'::jsonb,
  '{"strength":10,"dexterity":13,"constitution":14,"intelligence":12,"wisdom":15,"charisma":8}'::jsonb,
  '{"strength":11,"dexterity":14,"constitution":15,"intelligence":13,"wisdom":16,"charisma":9}'::jsonb),
 ('sorcerer','draconic',6,23,
  ARRAY['acid-splash','fire-bolt','light','ray-of-frost'],ARRAY['burning-hands','charm-person','magic-missile','scorching-ray'],ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[],
  ARRAY['dragon-ancestor-gold---fire-damage','draconic-resilience','metamagic-quickened-spell','metamagic-subtle-spell'],
  '{"sorcerer-proficiency-choice-0":["skill-arcana","skill-persuasion"],"dragon-ancestor":["dragon-ancestor-gold---fire-damage"],"metamagic-1":["metamagic-quickened-spell","metamagic-subtle-spell"]}'::jsonb,
  '{"strength":8,"dexterity":13,"constitution":14,"intelligence":12,"wisdom":10,"charisma":15}'::jsonb,
  '{"strength":9,"dexterity":14,"constitution":15,"intelligence":13,"wisdom":11,"charisma":16}'::jsonb),
 ('warlock','fiend',8,24,
  ARRAY['eldritch-blast','mage-hand'],ARRAY['charm-person','hellish-rebuke','burning-hands','scorching-ray'],ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[],
  ARRAY['dark-ones-blessing','pact-of-the-blade','eldritch-invocation-agonizing-blast','eldritch-invocation-repelling-blast'],
  '{"warlock-proficiency-choice-0":["skill-arcana","skill-history"],"pact-boon":["pact-of-the-blade"],"eldritch-invocations":["eldritch-invocation-agonizing-blast","eldritch-invocation-repelling-blast"]}'::jsonb,
  '{"strength":8,"dexterity":13,"constitution":14,"intelligence":12,"wisdom":10,"charisma":15}'::jsonb,
  '{"strength":9,"dexterity":14,"constitution":15,"intelligence":13,"wisdom":11,"charisma":16}'::jsonb),
 ('wizard','evocation',6,20,
  ARRAY['fire-bolt','light','mage-hand'],ARRAY['burning-hands','charm-person','comprehend-languages','detect-magic','feather-fall','identify','magic-missile','shield','misty-step','scorching-ray'],
  ARRAY['burning-hands','charm-person','magic-missile','shield','misty-step','scorching-ray'],ARRAY[]::text[],ARRAY[]::text[],
  ARRAY['arcane-recovery','evocation-savant','sculpt-spells'],
  '{"wizard-proficiency-choice-0":["skill-arcana","skill-history"]}'::jsonb,
  '{"strength":8,"dexterity":13,"constitution":14,"intelligence":15,"wisdom":12,"charisma":10}'::jsonb,
  '{"strength":9,"dexterity":14,"constitution":15,"intelligence":16,"wisdom":13,"charisma":11}'::jsonb),
 ('paladin','devotion',10,28,
  ARRAY[]::text[],ARRAY['bless','cure-wounds','divine-favor','shield-of-faith'],ARRAY['bless','cure-wounds','divine-favor','shield-of-faith'],
  ARRAY['protection-from-evil-and-good','sanctuary'],ARRAY[]::text[],
  ARRAY['divine-smite','divine-health','channel-divinity-sacred-weapon','channel-divinity-turn-the-unholy','fighting-style-defense'],
  '{"paladin-proficiency-choice-0":["skill-athletics","skill-persuasion"],"paladin-fighting-style":["fighting-style-defense"]}'::jsonb,
  '{"strength":14,"dexterity":12,"constitution":13,"intelligence":8,"wisdom":10,"charisma":15}'::jsonb,
  '{"strength":15,"dexterity":13,"constitution":14,"intelligence":9,"wisdom":11,"charisma":16}'::jsonb),
 ('ranger','hunter',10,28,
  ARRAY[]::text[],ARRAY['animal-friendship','hunters-mark','longstrider'],ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[],
  ARRAY['favored-enemy-1-type','natural-explorer-1-terrain-type','hunters-prey-colossus-slayer','primeval-awareness','ranger-fighting-style-archery'],
  '{"ranger-proficiency-choice-0":["skill-athletics","skill-perception","skill-survival"],"natural-explorer-1-terrain-type":["forest"],"ranger-fighting-style":["ranger-fighting-style-archery"],"hunters-prey":["hunters-prey-colossus-slayer"]}'::jsonb,
  '{"strength":12,"dexterity":15,"constitution":13,"intelligence":10,"wisdom":14,"charisma":8}'::jsonb,
  '{"strength":13,"dexterity":16,"constitution":14,"intelligence":11,"wisdom":15,"charisma":9}'::jsonb)
), expected AS (
 SELECT e.*,e.expected_choices||'{"human-language-choice":["dwarvish"],"acolyte-language-choice":["celestial","elvish"]}'::jsonb AS all_expected_choices
 FROM oracles e JOIN selected_class c ON c.slug=e.class_slug
), spells AS (
 SELECT s.*,v.slug_snapshot AS slug,(v.data_snapshot->>'level')::integer AS spell_level,
   v.content_id IS NOT NULL AND v.content_type_snapshot='spell' AND v.system_id_snapshot=t.system_id AS exact_version
 FROM public.character_spells s JOIN target t ON t.id=s.character_id
 LEFT JOIN public.content_versions v ON v.content_id=s.content_id AND v.version=s.content_version
), awards AS (
 SELECT g.* FROM public.character_starting_grants g JOIN target t ON t.id=g.character_id WHERE g.grant_kind='starting_equipment'
), domains AS (
 SELECT 'pins' AS domain,COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[]) AS ids FROM refs r
 UNION ALL SELECT 'inventory',COALESCE(array_agg(i.id ORDER BY i.id),'{}'::uuid[]) FROM public.character_inventory i JOIN target t ON t.id=i.character_id
 UNION ALL SELECT 'spells',COALESCE(array_agg(s.id ORDER BY s.id),'{}'::uuid[]) FROM spells s
 UNION ALL SELECT 'feature_grants',COALESCE(array_agg(g.id ORDER BY g.id),'{}'::uuid[]) FROM public.character_feature_grants g JOIN target t ON t.id=g.character_id
 UNION ALL SELECT 'spell_grants',COALESCE(array_agg(g.id ORDER BY g.id),'{}'::uuid[]) FROM public.character_spell_grants g JOIN target t ON t.id=g.character_id
), order_checks AS (
 SELECT d.domain,cardinality(d.ids)=jsonb_array_length(to_jsonb(o)->d.domain)
   AND d.ids=ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(to_jsonb(o)->d.domain) ORDER BY value::uuid)
   AND cardinality(d.ids)=(SELECT count(DISTINCT value) FROM jsonb_array_elements_text(to_jsonb(o)->d.domain)) AS bijection
 FROM domains d CROSS JOIN target t JOIN private.character_projection_order_v1 o ON o.character_id=t.id
), observed AS (
 SELECT t.user_id,t.level,t.action_revision,t.base_stats,t.choices,t.state,c.*,e.class_slug AS oracle_class,
   p.effective_scores AS actual_scores,p.roles,p.original,md5(p.graph::text) AS graph_fingerprint,
   private.builder_multiclass_max_hp_v1(t.id,t.choices,p.graph) AS native_max_hp,
   e.max_hp AS expected_max_hp,e.hit_die,e.cantrips,e.ordinary,e.prepared,e.fixed,e.bonus,e.required_features,e.all_expected_choices,
   e.base_scores AS expected_base_scores,e.effective_scores AS expected_effective_scores
 FROM target t CROSS JOIN proof p JOIN selected_class c ON c.character_id=t.id JOIN expected e ON e.class_slug=c.slug
)
SELECT jsonb_build_object(
 'evidenceKind','read_only_after_complete_actual_app_caster_builder','characterId',t.id,'classSlug',o.slug,
 'actorId',t.user_id,'level',t.level,'actionRevision',t.action_revision::text,'graphFingerprint',o.graph_fingerprint,
 'independent2014Expected',jsonb_build_object('cantrips',to_jsonb(o.cantrips),'ordinarySpells',to_jsonb(o.ordinary),
   'ordinaryPrepared',to_jsonb(o.prepared),'fixedGrants',to_jsonb(o.fixed),'bonusCantrips',to_jsonb(o.bonus),
   'baseScores',o.expected_base_scores,'effectiveScores',o.expected_effective_scores,'maximumHp',o.expected_max_hp),
 'observed',jsonb_build_object('baseScores',t.base_stats,'effectiveScores',o.actual_scores,'maximumHp',o.native_max_hp,
   'gp',t.state#>'{currency,gp}','choices',t.choices,'originalOccurrence',o.original,'roles',o.roles),
 'pins',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'slug',slug,'contentId',content_id,'version',content_version,
   'featureGrantId',feature_grant_id,'choiceSource',choice_source,'snapshotFingerprint',snapshot_fingerprint) ORDER BY kind,slug,id) FROM refs),'[]'),
 'spells',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'slug',slug,'source',source,'version',content_version,
   'known',is_known,'prepared',is_prepared,'alwaysPrepared',always_prepared,'book',in_spellbook,'custom',custom_data) ORDER BY source,slug) FROM spells),'[]'),
 'checks',jsonb_build_object(
   'oneExpectedCharacterAndClass',(SELECT count(*)=1 FROM target) AND (SELECT count(*)=1 FROM selected_class)
     AND (SELECT count(*)=1 FROM expected) AND t.level=3 AND o.class_level=3 AND o.lifecycle='accepted',
   'exactOriginalProvenance',o.id=(o.original->>'id')::uuid AND o.controller_ref_id=(o.original->>'controller_ref_id')::uuid
     AND o.content_id=o.pinned_class_id AND o.content_version=o.pinned_class_version
     AND (SELECT count(*)=1 FROM private.character_class_commands_v1 WHERE character_id=t.id),
   'expectedSubclass',o.subclass_slug=(SELECT subclass_slug FROM expected) AND (SELECT count(*)=1 FROM refs WHERE kind='subclass'),
   'allPinnedVersionsExact',(SELECT COALESCE(bool_and(exact_version AND system_id=t.system_id AND source='srd' AND scope='platform' AND owner_id IS NULL),false) FROM refs),
   'humanAcolyteStandardArray',t.choices->>'race'='human' AND NOT (t.choices ? 'subrace') AND t.choices->>'background'='acolyte'
     AND t.choices->>'ability_method'='standard_array' AND t.base_stats=o.expected_base_scores AND o.actual_scores=o.expected_effective_scores,
   'allExpectedChoicesExact',NOT EXISTS(SELECT 1 FROM jsonb_each(o.all_expected_choices) e(key,value) WHERE
     ARRAY(SELECT value FROM jsonb_array_elements_text(COALESCE(t.choices#>ARRAY['resolved_choices',e.key],'[]')) ORDER BY value)
       IS DISTINCT FROM ARRAY(SELECT value FROM jsonb_array_elements_text(e.value) ORDER BY value)),
   'allEarnedRequiredFeaturesPresent',NOT EXISTS(SELECT 1 FROM unnest(o.required_features) expected_slug WHERE
     (SELECT count(*) FROM refs WHERE kind='feature' AND slug=expected_slug)<>1),
   'ordinaryCantripsExact',ARRAY(SELECT slug FROM spells WHERE source='selection' AND spell_level=0 ORDER BY slug)
     =ARRAY(SELECT value FROM unnest(o.cantrips) value ORDER BY value),
   'ordinaryLevelledSpellsExact',ARRAY(SELECT slug FROM spells WHERE source='selection' AND spell_level>0 ORDER BY slug)
     =ARRAY(SELECT value FROM unnest(o.ordinary) value ORDER BY value),
   'ordinaryPreparationExact',ARRAY(SELECT slug FROM spells WHERE source='selection' AND spell_level>0 AND is_prepared ORDER BY slug)
     =ARRAY(SELECT value FROM unnest(o.prepared) value ORDER BY value),
   'fixedGrantsExact',ARRAY(SELECT slug FROM spells WHERE source='feature' ORDER BY slug)=ARRAY(SELECT value FROM unnest(o.fixed) value ORDER BY value)
     AND NOT EXISTS(SELECT 1 FROM spells WHERE source='feature' AND (NOT always_prepared OR NOT is_prepared)),
   'bonusCantripsExact',ARRAY(SELECT slug FROM spells WHERE source='bonus' ORDER BY slug)=ARRAY(SELECT value FROM unnest(o.bonus) value ORDER BY value),
   'noExtraSpellRows',(SELECT count(*) FROM spells)=cardinality(o.cantrips)+cardinality(o.ordinary)+cardinality(o.fixed)+cardinality(o.bonus),
   'ordinaryRowsOwned',NOT EXISTS(SELECT 1 FROM spells WHERE source='selection' AND (NOT exact_version OR NOT is_known OR always_prepared
     OR spell_grant_id IS NOT NULL OR class_slug<>o.slug OR custom_data->>'builder_class_controller_ref_id' IS DISTINCT FROM o.controller_ref_id::text)),
   'spellbookExact',CASE WHEN o.slug='wizard' THEN
       (SELECT count(*)=10 AND bool_and(in_spellbook) FROM spells WHERE source='selection' AND spell_level>0)
       AND (SELECT count(*)=8 FROM spells WHERE source='selection' AND spell_level=1)
       AND (SELECT count(*)=2 FROM spells WHERE source='selection' AND spell_level=2)
       AND NOT EXISTS(SELECT 1 FROM spells WHERE spell_level=0 AND in_spellbook)
     ELSE NOT EXISTS(SELECT 1 FROM spells WHERE in_spellbook) END,
   'twoExplicitAverageHpRecords',(SELECT count(*)=2 FROM jsonb_object_keys(COALESCE(t.choices->'hp_rolls','{}')))
     AND t.choices#>ARRAY['hp_rolls',o.slug||'-2']=jsonb_build_object('method','average','value',o.hit_die/2+1)
     AND t.choices#>ARRAY['hp_rolls',o.slug||'-3']=jsonb_build_object('method','average','value',o.hit_die/2+1)
     AND NOT EXISTS(SELECT 1 FROM private.character_builder_hp_draws_v1 WHERE character_id=t.id),
   'maximumHpMatches2014',o.native_max_hp=o.expected_max_hp,
   'rangerFavoredEnemyExact',o.slug<>'ranger' OR t.choices#>'{favored_enemies,favored-enemy-1-type}'=
     '{"selection":{"mode":"type","enemy_type":"beasts"},"language":null}'::jsonb,
   'oneEquipmentAward',(SELECT count(*)=1 FROM awards) AND t.choices#>'{starting_equipment,confirmed}'='true'::jsonb
     AND t.state#>'{currency,gp}'='15'::jsonb,
   'inventoryAwardProvenance',(SELECT count(*)>0 FROM public.character_inventory WHERE character_id=t.id)
     AND NOT EXISTS(SELECT 1 FROM public.character_inventory i WHERE i.character_id=t.id AND NOT EXISTS(SELECT 1 FROM awards a
       WHERE a.id=i.starting_grant_id AND a.receipt->'inventory_ids' @> jsonb_build_array(i.id))),
   'detailsConfirmed',t.choices->'details_confirmed'='true'::jsonb AND t.choices->>'alignment'='Neutral Good' AND t.name LIKE 'Complete SRD %',
   'ownedOrdinaryReceipts',(SELECT count(*)>0 FROM private.character_builder_receipts_v1 WHERE character_id=t.id)
     AND NOT EXISTS(SELECT 1 FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id AND
       (r.actor_id<>t.user_id OR r.receipt->>'actor_id'<>t.user_id::text OR r.receipt->>'character_id'<>t.id::text
         OR r.receipt->>'operation_id'<>r.operation_id::text OR r.receipt->>'command'<>r.request->>'command')),
   'fiveOrderBijections',(SELECT count(*)=5 AND bool_and(bijection) FROM order_checks),
   'currentParentAndRoleOrder',(SELECT producer_revision=t.action_revision FROM private.character_projection_order_v1 WHERE character_id=t.id)
     AND o.roles->>'action_revision'=t.action_revision::text AND o.roles->'source_order'=(SELECT to_jsonb(p)->'pins' FROM private.character_projection_order_v1 p WHERE p.character_id=t.id),
   'boundariesClosed',(SELECT count(*)=0 FROM private.character_builder_capabilities_v1)
     AND (SELECT count(*)=13 FROM private.character_writer_readiness_v1) AND NOT EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
     AND NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled) AND NOT EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
     AND NOT has_schema_privilege('service_role','private','USAGE')
 )) FROM target t JOIN observed o ON o.character_id=t.id;
ROLLBACK;
