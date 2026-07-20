import { isRichTextDocument } from "@/lib/editor/content";

export interface CampaignPageLinkCandidate {
  id: string;
  title: string;
  content: unknown;
}

export interface CharacterNarrativeLinkCandidate {
  id: string;
  name: string;
  narrativeRich: unknown;
  dmNotes?: unknown;
}

export interface CharacterNarrativeBacklink {
  id: string;
  name: string;
  source: "narrative" | "dm_notes" | "narrative_and_dm_notes";
}

export interface CampaignPageBacklink {
  id: string;
  title: string;
}

function extractMentionIds(content: unknown, suggestionChar: "#" | "@"): string[] {
  if (!isRichTextDocument(content)) return [];
  const ids = new Set<string>();

  function visit(node: unknown): void {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;

    const candidate = node as {
      type?: unknown;
      attrs?: { id?: unknown; mentionSuggestionChar?: unknown };
      content?: unknown;
    };
    if (
      candidate.type === "mention" &&
      candidate.attrs?.mentionSuggestionChar === suggestionChar &&
      typeof candidate.attrs.id === "string"
    ) {
      ids.add(candidate.attrs.id);
    }
    visit(candidate.content);
  }

  visit(content.content);
  return [...ids];
}

export function extractCampaignPageMentionIds(content: unknown): string[] {
  return extractMentionIds(content, "#");
}

export function extractCharacterMentionIds(content: unknown): string[] {
  return extractMentionIds(content, "@");
}

export function extractNarrativePageMentionIds(narrativeRich: unknown): string[] {
  if (!narrativeRich || typeof narrativeRich !== "object" || Array.isArray(narrativeRich)) {
    return [];
  }
  const ids = new Set<string>();
  for (const content of Object.values(narrativeRich)) {
    extractCampaignPageMentionIds(content).forEach((id) => ids.add(id));
  }
  return [...ids];
}

export function findCampaignPageBacklinks(
  pages: CampaignPageLinkCandidate[],
  targetPageId: string,
): CampaignPageBacklink[] {
  return pages
    .filter(
      (page) =>
        page.id !== targetPageId &&
        extractCampaignPageMentionIds(page.content).includes(targetPageId),
    )
    .map(({ id, title }) => ({ id, title }));
}

export function findCampaignPageCharacterBacklinks(
  pages: CampaignPageLinkCandidate[],
  targetCharacterId: string,
): CampaignPageBacklink[] {
  return pages
    .filter((page) => extractCharacterMentionIds(page.content).includes(targetCharacterId))
    .map(({ id, title }) => ({ id, title }));
}

export function findCharacterNarrativeBacklinks(
  characters: CharacterNarrativeLinkCandidate[],
  targetPageId: string,
): CharacterNarrativeBacklink[] {
  return characters.flatMap((character) => {
    const shared = extractNarrativePageMentionIds(character.narrativeRich).includes(targetPageId);
    const dmNotes = extractCampaignPageMentionIds(character.dmNotes).includes(targetPageId);
    if (!shared && !dmNotes) return [];
    return [{
      id: character.id,
      name: character.name,
      source: shared && dmNotes ? "narrative_and_dm_notes" : dmNotes ? "dm_notes" : "narrative",
    }];
  });
}
