import { Activity } from "react";
import Link from "next/link";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AbilitiesStepClient } from "@/app/(app)/characters/[id]/builder/abilities/abilities-step-client";
import { saveCharacterAbilities, type AbilityScoreDraft } from "@/lib/supabase/ability-scores-client";
import { discardAbilityScoreDraft } from "@/lib/builder/use-ability-score-draft";
import type { SystemSchemaDefinition } from "@/lib/types/system";

vi.mock("@/lib/supabase/ability-scores-client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/supabase/ability-scores-client")>(), saveCharacterAbilities: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
} }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/builder/stat-preview", () => ({ StatPreview: () => null }));

const schema: SystemSchemaDefinition = { ability_scores: [
  { slug: "strength", name: "Strength", abbr: "STR" },
  { slug: "dexterity", name: "Dexterity", abbr: "DEX" },
], proficiency_levels: [], derived_stats: [], skills: [], resources: [],
  content_types: [], currencies: [], creation_steps: [], sheet_sections: [],
};
function mount(method: "standard_array" | "manual" | "point_buy" = "standard_array", scores: Record<string, number> = {}) {
  return render(<AbilitiesStepClient ownerId="owner-1" characterId="char-1" character={{
    id: "char-1", level: 1, choices: { ability_method: method, race: "human" }, base_stats: scores,
  }} contentRefs={[]} schema={schema as never} />);
}
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject, save: async (_id: string, next: AbilityScoreDraft) => { await promise; return next; } };
}
const persist = vi.mocked(saveCharacterAbilities);

