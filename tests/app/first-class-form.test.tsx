import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FirstClassForm } from "@/app/(app)/characters/[id]/builder/first-class/first-class-form";
import { parseFirstClassIntent, type FirstClassIntent, type FirstClassUIResult } from "@/lib/character/first-class-command-schema";
import { firstClassStorageKey, persistPendingFirstClass, readPendingFirstClass } from "@/lib/character/pending-first-class-storage";
import { getCreationScope, setCreationAccount } from "@/lib/character/pending-creation-storage";
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

// Actual component and sessionStorage with action doubles. No browser, provider,
// HTTP/database commit or save acceptance follows from this jsdom fixture.
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const account = id(1), target = id(2), operation = id(3), content = id(4), other = id(5);
const classes = [{ id: content, name: "Fixture class", version: 1 }];
const original = (characterId = target) => parseFirstClassIntent({ contract_version: 1, command: "add_class", character_id: characterId,
  operation_id: operation, expected_action_revision: "0", expected_class_revision: "0",
  fields: { content_id: content, content_version: 1, subclass: null } })!;
const confirmed = (op = operation, characterId = target): FirstClassUIResult => ({ status: "confirmed", account_id: account,
  character_id: characterId, operation_id: op });
function actions() {
  return { submit: vi.fn<(input: FirstClassIntent) => Promise<FirstClassUIResult>>().mockResolvedValue({ status: "unavailable" }),
    check: vi.fn<(input: FirstClassIntent) => Promise<FirstClassUIResult>>().mockResolvedValue({ status: "absent" }) };
}
async function open(handlers = actions(), options = classes, canStart = true) {
  const props = { accountId: account, characterId: target, classes: options, canStart,
    submitAction: handlers.submit, checkAction: handlers.check };
  const rendered = render(<FirstClassForm {...props} />);
  await waitFor(() => expect(screen.queryByText(/Checking your signed-in/)).not.toBeInTheDocument());
  return { ...rendered, ...handlers, props };
}
function submit() {
  const select = screen.getByRole("combobox", { name: "First class" });
  fireEvent.change(select, { target: { value: content } }); fireEvent.submit(select.closest("form")!);
}
beforeEach(() => { vi.restoreAllMocks(); router.refresh.mockReset(); sessionStorage.clear(); setCreationAccount(account, sessionStorage); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("retained first-class component", () => {
  it("stores the complete immutable original before sending, then hides new-choice controls on uncertainty", async () => {
    const handlers = actions();
    handlers.submit.mockImplementation(async input => {
      expect(readPendingFirstClass(account, target, sessionStorage)?.intent).toEqual(input);
      return { status: "unavailable" };
    });
    await open(handlers); submit();
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry original class save" })).toBeEnabled());
    const retained = readPendingFirstClass(account, target, sessionStorage)!;
    expect(handlers.submit).toHaveBeenCalledExactlyOnceWith(retained.intent);
    expect(retained.intent.fields).toEqual({ content_id: content, content_version: 1, subclass: null });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
  it("remount restores the original operation/version despite advanced parent and absent catalog options", async () => {
    persistPendingFirstClass(original(), getCreationScope(), sessionStorage);
    const first = await open(); first.unmount();
    const handlers = actions(); await open(handlers, [], false);
    fireEvent.click(screen.getByRole("button", { name: "Check class save" }));
    await waitFor(() => expect(screen.getByText(/No saved result was found yet/)).toBeInTheDocument());
    expect(handlers.check).toHaveBeenCalledExactlyOnceWith(original());
    fireEvent.click(screen.getByRole("button", { name: "Retry original class save" }));
    await waitFor(() => expect(handlers.submit).toHaveBeenCalledExactlyOnceWith(original()));
    expect(readPendingFirstClass(account, target, sessionStorage)?.intent).toEqual(original());
  });
  it("clears only an exact owned confirmation and shows the saved notebook link", async () => {
    const handlers = actions(); handlers.submit.mockImplementation(async input => confirmed(input.operation_id));
    await open(handlers); submit();
    await waitFor(() => expect(screen.getByRole("link", { name: "View saved class" })).toHaveAttribute("href", `/characters/${target}/builder/first-class`));
    expect(router.refresh).toHaveBeenCalledExactlyOnceWith();
    expect(readPendingFirstClass(account, target, sessionStorage)).toBeNull();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it.each([
    { ...confirmed(), account_id: other }, { ...confirmed(), character_id: other }, { ...confirmed(), operation_id: other },
    { ...confirmed(), token: "unexpected" }, { status: "confirmed" }, { status: "applied", receipt: {} },
  ])("retains the original on malformed/mismatched confirmation %j", async result => {
    persistPendingFirstClass(original(), getCreationScope(), sessionStorage);
    const handlers = actions(); handlers.check.mockResolvedValue(result as FirstClassUIResult); await open(handlers);
    fireEvent.click(screen.getByRole("button", { name: "Check class save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Check class save" })).toBeEnabled());
    expect(readPendingFirstClass(account, target, sessionStorage)?.intent).toEqual(original());
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("ignores a late result after target navigation and preserves both targets' pending originals", async () => {
    let finish!: (value: FirstClassUIResult) => void;
    const handlers = actions(); handlers.submit.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const opened = await open(handlers); submit();
    await waitFor(() => expect(handlers.submit).toHaveBeenCalledTimes(1));
    const sent = handlers.submit.mock.calls[0][0];
    const next = persistPendingFirstClass(original(other), getCreationScope(), sessionStorage);
    opened.rerender(<FirstClassForm {...opened.props} characterId={other} />);
    await act(async () => { finish(confirmed(sent.operation_id)); });
    expect(readPendingFirstClass(account, target, sessionStorage)?.intent).toEqual(sent);
    expect(readPendingFirstClass(account, other, sessionStorage)).toEqual(next);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("invalidates a late response across account changes before it can clear the next account's pending save", async () => {
    let finish!: (value: FirstClassUIResult) => void;
    const handlers = actions(); handlers.submit.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await open(handlers); submit(); await waitFor(() => expect(handlers.submit).toHaveBeenCalledTimes(1));
    const sent = handlers.submit.mock.calls[0][0];
    act(() => { setCreationAccount(other, sessionStorage); });
    const next = persistPendingFirstClass(original(), getCreationScope(), sessionStorage);
    await act(async () => { finish(confirmed(sent.operation_id)); });
    expect(readPendingFirstClass(other, target, sessionStorage)).toEqual(next);
    expect(screen.queryByRole("button")).not.toBeInTheDocument(); expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("rejects overlapping native submits before an uncertain response", async () => {
    let finish!: (value: FirstClassUIResult) => void;
    const handlers = actions(); handlers.submit.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await open(handlers); const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: content } });
    fireEvent.submit(select.closest("form")!); fireEvent.submit(select.closest("form")!);
    expect(handlers.submit).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ status: "unavailable" }); });
  });
  it("sends nothing when the original cannot be stored durably", async () => {
    const handlers = actions(); await open(handlers);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("denied"); }); submit();
    expect(handlers.submit).not.toHaveBeenCalled(); expect(handlers.check).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("No new save was sent");
  });
  it("preserves malformed stored bytes and blocks replacement", async () => {
    const key = firstClassStorageKey(account, target); sessionStorage.setItem(key, "{broken");
    const handlers = actions(); await open(handlers);
    expect(screen.getByRole("status")).toHaveTextContent("It has been kept");
    expect(sessionStorage.getItem(key)).toBe("{broken");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument(); expect(handlers.submit).not.toHaveBeenCalled();
  });
  it("retains the saved link and original when local confirmed-record cleanup fails", async () => {
    persistPendingFirstClass(original(), getCreationScope(), sessionStorage);
    const handlers = actions(); handlers.check.mockResolvedValue(confirmed()); await open(handlers);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw Error("denied"); });
    fireEvent.click(screen.getByRole("button", { name: "Check class save" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "View saved class" })).toBeInTheDocument());
    expect(router.refresh).not.toHaveBeenCalled();
    expect(readPendingFirstClass(account, target, sessionStorage)?.intent).toEqual(original());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
