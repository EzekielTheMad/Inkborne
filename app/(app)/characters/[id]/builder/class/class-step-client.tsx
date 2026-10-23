"use client";
import type { AsiEvidence } from "@/lib/character/asi-contributions";
import { resolveAbilityMechanics } from "@/lib/character/ability-mechanics";


import { useCallback, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateCharacter,
  updateCharacterAndReturn,
} from "@/lib/supabase/character-client";
import {
  insertContentRef,
  removeContentRefById,
} from "@/lib/supabase/content-refs-client";
import { Button } from "@/components/ui/button";
import { ContentBrowser, type ContentEntry } from "@/components/builder/content-browser";
import { ClassPreviewModal } from "@/components/builder/class-preview-modal";
import { ClassStepRail } from "@/components/builder/class-step-rail";
import { StatPreview } from "@/components/builder/stat-preview";
import { RaceAbilityNotice } from "@/components/builder/race-ability-notice";
import { buildCharacterStructuredSources } from "@/lib/character/structured-sources";
import { resolveCharacterChoiceEffects } from "@/lib/character/choice-effects";
import { resolveDefinitionExpertise } from "@/lib/builder/expertise";
import type {
  CharacterChoices,
  AsiChoice,
  HpRollRecord,
  UsableFeatOption,
} from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import { resolveHpRule, type HpRule } from "@/lib/builder/level-up-rules";
import type { Effect } from "@/lib/types/effects";
import { evaluate } from "@/lib/engine/evaluator";
import {
  reconcileClassFeatureRefsAction,
  searchUsableFeatsAction,
  setCharacterAsiChoiceAction,
} from "./actions";

import { activeFeatureSlugs, fightingStyleSlugs, fixedLanguages, resolveDefinitionChoices } from "@/lib/builder/choice-validation";
import type { SaveBuilderStep } from "@/lib/builder/builder-step-command";
import { BonusSpellsPanel } from "@/components/builder/bonus-spells-panel";
import { readBonusSpellChoices, ordinaryKnownSpellBudget, resolveLoreSkillChoice } from "@/lib/builder/bonus-spells";
import { ClassSpellsPanel, type BuilderSpellSelection } from "@/components/builder/class-spells-panel";
import type { EffectiveCastingSource } from "@/lib/spells/effective-sources";
import { classRoleEvaluationRef, originalClassOccurrence, type BuilderClassRole } from "@/lib/character/builder-class-roles";
import { classRoleRevisionSchema } from "@/lib/character/class-role-effects-schema";
import { resolveDefinitionClassFeatureChoices } from "@/lib/builder/class-feature-choices";
import type { FavoredEnemyChoice } from "@/lib/builder/favored-enemy";

interface ClassStepClientProps {
  saveAction?: SaveBuilderStep;
  classRolesAvailable?: boolean;
  castingSources?: EffectiveCastingSource[];
  selectedSpells?: Array<BuilderSpellSelection & { class_slug: string }>;
  grantedSpells?: Array<{ content_id: string; class_slug: string }>;
  characterId: string;
  character: {
    id: string;
    name: string;
    system_id?: string;
    level: number;
    action_revision?: number | string;
    base_stats: Record<string, number>;
    choices: CharacterChoices;
    state?: Record<string, unknown>;
  };
  classes: ContentEntry[];
  subclasses: ContentEntry[];
  features: ContentEntry[];
  feats: UsableFeatOption[];
  spells: ContentEntry[];
  contentRefs: Array<{
    id: string;
    content_id: string;
    context: Record<string, unknown>;
    choice_source: string | null;
    content_version?: number;
    class_role?: BuilderClassRole;
    content_definitions: {
      id: string;
      name: string;
      slug: string;
      content_type: string;
      data: Record<string, unknown>;
      effects: Effect[];
      version: number;
      source: string;
    };
  }>;
  asiEvidence?: AsiEvidence;
  schema: SystemSchemaDefinition | undefined;
  availableLanguages?: string[];
}

/** Resolve only saved selections/referenced features. New picks stay catalog-based;
 * duplicate pins are a conflict, never an arbitrary snapshot upgrade. */
function pinnedEntries(
  catalog: ContentEntry[],
  refs: ClassStepClientProps["contentRefs"],
  type: "class" | "subclass" | "feature",
  slugs: string[],
) {
  const selected = new Set(slugs);
  const entries = catalog.filter(entry => !selected.has(entry.slug));
  const conflicts: string[] = [];
  for (const slug of selected) {
    const pins = refs.filter(ref => ref.content_id === ref.content_definitions.id &&
      ref.content_definitions.content_type === type && ref.content_definitions.slug === slug);
    if (pins.length > 1) conflicts.push(slug);
    else {
      const entry = pins[0]?.content_definitions ?? catalog.find(item => item.slug === slug);
      if (entry) entries.push(entry);
    }
  }
  return { entries, conflicts };
}

