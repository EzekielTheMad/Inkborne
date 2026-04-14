export interface InventoryItem {
  id: string;
  character_id: string;
  content_id: string | null;
  name: string;
  content_type: string;
  quantity: number;
  equipped: boolean;
  attuned: boolean;
  sort_order: number;
  notes: string | null;
  custom_data: Record<string, unknown> | null;
  created_at: string;
  content_definitions?: {
    id: string;
    name: string;
    slug: string;
    content_type: string;
    data: Record<string, unknown>;
    effects: Array<Record<string, unknown>>;
  } | null;
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
