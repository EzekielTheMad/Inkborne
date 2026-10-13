import "server-only";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { mapHomebrewMagicItemFormData, mergeMagicItemEdit, magicItemUncertainty, magicItemVersionSchema, MAGIC_ITEM_VERSION_MAX, type MagicItemActionState } from "@/lib/homebrew/magic-item-form";
import { magicItemDataSchema, type MagicItemData } from "@/lib/schemas/content-types/magic-item";
import { effectSchema } from "@/lib/schemas/effects";
import { parseContentDefinition, parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const SELECT = "id, system_id, content_type, slug, name, data, effects, source, scope, owner_id, version, created_at, is_retired";
const SNAPSHOT = "content_id, version, system_id_snapshot, content_type_snapshot, slug_snapshot, name_snapshot, data_snapshot, effects_snapshot, source_snapshot, scope_snapshot, owner_id_snapshot";
const envelope = z.object({ id: z.uuid(), system_id: z.uuid(), content_type: z.literal("magic_item"), slug: z.string().min(1), name: z.string().min(1),
  data: z.record(z.string(), z.unknown()), effects: z.array(z.unknown()), source: z.literal("homebrew"), scope: z.literal("personal"), owner_id: z.uuid(),
  version: magicItemVersionSchema, created_at: z.string().min(1), is_retired: z.literal(false) });
type RawRow = z.infer<typeof envelope>;
export interface HomebrewMagicItemRecord extends Omit<RawRow, "data"> { data: MagicItemData }
export type HomebrewMagicItemMutationResult = MagicItemActionState;
export type HomebrewMagicItemMutationResponse = MagicItemActionState;
const fail = (message: string, fieldErrors?: Record<string, string[]>): MagicItemActionState => ({ status: "error", message, ...(fieldErrors ? { fieldErrors } : {}) });
function admit(raw: unknown, owner: string, system: string): RawRow {
  const row = envelope.parse(raw);
  magicItemDataSchema.parse(row.data);
  z.array(effectSchema).parse(row.effects); // Validation only: do not serialize stripped validator output.
  if (row.owner_id !== owner || row.system_id !== system || !parseContentDefinition(raw)) throw Error("Unsupported private magic item");
  // The validators may strip extension keys. Keep the admitted original JSON,
  // including nested metadata and raw effect fields, for comparisons/merges.
  const original = raw as { data: Record<string, unknown>; effects: unknown[] };
  return { ...row, data: original.data, effects: original.effects };
}
function record(row: RawRow): HomebrewMagicItemRecord {
  return { ...row, data: magicItemDataSchema.parse(row.data) };
}
async function session() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || !z.uuid().safeParse(user.id).success) throw Error("Authentication required");
  return { client, owner: user.id };
}
async function context(auth: Awaited<ReturnType<typeof session>>) {
  const { data, error } = await auth.client.from("game_systems").select("id").eq("slug", "dnd-5e-2014").eq("status", "published").single();
  const system = z.object({ id: z.uuid() }).safeParse(data);
  if (error || !system.success) throw Error("Canonical published system unavailable");
  return { ...auth, system: system.data.id };
}
type Context = Awaited<ReturnType<typeof context>>;
function owned(ctx: Context) {
  return ctx.client.from("content_definitions").select(SELECT).eq("owner_id", ctx.owner).eq("system_id", ctx.system)
    .eq("content_type", "magic_item").eq("source", "homebrew").eq("scope", "personal").eq("is_retired", false);
}
export async function listOwnedHomebrewMagicItems(): Promise<HomebrewMagicItemRecord[]> {
  const ctx = await context(await session());
  const { data, error } = await owned(ctx).order("name");
  if (error || !Array.isArray(data)) throw Error("Magic item list unavailable");
  return data.map(raw => record(admit(raw, ctx.owner, ctx.system)));
}
export async function getOwnedHomebrewMagicItem(id: string): Promise<HomebrewMagicItemRecord | null> {
  const auth = await session();
  if (!z.uuid().safeParse(id).success) return null;
  const ctx = await context(auth);
  const { data, error } = await owned(ctx).eq("id", id).maybeSingle();
  if (error) throw Error("Magic item unavailable");
  if (!data) return null;
  const row = admit(data, ctx.owner, ctx.system);
  if (row.id !== id) throw Error("Magic item identity mismatch");
  return record(row);
}
function slugify(name: string) {
  const base = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "homebrew-magic-item";
  return `${base}-${randomUUID().slice(0, 8)}`;
}
async function confirmPin(ctx: Context, row: RawRow) {
  const { data, error } = await ctx.client.from("content_versions").select(SNAPSHOT).eq("content_id", row.id).eq("version", row.version)
    .eq("owner_id_snapshot", ctx.owner).eq("system_id_snapshot", ctx.system).eq("content_type_snapshot", "magic_item")
    .eq("source_snapshot", "homebrew").eq("scope_snapshot", "personal").single();
  const pin = !error && parseContentVersionSnapshot(data);
  const raw = data as { data_snapshot?: unknown; effects_snapshot?: unknown } | null;
  if (!pin || pin.id !== row.id || pin.version !== row.version || pin.owner_id !== ctx.owner || pin.system_id !== ctx.system
    || pin.content_type !== "magic_item" || pin.source !== "homebrew" || pin.scope !== "personal" || pin.name !== row.name || pin.slug !== row.slug
    || !isDeepStrictEqual(raw?.data_snapshot, row.data) || !isDeepStrictEqual(raw?.effects_snapshot, row.effects)) throw Error("Exact saved snapshot unavailable");
  // This confirms an exact immutable version, not latest/private status after a concurrent edit.
}
async function missing(ctx: Context, id: string, expected: number, issued: boolean): Promise<MagicItemActionState> {
  try {
    const { data, error } = await owned(ctx).eq("id", id).maybeSingle();
    if (error || !data) return issued ? magicItemUncertainty("edit") : fail("This private magic item is unavailable. No update was attempted.");
    const row = admit(data, ctx.owner, ctx.system);
    if (row.id === id && row.version > expected) return { status: "conflict", message: "This magic item changed in another session. Your draft is kept. Reload before saving." };
  } catch { /* Inconclusive rereads never authorize a retry or pretend to prove a newer version. */ }
  return issued ? magicItemUncertainty("edit") : fail("This private magic item could not be identified. No update was attempted.");
}
export async function createHomebrewMagicItemRecord(form: FormData): Promise<MagicItemActionState> {
  let auth: Awaited<ReturnType<typeof session>>;
  try { auth = await session(); } catch { return fail("Sign in before creating a homebrew magic item."); }
  const mapped = mapHomebrewMagicItemFormData(form);
  if (!mapped.success) return fail("Check the highlighted fields.", mapped.fieldErrors);
  let ctx: Context;
  try { ctx = await context(auth); } catch { return fail("The published D&D 5e (2014) system is unavailable. No create was attempted."); }
  const id = randomUUID(), slug = slugify(mapped.data.name), { name, data: draft } = mapped.data;
  try {
    const { data, error } = await ctx.client.from("content_definitions").insert({ id, slug, system_id: ctx.system, content_type: "magic_item", name,
      data: draft as unknown as Json, effects: [], source: "homebrew", scope: "personal", owner_id: ctx.owner }).select(SELECT).single();
    if (error || !data) return magicItemUncertainty("create");
    const row = admit(data, ctx.owner, ctx.system);
    if (row.id !== id || row.slug !== slug || row.version !== 1 || row.name !== name || !isDeepStrictEqual(row.data, draft) || !isDeepStrictEqual(row.effects, [])) return magicItemUncertainty("create");
    await confirmPin(ctx, row);
    return { status: "saved", operation: "create", id, version: 1 };
  } catch { return magicItemUncertainty("create"); }
}
export async function updateHomebrewMagicItemRecord(id: string, expectedVersion: number, form: FormData): Promise<MagicItemActionState> {
  let auth: Awaited<ReturnType<typeof session>>;
  try { auth = await session(); } catch { return fail("Sign in before editing a homebrew magic item."); }
  if (!z.uuid().safeParse(id).success || !magicItemVersionSchema.safeParse(expectedVersion).success) return fail("The magic-item identifier or version is invalid.");
  const mapped = mapHomebrewMagicItemFormData(form);
  if (!mapped.success) return fail("Check the highlighted fields.", mapped.fieldErrors);
  let ctx: Context;
  try { ctx = await context(auth); } catch { return fail("The published D&D 5e (2014) system is unavailable. No update was attempted."); }
  let original: RawRow, merged: ReturnType<typeof mergeMagicItemEdit>;
  try {
    const { data, error } = await owned(ctx).eq("id", id).eq("version", expectedVersion).maybeSingle();
    if (error) return fail("The magic item could not be read. No update was attempted.");
    if (!data) return await missing(ctx, id, expectedVersion, false);
    original = admit(data, ctx.owner, ctx.system);
    if (original.id !== id || original.version !== expectedVersion) return fail("Magic-item identity or version mismatch. No update was attempted.");
    merged = mergeMagicItemEdit(original.name, original.data, mapped.data);
    if (original.name === merged.name && isDeepStrictEqual(original.data, merged.data)) return { status: "unchanged", id, version: expectedVersion, message: "This invocation did not write a new version: no controls changed." };
    if (expectedVersion === MAGIC_ITEM_VERSION_MAX) return fail("This magic item has reached its version limit. No update was attempted.");
  } catch { return fail("This magic item contains unsupported data or could not be read. No update was attempted."); }
  try {
    const { data, error } = await ctx.client.from("content_definitions").update({ name: merged.name, data: merged.data as Json })
      .eq("id", id).eq("owner_id", ctx.owner).eq("system_id", ctx.system).eq("content_type", "magic_item").eq("source", "homebrew")
      .eq("scope", "personal").eq("is_retired", false).eq("version", expectedVersion).select(SELECT).maybeSingle();
    if (error) return magicItemUncertainty("edit");
    if (!data) return await missing(ctx, id, expectedVersion, true);
    const row = admit(data, ctx.owner, ctx.system);
    if (row.id !== id || row.slug !== original.slug || row.created_at !== original.created_at || row.version !== expectedVersion + 1
      || row.name !== merged.name || !isDeepStrictEqual(row.data, merged.data) || !isDeepStrictEqual(row.effects, original.effects)) return magicItemUncertainty("edit");
    await confirmPin(ctx, row);
    return { status: "saved", operation: "edit", id, version: row.version };
  } catch { return magicItemUncertainty("edit"); }
}
