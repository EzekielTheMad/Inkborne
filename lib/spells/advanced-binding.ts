import { z } from "zod";
import { parseContentVersionSnapshot, type ParsedContentDefinition } from "@/lib/supabase/content-definitions-parser";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { AbilityScoreDefinition } from "@/lib/types/system";
import { getMaxUses, normalizeRecovery } from "@/lib/resources/helpers";
import { resolveEffectiveCastingSources } from "./effective-sources";
import { resolveCastingMath } from "./casting-math";
import { parseArcanumFeatureSnapshot } from "./advanced-descriptor";

const uuid = z.string().uuid(), version = z.number().int().positive();
const nonblank = z.string().refine(value => value.trim().length > 0);
const refSchema = z.strictObject({ refId: uuid, characterId: uuid, contentId: uuid, contentVersion: version, featureGrantId: uuid.nullable().optional(), snapshot: z.unknown() });
const grantSchema = z.strictObject({ grantId: uuid, characterId: uuid, controllerRefId: uuid, featureSlug: nonblank, featureContentId: uuid, featureVersion: version, unlockLevel: z.number().int().min(1).max(20) });
const selectionSchema = z.strictObject({ characterId: uuid, systemId: uuid, classSlug: nonblank, controllerRefId: uuid, controllerContentId: uuid, controllerVersion: version, grantId: uuid, featureContentId: uuid, featureVersion: version, spellContentId: uuid, spellVersion: version });
export type AdvancedRawRef = z.infer<typeof refSchema>;
export type AdvancedCapturedGrant = z.infer<typeof grantSchema>;
export type ArcanumSelection = z.infer<typeof selectionSchema>;
type ParsedRef = AdvancedRawRef & { definition: ParsedContentDefinition };

/** Modeled read evidence only; no authorization boolean or production write DTO. */
export interface AdvancedBindingInput {
  character: { id: string; system_id: string; classes: unknown };
  refs: readonly unknown[];
  refsComplete: boolean;
  grants: readonly unknown[];
  grantId: string;
  selection?: unknown;
  abilities: readonly Pick<AbilityScoreDefinition, "slug">[];
  abilityScores: Record<string, number>;
  proficiencyBonus: unknown;
  state: unknown;
}
export type AdvancedBindingResolution =
  | { status: "unselected"; classSlug: string; featureGrantId: string; castLevel: number; resourceSlug: string }
  | { status: "unavailable"; reason: string }
  | { status: "ready"; classSlug: string; featureGrantId: string; controllerPin: { refId: string; contentId: string; version: number }; featurePin: { contentId: string; version: number }; spell: ParsedContentDefinition; castLevel: number;
      profile: { classSlug: string; ability: string; abilityModifier: number; spellAttackBonus: number; spellDc: number };
      payment: { resourceSlug: string; maxUses: 1; recovery: "long"; usesToSpend: 1 } };

function plainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function usageCount(state: unknown, key: string): number | null {
  if (!plainObject(state)) return null;
  if (!Object.hasOwn(state, "feature_uses")) return 0;
  const field = Object.getOwnPropertyDescriptor(state, "feature_uses");
  if (!field || !("value" in field)) return null;
  const map = field.value;
  if (!plainObject(map) || Object.getOwnPropertySymbols(map).length) return null;
  const descriptors = Object.getOwnPropertyDescriptors(map);
  if (Object.values(descriptors).some(field => !("value" in field) || typeof field.value !== "number" || !Number.isFinite(field.value) || !Number.isInteger(field.value) || field.value < 0)) return null;
  return Object.hasOwn(descriptors, key) ? descriptors[key].value as number : 0;
}
function validUsages(value: unknown): boolean {
  const count = (item: unknown) => typeof item === "number" && Number.isFinite(item) && Number.isInteger(item) && item >= 0;
  return value === undefined || count(value) || (Array.isArray(value) && value.length === 20 && Array.from(value).every(item => item === null || count(item)));
}

/** Collect raw contributors BEFORE computeResources' slug deduplication.
 * Uses the same class context, recovery normalization and extra slug grammar. */
