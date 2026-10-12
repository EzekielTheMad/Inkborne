import "server-only";

import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { homebrewTraitVersionSchema, inspectTraitResourceEditability, mapHomebrewTraitFormData, overlayTraitResourceControls,
  TRAIT_UNCERTAIN_MESSAGE, type HomebrewTraitActionState } from "@/lib/homebrew/trait-form";
import { traitDataSchema, type TraitData } from "@/lib/schemas/content-types/trait";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const SELECT = "id, system_id, content_type, slug, name, data, effects, source, scope, owner_id, version, created_at, is_retired";
type Client = Awaited<ReturnType<typeof createClient>>;
const envelopeSchema = z.object({ id: z.string().uuid(), system_id: z.string().uuid(), content_type: z.literal("trait"),
  slug: z.string().min(1), name: z.string().min(1), data: z.record(z.string(), z.unknown()), effects: z.array(z.unknown()),
  source: z.literal("homebrew"), scope: z.literal("personal"), owner_id: z.string().uuid(),
  version: homebrewTraitVersionSchema, created_at: z.string().min(1), is_retired: z.literal(false) });
export interface HomebrewTraitRecord extends Omit<z.infer<typeof envelopeSchema>, "data"> {
  data: TraitData;
  resourceEditable: boolean;
}
type Feedback = Exclude<HomebrewTraitActionState, { status: "saved" }>;
export type HomebrewTraitMutationResponse = HomebrewTraitRecord | Feedback;
const failure = (message: string, fieldErrors?: Record<string, string[]>): Feedback => ({ status: "error", message, ...(fieldErrors ? { fieldErrors } : {}) });
const uncertain = (create: boolean): Feedback => ({ status: "uncertain", message: create ? TRAIT_UNCERTAIN_MESSAGE : "The save could not be confirmed. Your draft is kept. Reload this trait before saving again." });

