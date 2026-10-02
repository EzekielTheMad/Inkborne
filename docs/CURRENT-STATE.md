# Inkborne current work

Updated October 2, 2026, around 18:40 UTC. Verified source:
`bd74cda343f31e3480a82ab3bfe063918d419c1a`, branch `codex/playable-core-stability`.
**Not release-ready.** See the [replacement recovery milestone](handoffs/2026-10-02-background-replacement-recovery.md)
for current evidence and the [cutoff handoff](handoffs/2026-10-02-cutoff-checkpoint.md) for prior history.

## Direction and authority

Victor prioritizes character building and the fresh-character-to-play-sheet journey. Keep mechanics
and narrative/worldbuilding integrated. The group uses LegendKeeper; preserve existing
integration/campaign behavior without expanding those surfaces.

Isolated checkout: `C:/Users/kaios/Documents/Codex/2026-10-02/task/inkborne-core`. Supplied main
baseline: `0a4acb93ab5fcda94d8efa13a87568c3315da108`; continuation began at
`29c92f19e994d3a8a9aac028bbf8c69ae5b0eaf5`. Existing worktrees and the separate alpha-readiness
candidate remain untouched. No remote main verification occurred.

Only local scoped edits, safe tests/builds and local commits were authorized. No installs, hosted
Supabase tests/writes, schema/migrations, credentials/security changes, worktree deletion, push,
merge or deployment. The original source cutoff was 17:25 UTC. The parent reauthorized continuation
at 18:25 UTC without a new deadline; this continuation ends at a coherent verified background-recovery
milestone. Product-goal changes require the parent; durable database work requires separate approval.

## Verified local behavior

- **P1/P2 review repairs:** relative HP, hit-die and rest actions reject pending/stale state before
  dependent calculation or spending. The exact failed-damage/hit-die path retries from 10 HP and
  saves 13; independent absolute Temp HP edits remain supported. Retained React Activity
  cast/rest/hit-die sessions deliver settled outcomes once on reveal with generations/error recovery
  preserved. See [HP and Activity recovery](handoffs/2026-10-02-relative-hp-activity.md).
- **Builder saves:** class/background controls share local synchronous gates. Mobile drawers show
  pending/errors and disable portal controls. Custom notes save on blur/Enter, retain failed drafts
  and reconcile hidden completion; explicit clearing saves an empty selection. Replacement keeps
  unconfirmed notes in their editor with retry instructions; its header recovery controls remain
  visible after retained Activity updates. See [replacement recovery](handoffs/2026-10-02-background-replacement-recovery.md).
  Equipment selection
  errors require retry; failed confirmation prevents blind same-session re-grants. These are not
  durable transactions. See [builder gates](handoffs/2026-10-02-builder-save-gates.md), [background
  recovery](handoffs/2026-10-02-background-save-recovery.md), [note
  clearing](handoffs/2026-10-02-background-note-clearing.md), [mobile
  feedback](handoffs/2026-10-02-mobile-class-save-feedback.md) and [equipment
  controls](handoffs/2026-10-02-equipment-save-controls.md).
- **Saved definitions:** class/subclass, level features, selected styles and race traits honor
  unique existing pins, including retired catalog entries. Duplicate/incompatible pins block
  editing; background display matches selected identity. Selected style/subclass re-clicks are
  inert. Style replacement is feature-scoped; ambiguous/shared legacy ownership is retained. See
  [class pins](handoffs/2026-10-02-pinned-class-display.md), [race
  traits](handoffs/2026-10-02-pinned-race-traits.md), [style
  references](handoffs/2026-10-02-fighting-style-references.md) and [subclass
  preservation](handoffs/2026-10-02-subclass-pin-preservation.md).
