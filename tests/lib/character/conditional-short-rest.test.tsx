import { Activity, useEffect, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterProvider, useCharacterState, useRest } from "@/lib/character/character-context";
import { RestDialog } from "@/components/sheet/rest-dialog";
import type { CharacterState } from "@/lib/types/character";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));
vi.mock("@/lib/supabase/inventory", () => ({ addInventoryItem: vi.fn(), updateInventoryItem: vi.fn(), removeInventoryItem: vi.fn(), unequipAllArmor: vi.fn() }));
vi.mock("@/lib/supabase/spells", () => ({ addCharacterSpell: vi.fn(), updateCharacterSpell: vi.fn(), removeCharacterSpell: vi.fn() }));
vi.mock("@/lib/supabase/rolls", () => ({ insertRoll: vi.fn() }));

const schema = { ability_scores: [], proficiency_levels: [], derived_stats: [], skills: [], resources: [], content_types: [], currencies: [], creation_steps: [], sheet_sections: [] };
const refs = [
  { content_definitions: { id: "ar", slug: "arcane-recovery", name: "Arcane Recovery", content_type: "feature", data: { class: "wizard", level: 1, usages: 1, recovery: "long rest" }, effects: [] } },
  { content_definitions: { id: "wind", slug: "second-wind", name: "Second Wind", content_type: "feature", data: { class: "fighter", level: 1, usages: 1, recovery: "short rest" }, effects: [] } },
];
type Handles = { rest: ReturnType<typeof useRest>; saves: ReturnType<typeof useCharacterState> };
let handles: Record<string, Handles>;
let stored: CharacterState;
function persist(name: string, args: { expected_state?: CharacterState; state_patch: Partial<CharacterState> }) {
  if (name === "patch_character_state_if_current") {
    if (JSON.stringify(args.expected_state) !== JSON.stringify(stored)) {
      return { error: null, data: [{ status: "conflict", resulting_state: structuredClone(stored) }] };
    }
    stored = { ...stored, ...args.state_patch };
    return { error: null, data: [{ status: "applied", resulting_state: structuredClone(stored) }] };
  }
  expect(name).toBe("patch_character_state");
  stored = { ...stored, ...args.state_patch };
  return { error: null };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => { resolve = yes; });
  return { promise, resolve };
}
function Probe({ label, dialog }: { label: string; dialog: boolean }) {
  const rest = useRest();
  const saves = useCharacterState();
  const [open, setOpen] = useState(dialog);
  useEffect(() => { handles[label] = { rest, saves }; }, [label, rest, saves]);
  return <><output aria-label={`${label} state`}>{JSON.stringify(saves.state)}</output>{open && <RestDialog open onClose={() => setOpen(false)} />}</>;
}
function Fixture({ raw, label = "sheet", dialog = false }: { raw: CharacterState; label?: string; dialog?: boolean }) {
  return <CharacterProvider
    character={{ id: "local-character", state: raw, choices: { classes: [{ slug: "wizard", level: 3 }, { slug: "fighter", level: 1 }] }, base_stats: {}, narrative: {} } as never}
    schema={schema as never} contentRefs={refs as never}
    initialState={{ ...raw, temp_hp: 0 }} initialInventory={[]} initialSpells={[]}
    classData={{ wizard: { slug: "wizard", data: { hit_die: 6, spellcasting: { type: "full", ability: "intelligence" } } }, fighter: { slug: "fighter", data: { hit_die: 10 } } } as never}
    allEffects={[]} baseStatsWithLevel={{ level: 4, constitution: 10, intelligence: 10 }} structuredSources={{}}
    isOwner isDm={false} hasSheet maxHp={20} primaryColor={null} onPrimaryColorChange={() => {}}
  ><Probe label={label} dialog={dialog} /></CharacterProvider>;
}

beforeEach(() => {
  handles = {};
  rpc.mockReset().mockImplementation(async (name, args) => persist(name, args));
});

