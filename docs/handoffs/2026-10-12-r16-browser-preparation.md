# R16 offline browser harness preparation — not executed

Prepared against accepted worker source `7e25581`, whose root integration is
`cda325ae527c6c86ad7e45d4a886c1c85de2800d`. Root's latest product includes
fixture-only descendant `2e20658`; its check/build receipt is still pending.
**Browser/full/build hold remains.** No built artifact, font or CSS file has been
read during this preparation. No server/browser or background process started.
Only `node --check scripts/verify-monsters-local.mjs` and `git diff --check` ran
and passed; the embedded fixture compilation, TypeScript checks and actual
browser assertions remain unexecuted until reviewed release.

Files: `scripts/verify-monsters-local.mjs`,
`e2e/local-monsters/playwright.config.ts`, `e2e/local-monsters/monsters.spec.ts`.
Invocation after independent harness inspection and root UI/resource release:

```text
npm.cmd run test:e2e -- --config e2e/local-monsters/playwright.config.ts
```

The runner requires this **root-produced input** at
`test-results/monsters-local/production-artifacts.json` in the executing worktree
(or direct runner `--artifact-manifest <absolute path>`). The input/evidence
directory is ignored; no credentials/environment/provider or default hosted E2E
setup is read. Required manifest contract:

```text
{
  kind: "next-production",
  sourceCommit: <exact 40-character root build source SHA>,
  staticDirectory: <absolute equipment-verification/.next/static>,
  htmlClassName: "dark h-full antialiased <actual Marcellus variable class> <actual EB Garamond variable class>",
  buildIdSha256: <SHA-256 of equipment-verification/.next/BUILD_ID bytes>,
  buildReceipt: {path: <absolute saved root build receipt>, sha256: <SHA-256>, sourceCommit: <same source SHA>},
  assets: [
    {relativePath: "chunks/<actual filename>.css", sha256: <SHA-256>},
    {relativePath: "media/<actual font filename>.woff2", sha256: <SHA-256>},
    ...all compiled CSS files and every local asset referenced by those CSS files...
  ]
}
```

Root must supply actual filenames, hashes, successful build receipt and generated
font-variable class tokens from that build; placeholders are not usable inputs.
The exact expected artifact root is the sibling
`equipment-verification/.next/static` (also resolves correctly when run after
integration in that root). Input source SHA must equal **current root HEAD**
when invoked and accepted `cda325a` must be its ancestor. Input receipt source
SHA must match, as must receipt/BUILD_ID/all asset hashes. If root HEAD changes
after the build, or any artifact/hash/path drifts, preflight refuses execution;
do not relabel an old build. This conservative check supports the newly announced
fixture-correction descendant while refusing the stale original build.

All compiled CSS paths must appear in the manifest; a selective/simplified
stylesheet cannot pass. CSS URL references must resolve to manifest-backed local
assets (data URIs excepted), with no traversal or remote URL. Verified asset bytes
are read once into a local serving map. Required `--font-marcellus` and
`--font-eb-garamond` must resolve to actually loaded FontFaces, and hashed font
files must actually be requested; missing fonts fail rather than silently count
a fallback as production proof. No global CSS recompilation, handcrafted
stylesheet, invented font definition or remote font request.

## Concrete finite behavior and limits

Actual CompendiumBrowser/CompendiumRow/CompendiumDetail/MonsterStatBlock and the
real canonical schema/definition parser run from the executing source. Original
canonical small/all-fields fixtures plus a **>60 KiB, <=64 KiB** multibyte and
long-unbroken-word variant are mounted. No new schema or product-source changes.
The large fixture is available in the local catalog; dedicated assertions focus
on the small, all-fields and aggregate-budget cases.

**20 recorded checks**, ten each at **1440x900** and **390x844**:

1. Native keyboard category navigation exposes actual Monsters/Size controls.
2. Native GET form preserves system/search/access/size/sort; current production
   font families load from hashed local files.
3. Keyboard row navigation reaches actual detail and retains all return-query
   values (canonical query order may differ from native form order).
4. Small stat block visibly retains declared negative/zero attack/save bonuses,
   HP average/dice and damage average/dice without recalculation.
5. Keyboard Back restores the filtered Library controls.
6. All-fields detail retains every rule section and duplicate action order;
   a valid envelope effect does not alter declared AC.
7. Explicit zero DC, XP, damage and lair initiative are present; valid cost is
   shown, without assuming any missing bonus/cost.
8. Literal script/HTML/event-handler/javascript text creates no executable
   nodes/link/side effect; all-fields layout has no horizontal body overflow.
9. Near-budget multibyte/unbroken title/rules all mount, with 20 ordered traits,
   production fonts and no body overflow. Top viewport screenshot.
10. Last full rule is within the viewport after scrolling, with no clipping
    ancestor/overflow. Final viewport screenshot.

Small/Library/all-fields full-page screenshots and top/final long-content
viewport screenshots are saved. The long page uses viewport captures to bound
image memory; no shortened product text is substituted. Layout assertions run
throughout, and all twenty expected checks must pass. Page errors, cross-origin
or non-GET requests, unexpected local paths/writes all cause failure.

Auth/data are explicitly mocked local returned fixtures; Next Link becomes a
native anchor and native GET routing mounts the real components. No authenticated
Next server, actual Next router/prefetch/hydration semantics, real RLS, PostgreSQL,
JWT, campaign sharing or persistence is proved. The app shell is a local padded
wrapper carrying root font classes, not the full authenticated sidebar/header.
These boundaries are recorded in `evidence.json`; no successful result can claim
whole R16/M5 acceptance.

Runner/browser PID, parent, argv, cwd, start time and ephemeral local ports are
recorded. Normal success/error cleanup closes browser and HTTP server, verifies
both ports closed and browser exited, and writes exact evidence. On owning-test
interruption, IPC requests browser cleanup; after ten seconds a stuck child can
be force-ended only after fresh PID/parent/command verification, targeting that
exact private process tree, never an executable name. No unrelated process is
stopped. Root must still inspect active processes/ports and serialize the UI slot
before the first run, then review screenshots and final cleanup readback.