describe("ability-score save recovery", () => {
  beforeEach(() => {
    discardAbilityScoreDraft("owner-1", "char-1");
    vi.resetAllMocks();
    persist.mockImplementation(async (_id, next) => next);
  });

  it("serializes rapid assignments and keeps later edits when an earlier save fails", async () => {
    const first = deferred(); const second = deferred();
    persist.mockImplementationOnce(first.save).mockImplementationOnce(second.save);
    mount();
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "15" } });
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "14" } });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Next: Background" })).toBeDisabled();
    await act(async () => first.reject(new Error("offline")));
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(2));
    expect(screen.getAllByRole("combobox")[0]).toHaveValue("15");
    expect(screen.getAllByRole("combobox")[1]).toHaveValue("14");
    expect(persist).toHaveBeenLastCalledWith("char-1", { method: "standard_array", scores: { strength: 15, dexterity: 14 } }, { method: "standard_array", scores: {} });
    await act(async () => second.resolve());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next: Background" })).toBeEnabled();
  });

  it("retains a failed draft and retries the latest scores explicitly", async () => {
    persist.mockRejectedValueOnce(new Error("database internal message"));
    mount("manual", { strength: 10, dexterity: 10 });
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "18" } });
    await screen.findByRole("alert");
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(18);
    expect(screen.getByRole("alert")).not.toHaveTextContent("database internal message");
    expect(screen.getByRole("button", { name: "Next: Background" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(persist).toHaveBeenLastCalledWith("char-1", { method: "manual", scores: { strength: 18, dexterity: 10 } }, { method: "manual", scores: { strength: 10, dexterity: 10 } });
  });

  it("saves method changes immediately and orders them after pending edits", async () => {
    const first = deferred(); persist.mockImplementationOnce(first.save);
    mount();
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "15" } });
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Point Buy" }));
    expect(persist).toHaveBeenCalledTimes(1);
    await act(async () => first.resolve());
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(2));
    expect(persist).toHaveBeenLastCalledWith("char-1", { method: "point_buy", scores: { strength: 8, dexterity: 8 } }, { method: "standard_array", scores: { strength: 15 } });
  });

  it("persists clearing an array assignment as a partial draft", async () => {
    mount("standard_array", { strength: 15 });
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "" } });
    await waitFor(() => expect(persist).toHaveBeenCalledWith("char-1", { method: "standard_array", scores: {} }, { method: "standard_array", scores: { strength: 15 } }));
    expect(screen.getAllByRole("combobox")[0]).toHaveValue("");
  });

  it("retains the newest rapid edit when its save fails and retries that value", async () => {
    const first = deferred();
    persist.mockImplementationOnce(first.save).mockRejectedValueOnce(new Error("offline"));
    mount("manual", { strength: 10, dexterity: 10 });
    const strength = screen.getByRole("spinbutton", { name: "Strength score" });
    act(() => {
      fireEvent.change(strength, { target: { value: "16" } });
      fireEvent.change(strength, { target: { value: "18" } });
    });
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    await act(async () => first.resolve());
    await screen.findByRole("alert");
    expect(strength).toHaveValue(18);
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    await waitFor(() => expect(screen.getByText("Changes save automatically.")).toHaveAttribute("role", "status"));
    expect(persist).toHaveBeenLastCalledWith("char-1", { method: "manual", scores: { strength: 18, dexterity: 10 } }, { method: "manual", scores: { strength: 16, dexterity: 10 } });
  });

  it("accumulates point-buy increments before the previous request settles", async () => {
    const first = deferred(); persist.mockImplementationOnce(first.save);
    mount("point_buy", { strength: 8, dexterity: 8 });
    act(() => {
      fireEvent.click(screen.getAllByRole("button", { name: "Increase Strength" })[0]);
      fireEvent.click(screen.getAllByRole("button", { name: "Increase Strength" })[0]);
    });
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    await act(async () => first.resolve());
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(2));
    expect(persist).toHaveBeenLastCalledWith("char-1", { method: "point_buy", scores: { strength: 10, dexterity: 8 } }, { method: "point_buy", scores: { strength: 9, dexterity: 8 } });
  });

  it("keeps manual score limits and point-buy lower bounds", () => {
    const mounted = mount("manual", { strength: 10, dexterity: 10 });
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "31" } });
    expect(persist).not.toHaveBeenCalled();
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(10);
    mounted.unmount();
    discardAbilityScoreDraft("owner-1", "char-1");
    mount("point_buy", { strength: 8, dexterity: 8 });
    expect(screen.getAllByRole("button", { name: "Decrease Strength" })[0]).toBeDisabled();
  });

  it("does not present existing scores as assigned array values before a method was chosen", () => {
    render(<AbilitiesStepClient ownerId="owner-1" characterId="char-1" character={{
      id: "char-1", level: 1, choices: {}, base_stats: { strength: 10, dexterity: 10 },
    }} contentRefs={[]} schema={schema as never} />);
    expect(screen.getByRole("combobox", { name: "Strength score" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Standard Array" })).toHaveAttribute("aria-pressed", "true");
    expect(persist).not.toHaveBeenCalled();
  });
  it("blocks header links and unload until the pending draft is confirmed", async () => {
    const first = deferred(); persist.mockImplementationOnce(first.save);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const navigate = vi.fn();
    render(<Link href="/campaigns" onClick={(event) => { event.preventDefault(); navigate(); }}>Campaigns</Link>);
    mount("manual", { strength: 10 });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Strength score" }), { target: { value: "18" } });
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("link", { name: "Campaigns" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("before leaving");
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload); expect(unload.defaultPrevented).toBe(true);
    await act(async () => first.resolve());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Campaigns" }));
    expect(navigate).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });

  it("shares accepted saves and the latest draft after the same editor remounts", async () => {
    const first = deferred(); persist.mockImplementationOnce(first.save);
    const old = mount("manual", { strength: 10 });
    const strength = screen.getByRole("spinbutton", { name: "Strength score" });
    fireEvent.change(strength, { target: { value: "16" } });
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    fireEvent.change(strength, { target: { value: "18" } });
    old.unmount();
    mount("manual", { strength: 10 });
    expect(screen.getByRole("spinbutton", { name: "Strength score" })).toHaveValue(18);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Strength score" }), { target: { value: "20" } });
    expect(persist).toHaveBeenCalledTimes(1);
    await act(async () => first.resolve());
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(3));
    expect(persist.mock.calls.map(([id]) => id)).toEqual(["char-1", "char-1", "char-1"]);
    expect(persist.mock.calls[2][2]).toEqual({ method: "manual", scores: { strength: 18 } });
    expect(screen.getByRole("spinbutton", { name: "Strength score" })).toHaveValue(20);
    expect(screen.getByText("Changes save automatically.")).toHaveAttribute("role", "status");
  });

  it("recovers a draft after a cached route hides the editor during a save", async () => {
    const first = deferred(); persist.mockImplementationOnce(first.save);
    const editor = <AbilitiesStepClient ownerId="owner-1" characterId="char-1" character={{ id: "char-1", level: 1, choices: { ability_method: "manual" }, base_stats: { strength: 10 } }} contentRefs={[]} schema={schema as never} />;
    const view = render(<Activity mode="visible">{editor}</Activity>);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Strength score" }), { target: { value: "18" } });
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    view.rerender(<Activity mode="hidden">{editor}</Activity>);
    await act(async () => first.reject(new Error("Failed while hidden")));
    view.rerender(<Activity mode="visible">{editor}</Activity>);
    await screen.findByRole("alert");
    expect(screen.getByRole("spinbutton", { name: "Strength score" })).toHaveValue(18);
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    await waitFor(() => expect(screen.getByText("Changes save automatically.")).toHaveAttribute("role", "status"));
    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist.mock.calls[1]).toEqual(persist.mock.calls[0]);
  });

  it("accepts the original save after the cached editor has resumed without a duplicate", async () => {
    const first = deferred(); persist.mockImplementationOnce(first.save);
    const editor = <AbilitiesStepClient ownerId="owner-1" characterId="char-1" character={{ id: "char-1", level: 1, choices: { ability_method: "manual" }, base_stats: { strength: 10 } }} contentRefs={[]} schema={schema as never} />;
    const view = render(<Activity mode="visible">{editor}</Activity>);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Strength score" }), { target: { value: "18" } });
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    view.rerender(<Activity mode="hidden">{editor}</Activity>);
    view.rerender(<Activity mode="visible">{editor}</Activity>);
    expect(screen.getByRole("button", { name: "Next: Background" })).toBeDisabled();
    await act(async () => first.resolve());
    expect(screen.getByText("Changes save automatically.")).toHaveAttribute("role", "status");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(persist).toHaveBeenCalledTimes(1);
  });

});
