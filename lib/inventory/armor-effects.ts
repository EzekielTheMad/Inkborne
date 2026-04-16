import type { MechanicalEffect } from "@/lib/types/effects";

interface ArmorData {
  armor_category: string;
  armor_class: {
    base: number;
    dex_bonus: boolean;
    max_bonus?: number | null;
  };
}

export function generateArmorEffects(
  data: ArmorData | null | undefined,
): MechanicalEffect[] {
  if (!data?.armor_class) return [];

  const { armor_category, armor_class: ac } = data;

  if (armor_category === "Shield") {
    return [
      {
        type: "mechanical",
        stat: "armor_class",
        op: "add",
        value: ac.base,
      },
    ];
  }

  let expr: string;

  if (!ac.dex_bonus) {
    expr = String(ac.base);
  } else if (ac.max_bonus != null) {
    expr = `${ac.base} + min(mod(dexterity), ${ac.max_bonus})`;
  } else {
    expr = `${ac.base} + mod(dexterity)`;
  }

  return [
    {
      type: "mechanical",
      stat: "armor_class",
      op: "formula",
      expr,
      tag: "ac_formula",
      condition: { field: "equipped_armor", op: "neq", value: "none" },
    },
  ];
}
