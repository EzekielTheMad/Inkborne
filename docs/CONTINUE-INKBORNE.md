# Inkborne development continuation prompt

Execute this prompt when the user asks to continue development or to execute
this file. Reading, editing or reviewing it alone does not start product work.
It defines reusable working rules, not a roadmap or a frozen checkpoint.

## Resume from the latest verified state

Continue Inkborne and make concrete product progress.

Bootstrap workspace:
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\equipment-verification`.
Confirm the current authoritative checkout and branch from
[CODEX-ORCHESTRATOR.md](CODEX-ORCHESTRATOR.md). Preserve
`C:\Projects\Inkborne` as the old backup, inherited worktrees, accepted work
and unrelated changes. Do not reset or recreate a checkout from an old SHA.

1. Read applicable `AGENTS.md` instructions; confirm working directory, branch,
   Git HEAD and uncommitted changes before editing.
   Read [SHARED-DOMAIN-CONTRACT.md](SHARED-DOMAIN-CONTRACT.md) at every continuation,
   including after context compaction. Retain the user's assigned lane and its
   compact handoff; record the contract version and current deliverable there.
2. Use [LAUNCH-ACCEPTANCE.md — current execution path](LAUNCH-ACCEPTANCE.md#current-execution-path)
   as the single guiding plan. Read its current continuation and relevant
   requirement rows, then the orchestrator's current pickup section and latest
   linked handoff. Read historical records only to answer a concrete question.
3. Reconcile the documents with current source and verification evidence.
   Preserve implemented and accepted slices; do not mistake implementation for
   acceptance, or rerun completed work because an older note lists it as missing.
   Resolve material discrepancies from evidence and update the canonical record.
4. Select the next unfinished, ready dependency in the explicitly assigned lane,
   or in the canonical queue when no lane is assigned. Briefly state
   where we are, the next useful delivery and its minimum verification, then
   proceed. Do not stop at a plan or require repeated checkpoint permissions.

## Deliver with proportional testing

Prioritize working user workflows and implementation. For routine development
under this kickoff, I explicitly request **focused validation instead of
automatic full `npm run check`, full E2E suites or production builds**. Preserve
required security, data-integrity and release acceptance gates.

- Use existing npm scripts for the smallest relevant checks. Exercise the
  changed user workflow in the actual app when needed; use the real database
  when its guarantees are what must be verified.
- Batch related work and run applicable typecheck/lint once per coherent
  checkpoint. Reuse passing evidence for unchanged code at the boundary it
  actually establishes. Repeat only after relevant changes, failures or a
  concrete unresolved concern.
- Add regression tests when they protect meaningful behavior. Avoid tests that
  mirror implementation and new tests for trivial reversible edits. Avoid
  speculative harnesses, unrelated audits and chasing test counts or coverage.
- Broaden validation for a specific demonstrated risk, significant shared
  impact or release gate. State what risk the broader check will settle.
  Ownership, authentication, transactions, data loss and durable recovery may
  require deeper checks; never weaken an oracle to obtain green.
- If verification dominates, identify the bottleneck and the smallest check
  that resolves it. Do not replace an unavailable actual-flow check with
  repeated simulations and call it accepted. Continue useful independent work
  when a resource/access dependency blocks one lane.

### Verification stopping rules

- Before implementing a coherent slice, name its user-visible finish line and
  minimum verification. Do not turn a small fix into a new acceptance framework.
- Stop verification when those checks pass and no concrete material risk remains.
  Continue delivery or the next ready slice; do not add checks simply because
  more tests could be written. Reuse unchanged evidence within its actual scope.
- Broaden only for a relevant failure, a changed shared contract, a specific
  unresolved security/data-integrity risk, or an applicable release requirement.
  State the trigger, the next bounded check and its stopping condition first.
- After two consecutive verification-only cycles with no product improvement,
  perform a brief drift check. A cycle means a planned check batch plus its
  analysis, not each individual test. Identify the exact unresolved failure or
  required gate. Fix the concrete cause, continue another ready in-scope product
  action, or report the real blocker. Do not launch a third exploratory test or
  evidence-harness expansion without that justification. Necessary safety work
  continues; this is a scope check, not permission to ignore failing checks.
- Keep current feature development separate from historical upgrade and release
  acceptance. Do not rebuild old evidence chains unless the changed behavior or
  selected acceptance target actually depends on them.
- Documentation-only changes need link/diff/consistency checks, not app suites.
  Small reversible presentation changes need relevant inspection. Saved-data
  behavior needs save/reopen and meaningful failure checks; permissions need
  authorized/denied cases; transactions/recovery need the relevant real database
  guarantees. Use existing scripts and harnesses before creating new machinery.
- End each slice with: what the user can now do; checks and their scope; remaining
  limitation; next product action. If no product behavior changed, say so and
  explain the specific blocker resolved. Test counts are supporting evidence,
  never the finish line. Do not promise a fixed test-count or time ratio.

## Delegate selectively

- Use the smallest effective team. Delegate bounded, independent work when it
  materially improves speed or quality; keep small edits and tightly sequential
  work with the main agent.
- Give each worker a specific question or deliverable, clear file ownership,
  relevant context and a concise expected result. Reuse agents and findings;
  avoid duplicate history reading or repeated exploration of completed scope.
- Use isolated worktrees for parallel implementation, one writer per worktree,
  and preserve others' changes. The main agent owns integration and follows the
  single current plan rather than creating parallel roadmaps.
- Coordinate verification centrally. Workers run affected checks; the main
  agent runs necessary integration checks without repeating unchanged passes.
  Serialize memory-heavy tests, browsers and development servers.
- Request concise findings, file references, commits and verification results
  instead of full logs. Avoid nested delegation without a concrete benefit.

## Review at the right boundary

- For a completed feature or consequential fix, use one independent, read-only
  agent review of the exact change and directly supporting code before marking
  that slice accepted. Supply the intended behavior, relevant invariants and
  known limitations. Small copy/layout edits need self-review and relevant
  checks, not an automatic independent security-review cycle.
- Include explicit security/data-integrity review for changes to authentication,
  account ownership, sharing, permissions/RLS, privileged calls, imports/uploads,
  migrations, native transactions, save recovery, or copy/delete behavior. The
  same independent reviewer can cover these risks in the feature review; do not
  automatically create another agent or expand into a whole-repository audit.
- Ask for concrete bugs/regressions with file/line references, a failure or
  attack scenario, impact and supporting evidence. Distinguish confirmed issues
  from hypotheses; use the smallest relevant check to resolve material doubt.
  Confirmed cross-account leaks, data loss, duplicate writes and broken critical
  workflows block acceptance. Track minor findings without unrelated rewrites.
- Record the reviewed base/head commits (or exact uncommitted diff digest),
  material findings, their disposition and remaining verification in the existing
  handoff/ledger. Review approval applies only to that recorded source. Re-review
  relevant fixes or material later changes, not unchanged code after every commit.
- Use existing CI and integration gates for the assembled change. Verify whether
  dependency/secret scanning is actually configured before claiming coverage;
  do not infer live GitHub settings from local workflow files.
- Before launch, perform the broader frozen-candidate review and actual
  environment checks required by [RELEASE-READINESS.md](RELEASE-READINESS.md) and
  the [ledger's completion gates](LAUNCH-ACCEPTANCE.md#completion-gates-and-durable-tracking).
  Development review does not establish deployed permissions, provider behavior,
  production configuration or backup/restore acceptance. Keep those release gates
  separate from the lightweight development loop.

## Preserve boundaries and leave a usable handoff

- Follow the explicitly assigned lane, or the ledger's current milestone order
  when no lane is assigned. Preserve the ledger's pauses, deferrals and hosting
  decisions. This kickoff does not change Vercel hosting, resume paused work or
  invent a new beta scope/date. New explicit user decisions take precedence.
- Continue authorized local work without repeated permission requests. Reuse
  valid authorization; do not infer permission for push, merge, deployment,
  hosted data/security changes, new credentials or other external actions from
  this kickoff. Apply existing authorization to its exact stated scope.
- Before starting services or heavy checks, inspect existing processes and
  enforce the current handoff's resource guards. Record task-owned identities;
  stop and verify cleanup of only task-owned services and resources afterward,
  unless explicitly asked to leave them running. Preserve shared services.
- Before finishing, update the canonical ledger and current handoff concisely:
  delivered behavior, exact source/verification evidence, remaining gaps,
  blockers and the next action. Do not create another roadmap or copy logs into
  planning files. Commit scoped local checkpoints and preserve unrelated edits.
- Report user-visible progress first, followed by concise verification,
  limitations and the next step. A plan, audit or green test count alone is not
  a delivered product result. Clearly distinguish source-only, simulated,
  actual local, hosted and release acceptance.
- At meaningful checkpoints, maintain this chat's registered
  `docs/dashboard/character-flow.json` and `docs/dashboard/overview.json` under
  `C:/Users/kaios/Documents/ChatGPT/Project Dashboard/docs/REPORTING-SOP.md`
  version1. Validate reports with its CLI; preserve stable IDs and the ledger's
  acceptance authority. Reporting does not trigger additional app testing.
