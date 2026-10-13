import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const actions = vi.hoisted(() => ({ commit: vi.fn(), resolve: vi.fn(), preview: vi.fn(), push: vi.fn() }));
vi.mock("@/app/(app)/campaigns/[id]/monsters/actions", () => ({ commitCampaignMonster: actions.commit, resolveCampaignMonster: actions.resolve, previewCampaignMonster: actions.preview }));
vi.mock("next/navigation", async (original) => ({ ...(await original<typeof import("next/navigation")>()), useRouter: () => ({ push: actions.push }) }));
import { MonsterInstanceForm } from "@/components/campaigns/monster-instance-form";
import { instanceIntentFromForm } from "@/lib/campaigns/monster-instance-form";
import { MC, monsterDetail, monsterPreview, monsterReceipt } from "@/tests/fixtures/campaign-monster-instances";
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); actions.preview.mockResolvedValue({ status: "preview", preview: monsterPreview() }); actions.resolve.mockResolvedValue({ status: "absent" }); });
async function createForm() {
  render(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} sources={[{ id: MC.source, name: "Mossglass Sentinel", version: 1 }]} />);
  await waitFor(() => expect(screen.getByLabelText("Monster source")).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Monster source"), { target: { value: MC.source } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Add monster instance" })).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Instance name"), { target: { value: "Bridge sentinel" } });
}
const submit = () => fireEvent.submit(screen.getByLabelText("Instance name").closest("form")!);
describe("actual DM monster form with simulated transport only", () => {
  it("previews unchanged original declared block and creates explicit manual HP0/name/empty notes", async () => {
    actions.commit.mockImplementation(async (_campaign, form: FormData) => ({ status: "saved", receipt: monsterReceipt(instanceIntentFromForm(form)) }));
    await createForm(); fireEvent.change(screen.getByLabelText(/Current HP/), { target: { value: "0" } }); submit();
    await screen.findByText(/Saved\. The original receipt/); const request = instanceIntentFromForm(actions.commit.mock.calls[0][1]);
    expect(request).toMatchObject({ command: "create", name: "Bridge sentinel", current_hp: 0, notes: "", source_id: MC.source, source_version: 1 });
    expect(screen.getByLabelText("Monster stat block")).toBeVisible(); expect(document.querySelector("script")).toBeNull();
    expect(screen.getByRole("button", { name: "Add monster instance" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Add another deliberate instance" })); expect(screen.getByLabelText("Instance name")).toHaveValue("");
  });
  it("pending disables controls, ignores duplicate submits, prevents native reset", async () => {
    let finish!: (value: unknown) => void; actions.commit.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await createForm(); fireEvent.change(screen.getByLabelText("DM notes"), { target: { value: "Retain private draft" } }); submit();
    await waitFor(() => expect(screen.getByLabelText("Instance name")).toBeDisabled()); submit();
    fireEvent.reset(screen.getByLabelText("Instance name").closest("form")!); expect(screen.getByLabelText("DM notes")).toHaveValue("Retain private draft");
    expect(actions.commit).toHaveBeenCalledTimes(1); await act(async () => finish({ status: "uncertain", message: "Check." }));
  });
  it.each(["reject", "missing", "malformed"])("retains operation/intent after %s and absent receipt never permits replacement UUID", async (mode) => {
    if (mode === "reject") actions.commit.mockRejectedValue(new Error("lost response"));
    else actions.commit.mockResolvedValue(mode === "missing" ? undefined : { status: "saved", receipt: { id: "bad" } });
    await createForm(); submit(); await screen.findByRole("button", { name: "Check campaign monsters" });
    const original = instanceIntentFromForm(actions.commit.mock.calls[0][1]); expect(screen.getByLabelText("Instance name")).toHaveValue("Bridge sentinel");
    fireEvent.click(screen.getByRole("button", { name: "Check campaign monsters" })); await screen.findByText(/No receipt was found/);
    expect(actions.commit).toHaveBeenCalledTimes(1); expect(screen.getByRole("button", { name: "Add monster instance" })).toBeDisabled();
    actions.commit.mockResolvedValue({ status: "saved", receipt: monsterReceipt(original) }); fireEvent.click(screen.getByRole("button", { name: "Resubmit same operation" }));
    await screen.findByText(/Saved\. The original receipt/); expect(instanceIntentFromForm(actions.commit.mock.calls[1][1])).toEqual(original);
  });
  it("reload marker without original intent exposes recovery only and keeps absence blocked", async () => {
    sessionStorage.setItem(`inkborne:campaign-monster:v1:${MC.owner}:${MC.campaign}:create`, JSON.stringify({ operation_id: MC.operation }));
    render(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} />);
    await screen.findByText(/original intent is unavailable after reload/); expect(screen.queryByRole("button", { name: "Resubmit same operation" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Check campaign monsters" })); await screen.findByText(/No receipt was found/); expect(actions.commit).not.toHaveBeenCalled();
  });
  it("saved ID survives navigation failure and reload recovery without reinsertion", async () => {
    actions.commit.mockImplementation(async (_campaign, form: FormData) => ({ status: "saved", receipt: monsterReceipt(instanceIntentFromForm(form)) }));
    actions.push.mockImplementation(() => { throw new Error("navigation lost"); });
    await createForm(); submit(); await screen.findByRole("button", { name: "Open saved instance" }); fireEvent.click(screen.getByRole("button", { name: "Open saved instance" }));
    await screen.findByText(/Navigation failed/); expect(screen.getByRole("link", { name: /Saved instance/ })).toHaveAttribute("href", `/campaigns/${MC.campaign}/monsters/${MC.instance}`); submit(); expect(actions.commit).toHaveBeenCalledTimes(1);
  });
  it("edit keeps immutable source outside intent, supports notes clear/archive and conflict Reload latest", async () => {
    actions.commit.mockResolvedValue({ status: "conflict", message: "Native revision conflict. Reload latest." });
    render(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} initial={monsterDetail("9007199254740993")} />);
    await waitFor(() => expect(screen.getByLabelText("Instance name")).toBeEnabled());
    fireEvent.change(screen.getByLabelText("DM notes"), { target: { value: "" } }); fireEvent.click(screen.getByLabelText(/Archived/)); submit();
    await screen.findByRole("alert"); const intent = instanceIntentFromForm(actions.commit.mock.calls[0][1]);
    expect(intent).toMatchObject({ command: "update", expected_revision: "9007199254740993", patch: { notes: "", archived: true } });
    expect(intent).not.toHaveProperty("source_snapshot"); expect(screen.getByRole("button", { name: "Save instance" })).toBeDisabled(); expect(screen.getByRole("link", { name: "Reload latest" })).toBeVisible();
  });
  it("blocks invalid controls and native DOM drift before any operation or action", async () => {
    await createForm(); const input = screen.getByLabelText("Instance name") as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Unexpected DOM value"); submit();
    await screen.findByText(/rendered controls changed/); expect(actions.commit).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "x".repeat(101) } }); submit(); await screen.findByText(/Check name/); expect(actions.commit).not.toHaveBeenCalled();
  });
  it("props revision drift preserves draft and denies new writes rather than silently rebasing", async () => {
    const mounted = render(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} initial={monsterDetail("0")} />);
    await waitFor(() => expect(screen.getByLabelText("Instance name")).toBeEnabled()); fireEvent.change(screen.getByLabelText("DM notes"), { target: { value: "Unsaved draft" } });
    mounted.rerender(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} initial={monsterDetail("1")} />);
    expect(screen.getByLabelText("DM notes")).toHaveValue("Unsaved draft"); expect(screen.getByRole("button", { name: "Save instance" })).toBeDisabled(); submit(); expect(actions.commit).not.toHaveBeenCalled();
  });
  it("source version drift refuses new write until explicit current-version preview, without automatic repin", async () => {
    const mounted = render(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} sources={[{ id: MC.source, name: "Mossglass Sentinel", version: 1 }]} />);
    await waitFor(() => expect(screen.getByLabelText("Monster source")).toBeEnabled()); fireEvent.change(screen.getByLabelText("Monster source"), { target: { value: MC.source } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Add monster instance" })).toBeEnabled());
    mounted.rerender(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} sources={[{ id: MC.source, name: "Mossglass Sentinel", version: 2 }]} />);
    expect(screen.getByRole("button", { name: "Add monster instance" })).toBeDisabled(); expect(actions.preview).toHaveBeenCalledTimes(1); submit(); expect(actions.commit).not.toHaveBeenCalled();
    const preview = monsterPreview(); actions.preview.mockResolvedValue({ status: "preview", preview: { ...preview, source_version: 2, snapshot: { ...(preview.snapshot as object), version: 2 } } });
    fireEvent.click(screen.getByRole("button", { name: "Load current source version" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Add monster instance" })).toBeEnabled()); expect(actions.preview).toHaveBeenLastCalledWith(MC.campaign, MC.source, 2);
  });
});
