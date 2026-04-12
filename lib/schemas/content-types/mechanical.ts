import { z } from "zod";

// Speed object — used by race and feature schemas
export const speedSchema = z.object({
  walk: z.number().int().nonnegative().optional(),
  fly: z.number().int().nonnegative().optional(),
  swim: z.number().int().nonnegative().optional(),
  climb: z.number().int().nonnegative().optional(),
  burrow: z.number().int().nonnegative().optional(),
  encumbered: z.number().int().nonnegative().optional(),
});
export type SpeedData = z.infer<typeof speedSchema>;

// Vision entry — darkvision 60, blindsight 10, etc.
export const VISION_TYPES = ["darkvision", "blindsight", "truesight", "tremorsense"] as const;
export const visionEntrySchema = z.object({
  type: z.enum(VISION_TYPES),
  range: z.number().int().positive(),
});
export type VisionEntry = z.infer<typeof visionEntrySchema>;

// Save text — advantage vs X, immune to Y
export const savetxtSchema = z.object({
  adv_vs: z.array(z.string()).default([]),
  immune: z.array(z.string()).default([]),
});
export type SavetxtData = z.infer<typeof savetxtSchema>;

// Ability score array — [STR, DEX, CON, INT, WIS, CHA]
export const abilityScoreArraySchema = z.array(z.number().int()).length(6);
export type AbilityScoreArray = z.infer<typeof abilityScoreArraySchema>;

// Action economy enum
export const ACTION_TYPES = ["action", "bonus action", "reaction", "free"] as const;

// Recovery enum
export const RECOVERY_TYPES = ["short rest", "long rest", "dawn", "day"] as const;

// Source reference — book + page for content filtering
export const sourceRefSchema = z.object({
  book: z.string().min(1),    // e.g., "PHB", "SRD", "XGE", "TCE"
  page: z.number().int().min(0).default(0),
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

export const sourceRefsSchema = z.array(sourceRefSchema).default([]);

// Proficiency grants (by category)
export const proficiencyGrantsSchema = z.object({
  weapons: z.array(z.string()).default([]),
  armor: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
});
export type ProficiencyGrants = z.infer<typeof proficiencyGrantsSchema>;
