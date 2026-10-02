# Ability-score recovery checkpoint

Milestone base: `c0671ff5c4ba254a45c25d69968a302cc8a12971` on
`codex/playable-core-stability`; isolated checkout
`C:\Users\kaios\Documents\Codex\2026-10-02\task\inkborne-core`.

## Changes and evidence

The real ability UI now uses ordered complete drafts. Earlier save failures do
not restore old scores over newer edits. Failed final drafts remain visible with
an accessible error and explicit Retry save action. Saving/saved/unsaved status
is announced, and the editor's previous/next buttons wait for confirmed saves.
Method changes save immediately using the selected method's defaults. Standard
array drafts may be partial; selecting "--" now actually clears an assignment.
Numeric inputs/selects are named. Manual entries enforce integer scores 1–30;
point-buy bounds/budget and unique array assignments remain.

`saveCharacterAbilityScores` reads current choices before each dispatched write
to preserve other selections, then filters the update by both read JSON snapshots
and requires a returned row. A concurrent change in the read/write window or a
denied/no-match update cannot be displayed as saved. No migration is added.
The client is keyed by character ID to reset its editor lifetime on navigation.

Eight UI cases cover successive edits, earlier and latest failures, explicit
retry, method changes while pending, clearing assignments and numeric bounds.
Five transport cases use the actual Supabase client with a mocked fetch (invalid
test hostname) to verify serialized JSON predicates, preserved unrelated choices,
returned-row confirmation and rejected reads/writes. No request reaches a server.

The update/returned-row contract was checked against the installed client source
and [Supabase update documentation](https://supabase.com/docs/reference/javascript/update).
Equality predicates follow [PostgREST filters](https://docs.postgrest.org/en/stable/references/api/tables_views.html).
The changelog markdown fetch was unavailable in the web tool (unsupported content
type); this uses existing client features, with no package upgrade or install.

## Verification

Final combined check passed typecheck, zero-warning lint, 200 test files /
1,840 tests after critical review restored the preexisting unchosen-method
initialization rule and added its regression case. Final production build passed
Next 16.2.10 compile, TypeScript and 24 static pages with loopback-only
placeholders. Dependencies remain reused, with no install. `git diff --check`
passed. The accumulated review is recorded separately in
[critical save review](2026-10-02-critical-save-review.md).

## Limits requiring honest handoff

This orders one mounted editor session. Drafts are not stored offline; a reload
can lose unsaved changes, and header/browser navigation is not globally blocked.
Already queued writes continue after unmount. The guard protects the read/write
window, not simultaneous ability drafts made in different tabs before the read.
A lost response remains ambiguous; retry repeats an absolute score snapshot,
without granting items or spending gameplay resources.

Equipment atomic/idempotent grants remain unresolved and require separate schema
authorization. No hosted writes, migrations, dependencies, publication or deploy.
