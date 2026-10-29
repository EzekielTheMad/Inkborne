import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { spawn } from "node:child_process";
import { canonicalHitDieJson } from "../../lib/character/durable-hit-die-canonical";
import { CharacterPsqlSession, type SessionProcess } from "../character-psql-session";
import { assertNativeIdentity, nativeJson, psqlArguments, psqlEnvironment, testRuntime } from "./native";

export type ScratchAccount = { id: string; email: string; password: string };
export type BasicRole = "owner" | "dm" | "member" | "outsider";
type Authenticated = { client: SupabaseClient; context: Record<string, unknown>; claims: Record<string, unknown> };
export type BasicClients = Record<BasicRole, Authenticated> & { service: SupabaseClient; anonymous: SupabaseClient };
export const basicHash = (value: unknown) => createHash("sha256").update(canonicalHitDieJson(value)).digest("hex");
export type BasicSnapshot = {
  parent: Record<string, unknown> & { id: string; user_id: string; campaign_id: string | null; action_revision: string; state: Record<string, unknown> };
  mechanics: Record<string, unknown>; children: Record<string, unknown>; order: Record<string, unknown>; maximum: number;
};
const snapshotExpression = `jsonb_build_object('parent',to_jsonb(c)||jsonb_build_object('action_revision',c.action_revision::text),
  'mechanics',private.character_parent_mechanics_v1(to_jsonb(c)),
  'children',private.basic_sheet_children_v1(c.id),
  'order',(SELECT to_jsonb(o)||jsonb_build_object('producer_revision',o.producer_revision::text)
    FROM private.character_projection_order_v1 o WHERE o.character_id=c.id),
  'maximum',private.builder_multiclass_max_hp_v1(c.id,c.choices,private.builder_progression_full_graph_v1(c.id)))`;

export async function basicSnapshot(characterId: string, ownerId: string): Promise<BasicSnapshot> {
  z.uuid().parse(characterId); z.uuid().parse(ownerId);
  return await nativeJson(`BEGIN READ ONLY;
    SELECT ${snapshotExpression}
    FROM public.characters c WHERE c.id=:'character_id'::uuid AND c.user_id=:'actor_id'::uuid;
    ROLLBACK;`, { character_id: characterId, actor_id: ownerId }) as BasicSnapshot;
}

/** Every intended mutation has an exact full-parent/child/order postimage. */
export function assertBasicTransition(before: BasicSnapshot, after: BasicSnapshot,
  change: { state?: Record<string, unknown>; campaign_id?: string }) {
  const revision = (BigInt(before.parent.action_revision) + BigInt(1)).toString();
  const parent = { ...before.parent, ...change, action_revision: revision };
  const mechanics = { ...before.mechanics, ...change, action_revision: revision };
  assert.equal(basicHash(after), basicHash({ ...before, parent, mechanics, order: { ...before.order, producer_revision: revision } }),
    "native mutation must retain every unrelated parent/child field and advance the existing revision/order exactly once");
}

