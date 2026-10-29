import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { revalidatePath } from "next/cache";
import { createRelationship, createTimelineEvent, updateTimelineEvent, deleteTimelineEvent, readTimelineEvent } from "@/app/(app)/characters/[id]/story-actions";
import { createClient } from "@/lib/supabase/server";

const characterId = "11111111-1111-4111-8111-111111111111";
const entryId = "22222222-2222-4222-8222-222222222222";
const ownerId = "33333333-3333-4333-8333-333333333333";
const opened = "2026-01-01T00:00:00.000Z";
const input = { title: "  The Sundering  ", dateLabel: "Year 12", description: null, visibility: "dm_only" as const, sortOrder: 2, entryId, expectedUpdatedAt: opened };
const row = { id: entryId, character_id: characterId, created_by: ownerId, title: "Saved elsewhere", date_label: null,
  description: { type: "doc", content: [] }, visibility: "dm_only", sort_order: 2, created_at: opened, updated_at: opened };
type Outcome = { data: unknown; error: { message: string; code?: string } | null };

function mockClient({ owner = true, user = true, outcome, reject = false }: { owner?: boolean; user?: boolean; outcome?: Outcome; reject?: boolean } = {}) {
  const ownerQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: owner ? { id: characterId } : null, error: null }) };
  ownerQuery.select.mockReturnValue(ownerQuery); ownerQuery.eq.mockReturnValue(ownerQuery);
  let updated: Record<string, unknown> | undefined;
  const result = () => outcome ?? { data: updated ? { id: entryId, updated_at: updated.updated_at } : { id: entryId, updated_at: opened }, error: null };
  const mutation = {
    insert: vi.fn(), update: vi.fn((value: Record<string, unknown>) => { updated = value; return mutation; }), delete: vi.fn(),
    select: vi.fn(), eq: vi.fn(),
    single: vi.fn(() => reject ? Promise.reject(Error("connection lost")) : Promise.resolve(result())),
    maybeSingle: vi.fn(() => reject ? Promise.reject(Error("connection lost")) : Promise.resolve(result())), error: null,
  };
  for (const method of [mutation.insert, mutation.delete, mutation.select, mutation.eq]) method.mockReturnValue(mutation);
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: user ? { id: ownerId } : null }, error: null }) },
    from: vi.fn((table: string) => table === "characters" ? ownerQuery : mutation),
  };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { mutation, ownerQuery, supabase };
}