- **Progress/choices:** overview/navigation check unique core saved identity/version/parent
  relationships and explicit-array count, uniqueness and membership. Missing/extra/conflicting core
  pins remain In progress. Invalid explicit picks have a clear/save recovery action. First-level
  class choices remain visible without feature rows; styles require one compatible definition.
  Complete is still narrower than all per-level/category choices or playability. See [reference
  progress](handoffs/2026-10-02-saved-reference-progress.md), [explicit
  choices](handoffs/2026-10-02-explicit-choice-progress.md), [choice
  recovery](handoffs/2026-10-02-invalid-choice-recovery.md) and [class choice
  display](handoffs/2026-10-02-class-choice-display.md).
- **Class HP:** removed a second draft snapshot that concealed failed saves; method switches avoid
  competing Manual blur writes. Manual input rejects blank/fractional/out-of-range values.
  Deterministic Average/Max can confirm without fabricated records. Gain labels match the existing
  sheet minimum while raw values remain unchanged. Rolled-only keeps old Manual values read-only;
  grandfathering/confirmation policy is still open. See [HP
  rollback](handoffs/2026-10-02-class-hp-draft-recovery.md), [Manual
  validation](handoffs/2026-10-02-manual-hp-validation.md), [locked
  confirmation](handoffs/2026-10-02-locked-hp-confirmation.md), [gain
  display](handoffs/2026-10-02-hp-gain-display.md) and [rolled-only
  boundary](handoffs/2026-10-02-rolled-only-field-guard.md).
- Earlier creation/ability/play save recovery remains covered. The [original
  continuation](handoffs/2026-10-02-fast-continuation.md) is historical; see [builder
  journey](handoffs/2026-10-02-builder-journey.md), [ability
  recovery](handoffs/2026-10-02-ability-save-recovery.md) and [history
  review](handoffs/2026-10-02-history-builder-review.md).

## Final verification

Milestone checks completed around 18:40 UTC:

| Command | Result |
| --- | --- |
| `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint` | Strict types, zero-warning lint; 203 files / 1,969 tests passed |
| `npm.cmd run build` | Next 16.2.10 compile, TypeScript and 24 static pages passed |
| `node scripts/verify-builder-local.mjs` | 20 installed-Chrome checks passed with fresh build CSS |
| `node scripts/verify-play-save-local.mjs` | 5 installed-Chrome critical play checks passed |
| `git diff --check` / source status | Passed / clean before documentation consolidation |

Builds use loopback public Supabase placeholders, not production credentials. An early
restricted-network font download failed; authorized build access resolved it. Dependencies were
reused with matching package/lock manifests; no install. Runtime Vitest reported 4.1.10; a fresh
lockfile installation was not verified.

Fixtures bundle real components and React Activity with simulated router/persistence, production CSS
and installed Chrome; remote requests are blocked. Final evidence reports no page errors or remote
attempts. Artifacts: `test-results/builder-local/` and `test-results/play-save-local/`. These are
**simulated local checks**, not live Next/auth/RLS/Supabase acceptance. Hosted Playwright setup
writes to Supabase and was not run. Production availability, privacy/security and release/UAT gates
remain unverified.

## Prioritized next work

1. Extend readiness to required per-level/ASI/category-backed choices; reconcile
   missing/retired/orphan pins. Do not infer new mechanics from prose or automatically repair
   references.
2. Equipment grants need durable inventory/currency/confirmation atomicity and provenance across
   reload, tabs and lost responses. The [equipment
   proposal](specs/2026-10-02-equipment-atomicity-proposal.md) is design only. Migration history,
   historical partial grants and copy semantics require review before approved schema/hosted work.
3. Cross-client state, concurrent choices/pins and ambiguous completion need a shared durable
   boundary. The [action proposal](specs/2026-10-02-durable-character-actions-proposal.md) covers
   receipts/revisions/locking and all relevant writers; no schema implements it. Guaranteed injected
   failure is not proof of safe replay after a committed response is lost.
4. Clarify whether legacy Manual/Average HP satisfies a later rolled-only rule. Stored values/math
   and confirmation handling were preserved; only the leaking Manual edit field changed.
