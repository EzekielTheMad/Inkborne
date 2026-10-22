/** Finite scratch verification transport. No container startup or credentials. */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { NativeSession } from "./character-command-concurrency";
import { TARGET, verifyRuntime, type Transport, type RuntimeApproval } from "./equipment-runtime";

const DOCKER = "C:\\Users\\kaios\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe";
const SIDES = ["blocker", "checker", "observer"] as const;
export const PSQL_LIMITS = Object.freeze({ queryMs: 20_000, closeMs: 2_000, outputBytes: 262_144, sqlBytes: 131_072 });
export type SessionProcess = { pid: number; parentPid: number; cwd: string; executable: string; args: string[];
  startedUtc: string; finishedUtc?: string; ports: []; exitCode?: number; stderrBytes: number; forced?: boolean };
type Pending = { begin: string; end: string; begun: boolean; rows: Record<string, unknown>[]; bytes: number;
  resolve(rows: Record<string, unknown>[]): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> };

export class CharacterPsqlError extends Error {
  constructor(readonly code: string) { super("character-command database statement refused"); }
}
const protocolError = () => new Error("character-command psql protocol unavailable");

// The final psql SQLSTATE must describe the entire frame. Permit exactly one
// statement, including one dollar-quoted DO block, without splitting SQL text.
function oneStatement(sql: string): boolean {
  let quote = "", block = 0, line = false;
  for (let i = 0; i < sql.length; i++) {
    const pair = sql.slice(i, i + 2), char = sql[i];
    if (line) { if (char === "\n") line = false; continue; }
    if (block) { if (pair === "/*") { block++; i++; } else if (pair === "*/") { block--; i++; } continue; }
    if (quote) {
      if (quote.startsWith("$")) { if (sql.startsWith(quote, i)) { i += quote.length - 1; quote = ""; } }
      else if (char === quote) { if (sql[i + 1] === quote) i++; else quote = ""; }
      continue;
    }
    if (pair === "--") { line = true; i++; continue; }
    if (pair === "/*") { block++; i++; continue; }
    if (char === "'" || char === '"') { quote = char; continue; }
    if (char === "$" && /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.test(sql.slice(i))) {
      quote = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i))![0]; i += quote.length - 1; continue;
    }
    if (char === ";" || char === "\\") return false;
  }
  return !quote && !block;
}

/** SELECTs are fixed harness source, wrapped as JSON rows. Other commands must
 * produce no rows. This is not a production or browser SQL interface. */
export function framedCharacterSql(sql: string, begin: string, end: string): string {
  const text = sql.trim().replace(/;\s*$/, "");
  if (!text || Buffer.byteLength(text) > PSQL_LIMITS.sqlBytes || text.includes("\\") || !oneStatement(text)
    || /\bRETURNING\b/i.test(text) || !/^(SELECT|BEGIN|COMMIT|ROLLBACK|SET|UPDATE|DELETE|INSERT|DO)\b/i.test(text)) throw protocolError();
  if (!/^INKBORNE_BEGIN_[a-f0-9]{32}$/.test(begin) || !/^INKBORNE_END_[a-f0-9]{32}$/.test(end)) throw protocolError();
  const statement = /^SELECT\b/i.test(text) ? `SELECT pg_catalog.row_to_json(inkborne_frame) FROM (${text}) AS inkborne_frame` : text;
  return `\\echo ${begin}\n${statement};\n\\echo ${end} :SQLSTATE\n`;
}

