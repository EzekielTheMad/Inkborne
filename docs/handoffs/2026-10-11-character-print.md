# R23 character print / Save PDF candidate

Local implementation on `codex/r23-character-print`, based on `72fb420336d0c087c8a7089afca9a615b7ca65ff`. No database, hosted configuration, account, deployment or dependency version changed.

## Behavior

The owner's sheet now has **Print / Save PDF**. It captures the current evaluated abilities, saving throws, skills/passives, combat values, senses/defenses, HP, conditions, hit dice, feature uses, currency, casting DC/attack and remaining slots. Inventory, sheet weapon attacks, spells and feature/content descriptions retain the loaded immutable content versions. The preview has keyboard focus containment, Escape/back recovery and a document title suitable for Save as PDF.

The export DTO explicitly selects mechanical fields. It excludes character narrative/rich narrative, DM notes, campaign pages/relationships/timeline, freeform play notes, item notes, arbitrary ref context and arbitrary custom-data fields. Descriptions render as escaped text. Printing hides the surrounding app and preview controls.

`getCharacterContentRefSnapshot` reports whether every recorded ref has a readable matching id/version. It shares the existing request-scoped raw query, preserves ordinary degraded sheet reads and strict builder semantics, and reports incomplete snapshots through the page/client/provider. Missing completeness evidence and failed owner feature/spell reconciliation disable print while preserving the degraded sheet. The model also rejects missing/mismatched inventory and spell pins. This flag establishes completeness of recorded rows, not completion of every builder step or hosted reconciliation acceptance.

Printing is disabled for pending state writes, reload-required conflicts, pending/uncertain roll persistence and unresolved concentration checks. Existing inventory/spell mutations publish their new rows after saves; their provider API has no general mutation-pending/uncertain indicator. A print snapshot can therefore represent the preceding confirmed inventory/spell state if those operations are in flight. It is a captured reference, not a cross-session/database transaction snapshot.

## Local evidence

- `npm.cmd test -- tests/lib/supabase/content-refs.test.ts tests/lib/supabase/request-reads.test.ts tests/lib/character/character-context.test.tsx tests/lib/character/print-model.test.ts tests/components/sheet/character-print-action.test.tsx tests/components/character/character-page-client-print.test.tsx`: final 6 files / 80 tests passed, including 3 through the real page client/provider with only the shell isolated.
- `npm.cmd run typecheck`: passed. The installed Next CSS-module parser also accepted the pure selectors. Root orchestration owns final combined `npm run check` and production build.
- `npm.cmd run test:e2e -- --config e2e/print/playwright.config.ts`: final 6 / 6 passed in 4.2 seconds. The browser uses the actual print action/view/styles/model with a fixture context shim, no server or Supabase access. Anonymous/inaccessible-user route denial is covered with mocked DAL/auth responses; this is not live RLS proof.
- Six real Chrome PDFs: martial Letter/A4 2 pages each, caster Letter/A4 2 pages each, long Letter 13 pages and A4 12 pages, **33 pages total**. Python/pypdf/pdfplumber checks verified paper dimensions, printable text margins, all 28 inventory entries, 14 spell ending markers and 12 feature ending markers, and absence of private/control sentinels. Poppler rendered every page. All six full-page contact sheets and a full-resolution long feature page were visually inspected; no clipped text, overlapping fields, orphan source-only page or blank page remained. Long descriptions paginate and short entries stay together.

Ignored evidence stays in the worker's `test-results/character-print/`: PDFs and `pages/*.png`, per-fixture `all-pages.png`, `pdf-verification.json`, `worker-process.json` and `render-processes.json`. The bundled native Poppler executable works; its `.cmd` wrapper did not resolve its path, and PyMuPDF was unavailable. Existing pypdf/pdfplumber/Pillow plus native Poppler were sufficient. No installation was needed for PDF QA.

The first browser pass caught a real Escape recovery defect after printing moved focus to the body. Handling preview keys at document scope fixed it; the final six-case pass verifies this recovery. Layout QA also removed a footer that created an otherwise empty third caster Letter page.

## Remaining acceptance

Browser print/Save as PDF supplies the P0 paper/PDF workflow without a cloud service or new dependency. A dedicated server-rendered download is not implemented; PRD section 11 lists server rendering as a proposed implementation stack. Standard fillable PDF, character JSON import/export and campaign export remain separate P1/P2 requirements.

Real authenticated candidate character export, production authorization/RLS, native print-dialog interaction, physical printer output, Safari/Firefox/mobile browser printing and cross-session races have not been verified. Default hosted E2E was deliberately not run. The offline PDFs establish rendering behavior for original fixtures, not hosted release acceptance.

No server/listening port was started. Playwright/Chrome and render processes were task-owned, bounded and finished; process receipts record worker/render PIDs, parent PIDs, command, cwd and timestamps. The final process check found no remaining task-owned worker or renderer.
