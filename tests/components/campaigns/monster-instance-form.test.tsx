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
  const mounted = render(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} systemId={MC.system} sources={[{ id: MC.source, name: "Mossglass Sentinel", version: 1 }]} />);
  await waitFor(() => expect(screen.getByLabelText("Monster source")).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Monster source"), { target: { value: MC.source } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Add monster instance" })).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Instance name"), { target: { value: "Bridge sentinel" } });
  return mounted;
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
    render(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} systemId={MC.system} />);
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
    render(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} systemId={MC.system} initial={monsterDetail("9007199254740993")} />);
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
    const mounted = render(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} systemId={MC.system} initial={monsterDetail("0")} />);
    await waitFor(() => expect(screen.getByLabelText("Instance name")).toBeEnabled()); fireEvent.change(screen.getByLabelText("DM notes"), { target: { value: "Unsaved draft" } });
    mounted.rerender(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} systemId={MC.system} initial={monsterDetail("1")} />);
    expect(screen.getByLabelText("DM notes")).toHaveValue("Unsaved draft"); expect(screen.getByRole("button", { name: "Save instance" })).toBeDisabled(); submit(); expect(actions.commit).not.toHaveBeenCalled();
  });
  it("source version drift refuses new write until explicit current-version preview, without automatic repin", async () => {
    const mounted = render(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} systemId={MC.system} sources={[{ id: MC.source, name: "Mossglass Sentinel", version: 1 }]} />);
    await waitFor(() => expect(screen.getByLabelText("Monster source")).toBeEnabled()); fireEvent.change(screen.getByLabelText("Monster source"), { target: { value: MC.source } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Add monster instance" })).toBeEnabled());
    mounted.rerender(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} systemId={MC.system} sources={[{ id: MC.source, name: "Mossglass Sentinel", version: 2 }]} />);
    expect(screen.getByRole("button", { name: "Add monster instance" })).toBeDisabled(); expect(actions.preview).toHaveBeenCalledTimes(1); submit(); expect(actions.commit).not.toHaveBeenCalled();
    const preview = monsterPreview(); actions.preview.mockResolvedValue({ status: "preview", preview: { ...preview, source_version: 2, snapshot: { ...(preview.snapshot as object), version: 2 } } });
    fireEvent.click(screen.getByRole("button", { name: "Load current source version" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Add monster instance" })).toBeEnabled()); expect(actions.preview).toHaveBeenLastCalledWith(MC.campaign, MC.source, 2);
  });
  it.each(["saved", "uncertain", "error"])("native settlement-gap submit after immediate %s cannot replace lifetime operation/intent/marker", async (status) => {
    actions.commit.mockImplementation((_campaign, input: FormData) => {
      const request = instanceIntentFromForm(input);
      return Promise.resolve(status === "saved" ? { status, receipt: monsterReceipt(request) } : { status, message: "Simulated initial prewrite refusal or uncertainty." });
    });
    await createForm(); const form = screen.getByLabelText("Instance name").closest("form")!;
    const markerKey = `inkborne:campaign-monster:v1:${MC.owner}:${MC.campaign}:create`;
    let original!: ReturnType<typeof instanceIntentFromForm>;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      original = instanceIntentFromForm(actions.commit.mock.calls[0][1]);
      await Promise.resolve(); await Promise.resolve();
      // Deliberately bypass fireEvent's act wrapper: DOM pending=false has NOT committed.
      expect(form.querySelector("fieldset")!.disabled).toBe(false);
      expect(JSON.parse(sessionStorage.getItem(markerKey)!).operation_id).toBe(original.operation_id);
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      expect(actions.commit).toHaveBeenCalledTimes(1);
      expect(instanceIntentFromForm(actions.commit.mock.calls[0][1])).toEqual(original);
      expect(JSON.parse(sessionStorage.getItem(markerKey)!).operation_id).toBe(original.operation_id);
    });
    if (status === "error") {
      expect(sessionStorage.getItem(markerKey)).toBeNull();
      submit(); await waitFor(() => expect(actions.commit).toHaveBeenCalledTimes(2));
      expect(instanceIntentFromForm(actions.commit.mock.calls[1][1]).operation_id).not.toBe(original.operation_id);
    } else {
      submit(); expect(actions.commit).toHaveBeenCalledTimes(1);
      if (status === "uncertain") {
        actions.commit.mockResolvedValue({ status: "saved", receipt: monsterReceipt(original) });
        fireEvent.click(screen.getByRole("button", { name: "Resubmit same operation" })); await screen.findByRole("button", { name: "Open saved instance" });
        expect(instanceIntentFromForm(actions.commit.mock.calls[1][1])).toEqual(original);
      }
    }
  });
  it.each(["owner", "campaign", "editor", "system", "source-version", "unmount"])("stale pending source preview on %s never applies or automatically pins", async (change) => {
    let finish!: (value: unknown) => void; actions.preview.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const source = [{ id: MC.source, name: "Mossglass Sentinel", version: 1 }];
    const mounted = render(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} systemId={MC.system} sources={source} />);
    await waitFor(() => expect(screen.getByLabelText("Monster source")).toBeEnabled()); fireEvent.change(screen.getByLabelText("Monster source"), { target: { value: MC.source } });
    if (change === "unmount") mounted.unmount();
    else mounted.rerender(<MonsterInstanceForm campaignId={change === "campaign" ? MC.foreign : MC.campaign} ownerId={change === "owner" ? MC.foreign : MC.owner}
      systemId={change === "system" ? MC.foreign : MC.system} initial={change === "editor" ? monsterDetail() : undefined}
      sources={change === "source-version" ? [{ ...source[0], version: 2 }] : source} />);
    await act(async () => finish({ status: "preview", preview: monsterPreview() }));
    expect(screen.queryByLabelText("Monster stat block")).toBeNull(); expect(actions.preview).toHaveBeenCalledTimes(1); expect(actions.commit).not.toHaveBeenCalled();
    if (change === "source-version") expect(screen.getByLabelText(/Current HP/)).toHaveValue(null);
    expect(sessionStorage.length).toBe(0);
  });
  it("refuses self-consistent foreign-system preview despite valid descriptive content", async () => {
    const preview = monsterPreview(); actions.preview.mockResolvedValue({ status: "preview", preview: { ...preview, system_id: MC.foreign, snapshot: { ...(preview.snapshot as object), system_id_snapshot: MC.foreign } } });
    render(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} systemId={MC.system} sources={[{ id: MC.source, name: "Mossglass Sentinel", version: 1 }]} />);
    await waitFor(() => expect(screen.getByLabelText("Monster source")).toBeEnabled()); fireEvent.change(screen.getByLabelText("Monster source"), { target: { value: MC.source } });
    await screen.findByText(/source is unavailable or unsupported/); expect(screen.queryByLabelText("Monster stat block")).toBeNull(); expect(actions.commit).not.toHaveBeenCalled();
  });
  it.each(["owner", "campaign", "editor", "unmount"])("accepted old operation on %s is retained in original scope without receipt applied to new editor", async (change) => {
    let finish!: (value: unknown) => void; actions.commit.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const mounted = await createForm(); submit(); await waitFor(() => expect(screen.getByLabelText("Instance name")).toBeDisabled());
    const original = instanceIntentFromForm(actions.commit.mock.calls[0][1]);
    if (change === "unmount") mounted.unmount();
    else mounted.rerender(<MonsterInstanceForm campaignId={change === "campaign" ? MC.foreign : MC.campaign} ownerId={change === "owner" ? MC.foreign : MC.owner}
      systemId={MC.system} initial={change === "editor" ? monsterDetail() : undefined} sources={[{ id: MC.source, name: "Mossglass Sentinel", version: 1 }]} />);
    await act(async () => finish({ status: "saved", receipt: monsterReceipt(original) }));
    expect(screen.queryByRole("link", { name: /Saved instance/ })).toBeNull();
    expect(JSON.parse(sessionStorage.getItem(`inkborne:campaign-monster:v1:${MC.owner}:${MC.campaign}:create`)!)).toEqual({ operation_id: original.operation_id, saved_id: MC.instance });
    expect(actions.commit).toHaveBeenCalledTimes(1);
  });
  it("source change while unknown commit settles does not hide accepted original receipt or repin", async () => {
    let finish!: (value: unknown) => void; actions.commit.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const mounted = await createForm(); submit(); await waitFor(() => expect(screen.getByLabelText("Instance name")).toBeDisabled()); const original = instanceIntentFromForm(actions.commit.mock.calls[0][1]);
    mounted.rerender(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} systemId={MC.system} sources={[{ id: MC.source, name: "Mossglass Sentinel", version: 2 }]} />);
    await act(async () => finish({ status: "saved", receipt: monsterReceipt(original) }));
    expect(screen.getByRole("link", { name: /Saved instance/ })).toHaveAttribute("href", `/campaigns/${MC.campaign}/monsters/${MC.instance}`);
    expect(original).toMatchObject({ source_version: 1 }); expect(actions.preview).toHaveBeenCalledTimes(1); expect(actions.commit).toHaveBeenCalledTimes(1);
  });
  it("late accepted response preserves a newer same-scope operation marker instead of overwriting it", async () => {
    let finish!: (value: unknown) => void; actions.commit.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const mounted = await createForm(); submit(); await waitFor(() => expect(screen.getByLabelText("Instance name")).toBeDisabled()); const original = instanceIntentFromForm(actions.commit.mock.calls[0][1]);
    mounted.unmount(); const key = `inkborne:campaign-monster:v1:${MC.owner}:${MC.campaign}:create`;
    const newer = { operation_id: MC.foreign }; sessionStorage.setItem(key, JSON.stringify(newer));
    await act(async () => finish({ status: "saved", receipt: monsterReceipt(original) }));
    expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual(newer);
    expect(JSON.parse(sessionStorage.getItem(`${key}:accepted:${original.operation_id}`)!)).toEqual({ operation_id: original.operation_id, saved_id: MC.instance });
  });
});
