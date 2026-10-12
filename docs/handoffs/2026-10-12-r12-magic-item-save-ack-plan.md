# R12 magic-item acknowledgment plan handoff

2026-10-12. Plan only for independent challenge. Owned clean
r12-magic-ack-worker/codex/r12-magic-save-ack, base
81629ce050f9818827dc88008d6362cd6479435f. Only new save-ack plan and this handoff
are committed. Root/JSON/ordinary-item R13/other worktrees preserved. No code,
SQL/provider/network/install/runtime/tests/typecheck/lint/build/browser changes.

Actual magic-item CREATE trusts a parsed returned row without frozen ID or
immutable confirmation; actions redirect any status-less result; UPDATE rebuilds
only authored data and drops unrepresented raw keys; no-op/MAX and strictly newer
reread distinction absent. Form native reset retention already works, but pending
does not disable fields, malformed/idle result can permit retries, and hidden
identity follows changed props over retained fields.

Four proposed production paths only: homebrew-magic-items-server.ts,
magic-items/actions.ts, magic-item-form.tsx and magic-item-form.ts. Freeze
server UUID/slug before INSERT; validate intended complete returned envelope
and exact raw immutable pin before saved. Auth/published canonical system and
owner/private/type/source/active filters on all operations. Original raw-data
read, semantic changed-control overlay preserving defaults/absence/whitespace/
extensions and valid effects (validation only, UPDATE omits effects); true
no-op/MAX no-write; expected+1 CAS and strictly newer eligible conflict versus
post-issued-write uncertainty. No latest/current-private inference from saved
pin; no SQL/receipt/exactly-once claim.

Strict finite response/mount identity contract, native pending single submission,
existing native reset/draft retention, invalid focus, idle/malformed uncertainty,
manual Check Homebrew+explicit create acknowledgment, edit reload lock, saved
pin retained before plain Homebrew navigation and no reinsertion on failure.
Mounted ID/version never silently rebase old draft on prop changes. Preserve
current finite fields/trim semantics and existing mapper/reset/effects positives.
No shared schema/framework/route/Homebrew query-notice change is proposed.

Meaningful before tests must use actual OLD DAL/actions/form exports with
otherwise-valid fixtures/queued responses and demonstrate wrong acknowledgments,
redirect/retry/raw loss/identity drift; missing new modules or schema-construction
failures do not count. Prepared plan names the four existing focused suites,
positive fixture upgrades without diluted assertions, exact failure/restoration
receipts and later independently reviewed real-form offline/native acceptance.
Mocks do not establish RLS/version trigger/real race/rollback/idempotency; G2 is
separate. Root owns future source challenge and heavy/UI/integration scheduling.

Supabase guidance applied to authenticated derived envelope, scoped queries and
returned-row proof; no changelog/network/provider query in this docs-only scope.
Read installed Next guides/React checklist before future code. Static git diff
checks only; no long-running process/listener started. Freeze exact docs SHA and
return idle before implementation authorization.
