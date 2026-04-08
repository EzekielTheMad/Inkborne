import type { z } from "zod";
import { raceDataSchema } from "./race";
import { subraceDataSchema } from "./subrace";
import { traitDataSchema } from "./trait";
import { languageDataSchema } from "./language";
import { proficiencyDataSchema } from "./proficiency";
import { featureDataSchema } from "./feature";
import { classDataSchema } from "./class";
import { subclassDataSchema } from "./subclass";
import { backgroundDataSchema } from "./background";
import { featDataSchema } from "./feat";
import { spellDataSchema } from "./spell";
import { weaponDataSchema } from "./weapon";
import { armorDataSchema } from "./armor";
import { itemDataSchema } from "./item";
import { magicItemDataSchema } from "./magic-item";

const CONTENT_TYPE_SCHEMAS: Record<string, z.ZodType> = {
  race: raceDataSchema,
  subrace: subraceDataSchema,
  trait: traitDataSchema,
  language: languageDataSchema,
  proficiency: proficiencyDataSchema,
  feature: featureDataSchema,
  class: classDataSchema,
  subclass: subclassDataSchema,
  background: backgroundDataSchema,
  feat: featDataSchema,
  spell: spellDataSchema,
  weapon: weaponDataSchema,
  armor: armorDataSchema,
  item: itemDataSchema,
  magic_item: magicItemDataSchema,
};

export function getContentTypeSchema(contentType: string): z.ZodType | undefined {
  return CONTENT_TYPE_SCHEMAS[contentType];
}

export function registerContentTypeSchema(contentType: string, schema: z.ZodType): void {
  CONTENT_TYPE_SCHEMAS[contentType] = schema;
}
