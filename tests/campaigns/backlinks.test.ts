import { describe, expect, it } from "vitest";
import {
  extractCampaignPageMentionIds,
  extractCharacterMentionIds,
  extractNarrativePageMentionIds,
  findCampaignPageBacklinks,
  findCampaignPageCharacterBacklinks,
  findCharacterNarrativeBacklinks,
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

  it("finds character mentions in campaign pages", () => {
    const page = { type: "doc", content: [mention("character-1", "@"), mention("page-1")] };
    expect(extractCharacterMentionIds(page)).toEqual(["character-1"]);
    expect(
      findCampaignPageCharacterBacklinks(
        [{ id: "page-1", title: "Cast", content: page }],
        "character-1",
      ),
    ).toEqual([{ id: "page-1", title: "Cast" }]);
  });

  it("finds page links across shared character narrative fields", () => {
    expect(
      extractNarrativePageMentionIds({
        backstory_origin: { type: "doc", content: [mention("page-1")] },
        backstory_turning_point: { type: "doc", content: [mention("page-2")] },
        malformed: { content: [mention("ignored")] },
      }),
    ).toEqual(["page-1", "page-2"]);
  });

  it("labels shared and RLS-authorized DM-note character backlinks", () => {
    expect(
      findCharacterNarrativeBacklinks(
        [
          {
            id: "character-1",
            name: "Aria",
            narrativeRich: { origin: { type: "doc", content: [mention("page-1")] } },
          },
          {
            id: "character-2",
            name: "Bram",
            narrativeRich: { origin: { type: "doc", content: [mention("page-1")] } },
            dmNotes: { type: "doc", content: [mention("page-1")] },
          },
          {
            id: "character-3",
            name: "Cyra",
            narrativeRich: {},
            dmNotes: { type: "doc", content: [mention("page-1")] },
          },
        ],
        "page-1",
      ),
    ).toEqual([
      { id: "character-1", name: "Aria", source: "narrative" },
      { id: "character-2", name: "Bram", source: "narrative_and_dm_notes" },
      { id: "character-3", name: "Cyra", source: "dm_notes" },
    ]);
  });
});
