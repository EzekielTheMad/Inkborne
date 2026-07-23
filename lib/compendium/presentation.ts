import type { CompendiumEntry } from "@/lib/compendium/types";

export interface CompendiumFact {
  label: string;
  value: string;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberText(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

function list(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function title(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function costText(value: unknown): string | null {
  const cost = record(value);
  const quantity = numberText(cost?.quantity);
  const unit = text(cost?.unit);
  return quantity && unit ? `${quantity} ${unit}` : null;
}

function damageText(value: unknown): string | null {
  const damage = record(value);
  const dice = text(damage?.dice);
  const type = text(damage?.type);
  return [dice, type ? title(type) : null].filter(Boolean).join(" ") || null;
}

function spellScalingText(value: unknown, damageType?: unknown): string | null {
  const scaling = record(value);
  if (!scaling) return null;
  const levels = Object.entries(scaling)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([level, dice]) => `Level ${level}: ${dice}`);
  if (levels.length === 0) return null;
  const type = text(damageType);
  return `${type ? `${title(type)} · ` : ""}${levels.join(", ")}`;
}

export function getCompendiumEntryDescription(entry: CompendiumEntry): string {
  const data = entry.data;
  const direct = text(data.description) ?? text(data.descriptionFull);
  if (direct) return direct;

  if (entry.content_type === "background") {
    return text(record(data.feature)?.description) ?? "Background rules and proficiencies.";
  }
  if (entry.content_type === "race") {
    return text(data.language_description)
      ?? text(data.size_description)
      ?? "Species traits, movement, languages, and senses.";
  }
  if (entry.content_type === "class") {
    const primary = text(data.primaryAbility);
    return primary
      ? `A class whose primary ability is ${primary}.`
      : "Class progression, proficiencies, and features.";
  }
  if (entry.content_type === "weapon") {
    const damage = record(data.damage);
    const dice = text(damage?.dice);
    const damageType = text(damage?.type);
    return dice
      ? `${dice}${damageType ? ` ${damageType}` : ""} damage.`
      : "Weapon statistics and properties.";
  }
  if (entry.content_type === "armor") {
    const armorClass = record(data.armor_class);
    const base = numberText(armorClass?.base);
    return base ? `Base Armor Class ${base}.` : "Armor statistics and requirements.";
  }

  return "Rules content available to your account.";
}

export function getCompendiumEntryFacts(entry: CompendiumEntry): CompendiumFact[] {
  const data = entry.data;
  const facts: CompendiumFact[] = [];
  const add = (label: string, value: string | null) => {
    if (value) facts.push({ label, value });
  };

  switch (entry.content_type) {
    case "class":
      add("Hit die", numberText(data.hit_die) ? `d${numberText(data.hit_die)}` : null);
      add("Primary ability", text(data.primaryAbility));
      add("Saving throws", list(data.saving_throws).map(title).join(", ") || null);
      add("Subclass", text(data.subclassLabel));
      break;
    case "race":
      add("Size", text(data.size));
      add("Speed", numberText(data.speed) ? `${numberText(data.speed)} ft.` : null);
      add("Languages", list(data.languages).map(title).join(", ") || null);
      add("Traits", list(data.traits).map(title).join(", ") || null);
      break;
    case "background": {
      const feature = record(data.feature);
      add("Feature", text(feature?.name));
      add("Skills", list(data.skills).map(title).join(", ") || null);
      add("Equipment", text(data.equipment));
      add("Starting gold", numberText(data.gold) ? `${numberText(data.gold)} gp` : null);
      break;
    }
    case "feat":
      add("Action", text(data.action)?.replaceAll("_", " ") ?? null);
      add("Recovery", text(data.recovery));
      add("Prerequisites", Array.isArray(data.prerequisites) && data.prerequisites.length
        ? `${data.prerequisites.length} requirement${data.prerequisites.length === 1 ? "" : "s"}`
        : "None");
      break;
    case "spell":
      {
        const damage = record(data.damage);
        const save = record(data.dc);
        const area = record(data.area_of_effect);
      add("Level", data.level === 0 ? "Cantrip" : numberText(data.level));
      add("School", text(data.school) ? title(text(data.school)!) : null);
      add("Casting time", text(data.casting_time));
      add("Range", text(data.range));
      add("Duration", text(data.duration));
      add("Components", list(data.components).join(", ") || null);
      add("Materials", text(data.material));
      add("Spell attack", text(data.attack_type) ? `${title(text(data.attack_type)!)} spell attack` : null);
      add("Damage", spellScalingText(damage?.dice_at_slot_level, damage?.type));
      add("Healing", spellScalingText(data.heal_at_slot_level));
      add(
        "Saving throw",
        text(save?.type)
          ? `${title(text(save?.type)!)} · ${text(save?.success) === "half" ? "half damage on success" : text(save?.success) === "none" ? "no effect on success" : "special result on success"}`
          : null,
      );
      add(
        "Area",
        text(area?.type) && numberText(area?.size)
          ? `${numberText(area?.size)}-ft. ${title(text(area?.type)!)}`
          : null,
      );
      add("Ritual", data.ritual === true ? "Yes" : "No");
      add("Concentration", data.concentration === true ? "Yes" : "No");
      add("Classes", list(data.classes).map(title).join(", ") || null);
      break;
      }
    case "magic_item":
      add("Rarity", text(data.rarity));
      add("Category", text(data.equipment_category));
      add(
        "Attunement",
        data.requires_attunement === true
          ? "Required"
          : text(data.requires_attunement) ?? "Not required",
      );
      break;
    case "item":
      add("Category", text(data.equipment_category));
      add("Cost", costText(data.cost));
      add("Weight", numberText(data.weight) ? `${numberText(data.weight)} lb.` : null);
      break;
    case "weapon": {
      const damage = record(data.damage);
      const range = record(data.range);
      add("Category", text(data.weapon_category));
      add("Type", text(data.weapon_range));
      add("Cost", costText(data.cost));
      add("Range", numberText(range?.normal)
        ? `${numberText(range?.normal)} ft.${numberText(range?.long) ? ` / ${numberText(range?.long)} ft.` : ""}`
        : null);
      add("Damage", damageText(damage));
      add("Versatile damage", damageText(data.two_handed_damage));
      add("Properties", list(data.properties).map(title).join(", ") || null);
      add("Weight", numberText(data.weight) ? `${numberText(data.weight)} lb.` : null);
      break;
    }
    case "armor": {
      const armorClass = record(data.armor_class);
      const base = numberText(armorClass?.base);
      const dex = armorClass?.dex_bonus === true ? " + Dex" : "";
      add("Category", text(data.armor_category));
      add("Cost", costText(data.cost));
      add("Armor Class", base ? `${base}${dex}` : null);
      add("Strength", numberText(data.str_minimum));
      add("Stealth", data.stealth_disadvantage === true ? "Disadvantage" : "Normal");
      add("Weight", numberText(data.weight) ? `${numberText(data.weight)} lb.` : null);
      break;
    }
  }

  return facts;
}

export function getCompendiumEntryEyebrow(entry: CompendiumEntry): string {
  if (entry.content_type === "spell") {
    return entry.data.level === 0
      ? `Cantrip · ${title(text(entry.data.school) ?? "Spell")}`
      : `Level ${numberText(entry.data.level) ?? "?"} · ${title(text(entry.data.school) ?? "Spell")}`;
  }
  if (entry.content_type === "magic_item") {
    return `${text(entry.data.rarity) ?? "Magic"} item`;
  }
  return title(entry.content_type);
}
