# R03.3 finite development dependency remediation plan

Prepared 2026-10-12 UTC, branch `codex/r03-devtool-remediation`, worker
`C:\Users\kaios\Documents\Codex\2026-10-11\task-2\r03-devtools-worker`,
base `794e5ba`. **Plan/inventory only.** No package/lock mutation, install, server,
MCP/Express startup, hosted request, environment/credential read or heavy gate.
Independent plan challenge and root resource release precede implementation.

Fresh `npm.cmd audit --json`: **23 findings: 15 high, 7 moderate, 1 low, zero
critical**. Every reported node has `dev: true` in this exact lock. Local public
evidence: `verification/r03-devtools-plan/audit-before.json` and
`advisory-thresholds.json` under the parent task directory. The latter records
official GitHub advisory API ranges, minimum fixed versions and maintainer links.
All candidate npm registry versions below were read and exist. This is current
inventory, not evidence of patched installation, exploit absence or risk acceptance.

## Exact compatible patch matrix

All paths below are the current lock's development graph. Version branches are
preserved; parent ranges are inspected, not inferred from audit's recommended
major downgrade. Links name the maintainer advisory establishing the tightest
fixed floor among this family's observed advisories.

| Family / installed version | Minimum candidate | Actual parent/range and exposure |
| --- | --- | --- |
| Vitest + mocker `4.1.2` | **Vitest `4.1.11`**, seven exact-version `@vitest/*` companions `4.1.11` | Direct `^4.1.2`; mocker exact `4.1.2` requires coherent family update. [Maintainer advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9). Unit runner/import mocks/jsdom; exposed mocker dev sockets are a specific advisory precondition, not the default test setup. |
| `@hono/node-server 1.19.14` | `1.19.15` | SDK `^1.19.9`; new SDK also permits `^2.0.5`, so explicitly retain patched **1.x**, avoiding an incidental adapter major. [Windows traversal](https://github.com/honojs/node-server/security/advisories/GHSA-frvp-7c67-39w9). Dormant MCP HTTP adapter in installed CLI graph. |
| `@humanfs/node 0.16.7` | `0.16.8` | ESLint `9.39.4` -> `^0.16.6`. [Symlink copy](https://github.com/humanwhocodes/humanfs/security/advisories/GHSA-p498-v437-472g). Lint filesystem helpers; no direct repository copy-helper call found. |
| `@modelcontextprotocol/sdk 1.29.0` | `1.31.0` | shadcn `4.1.2` -> `^1.26.0`. [OAuth metadata trust](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6qxp-vccf-f47h). CLI/MCP client/server and remote authentication helpers, not invoked by CSS import. |
| `body-parser 2.2.2` | `2.3.0` | SDK -> Express `5.2.1` -> `^2.2.1`. [Invalid limit handling](https://github.com/expressjs/body-parser/security/advisories/GHSA-v422-hmwv-36x6). Latent MCP HTTP request-body parsing. |
| `brace-expansion 1.1.13`, two nested `5.0.7` nodes | `1.1.21`, both `5.0.12` | minimatch `3.1.5` -> `^1.1.7`; minimatch `10.2.5` under ts-morph and TypeScript ESLint -> `^5.0.5`. [Latest observed floor](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr). Keep majors separate. This package is distinct from unresolved **braces**. |
| `browserslist 4.28.2` | `4.28.7` | Babel helper -> `^4.24.0`; shadcn -> `^4.26.2`. [Query cache](https://github.com/browserslist/browserslist/security/advisories/GHSA-c83g-rgw3-j3cx), [custom stats](https://github.com/browserslist/browserslist/security/advisories/GHSA-73wf-gq98-2v4g). CLI/Babel/browser target processing; required browser database floors may affect generated targets. |
| `fast-uri 3.1.4` | `3.1.8` | Both AJV `8.18.0` nodes in SDK/schema helpers -> `^3.0.1`. [Latest observed floor](https://github.com/fastify/fast-uri/security/advisories/GHSA-hrr3-gc8f-f4qj). URI normalization in CLI schema processing; exploit preconditions vary with downstream usage. |
| `hono 4.12.31` | `4.13.7` | SDK -> `^4.11.4`. [Latest observed middleware fix](https://github.com/honojs/hono/security/advisories/GHSA-hxh3-vqpv-xpqv). Latent MCP middleware/server helpers. |
| `ip-address 10.2.0` | `10.7.1` | SDK -> Express rate-limit `8.6.0` -> `^10.2.0`. [Latest observed floor](https://github.com/beaugunderson/ip-address/security/advisories/GHSA-h3mg-xc3c-68pw). IP classification/trust/rate-limit helpers in the CLI server graph. |
| `js-yaml 4.3.0` | `4.3.2` | ESLint eslintrc -> `^4.1.1`; shadcn cosmiconfig -> `^4.1.0`. [Merge work limit](https://github.com/nodeca/js-yaml/security/advisories/GHSA-2883-xcg3-v3hh). Tool configuration parsing. |
| `postcss-selector-parser 7.1.1` | `7.1.6` | shadcn -> `^7.1.0`. [Selector CPU exhaustion](https://github.com/postcss/postcss-selector-parser/security/advisories/GHSA-rj75-hqrm-r3gf). CLI CSS transforms; static CSS export remains required separately. |
| `qs 6.15.3` | `6.16.0` | Express -> `^6.14.0`; current body-parser -> `^6.14.1`, patched -> `^6.15.2`. [Attacker-controlled object](https://github.com/ljharb/qs/security/advisories/GHSA-4mjr-xmp4-gh2g). Latent MCP HTTP query/body parsing. |
| `undici 7.28.0` | `7.29.1` | jsdom `29.0.1` -> `^7.24.5`. [One restrictive floor](https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3); audit records fourteen additional same-family advisories with floors <=7.29.1. Test DOM/network helpers; exact affected API/preconditions differ. |

The intended direct edit is `devDependencies.vitest: "4.1.11"`; avoid Vitest 5.
Keep Vite `8.1.5` because it already satisfies Vitest's unchanged `^6 || ^7 || ^8`
range. Update its seven exact companion versions via the coherent dependency tree,
not independent incompatible mocker overriding. Do not add optional browser/coverage
packages. Registry metadata: [Vitest 4.1.11](https://registry.npmjs.org/vitest/4.1.11).

The transitive additions proposed alongside the existing overrides are:

```json
{
  "@modelcontextprotocol/sdk@^1.0.0": {
    ".": "1.31.0",
    "@hono/node-server": "1.19.15",
    "hono": "4.13.7"
  },
  "@humanfs/node@^0.16.0": "0.16.8",
  "body-parser@^2.0.0": "2.3.0",
  "brace-expansion@^1.0.0": "1.1.21",
  "brace-expansion@^5.0.0": "5.0.12",
  "browserslist@^4.0.0": "4.28.7",
  "fast-uri@^3.0.0": "3.1.8",
  "ip-address@^10.0.0": "10.7.1",
  "js-yaml@^4.0.0": "4.3.2",
  "postcss-selector-parser@^7.0.0": "7.1.6",
  "qs@^6.0.0": "6.16.0",
  "undici@^7.0.0": "7.29.1"
}
```

These selectors constrain the observed major families; Hono/adapter are scoped
inside SDK to keep its accepted 1.x adapter. If npm's override behavior or peer
resolution does not reproduce this exact compatible tree, stop and revise the
plan. No package alias, upstream internal-API violation or hand-invented lock
integrity/tree is permitted. Existing Next/TipTap/PostCSS/Markdown/ws/esbuild
overrides remain unchanged. An override is a local compatibility constraint,
not evidence that maintainers accepted an unreported API contract.

Necessary supporting deltas must be enumerated at implementation: Humanfs Node
`0.16.8` requires core `^0.19.2` (current `0.19.1`) plus types `^0.15.0`; Browserslist
requires caniuse-lite `^1.0.30001806`, node-releases `^2.0.51`, electron-to-chromium
`^1.5.393`. Existing baseline-browser-mapping `2.11.28`, update-browserslist-db `1.2.3`
and balanced-match `4.0.4` already meet required ranges and should stay fixed.
Validate minimum supporting versions from registry before edits; incidental latest
data/helper changes outside required floors are not silently accepted.

Actual local Node is `24.14.0`; CI declares Node 22. Candidate engines accept these
lanes: brace-expansion 5 `20 || >=22`, Vitest `^20 || ^22 || >=24`, undici
`>=20.18.1`, Humanfs `>=18.18.0`, SDK/body-parser `>=18`. Existing Vite requires
Node `^20.19 || >=22.12` already; retained jsdom `29.0.1` requires
`^20.19.0 || ^22.13.0 || >=24.0.0`. Thus accept a concrete Node 22 CI patch
**>=22.13.0**, or the observed Node 24 lane, rather than assume any `>=22` version
works. These stronger floors are preexisting; no engine/CI mutation is proposed.
Root's current actual install/CI compatibility still needs fresh acceptance.

## Eight unresolved high findings

The authoritative [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
reports affected `<=3.0.3` and **no patched release**. Official npm metadata still
tags [braces 3.0.3](https://registry.npmjs.org/braces/latest) as latest;
micromatch `4.0.8` requires `braces ^3.0.3`, fast-glob `3.3.3` requires micromatch.
Expected residual audit nodes, pending actual resolution/audit: **braces,
micromatch, fast-glob, @next/eslint-plugin-next, eslint-config-next,
@ts-morph/common, ts-morph, shadcn** — eight high findings from this one unpatched
family, not eight independently fixed vulnerabilities. Expected full audit
23 -> 8 high / zero moderate / zero low / zero critical is a prediction only.

Actual chain roots:

- `eslint-config-next 16.3.8 -> @next/eslint-plugin-next 16.3.8 -> fast-glob 3.3.1
  -> micromatch 4.0.8 -> braces 3.0.3` (lint).
- `shadcn 4.1.2 -> fast-glob 3.3.3 -> micromatch -> braces` (CLI).
- `shadcn -> ts-morph 26.0.0 -> @ts-morph/common 0.27.0 -> fast-glob 3.3.3
  -> micromatch -> braces` (CLI source transformation).

No patched braces/micromatch/fast-glob same-major candidate was found. Current
shadcn latest `4.21.4` still retains fast-glob/ts-morph 26, so a broad minor CLI
upgrade does not resolve it. Common `0.28.0` moves to tinyglobby but violates
ts-morph 26's `~0.27.0` internal dependency; do not override that contract or swap
in a non-equivalent glob API. Audit recommends shadcn `1.0.0` or ESLint config
`14.2.35` as major downgrades; neither is an acceptable coherent repair.
Upstream fix, a separately challenged compatible dependency replacement, or an
explicitly decided bounded residual-risk policy remains needed. **No residual
risk acceptance or release clearance is granted by this plan.**

## Build/runtime boundaries and validation

`app/globals.css:3` actively imports `shadcn/tailwind.css`; retain shadcn `4.1.2`.
Its installed static CSS was read from the already installed R07 worker (no
mutation there), SHA256
`146941ac3ff65496fdf1cb306e697255328e4dadc7c105d66e36bb031b00f6d6`.
This export contains Tailwind theme/variant CSS and does not initialize its JS
MCP/Express entrypoint. No repository direct imports of the vulnerable modules or
public mocker/interceptor plugin configuration were found. That bounded source
inspection is not an assertion of no execution by tooling/bundled compilers.

CI runs `npm ci`, typecheck, lint, tests and production build. Dev-only installed
nodes can still affect local/CI filesystem processing, untrusted source/config,
CLI remote registries/MCP/auth flows, and test DOM resources. Fixed linter glob
arguments/repository patterns lower the presently observed input exposure but do
not remediate the unpatched recursive parser. No app/browser user route importing
this package graph was identified; fresh omit-dev audit must confirm its reported
production dependency boundary, not prove every bundled compiler is harmless.

After independent challenge and root's resource release:

1. Add only the approved package constraints and resolve a lock with npm's
   package-lock-only/ignore-scripts path. No `audit fix --force` or blanket update.
   Inspect every changed lock node/range/integrity, allow only matrix/necessary
   supporting rows and justified deduplication, stop unexpected churn. Preserve
   Next/eslint-config-next `16.3.8`, all direct TipTap `3.30.5`, current scoped
   menu patches and shadcn `4.1.2`; no product source changes.
2. At a coordinated slot, `npm.cmd ci --ignore-scripts`; record exact process/cwd,
   start/finish and verify package versions/peers/engines. Full `npm.cmd audit --json`
   and `npm.cmd audit --omit=dev --json`; report actual counts and remaining paths
   without treating unresolved eight highs as accepted. No startup-based probes.
3. Pure offline parser/brace regression probes with small bounded inputs and
   no network/listener/huge attack strings; check both brace-expansion APIs,
   normal CSS selectors/URI/YAML/query parsing. Avoid duplicating implementation
   tests or pretending this proves security exploitation behavior.
4. Existing focused import-mock/jsdom flow tests:
   `tests/components/editor/rich-text-editor.test.ts`,
   `tests/components/narrative/use-narrative-editor.test.ts`,
   `tests/app/builder-choice-recovery.test.tsx`,
   `tests/api/campaign-mentions-route.test.ts`,
   `tests/lib/supabase/content-definitions-parser.test.ts`,
   and `tests/scripts/equipment-runtime-fixtures.test.ts` for Node transport mocks.
   Run through `npm.cmd test -- ...`, then typecheck/lint scripts. Do not execute
   real database fixtures or provider/browser/default hosted E2E tests.
5. Reconfirm retained shadcn CSS byte hash/export; root owns final combined full
   check, production build and generated CSS/browser acceptance. Browserslist's
   required data update may alter target-dependent output; do not assume byte
   identity of generated bundles. No new MCP/Express/dev servers, CLI generation,
   global services, migrations, hosted changes or credential access.

Rollback is the scoped package/lock checkpoint before integration and a fresh
`npm ci` from that lock, with the security implications of reverting fixed leaves
reported explicitly. Root retains independent final review and launch acceptance.

## Resolution stop and exact preservation amendment (challenge pending)

The approved constraints were applied, then npm `11.9.0` ran
`npm.cmd install --package-lock-only --ignore-scripts --no-audit --no-fund`.
Shell PID 54772, parent 30200, worker cwd, UTC start
`2026-10-12T02:09:58.6664376Z`, finish `2026-10-12T02:10:09.6581680Z`, exit zero.
No node_modules directory or install scripts were created/run.

Resolution also upgraded Vite `8.1.5 -> 8.3.4`, rolldown `1.1.5 -> 1.2.13`,
OXC types `0.139.0 -> 0.153.0`, compiler platform bindings, nested LightningCSS
`1.33.0`, picomatch `4.0.5 -> 4.0.7`, Chai `6.2.2 -> 6.3.0` and tinyrainbow
`3.1.0 -> 3.2.0`. Browser data resolved above the needed floors. **Stopped before
install/testing; this tree is rejected for scope, not accepted.** Exact full node
before/after evidence is `verification/r03-devtools-plan/resolution-changes.json`;
the retained rejected lock is `unexpected-resolution-lock.json`. Package/lock
remain uncommitted review inputs, not a usable accepted checkpoint.

Changed Vitest/mocker keep their `^6 || ^7 || ^8` Vite requirement; its new
expect package retains Chai `^6.2.2` and tinyrainbow `^3.1.0`. These do not require
the incidental increases. Rejected Vite `8.3.4` demands PostCSS `^8.5.29`, while
the existing approved override is `8.5.23`; retaining old Vite avoids silently
forcing an out-of-range compiler child. Additional Vitest optional coverage peer
metadata is authored by patched `4.1.11`; no coverage packages were added.

Body-parser `2.3.0` does require **type-is `^2.1.0`** and **content-type `^2.0.0`**.
Their published minimums are `2.1.0` and `2.0.0`, Node >=18. Type-is `2.1.0` also
requires content-type `^2`. Current Express can keep its already accepted type-is
`2.0.1`/content-type `1.0.5`; scope the new helper tree inside patched body-parser.
This supporting API-major child is explicitly required by the selected security
patch; it is not an unrelated direct package upgrade or an invented override.

The proposed replacement/additional override entries below accompany all the
unchanged original security constraints. **Do not apply until the amendment
challenge passes.** Registry metadata confirms these versions; the next npm
resolution must prove the actual scoped tree and unchanged outside versions.

```json
{
  "vite@^8.0.0": {
    ".": "8.1.5",
    "rolldown": { ".": "1.1.5", "@rolldown/pluginutils": "1.0.1" },
    "lightningcss": "1.32.0",
    "picomatch": "4.0.5",
    "tinyglobby": "0.2.17"
  },
  "chai@^6.0.0": "6.2.2",
  "tinyrainbow@^3.0.0": "3.1.0",
  "caniuse-lite": "1.0.30001786",
  "browserslist@^4.0.0": {
    ".": "4.28.7",
    "caniuse-lite": "1.0.30001806",
    "electron-to-chromium": "1.5.393",
    "node-releases": "2.0.51",
    "baseline-browser-mapping": "2.11.28",
    "update-browserslist-db": "1.2.3"
  },
  "type-is@^2.0.0": "2.0.1",
  "body-parser@^2.0.0": {
    ".": "2.3.0",
    "content-type": "2.0.0",
    "type-is": { ".": "2.1.0", "content-type": "2.0.0" }
  },
  "@humanfs/node@^0.16.0": {
    ".": "0.16.8",
    "@humanfs/core": { ".": "0.19.2", "@humanfs/types": "0.15.0" },
    "@humanfs/types": "0.15.0"
  }
}
```

Rolldown `1.1.5` declares exact old OXC/binding versions, so restoring its actual
package restores the corresponding optional platform family; do not manually
splice/invent integrities. Global caniuse retains the already locked production
Next dataset; Browserslist's more-specific scoped child uses its required new
minimum. Global type-is retains the old Express helper while body-parser's scoped
child uses its explicit new minimum. If npm does not implement this scoped result,
stop rather than claim the intended tree was produced. No package aliases, forced
peer violations, unsupported framework downgrade or broad compiler upgrade.

After successful revised resolution, every node delta must be approved security
family, necessary listed helper/data floor, patched Vitest authored metadata, or
justified reparenting/deduplication with unchanged version/integrity. The eight
unpatched braces-chain highs stay unresolved and unaccepted. Root coordinates
install with other workers and owns final combined gates; current no-install hold
remains until the actual revised diff is accepted.
