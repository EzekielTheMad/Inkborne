import { z } from "zod";
import { DAMAGE_TYPES, type DamageType } from "@/lib/types/taxonomies";
import { effectSchema } from "@/lib/schemas/effects";
import type { AsiCharacter, AsiEvidence } from "./asi-contributions";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";

export type AncestryDefenses = { status: "available"; dmgres: DamageType[] }
  | { status: "unavailable"; reason: "incomplete_evidence" | "invalid_ancestry" };
const uuid = z.uuid(), version = z.number().int().min(1).max(2_147_483_647);
const fixedResistance = z.strictObject({ type: z.literal("grant"), stat: z.literal("dmgres"), value: z.enum(DAMAGE_TYPES) });
const traitChoice = z.strictObject({ type: z.literal("choice"), choose: z.number().int().min(1).max(100),
  from: z.array(z.string().min(1).max(200)).min(1).max(128), grant_type: z.literal("trait"), choice_id: z.string().min(1).max(200) });
const unavailable = (reason: "incomplete_evidence" | "invalid_ancestry"): AncestryDefenses => ({ status: "unavailable", reason });

/** Check the original snapshot BEFORE the general parser strips unknown keys.
 * The shipped grant/choice schemas define exactly these three/five keys.
 * Conditional or otherwise unsupported declarations must not become fixed ones.
 */
export function ancestryResistanceDeclarationsSupported(type: unknown, effects: unknown): boolean {
  if (!["race", "subrace", "trait"].includes(type as string)) return true;
  return Array.isArray(effects) && effects.every(effect => {
    if (!effect || typeof effect !== "object" || Array.isArray(effect)) return true;
    if (effect.type === "grant" && effect.stat === "dmgres") return fixedResistance.safeParse(effect).success;
    if (effect.type === "choice" && effect.grant_type === "trait") return traitChoice.safeParse(effect).success;
    return true;
  });
}

/** Project only explicit fixed resistance declarations in the selected, owned
 * ancestry closure. No catalog lookup, name mapping or generic grant activation.
 */
