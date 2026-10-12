import { z } from "zod";
import { hitDieSnapshotSchema } from "./durable-hit-die-schema";
import { canonicalHitDieJson } from "./durable-hit-die-canonical";
import { nativeInstantMicros } from "./durable-hit-die-kernel-model";
import { nativeHitDieInstantSchema } from "./durable-hit-die-receipt";

const version = z.number().int().min(1).max(2147483647);
const jsonObject = z.record(z.string(), z.json());
const nativeInstant = nativeHitDieInstantSchema.refine(value => {
  try { nativeInstantMicros(value); return true; } catch { return false; }
});
const definitionSchema = hitDieSnapshotSchema.shape.pins.element.shape.resolved;
export const authorityVersionTimeSchema = z.strictObject({ content_id: z.uuid(), content_version: version, created_at: nativeInstant });
export const frozenSpellGrantSchema = z.object({
  id: z.uuid(), character_id: z.uuid(), controller_ref_id: z.uuid(), controller_type: z.enum(["class", "subclass"]),
  controller_slug: z.string().min(1), class_slug: z.string().min(1), spell_content_id: z.uuid(), spell_version: version,
  spell_slug: z.string().min(1), spell_name: z.string().min(1), unlock_level: z.number().int().min(1).max(20), created_at: nativeInstant,
}).catchall(z.json());
export const authoritySpellSchema = z.object({
  id: z.uuid(), character_id: z.uuid(), content_id: z.uuid().nullable(), content_version: version.nullable(),
  spell_grant_id: z.uuid().nullable(), name: z.string(), class_slug: z.string().min(1), source: z.string(),
  is_known: z.boolean(), is_prepared: z.boolean(), always_prepared: z.boolean(), in_spellbook: z.boolean(),
  custom_data: jsonObject.nullable(), created_at: nativeInstant, resolved: definitionSchema.nullable(),
}).catchall(z.json()).superRefine((spell, ctx) => {
  if (spell.content_id === null ? spell.content_version !== null || spell.resolved !== null : !spell.resolved || spell.content_version === null ||
    spell.resolved.id !== spell.content_id || spell.resolved.version !== spell.content_version || spell.resolved.content_type !== "spell") {
    ctx.addIssue({ code: "custom", message: "Custom source must be absent; pinned spell source must match exactly" });
  }
});
const spellEvidenceSchema = z.strictObject({
  character: hitDieSnapshotSchema.shape.character.pick({ id: true, system_id: true, level: true, choices: true }),
  pins: z.array(hitDieSnapshotSchema.shape.pins.element), grants: z.array(frozenSpellGrantSchema), spells: z.array(authoritySpellSchema),
  versions: z.array(definitionSchema), versionTimes: z.array(authorityVersionTimeSchema),
});
export type FrozenSpellAuthorityInput = z.infer<typeof spellEvidenceSchema>;
export type FrozenSpellAuthorityResult = { status: "available"; representativeIds: string[] }
  | { status: "unavailable"; reason: "invalid_spell_evidence" | "incomplete_spell_manifest" | "unsupported_spell_profile" };
const unavailable = (reason: Extract<FrozenSpellAuthorityResult, { status: "unavailable" }>["reason"]): FrozenSpellAuthorityResult => ({ status: "unavailable", reason });
const tuple = (id: string, v: number) => `${id}:${v}`;
// PostgreSQL UUID order is byte order, independent of locale. Never use this
// metadata/representative comparator to reorder mechanical source arrays.
const compareUuid = (a: string, b: string) => {
  const left = a.replaceAll("-", "").toLowerCase(), right = b.replaceAll("-", "").toLowerCase();
  return left < right ? -1 : left > right ? 1 : 0;
};
const compareVersion = (a: { id: string; version: number }, b: { id: string; version: number }) => compareUuid(a.id, b.id) || a.version - b.version;

/** Checks the complete frozen manifest/acquisition projection. No catalog,
 * authentication, reconciliation or historic candidate-winner proof. Trusted
 * producer lineage, full reader counts and all writer fences remain prerequisites. */
