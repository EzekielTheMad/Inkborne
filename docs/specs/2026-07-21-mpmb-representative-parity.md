# Representative MPMB calculation parity

## Purpose

Keep one rights-safe, end-to-end fixture that exercises the static parser,
schema mapper, calculation preview, and live character-sheet evaluator without
copying community-published names or rules text.

## Fixture contract

`tests/fixtures/mpmb/representative-parity.mpmb` contains only original,
synthetic content:

- one feat with an ability increase, AC bonus, speed, vision, resistance, and
  save-note data;
- one first-level attack spell with sparse slot scaling and a structured save;
- one synthetic source declaration for provenance.

The fixture must continue to map both entries as valid with no warnings or
blocking issues. It deliberately uses only static data accepted by the safe
parser; it is not intended to broaden the supported MPMB language.

## Parity contract

The focused integration test parses and maps the fixture before making either
calculation. For the feat, it sends the mapped data through both the import
preview source shape and `buildCharacterStructuredSources`, the aggregation
path used by the live character sheet, then requires identical evaluator
results and matching preview deltas.

For the spell, the test runs the preview twice and pins all nine legal slot
casts: character level, cast level, attack and damage expressions, save DC, and
persistent-effect status. Sparse damage keys intentionally verify deterministic
carry-forward scaling at the intervening slot levels.

## Boundary

This contract tests calculation parity only. Persistence, repair UI, import
confirmation, and browser navigation remain covered by their own suites.
