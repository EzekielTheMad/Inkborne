import type { HitDieGraphResponse } from "@/lib/character/hit-die-authority";
import type { FrozenSpellAuthorityInput } from "@/lib/character/hit-die-spell-authority";

export type AuthorityGraphFixture = Extract<HitDieGraphResponse, { status: "complete"; graph_version: 2 }>;
export const authorityId = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
export const authorityContext = { context_version: 1, actor_id: authorityId(1), session_id: authorityId(2), jwt_expires_at: "2026-10-12T23:59:59.000000Z" };
export const authorityRevision = "9007199254740993";
export const controllerCreatedAt = "2026-01-01T00:00:00.000001Z";
const acquiredAt = "2026-10-12T01:00:00.000000Z";

/** Original synthetic complete projection; proves no real producer/Auth/SQL. */
export function authorityGraphFixture(): AuthorityGraphFixture {
  const definition: AuthorityGraphFixture["versions"][number] = { id: authorityId(5), version: 1, system_id: authorityId(4), content_type: "class", slug: "fighter", name: "Fighter", source: "srd", scope: "platform", owner_id: null, effects: [],
    data: { hit_die: 10, spellcasting: null, multiclass: { prerequisites: [], proficiencies_gained: [] }, saving_throws: [], starting_proficiencies: [],
      levels: Array.from({ length: 20 }, (_, i) => ({ level: i + 1, features: [], spellcasting: null })), source_refs: [] } };
  return { status: "complete", graph_version: 2, readiness: { protocol_version: 1, writers_complete: true, auth_complete: true, order_complete: true },
    counts: { pins: "1", inventory: "0", spells: "0", feature_grants: "0", spell_grants: "0", resolved_versions: "1", access_rows: "3" },
    order: { producer_version: 1, character_id: authorityId(3), producer_revision: authorityRevision, pins: [authorityId(6)], inventory: [], spells: [], feature_grants: [], spell_grants: [] },
    versions: [definition], version_times: [{ content_id: definition.id, content_version: 1, created_at: controllerCreatedAt }],
    snapshot: { contract_version: 1, character: { id: authorityId(3), owner_id: authorityId(1), system_id: authorityId(4), campaign_id: null, archived: false, revision: authorityRevision, level: 1, base_stats: { constitution: 14 },
      choices: { classes: [{ slug: "fighter", level: 1 }], hp_rolls: {} }, state: { current_hp: 4, hit_dice_spent: { fighter: 0 } } },
      system: { id: authorityId(4), slug: "dnd-5e-2014", expression_context: {}, schema_definition: { ability_scores: [{ slug: "constitution", name: "Constitution", abbr: "CON" }], proficiency_levels: [{ slug: "none", name: "None", multiplier: 0 }], derived_stats: [], skills: [], resources: [], currencies: [], content_types: [{ slug: "class", name: "Class" }], creation_steps: [{ step: 1, type: "class", label: "Class" }], sheet_sections: [{ slug: "stats", label: "Stats" }] } }, campaign: null,
      pins: [{ id: authorityId(6), character_id: authorityId(3), content_id: definition.id, content_version: 1, context: {}, choice_source: null, feature_grant_id: null, resolved: definition }], inventory: [], spells: [], feature_grants: [], spell_grants: [],
      access_rows: [{ kind: "verified_session", actor_id: authorityId(1), session_id: authorityId(2), jwt_expires_at: authorityContext.jwt_expires_at },
        { kind: "current_owner", character_id: authorityId(3), owner_id: authorityId(1), system_id: authorityId(4), campaign_id: null, archived: false },
        { kind: "pinned_continuity", domain: "pin", row_id: authorityId(6), content_id: definition.id, content_version: 1 }] } };
}

/** Rebuild fixture counts/closure/proofs after a deliberate raw-row change, so
 * earned negatives cannot pass merely because counts or pin joins are missing. */
export function rebuildAuthorityGraph(graph: AuthorityGraphFixture): AuthorityGraphFixture {
  const s = graph.snapshot, needed = new Set<string>();
  s.access_rows = s.access_rows.slice(0, 2);
  for (const domain of ["pins", "inventory", "spells", "feature_grants", "spell_grants"] as const) {
    const rows = s[domain]; graph.counts[domain] = String(rows.length); graph.order[domain] = rows.map(row => row.id);
    for (const row of rows) {
      const record = row as Record<string, unknown>;
      const content = domain === "feature_grants" ? record.feature_content_id : domain === "spell_grants" ? record.spell_content_id : record.content_id;
      const version = domain === "feature_grants" ? record.feature_version : domain === "spell_grants" ? record.spell_version : record.content_version;
      if (content === null) continue;
      needed.add(`${content}:${version}`);
      s.access_rows.push({ kind: "pinned_continuity", domain: domain === "pins" ? "pin" : domain === "inventory" ? "inventory" : domain === "spells" ? "spell" : domain === "feature_grants" ? "feature_grant" : "spell_grant",
        row_id: row.id, content_id: content as string, content_version: version as number });
    }
  }
  graph.versions = graph.versions.filter(definition => needed.has(`${definition.id}:${definition.version}`)).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : a.version - b.version);
  graph.version_times = graph.versions.map(definition => graph.version_times.find(time => time.content_id === definition.id && time.content_version === definition.version) ??
    { content_id: definition.id, content_version: definition.version, created_at: controllerCreatedAt });
  graph.counts.resolved_versions = String(graph.versions.length); graph.counts.access_rows = String(s.access_rows.length);
  return graph;
}

