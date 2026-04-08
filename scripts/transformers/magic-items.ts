import { fetchAllFromApi, buildContentEntry, buildNarrativeEffect } from "./common";
import type { TransformedContent } from "./common";

interface ApiMagicItem {
  index: string;
  name: string;
  desc: string[];
  equipment_category: { index: string; name: string };
  rarity: { name: string };
}

export async function transformMagicItems(): Promise<TransformedContent[]> {
  const items = await fetchAllFromApi<ApiMagicItem>("/magic-items");
  return items.map((item) => {
    const effects = [];
    if (item.desc.length > 0) {
      effects.push(buildNarrativeEffect(item.desc.join("\n"), "Magic Item"));
    }

    return buildContentEntry("magic_item", item.index, item.name, {
      rarity: item.rarity.name,
      description: item.desc.join("\n"),
      equipment_category: item.equipment_category.name,
    }, effects);
  });
}
