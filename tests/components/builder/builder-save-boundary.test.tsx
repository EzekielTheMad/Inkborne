import { useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BuilderSaveBoundary, useBuilderStepSave } from "@/components/builder/builder-save-boundary";
import { parseBuilderStepIntent, type BuilderStepIntent, type BuilderStepResponse,
  type SaveBuilderStep } from "@/lib/builder/builder-step-command";
import { builderStepStorageKey, persistPendingBuilderStep, readPendingBuilderStep } from "@/lib/builder/pending-builder-step-storage";
import { getCreationScope, setCreationAccount } from "@/lib/character/pending-creation-storage";
import { AbilitiesStepClient } from "@/app/(app)/characters/[id]/builder/abilities/abilities-step-client";
import { discardAbilityScoreDraft } from "@/lib/builder/use-ability-score-draft";
import type { SystemSchemaDefinition } from "@/lib/types/system";
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const reload = vi.hoisted(() => ({ call: vi.fn(), blocked: false }));
vi.mock("@/lib/builder/reload-builder-snapshot", async () => {
  const { discardAbilityScoreDraft: discard } = await import("@/lib/builder/use-ability-score-draft");
  return { reloadBuilderSnapshot: (accountId: string, characterId: string) => {
    discard(accountId, characterId);
    const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event);
    reload.blocked = event.defaultPrevented; reload.call(accountId, characterId);
  } };
});
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } }) }));
vi.mock("@/components/builder/stat-preview", () => ({ StatPreview: () => null }));

// Real boundary/storage with mocked actions/router, without native/browser proof.
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const account = id(1), target = id(2), operation = id(3), other = id(4);
const original = (characterId = target) => parseBuilderStepIntent({ contract_version: 1, operation_id: operation,
  character_id: characterId, command: "save_details", fields: { name: "Original name", alignment: null } })!;
const result = (intent = original(), status: "applied" | "replayed" | "recorded" = "applied"): BuilderStepResponse => ({ status,
  receipt: { operation_id: intent.operation_id, character_id: intent.character_id, actor_id: account,
    command: intent.command, fields: intent.fields, saved_choices: { alignment: "historical" }, saved_scores: { strength: 15 }, action_revision: "3" } });
function actions() {
  return { submit: vi.fn<(input: BuilderStepIntent) => Promise<unknown>>().mockRejectedValue(Error("response lost")),
    check: vi.fn<(input: BuilderStepIntent) => Promise<unknown>>().mockResolvedValue({ status: "absent" }) };
}
const fallback = vi.fn<SaveBuilderStep>();
const accepted = vi.fn();
const abilitySchema: SystemSchemaDefinition = {
  ability_scores: [{ slug: "strength", name: "Strength", abbr: "STR" }, { slug: "dexterity", name: "Dexterity", abbr: "DEX" }],
  proficiency_levels: [], derived_stats: [], skills: [], resources: [], content_types: [], currencies: [], creation_steps: [], sheet_sections: [],
};
const abilityProps = () => ({ ownerId: account, characterId: target, character: { id: target, level: 1,
  base_stats: { strength: 15, dexterity: 14 }, choices: { ability_method: "manual" as const } },
  contentRefs: [], schema: abilitySchema, saveAction: fallback });
function Editor({ supplied = fallback }: { supplied?: SaveBuilderStep }) {
  const save = useBuilderStepSave(supplied);
  const [draft, setDraft] = useState("current server name");
  return <div><input aria-label="Name" value={draft} onChange={event => setDraft(event.target.value)} />
    <button type="button" onClick={() => { void save?.("save_details", { name: "Original name", alignment: null }).then(accepted).catch(() => {}); }}>Save change</button>
    <Link href="/characters">Leave builder</Link>
  </div>;
}
async function open(handlers = actions()) {
  const props = { accountId: account, characterId: target, submitAction: handlers.submit, checkAction: handlers.check };
  const rendered = render(<BuilderSaveBoundary {...props}><Editor /></BuilderSaveBoundary>);
  await waitFor(() => expect(screen.queryByText(/Checking your signed-in/)).not.toBeInTheDocument());
  return { ...rendered, ...handlers, props };
}
beforeEach(() => { vi.restoreAllMocks(); router.refresh.mockReset(); reload.call.mockReset(); reload.blocked = false;
  discardAbilityScoreDraft(account, target); accepted.mockReset(); fallback.mockReset();
  sessionStorage.clear(); setCreationAccount(account, sessionStorage); });
