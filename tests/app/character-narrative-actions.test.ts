import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/storage", () => ({
  uploadCharacterImage: vi.fn(),
  deleteCharacterImage: vi.fn(),
}));

import { saveNarrativeRich } from "@/app/(app)/characters/[id]/narrative-actions";
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);

function mockNarrativeClient() {
  const ownerQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: "character-1",
        user_id: "user-1",
        narrative: {},
        narrative_rich: { backstory_origin: { type: "doc", content: [] } },
        choices: {},
      },
      error: null,
    }),
  };
  ownerQuery.select.mockReturnValue(ownerQuery);
  ownerQuery.eq.mockReturnValue(ownerQuery);

  const rpc = vi.fn().mockResolvedValue({ error: null });
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    from: vi.fn((table: string) => {
      if (table === "characters") return ownerQuery;
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc,
  };
  mockedCreateClient.mockResolvedValue(supabase as never);
  return { rpc };
}

describe("saveNarrativeRich", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores shared narrative and DM notes in separate security boundaries", async () => {
    const { rpc } = mockNarrativeClient();
    const dmDocument = { type: "doc", content: [{ type: "paragraph" }] };

    await expect(
      saveNarrativeRich("character-1", {
        backstory_turning_point: { type: "doc", content: [] },
        backstory_dm_notes: dmDocument,
      }),
    ).resolves.toEqual({ success: true });

    expect(rpc).toHaveBeenCalledWith("save_character_narrative_rich", {
      target_character_id: "character-1",
      shared_narrative: {
        backstory_origin: { type: "doc", content: [] },
        backstory_turning_point: { type: "doc", content: [] },
      },
      dm_notes: dmDocument,
      write_dm_notes: true,
    });
  });

  it("does not create a DM-note row when a shared field is saved alone", async () => {
    const { rpc } = mockNarrativeClient();
    await saveNarrativeRich("character-1", {
      backstory_left_behind: { type: "doc", content: [] },
    });
    expect(rpc).toHaveBeenCalledWith(
      "save_character_narrative_rich",
      expect.objectContaining({ write_dm_notes: false }),
    );
  });
});
