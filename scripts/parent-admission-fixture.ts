import assert from "node:assert/strict";
import { z } from "zod";

const id = z.uuid(), revision = z.string().regex(/^\d+$/), digest = z.string().regex(/^[a-f0-9]{32}$/);
const baseScores = { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 };
const allocation = z.object({ mode: z.literal("asi"), allocations: z.array(z.object({ ability: z.literal("strength"), amount: z.literal(2) }).strict()).length(1) }).strict();
export const nativeSchema = z.object({ kind: z.literal("builder-parent-admission-fixture-readback-v1"), characterId: id, actorId: id, level: z.literal(4),
  actionRevision: revision, fixtureFingerprint: digest, graphFingerprint: digest, enrolled: z.literal(true), originalOccurrenceId: id,
  choices: z.object({ ability_method: z.literal("standard_array"), race: z.literal("human"), background: z.literal("acolyte"),
    classes: z.array(z.object({ slug: z.literal("fighter"), level: z.literal(4), occurrence_id: id }).passthrough()).length(1),
    asi_choices: z.record(z.string(), allocation), starting_equipment: z.object({ confirmed: z.literal(false).optional() }).passthrough().optional() }).passthrough(),
  scores: z.record(z.string(), z.number().int()), state: z.record(z.string(), z.unknown()),
  classRoles: z.object({ status: z.literal("available"), contract_version: z.literal(1), character_id: id, system_id: id, action_revision: revision,
    original_occurrence_id: id, class_sources: z.array(z.object({ role: z.literal("original"), occurrence_id: id, controller_ref_id: id,
      content_id: id, content_version: z.number().int().positive() }).passthrough()).length(1) }).passthrough(),
  startingAwards: z.array(z.object({ status: z.literal("eligible"), canonical_intent: z.null(), receipt: z.null(), completed_at: z.null() }).passthrough()),
  receipts: z.array(z.object({ operationId: id, command: z.string(), fields: z.unknown(), receipt: z.unknown() }).passthrough()),
  firstClassProofs: z.array(z.object({ phase: z.literal("observed"), actorId: id, operationId: id, acceptanceId: id }).passthrough()).length(1),
  orderBijections: z.record(z.string(), z.boolean()), parentOrderRevisionEqual: z.literal(true), capsRemaining: z.literal(0), sealsRemaining: z.literal(0),
  readinessCount: z.literal(13), readyCount: z.literal(0), classGate: z.literal(false), hitDieGate: z.literal(false), servicePrivateUsage: z.literal(false),
}).passthrough();
export const eligibilitySchema = z.object({ characterId: id, actorId: id, activeAsiCount: z.literal(1), featureSlug: z.string().regex(/^[a-z0-9-]{1,200}$/),
  legalChangedAbilities: z.array(z.enum(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"])).min(1),
  unawarded: z.literal(true), inventoryCount: z.literal(0), hasStoredCurrentHp: z.literal(false) }).strict();

export const PARENT_ASI_ELIGIBILITY_SQL = `BEGIN READ ONLY;
SELECT jsonb_build_object('characterId',c.id,'actorId',c.user_id,
 'activeAsiCount',(SELECT count(*) FROM public.character_feature_grants x JOIN public.content_versions v
   ON v.content_id=x.feature_content_id AND v.version=x.feature_version WHERE x.character_id=c.id
   AND v.data_snapshot->>'feature_type'='asi' AND private.is_character_feature_grant_active(x.id)),
 'featureSlug',g.feature_slug,
 'legalChangedAbilities',(SELECT COALESCE(jsonb_agg(e.key ORDER BY e.key),'[]') FROM jsonb_each(private.character_ability_scores(c.id,NULL,g.feature_slug,NULL)) e
   WHERE e.key IN ('strength','dexterity','constitution','intelligence','wisdom','charisma') AND jsonb_typeof(e.value)='number' AND (e.value#>>'{}')::numeric<=18
   AND c.choices#>ARRAY['asi_choices',g.feature_slug] IS DISTINCT FROM jsonb_build_object('mode','asi','allocations',jsonb_build_array(jsonb_build_object('ability',e.key,'amount',2)))),
 'unawarded',NOT EXISTS(SELECT 1 FROM public.character_starting_grants a WHERE a.character_id=c.id AND a.status<>'eligible')
   AND NOT COALESCE(c.choices#>'{starting_equipment,confirmed}'='true'::jsonb,false),
 'inventoryCount',(SELECT count(*) FROM public.character_inventory i WHERE i.character_id=c.id),'hasStoredCurrentHp',c.state?'current_hp')
FROM public.characters c JOIN LATERAL (SELECT f.feature_slug FROM public.character_feature_grants f JOIN public.content_versions v
 ON v.content_id=f.feature_content_id AND v.version=f.feature_version WHERE f.character_id=c.id AND v.data_snapshot->>'feature_type'='asi'
 AND private.is_character_feature_grant_active(f.id) AND (SELECT count(*) FROM public.character_feature_grants x WHERE x.character_id=c.id AND x.feature_slug=f.feature_slug)=1
 ORDER BY f.feature_slug LIMIT 1) g ON true WHERE c.id=:'character_id'::uuid AND c.user_id=:'actor_id'::uuid;
ROLLBACK;`;

export function validateParentPreparationNative(input: unknown, eligibilityInput: unknown, characterId: string, actorId: string) {
  const native = nativeSchema.parse(input), eligibility = eligibilitySchema.parse(eligibilityInput);
  for (const value of [native, eligibility]) { assert.equal(value.characterId, characterId); assert.equal(value.actorId, actorId); }
  assert.deepEqual(native.scores, baseScores); assert(!Object.hasOwn(native.state, "current_hp"), "do not invent stored HP for the fixture");
  assert.equal(native.choices.classes[0].occurrence_id, native.originalOccurrenceId);
  assert.equal(native.classRoles.character_id, characterId); assert.equal(native.classRoles.action_revision, native.actionRevision);
  assert.equal(native.classRoles.original_occurrence_id, native.originalOccurrenceId); assert.equal(native.classRoles.class_sources[0].occurrence_id, native.originalOccurrenceId);
  assert.equal(native.firstClassProofs[0].actorId, actorId);
  assert.deepEqual(Object.keys(native.orderBijections).sort(), ["feature_grants", "inventory", "pins", "spell_grants", "spells"]);
  assert(Object.values(native.orderBijections).every(value => value === true));
  assert(!native.receipts.some(item => item.command === "award_equipment"));
  for (const command of ["save_abilities", "select_background", "select_asi", "select_equipment", "set_class_level"])
    assert(native.receipts.some(item => item.command === command), `missing genuine ${command} receipt`);
  assert.deepEqual(Object.keys(native.choices.asi_choices), [eligibility.featureSlug]);
  return { native, eligibility };
}

