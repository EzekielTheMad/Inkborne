/** Finite Windows scratch transport. No container startup or credentials. */
import { spawn } from "node:child_process";
import type { NativeSession } from "./character-command-concurrency";
import { TARGET, verifyRuntime, type Transport, type RuntimeApproval } from "./equipment-runtime";
import { CharacterPsqlSession, type SessionProcess } from "./character-psql-session";
export { CharacterPsqlSession, CharacterPsqlError, PSQL_LIMITS, framedCharacterSql, type SessionProcess } from "./character-psql-session";

const DOCKER = "C:\\Users\\kaios\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe";
const SIDES = ["blocker", "checker", "observer"] as const;
const protocolError = () => new Error("character-command psql protocol unavailable");

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
