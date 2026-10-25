import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubclassContentUpdate } from "@/components/builder/subclass-content-update";
import type { SaveBuilderStep } from "@/lib/builder/builder-step-command";
import type { SubclassContentUpdatePreview } from "@/lib/builder/subclass-content-update";
import { setCreationAccount } from "@/lib/character/pending-creation-storage";

// Actual inline review and account boundary with action doubles. This fixture
// establishes no native preview, graph mutation, browser or Auth acceptance.
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const account = id(1), character = id(2), occurrence = id(3), reference = id(4), content = id(5), other = id(6);
const candidate = { occurrence_id: occurrence, subclass_ref_id: reference, content_id: content,
  expected_content_version: 1, target_content_version: 2, saved_name: "Fiend", target_name: "Fiend" };
const preview = (): SubclassContentUpdatePreview => ({ contract_version: 1, character_id: character, actor_id: account,
  fields: { class_slug: "warlock", occurrence_id: occurrence, subclass_ref_id: reference, content_id: content,
    expected_content_version: 1, target_content_version: 2, expected_action_revision: "7", preview_digest: "b".repeat(64) },
  saved_name: "Fiend", target_name: "Fiend", retained: [{ kind: "ordinary_spell", label: "Charm Person, ordinary learned selection" },
    { kind: "invariant", label: "Class levels, HP rolls, ASI, inventory and original class provenance" }],
  removed: [{ kind: "spell_grant", label: "Burning Hands, automatic Fiend spell grant" }],
  added: [{ kind: "expanded_spell", label: "Burning Hands, available as an ordinary choice" }], automatic_spells_learned: 0 });
