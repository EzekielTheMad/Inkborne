-- Read-only evidence for one genuine app-created fixture. No Auth row payload.
-- psql -v character_id=<UUID> -v actor_id=<UUID> -f this-file.sql
BEGIN READ ONLY;
WITH target AS (
 SELECT * FROM public.characters WHERE id=:'character_id'::uuid AND user_id=:'actor_id'::uuid
), graph AS (
 SELECT t.id,private.builder_progression_full_graph_v1(t.id) AS graph,
   private.builder_original_occurrence_v1(t.id) AS original FROM target t
), domains AS (
 SELECT 'pins' AS name,COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[]) AS ids FROM public.character_content_refs r JOIN target t ON t.id=r.character_id
 UNION ALL SELECT 'inventory',COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[]) FROM public.character_inventory r JOIN target t ON t.id=r.character_id
 UNION ALL SELECT 'spells',COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[]) FROM public.character_spells r JOIN target t ON t.id=r.character_id
 UNION ALL SELECT 'feature_grants',COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[]) FROM public.character_feature_grants r JOIN target t ON t.id=r.character_id
 UNION ALL SELECT 'spell_grants',COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[]) FROM public.character_spell_grants r JOIN target t ON t.id=r.character_id
), order_checks AS (
 SELECT d.name,d.ids=ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(to_jsonb(o)->d.name) ORDER BY value::uuid)
  AND cardinality(d.ids)=jsonb_array_length(to_jsonb(o)->d.name)
  AND cardinality(d.ids)=(SELECT count(DISTINCT value) FROM jsonb_array_elements_text(to_jsonb(o)->d.name)) AS bijection
 FROM domains d CROSS JOIN target t JOIN private.character_projection_order_v1 o ON o.character_id=t.id
), snapshot AS (
 SELECT t.id,jsonb_build_object('parent',to_jsonb(t),'graph',g.graph,
  'order',(SELECT to_jsonb(o) FROM private.character_projection_order_v1 o WHERE character_id=t.id),
  'awards',(SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]') FROM public.character_starting_grants a WHERE character_id=t.id),
  'receipts',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.operation_id),'[]') FROM private.character_builder_receipts_v1 r WHERE character_id=t.id),
  'draws',(SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.occurrence_id,d.level),'[]') FROM private.character_builder_hp_draws_v1 d WHERE character_id=t.id),
  'history',(SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY h.operation_id),'[]') FROM private.character_builder_progression_history_v1 h WHERE character_id=t.id),
  'first_proofs',(SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.acceptance_id),'[]') FROM private.class_first_acquisition_proofs_v1 p WHERE target_character_id=t.id)) AS data
 FROM target t JOIN graph g ON g.id=t.id
)
SELECT jsonb_build_object('kind','builder-parent-admission-fixture-readback-v1','characterId',t.id,'actorId',t.user_id,
 'actionRevision',t.action_revision::text,'level',t.level,'name',t.name,'choices',t.choices,'scores',t.base_stats,'state',t.state,
 'enrolled',private.enrolled_character_parent_v1(t.id),'originalOccurrenceId',g.original->>'id',
 'classRoles',private.builder_class_roles_v1(t.id),'graphFingerprint',md5(g.graph::text),'fixtureFingerprint',md5(s.data::text),
 'orderBijections',(SELECT jsonb_object_agg(name,bijection) FROM order_checks),
 'parentOrderRevisionEqual',(SELECT producer_revision=t.action_revision FROM private.character_projection_order_v1 WHERE character_id=t.id),
 'receipts',COALESCE((SELECT jsonb_agg(jsonb_build_object('operationId',operation_id,'command',request->>'command',
   'fields',request->'fields','receipt',receipt) ORDER BY operation_id) FROM private.character_builder_receipts_v1 WHERE character_id=t.id),'[]'),
 'startingAwards',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.character_starting_grants a WHERE character_id=t.id),'[]'),
 'firstClassProofs',COALESCE((SELECT jsonb_agg(jsonb_build_object('acceptanceId',p.acceptance_id,'phase',p.phase,'actorId',p.verified_actor_id,
   'operationId',p.operation_id,'beforeRevision',p.before_action_revision::text,'afterRevision',p.after_action_revision::text)
   ORDER BY p.acceptance_id) FROM private.class_first_acquisition_proofs_v1 p WHERE target_character_id=t.id),'[]'),
 'capsRemaining',(SELECT count(*) FROM private.character_builder_capabilities_v1),'sealsRemaining',(SELECT count(*) FROM private.character_parent_admissions_v1),
 'readinessCount',(SELECT count(*) FROM private.character_writer_readiness_v1),'readyCount',(SELECT count(*) FROM private.character_writer_readiness_v1 WHERE ready),
 'classGate',EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled),'hitDieGate',EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled),
 'servicePrivateUsage',has_schema_privilege('service_role','private','USAGE')) FROM target t JOIN graph g ON g.id=t.id JOIN snapshot s ON s.id=t.id;
ROLLBACK;
