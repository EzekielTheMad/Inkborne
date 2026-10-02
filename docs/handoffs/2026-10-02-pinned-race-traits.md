# Pinned race-trait display — October 2, 2026

The actual race selector displayed a newer catalog trait's tool options despite an authorized older trait snapshot already being pinned to the character. The new real-control regression failed before repair.

Traits named by the displayed race now use a unique matching trait pin (type, slug and content identity), including descriptive traits and ChoiceEffects. Retired catalog traits remain visible from their saved snapshots. Conflicting matching trait pins are not arbitrarily selected: the existing readable conflict alert includes traits, editing is disabled and stat preview is withheld. Missing trait pins retain the existing catalog fallback. No pins are created, upgraded, repaired or removed.

`npm.cmd run check`: strict types, zero-warning lint, 203 files / 1,934 tests passed. Loopback-placeholder `npm.cmd run build`: Next 16.2.10 compile, TypeScript and 24 static pages passed. Ten isolated builder Chrome checks passed; the existing pinned-race check now verifies trait options against a newer catalog revision. Updated mobile screenshot inspected. Browser boundaries remain simulated, remote requests blocked and no page errors. Prior five play-save checks cover unchanged play code.

Remaining: missing trait provenance, subrace-specific trait resolution and per-level/system readiness are not addressed. Separate choice/ref writes and stale extras remain risks; cross-client/ambiguous write outcomes and equipment durable atomicity still need approved durable designs. No hosted operations, schema changes, installs or remote Git operations. Not release-ready.
