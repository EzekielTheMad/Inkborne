# Relative HP and retained dialog recovery

Local continuation from `29c92f1`, 2026-10-02. No hosted operations or schema changes.

## Reproduced and repaired

The real CharacterProvider, HPTracker and RestDialog regression starts at 10/20 HP, sends damage 5 to delayed mocked persistence, opens Rest and spends a hit die. Before the repair, the hit die rolls against optimistic HP 5. The repair rejects this action before rolling/logging/spending. Failed damage restores HP 10; explicit hit-die retry with deterministic healing 3 saves HP 13 and one spent die.

Hit-die actions now use the existing state writer's settled/current-render gate. Short and long rests use the same gate and preserve their boolean failure contract. Desktop and mobile HP trackers receive a guarded damage/heal action save from SheetPanel; absolute temp HP and raw absolute patchState writes retain the original writer path. A pending or stale HP action fails visibly and retains the input for explicit retry. A focused three-case UI regression checks damage/heal conflict recovery and confirms that Set Temp HP uses the independent absolute save. No generic numeric arithmetic or scalar invalidation is added. Absolute edits can still queue independently, as verified by both writer coverage and provider rest regressions.

useDialogAction now retains a settled completion while React Activity disconnects effects, then delivers it once when the same mounted session resumes. Cast outcomes, rest close callbacks and explicit errors survive Back. In-flight work stays pending when revealed before settlement. Closed/reopened dialogs retain their existing mounted-session/key isolation. Persistence is neither cancelled nor automatically retried. Generation checks protect completion delivery; a destroyed session has no resumed effect to deliver its result.

## Evidence so far

- New regressions failed before repair: pending hit-die rolled; hidden-settlement cast/rest did not reconcile on reveal.
- Final blocker checkpoint `npm.cmd run check`: strict types, zero-warning lint, 203 files / 1,897 tests passed.
- Targeted provider follow-up: 21 tests passed, including both new rest cases.
- Actual React Activity tests cover hide/settle/reveal and hide/reveal/late-settle for cast/rest, hidden cast failure/retry and hit-die failure/dismissal. These are retained routes, not only open=false session destruction.

- `npm.cmd run build`: Next 16.2.10 compile, TypeScript and 24 static pages passed with loopback-only Supabase placeholders. No credentials were read.
- `node scripts/verify-play-save-local.mjs`: five installed-Chrome fixture checks passed: exact damage/hit-die recovery, both cast Activity settlement orders, rest close on Back and mobile hit-die failure recovery. All requests stayed on its random loopback server; no page errors. Evidence is under `test-results/play-save-local/`; the mobile recovery screenshot was visually inspected. Actual components/provider, simulated persistence/history; no running Next/auth/backend acceptance.

## Limits

These guards are local session conflict rejection, not cross-client concurrency or ambiguous-response reconciliation. An accepted hit-die roll still enters the existing roll log before its state save confirms; a failed save is explicit and does not spend the die, but roll-history persistence is separate. Raw low-level patchState callers must distinguish absolute edits from relative domain actions. Equipment atomicity remains deferred to the separately documented durable server transaction/ledger design. No deployment readiness claim follows from local mocked tests.