function parseRecord(value: unknown, userId: string, systemId: string): HomebrewTraitRecord {
  const envelope = envelopeSchema.parse(value);
  if (envelope.owner_id !== userId || envelope.system_id !== systemId) throw Error("Unexpected trait ownership or system.");
  const data = traitDataSchema.parse(envelope.data);
  return { ...envelope, data, resourceEditable: inspectTraitResourceEditability(envelope.data) };
}
async function session() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return !error && user ? { supabase, userId: user.id } : null;
}
async function publishedSystem(supabase: Client): Promise<string | null> {
  const { data, error } = await supabase.from("game_systems").select("id")
    .eq("slug", "dnd-5e-2014").eq("status", "published").single();
  const parsed = z.object({ id: z.string().uuid() }).safeParse(data);
  return !error && parsed.success ? parsed.data.id : null;
}
function ownedRead(supabase: Client, userId: string, systemId: string) {
  return supabase.from("content_definitions").select(SELECT)
    .eq("owner_id", userId).eq("system_id", systemId).eq("content_type", "trait")
    .eq("source", "homebrew").eq("scope", "personal").eq("is_retired", false);
}
export async function listOwnedHomebrewTraits(): Promise<HomebrewTraitRecord[]> {
  const auth = await session();
  if (!auth) throw Error("Authentication required.");
  const systemId = await publishedSystem(auth.supabase);
  if (!systemId) throw Error("The D&D 5e (2014) system is unavailable.");
  const { data, error } = await ownedRead(auth.supabase, auth.userId, systemId).order("name");
  if (error) throw error;
  return (data ?? []).map(row => parseRecord(row, auth.userId, systemId));
}
export async function getOwnedHomebrewTrait(id: string): Promise<HomebrewTraitRecord | null> {
  const auth = await session();
  if (!auth) throw Error("Authentication required.");
  if (!z.string().uuid().safeParse(id).success) return null;
  const systemId = await publishedSystem(auth.supabase);
  if (!systemId) throw Error("The D&D 5e (2014) system is unavailable.");
  const { data, error } = await ownedRead(auth.supabase, auth.userId, systemId).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? parseRecord(data, auth.userId, systemId) : null;
}
export async function createHomebrewTraitRecord(form: FormData): Promise<HomebrewTraitMutationResponse> {
  let auth: Awaited<ReturnType<typeof session>>;
  let systemId: string | null;
  const parsed = mapHomebrewTraitFormData(form, true);
  if (!parsed.success) return failure("Check the highlighted fields and try again.", parsed.fieldErrors);
  try {
    auth = await session();
    if (!auth) return failure("Sign in before creating a homebrew trait.");
    systemId = await publishedSystem(auth.supabase);
    if (!systemId) return failure("The D&D 5e (2014) system is unavailable.");
  } catch { return failure("The trait could not be prepared for saving. No creation was attempted."); }
  const resource = parsed.data.resource;
  const content = traitDataSchema.parse({ description: parsed.data.description, recovery: resource?.recovery ?? null,
    ...(resource?.usages !== undefined ? { usages: resource.usages } : {}) });
  const id = randomUUID();
  const base = parsed.data.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "homebrew-trait";
  const slug = `${base}-${id.slice(0, 8)}`;
  try {
    const { data, error } = await auth.supabase.from("content_definitions").insert({ id, system_id: systemId,
      content_type: "trait", slug, name: parsed.data.name, data: content as unknown as Json, effects: [],
      source: "homebrew", scope: "personal", owner_id: auth.userId }).select(SELECT).single();
    // A generated identity is not an idempotency receipt. Never retry an uncertain INSERT.
    if (error?.code === "23505") return failure("The creation was rejected because its identity conflicted. Check your Homebrew before another create.");
    if (error || !data) return uncertain(true);
    const record = parseRecord(data, auth.userId, systemId);
    if (record.id !== id || record.slug !== slug || record.version !== 1 || record.name !== parsed.data.name
      || !isDeepStrictEqual(record.data, content) || record.effects.length !== 0) return uncertain(true);
    return record;
  } catch { return uncertain(true); }
}
async function missingUpdate(supabase: Client, userId: string, systemId: string, id: string): Promise<Feedback> {
  const { data, error } = await ownedRead(supabase, userId, systemId).eq("id", id).maybeSingle();
  if (error) return failure("The current trait could not be checked. Reload before saving again.");
  if (!data) return failure("This homebrew trait could not be found.");
  try { parseRecord(data, userId, systemId); } catch { return failure("This homebrew trait could not be read."); }
  return { status: "conflict", message: "This trait changed in another session. Your draft is kept. Reload it before saving again." };
}
export async function updateHomebrewTraitRecord(id: string, expectedVersion: number, form: FormData): Promise<HomebrewTraitMutationResponse> {
  const identity = z.object({ id: z.string().uuid(), expectedVersion: homebrewTraitVersionSchema }).safeParse({ id, expectedVersion });
  if (!identity.success) return failure("The trait identifier or version is invalid. Reload before saving.");
  let auth: Awaited<ReturnType<typeof session>>;
  let systemId: string | null;
  let existing: unknown;
  try {
    auth = await session();
    if (!auth) return failure("Sign in before updating a homebrew trait.");
    systemId = await publishedSystem(auth.supabase);
    if (!systemId) return failure("The D&D 5e (2014) system is unavailable.");
    const { data, error } = await ownedRead(auth.supabase, auth.userId, systemId).eq("id", id).eq("version", expectedVersion).maybeSingle();
    if (error) return failure("The trait could not be read. Reload before saving.");
    if (!data) return await missingUpdate(auth.supabase, auth.userId, systemId, id);
    existing = data;
  } catch { return failure("The trait could not be read. No update was attempted."); }
  let merged: Record<string, unknown>;
  let record: HomebrewTraitRecord;
  try {
    record = parseRecord(existing, auth.userId, systemId);
    if (record.id !== id || record.version !== expectedVersion) return failure("The trait row did not match the requested version.");
    const raw = envelopeSchema.parse(existing).data;
    const parsed = mapHomebrewTraitFormData(form, inspectTraitResourceEditability(raw));
    if (!parsed.success) return failure("Check the highlighted fields and try again.", parsed.fieldErrors);
    merged = parsed.data.resource ? overlayTraitResourceControls(raw, parsed.data.resource) : { ...raw };
    merged.description = parsed.data.description;
    traitDataSchema.parse(merged); // Validate known fields; never serialize stripped output.
    record = { ...record, name: parsed.data.name };
  } catch { return failure("This trait contains unsupported data and could not be edited."); }
  try {
    const { data, error } = await auth.supabase.from("content_definitions").update({ name: record.name, data: merged as unknown as Json })
      .eq("id", id).eq("owner_id", auth.userId).eq("system_id", systemId).eq("content_type", "trait")
      .eq("source", "homebrew").eq("scope", "personal").eq("is_retired", false).eq("version", expectedVersion)
      .select(SELECT).maybeSingle();
    // Effects, envelope, relations and original raw extensions are not authored.
    if (error) return uncertain(false);
    if (!data) return await missingUpdate(auth.supabase, auth.userId, systemId, id);
    const saved = parseRecord(data, auth.userId, systemId);
    if (saved.id !== id || saved.slug !== record.slug || saved.name !== record.name
      || ![expectedVersion, expectedVersion + 1].includes(saved.version)
      || !isDeepStrictEqual(envelopeSchema.parse(data).data, merged) || !isDeepStrictEqual(saved.effects, record.effects)) return uncertain(false);
    return saved;
  } catch { return uncertain(false); }
}
