import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Character } from "@/lib/types/character";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
// This suite tests the page's preference-controlled inclusion, rather than the
// banner's separate dismissal/feedback mutations.
vi.mock("@/components/alpha/alpha-banner", () => ({
  AlphaBanner: () => <aside aria-label="Inkborne alpha notice">Inkborne Alpha</aside>,
}));

import DashboardPage from "@/app/(app)/dashboard/page";
import CharactersPage from "@/app/(app)/characters/page";

type OverviewCharacter = Character & {
  game_systems: { name: string } | Array<{ name: string }> | null;
  campaigns: { name: string } | null;
};
interface QueryResult { data: unknown; error: { message: string; details?: string; hint?: string } | null }

function character(id: string, changes: Partial<OverviewCharacter> = {}): OverviewCharacter {
  return {
    id, user_id: "owner-1", system_id: "system-1", campaign_id: null,
    name: id === "first" ? "Mara Stonepath" : "The Unwritten Traveler", level: 5,
    visibility: "private", archived: false, primary_color: "#2563eb",
    choices: { race: "human", classes: [{ slug: "fighter", level: 5 }] },
    base_stats: {}, state: {}, narrative: {}, narrative_rich: {},
    created_at: "2026-10-01T00:00:00Z",
    game_systems: { name: "D&D 5e 2014" }, campaigns: null,
    ...changes,
  };
}

