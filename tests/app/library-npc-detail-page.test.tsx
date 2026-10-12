import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { npcEnvelope } from "@/tests/fixtures/npcs";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getEntry: vi.fn(), redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/compendium-server", () => ({ getCompendiumEntry: mocks.getEntry }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
import CompendiumEntryPage from "@/app/(app)/library/[id]/page";

beforeEach(() => {
  vi.clearAllMocks(); mocks.getUser.mockResolvedValue({ data: { user: { id: npcEnvelope().owner_id } } });
  mocks.getEntry.mockResolvedValue(npcEnvelope());
  mocks.redirect.mockImplementation(() => { throw Error("Synthetic login redirect"); });
  mocks.notFound.mockImplementation(() => { throw Error("Synthetic not-found"); });
});
describe("actual NPC detail route, mocked auth/transport", () => {
  it("mounts narrative profile and preserves bounded local return query", async () => {
    const returnTo = "/library?category=npcs&q=keeper";
    render(await CompendiumEntryPage({ params: Promise.resolve({ id: npcEnvelope().id }), searchParams: Promise.resolve({ returnTo }) }));
    expect(screen.getByRole("region", { name: "NPC profile" })).toBeVisible();
    expect(screen.getByText("The bell maker")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to Library" })).toHaveAttribute("href", returnTo);
  });
  it("keeps signed-out reads behind login before content fetch", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    await expect(CompendiumEntryPage({ params: Promise.resolve({ id: npcEnvelope().id }), searchParams: Promise.resolve({}) })).rejects.toThrow("Synthetic login");
    expect(mocks.getEntry).not.toHaveBeenCalled();
  });
  it("rejects malformed IDs and unavailable rows without inventing NPC content", async () => {
    await expect(CompendiumEntryPage({ params: Promise.resolve({ id: "bad" }), searchParams: Promise.resolve({}) })).rejects.toThrow("Synthetic not-found");
    expect(mocks.getEntry).not.toHaveBeenCalled();
    mocks.getEntry.mockResolvedValue(null);
    await expect(CompendiumEntryPage({ params: Promise.resolve({ id: npcEnvelope().id }), searchParams: Promise.resolve({}) })).rejects.toThrow("Synthetic not-found");
  });
  it("refuses a foreign/javascript return target and uses actual NPC category fallback", async () => {
    render(await CompendiumEntryPage({ params: Promise.resolve({ id: npcEnvelope().id }), searchParams: Promise.resolve({ category: "npcs", returnTo: "javascript:alert(1)" }) }));
    expect(screen.getByRole("link", { name: "Back to Library" })).toHaveAttribute("href", "/library?category=npcs");
  });
});
