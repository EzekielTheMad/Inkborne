import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { z } from "zod";
import { CharacterPsqlSession, type SessionProcess } from "../character-command-psql";
import { runBuilderParentAdmissionContention, PARENT_CONTENTION_CASES } from "../builder-parent-admission-concurrency";
import { assertNativeIdentity, nativeJson, psqlArguments, psqlEnvironment, testRuntime } from "./native";

// Reuse the genuine native cases and framed three-session protocol. No Docker
// API/socket or historical browser-receipt chain is needed inside this runner.
export async function verifyNativeParentFixture(characterId: string, actorId: string) {
  z.uuid().parse(characterId); z.uuid().parse(actorId); assertNativeIdentity();
  const runtime = testRuntime(), variables = { character_id: characterId, actor_id: actorId };
  const read = (name: string) => fs.readFileSync(`supabase/verification/${name}.sql`, "utf8");
  const before = await nativeJson(read("builder-parent-admission-readback"), variables);
  const catalogBefore = await nativeJson(read("builder-parent-admission-catalog"));
  const processes: SessionProcess[] = [], captures: Array<{ pid: number; birth: string; tag: string }> = [], sessions: CharacterPsqlSession[] = [];
  const tags: string[] = []; let negatives: unknown, contention: unknown, failed = false, clean = false;
  const open = async (side: string) => {
    const tag = `ib-${runtime.runId.slice(0, 8)}-${side}`; tags.push(tag);
    const args = psqlArguments("postgres", {}, false), child = spawn("psql", args, { env: psqlEnvironment(tag), stdio: ["pipe", "pipe", "pipe"] });
    const record: SessionProcess = { pid: child.pid!, parentPid: process.pid, cwd: process.cwd(), executable: "psql", args,
      startedUtc: new Date().toISOString(), ports: [], stderrBytes: 0 };
    processes.push(record); const session = new CharacterPsqlSession(child, record, value => Object.assign(record, value)); sessions.push(session);
    const rows = await session.query("SELECT pg_backend_pid() AS pid,backend_start::text AS birth,current_setting('application_name') AS tag FROM pg_stat_activity WHERE pid=pg_backend_pid()");
    assert.equal(rows.length, 1); const row = z.object({ pid: z.number().int().positive(), birth: z.string(), tag: z.literal(tag) }).parse(rows[0]);
    session.backendPid = row.pid; captures.push(row); return session;
  };
  try {
    const cases = await nativeJson(read("builder-parent-admission-cases"), variables) as { caseCount: number; cases: Array<{ role: string; case: string; outcome: string; sqlstate: string; affectedRows?: number }> };
    assert.equal(cases.caseCount, 34);
    const names = ["state", "scores", "choices", "level", "system", "campaign", "archive", "owner", "identity", "revision", "delete", "state_patch", "state_cas", "ability_rpc", "background_rpc", "asi_rpc"];
    const expected = ["authenticated", "service_role"].flatMap(role => [...names.map(name => role === "authenticated" && name === "delete"
      ? { role, case: name, outcome: "rls_no_rows_unchanged", sqlstate: "00000", affectedRows: 0 }
      : { role, case: name, outcome: "refused_unchanged", sqlstate: "42501" }), { role, case: "metadata", outcome: "allowed_then_rolled_back", sqlstate: "00000" }]);
    const sorted = <T extends { role: string; case: string }>(values: T[]) => [...values].sort((a, b) => `${a.role}/${a.case}`.localeCompare(`${b.role}/${b.case}`));
    assert.deepEqual(sorted(cases.cases), sorted(expected)); negatives = cases;
    const bundle = { blocker: await open("blocker"), checker: await open("checker"), observer: await open("observer") };
    const report = await runBuilderParentAdmissionContention(bundle, { characterId, actorId }, { maxScenarioMs: 8000, pollMs: 25 });
    assert.equal(report.passed, true); assert.equal(report.sessionsClosed, true);
    assert.deepEqual(report.cases.map(item => item.name), [...PARENT_CONTENTION_CASES]);
    for (const item of report.cases) {
      assert.equal(item.status, "passed"); assert.equal(item.parentProbeSucceeded, true);
      assert(item.edge && item.edge.blockerPid !== item.edge.waiterPid); assert.equal(item.beforeDigest, item.afterDigest);
      assert.equal(item.observedSqlstate, item.name === "owner-delete" ? "00000" : "42501");
      if (item.name === "owner-delete") assert.equal(item.affectedRows, 0);
    }
    contention = report;
  } catch { failed = true; }
  finally {
    for (const session of sessions) await session.close().catch(() => { failed = true; });
    const lit = (value: string) => "'" + value.replaceAll("'", "''") + "'";
    try {
      const live = await nativeJson(`BEGIN READ ONLY; SELECT COALESCE(jsonb_agg(jsonb_build_object('pid',pid,'birth',backend_start::text,'tag',application_name)),'[]')
        FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND (application_name=ANY(ARRAY[${tags.map(lit).join(",")}]::text[])
        OR pid=ANY(ARRAY[${captures.map(item => item.pid).join(",")}]::integer[])); ROLLBACK;`, {}, "supabase_admin") as Array<{ pid: number; birth: string; tag: string }>;
      for (const row of live) {
        const captured = captures.find(item => item.pid === row.pid);
        assert(captured && row.birth === captured.birth && [captured.tag, "inkborne-parent-blocker", "inkborne-parent-checker", "inkborne-parent-observer"].includes(row.tag), "native backend identity changed");
        await nativeJson(`SELECT to_json(COALESCE(bool_and(pg_terminate_backend(pid)),true)) FROM pg_stat_activity WHERE pid=${row.pid} AND backend_start=${lit(row.birth)}::timestamptz AND application_name=${lit(row.tag)}`, {}, "supabase_admin");
      }
      const remaining = await nativeJson(`SELECT count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND
        (pid=ANY(ARRAY[${captures.map(item => item.pid).join(",")}]::integer[]) OR application_name=ANY(ARRAY[${tags.map(lit).join(",")}]::text[]))`, {}, "supabase_admin");
      assert.equal(remaining, 0); assert(processes.every(item => item.finishedUtc)); clean = true;
    } catch { failed = true; }
  }
  assertNativeIdentity();
  const after = await nativeJson(read("builder-parent-admission-readback"), variables), catalogAfter = await nativeJson(read("builder-parent-admission-catalog"));
  assert.deepEqual(after, before); assert.deepEqual(catalogAfter, catalogBefore);
  const result = { passed: !failed && clean, authenticationAccepted: false, fixture: { characterId, actorId }, negatives, contention,
    cleanup: { allCapturedBackendsGone: clean, allClientsExited: processes.every(item => item.finishedUtc) }, retainedFixture: true, retainedCatalog: true };
  fs.writeFileSync("/output/native-parent.json", JSON.stringify(result, null, 2) + "\n");
  assert(result.passed, "native parent verification failed; preserve native report"); return result;
}
