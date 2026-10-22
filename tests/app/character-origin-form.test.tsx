import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OriginCreationForm } from "@/app/(app)/characters/new/origin-form";
import { creationStorageKey, getCreationScope, persistPendingCreation, readPendingCreation, setCreationAccount } from "@/lib/character/pending-creation-storage";
import { parseCreationIntent, type CreationIntent, type CreationUIResult } from "@/lib/character/pending-creation-schema";
const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

// Component/storage/action-double checks only: no browser, Auth, RPC or database
// acceptance is established by this jsdom fixture.
const account = "10000000-0000-4000-8000-000000000001", other = "10000000-0000-4000-8000-000000000004";
const system = "10000000-0000-4000-8000-000000000005", operation = "10000000-0000-4000-8000-000000000002";
const target = "10000000-0000-4000-8000-000000000003";
const systems = [{ id: system, name: "D&D 5e", slug: "dnd-5e-2014" }];
const original = () => parseCreationIntent({ contract_version: 1, operation_id: operation, command: "create_character",
  fields: { name: "Elara", system_id: system, campaign_id: null } })!;
const confirmed = (op: string): CreationUIResult => ({ status: "confirmed", account_id: account, operation_id: op, character_id: target });
function actions() {
  return { submit: vi.fn<(intent: CreationIntent) => Promise<CreationUIResult>>().mockResolvedValue({ status: "unavailable" }),
    check: vi.fn<(intent: CreationIntent) => Promise<CreationUIResult>>().mockResolvedValue({ status: "absent" }) };
}
async function open(handlers = actions(), options = systems) {
  const rendered = render(<OriginCreationForm accountId={account} systems={options} submitAction={handlers.submit} checkAction={handlers.check} />);
  await waitFor(() => expect(screen.queryByText(/Checking your signed-in/)).not.toBeInTheDocument());
  return { ...rendered, ...handlers };
}
function fillAndSubmit(name = " Elara ") {
  const field = screen.getByRole("textbox", { name: "What will they be called?" });
  fireEvent.change(field, { target: { value: name } });
  fireEvent.submit(field.closest("form")!);
}
beforeEach(() => {
  vi.restoreAllMocks(); mocks.push.mockReset(); sessionStorage.clear(); setCreationAccount(account, sessionStorage);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("pending first-character creation", () => {
  it("retains before first request, trims once and freezes fields after uncertainty", async () => {
    const handlers = actions();
    handlers.submit.mockImplementation(async intent => {
      expect(readPendingCreation(account, sessionStorage)?.intent).toEqual(intent);
      return { status: "unavailable" };
    });
    await open(handlers);
    expect(screen.getByRole("textbox")).toHaveAttribute("maxlength", "100");
    fillAndSubmit();
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry original request" })).toBeEnabled());
    const stored = readPendingCreation(account, sessionStorage)!;
    expect(stored.intent.fields.name).toBe("Elara");
    expect(handlers.submit).toHaveBeenCalledExactlyOnceWith(stored.intent);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("reload restores same intent even if the system is no longer listed; absent never creates a new ID", async () => {
    persistPendingCreation(original(), getCreationScope(), sessionStorage);
    const first = await open(); first.unmount();
    const handlers = actions(); await open(handlers, []);
    fireEvent.click(screen.getByRole("button", { name: "Check result" }));
    await waitFor(() => expect(screen.getByText(/No saved result was found yet/)).toBeInTheDocument());
    expect(handlers.check).toHaveBeenCalledExactlyOnceWith(original());
    expect(readPendingCreation(account, sessionStorage)?.intent).toEqual(original());
    fireEvent.click(screen.getByRole("button", { name: "Retry original request" }));
    await waitFor(() => expect(handlers.submit).toHaveBeenCalledExactlyOnceWith(original()));
    expect(readPendingCreation(account, sessionStorage)?.intent.operation_id).toBe(operation);
  });
  it("only a matching owned confirmation clears and opens the saved character", async () => {
    const handlers = actions(); handlers.submit.mockImplementation(async intent => confirmed(intent.operation_id));
    await open(handlers); fillAndSubmit();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/characters/" + target + "/builder/first-class"));
    expect(readPendingCreation(account, sessionStorage)).toBeNull();
    expect(screen.getByRole("link", { name: "Open your saved character" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it.each([
    { status: "confirmed", account_id: other, operation_id: operation, character_id: target },
    { status: "confirmed", account_id: account, operation_id: other, character_id: target },
    { status: "confirmed", account_id: account, operation_id: operation, character_id: "bad" },
    { status: "confirmed", account_id: account, operation_id: operation, character_id: target, token: "unexpected" },
  ])("retains on unmatched/malformed confirmation %j", async result => {
    persistPendingCreation(original(), getCreationScope(), sessionStorage);
    const handlers = actions(); handlers.check.mockResolvedValue(result as CreationUIResult);
    await open(handlers); fireEvent.click(screen.getByRole("button", { name: "Check result" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Check result" })).toBeEnabled());
    expect(readPendingCreation(account, sessionStorage)?.intent).toEqual(original()); expect(mocks.push).not.toHaveBeenCalled();
  });
  it("ignores a late response after account transition and cannot clear the next account's record", async () => {
    let finish!: (result: CreationUIResult) => void;
    const handlers = actions(); handlers.submit.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await open(handlers); fillAndSubmit();
    await waitFor(() => expect(handlers.submit).toHaveBeenCalledTimes(1));
    const sent = handlers.submit.mock.calls[0][0];
    act(() => { setCreationAccount(other, sessionStorage); });
    const next = persistPendingCreation(original(), getCreationScope(), sessionStorage);
    await act(async () => { finish(confirmed(sent.operation_id)); });
    expect(readPendingCreation(other, sessionStorage)).toEqual(next); expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("prevents an overlapping second submit before the first response", async () => {
    let finish!: (result: CreationUIResult) => void;
    const handlers = actions(); handlers.submit.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await open(handlers);
    const field = screen.getByRole("textbox"); fireEvent.change(field, { target: { value: "Elara" } });
    const form = field.closest("form")!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(handlers.submit).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ status: "unavailable" }); });
  });
  it("storage failure prevents any first request", async () => {
    const handlers = actions(); await open(handlers);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
    fillAndSubmit();
    expect(handlers.submit).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("No new request was sent");
  });
  it("unreadable pending bytes are retained and block new requests", async () => {
    sessionStorage.setItem(creationStorageKey(account), "{broken");
    const handlers = actions(); await open(handlers);
    expect(screen.getByRole("status")).toHaveTextContent("It has been kept");
    expect(sessionStorage.getItem(creationStorageKey(account))).toBe("{broken");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument(); expect(handlers.submit).not.toHaveBeenCalled();
  });
  it("does not offer systems outside the finite creation profile", async () => {
    const handlers = actions(); await open(handlers, [{ id: system, slug: "other-system", name: "Other system" }]);
    expect(screen.queryByRole("option", { name: "Other system" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open the notebook" })).toBeDisabled();
  });
  it("keeps the original and saved-character link when confirmed-record clearing fails", async () => {
    persistPendingCreation(original(), getCreationScope(), sessionStorage);
    const handlers = actions(); handlers.check.mockResolvedValue(confirmed(operation)); await open(handlers);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("denied"); });
    fireEvent.click(screen.getByRole("button", { name: "Check result" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "Open your saved character" })).toBeInTheDocument());
    expect(readPendingCreation(account, sessionStorage)?.intent).toEqual(original()); expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
