-- Supplement to the frozen builder-parent-admission-readback.sql.
-- Read-only, exact owned character; never creates a fixture or admission.
BEGIN READ ONLY;
WITH target AS (
 SELECT * FROM public.characters WHERE id=:'character_id'::uuid AND user_id=:'actor_id'::uuid
), inventory AS (
 SELECT i.*,v.content_id IS NOT NULL AS exact_version,v.content_type_snapshot AS kind,
   v.system_id_snapshot AS system_id,v.source_snapshot AS source,v.scope_snapshot AS scope,v.owner_id_snapshot AS owner_id
 FROM public.character_inventory i JOIN target t ON t.id=i.character_id
 LEFT JOIN public.content_versions v ON v.content_id=i.content_id AND v.version=i.content_version
)
SELECT jsonb_build_object(
 'kind','builder-parent-positive-detail-v1','characterId',t.id,'actorId',t.user_id,
 'pins',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.character_content_refs r WHERE r.character_id=t.id),'[]'),
 'inventory',COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM public.character_inventory i WHERE i.character_id=t.id),'[]'),
 'featureGrants',COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.id) FROM public.character_feature_grants g WHERE g.character_id=t.id),'[]'),
 'spellGrants',COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.id) FROM public.character_spell_grants g WHERE g.character_id=t.id),'[]'),
 'spells',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM public.character_spells s WHERE s.character_id=t.id),'[]'),
 'hpDraws',COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.occurrence_id,d.level) FROM private.character_builder_hp_draws_v1 d WHERE d.character_id=t.id),'[]'),
 'updateReceipts',COALESCE((SELECT jsonb_agg(jsonb_build_object('operationId',r.operation_id,'request',r.request,'receipt',r.receipt) ORDER BY r.operation_id)
   FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id AND r.request->>'command'='update_subclass_version'),'[]'),
 'inventoryFromAcceptedAward',NOT EXISTS(SELECT 1 FROM inventory i WHERE i.quantity<=0
   OR (CASE WHEN i.content_id IS NULL THEN i.content_version IS NULL ELSE i.exact_version AND i.kind IN ('item','weapon','armor')
     AND i.kind=i.content_type AND i.system_id=t.system_id AND i.source='srd' AND i.scope='platform' AND i.owner_id IS NULL END) IS DISTINCT FROM true
   OR NOT EXISTS(SELECT 1 FROM public.character_starting_grants a WHERE a.character_id=t.id AND a.id=i.starting_grant_id
     AND a.status='awarded' AND a.grant_kind='starting_equipment' AND a.completed_at IS NOT NULL
     AND a.receipt->>'grant_id'=a.id::text AND a.receipt->'plan'=a.canonical_intent->'plan'
     AND jsonb_array_length(a.receipt->'inventory_ids')=(SELECT count(*) FROM inventory)
     AND jsonb_array_length(a.receipt#>'{plan,items}')=(SELECT count(*) FROM inventory)
     AND (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(a.receipt->'inventory_ids'))=(SELECT count(*) FROM inventory)
     AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(a.receipt->'inventory_ids') WITH ORDINALITY line(id,position)
       WHERE line.id=i.id::text AND a.receipt#>ARRAY['plan','items',(line.position-1)::text]=jsonb_build_object(
         'content_id',i.content_id,'content_version',i.content_version,'name',i.name,'content_type',i.content_type,'quantity',i.quantity))
     AND EXISTS(SELECT 1 FROM private.character_builder_receipts_v1 r WHERE r.character_id=t.id AND r.actor_id=t.user_id
       AND r.request->>'command'='award_equipment' AND r.request->'canonical_intent'=a.canonical_intent AND r.receipt=a.receipt))),
 'catalog',jsonb_build_object('count',(SELECT count(*) FROM public.content_definitions),
   'fingerprint',(SELECT md5(COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.id),'[]')::text) FROM public.content_definitions d)),
 'snapshots',jsonb_build_object('count',(SELECT count(*) FROM public.content_versions),
   'fingerprint',(SELECT md5(COALESCE(jsonb_agg(to_jsonb(v) ORDER BY v.content_id,v.version),'[]')::text) FROM public.content_versions v))
) FROM target t;
ROLLBACK;
