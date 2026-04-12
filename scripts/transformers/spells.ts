import { fetchAllFromApi, buildContentEntry, expandAbilityAbbreviation } from "./common";
import type { TransformedContent } from "./common";

interface ApiSpell {
  index: string;
  name: string;
  desc: string[];
  higher_level?: string[];
  range: string;
  components: string[];
  material?: string;
  ritual: boolean;
  duration: string;
  concentration: boolean;
  casting_time: string;
  level: number;
  damage?: {
    damage_type: { index: string; name: string };
    damage_at_slot_level?: Record<string, string>;
    damage_at_character_level?: Record<string, string>;
  };
  heal_at_slot_level?: Record<string, string>;
  dc?: {
    dc_type: { index: string; name: string };
    dc_success: string;
  };
  area_of_effect?: {
    type: string;
    size: number;
  };
  school: { index: string; name: string };
  classes: Array<{ index: string; name: string }>;
  subclasses: Array<{ index: string; name: string }>;
}

export function transformSpellEntry(apiSpell: ApiSpell): TransformedContent {
  const damage = apiSpell.damage
    ? {
        type: apiSpell.damage.damage_type?.index ?? null,
        dice_at_slot_level: apiSpell.damage.damage_at_slot_level ?? apiSpell.damage.damage_at_character_level ?? {},
      }
    : null;

  const dc = apiSpell.dc
    ? {
        type: expandAbilityAbbreviation(apiSpell.dc.dc_type.index),
        success: apiSpell.dc.dc_success as "half" | "none" | "other",
      }
    : null;

  const aoe = apiSpell.area_of_effect
    ? {
        type: apiSpell.area_of_effect.type as "sphere" | "cone" | "cylinder" | "line" | "cube",
        size: apiSpell.area_of_effect.size,
      }
    : null;

  // descriptionCantripDie is MPMB-seeded via SQL migration 00015_mpmb_cantrip_scaling.sql
  return buildContentEntry("spell", apiSpell.index, apiSpell.name, {
    level: apiSpell.level,
    school: apiSpell.school.index,
    casting_time: apiSpell.casting_time,
    range: apiSpell.range,
    components: apiSpell.components,
    material: apiSpell.material,
    duration: apiSpell.duration,
    concentration: apiSpell.concentration,
    ritual: apiSpell.ritual,
    description: apiSpell.desc.join("\n"),
    descriptionFull: apiSpell.desc.join("\n"),
    higher_level: apiSpell.higher_level?.join("\n"),
    damage,
    heal_at_slot_level: apiSpell.heal_at_slot_level ?? null,
    dc,
    area_of_effect: aoe,
    classes: apiSpell.classes.map((c) => c.index),
    subclasses: apiSpell.subclasses.map((s) => s.index),
    dependencies: [],
  });
}

export async function transformSpells(): Promise<TransformedContent[]> {
  const spells = await fetchAllFromApi<ApiSpell>("/spells");
  return spells.map(transformSpellEntry);
}
