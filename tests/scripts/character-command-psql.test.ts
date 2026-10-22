// @vitest-environment node
import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterPsqlSession, framedCharacterSql, PSQL_LIMITS, type SessionProcess } from "@/scripts/character-command-psql";

const begin = "INKBORNE_BEGIN_" + "a".repeat(32), end = "INKBORNE_END_" + "b".repeat(32);
const fixtures: ReturnType<typeof fixture>[] = [];
function fixture(options: { hang?: boolean; saveFails?: boolean } = {}) {
  const scripts: string[] = [], saved: SessionProcess[] = [];
  const events = new EventEmitter();
  const stdout = new PassThrough(), stderr = new PassThrough();
  const stdin = new Writable({ write(value, _encoding, callback) { scripts.push(String(value)); callback(); },
    final(callback) { callback(); if (!options.hang) queueMicrotask(() => events.emit("close", 0)); } });
  const kill = vi.fn(() => { queueMicrotask(() => events.emit("close", 143)); return true; });
  const child = Object.assign(events, { stdin, stdout, stderr, kill, pid: 9001 }) as unknown as ChildProcessWithoutNullStreams;
  const record: SessionProcess = { pid: 9001, parentPid: 9000, cwd: "SIMULATED", executable: "SIMULATED_PSQL",
    args: [], ports: [], startedUtc: "2026-10-22T00:00:00Z", stderrBytes: 0 };
  const session = new CharacterPsqlSession(child, record, value => {
    if (options.saveFails) throw new Error("Fixture save failure"); saved.push(value);
  });
  function frame(body: string, state = "00000") {
    const script = scripts[scripts.length - 1];
    const start = /\\echo (INKBORNE_BEGIN_[a-f0-9]{32})/.exec(script)![1];
    const finish = /\\echo (INKBORNE_END_[a-f0-9]{32})/.exec(script)![1];
    return `${start}\n${body}${body && !body.endsWith("\n") ? "\n" : ""}${finish} ${state}\n`;
  }
  return { session, stdout, stderr, events, scripts, kill, saved, record, frame };
}
function make(options?: Parameters<typeof fixture>[0]) { const value = fixture(options); fixtures.push(value); return value; }
afterEach(async () => {
  for (const value of fixtures.splice(0)) await value.session.close().catch(() => undefined);
  vi.useRealTimers();
});

