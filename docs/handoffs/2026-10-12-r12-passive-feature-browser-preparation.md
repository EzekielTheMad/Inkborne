# R12.6a actual passive feature form browser harness — SOURCE ONLY, UNRUN

Prepared in `r12-passive-feature-worker`, branch `codex/r12-passive-features`,
from clean `ff3e4529918fa727be01e335f07cafc60b269387`. The approved product is
`6f43b57b574faaeb7536aad4ded592cb1bb1e449`; product source, prior tests, dependency
files and other worktrees are unchanged. Root remains sole integration writer.
No install, test, typecheck, lint, build, server, browser, SQL or provider operation
ran for this harness child. Only source inspection/writing and Git diff checks.
Root R09 owns the heavy slot. This checkpoint requires independent harness review
and a separate execution release; it is not browser or runtime acceptance.

## Files and finite intended checks

- `e2e/local-passive-features/fixture.tsx`: mounts actual `PassiveFeatureForm` and
  actual mapper/canonical feature/effect schemas using original synthetic data.
  Explicitly simulated actions, write/readback journal, list checks and navigation;
  no Supabase client, server DAL, Server Actions HTTP, auth or database authority.
- `scripts/passive-feature-scenarios.mjs`: 22 cases in each viewport (desktop
  1280x900, mobile390x844): basic/optional-subclass/level20 creates; invalid ASCII
  class/subclass and level21/01; programmatic101-name regression; unbroken20,000
  description; pending duplicate/reset; actual rejected Promise, undefined response,
  malformed response, explicit uncertainty, confirmed-save navigation failure;
  text-only edit retaining raw mechanics/ordered effects/extensions, original absent
  type/subclass, no-op, conflict/uncertainty/rejection reload and canonical-data
  refusal before any **simulated** write. Intended44 checks and44 screenshots.
- Native required blank submission makes zero calls; real maxlength values remain
  intact. The101 case uses native input value setter + bubbled input, then waits
  for actual controlled value/defaultValue and real serialized FormData101 before
  submit, and proves exact101 reached mapper rejection/focus with zero writes.
  Valid boundaries retain explicit1/20 and blank-subclass null; literal script-like
  draft text stays inert and original whitespace/long text survives simulation.
- Retained-draft reset protection, immediate/pending duplicate lock, no auto retry,
  Check Homebrew before explicit local acknowledgement and second manual-create
  relock; saved ID/navigation failure cannot cause another INSERT. Edit controls
  contain name/description/id/version only; no association/effect authoring inputs.
  Conflict/rejected/uncertain edit reload uses real native reload with simulated
  latest version4 and no write. No-op has zero writes/navigation. Bad canonical
  source uses the real parser for refusal; this reproduces admission in the fixture
  and does not exercise server authorization or historical triggers.
- `scripts/verify-passive-features-local.mjs`: single ephemeral loopback HTTP server
  and private headless Chrome; GET-only local request allowlist, unexpected remote
  requests/writes/page errors fail. Production fonts must load their exact families
  normal/italic; body horizontal overflow and every visible form control's viewport
  bounds are checked, with offender dimensions/failure DOM/screenshots preserved.
  Submission, check link, acknowledgement and reload are reached via keyboard.
- `scripts/passive-feature-production-assets.mjs`: reviewed821eb1a Trait/Monster
  successful-clean-build guard adapted for exact passive source, all actual
  transitive bundled project bytes and Next browser helper bytes. No fallback CSS.
  `next/navigation` stubs **only** useRouter, re-exporting actual installed
  `next/dist/client/components/unstable-rethrow.browser.js` with captured root-matched
  transitive helpers; no invented digest/framework exception simulation.
- `e2e/local-passive-features/{features.spec.ts,playwright.config.ts}`: one worker,
  zero retries, dedicated config with no default hosted setup. Cooperative IPC stop
  first; fallback exact private runner tree kill is permitted only after fresh OS
  CreationDate+PID+parent+exact captured command equality. No executable-name kill.
  Runner and Chrome record actual OS birth, parent, command, cwd/start/ports, shared
  before/after resources and closure of both HTTP/control ports plus browser exit.
- `tests/scripts/passive-feature-production-assets.test.ts`: prepared positive
  clean-build controls and failed/missing/stale/dirty/shape rejection controls,
  frozen product-path identity. **Not run.**

## Required root build and receipt contract

Later commands, only after review and root resource/UI release:

```text
npm.cmd test -- tests/scripts/passive-feature-production-assets.test.ts --maxWorkers=2
npm.cmd run test:e2e -- --config e2e/local-passive-features/playwright.config.ts
```

Runner default manifest:
`test-results/passive-features-local/production-artifacts.json`; direct runner also
supports explicit `--artifact-manifest <absolute path>`. Root must create it from
its fresh successful build after integrated passive source, with `kind:next-production`,
exact current clean root HEAD in `sourceCommit`, `.next/static` absolute real path,
actual production HTML font classes, BUILD_ID SHA256, dependency-lock SHA256, and
hash-bound `buildReceipt:{sourceCommit,path,sha256}`. Saved build receipt must itself
parse as `gate:build, exitCode:0, sourceSha:currentHEAD, sourceStatus:"" or []`.
All production CSS must be listed; font/media resources referenced by CSS must
exist locally and match SHA256, path containment and local-resource guards.

Root checkout remains sibling `equipment-verification`; preflight rejects root
HEAD movement/dirty tracked source, stale/failed build, worker/root product Git blob
or physical-byte drift, staged/unstaged transitive changes, config/lock mismatch,
missing assets/fonts, remote CSS URLs or missing actual browser helper. Installed
esbuild/Next/React/ReactDOM/Playwright/test versions must match the exact lock.
Fixture bytes are hash captured and require clean tracked worker HEAD. Synthetic
fixture/action/navigation namespaces are declared separately from production input
receipts. If root product/config changes materially, update/review this harness
binding; do not silently relax it or run against old build assets.

## Exact limits

Simulated rows/readback/CAS/conflict/snapshot preservation are local fixture data,
not a PostgreSQL transaction, role/RLS acceptance, durable receipt or historical
pin verification. Check Homebrew stub keeps draft mounted; real navigation can lose
page-local drafts. It is not authenticated Next shell/HTTP routing or real account
recovery. The128KiB mapper cap is exercised by prior narrow units; this browser
matrix respects native20,000-description bound and does not claim total transport
size proof. No class/subclass attachment, character grant, import, public sharing,
SQL/schema/seed/provider operation is included. Runtime acceptance remains open.

Read current installed Next16.3.8 forms/server-actions guides and actual browser
rethrow implementation before preparing this fixture. React checklist: one real
mounted form, finite labelled fields, event-driven controls, ordered fixture data,
explicit simulation disclosures and no product hook/state changes.
