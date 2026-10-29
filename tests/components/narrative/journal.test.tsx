import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TimelineSection } from "@/components/narrative/timeline-section";
import { createTimelineEvent, updateTimelineEvent, readTimelineEvent } from "@/app/(app)/characters/[id]/story-actions";
import type { CharacterTimelineEvent } from "@/lib/types/narrative";

vi.mock("@/app/(app)/characters/[id]/story-actions", () => ({
  createTimelineEvent: vi.fn(), updateTimelineEvent: vi.fn(), deleteTimelineEvent: vi.fn(), readTimelineEvent: vi.fn(),
}));
vi.mock("@/components/editor/rich-text-editor", () => ({
  RichTextEditor: ({ content, onChange, editable }: {
    content: { content?: { content?: { text?: string }[] }[] } | null;
    onChange: (content: unknown) => void; editable: boolean;
  }) => <textarea aria-label="Entry body" disabled={!editable}
    value={content?.content?.[0]?.content?.[0]?.text ?? ""}
    onChange={event => onChange({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: event.target.value }] }] })} />,
}));
vi.mock("@/components/editor/rich-text-renderer", () => ({ RichTextRenderer: () => <div /> }));

const entry: CharacterTimelineEvent = {
  id: "entry-1", character_id: "character-1", created_by: "owner", title: "First discovery",
  date_label: "Autumn", description: { type: "doc", content: [] }, visibility: "dm_only",
  sort_order: 7, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};
const later = { ...entry, id: "entry-2", title: "Second discovery", sort_order: 3, created_at: "2026-02-01T00:00:00Z" };
const start = () => {
  fireEvent.click(screen.getByRole("button", { name: "Write entry" }));
  fireEvent.change(screen.getByLabelText("Entry title"), { target: { value: "Night watch" } });
  fireEvent.change(screen.getByLabelText("Entry body"), { target: { value: "I heard the river." } });
};

