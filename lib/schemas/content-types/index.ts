import type { z } from "zod";
import { raceDataSchema } from "./race";
import { subraceDataSchema } from "./subrace";
import { traitDataSchema } from "./trait";
import { languageDataSchema } from "./language";
import { proficiencyDataSchema } from "./proficiency";
import { featureDataSchema } from "./feature";

const CONTENT_TYPE_SCHEMAS: Record<string, z.ZodType> = {
  race: raceDataSchema,
  subrace: subraceDataSchema,
  trait: traitDataSchema,
  language: languageDataSchema,
  proficiency: proficiencyDataSchema,
  feature: featureDataSchema,
};

export function getContentTypeSchema(contentType: string): z.ZodType | undefined {
  return CONTENT_TYPE_SCHEMAS[contentType];
}

export function registerContentTypeSchema(contentType: string, schema: z.ZodType): void {
  CONTENT_TYPE_SCHEMAS[contentType] = schema;
}
