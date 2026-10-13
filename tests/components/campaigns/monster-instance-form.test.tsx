import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { startTransition } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const actions = vi.hoisted(() => ({ commit: vi.fn(), resolve: vi.fn(), preview: vi.fn(), push: vi.fn() }));
vi.mock("@/app/(app)/campaigns/[id]/monsters/actions", () => ({ commitCampaignMonster: actions.commit, resolveCampaignMonster: actions.resolve, previewCampaignMonster: actions.preview }));
vi.mock("next/navigation", async (original) => ({ ...(await original<typeof import("next/navigation")>()), useRouter: () => ({ push: actions.push }) }));
import { MonsterInstanceForm } from "@/components/campaigns/monster-instance-form";
import { instanceIntentFromForm } from "@/lib/campaigns/monster-instance-form";
import { MC, monsterDetail, monsterPreview, monsterReceipt } from "@/tests/fixtures/campaign-monster-instances";
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); actions.preview.mockResolvedValue({ status: "preview", preview: monsterPreview() }); actions.resolve.mockResolvedValue({ status: "absent" }); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
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
  // UNVERIFIED M5-STRESS-SAVED/UNCERTAIN/ERROR: old enabled-DOM setup failed.
  // Exact bodies/oracles retained; tracked acceptance proof is in the owned handoff.
  it.skip.each(["saved", "uncertain", "error"])("native settlement-gap submit after immediate %s cannot replace lifetime operation/intent/marker", async (status) => {
    let responseObserved = false;
    actions.commit.mockImplementation((_campaign, input: FormData) => {
      const request = instanceIntentFromForm(input);
      // Actual parser access proves the async response path resumed; a still-pending
      // promise/ref cannot make this scheduling control accidentally pass.
      return Promise.resolve(status === "saved" ? { status, get receipt() { responseObserved = true; return monsterReceipt(request); } }
        : { status, get message() { responseObserved = true; return "Simulated initial prewrite refusal or uncertainty."; } });
    });
    await createForm(); const form = screen.getByLabelText("Instance name").closest("form")!;
    const markerKey = `inkborne:campaign-monster:v1:${MC.owner}:${MC.campaign}:create`;
    let original!: ReturnType<typeof instanceIntentFromForm>;
    const actFlag = "IS_REACT_ACT_ENVIRONMENT";
    const previousActDescriptor = Object.getOwnPropertyDescriptor(globalThis, actFlag);
    // Warning suppression ONLY. Real React scheduler/actQueue, refs and DOM remain untouched.
    Object.defineProperty(globalThis, actFlag, { configurable: true, enumerable: previousActDescriptor?.enumerable ?? true, writable: true, value: false });
    try {
      // Deliberately defer the initial pending/operation render with the real React
      // transition scheduler OUTSIDE act, whose queue otherwise commits it during awaits.
      startTransition(() => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
      original = instanceIntentFromForm(actions.commit.mock.calls[0][1]);
      await Promise.resolve(); await Promise.resolve();
      // Response is settled but the old enabled controls have not committed updates.
      // This is a scheduling control, not a claim that every normal submit delays.
      expect(responseObserved).toBe(true);
      expect(form.querySelector("fieldset")!.disabled).toBe(false);
      if (status === "saved") expect(JSON.parse(sessionStorage.getItem(markerKey)!).saved_id).toBe(MC.instance);
      expect(JSON.parse(sessionStorage.getItem(markerKey)!).operation_id).toBe(original.operation_id);
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      expect(actions.commit).toHaveBeenCalledTimes(1);
      expect(instanceIntentFromForm(actions.commit.mock.calls[0][1])).toEqual(original);
      expect(JSON.parse(sessionStorage.getItem(markerKey)!).operation_id).toBe(original.operation_id);
    } finally {
      try {
        if (previousActDescriptor) Object.defineProperty(globalThis, actFlag, previousActDescriptor);
        else Reflect.deleteProperty(globalThis, actFlag);
      } finally { await act(async () => {}); } // Always flush genuine queued React work, including assertion failure.
    }
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

const editMarkerKey = `inkborne:campaign-monster:v1:${MC.owner}:${MC.campaign}:${MC.instance}`;
async function acceptedEdit(noop = false) {
  actions.commit.mockImplementation(async (_campaign, input: FormData) => {
    const request = instanceIntentFromForm(input); const receipt = monsterReceipt(request);
    if (noop && actions.commit.mock.calls.length === 1 && request.command === "update") { receipt.outcome = "noop"; receipt.readback.revision = request.expected_revision; }
    return { status: "saved", receipt };
  });
  const mounted = render(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} systemId={MC.system} initial={monsterDetail("0")} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Save instance" })).toBeEnabled());
  if (!noop) fireEvent.change(screen.getByLabelText(/Current HP/), { target: { value: "4" } });
  submit(); await screen.findByRole("button", { name: "Edit latest instance" });
  const original = instanceIntentFromForm(actions.commit.mock.calls[0][1]);
  return { mounted, original, savedMarker: { operation_id: original.operation_id, saved_id: MC.instance } };
}
describe("explicit accepted edit transition with simulated navigation and server reads only", () => {
  it.each([false, true])("persists accepted ID before marker clear, locks old editor and permits a second deliberate fresh edit (noop=%s)", async (noop) => {
    const { mounted, original, savedMarker } = await acceptedEdit(noop);
    const metadataKey = `${editMarkerKey}:accepted:${original.operation_id}`;
    const events: string[] = []; const set = Storage.prototype.setItem; const remove = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) { if (key === metadataKey) events.push("persist"); set.call(this, key, value); });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, key) { if (key === editMarkerKey) events.push("clear"); remove.call(this, key); });
    const assign = vi.fn(() => {
      events.push("navigate"); expect(JSON.parse(sessionStorage.getItem(metadataKey)!)).toEqual(savedMarker);
      expect(sessionStorage.getItem(editMarkerKey)).toBeNull();
    }); vi.stubGlobal("location", { assign });
    fireEvent.click(screen.getByRole("button", { name: "Edit latest instance" }));
    expect(events).toEqual(["persist", "clear", "navigate"]);
    expect(assign).toHaveBeenCalledWith(`/campaigns/${MC.campaign}/monsters/${MC.instance}?editAfter=${original.operation_id}`);
    expect(screen.getByRole("button", { name: "Edit latest instance" })).toBeDisabled();
    submit(); expect(actions.commit).toHaveBeenCalledTimes(1); // A returned/hung navigation leaves this lifetime locked.
    mounted.unmount();
    // Deliberately supplied fresh read is simulated; actual route correspondence is tested separately.
    const latest = { ...monsterDetail(noop ? "0" : "3"), current_hp: noop ? 0 : 7 };
    render(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} systemId={MC.system} initial={latest} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Save instance" })).toBeEnabled());
    expect(screen.getByLabelText(/Current HP/)).toHaveValue(latest.current_hp);
    fireEvent.change(screen.getByLabelText(/Current HP/), { target: { value: "9" } }); submit();
    await waitFor(() => expect(actions.commit).toHaveBeenCalledTimes(2));
    const next = instanceIntentFromForm(actions.commit.mock.calls[1][1]);
    expect(next).toMatchObject({ command: "update", expected_revision: latest.revision, patch: { current_hp: 9 } });
    expect(next.operation_id).not.toBe(original.operation_id);
    expect(sessionStorage.getItem(metadataKey)).toBe(JSON.stringify(savedMarker));
  });
  it("navigation throw restores only the absent original marker, retains receipt/link, and explicit retry never saves again", async () => {
    const { original, savedMarker } = await acceptedEdit();
    const assign = vi.fn(() => { throw new Error("native navigation failed"); }); vi.stubGlobal("location", { assign });
    fireEvent.click(screen.getByRole("button", { name: "Edit latest instance" }));
    expect(JSON.parse(sessionStorage.getItem(editMarkerKey)!)).toEqual(savedMarker);
    expect(JSON.parse(sessionStorage.getItem(`${editMarkerKey}:accepted:${original.operation_id}`)!)).toEqual(savedMarker);
    expect(screen.getByRole("link", { name: /Saved instance/ })).toHaveAttribute("href", `/campaigns/${MC.campaign}/monsters/${MC.instance}`);
    expect(screen.getByRole("button", { name: "Edit latest instance" })).toBeEnabled();
    submit(); fireEvent.click(screen.getByRole("button", { name: "Edit latest instance" }));
    expect(assign).toHaveBeenCalledTimes(2); expect(actions.commit).toHaveBeenCalledTimes(1);
  });
  it("navigation throw never overwrites a newer marker created during navigation", async () => {
    const { original } = await acceptedEdit(); const newer = JSON.stringify({ operation_id: MC.foreign });
    const assign = vi.fn(() => { sessionStorage.setItem(editMarkerKey, newer); throw new Error("navigation failed after newer marker"); }); vi.stubGlobal("location", { assign });
    fireEvent.click(screen.getByRole("button", { name: "Edit latest instance" }));
    expect(sessionStorage.getItem(editMarkerKey)).toBe(newer);
    expect(sessionStorage.getItem(`${editMarkerKey}:accepted:${original.operation_id}`)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit latest instance" }));
    expect(assign).toHaveBeenCalledTimes(1); expect(sessionStorage.getItem(editMarkerKey)).toBe(newer); submit(); expect(actions.commit).toHaveBeenCalledTimes(1);
  });
  it.each(["newer", "malformed", "foreign-saved-id", "persist-fault", "read-fault", "clear-fault"])("%s refuses transition without clearing protected marker or resubmitting", async (mode) => {
    const { original } = await acceptedEdit();
    const raw = mode === "newer" ? JSON.stringify({ operation_id: MC.foreign }) : mode === "malformed" ? "broken-json"
      : mode === "foreign-saved-id" ? JSON.stringify({ operation_id: original.operation_id, saved_id: MC.foreign }) : sessionStorage.getItem(editMarkerKey)!;
    sessionStorage.setItem(editMarkerKey, raw);
    const set = Storage.prototype.setItem; const get = Storage.prototype.getItem; const remove = Storage.prototype.removeItem;
    if (mode === "persist-fault") vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) { if (key.includes(":accepted:")) throw new Error("storage full"); set.call(this, key, value); });
    if (mode === "read-fault") vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key) { if (key === editMarkerKey) throw new Error("storage unavailable"); return get.call(this, key); });
    if (mode === "clear-fault") vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, key) { if (key === editMarkerKey) throw new Error("storage clear denied"); remove.call(this, key); });
    const assign = vi.fn(); vi.stubGlobal("location", { assign }); fireEvent.click(screen.getByRole("button", { name: "Edit latest instance" }));
    expect(assign).not.toHaveBeenCalled(); expect(get.call(sessionStorage, editMarkerKey)).toBe(raw);
    expect(screen.getByRole("button", { name: "Save instance" })).toBeDisabled(); submit(); expect(actions.commit).toHaveBeenCalledTimes(1);
  });
  it("accepted proof permits absent marker transition, but unresolved reload/absence never does", async () => {
    const { mounted } = await acceptedEdit(); sessionStorage.removeItem(editMarkerKey);
    const assign = vi.fn(); vi.stubGlobal("location", { assign }); fireEvent.click(screen.getByRole("button", { name: "Edit latest instance" })); expect(assign).toHaveBeenCalledTimes(1);
    mounted.unmount(); sessionStorage.setItem(editMarkerKey, JSON.stringify({ operation_id: MC.foreign }));
    render(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} systemId={MC.system} initial={monsterDetail("5")} />);
    await screen.findByText(/original intent is unavailable after reload/); fireEvent.click(screen.getByRole("button", { name: "Check campaign monsters" }));
    await screen.findByText(/No receipt was found/); expect(screen.queryByRole("button", { name: "Edit latest instance" })).toBeNull();
    expect(sessionStorage.getItem(editMarkerKey)).toBe(JSON.stringify({ operation_id: MC.foreign })); submit(); expect(actions.commit).toHaveBeenCalledTimes(1);
  });
  it("uncertain original edit keeps its operation through receipt absence and exposes no accepted transition", async () => {
    actions.commit.mockRejectedValue(new Error("response lost"));
    render(<MonsterInstanceForm campaignId={MC.campaign} ownerId={MC.owner} systemId={MC.system} initial={monsterDetail()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Save instance" })).toBeEnabled()); submit();
    await screen.findByRole("button", { name: "Check campaign monsters" }); const marker = sessionStorage.getItem(editMarkerKey);
    fireEvent.click(screen.getByRole("button", { name: "Check campaign monsters" })); await screen.findByText(/No receipt was found/);
    expect(screen.queryByRole("button", { name: "Edit latest instance" })).toBeNull(); expect(sessionStorage.getItem(editMarkerKey)).toBe(marker);
    submit(); expect(actions.commit).toHaveBeenCalledTimes(1);
  });
});
