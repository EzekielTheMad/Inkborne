import type { AsiCharacter, AsiEvidence } from "@/lib/character/asi-contributions";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { Effect } from "@/lib/types/effects";
export const adId = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Finite loaded-pin fixture using the genuine 2014 choice/grant declarations.
 * This supplies source tests, not a native producer or actual-app receipt.
 */
export function ancestryDefenseFixture() {
  const character: AsiCharacter = { id: adId(1), system_id: adId(2), level: 1, choices: { classes: [], race: "dragonborn",
    resolved_choices: { "draconic-ancestry-trait-choice": ["draconic-ancestry-gold"] } } };
  const pin = (n: number, type: string, slug: string, data: Record<string, unknown>, effects: Effect[], rootId = adId(3)): ContentRefWithContent => ({
    id: adId(n), character_id: character.id, content_id: adId(n + 100), content_version: 1,
    feature_grant_id: null, context: type === "trait" ? { source: "racial_trait", root_controller_ref_id: rootId } : { source: type },
    choice_source: type === "trait" ? `builder:racial-trait:${slug}` : null, created_at: "2026-10-11T01:00:00.000Z",
    content_definitions: { id: adId(n + 100), version: 1, system_id: character.system_id, content_type: type, slug, name: slug,
      source: "srd", scope: "platform", owner_id: null, data, effects },
  });
  const root = pin(3, "race", "dragonborn", { size: "Medium", speed: 30, traits: ["draconic-ancestry"], subraces: [], source_refs: [] }, []);
  const controller = pin(4, "trait", "draconic-ancestry", { description: "Choose one type of dragon from the Draconic Ancestry table.",
    races: ["dragonborn"], subraces: [] }, [{ type: "choice", choose: 1, grant_type: "trait", choice_id: "draconic-ancestry-trait-choice",
    from: ["black", "blue", "brass", "bronze", "copper", "gold", "green", "red", "silver", "white"].map(color => `draconic-ancestry-${color}`) }]);
  const selected = pin(5, "trait", "draconic-ancestry-gold", { description: "Your damage resistance is determined by the dragon type.",
    races: ["dragonborn"], subraces: [] }, [{ type: "grant", stat: "dmgres", value: "fire" }]);
  const refs = [root, controller, selected];
  const evidence: Extract<AsiEvidence, { status: "complete" }> = { status: "complete", character_id: character.id,
    system_id: character.system_id, refs, grants: [] };
  return { character, root, controller, selected, refs, evidence, pin };
}
