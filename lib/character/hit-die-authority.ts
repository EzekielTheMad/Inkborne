import "server-only";
import { z } from "zod";
import { actionRevisionSchema, hitDieSnapshotSchema, MAX_ACTION_REVISION } from "./durable-hit-die-schema";
import { canonicalHitDieJson } from "./durable-hit-die-canonical";
import { nativeInstantMicros } from "./durable-hit-die-kernel-model";
import { nativeHitDieInstantSchema } from "./durable-hit-die-receipt";

export const HIT_DIE_WRITER_FAMILIES = ["auth", "order", "state", "character_choices", "refs", "feature_grants", "spell_grants", "inventory", "spells", "shared_rules_access", "version_identity", "copy_award", "lifecycle"] as const;
export const HIT_DIE_ORDER_DOMAINS = ["pins", "inventory", "spells", "feature_grants", "spell_grants"] as const;
export const hitDieUnreadyReasonSchema = z.enum(["auth_unavailable", "writers_unready", "schema_unready", "legacy_order_unproven", "invalid_graph", "incomplete_graph", "unsupported_time"]);
const jsonObject = z.record(z.string(), z.json());
const nativeInstant = nativeHitDieInstantSchema.refine(value => { try { nativeInstantMicros(value); return true; } catch { return false; } });
/** Construct only from the same VERIFIED token at a later server auth boundary.
 * Parsing this structure alone does not authenticate or establish session life. */
export const verifiedHitDieContextSchema = z.strictObject({ context_version: z.literal(1), actor_id: z.uuid(), session_id: z.uuid(), jwt_expires_at: nativeInstant });
export type VerifiedHitDieContext = z.infer<typeof verifiedHitDieContextSchema>;
export const hitDieReadinessSchema = z.array(z.strictObject({ family: z.enum(HIT_DIE_WRITER_FAMILIES), protocol_version: z.literal(1), ready: z.boolean(), reviewed_objects: jsonObject })).superRefine((rows, ctx) => {
  if (rows.length !== HIT_DIE_WRITER_FAMILIES.length || new Set(rows.map(row => row.family)).size !== rows.length) ctx.addIssue({ code: "custom", message: "Every readiness family must be present exactly once" });
});
export function allHitDieWritersReady(raw: unknown): boolean {
  const result = hitDieReadinessSchema.safeParse(raw);
  return result.success && result.data.every(row => row.ready && Object.keys(row.reviewed_objects).length > 0);
}
const count = actionRevisionSchema;
export const hitDieGraphOrderSchema = z.strictObject({ producer_version: z.literal(1), character_id: z.uuid(), producer_revision: actionRevisionSchema,
  pins: z.array(z.uuid()), inventory: z.array(z.uuid()), spells: z.array(z.uuid()), feature_grants: z.array(z.uuid()), spell_grants: z.array(z.uuid()) });
const countsSchema = z.strictObject({ pins: count, inventory: count, spells: count, feature_grants: count, spell_grants: count, resolved_versions: count, access_rows: count });
const proofSchema = z.discriminatedUnion("kind", [
  verifiedHitDieContextSchema.omit({ context_version: true }).extend({ kind: z.literal("verified_session") }).strict(),
  z.strictObject({ kind: z.literal("current_owner"), character_id: z.uuid(), owner_id: z.uuid(), system_id: z.uuid(), campaign_id: z.uuid().nullable(), archived: z.boolean() }),
  z.strictObject({ kind: z.literal("pinned_continuity"), domain: z.enum(["pin", "inventory", "spell", "feature_grant", "spell_grant"]), row_id: z.uuid(), content_id: z.uuid(), content_version: z.number().int().min(1).max(2147483647) }),
  z.strictObject({ kind: z.literal("campaign"), id: z.uuid(), system_id: z.uuid(), owner_id: z.uuid(), hp_rule: hitDieSnapshotSchema.shape.campaign.unwrap().shape.hp_rule }),
  z.strictObject({ kind: z.literal("campaign_member"), id: z.uuid(), campaign_id: z.uuid(), user_id: z.uuid(), role: z.enum(["dm", "player"]) }),
  z.strictObject({ kind: z.literal("content_share"), id: z.uuid(), content_id: z.uuid(), campaign_id: z.uuid(), shared_by: z.uuid() }),
]);
const definitionSchema = hitDieSnapshotSchema.shape.pins.element.shape.resolved;
const featureGrantSchema = z.object({ id: z.uuid(), character_id: z.uuid(), controller_ref_id: z.uuid(), controller_type: z.enum(["class", "subclass"]), controller_slug: z.string().min(1),
  feature_content_id: z.uuid(), feature_version: z.number().int().min(1).max(2147483647), feature_slug: z.string().min(1), unlock_level: z.number().int().min(1).max(20), created_at: nativeInstant }).catchall(z.json());