function readChain(result: QueryResult) {
  const chain = {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), single: vi.fn(),
    then: (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  for (const method of ["select", "eq", "order", "limit"] as const) chain[method].mockReturnValue(chain);
  chain.single.mockResolvedValue(result);
  return chain;
}

function mockReads({
  characters = [character("first"), character("second", { choices: {}, primary_color: null })],
  error = null,
  preferences = {},
  user = { id: "owner-1" } as { id: string } | null,
}: {
  characters?: OverviewCharacter[] | null;
  error?: QueryResult["error"];
  preferences?: Record<string, unknown>;
  user?: { id: string } | null;
} = {}) {
  const profile = readChain({ data: { display_name: "Kai", preferences }, error: null });
  const owned = readChain({ data: characters, error });
  const from = vi.fn((table: string) => {
    if (table === "profiles") return profile;
    if (table === "characters") return owned;
    throw new Error(`Unexpected overview table: ${table}`);
  });
  const getUser = vi.fn().mockResolvedValue({ data: { user }, error: null });
  mocks.createClient.mockResolvedValue({ auth: { getUser }, from });
  return { profile, owned, from, getUser };
}

function projection(chain: ReturnType<typeof readChain>) {
  return String(chain.select.mock.calls[0]?.[0] ?? "").replace(/\s+/g, "");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((destination: string) => { throw new Error(`REDIRECT:${destination}`); });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("dashboard notebook contracts", () => {
  it("reads the owner's active characters in server order with the eight-character limit and saved accents", async () => {
    const { profile, owned, from, getUser } = mockReads();
    render(await DashboardPage());
    expect(getUser).toHaveBeenCalledOnce();
    expect(from.mock.calls.map(([table]) => table)).toEqual(["profiles", "characters"]);
    expect(projection(profile)).toBe("display_name,preferences");
    expect(profile.eq).toHaveBeenCalledWith("id", "owner-1");
    expect(profile.single).toHaveBeenCalledOnce();
    for (const field of ["id", "name", "level", "choices", "narrative", "system_id", "primary_color"]) {
      expect(projection(owned).split(",")).toContain(field);
    }
    expect(projection(owned)).toContain("game_systems(name)");
    expect(owned.eq.mock.calls).toEqual([["user_id", "owner-1"], ["archived", false]]);
    expect(owned.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(owned.limit).toHaveBeenCalledWith(8);
  });

  it("features the first returned character and retains unwritten character, shelf, creation and campaign links", async () => {
    mockReads({ characters: [
      character("first", { created_at: "2020-01-01T00:00:00Z" }),
      character("second", { choices: {}, created_at: "2030-01-01T00:00:00Z" }),
    ] });
    render(await DashboardPage());
    // Query order owns recency; the view must not substitute alphabetical or
    // locally re-sorted order when selecting the featured character.
    const featured = screen.getByRole("region", { name: "Your latest character" });
    expect(within(featured).getByRole("heading", { name: "Mara Stonepath" })).toBeVisible();
    expect(within(featured).getByRole("link")).toHaveAttribute("href", "/characters/first");
    const unwritten = screen.getByRole("link", { name: /The Unwritten Traveler/ });
    expect(unwritten).toHaveAttribute("href", "/characters/second");
    expect(unwritten).toHaveTextContent(/unwritten/i);
    expect(unwritten).toHaveTextContent("Not built yet");
    expect(screen.getByRole("link", { name: /View all/ })).toHaveAttribute("href", "/characters");
    expect(screen.getByRole("link", { name: /Begin a new character/ })).toHaveAttribute("href", "/characters/new");
    expect(screen.getByRole("link", { name: /Open campaigns/ })).toHaveAttribute("href", "/campaigns");
  });

  it("handles a joined system returned as an array without losing its label", async () => {
    mockReads({ characters: [character("first", { game_systems: [{ name: "Mythic Roads" }] })] });
    render(await DashboardPage());
    expect(screen.getByRole("region", { name: "Your latest character" })).toHaveTextContent("Mythic Roads");
  });

  it.each([undefined, null, false, 0])("shows the alpha notice when the dismissal value is %s", async (value) => {
    mockReads({ preferences: { alpha_banner_dismissed_at: value } });
    render(await DashboardPage());
    expect(screen.getByRole("complementary", { name: "Inkborne alpha notice" })).toBeVisible();
  });

  it("honors a saved string dismissal in the populated and empty dashboard", async () => {
    mockReads({ preferences: { alpha_banner_dismissed_at: "2026-10-22T10:00:00Z" } });
    const populated = render(await DashboardPage());
    expect(screen.queryByRole("complementary", { name: "Inkborne alpha notice" })).not.toBeInTheDocument();
    populated.unmount();
    mockReads({ characters: [], preferences: { alpha_banner_dismissed_at: "2026-10-22T10:00:00Z" } });
    render(await DashboardPage());
    expect(screen.queryByRole("complementary", { name: "Inkborne alpha notice" })).not.toBeInTheDocument();
  });

  it("shows the blank notebook and creation link only for a successful empty read", async () => {
    mockReads({ characters: [] });
    render(await DashboardPage());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Welcome, Kai.");
    expect(screen.getByText(/A blank notebook/)).toBeVisible();
    expect(screen.queryByRole("region", { name: "Your latest character" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Begin a character/ })).toHaveAttribute("href", "/characters/new");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a read failure instead of claiming that a failed read is a blank notebook", async () => {
    mockReads({ characters: null, error: { message: "Database read unavailable" } });
    render(await DashboardPage());
    expect(screen.getByRole("alert")).toHaveTextContent(/character|notebook/i);
    expect(screen.queryByText(/A blank notebook/)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your latest character" })).not.toBeInTheDocument();
  });
});

describe("character shelf contracts", () => {
  it("keeps owner/archive filters, system/campaign joins and newest-first ordering without a dashboard limit", async () => {
    const { owned, from, getUser } = mockReads();
    render(await CharactersPage());
    expect(getUser).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledExactlyOnceWith("characters");
    expect(projection(owned)).toBe("*,game_systems(name),campaigns(name)");
    expect(owned.eq.mock.calls).toEqual([["user_id", "owner-1"], ["archived", false]]);
    expect(owned.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(owned.limit).not.toHaveBeenCalled();
  });

  it("keeps every card, including unwritten cards, linked to its character page", async () => {
    mockReads();
    render(await CharactersPage());
    expect(screen.getByRole("link", { name: /Mara Stonepath/ })).toHaveAttribute("href", "/characters/first");
    const unwritten = screen.getByRole("link", { name: /The Unwritten Traveler/ });
    expect(unwritten).toHaveAttribute("href", "/characters/second");
    expect(unwritten).toHaveTextContent(/Unwritten/);
    expect(screen.getAllByRole("link").filter(link => link.getAttribute("href")?.includes("/builder"))).toHaveLength(0);
    expect(screen.getByRole("link", { name: /Begin a new character/ })).toHaveAttribute("href", "/characters/new");
  });

  it("retains the blank shelf and both creation destinations for a successful empty read", async () => {
    mockReads({ characters: [] });
    render(await CharactersPage());
    expect(screen.getByRole("heading", { name: "No characters yet." })).toBeVisible();
    const creationLinks = screen.getAllByRole("link");
    expect(creationLinks).toHaveLength(2);
    expect(creationLinks.every(link => link.getAttribute("href") === "/characters/new")).toBe(true);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("distinguishes a failed read from a blank shelf without rendering fictional cards", async () => {
    mockReads({ characters: null, error: { message: "Database read unavailable" } });
    render(await CharactersPage());
    expect(screen.getByRole("alert")).toHaveTextContent(/character|notebook/i);
    expect(screen.queryByRole("heading", { name: "No characters yet." })).not.toBeInTheDocument();
    expect(screen.queryByText("A blank shelf")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Mara Stonepath|The Unwritten Traveler/ })).not.toBeInTheDocument();
  });

  it("redirects unauthenticated visitors before attempting an owned-character read", async () => {
    const { from } = mockReads({ user: null });
    await expect(CharactersPage()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/login");
    expect(from).not.toHaveBeenCalled();
  });
});
