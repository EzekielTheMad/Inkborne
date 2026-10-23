import type { MechanicalEffect, GrantEffect, NarrativeEffect, ChoiceEffect, Effect } from "@/lib/types/effects";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { enrichSrdEntry } from "./srd-enrichment";

const API_HOST = "https://www.dnd5eapi.co";
const API_BASE = `${API_HOST}/api/2014`;

// --- API Fetch ---

export async function fetchFromApi<T>(path: string): Promise<T> {
  let url: string;
  if (path.startsWith("http")) {
    url = path;
  } else if (path.startsWith("/api/")) {
    // API returns urls like "/api/2014/traits/darkvision" — use host directly
    url = `${API_HOST}${path}`;
  } else {
    url = `${API_BASE}${path}`;
  }
  const source = new URL(url);
  if (source.origin !== API_HOST || !/^\/api\/2014\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(source.pathname) || source.search || source.hash) {
    throw new Error("SRD source must be an explicit 2014 D&D API resource.");
  }
  const cacheRoot = process.env.INKBORNE_SRD_CACHE_DIR;
  const cacheFile = cacheRoot ? resolve(cacheRoot, "responses", `${source.pathname.slice("/api/2014/".length)}.json`) : null;
  if (cacheFile) {
    try {
      const cached = await readFile(cacheFile, "utf8");
      if (Buffer.byteLength(cached) > 4_194_304) throw new Error("SRD source response exceeds cache budget.");
      return JSON.parse(cached) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) {
    throw new Error(`API fetch failed: ${response.status} ${url}`);
  }
  const data = await response.json() as T;
  if (cacheFile) {
    const serialized = `${JSON.stringify(data, null, 2)}\n`;
    if (Buffer.byteLength(serialized) > 4_194_304) throw new Error("SRD source response exceeds cache budget.");
    await mkdir(dirname(cacheFile), { recursive: true });
    await writeFile(cacheFile, serialized);
  }
  return data;
}

export async function fetchAllFromApi<T>(path: string): Promise<T[]> {
  const listResponse = await fetchFromApi<{ count?: number; results: Array<{ index: string; url: string }> }>(path);
  if (!Array.isArray(listResponse.results) || listResponse.results.length > 5_000 || (listResponse.count !== undefined && listResponse.count !== listResponse.results.length)) {
    throw new Error(`Incomplete or oversized SRD source listing: ${path}`);
  }
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
  return enrichSrdEntry({ content_type: contentType, slug, name, data, effects });
}