describe("actual provider conditional short-rest recovery", () => {
  it("guards full-HP pact/resource recovery without an HP patch or display defaults", async () => {
    const raw = { current_hp: 20, spell_slots_used: { pact: 1, "1": 2 }, feature_uses: { "second-wind": 1, other: 2 }, quick_notes: "keep" };
    stored = structuredClone(raw);
    render(<Fixture raw={raw} />);
    await act(async () => { expect(await handles.sheet.rest.shortRest()).toBe(true); });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("patch_character_state_if_current", {
      character_id: "local-character", expected_state: raw,
      state_patch: { spell_slots_used: { pact: 0, "1": 2 }, feature_uses: { "second-wind": 0, other: 2 } },
    });
    expect(stored).toEqual({ ...raw, spell_slots_used: { pact: 0, "1": 2 }, feature_uses: { "second-wind": 0, other: 2 } });
    expect(handles.sheet.saves.state).toMatchObject({ ...stored, temp_hp: 0 });
  });

  it("combines actual dialog Arcane Recovery picks and short-rest resets in one conditional save", async () => {
    const raw = { current_hp: 20, spell_slots_used: { pact: 1, "1": 2 }, feature_uses: { "second-wind": 1 } };
    stored = structuredClone(raw);
    render(<Fixture raw={raw} dialog />);
    fireEvent.click(screen.getByRole("button", { name: "Recover one more 1st-level slot" }));
    fireEvent.click(screen.getByRole("button", { name: "Recover one more 1st-level slot" }));
    fireEvent.click(screen.getByRole("button", { name: "Take Short Rest" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(rpc).toHaveBeenCalledExactlyOnceWith("patch_character_state_if_current", {
      character_id: "local-character", expected_state: raw,
      state_patch: { spell_slots_used: { pact: 0, "1": 0 }, feature_uses: { "second-wind": 0, "arcane-recovery": 1 } },
    });
  });

  it("gates pending and stale callbacks before pick validation, then uses the confirmed notes baseline", async () => {
    const raw = { current_hp: 20, spell_slots_used: { pact: 1 }, quick_notes: "old" };
    stored = structuredClone(raw);
    const hold = deferred();
    rpc.mockImplementationOnce(async (name, args) => { await hold.promise; return persist(name, args); });
    render(<Fixture raw={raw} />);
    const stale = handles.sheet.rest.shortRest;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let notes!: Promise<boolean>;
    await act(async () => { notes = handles.sheet.saves.patchState({ quick_notes: "new" }); });
    await act(async () => { expect(await handles.sheet.rest.shortRest({ "1": 999 })).toBe(false); });
    expect(warn).not.toHaveBeenCalled(); expect(rpc).toHaveBeenCalledTimes(1);
    await act(async () => { hold.resolve(); expect(await notes).toBe(true); });
    await act(async () => { expect(await stale()).toBe(false); });
    expect(rpc).toHaveBeenCalledTimes(1);
    await act(async () => { expect(await handles.sheet.rest.shortRest()).toBe(true); });
    expect(rpc).toHaveBeenLastCalledWith("patch_character_state_if_current", expect.objectContaining({ expected_state: { ...raw, quick_notes: "new" } }));
    warn.mockRestore();
  });

  it("does not persist or report success for a no-op rest", async () => {
    stored = { current_hp: 20 };
    render(<Fixture raw={stored} />);
    await act(async () => { expect(await handles.sheet.rest.shortRest()).toBe(false); });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects the second independent provider recovery and never replays it", async () => {
    const raw = { current_hp: 20, spell_slots_used: { "1": 2 } };
    stored = structuredClone(raw);
    const firstHold = deferred(); const secondHold = deferred();
    rpc.mockImplementationOnce(async (name, args) => { await firstHold.promise; return persist(name, args); });
    rpc.mockImplementationOnce(async (name, args) => { await secondHold.promise; return persist(name, args); });
    render(<><Fixture raw={raw} label="a" /><Fixture raw={raw} label="b" /></>);
    let first!: Promise<boolean>; let second!: Promise<unknown>;
    await act(async () => {
      first = handles.a.rest.shortRest({ "1": 1 });
      second = handles.b.rest.shortRest({ "1": 2 }).catch(error => error);
    });
    await act(async () => { firstHold.resolve(); expect(await first).toBe(true); });
    await act(async () => { secondHold.resolve(); expect(await second).toMatchObject({ requiresReload: true }); });
    expect(stored).toEqual({ ...raw, spell_slots_used: { "1": 1 }, feature_uses: { "arcane-recovery": 1 } });
    expect(handles.b.saves.state).toMatchObject({ spell_slots_used: { "1": 2 } });
    expect(handles.b.saves.state.feature_uses).toBeUndefined();
    await act(async () => { await expect(handles.b.rest.shortRest({ "1": 2 })).rejects.toThrow("Reload before choosing a new action"); });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Reload character" })).toBeEnabled();
  });

  it.each(["conflict", "uncertain"])("keeps independent queued notes after %s and drains them before reload", async (outcome) => {
    const raw = { current_hp: 20, spell_slots_used: { pact: 1 }, quick_notes: "old" };
    stored = structuredClone(raw);
    const restHold = deferred(); const notesHold = deferred();
    rpc.mockImplementationOnce(async () => {
      await restHold.promise;
      if (outcome === "uncertain") return { error: { message: "response lost" }, data: null };
      stored = { ...stored, current_hp: 19 };
      return { error: null, data: [{ status: "conflict", resulting_state: stored }] };
    });
    rpc.mockImplementationOnce(async (name, args) => { await notesHold.promise; return persist(name, args); });
    render(<Fixture raw={raw} />);
    let rest!: Promise<unknown>; let notes!: Promise<boolean>;
    await act(async () => { rest = handles.sheet.rest.shortRest().catch(error => error); });
    await act(async () => { notes = handles.sheet.saves.patchState({ quick_notes: "new" }); });
    await act(async () => { restHold.resolve(); expect(await rest).toMatchObject({ requiresReload: true }); });
    expect(screen.getByRole("button", { name: "Reload character" })).toBeDisabled();
    await act(async () => { notesHold.resolve(); expect(await notes).toBe(true); });
    expect(screen.getByRole("button", { name: "Reload character" })).toBeEnabled();
    expect(handles.sheet.saves.state).toMatchObject({ spell_slots_used: { pact: 1 }, quick_notes: "new" });
    expect(stored).toMatchObject({ spell_slots_used: { pact: 1 }, quick_notes: "new" });
    expect(rpc.mock.calls[1]).toEqual(["patch_character_state", { character_id: "local-character", state_patch: { quick_notes: "new" } }]);
    await act(async () => { await expect(handles.sheet.rest.shortRest()).rejects.toMatchObject({ requiresReload: true }); });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it.each(["success", "conflict", "uncertain"])("reconciles actual short-rest dialog %s after hide, settle, and Back", async outcome => {
    const raw = { current_hp: 20, spell_slots_used: { pact: 1, "1": 2 } };
    stored = structuredClone(raw);
    const hold = deferred();
    rpc.mockImplementationOnce(async (name, args) => {
      await hold.promise;
      if (outcome === "uncertain") return { error: { message: "response lost" }, data: null };
      if (outcome === "conflict") stored = { ...stored, quick_notes: "other tab" };
      return persist(name, args);
    });
    const fixture = <Fixture raw={raw} dialog />;
    const view = render(<Activity mode="visible">{fixture}</Activity>);
    fireEvent.click(screen.getByRole("button", { name: "Recover one more 1st-level slot" }));
    fireEvent.click(screen.getByRole("button", { name: "Take Short Rest" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    view.rerender(<Activity mode="hidden">{fixture}</Activity>);
    await act(async () => { hold.resolve(); });
    view.rerender(<Activity mode="visible">{fixture}</Activity>);
    if (outcome === "success") {
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(stored.spell_slots_used).toEqual({ pact: 0, "1": 1 });
      expect(stored.feature_uses).toEqual({ "arcane-recovery": 1 });
    } else {
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent(outcome === "conflict" ? "Reload before choosing a new action" : "The character save could not be confirmed");
      expect(dialog).not.toHaveTextContent("Please try again");
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByLabelText("1 1st-level slot selected")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Take Short Rest" }));
      await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
      expect(stored).toMatchObject({ spell_slots_used: raw.spell_slots_used });
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.getByRole("button", { name: "Reload character" })).toBeEnabled();
    }
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

