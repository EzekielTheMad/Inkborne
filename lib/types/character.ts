import type { NarrativeData, NarrativeRichData } from "./narrative";

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

export interface CharacterChoices {
  classes?: Array<{ slug: string; level: number; subclass?: string }>;
  race?: string;
  subrace?: string;
  background?: string;
  ability_method?: "standard_array" | "point_buy" | "manual";
  ability_assignments?: Record<string, number>;
  starting_equipment?: string;
  personality_traits?: string[];
  ideals?: string[];
  bonds?: string[];
  flaws?: string[];
  resolved_choices?: Record<string, string[]>;
  /** Keyed by feature slug, e.g. "barbarian-ability-score-improvement-4" */
  asi_choices?: Record<string, AsiChoice>;
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
  spell_slots_used?: Record<string, number>;
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
