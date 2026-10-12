/** Canonical original synthetic content. The production schemas are the authority. */
import { contentDefinitionSchema } from "../../lib/schemas/content";
import { classDataSchema } from "../../lib/schemas/content-types/class";
import { featureDataSchema } from "../../lib/schemas/content-types/feature";
import { spellDataSchema } from "../../lib/schemas/content-types/spell";
import { itemDataSchema } from "../../lib/schemas/content-types/item";
import { parseContentDefinition, parseContentVersionSnapshot } from "../../lib/supabase/content-definitions-parser";
import { effectSchema } from "../../lib/schemas/effects";
import { systemSchemaDefinitionSchema } from "../../lib/schemas/system";

export function makeFixtureSystemSchema() {
  const abilities = [["strength", "Strength", "STR"], ["dexterity", "Dexterity", "DEX"], ["constitution", "Constitution", "CON"],
    ["intelligence", "Intelligence", "INT"], ["wisdom", "Wisdom", "WIS"], ["charisma", "Charisma", "CHA"]];
  return systemSchemaDefinitionSchema.parse({ ability_scores: abilities.map(([slug, name, abbr]) => ({ slug, name, abbr })),
    proficiency_levels: [{ slug: "proficient", name: "Proficient", multiplier: 1 }], derived_stats: [], skills: [], resources: [],
    content_types: ["class", "feature", "spell", "item"].map(slug => ({ slug, name: `Synthetic ${slug}` })),
    currencies: [{ slug: "cp", name: "Copper", rate: 0.01 }, { slug: "sp", name: "Silver", rate: 0.1 }, { slug: "ep", name: "Electrum", rate: 0.5 }, { slug: "gp", name: "Gold", rate: 1 }, { slug: "pp", name: "Platinum", rate: 10 }],
    creation_steps: [{ step: 1, type: "abilities", label: "Synthetic abilities", methods: ["manual"] }],
    sheet_sections: [{ slug: "abilities", label: "Synthetic abilities", contains: abilities.map(([slug]) => slug) }] });
}

export function fixtureSnapshot(definition: ReturnType<typeof contentDefinitionSchema.parse> & { id: string }) {
  return { content_id: definition.id, version: definition.version, system_id_snapshot: definition.system_id, content_type_snapshot: definition.content_type,
    slug_snapshot: definition.slug, name_snapshot: definition.name, data_snapshot: definition.data, effects_snapshot: definition.effects,
    source_snapshot: definition.source, scope_snapshot: definition.scope, owner_id_snapshot: definition.owner_id };
}
function validateCanonical(definition: ReturnType<typeof contentDefinitionSchema.parse> & { id: string }) {
  if (!parseContentDefinition(definition) || !parseContentVersionSnapshot(fixtureSnapshot(definition))) throw new Error("R07.2 canonical fixture definition/snapshot refused");
  return definition;
}

export function makeFixtureDefinitions(tag: string, roots: { system: string; class: string; feature: string; asi: string; spell: string; item: string }) {
  const classSlug = `${tag}-class`;
  const passive = featureDataSchema.parse({ class: classSlug, level: 1, feature_type: "passive", description: "Synthetic steady training grants familiarity with this original fixture discipline." });
  const asi = featureDataSchema.parse({ class: classSlug, level: 4, feature_type: "asi", description: "Synthetic earned training permits one supported ability score improvement at class level four." });
  const spell = spellDataSchema.parse({ level: 1, school: "abjuration", casting_time: "1 action", range: "Touch", components: ["V", "S"],
    duration: "1 minute", concentration: false, ritual: false, description: "An original synthetic ward marks its willing target with a harmless blue shimmer.", classes: [classSlug] });
  const item = itemDataSchema.parse({ equipment_category: "Adventuring Gear", cost: { quantity: 1, unit: "gp" }, weight: 1, description: "Original synthetic provisions used only for award and consumption acceptance." });
  const controller = classDataSchema.parse({ description: "An original synthetic controller for exact-version feature, ASI and spell grant acceptance.", hit_die: 8,
    spellcasting: { ability: "intelligence", type: "full", focus: "Synthetic focus", ritual_casting: false }, multiclass: { prerequisites: [], proficiencies_gained: [] },
    saving_throws: ["intelligence", "wisdom"], starting_proficiencies: [],
    levels: Array.from({ length: 20 }, (_, index) => ({ level: index + 1, features: index === 0 ? [`${tag}-feature`] : index === 3 ? [`${tag}-asi`] : [] })),
    spellcastingExtra: [`${tag}-spell`] });
  return [
    { id: roots.feature, content_type: "feature", slug: `${tag}-feature`, name: "R07 synthetic feature", data: passive },
    { id: roots.asi, content_type: "feature", slug: `${tag}-asi`, name: "R07 synthetic earned ASI", data: asi },
    { id: roots.spell, content_type: "spell", slug: `${tag}-spell`, name: "R07 synthetic spell", data: spell },
    { id: roots.item, content_type: "item", slug: `${tag}-item`, name: "R07 synthetic provisions", data: item },
    { id: roots.class, content_type: "class", slug: classSlug, name: "R07 synthetic class", data: controller },
  ].map(definition => validateCanonical({ id: definition.id, ...contentDefinitionSchema.parse({ ...definition, system_id: roots.system, effects: [], source: "srd", scope: "platform", owner_id: null, version: 1 }) }));
}

export function makePassiveRevision(original: ReturnType<typeof makeFixtureDefinitions>[number]) {
  return validateCanonical({ ...original, version: 2,
    data: featureDataSchema.parse({ ...original.data, description: "Synthetic advanced training now increases Strength by two while retaining this original fixture discipline." }),
    effects: effectSchema.array().parse([{ type: "mechanical", stat: "strength", op: "add", value: 2 }]) });
}
