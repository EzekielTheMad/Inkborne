import { describe, expect, it } from "vitest";
import { PARENT_CONTENTION_CASES, runBuilderParentAdmissionContention } from "../../scripts/builder-parent-admission-concurrency";
import { framedCharacterSql } from "../../scripts/character-command-psql";
import type { CommandSessions, NativeSession } from "../../scripts/character-command-concurrency";

// SIMULATED protocol characterization only. These scripted sessions cannot
// establish PostgreSQL locking, installed callbacks, RLS or authentication.
const fixture = { characterId: "30000000-0000-4000-8000-000000000001", actorId: "30000000-0000-4000-8000-000000000002" };
const names = { blocker: "inkborne-parent-blocker", checker: "inkborne-parent-checker", observer: "inkborne-parent-observer" };
const pids = { blocker: 101, checker: 102, observer: 103 };
type Side = keyof typeof pids;
type Fault = "none" | "parent-before-guard" | "refuses-before-guard" | "wrong-refusal" | "mutates-after-refusal" | "close-fails" | "invalid-fixture";
class ScriptedModel {
  held = false;
  waiting = false;
  released = false;
  closeCalls: Side[] = [];
  statements: Array<{ side: Side; sql: string }> = [];
  pending?: { reject(error: unknown): void };
  readonly sessions: CommandSessions;
  constructor(readonly fault: Fault = "none") {
    const session = (side: Side): NativeSession => ({ backendPid: pids[side],
      query: sql => this.query(side, sql), close: async () => {
        this.closeCalls.push(side);
        this.pending?.reject({ code: "57014" }); this.pending = undefined;
        if (this.fault === "close-fails" && side === "observer") throw Error("simulated close failure");
      } });
    this.sessions = { blocker: session("blocker"), checker: session("checker"), observer: session("observer") };
  }
  async query(side: Side, sql: string): Promise<Record<string, unknown>[]> {
    this.statements.push({ side, sql });
    if (sql.startsWith("SELECT pg_backend_pid()")) return [{ pid: pids[side], role: "postgres", database: "postgres" }];
    if (sql.includes(" AS fixture")) return [{ fixture: {
      character_id: fixture.characterId, actor_id: fixture.actorId, enrolled: true,
      original: "30000000-0000-4000-8000-000000000003", revision: "40", background_count: 1, awarded: false,
      choices: { classes: [{ slug: "fighter", level: 4 }], background: "acolyte", ability_method: "standard_array" },
      scores: { strength: 15, dexterity: 14, constitution: this.fault === "invalid-fixture" ? "13" : 13, intelligence: 12, wisdom: 10, charisma: 8 },
      state: { current_hp: 30 }, asi_feature: "fighter-ability-score-improvement-4", asi_ability: "charisma",
    } }];
    if (sql.includes(" AS digest")) return [{ digest: this.released && this.fault === "mutates-after-refusal" ? "b".repeat(32) : "a".repeat(32) }];
    if (sql.includes("AS seals")) return [{ seals: 0, caps: 0 }];
    if (sql.startsWith("SELECT private.lock_enrolled_parent_guard_v1()")) { this.held = true; this.released = false; return []; }
    if (sql.startsWith("SELECT w.pid AS waiter_pid")) return [{ waiter_pid: pids.checker, blocker_pid: pids.blocker,
      waiter_name: names.checker, blocker_name: names.blocker, wait_event_type: this.waiting ? "Lock" : null,
      state: "active", blocked: this.waiting && this.held, observed_at: "2026-10-25T06:00:00.000001Z" }];
    if (side === "observer" && sql.includes("FOR UPDATE NOWAIT")) {
      if (this.fault === "parent-before-guard") throw { code: "55P03" };
      return [{ id: fixture.characterId }];
    }
    if (sql === "ROLLBACK") {
      if (side === "blocker" && this.held) {
        this.held = false; this.waiting = false; this.released = true;
        this.pending?.reject({ code: this.fault === "wrong-refusal" ? "P0001" : "42501" }); this.pending = undefined;
      }
      return [];
    }
    if (side === "checker" && (/^(?:UPDATE public\.|DELETE FROM public\.)/.test(sql) || /^SELECT (?:\* FROM )?public\./.test(sql))) {
      if (this.fault === "refuses-before-guard") throw { code: "42501" };
      if (!this.held) throw Error("simulated writer bypassed held guard");
      this.waiting = true;
      return new Promise((_, reject) => { this.pending = { reject }; });
    }
    return [];
  }
}