export class CharacterPsqlSession implements NativeSession {
  backendPid = 0;
  private pending?: Pending;
  private buffer = "";
  private failed = false;
  private closed = false;
  private saveFailed = false;
  private closePromise: Promise<void>;
  private resolveClose!: () => void;
  constructor(private readonly child: ChildProcessWithoutNullStreams, private readonly record: SessionProcess,
    private readonly save: (record: SessionProcess) => void) {
    this.closePromise = new Promise(resolve => { this.resolveClose = resolve; });
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", (value: string) => this.receive(value));
    child.stderr.on("data", (value: string) => {
      record.stderrBytes += Buffer.byteLength(value);
      // Server errors may contain source text; retain a byte count only.
      if (record.stderrBytes > PSQL_LIMITS.outputBytes) this.fail();
    });
    child.stdin.on("error", () => this.fail());
    child.on("error", () => this.fail());
    child.on("close", code => {
      this.closed = true; record.finishedUtc = new Date().toISOString(); record.exitCode = code ?? -1;
      if (this.pending || this.buffer.trim() || code !== 0) this.fail();
      try { save(structuredClone(record)); } catch { this.saveFailed = true; }
      this.resolveClose();
    });
  }
  private fail() {
    if (this.failed) return;
    this.failed = true;
    const pending = this.pending; this.pending = undefined;
    if (pending) { clearTimeout(pending.timer); pending.reject(protocolError()); }
    if (!this.closed) { this.record.forced = true; this.child.kill(); }
  }
  private receive(value: string) {
    if (this.failed) return;
    if (!this.pending && value.trim()) { this.fail(); return; }
    if (this.pending) {
      this.pending.bytes += Buffer.byteLength(value);
      if (this.pending.bytes > PSQL_LIMITS.outputBytes) { this.fail(); return; }
    }
    this.buffer += value;
    let newline: number;
    while ((newline = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, ""); this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      const pending = this.pending;
      if (!pending) { this.fail(); return; }
      if (!pending.begun) {
        if (line !== pending.begin) { this.fail(); return; }
        pending.begun = true; continue;
      }
      if (line.startsWith(pending.end + " ")) {
        const code = line.slice(pending.end.length + 1);
        if (!/^[0-9A-Z]{5}$/.test(code) || this.buffer.trim()) { this.fail(); return; }
        clearTimeout(pending.timer); this.pending = undefined;
        if (code === "00000") pending.resolve(pending.rows); else pending.reject(new CharacterPsqlError(code));
        continue;
      }
      try {
        const row: unknown = JSON.parse(line);
        if (!row || typeof row !== "object" || Array.isArray(row)) throw protocolError();
        pending.rows.push(row as Record<string, unknown>);
      } catch { this.fail(); return; }
    }
  }
  query(sql: string): Promise<Record<string, unknown>[]> {
    if (this.failed || this.closed || this.pending) return Promise.reject(protocolError());
    const nonce = randomUUID().replaceAll("-", "");
    const begin = `INKBORNE_BEGIN_${nonce}`, end = `INKBORNE_END_${nonce}`;
    let script: string;
    try { script = framedCharacterSql(sql, begin, end); } catch { return Promise.reject(protocolError()); }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(), PSQL_LIMITS.queryMs);
      this.pending = { begin, end, begun: false, rows: [], bytes: 0, resolve, reject, timer };
      this.child.stdin.write(script, error => { if (error) this.fail(); });
    });
  }
  async close(): Promise<void> {
    if (this.closed) { if (this.failed || this.saveFailed || this.record.exitCode !== 0) throw protocolError(); return; }
    if (this.pending || this.failed) this.fail();
    else this.child.stdin.end("\\q\n");
    const timer = setTimeout(() => { this.record.forced = true; this.child.kill(); }, PSQL_LIMITS.closeMs);
    try {
      await Promise.race([this.closePromise, new Promise<never>((_, reject) => {
        const release = setTimeout(() => reject(protocolError()), PSQL_LIMITS.closeMs * 2);
        this.closePromise.finally(() => clearTimeout(release));
      })]);
      if (this.failed || this.saveFailed || this.record.forced || this.record.exitCode !== 0) throw protocolError();
    } finally { clearTimeout(timer); }
  }
}

export async function openCharacterPsqlSession(options: {
  root: string; resourceIds: Pick<RuntimeApproval, "engineId" | "containerId" | "imageId" | "networkId">;
  transport: Transport; save(record: SessionProcess): void;
}, side: typeof SIDES[number]): Promise<NativeSession> {
  if (!SIDES.includes(side) || !/^[a-f0-9]{64}$/.test(options.resourceIds.containerId)) throw protocolError();
  await verifyRuntime(options.transport, options.resourceIds);
  const args = ["--context", TARGET.context, "exec", "-i", options.resourceIds.containerId, "psql", "-X", "--no-password",
    "--host", "/var/run/postgresql", "--username", "postgres", "--dbname", "postgres", "--quiet", "--tuples-only", "--no-align",
    "--set", "ON_ERROR_STOP=off", "--set", "VERBOSITY=sqlstate", "--file", "-"];
  const child = spawn(DOCKER, args, { cwd: options.root, windowsHide: true, shell: false, stdio: ["pipe", "pipe", "pipe"] });
  const record: SessionProcess = { pid: child.pid ?? -1, parentPid: process.pid, cwd: options.root,
    executable: DOCKER, args, startedUtc: new Date().toISOString(), ports: [], stderrBytes: 0 };
  const session = new CharacterPsqlSession(child, record, options.save);
  try {
    options.save(structuredClone(record));
    for (const setting of [`SET application_name='inkborne-authrows-${side}'`, "SET statement_timeout='15s'", "SET lock_timeout='12s'", "SET client_min_messages='error'"]) await session.query(setting);
    const identity = (await session.query("SELECT pg_catalog.pg_backend_pid() AS backend_pid, current_database() AS database, current_user AS actor, current_setting('application_name') AS application_name"))[0];
    if (!identity || !Number.isSafeInteger(identity.backend_pid) || Number(identity.backend_pid) <= 0 || identity.database !== "postgres"
      || identity.actor !== "postgres" || identity.application_name !== `inkborne-authrows-${side}`) throw protocolError();
    session.backendPid = Number(identity.backend_pid); return session;
  } catch {
    await session.close().catch(() => undefined); throw protocolError();
  }
}
