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
  const pending: Array<Partial<CharacterState>> = [];
  let tail = Promise.resolve();

  const publish = () => onState(Object.assign({}, confirmed, ...pending));

  return (patch: Partial<CharacterState>): Promise<boolean> => {
    const change = { ...patch };
    pending.push(change);
    publish();
    const operation = tail.then(async () => {
      let saved = false;
      try {
        await persist(change);
        confirmed = { ...confirmed, ...change };
        saved = true;
      } catch {
        onFailure();
      }
      pending.splice(pending.indexOf(change), 1);
      publish();
      return saved;
    });
    tail = operation.then(() => undefined);
    return operation;
  };
}