export function validateFrozenSpellAuthority(raw: FrozenSpellAuthorityInput): FrozenSpellAuthorityResult {
  const parsed = spellEvidenceSchema.safeParse(raw);
  if (!parsed.success) return unavailable("invalid_spell_evidence");
  const { character, pins, grants, spells, versions, versionTimes } = parsed.data;
  const classes = character.choices.classes;
  if (new Set(classes.map(cls => cls.slug)).size !== classes.length || classes.reduce((n, cls) => n + cls.level, 0) !== character.level ||
    new Set(pins.map(pin => pin.id)).size !== pins.length || new Set(grants.map(grant => grant.id)).size !== grants.length || new Set(spells.map(spell => spell.id)).size !== spells.length) return unavailable("invalid_spell_evidence");
  const definitions = new Map<string, z.infer<typeof definitionSchema>>();
  const times = new Map<string, bigint>();
  if (versionTimes.length !== versions.length) return unavailable("invalid_spell_evidence");
  for (let i = 0; i < versions.length; i++) {
    const definition = versions[i], time = versionTimes[i], key = tuple(definition.id, definition.version);
    if (definition.system_id !== character.system_id || definitions.has(key) || time.content_id !== definition.id || time.content_version !== definition.version ||
      (i > 0 && compareVersion(versions[i - 1], definition) >= 0)) return unavailable("invalid_spell_evidence");
    definitions.set(key, definition); times.set(key, nativeInstantMicros(time.created_at));
  }
  const required = new Set<string>();
  for (const pin of pins) {
    const key = tuple(pin.content_id, pin.content_version), definition = definitions.get(key);
    if (pin.character_id !== character.id || !definition || canonicalHitDieJson(pin.resolved) !== canonicalHitDieJson(definition)) return unavailable("invalid_spell_evidence");
    required.add(key);
  }
  // Other domains (inventory/feature grants) share versions; exact full closure
  // is checked by the real graph consumer, rather than filtered out here.
  const controllers = pins.filter(pin => pin.resolved.content_type === "class" || pin.resolved.content_type === "subclass");
  for (const cls of classes) {
    if (controllers.filter(pin => pin.resolved.content_type === "class" && pin.resolved.slug === cls.slug).length !== 1 ||
      (cls.subclass && controllers.filter(pin => pin.resolved.content_type === "subclass" && pin.resolved.slug === cls.subclass && pin.resolved.data.parent_class === cls.slug).length !== 1)) return unavailable("invalid_spell_evidence");
  }
  const expected = new Map<string, { controller: typeof controllers[number]; classSlug: string; classLevel: number; unlock: number }>();
  for (const controller of controllers) {
    const definition = controller.resolved;
    const matches = classes.filter(cls => definition.content_type === "class" ? cls.slug === definition.slug : cls.subclass === definition.slug && cls.slug === definition.data.parent_class);
    if (matches.length !== 1 || controllers.filter(pin => pin.resolved.content_type === definition.content_type && pin.resolved.slug === definition.slug).length !== 1 ||
      (definition.content_type === "subclass" && controllers.filter(pin => pin.resolved.content_type === "class" && pin.resolved.slug === matches[0].slug).length !== 1)) return unavailable("invalid_spell_evidence");
    if (!Object.hasOwn(definition.data, "spellcastingExtra")) continue;
    const manifest = definition.data.spellcastingExtra;
    if (!Array.isArray(manifest)) return unavailable("unsupported_spell_profile");
    for (let index = 0; index < manifest.length; index++) {
      const entry = manifest[index]; let unlock = index + 1; let slugs: unknown[];
      if (typeof entry === "string") slugs = [entry];
      else if (Array.isArray(entry)) slugs = entry;
      else if (entry !== null && typeof entry === "object" && definition.content_type === "subclass" &&
        typeof entry.level === "number" && Number.isInteger(entry.level) && entry.level >= 1 && entry.level <= 20 && Array.isArray(entry.spells)) {
        unlock = entry.level; slugs = entry.spells;
      } else return unavailable("unsupported_spell_profile");
      if (slugs.length && unlock > 20) return unavailable("unsupported_spell_profile");
      for (const rawSlug of slugs) {
        // PostgreSQL btrim defaults to U+0020; Unicode trim would choose a
        // different immutable slug and silently widen the supported profile.
        if (typeof rawSlug !== "string") return unavailable("unsupported_spell_profile");
        const slug = rawSlug.replace(/^ +| +$/g, "");
        if (!slug) return unavailable("unsupported_spell_profile");
        const key = `${controller.id}:${slug}`, previous = expected.get(key);
        expected.set(key, { controller, classSlug: matches[0].slug, classLevel: matches[0].level, unlock: previous ? Math.min(previous.unlock, unlock) : unlock });
      }
    }
  }
  if (expected.size !== grants.length) return unavailable("incomplete_spell_manifest");
  const seen = new Set<string>();
  const active: z.infer<typeof frozenSpellGrantSchema>[] = [];
  for (const grant of grants) {
    const key = `${grant.controller_ref_id}:${grant.spell_slug}`, entry = expected.get(key);
    if (!entry || seen.has(key)) return unavailable("incomplete_spell_manifest");
    seen.add(key);
    const controller = entry.controller.resolved, spellKey = tuple(grant.spell_content_id, grant.spell_version), spell = definitions.get(spellKey);
    if (grant.character_id !== character.id || grant.controller_type !== controller.content_type || grant.controller_slug !== controller.slug ||
      grant.class_slug !== entry.classSlug || grant.unlock_level !== entry.unlock || !spell || spell.content_type !== "spell" || spell.slug !== grant.spell_slug || spell.name !== grant.spell_name ||
      times.get(spellKey)! > times.get(tuple(controller.id, controller.version))!) return unavailable("invalid_spell_evidence");
    if (controller.source === "srd" ? spell.source !== "srd" || spell.scope !== "platform" : controller.source !== "homebrew") return unavailable("unsupported_spell_profile");
    required.add(spellKey);
    if (entry.classLevel >= grant.unlock_level) active.push(grant);
  }
  const representatives = new Map<string, z.infer<typeof frozenSpellGrantSchema>>();
  // Sort a derived copy only: frozen grants/spells/pins preserve source order.
  for (const grant of [...active].sort((a, b) => a.unlock_level - b.unlock_level || compareUuid(a.controller_ref_id, b.controller_ref_id) || compareUuid(a.id, b.id))) {
    const key = `${grant.spell_content_id}:${grant.class_slug}`;
    if (!representatives.has(key)) representatives.set(key, grant);
  }
  const representativeIds = new Set([...representatives.values()].map(grant => grant.id));
  const acquisitions = new Map<string, z.infer<typeof authoritySpellSchema>>();
  for (const spell of spells) {
    if (spell.character_id !== character.id) return unavailable("invalid_spell_evidence");
    if (spell.source !== "selection" && spell.source !== "feature") return unavailable("unsupported_spell_profile");
    if (spell.content_id !== null) {
      const key = `${spell.content_id}:${spell.class_slug}`, definition = definitions.get(tuple(spell.content_id, spell.content_version!));
      if (acquisitions.has(key) || !definition || canonicalHitDieJson(spell.resolved) !== canonicalHitDieJson(definition)) return unavailable("invalid_spell_evidence");
      acquisitions.set(key, spell); required.add(tuple(spell.content_id, spell.content_version!));
    }
    if (spell.source === "selection") {
      if (spell.spell_grant_id !== null) return unavailable("invalid_spell_evidence");
    } else {
      const grant = grants.find(grant => grant.id === spell.spell_grant_id);
      if (!grant || !representativeIds.has(grant.id) || spell.content_id !== grant.spell_content_id || spell.content_version !== grant.spell_version ||
        spell.class_slug !== grant.class_slug || spell.name !== grant.spell_name || !spell.is_prepared || !spell.always_prepared) return unavailable("invalid_spell_evidence");
    }
  }
  for (const key of representatives.keys()) if (!acquisitions.has(key)) return unavailable("incomplete_spell_manifest");
  // Required set intentionally does not assert global closure: inventory and
  // frozen features are inputs only to the enclosing actual graph validator.
  for (const key of required) if (!definitions.has(key)) return unavailable("invalid_spell_evidence");
  return { status: "available", representativeIds: [...representatives.values()].sort((a, b) => compareUuid(a.spell_content_id, b.spell_content_id) ||
    (a.class_slug < b.class_slug ? -1 : a.class_slug > b.class_slug ? 1 : 0)).map(grant => grant.id) };
}
