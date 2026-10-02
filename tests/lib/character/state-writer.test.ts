import { describe, expect, it, vi } from "vitest";
import { createStateWriter } from "@/lib/character/state-writer";
import type { CharacterState } from "@/lib/types/character";
import type { ActiveEffect } from "@/lib/types/active-effects";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("character state saves", () => {
  it("rejects a queued full slot map that may contain a failed optimistic spend", async () => {
    const first = deferred();
    const persist = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    let state = { spell_slots_used: { "1": 0 } } as CharacterState;
    const save = createStateWriter(state, persist, (next) => { state = next; }, vi.fn());
    const failedCast = save({ spell_slots_used: { "1": 1 } });
    const dependentCast = save({ spell_slots_used: { "1": 2 } });
    await Promise.resolve();
    first.reject(new Error("offline"));
    expect(await failedCast).toBe(false);
    expect(await dependentCast).toBe(false);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(state.spell_slots_used).toEqual({ "1": 0 });
    expect(await save({ spell_slots_used: { "1": 1 } })).toBe(true);
    expect(state.spell_slots_used).toEqual({ "1": 1 });
  });

  it("keeps disjoint successful maps when another map save fails", async () => {
    const persist = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    let state = { spell_slots_used: { "1": 0 }, feature_uses: {} } as CharacterState;
    const save = createStateWriter(state, persist, (next) => { state = next; }, vi.fn());
    const failed = save({ spell_slots_used: { "1": 1 } });
    const independent = save({ feature_uses: { rage: 1 } });
    expect(await failed).toBe(false);
    expect(await independent).toBe(true);
    expect(state).toMatchObject({ spell_slots_used: { "1": 0 }, feature_uses: { rage: 1 } });
  });

  it("does not carry failed effect snapshots forward in a queued effect list", async () => {
    const persist = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    let state = { active_effects: [] } as CharacterState;
    const save = createStateWriter(state, persist, (next) => { state = next; }, vi.fn());
    const effect: ActiveEffect = {
      id: "failed", name: "Failed effect", slug: "custom", source: "custom",
      content_id: null, effects: [], duration: { type: "special" },
      concentration: false, applied_at: "2026-10-02T13:00:00Z", expires_at: null,
    };
    const failed = save({ active_effects: [effect] });
    const dependent = save({ active_effects: [effect, { ...effect, id: "new" }] });
    expect(await failed).toBe(false);
    expect(await dependent).toBe(false);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(state.active_effects).toEqual([]);
  });
  it("serializes writes and preserves a newer edit when an earlier save fails", async () => {
    const first = deferred();
    const persist = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    let state = { current_hp: 10, inspiration: false } as CharacterState;
    const failure = vi.fn();
    const save = createStateWriter(state, persist, (next) => { state = next; }, failure);
    const oldSave = save({ current_hp: 7 });
    const newSave = save({ current_hp: 8, inspiration: true });
    await Promise.resolve();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(state.current_hp).toBe(8);
    first.reject(new Error("network"));
    expect(await oldSave).toBe(false);
    expect(state.current_hp).toBe(8);
    expect(await newSave).toBe(true);
    expect(state).toMatchObject({ current_hp: 8, inspiration: true });
    expect(failure).toHaveBeenCalledOnce();
  });

  it("restores failed keys without losing successful changes and allows another attempt", async () => {
    const persist = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("denied")).mockResolvedValue(undefined);
    let state = { current_hp: 10, inspiration: false } as CharacterState;
    const save = createStateWriter(state, persist, (next) => { state = next; }, vi.fn());
    const successful = save({ inspiration: true, current_hp: 7 });
    const failed = save({ current_hp: 4 });
    expect(await successful).toBe(true);
    expect(await failed).toBe(false);
    expect(state).toMatchObject({ current_hp: 7, inspiration: true });
    expect(await save({ current_hp: 4 })).toBe(true);
    expect(state).toMatchObject({ current_hp: 4, inspiration: true });
  });

  it("restores the confirmed nested slot map when a cast patch fails", async () => {
    let state = { spell_slots_used: { "1": 1 }, concentrating_on: null } as CharacterState;
    const save = createStateWriter(state, vi.fn().mockRejectedValue(new Error("denied")), (next) => { state = next; }, vi.fn());
    expect(await save({ spell_slots_used: { "1": 2 } })).toBe(false);
    expect(state.spell_slots_used).toEqual({ "1": 1 });
  });
});
