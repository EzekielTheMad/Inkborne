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

// Spellcasting known — cantrips/spells known per level for a class
export const spellcastingKnownSchema = z.object({
  cantrips: z.array(z.number().int().nonnegative()).length(20).optional(),
  spells: z.union([
    z.array(z.number().int().nonnegative()).length(20),
    z.literal("all"),
  ]).optional(),
  prepared: z.boolean().default(false),
});
export type SpellcastingKnown = z.infer<typeof spellcastingKnownSchema>;

// Spellcasting list reference — which spell list a class uses
export const spellcastingListSchema = z.object({
  class: z.string().min(1),
  level: z.tuple([z.number().int().min(0), z.number().int().min(0).max(9)]),
});
export type SpellcastingList = z.infer<typeof spellcastingListSchema>;

// Bonus spells granted at certain class/subclass levels
export const spellcastingExtraSchema = z.array(
  z.union([
    z.string().min(1),                  // spell slug at all levels
    z.array(z.string().min(1)),         // array of spell slugs for that tier
  ])
);
export type SpellcastingExtra = z.infer<typeof spellcastingExtraSchema>;

// Bonus spell access granted by a feature
export const spellcastingBonusSchema = z.object({
  name: z.string().min(1),
  spells: z.array(z.string().min(1)).default([]),
  selection: z.object({
    count: z.number().int().positive(),
    from: z.union([
      z.literal("class"),
      z.literal("any"),
      z.array(z.string().min(1)),
    ]),
    level: z.tuple([z.number().int().min(0), z.number().int().max(9)]).optional(),
    school: z.array(z.string()).optional(),
  }).optional(),
  class: z.string().optional(),
  level: z.number().int().min(0).max(9).optional(),
  prepared: z.boolean().default(false),
  atwill: z.boolean().default(false),
  oncelr: z.boolean().default(false),
  oncesr: z.boolean().default(false),
});
export type SpellcastingBonus = z.infer<typeof spellcastingBonusSchema>;

// Cantrip damage scaling formula
export const cantripDieSchema = z.object({
  die: z.string().min(1),
  levels: z.array(z.number().int().positive()).default([1, 5, 11, 17]),
});
export type CantripDie = z.infer<typeof cantripDieSchema>;

// Language proficiency grants — fixed languages or "choose N from any"
export const languageProfsSchema = z.array(
  z.union([
    z.string().min(1),           // fixed language slug: "elvish", "dwarvish"
    z.object({                   // choice: "choose N"
      choose: z.number().int().positive(),
      from: z.union([z.literal("any"), z.array(z.string().min(1))]),
    }),
  ])
).default([]);
export type LanguageProfs = z.infer<typeof languageProfsSchema>;

// Tool proficiency grants
export const toolProfsSchema = z.array(
  z.union([
    z.string().min(1),           // fixed tool slug: "thieves-tools"
    z.object({
      choose: z.number().int().positive(),
      from: z.union([z.literal("any"), z.array(z.string().min(1))]),
    }),
  ])
).default([]);
export type ToolProfs = z.infer<typeof toolProfsSchema>;

// Skill proficiency grants
export const skillProfsSchema = z.array(z.string().min(1)).default([]);

// Starting equipment description text
export const equipmentDescSchema = z.string().default("");

// Conditional modifier — declarative version of MPMB calcChanges
export const calcChangeEntrySchema = z.object({
  target: z.enum(["atkCalc", "atkAdd", "spellCalc", "spellAdd", "hp"]),
  condition: z.string().default(""),       // human-readable condition description
  value: z.union([z.number(), z.string()]).optional(),  // numeric bonus or formula
  description: z.string().min(1),          // what this modifier does
});
export type CalcChangeEntry = z.infer<typeof calcChangeEntrySchema>;

export const calcChangesSchema = z.array(calcChangeEntrySchema).default([]);

// Modifier addition — adds to a specific computed field
export const addModEntrySchema = z.object({
  type: z.string().min(1),     // modifier type: "save", "skill", etc.
  field: z.string().min(1),    // specific field: "Str", "Athletics", etc.
  mod: z.union([z.number(), z.string()]),  // bonus value or formula
  text: z.string().default(""),
});
export type AddModEntry = z.infer<typeof addModEntrySchema>;

export const addModSchema = z.array(addModEntrySchema).default([]);
