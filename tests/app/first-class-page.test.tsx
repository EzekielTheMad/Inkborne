import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), submit: vi.fn(), check: vi.fn(), form: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("next/navigation", () => ({ notFound: () => { throw Error("not-found"); },
  redirect: (url: string) => { throw Error("redirect:" + url); } }));
vi.mock("@/app/(app)/characters/[id]/builder/first-class/actions", () => ({ submitFirstClass: mocks.submit, checkFirstClass: mocks.check }));
vi.mock("@/app/(app)/characters/[id]/builder/first-class/first-class-form", () => ({
  FirstClassForm: (props: unknown) => { mocks.form(props); return <p>First-class recovery fixture</p>; },
}));
import FirstClassPage from "@/app/(app)/characters/[id]/builder/first-class/page";

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const account = id(1), target = id(2), system = id(3), content = id(4);
const character = () => ({ id: target, user_id: account, system_id: system, campaign_id: null, action_revision: "0", choices: {},
  game_systems: { slug: "dnd-5e-2014", status: "published" } });
function setup(row: Record<string, unknown> | null = character(), characterError: unknown = null,
  contentError: unknown = null, user: unknown = { id: account }) {
  const targetQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: row, error: characterError }) };
  const contentQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: contentError ? null : [{ id: content, name: "Fixture class", version: 1 }], error: contentError }) };
  const from = vi.fn((table: string) => table === "characters" ? targetQuery : contentQuery);
  const getUser = vi.fn().mockResolvedValue({ data: { user }, error: null });
  mocks.client.mockResolvedValue({ auth: { getUser }, from });
  return { targetQuery, contentQuery, from, getUser };
}
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("INKBORNE_CLASS_ORIGIN_CREATION_UI", "true"); });
afterEach(() => vi.unstubAllEnvs());

describe("first-class route (query/action doubles only)", () => {
  it.each(["", "false", "TRUE"])("refuses flag %j before Auth or data access", async flag => {
    vi.stubEnv("INKBORNE_CLASS_ORIGIN_CREATION_UI", flag);
    await expect(FirstClassPage({ params: Promise.resolve({ id: target }) })).rejects.toThrow("not-found");
    expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.form).not.toHaveBeenCalled();
  });
  it("redirects an unsigned account before querying a target", async () => {
    const query = setup(character(), null, null, null);
    await expect(FirstClassPage({ params: Promise.resolve({ id: target }) })).rejects.toThrow("redirect:/login");
    expect(query.from).not.toHaveBeenCalled();
  });
  it.each([null, { ...character(), user_id: id(9) }])("refuses missing/foreign target %j without a recovery form", async row => {
    setup(row);
    await expect(FirstClassPage({ params: Promise.resolve({ id: target }) })).rejects.toThrow("not-found");
    expect(mocks.form).not.toHaveBeenCalled();
  });
  it("binds the authenticated account into both actions and queries classes for the owned supported system", async () => {
    const query = setup(); render(await FirstClassPage({ params: Promise.resolve({ id: target }) }));
    expect(query.targetQuery.eq).toHaveBeenCalledWith("id", target);
    expect(query.contentQuery.eq).toHaveBeenCalledWith("system_id", system);
    expect(query.contentQuery.eq).toHaveBeenCalledWith("content_type", "class");
    const props = mocks.form.mock.calls[0][0] as { accountId: string; characterId: string; canStart: boolean;
      classes: unknown[]; submitAction: (value: unknown) => Promise<unknown>; checkAction: (value: unknown) => Promise<unknown> };
    expect(props).toMatchObject({ accountId: account, characterId: target, canStart: true,
      classes: [{ id: content, name: "Fixture class", version: 1 }] });
    const original = { original: "finite input checked by actual action separately" };
    await props.submitAction(original); await props.checkAction(original);
    expect(mocks.submit).toHaveBeenCalledExactlyOnceWith(account, original); expect(mocks.check).toHaveBeenCalledExactlyOnceWith(account, original);
  });
  it("still mounts recovery when the parent has already advanced and skips current catalog lookup", async () => {
    const query = setup({ ...character(), action_revision: "4", choices: { classes: [{ slug: "fixture", level: 2 }] } });
    render(await FirstClassPage({ params: Promise.resolve({ id: target }) }));
    expect(mocks.form.mock.calls[0][0]).toMatchObject({ canStart: false, classes: [], accountId: account, characterId: target });
    expect(query.from).toHaveBeenCalledExactlyOnceWith("characters");
  });
  it("preserves recovery when the available-class query fails", async () => {
    setup(character(), null, { message: "fixture-private-catalog-error" });
    render(await FirstClassPage({ params: Promise.resolve({ id: target }) }));
    expect(screen.getByRole("status")).toHaveTextContent("unfinished save is still available");
    expect(mocks.form.mock.calls[0][0]).toMatchObject({ canStart: true, classes: [] });
    expect(screen.queryByText("fixture-private-catalog-error")).not.toBeInTheDocument();
  });
  it.each([{ ...character(), campaign_id: id(8) }, { ...character(), game_systems: { slug: "other", status: "published" } },
    { ...character(), game_systems: { slug: "dnd-5e-2014", status: "draft" } }])(
    "offers recovery without a new first choice outside the finite profile", async row => {
      const query = setup(row); render(await FirstClassPage({ params: Promise.resolve({ id: target }) }));
      expect(mocks.form.mock.calls[0][0]).toMatchObject({ canStart: false, classes: [] });
      expect(query.from).toHaveBeenCalledExactlyOnceWith("characters");
    });
});
