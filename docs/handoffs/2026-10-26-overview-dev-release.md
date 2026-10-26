# Dashboard and character list: scoped dev release

26 October 2026. The user approved the local refresh and requested deployment to `dev.inkborne.app`, preserving existing behavior, Light/Dark/System, individual accents and conditional campaign labels.

## Verified source and target

- Approved local source: `3da7ba2c7c644dd9efe2b3e36345f117d24593d9`, including `e7de321`.
- Current dev and remote mapped branch: `0142f3eb0e6c6ea0e782bb516d309e48991c3627`.
- Release branch: `codex/overview-dev-20261026` in the existing clean visual-release checkout.
- Mapped remote branch: `fix/builder-ability-save-order`.
- Project: `prj_LWMhTpauZDDqLACtHhvIg6vTQ0W1` (`inkborne`, Next.js).
- Team: `team_gZZdNu24Ux7R6F93mtOzojtj`.
- Current dev / rollback: `dpl_FANnMYKadWQG66gEbjbCCgmpnJc5`, `inkborne-bsm07ja72-ezekielthemads-projects.vercel.app`.
- Production to preserve: `dpl_HAxoR5oLVQ23fvsnLETZ6pxwjptA`, `main` at `6b8601f976d3ee121d11f2ec33c7383393024b91`.

Connected Vercel reads verified both current deployments as READY, the project/team, dev domain's existing branch mapping and production alias. `git ls-remote` independently matched both source commits. The approved source descends from the current remote dev tip; no transplant, merge or force push is needed. Reconfirm the remote and aliases before publication.

## Runtime allowlist

Exactly eight runtime files change relative to the current dev release:

```text
app/(app)/characters/page.tsx
app/(app)/dashboard/page.tsx
components/character/character-route-frame.tsx
components/characters/character-card.tsx
components/characters/character-row.tsx
components/characters/notebook-overview.module.css
components/nav/character-appearance.tsx
lib/character/notebook-route.ts
```

The remaining delta is documentation, matched screenshots, tests and a bounded loopback review harness. No application module imports the local I/O adapters.

The dashboard adds `primary_color` and default-left `campaigns(name)` projections. Owner/archive filters, ordering and its eight-character limit remain intact. The shelf query, authentication guards, creation/card/campaign destinations and actions are preserved. Assigned characters show `Campaign · [name]`; missing campaign names add no label or placeholder. Campaign metadata is plain text inside each character entry, with no nested link.

The existing notebook frame and Scribe appearance extend only to Dashboard and Characters, retaining the existing sheet routes and excluding new/builder/copy routes. Each row/card derives its own accent maps with the unchanged resolver; global branding and semantic focus/error roles remain independent. No authentication, gameplay, persistence writer, schema, migration, dependency, lockfile, project configuration, root palette or sheet CSS changes.

Independent read-only source review found no blockers.

## Complete external action and rollback

After the normal check, production build and bounded local browser checks pass, publish one normal fast-forward push of the release commit to `fix/builder-ability-save-order`. Existing Vercel Git integration builds Preview with its current hosted configuration and assigns the existing dev domain. No manual restart is required; a browser reload loads the new assets. The local build uses deliberately non-working public placeholders and is never uploaded.

Do not push `main`, promote production, reassign the apex, change environment/security settings, run migrations, create credentials or modify hosted characters. Existing deployment protection remains enabled.

If release smoke checks identify a regression, restore only `dev.inkborne.app` to the recorded previous dev deployment and verify the assignment. Repair the mapped branch before another push. Do not promote or roll back production.

## Verification boundaries

Run `npm.cmd run check`, `npm.cmd run build` and the dedicated `e2e/local-overview` browser suite; check the existing sheet suite because the route frame is shared. Local fixtures use original fictional characters, actual page/components and explicit read/persistence adapters. They verify presentation and simulated client workflows, not hosted authentication, database/RLS or account persistence.

Before this release, a direct anonymous dev sign-in request reached the existing Vercel access gate. Hosted requests requiring that gate must use existing authenticated access where available; this task does not authorize creating share credentials or weakening protection. A protected gate is a verification limit, not evidence of an application failure. Record READY status, source SHA, alias assignment, build results and unchanged production separately from authenticated user acceptance.

Final candidate checks and hosted observations are recorded in the deployment receipt after completion.

## Candidate checks completed before publication

- `npm.cmd run check`: typecheck, zero-warning lint, all 207 test files / 1,943 tests passed.
- `npm.cmd run build`: Next.js 16.2.10 production build passed using non-working loopback public placeholders in that shell. The build is not uploaded.
- `npm.cmd run test:e2e -- --config e2e/local-overview/playwright.config.ts`: all 12 passed, including campaign omission, both themes/System, independent accents, contrast, navigation and long/narrow layouts.
- `npm.cmd run test:e2e -- --config e2e/local-sheet/playwright.config.ts`: all 12 passed, including shared route-frame navigation, accents/portals, HP, notes, rolls, casting, narrative, rest and mobile controls with explicit simulated persistence.
- Final typecheck and zero-warning lint passed after the test configuration correction below.
- The eight runtime files remain byte-for-byte the approved `3da7ba2` source. No application code was changed during release preparation.

The initial clean-start overview test found that Playwright resolves its server command from the configuration directory. Prior reviews had reused manually started servers, masking the relative-path problem. Both dedicated overview and sheet configs now set the repository working directory explicitly. The cold-start tests then passed and their owned ports closed. This is a test-harness correction only.
