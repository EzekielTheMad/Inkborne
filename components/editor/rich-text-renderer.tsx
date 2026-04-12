"use client";

import type { JSONContent } from "@tiptap/react";
import { RichTextEditor } from "./rich-text-editor";

interface RichTextRendererProps {
  content: JSONContent | null;
  minHeight?: string;
}

/**
 * Read-only renderer for Tiptap JSON content.
 * Uses the RichTextEditor in non-editable mode.
 * Mention nodes are rendered via CSS as gold-accent styled text.
 * If content is null or empty, renders nothing.
 */
export function RichTextRenderer({ content, minHeight }: RichTextRendererProps) {
  if (!content || (content.type === "doc" && !content.content?.length)) {
    return null;
  }

  return (
    <RichTextEditor
      content={content}
      editable={false}
      minHeight={minHeight ?? "auto"}
    />
  );
}
