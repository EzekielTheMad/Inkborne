-- Read-only native evidence after the authenticated browser workflow.
-- psql -v character_id=<public UUID> -f this-file.sql
BEGIN READ ONLY;
WITH RECURSIVE target AS (
 SELECT * FROM public.characters WHERE id=:'character_id'::uuid
), refs AS (
 SELECT r.*,v.slug_snapshot AS slug,v.content_type_snapshot AS kind,v.data_snapshot AS data,
   v.system_id_snapshot=t.system_id AS same_system
 FROM public.character_content_refs r JOIN target t ON t.id=r.character_id
 JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
), earned_features AS (
 SELECT r.* FROM refs r JOIN public.character_feature_grants g ON g.character_id=r.character_id
   AND g.id=r.feature_grant_id AND g.feature_content_id=r.content_id AND g.feature_version=r.content_version
 CROSS JOIN target t CROSS JOIN LATERAL jsonb_array_elements(t.choices->'classes') c(value)
 JOIN refs controller ON controller.id=g.controller_ref_id
 WHERE r.kind='feature' AND r.data->>'class'=c.value->>'slug' AND g.unlock_level<=(c.value->>'level')::integer
   AND (controller.kind='class' AND controller.slug=c.value->>'slug'
     OR controller.kind='subclass' AND controller.slug=c.value->>'subclass' AND controller.data->>'parent_class'=c.value->>'slug')
 UNION ALL
 SELECT child.* FROM refs child JOIN earned_features parent ON parent.id::text=child.context->>'source_ref_id'
 CROSS JOIN target t
 WHERE child.kind='feature' AND child.choice_source LIKE 'builder:feature-choice:%'
   AND child.context->>'source'='class_feature_choice' AND child.data->'class'=parent.data->'class'
   AND COALESCE(t.choices#>ARRAY['resolved_choices',child.context->>'choice_id'],'[]') @> jsonb_build_array(child.slug)
   AND EXISTS(SELECT 1 FROM public.content_versions v CROSS JOIN LATERAL jsonb_array_elements(v.effects_snapshot) e(value)
     WHERE v.content_id=parent.content_id AND v.version=parent.content_version AND e.value->>'type'='choice'
       AND e.value->>'choice_id'=child.context->>'choice_id' AND e.value->>'grant_type' IN ('feature','invocation')
       AND (e.value->'from') @> jsonb_build_array(child.slug))
), descriptors AS (
 SELECT r.id AS source_ref_id,r.slug AS feature_slug,r.data->>'class' AS class_slug,d.value AS descriptor,
   d.value->>'choice_id' AS choice_id
 FROM earned_features r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.data->'bonus_spells','[]')) d(value)
 WHERE r.kind='feature'
), saved AS (
 SELECT c.key AS choice_id,c.value AS selected,d.source_ref_id,d.feature_slug,d.class_slug,d.descriptor FROM target t
 CROSS JOIN LATERAL jsonb_each(COALESCE(t.choices->'bonus_spells','{}')) c(key,value)
 LEFT JOIN descriptors d ON d.choice_id=c.key
), picks AS (
 SELECT s.feature_slug,s.source_ref_id,s.class_slug,s.descriptor,s.selected,s.choice_id,
   p.value->>'content_id' AS content_id,(p.value->>'content_version')::integer AS version
 FROM saved s CROSS JOIN LATERAL jsonb_array_elements(s.selected) p(value)
), spell_rows AS (
 SELECT s.*,v.slug_snapshot AS slug,v.data_snapshot AS data,v.system_id_snapshot=t.system_id AS same_system
 FROM public.character_spells s JOIN target t ON t.id=s.character_id
 JOIN public.content_versions v ON v.content_id=s.content_id AND v.version=s.content_version
), choice_checks AS (
 SELECT s.choice_id,s.feature_slug,jsonb_array_length(s.selected) AS selected_count,
   s.source_ref_id IS NOT NULL AND jsonb_array_length(s.selected)<=(s.descriptor->>'choose')::integer
     AND (SELECT count(DISTINCT value->>'content_id') FROM jsonb_array_elements(s.selected))=jsonb_array_length(s.selected)
     AS earned_unique_within_budget,
   NOT EXISTS(SELECT 1 FROM picks p WHERE p.choice_id=s.choice_id AND
     (SELECT count(*) FROM refs r WHERE r.content_id=p.content_id::uuid AND r.content_version=p.version
       AND r.kind='spell' AND r.same_system AND r.context->>'source_ref_id'=s.source_ref_id::text
       AND r.context->>'choice_id'=s.choice_id AND r.choice_source LIKE 'builder:bonus-spell:%')<>1) AS exact_pins,
   NOT EXISTS(SELECT 1 FROM picks p WHERE p.choice_id=s.choice_id AND
     (SELECT count(*) FROM spell_rows r WHERE r.content_id=p.content_id::uuid AND r.content_version=p.version
       AND r.class_slug=p.class_slug AND r.same_system AND
       CASE WHEN p.descriptor->>'spellbook_only'='true' THEN r.source='selection' AND r.in_spellbook
         AND CASE WHEN p.descriptor->>'mode'='signature' THEN r.always_prepared AND r.is_prepared ELSE true END
       ELSE r.source='bonus' AND r.custom_data->>'builder_bonus_choice_id'=p.choice_id
         AND r.custom_data->>'builder_bonus_source_ref_id'=p.source_ref_id::text END)<>1) AS exact_rows
 FROM saved s
), bonus_rows AS (
 SELECT r.id,r.slug,r.class_slug,r.custom_data->>'builder_bonus_choice_id' AS choice_id,
   r.custom_data->>'builder_bonus_mode' AS mode,r.is_known,r.is_prepared,r.always_prepared,
   r.same_system AND r.is_known AND NOT r.in_spellbook AND r.spell_grant_id IS NULL
     AND EXISTS(SELECT 1 FROM refs pin WHERE pin.content_id=r.content_id AND pin.content_version=r.content_version
       AND pin.context->>'choice_id'=r.custom_data->>'builder_bonus_choice_id'
       AND pin.context->>'source_ref_id'=r.custom_data->>'builder_bonus_source_ref_id'
       AND pin.choice_source LIKE 'builder:bonus-spell:%')
     AND EXISTS(SELECT 1 FROM earned_features owner WHERE owner.id::text=r.custom_data->>'builder_bonus_source_ref_id'
       AND owner.data->>'class'=r.class_slug AND owner.same_system
       AND CASE WHEN r.custom_data->>'builder_bonus_mode'='fixed' THEN r.always_prepared AND r.is_prepared
         AND EXISTS(SELECT 1 FROM jsonb_array_elements(owner.data->'bonus_spell_grants') tier(value)
           CROSS JOIN target t CROSS JOIN LATERAL jsonb_array_elements(t.choices->'classes') c(value)
           WHERE c.value->>'slug'=r.class_slug AND (tier.value->>'class_level')::integer<=(c.value->>'level')::integer
             AND r.custom_data->>'builder_bonus_choice_id'=owner.slug||'-'||(tier.value->>'class_level')
             AND tier.value->'spells' @> jsonb_build_array(r.slug))
       ELSE EXISTS(SELECT 1 FROM descriptors d WHERE d.source_ref_id=owner.id
         AND d.choice_id=r.custom_data->>'builder_bonus_choice_id' AND d.descriptor->>'mode'=r.custom_data->>'builder_bonus_mode'
         AND (d.descriptor->>'always_prepared')::boolean=r.always_prepared) END) AS owned_exact_projection
 FROM spell_rows r WHERE r.source='bonus'
), domains AS (
 SELECT 'pins' AS domain,COALESCE(array_agg(id ORDER BY id),'{}'::uuid[]) AS ids FROM refs
 UNION ALL SELECT 'spells',COALESCE(array_agg(id ORDER BY id),'{}'::uuid[]) FROM spell_rows
 UNION ALL SELECT 'inventory',COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[]) FROM public.character_inventory r JOIN target t ON t.id=r.character_id
 UNION ALL SELECT 'feature_grants',COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[]) FROM public.character_feature_grants r JOIN target t ON t.id=r.character_id
 UNION ALL SELECT 'spell_grants',COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[]) FROM public.character_spell_grants r JOIN target t ON t.id=r.character_id
), order_checks AS (
 SELECT d.domain,d.ids=(SELECT COALESCE(array_agg(value::uuid ORDER BY value::uuid),'{}'::uuid[])
   FROM jsonb_array_elements_text(to_jsonb(o)->d.domain))
   AND cardinality(d.ids)=jsonb_array_length(to_jsonb(o)->d.domain) AS bijection
 FROM domains d CROSS JOIN target t JOIN private.character_projection_order_v1 o ON o.character_id=t.id
)
SELECT jsonb_build_object('characterId',t.id,'level',t.level,'classes',t.choices->'classes',
 'bonusChoices',COALESCE(t.choices->'bonus_spells','{}'),'resolvedChoices',COALESCE(t.choices->'resolved_choices','{}'),
 'choiceChecks',COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM choice_checks c),'[]'),
 'bonusRows',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY class_slug,choice_id,slug) FROM bonus_rows r),'[]'),
 'spells',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'slug',slug,'source',source,'known',is_known,
   'prepared',is_prepared,'alwaysPrepared',always_prepared,'book',in_spellbook,'custom',custom_data) ORDER BY slug) FROM spell_rows),'[]'),
 'allChoicesValid',NOT EXISTS(SELECT 1 FROM choice_checks WHERE NOT earned_unique_within_budget OR NOT exact_pins OR NOT exact_rows),
 'allBonusRowsOwned',NOT EXISTS(SELECT 1 FROM bonus_rows WHERE NOT owned_exact_projection),
 'orderBijections',(SELECT jsonb_object_agg(domain,bijection) FROM order_checks),
 'parentOrderRevisionEqual',(SELECT producer_revision=t.action_revision FROM private.character_projection_order_v1 WHERE character_id=t.id),
 'receiptCount',(SELECT count(*) FROM private.character_builder_receipts_v1 WHERE character_id=t.id),
 'bonusReceipts',(SELECT count(*) FROM private.character_builder_receipts_v1 WHERE character_id=t.id AND request->>'command'='select_bonus_spells'),
 'capsRemaining',(SELECT count(*) FROM private.character_builder_capabilities_v1),
 'writerReadiness',(SELECT count(*) FROM private.character_writer_readiness_v1 WHERE ready),
 'classGate',EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled),
 'hitDieGate',EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled),
 'servicePrivateUsage',has_schema_privilege('service_role','private','USAGE')) FROM target t;
COMMIT;