const spellGrantSchema = z.object({ id: z.uuid(), character_id: z.uuid(), controller_ref_id: z.uuid(), controller_type: z.enum(["class", "subclass"]), controller_slug: z.string().min(1), class_slug: z.string().min(1),
  spell_content_id: z.uuid(), spell_version: z.number().int().min(1).max(2147483647), spell_slug: z.string().min(1), spell_name: z.string().min(1), unlock_level: z.number().int().min(1).max(20), created_at: nativeInstant }).catchall(z.json());
const spellRowSchema = z.object({ id: z.uuid(), character_id: z.uuid(), content_id: z.uuid().nullable(), content_version: z.number().int().min(1).max(2147483647).nullable(),
  name: z.string(), class_slug: z.string().min(1), is_known: z.boolean(), is_prepared: z.boolean(), always_prepared: z.boolean(), in_spellbook: z.boolean(), source: z.string(), custom_data: jsonObject.nullable(),
  created_at: nativeInstant, resolved: definitionSchema.nullable() }).catchall(z.json());
// Adjacent graph DTO preserves required nullable grant identity without editing
// ASI-owned shared schemas. Actual completeness refuses until they integrate.
const authoritySnapshotSchema = hitDieSnapshotSchema.safeExtend({
  pins: z.array(hitDieSnapshotSchema.shape.pins.element.safeExtend({ feature_grant_id: z.uuid().nullable() })),
  feature_grants: z.array(featureGrantSchema), spell_grants: z.array(spellGrantSchema), spells: z.array(spellRowSchema), access_rows: z.array(proofSchema),
});
export const hitDieGraphResponseSchema = z.union([
  z.strictObject({ status: z.literal("inaccessible") }),
  z.strictObject({ status: z.literal("unready"), reason: hitDieUnreadyReasonSchema }),
  z.strictObject({ status: z.literal("complete"), graph_version: z.literal(1), readiness: z.strictObject({ protocol_version: z.literal(1), writers_complete: z.literal(true), auth_complete: z.literal(true), order_complete: z.literal(true) }),
    counts: countsSchema, order: hitDieGraphOrderSchema, versions: z.array(definitionSchema), snapshot: authoritySnapshotSchema }),
]);
export type HitDieGraphResponse = z.infer<typeof hitDieGraphResponseSchema>;
const unready = (reason: z.infer<typeof hitDieUnreadyReasonSchema>): HitDieGraphResponse => ({ status: "unready", reason });

/** Validates an authoritative service RPC response, never supplies authority to
 * SQL. The shared ASI schema is an explicit integration prerequisite. */
