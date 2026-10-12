import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/supabase/homebrew-npcs-server", () => ({ createHomebrewNpcRecord: mocks.create, updateHomebrewNpcRecord: mocks.update }));
import { createHomebrewNpc, updateHomebrewNpc } from "@/app/(app)/homebrew/npcs/actions";
import { npcId } from "@/tests/fixtures/npcs";
beforeEach(() => vi.clearAllMocks());
describe("NPC action response and confirmed-only cache invalidation", () => {
  it("returns confirmed exact version without redirect/query notice", async () => {
    const result = { status: "saved", id: npcId(1), version: 1, operation: "create" }; mocks.create.mockResolvedValue(result);
    expect(await createHomebrewNpc({ status: "idle" }, new FormData())).toEqual(result);
    expect(mocks.revalidate.mock.calls).toEqual([["/homebrew"], ["/library"], [`/library/${npcId(1)}`], [`/homebrew/npcs/${npcId(1)}/edit`]]);
  });
  it.each(["error", "uncertain", "conflict", "unchanged"])("%s does not revalidate", async status => {
    mocks.update.mockResolvedValue({ status, message: "Synthetic feedback" }); await updateHomebrewNpc({ status: "idle" }, new FormData());
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
