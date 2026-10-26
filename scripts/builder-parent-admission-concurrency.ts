import { setTimeout as pause } from "node:timers/promises";
import type { CommandSessions, NativeSession } from "./character-command-concurrency";

// Source-only finite verifier. The caller must bind these existing native
// sessions to its frozen disposable app profile; this starts no process and
// authorizes no runtime. Reuse CharacterPsqlSession's one-statement framing.
export const PARENT_CONTENTION_CASES = ["owner-update", "service-update", "owner-delete", "state-patch",
  "state-cas", "ability-rpc", "background-rpc", "asi-rpc"] as const;
type Case = typeof PARENT_CONTENTION_CASES[number];
type Fixture = { characterId: string; actorId: string };
type Json = Record<string, unknown>;
type Inputs = { choices: Json; scores: Json; state: Json; asi_feature: string; asi_ability: string };
type Edge = { waiterPid: number; blockerPid: number; observedAtUTC: string };
export type ParentContentionReport = {
  kind: "builder-parent-admission-contention-v1";
  authenticationAccepted: false;
  cases: Array<{ name: Case; status: "passed" | "failed"; beforeDigest?: string; afterDigest?: string;
    edge?: Edge; parentProbeSucceeded?: boolean; expectedSqlstate: "42501" | "00000"; observedSqlstate?: string; affectedRows?: number; reason?: string }>;
  backendPids: number[]; sessionsClosed: boolean; passed: boolean;
};
const names = { blocker: "inkborne-parent-blocker", checker: "inkborne-parent-checker", observer: "inkborne-parent-observer" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const abilities = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const object = (value: unknown): value is Json => Boolean(value && typeof value === "object" && !Array.isArray(value));
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const json = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`;
class Refusal extends Error { constructor(message: string, readonly sqlstate?: string) { super(message); } }
function code(error: unknown) {
  return object(error) && typeof error.code === "string" && /^[0-9A-Z]{5}$/.test(error.code) ? error.code : undefined;
}

/** Server-side digests leave Auth data on the server and include retained
 * history as well as all mutable parent/graph/order/award state. */
export function parentFixtureDigestSql(fixture: Fixture) {
  if (!uuid.test(fixture.characterId) || !uuid.test(fixture.actorId)) throw new Refusal("Invalid fixture identity");
  return `SELECT md5(jsonb_build_object('parent',to_jsonb(c),'graph',private.builder_progression_full_graph_v1(c.id),
'order',(SELECT to_jsonb(o) FROM private.character_projection_order_v1 o WHERE character_id=c.id),
'awards',(SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]') FROM public.character_starting_grants a WHERE character_id=c.id),
'receipts',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.operation_id),'[]') FROM private.character_builder_receipts_v1 r WHERE character_id=c.id),
'draws',(SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.occurrence_id,d.level),'[]') FROM private.character_builder_hp_draws_v1 d WHERE character_id=c.id),
'history',(SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY h.operation_id),'[]') FROM private.character_builder_progression_history_v1 h WHERE character_id=c.id),
'first_proofs',(SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.acceptance_id),'[]') FROM private.class_first_acquisition_proofs_v1 p WHERE target_character_id=c.id)
)::text) AS digest FROM public.characters c WHERE id='${fixture.characterId}' AND user_id='${fixture.actorId}'`;
}

function inputSql(fixture: Fixture) {
  return `SELECT jsonb_build_object('character_id',c.id,'actor_id',c.user_id,'enrolled',private.enrolled_character_parent_v1(c.id),
'original',private.builder_original_occurrence_v1(c.id)->>'id','revision',c.action_revision::text,'choices',c.choices,'scores',c.base_stats,'state',c.state,
'background_count',(SELECT count(*) FROM public.character_content_refs r JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
 WHERE r.character_id=c.id AND v.content_type_snapshot='background' AND v.slug_snapshot=c.choices->>'background'),
'awarded',EXISTS(SELECT 1 FROM public.character_starting_grants a WHERE a.character_id=c.id AND a.status<>'eligible'),
'asi_feature',g.feature_slug,'asi_ability',(SELECT e.key FROM jsonb_each(private.character_ability_scores(c.id,NULL,g.feature_slug,NULL)) e
 WHERE e.key IN ('strength','dexterity','constitution','intelligence','wisdom','charisma') AND jsonb_typeof(e.value)='number' AND (e.value#>>'{}')::numeric<=18
 AND c.choices#>ARRAY['asi_choices',g.feature_slug] IS DISTINCT FROM jsonb_build_object('mode','asi','allocations',jsonb_build_array(jsonb_build_object('ability',e.key,'amount',2)))
 ORDER BY e.key LIMIT 1)) AS fixture
FROM public.characters c JOIN LATERAL (SELECT f.feature_slug FROM public.character_feature_grants f
 JOIN public.content_versions v ON v.content_id=f.feature_content_id AND v.version=f.feature_version
 WHERE f.character_id=c.id AND v.data_snapshot->>'feature_type'='asi' AND private.is_character_feature_grant_active(f.id)
 AND (SELECT count(*) FROM public.character_feature_grants x WHERE x.character_id=c.id AND x.feature_slug=f.feature_slug)=1
 ORDER BY f.feature_slug LIMIT 1) g ON true WHERE c.id='${fixture.characterId}' AND c.user_id='${fixture.actorId}'`;
}
function readInputs(rows: Json[], fixture: Fixture): Inputs {
  const value = rows[0]?.fixture;
  if (rows.length !== 1 || !object(value) || value.character_id !== fixture.characterId || value.actor_id !== fixture.actorId
    || value.enrolled !== true || typeof value.original !== "string" || !uuid.test(value.original)
    || typeof value.revision !== "string" || !/^(0|[1-9][0-9]{0,17})$/.test(value.revision)
    || !object(value.choices) || !object(value.scores) || !object(value.state) || value.background_count !== 1 || value.awarded !== false
    || value.choices.starting_equipment && object(value.choices.starting_equipment) && value.choices.starting_equipment.confirmed === true
    || typeof value.asi_feature !== "string" || !/^[a-z0-9-]{1,200}$/.test(value.asi_feature)
    || typeof value.asi_ability !== "string" || !abilities.includes(value.asi_ability)
    || !abilities.every(key => Number.isInteger(value.scores && (value.scores as Json)[key])
      && Number((value.scores as Json)[key]) >= 1 && Number((value.scores as Json)[key]) <= 30)
    || Buffer.byteLength(JSON.stringify(value)) > 65536) throw new Refusal("Genuine unawarded ASI/background fixture is unavailable");
  return value as Inputs;
}
function command(name: Case, fixture: Fixture, inputs: Inputs) {
  const target = `'${fixture.characterId}'::uuid`, nextState = { ...inputs.state, current_hp: inputs.state.current_hp === 1 ? 0 : 1 };
  if (name === "owner-update" || name === "service-update") return `UPDATE public.characters SET state=${json(nextState)} WHERE id=${target}`;
  if (name === "owner-delete") return `DO $parent_delete$ DECLARE affected bigint; BEGIN
DELETE FROM public.characters WHERE id=${target}; GET DIAGNOSTICS affected=ROW_COUNT;
PERFORM set_config('inkborne.parent_delete_affected',affected::text,true);
IF affected<>0 THEN RAISE EXCEPTION 'parent_delete_unexpected_row_count' USING ERRCODE='ZP001'; END IF;
END $parent_delete$`;
  if (name === "state-patch") return `SELECT public.patch_character_state(${target},${json({ current_hp: nextState.current_hp })})`;
  if (name === "state-cas") return `SELECT * FROM public.patch_character_state_if_current(${target},${json(inputs.state)},${json(nextState)})`;
  if (name === "ability-rpc") {
    const nextScores = { ...inputs.scores, constitution: Number(inputs.scores.constitution) < 30 ? Number(inputs.scores.constitution) + 1 : 29 };
    const expected = typeof inputs.choices.ability_method === "string" ? literal(inputs.choices.ability_method) : "NULL";
    return `SELECT * FROM public.save_character_abilities(${target},'manual',${json(nextScores)},${expected},${json(inputs.scores)})`;
  }
  if (name === "background-rpc") return `SELECT * FROM public.set_character_background(${target},NULL,NULL)`;
  return `SELECT * FROM public.set_character_asi_choice(${target},${literal(inputs.asi_feature)},'asi',${json([{ ability: inputs.asi_ability, amount: 2 }])},NULL,NULL)`;
}

/** Native SQL role/RLS contention proof, not a JWT authentication claim.
 * All mutation attempts and probe locks roll back. No Auth reset, capability,
 * parent seal, origin/proof fabrication or enrolled DELETE cleanup is used. */
export async function runBuilderParentAdmissionContention(sessions: CommandSessions, fixture: Fixture,
  options: { maxScenarioMs?: number; pollMs?: number } = {}): Promise<ParentContentionReport> {
  const list = [sessions.blocker, sessions.checker, sessions.observer], maxMs = options.maxScenarioMs ?? 8000, pollMs = options.pollMs ?? 25;
  const report: ParentContentionReport = { kind: "builder-parent-admission-contention-v1", authenticationAccepted: false,
    cases: [], backendPids: list.map(item => item.backendPid), sessionsClosed: false, passed: false };
  let deadline = Date.now() + maxMs, queries = 0;
  const run = async (session: NativeSession, sql: string) => {
    if (++queries > 2048 || Date.now() >= deadline) throw new Refusal("Finite query/time budget exceeded");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([session.query(sql), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Refusal("Scenario wall-time bound exceeded")), Math.max(1, deadline - Date.now()));
      })]);
    } catch (error) { if (error instanceof Refusal) throw error; throw new Refusal("Native statement refused", code(error)); }
    finally { clearTimeout(timer); }
  };
  const begin = async (session: NativeSession) => {
    await run(session, "BEGIN");
    await run(session, `SET LOCAL lock_timeout='${maxMs - 100}ms'`);
    await run(session, `SET LOCAL statement_timeout='${maxMs - 50}ms'`);
  };
  const digest = async () => {
    const rows = await run(sessions.observer, parentFixtureDigestSql(fixture));
    if (rows.length !== 1 || typeof rows[0].digest !== "string" || !/^[a-f0-9]{32}$/.test(rows[0].digest)) throw new Refusal("Complete fixture digest unavailable");
    return rows[0].digest;
  };
  try {
    if (!uuid.test(fixture.actorId) || !uuid.test(fixture.characterId) || !Number.isInteger(maxMs) || maxMs < 1000 || maxMs > 15000
      || !Number.isInteger(pollMs) || pollMs < 1 || pollMs > 250 || new Set(report.backendPids).size !== 3
      || report.backendPids.some(pid => !Number.isSafeInteger(pid) || pid <= 0)) throw new Refusal("Invalid bounded native session configuration");
    for (const side of ["blocker", "checker", "observer"] as const) {
      await run(sessions[side], `SET application_name='${names[side]}'`);
      const rows = await run(sessions[side], "SELECT pg_backend_pid() AS pid,current_user AS role,current_database() AS database");
      if (rows.length !== 1 || rows[0].pid !== sessions[side].backendPid || rows[0].role !== "postgres" || rows[0].database !== "postgres") throw new Refusal("Exact native session identity unavailable");
    }
    const inputs = readInputs(await run(sessions.observer, inputSql(fixture)), fixture);
    for (const name of PARENT_CONTENTION_CASES) {
      deadline = Date.now() + maxMs;
      const item: ParentContentionReport["cases"][number] = { name, status: "failed", expectedSqlstate: name === "owner-delete" ? "00000" : "42501" };
      report.cases.push(item);
      try {
        item.beforeDigest = await digest();
        await begin(sessions.blocker); await run(sessions.blocker, "SELECT private.lock_enrolled_parent_guard_v1()");
        await begin(sessions.checker);
        await run(sessions.checker, `SET LOCAL ROLE ${name === "service-update" ? "service_role" : "authenticated"}`);
        await run(sessions.checker, `SELECT set_config('request.jwt.claims',${json({ sub: fixture.actorId, role: "authenticated" })}::text,true),set_config('request.jwt.claim.sub','${fixture.actorId}',true)`);
        let settled = false;
        const pending = run(sessions.checker, command(name, fixture, inputs)).then(() => name === "owner-delete" ? "00000" : undefined, error => {
          if (!(error instanceof Refusal) || !error.sqlstate) throw error;
          return error.sqlstate;
        }).finally(() => { settled = true; });
        void pending.catch(() => undefined);
        for (;;) {
          const rows = await run(sessions.observer, `SELECT w.pid AS waiter_pid,h.pid AS blocker_pid,w.application_name AS waiter_name,h.application_name AS blocker_name,
w.wait_event_type,w.state,h.pid=ANY(pg_blocking_pids(w.pid)) AS blocked,to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS observed_at
FROM pg_stat_activity w CROSS JOIN pg_stat_activity h WHERE w.pid=${sessions.checker.backendPid} AND h.pid=${sessions.blocker.backendPid}`);
          const row = rows[0];
          if (settled) throw new Refusal("Mutation settled before guard blocking proof");
          if (rows.length !== 1 || row.waiter_pid !== sessions.checker.backendPid || row.blocker_pid !== sessions.blocker.backendPid
            || row.waiter_name !== names.checker || row.blocker_name !== names.blocker || typeof row.observed_at !== "string"
            || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(row.observed_at)) throw new Refusal("Exact guard blocking observation unavailable");
          if (row.blocked === true && row.wait_event_type === "Lock" && row.state === "active") {
            item.edge = { waiterPid: row.waiter_pid as number, blockerPid: row.blocker_pid as number, observedAtUTC: row.observed_at }; break;
          }
          await pause(pollMs);
        }
        // Third session can still acquire the parent while the writer waits on
        // the singleton. A BEFORE ROW-only lock adapter would fail this probe.
        await begin(sessions.observer);
        const probe = await run(sessions.observer, `SELECT id FROM public.characters WHERE id='${fixture.characterId}' AND user_id='${fixture.actorId}' FOR UPDATE NOWAIT`);
        if (probe.length !== 1 || probe[0].id !== fixture.characterId || settled) throw new Refusal("Parent lock was not available before guard admission");
        item.parentProbeSucceeded = true;
        await run(sessions.observer, "ROLLBACK"); await run(sessions.blocker, "ROLLBACK");
        item.observedSqlstate = await pending;
        if (item.observedSqlstate !== item.expectedSqlstate) throw new Refusal("Unexpected post-guard mutation outcome", item.observedSqlstate);
        if (name === "owner-delete") {
          // The fixed DO block records the real ROW_COUNT. Empty protocol rows
          // alone cannot establish a zero-row DELETE.
          const result = await run(sessions.checker, "SELECT current_setting('inkborne.parent_delete_affected',true)::integer AS affected_rows");
          if (result.length !== 1 || result[0].affected_rows !== 0) throw new Refusal("Authenticated DELETE affected-row proof unavailable");
          item.affectedRows = 0;
        }
        await run(sessions.checker, "ROLLBACK");
        item.afterDigest = await digest();
        if (item.afterDigest !== item.beforeDigest) throw new Refusal("Failed mutation changed retained fixture rows");
        const closure = await run(sessions.observer, "SELECT (SELECT count(*)::integer FROM private.character_parent_admissions_v1) AS seals,(SELECT count(*)::integer FROM private.character_builder_capabilities_v1) AS caps");
        if (closure.length !== 1 || closure[0].seals !== 0 || closure[0].caps !== 0) throw new Refusal("Parent admission transaction residue");
        item.status = "passed";
      } catch (error) {
        item.reason = error instanceof Refusal ? error.message : "Unclassified contention failure";
        if (error instanceof Refusal && error.sqlstate) item.observedSqlstate = error.sqlstate;
        break;
      }
    }
  } catch (error) {
    report.cases.push({ name: "owner-update", status: "failed", expectedSqlstate: "42501", reason: error instanceof Refusal ? error.message : "Native setup failed" });
  } finally {
    // End owned pending/aborted transactions by closing their sessions even if
    // an observer/probe failed while a mutation was waiting. No other PID ends.
    const closed = await Promise.allSettled(list.map(async session => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([session.close(), new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Refusal("Owned session close deadline exceeded")), 5000);
        })]);
      } finally { clearTimeout(timer); }
    }));
    report.sessionsClosed = closed.every(result => result.status === "fulfilled");
  }
  report.passed = report.sessionsClosed && report.cases.length === PARENT_CONTENTION_CASES.length && report.cases.every(item => item.status === "passed");
  return report;
}