export function resolveOwnedAncestryDefenses(character: AsiCharacter, evidence?: AsiEvidence): AncestryDefenses {
  if (evidence?.status !== "complete") return unavailable("incomplete_evidence");
  try {
    if (evidence.character_id !== character.id || evidence.system_id !== character.system_id
      || !uuid.safeParse(character.id).success || !uuid.safeParse(character.system_id).success
      || evidence.refs.length > 4096 || new Set(evidence.refs.map(ref => ref.id)).size !== evidence.refs.length) return unavailable("invalid_ancestry");
    const refs = evidence.refs, roots = refs.filter(ref => ["race", "subrace"].includes(ref.content_definitions.content_type));
    const exact = (ref: ContentRefWithContent) => uuid.safeParse(ref.id).success && ref.character_id === character.id
      && uuid.safeParse(ref.content_id).success && version.safeParse(ref.content_version).success
      && ref.content_id === ref.content_definitions.id && ref.content_version === ref.content_definitions.version
      && ref.content_definitions.system_id === character.system_id
      && ["srd", "homebrew"].includes(ref.content_definitions.source)
      && ["platform", "personal", "shared"].includes(ref.content_definitions.scope ?? "")
      && (ref.content_definitions.owner_id === null || uuid.safeParse(ref.content_definitions.owner_id).success)
      && ref.content_definitions.data !== null && typeof ref.content_definitions.data === "object" && !Array.isArray(ref.content_definitions.data)
      && z.array(effectSchema).safeParse(ref.content_definitions.effects).success
      && ancestryResistanceDeclarationsSupported(ref.content_definitions.content_type, ref.content_definitions.effects);
    const strings = (value: unknown): string[] => {
      if (value === undefined) return [];
      if (!Array.isArray(value) || value.length > 128 || value.some(item => typeof item !== "string" || !item.length || item.length > 200)) throw Error("Invalid ancestry source array");
      return value;
    };
    for (const type of ["race", "subrace"] as const) {
      const pins = roots.filter(ref => ref.content_definitions.content_type === type), slug = character.choices[type];
      if (pins.length !== (slug ? 1 : 0) || slug && pins[0]?.content_definitions.slug !== slug) return unavailable("invalid_ancestry");
    }
    if (roots.some(ref => !exact(ref) || ref.feature_grant_id !== null || ref.choice_source !== null
      || ref.context.source !== ref.content_definitions.content_type || Object.keys(ref.context).length !== 1)) return unavailable("invalid_ancestry");
    const race = roots.find(ref => ref.content_definitions.content_type === "race"), subrace = roots.find(ref => ref.content_definitions.content_type === "subrace");
    if (subrace && (!race || subrace.content_definitions.data.parent_race !== race.content_definitions.slug)) return unavailable("invalid_ancestry");
    const rootsById = new Map(roots.map(ref => [ref.id, ref]));
    const traits = refs.filter(ref => ref.content_definitions.content_type === "trait"
      && (ref.context.source === "racial_trait" || ref.choice_source?.startsWith("builder:racial-trait:")));
    if (new Set(traits.map(ref => ref.content_id)).size !== traits.length || traits.some(ref => !exact(ref)
      || ref.feature_grant_id !== null || ref.choice_source !== `builder:racial-trait:${ref.content_definitions.slug}`
      || ref.context.source !== "racial_trait" || Object.keys(ref.context).length !== 2
      || typeof ref.context.root_controller_ref_id !== "string" || !rootsById.has(ref.context.root_controller_ref_id))) return unavailable("invalid_ancestry");
    const matchesScope = (trait: ContentRefWithContent, root: ContentRefWithContent) => {
      const races = strings(trait.content_definitions.data.races), subraces = strings(trait.content_definitions.data.subraces);
      return !races.length && !subraces.length || (root.content_definitions.content_type === "race"
        ? races.includes(root.content_definitions.slug)
        : subraces.includes(root.content_definitions.slug) || races.includes(root.content_definitions.data.parent_race as string));
    };
    const selections = character.choices.resolved_choices;
    if (selections !== undefined && (!selections || typeof selections !== "object" || Array.isArray(selections))) return unavailable("invalid_ancestry");
    const resistances = new Set<DamageType>(), visited = new Map<string, Set<string>>();
    const collect = (ref: ContentRefWithContent) => {
      for (const effect of ref.content_definitions.effects) if (effect.type === "grant" && effect.stat === "dmgres") {
        const fixed = fixedResistance.safeParse(effect);
        if (!fixed.success) throw Error("Unsupported ancestry resistance");
        resistances.add(fixed.data.value);
      }
    };
    let edges = 0;
    const visit = (slug: string, root: ContentRefWithContent, active: Set<string>) => {
      if (++edges > 128) throw Error("Ancestry closure exceeds bound");
      const named = traits.filter(ref => ref.content_definitions.slug === slug);
      const owned = named.filter(ref => ref.context.root_controller_ref_id === root.id);
      const candidates = owned.length ? owned : named, trait = candidates[0];
      if (candidates.length !== 1 || !matchesScope(trait, root) || active.has(trait.content_id)) throw Error("Missing, conflicting or cyclic ancestry dependency");
      const reached = visited.get(trait.id) ?? new Set<string>();
      if (reached.has(root.id)) return; // Native same-version convergent edges share one pin.
      reached.add(root.id); visited.set(trait.id, reached);
      collect(trait);
      const nextActive = new Set(active).add(trait.content_id);
      for (const choice of trait.content_definitions.effects) if (choice.type === "choice" && choice.grant_type === "trait") {
        if (!Number.isInteger(choice.choose) || choice.choose < 1 || choice.choose > 100 || !choice.choice_id || choice.choice_id.length > 200
          || !Array.isArray(choice.from) || strings(choice.from).length === 0
          || refs.flatMap(ref => ref.content_definitions.effects).filter(effect => effect.type === "choice" && effect.choice_id === choice.choice_id).length !== 1) throw Error("Ambiguous ancestry choice");
        const options = strings(choice.from);
        const picked = selections && Object.hasOwn(selections, choice.choice_id) ? selections[choice.choice_id] : [];
        if (!Array.isArray(picked) || picked.length > choice.choose || new Set(picked).size !== picked.length
          || picked.some(value => typeof value !== "string" || !options.includes(value))) throw Error("Invalid saved ancestry choice");
        for (const child of picked) visit(child, root, nextActive);
      }
    };
    for (const root of roots) {
      collect(root);
      for (const slug of strings(root.content_definitions.data.traits)) visit(slug, root, new Set());
    }
    // Every native ancestry pin must be reached from its actual saved owner,
    // including a pin shared by legitimate convergent declared dependencies.
    if (traits.some(ref => !visited.get(ref.id)?.has(ref.context.root_controller_ref_id as string))) return unavailable("invalid_ancestry");
    return { status: "available", dmgres: [...resistances] };
  } catch { return unavailable("invalid_ancestry"); }
}
