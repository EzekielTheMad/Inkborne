# Critical review of the accumulated local changes

Reviewed source from remote-main base `0a4acb93ab5fcda94d8efa13a87568c3315da108`
through the local save/creation, builder-status and ability-recovery milestones.
Review checks control flow, request lifetimes, shallow state and navigation;
passing test totals alone are not evidence that all gameplay races are solved.

## Confirmed architectural limitation: dependent gameplay actions

The sheet writer removes a failed shallow patch, but cannot reconstruct domain
intent from later absolute nested maps. A local Node execution of the actual
`createStateWriter` with slots `{1:0}`, an optimistic first cast patch `{1:1}`,
and a second patch computed from the optimistic map `{1:2}` produced:

```json
{"first":false,"second":true,"finalState":{"spell_slots_used":{"1":2}}}
```

Only the second save succeeded. Rebuilding confirmed state plus pending patches
does not remove the failed spend embedded in the second map. Active effects,
resource maps and other dependent actions need the same audit. This behavior is
not a regression introduced by the builder task; the prior parallel snapshots
were also unsafe. A general solution requires commands/deltas with domain-aware
recomputation or interaction serialization at the action level. Do not retrofit
generic numeric subtraction onto unrelated state keys. Release/UAT must include
failed-first/queued-second casts and related resource actions. Equipment atomicity
is a separate unresolved problem.

## Small regression repaired: pending HP controls

The changed damage path awaits its save while leaving all HP controls enabled.
The old path closed immediately, so this newly lengthened window permits repeated
damage actions and competing heal/temp actions. The follow-up
[HP-control repair](2026-10-02-hp-save-controls.md) blocks concurrent actions in
that popover, retains the amount on failure and applies the same confirmed-save
handling to heal/temp HP. Delayed and false/rejected failure cases are covered.
This does not coordinate actions originating in other sheet components.

## Other practical limitations

- Pending sheet saves may outlive a keyed provider; cross-tab/same-character
  remounts are not coordinated. A later command-layer review needs cancellation
  and reconciliation semantics, rather than arbitrary dropped requests.
- Rest/cast completion can arrive after dialog dismissal/reopen. Their busy UI
  controls protect normal clicks but do not prove every dismissal path is safe.
- Shared sheet errors remain visible until dismissal; a successful retry does
  not automatically clear a previous error. Copy asks to retry the action,
  which is not always sufficient for nested-map ambiguity above.
- Builder "complete" still records saved choices, not validated readiness:
  subclasses, ASI and sparse abilities need a separate schema-aware audit.
- Ability saves preserve choices read at dispatch and guard the write window;
  they do not resolve ability edits made concurrently across tabs before reading.
- Creation response loss can still leave a remotely created character; automatic
  create retry/idempotency is not implemented.

Character/campaign narrative paths, schema, dependencies and existing worktrees
remain untouched by these reliability milestones. Real authenticated browser,
RLS and release checks remain unrun under the no-hosted-writes boundary.
