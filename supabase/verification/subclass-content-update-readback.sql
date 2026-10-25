-- Read-only evidence for two app-created characters in the disposable profile.
-- psql -v character_id=<target UUID> -v control_id=<old-pin control UUID> -f this-file.sql
BEGIN READ ONLY;
WITH target AS (
 SELECT * FROM public.characters WHERE id=:'character_id'::uuid
), refs AS (
 SELECT r.*,v.slug_snapshot AS slug,v.content_type_snapshot AS kind
 FROM public.character_content_refs r JOIN target t ON t.id=r.character_id
 JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
), spells AS (
 SELECT s.*,v.slug_snapshot AS slug,(v.data_snapshot->>'level')::integer AS spell_level
 FROM public.character_spells s JOIN target t ON t.id=s.character_id
 JOIN public.content_versions v ON v.content_id=s.content_id AND v.version=s.content_version
), domains AS (
 SELECT 'pins' AS domain,COALESCE(array_agg(id ORDER BY id),'{}'::uuid[]) AS ids FROM refs
 UNION ALL SELECT 'spells',COALESCE(array_agg(id ORDER BY id),'{}'::uuid[]) FROM spells
 UNION ALL SELECT 'inventory',COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[]) FROM public.character_inventory r JOIN target t ON t.id=r.character_id
 UNION ALL SELECT 'feature_grants',COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[]) FROM public.character_feature_grants r JOIN target t ON t.id=r.character_id
 UNION ALL SELECT 'spell_grants',COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[]) FROM public.character_spell_grants r JOIN target t ON t.id=r.character_id
), order_checks AS (
 SELECT d.domain,d.ids=(SELECT COALESCE(array_agg(value::uuid ORDER BY value::uuid),'{}'::uuid[])
   FROM jsonb_array_elements_text(to_jsonb(o)->d.domain))
   AND cardinality(d.ids)=jsonb_array_length(to_jsonb(o)->d.domain) AS bijection
 FROM domains d CROSS JOIN target t JOIN private.character_projection_order_v1 o ON o.character_id=t.id
), control_graph AS (
 SELECT jsonb_build_object('parent',to_jsonb(c),'graph',private.builder_progression_full_graph_v1(c.id),
  'order',(SELECT to_jsonb(o) FROM private.character_projection_order_v1 o WHERE character_id=c.id),
  'draws',(SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.occurrence_id,d.level),'[]') FROM private.character_builder_hp_draws_v1 d WHERE character_id=c.id),
  'receipts',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.operation_id),'[]') FROM private.character_builder_receipts_v1 r WHERE character_id=c.id)) AS data
 FROM public.characters c WHERE c.id=:'control_id'::uuid
)
SELECT jsonb_build_object('characterId',t.id,'actorId',t.user_id,'actionRevision',t.action_revision::text,'level',t.level,
 'choices',t.choices,'scores',t.base_stats,'state',t.state,
 'originalOccurrenceId',private.builder_original_occurrence_v1(t.id)->>'id',
 'occurrences',(SELECT jsonb_agg(to_jsonb(o) ORDER BY o.id) FROM private.character_class_occurrences_v1 o WHERE character_id=t.id),
 'classRoots',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'slug',slug,'version',content_version) ORDER BY id) FROM refs WHERE kind='class'),'[]'),
 'subclassRoots',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'contentId',content_id,'slug',slug,'version',content_version,'context',context) ORDER BY id) FROM refs WHERE kind='subclass'),'[]'),
 'pins',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'slug',slug,'kind',kind,'version',content_version,'featureGrantId',feature_grant_id,'context',context) ORDER BY id) FROM refs),'[]'),
 'featureGrants',COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.id) FROM public.character_feature_grants g WHERE character_id=t.id),'[]'),
 'spellGrants',COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.id) FROM public.character_spell_grants g WHERE character_id=t.id),'[]'),
 'spells',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'slug',slug,'classSlug',class_slug,'source',source,'version',content_version,
   'level',spell_level,'known',is_known,'prepared',is_prepared,'alwaysPrepared',always_prepared,'grantId',spell_grant_id,'custom',custom_data) ORDER BY id) FROM spells),'[]'),
 'fiendFreeRows',(SELECT count(*) FROM spells s JOIN public.character_spell_grants g ON g.id=s.spell_grant_id
   JOIN refs root ON root.id=g.controller_ref_id WHERE root.kind='subclass' AND root.slug='fiend'),
 'warlockCantrips',(SELECT count(*) FROM spells WHERE class_slug='warlock' AND source='selection' AND spell_level=0),
 'warlockKnown',(SELECT count(*) FROM spells WHERE class_slug='warlock' AND source='selection' AND spell_level>0),
 'inventory',COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM public.character_inventory i WHERE character_id=t.id),'[]'),
 'startingAwards',COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.id) FROM public.character_starting_grants g WHERE character_id=t.id),'[]'),
 'hpDraws',COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.occurrence_id,d.level) FROM private.character_builder_hp_draws_v1 d WHERE character_id=t.id),'[]'),
 'receiptCount',(SELECT count(*) FROM private.character_builder_receipts_v1 WHERE character_id=t.id),
 'updateReceipts',COALESCE((SELECT jsonb_agg(jsonb_build_object('operationId',operation_id,'request',request,'receipt',receipt) ORDER BY operation_id)
   FROM private.character_builder_receipts_v1 WHERE character_id=t.id AND request->>'command'='update_subclass_version'),'[]'),
 'updateHistoryCount',(SELECT count(*) FROM private.character_builder_progression_history_v1 WHERE character_id=t.id AND command='update_subclass_version'),
 'fiendDefinitionVersion',(SELECT version FROM public.content_definitions WHERE content_type='subclass' AND slug='fiend' AND system_id=t.system_id),
 'fiendSnapshots',(SELECT jsonb_agg(jsonb_build_object('id',id,'version',version,'digest',md5(to_jsonb(v)::text),
   'extra',data_snapshot ? 'spellcastingExtra','expanded',data_snapshot ? 'spellcastingExpanded') ORDER BY version)
   FROM public.content_versions v WHERE content_type_snapshot='subclass' AND slug_snapshot='fiend' AND system_id_snapshot=t.system_id),
 'controlFingerprint',(SELECT md5(data::text) FROM control_graph),'controlCharacterId',:'control_id'::uuid,
 'controlFiendVersion',(SELECT r.content_version FROM public.character_content_refs r JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
   WHERE r.character_id=:'control_id'::uuid AND v.content_type_snapshot='subclass' AND v.slug_snapshot='fiend'),
 'orderBijections',(SELECT jsonb_object_agg(domain,bijection) FROM order_checks),
 'parentOrderRevisionEqual',(SELECT producer_revision=t.action_revision FROM private.character_projection_order_v1 WHERE character_id=t.id),
 'capsRemaining',(SELECT count(*) FROM private.character_builder_capabilities_v1),
 'readinessCount',(SELECT count(*) FROM private.character_writer_readiness_v1),'writerReadiness',(SELECT count(*) FROM private.character_writer_readiness_v1 WHERE ready),
 'classGate',EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled),'hitDieGate',EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled),
 'servicePrivateUsage',has_schema_privilege('service_role','private','USAGE')) FROM target t;
COMMIT;
