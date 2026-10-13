import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STAGES } from "../../scripts/core-db-verification";
const runner = readFileSync("scripts/core-db-verification.ts", "utf8");
const preflight = readFileSync("scripts/core-db-verification/preflight.sql", "utf8");
const assertions = readFileSync("scripts/core-db-verification/disabled-assertions.sql", "utf8");
describe("core disabled profile SOURCE contract; not SQL execution", () => {
  it("keeps ordered complete D1-D5 stages separate from original equipment execution", () => {
    expect(STAGES).toEqual(["supabase/staged/hit-die-transaction.sql", "supabase/staged/hit-die-authority-and-writers.sql",
      "supabase/staged/class-origin-producer.sql", "supabase/staged/class-origin-joint-revision.sql", "supabase/staged/class-origin-confirmation-producer.sql"]);
    expect(runner).toContain("actual separate human G2 record/profile/target confirmation required");
    expect(runner).toContain("sameAudit(initial, lineage.cleanup.audits.at(-1)!)");
    expect(runner).not.toContain("executeFixtures("); expect(runner).not.toContain("executeApproved(");
    expect(runner).not.toMatch(/docker.*(?:compose up|pull|prune)/);
  });
  it("refuses partial roles/objects before any DDL and invokes only exact always-denied seams", () => {
    expect(preflight).toContain("Disabled family role already present; no replay/resume");
    expect(preflight).toContain("Partial disabled installation detected");
    for (const sql of [preflight, assertions]) {
      expect(sql).toContain("BEGIN READ ONLY;"); expect(sql).toContain("COMMIT;");
      expect(sql).not.toMatch(/^\s*(?:GRANT|REVOKE|ALTER|CREATE|INSERT|UPDATE|DELETE|DROP)\s/gm);
    }
    expect(assertions).toContain("count(*) FROM private.character_writer_readiness_v1)<>13");
    expect(assertions).toContain("WHERE ready");
    expect(assertions).toContain('{"status":"unready","reason":"auth_unavailable"}');
    expect(assertions).toContain("EXCEPTION WHEN SQLSTATE 'P0001'");
    expect(assertions).toContain("IF message<>'auth_unavailable' THEN RAISE");
    expect(assertions).not.toContain("SET ready"); expect(assertions).not.toContain("SET enabled");
  });
  it("inspects effective columns, closed ownership/bridges and immutable/deferred metadata without claiming FOR SHARE proof", () => {
    for (const token of ["pg_catalog.has_column_privilege", "NOT polpermissive", "pg_catalog.pg_get_expr(polwithcheck,polrelid)='false'",
      "pg_catalog.pg_auth_members", "class_confirmation_no_mutation", "Immutable receipt runtime privileges drift",
      "tgdeferrable AND tginitdeferred", "condeferrable AND condeferred AND convalidated", "pg_catalog.pg_get_functiondef"]) expect(assertions).toContain(token);
    expect(assertions).toContain("No positive Auth/history/locking/atomicity/replay/unreachable-body acceptance");
  });
  it("source guard retains first uncertainty, time/command/evidence caps and no result-only identity fallback", () => {
    expect(runner).toContain("durationMs: 900_000, commands: 500");
    expect(runner).toContain("evidenceBytes: 10 * 1024 * 1024");
    expect(runner).toContain("captureFailed || !identity || !absent || !result");
    expect(runner).toContain("journal.status = \"uncertain\"");
    expect(runner).toContain("Never continue after observer or journal uncertainty");
    expect(runner).not.toContain("taskkill"); expect(runner).not.toContain(".kill(");
    expect(runner).toContain("mode === \"freeze\"");
  });
});
