import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), submit: vi.fn(), check: vi.fn(), form: vi.fn(), refs: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/content-refs", () => ({ getContentRefsByCharacter: mocks.refs }));
vi.mock("next/navigation", () => ({ notFound: () => { throw Error("not-found"); },
  redirect: (url: string) => { throw Error("redirect:" + url); } }));
vi.mock("@/app/(app)/characters/[id]/builder/first-class/actions", () => ({ submitFirstClass: mocks.submit, checkFirstClass: mocks.check }));
vi.mock("@/app/(app)/characters/[id]/builder/first-class/first-class-form", () => ({
  FirstClassForm: (props: unknown) => { mocks.form(props); return <p>First-class recovery fixture</p>; },
}));
import FirstClassPage from "@/app/(app)/characters/[id]/builder/first-class/page";

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const account = id(1), target = id(2), system = id(3), content = id(4);
const character = () => ({ id: target, user_id: account, system_id: system, campaign_id: null, level: 1, action_revision: "0", choices: {},
  game_systems: { slug: "dnd-5e-2014", status: "published" } });
const savedCharacter = () => ({ ...character(), action_revision: "1", choices: {
  classes: [{ occurrence_id: id(6), slug: "fixture-class", level: 1 }],
} });
// The complete-reader dependency is mocked here; its existing tests validate
// actual envelope/type-specific snapshot parsing. App/HTTP acceptance is separate.
const classPin = () => ({ id: id(7), character_id: target, content_id: content, content_version: 1,
  context: { source: "class", level: 1 }, choice_source: null, feature_grant_id: null,
  content_definitions: { id: content, system_id: system, content_type: "class", slug: "fixture-class",
    name: "Pinned fixture class", version: 1 },
});
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
beforeEach(() => { vi.resetAllMocks(); mocks.refs.mockResolvedValue([]); vi.stubEnv("INKBORNE_CLASS_ORIGIN_CREATION_UI", "true"); });
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
    expect(props).toMatchObject({ accountId: account, characterId: target, canStart: true, hasSavedClass: false,
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
  it("a fresh server render shows the saved pinned class and a nonmechanical next step", async () => {
    setup(); const initial = render(await FirstClassPage({ params: Promise.resolve({ id: target }) }));
    expect(screen.queryByRole("heading", { name: "Saved class" })).not.toBeInTheDocument();
    expect(mocks.refs).not.toHaveBeenCalled(); initial.unmount();
    const query = setup(savedCharacter()); mocks.refs.mockResolvedValue([classPin()]);
    render(await FirstClassPage({ params: Promise.resolve({ id: target }) }));
    expect(screen.getByRole("heading", { name: "Saved class" })).toBeInTheDocument();
    expect(screen.getByText("Pinned fixture class · Level 1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to your characters" })).toHaveAttribute("href", "/characters");
    expect(mocks.refs).toHaveBeenCalledExactlyOnceWith(target, { requireCompleteSnapshots: true, fresh: true });
    expect(query.from).toHaveBeenCalledExactlyOnceWith("characters");
    expect(mocks.form.mock.calls.at(-1)![0]).toMatchObject({ canStart: false, hasSavedClass: true, classes: [], accountId: account, characterId: target });
  });
  it("keeps the pinned saved selection and recovery after later parent revisions without today's catalog", async () => {
    const query = setup({ ...savedCharacter(), action_revision: "4" }, null, { message: "catalog unavailable" });
    mocks.refs.mockResolvedValue([classPin()]);
    render(await FirstClassPage({ params: Promise.resolve({ id: target }) }));
    expect(screen.getByText("Pinned fixture class · Level 1")).toBeInTheDocument();
    expect(query.contentQuery.order).not.toHaveBeenCalled();
    expect(mocks.form.mock.calls[0][0]).toMatchObject({ canStart: false, classes: [] });
  });
  it("reads the original class in a saved multiclass build using its native occurrence rather than array position", async () => {
    const original = classPin(), secondary = { ...classPin(), id: id(10), content_id: id(11), choice_source: `builder:class-acquisition:${id(15)}`,
      content_definitions: { ...classPin().content_definitions, id: id(11), slug: "cleric", name: "Pinned Cleric" } };
    const role = (pin: Omit<typeof original, "choice_source"> & { choice_source: string | null }, occurrence: string, kind: "original" | "secondary") => ({ ...pin,
      class_role: { occurrence_id: occurrence, controller_ref_id: pin.id, content_id: pin.content_id, content_version: 1,
        role: kind, action_revision: "9", raw_effects: [], evaluation_effects: [], raw_data: {}, evaluation_data: {} } });
    setup({ ...savedCharacter(), action_revision: "9", level: 5, choices: { classes: [
      { occurrence_id: id(12), slug: "cleric", level: 1 }, { occurrence_id: id(6), slug: "fixture-class", level: 4 },
    ] } });
    mocks.refs.mockResolvedValue([role(secondary, id(12), "secondary"), role(original, id(6), "original")]);
    render(await FirstClassPage({ params: Promise.resolve({ id: target }) }));
    expect(screen.getByText("Pinned fixture class · Level 4")).toBeInTheDocument();
    expect(screen.queryByText("Pinned Cleric · Level 1")).not.toBeInTheDocument();
    expect(mocks.form.mock.calls[0][0]).toMatchObject({ canStart: false, hasSavedClass: true });
  });
  it("retains recovery and refuses a success display when complete pinned snapshots are unreadable", async () => {
    setup(savedCharacter()); mocks.refs.mockRejectedValue(Error("fixture-private-snapshot-error"));
    render(await FirstClassPage({ params: Promise.resolve({ id: target }) }));
    expect(screen.getByRole("status")).toHaveTextContent("could not be read completely");
    expect(screen.queryByRole("heading", { name: "Saved class" })).not.toBeInTheDocument();
    expect(screen.queryByText("fixture-private-snapshot-error")).not.toBeInTheDocument();
    expect(mocks.form.mock.calls[0][0]).toMatchObject({ canStart: false, classes: [] });
  });
  it.each([
    { pins: [] }, { pins: [classPin(), classPin()] }, { pins: [{ ...classPin(), character_id: id(9) }] },
    { pins: [{ ...classPin(), content_version: 2 }] }, { pins: [{ ...classPin(), content_id: id(9) }] },
    { pins: [{ ...classPin(), feature_grant_id: id(9) }] }, { pins: [{ ...classPin(), choice_source: "choice:class" }] },
    { pins: [{ ...classPin(), context: { source: "class", level: 2 } }] },
    { pins: [{ ...classPin(), content_definitions: { ...classPin().content_definitions, slug: "other-class" } }] },
    { pins: [{ ...classPin(), content_definitions: { ...classPin().content_definitions, system_id: id(9) } }] },
    { pins: [classPin(), { ...classPin(), id: id(8), content_definitions: { ...classPin().content_definitions, content_type: "subclass" } }] },
  ])("does not infer a saved first class from missing/conflicting controller pins %#", async ({ pins }) => {
    setup(savedCharacter()); mocks.refs.mockResolvedValue(pins);
    render(await FirstClassPage({ params: Promise.resolve({ id: target }) }));
    expect(screen.queryByRole("heading", { name: "Saved class" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("could not be read completely");
    expect(mocks.form.mock.calls[0][0]).toMatchObject({ canStart: false });
  });
  it("refuses an incomplete occurrence-bearing choice before reading pinned rows, while keeping recovery", async () => {
    setup({ ...savedCharacter(), choices: { classes: [{ slug: "fixture-class", level: 1 }] } });
    render(await FirstClassPage({ params: Promise.resolve({ id: target }) }));
    expect(mocks.refs).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Saved class" })).not.toBeInTheDocument();
    expect(mocks.form.mock.calls[0][0]).toMatchObject({ canStart: false, classes: [] });
  });
  it.each([{ ...character(), campaign_id: id(8) }, { ...character(), game_systems: { slug: "other", status: "published" } },
    { ...character(), game_systems: { slug: "dnd-5e-2014", status: "draft" } }])(
    "offers recovery without a new first choice outside the finite profile", async row => {
      const query = setup(row); render(await FirstClassPage({ params: Promise.resolve({ id: target }) }));
      expect(mocks.form.mock.calls[0][0]).toMatchObject({ canStart: false, classes: [] });
      expect(query.from).toHaveBeenCalledExactlyOnceWith("characters");
    });
});
