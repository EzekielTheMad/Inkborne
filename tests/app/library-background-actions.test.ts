import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  share: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/homebrew-backgrounds-server", () => ({
  createHomebrewBackgroundRecord: mocks.create,
  updateHomebrewBackgroundRecord: mocks.update,
  setHomebrewBackgroundCampaignShare: mocks.share,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }),
}));

import {
  createHomebrewBackground,
  toggleHomebrewBackgroundCampaignShare,
  updateHomebrewBackground,
} from "@/app/(app)/homebrew/backgrounds/actions";

const idle = { status: "idle" as const, message: "" };

describe("homebrew background actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
  });

  it("redirects unauthenticated mutations before touching content", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(createHomebrewBackground(idle, new FormData())).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("returns recoverable validation failures", async () => {
    const failure = { status: "error" as const, message: "Check the background fields." };
    mocks.create.mockResolvedValue(failure);
    await expect(createHomebrewBackground(idle, new FormData())).resolves.toEqual(failure);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("revalidates and redirects after creation", async () => {
    mocks.create.mockResolvedValue({ id: "background-id" });
    await expect(createHomebrewBackground(idle, new FormData())).rejects.toThrow(
      "REDIRECT:/homebrew?created=background-id",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/homebrew");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/library");
  });

  it("rejects malformed edit identity before the data helper", async () => {
    await expect(updateHomebrewBackground(idle, new FormData())).resolves.toMatchObject({
      status: "error",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns stale edit conflicts without redirecting", async () => {
    const input = new FormData();
    input.set("id", "background-id");
    input.set("expected_version", "2");
    const conflict = { status: "conflict" as const, message: "Reload the latest version." };
    mocks.update.mockResolvedValue(conflict);

    await expect(updateHomebrewBackground(idle, input)).resolves.toEqual(conflict);
    expect(mocks.update).toHaveBeenCalledWith("background-id", 2, input);
  });

  it("revalidates both catalogs and the homebrew edit route after update", async () => {
    const input = new FormData();
    input.set("id", "background-id");
    input.set("expected_version", "2");
    mocks.update.mockResolvedValue({ id: "background-id" });

    await expect(updateHomebrewBackground(idle, input)).rejects.toThrow(
      "REDIRECT:/homebrew?updated=background-id",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/homebrew");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/library");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/homebrew/backgrounds/background-id/edit",
    );
  });

  it("rejects malformed campaign access before the data helper", async () => {
    await expect(
      toggleHomebrewBackgroundCampaignShare(idle, new FormData()),
    ).resolves.toMatchObject({ status: "error" });
    expect(mocks.share).not.toHaveBeenCalled();
  });

  it("updates background campaign access and revalidates owner surfaces", async () => {
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

    await expect(toggleHomebrewBackgroundCampaignShare(idle, input)).resolves.toMatchObject({
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
      "/homebrew/backgrounds/11111111-1111-4111-8111-111111111111/edit",
    );
  });
});
