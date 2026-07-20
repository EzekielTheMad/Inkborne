import { isRichTextDocument } from "@/lib/editor/content";

export interface CampaignPageLinkCandidate {
  id: string;
  title: string;
  content: unknown;
}

export function extractCampaignPageMentionIds(content: unknown): string[] {
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
      candidate.attrs?.mentionSuggestionChar === "#" &&
      typeof candidate.attrs.id === "string"
    ) {
      ids.add(candidate.attrs.id);
    }
    visit(candidate.content);
  }

  visit(content.content);
  return [...ids];
}

export function findCampaignPageBacklinks(
  pages: CampaignPageLinkCandidate[],
  targetPageId: string,
): Array<{ id: string; title: string }> {
  return pages
    .filter(
      (page) =>
        page.id !== targetPageId &&
        extractCampaignPageMentionIds(page.content).includes(targetPageId),
    )
    .map(({ id, title }) => ({ id, title }));
}
