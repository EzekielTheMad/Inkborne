export type AbilityMethod = "standard_array" | "point_buy" | "manual";
export interface AbilityDraft {
  method: AbilityMethod;
  scores: Record<string, number>;
}
export type AbilitySaveStatus = "idle" | "saving" | "saved" | "error";

/** Ordered full drafts: a later draft intentionally includes all local edits.
 * Failure retains the latest draft for explicit retry, never an old rollback.
 * Scoped to this editor session; not an offline outbox or cross-tab lock. */
export function createAbilityScoreWriter(
  initial: AbilityDraft,
  persist: (draft: AbilityDraft) => Promise<void>,
  onDraft: (draft: AbilityDraft) => void,
  onStatus: (status: AbilitySaveStatus) => void,
) {
  let latest = initial;
  let tail = Promise.resolve();
  let status: AbilitySaveStatus = "idle";
  const report = (next: AbilitySaveStatus) => { status = next; onStatus(next); };
  const enqueue = (draft: AbilityDraft) => {
    report("saving");
    const operation = tail.then(async () => {
      let saved = false;
      try {
        await persist(draft);
        saved = true;
      } catch {
        // The visible draft remains available even if the response was lost.
      }
      if (latest === draft) report(saved ? "saved" : "error");
    });
    tail = operation;
  };
  return {
    edit(update: (draft: AbilityDraft) => AbilityDraft) {
      const next = update(latest);
      if (next === latest) return;
      latest = { method: next.method, scores: { ...next.scores } };
      onDraft(latest);
      enqueue(latest);
    },
    retry() { if (status === "error") enqueue(latest); },
  };
}