export function validateHitDieGraph(raw: unknown, rawContext: unknown, characterId: string): HitDieGraphResponse {
  const context = verifiedHitDieContextSchema.safeParse(rawContext);
  const parsed = hitDieGraphResponseSchema.safeParse(raw);
  if (!context.success || !z.uuid().safeParse(characterId).success || !parsed.success) return unready("invalid_graph");
  const result = parsed.data;
  if (result.status !== "complete") return result;
  const s = result.snapshot, c = s.character;
  if (c.id !== characterId || c.owner_id !== context.data.actor_id || result.order.character_id !== c.id || result.order.producer_revision !== c.revision) return unready("invalid_graph");
  const session = s.access_rows[0], owner = s.access_rows[1];
  if (session?.kind !== "verified_session" || session.actor_id !== context.data.actor_id || session.session_id !== context.data.session_id || session.jwt_expires_at !== context.data.jwt_expires_at ||
    owner?.kind !== "current_owner" || owner.character_id !== c.id || owner.owner_id !== c.owner_id || owner.system_id !== c.system_id || owner.campaign_id !== c.campaign_id || owner.archived !== c.archived) return unready("invalid_graph");
  const wanted = new Map<string, z.infer<typeof definitionSchema>>();
  for (const version of result.versions) { const key = `${version.id}:${version.version}`; if (wanted.has(key) || version.system_id !== c.system_id) return unready("invalid_graph"); wanted.set(key, version); }
  const required = new Set<string>();
  const proofRows: z.infer<typeof proofSchema>[] = [session, owner];
  for (const domain of HIT_DIE_ORDER_DOMAINS) {
    const rows = s[domain]; const ids = rows.map(row => row.id as string), order = result.order[domain];
    if (BigInt(result.counts[domain]) !== BigInt(rows.length) || new Set(ids).size !== rows.length || new Set(order).size !== order.length || order.length !== rows.length || ids.some((id, i) => id !== order[i])) return unready("incomplete_graph");
    for (const row of rows) {
      if (row.character_id !== c.id) return unready("invalid_graph");
      const record = row as Record<string, unknown>;
      const contentId = domain === "feature_grants" ? record.feature_content_id : domain === "spell_grants" ? record.spell_content_id : record.content_id;
      const version = domain === "feature_grants" ? record.feature_version : domain === "spell_grants" ? record.spell_version : record.content_version;
      if (contentId === null) continue;
      const key = `${contentId}:${version}`; required.add(key); const resolved = wanted.get(key);
      if (!resolved || ("resolved" in row && canonicalHitDieJson(row.resolved) !== canonicalHitDieJson(resolved))) return unready("incomplete_graph");
      proofRows.push({ kind: "pinned_continuity", domain: domain === "pins" ? "pin" : domain === "inventory" ? "inventory" : domain === "spells" ? "spell" : domain === "feature_grants" ? "feature_grant" : "spell_grant", row_id: row.id as string, content_id: contentId as string, content_version: version as number });
    }
  }
  if (required.size !== wanted.size || BigInt(result.counts.resolved_versions) !== BigInt(wanted.size) || BigInt(result.counts.access_rows) !== BigInt(s.access_rows.length)) return unready("incomplete_graph");
  for (const [domain, grants] of [["feature_grants", s.feature_grants], ["spell_grants", s.spell_grants]] as const) for (const grant of grants) {
    const controller = s.pins.find(pin => pin.id === grant.controller_ref_id);
    if (!controller || controller.resolved.content_type !== grant.controller_type || controller.resolved.slug !== grant.controller_slug) return unready("invalid_graph");
    const cls = s.character.choices.classes.find(cls => controller.resolved.content_type === "class" ? cls.slug === controller.resolved.slug : cls.subclass === controller.resolved.slug && cls.slug === controller.resolved.data.parent_class);
    if (!cls) return unready("invalid_graph");
    if (domain === "feature_grants") {
      const feature = featureGrantSchema.parse(grant);
      const definition = wanted.get(`${feature.feature_content_id}:${feature.feature_version}`);
      if (!definition || definition.content_type !== "feature" || definition.slug !== feature.feature_slug) return unready("invalid_graph");
      const derived = s.pins.filter(pin => pin.feature_grant_id === grant.id);
      if (cls.level >= grant.unlock_level && derived.length !== 1) return unready("incomplete_graph");
      if (cls.level < grant.unlock_level && derived.length !== 0) return unready("invalid_graph");
      const levels = controller.resolved.data.levels;
      if (!Array.isArray(levels)) return unready("invalid_graph");
      const manifest = levels.flatMap(row => row && typeof row === "object" && !Array.isArray(row) && Array.isArray(row.features) && row.features.includes(feature.feature_slug) && typeof row.level === "number" ? [row.level] : []);
      if (!manifest.length || Math.min(...manifest) !== feature.unlock_level) return unready("invalid_graph");
      if (derived.some(pin => pin.content_id !== feature.feature_content_id || pin.content_version !== feature.feature_version || pin.resolved.slug !== feature.feature_slug || pin.resolved.content_type !== "feature")) return unready("invalid_graph");
    } else {
      const spell = spellGrantSchema.parse(grant), definition = wanted.get(`${spell.spell_content_id}:${spell.spell_version}`);
      if (!definition || definition.content_type !== "spell" || definition.slug !== spell.spell_slug || spell.class_slug !== cls.slug) return unready("invalid_graph");
    }
  }
  for (const pin of s.pins) if (pin.feature_grant_id !== null && !s.feature_grants.some(grant => grant.id === pin.feature_grant_id)) return unready("invalid_graph");
  let accessIndex = proofRows.length;
  if (canonicalHitDieJson(s.access_rows.slice(0, accessIndex)) !== canonicalHitDieJson(proofRows)) return unready("invalid_graph");
  if (c.campaign_id !== null) {
    const campaign = s.access_rows[accessIndex++];
    if (campaign?.kind !== "campaign" || campaign.id !== c.campaign_id || campaign.system_id !== c.system_id || campaign.hp_rule !== s.campaign?.hp_rule) return unready("invalid_graph");
  }
  const metadata = s.access_rows.slice(accessIndex);
  const keys = metadata.map(row => "id" in row ? `${row.kind}:${row.id}` : "");
  if (keys.some((key, i) => !key || (i > 0 && key <= keys[i - 1])) || metadata.some(row => (row.kind !== "campaign_member" && row.kind !== "content_share") || row.campaign_id !== c.campaign_id || (row.kind === "campaign_member" && row.user_id !== c.owner_id))) return unready("invalid_graph");
  // This worker intentionally does not replace ASI schema/earned-choice logic.
  if (!("feature_grant_id" in hitDieSnapshotSchema.shape.pins.element.shape)) return unready("schema_unready");
  if (!hitDieSnapshotSchema.safeParse(s).success) return unready("schema_unready");
  return result;
}

