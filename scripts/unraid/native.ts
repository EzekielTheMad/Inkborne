import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { z } from "zod";

const runtimeSchema = z.object({ kind: z.literal("inkborne-unraid-test-runtime-v1"), runId: z.uuid(),
  sourceHead: z.string().regex(/^[a-f0-9]{40}$/), engineId: z.string().min(5), databaseId: z.string().regex(/^[a-f0-9]{64}$/),
  pgSystemId: z.string().regex(/^\d+$/) }).passthrough();
export function testRuntime() {
  assert.equal(process.platform, "linux", "native verification runs inside the Linux test runner");
  assert.equal(process.env.INKBORNE_TEST_RUNTIME, "/run/inkborne/runtime.json", "dedicated scratch runtime required");
  return runtimeSchema.parse(JSON.parse(fs.readFileSync(process.env.INKBORNE_TEST_RUNTIME, "utf8")));
}
export const psqlEnvironment = (tag: string) => {
  assert(/^[a-z0-9-]{1,63}$/.test(tag));
  return { ...process.env, PGHOST: "db", PGPORT: "5432", PGDATABASE: "postgres", PGPASSFILE: "/run/inkborne/pgpass",
    PGSSLMODE: "disable", PGAPPNAME: tag, PGOPTIONS: "-c statement_timeout=30000 -c lock_timeout=5000" };
};
export function psqlArguments(role: "postgres" | "supabase_admin", variables: Record<string, string> = {}, fatal = true) {
  const args = ["-X", "--no-password", "--username", role, "--quiet", "--tuples-only", "--no-align", "--set", `ON_ERROR_STOP=${fatal ? "1" : "off"}`];
  for (const [key, value] of Object.entries(variables)) {
    const finite: Record<string, string[]> = { case_id: ["A1", "A2", "A3"], paladin_level: ["1", "2"], spell_phase: ["baseline", "concurrent"],
      corrected_version: ["1", "2"], root_version: ["1", "2"], current_catalog: ["0", "1"],
      stage: ["complete", "trimmed-five", "wizard-one", "below-three", "restored-four"] };
    assert(["character_id", "actor_id", "control_id"].includes(key) ? z.uuid().safeParse(value).success : finite[key]?.includes(value), "finite native query input required");
    args.push("--set", `${key}=${value}`);
  }
  return [...args, "--file", "-"];
}
let verified = false;
function execute(sql: string, variables: Record<string, string>, role: "postgres" | "supabase_admin") {
  const runtime = testRuntime(), tag = `ib-${runtime.runId.slice(0, 8)}-once`;
  const result = spawnSync("psql", psqlArguments(role, variables), { input: sql, encoding: "utf8", env: psqlEnvironment(tag),
    timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
  if(result.status!==0)fs.appendFileSync('/run/inkborne/native-errors.log',result.stderr??String(result.error??'psql failed'),{mode:0o600});
  assert.equal(result.status, 0, "scratch database command failed; SQL/output withheld"); return result.stdout.trim();
}
export function assertNativeIdentity() {
  const runtime = testRuntime();
  const actual = execute("BEGIN READ ONLY; SELECT jsonb_build_object('database',current_database(),'systemId',system_identifier::text) FROM pg_control_system(); ROLLBACK;", {}, "supabase_admin");
  assert.deepEqual(JSON.parse(actual), { database: "postgres", systemId: runtime.pgSystemId }, "scratch database identity changed"); verified = true;
}
export async function nativeSql(sql: string, variables: Record<string, string> = {}, role: "postgres" | "supabase_admin" = "postgres") {
  if (!verified) assertNativeIdentity();
  return execute(sql, variables, role);
}
export async function nativeJson(sql: string, variables: Record<string, string> = {}, role: "postgres" | "supabase_admin" = "postgres"): Promise<unknown> {
  return JSON.parse(await nativeSql(sql, variables, role)) as unknown;
}
