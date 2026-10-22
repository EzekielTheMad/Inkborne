import { z } from "zod";
import { collectClassRoleEffects, type ClassRoleCollection } from "./class-role-effects";
import { boundedClassRoleJson, classRoleOccurrenceSchema, classRoleOriginSchema, classRoleRevisionSchema } from "./class-role-effects-schema";

const id = z.string().uuid();
const version = z.number().int().min(1).max(2147483647);
const object = z.record(z.string(), z.unknown());
const tuple = z.looseObject({ content_id: id.nullable(), content_version: version.nullable() });
const row = z.looseObject({ id, character_id: id });
const pin = row.extend({ content_id: id, content_version: version, context: object, choice_source: z.string().nullable(),
  feature_grant_id: id.nullable() });
const graphSchema = z.strictObject({
  parent: z.looseObject({ id, system_id: id, action_revision: classRoleRevisionSchema, choices: object }),
  origin: classRoleOriginSchema,
  order: z.strictObject({ character_id: id, producer_version: z.literal(1), producer_revision: classRoleRevisionSchema,
    pins: z.array(id), inventory: z.array(id), spells: z.array(id), feature_grants: z.array(id), spell_grants: z.array(id) }),
  occurrences: z.array(classRoleOccurrenceSchema.extend({ controller_ref_id: id.nullable(), subclass_ref_id: z.null() })).max(256),
  refs: z.array(pin).max(128), inventory: z.array(row.extend(tuple.shape)).max(4096),
  spells: z.array(row.extend({ ...tuple.shape, class_slug: z.string(), name: z.string(), source: z.string(), spell_grant_id: id.nullable() })).max(4096),
  feature_grants: z.array(row.extend({ feature_content_id: id, feature_version: version, controller_ref_id: id,
    controller_type: z.literal("class"), controller_slug: z.string(), feature_slug: z.string(), unlock_level: z.number().int().min(1).max(20) })).max(4096),
  spell_grants: z.array(row.extend({ spell_content_id: id, spell_version: version, controller_ref_id: id,
    controller_type: z.literal("class"), controller_slug: z.string(), class_slug: z.string(), spell_name: z.string() })).max(4096),
  versions: z.array(z.looseObject({ content_id: id, version, system_id_snapshot: id, content_type_snapshot: z.string(),
    slug_snapshot: z.string(), name_snapshot: z.string(), source_snapshot: z.string(), scope_snapshot: z.string(),
    owner_id_snapshot: id.nullable(), data_snapshot: object, effects_snapshot: z.array(object) })).max(4096),
});

/** Advisory projection of a complete native graph, never allocation/receipt/Auth
 * authority. Uses only supplied exact snapshots; creates no save manifest or
 * starting-class proof. Missing/unsupported evidence is propagated, not guessed.
 * Finite class-only controller profile: subclasses are explicitly unsupported.
 * This helper has no application caller while native acquisition remains gated. */