const subscribeToHydration = () => () => {};

export function ClassStepClient({
  characterId,
  character,
  classes,
  subclasses,
  features,
  feats,
  spells,
  contentRefs: serverContentRefs,
  schema,
  asiEvidence: serverAsiEvidence,
  availableLanguages,
  saveAction: serverSaveAction,
  classRolesAvailable = false,
  castingSources = [],
  selectedSpells = [],
  grantedSpells = [],
}: ClassStepClientProps) {
  const [recovered, setRecovered] = useState<{ source: ClassStepClientProps["contentRefs"]; refs: ClassStepClientProps["contentRefs"]; asiEvidence: AsiEvidence } | null>(null);
  const contentRefs = recovered?.source === serverContentRefs ? recovered.refs : serverContentRefs;
  const asiEvidence = recovered?.source === serverContentRefs ? recovered.asiEvidence : serverAsiEvidence;
  const saveBusy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [refreshing, startTransition] = useTransition();
  const [previewContent, setPreviewContent] = useState<ContentEntry | null>(null);
  const [localChoices, setLocalChoices] = useState<CharacterChoices>(
    character.choices ?? {},
  );
  const [localLevel, setLocalLevel] = useState(character.level);
  const [acceptedRevision, setAcceptedRevision] = useState<{ source: typeof character.action_revision; value: string } | null>(null);
  const currentRevision = acceptedRevision && acceptedRevision.source === character.action_revision ? acceptedRevision.value : String(character.action_revision);
  const saveNative = useCallback<SaveBuilderStep>(async (command, fields) => {
    if (!serverSaveAction) throw Error("This class save is unavailable.");
    const saved = await serverSaveAction(command, fields);
    setAcceptedRevision({ source: character.action_revision, value: saved.action_revision });
    // Ordinary spellbook edits can prune Mastery/Signature picks too. Adopt
    // every confirmed choices document before the refreshed snapshot arrives.
    setLocalChoices(saved.choices);
    return saved;
  }, [serverSaveAction, character.action_revision]);
  const saveAction = serverSaveAction ? saveNative : undefined;
  const [spellDrafts, setSpellDrafts] = useState<Record<string, boolean>>({});
  const handleSpellDraftChange = useCallback((classSlug: string, dirty: boolean) => {
    setSpellDrafts(previous => previous[classSlug] === dirty ? previous : { ...previous, [classSlug]: dirty });
  }, []);
  const unsavedSpells = Object.values(spellDrafts).some(Boolean);

  const selectedClasses = localChoices.classes ?? [];
  const hasClass = selectedClasses.length > 0;

  const savedClasses = pinnedEntries(classes, contentRefs, "class", selectedClasses.map(cls => cls.slug));
  const savedSubclasses = pinnedEntries(subclasses, contentRefs, "subclass",
    selectedClasses.flatMap(cls => cls.subclass ? [cls.subclass] : []));
  const mismatchedSubclass = selectedClasses.some(cls => cls.subclass &&
    savedSubclasses.entries.find(entry => entry.slug === cls.subclass)?.data.parent_class !== cls.slug);
  const referencedFeatures = [...savedClasses.entries.filter(entry => selectedClasses.some(cls => cls.slug === entry.slug)),
    ...savedSubclasses.entries.filter(entry => selectedClasses.some(cls => cls.subclass === entry.slug))]
    .flatMap(entry => (entry.data.levels as Array<{ features?: string[] }> | undefined) ?? [])
    .flatMap(level => level.features ?? []);
  const savedLevelFeatures = pinnedEntries(features, contentRefs, "feature", referencedFeatures);
  const selectedStyleSlugs = savedLevelFeatures.entries
    .filter(feature => referencedFeatures.includes(feature.slug) &&
      feature.data.feature_type === "fighting_style" && (fightingStyleSlugs(feature).length > 0 || feature.name === "Fighting Style"))
    .flatMap(feature => localChoices.resolved_choices?.[feature.slug] ?? []);
  const savedFeatures = pinnedEntries(savedLevelFeatures.entries, contentRefs, "feature", selectedStyleSlugs);
  const conflictingPins = [...savedClasses.conflicts, ...savedSubclasses.conflicts,
    ...savedLevelFeatures.conflicts, ...savedFeatures.conflicts];
  const snapshotConflict = conflictingPins.length > 0 || mismatchedSubclass;

  const activeSlugs = selectedClasses.flatMap(cls => {
    const pin = contentRefs.find(ref => ref.content_id === ref.content_definitions.id && ref.content_definitions.content_type === "class" && ref.content_definitions.slug === cls.slug);
    if (!pin) return [];
    const subclass = contentRefs.find(ref => ref.content_id === ref.content_definitions.id && ref.content_definitions.content_type === "subclass" && ref.content_definitions.slug === cls.subclass);
    return [...activeFeatureSlugs(pin.content_definitions, cls.level), ...(subclass ? activeFeatureSlugs(subclass.content_definitions, cls.level) : [])];
  });
  const missingFeatures = [...new Set(activeSlugs)].filter(slug => !contentRefs.some(ref => ref.content_id === ref.content_definitions.id && ref.content_definitions.content_type === "feature" && ref.content_definitions.slug === slug));
  const grantedLanguages = fixedLanguages(contentRefs.map(ref => ref.content_definitions));
  const knownSpellSlugs = new Set(selectedSpells.flatMap(selected => {
    const matches = spells.filter(spell => spell.id === selected.content_id && spell.version === selected.content_version);
    return matches.length === 1 ? [matches[0].slug] : [];
  }));
  const resolveEntries = (entries: ContentEntry[]) => entries.map(entry => {
    const pin = entry.content_type === "class" ? contentRefs.find(ref => ref.content_id === entry.id && ref.content_version === entry.version) : undefined;
    const projected = pin ? classRoleEvaluationRef(pin, localChoices).content_definitions : entry;
    const loreResolved = { ...projected, effects: projected.effects?.map(effect => effect.type === "choice"
      ? resolveLoreSkillChoice(effect, contentRefs, localChoices) : effect) };
    return resolveDefinitionClassFeatureChoices(resolveDefinitionExpertise(
      resolveDefinitionChoices(loreResolved, availableLanguages, grantedLanguages), contentRefs, localChoices), contentRefs, localChoices,
      { features, knownSpellSlugs });
  });

  const bonusGroups = contentRefs.flatMap(ref => {
    const feature = ref.content_definitions;
    if (ref.content_id !== feature.id || ref.content_version !== feature.version || feature.content_type !== "feature") return [];
    const source = castingSources.find(candidate => candidate.classSlug === feature.data.class && candidate.active && candidate.config);
    if (!source || typeof feature.data.level !== "number" || feature.data.level > source.classLevel
      || typeof feature.data.subclass === "string" && feature.data.subclass !== source.subclassSlug) return [];
    return readBonusSpellChoices(feature.data).map(choice => ({ feature, choice, source }));
  });
  const adjustedCastingSources = castingSources.map(source => ({ ...source, spellsKnown: source.spellsKnown === "all" ? "all" as const : ordinaryKnownSpellBudget(source.spellsKnown,
    bonusGroups.filter(group => group.source.classSlug === source.classSlug).map(group => group.choice)) }));
  const handleBonusSaved = (saved: Awaited<ReturnType<SaveBuilderStep>>) => setLocalChoices(saved.choices);

  async function recoverFeatureRefs() {
    if (saveBusy.current || snapshotConflict) return;
    saveBusy.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await reconcileClassFeatureRefsAction({ characterId });
      if (result.status !== "success") throw new Error(result.message);
      setRecovered({ source: serverContentRefs, refs: result.refs, asiEvidence: result.asiEvidence });
      startTransition(() => router.refresh());
    } catch {
      setSaveError("Saved class features could not be restored. Your selections are kept. Try again or reload the character.");
    } finally {
      saveBusy.current = false;
      setSaving(false);
    }
  }

  const hpRule = resolveHpRule(
    (character as unknown as { campaigns?: { hp_rule?: HpRule | null } | null }).campaigns?.hp_rule,
    (schema as unknown as { hp_rule?: HpRule } | undefined)?.hp_rule,
  );

  const hpRolls = localChoices.hp_rolls ?? {};

  const allEffects: Effect[] = resolveCharacterChoiceEffects(contentRefs, localChoices);

  const confirmedSources = buildCharacterStructuredSources(contentRefs, character.level, { character: { ...character, system_id: character.system_id ?? "" }, evidence: asiEvidence });
  const confirmedResult = schema ? evaluate({ ...character.base_stats, level: character.level }, allEffects, schema, confirmedSources, character.state) : null;
  const confirmedMechanics = schema && confirmedResult ? resolveAbilityMechanics(character.base_stats, confirmedResult, schema) : { status: "unavailable" as const, reason: "Saved mechanics are unavailable." };
  const mechanicsAvailable = confirmedMechanics.status === "available" && localLevel === character.level && JSON.stringify(localChoices) === JSON.stringify(character.choices) && !saving && !refreshing;
  const resolvedStats = confirmedResult?.stats ?? {};

  function beginSave() {
    if (unsavedSpells) {
      setSaveError("Save your spell choices before changing this class build.");
      return false;
    }
    if (saveBusy.current || refreshing) {
      setSaveError("The class build is still saving. Wait for it to finish, then retry this change.");
      return false;
    }
    if (snapshotConflict || missingFeatures.length > 0) return false;
    saveBusy.current = true;
    setSaving(true);
    return true;
  }

  async function handleSelectClass(
    content: ContentEntry,
    opts?: { subclassSlug?: string | null },
  ) {
    if (saveAction && (!classRolesAvailable || !classRoleRevisionSchema.safeParse(currentRevision).success || unsavedSpells)) {
      setSaveError("Save your spell choices and reload the current class build before adding a class.");
      return;
    }
    if (!beginSave()) return;
    setPreviewContent(null);

    const subclassSlug = opts?.subclassSlug ?? undefined;
    const newClasses = [
      ...selectedClasses,
      { slug: content.slug, level: 1, subclass: subclassSlug },
    ];
    const totalLevel = newClasses.reduce((sum, c) => sum + c.level, 0);
    const newChoices = { ...localChoices, classes: newClasses };

    const prev = { choices: localChoices, level: localLevel };
    if (!saveAction) { setLocalChoices(newChoices); setLocalLevel(totalLevel); }

    setSaveError(null);
    try {
      if (saveAction) {
        const saved = await saveAction("add_class", { class_id: content.id, class_version: content.version,
          expected_action_revision: currentRevision });
        setLocalChoices(saved.choices);
        setLocalLevel(saved.choices.classes?.reduce((sum, cls) => sum + cls.level, 0) ?? character.level);
        // Subclass acquisition has its own finite transition after the new
        // controller reloads. Never combine a legacy pin write with Add.
        startTransition(() => router.refresh());
        return;
      }
      const persisted = await updateCharacterAndReturn(characterId, {
        choices: newChoices,
        level: totalLevel,
      });
      setLocalChoices(persisted.choices);
      setLocalLevel(persisted.level);
      await insertContentRef({
        characterId,
        contentId: content.id,
        contentVersion: content.version,
        context: { source: "class", level: 1 },
      });
      if (subclassSlug) {
        const subclassContent = subclasses.find((sc) => sc.slug === subclassSlug);
        if (subclassContent) {
          await insertContentRef({
            characterId,
            contentId: subclassContent.id,
            contentVersion: subclassContent.version,
            context: { source: "subclass", class: content.slug },
          });
        }
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setLocalChoices(prev.choices);
      setLocalLevel(prev.level);
      console.error("Failed to add class:", err);
      setSaveError("This class change could not be confirmed. Some changes may have saved. Reload the character before trying again.");
    } finally {
      saveBusy.current = false;
      setSaving(false);
    }
  }

  async function handleLevelChange(classIndex: number, newLevel: number) {
    if (!beginSave()) return;
    const updatedClasses = [...selectedClasses];
    updatedClasses[classIndex] = {
      ...updatedClasses[classIndex],
      level: newLevel,
    };
    const totalLevel = updatedClasses.reduce((sum, c) => sum + c.level, 0);
    const newChoices = { ...localChoices, classes: updatedClasses };

    const prev = { choices: localChoices, level: localLevel };
    setLocalChoices(newChoices);
    setLocalLevel(totalLevel);

    setSaveError(null);
    try {
      if (saveAction) {
        const saved = await saveAction("set_class_level", { class_slug: selectedClasses[classIndex].slug, level: newLevel });
        setLocalChoices(saved.choices);
        setLocalLevel(saved.choices.classes?.reduce((sum, cls) => sum + cls.level, 0) ?? character.level);
        startTransition(() => router.refresh());
        return;
      }
      const persisted = await updateCharacterAndReturn(characterId, {
        choices: newChoices,
        level: totalLevel,
      });
      setLocalChoices(persisted.choices);
      setLocalLevel(persisted.level);
      startTransition(() => router.refresh());
    } catch (err) {
      setLocalChoices(prev.choices);
      setLocalLevel(prev.level);
      console.error("Failed to change class level:", err);
      setSaveError("This class change could not be confirmed. Some changes may have saved. Reload the character before trying again.");
    } finally {
      saveBusy.current = false;
      setSaving(false);
    }
  }

  async function handleConfirmLevelUp(payload: {
    classIndex: number;
    draftLevel: number;
  }) {
    if (!beginSave()) return;
    const { classIndex, draftLevel } = payload;
    const updatedClasses = [...selectedClasses];
    updatedClasses[classIndex] = {
      ...updatedClasses[classIndex],
      level: draftLevel,
    };
    const totalLevel = updatedClasses.reduce((sum, c) => sum + c.level, 0);
    const newChoices = { ...localChoices, classes: updatedClasses };

    const prev = { choices: localChoices, level: localLevel };
    setLocalChoices(newChoices);
    setLocalLevel(totalLevel);

    setSaveError(null);
    try {
      if (saveAction) {
        const saved = await saveAction("set_class_level", { class_slug: selectedClasses[classIndex].slug, level: draftLevel });
        setLocalChoices(saved.choices);
        setLocalLevel(saved.choices.classes?.reduce((sum, cls) => sum + cls.level, 0) ?? character.level);
        startTransition(() => router.refresh());
        return;
      }
      const persisted = await updateCharacterAndReturn(characterId, {
        choices: newChoices,
        level: totalLevel,
      });
      setLocalChoices(persisted.choices);
      setLocalLevel(persisted.level);
      startTransition(() => router.refresh());
    } catch (err) {
      setLocalChoices(prev.choices);
      setLocalLevel(prev.level);
      console.error("Failed to confirm level up:", err);
      setSaveError("This class change could not be confirmed. Some changes may have saved. Reload the character before trying again.");
    } finally {
      saveBusy.current = false;
      setSaving(false);
    }
  }

  function handleCancelLevelUp() {
    // No persistence — the rail handles UI revert; HP roll edits are already
    // persisted incrementally via handleHpRollChange (per Q2A semantics).
  }

  async function handleHpRollChange(key: string, record: HpRollRecord) {
    if (!beginSave()) return;
    const newHpRolls = { ...(localChoices.hp_rolls ?? {}), [key]: record };
    const newChoices = { ...localChoices, hp_rolls: newHpRolls };

    const prev = localChoices;
    if (!saveAction || record.method !== "rolled") setLocalChoices(newChoices);

    setSaveError(null);
    try {
      if (saveAction) {
        const split = key.lastIndexOf("-");
        const saved = await saveAction("save_hp_roll", { class_slug: key.slice(0, split), level: Number(key.slice(split + 1)),
          method: record.method, value: record.method === "rolled" ? null : record.value });
        setLocalChoices(saved.choices);
        startTransition(() => router.refresh());
      } else await updateCharacter(characterId, { choices: newChoices });
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to save HP roll:", err);
      setSaveError("This class change could not be confirmed. Some changes may have saved. Reload the character before trying again.");
    } finally {
      saveBusy.current = false;
      setSaving(false);
    }
  }

  async function handleRemoveClass(classIndex: number) {
    if (saveAction) {
      setSaveError("Removing a saved class is not available yet.");
      return;
    }
    if (!beginSave()) return;
    const removedClass = selectedClasses[classIndex];
    const updatedClasses = selectedClasses.filter((_, i) => i !== classIndex);
    const totalLevel = updatedClasses.reduce((sum, c) => sum + c.level, 0);
    const newChoices = { ...localChoices, classes: updatedClasses };
    const newLevel = Math.max(totalLevel, 1);

    const prev = { choices: localChoices, level: localLevel };
    setLocalChoices(newChoices);
    setLocalLevel(newLevel);

    setSaveError(null);
    try {
      const persisted = await updateCharacterAndReturn(characterId, {
        choices: newChoices,
        level: newLevel,
      });
      setLocalChoices(persisted.choices);
      setLocalLevel(persisted.level);
      const classContentRef = contentRefs.find(
        (ref) =>
          ref.content_definitions?.slug === removedClass.slug &&
          ref.content_definitions?.content_type === "class",
      );
      if (classContentRef) {
        await removeContentRefById(classContentRef.id);
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setLocalChoices(prev.choices);
      setLocalLevel(prev.level);
      console.error("Failed to remove class:", err);
      setSaveError("This class change could not be confirmed. Some changes may have saved. Reload the character before trying again.");
    } finally {
      saveBusy.current = false;
      setSaving(false);
    }
  }

  async function handleChoiceSelect(choiceId: string, selections: string[]) {
    if (!beginSave()) return;
    const newResolved = {
      ...localChoices.resolved_choices,
      [choiceId]: selections,
    };
    const newChoices = { ...localChoices, resolved_choices: newResolved };

    const prev = localChoices;
    setLocalChoices(newChoices);

    setSaveError(null);
    try {
      if (saveAction) {
        const saved = await saveAction("class_choice", { choice_id: choiceId, selections });
        setLocalChoices(saved.choices);
        startTransition(() => router.refresh());
      } else await updateCharacter(characterId, { choices: newChoices });
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to save choice selection:", err);
      setSaveError("This class change could not be confirmed. Some changes may have saved. Reload the character before trying again.");
    } finally {
      saveBusy.current = false;
      setSaving(false);
    }
  }

  async function handleFavoredEnemySelect(featureSlug: string, value: FavoredEnemyChoice) {
    if (!saveAction) throw Error("This favored enemy save is unavailable.");
    if (!beginSave()) throw Error("The current class build is still saving.");
    setSaveError(null);
    try {
      const saved = await saveAction("favored_enemy", { feature_slug: featureSlug, ...value });
      setLocalChoices(saved.choices);
      startTransition(() => router.refresh());
    } catch (error) {
      setSaveError("This class choice could not be confirmed. Reload its saved values before trying again.");
      throw error;
    } finally { saveBusy.current = false; setSaving(false); }
  }

  async function handleFightingStyleSelect(
    featureSlug: string,
    classSlug: string,
    styleSlug: string | undefined,
  ) {
    if (!beginSave()) return;
    const newResolved = {
      ...localChoices.resolved_choices,
      [featureSlug]: styleSlug ? [styleSlug] : [],
    };
    const newChoices = { ...localChoices, resolved_choices: newResolved };

    const prev = localChoices;
    setLocalChoices(newChoices);

    setSaveError(null);
    try {
      if (saveAction) {
        const saved = await saveAction("fighting_style", { feature_slug: featureSlug, style_slug: styleSlug ?? null });
        setLocalChoices(saved.choices);
        startTransition(() => router.refresh());
        return;
      }
      await updateCharacter(characterId, { choices: newChoices });

      const previousStyles = prev.resolved_choices?.[featureSlug] ?? [];
      const oldRef = contentRefs.find((ref) => {
        if (ref.context?.source !== "fighting_style" || ref.context?.class !== classSlug) return false;
        if (ref.context?.feature) return ref.context.feature === featureSlug;
        // Legacy references have no feature owner. Only retire a uniquely owned
        // previous selection; another choice may still depend on the same pin.
        const slug = ref.content_definitions?.slug;
        return previousStyles.length === 1 && slug === previousStyles[0] &&
          !Object.entries(prev.resolved_choices ?? {}).some(([choice, selected]) =>
            choice !== featureSlug && selected.includes(slug));
      });
      if (oldRef) {
        await removeContentRefById(oldRef.id);
      }

      if (styleSlug) {
        const styleContent = savedFeatures.entries.find((f) => f.slug === styleSlug);
        if (styleContent) {
          await insertContentRef({
            characterId,
            contentId: styleContent.id,
            contentVersion: styleContent.version,
            context: { source: "fighting_style", class: classSlug, feature: featureSlug },
          });
        }
      }

      startTransition(() => router.refresh());
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to save fighting style:", err);
      setSaveError("This class change could not be confirmed. Some changes may have saved. Reload the character before trying again.");
    } finally {
      saveBusy.current = false;
      setSaving(false);
    }
  }

  async function handleSubclassSelect(
    classSlug: string,
    classIndex: number,
    subclassSlug: string | undefined,
  ) {
    if (!beginSave()) return;
    const updatedClasses = [...selectedClasses];
    updatedClasses[classIndex] = {
      ...updatedClasses[classIndex],
      subclass: subclassSlug,
    };
    const newChoices = { ...localChoices, classes: updatedClasses };

    const prev = localChoices;
    setLocalChoices(newChoices);

    setSaveError(null);
    try {
      if (saveAction) {
        const selected = subclassSlug ? subclasses.find(entry => entry.slug === subclassSlug) : undefined;
        if (subclassSlug && !selected) throw Error("The selected subclass is unavailable. Reload before trying again.");
        const saved = await saveAction("select_subclass", { class_slug: classSlug,
          content_id: selected?.id ?? null, content_version: selected?.version ?? null });
        setLocalChoices(saved.choices);
        startTransition(() => router.refresh());
        return;
      }
      await updateCharacter(characterId, { choices: newChoices });

      const existingRef = contentRefs.find(
        (ref) =>
          ref.content_definitions?.content_type === "subclass" &&
          ref.context?.source === "subclass" &&
          ref.context?.class === classSlug,
      );

      if (subclassSlug) {
        const subclassContent = subclasses.find((sc) => sc.slug === subclassSlug);
        if (subclassContent) {
          if (existingRef) {
            await removeContentRefById(existingRef.id);
          }
          await insertContentRef({
            characterId,
            contentId: subclassContent.id,
            contentVersion: subclassContent.version,
            context: { source: "subclass", class: classSlug },
          });
        }
      } else if (existingRef) {
        await removeContentRefById(existingRef.id);
      }

      startTransition(() => router.refresh());
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to save subclass:", err);
      setSaveError("This class change could not be confirmed. Some changes may have saved. Reload the character before trying again.");
    } finally {
      saveBusy.current = false;
      setSaving(false);
    }
  }

  async function handleAsiSelect(featureSlug: string, choice: AsiChoice) {
    if (!beginSave()) throw new Error("The class build is still saving or has conflicting references. Please try again after it settles.");
    const newAsiChoices = {
      ...localChoices.asi_choices,
      [featureSlug]: choice,
    };
    const newChoices = { ...localChoices, asi_choices: newAsiChoices };

    const prev = localChoices;
    setLocalChoices(newChoices);

    setSaveError(null);
    try {
      if (saveAction) {
        const saved = await saveAction("select_asi", { feature_slug: featureSlug, choice: choice.mode === "feat"
          ? { mode: "feat", feat_id: choice.featId, feat_version: choice.featVersion } : choice });
        setLocalChoices(saved.choices);
        startTransition(() => router.refresh());
        return;
      }
      const result = await setCharacterAsiChoiceAction({
        characterId,
        featureSlug,
        choice: choice.mode === "feat"
          ? {
              mode: choice.mode,
              featId: choice.featId,
              featVersion: choice.featVersion,
            }
          : choice,
      });
      if (result.status !== "success") {
        throw new Error(result.message);
      }
      setLocalChoices(result.choices);
      startTransition(() => router.refresh());
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to save ASI selection:", err);
      setSaveError("This class change could not be confirmed. Some changes may have saved. Reload the character before trying again.");
      throw err;
    } finally {
      saveBusy.current = false;
      setSaving(false);
    }
  }

  const handleFeatSearch = useCallback(async (featureSlug: string, query: string) => {
    const result = await searchUsableFeatsAction({
      characterId,
      featureSlug,
      query,
    });
    if (result.status !== "success") {
      throw new Error(result.message);
    }
    return result.feats;
  }, [characterId]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <fieldset disabled={!hydrated || saving || refreshing} aria-busy={!hydrated || saving || refreshing} className="space-y-6 min-w-0 border-0 p-0">
        <RaceAbilityNotice contentRefs={contentRefs} />
        <h2 className="text-xl font-semibold">Class</h2>
        {saving && <p role="status" className="text-sm text-muted-foreground">Saving this class change. Please wait.</p>}
        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}

        {conflictingPins.length > 0 && <p role="alert" className="text-sm text-destructive">Multiple saved snapshots match this class build. Reload the character and resolve its references before editing.</p>}
        {mismatchedSubclass && <p role="alert" className="text-sm text-destructive">The selected subclass is missing or does not belong to its class. Reload the character and check its references before editing.</p>}
        {missingFeatures.length > 0 && <div role="alert" className="space-y-2 text-sm">
          <p>Saved class features are missing: {missingFeatures.join(", ")}. Restore their saved versions before editing this build.</p>
          <Button type="button" variant="outline" onClick={recoverFeatureRefs}>Restore saved class features</Button>
        </div>}
        {snapshotConflict || missingFeatures.length > 0 ? null : hasClass ? (
          <ClassStepRail
            saveLevelImmediately={!!saveAction}
            classChangesAvailable={!saveAction || classRolesAvailable}
            classRemovalAvailable={!saveAction}
            originalOccurrenceId={saveAction ? originalClassOccurrence(contentRefs, localChoices) ?? null : undefined}
            characterName={character.name}
            savePending={saving}
            saveError={saveError}
            classes={resolveEntries(savedClasses.entries)}
            subclasses={resolveEntries(savedSubclasses.entries)}
            features={resolveEntries(savedFeatures.entries)}
            feats={feats}
            onFeatSearch={handleFeatSearch}
            selectedClasses={selectedClasses}
            localChoices={localChoices}
            resolvedStats={resolvedStats}
            mechanicsAvailable={mechanicsAvailable}
            hpRule={hpRule}
            hpRolls={hpRolls}
            onLevelChange={handleLevelChange}
            onRemoveClass={handleRemoveClass}
            onSubclassSelect={handleSubclassSelect}
            onAsiSelect={handleAsiSelect}
            onFightingStyleSelect={handleFightingStyleSelect}
            onChoiceSelect={handleChoiceSelect}
            availableLanguages={availableLanguages}
            onFavoredEnemySelect={handleFavoredEnemySelect}
            onAddClass={(content) => setPreviewContent(content)}
            onConfirmLevelUp={handleConfirmLevelUp}
            onCancelLevelUp={handleCancelLevelUp}
            onHpRollChange={handleHpRollChange}
          />
        ) : (
          <ContentBrowser
            entries={classes}
            contentTypeLabel="Class"
            onSelect={setPreviewContent}
          />
        )}

        <ClassPreviewModal
          acquisitionOnly={!!saveAction}
          open={previewContent !== null && !snapshotConflict}
          classContent={previewContent}
          features={features}
          subclasses={subclasses}
          spells={spells}
          onCancel={() => setPreviewContent(null)}
          onPick={({ subclassSlug }) => {
            if (!previewContent || snapshotConflict) return;
            // classSlug from the modal == previewContent.slug. We pass the
            // full ContentEntry to keep the existing handler signature.
            handleSelectClass(previewContent, { subclassSlug });
          }}
        />

        {saveAction && adjustedCastingSources.filter(source => source.active && source.config).map(source => <ClassSpellsPanel
          key={source.classSlug}
          source={source} catalog={spells.filter(spell => !grantedSpells.some(grant => grant.class_slug === source.classSlug && grant.content_id === spell.id))}
          selected={selectedSpells.filter(spell => spell.class_slug === source.classSlug)} abilityScores={resolvedStats}
          disabled={saving || refreshing || !mechanicsAvailable} saveAction={saveAction} onDirtyChange={handleSpellDraftChange} />)}

        {saveAction && bonusGroups.map(({ feature, choice, source }) => <BonusSpellsPanel
          key={`${feature.id}:${feature.version}:${choice.choice_id}`}
          feature={feature} choice={choice} catalog={spells}
          selected={localChoices.bonus_spells?.[choice.choice_id] ?? []}
          spellbook={selectedSpells.filter(spell => spell.class_slug === source.classSlug)
            .map(spell => ({ content_id: spell.content_id, content_version: spell.content_version }))}
          classMaxSpellLevel={source.maxLearnableLevel}
          occupied={new Set(choice.spellbook_only ? [] : [
            ...selectedSpells.filter(spell => spell.class_slug === source.classSlug).map(spell => spell.content_id),
            ...grantedSpells.filter(spell => spell.class_slug === source.classSlug).map(spell => spell.content_id),
            ...bonusGroups.filter(other => other.source.classSlug === source.classSlug && other.choice.choice_id !== choice.choice_id)
              .flatMap(other => localChoices.bonus_spells?.[other.choice.choice_id] ?? []).map(spell => spell.content_id),
          ])}
          saveAction={saveAction} disabled={saving || refreshing || !mechanicsAvailable}
          onSaved={handleBonusSaved} onDirtyChange={handleSpellDraftChange} />)}

        {/* Bottom navigation */}
        {unsavedSpells && <p role="status" className="text-sm text-muted-foreground">Save your spell choices before continuing.</p>}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            disabled={unsavedSpells}
            onClick={() =>
              router.push(`/characters/${characterId}/builder/${saveAction ? "first-class" : "race"}`)
            }
          >
            {saveAction ? "Previous: Class selection" : "Previous: Race"}
          </Button>
          <Button
            className="bg-character-fg text-background hover:opacity-90"
            disabled={unsavedSpells}
            onClick={() =>
              router.push(`/characters/${characterId}/builder/${saveAction ? "race" : "abilities"}`)
            }
          >
            {saveAction ? "Next: Race" : "Next: Abilities"}
          </Button>
        </div>
      </fieldset>

      {/* Sidebar: StatPreview */}
      {schema && !snapshotConflict && (
        <div className="hidden lg:block">
          <StatPreview
            baseStats={character.base_stats ?? {}}
            effects={allEffects}
            schema={schema}
            level={localLevel}
            sources={confirmedSources}
            draft={!mechanicsAvailable}
            state={character.state}
            classContext={{ available: mechanicsAvailable, choices: localChoices, hpRule,
              originalOccurrenceId: saveAction ? originalClassOccurrence(contentRefs, localChoices) ?? null : undefined,
              classContent: Object.fromEntries(contentRefs.filter(ref => ref.content_definitions.content_type === "class"
                && ref.content_id === ref.content_definitions.id && ref.content_version === ref.content_definitions.version)
                .map(ref => [ref.content_definitions.slug, ref.content_definitions])), castingSources }}
          />
        </div>
      )}
    </div>
  );
}
