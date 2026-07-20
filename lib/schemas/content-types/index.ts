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

/**
 * Convenience: run the registered schema for `contentType` against `data`.
 * Returns a discriminated `{ ok, ... }` shape so callers don't have to wrap
 * `safeParse` themselves. Returns `{ ok: false, error: "unknown_content_type" }`
 * when no schema is registered for the given content_type.
 */
export type ParseContentResult =
  | { ok: true; data: unknown }
  | { ok: false; error: "unknown_content_type" | "schema_violation"; issues?: z.ZodIssue[] };

export function parseContentByType(
  contentType: string,
  data: unknown,
): ParseContentResult {
  const schema = CONTENT_TYPE_SCHEMAS[contentType];
  if (!schema) {
    return { ok: false, error: "unknown_content_type" };
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    return { ok: false, error: "schema_violation", issues: result.error.issues };
  }
  return { ok: true, data: result.data };
}
