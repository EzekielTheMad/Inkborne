# Next bounded task: builder overview and navigation

> Historical proposal/task plan; may include unimplemented work. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current priorities.

## Evidence

`app/(app)/characters/[id]/builder/page.tsx` has `getStepStatus`, while its
`layout.tsx` separately implements the same status rules in `computeStepStatus`.
The layout's "Back to Dashboard" button actually links to the character page.
The existing hosted `e2e/builder.spec.ts` ends after character creation and
builder entry; gameplay tests seed an already-built wizard. Neither proves the
full fresh builder-to-play journey. Hosted fixtures are excluded from this task.

## Safe first slice

1. Extract the duplicated current status rules into one pure builder helper.
   Preserve current behavior, including legacy equipment acknowledgements.
2. Use the helper from both server surfaces; correct the character-return label.
3. Add local mocked tests for an empty character, saved race/class/abilities/
   background choices, draft equipment, confirmed equipment and the character
   return link. Verify the overview and navigation agree as the fixture advances.
4. Extend the local journey through the existing sheet provider with save
   rejection/retry; reuse existing domain fixtures instead of inventing a second
   rule engine or a fake production environment.

## Before changing readiness semantics

Audit pending class choices/subclasses/ASI and required ability fields against
the actual published system schema and current builder validators. The current
status indicator treats any class selection as complete and any nonempty stats
object plus an ability method as complete. Do not silently redefine "complete"
while consolidating code; record the contract and add behavioral cases first.

## Boundaries and acceptance

Owned areas: builder overview/layout/navigation, a pure status helper, their
local tests and current-state documentation. Preserve character/campaign links,
sheet mechanics, schema, authoring/imports and existing worldbuilding behavior.
No migration, dependency install, hosted test, push, merge or deployment.

Run narrow regressions, then `npm.cmd run check`; build with the documented
loopback-only placeholders if source changes warrant it. Record exact counts,
base/head SHA and remaining gaps. Completion is a local development milestone,
not proof of a real authenticated browser journey against production.