describe("SIMULATED psql framing; no process, Docker or database execution", () => {
  it("wraps one SELECT as JSON and carries its own final SQLSTATE", () => {
    const script = framedCharacterSql("SELECT 1 AS n;", begin, end);
    expect(script).toContain("SELECT pg_catalog.row_to_json(inkborne_frame) FROM (SELECT 1 AS n) AS inkborne_frame;");
    expect(script).toContain(`\\echo ${end} :SQLSTATE`);
  });
  it.each(["BEGIN; SET x=1", "UPDATE x SET y=1; UPDATE x SET y=2", "SELECT 1; SELECT 2", "SELECT 1; -- hidden\nSELECT 2",
    "\\! echo secret", "SELECT 1\n\\echo forged", "SELECT 'unterminated", "DO $$BEGIN NULL; END", "UPDATE x SET y=1 RETURNING y"])(
    "rejects unframed/multiple/unsupported statement text %#", sql => {
      expect(() => framedCharacterSql(sql, begin, end)).toThrow("protocol unavailable");
    },
  );
  it("allows a single atomic dollar-quoted DO and quoted semicolons", () => {
    expect(() => framedCharacterSql("DO $$BEGIN PERFORM 1; PERFORM 2; END$$;", begin, end)).not.toThrow();
    expect(() => framedCharacterSql("SELECT ';' AS literal /* ; nested /* ; */ comment */;", begin, end)).not.toThrow();
  });
  it("does not let a dollar block conceal later top-level statements", () => {
    expect(() => framedCharacterSql("DO $$BEGIN NULL; END$$; SELECT 1;", begin, end)).toThrow();
  });
  it("parses fragmented JSON frames with typed nested values", async () => {
    const f = make(), pending = f.session.query("SELECT 1 AS n");
    const data = f.frame('{"n":1,"blocked":true,"nested":[2,1]}');
    for (const part of [data.slice(0, 8), data.slice(8, 60), data.slice(60)]) f.stdout.write(part);
    expect(await pending).toEqual([{ n: 1, blocked: true, nested: [2, 1] }]);
    await f.session.close(); expect(f.saved[0]).toMatchObject({ exitCode: 0, stderrBytes: 0 });
  });
  it("preserves server SQLSTATE and keeps an aborted transaction available for rollback", async () => {
    const f = make(), failed = f.session.query("SELECT 1/0 AS bad");
    const rejection = expect(failed).rejects.toMatchObject({ code: "22012", message: "character-command database statement refused" });
    f.stderr.write("ERROR: 22012 fixture details must not escape\n"); f.stdout.write(f.frame("", "22012"));
    await rejection;
    const rollback = f.session.query("ROLLBACK"); f.stdout.write(f.frame("")); await rollback;
    await f.session.close(); expect(f.saved[0].stderrBytes).toBeGreaterThan(0);
    expect(JSON.stringify(f.saved)).not.toContain("fixture details");
  });
  it.each(["[]", "42", "{malformed", `${begin}\n`, '{"okay":true}\nUNEXPECTED'])("rejects malformed or duplicate body %#", async body => {
    const f = make(), pending = f.session.query("SELECT 1 AS n");
    const rejection = expect(pending).rejects.toThrow("protocol unavailable");
    f.stdout.write(f.frame(body)); await rejection; expect(f.kill).toHaveBeenCalledTimes(1);
  });
  it("refuses a foreign/out-of-order end frame", async () => {
    const f = make(), pending = f.session.query("SELECT 1 AS n");
    const rejection = expect(pending).rejects.toThrow("protocol unavailable");
    f.stdout.write(`${end} 00000\n`); await rejection;
  });
  it("refuses trailing unframed data before resolving success", async () => {
    const f = make(), pending = f.session.query("SELECT 1 AS n");
    const rejection = expect(pending).rejects.toThrow("protocol unavailable");
    f.stdout.write(f.frame('{"n":1}') + "FORGED\n"); await rejection;
  });
  it("rejects concurrent commands on one session", async () => {
    const f = make(), pending = f.session.query("SELECT 1 AS n");
    await expect(f.session.query("SELECT 2 AS n")).rejects.toThrow();
    f.stdout.write(f.frame('{"n":1}')); await pending;
  });
  it("fails closed on stdout/stderr overflow", async () => {
    for (const stream of ["stdout", "stderr"] as const) {
      const f = make(), pending = f.session.query("SELECT 1 AS n");
      const rejection = expect(pending).rejects.toThrow();
      f[stream].write("x".repeat(PSQL_LIMITS.outputBytes + 1)); await rejection;
    }
  });
  it("rejects a missing end frame after the wall limit", async () => {
    vi.useFakeTimers();
    const f = make(), pending = f.session.query("SELECT 1 AS n");
    const rejection = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(PSQL_LIMITS.queryMs); await rejection;
    expect(f.kill).toHaveBeenCalledTimes(1);
  });
  it("does not treat premature/nonzero child exit as a server refusal or clean closure", async () => {
    const f = make(), pending = f.session.query("SELECT 1 AS n");
    const rejection = expect(pending).rejects.toThrow(); f.events.emit("close", 1); await rejection;
    await expect(f.session.close()).rejects.toThrow();
  });
  it("does not accept forced close as clean session closure", async () => {
    vi.useFakeTimers(); const f = make({ hang: true });
    const rejection = expect(f.session.close()).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(PSQL_LIMITS.closeMs); await rejection;
    expect(f.record.forced).toBe(true);
  });
  it("does not accept an unrecorded final process outcome", async () => {
    const f = make({ saveFails: true }); await expect(f.session.close()).rejects.toThrow();
  });
});