export const inspirationPatchSchema = z.strictObject({ inspiration: z.boolean() });
const casRow = { character_id: z.uuid(), state: jsonObject, revision: actionRevisionSchema };
export const inspirationCasResponseSchema = z.union([
  z.strictObject({ status: z.enum(["applied", "unchanged", "conflict"]), ...casRow }),
  z.strictObject({ status: z.enum(["inaccessible", "invalid"]) }),
  z.strictObject({ status: z.literal("unready"), reason: hitDieUnreadyReasonSchema }),
]);
export interface HitDieAuthorityRpcClient {
  rpc(name: "read_hit_die_graph_v1" | "patch_character_state_at_revision_v1", args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
}
/** No client constructor, credentials, action route or retry. Inject only the
 * future audited cookie-free service client; SQL Auth seam is unavailable. */
export async function readHitDieAuthorityGraph(client: HitDieAuthorityRpcClient, context: unknown, characterId: string): Promise<HitDieGraphResponse> {
  const verified = verifiedHitDieContextSchema.safeParse(context);
  if (!verified.success || !z.uuid().safeParse(characterId).success) return unready("invalid_graph");
  try { const result = await client.rpc("read_hit_die_graph_v1", { p_verified_context: verified.data, p_character_id: characterId }); return result.error ? unready("invalid_graph") : validateHitDieGraph(result.data, verified.data, characterId); }
  catch { return unready("invalid_graph"); }
}
export async function saveInspirationAtRevision(client: HitDieAuthorityRpcClient, context: unknown, characterId: string, revision: unknown, patch: unknown): Promise<z.infer<typeof inspirationCasResponseSchema> | { status: "uncertain" }> {
  const verified = verifiedHitDieContextSchema.safeParse(context), expected = actionRevisionSchema.safeParse(revision), input = inspirationPatchSchema.safeParse(patch);
  if (!verified.success || !expected.success || !input.success || !z.uuid().safeParse(characterId).success || expected.data === MAX_ACTION_REVISION) return { status: "invalid" };
  try {
    const raw = await client.rpc("patch_character_state_at_revision_v1", { p_verified_context: verified.data, p_character_id: characterId, p_expected_revision: expected.data, p_patch: input.data });
    if (raw.error) return { status: "uncertain" };
    const response = inspirationCasResponseSchema.safeParse(raw.data); if (!response.success) return { status: "uncertain" };
    const row = response.data;
    if ("character_id" in row && (row.character_id !== characterId ||
      (row.status === "applied" && (BigInt(row.revision) !== BigInt(expected.data) + BigInt(1) || row.state.inspiration !== input.data.inspiration)) ||
      (row.status === "unchanged" && (row.revision !== expected.data || row.state.inspiration !== input.data.inspiration)) ||
      (row.status === "conflict" && row.revision === expected.data))) return { status: "uncertain" };
    return row;
  } catch { return { status: "uncertain" }; }
}
