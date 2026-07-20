import { describe, expect, it } from "vitest";
import { buildMentionSearchUrl } from "@/components/editor/rich-text-editor";

describe("rich-text mention search", () => {
  it("builds separate campaign-scoped page and character searches", () => {
    expect(buildMentionSearchUrl("campaign/id", "page", "Red Keep")).toBe(
      "/api/campaigns/campaign%2Fid/mentions?kind=page&q=Red%20Keep",
    );
    expect(buildMentionSearchUrl("campaign/id", "character", "Ada & Bob")).toBe(
      "/api/campaigns/campaign%2Fid/mentions?kind=character&q=Ada%20%26%20Bob",
    );
  });
});
