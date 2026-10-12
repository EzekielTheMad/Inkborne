import type { CharacterContextValue } from "@/lib/character/character-context";
import type { ParsedContentDefinition } from "@/lib/supabase/content-definitions-parser";
import { formatModifier, getSaveModifier, getSkillModifier, isProficient } from "@/lib/sheet/helpers";
import { getItemData } from "@/lib/inventory/helpers";

export interface PrintEntry { name: string; details: string; description: string; pin: string }
export type CharacterPrintInput = Pick<CharacterContextValue,
  "character" | "schema" | "evalResult" | "state" | "isOwner" | "hasSheet" | "reloadRequired" |
  "patchState" | "rollPersistencePending" | "rollPersistenceUncertain" | "pendingConcentrationCheck" |
  "contentRefs" | "contentSnapshotsComplete" | "inventory" | "currency" | "spells" | "maxSlots" | "slotState" | "pactSlotLevel" |
  "hitDicePools" | "resources" | "casterInfo" | "concentration" | "maxHp">;
export interface CharacterPrintModel {
  name: string;
  identity: string;
  capturedAt: string;
  abilities: Array<{ name: string; score: number; modifier: string; save: string }>;
  skills: Array<{ name: string; modifier: string; passive: number }>;
  stats: Array<{ name: string; value: string }>;
  proficiencies: string[];
  inventory: PrintEntry[];
  attacks: PrintEntry[];
  spells: PrintEntry[];
  features: PrintEntry[];
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
function list(value: unknown): string {
  return Array.isArray(value) ? value.map(text).filter(Boolean).join(", ") : text(value);
}
function label(slug: string): string { return slug.replace(/[_-]/g, " "); }
function pin(id: string | null, version: number | null, definition: ParsedContentDefinition | null | undefined): string {
  if (id === null && version === null) return "Custom entry";
  if (!id || !version || !definition || definition.id !== id || definition.version !== version) {
    throw new Error("A saved content version is unavailable. Reload the character before printing.");
  }
  return `${definition.name} v${version}`;
}

/** Snapshot only paper-safe mechanical fields. Never serialize the context,
 * character narrative, arbitrary JSON, DM notes, campaign pages or item notes. */
export function buildCharacterPrintModel(ctx: CharacterPrintInput, capturedAt = new Date().toISOString()): CharacterPrintModel {
  const { character, schema, evalResult: result, state } = ctx;
  if (!ctx.isOwner || !ctx.hasSheet) throw new Error("Print is available for your completed character sheets.");
  if (!ctx.contentSnapshotsComplete) throw new Error("A saved content version is unavailable. Reload the character before printing.");
  if (ctx.reloadRequired || ctx.patchState.hasPendingWrites() || ctx.rollPersistencePending ||
    ctx.rollPersistenceUncertain || ctx.pendingConcentrationCheck) {
    throw new Error("Finish saving and resolve pending play actions before printing. Reload if a save is uncertain.");
  }
  for (const ref of ctx.contentRefs) pin(ref.content_id, ref.content_version, ref.content_definitions);
  const bonus = result.computed.proficiency_bonus ?? 0;
  const abilityMod = (slug: string) => result.stats[`${slug}_mod`] ?? Math.floor(((result.stats[slug] ?? 10) - 10) / 2);
  const skills = [...schema.skills].sort((a, b) => a.name.localeCompare(b.name)).map(skill => {
    const modifier = getSkillModifier(abilityMod(skill.ability), bonus, result.grants, skill.slug);
    return { name: skill.name, modifier: formatModifier(modifier), passive: 10 + modifier };
  });
  const slots = Object.entries(ctx.maxSlots).map(([level, max]) => {
    const used = ctx.slotState[level as keyof typeof ctx.slotState] ?? 0;
    const name = level === "pact" ? `Pact slots (level ${ctx.pactSlotLevel ?? "?"})` : `Level ${level} slots`;
    return { name, value: `${Math.max(0, Math.min(max, max - used))}/${max} remaining` };
  });
  const classNames = (character.choices.classes ?? []).map(choice => {
    const def = ctx.contentRefs.find(ref => ref.content_definitions.content_type === "class" && ref.content_definitions.slug === choice.slug)?.content_definitions;
    return `${def?.name ?? label(choice.slug)} ${choice.level}${choice.subclass ? ` (${label(choice.subclass)})` : ""}`;
  });
  const stats = [
    { name: "HP", value: `${state.current_hp ?? ctx.maxHp}/${ctx.maxHp} (${state.temp_hp ?? 0} temporary)` },
    { name: "Armor class", value: text(result.computed.armor_class ?? result.computed.ac ?? 10) },
    { name: "Initiative", value: formatModifier(result.computed.initiative ?? abilityMod("dexterity")) },
    { name: "Proficiency bonus", value: formatModifier(bonus) },
    { name: "Movement", value: Object.entries(result.speed).map(([kind, distance]) => `${label(kind)} ${distance} ft`).join(", ") },
    { name: "Attacks per action", value: text(result.attacks) },
    { name: "Inspiration", value: state.inspiration ? "Yes" : "No" },
    { name: "Conditions", value: `${(state.conditions ?? []).join(", ") || "None"}; exhaustion ${state.exhaustion ?? 0}` },
    { name: "Death saves", value: `${state.death_saves?.successes ?? 0} successes / ${state.death_saves?.failures ?? 0} failures` },
    { name: "Hit dice", value: ctx.hitDicePools.map(pool => `${label(pool.classSlug)} ${pool.max - pool.spent}/${pool.max} d${pool.die}`).join(", ") || "None" },
    { name: "Vision", value: result.vision.map(entry => `${entry.type} ${entry.range} ft`).join(", ") || "Normal" },
    { name: "Resistances", value: result.dmgres.join(", ") || "None" },
    { name: "Save advantages", value: result.savetxt.adv_vs.join(", ") || "None" },
    { name: "Immunities", value: result.savetxt.immune.join(", ") || "None" },
    { name: "Currency", value: Object.entries(ctx.currency).map(([kind, amount]) => `${amount} ${kind}`).join(" / ") },
    { name: "Concentration", value: ctx.concentration?.spell_name ?? "None" },
    { name: "Active effects", value: (state.active_effects ?? []).map(effect => `${effect.name} (${effect.duration.type}${"value" in effect.duration ? ` ${effect.duration.value}` : ""})`).join(", ") || "None" },
    ...ctx.resources.map(resource => ({ name: resource.name, value: `${Math.max(0, Math.min(resource.max, resource.max - (state.feature_uses?.[resource.slug] ?? 0)))}/${resource.max}; ${resource.recovery} rest` })),
    ...ctx.casterInfo.classes.map(caster => ({ name: `${label(caster.slug)} spellcasting`, value: `DC ${8 + bonus + abilityMod(caster.ability)}; attack ${formatModifier(bonus + abilityMod(caster.ability))}; ${label(caster.ability)}` })),
    ...slots,
  ];
  return {
    name: character.name,
    identity: `${character.game_systems.name} | Level ${character.level} | ${classNames.join(" / ")} | ${label(character.choices.race ?? "")} | ${label(character.choices.background ?? "")}`,
    capturedAt,
    abilities: schema.ability_scores.map(ability => ({ name: ability.name, score: result.stats[ability.slug] ?? 10, modifier: formatModifier(abilityMod(ability.slug)), save: formatModifier(getSaveModifier(abilityMod(ability.slug), bonus, result.grants, `saving_throw_${ability.slug}`)) })),
    skills,
    stats,
    proficiencies: [...new Set(result.grants.filter(grant => grant.value === "proficient" || grant.value === "expertise").map(grant => `${label(grant.stat)} (${grant.value})`))],
    attacks: ctx.contentRefs.filter(ref => ref.content_definitions.content_type === "weapon").map(ref => {
      const def = ref.content_definitions, data = def.data;
      // Keep the existing sheet's weapon ability/proficiency calculation. The
      // evaluated stats already include the current character's active effects.
      const properties = list(data.properties), range = text(data.range) || "5 ft";
      const ranged = text(data.weapon_type).includes("ranged") || range.includes("/");
      const modifier = properties.toLowerCase().includes("finesse") ? Math.max(abilityMod("strength"), abilityMod("dexterity")) : abilityMod(ranged ? "dexterity" : "strength");
      const proficient = [def.slug, `weapon_${def.slug}`, "simple_weapons", "martial_weapons"].some(slug => isProficient(result.grants, slug));
      return { name: def.name, details: `Hit ${formatModifier(modifier + (proficient ? bonus : 0))} | Damage ${text(data.damage) || "1d4"} ${formatModifier(modifier)} ${text(data.damage_type)} | ${range} | ${properties}`, description: text(data.description), pin: pin(ref.content_id, ref.content_version, def) };
    }),
    inventory: ctx.inventory.map(item => {
      const source = pin(item.content_id, item.content_version, item.content_definitions);
      const data = getItemData(item);
      const details = [`Quantity ${item.quantity}`, item.equipped ? "Equipped" : "Carried", item.attuned ? "Attuned" : "", data.weight != null ? `${text(data.weight)} lb each` : "", text(data.damage), text(data.damage_type), text(data.range), list(data.properties)].filter(Boolean).join(" | ");
      return { name: item.name, details, description: text(data.description), pin: source };
    }),
    spells: ctx.spells.map(spell => {
      const source = pin(spell.content_id, spell.content_version, spell.content_definitions);
      const data = spell.content_definitions?.data ?? spell.custom_data ?? {};
      const flags = [spell.is_known ? "Known" : "", spell.is_prepared ? "Prepared" : "", spell.always_prepared ? "Always prepared" : "", spell.in_spellbook ? "Spellbook" : "", data.concentration ? "Concentration" : "", data.ritual ? "Ritual" : ""];
      return { name: spell.name, details: [`Level ${text(data.level) || "0"}`, label(spell.class_slug), text(data.school), ...flags, text(data.casting_time), text(data.range), text(data.duration), list(data.components), text(data.material)].filter(Boolean).join(" | "), description: [text(data.description), text(data.higher_level)].filter(Boolean).join("\n\n"), pin: source };
    }),
    features: ctx.contentRefs.filter(ref => !["weapon", "spell", "armor", "equipment", "item", "magic_item"].includes(ref.content_definitions.content_type)).map(ref => {
      const def = ref.content_definitions;
      const feature = def.data.feature && typeof def.data.feature === "object" ? def.data.feature as Record<string, unknown> : {};
      return { name: text(feature.name) || def.name, details: [label(def.content_type), text(def.data.action_type ?? def.data.action)].filter(Boolean).join(" | "), description: text(feature.description) || text(def.data.description), pin: pin(ref.content_id, ref.content_version, def) };
    }),
  };
}
