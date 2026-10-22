import { setTimeout as pause } from "node:timers/promises";

/** Closed disposable-fixture runner. Supplying a session does not authorize a
 * native run. The caller owns approval, target/source freeze and OS lifecycle. */
export interface NativeSession {
  backendPid: number;
  query(sql: string): Promise<Record<string, unknown>[]>;
  close(): Promise<void>;
}
export interface CommandSessions { blocker: NativeSession; checker: NativeSession; observer: NativeSession }
export const CONCURRENCY_IDS = Object.freeze({ actor: "10000000-0000-4000-8000-000000000001",
  session: "10000000-0000-4000-8000-000000000002", target: "10000000-0000-4000-8000-000000000003",
  foreignActor: "10000000-0000-4000-8000-000000000004" });
const names = { blocker: "inkborne-authrows-blocker", checker: "inkborne-authrows-checker", observer: "inkborne-authrows-observer" };
const { actor, session, target, foreignActor } = CONCURRENCY_IDS;
export const RESET_SQL = `DO $$ BEGIN
UPDATE auth.users SET aud='authenticated',role='authenticated',is_anonymous=false,deleted_at=NULL,banned_until=NULL WHERE id='${actor}';
INSERT INTO auth.sessions(id,user_id,not_after) VALUES('${session}','${actor}',NULL)
ON CONFLICT(id) DO UPDATE SET user_id=EXCLUDED.user_id,not_after=NULL;
UPDATE public.characters SET user_id='${actor}' WHERE id='${target}';
END; $$;`;
export const CONCURRENCY_SCENARIOS = ["checker-first-session-delete", "delete-first-checker-refuses", "ban-first-checker-refuses",
  "owner-transfer-first-checker-refuses", "guard-wait-jwt-expiry", "session-wait-not-after-expiry",
  "failure-rollback-releases-locks", "api-execute-denials"] as const;
type Scenario = typeof CONCURRENCY_SCENARIOS[number] | "setup";
export interface LockEdge { waiterPid: number; blockerPid: number; observedAtUTC: string; deadlineExpired: boolean }
export interface ScenarioEvidence {
  scenario: Scenario; status: "passed" | "failed"; startedUTC: string; finishedUTC?: string;
  edges: LockEdge[]; deadlineUTC?: string; expectedSqlstate?: string; observedSqlstate?: string;
  deniedRoles?: string[]; reason?: string;
}
export interface ConcurrencyReport {
  kind: "character-command-concurrency-observations-v1";
  authenticationAccepted: false;
  scenarios: ScenarioEvidence[]; sessionsClosed: boolean; passed: boolean;
}
class SafeFailure extends Error {
  constructor(message: string, readonly sqlstate?: string) { super(message); }
}
function code(error: unknown): string | undefined {
  const value = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return typeof value === "string" && /^[0-9A-Z]{5}$/.test(value) ? value : undefined;
}
async function bounded<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new SafeFailure("Scenario wall-time bound exceeded")), Math.max(1, milliseconds));
    })]);
  } finally { clearTimeout(timer); }
}
function quotedDeadline(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000000Z$/.test(value)) {
    throw new SafeFailure("Native deadline shape is unavailable");
  }
  return `'${value}'::timestamptz`;
}
function callSql(deadline: string): string {
  return `SELECT private.lock_character_command_rows_v1(jsonb_build_object('context_version',1,'actor_id','${actor}',
'session_id','${session}','jwt_expires_at',to_char(${quotedDeadline(deadline)} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),'${target}'::uuid);`;
}

/** Evidence records SQLSTATEs and backend lock edges only. No Auth row values,
 * token/user payloads, raw errors, query text or secrets enter the report.
 * Tests using scripted sessions must label their results SIMULATED; this
 * injected interface cannot attest whether a transport is actual PostgreSQL. */