export function frozenSpellGraphFixture(): AuthorityGraphFixture {
  const graph = authorityGraphFixture(), cls = graph.snapshot.pins[0].resolved;
  cls.data.spellcastingExtra = [["shield"], [], ["misty-step"]];
  for (const [n, slug, unlock] of [[7, "shield", 1], [8, "misty-step", 3]] as const) {
    const definition: AuthorityGraphFixture["versions"][number] = { id: authorityId(n), version: 1, system_id: authorityId(4), content_type: "spell", slug, name: `Original ${slug}`, source: "srd", scope: "platform", owner_id: null, effects: [],
      data: { level: 1, school: "abjuration", casting_time: "1 action", range: "Self", components: ["V"], duration: "1 minute", concentration: false, ritual: false, description: "Original grant control." } };
    graph.versions.push(definition);
    graph.version_times.push({ content_id: definition.id, content_version: 1, created_at: "2026-01-01T00:00:00.000000Z" });
    const grant = { id: authorityId(n + 3), character_id: authorityId(3), controller_ref_id: authorityId(6), controller_type: "class" as const, controller_slug: cls.slug, class_slug: cls.slug,
      spell_content_id: definition.id, spell_version: 1, spell_slug: slug, spell_name: definition.name, unlock_level: unlock, created_at: acquiredAt, raw_extension: { retained: ["original", n] } };
    graph.snapshot.spell_grants.push(grant);
    if (unlock === 1) graph.snapshot.spells.push({ id: authorityId(13), character_id: authorityId(3), content_id: definition.id, content_version: 1, spell_grant_id: grant.id,
      name: definition.name, class_slug: cls.slug, source: "feature", is_known: false, is_prepared: true, always_prepared: true, in_spellbook: false, custom_data: null, created_at: acquiredAt, resolved: definition, acquisition_extension: { preserve: true } });
  }
  return rebuildAuthorityGraph(graph);
}

export function earnedAsiGraphFixture(): AuthorityGraphFixture {
  const graph = authorityGraphFixture(), s = graph.snapshot, cls = s.pins[0].resolved, slug = "original-fighter-improvement-4";
  s.character.level = 4; s.character.choices.classes[0].level = 4;
  cls.data.levels = Array.from({ length: 20 }, (_, i) => ({ level: i + 1, features: i === 3 ? [slug] : [], spellcasting: null }));
  const feature: AuthorityGraphFixture["versions"][number] = { id: authorityId(15), version: 1, system_id: authorityId(4), content_type: "feature", slug, name: "Original improvement", source: "srd", scope: "platform", owner_id: null, effects: [],
    data: { class: cls.slug, subclass: null, level: 4, feature_type: "asi", description: "Original earned improvement.", source_refs: [] } };
  const grant = { id: authorityId(17), character_id: authorityId(3), controller_ref_id: authorityId(6), controller_type: "class" as const, controller_slug: cls.slug,
    feature_content_id: feature.id, feature_version: 1, feature_slug: slug, unlock_level: 4, created_at: acquiredAt, retained_extension: { raw: true } };
  s.feature_grants.push(grant);
  s.pins.push({ id: authorityId(16), character_id: authorityId(3), content_id: feature.id, content_version: 1, feature_grant_id: grant.id,
    choice_source: `auto:feature-grant:${grant.id}`, context: { source: "class_feature", controller_type: "class", controller_slug: cls.slug, feature_slug: slug, feature_level: 4 }, resolved: feature });
  s.character.choices.asi_choices = { [slug]: { mode: "asi", allocations: [{ ability: "constitution", amount: 2 }] } };
  graph.versions.push(feature);
  return rebuildAuthorityGraph(graph);
}

export function spellAuthorityInput(graph = frozenSpellGraphFixture()): FrozenSpellAuthorityInput {
  const c = graph.snapshot.character;
  return { character: { id: c.id, system_id: c.system_id, level: c.level, choices: c.choices }, pins: graph.snapshot.pins, grants: graph.snapshot.spell_grants,
    spells: graph.snapshot.spells, versions: graph.versions, versionTimes: graph.version_times };
}
