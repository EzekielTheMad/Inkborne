import { CharacterStateReloadError } from "@/lib/character/state-save-error";
import type { CharacterState } from "@/lib/types/character";

export interface StateWriteOptions {
  /** Explicit opt-in for a state-only action that must compare its raw baseline. */
  requireCurrent?: boolean;
}

/** Serialize shallow RPC patches and rebuild optimistic state from confirmed
 * writes plus pending changes. A failed write never restores an old whole-page
 * snapshot over a newer change. This is session-local, with no automatic retry. */
export function createStateWriter(
  initialState: CharacterState,
  persist: (patch: Partial<CharacterState>, expectedState?: CharacterState, writeOptions?: StateWriteOptions) => Promise<void | CharacterState>,
  onState: (state: CharacterState) => void,
  onFailure: (error?: unknown) => void,
  options?: { persistedState: CharacterState },
) {
  let confirmed = initialState;
  let persisted = options?.persistedState ?? initialState;
  let reloadError: CharacterStateReloadError | undefined;
  let visible = initialState;
  const pending: Array<Partial<CharacterState>> = [];
  const invalidated = new Set<Partial<CharacterState>>();
  let tail = Promise.resolve();

  const publish = () => {
    visible = Object.assign({}, confirmed, ...pending.filter((change) => !invalidated.has(change)));
    onState(visible);
  };

  const write = (patch: Partial<CharacterState>, writeOptions?: StateWriteOptions): Promise<boolean> => {
    const change = { ...patch };
    pending.push(change);
    publish();
    const operation = tail.then(async () => {
      let saved = false;
      try {
        if (invalidated.has(change)) throw new Error("A prior save invalidated this snapshot.");
        if (reloadError && (writeOptions?.requireCurrent || "current_hp" in change || "temp_hp" in change)) throw reloadError;
        const savedState = writeOptions
          ? await persist(change, persisted, writeOptions)
          : options ? await persist(change, persisted) : await persist(change);
        persisted = savedState ?? { ...persisted, ...change };
        confirmed = { ...confirmed, ...(savedState ?? change) };
        saved = true;
      } catch (error) {
        if (error instanceof CharacterStateReloadError) reloadError = error;
        // Full nested maps may embed optimistic edits from this failed write.
        // Their intent cannot be inferred safely: reject, rather than persist it.
        for (const queued of pending) {
          if (queued !== change && Object.keys(change).some((key) =>
            key in queued && typeof change[key] === "object" && typeof queued[key] === "object",
          )) invalidated.add(queued);
        }
        onFailure(reloadError ?? error);
      }
      invalidated.delete(change);
      pending.splice(pending.indexOf(change), 1);
      publish();
      return saved;
    });
    tail = operation.then(() => undefined);
    return operation;
  };

  // The same settled-state preflight protects actions that must generate dice
  // synchronously before entering a write. It never queues or publishes a patch.
  const assertActionReady = (expectedState: CharacterState) => {
    if (reloadError) throw reloadError;
    if (pending.length > 0 || expectedState !== visible) {
      throw new Error("The character is still saving or has changed. Please try the action again.");
    }
  };

  return Object.assign(write, {
    hasPendingWrites: () => pending.length > 0,
    assertActionReady,
    /** Explicit complete server read; never replace an in-flight intent. The
     * consumer validates its native revision/mechanical binding first. */
    acceptConfirmedRead(fresh: CharacterState, raw: CharacterState) {
      if (pending.length > 0) throw new Error("Wait for the current character save before accepting a fresh read.");
      confirmed = fresh; persisted = raw; reloadError = undefined;
      publish();
    },
    /** A state-dependent action must start from a settled, current render.
     * Refuse stale/busy commands before computing effects or spending a slot. */
    async runAction<T>(
      expectedState: CharacterState,
      compute: (state: CharacterState) => { patch: Partial<CharacterState>; result: T },
      writeOptions?: StateWriteOptions,
    ): Promise<T> {
      assertActionReady(expectedState);
      const { patch, result } = compute(confirmed);
      if (Object.keys(patch).length > 0 && !(await write(patch, writeOptions))) {
        if (reloadError) throw reloadError;
        throw new Error("The character change could not be saved. Please try the action again.");
      }
      return result;
    },
  });
}
