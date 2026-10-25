import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import type { AsiCharacter } from "@/lib/character/asi-contributions";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import { featureDataSchema } from "@/lib/schemas/content-types/feature";
import { raceDataSchema } from "@/lib/schemas/content-types/race";

export const providerCharacterId = "a1111111-1111-4111-8111-111111111111";
export const providerSystemId = "a2222222-2222-4222-8222-222222222222";

export const providerAbilities = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].map(slug => ({ slug, name: slug[0].toUpperCase() + slug.slice(1), abbr: slug.slice(0, 3).toUpperCase() }));
export const providerBase = { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 };

/** Explicit local loaded graph, validated by the production resolver. These
 * no-ASI fixture graphs are not hosted hydration or earned-grant authority. */
export function providerSources(character: AsiCharacter, refs: ContentRefWithContent[] = []) {
  return buildCharacterStructuredSources(refs, character.level, { character, evidence: {
    status: "complete", character_id: character.id, system_id: character.system_id, refs, grants: [],
  } });
}

export function providerPassiveFeature(n: number, slug: string, name: string, classSlug: string, usages: number, recovery: "short rest" | "long rest", characterId = providerCharacterId, systemId = providerSystemId): ContentRefWithContent {
  const id = `b1111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
  return { id, character_id: characterId, content_id: slug, content_version: 1, feature_grant_id: null, context: {}, choice_source: null, created_at: "2026-10-12T16:00:00.000Z",
    content_definitions: { id: slug, version: 1, system_id: systemId, slug, name, content_type: "feature", source: "homebrew", effects: [],
      data: featureDataSchema.parse({ class: classSlug, level: 1, description: `Original ${name} persistence control.`, feature_type: "passive", usages, recovery }) } };
}

/** An explicit owned, frozen empty-trait race for provider-boundary fixtures.
 * Renderer snapshots alone do not establish selected ancestry evidence. */
export function providerRaceRef(slug: string, characterId = providerCharacterId, systemId = providerSystemId): ContentRefWithContent {
  const id = "a3333333-3333-4333-8333-333333333333", contentId = "a4444444-4444-4444-8444-444444444444";
  return { id, character_id: characterId, content_id: contentId, content_version: 1, feature_grant_id: null,
    context: { source: "race" }, choice_source: null, created_at: "2026-10-12T16:00:00.000Z",
    content_definitions: { id: contentId, version: 1, system_id: systemId, slug, name: "Original provider ancestry", content_type: "race",
      source: "homebrew", scope: "shared", owner_id: "a5555555-5555-4555-8555-555555555555", effects: [],
      data: raceDataSchema.parse({ size: "Medium", speed: 30, traits: [] }) } };
}
