# Class save conflicts and background pin identity

## Reproductions and repairs

A deferred canonical class-level save left competing ASI buttons enabled. Those actions can write overlapping complete choices snapshots. ClassStepClient now owns a synchronous save ref for all nine mutation handlers, with an accessible saving message and disabled fieldset for ordinary controls. The gate stays busy through the entire choice/reference sequence, not just the first character write. Portal callbacks also check the ref: a busy ASI rejects with a readable error; other blocked handlers leave a visible retry instruction. Finally clears pending on both success and failure. Existing canonical choices and error rollback behavior are retained; this is same-session conflict rejection, not concurrency control across clients.

The background page used the first background reference regardless of the saved selected slug. New regressions demonstrated wrong display when an unrelated ref came first, displaying another background after the selected pin was missing, and arbitrarily choosing between duplicate snapshots. It now matches type, selected slug and content identity, respects an explicitly saved selection override only when its slug matches, and identifies missing/duplicate snapshots. Conflicting snapshot editing and preview portals are disabled. No catalog upgrade or automatic reference repair is performed.

## Evidence

- Before repair: one class pending-control regression and three background identity regressions failed.
- Targeted class/choice/background suites: 28 tests passed, including portal callback refusal and successful gate release after a delayed canonical save.
- `npm.cmd run check`: strict types, zero-warning lint, 203 files / 1,906 tests passed. Build/browser evidence will be refreshed after final scoped verification.

## Remaining boundaries

Class choice/pin writes remain separate; partial successful writes cannot be undone by local rollback. A failure explicitly advises reloading because changes may have saved. This gate does not confirm stale props, reconcile tabs, resolve a lost response or provide a durable transaction. Background narrative/subchoice writes can still overlap full choices snapshots; this milestone does not claim to repair that independent workflow. Missing background pins are identified, not recreated; stale extra refs remain for explicit reconciliation. Equipment grants still require the separately proposed durable atomic/idempotent server design and separate authorization before schema or hosted work.
