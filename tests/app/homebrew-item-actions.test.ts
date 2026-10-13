import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  share: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/homebrew-items-server", () => ({
  createHomebrewItemRecord: mocks.create,
  updateHomebrewItemRecord: mocks.update,
  setHomebrewItemCampaignShare: mocks.share,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", async importOriginal => ({
  ...await importOriginal<typeof import("next/navigation")>(), redirect: mocks.redirect,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }),
}));

import {
  createHomebrewItem,
  updateHomebrewItem,
  toggleHomebrewItemCampaignShare,
} from "@/app/(app)/homebrew/items/actions";

const idle = { status: "idle" as const, message: "" };

describe("homebrew item actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
  });

  it("redirects unauthenticated mutations before touching content", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(createHomebrewItem(idle, new FormData())).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("returns recoverable validation failures", async () => {
    const failure = { status: "error" as const, message: "Check the fields." };
    mocks.create.mockResolvedValue(failure);

    await expect(createHomebrewItem(idle, new FormData())).resolves.toEqual(failure);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("revalidates Homebrew and Library after creation", async () => {
    mocks.create.mockResolvedValue({ id: "item-id" });

    await expect(createHomebrewItem(idle, new FormData())).rejects.toThrow(
      "REDIRECT:/homebrew?created=item-id",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/homebrew");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/library");
  });

  it("rejects malformed edit identity before the persistence helper", async () => {
    await expect(updateHomebrewItem(idle, new FormData())).resolves.toMatchObject({
      status: "error",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns stale conflicts without redirecting", async () => {
    const input = new FormData();
    input.set("id", "item-id");
    input.set("expected_version", "1");
    const conflict = { status: "conflict" as const, message: "Reload the latest version." };
    mocks.update.mockResolvedValue(conflict);

    await expect(updateHomebrewItem(idle, input)).resolves.toEqual(conflict);
    expect(mocks.update).toHaveBeenCalledWith("item-id", 1, input);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates both catalogs and the edit route after update", async () => {
    const input = new FormData();
    input.set("id", "item-id");
    input.set("expected_version", "1");
    mocks.update.mockResolvedValue({ id: "item-id" });

    await expect(updateHomebrewItem(idle, input)).rejects.toThrow(
      "REDIRECT:/homebrew?updated=item-id",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/homebrew");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/library");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/homebrew/items/item-id/edit",
    );
  });
});

describe("ordinary item sharing action", () => {
  const contentId = "33333333-3333-4333-8333-333333333333", campaignId = "44444444-4444-4444-8444-444444444444";
  function input(enabled = "true", version = "1") {
    const form = new FormData();
    for (const [key, value] of Object.entries({ content_id: contentId, campaign_id: campaignId, enabled, expected_version: version })) form.set(key, value);
    return form;
  }
  beforeEach(() => { vi.clearAllMocks(); mocks.share.mockReset(); mocks.revalidatePath.mockReset(); mocks.getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null }); });
  it("authenticates before any sharing helper", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(toggleHomebrewItemCampaignShare(idle, input())).rejects.toThrow("REDIRECT:/login"); expect(mocks.share).not.toHaveBeenCalled();
  });
  it.each(["false-ish", "1", "", "TRUE"])("refuses malformed enabled %s without RPC", async enabled => {
    expect(await toggleHomebrewItemCampaignShare(idle, input(enabled))).toMatchObject({ status: "error" }); expect(mocks.share).not.toHaveBeenCalled();
  });
  it.each(["0", "2147483648", "1.5"])("refuses out-of-domain version %s", async version => {
    expect(await toggleHomebrewItemCampaignShare(idle, input("true", version))).toMatchObject({ status: "error" }); expect(mocks.share).not.toHaveBeenCalled();
  });
  it("returns exact confirmed identity/selection/written version and invalidates only its catalog/edit/campaign paths", async () => {
    mocks.share.mockResolvedValue({ contentId, version: 2, scope: "shared", sharedCampaignCount: 1 });
    expect(await toggleHomebrewItemCampaignShare(idle, input())).toMatchObject({ status: "idle", contentId, campaignId, enabled: true, expectedVersion: 1, version: 2 });
    expect(mocks.share).toHaveBeenCalledExactlyOnceWith(contentId, campaignId, true, 1);
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual(["/homebrew", "/library", `/homebrew/items/${contentId}/edit`, `/campaigns/${campaignId}/settings`]);
  });
  it.each(["conflict", "uncertain"] as const)("does not automatically resubmit prior %s state or emit success invalidation", async status => {
    const previous = { status, message: "Explicit reload required", contentId, campaignId, enabled: true };
    expect(await toggleHomebrewItemCampaignShare(previous, input())).toEqual(previous);
    expect(mocks.share).not.toHaveBeenCalled(); expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("keeps uncertain returned state correlated with requested campaign, without success", async () => {
    mocks.share.mockResolvedValue({ status: "uncertain", message: "Reload latest access." });
    expect(await toggleHomebrewItemCampaignShare(idle, input())).toMatchObject({ status: "uncertain", contentId, campaignId, enabled: true });
    expect(mocks.share).toHaveBeenCalledOnce(); expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("freezes ordinary transport rejection with the exact requested tuple", async () => {
    mocks.share.mockRejectedValue(new Error("response lost"));
    expect(await toggleHomebrewItemCampaignShare(idle, input())).toMatchObject({ status: "uncertain", contentId, campaignId, enabled: true, expectedVersion: 1 });
    expect(mocks.share).toHaveBeenCalledOnce(); expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("treats ordinary post-RPC cache failure as uncertainty without repeating the accepted RPC", async () => {
    mocks.share.mockResolvedValue({ contentId, version: 2, scope: "shared", sharedCampaignCount: 1 });
    mocks.revalidatePath.mockImplementation(() => { throw new Error("cache failed"); });
    const result = await toggleHomebrewItemCampaignShare(idle, input());
    expect(result).toMatchObject({ status: "uncertain", contentId, campaignId, enabled: true, expectedVersion: 1 });
    expect(result).not.toHaveProperty("version");
    expect(await toggleHomebrewItemCampaignShare(result, input())).toBe(result);
    expect(mocks.share).toHaveBeenCalledOnce();
  });
  it.each(["NEXT_REDIRECT;replace;/login;307;", "NEXT_HTTP_ERROR_FALLBACK;404"])("preserves actual Next control flow %s", async digest => {
    const signal = Object.assign(new Error("framework signal"), { digest });
    mocks.share.mockRejectedValue(signal);
    await expect(toggleHomebrewItemCampaignShare(idle, input())).rejects.toBe(signal);
    expect(mocks.share).toHaveBeenCalledOnce(); expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("preserves actual Next control flow from post-RPC cache invalidation", async () => {
    const signal = Object.assign(new Error("framework signal"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    mocks.share.mockResolvedValue({ contentId, version: 2, scope: "shared", sharedCampaignCount: 1 });
    mocks.revalidatePath.mockImplementation(() => { throw signal; });
    await expect(toggleHomebrewItemCampaignShare(idle, input())).rejects.toBe(signal);
    expect(mocks.share).toHaveBeenCalledOnce();
  });
});
