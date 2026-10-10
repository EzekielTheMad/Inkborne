import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AbilitiesStepClient } from "@/app/(app)/characters/[id]/builder/abilities/abilities-step-client";
import { saveCharacterAbilities, AbilityScoreConflictError, type AbilityScoreDraft } from "@/lib/supabase/ability-scores-client";
import type { CharacterChoices } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import { discardAbilityScoreDraft } from "@/lib/builder/use-ability-score-draft";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const auth = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(), unsubscribe: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));
vi.mock("@/lib/supabase/ability-scores-client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/supabase/ability-scores-client")>(),
  saveCharacterAbilities: vi.fn(),
}));
vi.mock("@/components/builder/stat-preview", () => ({ StatPreview: () => null }));

const update = vi.mocked(saveCharacterAbilities);
const schema: SystemSchemaDefinition = {
  ability_scores: [
    { slug: "str", name: "Strength", abbr: "STR" },
    { slug: "dex", name: "Dexterity", abbr: "DEX" },
  ],
  proficiency_levels: [], derived_stats: [], skills: [], resources: [],
  content_types: [], currencies: [], creation_steps: [], sheet_sections: [],
};

function props({
  id = "char-1", method = "manual", scores = { str: 12, dex: 14 },
}: { id?: string; method?: CharacterChoices["ability_method"]; scores?: Record<string, number> } = {}): React.ComponentProps<typeof AbilitiesStepClient> {
  return {
    ownerId: "owner-1",
    characterId: id,
    character: { id, level: 1, base_stats: scores, choices: { race: "human", ability_method: method } },
    contentRefs: [], schema,
  };
}

function pendingSave() {
  let finish!: (saved: AbilityScoreDraft) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<AbilityScoreDraft>((yes, no) => { finish = yes; reject = no; });
  return { promise, resolve: () => finish({ method: "manual", scores: { str: 16, dex: 14 } }), reject };
}

function editManual(index: number, value: string) {
  fireEvent.change(screen.getAllByRole("spinbutton")[index], { target: { value } });
}

function next() { return screen.getByRole("button", { name: "Next: Background" }); }
function previous() { return screen.getByRole("button", { name: "Previous: Class" }); }

beforeEach(() => {
  discardAbilityScoreDraft("owner-1", "char-1");
  discardAbilityScoreDraft("owner-1", "char-2");
  discardAbilityScoreDraft("owner-2", "char-1");
  vi.clearAllMocks();
  update.mockReset().mockImplementation(async (_id, next) => next);
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: auth.unsubscribe } } });
});

