import type { MechanicalEffect, GrantEffect, NarrativeEffect, ChoiceEffect, Effect } from "@/lib/types/effects";

const API_BASE = "https://www.dnd5eapi.co/api/2014";

// --- API Fetch ---

export async function fetchFromApi<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API fetch failed: ${response.status} ${url}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchAllFromApi<T>(path: string): Promise<T[]> {
  const listResponse = await fetchFromApi<{ results: Array<{ index: string; url: string }> }>(path);
  const items: T[] = [];
  for (const result of listResponse.results) {
    const item = await fetchFromApi<T>(result.url);
    items.push(item);
  }
  return items;
}

// --- Slug Normalization ---

const ABILITY_ABBREVIATIONS: Record<string, string> = {
  str: "strength",
  dex: "dexterity",
  con: "constitution",
  int: "intelligence",
  wis: "wisdom",
  cha: "charisma",
};

export function normalizeSlug(input: string): string {
  return input.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function expandAbilityAbbreviation(abbr: string): string {
  return ABILITY_ABBREVIATIONS[abbr.toLowerCase()] ?? abbr.toLowerCase();
}

// --- Effect Builders ---

export function buildMechanicalEffect(
  stat: string,
  op: "add" | "set" | "multiply" | "max" | "min",
  value: number | string
): MechanicalEffect {
  return { type: "mechanical", stat, op, value };
}

export function buildGrantEffect(stat: string, value: string): GrantEffect {
  return { type: "grant", stat, value };
}

export function buildNarrativeEffect(text: string, tag?: string): NarrativeEffect {
  return { type: "narrative", text, ...(tag ? { tag } : {}) };
}

export function buildChoiceEffect(
  choose: number,
  from: string[] | string,
  grantType: string,
  choiceId: string
): ChoiceEffect {
  return { type: "choice", choose, from, grant_type: grantType, choice_id: choiceId };
}

interface ApiAbilityBonus {
  ability_score: { index: string; name: string };
  bonus: number;
}

export function buildAbilityBonusEffects(bonuses: ApiAbilityBonus[]): MechanicalEffect[] {
  return bonuses.map((b) => ({
    type: "mechanical" as const,
    stat: expandAbilityAbbreviation(b.ability_score.index),
    op: "add" as const,
    value: b.bonus,
  }));
}

// --- Content Definition Builder ---

export interface TransformedContent {
  content_type: string;
  slug: string;
  name: string;
  data: Record<string, unknown>;
  effects: Effect[];
}

export function buildContentEntry(
  contentType: string,
  slug: string,
  name: string,
  data: Record<string, unknown>,
  effects: Effect[] = []
): TransformedContent {
  return { content_type: contentType, slug, name, data, effects };
}
