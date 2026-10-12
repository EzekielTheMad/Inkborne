import { z } from "zod";
import type { MechanicalEffect } from "@/lib/types/effects";

export const RACE_CORE_ANNOTATION_KEY = "_inkborne_race_core";
export const RACE_WALKING_TAG = "inkborne:race-core:v1:walking-speed";

const walkingEffectSchema = z.object({
  type: z.literal("mechanical"), stat: z.literal("movement_speed"),
  op: z.literal("set"), value: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  tag: z.literal(RACE_WALKING_TAG),
}).strict();
const annotationSchema = z.object({ contract_version: z.literal(1), walking_effect: walkingEffectSchema }).strict();

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function raceWalkingEffect(speed: number): MechanicalEffect {
  return walkingEffectSchema.parse({ type: "mechanical", stat: "movement_speed", op: "set", value: speed, tag: RACE_WALKING_TAG });
}
export function raceCoreAnnotation(speed: number) {
  return annotationSchema.parse({ contract_version: 1, walking_effect: raceWalkingEffect(speed) });
}

export type RaceWalkingEditability =
  | { editable: false }
  | { editable: true; effectIndex: number; speed: number };

/** Validated editing annotation, NOT proof of provenance or authorization:
 * an owner with DML access can alter this JSON. The server must call this on
 * its authenticated expected-version row, never on a browser eligibility flag.
 * Strict raw checks reject extras before any parser could silently strip them. */
export function inspectRaceWalkingEditability(data: unknown, effects: unknown): RaceWalkingEditability {
  if (!record(data) || !Array.isArray(effects)) return { editable: false };
  const annotation = annotationSchema.safeParse(data[RACE_CORE_ANNOTATION_KEY]);
  if (!annotation.success) return { editable: false };
  const tagged = effects.flatMap((effect, index) => record(effect) && effect.tag === RACE_WALKING_TAG ? [index] : []);
  if (tagged.length !== 1) return { editable: false };
  const effectIndex = tagged[0];
  const rawEffect = effects[effectIndex];
  const owned = walkingEffectSchema.safeParse(rawEffect);
  if (!owned.success || owned.data.value !== annotation.data.walking_effect.value) return { editable: false };
  // The strict schemas fixed all other values and rejected raw conditions,
  // formulas, extra fields, and altered contract/target/operation/tag values.
  if (effects.some((effect, index) => index !== effectIndex && record(effect) && effect.stat === "movement_speed")) return { editable: false };
  if (!record(data.speed_detail) || data.speed !== owned.data.value || data.speed_detail.walk !== owned.data.value) return { editable: false };
  return { editable: true, effectIndex, speed: owned.data.value };
}