describe("AbilitiesStepClient saves", () => {
  it.each([
    ["Point Buy", "point_buy", { str: 8, dex: 8 }],
    ["Standard Array", "standard_array", {}],
  ])("persists a switch to %s without requiring another edit", async (label, method, scores) => {
    render(<AbilitiesStepClient {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("char-1", {
      method, scores,
    }, expect.anything()));
  });

  it("persists manual defaults when switching from point buy", async () => {
    render(<AbilitiesStepClient {...props({ method: "point_buy" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Manual Entry" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("char-1", {
      method: "manual", scores: { str: 10, dex: 10 },
    }, expect.anything()));
  });

  it("does not reset scores or write when the active method is selected again", () => {
    render(<AbilitiesStepClient {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Manual Entry" }));
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(12);
    expect(screen.getAllByRole("spinbutton")[1]).toHaveValue(14);
    expect(update).not.toHaveBeenCalled();
  });

  it("clears a standard-array assignment and makes its value available again", async () => {
    render(<AbilitiesStepClient {...props({ method: "standard_array", scores: { str: 15, dex: 14 } })} />);
    const [strength, dexterity] = screen.getAllByRole("combobox");
    fireEvent.change(strength, { target: { value: "" } });
    expect(strength).toHaveValue("");
    expect(within(dexterity).getByRole("option", { name: "15" })).toBeEnabled();
    await waitFor(() => expect(update).toHaveBeenCalledWith("char-1", {
      method: "standard_array", scores: { dex: 14 },
    }, expect.anything()));
  });

  it("serializes rapid edits while immediately retaining both changes", async () => {
    const first = pendingSave();
    update.mockReturnValueOnce(first.promise);
    render(<AbilitiesStepClient {...props()} />);
    editManual(0, "16");
    editManual(1, "18");
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(16);
    expect(screen.getAllByRole("spinbutton")[1]).toHaveValue(18);
    expect(previous()).toBeDisabled();
    expect(next()).toBeDisabled();
    await act(async () => first.resolve());
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update).toHaveBeenLastCalledWith("char-1", {
      method: "manual", scores: { str: 16, dex: 18 },
    }, { method: "manual", scores: { str: 16, dex: 14 } });
    await waitFor(() => expect(next()).toBeEnabled());
  });

  it("queues a method switch behind an in-flight score save with its own method", async () => {
    const first = pendingSave();
    update.mockReturnValueOnce(first.promise);
    render(<AbilitiesStepClient {...props()} />);
    editManual(0, "16");
    fireEvent.click(screen.getByRole("button", { name: "Point Buy" }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(screen.getByText("27 / 27")).toBeInTheDocument();
    await act(async () => first.resolve());
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update).toHaveBeenLastCalledWith("char-1", {
      method: "point_buy", scores: { str: 8, dex: 8 },
    }, expect.anything());
  });

  it("keeps a failed draft visible, blocks navigation, and retries that exact draft", async () => {
    update.mockRejectedValueOnce(new Error("Connection lost"));
    render(<AbilitiesStepClient {...props()} />);
    editManual(0, "16");
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not save/i);
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(16);
    expect(previous()).toBeDisabled();
    expect(next()).toBeDisabled();
    fireEvent.click(next());
    expect(navigation.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /retry save/i }));
    await waitFor(() => expect(next()).toBeEnabled());
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[1]).toEqual(update.mock.calls[0]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(next());
    expect(navigation.push).toHaveBeenCalledWith("/characters/char-1/builder/background");
  });

  it("does not roll back a newer draft when an older save fails", async () => {
    const first = pendingSave();
    update.mockReturnValueOnce(first.promise);
    render(<AbilitiesStepClient {...props()} />);
    editManual(0, "16");
    editManual(1, "18");
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    await act(async () => first.reject(new Error("Older request failed")));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(next()).toBeEnabled());
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(16);
    expect(screen.getAllByRole("spinbutton")[1]).toHaveValue(18);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(update.mock.calls[1][2]).toEqual({ method: "manual", scores: { str: 12, dex: 14 } });
  });

  it("uses the raw absent method and scores instead of displayed defaults as expectations", async () => {
    const initial = props({ scores: {} });
    initial.character.choices.ability_method = undefined;
    render(<AbilitiesStepClient {...initial} />);
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "15" } });
    await waitFor(() => expect(update).toHaveBeenCalledWith("char-1", {
      method: "standard_array", scores: { str: 15 },
    }, { method: null, scores: {} }));
  });

  it("retries a final failed draft against the last successful snapshot", async () => {
    update.mockImplementationOnce(async (_id, next) => next).mockRejectedValueOnce(new Error("Connection lost"));
    render(<AbilitiesStepClient {...props()} />);
    editManual(0, "16");
    editManual(1, "18");
    await screen.findByRole("alert");
    expect(screen.getAllByRole("spinbutton")[1]).toHaveValue(18);
    fireEvent.click(screen.getByRole("button", { name: /retry save/i }));
    await waitFor(() => expect(next()).toBeEnabled());
    expect(update.mock.calls[2]).toEqual(["char-1",
      { method: "manual", scores: { str: 16, dex: 18 } },
      { method: "manual", scores: { str: 16, dex: 14 } },
    ]);
  });

  it("stops queued saves on a conflict and requires reload rather than blind retry", async () => {
    const first = pendingSave();
    update.mockReturnValueOnce(first.promise);
    render(<AbilitiesStepClient {...props()} />);
    editManual(0, "16");
    editManual(1, "18");
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    await act(async () => first.reject(new AbilityScoreConflictError()));
    expect(await screen.findByRole("alert")).toHaveTextContent(/changed in another editor/i);
    expect(screen.getByRole("button", { name: "Reload saved scores" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /retry save/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("spinbutton")[0]).toBeDisabled();
    expect(next()).toBeDisabled();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("warns on unload while unsaved and removes the warning after success", async () => {
    const first = pendingSave();
    update.mockReturnValueOnce(first.promise);
    render(<AbilitiesStepClient {...props()} />);
    editManual(0, "16");
    const pendingUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(pendingUnload);
    expect(pendingUnload.defaultPrevented).toBe(true);
    await act(async () => first.resolve());
    await waitFor(() => expect(next()).toBeEnabled());
    const savedUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(savedUnload);
    expect(savedUnload.defaultPrevented).toBe(false);
  });

  it.each(["0", "31", "12.5", ""])("does not persist an invalid manual value: %s", (value) => {
    render(<AbilitiesStepClient {...props()} />);
    editManual(0, value);
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps accepted saves on their original character after switching characters", async () => {
    const first = pendingSave();
    update.mockReturnValueOnce(first.promise);
    const view = render(<AbilitiesStepClient {...props()} />);
    editManual(0, "16");
    editManual(1, "18");
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    view.rerender(<AbilitiesStepClient {...props({ id: "char-2", scores: { str: 10, dex: 11 } })} />);
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(10);
    expect(screen.getAllByRole("spinbutton")[1]).toHaveValue(11);
    expect(next()).toBeEnabled();
    await act(async () => first.resolve());
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls.map(([id]) => id)).toEqual(["char-1", "char-1"]);
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(10);
    expect(screen.getAllByRole("spinbutton")[1]).toHaveValue(11);
  });

  it("handles an in-flight failure after unmount without a navigation side effect", async () => {
    const first = pendingSave();
    update.mockReturnValueOnce(first.promise);
    const view = render(<AbilitiesStepClient {...props()} />);
    editManual(0, "16");
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    view.unmount();
    await act(async () => first.reject(new Error("Request ended after unmount")));
    expect(navigation.push).not.toHaveBeenCalled();
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("restores the failed draft and retry after leaving and returning to the same character", async () => {
    const first = pendingSave();
    update.mockReturnValueOnce(first.promise);
    const oldEditor = render(<AbilitiesStepClient {...props()} />);
    editManual(0, "16");
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    oldEditor.unmount();
    await act(async () => first.reject(new Error("Connection failed while away")));
    const unloadWhileAway = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unloadWhileAway);
    expect(unloadWhileAway.defaultPrevented).toBe(true);
    render(<AbilitiesStepClient {...props()} />);
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(16);
    expect(screen.getByRole("alert")).toHaveTextContent(/could not save/i);
    expect(next()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /retry save/i }));
    await waitFor(() => expect(next()).toBeEnabled());
    expect(update.mock.calls[1]).toEqual(update.mock.calls[0]);
  });

  it("discards retained drafts on sign-out and stops queued writes", async () => {
    const first = pendingSave();
    update.mockReturnValueOnce(first.promise);
    const oldEditor = render(<AbilitiesStepClient {...props()} />);
    editManual(0, "16");
    editManual(1, "18");
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const onAuthChange = auth.onAuthStateChange.mock.calls.at(-1)![0];
    act(() => onAuthChange("SIGNED_OUT", null));
    expect(screen.getByRole("alert")).toHaveTextContent(/sign-in session changed/i);
    expect(screen.queryByRole("button", { name: /retry save/i })).not.toBeInTheDocument();
    await act(async () => first.resolve());
    expect(update).toHaveBeenCalledTimes(1);
    const unloadAfterSignout = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unloadAfterSignout);
    expect(unloadAfterSignout.defaultPrevented).toBe(false);
    oldEditor.unmount();
    render(<AbilitiesStepClient {...props()} />);
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(12);
  });

  it("does not recover one owner's failed draft into another owner's editor", async () => {
    update.mockRejectedValueOnce(new Error("Connection lost"));
    const view = render(<AbilitiesStepClient {...props()} />);
    editManual(0, "16");
    await screen.findByRole("alert");
    view.rerender(<AbilitiesStepClient {...props()} ownerId="owner-2" />);
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(12);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    view.rerender(<AbilitiesStepClient {...props()} />);
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(12);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shares the in-flight queue with a same-character remount", async () => {
    const first = pendingSave();
    update.mockReturnValueOnce(first.promise);
    const oldEditor = render(<AbilitiesStepClient {...props()} />);
    editManual(0, "16");
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    oldEditor.unmount();
    render(<AbilitiesStepClient {...props()} />);
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(16);
    expect(next()).toBeDisabled();
    editManual(1, "18");
    expect(update).toHaveBeenCalledTimes(1);
    await act(async () => first.resolve());
    await waitFor(() => expect(next()).toBeEnabled());
    expect(update.mock.calls[1]).toEqual(["char-1",
      { method: "manual", scores: { str: 16, dex: 18 } },
      { method: "manual", scores: { str: 16, dex: 14 } },
    ]);
  });
});