export async function openBasicClients(config: { supabaseOrigin: string; anonKey: string; serviceRoleKey: string;
  accounts: Record<BasicRole, ScratchAccount> }): Promise<BasicClients> {
  assertNativeIdentity(); assert.equal(config.supabaseOrigin, "http://127.0.0.1:9999");
  const result = {} as BasicClients;
  for (const role of ["owner", "dm", "member", "outsider"] as const) {
    const client: SupabaseClient = createClient(config.supabaseOrigin, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await client.auth.signInWithPassword(config.accounts[role]);
    assert(!login.error && login.data.user?.id === config.accounts[role].id && login.data.session, "scratch native probe sign-in failed; details withheld");
    const verified = await client.auth.getUser(login.data.session.access_token);
    assert(!verified.error && verified.data.user?.id === config.accounts[role].id, "scratch native probe token verification failed");
    const payload = JSON.parse(Buffer.from(login.data.session.access_token.split(".")[1], "base64url").toString("utf8"));
    const claims = z.object({ sub: z.uuid(), role: z.literal("authenticated"), session_id: z.uuid(), exp: z.number().int().positive() }).parse(payload);
    assert.equal(claims.sub, config.accounts[role].id);
    const context = { context_version: 1, actor_id: claims.sub, session_id: claims.session_id,
      jwt_expires_at: new Date(claims.exp * 1000).toISOString().replace(/\.([0-9]{3})Z$/, (_, ms: string) => "." + ms + "000Z") };
    result[role] = { client, claims, context };
  }
  result.service = createClient(config.supabaseOrigin, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  result.anonymous = createClient(config.supabaseOrigin, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return result;
}

// No token/password is interpolated or emitted. This uses only the four native
// claims from the actual token verified above, the existing native role path,
// and the original producer in one ROLLBACK transaction. Real HTTP role cases
// below independently test the actual PostgREST JWT/execute boundary.
const textLiteral = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const literal = (value: unknown) => textLiteral(JSON.stringify(value)) + "::jsonb";
export async function verifyBasicRollback(clients: BasicClients, before: BasicSnapshot, command: "hp" | "campaign", campaignId: string) {
  const request = command === "hp"
    ? { character_id: before.parent.id, expected_parent: before.mechanics, expected_max_hp: before.maximum,
      patch: { temp_hp: Number(before.parent.state.temp_hp ?? 0) + 1 } }
    : { character_id: before.parent.id, campaign_id: z.uuid().parse(campaignId), expected_campaign_id: null,
      expected_revision: before.parent.action_revision };
  const name = command === "hp" ? "character_manual_hp_command_v1" : "character_campaign_assignment_v1";
  const claimSetup = `BEGIN PERFORM set_config('request.jwt.claims',${textLiteral(JSON.stringify(clients.owner.claims))},true); END;`;
  const attempt = `DECLARE receipt jsonb; BEGIN receipt:=public.${name}(${literal(clients.owner.context)},${literal(request)});
    PERFORM set_config('inkborne.csj_rollback_receipt',receipt::text,true); END;`;
  const result = await nativeJson(`BEGIN;
    SET LOCAL standard_conforming_strings=on;
    DO ${textLiteral(claimSetup)};
    SET LOCAL ROLE authenticated;
    DO ${textLiteral(attempt)};
    RESET ROLE;
    SELECT jsonb_build_object('receipt',current_setting('inkborne.csj_rollback_receipt')::jsonb,'snapshot',${snapshotExpression})
      FROM public.characters c WHERE c.id=:'character_id'::uuid AND c.user_id=:'actor_id'::uuid;
    ROLLBACK;`, { character_id: before.parent.id, actor_id: before.parent.user_id }) as { receipt: { status: string; revision: string }; snapshot: BasicSnapshot };
  assert.equal(result.receipt.status, "applied", "rollback probe must exercise a real admitted write");
  assert.equal(result.receipt.revision, (BigInt(before.parent.action_revision) + BigInt(1)).toString());
  assertBasicTransition(before, result.snapshot, command === "hp"
    ? { state: { ...before.parent.state, temp_hp: Number(before.parent.state.temp_hp ?? 0) + 1 } } : { campaign_id: campaignId });
  assert.equal(basicHash(await basicSnapshot(before.parent.id, before.parent.user_id)), basicHash(before), "ROLLBACK must restore full native parent/children/order");
  return { command, admittedAndReadInsideTransaction: true, restoredExactlyAfterRollback: true };
}

export async function verifyBasicRefusals(clients: BasicClients, before: BasicSnapshot, campaignId: string) {
  const hp = { character_id: before.parent.id, expected_parent: before.mechanics, expected_max_hp: before.maximum, patch: { temp_hp: 7 } };
  const campaign = { character_id: before.parent.id, campaign_id: campaignId, expected_campaign_id: null, expected_revision: before.parent.action_revision };
  const evidence: Array<{ actor: string; command: string; http: number; code?: string; outcome: string }> = [];
  const retained = async () => assert.equal(basicHash(await basicSnapshot(before.parent.id, before.parent.user_id)), basicHash(before), "refused command must retain every native field/child/order");
  for (const role of ["anonymous", "service", "dm", "member", "outsider"] as const) {
    for (const [name, request] of [["character_manual_hp_command_v1", hp], ["character_campaign_assignment_v1", campaign]] as const) {
      const identity = role === "service" || role === "anonymous" ? clients[role] : clients[role].client;
      const context = role === "service" || role === "anonymous" ? clients.owner.context : clients[role].context;
      const result = await identity.rpc(name, { p_context: context, p_request: request });
      // No unauthenticated/foreign success, filtered-row equivalence or network
      // failure can count as a refusal: authorization itself must answer.
      assert([401, 403].includes(result.status) && result.error?.code === "42501", "native role denial must reach authorization; stop on unexpected success");
      await retained(); evidence.push({ actor: role, command: name, http: result.status, code: result.error.code, outcome: "refused_unchanged" });
    }
  }
  // Call the native entry point directly: app-side validation cannot establish
  // the SQL field boundary. These are all outside the finite nonlethal contract.
  for (const [name, patch] of [
    ["empty_patch", {}],
    ["death_saves", { temp_hp: 7, death_saves: { successes: 1, failures: 0 } }],
    ["concentration", { temp_hp: 7, concentrating_on: "test" }],
    ["spell_slots", { temp_hp: 7, spell_slots: { "1": 1 } }],
    ["zero_hp", { current_hp: 0 }],
    ["negative_temp_hp", { temp_hp: -1 }],
  ] as const) {
    const result = await clients.owner.client.rpc("character_manual_hp_command_v1", {
      p_context: clients.owner.context, p_request: { ...hp, patch },
    });
    assert(!result.error && result.status === 200 && result.data?.status === "invalid", "native HP boundary must explicitly reject the invalid patch");
    await retained();
    evidence.push({ actor: "owner", command: name, http: result.status, outcome: "invalid_unchanged" });
  }
  const stale = { ...hp, expected_parent: { ...before.mechanics, action_revision: (BigInt(before.parent.action_revision) - BigInt(1)).toString() } };
  const conflict = await clients.owner.client.rpc("character_manual_hp_command_v1", { p_context: clients.owner.context, p_request: stale });
  assert(!conflict.error && conflict.status === 200 && conflict.data?.status === "conflict", "stale HP must explicitly refuse"); await retained();
  evidence.push({ actor: "owner", command: "stale_hp", http: conflict.status, outcome: "conflict_unchanged" });
  const staleCampaign = await clients.owner.client.rpc("character_campaign_assignment_v1", { p_context: clients.owner.context,
    p_request: { ...campaign, expected_revision: (BigInt(before.parent.action_revision) - BigInt(1)).toString() } });
  assert(!staleCampaign.error && staleCampaign.status === 200 && staleCampaign.data?.status === "conflict", "stale campaign assignment must explicitly refuse"); await retained();
  evidence.push({ actor: "owner", command: "stale_campaign", http: staleCampaign.status, outcome: "conflict_unchanged" });
  for (const [name, args] of [
    ["patch_character_state", { character_id: before.parent.id, state_patch: { current_hp: 1 } }],
    ["patch_character_state_if_current", { character_id: before.parent.id, expected_state: before.parent.state, state_patch: { current_hp: 1 } }],
  ] as const) {
    const result = await clients.owner.client.rpc(name, args);
    assert(result.status === 403 && result.error?.code === "42501", "legacy state writer must remain denied"); await retained();
    evidence.push({ actor: "owner", command: name, http: result.status, code: result.error.code, outcome: "refused_unchanged" });
  }
  const direct = await clients.owner.client.from("characters").update({ state: { current_hp: 1 } }).eq("id", before.parent.id).select("id");
  assert(direct.status === 403 && direct.error?.code === "42501", "direct parent PATCH must remain denied"); await retained();
  evidence.push({ actor: "owner", command: "direct_parent_patch", http: direct.status, code: direct.error.code, outcome: "refused_unchanged" });
  return evidence;
}

/** One existing framed blocker, two real concurrent owner HTTP requests. Both
 * native backends must actually wait on locks before release; this proves the
 * collision rather than merely launching two requests and assuming overlap. */
export async function verifyBasicConcurrency(clients: BasicClients, before: BasicSnapshot) {
  const runtime = testRuntime(), tag = `ib-${runtime.runId.slice(0, 8)}-hp-blocker`;
  const args = psqlArguments("postgres", {}, false);
  const child = spawn("psql", args, { env: psqlEnvironment(tag), stdio: ["pipe", "pipe", "pipe"] });
  const processRecord: SessionProcess = { pid: child.pid!, parentPid: process.pid, cwd: process.cwd(), executable: "psql", args,
    startedUtc: new Date().toISOString(), ports: [], stderrBytes: 0 };
  const session = new CharacterPsqlSession(child, processRecord, value => Object.assign(processRecord, value));
  let locked = false, released = false;
  let capture: { pid: number; birth: string; tag: string } | undefined;
  const requests: Array<PromiseLike<{ data: unknown; error: unknown; status: number }>> = [];
  let waiting: number[] = [];
  try {
    const rows = await session.query("SELECT pg_backend_pid() AS pid,backend_start::text AS birth,current_setting('application_name') AS tag FROM pg_stat_activity WHERE pid=pg_backend_pid()");
    capture = z.object({ pid: z.number().int().positive(), birth: z.string(), tag: z.literal(tag) }).parse(rows[0]);
    session.backendPid = capture.pid;
    await session.query("BEGIN"); locked = true;
    await session.query("SELECT public.lock_character_parent_write_guard_v1()");
    for (const value of [6, 7]) {
      const request = { character_id: before.parent.id, expected_parent: before.mechanics,
        expected_max_hp: before.maximum, patch: { temp_hp: value } };
      requests.push(clients.owner.client.rpc("character_manual_hp_command_v1", { p_context: clients.owner.context, p_request: request })
        .abortSignal(AbortSignal.timeout(15000)).then(result => result));
    }
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      waiting = await nativeJson(`BEGIN READ ONLY;
        SELECT COALESCE(jsonb_agg(pid ORDER BY pid),'[]') FROM pg_stat_activity
        WHERE pid<>pg_backend_pid() AND state='active' AND wait_event_type='Lock'
          AND position('character_manual_hp_command_v1' IN query)>0;
        ROLLBACK;`, {}, "supabase_admin") as number[];
      if (new Set(waiting).size === 2) break;
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    assert.equal(new Set(waiting).size, 2, "both genuine HTTP writers must be observed on separate blocked native backends");
    await session.query("ROLLBACK"); released = true;
    const results = await Promise.all(requests);
    assert(results.every(result => !result.error && result.status === 200), "native concurrent requests must reach the command");
    const values = results.map(result => result.data as { status: string; state?: Record<string, unknown> });
    assert.deepEqual(values.map(value => value.status).sort(), ["applied", "conflict"]);
    const winner = values.find(value => value.status === "applied")!;
    assert([6, 7].includes(Number(winner.state?.temp_hp)));
    const after = await basicSnapshot(before.parent.id, before.parent.user_id);
    assertBasicTransition(before, after, { state: { ...before.parent.state, temp_hp: winner.state!.temp_hp } });
    return { separateBlockedBackends: waiting, actualOwnerRequests: 2, applied: 1, conflict: 1,
      before: basicHash(before), after: basicHash(after), process: processRecord, blockerReleased: true };
  } finally {
    if (locked && !released) await session.query("ROLLBACK").catch(() => {});
    await Promise.allSettled(requests);
    await session.close();
    if (capture) {
      const remaining = await nativeJson(`BEGIN READ ONLY;
        SELECT count(*) FROM pg_stat_activity WHERE application_name='${tag}' AND pid=${capture.pid}; ROLLBACK;`);
      assert.equal(remaining, 0, "the exact task-owned blocker backend must close");
    }
  }
}
