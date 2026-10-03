# Read-only hosted timeout profile — 2026-10-03

Scope: approved project etcaodglvcspcmwecyxq; no fixture creation, writes, schema, role grants, timeout, index, RLS, function, infrastructure or dependency changes. Existing exact-ID cleanup from run c9e2c9a0-0440-4d10-88b3-313bef708a28 remains complete. One of six creation attempts used. Credentials stayed internal.

## Exact failure and role

Window inspected: 13:54–14:01 UTC. PostgreSQL logs contain three SQLSTATE 57014 errors:
- 13:57:33.777: SELECT character_content_refs filtered by character_id, LEFT JOIN LATERAL content_versions on content_id/version, projected immutable snapshot fields, PostgREST JSON aggregate. Context: SQL function private.can_view_character during startup.
- 13:57:36.017: PATCH characters choices JSON by exact id, RETURNING id, PostgREST JSON aggregate. Context: private.prune_inactive_asi_choices_before_choices line 9, pruning asi_choices through feature grants, controller refs, controller/feature versions and selected class levels.
- 13:57:36.018: same reference/snapshot SELECT shape; empty context.

All three API calls were authenticated; database connection user was authenticator. Their HTTP status was 500, gateway upstream times 16,534 / 15,927 / 13,674ms. These are end-to-end upstream durations, not measured database execution times. Role configs remained authenticated 8s, anon 3s, authenticator statement/lock timeout 8s.

The deleted fixture was b7099e42-1781-48d2-8e39-5472e61609b1. Its pre-cleanup volume was four refs and 23 class feature grants. The failure occurred after Half-Orc/Barbarian and Athletics had saved. No blind write retry was performed.

## Volume and plans

Catalog estimates (pg_class.reltuples, not exact counts): characters 11; refs 21; feature grants 129; definitions 1,537; versions 1,537; shares 1. Definitions ~6.47MB, versions ~3.86MB. Database postmaster started 13:34:31.258 UTC, about 23 minutes before errors. Restart timing alone does not establish cold-start cause.

Nonexecuting EXPLAIN FORMAT JSON compared a structurally equivalent narrowed-projection reference/lateral-snapshot SELECT. Authenticated role and the existing approved owner claim were transaction-local in BEGIN READ ONLY, followed by ROLLBACK. No persistent permissions/settings changed. The already deleted fixture filter means these are planner comparisons, not populated-fixture runtime reproductions:
- Admin: cost 3.78, one estimated outer row; tiny refs sequential scan, unique content/version index lookup.
- Authenticated: cost 30.03, one estimated outer row; character_id index access, unique content/version lookup; RLS adds visibility filters and indexed reference/inventory/spell ownership subplans.
- Authenticated feature catalog query: identity index on system_id/content_type, sort by name, 406 estimated rows, cost 1,638.04. Cost units are not milliseconds.

Existing indexes cover character_id and content/version joins. No absent-index conclusion follows. Both timeout-context helpers are SECURITY DEFINER, owned by postgres with bypassrls; characters/refs do not force RLS. This excludes the apparent direct characters-policy self-recursion through can_view_character. It does not prove all policies optimal.

Broad successful pg_stat_statements entries containing character_content_refs had maxima up to 1,189.88ms in the limited top-five snapshot. They are not matched failing requests, and do not include canceled statements reliably; no root-cause inference is made from them.

## Reproducibility and concurrency evidence

During the original journey, requests succeeded immediately before and after the failures. Four exact-fixture read-only probes later passed: owner character 2,408ms; owner bare refs 3,215ms; owner joined snapshots 1,791ms; trusted joined snapshots 1,330ms. These happened before cleanup. Current profiling did not execute heavy EXPLAIN ANALYZE or recreate that fixture.

Edge logs show duplicate catalog/read bursts: at 13:56:53.179–.184 and .237–.242, five catalog types plus refs repeated roughly 60ms apart. At 13:57:22 and 13:57:24, another repeated catalog/ref fan-out coincided with the failing choice PATCH. Some successful catalog requests exceeded 8 seconds upstream. Source inspection confirms the class page loads class/subclass/feature/spell/language plus refs concurrently, while builder layout also reads refs. Duplicate workload is evidenced; it is not proven to have caused cancellation.

## Narrow proposal and approval boundary

Client-only candidate: deduplicate identical builder refs/catalog reads within a single server render/request using an appropriate request-scoped mechanism; preserve authenticated user scope, complete-snapshot validation, mutation refresh semantics and errors. Measure request counts and controlled latency before/after. Avoid cross-user persistent caching and automatic write retries. This is a workload reduction proposal, not a verified timeout fix, and was not implemented in this profiling phase.

Do not raise timeouts or add indexes based on the present evidence. If cancellation recurs under reduced controlled load, obtain bounded populated authenticated execution evidence and relevant database resource/lock observations before proposing a specific database remedy. Any index, RLS/helper/trigger, timeout or infrastructure change requires explicit approval. No durable-action/equipment schema implementation is included.

Root cause remains unresolved: neither inefficient execution nor transient restoration/resource contention has been established. Authenticated create/refresh and secondary-account unchanged-owner readback passed previously; full builder-to-sheet, HP/cast/rest real Activity recovery, denial variants, concurrency and response-loss remain unaccepted. No new acceptance fixture is authorized in this phase.

Evidence: sanitized planner JSON in ignored test-results/bounded-runs/c9e2c9a0-0440-4d10-88b3-313bef708a28/query-profile.json; original cleaned journal/owned-rows/read-diagnostics retained. This documentation-only checkpoint does not alter the 210-file / 2,019-test passing application baseline.

