# Inkborne

Inkborne is a character and campaign manager for tabletop roleplaying games.

## Continue the project

1. Start with [the current execution entrypoint](docs/CODEX-ORCHESTRATOR.md).
2. Follow [the single current execution path](docs/LAUNCH-ACCEPTANCE.md#current-execution-path)
   and [milestone matrix](docs/LAUNCH-ACCEPTANCE.md#milestone-matrix). The acceptance
   ledger owns scope, ordering, evidence and completion decisions.
3. Use the linked current handoff for the next bounded task. The current builder
   workstream is **R06**, within roadmap **M3**; it is not a second milestone M1.

[ROADMAP](docs/ROADMAP.md), [GAME-PLAN](docs/GAME-PLAN.md),
[CURRENT-STATE](docs/CURRENT-STATE.md) and
[RELEASE-READINESS](docs/RELEASE-READINESS.md) provide navigation, conventions or
historical context. They do not define competing task queues. The
[PRD](inkborne-prd.md) records product requirements; current scope dispositions
come from the acceptance ledger.

## Development

Read the applicable [AGENTS.md](AGENTS.md), confirm the worktree and branch, and
check for an existing development server before starting one. Use the scripts
in [package.json](package.json):

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the local application under the current runtime contract. |
| `npm test -- <test files>` | Run affected tests while iterating. |
| `npm run typecheck` | Check TypeScript. |
| `npm run lint` | Check source with zero lint warnings. |
| `npm run test:e2e` | Exercise the selected browser workflow with its approved configuration/runtime. |
| `npm run check` | Run the combined type, lint and unit-test checks when required. |
| `npm run build` | Build the application when relevant to the change/release gate. |

The current work uses focused checks and actual-app evidence; a passing source
check does not establish database, hosted or release acceptance. Hosting remains
on Vercel. Follow the ledger's release gates for publication.
