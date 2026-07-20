import type { JSONContent } from "@tiptap/react";

export function emptyRichTextDocument(): JSONContent {
  return { type: "doc", content: [] };
}

export function isRichTextDocument(content: unknown): content is JSONContent {
  if (!content || typeof content !== "object") return false;
  const candidate = content as { type?: unknown; content?: unknown };
  return candidate.type === "doc" && Array.isArray(candidate.content);
}

export function normalizeRichTextContent(content: unknown): JSONContent {
  return isRichTextDocument(content) ? content : emptyRichTextDocument();
}
