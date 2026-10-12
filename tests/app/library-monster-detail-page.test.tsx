import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { monsterEnvelope } from "@/tests/fixtures/monsters";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getEntry: vi.fn(), redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/compendium-server", () => ({ getCompendiumEntry: mocks.getEntry }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
import CompendiumEntryPage from "@/app/(app)/library/[id]/page";

describe("existing detail route with monster fixtures (mocked auth/transport)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: monsterEnvelope().owner_id } } });
    mocks.getEntry.mockResolvedValue(monsterEnvelope());
    mocks.redirect.mockImplementation(() => { throw new Error("Synthetic redirect"); });
    mocks.notFound.mockImplementation(() => { throw new Error("Synthetic not-found"); });
  });
  it("mounts the real read-only detail and preserves a bounded Library return query", async () => {
    const returnTo = "/library?category=monsters&size=Small";
    render(await CompendiumEntryPage({ params: Promise.resolve({ id: monsterEnvelope().id }), searchParams: Promise.resolve({ returnTo }) }));
    expect(mocks.getEntry).toHaveBeenCalledWith(monsterEnvelope().id);
    expect(screen.getByText("18 (3d6 + 8)")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to Library" })).toHaveAttribute("href", returnTo);
  });
  it("keeps signed-out reads behind the existing login redirect", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    await expect(CompendiumEntryPage({ params: Promise.resolve({ id: monsterEnvelope().id }), searchParams: Promise.resolve({}) })).rejects.toThrow("Synthetic redirect");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.getEntry).not.toHaveBeenCalled();
  });
  it("rejects malformed IDs before querying and keeps missing rows not-found", async () => {
    await expect(CompendiumEntryPage({ params: Promise.resolve({ id: "not-a-uuid" }), searchParams: Promise.resolve({}) })).rejects.toThrow("Synthetic not-found");
    expect(mocks.getEntry).not.toHaveBeenCalled();
    mocks.getEntry.mockResolvedValue(null);
    await expect(CompendiumEntryPage({ params: Promise.resolve({ id: monsterEnvelope().id }), searchParams: Promise.resolve({}) })).rejects.toThrow("Synthetic not-found");
  });
  it("refuses a javascript or foreign return URL and retains the monster category fallback", async () => {
    render(await CompendiumEntryPage({ params: Promise.resolve({ id: monsterEnvelope().id }), searchParams: Promise.resolve({ category: "monsters", returnTo: "javascript:alert(1)" }) }));
    expect(screen.getByRole("link", { name: "Back to Library" })).toHaveAttribute("href", "/library?category=monsters");
  });
});
