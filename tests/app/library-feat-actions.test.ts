import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  share: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/homebrew-feats-server", () => ({
  createHomebrewFeatRecord: mocks.create,
  updateHomebrewFeatRecord: mocks.update,
  setHomebrewFeatCampaignShare: mocks.share,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }),
}));

import {
  createHomebrewFeat,
  toggleHomebrewFeatCampaignShare,
  updateHomebrewFeat,
} from "@/app/(app)/homebrew/feats/actions";

const idle = { status: "idle" as const, message: "" };

describe("homebrew feat actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
  });

  it("redirects unauthenticated mutations before touching content", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(createHomebrewFeat(idle, new FormData())).rejects.toThrow("REDIRECT:/login");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("returns recoverable validation failures", async () => {
    const failure = { status: "error" as const, message: "Check the feat fields." };
    mocks.create.mockResolvedValue(failure);
    await expect(createHomebrewFeat(idle, new FormData())).resolves.toEqual(failure);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("revalidates and redirects after creation", async () => {
    mocks.create.mockResolvedValue({ id: "feat-id" });
    await expect(createHomebrewFeat(idle, new FormData())).rejects.toThrow(
      "REDIRECT:/homebrew?created=feat-id",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/homebrew");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/library");
  });

  it("rejects malformed edit identity before the data helper", async () => {
    await expect(updateHomebrewFeat(idle, new FormData())).resolves.toMatchObject({ status: "error" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns stale edit conflicts without redirecting", async () => {
    const input = new FormData();
    input.set("id", "feat-id");
    input.set("expected_version", "2");
    const conflict = { status: "conflict" as const, message: "Reload the latest version." };
    mocks.update.mockResolvedValue(conflict);

    await expect(updateHomebrewFeat(idle, input)).resolves.toEqual(conflict);
    expect(mocks.update).toHaveBeenCalledWith("feat-id", 2, input);
  });

  it("revalidates both catalogs and the homebrew edit route after update", async () => {
    const input = new FormData();
    input.set("id", "feat-id");
    input.set("expected_version", "2");
    mocks.update.mockResolvedValue({ id: "feat-id" });

    await expect(updateHomebrewFeat(idle, input)).rejects.toThrow(
      "REDIRECT:/homebrew?updated=feat-id",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/homebrew");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/library");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/homebrew/feats/feat-id/edit");
  });

  it("rejects malformed campaign access before the data helper", async () => {
    await expect(toggleHomebrewFeatCampaignShare(idle, new FormData())).resolves.toMatchObject({
      status: "error",
    });
    expect(mocks.share).not.toHaveBeenCalled();
  });

  it("updates feat campaign access and revalidates both owner surfaces", async () => {
    const input = new FormData();
    input.set("content_id", "11111111-1111-4111-8111-111111111111");
    input.set("campaign_id", "22222222-2222-4222-8222-222222222222");
    input.set("enabled", "true");
    input.set("expected_version", "2");
    mocks.share.mockResolvedValue({
      contentId: "11111111-1111-4111-8111-111111111111",
      version: 3,
      scope: "shared",
      sharedCampaignCount: 1,
    });

    await expect(toggleHomebrewFeatCampaignShare(idle, input)).resolves.toMatchObject({
      status: "idle",
      enabled: true,
      version: 3,
      scope: "shared",
      sharedCampaignCount: 1,
    });
    expect(mocks.share).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      true,
      2,
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/homebrew");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/library");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/homebrew/feats/11111111-1111-4111-8111-111111111111/edit",
    );
  });
});
