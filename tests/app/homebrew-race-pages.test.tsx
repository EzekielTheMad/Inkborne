import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), getOwned: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/homebrew-races-server", () => ({ getOwnedHomebrewRace: mocks.getOwned }));
vi.mock("@/components/library/race-form", () => ({ RaceForm: ({ mode, initialValue }: { mode: string; initialValue?: { name: string; version: number } }) =>
  <p>{mode} form {initialValue?.name} {initialValue?.version}</p> }));

import NewHomebrewRacePage from "@/app/(app)/homebrew/races/new/page";
import EditHomebrewRacePage from "@/app/(app)/homebrew/races/[id]/edit/page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
});

describe("private race routes", () => {
  it("authenticates creation and offers the real form boundary", async () => {
    render(await NewHomebrewRacePage());
    expect(screen.getByRole("heading", { name: "Create a race" })).toBeVisible();
    expect(screen.getByText("create form")).toBeVisible();
  });
  it("redirects a failed authentication before loading race", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: new Error("expired") });
    await expect(EditHomebrewRacePage({ params: Promise.resolve({ id: "race" }) })).rejects.toThrow("REDIRECT:/login");
    expect(mocks.getOwned).not.toHaveBeenCalled();
  });
  it("returns not found when the owned active private race is unavailable", async () => {
    mocks.getOwned.mockResolvedValue(null);
    await expect(EditHomebrewRacePage({ params: Promise.resolve({ id: "race" }) })).rejects.toThrow("NOT_FOUND");
    expect(mocks.getOwned).toHaveBeenCalledWith("race");
  });
  it("passes the owned latest version to editing without changing character pins", async () => {
    mocks.getOwned.mockResolvedValue({ id: "race", name: "Lantern", version: 3, data: {} });
    render(await EditHomebrewRacePage({ params: Promise.resolve({ id: "race" }) }));
    expect(screen.getByText("edit form Lantern 3")).toBeVisible();
    expect(screen.getByText(/Existing character pins keep their saved version/)).toBeVisible();
  });
});
