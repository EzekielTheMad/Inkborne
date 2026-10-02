# Consolidation and acceptance-readiness handoff

October 2, 2026, around 18:55 UTC. Source `d16f63fed30db28a1a9ddd43b9e4f5d1411331e7`.
Branch `codex/playable-core-stability`; began this pass at clean `4e7ae96d77e2288a84cc73cdea2a7ac210c42d23`.
**Not release-ready.** [CURRENT-STATE](../CURRENT-STATE.md) and the single
[release checklist](../RELEASE-READINESS.md) are authoritative; older milestone notes are historical.

## Review scope and concrete repairs

Reviewed the full branch runtime diff, test contracts and documentation inventory against local main
`26e1f514693190e4afb2dc708ac97fb04a0f5814` (also merge base). At review start the diff covered 111 files;
main had no commits absent from this branch. No remote fetch/main verification, worktree merge or
other-worktree edit occurred. This was a manual source review, not an independent agent audit.

The ability writer and play-state writer deliberately have different semantics: ordered complete
drafts with explicit retry versus optimistic shallow patches rebased over confirmed writes with
dependent nested snapshots rejected. Combining them would obscure recovery contracts. Overview and
navigation already share step-status and ability validation. Class/race pin resolvers handle different
ownership/feature sources; no broad resolver framework or speculative extraction was introduced.
The existing useDialogAction gate is reused for the one newly found UI contract repair.

1. Active-effect wrappers previously discarded the writer's false result; the editor closed before
   awaiting any persistence. A rejected custom effect therefore lost its input draft despite a global
   error. Wrappers now return boolean confirmation; the editor remains open/pending, locks duplicate
   submission/dismissal, retains the failed name/modifier/duration and closes after a confirmed retry.
   The real provider/UI regression exercises deferred rejection and exactly two writes with one final
   added effect. Known-spell false-result handling is covered separately. The mobile browser test hides
   Activity while pending, rejects, goes Back, verifies retained editable values and retries once.
2. Overview/navigation previously advertised Complete despite intentionally partial readiness checks;
   the label is now Saved, visibly shown in overview, with a class-choice/equipment review instruction.
   Orphaned class/subclass, race/subrace and background pins now produce In progress even without the
   corresponding choice. Shared helper behavior is tested through both actual overview and navigation.
3. Corrected the state-patch comment: shallow JSON merge preserves unrelated top-level keys but does
   not protect concurrent replacements of nested maps. No mutation implementation/schema changed.

Regressions reproduced before fixes (effect editor disappeared; readiness labels/orphan state differed).
A JSX wrapper compile error during editing was corrected before final checks. Final source review checked
boolean propagation, gate reuse, retained completion, native disabled controls, and absence of automatic
replay. No new persistence framework, hosted behavior or roll/copy/product policy was added.

## Final local evidence

| Command | Result |
| --- | --- |
| Focused provider/effect UI/builder journey tests | 3 files / 59 tests passed |
| `npm.cmd run check` | Types, zero-warning lint; 203 files / 1,972 tests passed |
| `npm.cmd run lint` after browser-script/comment edits | Passed |
| `npm.cmd run build` | Next 16.2.10 compile/types and 24 static pages passed |
| `node scripts/verify-builder-local.mjs` after fresh build | 20 checks passed |
| `node scripts/verify-play-save-local.mjs` after fresh build | 6 checks passed |
| `git diff --check` | Passed |

Browser artifacts: `test-results/builder-local/`, `test-results/play-save-local/`, including
`effect-recovery-mobile.png`. Both fixtures report no page errors/remote request attempts; screenshot
inspection confirmed the failed effect values and instruction remained visible on mobile.
Temp logs: `inkborne-consolidation-before.txt` (red evidence), `inkborne-consolidation-focused.txt`,
`inkborne-consolidation-check.txt`, `inkborne-consolidation-final-lint.txt`,
`inkborne-consolidation-build.txt`, `inkborne-consolidation-builder.txt`, `inkborne-consolidation-play.txt`.
Only existing dependencies/installed Chrome were used. Build Supabase public values were loopback
placeholders. No secrets/environment files, installs or hosted tests/writes were used.

## Remaining blockers and next boundary

Meaningful local-only work remains: per-level/ASI/category validation, category-choice UI and explicit
missing/retired/orphan reference recovery. No additional critical local data-loss regression remained
known after this bounded review; this does not mean full local readiness. Class/race/style multi-write
choices/pins, equipment partial grants, two-client conflicts and ambiguous completion remain durable
backend acceptance risks. Creation response loss also lacks a deduplication receipt; character-scoped
action receipts do not by themselves solve creation idempotency. Legacy HP/grant/copy policies need Victor.

Read-only migration inspection found state RPC acceptance questions: 00031 returns void and does not
prove affected rows; 00041 sets empty search_path while that earlier SQL body names unqualified
characters. Later local migrations do not redefine it. PostgreSQL documents that string-form SQL function bodies
are parsed at execution time ([CREATE FUNCTION](https://www.postgresql.org/docs/16/sql-createfunction.html));
this supports checking name resolution in a fresh connection. Verify effective deployed definition and fresh
migration replay before claiming backend behavior; no live query or SQL repair was authorized here.
The proposals now list exact minimum schema/caller/permission scope and disposable hosted scenarios
requiring approval. No migration/schema, credential/security change, push, merge or deployment occurred.

Documentation was consolidated without deleting records: CURRENT-STATE is a compact index, one checklist
owns release gates, this handoff owns pass-specific evidence, older October 2 handoffs/plans are labeled
historical, and the two durable proposals remain active design-only approval documents.

Documentation checks preserved the semantic content of all 40 historical/design records (some legacy
records had mixed encodings) and resolved all 11 current relative links. No historic record was deleted.
