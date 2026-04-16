/**
 * D&D item rarity colors — matches the standard D&D Beyond / community color scheme.
 * Used for item name styling in inventory displays and item search results.
 */

export type Rarity =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Very Rare"
  | "Legendary"
  | "Artifact"
  | string;

const RARITY_CLASS_MAP: Record<string, string> = {
  Common: "text-foreground",
  Uncommon: "text-green-400",
  Rare: "text-blue-400",
  "Very Rare": "text-purple-400",
  Legendary: "text-orange-400",
  Artifact: "text-red-400",
};

/**
 * Returns a Tailwind text-color class for the given rarity.
 * Returns default foreground color when rarity is null/undefined/unrecognized.
 */
export function rarityTextClass(rarity: string | null | undefined): string {
  if (!rarity) return "text-foreground";
  return RARITY_CLASS_MAP[rarity] ?? "text-foreground";
}
