import type { CharacterState } from "@/lib/types/character";

/** Serialize shallow RPC patches and rebuild optimistic state from confirmed
 * writes plus pending changes. A failed write never restores an old whole-page
 * snapshot over a newer change. This is session-local, with no automatic retry. */
export function createStateWriter(
  initialState: CharacterState,
  persist: (patch: Partial<CharacterState>) => Promise<void>,
  onState: (state: CharacterState) => void,
  onFailure: () => void,
) {
  let confirmed = initialState;
  let visible = initialState;
  const pending: Array<Partial<CharacterState>> = [];
  const invalidated = new Set<Partial<CharacterState>>();
  let tail = Promise.resolve();

  const publish = () => {
    visible = Object.assign({}, confirmed, ...pending.filter((change) => !invalidated.has(change)));
    onState(visible);
  };

  const write = (patch: Partial<CharacterState>): Promise<boolean> => {
    const change = { ...patch };
    pending.push(change);
    publish();
    const operation = tail.then(async () => {
      let saved = false;
      try {
        if (invalidated.has(change)) throw new Error("A prior save invalidated this snapshot.");
        await persist(change);
        confirmed = { ...confirmed, ...change };
        saved = true;
      } catch {
        // Full nested maps may embed optimistic edits from this failed write.
        // Their intent cannot be inferred safely: reject, rather than persist it.
        for (const queued of pending) {
          if (queued !== change && Object.keys(change).some((key) =>
            key in queued && typeof change[key] === "object" && typeof queued[key] === "object",
          )) invalidated.add(queued);
        }
        onFailure();
      }
      invalidated.delete(change);
      pending.splice(pending.indexOf(change), 1);
      publish();
      return saved;
    });
    tail = operation.then(() => undefined);
    return operation;
  };

  return Object.assign(write, {
    /** A state-dependent action must start from a settled, current render.
     * Refuse stale/busy commands before computing effects or spending a slot. */
    async runAction<T>(
      expectedState: CharacterState,
      compute: (state: CharacterState) => { patch: Partial<CharacterState>; result: T },
    ): Promise<T> {
      if (pending.length > 0 || expectedState !== visible) {
        throw new Error("The character is still saving or has changed. Please try the action again.");
      }
      const { patch, result } = compute(confirmed);
      if (Object.keys(patch).length > 0 && !(await write(patch))) {
        throw new Error("The character change could not be saved. Please try the action again.");
      }
      return result;
    },
  });
}
