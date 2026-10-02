import { Activity } from "react";
import Link from "next/link";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AbilitiesStepClient } from "@/app/(app)/characters/[id]/builder/abilities/abilities-step-client";
import { saveCharacterAbilityScores } from "@/lib/supabase/character-client";

vi.mock("@/lib/supabase/character-client", () => ({ saveCharacterAbilityScores: vi.fn(), updateCharacter: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/builder/stat-preview", () => ({ StatPreview: () => null }));

const schema = { ability_scores: [
  { slug: "strength", name: "Strength", abbr: "STR" },
  { slug: "dexterity", name: "Dexterity", abbr: "DEX" },
] };
function mount(method: "standard_array" | "manual" | "point_buy" = "standard_array", scores: Record<string, number> = {}) {
  return render(<AbilitiesStepClient characterId="char-1" character={{
    id: "char-1", level: 1, choices: { ability_method: method, race: "human" }, base_stats: scores,
  }} contentRefs={[]} schema={schema as never} />);
}
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const persist = vi.mocked(saveCharacterAbilityScores);

describe("ability-score save recovery", () => {
  beforeEach(() => { vi.resetAllMocks(); persist.mockResolvedValue(undefined); });

  it("serializes rapid assignments and keeps later edits when an earlier save fails", async () => {
    const first = deferred(); const second = deferred();
    persist.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
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
    expect(persist).toHaveBeenLastCalledWith("char-1", "standard_array", { strength: 15, dexterity: 14 }, expect.any(AbortSignal));
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
    expect(persist).toHaveBeenLastCalledWith("char-1", "manual", { strength: 18, dexterity: 10 }, expect.any(AbortSignal));
  });

  it("saves method changes immediately and orders them after pending edits", async () => {
    const first = deferred(); persist.mockReturnValueOnce(first.promise);
    mount();
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "15" } });
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Point Buy" }));
    expect(persist).toHaveBeenCalledTimes(1);
    await act(async () => first.resolve());
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(2));
    expect(persist).toHaveBeenLastCalledWith("char-1", "point_buy", { strength: 8, dexterity: 8 }, expect.any(AbortSignal));
  });

  it("persists clearing an array assignment as a partial draft", async () => {
    mount("standard_array", { strength: 15 });
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "" } });
    await waitFor(() => expect(persist).toHaveBeenCalledWith("char-1", "standard_array", {}, expect.any(AbortSignal)));
    expect(screen.getAllByRole("combobox")[0]).toHaveValue("");
  });

  it("retains the newest rapid edit when its save fails and retries that value", async () => {
    const first = deferred();
    persist.mockReturnValueOnce(first.promise).mockRejectedValueOnce(new Error("offline"));
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
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Ability scores saved."));
    expect(persist).toHaveBeenLastCalledWith("char-1", "manual", { strength: 18, dexterity: 10 }, expect.any(AbortSignal));
  });

  it("accumulates point-buy increments before the previous request settles", async () => {
    const first = deferred(); persist.mockReturnValueOnce(first.promise);
    mount("point_buy", { strength: 8, dexterity: 8 });
    act(() => {
      fireEvent.click(screen.getAllByRole("button", { name: "+" })[0]);
      fireEvent.click(screen.getAllByRole("button", { name: "+" })[0]);
    });
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    await act(async () => first.resolve());
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(2));
    expect(persist).toHaveBeenLastCalledWith("char-1", "point_buy", { strength: 10, dexterity: 8 }, expect.any(AbortSignal));
  });

  it("keeps manual score limits and point-buy lower bounds", () => {
    const mounted = mount("manual", { strength: 10, dexterity: 10 });
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "31" } });
    expect(persist).not.toHaveBeenCalled();
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(10);
    mounted.unmount();
    mount("point_buy", { strength: 8, dexterity: 8 });
    expect(screen.getAllByRole("button", { name: "-" })[0]).toBeDisabled();
  });

  it("does not present existing scores as assigned array values before a method was chosen", () => {
    render(<AbilitiesStepClient characterId="char-1" character={{
      id: "char-1", level: 1, choices: {}, base_stats: { strength: 10, dexterity: 10 },
    }} contentRefs={[]} schema={schema as never} />);
    expect(screen.getByRole("combobox", { name: "Strength score" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Standard Array" })).toHaveAttribute("aria-pressed", "true");
    expect(persist).not.toHaveBeenCalled();
  });
  it("blocks header links and unload until the pending draft is confirmed", async () => {
    const first = deferred(); persist.mockReturnValueOnce(first.promise);
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

  it("drops unsent drafts when an editor closes and ignores its stale completion", async () => {
    const first = deferred(); persist.mockReturnValueOnce(first.promise);
    const old = mount("manual", { strength: 10 });
    const strength = screen.getByRole("spinbutton", { name: "Strength score" });
    fireEvent.change(strength, { target: { value: "16" } });
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    fireEvent.change(strength, { target: { value: "18" } });
    const oldSignal = persist.mock.calls[0][3];
    old.unmount(); expect(oldSignal?.aborted).toBe(true);
    mount("manual", { strength: 10 });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Strength score" }), { target: { value: "20" } });
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(2));
    await act(async () => first.resolve());
    expect(persist).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("spinbutton", { name: "Strength score" })).toHaveValue(20);
    expect(screen.getByRole("status")).toHaveTextContent("Ability scores saved.");
  });

  it("recovers a draft after a cached route hides the editor during a save", async () => {
    const first = deferred(); persist.mockReturnValueOnce(first.promise);
    const editor = <AbilitiesStepClient characterId="char-1" character={{ id: "char-1", level: 1, choices: { ability_method: "manual" }, base_stats: { strength: 10 } }} contentRefs={[]} schema={schema as never} />;
    const view = render(<Activity mode="visible">{editor}</Activity>);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Strength score" }), { target: { value: "18" } });
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    view.rerender(<Activity mode="hidden">{editor}</Activity>);
    expect(persist.mock.calls[0][3]?.aborted).toBe(true);
    await act(async () => first.resolve());
    view.rerender(<Activity mode="visible">{editor}</Activity>);
    await screen.findByRole("alert");
    expect(screen.getByRole("spinbutton", { name: "Strength score" })).toHaveValue(18);
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Ability scores saved."));
    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist.mock.calls[1][3]?.aborted).toBe(false);
  });

  it("ignores the previous session response after the cached editor has resumed", async () => {
    const first = deferred(); persist.mockReturnValueOnce(first.promise);
    const editor = <AbilitiesStepClient characterId="char-1" character={{ id: "char-1", level: 1, choices: { ability_method: "manual" }, base_stats: { strength: 10 } }} contentRefs={[]} schema={schema as never} />;
    const view = render(<Activity mode="visible">{editor}</Activity>);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Strength score" }), { target: { value: "18" } });
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    view.rerender(<Activity mode="hidden">{editor}</Activity>);
    view.rerender(<Activity mode="visible">{editor}</Activity>);
    await screen.findByRole("alert");
    await act(async () => first.resolve());
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved ability scores.");
    expect(persist).toHaveBeenCalledTimes(1);
  });

});
