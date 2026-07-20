"use client";

import type { JSONContent } from "@tiptap/react";
import { RichTextEditor } from "./rich-text-editor";
import { normalizeRichTextContent } from "@/lib/editor/content";

interface RichTextRendererProps {
  content: JSONContent | null;
  minHeight?: string;
  campaignId?: string;
}

/**
 * Read-only renderer for Tiptap JSON content.
 * Uses the RichTextEditor in non-editable mode.
 * Mention nodes are rendered via CSS as gold-accent styled text.
 * If content is null or empty, renders nothing.
 */
export function RichTextRenderer({ content, minHeight, campaignId }: RichTextRendererProps) {
  const normalizedContent = normalizeRichTextContent(content);
  if (!normalizedContent.content?.length) {
    return null;
  }

  return (
    <RichTextEditor
      content={normalizedContent}
      editable={false}
      minHeight={minHeight ?? "auto"}
      campaignId={campaignId}
    />
  );
}
