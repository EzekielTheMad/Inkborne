import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { CasterClass, SlotResolution } from "@/lib/types/spells";
import { subclassDataSchema } from "@/lib/schemas/content-types/subclass";
import { resolveSpellSlots } from "./slot-resolution";

export type PreparationRule = "parent" | "class-level-plus-ability" | "half-class-level-plus-ability";
export interface EffectiveCastingSource {
  classSlug: string;
  classLevel: number;
  kind: "class" | "subclass";
  subclassSlug?: string;
  parentPin: { contentId: string; version: number };
  subclassPin?: { contentId: string; version: number };
  active: boolean;
  config: { type: CasterClass["type"]; ability: string; focus?: string; ritual_casting?: boolean } | null;
  cantripsKnown: number;
  spellsKnown: number | "all";
  prepared: boolean;
  preparationRule: PreparationRule;
  spellList: { class: string; level: [number, number] };
  directSlots: number[];
  maxLearnableLevel: number;
}
export type EffectiveCastingResolution =
  | { status: "available"; sources: EffectiveCastingSource[]; slots: Extract<SlotResolution, { status: "available" }> }
  | { status: "unavailable"; reason: string };

function exactRef(type: string, slug: string, refs: ContentRefWithContent[], character: { id: string; system_id: string }) {
  const matches = refs.filter(ref => ref?.content_definitions?.content_type === type && ref.content_definitions.slug === slug);
  const ref = matches[0];
  if (matches.length !== 1 || !ref || typeof ref.content_id !== "string" || !ref.content_id || ref.character_id !== character.id ||
    ref.content_definitions.system_id !== character.system_id || ref.content_id !== ref.content_definitions.id ||
    ref.content_version !== ref.content_definitions.version || !Number.isInteger(ref.content_version) || ref.content_version < 1) return null;
  return ref;
}

/** One validated profile per selected parent class; grant-only subclasses inherit.
 * No current-catalog lookup, slot fallback or subclass-as-a-second-class. */
export function resolveEffectiveCastingSources(classes: unknown, refs: ContentRefWithContent[], character: { id: string; system_id: string }): EffectiveCastingResolution {
  const unavailable = (detail: string): EffectiveCastingResolution => ({ status: "unavailable", reason: `Spell slots are unavailable: ${detail}. Reload the character or restore its saved class/subclass content.` });
  if (!Array.isArray(classes)) return unavailable("invalid class choices");
  const sources: EffectiveCastingSource[] = [];
  const profiles: Record<string, unknown> = Object.create(null);
  const seen = new Set<string>();
  for (const choice of classes) {
    if (!choice || typeof choice.slug !== "string" || !choice.slug.trim() || seen.has(choice.slug) ||
      !Number.isInteger(choice.level) || choice.level < 1 || choice.level > 20 ||
      (choice.subclass !== undefined && (typeof choice.subclass !== "string" || !choice.subclass.trim()))) return unavailable("invalid or ambiguous selected classes");
    seen.add(choice.slug);
    const parent = exactRef("class", choice.slug, refs, character);
    if (!parent) return unavailable("a saved parent class version is missing or ambiguous");
    const parentData = parent.content_definitions.data;
    // Retain the shipped parent slot validator and all its absence/null rules.
    const parentSlots = resolveSpellSlots([choice], { [choice.slug]: parentData });
    if (parentSlots.status !== "available") return unavailable("invalid saved parent progression");
    let data = parentData;
    let kind: EffectiveCastingSource["kind"] = "class";
    let subclass: ContentRefWithContent | null = null;
    let preparationRule: PreparationRule = "parent";
    if (choice.subclass !== undefined) {
      subclass = exactRef("subclass", choice.subclass, refs, character);
      if (!subclass) return unavailable("a selected subclass version is missing or ambiguous");
      const parsed = subclassDataSchema.safeParse(subclass.content_definitions.data);
      if (!parsed.success || parsed.data.parent_class !== choice.slug) return unavailable("invalid selected subclass or parent pairing");
      const sub = parsed.data;
      // Grants/legacy spells are intentionally excluded from source markers.
      const metadataMarker = Object.hasOwn(sub, "spellcastingKnown") || Object.hasOwn(sub, "spellcastingList") || Object.hasOwn(sub, "preparation_rule");
      const rowMarker = sub.levels.some(row => Object.hasOwn(row, "spellcasting"));
      const inherit = (!Object.hasOwn(sub, "spellcasting") && !metadataMarker && !rowMarker) ||
        (sub.spellcasting === null && !metadataMarker && sub.levels.every(row => row.spellcasting === undefined || row.spellcasting === null));
      if (!inherit) {
        if (!sub.spellcasting || !sub.spellcastingKnown || !sub.spellcastingList) return unavailable("incomplete subclass casting profile");
        if (parentData.spellcasting !== null) return unavailable("parent and subclass both declare casting profiles");
        if (sub.spellcastingKnown.prepared && !sub.preparation_rule) return unavailable("missing subclass preparation rule");
        const selected = sub.levels.filter(row => row.level === choice.level);
        if (selected.length !== 1 || selected[0].spellcasting === undefined) return unavailable("missing or duplicate selected subclass casting row");
        const row = selected[0].spellcasting;
        if (row && row.cantrips_known !== undefined && row.cantrips_known !== sub.spellcastingKnown.cantrips[choice.level - 1]) return unavailable("conflicting subclass cantrip counts");
        data = sub as unknown as Record<string, unknown>;
        kind = "subclass";
        preparationRule = sub.spellcastingKnown.prepared ? sub.preparation_rule! : "parent";
      }
    }
    const slotValidation = resolveSpellSlots([choice], { [choice.slug]: data });
    if (slotValidation.status !== "available") return unavailable("invalid effective casting progression");
    profiles[choice.slug] = data;
    const rows = data.levels as Array<{ level: number; spellcasting: { spell_slots: number[] } | null }>;
    const selected = rows.find(row => row.level === choice.level)!;
    const config = data.spellcasting as EffectiveCastingSource["config"];
    const active = selected.spellcasting !== null;
    const directSlots = active ? selected.spellcasting!.spell_slots : [];
    const known = data.spellcastingKnown as { cantrips?: number[]; spells?: number[] | "all"; prepared?: boolean } | undefined;
    const spellList = (data.spellcastingList ?? { class: choice.slug, level: [0, 9] }) as EffectiveCastingSource["spellList"];
    sources.push({ classSlug: choice.slug, classLevel: choice.level, kind, subclassSlug: choice.subclass,
      parentPin: { contentId: parent.content_id, version: parent.content_version },
      ...(subclass ? { subclassPin: { contentId: subclass.content_id, version: subclass.content_version } } : {}),
      active, config, prepared: known?.prepared ?? false, preparationRule, spellList, directSlots,
      cantripsKnown: known?.cantrips?.[choice.level - 1] ?? 0,
      spellsKnown: known?.spells === "all" || known?.spells === undefined ? "all" : known.spells[choice.level - 1] ?? 0,
      maxLearnableLevel: directSlots.reduce((max, count, index) => count > 0 ? index + 1 : max, 0) });
  }
  const slots = resolveSpellSlots(classes, profiles);
  return slots.status === "available" ? { status: "available", sources, slots } : unavailable("invalid combined casting progression");
}
