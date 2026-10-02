# Invalid saved-choice recovery — October 2, 2026

An actual background ChoiceSelector reproduction began with an unavailable saved pick filling its limit. Every visible replacement was disabled and there was no control to remove the unavailable pick. The new regression failed before repair.

For explicit option lists, the selector now identifies unavailable, duplicated or excessive saved selections and offers Clear saved selections. Clearing is explicit and goes through the existing parent save callback and pending gate. No saved choice is dropped on render. A rejected clear restores the invalid state, exposes the existing error and permits explicit retry; a successful clear allows a valid replacement. Category-string option resolution is outside this change.

Verification: `npm.cmd run check` passed strict types, zero-warning lint and 1,932 tests across 203 files; local placeholder build passed Next 16.2.10, TypeScript and 24 static pages. `node scripts/verify-builder-local.mjs` passed ten isolated Chrome checks, including actual mobile clearing/reselection; screenshot inspected. Persistence and history are simulated, all remote requests blocked, no page errors. Prior five play-save checks remain valid for unchanged play code. No hosted operations, schema changes, installs or remote Git operations.

The parent editor owns write/recovery semantics. This control does not resolve remote ambiguity, concurrency across editors or an unauthorized/missing pin. Full system readiness and equipment durable atomicity remain open; not release-ready.
