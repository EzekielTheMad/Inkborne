# Pending dialog session checkpoint

> Historical milestone record. Counts/status describe this checkpoint. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current authority.

Base: `c1a46bcb8c7e2f4fa538a2177e65d1ef0f21297b`, isolated branch
`codex/playable-core-stability`.

## Source evidence and fix

RestDialog previously stayed mounted when closed. Its awaited `saveRest`
unconditionally called the captured `onClose` on success, even after an external
close/reopen. Cast controls allowed Cancel/Escape and external unmount during a
pending cast. Actual spells-tab usage unmounts cast dialogs on close; a closed
instance's persistence continues, so dialog-local completion must be isolated.
Hit-die buttons also bypassed the rest save guard and could compete with rests.

Each open cast/rest is now a fresh mounted session. `useDialogAction` uses a
synchronous action lock and an effect-owned active-session marker. Only one
action can run in that session; async completion cannot set its state or close
a later session after unmount. Persistence is not silently cancelled.

While pending, explicit dismissal is blocked, the desktop close button is
hidden, Cancel is disabled, and Escape/outside requests are ignored. The mobile
drawer also uses its existing `dismissible` prop. Progress is announced and the
dialog is marked busy. Slot/ritual/recovery controls and hit-die/rest actions
are disabled. Hit-die failure now shows readable recovery and keeps the dialog.

## Interaction evidence

Tests use real Base UI/Vaul dialog DOM and controlled parent open state, with
only the persistence/hook boundary mocked. Desktop and mobile pending Escape/
Cancel cannot close; failure restores dismissal; closing and reopening clears
stale errors. External close/reopen while a save is delayed proves old cast
outcomes cannot appear and old rests cannot close the new session. A delayed
hit-die save blocks a competing rest and allows explicit recovery after failure.
The existing multi-class spend test now waits between actions, matching the
new one-action-at-a-time contract. Physical mobile swipe gestures still need
browser/device UAT; jsdom does not prove their geometry.

Scoped provider/writer/cast/rest run: 75 tests passed, including the cast release
gate. Final `npm.cmd run check` passed typecheck, zero-warning lint, 201 files /
1,856 tests. Production build passed Next 16.2.10 compile, TypeScript and 24
static pages with loopback-only placeholders. `git diff --check` passed.

## Remaining boundaries

External route navigation can still unmount a sheet during persistence. The
session guard prevents stale UI callbacks, not rollback of an in-flight RPC or
cross-tab coordination. Domain-level raw scalar dependencies and ambiguous
responses remain separate release review items. Equipment atomicity is deferred.
No hosted write/test, schema change, dependency install, publication or deploy.
