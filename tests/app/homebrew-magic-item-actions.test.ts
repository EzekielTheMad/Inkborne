import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), revalidatePath: vi.fn(), redirect: vi.fn((url: string) => { throw Error(`REDIRECT:${url}`); }), getUser: vi.fn() }));
vi.mock("@/lib/supabase/homebrew-magic-items-server", () => ({ createHomebrewMagicItemRecord: mocks.create, updateHomebrewMagicItemRecord: mocks.update }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", async () => ({ ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")), redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }) }));
import { createHomebrewMagicItem, updateHomebrewMagicItem } from "@/app/(app)/homebrew/magic-items/actions";
import { getRedirectError } from "next/dist/client/components/redirect";
const ID = "33333333-3333-4333-8333-333333333333", OWNER = "11111111-1111-4111-8111-111111111111";
const idle = { status: "idle" as const, message: "" };
function edit(version = "1") { const f = new FormData(); f.set("id", ID); f.set("expected_version", version); return f; }
beforeEach(() => {
  // Reset per-case behavior without erasing the module-level createClient factory.
  vi.clearAllMocks(); mocks.create.mockReset(); mocks.update.mockReset(); mocks.revalidatePath.mockReset(); mocks.redirect.mockReset(); mocks.getUser.mockReset();
  mocks.redirect.mockImplementation((url: string) => { throw Error(`REDIRECT:${url}`); }); mocks.getUser.mockResolvedValue({ data: { user: { id: OWNER } }, error: null });
});
describe("magic-item action exact acknowledgment", () => {
  it("redirects missing/auth-error actors before content mutations", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null }); await expect(createHomebrewMagicItem(idle, new FormData())).rejects.toThrow("REDIRECT:/login"); expect(mocks.create).not.toHaveBeenCalled();
    mocks.getUser.mockResolvedValue({ data: { user: { id: OWNER } }, error: { message: "Secret" } }); await expect(updateHomebrewMagicItem(idle, edit())).rejects.toThrow("REDIRECT:/login"); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("returns confirmed create and refreshes catalogs without redirect", async () => {
    const saved = { status: "saved", operation: "create", id: ID, version: 1 }; mocks.create.mockResolvedValue(saved);
    expect(await createHomebrewMagicItem(idle, new FormData())).toEqual(saved); expect(mocks.revalidatePath.mock.calls).toEqual([["/homebrew"], ["/library"]]); expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("confirmed edit refreshes catalogs and mounted edit route", async () => {
    const saved = { status: "saved", operation: "edit", id: ID, version: 2 }; mocks.update.mockResolvedValue(saved);
    expect(await updateHomebrewMagicItem(idle, edit())).toEqual(saved); expect(mocks.update).toHaveBeenCalledWith(ID, 1, expect.any(FormData));
    expect(mocks.revalidatePath.mock.calls).toEqual([["/homebrew"], ["/library"], [`/homebrew/magic-items/${ID}/edit`]]); expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it.each(["error", "conflict", "uncertain", "unchanged"])("%s does not invalidate/redirect", async status => {
    const result = status === "unchanged" ? { status, id: ID, version: 1, message: "No invocation write" } : { status, message: "Synthetic feedback" }; mocks.update.mockResolvedValue(result);
    expect(await updateHomebrewMagicItem(idle, edit())).toEqual(result); expect(mocks.revalidatePath).not.toHaveBeenCalled(); expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it.each(["0", "01", "1e0", "0x1", "2147483648", "NaN", "Infinity", "1.5", " 1"])("strict edit version%s refuses before DAL", async version => {
    expect(await updateHomebrewMagicItem(idle, edit(version))).toMatchObject({ status: "error" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("duplicate identity refuses before DAL", async () => { const f = edit(); f.append("id", ID); expect(await updateHomebrewMagicItem(idle, f)).toMatchObject({ status: "error" }); expect(mocks.update).not.toHaveBeenCalled(); });
  it("ordinary revalidation failure retains exact saved pin and does not call DAL again", async () => {
    mocks.create.mockResolvedValue({ status: "saved", operation: "create", id: ID, version: 1 }); mocks.revalidatePath.mockImplementation(() => { throw Error("Synthetic cache failure"); });
    expect(await createHomebrewMagicItem(idle, new FormData())).toMatchObject({ status: "saved", id: ID, version: 1, message: expect.stringMatching(/refresh failed/) }); expect(mocks.create).toHaveBeenCalledTimes(1); expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("uses real Next control-flow propagation rather than catching redirect as a lost write", async () => {
    const control = getRedirectError("/login", "replace", 307); mocks.create.mockRejectedValue(control);
    await expect(createHomebrewMagicItem(idle, new FormData())).rejects.toBe(control); expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("ordinary issued DAL throw is uncertain and never revalidates", async () => { mocks.create.mockRejectedValue(Error("Transport lost")); expect(await createHomebrewMagicItem(idle, new FormData())).toMatchObject({ status: "uncertain" }); expect(mocks.revalidatePath).not.toHaveBeenCalled(); });
});
describe("actual-old-export acknowledgment baseline action controls", () => {
  it.each([undefined, { id: ID }, { status: "idle", message: "Unexpected idle" }, { status: "saved", operation: "edit", id: ID, version: 1 }])("never confirms/redirects malformed create result%j", async result => {
    mocks.create.mockResolvedValue(result); expect(await createHomebrewMagicItem(idle, new FormData())).toMatchObject({ status: "uncertain" }); expect(mocks.redirect).not.toHaveBeenCalled(); expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("original field-refusal positive survives through actual old action", async () => {
    const refused = { status: "error", message: "Check the fields." }; mocks.create.mockResolvedValue(refused); expect(await createHomebrewMagicItem(idle, new FormData())).toEqual(refused); expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
