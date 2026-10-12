import "server-only";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { FEATURE_VERSION_MAX, featureUncertainty, featureVersionSchema, mapPassiveFeatureCreate, mapPassiveFeatureEdit,
  type FeatureActionState, type FeatureFeedback } from "@/lib/homebrew/passive-feature-form";
import { featureDataSchema, type FeatureType } from "@/lib/schemas/content-types/feature";
import { effectSchema } from "@/lib/schemas/effects";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const SELECT = "id, system_id, content_type, slug, name, data, effects, source, scope, owner_id, version, created_at, is_retired";
type Client = Awaited<ReturnType<typeof createClient>>;
const envelopeSchema = z.object({ id: z.string().uuid(), system_id: z.string().uuid(), content_type: z.literal("feature"),
  slug: z.string().min(1), name: z.string().min(1), data: z.record(z.string(), z.unknown()), effects: z.array(z.unknown()),
  source: z.literal("homebrew"), scope: z.literal("personal"), owner_id: z.string().uuid(),
  version: featureVersionSchema, created_at: z.string().min(1), is_retired: z.literal(false) });
export interface HomebrewPassiveFeatureRecord {
  id: string; name: string; version: number;
  data: { description: string; class: string; level: number; subclass?: string | null; feature_type?: FeatureType };
}
function admit(raw: unknown, owner: string, system: string) {
  const envelope = envelopeSchema.parse(raw);
  if (envelope.owner_id !== owner || envelope.system_id !== system) throw Error("Unexpected feature owner or system.");
  const known = featureDataSchema.parse(envelope.data);
  z.array(effectSchema).parse(envelope.effects); // Admission only: keep every raw entry/extension/order.
  const record: HomebrewPassiveFeatureRecord = { id: envelope.id, name: envelope.name, version: envelope.version,
    data: { description: known.description, class: known.class, level: known.level,
      ...(Object.hasOwn(envelope.data, "subclass") ? { subclass: known.subclass } : {}),
      ...(Object.hasOwn(envelope.data, "feature_type") ? { feature_type: known.feature_type } : {}) } };
  return { envelope, record };
}
const fail = (message: string, fieldErrors?: Record<string, string[]>): FeatureFeedback => ({ status: "error", message, ...(fieldErrors ? { fieldErrors } : {}) });
async function session() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  return !error && user ? { client, owner: user.id } : null;
}
async function publishedSystem(client: Client): Promise<string | null> {
  const { data, error } = await client.from("game_systems").select("id").eq("slug", "dnd-5e-2014").eq("status", "published").single();
  const parsed = z.object({ id: z.string().uuid() }).safeParse(data);
  return !error && parsed.success ? parsed.data.id : null;
}
function ownedRead(client: Client, owner: string, system: string) {
  return client.from("content_definitions").select(SELECT).eq("owner_id", owner).eq("system_id", system).eq("content_type", "feature")
    .eq("source", "homebrew").eq("scope", "personal").eq("is_retired", false);
}
export async function listOwnedHomebrewPassiveFeatures(): Promise<HomebrewPassiveFeatureRecord[]> {
  const auth = await session();
  if (!auth) throw Error("Authentication required.");
  const system = await publishedSystem(auth.client);
  if (!system) throw Error("The D&D 5e (2014) system is unavailable.");
  const { data, error } = await ownedRead(auth.client, auth.owner, system).order("name");
  if (error) throw error;
  return (data ?? []).map(row => admit(row, auth.owner, system).record);
}
export async function getOwnedHomebrewPassiveFeature(id: string): Promise<HomebrewPassiveFeatureRecord | null> {
  const auth = await session();
  if (!auth) throw Error("Authentication required.");
  if (!z.string().uuid().safeParse(id).success) return null;
  const system = await publishedSystem(auth.client);
  if (!system) throw Error("The D&D 5e (2014) system is unavailable.");
  const { data, error } = await ownedRead(auth.client, auth.owner, system).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const record = admit(data, auth.owner, system).record;
  if (record.id !== id) throw Error("Unexpected feature identifier.");
  return record;
}
export async function createHomebrewPassiveFeatureRecord(form: FormData): Promise<FeatureActionState> {
  const parsed = mapPassiveFeatureCreate(form);
  if (!parsed.success) return fail("Check the highlighted fields and try again.", parsed.fieldErrors);
  let auth: Awaited<ReturnType<typeof session>>, system: string | null;
  try {
    auth = await session();
    if (!auth) return fail("Sign in before creating a private feature.");
    system = await publishedSystem(auth.client);
    if (!system) return fail("The D&D 5e (2014) system is unavailable.");
  } catch { return fail("The feature could not be prepared. No creation was attempted."); }
  // Explicit passive fields only. Never persist unrelated canonical parser defaults.
  const content = { feature_type: "passive", class: parsed.data.class, subclass: parsed.data.subclass, level: parsed.data.level, description: parsed.data.description };
  featureDataSchema.parse(content);
  const id = randomUUID();
  const base = parsed.data.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "homebrew-feature";
  const slug = `${base}-${id.slice(0, 8)}`;
  try {
    const { data, error } = await auth.client.from("content_definitions").insert({ id, system_id: system, content_type: "feature", slug,
      name: parsed.data.name, data: content as Json, effects: [], source: "homebrew", scope: "personal", owner_id: auth.owner }).select(SELECT).single();
    if (error || !data) return featureUncertainty("create");
    const saved = admit(data, auth.owner, system).envelope;
    if (saved.id !== id || saved.slug !== slug || saved.version !== 1 || saved.name !== parsed.data.name
      || !isDeepStrictEqual(saved.data, content) || saved.effects.length !== 0) return featureUncertainty("create");
    return { status: "saved", id: saved.id, version: saved.version, operation: "create" };
  } catch { return featureUncertainty("create"); }
}
async function missingUpdate(client: Client, owner: string, system: string, id: string): Promise<FeatureFeedback> {
  const { data, error } = await ownedRead(client, owner, system).eq("id", id).maybeSingle();
  if (error) return fail("The current feature could not be checked. Reload before saving again.");
  if (!data) return fail("This private feature could not be found.");
  try {
    const current = admit(data, owner, system);
    if (current.record.id !== id) return fail("This private feature could not be found.");
  } catch { return fail("This feature contains unsupported data and cannot be edited."); }
  return { status: "conflict", message: "This feature changed in another session. Your draft is kept. Reload latest before saving again." };
}
export async function updateHomebrewPassiveFeatureRecord(form: FormData): Promise<FeatureActionState> {
  const parsed = mapPassiveFeatureEdit(form);
  if (!parsed.success) return fail("Check the highlighted fields and try again.", parsed.fieldErrors);
  const { id, expected_version: expectedVersion, name, description } = parsed.data;
  let auth: Awaited<ReturnType<typeof session>>, system: string | null, existing: unknown;
  try {
    auth = await session();
    if (!auth) return fail("Sign in before editing a private feature.");
    system = await publishedSystem(auth.client);
    if (!system) return fail("The D&D 5e (2014) system is unavailable.");
    const { data, error } = await ownedRead(auth.client, auth.owner, system).eq("id", id).eq("version", expectedVersion).maybeSingle();
    if (error) return fail("The feature could not be read. No update was attempted.");
    if (!data) return await missingUpdate(auth.client, auth.owner, system, id);
    existing = data;
  } catch { return fail("The feature could not be read. No update was attempted."); }
  let original: z.infer<typeof envelopeSchema>, merged: Record<string, unknown>;
  try {
    original = admit(existing, auth.owner, system).envelope;
    if (original.id !== id || original.version !== expectedVersion) return fail("The feature did not match the requested version. Reload before saving.");
    merged = { ...original.data, description };
    featureDataSchema.parse(merged); // Validate; original absence/extensions/order remain raw.
    if (name === original.name && isDeepStrictEqual(merged, original.data)) return { status: "unchanged", id, version: expectedVersion, message: "No changes to save." };
    if (expectedVersion === FEATURE_VERSION_MAX) return fail("This feature has reached its version limit. No changes were saved.");
  } catch { return fail("This feature contains unsupported data and cannot be edited."); }
  try {
    const { data, error } = await auth.client.from("content_definitions").update({ name, data: merged as Json })
      .eq("id", id).eq("owner_id", auth.owner).eq("system_id", system).eq("content_type", "feature").eq("source", "homebrew")
      .eq("scope", "personal").eq("is_retired", false).eq("version", expectedVersion).select(SELECT).maybeSingle();
    if (error) return featureUncertainty("edit");
    if (!data) return await missingUpdate(auth.client, auth.owner, system, id);
    const saved = admit(data, auth.owner, system).envelope;
    if (saved.id !== id || saved.slug !== original.slug || saved.created_at !== original.created_at || saved.name !== name || saved.version !== expectedVersion + 1
      || !isDeepStrictEqual(saved.data, merged) || !isDeepStrictEqual(saved.effects, original.effects)) return featureUncertainty("edit");
    return { status: "saved", id, version: saved.version, operation: "edit" };
  } catch { return featureUncertainty("edit"); }
}