function contributorKeys(refs: ParsedRef[], levels: Map<string, number>): string[] | null {
  const keys: string[] = [], total = [...levels.values()].reduce((sum, level) => sum + level, 0);
  for (const ref of refs) {
    const def = ref.definition;
    if (!["feature", "feat", "trait"].includes(def.content_type)) continue;
    const data = def.data;
    const level = def.content_type === "feature" ? levels.get(data.class as string) : total;
    if (level === undefined) continue; // Matches generic resources for unselected classes.
    if (!validUsages(data.usages)) return null;
    if (normalizeRecovery(data.recovery as string | null | undefined) && getMaxUses(data.usages as number | Array<number | null> | undefined, level) > 0) keys.push(def.slug);
    if (!Array.isArray(data.extraLimitedFeatures)) return null;
    for (const extra of data.extraLimitedFeatures as Array<{ name: string; usages: number; recovery: string }>) {
      if (!extra || typeof extra.name !== "string" || !extra.name.trim() || !validUsages(extra.usages) || typeof extra.usages !== "number") return null;
      if (normalizeRecovery(extra.recovery) && extra.usages > 0) keys.push(`${def.slug}.${extra.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`);
    }
  }
  return keys;
}

/** Advisory pure intent only. No state patch, save, roll, catalog or active flag. */
export function resolveAdvancedBinding(input: AdvancedBindingInput): AdvancedBindingResolution {
  const unavailable = (detail: string): AdvancedBindingResolution => ({ status: "unavailable", reason: `Arcanum is unavailable: ${detail}. Restore or reload its saved evidence.` });
  if (!input || !plainObject(input.character) || !uuid.safeParse(input.character.id).success || !uuid.safeParse(input.character.system_id).success || input.refsComplete !== true || !Array.isArray(input.refs) || !Array.isArray(input.grants) ||
    !Array.isArray(input.abilities) || input.abilities.some(ability => !ability || typeof ability.slug !== "string") || !plainObject(input.abilityScores)) return unavailable("incomplete character/content or evaluated evidence");
  const refs: ParsedRef[] = [], seenRefs = new Set<string>();
  for (const raw of input.refs) {
    const parsed = refSchema.safeParse(raw);
    if (!parsed.success || seenRefs.has(parsed.data.refId)) return unavailable("malformed or duplicate readable refs");
    const ref = parsed.data, def = parseContentVersionSnapshot(ref.snapshot);
    if (!def || ref.characterId !== input.character.id || def.system_id !== input.character.system_id || def.id !== ref.contentId || def.version !== ref.contentVersion) return unavailable("mismatched immutable ref");
    seenRefs.add(ref.refId); refs.push({ ...ref, definition: def });
  }
  const grants: AdvancedCapturedGrant[] = [], seenGrants = new Set<string>();
  for (const raw of input.grants) {
    const parsed = grantSchema.safeParse(raw);
    if (!parsed.success || seenGrants.has(parsed.data.grantId) || parsed.data.characterId !== input.character.id) return unavailable("malformed or duplicate captured grants");
    seenGrants.add(parsed.data.grantId); grants.push(parsed.data);
  }
  const grant = grants.find(candidate => candidate.grantId === input.grantId);
  if (!grant) return unavailable("missing captured grant");
  if (grants.filter(candidate => candidate.controllerRefId === grant.controllerRefId && candidate.featureSlug === grant.featureSlug).length !== 1) return unavailable("ambiguous captured feature edge");
  const controller = refs.find(ref => ref.refId === grant.controllerRefId);
  const features = refs.filter(ref => ref.featureGrantId === grant.grantId);
  if (!controller || features.length !== 1) return unavailable("missing or ambiguous controller/derived feature");
  const feature = features[0], descriptor = parseArcanumFeatureSnapshot(feature.snapshot);
  if (descriptor.status !== "available" || feature.contentId !== grant.featureContentId || feature.contentVersion !== grant.featureVersion || feature.definition.slug !== grant.featureSlug) return unavailable("contradictory feature/grant/version or descriptor");
  const contentRefs: ContentRefWithContent[] = refs.map(ref => ({ id: ref.refId, character_id: ref.characterId, content_id: ref.contentId, content_version: ref.contentVersion, feature_grant_id: ref.featureGrantId ?? null, context: {}, choice_source: null, created_at: ref.definition.version_created_at ?? "modeled", content_definitions: ref.definition }));
  const sources = resolveEffectiveCastingSources(input.character.classes, contentRefs, input.character);
  if (sources.status !== "available") return unavailable("invalid selected casting source");
  const source = sources.sources.find(candidate => candidate.classSlug === feature.definition.data.class);
  if (!source?.active || !source.config) return unavailable("missing active parent casting source");
  const cd = controller.definition, parentController = cd.content_type === "class" && cd.slug === source.classSlug && cd.id === source.parentPin.contentId && cd.version === source.parentPin.version;
  const subclassController = cd.content_type === "subclass" && cd.slug === source.subclassSlug && cd.data.parent_class === source.classSlug && cd.id === source.subclassPin?.contentId && cd.version === source.subclassPin?.version;
  if (!parentController && !subclassController) return unavailable("controller is not the selected exact parent/subclass");
  const declaredSubclass = feature.definition.data.subclass;
  if (declaredSubclass !== null && declaredSubclass !== undefined && (!subclassController || declaredSubclass !== cd.slug)) return unavailable("contradictory feature subclass");
  const levels = cd.data.levels;
  if (!Array.isArray(levels)) return unavailable("missing numbered controller feature rows");
  const rowNumbers = new Set<number>(), unlocks: number[] = [];
  for (const row of levels) {
    if (!row || !Number.isInteger(row.level) || row.level < 1 || row.level > 20 || rowNumbers.has(row.level) || !Array.isArray(row.features) || row.features.some((slug: unknown) => typeof slug !== "string" || !slug.trim()) || new Set(row.features).size !== row.features.length) return unavailable("ambiguous numbered feature rows");
    rowNumbers.add(row.level); if (row.features.includes(grant.featureSlug)) unlocks.push(row.level);
  }
  if (!unlocks.length || Math.min(...unlocks) !== grant.unlockLevel || feature.definition.data.level !== grant.unlockLevel || source.classLevel < grant.unlockLevel) return unavailable("contradictory or inactive class-level unlock");
  if (descriptor.descriptor.listClass !== source.spellList.class) return unavailable("feature list does not match its casting source");
  const math = resolveCastingMath(source.config.ability, input.abilities, input.abilityScores, input.proficiencyBonus);
  if (math.status !== "available") return unavailable("invalid evaluated casting math");
  const contributors = contributorKeys(refs, new Map(sources.sources.map(candidate => [candidate.classSlug, candidate.classLevel])));
  if (!contributors || contributors.filter(key => key === feature.definition.slug).length !== 1) return unavailable("incomplete or colliding resource contributors");
  const spent = usageCount(input.state, feature.definition.slug);
  if (spent === null || spent >= 1) return unavailable(spent === null ? "malformed usage state" : "resource exhausted");
  const d = descriptor.descriptor;
  if (!Object.hasOwn(input, "selection")) return { status: "unselected", classSlug: source.classSlug, featureGrantId: grant.grantId, castLevel: d.castLevel, resourceSlug: feature.definition.slug };
  const selected = selectionSchema.safeParse(input.selection);
  if (!selected.success) return unavailable("malformed declared selection");
  const s = selected.data;
  if (s.characterId !== input.character.id || s.systemId !== input.character.system_id || s.classSlug !== source.classSlug || s.controllerRefId !== controller.refId || s.controllerContentId !== cd.id || s.controllerVersion !== cd.version || s.grantId !== grant.grantId || s.featureContentId !== feature.contentId || s.featureVersion !== feature.contentVersion) return unavailable("selection no longer matches its captured source");
  const spells = refs.filter(ref => ref.definition.content_type === "spell" && ref.contentId === s.spellContentId && ref.contentVersion === s.spellVersion);
  const spell = spells[0]?.definition;
  if (spells.length !== 1 || !spell || spell.data.level !== d.spellLevel || !Array.isArray(spell.data.classes) || !spell.data.classes.includes(d.listClass)) return unavailable("missing or ineligible exact chosen spell");
  return { status: "ready", classSlug: source.classSlug, featureGrantId: grant.grantId, controllerPin: { refId: controller.refId, contentId: cd.id, version: cd.version }, featurePin: { contentId: feature.contentId, version: feature.contentVersion }, spell, castLevel: d.castLevel,
    profile: { classSlug: source.classSlug, ability: source.config.ability, abilityModifier: math.abilityModifier, spellAttackBonus: math.spellAttackBonus, spellDc: math.spellDc }, payment: { resourceSlug: feature.definition.slug, maxUses: 1, recovery: "long", usesToSpend: 1 } };
}
