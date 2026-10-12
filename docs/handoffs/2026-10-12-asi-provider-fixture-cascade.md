# ASI provider and print fixture cascade (source preparation)

Base: `a76c917363ac33655e1a2930b6fa905ed85b4595` on `codex/asi-fixture-cascade-20261012`.
Status: **UNVERIFIED source only**. No dependency install, typecheck, lint, tests,
build, browser, SQL, hosted hydration, or runtime was performed in this lane.

The integration failure baseline is preserved in root's
`verification/launch-20261012/check.{stdout,stderr,result}` at `f385`:
24 files failed, 168 cases failed, 3546 passed, 14 unhandled errors. The eleven
owned provider/print files account for 159 cases: 93 failed and 66 passed. These
counts are baseline observations, not post-change validation.

## Fixture changes

- Complete six finite saved abilities replace partial or empty positive schemas
  and base values. Existing INT/CHA/CON scores, dice sizes, max HP and all raw
  conditional state baselines remain unchanged.
- `providerSources` invokes actual `buildCharacterStructuredSources` with an
  explicit complete local no-ASI graph and no grants. It neither rewrites refs
  nor overrides resolver results. Missing, duplicated, mismatched and malformed
  refs continue into production validators unchanged.
- Original ordinary class pins now have UUID ref IDs, explicit null grant IDs,
  and actual `classDataSchema` data with declared numbered slot rows. The prior
  one-row slot evidence stays one-row; no absent row is inferred. Spell-source
  acquisition fixtures retain loaded spell identities and data.
- Passive feature controls receive explicit full original valid feature pins
  and ref envelopes. Ordinary ownership/system strings are still synthetic;
  these tests do not establish database authorization or provider hydration.
- Positive provider fixtures declare loaded content completeness. The page
  client's explicit undefined/false completeness controls still default to
  disabled print, and the public hook omission/false/true test still exercises
  the real provider default independently.
- Correct contradictory fixture total levels: conditional state controls are
  Wizard 3/Fighter 1/Barbarian 1 (total 5), Wizard recovery is level 3, and mixed
  slot fixtures use the sum of their original selected class levels.
- The direct check-roll fixture now supplies a current STR requirement without
  changing its original `1d20+5` request or sync/log/persistence assertions.
  This remains a pipeline test, not derivation of an Athletics +5 modifier.
- Print renderer fixtures remain explicit loaded-value models (including their
  injected availability and no-op `assertMechanics`). They gain canonical base
  values/full original feature refs for the separate real page-client boundary.
  That boundary uses the actual resolver/provider and declared PB/initiative;
  it has no injected authority callback. No claim of engine-to-database proof
  or earned ASI is made by the renderer fixture.

## Necessary refusal-oracle amendments

The existing three invalid subclass math controls previously asserted available
slots and an allowed whole long rest. Slot resolution remains independently
available from the frozen casting source graph. The combined ASI contract now
refuses the whole long rest when six-ability math is missing/duplicate/nonfinite.
The slot assertion stays `available`, and rest becomes `false`; all original no-cast/no-write/disabled-print controls
remain. Duplicate math still duplicates INT, with a fresh array so it cannot
poison later cases.

The four invalid print math cases now reject earlier with the exact required
mechanics error, rather than the later casting-summary error. Their unchanged
corrupted inputs must still produce no print model; no invalid value is supplied
with an availability override to make printing pass.

All original numerical, raw-state, RNG, log, DAL, conflict, recovery, retained
dialog, foreign source and stale callback behavioral assertions are otherwise
retained. Read-only/stale casting guidance assertions remain unchanged pending
runtime classification, because guard precedence may expose a product wording
contract rather than a fixture problem.

## Required verification after heavy-slot release

Run the eleven owned test files with two workers, then relevant shared-fixture
consumers (including existing print model/weapon cases and conditional short
rest). Run existing npm typecheck and lint scripts. Classify remaining failures
before editing; never relax mechanics guards, grant association validation,
unchanged raw-state/RNG/DAL or recovery assertions to obtain green results.

The shared pinned slot and print fixture files are also consumed by offline
browser harnesses. Their source manifests/build receipts must be regenerated
by root before browser reacceptance; this lane has not edited those harnesses.
