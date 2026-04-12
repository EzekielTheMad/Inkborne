export const DAMAGE_TYPES = [
  "acid", "bludgeoning", "cold", "fire", "force", "lightning",
  "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const MAGIC_SCHOOLS = [
  "abjuration", "conjuration", "divination", "enchantment",
  "evocation", "illusion", "necromancy", "transmutation",
] as const;
export type MagicSchool = (typeof MAGIC_SCHOOLS)[number];

export const CREATURE_SIZES = [
  "Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan",
] as const;
export type CreatureSize = (typeof CREATURE_SIZES)[number];

export const ARMOR_CATEGORIES = ["Light", "Medium", "Heavy", "Shield"] as const;
export type ArmorCategory = (typeof ARMOR_CATEGORIES)[number];

export const WEAPON_CATEGORIES = ["Simple", "Martial"] as const;
export type WeaponCategory = (typeof WEAPON_CATEGORIES)[number];

export const WEAPON_RANGE_TYPES = ["Melee", "Ranged"] as const;
export type WeaponRangeType = (typeof WEAPON_RANGE_TYPES)[number];

export const WEAPON_PROPERTIES = [
  "ammunition", "finesse", "heavy", "light", "loading",
  "range", "reach", "special", "thrown", "two-handed", "versatile",
] as const;
export type WeaponProperty = (typeof WEAPON_PROPERTIES)[number];

export const PROFICIENCY_TYPES = [
  "skill", "armor", "weapon", "tool", "saving_throw",
] as const;
export type ProficiencyType = (typeof PROFICIENCY_TYPES)[number];

export const ITEM_RARITIES = [
  "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact",
] as const;
export type ItemRarity = (typeof ITEM_RARITIES)[number];

export const SPELLCASTING_TYPES = [
  "full", "half", "third", "pact",
] as const;
export type SpellcastingType = (typeof SPELLCASTING_TYPES)[number];

export const VISION_TYPES = ["darkvision", "blindsight", "truesight", "tremorsense"] as const;
export type VisionType = (typeof VISION_TYPES)[number];

export const RECOVERY_TYPES = ["short rest", "long rest", "dawn", "day"] as const;
export type RecoveryType = (typeof RECOVERY_TYPES)[number];
