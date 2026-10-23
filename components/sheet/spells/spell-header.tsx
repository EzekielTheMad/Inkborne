"use client";

import { readBonusSpellChoices, ordinaryKnownSpellBudget } from "@/lib/builder/bonus-spells";
import { useCharacter, useSpells } from "@/lib/character/character-context";

export function SpellHeader() {
  const { casterInfo, spells } = useSpells();
  const { character, contentRefs } = useCharacter();
  if (!casterInfo.isCaster) return null;
  if (casterInfo.castingMathStatus === "unavailable" || casterInfo.spellDc === null || casterInfo.spellAttackBonus === null) return <p role="status" className="text-sm text-muted-foreground">Casting values and preparation are unavailable. Reload or restore the saved ability/class content.</p>;

  const bonusGroups = contentRefs.flatMap(ref => {
    const feature = ref.content_definitions;
    const caster = casterInfo.classes.find(candidate => candidate.slug === feature.data.class);
    const selectedClass = character.choices.classes?.find(candidate => candidate.slug === feature.data.class);
    return feature.content_type === "feature" && ref.content_id === feature.id && ref.content_version === feature.version
      && caster && typeof feature.data.level === "number" && feature.data.level <= caster.level
      && (typeof feature.data.subclass !== "string" || feature.data.subclass === selectedClass?.subclass)
      ? readBonusSpellChoices(feature.data).map(choice => ({ choice, classSlug: caster.slug })) : [];
  });
  const classSelections = spells.filter(spell => spell.source === "selection" && !spell.always_prepared
    && casterInfo.classes.some(caster => caster.slug === spell.class_slug));
  const cantripsKnown = classSelections.filter(
    (s) => (s.content_definitions?.data?.level ?? 1) === 0,
  ).length;
  const leveledSpellsKnown = classSelections.filter((s) => {
    const caster = casterInfo.classes.find(caster => caster.slug === s.class_slug);
    if (!caster || caster.prepared || caster.slug === "wizard") return false;
    const level = (s.content_definitions?.data?.level as number | undefined) ?? 0;
    return level > 0;
  }).length;
  const preparedCount = classSelections.filter(spell => {
    const level = spell.content_definitions?.data.level;
    return spell.is_prepared && typeof level === "number" && level > 0
      && casterInfo.classes.some(caster => caster.slug === spell.class_slug && caster.prepared);
  }).length;
  const totalCantripsAllowed = casterInfo.classes.reduce(
    (sum, c) => sum + c.cantripsKnown,
    0,
  );
  const totalPrepared = casterInfo.classes.reduce(
    (sum, c) => sum + (c.prepared ? c.maxPrepared ?? 0 : 0),
    0,
  );
  // Known casters (not prepared, not wizard): sum spells-known cap across classes.
  const totalSpellsKnown = casterInfo.classes.reduce((sum, c) => {
    if (c.prepared || c.slug === "wizard") return sum;
    const budget = c.spellsKnown === "all" ? "all" : ordinaryKnownSpellBudget(c.spellsKnown, bonusGroups.filter(group => group.classSlug === c.slug).map(group => group.choice));
    return sum + (typeof budget === "number" ? budget : 0);
  }, 0);

  const abilityLabel = casterInfo.classes
    .map((c) => c.ability.charAt(0).toUpperCase() + c.ability.slice(1))
    .join(", ");

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-1">
      <p className="text-xs text-muted-foreground">Class Spellcasting Ability</p>
      <p className="text-sm font-medium">{abilityLabel}</p>
      <div className="flex items-center gap-4 text-sm pt-1">
        <span>
          Save DC <span className="font-semibold">{casterInfo.spellDc}</span>
        </span>
        <span>
          Attack{" "}
          <span className="font-semibold">
            {casterInfo.spellAttackBonus >= 0 ? "+" : ""}
            {casterInfo.spellAttackBonus}
          </span>
        </span>
      </div>
      <p className="text-xs text-muted-foreground">These counters show ordinary class selections. Bonus choices have separate allowances; Magical Secrets reserves places in the class spells-known total.</p>
      {casterInfo.classes.length > 1 && <p className="text-xs text-muted-foreground">Highest class save DC and attack shown above. Each cast uses its spell&apos;s class.</p>}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 flex-wrap">
        <span>
          Cantrips: {cantripsKnown}/{totalCantripsAllowed}
        </span>
        {totalSpellsKnown > 0 && (
          <span>
            Ordinary Spells Known: {leveledSpellsKnown}/{totalSpellsKnown}
          </span>
        )}
        {totalPrepared > 0 && (
          <span>
            Prepared: {preparedCount}/{totalPrepared}
          </span>
        )}
      </div>
      {bonusGroups.length > 0 && <div className="space-y-1 pt-1 text-xs text-muted-foreground" aria-label="Bonus spell allowances">
        {bonusGroups.map(({ choice }) => <p key={choice.choice_id}>{choice.choice_id.replace(/-/g, " ")}: {character.choices.bonus_spells?.[choice.choice_id]?.length ?? 0}/{choice.choose}</p>)}
      </div>}
    </div>
  );
}
