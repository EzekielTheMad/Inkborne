import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), revalidate: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/supabase/homebrew-traits-server", () => ({ createHomebrewTraitRecord: mocks.create, updateHomebrewTraitRecord: mocks.update }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { createHomebrewTrait, updateHomebrewTrait } from "@/app/(app)/homebrew/traits/actions";
const ID = "33333333-3333-4333-8333-333333333333";
const idle = { status: "idle" as const };
beforeEach(() => vi.clearAllMocks());
describe("trait action feedback boundary", () => {
  it("returns confirmed save before client navigation, never a premature redirect", async () => {
    mocks.create.mockResolvedValue({ id: ID });
    expect(await createHomebrewTrait(idle, new FormData())).toEqual({ status: "saved", id: ID });
    expect(mocks.revalidate).toHaveBeenCalledWith("/homebrew"); expect(mocks.revalidate).toHaveBeenCalledWith("/library"); expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("uncertainty/field errors produce no confirmation, revalidation or retry", async () => {
    for (const status of ["uncertain", "error"] as const) {
      mocks.create.mockResolvedValue({ status, message: "Keep the draft." });
      expect(await createHomebrewTrait(idle, new FormData())).toEqual({ status, message: "Keep the draft." });
    }
    expect(mocks.create).toHaveBeenCalledTimes(2); expect(mocks.revalidate).not.toHaveBeenCalled(); expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it.each(["0", "1.5", "0x10", "1e3", "2147483648", "9007199254740991", "NaN", ""])("rejects invalid PostgreSQL version text %s before DAL", async value => {
    const form = new FormData(); form.set("id", ID); form.set("expected_version", value);
    expect(await updateHomebrewTrait(idle, form)).toMatchObject({ status: "error" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects duplicate identity scalars and retains a scoped stale conflict", async () => {
    const form = new FormData(); form.set("id", ID); form.set("expected_version", "1"); form.append("expected_version", "2");
    expect(await updateHomebrewTrait(idle, form)).toMatchObject({ status: "error" }); expect(mocks.update).not.toHaveBeenCalled();
    form.set("expected_version", "2147483647"); mocks.update.mockResolvedValue({ status: "conflict", message: "Reload." });
    expect(await updateHomebrewTrait(idle, form)).toMatchObject({ status: "conflict" }); expect(mocks.update).toHaveBeenCalledWith(ID, 2_147_483_647, form);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
