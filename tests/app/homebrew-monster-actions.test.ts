import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), revalidate: vi.fn(), getUser: vi.fn(), redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }) }));
vi.mock("@/lib/supabase/homebrew-monsters-server", () => ({ createHomebrewMonsterRecord: mocks.create, updateHomebrewMonsterRecord: mocks.update }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { createHomebrewMonster, updateHomebrewMonster } from "@/app/(app)/homebrew/monsters/actions";
const idle = { status: "idle" as const };
beforeEach(() => { vi.clearAllMocks(); mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null }); });
describe("monster actions", () => {
  it.each([createHomebrewMonster, updateHomebrewMonster])("authenticates at action boundary", async (action) => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(action(idle, new FormData())).rejects.toThrow("REDIRECT:/login"); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each(["idle", "error", "conflict"])("preserves %s result without revalidation/redirect", async (status) => {
    const result = { status, message: "Keep draft." }; mocks.update.mockResolvedValue(result);
    expect(await updateHomebrewMonster(idle, new FormData())).toEqual(result); expect(mocks.revalidate).not.toHaveBeenCalled(); expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("passes unchanged transport to server validation and revalidates only confirmed create", async () => {
    const form = new FormData(); mocks.create.mockResolvedValue({ id: "monster-id" });
    await expect(createHomebrewMonster(idle, form)).rejects.toThrow("REDIRECT:/homebrew?created=monster-id");
    expect(mocks.create).toHaveBeenCalledWith(form); expect(mocks.revalidate.mock.calls).toEqual([["/homebrew"], ["/library"], ["/library/monster-id"]]);
  });
  it("revalidates owned edit and canonical current detail after confirmed update", async () => {
    mocks.update.mockResolvedValue({ id: "monster-id" }); await expect(updateHomebrewMonster(idle, new FormData())).rejects.toThrow("REDIRECT:/homebrew?updated=monster-id");
    expect(mocks.revalidate.mock.calls).toEqual([["/homebrew"], ["/library"], ["/library/monster-id"], ["/homebrew/monsters/monster-id/edit"]]);
  });
});
