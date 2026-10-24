/** A recovered receipt is historical. A fresh document reads current server
 * values and releases every editor's in-memory draft/queue before editing. */
import { discardAbilityScoreDraft } from "./use-ability-score-draft";

export function reloadBuilderSnapshot(accountId: string, characterId: string): void {
  // The retained ability queue has its own unload warning. Confirmation
  // authorizes releasing this target's draft before the document reload.
  discardAbilityScoreDraft(accountId, characterId);
  window.location.reload();
}
