import type { Effect, StatCondition } from "./effects";

export type ContentScope = "platform" | "personal" | "shared";
export type ContentSource = "srd" | "homebrew";

export interface ContentDefinition {
  id: string;
  system_id: string;
  content_type: string;
  slug: string;
  name: string;
  data: Record<string, unknown>;
  effects: Effect[];
  source: ContentSource;
  scope: ContentScope;
  owner_id: string | null;
  version: number;
  created_at: string;
}

export interface ContentVersion {
  id: string;
  content_id: string;
  version: number;
  data_snapshot: Record<string, unknown>;
  effects_snapshot: Effect[];
  changelog: string;
  created_at: string;
}

export interface CustomContentType {
  id: string;
  system_id: string;
  owner_id: string;
  slug: string;
  name: string;
  description: string;
  allow_multiple: boolean;
  entry_conditions: StatCondition[];
  has_progression: boolean;
  scope: "personal" | "shared";
  version: number;
}

export interface ContentShare {
  id: string;
  content_id: string;
  campaign_id: string;
  shared_by: string;
  shared_at: string;
}

export interface ContentTypeShare {
  id: string;
  content_type_id: string;
  campaign_id: string;
  shared_by: string;
  shared_at: string;
}
