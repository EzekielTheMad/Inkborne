import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import type { AsiCharacter } from "@/lib/character/asi-contributions";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import { featureDataSchema } from "@/lib/schemas/content-types/feature";

export const providerAbilities = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].map(slug => ({ slug, name: slug[0].toUpperCase() + slug.slice(1), abbr: slug.slice(0, 3).toUpperCase() }));
export const providerBase = { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 };

/** Explicit local loaded graph, validated by the production resolver. These
 * no-ASI fixture graphs are not hosted hydration or earned-grant authority. */
export function providerSources(character: AsiCharacter, refs: ContentRefWithContent[] = []) {
  return buildCharacterStructuredSources(refs, character.level, { character, evidence: {
    status: "complete", character_id: character.id, system_id: character.system_id, refs, grants: [],
  } });
}

export function providerPassiveFeature(n: number, slug: string, name: string, classSlug: string, usages: number, recovery: "short rest" | "long rest", characterId = "local-character", systemId = "local-system"): ContentRefWithContent {
  const id = `b1111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
  return { id, character_id: characterId, content_id: slug, content_version: 1, feature_grant_id: null, context: {}, choice_source: null, created_at: "2026-10-12T16:00:00.000Z",
    content_definitions: { id: slug, version: 1, system_id: systemId, slug, name, content_type: "feature", source: "homebrew", effects: [],
      data: featureDataSchema.parse({ class: classSlug, level: 1, description: `Original ${name} persistence control.`, feature_type: "passive", usages, recovery }) } };
}
