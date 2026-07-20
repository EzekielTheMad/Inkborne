import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TimelineSection } from "@/components/narrative/timeline-section";
import { RelationshipsSection } from "@/components/narrative/relationships-section";
import type {
  CharacterRelationship,
  CharacterTimelineEvent,
} from "@/lib/types/narrative";

vi.mock("@/app/(app)/characters/[id]/story-actions", () => ({
  createTimelineEvent: vi.fn(),
  updateTimelineEvent: vi.fn(),
  deleteTimelineEvent: vi.fn(),
  createRelationship: vi.fn(),
  updateRelationship: vi.fn(),
  deleteRelationship: vi.fn(),
}));
vi.mock("@/components/editor/rich-text-renderer", () => ({
  RichTextRenderer: () => <div>Rich description</div>,
}));
vi.mock("@/components/editor/rich-text-editor", () => ({
  RichTextEditor: () => <div>Rich editor</div>,
}));

const timelineEvent: CharacterTimelineEvent = {
  id: "event-1",
  character_id: "character-1",
  created_by: "user-1",
  title: "The Sundering",
  date_label: "Year 12",
  description: { type: "doc", content: [] },
  visibility: "dm_only",
  sort_order: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const relationship: CharacterRelationship = {
  id: "relationship-1",
  character_id: "character-1",
  created_by: "user-1",
  name: "Mira",
  description: { type: "doc", content: [] },
  relationship: "Mentor",
  visibility: "campaign",
  portrait_url: null,
  metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};

describe("character story sections", () => {
  it("renders timeline entries read-only for a DM", () => {
    render(
      <TimelineSection
        characterId="character-1"
        events={[timelineEvent]}
        isOwner={false}
      />,
    );
    expect(screen.getByText("The Sundering")).toBeInTheDocument();
    expect(screen.getByText("DM & me")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add event/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit the sundering/i })).not.toBeInTheDocument();
  });

  it("shows timeline controls to the character owner", () => {
    render(
      <TimelineSection
        characterId="character-1"
        events={[timelineEvent]}
        isOwner
      />,
    );
    expect(screen.getByRole("button", { name: /add event/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit the sundering/i })).toBeInTheDocument();
  });

  it("renders relationship entries read-only for a DM", () => {
    render(
      <RelationshipsSection
        characterId="character-1"
        relationships={[relationship]}
        isOwner={false}
      />,
    );
    expect(screen.getByText("Mira")).toBeInTheDocument();
    expect(screen.getByText("Mentor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add person/i })).not.toBeInTheDocument();
  });
});
