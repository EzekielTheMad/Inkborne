# First-level class choice display — October 2, 2026

Two actual ClassStepClient regressions failed before repair: an explicit first-level proficiency choice disappeared when the class level had no feature rows, and an unavailable saved pick still showed Chosen.

The level pane now treats first-level class choices as content even without feature rows. Existing generic-choice badges require exact pick count, uniqueness and (for explicit option arrays) membership. Existing save callbacks, pending gate and explicit invalid-pick clearing remain in place. Category provenance and whole-character readiness are not inferred by these badges.

Verification: `npm.cmd run check` passed types, zero-warning lint and 1,936 tests / 203 files. Local placeholder build passed Next 16.2.10, TypeScript and 24 static pages. Eleven isolated builder Chrome checks passed, including a usable choice inside the actual mobile class detail sheet. Browser routing/persistence remain simulated, no remote requests or page errors. Existing five play-save checks cover unchanged play code. No hosted operations, schema changes, installs or remote Git changes.

Remaining class per-level validation, required ASI/feat/source eligibility and cross-client/ambiguous writes are separate risks. Equipment durable atomicity remains deferred. Not release-ready.
