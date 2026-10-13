import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const share = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/homebrew/items/actions", () => ({ toggleHomebrewItemCampaignShare: share }));
import { ItemSharingPanel } from "@/components/library/item-sharing-panel";
const contentId = "33333333-3333-4333-8333-333333333333";
const campaigns = [
  { id: "44444444-4444-4444-8444-444444444444", name: "Original Tuesday", shared: false, eligible: true },
  { id: "55555555-5555-4555-8555-555555555555", name: "Original Weekend", shared: false, eligible: true },
];
const base = { contentId, version: 1, scope: "personal" as const, sharedCampaignCount: 0, campaigns };
beforeEach(() => { share.mockReset(); });
describe("actual ItemSharingPanel with simulated server action", () => {
  it("submits exact campaign/content/version and retains both confirmed toggles with current share version", async () => {
    share.mockImplementation(async (_previous, data: FormData) => ({ status: "idle", message: "Confirmed original fixture.",
      contentId, campaignId: data.get("campaign_id"), enabled: data.get("enabled") === "true", expectedVersion: Number(data.get("expected_version")), version: 2, scope: "shared", sharedCampaignCount: 1 + (data.get("campaign_id") === campaigns[1].id ? 1 : 0) }));
    render(<ItemSharingPanel {...base} />);
    const firstForm = screen.getByRole("button", { name: "Share with Original Tuesday" }).closest("form")!;
    expect(Object.fromEntries(new FormData(firstForm))).toEqual({ content_id: contentId, campaign_id: campaigns[0].id, enabled: "true", expected_version: "1" });
    fireEvent.submit(firstForm);
    await screen.findByRole("button", { name: "Stop sharing with Original Tuesday" });
    const secondForm = screen.getByRole("button", { name: "Share with Original Weekend" }).closest("form")!;
    expect(new FormData(secondForm).get("expected_version")).toBe("2"); fireEvent.submit(secondForm);
    await screen.findByRole("button", { name: "Stop sharing with Original Weekend" });
    expect(screen.getByRole("button", { name: "Stop sharing with Original Tuesday" })).toBeEnabled();
    expect(share).toHaveBeenCalledTimes(2);
  });
  it("fresh server props supersede prior local toggle display instead of inventing persisted access", async () => {
    share.mockResolvedValue({ status: "idle", contentId, campaignId: campaigns[0].id, enabled: true, expectedVersion: 1, version: 2, scope: "shared", sharedCampaignCount: 1, message: "Confirmed." });
    const { rerender } = render(<ItemSharingPanel {...base} />);
    fireEvent.submit(screen.getByRole("button", { name: "Share with Original Tuesday" }).closest("form")!);
    await screen.findByRole("button", { name: "Stop sharing with Original Tuesday" });
    rerender(<ItemSharingPanel {...base} version={3} />);
    expect(screen.getByRole("button", { name: "Share with Original Tuesday" })).toBeEnabled();
    expect(new FormData(screen.getByRole("button", { name: "Share with Original Tuesday" }).closest("form")!).get("expected_version")).toBe("3");
  });
  it("keeps the last confirmed overlay and version across a correlated definite error", async () => {
    share.mockResolvedValueOnce({ status: "idle", message: "Confirmed.", contentId, campaignId: campaigns[0].id, enabled: true, expectedVersion: 1, version: 2, scope: "shared", sharedCampaignCount: 1 });
    share.mockResolvedValueOnce({ status: "error", message: "Membership denied.", contentId, campaignId: campaigns[1].id, enabled: true, expectedVersion: 2 });
    render(<ItemSharingPanel {...base} />);
    fireEvent.submit(screen.getByRole("button", { name: "Share with Original Tuesday" }).closest("form")!);
    await screen.findByRole("button", { name: "Stop sharing with Original Tuesday" });
    const second = screen.getByRole("button", { name: "Share with Original Weekend" }).closest("form")!;
    fireEvent.submit(second); expect(await screen.findByRole("alert")).toHaveTextContent("Membership denied.");
    expect(screen.getByRole("button", { name: "Stop sharing with Original Tuesday" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Share with Original Weekend" })).toBeEnabled();
    expect(new FormData(second).get("expected_version")).toBe("2");
    expect(screen.getByText("v2")).toBeVisible();
  });
  it.each(["conflict", "uncertain"] as const)("freezes %s, preserves selected hidden data and never automatically retries", async status => {
    share.mockResolvedValue({ status, contentId, campaignId: campaigns[0].id, enabled: true, expectedVersion: 1, message: "Reload latest access." });
    render(<ItemSharingPanel {...base} />);
    const form = screen.getByRole("button", { name: "Share with Original Tuesday" }).closest("form")!;
    fireEvent.submit(form); await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Share with Original Tuesday" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reload latest access" })).toBeEnabled();
    expect(new FormData(form).get("campaign_id")).toBe(campaigns[0].id);
    fireEvent.submit(form); expect(share).toHaveBeenCalledOnce();
  });
  it("disables duplicate native submissions while pending and restores a confirmed response", async () => {
    let settle!: (value: unknown) => void;
    share.mockReturnValue(new Promise(resolve => { settle = resolve; }));
    render(<ItemSharingPanel {...base} />);
    fireEvent.submit(screen.getByRole("button", { name: "Share with Original Tuesday" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("button", { name: "Share with Original Tuesday" })).toBeDisabled());
    settle({ status: "idle", contentId, campaignId: campaigns[0].id, enabled: true, expectedVersion: 1, version: 2, scope: "shared", sharedCampaignCount: 1, message: "Confirmed." });
    expect(await screen.findByRole("button", { name: "Stop sharing with Original Tuesday" })).toBeEnabled();
  });
  it("allows former-member removal but denies enabling a nonmember and exhausted first share", () => {
    render(<ItemSharingPanel {...base} version={2147483647} scope="shared" sharedCampaignCount={2}
      campaigns={[{ ...campaigns[0], shared: true, eligible: false }, { ...campaigns[1], shared: false, eligible: false }]} />);
    expect(screen.getByRole("button", { name: "Stop sharing with Original Tuesday" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Share with Original Weekend" })).toBeDisabled();
  });
  it("synchronously rejects the second native submit in the same tick before pending state commits", async () => {
    let settle!: (value: unknown) => void;
    share.mockReturnValue(new Promise(resolve => { settle = resolve; }));
    render(<ItemSharingPanel {...base} />);
    const first = screen.getByRole("button", { name: "Share with Original Tuesday" }).closest("form")!;
    const second = screen.getByRole("button", { name: "Share with Original Weekend" }).closest("form")!;
    expect(Object.fromEntries(new FormData(first))).toEqual({ content_id: contentId, campaign_id: campaigns[0].id, enabled: "true", expected_version: "1" });
    let secondDispatched = true;
    act(() => {
      first.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      secondDispatched = second.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(secondDispatched).toBe(false);
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    settle({ status: "idle", message: "Confirmed.", contentId, campaignId: campaigns[0].id, enabled: true, expectedVersion: 1, version: 2, scope: "shared", sharedCampaignCount: 1 });
    await screen.findByRole("button", { name: "Stop sharing with Original Tuesday" });
    expect(share).toHaveBeenCalledOnce();
  });
  it("keeps the native gate shut while an unresolved response awaits React state commit", async () => {
    let settle!: (value: unknown) => void;
    const reply = new Promise(resolve => { settle = resolve; });
    share.mockReturnValue(reply);
    render(<ItemSharingPanel {...base} />);
    const form = screen.getByRole("button", { name: "Share with Original Tuesday" }).closest("form")!;
    fireEvent.submit(form); await waitFor(() => expect(share).toHaveBeenCalledOnce());
    let resubmitted = true;
    const schedulingGap = reply.then(() => new Promise<void>(resolve => queueMicrotask(() => {
      resubmitted = form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); resolve();
    })));
    await act(async () => { settle(undefined); await schedulingGap; });
    expect(resubmitted).toBe(false); expect(share).toHaveBeenCalledOnce();
    expect(await screen.findByRole("button", { name: "Reload latest access" })).toBeEnabled();
  });
  it.each([
    undefined, null, [],
    { status: "success" }, { contentId: campaigns[1].id }, { campaignId: campaigns[1].id },
    { enabled: false }, { expectedVersion: 2 }, { version: 2147483648 }, { version: 4 },
    { scope: "personal" }, { sharedCampaignCount: -1 }, { sharedCampaignCount: 0 },
    { message: "" }, { injected: true },
  ])("freezes malformed or mismatched acknowledgement %j without applying its toggle", async change => {
    const valid = { status: "idle", message: "Untrusted acknowledgement.", contentId, campaignId: campaigns[0].id, enabled: true, expectedVersion: 1, version: 2, scope: "shared", sharedCampaignCount: 1 };
    share.mockResolvedValue(change && !Array.isArray(change) ? { ...valid, ...change } : change);
    render(<ItemSharingPanel {...base} />);
    const form = screen.getByRole("button", { name: "Share with Original Tuesday" }).closest("form")!;
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be confirmed");
    expect(screen.queryByText("Untrusted acknowledgement.")).toBeNull();
    expect(screen.getByRole("button", { name: "Share with Original Tuesday" })).toBeDisabled();
    expect(screen.getByText("v1")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reload latest access" })).toBeEnabled();
    fireEvent.submit(form); expect(share).toHaveBeenCalledOnce();
  });
  it("turns an ordinary rejected action into uncertainty and requires manual reload", async () => {
    share.mockRejectedValue(new Error("transport response lost"));
    render(<ItemSharingPanel {...base} />);
    const form = screen.getByRole("button", { name: "Share with Original Tuesday" }).closest("form")!;
    fireEvent.submit(form); expect(await screen.findByRole("alert")).toHaveTextContent("could not be confirmed");
    expect(screen.getByRole("button", { name: "Reload latest access" })).toBeEnabled();
    fireEvent.submit(form); expect(share).toHaveBeenCalledOnce();
  });
  it("refuses final scope change at PG maximum without fabricating an out-of-range version", () => {
    render(<ItemSharingPanel {...base} version={2147483647} scope="shared" sharedCampaignCount={1} campaigns={[{ ...campaigns[0], shared: true }]} />);
    expect(screen.getByRole("button", { name: "Stop sharing with Original Tuesday" })).toBeDisabled();
    expect(screen.getByText(/version limit/)).toBeVisible(); expect(screen.queryByText(/2147483648/)).toBeNull();
  });
});