const saved = () => ({ choices: {}, scores: {}, action_revision: "8" });
function actions() {
  return { previewAction: vi.fn<(input: unknown) => Promise<unknown>>().mockResolvedValue({ status: "available", preview: preview() }),
    saveAction: vi.fn<SaveBuilderStep>().mockResolvedValue(saved()) };
}
function open(handlers = actions(), disabled = false) {
  const props = { accountId: account, characterId: character, candidate, actionRevision: "7", ...handlers, disabled };
  const rendered = render(<SubclassContentUpdate {...props} />);
  return { ...rendered, ...handlers, props };
}
async function review() {
  fireEvent.click(screen.getByRole("button", { name: "Review content update" }));
  await screen.findByRole("button", { name: "Confirm update for this character" });
}
beforeEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); setCreationAccount(account, sessionStorage); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("explicit per-character Fiend content review", () => {
  it("loads complete named consequences without a save and lets the owner keep the old version", async () => {
    const opened = open(); const before = JSON.stringify(sessionStorage); await review();
    expect(opened.previewAction).toHaveBeenCalledExactlyOnceWith({ subclass_ref_id: reference, target_content_version: 2 });
    expect(opened.saveAction).not.toHaveBeenCalled(); expect(JSON.stringify(sessionStorage)).toBe(before);
    expect(screen.getByRole("table")).toHaveTextContent("Fiend · version 1Fiend · version 2");
    expect(within(screen.getByRole("region", { name: "Retained" })).getByText("Charm Person, ordinary learned selection")).toBeVisible();
    expect(within(screen.getByRole("region", { name: "Removed" })).getByText("Burning Hands, automatic Fiend spell grant")).toBeVisible();
    expect(within(screen.getByRole("region", { name: "Added" })).getByText("Burning Hands, available as an ordinary choice")).toBeVisible();
    expect(screen.getByText(/This update learns no spells automatically/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Keep saved version" }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Your saved version is unchanged");
    expect(opened.saveAction).not.toHaveBeenCalled(); expect(opened.previewAction).toHaveBeenCalledTimes(1);
  });
  it("saves only the exact reviewed tuple, revision and native closure digest after explicit confirmation", async () => {
    const opened = open(); await review();
    fireEvent.click(screen.getByRole("button", { name: "Confirm update for this character" }));
    await waitFor(() => expect(opened.saveAction).toHaveBeenCalledExactlyOnceWith("update_subclass_version", preview().fields));
    expect(opened.saveAction.mock.calls[0][1]).not.toHaveProperty("retained");
    expect(opened.saveAction.mock.calls[0][1]).not.toHaveProperty("choices");
  });
  it("blocks preview and confirmation while class or spell edits are unfinished", async () => {
    const opened = open(actions(), true);
    expect(screen.getByRole("button", { name: "Review content update" })).toBeDisabled();
    expect(opened.previewAction).not.toHaveBeenCalled();
    opened.rerender(<SubclassContentUpdate {...opened.props} disabled={false} />); await review();
    opened.rerender(<SubclassContentUpdate {...opened.props} disabled />);
    expect(screen.getByRole("button", { name: "Confirm update for this character" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep saved version" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm update for this character" }));
    expect(opened.saveAction).not.toHaveBeenCalled();
  });
  it("invalidates a review when the accepted build revision changes", async () => {
    const opened = open(); await review();
    opened.rerender(<SubclassContentUpdate {...opened.props} actionRevision="8" />);
    expect(screen.queryByRole("button", { name: "Confirm update for this character" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Your saved build changed");
    expect(opened.saveAction).not.toHaveBeenCalled();
  });
  it.each(["account", "character", "revision", "unmount"])("ignores a late preview after %s changes", async change => {
    let finish!: (value: unknown) => void;
    const handlers = actions(); handlers.previewAction.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const opened = open(handlers); fireEvent.click(screen.getByRole("button", { name: "Review content update" }));
    if (change === "account") act(() => { setCreationAccount(other, sessionStorage); });
    else if (change === "character") opened.rerender(<SubclassContentUpdate {...opened.props} characterId={other} />);
    else if (change === "revision") opened.rerender(<SubclassContentUpdate {...opened.props} actionRevision="8" />);
    else opened.unmount();
    await act(async () => { finish({ status: "available", preview: preview() }); });
    expect(screen.queryByRole("button", { name: "Confirm update for this character" })).not.toBeInTheDocument();
    expect(handlers.saveAction).not.toHaveBeenCalled();
  });
  it.each([
    { ...preview(), actor_id: other }, { ...preview(), character_id: other },
    { ...preview(), fields: { ...preview().fields, occurrence_id: other } },
    { ...preview(), fields: { ...preview().fields, subclass_ref_id: other } },
    { ...preview(), fields: { ...preview().fields, content_id: other } },
    { ...preview(), fields: { ...preview().fields, expected_content_version: 0 } },
    { ...preview(), fields: { ...preview().fields, target_content_version: 3 } },
    { ...preview(), fields: { ...preview().fields, expected_action_revision: "8" } },
    { ...preview(), fields: { ...preview().fields, preview_digest: "missing" } },
    { ...preview(), retained: [{ kind: "invariant", label: "Classes retained", unexpected: true }] },
  ])("does not offer confirmation for mismatched or malformed review %j", async raw => {
    const handlers = actions(); handlers.previewAction.mockResolvedValue({ status: "available", preview: raw }); open(handlers);
    fireEvent.click(screen.getByRole("button", { name: "Review content update" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("could not be reviewed"));
    expect(screen.queryByRole("button", { name: "Confirm update for this character" })).not.toBeInTheDocument();
    expect(handlers.saveAction).not.toHaveBeenCalled();
  });
  it("keeps uncertainty separate from review and leaves recovery to the retained original save", async () => {
    const handlers = actions(); handlers.saveAction.mockRejectedValue(Error("response lost")); open(handlers); await review();
    fireEvent.click(screen.getByRole("button", { name: "Confirm update for this character" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Check the original save"));
    expect(screen.queryByRole("button", { name: "Confirm update for this character" })).not.toBeInTheDocument();
    expect(handlers.saveAction).toHaveBeenCalledOnce();
  });
  it("rejects overlapping preview calls and overlapping confirmations", async () => {
    let finish!: (value: unknown) => void;
    const handlers = actions(); handlers.previewAction.mockReturnValue(new Promise(resolve => { finish = resolve; })); open(handlers);
    const button = screen.getByRole("button", { name: "Review content update" }); fireEvent.click(button); fireEvent.click(button);
    expect(handlers.previewAction).toHaveBeenCalledOnce();
    await act(async () => { finish({ status: "available", preview: preview() }); });
    let savedFinish!: (value: Awaited<ReturnType<SaveBuilderStep>>) => void;
    handlers.saveAction.mockReturnValue(new Promise(resolve => { savedFinish = resolve; }));
    const confirm = screen.getByRole("button", { name: "Confirm update for this character" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(handlers.saveAction).toHaveBeenCalledOnce();
    await act(async () => { savedFinish(saved()); });
  });
});
