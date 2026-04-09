"use client";

import type { GrantEffect } from "@/lib/types/effects";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";

interface ProficienciesProps {
  grants: GrantEffect[];
  contentRefs?: ContentRefWithContent[];
}

/** Convert a slug like "light_armor" or "simple_weapons" to a display name */
function slugToLabel(slug: string): string {
  return slug
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const ARMOR_SLUGS = new Set([
  "light_armor",
  "medium_armor",
  "heavy_armor",
  "shields",
]);

const WEAPON_PREFIXES = ["simple_weapons", "martial_weapons"];
const TOOL_SUFFIXES = ["_tools", "_kit", "_instruments", "_supplies", "_set"];

function isArmorGrant(stat: string): boolean {
  return ARMOR_SLUGS.has(stat);
}

function isWeaponGrant(stat: string): boolean {
  if (WEAPON_PREFIXES.includes(stat)) return true;
  // Specific weapon proficiencies (e.g., "longsword", "hand_crossbow")
  // Use heuristics: not armor, not tool, not language, not skill, not save
  return (
    stat.endsWith("_weapon") ||
    stat.endsWith("_bow") ||
    stat.endsWith("_sword") ||
    stat.endsWith("_axe") ||
    stat.endsWith("_hammer") ||
    stat.endsWith("_blade") ||
    stat.endsWith("_staff")
  );
}

function isToolGrant(stat: string): boolean {
  return TOOL_SUFFIXES.some((suffix) => stat.endsWith(suffix)) || stat.includes("tool");
}

function isLanguageGrant(stat: string): boolean {
  // Language grants are typically prefixed with "language_" or are known language slugs
  return (
    stat.startsWith("language_") ||
    stat === "common" ||
    stat === "elvish" ||
    stat === "dwarvish" ||
    stat === "draconic" ||
    stat === "infernal" ||
    stat === "celestial" ||
    stat === "abyssal" ||
    stat === "deep_speech" ||
    stat === "undercommon" ||
    stat === "sylvan" ||
    stat === "giant" ||
    stat === "gnomish" ||
    stat === "goblin" ||
    stat === "halfling" ||
    stat === "orc" ||
    stat === "primordial" ||
    stat === "auran" ||
    stat === "aquan" ||
    stat === "ignan" ||
    stat === "terran" ||
    stat === "thieves_cant" ||
    stat === "druidic"
  );
}

interface ProficiencyCategory {
  label: string;
  items: string[];
}

export function Proficiencies({ grants, contentRefs }: ProficienciesProps) {
  // Only consider proficiency grants (value === "proficient")
  const profGrants = grants.filter((g) => g.value === "proficient");

  const armor: string[] = [];
  const weapons: string[] = [];
  const tools: string[] = [];
  const languages: string[] = [];

  for (const grant of profGrants) {
    const stat = grant.stat;
    if (isArmorGrant(stat)) {
      armor.push(slugToLabel(stat));
    } else if (isWeaponGrant(stat)) {
      weapons.push(slugToLabel(stat));
    } else if (isLanguageGrant(stat)) {
      const label = stat.startsWith("language_")
        ? slugToLabel(stat.replace("language_", ""))
        : slugToLabel(stat);
      languages.push(label);
    } else if (isToolGrant(stat)) {
      tools.push(slugToLabel(stat));
    }
    // Skills and saves are excluded — handled by SkillsList and SavingThrows
  }

  const categories: ProficiencyCategory[] = [
    { label: "Armor", items: armor },
    { label: "Weapons", items: weapons },
    { label: "Tools", items: tools },
    { label: "Languages", items: languages },
  ].filter((cat) => cat.items.length > 0);

  if (categories.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <h3 className="text-accent font-semibold text-sm uppercase tracking-wide">
        Proficiencies
      </h3>
      <div className="space-y-2">
        {categories.map((cat) => (
          <div key={cat.label}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
              {cat.label}
            </p>
            <p className="text-sm text-foreground">
              {cat.items.join(", ")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
