import { z } from "zod";
import { RACE_ABILITY_SLUGS } from "@/lib/engine/race-ability-scores";
import { effectSchema } from "@/lib/schemas/effects";
import { getContentTypeSchema } from "@/lib/schemas/content-types";
import type { CharacterChoices } from "@/lib/types/character";
import type { MechanicalEffect } from "@/lib/types/effects";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";

const version = z.number().int().min(1).max(2_147_483_647);
/** Validate known frozen fields while retaining raw extensions in fingerprints. */
export const frozenFeatureGrantSchema = z.object({
  id: z.uuid(), character_id: z.uuid(), controller_ref_id: z.uuid(),
  controller_type: z.enum(["class", "subclass"]), controller_slug: z.string().min(1),
  feature_content_id: z.uuid(), feature_version: version, feature_slug: z.string().min(1),
  unlock_level: z.number().int().min(1).max(20), created_at: z.iso.datetime({ offset: true }),
}).catchall(z.json());
export type FrozenFeatureGrant = z.infer<typeof frozenFeatureGrantSchema>;
export type AsiIssue = "missing_evidence" | "incomplete_evidence" | "invalid_evidence" | "unearned_choice" | "ambiguous_occurrence" | "invalid_choice";
export type AsiEvidence = { status: "complete"; character_id: string; system_id: string; refs: ContentRefWithContent[]; grants: FrozenFeatureGrant[] }
  | { status: "unavailable"; reason: AsiIssue };
export type AsiContributions = { status: "available"; effects: MechanicalEffect[]; allocations: Array<{ featureSlug: string; grantId: string; ability: string; amount: number }> }
  | { status: "unavailable"; reason: AsiIssue };
export interface AsiCharacter { id: string; system_id: string; level: number; choices: CharacterChoices }
const allocationSchema = z.strictObject({ ability: z.enum(RACE_ABILITY_SLUGS), amount: z.union([z.literal(1), z.literal(2)]) });
const choiceSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("asi"), allocations: z.array(allocationSchema).min(1).max(2) }).refine(choice =>
    choice.allocations.reduce((sum, entry) => sum + entry.amount, 0) === 2 && new Set(choice.allocations.map(entry => entry.ability)).size === choice.allocations.length),
  z.strictObject({ mode: z.literal("feat"), featId: z.uuid(), featVersion: version, featName: z.string().min(1) }),
]);
const classesSchema = z.array(z.object({ slug: z.string().min(1), level: z.number().int().min(1).max(20), subclass: z.string().min(1).optional() }));
const fail = (reason: AsiIssue): AsiContributions => ({ status: "unavailable", reason });

