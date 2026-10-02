# Saved core reference progress

Overview/navigation previously marked race/class/background Complete from selected names alone, including after a choice write saved but its matching pin failed. Four new regressions failed against that behavior (three rendered mismatch cases and the helper's no-reference case).

Both server surfaces now reuse the existing parsed content-reference read and pass it to the shared status helper. Selected core identities require unique matching content IDs/versions; extra stale pins, incompatible selected subrace/subclass parents and invalid non-positive/non-integer class levels remain In progress. Missing reference data does not earn Complete. Fresh choices remain Not started. The existing schema-aware ability validation and equipment confirmation markers are preserved. Navigation stays available; there is no new hard gate or automatic pin repair.

## Evidence

- Actual overview and navigation render tests cover missing pins, duplicate race pins, wrong background content identity, version mismatch, extra stale class pin, incompatible subrace, missing subclass pin and invalid class level. Both surfaces agree.
- Failed snapshot reads propagate to the existing route error boundary rather than inventing Complete progress; unauthenticated/foreign-character layout rejection occurs before reference fetching.
- `npm.cmd run check`: strict types, zero-warning lint, 203 files / 1,918 tests passed.
- `npm.cmd run build`: Next 16.2.10 compile, TypeScript and 24 static pages passed with loopback-only Supabase placeholders; no credentials or hosted operations.

## Limits and critical review

This validates saved core identity/reference consistency, not every required feature choice, ASI, subclass level gate, race trait provenance, dynamic language choice or playable-system constraint. Class level validation is positive/integer only; it does not impose a system-agnostic level cap. Legacy equipment confirmation still is not a durable grant receipt. The read helper's existing parser filters malformed rows, so missing pins remain incomplete. Each surface reads its own parsed refs; this does not introduce a cache or promise a single cross-client snapshot. Full-choice synchronization and lost-response resolution remain separate. The [durable action proposal](../specs/2026-10-02-durable-character-actions-proposal.md) is design only and requires separate authorization before schema/hosted work.
