// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CONCURRENCY_SCENARIOS, EXTENDED_CONCURRENCY_SCENARIOS, RESET_SQL, runCharacterCommandConcurrency, type CommandSessions,
  type NativeSession } from "../../scripts/character-command-concurrency";

// SIMULATED protocol tests only. Scripted SQLSTATEs, pg_stat_activity rows and
// clocks below are not native PostgreSQL/Auth/concurrency acceptance evidence.
type Role = keyof CommandSessions;
type Fault = "wrong-backend" | "wrong-observer-edge" | "wrong-name" | "no-block" | "early-settle"
  | "wrong-refusal" | "clock-never-expires" | "close-failure" | "private-error" | "role-switch-failure"
  | "extended-row-drift" | "absence-rollback-drift" | "clock-helper-allowed";
function simulated(fault?: Fault, profile: "baseline" | "extended" = "baseline") {
  const commands: Array<{ role: Role; sql: string }> = [];
  const closed: Role[] = [];
  const pids = { blocker: 101, checker: 102, observer: 103 };
  const names = { blocker: "inkborne-authrows-blocker", checker: "inkborne-authrows-checker", observer: "inkborne-authrows-observer" };
  let scenario = -1, observations = 0, currentRole = "postgres", digestReads = 0, absenceMutated = false, rollbackCorrupt = false;
  const inventory = profile === "extended" ? EXTENDED_CONCURRENCY_SCENARIOS : CONCURRENCY_SCENARIOS;
  const scenarioName = () => inventory[scenario];
  const checkerFirst = () => scenarioName()?.startsWith("checker-first-") || scenarioName() === "failure-rollback-releases-locks";
  const absenceCase = () => scenarioName()?.endsWith("-transaction-refuses");
  const pending = new Map<Role, { resolve(rows: Record<string, unknown>[]): void; reject(error: unknown): void }>();
  const stateError = (code: string) => Object.assign(new Error("SIMULATED private message must never enter evidence"), { code });
  const wait = (role: Role) => new Promise<Record<string, unknown>[]>((resolve, reject) => pending.set(role, { resolve, reject }));
  const release = (role: Role, code?: string) => {
    const operation = pending.get(role); pending.delete(role);
    if (code) operation?.reject(stateError(code)); else operation?.resolve([]);
  };
  const query = async (role: Role, sql: string): Promise<Record<string, unknown>[]> => {
    commands.push({ role, sql });
    if (fault === "private-error" && sql.startsWith("SET application_name")) throw stateError("XX001");
    if (sql === RESET_SQL) { scenario++; observations = 0; digestReads = 0; absenceMutated = false; rollbackCorrupt = false; return []; }
    if (sql.startsWith("SET application_name")) return [];
    if (sql.startsWith("SELECT pg_backend_pid()")) return [{ pid: fault === "wrong-backend" ? 999 : pids[role], database: "SIMULATED", role: "postgres" }];
    if (sql.startsWith("SELECT to_char((date_trunc")) return [{ deadline: "2099-01-01T00:00:03.000000Z" }];
    if (sql.includes("AS fixture_digest")) {
      digestReads++;
      const changed = (role === "checker" && absenceMutated) || rollbackCorrupt
        || (fault === "extended-row-drift" && scenarioName() === "read-only-complete-row-correspondence" && digestReads > 1);
      return [{ fixture_digest: (changed ? "b" : "a").repeat(32) }];
    }
    if (sql.includes("FROM pg_stat_activity")) {
      observations++;
      const waiter: Role = checkerFirst() ? "blocker" : "checker";
      const holder: Role = waiter === "blocker" ? "checker" : "blocker";
      const expired = scenarioName()?.endsWith("-expiry") && observations > 1 && fault !== "clock-never-expires";
      return [{ waiter_pid: fault === "wrong-observer-edge" ? 999 : pids[waiter], blocker_pid: pids[holder],
        waiter_name: fault === "wrong-name" ? "unrelated" : names[waiter], blocker_name: names[holder],
        state: "active", wait_event_type: "Lock", blocked: fault !== "no-block",
        observed_at: expired ? "2099-01-01T00:00:04.000000Z" : "2099-01-01T00:00:00.000000Z", expired }];
    }
    if (sql.startsWith("SET LOCAL ROLE")) {
      if (fault === "role-switch-failure") throw stateError("42501");
      currentRole = sql.match(/ROLE (\w+)/)![1]; return [];
    }
    if (sql.startsWith("SELECT private.lock_character_command_rows_v1")) {
      if (scenarioName() === "api-execute-denials" && currentRole !== "postgres") throw stateError("42501");
      if (absenceCase()) throw stateError("P0001");
      if (checkerFirst() || scenarioName() === "read-only-complete-row-correspondence" || fault === "early-settle") return [];
      return wait(role);
    }
    if (sql.startsWith("SELECT private.check_character_command_clock_v1")) {
      if (currentRole !== "postgres" && fault !== "clock-helper-allowed") throw stateError("42501");
      return [];
    }
    if (sql.startsWith("SELECT 1/0")) throw stateError("22012");
    if (role === "blocker" && checkerFirst() && (sql.startsWith("DELETE FROM auth.sessions")
      || sql.startsWith("UPDATE auth.users") || sql.startsWith("UPDATE public.characters"))) return wait(role);
    if (role === "checker" && absenceCase() && (sql.startsWith("DELETE ") || sql.startsWith("UPDATE "))) {
      absenceMutated = true; return [];
    }
    if (sql === "COMMIT;" || sql === "ROLLBACK;") {
      if (role === "checker") {
        currentRole = "postgres";
        if (checkerFirst()) release("blocker");
        if (absenceMutated && fault === "absence-rollback-drift") rollbackCorrupt = true;
        absenceMutated = false;
      }
      if (role === "blocker" && pending.has("checker")) release("checker", fault === "wrong-refusal" ? "42501" : "P0001");
      return [];
    }
    if (sql === "BEGIN;" || sql.startsWith("SET LOCAL lock_timeout=") || sql.startsWith("SET LOCAL statement_timeout=")
      || sql.startsWith("UPDATE ") || sql.startsWith("DELETE ") || sql.endsWith("FOR UPDATE;")) return [];
    throw new Error("SIMULATED unexpected fixture query");
  };
  const connection = (role: Role): NativeSession => ({ backendPid: pids[role], query: sql => query(role, sql), close: async () => {
    closed.push(role); release(role, "57014");
    if (fault === "close-failure" && role === "observer") throw new Error("SIMULATED private close detail");
  } });
  return { sessions: { blocker: connection("blocker"), checker: connection("checker"), observer: connection("observer") }, commands, closed };
}

