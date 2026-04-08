import { fetchAllFromApi, buildContentEntry } from "./common";
import type { TransformedContent } from "./common";

interface ApiProficiency {
  index: string;
  name: string;
  type: string;
  classes: Array<{ index: string }>;
  races: Array<{ index: string }>;
}

function mapProficiencyType(apiType: string): string {
  const mapping: Record<string, string> = {
    "Skills": "skill",
    "Armor": "armor",
    "Weapons": "weapon",
    "Artisan's Tools": "tool",
    "Gaming Sets": "tool",
    "Musical Instruments": "tool",
    "Other": "tool",
    "Saving Throws": "saving_throw",
    "Vehicles": "tool",
  };
  return mapping[apiType] ?? "tool";
}

export async function transformProficiencies(): Promise<TransformedContent[]> {
  const proficiencies = await fetchAllFromApi<ApiProficiency>("/proficiencies");
  return proficiencies.map((prof) =>
    buildContentEntry("proficiency", prof.index, prof.name, {
      proficiency_type: mapProficiencyType(prof.type),
      reference: prof.index,
      classes: prof.classes.map((c) => c.index),
      races: prof.races.map((r) => r.index),
    })
  );
}
