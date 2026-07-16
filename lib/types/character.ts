import type { NarrativeData, NarrativeRichData } from "./narrative";
import type { Currency } from "./inventory";
import type { SpellSlotsUsed, ConcentrationState } from "./spells";
import type { ActiveEffect } from "./active-effects";

export type CharacterVisibility = "private" | "campaign" | "public";

/** A single ASI allocation: which ability score gets how many points */
export interface AsiAllocation {
  ability: string;
  amount: number; // +1 or +2
}

/** Tracks ASI decisions per feature occurrence (keyed by feature slug) */
export interface AsiChoice {
  mode: "asi"; // future: | "feat"
  allocations: AsiAllocation[];
}

/** Campaign/system-level HP rule. Drives picker behavior and engine math.
 *  - free_choice: user picks Average / Roll / Manual per level
 *  - average_only: engine pins to averageHitDie; picker read-only
 *  - rolled_only: user must roll; engine falls back to average until rolled
 *  - max_first_level_each_class: every class's level 1 = max die; rest follow free_choice
 *  - max_for_all: every level = max die; picker read-only */
export type HpRule =
  | "free_choice"
  | "average_only"
  | "rolled_only"
  | "max_first_level_each_class"
  | "max_for_all";

/** Method used to determine HP gain at a given level. Stored value is always
 *  the raw die contribution (before CON), so CON changes from later ASIs
 *  automatically reflect in total HP without invalidating stored rolls. */
export type HpRollMethod = "average" | "rolled" | "manual";

export interface HpRollRecord {
  method: HpRollMethod;
  /** Raw die contribution for this level, BEFORE CON modifier (1..die). */
  value: number;
}

/** Structured starting-equipment state written by the equipment step chooser.
 *  `selections` maps a choice-group key (e.g. "class:1") to the chosen option id
 *  ("a" | "b" | …); `picks` maps a category-slot key (e.g. "class:1:b:0:1") to the
 *  chosen catalog slug (or "custom:<Name>" for items with no content definition).
 *  `confirmed` flips once the selections have been granted to inventory. */
export interface StartingEquipmentSelections {
  selections: Record<string, string>;
  picks: Record<string, string>;
  confirmed?: boolean;
}

export interface CharacterChoices {
  classes?: Array<{ slug: string; level: number; subclass?: string }>;
  race?: string;
  subrace?: string;
  background?: string;
  ability_method?: "standard_array" | "point_buy" | "manual";
  ability_assignments?: Record<string, number>;
  /** Legacy characters hold the strings "acknowledged" or "bundle_N";
   *  the equipment chooser writes a StartingEquipmentSelections object. */
  starting_equipment?: string | StartingEquipmentSelections;
  alignment?: string;
  personality_traits?: string[];
  ideals?: string[];
  bonds?: string[];
  flaws?: string[];
  resolved_choices?: Record<string, string[]>;
  /** Keyed by feature slug, e.g. "barbarian-ability-score-improvement-4" */
  asi_choices?: Record<string, AsiChoice>;
  /** Per-level HP rolls keyed as `{classSlug}-{level}` (e.g. "paladin-7").
   *  Lv 1 of the primary class is NOT stored — RAW pins it to max die.
   *  Engine reads from this map when present, falls back to averageHitDie. */
  hp_rolls?: Record<string, HpRollRecord>;
}

export interface CharacterDeathSaves {
  successes: number; // 0-3
  failures: number;  // 0-3
}

export interface CharacterState {
  current_hp?: number;
  temp_hp?: number;
  conditions?: string[];
  death_saves?: CharacterDeathSaves;
  inspiration?: boolean;
  quick_notes?: string;
  notes?: string;
  spell_slots_used?: SpellSlotsUsed;
  concentrating_on?: ConcentrationState | null;
  /** RAW exhaustion level 0-6. Applied via Conditions widget picker; decremented by 1 on long rest. */
  exhaustion?: number;
  /** Uses spent per feature resource. Key = FeatureResource.slug; value = spent count.
   *  Max is computed per render; spent clamped to [0, max] on read. */
  feature_uses?: Record<string, number>;
  /** Runtime buffs/debuffs snapshotting content Effect[] payloads with durations.
   *  Mutated wholesale via the pure helpers in lib/active-effects/helpers.ts;
   *  cleared entirely by a long rest. */
  active_effects?: ActiveEffect[];
  /** Hit dice spent per class. Key = class slug; value = spent count.
   *  Max per class = class level (computed per render via
   *  lib/hit-dice/helpers.ts; spent clamped to [0, max] on read).
   *  Long rest restores ⌊total HD / 2⌋ (min 1), largest die first. */
  hit_dice_spent?: Record<string, number>;
  // Equipment state
  equipped_armor?: "none" | "light" | "medium" | "heavy";
  shield_equipped?: boolean;
  // Activation toggles
  rage_active?: boolean;
  currency?: Currency;
  /** Set after the one-time "your character is ready" arrival moment
   *  has played (journey M2 B4) so it never replays for this character. */
  seen_sheet_first_time?: boolean;
  [key: string]: unknown;
}

export interface Character {
  id: string;
  user_id: string;
  system_id: string;
  campaign_id: string | null;
  name: string;
  visibility: CharacterVisibility;
  archived: boolean;
  level: number;
  base_stats: Record<string, number>;
  choices: CharacterChoices;
  state: CharacterState;
  narrative: NarrativeData;
  narrative_rich: NarrativeRichData;
  created_at: string;
  /** Per-character primary color (hex `#xxxxxx`) or null for the gold default. */
  primary_color: string | null;
}

export interface CharacterContentRef {
  id: string;
  character_id: string;
  content_id: string;
  content_version: number;
  context: Record<string, unknown>;
  choice_source: string | null;
  created_at: string;
}

export interface CharacterWithSystem extends Character {
  game_systems: {
    id: string;
    name: string;
    slug: string;
    schema_definition: import("./system").SystemSchemaDefinition;
  };
}

export type CampaignMemberRole = "dm" | "player";

export interface Campaign {
  id: string;
  system_id: string;
  owner_id: string;
  name: string;
  description: string;
  invite_code: string;
  created_at: string;
  /** Optional campaign-wide HP rule override. NULL = inherit from system. */
  hp_rule?: HpRule | null;
}

export interface CampaignMember {
  id: string;
  campaign_id: string;
  user_id: string;
  role: CampaignMemberRole;
  joined_at: string;
}

export interface ProfilePreferences {
  theme?: "dark" | "light" | "system";
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  preferences: ProfilePreferences;
  created_at: string;
}

/**
 * Partial patch shape accepted by `updateCharacter()`.
 * Only the top-level character fields the builder step-clients mutate.
 * Other columns (id, user_id, system_id, created_at, state, narrative*)
 * are written through dedicated paths and intentionally not part of this patch.
 */
export type CharacterUpdatePatch = Partial<
  Pick<
    Character,
    | "name"
    | "level"
    | "choices"
    | "primary_color"
    | "visibility"
    | "archived"
    | "base_stats"
  >
>;
