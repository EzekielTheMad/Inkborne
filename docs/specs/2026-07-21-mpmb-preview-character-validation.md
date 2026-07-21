# MPMB preview-character validation

**Milestone:** M4 homebrew importer
**Status:** implementation contract

## Goal

An import cannot write content to the library until Inkborne has successfully
evaluated every selected item against the same calculation paths used by a real
character sheet. The owner sees the resulting deltas and test-cast outputs,
then explicitly confirms the exact import revision they reviewed.

This is a calculation harness, not a persisted temporary character. Import
selection means “add these definitions to my library,” so selected feats are
evaluated independently instead of pretending one character owns all of them.

## Product flow

1. The owner uploads, repairs, selects, and resolves conflicts on the existing
   review page.
2. Once at least one valid item is selected and conflicts are resolved, the
   owner opens **Preview calculations**.
3. The server evaluates every selected item. The page shows the assumptions,
   feat sheet deltas, spell test-cast results, warnings, and failures.
4. If every item passes, the owner confirms the preview. The confirmation is
   recorded against the import's current revision.
5. The review page enables **Import selected** only while the confirmed preview
   revision still equals the current import revision.
6. Any selection, repair, or conflict-resolution mutation increments the
   revision and therefore invalidates the previous confirmation automatically.

The preview route is `/library/import/[id]/preview`. It is server-rendered and
owner-only. A completed or cancelled import has no confirmable preview.

## Deterministic character harness

The calculation service uses a neutral, documented D&D 5e test character:

- representative levels 1, 5, 11, and 17;
- every system-defined ability score starts at 10;
- no race, class feature, equipment, shield, rage, or active effects;
- walking speed starts at the engine default of 30 feet;
- test spellcaster ability score 16, spell save DC 13, spell attack +5;
- an imported feat is the only content applied to its feat evaluation;
- an imported spell is test-cast independently at every legal representative
  tier: cantrips at 1/5/11/17, leveled spells from their base slot through 9.

The system schema is parsed before evaluation. Candidate data is parsed with
`featDataSchema` or `spellDataSchema`, and effects with `effectSchema[]`.
Every derived result must be finite. Every generated dice expression must pass
the existing dice parser. Evaluation or cast exceptions become visible preview
failures rather than crashing the route.

### Feat output

Feat cards show only calculation output:

- changed abilities and derived statistics (before, after, delta);
- changes to speed, vision, damage resistances, and save advantages/immunities;
- narrative and grant effects produced by the evaluator;
- whether representative levels produced different results;
- explicit warnings for schema fields that Inkborne stores but does not yet
  automate.

The real sheet must include `feat` content in structured-source aggregation so
speed, vision, resistance, and save-note results match the preview. This runtime
parity fix ships with the preview slice and receives a regression test.

### Spell output

Spell cards show casting time, range, components, concentration/ritual state,
and deterministic cast results:

- effective cast level;
- attack, damage, and healing expressions;
- save DC information;
- whether the cast creates a persistent active effect;
- a clear “no roll or persistent sheet effect” result when appropriate.

Imported spells currently map to an empty persistent `effects` array. The
preview therefore uses `computeCastEffects`, not `evaluate`, for spell behavior.
This validates the same data-driven casting path used by the live sheet without
inventing spell effects that are not stored.

## Data and security boundary

Add nullable columns to `content_imports`:

- `preview_validated_revision integer`;
- `preview_validated_at timestamptz`.

The browser DTO exposes only whether the current revision is confirmed. Raw
`candidate_data` and `candidate_effects` never leave the server-only DAL.

Confirmation is not exposed as an authenticated browser RPC. The Server Action:

1. authenticates the user;
2. reloads the owned import and reruns the complete preview service;
3. refuses confirmation if any selected item fails;
4. uses a server-only service-role client to call a narrowly granted database
   function that records the stamp only when owner, status, and revision still
   match.

The service-role function is revoked from `PUBLIC`, `anon`, and `authenticated`.
The public `commit_mpmb_import` wrapper enforces
`preview_validated_revision = revision = expected_revision` before calling the
private retryable implementation. Thus a direct commit RPC cannot bypass the
preview gate, while completed-import idempotent retries remain valid.

No page-level check is treated as authorization. Every Server Action and DAL
entry point re-authenticates and rechecks ownership.

## Concurrency behavior

- Confirmation uses the revision rendered on the preview page.
- A stale confirmation returns the existing reload-and-retry conflict message.
- A mutation after confirmation changes the revision, making the stamp stale.
- Commit locks and rechecks the import through the existing implementation; a
  concurrent mutation still fails atomically before any content write.
- Completion increments the import revision. Idempotent retries of an already
  completed import bypass the review-only preview check and return provenance.

## Verification

Automated coverage must prove:

- pure feat preview deltas and structured fields at representative levels;
- spell base/upcast/cantrip results and dice-expression validation;
- evaluator/cast exceptions become failures;
- no candidate JSON or effects appear in the browser review/preview DTOs;
- only owners can load or confirm a preview;
- successful confirmation stamps only the current revision;
- selection, repair, and conflict mutations make the stamp stale via revision;
- direct commit without a current stamp is rejected before writes;
- stale preview confirmation and stale commit are rejected;
- completed commit retries remain idempotent;
- real character structured sources include both feature and feat data;
- review and preview routes render accessible empty, warning, failure, ready,
  stale, and confirmed states.

Final UAT uses a disposable hosted import to preview a mapped feat and spell,
confirm the revision, invalidate it with a selection change, reconfirm, commit,
and verify exact content/provenance rows. The fixture is deleted afterward.
