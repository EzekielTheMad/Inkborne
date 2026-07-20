import { describe, expect, it } from "vitest";
import {
  emptyRichTextDocument,
  isRichTextDocument,
  normalizeRichTextContent,
} from "@/lib/editor/content";

describe("rich-text content", () => {
  it("creates a valid empty TipTap document", () => {
    expect(emptyRichTextDocument()).toEqual({ type: "doc", content: [] });
  });

  it("preserves valid documents", () => {
    const document = { type: "doc", content: [{ type: "paragraph" }] };
    expect(isRichTextDocument(document)).toBe(true);
    expect(normalizeRichTextContent(document)).toBe(document);
  });

  it.each([null, {}, { type: "doc" }, { type: "paragraph", content: [] }])(
    "normalizes invalid content %#",
    (content) => {
      expect(normalizeRichTextContent(content)).toEqual({ type: "doc", content: [] });
    },
  );
});
