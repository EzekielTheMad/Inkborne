import type { EvaluationResult } from "@/lib/engine/evaluator";
import type { WeaponData } from "@/lib/schemas/content-types/weapon";
import { parseDiceExpression } from "@/lib/dice/parser";
import { formatSignedTerm } from "@/lib/rolls/requests";
import { formatModifier, isProficient } from "@/lib/sheet/helpers";

export interface WeaponDisplay {
  damageDice: string | null;
  damageType: string;
  damageText: string | null;
  range: string | null;
  properties: string;
  finesse: boolean;
  ranged: boolean;
  category: string;
}
export interface WeaponAttack {
  name: string;
  range: string;
  hitBonus: string;
  hitBonusValue: number;
  damage: string;
  damageExpression: string | null;
  damageType: string;
  properties: string;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function positiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Canonical nested weapon fields, with only the prior legitimate string
 * display shapes retained. Unknown damage/range stays unavailable. */
export function getWeaponDisplay(data: WeaponData | Record<string, unknown>): WeaponDisplay {
  const damage = record(data.damage), rangeData = record(data.range);
  const damageDice = text(damage?.dice) || text(data.damage) || null;
  const damageType = text(damage?.type) || text((data as Record<string, unknown>).damage_type);
  const range = positiveNumber(rangeData?.normal)
    ? `${rangeData.normal}${positiveNumber(rangeData.long) ? `/${rangeData.long}` : ""} ft`
    : text(data.range) || null;
  const properties = Array.isArray(data.properties) ? data.properties.filter((property): property is string => typeof property === "string") : [];
  const canonicalRange = text(data.weapon_range).toLowerCase();
  const legacyRange = text((data as Record<string, unknown>).weapon_type).toLowerCase();
  const ranged = canonicalRange === "ranged" ? true : canonicalRange === "melee" ? false
    : legacyRange.includes("ranged") ? true : legacyRange.includes("melee") ? false
    : typeof data.range === "string" && data.range.includes("/");
  return {
    damageDice, damageType,
    damageText: damageDice ? [damageDice, damageType].filter(Boolean).join(" ") : null,
    range, properties: properties.join(", "),
    finesse: properties.some(property => property.toLowerCase() === "finesse"),
    ranged, category: text(data.weapon_category).toLowerCase(),
  };
}

/** Normal STR/DEX weapon math shared by the interactive and paper sheets.
 * Does not invent special weapon rules, dice, or proficiency for unknown data. */
export function getWeaponAttack(
  name: string,
  slug: string,
  data: WeaponData | Record<string, unknown>,
  result: EvaluationResult,
): WeaponAttack {
  const display = getWeaponDisplay(data);
  const modifierFor = (ability: string) => {
    const effective = result.stats[`${ability}_mod`];
    if (typeof effective === "number" && Number.isFinite(effective)) return effective;
    const score = result.stats[ability];
    return typeof score === "number" && Number.isFinite(score) ? Math.floor((score - 10) / 2) : 0;
  };
  const strength = modifierFor("strength"), dexterity = modifierFor("dexterity");
  const abilityModifier = display.finesse ? Math.max(strength, dexterity) : display.ranged ? dexterity : strength;
  const categoryGrant = display.category === "simple" ? "simple_weapons" : display.category === "martial" ? "martial_weapons" : null;
  const proficient = isProficient(result.grants, slug) || isProficient(result.grants, `weapon_${slug}`) ||
    (categoryGrant !== null && isProficient(result.grants, categoryGrant));
  const hitBonusValue = abilityModifier + (proficient ? result.computed.proficiency_bonus ?? 0 : 0);
  let damageExpression: string | null = null;
  if (display.damageDice) {
    const expression = `${display.damageDice}${formatSignedTerm(abilityModifier)}`;
    try { parseDiceExpression(expression); damageExpression = expression; } catch { /* Manual/unknown damage is not a roll request. */ }
  }
  return {
    name, range: display.range ?? "Range unavailable", hitBonus: formatModifier(hitBonusValue), hitBonusValue,
    damage: damageExpression ? [display.damageDice, formatModifier(abilityModifier), display.damageType].filter(Boolean).join(" ") : "Damage unavailable",
    damageExpression, damageType: display.damageType, properties: display.properties,
  };
}
