import type { ParsedContentDefinition } from "@/lib/supabase/content-definitions-parser";

export interface CompendiumSystem {
  id: string;
  name: string;
  slug: string;
  versionLabel: string;
}

export type CompendiumEntry = ParsedContentDefinition & {
  system_id: string;
  scope: "platform" | "personal" | "shared";
  owner_id: string | null;
};

export interface CompendiumResultPage {
  entries: CompendiumEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export type CompendiumProvenance = "SRD" | "Your homebrew" | "Campaign shared";

export function getCompendiumProvenance(
  entry: CompendiumEntry,
  userId: string,
): CompendiumProvenance {
  if (entry.source === "srd") return "SRD";
  return entry.owner_id === userId ? "Your homebrew" : "Campaign shared";
}
