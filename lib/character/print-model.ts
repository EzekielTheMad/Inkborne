import type { CharacterContextValue } from "@/lib/character/character-context";
import type { ParsedContentDefinition } from "@/lib/supabase/content-definitions-parser";
import { formatModifier, getSaveModifier, getSkillModifier } from "@/lib/sheet/helpers";
import { getWeaponAttack, getWeaponDisplay } from "@/lib/sheet/weapon-attack";
import { getItemData } from "@/lib/inventory/helpers";
import { resolveCastingMath } from "@/lib/spells/casting-math";
import { assertAbilityMechanics, getConfirmedAbilityModifier } from "@/lib/character/ability-mechanics";

export interface PrintEntry { name: string; details: string; description: string; pin: string }
export type CharacterPrintInput = Pick<CharacterContextValue,
  "character" | "schema" | "evalResult" | "mechanics" | "assertMechanics" | "state" | "isOwner" | "hasSheet" | "reloadRequired" |
  "patchState" | "rollPersistencePending" | "rollPersistenceUncertain" | "pendingConcentrationCheck" |
  "contentRefs" | "contentSnapshotsComplete" | "inventory" | "currency" | "spells" | "slotResolution" | "maxSlots" | "slotState" | "pactSlotLevel" |
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

function assertIdentity(row: { character_id?: string; content_definitions?: ParsedContentDefinition | null }, character: CharacterPrintInput["character"]): void {
  if ((row.character_id !== undefined && row.character_id !== character.id) ||
    (row.content_definitions?.system_id !== undefined && row.content_definitions.system_id !== character.system_id)) {
    throw new Error("A saved content record belongs to another character or game system. Reload before printing.");
  }
}

/** Snapshot only paper-safe mechanical fields. Never serialize the context,
 * character narrative, arbitrary JSON, DM notes, campaign pages or item notes. */
export function buildCharacterPrintModel(ctx: CharacterPrintInput, capturedAt = new Date().toISOString()): CharacterPrintModel {
  const { character, schema, evalResult: result, state } = ctx;
  ctx.assertMechanics({ computed: ["proficiency_bonus", "initiative"], values: [ctx.maxHp] });
  assertAbilityMechanics(ctx.mechanics, result, schema, { abilities: schema.ability_scores.map(entry => entry.slug), computed: ["proficiency_bonus", "initiative"], values: [ctx.maxHp] });
  if (!ctx.isOwner || !ctx.hasSheet) throw new Error("Print is available for your completed character sheets.");
  const resolution = ctx.slotResolution;
  if (resolution?.status !== "available") throw new Error("Spell slots are unavailable. Reload the character or restore its saved class content before printing.");
  const castingProfiles = ctx.casterInfo.classes.map(caster => {
    const normal = resolveCastingMath(caster.ability, schema.ability_scores, result.stats, result.computed.proficiency_bonus);
    const modifier = getConfirmedAbilityModifier(result, schema, caster.ability), proficiency = result.computed.proficiency_bonus;
    if (normal.status !== "available" || modifier === null || !Number.isFinite(modifier + proficiency + 8)) return { status: "unavailable" as const, reason: "Saved casting values are unavailable." };
    return { ...normal, abilityModifier: modifier, spellAttackBonus: modifier + proficiency, spellDc: 8 + modifier + proficiency };
  });
  if (ctx.casterInfo.castingMathStatus === "unavailable" || castingProfiles.some(math => math.status !== "available")) throw new Error("Casting values are unavailable. Reload or restore the saved ability/class content before printing.");
  if (!ctx.contentSnapshotsComplete) throw new Error("A saved content version is unavailable. Reload the character before printing.");
  if (ctx.reloadRequired || ctx.patchState.hasPendingWrites() || ctx.rollPersistencePending ||
    ctx.rollPersistenceUncertain || ctx.pendingConcentrationCheck) {
    throw new Error("Finish saving and resolve pending play actions before printing. Reload if a save is uncertain.");
  }
  for (const row of [...ctx.contentRefs, ...ctx.inventory, ...ctx.spells]) assertIdentity(row, character);
  for (const ref of ctx.contentRefs) pin(ref.content_id, ref.content_version, ref.content_definitions);
  const bonus = result.computed.proficiency_bonus ?? 0;
  const abilityMod = (slug: string) => {
    const modifier = getConfirmedAbilityModifier(result, schema, slug);
    if (modifier === null) throw new Error("A saved ability modifier is unavailable.");
    return modifier;
  };
  const skills = [...schema.skills].sort((a, b) => a.name.localeCompare(b.name)).map(skill => {
    const modifier = getSkillModifier(abilityMod(skill.ability), bonus, result.grants, skill.slug);
    return { name: skill.name, modifier: formatModifier(modifier), passive: 10 + modifier };
  });
  const slots = Object.entries(resolution.maxSlots).map(([level, max]) => {
    const used = ctx.slotState[level as keyof typeof ctx.slotState] ?? 0;
    const name = level === "pact" ? `Pact slots (level ${resolution.pactSlotLevel ?? "?"})` : `Level ${level} slots`;
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
    ...ctx.casterInfo.classes.flatMap((caster, index) => {
      const math = castingProfiles[index];
      return math.status === "available" ? [{ name: `${label(caster.slug)} spellcasting`, value: `DC ${math.spellDc}; attack ${formatModifier(math.spellAttackBonus)}; ${label(caster.ability)}` }] : [];
    }),
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
      const attack = getWeaponAttack(def.name, def.slug, data, result, schema);
      return { name: def.name, details: [`Hit ${attack.hitBonus}`, attack.damageExpression ? `Damage ${attack.damage}` : attack.damage, attack.range, attack.properties].filter(Boolean).join(" | "), description: text(data.description), pin: pin(ref.content_id, ref.content_version, def) };
    }),
    inventory: ctx.inventory.map(item => {
      const source = pin(item.content_id, item.content_version, item.content_definitions);
      const data = getItemData(item);
      const display = getWeaponDisplay(data);
      const damage = display.damageText ?? (item.content_type === "weapon" ? "Damage unavailable" : "");
      const details = [`Quantity ${item.quantity}`, item.equipped ? "Equipped" : "Carried", item.attuned ? "Attuned" : "", data.weight != null ? `${text(data.weight)} lb each` : "", damage, display.range, display.properties].filter(Boolean).join(" | ");
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