export function collectClassRoleEffectsFromNativeGraph(input: {
  graph: unknown; system: unknown; currentProficiencyBonus: number; manifests: unknown;
}): ClassRoleCollection {
  const invalid = (message: string): ClassRoleCollection => ({ status: "invalid_evidence", messages: [message] });
  if (!boundedClassRoleJson(input)) return invalid("Bounded finite native graph evidence required");
  const parsed = graphSchema.safeParse(input.graph);
  if (!parsed.success) return invalid("Unsupported complete native class graph");
  const graph = parsed.data, target = graph.parent.id, system = graph.parent.system_id;
  const unique = (values: string[]) => new Set(values).size === values.length;
  const domains = [graph.refs, graph.inventory, graph.spells, graph.feature_grants, graph.spell_grants];
  const orders = [graph.order.pins, graph.order.inventory, graph.order.spells, graph.order.feature_grants, graph.order.spell_grants];
  if (graph.order.character_id !== target || graph.order.producer_revision !== graph.parent.action_revision
    || !unique(graph.occurrences.map(item => item.id))
    || graph.occurrences.some(item => item.character_id !== target || item.system_id !== system)
    || domains.some((rows, index) => !unique(rows.map(item => item.id)) || rows.some(item => item.character_id !== target)
      || rows.length !== orders[index].length || rows.some((item, position) => item.id !== orders[index][position]))) {
    return invalid("Native graph identity/order correspondence required");
  }
  const versions = new Map(graph.versions.map(snapshot => [`${snapshot.content_id}:${snapshot.version}`, snapshot]));
  if (versions.size !== graph.versions.length || graph.versions.some(snapshot => snapshot.system_id_snapshot !== system)) {
    return invalid("Unique exact same-system native snapshots required");
  }
  const required = new Set<string>();
  for (const item of [...graph.refs, ...graph.inventory, ...graph.spells, ...graph.occurrences]) {
    if (item.content_id === null && item.content_version === null) continue;
    if (item.content_id === null || item.content_version === null) return invalid("Incomplete native version tuple");
    required.add(`${item.content_id}:${item.content_version}`);
  }
  graph.feature_grants.forEach(item => required.add(`${item.feature_content_id}:${item.feature_version}`));
  graph.spell_grants.forEach(item => required.add(`${item.spell_content_id}:${item.spell_version}`));
  if (required.size !== versions.size || [...required].some(key => !versions.has(key))) return invalid("Complete native version closure required");
  const refs = new Map(graph.refs.map(item => [item.id, item]));
  const featureGrants = new Map(graph.feature_grants.map(item => [item.id, item]));
  const spellGrants = new Map(graph.spell_grants.map(item => [item.id, item]));
  const controllerMatches = (grant: { controller_ref_id: string; controller_type: string; controller_slug: string }) => {
    const controller = refs.get(grant.controller_ref_id);
    const snapshot = controller && versions.get(`${controller.content_id}:${controller.content_version}`);
    return controller && controller.context.source === "class" && snapshot?.content_type_snapshot === grant.controller_type
      && snapshot.slug_snapshot === grant.controller_slug;
  };
  if (graph.feature_grants.some(grant => !controllerMatches(grant)
      || versions.get(`${grant.feature_content_id}:${grant.feature_version}`)?.content_type_snapshot !== "feature")
    || graph.spell_grants.some(grant => !controllerMatches(grant) || grant.class_slug !== grant.controller_slug
      || versions.get(`${grant.spell_content_id}:${grant.spell_version}`)?.content_type_snapshot !== "spell")
    || graph.refs.some(ref => {
      if (ref.feature_grant_id === null) return ref.context.source === "class_feature";
      const grant = featureGrants.get(ref.feature_grant_id);
      return !grant || ref.content_id !== grant.feature_content_id || ref.content_version !== grant.feature_version
        || ref.choice_source !== `auto:feature-grant:${grant.id}` || ref.context.source !== "class_feature"
        || ref.context.controller_type !== grant.controller_type || ref.context.controller_slug !== grant.controller_slug
        || ref.context.feature_slug !== grant.feature_slug || ref.context.feature_level !== grant.unlock_level;
    }) || graph.spells.some(spell => {
      if (spell.spell_grant_id === null) return spell.source === "feature";
      const grant = spellGrants.get(spell.spell_grant_id);
      return !grant || spell.source !== "feature" || spell.content_id !== grant.spell_content_id || spell.content_version !== grant.spell_version
        || spell.class_slug !== grant.class_slug || spell.name !== grant.spell_name;
    })) return invalid("Exact native grant/controller/projection links required");
  if (graph.occurrences.some(occurrence => {
    if (occurrence.lifecycle === "ended") return false;
    const controller = occurrence.controller_ref_id && refs.get(occurrence.controller_ref_id);
    const snapshot = controller && versions.get(`${controller.content_id}:${controller.content_version}`);
    return !controller || controller.content_id !== occurrence.content_id || controller.content_version !== occurrence.content_version
      || controller.context.source !== "class" || !snapshot || snapshot.content_type_snapshot !== "class" || snapshot.slug_snapshot !== occurrence.class_slug
      || (occurrence.subclass_ref_id !== null && !refs.has(occurrence.subclass_ref_id));
  })) return invalid("Exact native occurrence/controller correspondence required");

  return collectClassRoleEffects({
    contract_version: 1,
    character: { id: target, system_id: system, classes: graph.parent.choices.classes },
    system: input.system, current_proficiency_bonus: input.currentProficiencyBonus, origin: graph.origin,
    // Deliberate projection: native controller/subclass pin links are checked
    // above, but are not fields of the existing strict advisory occurrence DTO.
    occurrences: graph.occurrences.map(occurrence => ({ id: occurrence.id, character_id: occurrence.character_id,
      system_id: occurrence.system_id, content_id: occurrence.content_id, content_version: occurrence.content_version,
      class_slug: occurrence.class_slug, lifecycle: occurrence.lifecycle, selected_at: occurrence.selected_at,
      acquired_character_level: occurrence.acquired_character_level, acquisition_operation_id: occurrence.acquisition_operation_id,
      accepted_at: occurrence.accepted_at, ended_at: occurrence.ended_at })),
    sources: graph.refs.map(ref => {
      const snapshot = versions.get(`${ref.content_id}:${ref.content_version}`)!;
      return { id: ref.id, character_id: ref.character_id, content_id: ref.content_id, content_version: ref.content_version,
        context: ref.context, choice_source: ref.choice_source,
        resolved: { id: snapshot.content_id, system_id: snapshot.system_id_snapshot, content_type: snapshot.content_type_snapshot,
          slug: snapshot.slug_snapshot, name: snapshot.name_snapshot, version: snapshot.version,
          source: snapshot.source_snapshot, scope: snapshot.scope_snapshot, owner_id: snapshot.owner_id_snapshot,
          data: snapshot.data_snapshot, effects: snapshot.effects_snapshot } };
    }),
    manifests: input.manifests,
  });
}
