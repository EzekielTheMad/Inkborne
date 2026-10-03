# Request-scoped read deduplication and bounded acceptance — October 3, 2026

## Change and independent review

Server catalog reads now use React.cache keyed by primitive system ID/content type. Joined character-reference rows use a shared React.cache reader keyed by character ID, with each caller retaining its own strict/lenient parsing and exact content/version validation. The cache belongs to the current server render request; there is no use-cache directive, persistent cache, cross-user store, timeout change or authorization bypass. Cookies and RLS still determine every new request's database visibility.

Explicit fresh:true reads bypass memoization after writes. The actual sheet feature-reconciliation reread and class restoration action use this bypass. Independent read-only review found the bypass had initially been placed on the initial sheet read; the actual CharacterPage regression failed, and the corrected post-sync callsite then passed. Reviewer confirmed closure with no remaining authorization/freshness findings in the diff. Review did not execute tests or query hosted data.

Nine new tests use the installed React server cache implementation with a simulated renderer dispatcher, mocked authenticated database responses and the actual sheet page:
- Three concurrent layout/page-style reference calls issue one query despite different option objects; different character keys issue another.
- Identical catalog calls share one query; system/type changes remain distinct.
- Permissive reads do not bypass another reader's strict version checks.
- A later request receives its own authorized data, changed versions and failure recovery.
- Explicit post-write reads and actual sheet reconciliation see new pins despite a primed request cache.
- Outside server rendering the reader does not retain a cache.

These establish helper/flow behavior under a modeled request scope, not actual Next renderer/auth isolation or all hosted RLS variants. Framework guidance was read from installed Next 16.2.10 fetching-data documentation and the [React cache reference](https://react.dev/reference/react/cache).

## Local validation

Final source check: npm run check passed types, lint, 211 files / 2,028 tests. Production build passed with process-local nonsecret public placeholders pointing at localhost; an earlier build without public settings failed prerendering forgot-password. No secret/configuration file was copied. Browser runs load only the existing approved seven settings internally.

Focused suite: nine new regressions passed. After the last mobile locator-only edit, types/lint passed again; production code was unchanged after the successful build. git diff --check passed.

Temp logs: inkborne-dedup-final-check.txt, inkborne-dedup-build.txt, inkborne-dedup-preflight.txt.

## Live coverage and honest limitations

Existing approved project etcaodglvcspcmwecyxq and the two existing approved accounts passed preflight. Reused durable run journal c9e2c9a0-0440-4d10-88b3-313bef708a28 so the six-attempt limit includes the prior cleaned fixture. One new fixture was created: 0f569bf2-4533-44fe-8bcf-b16b48327cb6. Total **two of six** creation attempts, both now cleaned; **four remain**. No broad discovery/cleanup, migrations, timeouts, indexes, RLS, functions, account, security, hosted settings or infrastructure changes.

The real creation/builder refresh/secondary-account update attempt with unchanged owner readback passed (5.9s). The journey selected existing Half-Orc/Barbarian, class skills, ability scores, Acolyte/languages and starting equipment, then reached/refreshed the desktop sheet and verified persisted refs/inventory. Those assertions passed on the runs. This establishes ordinary-path equipment persistence, not equipment atomicity or ambiguous write recovery.

**The journey suite did not pass in full.** Three capped runs on the same fixture reached the final mobile assertion and failed on test locators:
1. Mobile name is a paragraph; heading locator found no visible heading.
2. The intended replacement had not matched line endings before the continuation loaded, so the same failure repeated.
3. Changed text locator's first match was the hidden desktop heading, ahead of the visible mobile paragraph.

Final source filters exact-name text with :visible; types/lint passed, but this final locator correction was not rerun live after the cap. Mobile acceptance therefore remains unverified. Error-context snapshots showed the mobile sheet and name; they are diagnostic evidence, not a passing assertion. No further browser writes/retries were made after this cap. Logs: inkborne-dedup-browser.txt, inkborne-dedup-browser-continuation.txt, inkborne-dedup-browser-final.txt. No new creation occurred in continuations (--project journey --no-deps).

## Request and timing evidence

Read-only hosted log window 14:31:15–14:34:40 UTC across all three runs: **zero PostgreSQL 57014 errors and zero scoped HTTP 500s**. No timeout was reproduced during this bounded attempt. This does not prove deduplication resolved the earlier database failure.

For the first new run, 14:31:15–14:32:20 UTC (includes creation, polling, audit and desktop journey), gateway upstream timings/counts:
| Requests | Count | Median ms | Max ms | HTTP 500 |
| --- | ---: | ---: | ---: | ---: |
| Joined/bare character refs GET | 18 | 11.5 | 39 | 0 |
| Catalog GET | 43 | 12 | 175 | 0 |
| Character GET | 59 | 3 | 18 | 0 |
| Character PATCH | 16 | 10 | 46 | 0 |

Historical partial failed journey, 13:54–14:01 UTC:
| Requests | Count | Median ms | Max ms | HTTP 500 |
| --- | ---: | ---: | ---: | ---: |
| Character refs GET | 9 | 6,027 | 16,534 | 2 |
| Catalog GET | 33 | 5,250 | 14,007 | 0 |
| Character GET | 23 | 1,914 | 9,754 | 0 |
| Character PATCH | 4 | 2,439.5 | 15,927 | 1 |

Different windows, incomplete vs complete journeys, polling/audit calls, warm-up and backend conditions prevent a controlled before/after request-reduction or causal latency conclusion. Local simulated concurrent calls demonstrate 3-to-1 helper query reduction; logs demonstrate this run was responsive. Request-scoped deduplication intentionally does not combine separate refresh/navigation/prefetch requests. Root cause of the prior timeouts remains unresolved; see the earlier query-profile handoff.

Sanitized aggregates are retained in ignored dedup-request-metrics.json and a duplicate under task-5. No tokens, passwords or raw request headers were printed or persisted there.

## Cleanup and next work

Before cleanup, exact-child audit recorded 5 refs, 23 feature grants, 10 inventory rows; six other child scopes were empty. All child IDs were recorded. The reviewed cleanup plan contained only 0f569bf2-4533-44fe-8bcf-b16b48327cb6. The explicit action-time reviewed cleanup command revalidated exact owner/name/id, deleted the fixture and verified parent plus all nine child scopes absent; durable cleaned receipt persisted. The old fixture's cleaned receipt remains intact. New evidence is preserved separately so earlier cleanup evidence is not replaced.

Playwright-managed local servers on port 3015 (same isolated cwd) were stopped by the runner. First server PID 34704 with launcher PIDs 7132/26864, started near 14:31:25 UTC; continuation server PID 17892 with launchers 7516/30244; final server PID 7172 with launchers 21428/34664. Full logs retain worker PIDs. Final port probe returned ECONNREFUSED. No unrelated process/worktree was changed.

Next narrow acceptance is the corrected mobile assertion and real HP/cast/rest retained Activity lifecycle under approved bounded scope, plus denial/concurrency/response-loss cases. Do not claim release readiness or timeout remediation. Equipment atomicity and durable cross-client/ambiguous write outcomes still require separate design/approval; no schema implementation, push, merge or deployment occurred.

