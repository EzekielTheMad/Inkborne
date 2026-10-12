import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { mapHomebrewMonsterFormData, mergeMonsterEdit, monsterJsonEqual, type MonsterFormState } from "@/lib/homebrew/monster-form";
import { monsterDataSchema, type MonsterData } from "@/lib/schemas/content-types/monster";
import { effectSchema } from "@/lib/schemas/effects";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const SELECT = "id, system_id, content_type, slug, name, data, effects, source, scope, owner_id, version, created_at, is_retired";
type Client = Awaited<ReturnType<typeof createClient>>;
const envelopeSchema = z.object({
  id: z.string().uuid(), system_id: z.string().uuid(), content_type: z.literal("monster"), slug: z.string().min(1), name: z.string().min(1),
  data: z.unknown(), effects: z.array(effectSchema), source: z.literal("homebrew"), scope: z.literal("personal"), owner_id: z.string().uuid(),
  version: z.number().int().min(1).max(2_147_483_647), created_at: z.string().min(1), is_retired: z.literal(false),
});
export interface HomebrewMonsterRecord {
  id: string; name: string; version: number; data: MonsterData;
}
export type HomebrewMonsterMutationResponse = HomebrewMonsterRecord | MonsterFormState;
const fail = (message: string, fieldErrors?: Record<string, string[]>): MonsterFormState => ({ status: "error", message, ...(fieldErrors ? { fieldErrors } : {}) });
const uncertainSave = () => fail("The save could not be confirmed. Check your Homebrew list before trying again.");

function record(raw: unknown, owner: string, system: string): HomebrewMonsterRecord {
  const row = envelopeSchema.parse(raw);
  if (row.owner_id !== owner || row.system_id !== system) throw new Error("Unexpected private monster envelope.");
  const data = monsterDataSchema.parse(row.data);
  // Send only form controls, never effects or envelope authority, to the client.
  return { id: row.id, name: row.name, version: row.version, data };
}
async function session() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  return error || !user ? null : { client, owner: user.id };
}
async function systemId(client: Client): Promise<string | null> {
  const { data, error } = await client.from("game_systems").select("id").eq("slug", "dnd-5e-2014").eq("status", "published").single();
  if (error) return null;
  const parsed = z.object({ id: z.string().uuid() }).safeParse(data);
  return parsed.success ? parsed.data.id : null;
}
function ownedQuery(client: Client, owner: string, system: string) {
  return client.from("content_definitions").select(SELECT).eq("owner_id", owner).eq("system_id", system)
    .eq("content_type", "monster").eq("source", "homebrew").eq("scope", "personal").eq("is_retired", false);
}
async function context() {
  const auth = await session();
  if (!auth) return null;
  const system = await systemId(auth.client);
  if (!system) throw new Error("The D&D 5e (2014) system is unavailable.");
  return { ...auth, system };
}
export async function listOwnedHomebrewMonsters(): Promise<HomebrewMonsterRecord[]> {
  const ctx = await context();
  if (!ctx) throw new Error("Authentication required.");
  const { data, error } = await ownedQuery(ctx.client, ctx.owner, ctx.system).order("name");
  if (error) throw error;
  return (data ?? []).map((row) => record(row, ctx.owner, ctx.system));
}
export async function getOwnedHomebrewMonster(id: string): Promise<HomebrewMonsterRecord | null> {
  const ctx = await context();
  if (!ctx) throw new Error("Authentication required.");
  if (!z.string().uuid().safeParse(id).success) return null;
  const { data, error } = await ownedQuery(ctx.client, ctx.owner, ctx.system).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const result = record(data, ctx.owner, ctx.system);
  if (result.id !== id) throw new Error("Unexpected monster identifier.");
  return result;
}
function slug(name: string) {
  const base = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "homebrew-monster";
  return `${base}-${randomUUID().slice(0, 8)}`;
}
async function classifyMissing(client: Client, owner: string, system: string, id: string): Promise<MonsterFormState> {
  const { data, error } = await ownedQuery(client, owner, system).eq("id", id).maybeSingle();
  if (error) return fail("The monster could not be loaded. Try again later.");
  if (data) {
    try { record(data, owner, system); } catch { return fail("This monster contains unsupported data and cannot be edited."); }
    return { status: "conflict", message: "This monster changed in another session. Reload latest before saving again." };
  }
  return fail("This private monster could not be found.");
}
export async function createHomebrewMonsterRecord(form: FormData): Promise<HomebrewMonsterMutationResponse> {
  const auth = await session();
  if (!auth) return fail("Sign in before creating a private monster.");
  const parsed = mapHomebrewMonsterFormData(form, "create");
  if (!parsed.success) return fail("Check the highlighted fields and try again.", parsed.fieldErrors);
  const system = await systemId(auth.client);
  if (!system) return fail("The D&D 5e (2014) system is unavailable.");
  try {
    const { data, error } = await auth.client.from("content_definitions").insert({
      system_id: system, content_type: "monster", slug: slug(parsed.value.name), name: parsed.value.name,
      data: { ...parsed.value.data, schema_version: 1 } as unknown as Json,
      effects: [], source: "homebrew", scope: "personal", owner_id: auth.owner,
    }).select(SELECT).single();
    if (error || !data) return uncertainSave();
    const saved = record(data, auth.owner, system);
    if (saved.version !== 1 || saved.name !== parsed.value.name || !monsterJsonEqual(saved.data, parsed.value.data)) return uncertainSave();
    return saved;
  } catch { return uncertainSave(); }
}
export async function updateHomebrewMonsterRecord(form: FormData): Promise<HomebrewMonsterMutationResponse> {
  const auth = await session();
  if (!auth) return fail("Sign in before editing a private monster.");
  const parsed = mapHomebrewMonsterFormData(form, "edit");
  if (!parsed.success) return fail("Check the highlighted fields and try again.", parsed.fieldErrors);
  const { id, expectedVersion, name, data: draft, changedFields } = parsed.value;
  const system = await systemId(auth.client);
  if (!system) return fail("The D&D 5e (2014) system is unavailable.");
  const { data: existing, error: readError } = await ownedQuery(auth.client, auth.owner, system).eq("id", id!).eq("version", expectedVersion!).maybeSingle();
  if (readError) return fail("The monster could not be loaded. Try again later.");
  if (!existing) return classifyMissing(auth.client, auth.owner, system, id!);
  let merged: MonsterData;
  try {
    const current = record(existing, auth.owner, system);
    if (current.id !== id || current.version !== expectedVersion) return fail("The monster identifier or version does not match.");
    merged = mergeMonsterEdit(existing.data, draft, changedFields);
    if (current.name === name && monsterJsonEqual(existing.data, merged)) return { status: "idle", message: "No changes to save." };
  } catch { return fail("The monster contains unsupported data or undeclared changes. Reload before editing."); }
  try {
    const { data, error } = await auth.client.from("content_definitions").update({ name, data: merged as unknown as Json })
      .eq("id", id!).eq("owner_id", auth.owner).eq("system_id", system).eq("content_type", "monster")
      .eq("source", "homebrew").eq("scope", "personal").eq("is_retired", false).eq("version", expectedVersion!)
      .select(SELECT).maybeSingle();
    if (error) return uncertainSave();
    if (!data) return classifyMissing(auth.client, auth.owner, system, id!);
    const saved = record(data, auth.owner, system);
    if (saved.id !== id || saved.version !== expectedVersion! + 1 || saved.name !== name || !monsterJsonEqual(saved.data, merged)) return uncertainSave();
    return saved;
  } catch { return uncertainSave(); }
}