describe("journal workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createTimelineEvent).mockImplementation(async (_character, input) => ({ status: "saved", entryId: input.entryId!, updatedAt: entry.updated_at }));
    vi.mocked(updateTimelineEvent).mockResolvedValue({ status: "saved", entryId: entry.id, updatedAt: entry.updated_at });
    vi.mocked(readTimelineEvent).mockResolvedValue({ status: "unknown", error: "Read failed" });
  });

  it("creates on the existing character with a narrow audience and appends beyond sparse timeline order", async () => {
    render(<TimelineSection characterId="character-1" events={[entry]} isOwner />);
    start();
    expect(screen.getByLabelText("Audience if assigned to a campaign")).toHaveValue("dm_only");
    fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    await waitFor(() => expect(screen.queryByLabelText("Entry title")).not.toBeInTheDocument());
    expect(createTimelineEvent).toHaveBeenCalledWith("character-1", {
      title: "Night watch", dateLabel: null, description: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "I heard the river." }] }] },
      visibility: "dm_only", sortOrder: 8, entryId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it("retains the full draft on an explicit failure, disables switching and allows retry", async () => {
    vi.mocked(createTimelineEvent).mockResolvedValueOnce({ status: "rejected", code: "not_authorized", error: "Not authorized" });
    render(<TimelineSection characterId="character-1" events={[entry]} isOwner />);
    start();
    expect(screen.getByRole("button", { name: `Edit ${entry.title}` })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not authorized");
    expect(screen.getByLabelText("Entry title")).toHaveValue("Night watch");
    expect(screen.getByLabelText("Entry body")).toHaveValue("I heard the river.");
    expect(screen.getByRole("button", { name: "Download draft" })).toBeEnabled();
    fireEvent.click(await screen.findByRole("button", { name: "Save entry" }));
    await waitFor(() => expect(createTimelineEvent).toHaveBeenCalledTimes(2));
  });

  it("retains an uncertain draft and prevents blind duplicate replay", async () => {
    vi.mocked(createTimelineEvent).mockRejectedValueOnce(new Error("Connection lost"));
    render(<TimelineSection characterId="character-1" events={[]} isOwner />);
    start(); fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Save status unknown");
    expect(screen.getByRole("button", { name: "Save entry" })).toBeDisabled();
    expect(screen.getByLabelText("Entry body")).toHaveValue("I heard the river.");
    expect(createTimelineEvent).toHaveBeenCalledTimes(1);
  });

  it("treats resolved transport errors as uncertain because the write may have committed", async () => {
    vi.mocked(createTimelineEvent).mockResolvedValueOnce({ status: "unknown", error: "TypeError: fetch failed" });
    render(<TimelineSection characterId="character-1" events={[]} isOwner />);
    start(); fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Save status unknown");
    expect(screen.getByRole("button", { name: "Save entry" })).toBeDisabled();
    expect(screen.getByLabelText("Entry body")).toHaveValue("I heard the river.");
    expect(createTimelineEvent).toHaveBeenCalledTimes(1);
  });

  it("reopens an existing entry and changes its explicit audience", async () => {
    vi.mocked(updateTimelineEvent).mockResolvedValue({ status: "saved", entryId: entry.id, updatedAt: entry.updated_at });
    render(<TimelineSection characterId="character-1" campaignId="campaign" events={[entry]} isOwner />);
    fireEvent.click(screen.getByRole("button", { name: `Edit ${entry.title}` }));
    expect(screen.getByLabelText("Entry title")).toHaveValue(entry.title);
    fireEvent.change(screen.getByLabelText("Audience"), { target: { value: "campaign" } });
    fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    await waitFor(() => expect(updateTimelineEvent).toHaveBeenCalledWith("character-1", entry.id,
      expect.objectContaining({ title: entry.title, visibility: "campaign", sortOrder: 7, expectedUpdatedAt: entry.updated_at })));
  });

  it("browses by written time or preserved timeline order without mutating inputs", () => {
    const original = [entry, later];
    render(<TimelineSection characterId="character-1" events={original} isOwner={false} />);
    const titles = () => screen.getAllByRole("heading", { level: 3 }).map(node => node.textContent);
    expect(titles()).toEqual([later.title, entry.title]);
    fireEvent.change(screen.getByLabelText("Browse entries"), { target: { value: "oldest" } });
    expect(titles()).toEqual([entry.title, later.title]);
    fireEvent.change(screen.getByLabelText("Browse entries"), { target: { value: "timeline" } });
    expect(titles()).toEqual([later.title, entry.title]);
    expect(original).toEqual([entry, later]);
  });

  it("does not reuse drafts across character or viewer boundaries", () => {
    const { rerender } = render(<TimelineSection characterId="character-1" events={[]} isOwner />);
    start();
    rerender(<TimelineSection characterId="character-2" events={[]} isOwner />);
    fireEvent.click(screen.getByRole("button", { name: "Write entry" }));
    expect(screen.getByLabelText("Entry title")).toHaveValue("");
    rerender(<TimelineSection characterId="character-2" events={[]} isOwner={false} />);
    expect(screen.queryByLabelText("Entry title")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps the opened entry draft if a refresh changes or removes its saved row", () => {
    const { rerender } = render(<TimelineSection characterId="character-1" events={[entry]} isOwner />);
    fireEvent.click(screen.getByRole("button", { name: `Edit ${entry.title}` }));
    fireEvent.change(screen.getByLabelText("Entry title"), { target: { value: "Unsaved reflection" } });
    rerender(<TimelineSection characterId="character-1" events={[{ ...entry, title: "Changed elsewhere" }]} isOwner />);
    expect(screen.getByLabelText("Entry title")).toHaveValue("Unsaved reflection");
    rerender(<TimelineSection characterId="character-1" events={[]} isOwner />);
    expect(screen.getByLabelText("Entry title")).toHaveValue("Unsaved reflection");
  });

  it("retains a conflicting draft and keeps the opened timestamp through a refreshed row", async () => {
    vi.mocked(updateTimelineEvent).mockResolvedValue({ status: "conflict", error: "Entry changed or removed. Keep your draft." });
    const { rerender } = render(<TimelineSection characterId="character-1" events={[entry]} isOwner />);
    fireEvent.click(screen.getByRole("button", { name: `Edit ${entry.title}` }));
    fireEvent.change(screen.getByLabelText("Entry title"), { target: { value: "My unsaved change" } });
    rerender(<TimelineSection characterId="character-1" events={[{ ...entry, updated_at: "2026-02-01T00:00:00Z" }]} isOwner />);
    fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("changed or removed");
    expect(updateTimelineEvent).toHaveBeenCalledWith("character-1", entry.id, expect.objectContaining({ expectedUpdatedAt: entry.updated_at }));
    expect(screen.getByLabelText("Entry title")).toHaveValue("My unsaved change");
    expect(screen.getByRole("button", { name: "Save entry" })).toBeDisabled();
  });

  it("retries an uncertain create only after exact-ID absence, preserving the same UUID", async () => {
    vi.mocked(createTimelineEvent).mockResolvedValueOnce({ status: "unknown", error: "Connection lost" });
    vi.mocked(readTimelineEvent).mockResolvedValue({ status: "absent" });
    render(<TimelineSection characterId="character-1" events={[]} isOwner />);
    start(); fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    await screen.findByRole("alert");
    const firstId = vi.mocked(createTimelineEvent).mock.calls[0][1].entryId;
    expect(screen.getByRole("button", { name: "Save entry" })).toBeDisabled();
    fireEvent.click(await screen.findByRole("button", { name: "Check saved entry" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save entry" })).toBeEnabled());
    expect(readTimelineEvent).toHaveBeenCalledWith("character-1", firstId);
    expect(createTimelineEvent).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    await waitFor(() => expect(createTimelineEvent).toHaveBeenCalledTimes(2));
    expect(vi.mocked(createTimelineEvent).mock.calls[1][1].entryId).toBe(firstId);
  });

  it("shows exact-ID readback without matching title/body, discarding the draft or replaying a create", async () => {
    vi.mocked(createTimelineEvent).mockResolvedValueOnce({ status: "unknown", error: "Connection lost" });
    vi.mocked(readTimelineEvent).mockImplementation(async (_character, id) => ({ status: "found", entry: { ...entry, id, title: "Changed elsewhere" } }));
    render(<TimelineSection characterId="character-1" events={[]} isOwner />);
    start(); fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    await screen.findByRole("alert");
    fireEvent.click(await screen.findByRole("button", { name: "Check saved entry" }));
    expect(await screen.findByRole("heading", { name: "Saved entry: Changed elsewhere" })).toBeInTheDocument();
    expect(screen.getByLabelText("Entry title")).toHaveValue("Night watch");
    expect(screen.getByLabelText("Entry body")).toHaveValue("I heard the river.");
    expect(screen.getByRole("button", { name: "Save entry" })).toBeDisabled();
    expect(createTimelineEvent).toHaveBeenCalledTimes(1);
  });

  it.each(["unknown", "rejected"] as const)("never infers absence from %s recovery", async status => {
    vi.mocked(createTimelineEvent).mockResolvedValueOnce({ status: "unknown", error: "Connection lost" });
    vi.mocked(readTimelineEvent).mockResolvedValue(status === "unknown"
      ? { status: "unknown", error: "Read failed" } : { status: "rejected", code: "not_authorized", error: "Not authorized" });
    render(<TimelineSection characterId="character-1" events={[]} isOwner />);
    start(); fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    await screen.findByRole("alert");
    fireEvent.click(await screen.findByRole("button", { name: "Check saved entry" }));
    await waitFor(() => expect(readTimelineEvent).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Save entry" })).toBeDisabled();
    expect(createTimelineEvent).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Entry body")).toHaveValue("I heard the river.");
  });

  it("does not close on a legacy or mismatched success response", async () => {
    vi.mocked(createTimelineEvent).mockResolvedValueOnce({ status: "saved", entryId: "another-entry", updatedAt: entry.updated_at });
    render(<TimelineSection characterId="character-1" events={[]} isOwner />);
    start(); fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Save status unknown");
    expect(screen.getByLabelText("Entry title")).toHaveValue("Night watch");
  });

  it("does not enable replay for a malformed absence response carrying an error", async () => {
    vi.mocked(createTimelineEvent).mockResolvedValueOnce({ status: "unknown", error: "Connection lost" });
    vi.mocked(readTimelineEvent).mockResolvedValue({ status: "absent", error: "Transport failed" } as never);
    render(<TimelineSection characterId="character-1" events={[]} isOwner />);
    start(); fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    await screen.findByRole("alert");
    fireEvent.click(await screen.findByRole("button", { name: "Check saved entry" }));
    await waitFor(() => expect(readTimelineEvent).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Save entry" })).toBeDisabled();
    expect(createTimelineEvent).toHaveBeenCalledTimes(1);
  });
});
