import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/supabase/homebrew-passive-features-server", () => ({ createHomebrewPassiveFeatureRecord: mocks.create, updateHomebrewPassiveFeatureRecord: mocks.update }));
import { createHomebrewPassiveFeature, updateHomebrewPassiveFeature } from "@/app/(app)/homebrew/features/actions";
import { passiveFeatureId as ID } from "@/tests/fixtures/passive-features";
const idle = { status: "idle" as const };
beforeEach(() => vi.clearAllMocks());
describe("standalone feature actions", () => {
  it("delegates authentication/authority to the DAL unchanged and returns received saved identity before navigation", async () => {
    const form = new FormData(), result = { status: "saved", id: ID, version: 1, operation: "create" }; mocks.create.mockResolvedValue(result);
    expect(await createHomebrewPassiveFeature(idle, form)).toEqual(result); expect(mocks.create).toHaveBeenCalledWith(form);
    expect(mocks.revalidate.mock.calls).toEqual([["/homebrew"], ["/library"], [`/library/${ID}`]]);
  });
  it("only confirmed changed edit revalidates exact saved paths", async () => {
    mocks.update.mockResolvedValue({ status: "saved", id: ID, version: 2, operation: "edit" }); await updateHomebrewPassiveFeature(idle, new FormData());
    expect(mocks.revalidate.mock.calls).toEqual([["/homebrew"], ["/library"], [`/library/${ID}`], [`/homebrew/features/${ID}/edit`]]);
  });
  it.each([{ result: { status: "error", message: "Authentication required." } }, { result: { status: "conflict", message: "Reload." } },
    { result: { status: "uncertain", message: "Check Homebrew." } }, { result: { status: "unchanged", id: ID, version: 1, message: "No changes to save." } }])("does not revalidate uncertain/errors/conflicts/no-op $result", async ({ result }) => {
    mocks.update.mockResolvedValue(result); expect(await updateHomebrewPassiveFeature(idle, new FormData())).toEqual(result); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
