/**
 * Types for spell management.
 */

import type { ParsedContentDefinition } from "@/lib/supabase/content-definitions-parser";

export interface CharacterSpell {
  id: string;
  character_id: string;
  content_id: string | null;
  name: string;
  class_slug: string;
  is_known: boolean;
  is_prepared: boolean;
  always_prepared: boolean;
  in_spellbook: boolean;
  source: "selection" | "feature" | "feat" | "item";
  custom_data: Record<string, unknown> | null;
  created_at: string;
  content_definitions?: ParsedContentDefinition | null;
}

export interface SpellSlotsUsed {
  "1"?: number;
  "2"?: number;
  "3"?: number;
  "4"?: number;
  "5"?: number;
  "6"?: number;
  "7"?: number;
  "8"?: number;
  "9"?: number;
  pact?: number;
}

export interface MaxSlotsByLevel {
  "1"?: number;
  "2"?: number;
  "3"?: number;
  "4"?: number;
  "5"?: number;
  "6"?: number;
  "7"?: number;
  "8"?: number;
  "9"?: number;
  pact?: number;
}

export interface ConcentrationState {
  spell_slug: string;
  spell_name: string;
  slot_level: number;
  started_at: string;
}

export type CasterType = "full" | "half" | "pact" | "third";

export interface CasterClass {
  slug: string;
  level: number;
  type: CasterType;
  ability: string;
  prepared: boolean;
  cantripsKnown: number;
  spellsKnown: number | "all";
  maxPrepared: number;
  ritualCasting: boolean;
  focus?: string;
}

export interface CasterInfo {
  isCaster: boolean;
  classes: CasterClass[];
  spellDc: number;
  spellAttackBonus: number;
}

export interface AddSpellPayload {
  content_id: string | null;
  name: string;
  class_slug: string;
  is_known?: boolean;
  is_prepared?: boolean;
  in_spellbook?: boolean;
  custom_data?: Record<string, unknown> | null;
}

export type SpellUpdate = Partial<
  Pick<CharacterSpell, "is_prepared" | "is_known" | "in_spellbook">
>;