describe("SIMULATED character command multi-session orchestration; no native acceptance", () => {
  it("records eight finite cases with exact lock edges, refusal states and native-clock observations", async () => {
    const fixture = simulated();
    const result = await runCharacterCommandConcurrency(fixture.sessions, { maxScenarioMs: 1000, pollMs: 1 });
    expect(result).toMatchObject({ authenticationAccepted: false, sessionsClosed: true, passed: true });
    expect(result.scenarios.map(item => item.scenario)).toEqual([...CONCURRENCY_SCENARIOS]);
    expect(result.scenarios.every(item => item.status === "passed")).toBe(true);
    expect(result.scenarios[0].edges).toMatchObject([{ waiterPid: 101, blockerPid: 102 }]);
    for (const index of [1, 2, 3, 4, 5]) expect(result.scenarios[index]).toMatchObject({ expectedSqlstate: "P0001", observedSqlstate: "P0001" });
    for (const index of [4, 5]) expect(result.scenarios[index].edges.map(edge => edge.deadlineExpired)).toEqual([false, true]);
    expect(result.scenarios[6]).toMatchObject({ expectedSqlstate: "22012", observedSqlstate: "22012" });
    expect(result.scenarios[7].deniedRoles).toEqual(["anon", "authenticated", "service_role"]);
    expect(fixture.closed.sort()).toEqual(["blocker", "checker", "observer"]);
    expect(fixture.commands.filter(command => command.sql === RESET_SQL)).toHaveLength(9);
    expect(RESET_SQL).toMatch(/^DO \$\$ BEGIN[\s\S]*END; \$\$;$/);
    expect(RESET_SQL).not.toContain("EXCEPTION");
    const begins = fixture.commands.filter(command => command.sql === "BEGIN;");
    expect(begins.length).toBeGreaterThan(0);
    for (let index = 0; index < fixture.commands.length; index++) {
      if (fixture.commands[index].sql !== "BEGIN;") continue;
      expect(fixture.commands[index + 1]).toMatchObject({ role: fixture.commands[index].role,
        sql: expect.stringMatching(/^SET LOCAL lock_timeout='\d+ms';$/) });
      expect(fixture.commands[index + 2]).toMatchObject({ role: fixture.commands[index].role,
        sql: expect.stringMatching(/^SET LOCAL statement_timeout='\d+ms';$/) });
    }
    expect(JSON.stringify(result)).not.toMatch(/private message|user_id|SELECT|auth\.users|context_version/);
  });

  it.each(["wrong-backend", "wrong-observer-edge", "wrong-name", "early-settle", "wrong-refusal"] as const)(
    "fails closed on %s and stops before subsequent fixture work", async fault => {
      const fixture = simulated(fault);
      const result = await runCharacterCommandConcurrency(fixture.sessions, { maxScenarioMs: 1000, pollMs: 1 });
      expect(result.passed).toBe(false); expect(result.scenarios.at(-1)?.status).toBe("failed");
      expect(result.scenarios.length).toBeLessThan(8); expect(fixture.closed).toHaveLength(3);
      const failedIndex = result.scenarios.length - 1;
      expect(fixture.commands.filter(command => command.sql === RESET_SQL).length).toBeLessThanOrEqual(failedIndex + 1);
    });

  it.each(["no-block", "clock-never-expires"] as const)("does not treat elapsed polling time as %s proof", async fault => {
    const fixture = simulated(fault);
    const result = await runCharacterCommandConcurrency(fixture.sessions, { maxScenarioMs: 100, pollMs: 1 });
    expect(result.passed).toBe(false); expect(result.scenarios.at(-1)?.status).toBe("failed");
    expect(result.scenarios.at(-1)?.reason).toMatch(/bound/);
    expect(fixture.closed).toHaveLength(3);
    if (fault === "no-block") expect(result.scenarios[0].edges).toEqual([]);
    else expect(result.scenarios.at(-1)?.edges.map(edge => edge.deadlineExpired)).toEqual([false]);
  });

  it("requires successful SET LOCAL ROLE before counting a helper execute denial", async () => {
    const fixture = simulated("role-switch-failure");
    const result = await runCharacterCommandConcurrency(fixture.sessions, { maxScenarioMs: 1000, pollMs: 1 });
    expect(result.passed).toBe(false); expect(result.scenarios.at(-1)).toMatchObject({ scenario: "api-execute-denials", status: "failed", deniedRoles: [] });
  });

  it("does not claim completion when any owned session fails to close", async () => {
    const fixture = simulated("close-failure");
    const result = await runCharacterCommandConcurrency(fixture.sessions, { maxScenarioMs: 1000, pollMs: 1 });
    expect(result.scenarios.every(item => item.status === "passed")).toBe(true);
    expect(result).toMatchObject({ sessionsClosed: false, passed: false });
    expect(JSON.stringify(result)).not.toContain("private close detail");
  });

  it("preserves only a bounded SQLSTATE on transport errors", async () => {
    const fixture = simulated("private-error");
    const result = await runCharacterCommandConcurrency(fixture.sessions);
    expect(result.scenarios).toMatchObject([{ scenario: "setup", status: "failed", reason: "Session query failed", observedSqlstate: "XX001" }]);
    expect(JSON.stringify(result)).not.toContain("private message");
    expect(fixture.commands.some(command => command.sql === RESET_SQL)).toBe(false);
  });

  it("rejects duplicate backend identities before issuing SQL", async () => {
    const fixture = simulated(); fixture.sessions.checker.backendPid = fixture.sessions.blocker.backendPid;
    const result = await runCharacterCommandConcurrency(fixture.sessions);
    expect(result.passed).toBe(false); expect(fixture.commands).toEqual([]); expect(fixture.closed).toHaveLength(3);
  });

  it("selects the extended 25-case matrix only explicitly, covering both deadlines at every wait site", async () => {
    expect(EXTENDED_CONCURRENCY_SCENARIOS.slice(0, 8)).toEqual([...CONCURRENCY_SCENARIOS]);
    expect(new Set(EXTENDED_CONCURRENCY_SCENARIOS).size).toBe(25);
    const fixture = simulated(undefined, "extended");
    const result = await runCharacterCommandConcurrency(fixture.sessions, { scenarioProfile: "extended", maxScenarioMs: 1000, pollMs: 1 });
    expect(result).toMatchObject({ authenticationAccepted: false, sessionsClosed: true, passed: true });
    expect(result.scenarios.map(item => item.scenario)).toEqual([...EXTENDED_CONCURRENCY_SCENARIOS]);
    for (const site of ["user", "session", "profile", "guard", "parent"]) {
      for (const expiry of ["jwt", "not-after"]) {
        const scenario = result.scenarios.find(item => item.scenario === `${site}-wait-${expiry}-expiry`);
        expect(scenario).toMatchObject({ status: "passed", expectedSqlstate: "P0001", observedSqlstate: "P0001" });
        expect(scenario!.edges.map(edge => edge.deadlineExpired)).toEqual([false, true]);
      }
    }
    for (const name of ["checker-first-user-ban", "checker-first-owner-transfer"]) {
      expect(result.scenarios.find(item => item.scenario === name)?.edges).toMatchObject([{ waiterPid: 101, blockerPid: 102 }]);
    }
    expect(result.scenarios.find(item => item.scenario === "clock-helper-api-execute-denials")?.deniedRoles)
      .toEqual(["anon", "authenticated", "service_role"]);
    expect(fixture.commands.filter(command => command.sql === RESET_SQL)).toHaveLength(26);
    for (const table of ["auth.users", "auth.sessions", "public.profiles", "public.characters"]) {
      expect(fixture.commands.filter(command => command.role === "blocker"
        && command.sql.startsWith(`SELECT id FROM ${table} WHERE`) && command.sql.endsWith("FOR UPDATE;"))).toHaveLength(2);
    }
    expect(fixture.commands.filter(command => command.sql === "SELECT singleton FROM private.character_writer_guard_v1 WHERE singleton=true FOR UPDATE;")).toHaveLength(2);
  });

  it("keeps only complete-row digests and proves unchanged read-only rows plus rollback recovery for absence cases", async () => {
    const fixture = simulated(undefined, "extended");
    const result = await runCharacterCommandConcurrency(fixture.sessions, { scenarioProfile: "extended", maxScenarioMs: 1000, pollMs: 1 });
    expect(result.passed).toBe(true);
    const checks = result.scenarios.filter(item => item.rowChecks);
    expect(checks).toHaveLength(5);
    for (const scenario of checks) {
      const rows = scenario.rowChecks!;
      expect(rows.scope).toBe("complete-owned-fixture-rows-digest-only");
      expect(rows.beforeDigest).toMatch(/^[0-9a-f]{32}$/);
      expect(rows.restoredDigest).toBe(rows.beforeDigest);
      if (rows.phase === "read-only-check") expect(rows.afterDigest).toBe(rows.beforeDigest);
      else {
        expect(rows.afterDigest).not.toBe(rows.beforeDigest);
        expect(scenario).toMatchObject({ expectedSqlstate: "P0001", observedSqlstate: "P0001" });
      }
    }
    expect(fixture.commands.filter(command => command.sql.includes("AS fixture_digest"))).toHaveLength(15);
    expect(JSON.stringify(result)).not.toMatch(/raw_user_meta_data|encrypted_password|user_id|SELECT|auth\.users|context_version/);
  });

  it.each(["extended-row-drift", "absence-rollback-drift", "clock-helper-allowed"] as const)(
    "refuses extended-profile %s rather than claiming new acceptance", async fault => {
      const fixture = simulated(fault, "extended");
      const result = await runCharacterCommandConcurrency(fixture.sessions, { scenarioProfile: "extended", maxScenarioMs: 1000, pollMs: 1 });
      expect(result.passed).toBe(false); expect(result.scenarios.at(-1)?.status).toBe("failed");
      expect(fixture.closed).toHaveLength(3);
      if (fault === "extended-row-drift") expect(result.scenarios.at(-1)?.reason).toMatch(/changed during read-only/);
      else if (fault === "absence-rollback-drift") expect(result.scenarios.at(-1)?.reason).toMatch(/recover after rollback/);
      else expect(result.scenarios.at(-1)).toMatchObject({ scenario: "clock-helper-api-execute-denials", deniedRoles: [] });
    });

  it("refuses an unknown profile before issuing fixture SQL", async () => {
    const fixture = simulated();
    const result = await runCharacterCommandConcurrency(fixture.sessions, { scenarioProfile: "unapproved" as "extended" });
    expect(result.passed).toBe(false); expect(fixture.commands).toEqual([]); expect(fixture.closed).toHaveLength(3);
  });
});
