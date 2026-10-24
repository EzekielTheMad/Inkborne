-- Bounded, read-only native evidence for disposable actual-app recovery stories.
-- psql -v character_id=<public UUID> -f this-file.sql
BEGIN READ ONLY;
WITH target AS (
 SELECT * FROM public.characters WHERE id=:'character_id'::uuid
), domains AS (
 SELECT 'pins' AS domain,COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[]) AS ids
 FROM public.character_content_refs r JOIN target t ON t.id=r.character_id
 UNION ALL SELECT 'spells',COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[])
 FROM public.character_spells r JOIN target t ON t.id=r.character_id
 UNION ALL SELECT 'inventory',COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[])
 FROM public.character_inventory r JOIN target t ON t.id=r.character_id
 UNION ALL SELECT 'feature_grants',COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[])
 FROM public.character_feature_grants r JOIN target t ON t.id=r.character_id
 UNION ALL SELECT 'spell_grants',COALESCE(array_agg(r.id ORDER BY r.id),'{}'::uuid[])
 FROM public.character_spell_grants r JOIN target t ON t.id=r.character_id
), order_checks AS (
 SELECT d.domain,d.ids=(SELECT COALESCE(array_agg(value::uuid ORDER BY value::uuid),'{}'::uuid[])
   FROM jsonb_array_elements_text(to_jsonb(o)->d.domain))
   AND cardinality(d.ids)=jsonb_array_length(to_jsonb(o)->d.domain) AS bijection
 FROM domains d CROSS JOIN target t JOIN private.character_projection_order_v1 o ON o.character_id=t.id
)
SELECT jsonb_build_object('characterId',t.id,'actorId',t.user_id,'actionRevision',t.action_revision::text,
 'scores',t.base_stats,'abilityMethod',t.choices->'ability_method','hpRolls',t.choices->'hp_rolls',
 'pins',COALESCE((SELECT jsonb_agg(r.id ORDER BY r.id) FROM public.character_content_refs r WHERE r.character_id=t.id),'[]'),
 'receiptCount',(SELECT count(*) FROM private.character_builder_receipts_v1 WHERE character_id=t.id),
 'receipts',COALESCE((SELECT jsonb_agg(jsonb_build_object('operationId',r.operation_id,'actorId',r.actor_id,
   'request',r.request,'receipt',r.receipt) ORDER BY r.created_at,r.operation_id)
   FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id),'[]'),
 'hpDraws',COALESCE((SELECT jsonb_agg(jsonb_build_object('operationId',d.operation_id,'actorId',d.actor_id,
   'occurrenceId',d.occurrence_id,'level',d.level,'die',d.die,'value',d.value) ORDER BY d.occurrence_id,d.level)
   FROM private.character_builder_hp_draws_v1 d WHERE d.character_id=t.id),'[]'),
 'progressionHistoryCount',(SELECT count(*) FROM private.character_builder_progression_history_v1 WHERE character_id=t.id),
 'orderBijections',(SELECT jsonb_object_agg(domain,bijection) FROM order_checks),
 'parentOrderRevisionEqual',(SELECT producer_revision=t.action_revision FROM private.character_projection_order_v1 WHERE character_id=t.id),
 'capsRemaining',(SELECT count(*) FROM private.character_builder_capabilities_v1),
 'readinessCount',(SELECT count(*) FROM private.character_writer_readiness_v1),
 'writerReadiness',(SELECT count(*) FROM private.character_writer_readiness_v1 WHERE ready),
 'classGate',EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled),
 'hitDieGate',EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled),
 'servicePrivateUsage',has_schema_privilege('service_role','private','USAGE')) FROM target t;
COMMIT;
