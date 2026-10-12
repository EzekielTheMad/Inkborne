import type { ReactNode } from "react";
import {
  MONSTER_ABILITIES, MONSTER_MOVEMENT_MODES,
  type MonsterData, type MonsterRuleEntry,
} from "@/lib/schemas/content-types/monster";
import { formatModifier } from "@/lib/sheet/helpers";

const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const withNotes = (value: string | number, notes?: string) => `${value}${notes === undefined ? "" : ` (${notes})`}`;

function StatLine({ name, children }: { name: string; children: ReactNode }) {
  return <div><dt className="inline font-semibold">{name} </dt><dd className="inline">{children}</dd></div>;
}

/** Display only: consumes validated format-one data, with no rolls or character effects. */
export function MonsterStatBlock({ data }: { data: MonsterData }) {
  const speeds = MONSTER_MOVEMENT_MODES.filter((mode) => data.speed[mode] !== undefined)
    .map((mode) => `${label(mode)} ${data.speed[mode]} ft.${mode === "fly" && data.speed.hover === true ? " (hover)" : ""}`);
  const saves = MONSTER_ABILITIES.flatMap((ability) => {
    const bonus = data.saving_throws?.[ability];
    return bonus === undefined ? [] : [`${label(ability)} ${formatModifier(bonus)}`];
  });
  const senses = data.senses?.map((sense) => withNotes(`${label(sense.type)} ${sense.range} ft.`, sense.notes)) ?? [];
  if (data.passive_perception !== undefined) senses.push(`Passive Perception ${data.passive_perception}`);

  return (
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]" aria-label="Monster stat block">
      <section aria-label="Statistics">
        <h2 className="j-folio">Statistics</h2>
        <dl className="mt-3 space-y-2 text-sm leading-6">
          <StatLine name="Armor Class">{withNotes(data.armor_class.value, data.armor_class.notes)}</StatLine>
          <StatLine name="Hit Points">{withNotes(data.hit_points.average, data.hit_points.dice_text)}</StatLine>
          <StatLine name="Speed">{withNotes(speeds.join(", "), data.speed.notes)}</StatLine>
        </dl>
        <dl aria-label="Ability scores" className="my-5 grid grid-cols-3 gap-3 border-y border-border py-4 xl:grid-cols-6">
          {MONSTER_ABILITIES.map((ability) => (
            <div key={ability} className="min-w-0 text-center">
              <dt className="text-xs font-semibold">{label(ability)}</dt>
              <dd className="mt-1 text-sm">{data.ability_scores[ability]} ({formatModifier(Math.floor((data.ability_scores[ability] - 10) / 2))})</dd>
            </div>
          ))}
        </dl>
        <dl className="space-y-2 text-sm leading-6">
          {saves.length > 0 ? <StatLine name="Saving Throws">{saves.join(", ")}</StatLine> : null}
          {data.skills?.length ? <StatLine name="Skills">{data.skills.map((skill) => `${skill.name} ${formatModifier(skill.bonus)}`).join(", ")}</StatLine> : null}
          {data.damage_vulnerabilities?.length ? <StatLine name="Damage Vulnerabilities">{data.damage_vulnerabilities.join(", ")}</StatLine> : null}
          {data.damage_resistances?.length ? <StatLine name="Damage Resistances">{data.damage_resistances.join(", ")}</StatLine> : null}
          {data.damage_immunities?.length ? <StatLine name="Damage Immunities">{data.damage_immunities.join(", ")}</StatLine> : null}
          {data.damage_notes !== undefined ? <StatLine name="Damage Notes">{data.damage_notes}</StatLine> : null}
          {data.condition_immunities?.length ? <StatLine name="Condition Immunities">{data.condition_immunities.join(", ")}</StatLine> : null}
          {senses.length > 0 ? <StatLine name="Senses">{senses.join(", ")}</StatLine> : null}
          {data.senses_notes !== undefined ? <StatLine name="Senses Notes">{data.senses_notes}</StatLine> : null}
          {data.languages?.length ? <StatLine name="Languages">{data.languages.join(", ")}</StatLine> : null}
          {data.languages_notes !== undefined ? <StatLine name="Languages Notes">{data.languages_notes}</StatLine> : null}
          {data.challenge !== undefined ? <StatLine name="Challenge">{data.challenge.rating}{data.challenge.experience_points === undefined ? "" : ` (${data.challenge.experience_points} XP)`}</StatLine> : null}
        </dl>
      </section>
      <RuleSection title="Traits" entries={data.traits} />
      <RuleSection title="Actions" entries={data.actions} />
      <RuleSection title="Bonus Actions" entries={data.bonus_actions} />
      <RuleSection title="Reactions" entries={data.reactions} />
      <RuleSection title="Legendary Actions" entries={data.legendary_actions?.entries}
        description={data.legendary_actions?.description}
        extra={data.legendary_actions?.actions_per_round === undefined ? undefined : `Actions per round: ${data.legendary_actions.actions_per_round}`} />
      <RuleSection title="Lair Actions" entries={data.lair_actions?.entries}
        description={data.lair_actions?.description}
        extra={data.lair_actions?.initiative_count === undefined ? undefined : `Initiative count: ${data.lair_actions.initiative_count}`} />
    </div>
  );
}

function RuleSection({ title, entries, description, extra }: {
  title: string;
  entries?: readonly (MonsterRuleEntry & { cost?: number })[];
  description?: string;
  extra?: string;
}) {
  if (!entries?.length) return null;
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="j-folio border-b border-border pb-2">{title}</h2>
      {extra === undefined ? null : <p className="text-sm font-medium">{extra}</p>}
      {description === undefined ? null : <p className="whitespace-pre-line text-sm leading-7">{description}</p>}
      {entries.map((entry, index) => (
        <div key={`${title}-${index}`} className="space-y-1">
          <h3 className="text-sm font-semibold">{entry.name}{entry.cost === undefined ? null : <span className="font-normal"> (Cost {entry.cost})</span>}</h3>
          {entry.attack === undefined ? null : <p className="text-sm leading-6">{attackText(entry.attack)}</p>}
          {entry.saving_throw === undefined ? null : <p className="text-sm leading-6">
            {label(entry.saving_throw.ability)} save DC {entry.saving_throw.dc}
            {entry.saving_throw.on_success === undefined ? "" : `; on success: ${entry.saving_throw.on_success}`}
          </p>}
          {entry.damage === undefined ? null : <p className="text-sm leading-6">Damage: {entry.damage.map((damage) => {
            const amount = damage.average === undefined ? damage.roll_text : withNotes(damage.average, damage.roll_text);
            return withNotes(`${amount} ${damage.type}`, damage.notes);
          }).join("; ")}</p>}
          <p className="whitespace-pre-line text-sm leading-7 text-foreground/90">{entry.description}</p>
        </div>
      ))}
    </section>
  );
}

function attackText(attack: NonNullable<MonsterRuleEntry["attack"]>): string {
  const details = [`${label(attack.kind)} ${attack.attack_type} attack: ${formatModifier(attack.bonus)} to hit`];
  if (attack.reach !== undefined) details.push(`reach ${attack.reach} ft.`);
  if (attack.range !== undefined) details.push(`range ${attack.range.normal}${attack.range.long === undefined ? "" : ` / ${attack.range.long}`} ft.`);
  if (attack.target !== undefined) details.push(attack.target);
  return details.join("; ");
}
