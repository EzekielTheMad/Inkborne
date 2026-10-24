# Ordinary builder save recovery

Continue the M1/R06 builder work from `753e9bd`. An ordinary builder selection
must remain recoverable when the server commits but its response is lost and
the user reloads. Vercel stays unchanged; M1–M6/M5.5 precede M8 and M7/creature
imports remain paused.

## Contract

The browser creates one UUID and retains the complete validated intent before
sending it: contract version, operation, character, command and domain fields.
The parsed intent is a separate deeply frozen JSON value. Storage is scoped to
the signed-in account and character in this browser session. A storage failure
prevents sending a new request; existing unknown or malformed bytes are retained
and block replacement.

All six ordinary builder steps use one shared recovery boundary. Unknown results
keep the original request and prevent a new save. After reload, **Check save**
only resolves that operation; **Retry original save** resends the exact original
intent. Absence is not cancellation and does not permit a replacement UUID.

Both server actions reverify the current account/session using the existing
command context and user's cookie client. The existing native command retains
its independent ownership/session locks and receipt/replay checks. Server and
browser accept only a receipt matching account, character, operation, command
and exact domain fields. A matching receipt permits clearing that exact local
record. No new database function, migration, privilege, gate or hosted setting
is required.

The existing creation-session boundary invalidates in-flight leases before
account cleanup. Sign-out/account change clears recognized pending records;
unknown Auth state blocks the lease while retaining the original bytes. Old
responses cannot clear or apply a different account/target's request.

Receipt snapshots describe the original operation. Reload recovery refreshes
the current saved route instead of treating a historical receipt as the latest
character state. The current builder's ordinary callback can consume a newly
applied response; recovered operations refresh the editor from saved values.

## Acceptance

Focused checks cover exact request/receipt matching, absent/uncertain outcomes,
storage retention, reload, account transitions, stale callbacks and existing
builder behavior. Actual local application stories must exercise real sign-in,
server actions and PostgreSQL persistence:

1. Commit an ability save, drop its response, reload and resolve its receipt.
2. Drop an ability request before it reaches the server, reload, observe absence
   and retry the exact original intent.
3. Commit a server HP roll, drop its response, reload and recover the same draw.

Read-only native snapshots must agree with the browser, show one receipt and
one parent revision increment for each mutation, retain pin identities and all
five order bijections, and show no extra revision/receipt/draw after recovery.
All global activation gates remain closed. Actual local acceptance does not
establish hosted/provider, wider concurrency, lifecycle or launch acceptance.

Verification results and cleanup are recorded in the corresponding handoff.
