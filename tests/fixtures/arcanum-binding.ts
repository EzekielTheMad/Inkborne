import { originalId, originalParent, originalSnapshot, subclassCharacterId, subclassSystemId } from "./subclass-casting";
import type { AdvancedBindingInput, AdvancedCapturedGrant, AdvancedRawRef, ArcanumSelection } from "@/lib/spells/advanced-binding";

/** Canonical original immutable snapshots; grant/read records are MODELED,
 * not live database provenance, permissions, activation or receipt evidence. */
export function arcanumFixture(tier: 6 | 7 | 8 | 9 = 6, classLevel?: number) {
  const gainLevel = { 6: 11, 7: 13, 8: 15, 9: 17 }[tier], classSlug = "original-pact";
  const featureSlug = `original-arcanum-${tier}`;
  const parentData = structuredClone(originalParent(classSlug, "pact", [0, 0, 0, 0, 3, 0, 0, 0, 0]).content_definitions.data);
  (parentData.spellcastingList as { level: number[] }).level = [0, 5];
  (parentData.levels as Array<{ level: number; features: string[] }>).find(row => row.level === gainLevel)!.features = [featureSlug];
  const parent = originalSnapshot(classSlug, "class", parentData, 200);
  const feature = originalSnapshot(featureSlug, "feature", { class: classSlug, level: gainLevel, description: "An original prism revelation for bounded payment-intent tests.", feature_type: "passive", usages: 1, recovery: "long rest", source_refs: [],
    advanced_casting: { kind: "arcanum", listClass: classSlug, spellLevel: tier, selectionCount: 1, castLevel: tier } }, 300 + tier);
  const spell = originalSnapshot(`original-prism-${tier}`, "spell", { level: tier, school: "illusion", classes: [classSlug], casting_time: "1 action", range: "60 feet", components: ["V"], duration: "1 minute", concentration: true, ritual: false, description: "An originally authored prism horizon.", attack_type: "ranged", damage: { type: "radiant", dice_at_slot_level: { [tier]: "2d8 + MOD" } } }, 400 + tier, 2);
  const grant: AdvancedCapturedGrant = { grantId: originalId(1400 + tier), characterId: subclassCharacterId, controllerRefId: originalId(1200), featureSlug, featureContentId: feature.content_id, featureVersion: 1, unlockLevel: gainLevel };
  const refs: AdvancedRawRef[] = [
    { refId: grant.controllerRefId, characterId: subclassCharacterId, contentId: parent.content_id, contentVersion: 1, snapshot: parent },
    { refId: originalId(1300 + tier), characterId: subclassCharacterId, contentId: feature.content_id, contentVersion: 1, featureGrantId: grant.grantId, snapshot: feature },
    { refId: originalId(1500 + tier), characterId: subclassCharacterId, contentId: spell.content_id, contentVersion: 2, snapshot: spell },
  ];
  const selection: ArcanumSelection = { characterId: subclassCharacterId, systemId: subclassSystemId, classSlug, controllerRefId: grant.controllerRefId, controllerContentId: parent.content_id, controllerVersion: 1, grantId: grant.grantId, featureContentId: feature.content_id, featureVersion: 1, spellContentId: spell.content_id, spellVersion: 2 };
  const input: AdvancedBindingInput = { character: { id: subclassCharacterId, system_id: subclassSystemId, classes: [{ slug: classSlug, level: classLevel ?? gainLevel }] }, refs, refsComplete: true, grants: [grant], grantId: grant.grantId, selection,
    abilities: [{ slug: "charisma" }], abilityScores: { charisma: 14 }, proficiencyBonus: 4, state: {} };
  return { input, refs, grant, selection, parent, feature, spell, featureSlug, classSlug, gainLevel };
}
