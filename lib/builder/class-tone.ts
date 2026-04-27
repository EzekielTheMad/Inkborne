export type ClassTone = "gold" | "purple";

const PURPLE_TONE_SLUGS = new Set([
  "wizard",
  "sorcerer",
  "warlock",
  "bard",
  "cleric",
  "druid",
]);

export function classTone(slug: string): ClassTone {
  return PURPLE_TONE_SLUGS.has(slug) ? "purple" : "gold";
}

export function classEmblemLetter(slug: string, name?: string): string {
  const source = name ?? slug;
  return source.charAt(0).toUpperCase();
}
