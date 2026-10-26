import type { AsiCharacter, AsiEvidence } from "@/lib/character/asi-contributions";
import { resolveCharacterAsiContributions } from "@/lib/character/asi-contributions";
import { resolveCharacterChoiceEffects } from "@/lib/character/choice-effects";
import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import { resolveAbilityMechanics } from "@/lib/character/ability-mechanics";
import { evaluate } from "@/lib/engine/evaluator";
import type { SystemSchemaDefinition } from "@/lib/types/system";

/** UI candidates only. Re-evaluate exact saved sources without this occurrence's
 * old ASI/feat; subtracting a capped displayed score can admit the wrong option. */
export function asiOptionScores(character: AsiCharacter & { base_stats: Record<string, number>; state?: Record<string, unknown> },
  evidence: AsiEvidence | undefined, schema: SystemSchemaDefinition | undefined): Record<string, Record<string, number>> {
  if (!schema || evidence?.status !== "complete" || resolveCharacterAsiContributions(character, evidence).status !== "available") return {};
  const result: Record<string, Record<string, number>> = {};
  for (const grant of evidence.grants) {
    if (evidence.grants.filter(item => item.feature_slug === grant.feature_slug).length !== 1) continue;
    const controllers = evidence.refs.filter(ref => ref.id === grant.controller_ref_id && ref.content_definitions.content_type === grant.controller_type
      && ref.content_definitions.slug === grant.controller_slug);
    const features = evidence.refs.filter(ref => ref.feature_grant_id === grant.id && ref.content_id === grant.feature_content_id
      && ref.content_version === grant.feature_version && ref.content_definitions.slug === grant.feature_slug && ref.content_definitions.data.feature_type === "asi");
    if (controllers.length !== 1 || features.length !== 1) continue;
    const controller = controllers[0].content_definitions;
    const cls = character.choices.classes?.find(entry => grant.controller_type === "class" ? entry.slug === controller.slug
      : entry.subclass === controller.slug && entry.slug === controller.data.parent_class);
    const levels = controller.data.levels as Array<{ level: number; features: string[] }> | undefined;
    const unlocks = levels?.filter(row => row.features.includes(grant.feature_slug)).map(row => row.level) ?? [];
    if (!cls || cls.level < grant.unlock_level || !unlocks.length || Math.min(...unlocks) !== grant.unlock_level) continue;
    const choices = { ...character.choices, asi_choices: { ...character.choices.asi_choices } };
    delete choices.asi_choices[grant.feature_slug];
    const refs = evidence.refs.filter(ref => ref.choice_source !== `choice:asi:${grant.id}`);
    const preview = { ...character, choices };
    const sources = buildCharacterStructuredSources(refs, character.level, { character: preview, evidence: { ...evidence, refs } });
    const evaluated = evaluate({ ...character.base_stats, level: character.level }, resolveCharacterChoiceEffects(refs, choices), schema, sources, character.state);
    if (resolveAbilityMechanics(character.base_stats, evaluated, schema).status === "available") result[grant.feature_slug] = evaluated.stats;
  }
  return result;
}
