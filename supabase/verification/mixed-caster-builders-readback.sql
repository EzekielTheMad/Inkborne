-- A5 fixed 2014 full/half/Pact expectations after genuine UI writes.
-- Read-only evidence; no Auth substitute, fixture DML or ordering waiver.
-- corrected_version=2 is historical; explicit 1 requires the fresh current catalog.
-- psql -v character_id=<UUID> -v paladin_level=1|2 -v spell_phase=baseline|concurrent [-v corrected_version=1|2] -f this-file.sql
\if :{?corrected_version}
\else
\set corrected_version 2
\endif
BEGIN READ ONLY;
WITH expected AS (
 SELECT :'paladin_level'::integer AS paladin_level,:'spell_phase'::text AS phase,:'corrected_version'::integer AS corrected_version
), target AS (
 SELECT * FROM public.characters WHERE id=:'character_id'::uuid
), proof AS (
 SELECT t.id,private.builder_protected_graph_v1(t.id) AS graph,private.builder_original_occurrence_v1(t.id) AS original,
   private.builder_class_roles_v1(t.id) AS roles,private.character_ability_scores(t.id,NULL,NULL,NULL) AS scores FROM target t
), refs AS (
 SELECT r.*,v.content_type_snapshot AS kind,v.slug_snapshot AS slug,v.data_snapshot AS data,v.effects_snapshot AS effects,
   v.content_id IS NOT NULL AS exact_version,v.system_id_snapshot AS system_id,v.source_snapshot AS source,
   v.scope_snapshot AS scope,v.owner_id_snapshot AS owner_id,md5(to_jsonb(v)::text) AS snapshot_fingerprint
 FROM public.character_content_refs r JOIN target t ON t.id=r.character_id
 LEFT JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
), classes AS (
 SELECT c.value AS choice,c.value->>'slug' AS slug,(c.value->>'level')::integer AS own_level,o.*,to_jsonb(o) AS occurrence,
   root.content_id AS pinned_content_id,root.content_version AS pinned_version,root.data AS class_data,
   sub.id AS subclass_pin_id,sub.slug AS subclass_slug,sub.content_version AS subclass_version,sub.data AS subclass_data,
   sub.effects AS subclass_effects,sub.context AS subclass_context,sub.choice_source AS subclass_choice_source
 FROM target t CROSS JOIN LATERAL jsonb_array_elements(t.choices->'classes') c(value)
 JOIN private.character_class_occurrences_v1 o ON o.character_id=t.id AND o.id=(c.value->>'occurrence_id')::uuid
 JOIN refs root ON root.id=o.controller_ref_id AND root.kind='class'
 LEFT JOIN refs sub ON sub.id=o.subclass_ref_id AND sub.kind='subclass'
), own_casting AS (
 SELECT c.*,level_entry.value->'spellcasting' AS own_row,
   COALESCE((c.class_data#>>ARRAY['spellcastingKnown','cantrips',(c.own_level-1)::text])::integer,0) AS cantrips,
   c.class_data#>ARRAY['spellcastingKnown','spells',(c.own_level-1)::text] AS known_limit
 FROM classes c CROSS JOIN LATERAL jsonb_array_elements(c.class_data->'levels') level_entry(value) WHERE (level_entry.value->>'level')::integer=c.own_level
), spells AS (
 SELECT s.*,v.slug_snapshot AS slug,(v.data_snapshot->>'level')::integer AS spell_level,
   v.data_snapshot AS data,v.effects_snapshot AS effects,md5(to_jsonb(v)::text) AS snapshot_fingerprint,
   v.content_id IS NOT NULL AND v.content_type_snapshot='spell' AND v.system_id_snapshot=t.system_id
     AND v.source_snapshot='srd' AND v.scope_snapshot='platform' AND v.owner_id_snapshot IS NULL AS exact_version
 FROM public.character_spells s JOIN target t ON t.id=s.character_id
 LEFT JOIN public.content_versions v ON v.content_id=s.content_id AND v.version=s.content_version
), spell_oracles AS (
 SELECT 'paladin'::text AS slug,'[]'::jsonb AS cantrips,
   CASE WHEN e.paladin_level=2 THEN '["bless","cure-wounds","divine-favor","shield-of-faith"]'::jsonb ELSE '[]'::jsonb END AS ordinary
 FROM expected e
 UNION ALL SELECT 'sorcerer','["acid-splash","fire-bolt","light","ray-of-frost"]',
   CASE WHEN e.phase='baseline' THEN '["magic-missile","shield"]'::jsonb ELSE '["magic-missile","sleep"]'::jsonb END FROM expected e
 UNION ALL SELECT 'warlock','["eldritch-blast","mage-hand"]',
   CASE WHEN e.phase='baseline' THEN '["burning-hands","charm-person","hellish-rebuke","scorching-ray"]'::jsonb ELSE '["burning-hands","hellish-rebuke","scorching-ray","shatter"]'::jsonb END FROM expected e
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
 UNION ALL SELECT 'spells',COALESCE(array_agg(id ORDER BY id),'{}'::uuid[]) FROM spells
 UNION ALL SELECT 'feature_grants',COALESCE(array_agg(g.id ORDER BY g.id),'{}'::uuid[]) FROM public.character_feature_grants g JOIN target t ON t.id=g.character_id
 UNION ALL SELECT 'spell_grants',COALESCE(array_agg(g.id ORDER BY g.id),'{}'::uuid[]) FROM public.character_spell_grants g JOIN target t ON t.id=g.character_id
), order_checks AS (
 SELECT d.domain,cardinality(d.ids)=jsonb_array_length(to_jsonb(o)->d.domain)
   AND d.ids=ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(to_jsonb(o)->d.domain) ORDER BY value::uuid)
   AND cardinality(d.ids)=(SELECT count(DISTINCT value) FROM jsonb_array_elements_text(to_jsonb(o)->d.domain)) AS bijection
 FROM domains d CROSS JOIN target t JOIN private.character_projection_order_v1 o ON o.character_id=t.id
), observed AS (
 SELECT t.id,private.builder_multiclass_max_hp_v1(t.id,t.choices,p.graph) AS native_max_hp,
   md5(jsonb_build_array(to_jsonb(t),private.builder_progression_full_graph_v1(t.id),
     (SELECT to_jsonb(o) FROM private.character_projection_order_v1 o WHERE o.character_id=t.id),
     (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM awards a),
     (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.operation_id) FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id),
     (SELECT jsonb_agg(to_jsonb(h) ORDER BY h.operation_id) FROM private.character_builder_progression_history_v1 h WHERE h.character_id=t.id))::text) AS complete_fingerprint
 FROM target t JOIN proof p ON p.id=t.id
)
SELECT jsonb_build_object(
 'evidenceKind','read_only_after_actual_A5_mixed_caster_app_actions','characterId',t.id,'actorId',t.user_id,'level',t.level,
 'actionRevision',t.action_revision::text,'originalOccurrenceId',p.original->>'id','maximumHp',o.native_max_hp,
 'baseScores',t.base_stats,'effectiveScores',p.scores,'hasStoredCurrentHp',t.state?'current_hp','choices',t.choices,'state',t.state,
 'classRoots',(SELECT jsonb_agg(jsonb_build_object('slug',slug,'level',own_level,'occurrenceId',id,'controllerRefId',controller_ref_id,
   'contentId',content_id,'version',content_version,'subclassPinId',subclass_pin_id,'subclassSlug',subclass_slug) ORDER BY slug) FROM classes),
 'pins',(SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'slug',slug,'contentId',content_id,'version',content_version,
   'context',context,'choiceSource',choice_source,'featureGrantId',feature_grant_id,'snapshotFingerprint',snapshot_fingerprint) ORDER BY kind,slug,id) FROM refs),
 'inventory',(SELECT jsonb_agg(jsonb_build_object('id',id,'slug',slug,'contentId',content_id,'version',content_version,'equipped',equipped,
   'quantity',quantity,'startingGrantId',starting_grant_id,'snapshotFingerprint',snapshot_fingerprint) ORDER BY id) FROM inventory),
 'spells',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'slug',slug,'classSlug',class_slug,'contentId',content_id,'version',content_version,
   'level',spell_level,'source',source,'known',is_known,'prepared',is_prepared,'alwaysPrepared',always_prepared,'book',in_spellbook,
   'grantId',spell_grant_id,'custom',custom_data,'snapshotFingerprint',snapshot_fingerprint) ORDER BY class_slug,slug,id) FROM spells),'[]'),
 'receipts',COALESCE((SELECT jsonb_agg(jsonb_build_object('operationId',operation_id,'actorId',actor_id,'characterId',character_id,
   'command',request->>'command','actionRevision',receipt->>'action_revision','fields',request->'fields','request',request,'receipt',receipt)
   ORDER BY (receipt->>'action_revision')::bigint,operation_id) FROM private.character_builder_receipts_v1 WHERE character_id=t.id),'[]'),
 'historyCount',(SELECT count(*) FROM private.character_builder_progression_history_v1 WHERE character_id=t.id),'completeFingerprint',o.complete_fingerprint,
 'castingInputs',(SELECT jsonb_agg(jsonb_build_object('slug',slug,'ownLevel',own_level,'config',class_data->'spellcasting',
   'ownRow',own_row,'cantrips',cantrips,'knownLimit',known_limit,'prepared',class_data#>'{spellcastingKnown,prepared}') ORDER BY slug) FROM own_casting),
 -- Fixed independent oracle: Paladin2 contributes floor(2/2)=1, Sorcerer1
 -- contributes1, Warlock3 contributes0 regular caster levels; Pact is separate.
 -- Paladin1 instead contributes0. These are not application planner outputs.
 'independentExpectations',jsonb_build_object('hp',CASE WHEN e.paladin_level=2 THEN 48 ELSE 40 END,
   'regularSlots',jsonb_build_object('1',CASE WHEN e.paladin_level=2 THEN 3 ELSE 2 END),'pactSlots',2,'pactLevel',2,'dc',14,'attack',6),
 'checks',jsonb_build_object(
  'oneExpectedCharacter',(SELECT count(*)=1 FROM target) AND e.paladin_level IN (1,2) AND e.phase IN ('baseline','concurrent') AND t.level=e.paladin_level+4
    AND e.corrected_version IN (1,2) AND (e.corrected_version=2 OR ((SELECT count(*)=1535 FROM public.content_definitions) AND (SELECT count(*)=1535 FROM public.content_versions))),
  'exactOriginalAndSecondaryRoles',(SELECT count(*)=3 FROM classes) AND jsonb_array_length(t.choices->'classes')=3
    AND (SELECT count(*)=1 FROM private.character_class_commands_v1 WHERE character_id=t.id)
    AND (SELECT count(*)=2 FROM private.character_builder_class_acquisitions_v1 WHERE character_id=t.id)
    AND EXISTS(SELECT 1 FROM classes c WHERE c.slug='paladin' AND c.id=(p.original->>'id')::uuid AND c.controller_ref_id=(p.original->>'controller_ref_id')::uuid)
    AND p.roles->>'status'='available' AND p.roles->>'character_id'=t.id::text AND p.roles->>'original_occurrence_id'=p.original->>'id'
    AND jsonb_array_length(p.roles->'class_sources')=3
    AND NOT EXISTS(SELECT 1 FROM classes c WHERE c.lifecycle<>CASE WHEN c.id=(p.original->>'id')::uuid THEN 'provisional' ELSE 'accepted' END
      OR (c.id=(p.original->>'id')::uuid AND c.occurrence IS DISTINCT FROM p.original)
      OR c.content_id<>c.pinned_content_id OR c.content_version<>c.pinned_version OR NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements(p.roles->'class_sources') r(value) WHERE r.value->>'occurrence_id'=c.id::text AND r.value->>'controller_ref_id'=c.controller_ref_id::text
      AND r.value->>'content_id'=c.content_id::text AND r.value->>'content_version'=c.content_version::text AND r.value->>'role'=CASE WHEN c.slug='paladin' THEN 'original' ELSE 'secondary' END
      AND CASE WHEN c.slug='paladin' THEN ARRAY(SELECT value FROM jsonb_array_elements_text(r.value#>'{evaluation_data,saving_throws}') ORDER BY value)=ARRAY['charisma','wisdom']
        ELSE r.value#>'{evaluation_data,saving_throws}'='[]'::jsonb AND r.value#>'{evaluation_data,equipment}'='""'::jsonb END)),
  'exactClassAndSubclassPins',(SELECT jsonb_object_agg(slug,own_level) FROM classes)=jsonb_build_object('paladin',e.paladin_level,'sorcerer',1,'warlock',3)
    AND (SELECT count(*)=2 FROM refs WHERE kind='subclass')
    AND EXISTS(SELECT 1 FROM classes c WHERE c.slug='paladin' AND c.subclass_ref_id IS NULL)
    AND NOT EXISTS(SELECT 1 FROM classes c WHERE c.slug IN ('sorcerer','warlock') AND (c.subclass_slug IS DISTINCT FROM CASE WHEN c.slug='sorcerer' THEN 'draconic' ELSE 'fiend' END
      OR c.subclass_data->>'parent_class' IS DISTINCT FROM c.slug OR c.subclass_context IS DISTINCT FROM jsonb_build_object('source','subclass','class',c.slug)
      OR c.subclass_choice_source IS DISTINCT FROM 'builder:subclass:'||c.id::text))
    AND EXISTS(SELECT 1 FROM classes c WHERE c.slug='sorcerer' AND c.subclass_version=e.corrected_version AND c.subclass_data->'hit_points_bonus_per_class_level'='1'::jsonb
      AND c.subclass_effects @> '[{"type":"mechanical","stat":"armor_class","op":"formula","expr":"13 + mod(dexterity)","tag":"ac_formula","condition":{"field":"equipped_armor","op":"eq","value":"none"}}]'::jsonb)
    AND EXISTS(SELECT 1 FROM classes c WHERE c.slug='warlock' AND c.subclass_version=e.corrected_version
      AND c.subclass_data->'spellcastingExpanded'='[{"level":1,"spells":["burning-hands","command"]},{"level":3,"spells":["blindness-deafness","scorching-ray"]},{"level":5,"spells":["fireball","stinking-cloud"]},{"level":7,"spells":["fire-shield","wall-of-fire"]},{"level":9,"spells":["flame-strike","hallow"]}]'::jsonb
      AND NOT(c.subclass_data?'spellcastingExtra'))
    AND (e.corrected_version=2 OR (SELECT count(*)=2 FROM refs r JOIN public.content_definitions d ON d.id=r.content_id
      WHERE r.kind='subclass' AND r.slug IN ('draconic','fiend') AND r.content_version=1 AND d.version=1 AND NOT d.is_retired
        AND d.system_id=t.system_id AND d.content_type='subclass' AND d.slug=r.slug AND d.data=r.data AND d.effects=r.effects)),
  'allFrozenSrdPinsExact',(SELECT COALESCE(bool_and(exact_version AND system_id=t.system_id AND source='srd' AND scope='platform' AND owner_id IS NULL),false) FROM refs),
  'exactGoldAncestryClosure',t.choices->>'race'='dragonborn' AND NOT(t.choices?'subrace') AND (SELECT count(*)=1 FROM refs WHERE kind='race') AND NOT EXISTS(SELECT 1 FROM refs WHERE kind='subrace')
    AND EXISTS(SELECT 1 FROM refs root WHERE root.kind='race' AND root.slug='dragonborn' AND root.context='{"source":"race"}'::jsonb AND root.feature_grant_id IS NULL AND root.choice_source IS NULL
      AND ARRAY(SELECT value FROM jsonb_array_elements_text(root.data->'traits') ORDER BY value)=ARRAY['breath-weapon','damage-resistance','draconic-ancestry']
      AND NOT EXISTS(SELECT 1 FROM refs child WHERE child.kind='trait' AND (child.context IS DISTINCT FROM jsonb_build_object('source','racial_trait','root_controller_ref_id',root.id::text)
        OR child.choice_source IS DISTINCT FROM 'builder:racial-trait:'||child.slug OR child.feature_grant_id IS NOT NULL)))
    AND ARRAY(SELECT slug FROM refs WHERE kind='trait' ORDER BY slug)=ARRAY['breath-weapon','damage-resistance','draconic-ancestry','draconic-ancestry-gold']
    AND t.choices#>'{resolved_choices,draconic-ancestry-trait-choice}'='["draconic-ancestry-gold"]'::jsonb
    AND EXISTS(SELECT 1 FROM refs WHERE kind='trait' AND slug='draconic-ancestry' AND effects @> '[{"type":"choice","choose":1,"grant_type":"trait","choice_id":"draconic-ancestry-trait-choice"}]'::jsonb)
    AND EXISTS(SELECT 1 FROM refs WHERE kind='trait' AND slug='draconic-ancestry-gold' AND data->'races' @> '["dragonborn"]'::jsonb AND effects @> '[{"type":"grant","stat":"dmgres","value":"fire"}]'::jsonb),
  'standardArrayAndScores',t.choices->>'ability_method'='standard_array'
    AND t.base_stats='{"strength":13,"dexterity":10,"constitution":14,"intelligence":8,"wisdom":12,"charisma":15}'::jsonb
    AND p.scores='{"strength":15,"dexterity":10,"constitution":14,"intelligence":8,"wisdom":12,"charisma":16}'::jsonb,
  'finiteClassChoicesAndFeatures',t.choices->>'background'='acolyte' AND (SELECT count(*)=1 FROM refs WHERE kind='background' AND slug='acolyte')
    AND NOT EXISTS(SELECT 1 FROM jsonb_each('{"paladin-proficiency-choice-0":["skill-athletics","skill-persuasion"],"acolyte-language-choice":["celestial","elvish"],"dragon-ancestor":["dragon-ancestor-gold---fire-damage"],"pact-boon":["pact-of-the-blade"],"eldritch-invocations":["eldritch-invocation-agonizing-blast","eldritch-invocation-repelling-blast"]}'::jsonb) item(key,value)
      WHERE ARRAY(SELECT value FROM jsonb_array_elements_text(COALESCE(t.choices#>ARRAY['resolved_choices',item.key],'[]')) ORDER BY value) IS DISTINCT FROM ARRAY(SELECT value FROM jsonb_array_elements_text(item.value) ORDER BY value))
    AND (e.paladin_level=1 OR t.choices#>'{resolved_choices,paladin-fighting-style}'='["fighting-style-dueling"]'::jsonb)
    AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['divine-sense','lay-on-hands','dragon-ancestor-gold---fire-damage','draconic-resilience','dark-ones-blessing','pact-of-the-blade','eldritch-invocation-agonizing-blast','eldritch-invocation-repelling-blast']
      ||CASE WHEN e.paladin_level=2 THEN ARRAY['divine-smite','fighting-style-dueling'] ELSE '{}'::text[] END) wanted WHERE (SELECT count(*) FROM refs WHERE kind='feature' AND slug=wanted)<>1),
  'ordinarySpellsExactByOwner',NOT EXISTS(SELECT 1 FROM spell_oracles expected_owner WHERE
      ARRAY(SELECT slug FROM spells WHERE class_slug=expected_owner.slug AND spell_level=0 ORDER BY slug) IS DISTINCT FROM ARRAY(SELECT value FROM jsonb_array_elements_text(expected_owner.cantrips) ORDER BY value)
      OR ARRAY(SELECT slug FROM spells WHERE class_slug=expected_owner.slug AND spell_level>0 ORDER BY slug) IS DISTINCT FROM ARRAY(SELECT value FROM jsonb_array_elements_text(expected_owner.ordinary) ORDER BY value))
    AND (SELECT count(*) FROM spells)=CASE WHEN e.paladin_level=2 THEN 16 ELSE 12 END
    AND NOT EXISTS(SELECT 1 FROM spells WHERE class_slug NOT IN ('paladin','sorcerer','warlock') OR spell_level>CASE WHEN class_slug='warlock' THEN 2 ELSE 1 END
      OR is_prepared IS DISTINCT FROM (spell_level=0 OR (class_slug='paladin' AND spell_level>0))),
  'ordinaryRowsHaveExactController',NOT EXISTS(SELECT 1 FROM spells s WHERE NOT exact_version OR source<>'selection' OR NOT is_known OR always_prepared OR in_spellbook OR spell_grant_id IS NOT NULL
    OR NOT EXISTS(SELECT 1 FROM classes c WHERE c.slug=s.class_slug AND s.custom_data->>'builder_class_controller_ref_id'=c.controller_ref_id::text)),
  'independentOwnCastingInputs',(SELECT count(*)=3 FROM own_casting) AND NOT EXISTS(SELECT 1 FROM own_casting c WHERE
      c.class_data#>>'{spellcasting,ability}'<>'charisma' OR c.class_data#>>'{spellcasting,type}'<>CASE c.slug WHEN 'paladin' THEN 'half' WHEN 'sorcerer' THEN 'full' ELSE 'pact' END
      OR c.cantrips<>CASE c.slug WHEN 'sorcerer' THEN 4 WHEN 'warlock' THEN 2 ELSE 0 END
      OR c.own_row->'spell_slots' IS DISTINCT FROM CASE c.slug WHEN 'paladin' THEN CASE WHEN e.paladin_level=2 THEN '[2,0,0,0,0,0,0,0,0]'::jsonb ELSE '[0,0,0,0,0,0,0,0,0]'::jsonb END
        WHEN 'sorcerer' THEN '[2,0,0,0,0,0,0,0,0]'::jsonb ELSE '[0,2,0,0,0,0,0,0,0]'::jsonb END
      OR CASE c.slug WHEN 'sorcerer' THEN c.known_limit IS DISTINCT FROM '2'::jsonb WHEN 'warlock' THEN c.known_limit IS DISTINCT FROM '4'::jsonb
        ELSE c.class_data#>'{spellcastingKnown,spells}' IS DISTINCT FROM '"all"'::jsonb END
      OR c.class_data#>'{spellcastingKnown,prepared}' IS DISTINCT FROM to_jsonb(c.slug='paladin')),
  'explicitAverageHpAndMaximum',t.choices->'hp_rolls'=('{"sorcerer-1":{"method":"average","value":4},"warlock-1":{"method":"average","value":5},"warlock-2":{"method":"average","value":5},"warlock-3":{"method":"average","value":5}}'::jsonb
      ||CASE WHEN e.paladin_level=2 THEN '{"paladin-2":{"method":"average","value":6}}'::jsonb ELSE '{}'::jsonb END)
    AND NOT EXISTS(SELECT 1 FROM private.character_builder_hp_draws_v1 WHERE character_id=t.id) AND o.native_max_hp=CASE WHEN e.paladin_level=2 THEN 48 ELSE 40 END
    AND NOT(t.state?'current_hp'),
  'oneOriginalNativeAward',(SELECT count(*)=1 FROM awards) AND t.choices#>'{starting_equipment,confirmed}'='true'::jsonb AND t.state#>'{currency,gp}'='15'::jsonb
    AND (SELECT count(*)=1 FROM private.character_builder_receipts_v1 WHERE character_id=t.id AND request->>'command'='award_equipment')
    AND NOT EXISTS(SELECT 1 FROM awards award WHERE NOT EXISTS(SELECT 1 FROM classes original WHERE original.slug='paladin' AND original.id=(p.original->>'id')::uuid
      AND award.canonical_intent#>>'{sources,class,id}'=original.content_id::text AND award.canonical_intent#>>'{sources,class,version}'=original.content_version::text)
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
  'detailsConfirmed',t.choices->'details_confirmed'='true'::jsonb AND t.choices->>'alignment'='Neutral Good' AND t.name LIKE 'Mixed A5 %',
  'noAutomaticOrBonusSpells',NOT EXISTS(SELECT 1 FROM public.character_spell_grants WHERE character_id=t.id) AND NOT EXISTS(SELECT 1 FROM spells WHERE source<>'selection') AND COALESCE(t.choices->'bonus_spells','{}')='{}'::jsonb,
  'ownedReceiptsAndHistory',EXISTS(SELECT 1 FROM private.character_builder_progression_history_v1 WHERE character_id=t.id AND command='set_class_level')
    AND NOT EXISTS(SELECT 1 FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id AND (r.actor_id IS DISTINCT FROM t.user_id OR (r.request->>'command'<>'award_equipment' AND
      (r.receipt->>'actor_id' IS DISTINCT FROM t.user_id::text OR r.receipt->>'character_id' IS DISTINCT FROM t.id::text OR r.receipt->>'operation_id' IS DISTINCT FROM r.operation_id::text
        OR r.receipt->>'command' IS DISTINCT FROM r.request->>'command' OR r.receipt->'fields' IS DISTINCT FROM r.request->'fields'))))
    AND NOT EXISTS(SELECT 1 FROM private.character_builder_progression_history_v1 h WHERE h.character_id=t.id AND (h.actor_id IS DISTINCT FROM t.user_id OR h.receipt->'saved_choices' IS DISTINCT FROM h.after_parent->'choices'
      OR h.receipt->>'action_revision' IS DISTINCT FROM h.after_parent->>'action_revision' OR NOT EXISTS(SELECT 1 FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id AND r.actor_id=h.actor_id AND r.operation_id=h.operation_id AND r.request->>'command'=h.command AND r.receipt=h.receipt))),
  'fiveOrderBijections',(SELECT count(*)=5 AND bool_and(bijection) FROM order_checks),
  'currentParentAndRoleOrder',(SELECT producer_revision=t.action_revision FROM private.character_projection_order_v1 WHERE character_id=t.id)
    AND p.roles->>'action_revision'=t.action_revision::text AND p.roles->'source_order'=(SELECT to_jsonb(ordering)->'pins' FROM private.character_projection_order_v1 ordering WHERE ordering.character_id=t.id),
  'boundariesClosed',(SELECT count(*)=0 FROM private.character_builder_capabilities_v1) AND (SELECT count(*)=0 FROM private.character_parent_admissions_v1)
    AND (SELECT count(*)=13 FROM private.character_writer_readiness_v1) AND NOT EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    AND NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled) AND NOT EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
    AND NOT has_schema_privilege('service_role','private','USAGE')
 )) FROM target t JOIN proof p ON p.id=t.id JOIN observed o ON o.id=t.id CROSS JOIN expected e;
ROLLBACK;
