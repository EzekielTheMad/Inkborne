import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), record: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.user } }) }));
vi.mock("@/lib/supabase/homebrew-npcs-server", () => ({ getOwnedHomebrewNpc: mocks.record }));
vi.mock("@/components/library/npc-form", () => ({ NpcForm: ({ mode }: { mode: string }) => <p>Actual route with stubbed {mode} form</p> }));
vi.mock("next/navigation", () => ({ redirect: () => { throw Error("Fixture login redirect"); }, notFound: () => { throw Error("Fixture unavailable ID"); } }));
import NewNpcPage from "@/app/(app)/homebrew/npcs/new/page";
import EditNpcPage from "@/app/(app)/homebrew/npcs/[id]/edit/page";
import { npcId, originalNpc } from "@/tests/fixtures/npcs";
beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue({ data: { user: { id: npcId(3) } }, error: null }); mocks.record.mockResolvedValue({ id: npcId(1), name: "Original NPC", version: 1, data: originalNpc }); });
describe("NPC private new/edit routes, mocked reads", () => {
  it("uses authenticated ordinary routes and exact supplied ID", async () => {
    render(await NewNpcPage()); expect(screen.getByRole("heading", { name: "Create private NPC" })).toBeVisible();
    render(await EditNpcPage({ params: Promise.resolve({ id: npcId(1) }) })); expect(mocks.record).toHaveBeenCalledWith(npcId(1));
    expect(screen.getByText("Private NPC · read version 1")).toBeVisible();
  });
  it("auth failure redirects before owned reads", async () => {
    mocks.user.mockResolvedValue({ data: { user: null }, error: null });
    await expect(EditNpcPage({ params: Promise.resolve({ id: npcId(1) }) })).rejects.toThrow("Fixture login"); expect(mocks.record).not.toHaveBeenCalled();
  });
  it("unsupported data/read refusal is unavailable; absent eligible row stays not-found", async () => {
    mocks.record.mockRejectedValue(Error("Original effectful NPC refused")); render(await EditNpcPage({ params: Promise.resolve({ id: npcId(1) }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("NPC unavailable for editing"); expect(screen.queryByText(/stubbed edit/)).toBeNull();
    mocks.record.mockResolvedValue(null); await expect(EditNpcPage({ params: Promise.resolve({ id: npcId(1) }) })).rejects.toThrow("Fixture unavailable ID");
  });
});
