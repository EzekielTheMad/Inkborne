# R03.1 local runtime dependency security checkpoint

Date: 2026-10-12 UTC. Base: `72fb420336d0c087c8a7089afca9a615b7ca65ff`.

This checkpoint updates the production dependency chains identified by the inherited audit. It makes no application, schema, hosted configuration, or deployment change. Final combined build, full test suite, browser workflow, and independent review belong to the integration gate.

## Versions and rationale

| Chain | Before | Checkpoint |
| --- | --- | --- |
| Next / eslint-config-next | 16.2.10 | 16.3.8 |
| Tiptap direct packages and core/extensions | 3.22.3 | 3.30.5 |
| sharp | 0.34.5 | 0.35.5 |
| prosemirror-view | 1.41.8 | 1.42.6 |
| PostCSS override | 8.5.10 | 8.5.23 |
| nanoid | 3.3.11 | 3.3.20 |
| source-map-js | 1.2.1 | 1.2.2 |
| baseline-browser-mapping | 2.10.16 | 2.11.28 |
| Markdown / linkify overrides | 14.3.0 / 5.0.1 | 14.3.1 / 5.0.2 |

[Next 16.3.8](https://github.com/vercel/next.js/releases/tag/v16.3.8) is the first coherent stable Next release satisfying all 17 directly reported Next advisories in the inherited audit. The audit's recommended 16.4.0 is not required: npm metadata for both versions declares sharp `^0.35.4` and PostCSS `8.5.23`. The lock resolves sharp to 0.35.5, which also fixes the later [librsvg advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).

[Tiptap 3.30.5](https://github.com/ueberdosis/tiptap/security/advisories/GHSA-j95f-988m-3j2f) fixes the reported Markdown attribute parsing issue and includes the earlier mergeAttributes fix. Its exact core/pm peer requirements require aligning all six direct Tiptap packages. Two overrides scoped to `@tiptap/react` keep its optional bubble/floating menus at 3.30.5; without them npm selects 3.31.4 menus with conflicting exact peers. The final install and `npm ls` report no invalid peer dependencies.

The [ProseMirror paste fix](https://github.com/ProseMirror/prosemirror-view/security/advisories/GHSA-c8x8-7fp4-3x9w) starts at 1.42.3; the lock resolves the compatible patch 1.42.6. New Tiptap pm no longer depends on prosemirror-markdown/menu, removing their unused Markdown chain naturally. No product imports reference those removed packages. Existing Markdown/linkify overrides remain at patched versions should that chain return. PostCSS's override moves to the [complete source-map fix](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp). Only baseline-browser-mapping and source-map-js needed additional targeted lock refreshes.

All lockfile version changes follow the Next, sharp, PostCSS, and Tiptap dependency chains, including their native platform packages and minimum supporting dependencies. Unrelated direct packages and development tools retain their versions. No `npm audit fix --force`, major downgrade, or broad update was used.

## Verification

- Clean worker-local `npm ci --no-audit --no-fund`: passed, 800 packages installed.
- `npm ls` for the affected chains: exit 0; every Tiptap package resolves to 3.30.5.
- `npm audit --package-lock-only --omit=dev --json`: production findings **11 to 0**, previously one critical, eight high, two moderate vulnerable package nodes.
- Full audit: **37 to 24** vulnerable package nodes. Remaining: one critical, 15 high, seven moderate, one low. Each residual audited node is marked `dev: true` in the lock and absent from the production-only audit.
- Focused `npm test -- <editor, narrative, auth, mentions, and Supabase server-mock paths> --maxWorkers=2`: **20 files / 163 tests passed**. No hosted tests or credentials used.
- `npm run typecheck`: passed.
- `npm run lint`: passed, zero warnings.
- External verification-only Tiptap runtime smoke: passed HTML paste with bold/HTTPS link, rejection of script/image/event-handler/JavaScript URL content, character/page mention trigger text and attributes, and JSON serialization/reload. This checks actual dependency Editor APIs under jsdom; it is not mounted Inkborne/browser UAT or proof of all possible paste attacks.
- `git diff --check`: passed.

The installed Next upgrade guide was read before and after installation. No compatibility source edit was necessary. No server or listener was started. The install/test processes exited normally; process and audit evidence are stored outside the repository at the task's `verification/launch-20261012/r03-*` files.

## Residual development risks and release limits

The critical residual is `proxy-addr@2.0.7`, reached through **dev shadcn 4.1.2 → MCP SDK 1.29.0 → Express 5.2.1**. It is not an Inkborne runtime dependency. Remaining findings include MCP/Hono/Express tooling, ESLint/glob/YAML/browser tooling, ts-morph/shadcn tooling, Vitest mock tooling, and dev undici. Tool-only classification is not acceptance or remediation of these risks; they remain a separate release security decision. Do not expose development MCP/HTTP tooling as part of production.

Zero production audit findings mean no advisory currently reported by the npm registry for this resolved production tree. They do not prove deployment configuration, authorization, image-server exploit resistance, RLS, or hosted recovery correctness. Root integration must still run the full check/build, verify relevant real browser workflows, and record independent review before acceptance. No beta, hosted write, or deployment is authorized by this checkpoint.
