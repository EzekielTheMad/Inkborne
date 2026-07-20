import type { ParsedContentDefinition } from "@/lib/supabase/content-definitions-parser";

export interface InventoryItem {
  id: string;
  character_id: string;
  content_id: string | null;
  content_version: number | null;
  name: string;
  content_type: string;
  quantity: number;
  equipped: boolean;
  attuned: boolean;
  sort_order: number;
  notes: string | null;
  custom_data: Record<string, unknown> | null;
  created_at: string;
  content_definitions?: ParsedContentDefinition | null;
}

export interface Currency {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}

export const DEFAULT_CURRENCY: Currency = {
  cp: 0,
  sp: 0,
  ep: 0,
  gp: 0,
  pp: 0,
};
