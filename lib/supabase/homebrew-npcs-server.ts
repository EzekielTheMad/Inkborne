import "server-only";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { mapNpcForm, mergeNpcEdit, npcNameSchema, npcUncertainty, npcVersionSchema, NPC_VERSION_MAX, type NpcActionState } from "@/lib/homebrew/npc-form";
import type { NpcData } from "@/lib/schemas/content-types/npc";
import { parseContentDefinition, parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

const SELECT = "id, system_id, content_type, slug, name, data, effects, source, scope, owner_id, version, created_at, is_retired";
const SNAPSHOT = "content_id, version, system_id_snapshot, content_type_snapshot, slug_snapshot, name_snapshot, data_snapshot, effects_snapshot, source_snapshot, scope_snapshot, owner_id_snapshot";
type Client = Awaited<ReturnType<typeof createClient>>;
const envelope = z.object({ id: z.uuid(), system_id: z.uuid(), content_type: z.literal("npc"), slug: z.string().min(1), name: npcNameSchema,
  data: z.record(z.string(), z.unknown()), effects: z.array(z.unknown()).length(0), source: z.literal("homebrew"), scope: z.literal("personal"),
  owner_id: z.uuid(), version: npcVersionSchema, created_at: z.string().min(1), is_retired: z.literal(false) });
export interface HomebrewNpcRecord { id: string; name: string; version: number; data: NpcData }
const fail = (message: string, fieldErrors?: Record<string, string[]>): NpcActionState => ({ status: "error", message, ...(fieldErrors ? { fieldErrors } : {}) });
function admit(raw: unknown, owner: string, system: string) {
  const row = envelope.parse(raw);
  if (row.owner_id !== owner || row.system_id !== system || !parseContentDefinition(raw)) throw Error("Unsupported private NPC");
  return row;
}
function record(row: z.infer<typeof envelope>): HomebrewNpcRecord { return { id: row.id, name: row.name, version: row.version, data: row.data as NpcData }; }
async function context() {
  const client = await createClient(); const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw Error("Authentication unavailable");
  const { data, error: systemError } = await client.from("game_systems").select("id").eq("slug", "dnd-5e-2014").eq("status", "published").single();
  const system = z.object({ id: z.uuid() }).safeParse(data);
  if (systemError || !system.success) throw Error("Canonical system unavailable");
  return { client, owner: user.id, system: system.data.id };
}
function owned(client: Client, owner: string, system: string) {
  return client.from("content_definitions").select(SELECT).eq("owner_id", owner).eq("system_id", system).eq("content_type", "npc")
    .eq("source", "homebrew").eq("scope", "personal").eq("is_retired", false);
}
export async function listOwnedHomebrewNpcs(): Promise<HomebrewNpcRecord[]> {
  const ctx = await context(); const { data, error } = await owned(ctx.client, ctx.owner, ctx.system).order("name");
  if (error || !Array.isArray(data)) throw Error("NPC list unavailable");
  return data.map(row => record(admit(row, ctx.owner, ctx.system)));
}
export async function getOwnedHomebrewNpc(id: string): Promise<HomebrewNpcRecord | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const ctx = await context(); const { data, error } = await owned(ctx.client, ctx.owner, ctx.system).eq("id", id).maybeSingle();
  if (error) throw Error("NPC unavailable"); if (!data) return null;
  const row = admit(data, ctx.owner, ctx.system); if (row.id !== id) throw Error("NPC identity mismatch"); return record(row);
}
async function confirmPin(ctx: Awaited<ReturnType<typeof context>>, row: z.infer<typeof envelope>) {
  const { data, error } = await ctx.client.from("content_versions").select(SNAPSHOT).eq("content_id", row.id).eq("version", row.version)
    .eq("owner_id_snapshot", ctx.owner).eq("system_id_snapshot", ctx.system).eq("content_type_snapshot", "npc")
    .eq("source_snapshot", "homebrew").eq("scope_snapshot", "personal").single();
  const pin = !error && parseContentVersionSnapshot(data);
  if (!pin || pin.id !== row.id || pin.version !== row.version || pin.system_id !== ctx.system || pin.owner_id !== ctx.owner
    || pin.content_type !== "npc" || pin.source !== "homebrew" || pin.scope !== "personal" || pin.name !== row.name || pin.slug !== row.slug
    || !isDeepStrictEqual((data as { data_snapshot?: unknown }).data_snapshot, row.data) || pin.effects.length !== 0) throw Error("Exact saved snapshot unavailable");
  // Confirms this exact saved version only, not whether a later version/scope exists.
}
async function missing(ctx: Awaited<ReturnType<typeof context>>, id: string, expected: number): Promise<NpcActionState> {
  const { data, error } = await owned(ctx.client, ctx.owner, ctx.system).eq("id", id).maybeSingle();
  if (error) return npcUncertainty("edit"); if (!data) return fail("This private NPC is unavailable.");
  try {
    const row = admit(data, ctx.owner, ctx.system);
    if (row.id !== id || row.version <= expected) return npcUncertainty("edit");
    return { status: "conflict", message: "This NPC changed in another session. Your draft is kept. Reload latest before saving." };
  } catch { return fail("This NPC contains unsupported data and cannot be edited."); }
}
export async function createHomebrewNpcRecord(form: FormData): Promise<NpcActionState> {
  let ctx: Awaited<ReturnType<typeof context>>;
  try { ctx = await context(); } catch { return fail("Sign in and load the published D&D 5e (2014) system before creating an NPC."); }
  const mapped = mapNpcForm(form, "create"); if (!mapped.success) return fail("Check the highlighted fields.", mapped.fieldErrors);
  // Freeze both server-generated identities before INSERT; never regenerate/retry after uncertainty.
  const id = randomUUID(), slug = `private-npc-${randomUUID()}`, { name, data: draft } = mapped.value;
  try {
    const { data, error } = await ctx.client.from("content_definitions").insert({ id, slug, system_id: ctx.system, content_type: "npc", name,
      data: draft as unknown as Json, effects: [], source: "homebrew", scope: "personal", owner_id: ctx.owner }).select(SELECT).single();
    if (error || !data) return npcUncertainty("create");
    const row = admit(data, ctx.owner, ctx.system);
    if (row.id !== id || row.slug !== slug || row.version !== 1 || row.name !== name || !isDeepStrictEqual(row.data, draft)) return npcUncertainty("create");
    await confirmPin(ctx, row); return { status: "saved", id, version: 1, operation: "create" };
  } catch { return npcUncertainty("create"); }
}
export async function updateHomebrewNpcRecord(form: FormData): Promise<NpcActionState> {
  let ctx: Awaited<ReturnType<typeof context>>;
  try { ctx = await context(); } catch { return fail("Sign in and load the published D&D 5e (2014) system before editing an NPC."); }
  const mapped = mapNpcForm(form, "edit"); if (!mapped.success) return fail("Check the highlighted fields.", mapped.fieldErrors);
  const { id, expectedVersion, name, data: draft, changedFields } = mapped.value;
  let original: z.infer<typeof envelope>, merged: NpcData;
  try {
    const { data, error } = await owned(ctx.client, ctx.owner, ctx.system).eq("id", id!).eq("version", expectedVersion!).maybeSingle();
    if (error) return fail("This NPC could not be read. No update was attempted.");
    if (!data) return await missing(ctx, id!, expectedVersion!);
    original = admit(data, ctx.owner, ctx.system);
    if (original.id !== id || original.version !== expectedVersion) return fail("NPC identity or version mismatch.");
    merged = mergeNpcEdit(original.data, draft, changedFields);
    if (original.name === name && isDeepStrictEqual(original.data, merged)) return { status: "unchanged", id: id!, version: expectedVersion!, message: "No changes to save." };
    if (expectedVersion === NPC_VERSION_MAX) return fail("This NPC has reached its version limit. No update was attempted.");
  } catch { return fail("This NPC contains unsupported data or could not be read. No update was attempted."); }
  try {
    const { data, error } = await ctx.client.from("content_definitions").update({ name, data: merged as unknown as Json })
      .eq("id", id!).eq("owner_id", ctx.owner).eq("system_id", ctx.system).eq("content_type", "npc").eq("source", "homebrew")
      .eq("scope", "personal").eq("is_retired", false).eq("version", expectedVersion!).select(SELECT).maybeSingle();
    if (error) return npcUncertainty("edit"); if (!data) return await missing(ctx, id!, expectedVersion!);
    const row = admit(data, ctx.owner, ctx.system);
    if (row.id !== id || row.slug !== original.slug || row.created_at !== original.created_at || row.version !== expectedVersion! + 1
      || row.name !== name || !isDeepStrictEqual(row.data, merged)) return npcUncertainty("edit");
    await confirmPin(ctx, row); return { status: "saved", id: id!, version: row.version, operation: "edit" };
  } catch { return npcUncertainty("edit"); }
}