describe("character journal actions", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("creates only the identified narrative row and requires its exact acknowledgement", async () => {
    const { mutation, supabase } = mockClient();
    await expect(createTimelineEvent(characterId, input)).resolves.toEqual({ status: "saved", entryId, updatedAt: opened });
    expect(mutation.insert).toHaveBeenCalledWith({ id: entryId, character_id: characterId, created_by: ownerId,
      title: "The Sundering", date_label: "Year 12", description: { type: "doc", content: [] }, visibility: "dm_only", sort_order: 2 });
    expect(mutation.select).toHaveBeenCalledWith("id, updated_at");
    expect(supabase.from.mock.calls.map(([table]) => table)).toEqual(["characters", "character_timeline_events"]);
    expect(revalidatePath).toHaveBeenCalledWith(`/characters/${characterId}`);
  });

  it("updates with every ownership/identity/precondition filter and advances a future microsecond timestamp", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse(opened));
    const { mutation } = mockClient();
    const expectedUpdatedAt = "2026-02-01T00:00:00.000999Z";
    await expect(updateTimelineEvent(characterId, entryId, { ...input, expectedUpdatedAt })).resolves.toMatchObject({ status: "saved", entryId });
    expect(mutation.update).toHaveBeenCalledWith(expect.objectContaining({ updated_at: "2026-02-01T00:00:00.001Z" }));
    expect(mutation.eq.mock.calls).toEqual([["id", entryId], ["character_id", characterId], ["created_by", ownerId], ["updated_at", expectedUpdatedAt]]);
    expect(Object.keys(mutation.update.mock.calls[0][0]).sort()).toEqual(["date_label", "description", "sort_order", "title", "updated_at", "visibility"]);
  });

  it("requires old create clients to reopen before any authentication or insert", async () => {
    mockClient();
    await expect(createTimelineEvent(characterId, { ...input, entryId: undefined })).resolves.toMatchObject({ status: "rejected", code: "reopen_required" });
    expect(createClient).not.toHaveBeenCalled();
  });
  it("requires old update clients to reopen without attempting a write", async () => {
    const { mutation } = mockClient();
    await expect(updateTimelineEvent(characterId, entryId, { ...input, expectedUpdatedAt: undefined })).resolves.toMatchObject({ status: "rejected", code: "reopen_required" });
    expect(mutation.update).not.toHaveBeenCalled();
  });
  it("rejects invalid fields before mutation", async () => {
    const { mutation } = mockClient();
    await expect(createTimelineEvent(characterId, { ...input, title: " " })).resolves.toMatchObject({ status: "rejected", code: "invalid" });
    expect(mutation.insert).not.toHaveBeenCalled();
  });
  it.each(["DM", "member", "outsider", "signed out"])("rejects journal writes and recovery reads for %s before touching child data", async role => {
    const { mutation } = mockClient({ owner: false, user: role !== "signed out" });
    for (const result of [await createTimelineEvent(characterId, input), await updateTimelineEvent(characterId, entryId, input), await readTimelineEvent(characterId, entryId)]) {
      expect(result).toMatchObject({ status: "rejected", code: "not_authorized" });
    }
    await expect(deleteTimelineEvent(characterId, entryId)).resolves.toEqual({ error: "Not authorized" });
    expect(mutation.insert).not.toHaveBeenCalled(); expect(mutation.update).not.toHaveBeenCalled(); expect(mutation.maybeSingle).not.toHaveBeenCalled();
  });

  it("returns conflict for a stale, removed or foreign event's zero-row update", async () => {
    mockClient({ outcome: { data: null, error: null } });
    await expect(updateTimelineEvent(characterId, entryId, input)).resolves.toMatchObject({ status: "conflict" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("does not overwrite or acknowledge a duplicate create identity", async () => {
    const { mutation } = mockClient({ outcome: { data: null, error: { code: "23505", message: "duplicate" } } });
    await expect(createTimelineEvent(characterId, input)).resolves.toMatchObject({ status: "conflict" });
    expect(mutation.update).not.toHaveBeenCalled(); expect(revalidatePath).not.toHaveBeenCalled();
  });
  it.each([null, { id: characterId, updated_at: opened }, { id: entryId }])("treats missing/mismatched create acknowledgements as unknown", async data => {
    mockClient({ outcome: { data, error: null } });
    await expect(createTimelineEvent(characterId, input)).resolves.toMatchObject({ status: "unknown" });
  });
  it("does not acknowledge an unexpected updated timestamp", async () => {
    mockClient({ outcome: { data: { id: entryId, updated_at: opened }, error: null } });
    await expect(updateTimelineEvent(characterId, entryId, input)).resolves.toMatchObject({ status: "unknown" });
  });
  it("does not round a mismatched sub-millisecond acknowledgement into success", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse(opened));
    mockClient({ outcome: { data: { id: entryId, updated_at: "2026-01-01T00:00:00.001001Z" }, error: null } });
    await expect(updateTimelineEvent(characterId, entryId, input)).resolves.toMatchObject({ status: "unknown" });
  });
  it.each([false, true])("treats resolved or thrown transport failures as unknown after mutation", async reject => {
    mockClient({ reject, outcome: { data: null, error: { message: "fetch failed" } } });
    await expect(createTimelineEvent(characterId, input)).resolves.toMatchObject({ status: "unknown" });
    await expect(updateTimelineEvent(characterId, entryId, input)).resolves.toMatchObject({ status: "unknown" });
  });

  it("reads back the owner's exact ID even when the current content differs from the attempted draft", async () => {
    const { mutation } = mockClient({ outcome: { data: row, error: null } });
    await expect(readTimelineEvent(characterId, entryId)).resolves.toEqual({ status: "found", entry: row });
    expect(mutation.eq.mock.calls).toEqual([["id", entryId], ["character_id", characterId], ["created_by", ownerId]]);
    expect(mutation.insert).not.toHaveBeenCalled(); expect(mutation.update).not.toHaveBeenCalled();
  });
  it("reports absence only after a completed authorized empty read", async () => {
    mockClient({ outcome: { data: null, error: null } });
    await expect(readTimelineEvent(characterId, entryId)).resolves.toEqual({ status: "absent" });
  });
  it.each([{ data: null, error: { message: "transport failed" } }, { data: { ...row, character_id: entryId }, error: null }, { data: { ...row, description: {} }, error: null }])("does not turn read errors or malformed/foreign rows into absence", async outcome => {
    mockClient({ outcome });
    await expect(readTimelineEvent(characterId, entryId)).resolves.toMatchObject({ status: "unknown" });
  });
  it("keeps relationship creation on its existing contract", async () => {
    const { mutation } = mockClient();
    await expect(createRelationship(characterId, { name: "  Mira  ", relationship: "Mentor", description: null, visibility: "campaign" })).resolves.toEqual({ success: true });
    expect(mutation.insert).toHaveBeenCalledWith(expect.objectContaining({ name: "Mira", relationship: "Mentor", visibility: "campaign" }));
  });
});