/** Saved shape alone supplies no authority. Never mutate or infer duplicate intent. */
export function resolveCharacterAsiContributions(character: AsiCharacter, evidence?: AsiEvidence): AsiContributions {
  if (!evidence) return fail("missing_evidence");
  if (evidence.status !== "complete") return fail(evidence.reason);
  try {
    if (evidence.character_id !== character.id || evidence.system_id !== character.system_id || !Array.isArray(evidence.refs) || !Array.isArray(evidence.grants)) return fail("incomplete_evidence");
    const classes = classesSchema.parse(character.choices.classes ?? []);
    if (!z.number().int().min(1).max(20).safeParse(character.level).success || (classes.length && classes.reduce((sum, entry) => sum + entry.level, 0) !== character.level)) return fail("invalid_evidence");
    if (new Set(classes.map(entry => entry.slug)).size !== classes.length) return fail("ambiguous_occurrence");
    const grants = z.array(frozenFeatureGrantSchema).parse(evidence.grants);
    const refs = evidence.refs;
    if (new Set(grants.map(entry => entry.id)).size !== grants.length || new Set(refs.map(entry => entry.id)).size !== refs.length) return fail("ambiguous_occurrence");
    for (const ref of refs) {
      const definition = ref.content_definitions;
      if (!z.uuid().safeParse(ref.id).success || ref.character_id !== character.id || ref.content_id !== definition.id || ref.content_version !== definition.version
        || definition.system_id !== character.system_id || !Object.hasOwn(ref, "feature_grant_id")
        || !z.uuid().nullable().safeParse(ref.feature_grant_id).success || !version.safeParse(ref.content_version).success
        || !getContentTypeSchema(definition.content_type)?.safeParse(definition.data).success || !z.array(effectSchema).safeParse(definition.effects).success) return fail("invalid_evidence");
    }
    if (grants.some(grant => grant.character_id !== character.id)) return fail("invalid_evidence");
    const derivedGrantIds = refs.flatMap(ref => ref.feature_grant_id === null ? [] : [ref.feature_grant_id]);
    if (new Set(derivedGrantIds).size !== derivedGrantIds.length) return fail("ambiguous_occurrence");
    for (const ref of refs) if (ref.feature_grant_id !== null) {
      const matches = grants.filter(grant => grant.id === ref.feature_grant_id);
      if (matches.length !== 1 || ref.content_definitions.content_type !== "feature" || ref.content_id !== matches[0].feature_content_id || ref.content_version !== matches[0].feature_version) return fail("invalid_evidence");
    }
    const saved = character.choices.asi_choices;
    if (saved !== undefined && (saved === null || typeof saved !== "object" || Array.isArray(saved))) return fail("invalid_choice");
    const chosenFeatIds = Object.values(saved ?? {}).flatMap(choice => choice?.mode === "feat" ? [choice.featId] : []);
    if (new Set(chosenFeatIds).size !== chosenFeatIds.length) return fail("ambiguous_occurrence");
    for (const ref of refs) if (ref.choice_source?.startsWith("choice:asi:")) {
      const grant = grants.find(entry => ref.choice_source === `choice:asi:${entry.id}`), choice = grant ? saved?.[grant.feature_slug] : undefined;
      if (!grant || choice?.mode !== "feat" || ref.feature_grant_id !== null || ref.content_definitions.content_type !== "feat" || ref.content_id !== choice.featId || ref.content_version !== choice.featVersion) return fail("invalid_evidence");
    }
    const effects: MechanicalEffect[] = [], allocations: Extract<AsiContributions, { status: "available" }>["allocations"] = [];
    const occurrences: Array<{ key: string; grant: FrozenFeatureGrant; choice: z.infer<typeof choiceSchema>; classIndex: number; controllerIndex: number; manifestIndex: number }> = [];
    for (const [key, rawChoice] of Object.entries(saved ?? {})) {
      const choice = choiceSchema.parse(rawChoice);
      const active = grants.filter(grant => {
        if (grant.feature_slug !== key) return false;
        const controllers = refs.filter(ref => ref.id === grant.controller_ref_id && ref.content_definitions.content_type === grant.controller_type && ref.content_definitions.slug === grant.controller_slug);
        if (controllers.length !== 1) return false;
        const controller = controllers[0].content_definitions;
        return classes.some(entry => entry.level >= grant.unlock_level && (grant.controller_type === "class" ? entry.slug === controller.slug
          : entry.slug === controller.data.parent_class && entry.subclass === controller.slug));
      });
      if (active.length !== 1) return fail(active.length ? "ambiguous_occurrence" : "unearned_choice");
      const grant = active[0], controller = refs.find(ref => ref.id === grant.controller_ref_id)!.content_definitions;
      const classIndex = classes.findIndex(entry => grant.controller_type === "class" ? entry.slug === controller.slug : entry.slug === controller.data.parent_class && entry.subclass === controller.slug);
      // A selected slug must identify one controller pin, never a catalog fallback.
      if (refs.filter(ref => ref.content_definitions.content_type === grant.controller_type && ref.content_definitions.slug === controller.slug).length !== 1) return fail("ambiguous_occurrence");
      if (grant.controller_type === "subclass" && refs.filter(ref => ref.content_definitions.content_type === "class" && ref.content_definitions.slug === controller.data.parent_class).length !== 1) return fail("invalid_evidence");
      const rows = controller.data.levels as Array<{ level: number; features: string[] }>;
      const matchingRows = rows?.filter(row => row.features.includes(key));
      if (!matchingRows?.length || Math.min(...matchingRows.map(row => row.level)) !== grant.unlock_level) return fail("invalid_evidence");
      const featureRefs = refs.filter(ref => ref.feature_grant_id === grant.id);
      if (featureRefs.length !== 1) return fail(featureRefs.length ? "ambiguous_occurrence" : "incomplete_evidence");
      const feature = featureRefs[0].content_definitions;
      if (feature.content_type !== "feature" || feature.id !== grant.feature_content_id || feature.version !== grant.feature_version || feature.slug !== key || feature.data.feature_type !== "asi"
        || feature.data.class !== classes[classIndex].slug || (grant.controller_type === "subclass" && feature.data.subclass !== controller.slug)) return fail("invalid_evidence");
      if (choice.mode === "feat") {
        const featRefs = refs.filter(ref => ref.choice_source === `choice:asi:${grant.id}`);
        if (featRefs.length !== 1 || featRefs[0].feature_grant_id !== null || featRefs[0].content_id !== choice.featId || featRefs[0].content_version !== choice.featVersion || featRefs[0].content_definitions.content_type !== "feat") return fail("invalid_evidence");
      } else if (refs.some(ref => ref.choice_source === `choice:asi:${grant.id}`)) return fail("invalid_evidence");
      occurrences.push({ key, grant, choice, classIndex, controllerIndex: refs.findIndex(ref => ref.id === grant.controller_ref_id), manifestIndex: rows.findIndex(row => row.features.includes(key)) });
    }
    occurrences.sort((a, b) => a.classIndex - b.classIndex || a.controllerIndex - b.controllerIndex || a.manifestIndex - b.manifestIndex || a.grant.id.localeCompare(b.grant.id));
    for (const occurrence of occurrences) if (occurrence.choice.mode === "asi") for (const entry of occurrence.choice.allocations) {
      allocations.push({ featureSlug: occurrence.key, grantId: occurrence.grant.id, ...entry });
      effects.push({ type: "mechanical", stat: entry.ability, op: "add", value: entry.amount });
    }
    return { status: "available", effects, allocations };
  } catch { return fail("invalid_evidence"); }
}
