import { describe, expect, it } from "vitest";
import {
  extractCampaignPageMentionIds,
  findCampaignPageBacklinks,
} from "@/lib/campaigns/backlinks";

function mention(id: string, char = "#") {
  return {
    type: "mention",
    attrs: { id, label: id, mentionSuggestionChar: char },
  };
}

describe("campaign backlinks", () => {
  it("extracts nested page mentions once and ignores character mentions", () => {
    const content = {
      type: "doc",
      content: [
        { type: "paragraph", content: [mention("page-1"), mention("character-1", "@") ] },
        { type: "blockquote", content: [{ type: "paragraph", content: [mention("page-1")] }] },
      ],
    };

    expect(extractCampaignPageMentionIds(content)).toEqual(["page-1"]);
  });

  it("returns each visible source page once and excludes self-links", () => {
    expect(
      findCampaignPageBacklinks(
        [
          { id: "source-1", title: "Source", content: { type: "doc", content: [mention("target")] } },
          { id: "target", title: "Target", content: { type: "doc", content: [mention("target")] } },
          { id: "other", title: "Other", content: { type: "doc", content: [] } },
        ],
        "target",
      ),
    ).toEqual([{ id: "source-1", title: "Source" }]);
  });
});
