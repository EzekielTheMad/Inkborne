# A1 local ability-score integration

October 11, 2026. Worker branch `codex/core-ability-save-integration`, isolated task-2 worktree `a1-ability-worker`, based on integration `7e1c831`. Root owns integration and the central queue. PR101 source head is `794fd87849b715ee5497599409bc0c0d2f88c1d0`, actual base `6b8601f976d3ee121d11f2ec33c7383393024b91`.

## Result and preserved core behavior

The ability editor uses the reviewed owner-scoped in-memory draft store and ability-only compare-and-swap RPC. Accepted edits serialize against the last canonical response; a failed latest draft stays editable and supports explicit retry. SPA exit/remount shares accepted saves and retained drafts. A stale editor requires reload, and sign-out/account changes discard private drafts and stop queued writes. An already authorized in-flight request may finish after sign-out; hosted acceptance is still needed for that boundary.

The integration retains core shared ability validation/constants, same-window link/unload guard and notice, owner/character keys, input limits, point-buy budget, array assignment/clearing, existing narrative/choice data, and staged equipment/conditional APIs. The new generated function type is additive. A cleared sign-in session disables editing and requests reload while releasing the unsaved navigation warning.

Exact PR sources imported: draft hook, RPC client, SQL, specification, client/SQL tests. The editor/page, core recovery tests and browser fixture contain the reviewed integration adjustments. No package/lockfile changes. The old client writer remains available for its existing callers/tests; it is no longer the ability editor boundary.

The existing migration `20261010232200_save_character_abilities.sql` was copied from PR101 using raw `git show` bytes. Git blob: `2f6c58170ba82fc42f55a22af9e49438df3ffa14`. Canonical LF and current working-file SHA256: `b31702903d0fc8fb1a31b86a5d3c0d54c01e0b69e8c57d4ba9c5a970f725e6c1`. Git's ordinary Windows checkout may convert LF to CRLF later; compare the canonical blob when verifying provenance. No SQL was authored, changed, applied to a Supabase runtime, or added to remote migration history. The central handoff says this migration is already hosted; do not reapply it.

## Review and tests

Root reviewed the integration plan and mixed editor/type diff. The independent M1 worker approved the complete conflict-resolution diff: exact source provenance, retained guards, additive staged types, owner keys and test dispositions; no blocking findings. The Next.js client/server guide, current Supabase changelog/RPC/auth-listener docs, and condensed React checklist were read. Component state/effects remain client-side; SSR draft state does not share a browser recovery map between requests. Existing UI components and accessible score/action labels are retained.

Focused tests passed: 6 files / 84 tests. These include imported draft/RPC/disposable SQL tests, core validation/legacy transport tests, adapted core recovery tests and two new error/conflict same-window guard regressions.

Core abort-on-close expectations were deliberately updated to PR101's retained accepted writes: remount shares the ordered original-character queue, hidden failure retains an exact retry, and a resumed successful request is accepted once without duplicate replay. All input, queue, failure, retry and header/unload guard assertions remain represented.

| Gate | Result and tested scope |
| --- | --- |
| Focused A1 tests | 6 files / 84 passed. |
| Pre-wording `npm.cmd run check` | TypeScript, zero-warning lint and 226 files / 2,292 tests passed; unit phase 58.64 seconds. Includes inherited D1 characterization checks. |
| Pre-wording `npm.cmd run build` | Next.js 16.2.10 optimized build passed with fresh-process synthetic Supabase URL/keys; compile phase 6.9 seconds. |
| Pre-wording offline E2E | 3/3 specs, 43 checks, 29.4 seconds: builder 27, play-save 7, casting/resources 9; zero page errors/remote requests. |
| Post-wording focused tests | 2 files / 37 passed; 4.04 seconds. |
| Post-wording builder E2E | 1/1 spec / 27 real-component checks passed; 20.9 seconds; zero page errors/remote requests. |
| `git diff --check` | Passed. |

The final wording change was root-approved after visual inspection: a declined conflict exit now says “Reload the saved ability scores before editing again. This draft has not been saved.” It does not suggest a retry that the conflict state correctly forbids. Shared guard behavior is unchanged. Root explicitly narrowed the post-wording worker verification and will run final combined full check/build/browser gates against integrated committed source.

Evidence in sibling `verification`: `a1-focused.log`, `a1-build.log`, `a1-offline-ui.log`, `a1-wording-focused.log`, `a1-wording-offline.log`, process inventories and resource/cleanup JSON. The initial complete full-check result was captured in tool output. A prematurely started wording-only full rerun overwrote its log; root released the heavy slot, and only the verified task-owned ESLint PID 10332 was stopped. Its partial output is preserved as `a1-check-wording-interrupted.log` and the prior successful completion is explicitly summarized in `a1-check-preword-summary.log`. Neither is presented as a fresh complete post-wording gate. Root's final integration gate must supply that complete log.

Generated browser evidence/screenshots are preserved in ignored `test-results/{builder-local,play-save-local,casting-resources-local}`. The mobile conflict screenshot was visually inspected; conflict explanation, reload action and disabled competing controls were readable.

The offline builder retains its 24 prior behavior checks, replacing its outdated aborted-save fixture with the real reviewed RPC client, synthetic auth/CAS and SPA remount recovery. Three additional checks cover ordered rapid edits/method switch, mobile stale-CAS conflict with no blind retry/declined link exit, and sign-out clearing without save replay. Persistence and auth are simulated. Imported SQL tests run a synthetic disposable PGlite schema with owner RLS; they do not replay the full Supabase migration chain, production triggers/grants, or independent connections.

## Remaining approval blockers

Real owner/auth/trigger/multi-connection and real browser acceptance need separately approved named accounts/fixtures and cleanup. No hosted E2E, credentials, security changes, production writes, push, remote PR merge or deployment occurred. The domain/provider-auth blockers remain with root; this checkpoint authorizes no release operation.

## Process hygiene

No development server was started. Recorded Next build PID 8152 (parent 3336), Playwright PID 19052 and worker 13036, fixture metadata and command/start/cwd information are retained in process inventories and logs. Task listener ports 62409, 55001, 60772 and temporary build port 52063 closed after the initial run. The post-wording builder fixture used port 65401, which also closed. Fixture `finally` blocks closed the owned browsers/HTTP servers. Final cleanup found zero Node processes referencing this worktree and zero task listeners; no unrelated processes were stopped. Global resource snapshots are contextual because other isolated workers were active.