describe("SIMULATED parent admission contention protocol; no native acceptance", () => {
  it("requires all eight guard edges plus third-session parent probes and unchanged rows", async () => {
    const model = new ScriptedModel();
    const report = await runBuilderParentAdmissionContention(model.sessions, fixture, { pollMs: 1 });
    expect(report, JSON.stringify(report.cases)).toMatchObject({ authenticationAccepted: false, passed: true, sessionsClosed: true, backendPids: [101, 102, 103] });
    expect(report.cases.map(item => item.name)).toEqual(PARENT_CONTENTION_CASES);
    for (const item of report.cases) expect(item).toMatchObject({ status: "passed", parentProbeSucceeded: true,
      edge: { waiterPid: 102, blockerPid: 101 }, observedSqlstate: "42501", beforeDigest: "a".repeat(32), afterDigest: "a".repeat(32) });
    expect(model.closeCalls.sort()).toEqual(["blocker", "checker", "observer"]);
    expect(model.statements.filter(item => item.sql.includes("FOR UPDATE NOWAIT"))).toHaveLength(8);
    // Reuse the existing real transport's strict framing rather than crediting
    // a scripted session for accepting arbitrary or multiple statements.
    for (const item of model.statements) expect(() => framedCharacterSql(item.sql,
      "INKBORNE_BEGIN_00000000000000000000000000000000", "INKBORNE_END_00000000000000000000000000000000")).not.toThrow();
    expect(model.statements.some(item => /UPDATE auth\.|DELETE FROM auth\.|INSERT INTO private\.|seal_builder_parent/.test(item.sql))).toBe(false);
  });
  it("fails a BEFORE ROW-only ordering bug even when the eventual mutation refuses", async () => {
    const model = new ScriptedModel("parent-before-guard");
    const report = await runBuilderParentAdmissionContention(model.sessions, fixture, { pollMs: 1 });
    expect(report.passed).toBe(false); expect(report.cases).toHaveLength(1);
    expect(report.cases[0]).toMatchObject({ status: "failed", observedSqlstate: "55P03" });
    expect(model.closeCalls).toHaveLength(3);
  });
  it("does not credit a privilege refusal before the guard edge as contention proof", async () => {
    const model = new ScriptedModel("refuses-before-guard");
    const report = await runBuilderParentAdmissionContention(model.sessions, fixture, { pollMs: 1 });
    expect(report.passed).toBe(false); expect(report.cases[0].reason).toBe("Mutation settled before guard blocking proof");
    expect(report.cases[0].parentProbeSucceeded).toBeUndefined();
  });
  it.each(["wrong-refusal", "mutates-after-refusal"] as const)("fails %s instead of treating an observed edge as sufficient", async fault => {
    const model = new ScriptedModel(fault);
    const report = await runBuilderParentAdmissionContention(model.sessions, fixture, { pollMs: 1 });
    expect(report.passed).toBe(false); expect(report.cases).toHaveLength(1);
    expect(report.cases[0]).toMatchObject({ status: "failed", parentProbeSucceeded: true });
    expect(report.cases[0].reason).toBe(fault === "wrong-refusal" ? "Unexpected post-guard mutation outcome" : "Failed mutation changed retained fixture rows");
  });
  it("requires verified session closure after all simulated cases", async () => {
    const model = new ScriptedModel("close-fails");
    const report = await runBuilderParentAdmissionContention(model.sessions, fixture, { pollMs: 1 });
    expect(report.cases.every(item => item.status === "passed")).toBe(true);
    expect(report.sessionsClosed).toBe(false); expect(report.passed).toBe(false);
  });
  it("refuses a malformed fixture before beginning any guard/parent transaction", async () => {
    const model = new ScriptedModel("invalid-fixture");
    const report = await runBuilderParentAdmissionContention(model.sessions, fixture, { pollMs: 1 });
    expect(report.passed).toBe(false); expect(report.cases[0].reason).toBe("Genuine unawarded ASI/background fixture is unavailable");
    expect(model.statements.some(item => item.sql === "BEGIN")).toBe(false); expect(model.closeCalls).toHaveLength(3);
  });
});
