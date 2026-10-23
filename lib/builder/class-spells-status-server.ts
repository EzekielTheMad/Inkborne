import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { getCharacterContentRefSnapshot } from "@/lib/supabase/content-refs";
import { parseNestedContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { resolveEffectiveCastingSources } from "@/lib/spells/effective-sources";
import { evaluate } from "@/lib/engine/evaluator";
import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import { resolveCharacterChoiceEffects } from "@/lib/character/choice-effects";
import { classSpellSelectionsComplete } from "./spell-completion";
import type { Character } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";

const readSavedSpells = cache(async (characterId: string) => {
  const client = await createClient();
  const result = await client.from("character_spells").select(`*, content_versions!character_spells_content_version_fkey(
    content_id,version,system_id_snapshot,content_type_snapshot,slug_snapshot,name_snapshot,data_snapshot,effects_snapshot,source_snapshot,scope_snapshot,owner_id_snapshot
  )`).eq("character_id", characterId);
  if (result.error) throw Error("The saved spells could not be read. Reload before finishing.");
  return (result.data ?? []).map(row => ({ ...row, content_definitions: parseNestedContentVersionSnapshot(row.content_versions) }));
});

/** Shared saved-state verdict for navigation, overview and final review. */
export async function savedBuilderClassSpellsComplete(
  character: Pick<Character, "id" | "system_id" | "level" | "choices" | "base_stats" | "state">,
  snapshot: Awaited<ReturnType<typeof getCharacterContentRefSnapshot>>,
  schema?: SystemSchemaDefinition,
): Promise<boolean> {
  if (!character.choices.classes?.some(cls => cls.occurrence_id)) return true;
  if (!snapshot.complete) return false;
  const casting = resolveEffectiveCastingSources(character.choices.classes, snapshot.refs, character);
  if (casting.status !== "available") return false;
  if (!casting.sources.some(source => source.active && source.config)) return true;
  if (!schema) return false;
  const rows = await readSavedSpells(character.id);
  const scores = evaluate({ ...character.base_stats, level: character.level }, resolveCharacterChoiceEffects(snapshot.refs, character.choices), schema,
    buildCharacterStructuredSources(snapshot.refs, character.level, { character, evidence: snapshot.asiEvidence }), character.state).stats;
  return classSpellSelectionsComplete(casting.sources, rows, scores);
}
