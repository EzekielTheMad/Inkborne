-- A1–A3 independent 2014 martial/ancestry expectations after genuine app saves.
-- Read-only administrative evidence; the companion browser story proves Auth,
-- all six Saved states, passive sheet values, reload and foreign-account 404.
-- psql -v character_id=<public UUID> -v case_id=A1|A2|A3 -f this-file.sql
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
   v.data_snapshot AS data,v.effects_snapshot AS effects,v.content_id IS NOT NULL AS exact_version,
   md5(to_jsonb(v)::text) AS snapshot_fingerprint
 FROM public.character_content_refs r JOIN target t ON t.id=r.character_id
 LEFT JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
), selected_class AS (
 SELECT c.value AS choice,c.value->>'slug' AS slug,(c.value->>'level')::integer AS class_level,
   o.*,root.content_id AS pinned_class_id,root.content_version AS pinned_class_version,sub.slug AS subclass_slug,
   root.data AS class_data,sub.data AS subclass_data
 FROM target t CROSS JOIN LATERAL jsonb_array_elements(t.choices->'classes') c(value)
 JOIN private.character_class_occurrences_v1 o ON o.character_id=t.id AND o.id=(c.value->>'occurrence_id')::uuid
 JOIN refs root ON root.id=o.controller_ref_id AND root.kind='class'
 LEFT JOIN refs sub ON sub.id=o.subclass_ref_id AND sub.kind='subclass'
), oracles(case_id,original_class,expected_classes,race_slug,subrace_slug,total_level,max_hp,armor_class,speed,
 expected_choices,base_scores,effective_scores,required_traits,required_features,hp_records) AS (
 VALUES
 ('A1','rogue','{"rogue":3}'::jsonb,'halfling','lightfoot-halfling',3,24,14,25,
  '{"rogue-proficiency-choice-0":["skill-acrobatics","skill-perception","skill-sleight-of-hand","skill-stealth"],"rogue-expertise-1":["skill-perception","skill-stealth"]}'::jsonb,
  '{"strength":10,"dexterity":15,"constitution":14,"intelligence":12,"wisdom":13,"charisma":8}'::jsonb,
  '{"strength":10,"dexterity":17,"constitution":14,"intelligence":12,"wisdom":13,"charisma":9}'::jsonb,
  ARRAY['brave','halfling-nimbleness','lucky','naturally-stealthy'],
  ARRAY['rogue-expertise-1','sneak-attack','thieves-cant','cunning-action','fast-hands','second-story-work'],
  '{"rogue-2":{"method":"average","value":5},"rogue-3":{"method":"average","value":5}}'::jsonb),
 ('A2','monk','{"monk":3}'::jsonb,'gnome','rock-gnome',3,24,14,35,
  '{"monk-proficiency-choice-0":["skill-acrobatics","skill-stealth"],"monk-proficiency-choice-1":["smiths-tools"]}'::jsonb,
  '{"strength":12,"dexterity":15,"constitution":13,"intelligence":8,"wisdom":14,"charisma":10}'::jsonb,
  '{"strength":12,"dexterity":15,"constitution":14,"intelligence":10,"wisdom":14,"charisma":10}'::jsonb,
  ARRAY['darkvision','gnome-cunning','artificers-lore','tinker'],
  ARRAY['monk-unarmored-defense','martial-arts','ki','flurry-of-blows','patient-defense','step-of-the-wind','unarmored-movement-1','deflect-missiles','open-hand-technique'],
  '{"monk-2":{"method":"average","value":5},"monk-3":{"method":"average","value":5}}'::jsonb),
 ('A3','fighter','{"fighter":1,"rogue":3}'::jsonb,'half-orc',NULL,4,33,13,30,
  '{"fighter-proficiency-choice-0":["skill-athletics","skill-perception"],"fighter-fighting-style":["fighter-fighting-style-dueling"],"rogue-proficiency-choice-0":["skill-stealth"],"rogue-expertise-1":["skill-athletics","thieves-tools"]}'::jsonb,
  '{"strength":15,"dexterity":14,"constitution":13,"intelligence":8,"wisdom":12,"charisma":10}'::jsonb,
  '{"strength":17,"dexterity":14,"constitution":14,"intelligence":8,"wisdom":12,"charisma":10}'::jsonb,
  ARRAY['darkvision','savage-attacks','relentless-endurance','menacing'],
  ARRAY['fighter-fighting-style-dueling','second-wind','rogue-expertise-1','sneak-attack','thieves-cant','cunning-action','fast-hands','second-story-work'],
  '{"rogue-1":{"method":"average","value":5},"rogue-2":{"method":"average","value":5},"rogue-3":{"method":"average","value":5}}'::jsonb)
), expected AS (
 SELECT e.*,e.expected_choices||'{"acolyte-language-choice":["celestial","elvish"]}'::jsonb AS all_expected_choices
 FROM oracles e WHERE e.case_id=:'case_id'
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
 UNION ALL SELECT 'spells',COALESCE(array_agg(s.id ORDER BY s.id),'{}'::uuid[]) FROM public.character_spells s JOIN target t ON t.id=s.character_id
 UNION ALL SELECT 'feature_grants',COALESCE(array_agg(g.id ORDER BY g.id),'{}'::uuid[]) FROM public.character_feature_grants g JOIN target t ON t.id=g.character_id
 UNION ALL SELECT 'spell_grants',COALESCE(array_agg(g.id ORDER BY g.id),'{}'::uuid[]) FROM public.character_spell_grants g JOIN target t ON t.id=g.character_id
), order_checks AS (
 SELECT d.domain,cardinality(d.ids)=jsonb_array_length(to_jsonb(o)->d.domain)
   AND d.ids=ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(to_jsonb(o)->d.domain) ORDER BY value::uuid)
   AND cardinality(d.ids)=(SELECT count(DISTINCT value) FROM jsonb_array_elements_text(to_jsonb(o)->d.domain)) AS bijection
 FROM domains d CROSS JOIN target t JOIN private.character_projection_order_v1 o ON o.character_id=t.id
), observed AS (
 SELECT t.id,t.user_id,t.level,t.action_revision,t.base_stats,t.choices,t.state,e.*,p.original,p.roles,p.effective_scores AS actual_scores,
   md5(p.graph::text) AS graph_fingerprint,private.builder_multiclass_max_hp_v1(t.id,t.choices,p.graph) AS native_max_hp,
   -- Stable complete current source/state fingerprint, captured afresh in every
   -- phase. This is not an imported or reconstructed earlier snapshot.
   md5(to_jsonb(t)::text||p.graph::text||COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id)::text FROM refs r),'[]')
     ||COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id)::text FROM inventory i),'[]')
     ||COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)::text FROM awards a),'[]')
     ||COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.operation_id)::text FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id),'[]')
     ||COALESCE((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.operation_id)::text FROM private.character_builder_progression_history_v1 h WHERE h.character_id=t.id),'[]')) AS complete_fingerprint
 FROM target t CROSS JOIN proof p CROSS JOIN expected e
)
SELECT jsonb_build_object(
 'evidenceKind','read_only_after_complete_actual_app_martial_builder','caseId',o.case_id,'characterId',t.id,'actorId',t.user_id,
 'level',t.level,'actionRevision',t.action_revision::text,'graphFingerprint',o.graph_fingerprint,'completeFingerprint',o.complete_fingerprint,
 'originalOccurrenceId',o.original->>'id',
 'independent2014Expected',jsonb_build_object('maximumHp',o.max_hp,'armorClass',o.armor_class,'speed',o.speed,'baseScores',o.base_scores,'effectiveScores',o.effective_scores),
 'observed',jsonb_build_object('maximumHp',o.native_max_hp,'baseScores',t.base_stats,'effectiveScores',o.actual_scores,
   'roles',o.roles,'choices',t.choices),
 'pins',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'slug',slug,'contentId',content_id,'version',content_version,
   'context',context,'choiceSource',choice_source,'featureGrantId',feature_grant_id,'snapshotFingerprint',snapshot_fingerprint) ORDER BY kind,slug,id) FROM refs),'[]'),
 'inventory',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'slug',slug,'equipped',equipped,'startingGrantId',starting_grant_id,
   'contentId',content_id,'version',content_version,'snapshotFingerprint',snapshot_fingerprint) ORDER BY id) FROM inventory),'[]'),
 'checks',jsonb_build_object(
  'oneExpectedCharacter',(SELECT count(*)=1 FROM target) AND (SELECT count(*)=1 FROM expected) AND t.level=o.total_level,
  'exactOriginalAndSecondaryProvenance',o.roles->>'status'='available' AND o.roles->>'character_id'=t.id::text
    AND o.roles->>'original_occurrence_id'=o.original->>'id'
    AND (SELECT count(*)=1 FROM private.character_class_commands_v1 WHERE character_id=t.id)
    AND (SELECT count(*)=1 FROM selected_class WHERE id=(o.original->>'id')::uuid AND slug=o.original_class
      AND controller_ref_id=(o.original->>'controller_ref_id')::uuid)
    AND (SELECT count(*) FROM private.character_builder_class_acquisitions_v1 WHERE character_id=t.id)=CASE WHEN o.case_id='A3' THEN 1 ELSE 0 END
    AND NOT EXISTS(SELECT 1 FROM selected_class c WHERE c.lifecycle<>'accepted' OR c.content_id<>c.pinned_class_id OR c.content_version<>c.pinned_class_version
      OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(o.roles->'class_sources') r(value) WHERE r.value->>'occurrence_id'=c.id::text
        AND r.value->>'controller_ref_id'=c.controller_ref_id::text AND r.value->>'content_id'=c.content_id::text
        AND r.value->>'content_version'=c.content_version::text
        AND r.value->>'role'=CASE WHEN c.id=(o.original->>'id')::uuid THEN 'original' ELSE 'secondary' END)),
  'expectedClassesAndSubclass',(SELECT jsonb_object_agg(slug,class_level) FROM selected_class)=o.expected_classes
    AND (SELECT count(*) FROM selected_class)=(SELECT count(*) FROM jsonb_object_keys(o.expected_classes))
    AND (SELECT count(*)=1 FROM refs WHERE kind='subclass')
    AND (SELECT count(*)=1 FROM selected_class WHERE slug=CASE WHEN o.case_id='A2' THEN 'monk' ELSE 'rogue' END
      AND class_level=3 AND subclass_slug=CASE WHEN o.case_id='A2' THEN 'open-hand' ELSE 'thief' END
      AND subclass_data->>'parent_class'=slug),
  'allPinnedVersionsExact',(SELECT COALESCE(bool_and(exact_version AND system_id=t.system_id AND source='srd' AND scope='platform' AND owner_id IS NULL),false) FROM refs),
  'exactAncestryAndTraitOwners',t.choices->>'race'=o.race_slug AND t.choices->>'subrace' IS NOT DISTINCT FROM o.subrace_slug
    AND (SELECT count(*)=1 FROM refs WHERE kind='race' AND slug=o.race_slug AND context=jsonb_build_object('source','race') AND feature_grant_id IS NULL)
    AND (SELECT count(*) FROM refs WHERE kind='race')=1
    AND (SELECT count(*) FROM refs WHERE kind='subrace')=CASE WHEN o.subrace_slug IS NULL THEN 0 ELSE 1 END
    AND (o.subrace_slug IS NULL OR EXISTS(SELECT 1 FROM refs WHERE kind='subrace' AND slug=o.subrace_slug AND data->>'parent_race'=o.race_slug
      AND context=jsonb_build_object('source','subrace') AND feature_grant_id IS NULL))
    AND ARRAY(SELECT slug FROM refs WHERE kind='trait' ORDER BY slug)=ARRAY(SELECT value FROM unnest(o.required_traits) value ORDER BY value)
    AND NOT EXISTS(SELECT 1 FROM refs child WHERE child.kind='trait' AND (child.feature_grant_id IS NOT NULL
      OR child.choice_source IS DISTINCT FROM 'builder:racial-trait:'||child.slug
      OR NOT EXISTS(SELECT 1 FROM refs root WHERE root.kind IN ('race','subrace')
        AND child.context=jsonb_build_object('source','racial_trait','root_controller_ref_id',root.id::text)
        AND root.data->'traits' @> jsonb_build_array(child.slug)))),
  'standardArrayAndAncestryScores',t.choices->>'ability_method'='standard_array' AND t.base_stats=o.base_scores AND o.actual_scores=o.effective_scores
    AND t.choices->>'background'='acolyte' AND (SELECT count(*)=1 FROM refs WHERE kind='background' AND slug='acolyte'),
  'allExpectedChoicesExact',NOT EXISTS(SELECT 1 FROM jsonb_each(o.all_expected_choices) e(key,value) WHERE
    ARRAY(SELECT value FROM jsonb_array_elements_text(COALESCE(t.choices#>ARRAY['resolved_choices',e.key],'[]')) ORDER BY value)
      IS DISTINCT FROM ARRAY(SELECT value FROM jsonb_array_elements_text(e.value) ORDER BY value)),
  'allRequiredFeaturesPresent',NOT EXISTS(SELECT 1 FROM unnest(o.required_features) expected_slug WHERE
    (SELECT count(*) FROM refs WHERE kind='feature' AND slug=expected_slug)<>1),
  'roleProficienciesAndExpertise',EXISTS(SELECT 1 FROM jsonb_array_elements(o.roles->'class_sources') original_role(value)
    WHERE original_role.value->>'role'='original' AND original_role.value->>'occurrence_id'=o.original->>'id'
      AND ARRAY(SELECT value FROM jsonb_array_elements_text(original_role.value#>'{evaluation_data,saving_throws}') ORDER BY value)
        =CASE o.case_id WHEN 'A1' THEN ARRAY['dexterity','intelligence'] WHEN 'A2' THEN ARRAY['dexterity','strength'] ELSE ARRAY['constitution','strength'] END)
    AND private.normalize_builder_expertise_v1(t.id,t.choices,(SELECT jsonb_agg(to_jsonb(r))
      FROM public.character_content_refs r WHERE r.character_id=t.id),NULL) IS NOT DISTINCT FROM t.choices
    AND CASE WHEN o.case_id='A3' THEN
    EXISTS(SELECT 1 FROM jsonb_array_elements(o.roles->'class_sources') role_entry(value) JOIN refs r ON r.id=(role_entry.value->>'controller_ref_id')::uuid
      WHERE r.slug='rogue' AND role_entry.value->>'role'='secondary'
      AND role_entry.value#>'{evaluation_data,saving_throws}'='[]'::jsonb AND role_entry.value#>'{evaluation_data,equipment}'='""'::jsonb
      AND role_entry.value#>'{evaluation_data,toolProfs}'='["thieves-tools"]'::jsonb
      AND EXISTS(SELECT 1 FROM jsonb_array_elements(role_entry.value->'evaluation_effects') e(value)
        WHERE e.value->>'choice_id'='rogue-proficiency-choice-0' AND e.value->'choose'='1'::jsonb)
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(role_entry.value->'evaluation_effects') e(value)
        WHERE e.value->>'stat' LIKE 'save_%' OR e.value->>'stat' LIKE 'saving_throw_%'))
    ELSE o.roles#>>'{class_sources,0,role}'='original' END,
  'explicitAverageHpRecords',t.choices->'hp_rolls'=o.hp_records
    AND NOT EXISTS(SELECT 1 FROM private.character_builder_hp_draws_v1 WHERE character_id=t.id),
  'maximumHpMatches2014',o.native_max_hp=o.max_hp,
  'noSpellRows',NOT EXISTS(SELECT 1 FROM public.character_spells WHERE character_id=t.id)
    AND NOT EXISTS(SELECT 1 FROM public.character_spell_grants WHERE character_id=t.id),
  'oneOriginalEquipmentAward',(SELECT count(*)=1 FROM awards) AND t.choices#>'{starting_equipment,confirmed}'='true'::jsonb
    AND t.state#>'{currency,gp}'='15'::jsonb
    AND (SELECT count(*)=1 FROM private.character_builder_receipts_v1 WHERE character_id=t.id AND request->>'command'='award_equipment')
    AND NOT EXISTS(SELECT 1 FROM awards a WHERE NOT EXISTS(SELECT 1 FROM selected_class c
      WHERE c.id=(o.original->>'id')::uuid AND c.slug=o.original_class
        AND a.canonical_intent#>>'{sources,class,id}'=c.content_id::text
        AND a.canonical_intent#>>'{sources,class,version}'=c.content_version::text)
      OR NOT EXISTS(SELECT 1 FROM refs b WHERE b.kind='background' AND b.slug='acolyte'
        AND a.canonical_intent#>>'{sources,background,id}'=b.content_id::text
        AND a.canonical_intent#>>'{sources,background,version}'=b.content_version::text)),
  'inventoryFromAcceptedStartingAward',(SELECT count(*)>0 FROM inventory) AND NOT EXISTS(SELECT 1 FROM inventory i WHERE i.quantity<=0
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
  'detailsConfirmed',t.choices->'details_confirmed'='true'::jsonb AND t.choices->>'alignment'='Neutral Good' AND t.name LIKE 'Complete martial '||o.case_id||' %',
  'ownedOrdinaryReceipts',(SELECT count(*)>0 FROM private.character_builder_receipts_v1 WHERE character_id=t.id)
    AND NOT EXISTS(SELECT 1 FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id AND
      (r.actor_id IS DISTINCT FROM t.user_id OR (r.request->>'command'<>'award_equipment' AND
        (r.receipt->>'actor_id' IS DISTINCT FROM t.user_id::text OR r.receipt->>'character_id' IS DISTINCT FROM t.id::text
          OR r.receipt->>'operation_id' IS DISTINCT FROM r.operation_id::text OR r.receipt->>'command' IS DISTINCT FROM r.request->>'command')))),
  'ownedProgressionHistory',EXISTS(SELECT 1 FROM private.character_builder_progression_history_v1 h
    JOIN private.character_builder_receipts_v1 r ON r.actor_id=h.actor_id AND r.operation_id=h.operation_id AND r.character_id=h.character_id AND r.receipt=h.receipt
    WHERE h.character_id=t.id AND h.actor_id=t.user_id AND h.command='set_class_level' AND r.request->>'command'=h.command
      AND r.request#>>'{fields,class_slug}'=CASE WHEN o.case_id='A2' THEN 'monk' ELSE 'rogue' END
      AND r.request#>'{fields,level}'='3'::jsonb)
    AND NOT EXISTS(SELECT 1 FROM private.character_builder_progression_history_v1 h WHERE h.character_id=t.id
      AND (h.actor_id IS DISTINCT FROM t.user_id OR h.receipt->'saved_choices' IS DISTINCT FROM h.after_parent->'choices'
        OR h.receipt->>'action_revision' IS DISTINCT FROM h.after_parent->>'action_revision'
        OR NOT EXISTS(SELECT 1 FROM private.character_builder_receipts_v1 r WHERE r.actor_id=h.actor_id AND r.operation_id=h.operation_id
          AND r.character_id=h.character_id AND r.request->>'command'=h.command AND r.receipt=h.receipt))),
  'fiveOrderBijections',(SELECT count(*)=5 AND bool_and(bijection) FROM order_checks),
  'currentParentAndRoleOrder',(SELECT producer_revision=t.action_revision FROM private.character_projection_order_v1 WHERE character_id=t.id)
    AND o.roles->>'action_revision'=t.action_revision::text AND o.roles->'source_order'=(SELECT to_jsonb(p)->'pins' FROM private.character_projection_order_v1 p WHERE p.character_id=t.id),
  'boundariesClosed',(SELECT count(*)=0 FROM private.character_builder_capabilities_v1)
    AND (SELECT count(*)=13 FROM private.character_writer_readiness_v1) AND NOT EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    AND NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled) AND NOT EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
    AND NOT has_schema_privilege('service_role','private','USAGE')
 )) FROM target t JOIN observed o ON o.id=t.id;
ROLLBACK;