afterEach(() => { cleanup(); discardAbilityScoreDraft(account, target); vi.restoreAllMocks(); });

describe("ordinary builder recovery boundary", () => {
  it("persists complete original before sending and blocks editing after response loss", async () => {
    const handlers = actions(); handlers.submit.mockImplementation(async intent => {
      expect(readPendingBuilderStep(account, target, sessionStorage)?.intent).toEqual(intent);
      throw Error("response lost");
    });
    await open(handlers); fireEvent.click(screen.getByRole("button", { name: "Save change" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry original save" })).toBeEnabled());
    const pending = readPendingBuilderStep(account, target, sessionStorage)!;
    expect(handlers.submit).toHaveBeenCalledExactlyOnceWith(pending.intent);
    expect(pending.intent).toMatchObject({ character_id: target, command: "save_details", fields: { name: "Original name", alignment: null } });
    expect(screen.queryByRole("textbox", { name: "Name" })).not.toBeInTheDocument();
    expect(accepted).not.toHaveBeenCalled(); expect(fallback).not.toHaveBeenCalled();
  });

  it("restores the same operation after remount; absent results allow only check/retry original", async () => {
    persistPendingBuilderStep(original(), getCreationScope(), sessionStorage);
    const first = await open(); first.unmount(); const handlers = actions(); await open(handlers);
    fireEvent.click(screen.getByRole("button", { name: "Check save" }));
    await waitFor(() => expect(screen.getByText(/No saved result was found yet/)).toBeInTheDocument());
    expect(handlers.check).toHaveBeenCalledExactlyOnceWith(original());
    fireEvent.click(screen.getByRole("button", { name: "Retry original save" }));
    await waitFor(() => expect(handlers.submit).toHaveBeenCalledExactlyOnceWith(original()));
    expect(readPendingBuilderStep(account, target, sessionStorage)?.intent).toEqual(original());
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("delivers a newly applied acknowledgement to the active editor and clears only that original", async () => {
    const handlers = actions(); handlers.submit.mockImplementation(async intent => result(intent));
    await open(handlers); fireEvent.click(screen.getByRole("button", { name: "Save change" }));
    await waitFor(() => expect(accepted).toHaveBeenCalledExactlyOnceWith({ choices: { alignment: "historical" },
      scores: { strength: 15 }, action_revision: "3" }));
    expect(readPendingBuilderStep(account, target, sessionStorage)).toBeNull();
    expect(screen.getByRole("textbox")).toBeEnabled(); expect(router.refresh).not.toHaveBeenCalled();
  });

  it.each(["check", "retry"])("%s recovery reloads the current document without applying historical receipt choices", async method => {
    const handlers = actions(); await open(handlers);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "uncertain draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Save change" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Check save" })).toBeEnabled());
    const pending = readPendingBuilderStep(account, target, sessionStorage)!;
    if (method === "check") handlers.check.mockResolvedValue(result(pending.intent, "recorded"));
    else handlers.submit.mockResolvedValue(result(pending.intent, "replayed"));
    fireEvent.click(screen.getByRole("button", { name: method === "check" ? "Check save" : "Retry original save" }));
    await waitFor(() => expect(reload.call).toHaveBeenCalledExactlyOnceWith(account, target));
    expect(reload.blocked).toBe(false);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(readPendingBuilderStep(account, target, sessionStorage)).toBeNull();
    expect(accepted).not.toHaveBeenCalled();
  });

  it.each([
    { ...result(), receipt: { ...(result() as Exclude<BuilderStepResponse, { status: "absent" }>).receipt, actor_id: other } },
    { ...result(), receipt: { ...(result() as Exclude<BuilderStepResponse, { status: "absent" }>).receipt, character_id: other } },
    { ...result(), receipt: { ...(result() as Exclude<BuilderStepResponse, { status: "absent" }>).receipt, operation_id: other } },
    { ...result(), receipt: { ...(result() as Exclude<BuilderStepResponse, { status: "absent" }>).receipt, command: "clear_race", fields: {} } },
    { ...result(), receipt: { ...(result() as Exclude<BuilderStepResponse, { status: "absent" }>).receipt, fields: { name: "Replacement", alignment: null } } },
    { ...result(), receipt: { ...(result() as Exclude<BuilderStepResponse, { status: "absent" }>).receipt, fields: { name: " Original name ", alignment: null } } },
    { ...result(), unexpected: true }, { status: "recorded", receipt: {} },
  ])("retains and blocks replacement on malformed/mismatched receipt %j", async raw => {
    persistPendingBuilderStep(original(), getCreationScope(), sessionStorage);
    const handlers = actions(); handlers.check.mockResolvedValue(raw); await open(handlers);
    fireEvent.click(screen.getByRole("button", { name: "Check save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Check save" })).toBeEnabled());
    expect(readPendingBuilderStep(account, target, sessionStorage)?.intent).toEqual(original());
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument(); expect(reload.call).not.toHaveBeenCalled();
  });

  it("ignores a late result after account change and never clears the next account's pending save", async () => {
    let finish!: (value: unknown) => void;
    const handlers = actions(); handlers.submit.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await open(handlers); fireEvent.click(screen.getByRole("button", { name: "Save change" }));
    await waitFor(() => expect(handlers.submit).toHaveBeenCalledTimes(1)); const sent = handlers.submit.mock.calls[0][0];
    act(() => { setCreationAccount(other, sessionStorage); });
    const next = persistPendingBuilderStep(original(), getCreationScope(), sessionStorage);
    await act(async () => { finish(result(sent)); });
    expect(readPendingBuilderStep(other, target, sessionStorage)).toEqual(next);
    expect(accepted).not.toHaveBeenCalled(); expect(router.refresh).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("ignores a late result after character change and retains both originals", async () => {
    let finish!: (value: unknown) => void;
    const handlers = actions(); handlers.submit.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const opened = await open(handlers); fireEvent.click(screen.getByRole("button", { name: "Save change" }));
    await waitFor(() => expect(handlers.submit).toHaveBeenCalledTimes(1)); const sent = handlers.submit.mock.calls[0][0];
    const next = persistPendingBuilderStep(original(other), getCreationScope(), sessionStorage);
    opened.rerender(<BuilderSaveBoundary {...opened.props} characterId={other}><Editor /></BuilderSaveBoundary>);
    await act(async () => { finish(result(sent)); });
    expect(readPendingBuilderStep(account, target, sessionStorage)?.intent).toEqual(sent);
    expect(readPendingBuilderStep(account, other, sessionStorage)).toEqual(next);
    expect(accepted).not.toHaveBeenCalled(); expect(router.refresh).not.toHaveBeenCalled();
  });

  it("rejects overlapping submits and keeps navigation guarded until confirmation", async () => {
    let finish!: (value: unknown) => void;
    const handlers = actions(); handlers.submit.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await open(handlers); const button = screen.getByRole("button", { name: "Save change" });
    fireEvent.click(button); fireEvent.click(button); expect(handlers.submit).toHaveBeenCalledTimes(1);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("link")); expect(confirm).toHaveBeenCalledOnce();
    const unload = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(unload); expect(unload.defaultPrevented).toBe(true);
    await act(async () => { finish({ status: "absent" }); });
  });

  it("preserves corrupt bytes and blocks ordinary controls without sending", async () => {
    const key = builderStepStorageKey(account, target); sessionStorage.setItem(key, "{broken");
    const handlers = actions(); await open(handlers);
    expect(screen.getByText(/It has been kept/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument(); expect(sessionStorage.getItem(key)).toBe("{broken");
    expect(handlers.submit).not.toHaveBeenCalled(); expect(handlers.check).not.toHaveBeenCalled();
  });

  it("sends nothing if storage cannot retain the original", async () => {
    const handlers = actions(); await open(handlers);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("denied"); });
    fireEvent.click(screen.getByRole("button", { name: "Save change" }));
    await waitFor(() => expect(screen.getByText(/No new save was sent/)).toBeInTheDocument());
    expect(handlers.submit).not.toHaveBeenCalled(); expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("keeps confirmed original and blocks controls when local cleanup fails", async () => {
    persistPendingBuilderStep(original(), getCreationScope(), sessionStorage);
    const handlers = actions(); handlers.check.mockResolvedValue(result(original(), "recorded")); await open(handlers);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw Error("denied"); });
    fireEvent.click(screen.getByRole("button", { name: "Check save" }));
    await waitFor(() => expect(screen.getByText(/local record could not be cleared/)).toBeInTheDocument());
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument(); expect(screen.getByRole("button", { name: "Check save" })).toBeDisabled();
    expect(readPendingBuilderStep(account, target, sessionStorage)?.intent).toEqual(original()); expect(router.refresh).not.toHaveBeenCalled();
  });

  it("retains supplied callbacks without a provider and preserves disabled callers", async () => {
    fallback.mockResolvedValue({ choices: {}, scores: {}, action_revision: "1" });
    const first = render(<Editor />); fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(fallback).toHaveBeenCalledExactlyOnceWith("save_details", { name: "Original name", alignment: null }));
    first.unmount();
    function Disabled() { return <p>{useBuilderStepSave(undefined) === undefined ? "disabled" : "enabled"}</p>; }
    render(<BuilderSaveBoundary accountId={account} characterId={target} submitAction={actions().submit} checkAction={actions().check}><Disabled /></BuilderSaveBoundary>);
    expect(await screen.findByText("disabled")).toBeInTheDocument();
  });

  it("real ability editor sends its first and next edits through the current committed save adapter", async () => {
    const handlers = actions(); handlers.submit.mockImplementation(async intent => ({ ...result(intent),
      receipt: { ...(result(intent) as Exclude<BuilderStepResponse, { status: "absent" }>).receipt,
        saved_scores: (intent.fields as { scores: Record<string, number> }).scores } }));
    render(<BuilderSaveBoundary accountId={account} characterId={target} submitAction={handlers.submit} checkAction={handlers.check}>
      <AbilitiesStepClient {...abilityProps()} />
    </BuilderSaveBoundary>);
    const inputs = await screen.findAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "14" } });
    await waitFor(() => expect(handlers.submit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0]).toBeEnabled());
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "13" } });
    await waitFor(() => expect(handlers.submit).toHaveBeenCalledTimes(2));
    expect(handlers.submit.mock.calls[1][0]).toMatchObject({ command: "save_abilities", fields: {
      scores: { strength: 13, dexterity: 14 }, expected_scores: { strength: 14, dexterity: 14 } } });
    expect(handlers.submit.mock.calls[0][0].operation_id).not.toBe(handlers.submit.mock.calls[1][0].operation_id);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("real ability recovery removes local drafts and unload guards before loading current server values", async () => {
    const handlers = actions();
    const props = { accountId: account, characterId: target, submitAction: handlers.submit, checkAction: handlers.check };
    const first = render(<BuilderSaveBoundary {...props}><AbilitiesStepClient {...abilityProps()} /></BuilderSaveBoundary>);
    fireEvent.change((await screen.findAllByRole("spinbutton"))[0], { target: { value: "14" } });
    await waitFor(() => expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument());
    const pending = readPendingBuilderStep(account, target, sessionStorage)!;
    handlers.check.mockResolvedValue({ ...result(pending.intent, "recorded"), receipt: {
      ...(result(pending.intent) as Exclude<BuilderStepResponse, { status: "absent" }>).receipt,
      saved_scores: { strength: 14, dexterity: 14 } } });
    fireEvent.click(screen.getByRole("button", { name: "Check save" }));
    await waitFor(() => expect(reload.call).toHaveBeenCalledExactlyOnceWith(account, target));
    expect(reload.blocked).toBe(false); expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    first.unmount();
    // Emulate the document's next server snapshot, newer than the receipt.
    const latest = abilityProps(); latest.character.base_stats.strength = 17;
    handlers.submit.mockImplementation(async intent => ({ ...result(intent), receipt: {
      ...(result(intent) as Exclude<BuilderStepResponse, { status: "absent" }>).receipt,
      saved_scores: (intent.fields as { scores: Record<string, number> }).scores } }));
    render(<BuilderSaveBoundary {...props}><AbilitiesStepClient {...latest} /></BuilderSaveBoundary>);
    expect((await screen.findAllByRole("spinbutton"))[0]).toHaveValue(17);
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "16" } });
    await waitFor(() => expect(handlers.submit).toHaveBeenCalledTimes(2));
    expect(handlers.submit.mock.calls[1][0]).toMatchObject({ fields: { expected_scores: { strength: 17, dexterity: 14 },
      scores: { strength: 16, dexterity: 14 } } });
  });

  it("removes portalled editors once the original save becomes uncertain", async () => {
    function PortalEditor() { return <><Editor />{createPortal(<button type="button">Portalled choice</button>, document.body)}</>; }
    const handlers = actions();
    render(<BuilderSaveBoundary accountId={account} characterId={target} submitAction={handlers.submit} checkAction={handlers.check}><PortalEditor /></BuilderSaveBoundary>);
    await screen.findByRole("button", { name: "Portalled choice" });
    fireEvent.click(screen.getByRole("button", { name: "Save change" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Portalled choice" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Check save" })).toBeEnabled();
  });
});
