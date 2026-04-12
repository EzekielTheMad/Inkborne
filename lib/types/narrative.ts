import type { JSONContent } from "@tiptap/react";

export interface FunTraits {
  favorite_food?: string;
  least_favorite_food?: string;
  hobby?: string;
  zodiac?: string;
}

export interface NarrativeData {
  full_name?: string;
  aliases?: string;
  age?: string;
  build?: string;
  origin?: string;
  one_liner?: string;
  motivation?: string;
  mannerisms?: string;
  fear?: string;
  portrait_url?: string;
  token_url?: string;
  fun_traits?: FunTraits;
}

export interface NarrativeRichData {
  distinguishing_features?: JSONContent | null;
  backstory_origin?: JSONContent | null;
  backstory_turning_point?: JSONContent | null;
  backstory_left_behind?: JSONContent | null;
  backstory_dm_notes?: JSONContent | null;
}

// Fields from CharacterChoices that are editable on the Narrative tab
export interface PersonalityFields {
  personality_traits?: string[];
  ideals?: string[];
  bonds?: string[];
  flaws?: string[];
}

export interface MentionItem {
  id: string;
  label: string;
  entityType: "character" | "npc";
}

export interface Npc {
  id: string;
  character_id: string;
  created_by: string;
  name: string;
  description: JSONContent | Record<string, never>;
  relationship: string | null;
  visibility: "private" | "dm_only" | "campaign";
  portrait_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