export async function runCharacterCommandConcurrency(sessions: CommandSessions,
  options: { maxScenarioMs?: number; pollMs?: number } = {}): Promise<ConcurrencyReport> {
  const maxMs = options.maxScenarioMs ?? 15_000, pollMs = options.pollMs ?? 25;
  const report: ConcurrencyReport = { kind: "character-command-concurrency-observations-v1",
    authenticationAccepted: false, scenarios: [], sessionsClosed: false, passed: false };
  let end = Date.now() + maxMs, commands = 0;
  let evidence: ScenarioEvidence = { scenario: "setup", status: "failed", startedUTC: new Date().toISOString(), edges: [] };
  const list = [sessions.blocker, sessions.checker, sessions.observer];
  const run = async (connection: NativeSession, sql: string) => {
    if (++commands > 1024) throw new SafeFailure("Finite query budget exceeded");
    const remaining = end - Date.now();
    if (remaining <= 0) throw new SafeFailure("Scenario wall-time bound exceeded");
    try { return await bounded(connection.query(sql), remaining); }
    catch (error) {
      if (error instanceof SafeFailure) throw error;
      throw new SafeFailure("Session query failed", code(error));
    }
  };
  const begin = async (connection: NativeSession) => {
    // One top-level statement per transport frame: an earlier failure must
    // never be hidden by a later successful statement's SQLSTATE.
    await run(connection, "BEGIN;");
    await run(connection, `SET LOCAL lock_timeout='${Math.max(1, maxMs - 250)}ms';`);
    await run(connection, `SET LOCAL statement_timeout='${Math.max(1, maxMs - 100)}ms';`);
  };
  const deadline = async (seconds: 3 | 3600, connection = sessions.checker) => {
    const rows = await run(connection, `SELECT to_char((date_trunc('second',clock_timestamp()) + interval '${seconds} seconds')
AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS deadline;`);
    quotedDeadline(rows[0]?.deadline);
    return rows[0].deadline as string;
  };
  const start = (connection: NativeSession, sql: string) => {
    let settled = false;
    const result = run(connection, sql).then(() => ({ sqlstate: undefined }), error => {
      if (!(error instanceof SafeFailure) || !error.sqlstate) throw error;
      return { sqlstate: error.sqlstate };
    }).finally(() => { settled = true; });
    // A later observer refusal must not leave a rejecting query unhandled.
    void result.catch(() => undefined);
    return { result, settled: () => settled };
  };
  const expectCode = async (pending: ReturnType<typeof start>, expected?: string) => {
    const result = await pending.result;
    if (expected !== undefined || result.sqlstate !== undefined) {
      evidence.expectedSqlstate = expected; evidence.observedSqlstate = result.sqlstate;
    }
    if (result.sqlstate !== expected) throw new SafeFailure("Unexpected statement outcome", result.sqlstate);
  };
  const observe = async (waiter: "checker" | "blocker", holder: "checker" | "blocker", until?: string) => {
    const rows = await run(sessions.observer, `SELECT waiter.pid AS waiter_pid,holder.pid AS blocker_pid,
waiter.application_name AS waiter_name,holder.application_name AS blocker_name,waiter.state,waiter.wait_event_type,
(holder.pid=ANY(pg_blocking_pids(waiter.pid))) AS blocked,
to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS observed_at,
${until ? `clock_timestamp() >= ${quotedDeadline(until)}` : "false"} AS expired
FROM pg_stat_activity AS waiter CROSS JOIN pg_stat_activity AS holder
WHERE waiter.pid=${sessions[waiter].backendPid} AND holder.pid=${sessions[holder].backendPid};`);
    const row = rows[0];
    if (rows.length !== 1 || row.waiter_pid !== sessions[waiter].backendPid || row.blocker_pid !== sessions[holder].backendPid
      || row.waiter_name !== names[waiter] || row.blocker_name !== names[holder] || typeof row.expired !== "boolean"
      || typeof row.observed_at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(row.observed_at)) {
      throw new SafeFailure("Exact backend observation is unavailable");
    }
    return { row, edge: { waiterPid: row.waiter_pid as number, blockerPid: row.blocker_pid as number,
      observedAtUTC: String(row.observed_at), deadlineExpired: row.expired } };
  };
  const blocked = async (waiter: "checker" | "blocker", holder: "checker" | "blocker", pending: ReturnType<typeof start>, until?: string) => {
    for (;;) {
      const { row, edge } = await observe(waiter, holder, until);
      if (pending.settled()) throw new SafeFailure("Statement settled before its blocking edge was proved");
      if (row.blocked === true && row.wait_event_type === "Lock" && row.state === "active") {
        if (until && edge.deadlineExpired) throw new SafeFailure("Deadline expired before initial blocking proof");
        evidence.edges.push(edge); return;
      }
      await bounded(pause(pollMs), end - Date.now());
    }
  };
  const expireWhileBlocked = async (pending: ReturnType<typeof start>, until: string) => {
    for (;;) {
      const { row, edge } = await observe("checker", "blocker", until);
      if (pending.settled() || row.blocked !== true || row.wait_event_type !== "Lock" || row.state !== "active") {
        throw new SafeFailure("Blocking edge disappeared before native deadline proof");
      }
      if (edge.deadlineExpired) { evidence.edges.push(edge); return; }
      await bounded(pause(pollMs), end - Date.now());
    }
  };
  const refusalAfterMutation = async (mutation: string) => {
    await begin(sessions.blocker); await run(sessions.blocker, mutation);
    await begin(sessions.checker);
    const pending = start(sessions.checker, callSql(await deadline(3600)));
    await blocked("checker", "blocker", pending);
    await run(sessions.blocker, "COMMIT;"); await expectCode(pending, "P0001");
  };
  try {
    if (!Number.isInteger(maxMs) || maxMs < 100 || maxMs > 30_000 || !Number.isInteger(pollMs) || pollMs < 1 || pollMs > 250
      || list.some(connection => !Number.isSafeInteger(connection.backendPid) || connection.backendPid <= 0)
      || new Set(list.map(connection => connection.backendPid)).size !== 3) throw new SafeFailure("Invalid bounded session configuration");
    const identities: Record<string, unknown>[] = [];
    for (const role of ["blocker", "checker", "observer"] as const) {
      await run(sessions[role], `SET application_name='${names[role]}';`);
      const rows = await run(sessions[role], "SELECT pg_backend_pid() AS pid,current_database() AS database,current_user AS role;");
      if (rows.length !== 1 || rows[0].pid !== sessions[role].backendPid) throw new SafeFailure("Session backend identity mismatch");
      identities.push(rows[0]);
    }
    if (identities.some(row => row.database !== identities[0].database || row.role !== identities[0].role)) throw new SafeFailure("Sessions do not share the same target and role");
    for (const scenario of CONCURRENCY_SCENARIOS) {
      end = Date.now() + maxMs;
      evidence = { scenario, status: "failed", startedUTC: new Date().toISOString(), edges: [] };
      report.scenarios.push(evidence);
      await run(sessions.observer, RESET_SQL);
      if (scenario === "checker-first-session-delete" || scenario === "failure-rollback-releases-locks") {
        await begin(sessions.checker); await run(sessions.checker, callSql(await deadline(3600)));
        await begin(sessions.blocker);
        const pending = start(sessions.blocker, `DELETE FROM auth.sessions WHERE id='${session}';`);
        await blocked("blocker", "checker", pending);
        if (scenario === "failure-rollback-releases-locks") {
          await expectCode(start(sessions.checker, "SELECT 1/0 AS intentional_failure;"), "22012");
          await run(sessions.checker, "ROLLBACK;");
        } else await run(sessions.checker, "COMMIT;");
        await expectCode(pending); await run(sessions.blocker, "COMMIT;");
      } else if (scenario === "delete-first-checker-refuses") {
        await refusalAfterMutation(`DELETE FROM auth.sessions WHERE id='${session}';`);
      } else if (scenario === "ban-first-checker-refuses") {
        await refusalAfterMutation(`UPDATE auth.users SET banned_until=clock_timestamp()+interval '1 hour' WHERE id='${actor}';`);
      } else if (scenario === "owner-transfer-first-checker-refuses") {
        await refusalAfterMutation(`UPDATE public.characters SET user_id='${foreignActor}' WHERE id='${target}';`);
      } else if (scenario === "guard-wait-jwt-expiry" || scenario === "session-wait-not-after-expiry") {
        const expiry = await deadline(3, sessions.observer); evidence.deadlineUTC = expiry;
        if (scenario === "session-wait-not-after-expiry") {
          await run(sessions.observer, `UPDATE auth.sessions SET not_after=${quotedDeadline(expiry)} WHERE id='${session}';`);
        }
        await begin(sessions.blocker);
        await run(sessions.blocker, scenario === "guard-wait-jwt-expiry"
          ? "SELECT singleton FROM private.character_writer_guard_v1 WHERE singleton=true FOR UPDATE;"
          : `SELECT id FROM auth.sessions WHERE id='${session}' FOR UPDATE;`);
        await begin(sessions.checker);
        const pending = start(sessions.checker, callSql(scenario === "guard-wait-jwt-expiry" ? expiry : await deadline(3600)));
        await blocked("checker", "blocker", pending, expiry);
        await expireWhileBlocked(pending, expiry);
        await run(sessions.blocker, "ROLLBACK;"); await expectCode(pending, "P0001");
      } else {
        evidence.deniedRoles = [];
        for (const role of ["anon", "authenticated", "service_role"]) {
          const expires = await deadline(3600);
          await begin(sessions.checker); await run(sessions.checker, `SET LOCAL ROLE ${role};`);
          await expectCode(start(sessions.checker, callSql(expires)), "42501");
          evidence.deniedRoles.push(role); await run(sessions.checker, "ROLLBACK;");
        }
      }
      // Own idle/aborted transactions are explicitly ended between cases.
      await run(sessions.blocker, "ROLLBACK;"); await run(sessions.checker, "ROLLBACK;");
      evidence.status = "passed"; evidence.finishedUTC = new Date().toISOString();
    }
    // Restore the exact committed fixture for the caller's no-residue audit.
    await run(sessions.observer, RESET_SQL);
  } catch (error) {
    if (!report.scenarios.includes(evidence)) report.scenarios.push(evidence);
    evidence.status = "failed"; evidence.finishedUTC = new Date().toISOString();
    evidence.reason = error instanceof SafeFailure ? error.message : "Unclassified runner failure";
    if (error instanceof SafeFailure && error.sqlstate) evidence.observedSqlstate = error.sqlstate;
    // Stop immediately; no new fixture work after an unproved/failed case.
  } finally {
    const closed = await Promise.allSettled(list.map(connection => bounded(Promise.resolve().then(() => connection.close()), 5000)));
    report.sessionsClosed = closed.every(result => result.status === "fulfilled");
  }
  report.passed = report.sessionsClosed && report.scenarios.length === CONCURRENCY_SCENARIOS.length
    && report.scenarios.every(item => item.status === "passed");
  return report;
}
