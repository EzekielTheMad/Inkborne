import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { revalidatePath } from "next/cache";
import {
  createRelationship,
  createTimelineEvent,
} from "@/app/(app)/characters/[id]/story-actions";
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);
const characterId = "11111111-1111-4111-8111-111111111111";

function mockClient({ owner = true }: { owner?: boolean } = {}) {
  const ownerQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: owner ? { id: characterId } : null }),
  };
  ownerQuery.select.mockReturnValue(ownerQuery);
  ownerQuery.eq.mockReturnValue(ownerQuery);
  const mutation = {
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    from: vi.fn((table: string) => (table === "characters" ? ownerQuery : mutation)),
  };
  mockedCreateClient.mockResolvedValue(supabase as never);
  return { mutation };
}

describe("character story actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a normalized timeline event for the authenticated owner", async () => {
    const { mutation } = mockClient();
    await expect(
      createTimelineEvent(characterId, {
        title: "  The Sundering  ",
        dateLabel: "Year 12",
        description: null,
        visibility: "dm_only",
        sortOrder: 2,
      }),
    ).resolves.toEqual({ success: true });

    expect(mutation.insert).toHaveBeenCalledWith({
      character_id: characterId,
      created_by: "user-1",
      title: "The Sundering",
      date_label: "Year 12",
      description: { type: "doc", content: [] },
      visibility: "dm_only",
      sort_order: 2,
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/characters/${characterId}`);
  });

  it("creates a campaign-visible relationship with normalized rich text", async () => {
    const { mutation } = mockClient();
    await expect(
      createRelationship(characterId, {
        name: "  Mira  ",
        relationship: "Mentor",
        description: null,
        visibility: "campaign",
      }),
    ).resolves.toEqual({ success: true });

    expect(mutation.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Mira",
        relationship: "Mentor",
        description: { type: "doc", content: [] },
        visibility: "campaign",
      }),
    );
  });

  it("refuses mutations when the authenticated user does not own the character", async () => {
    const { mutation } = mockClient({ owner: false });
    await expect(
      createTimelineEvent(characterId, {
        title: "Forbidden",
        dateLabel: null,
        description: null,
        visibility: "campaign",
        sortOrder: 0,
      }),
    ).resolves.toEqual({ error: "Not authorized" });
    expect(mutation.insert).not.toHaveBeenCalled();
  });
});
