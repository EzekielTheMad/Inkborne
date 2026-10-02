"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
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
  searchUsableFeatsAction,
  setCharacterAsiChoiceAction,
} from "./actions";

interface ClassStepClientProps {
  characterId: string;
  character: {
    id: string;
    name: string;
    level: number;
    base_stats: Record<string, number>;
    choices: CharacterChoices;
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
  schema: SystemSchemaDefinition | undefined;
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

export function ClassStepClient({
  characterId,
  character,
  classes,
  subclasses,
  features,
  feats,
  spells,
  contentRefs,
  schema,
}: ClassStepClientProps) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [previewContent, setPreviewContent] = useState<ContentEntry | null>(null);
  const [localChoices, setLocalChoices] = useState<CharacterChoices>(
    character.choices ?? {},
  );
  const [localLevel, setLocalLevel] = useState(character.level);

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
  const savedFeatures = pinnedEntries(features, contentRefs, "feature", referencedFeatures);
  const conflictingPins = [...savedClasses.conflicts, ...savedSubclasses.conflicts, ...savedFeatures.conflicts];
  const snapshotConflict = conflictingPins.length > 0 || mismatchedSubclass;

  const hpRule = resolveHpRule(
    (character as unknown as { campaigns?: { hp_rule?: HpRule | null } | null }).campaigns?.hp_rule,
    (schema as unknown as { hp_rule?: HpRule } | undefined)?.hp_rule,
  );

  const hpRolls = localChoices.hp_rolls ?? {};

  const allEffects: Effect[] = contentRefs.flatMap(
    (ref) => ref.content_definitions?.effects ?? [],
  );

  const resolvedStats = useMemo(() => {
    if (!schema) return character.base_stats ?? {};
    const baseWithLevel = { ...(character.base_stats ?? {}), level: localLevel };
    return evaluate(baseWithLevel, allEffects, schema).stats;
  }, [character.base_stats, localLevel, allEffects, schema]);

  async function handleSelectClass(
    content: ContentEntry,
    opts?: { subclassSlug?: string | null },
  ) {
    setPreviewContent(null);

    const subclassSlug = opts?.subclassSlug ?? undefined;
    const newClasses = [
      ...selectedClasses,
      { slug: content.slug, level: 1, subclass: subclassSlug },
    ];
    const totalLevel = newClasses.reduce((sum, c) => sum + c.level, 0);
    const newChoices = { ...localChoices, classes: newClasses };

    const prev = { choices: localChoices, level: localLevel };
    setLocalChoices(newChoices);
    setLocalLevel(totalLevel);

    setSaveError(null);
    try {
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
    }
  }

  async function handleLevelChange(classIndex: number, newLevel: number) {
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
    }
  }

  async function handleConfirmLevelUp(payload: {
    classIndex: number;
    draftLevel: number;
  }) {
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
    }
  }

  function handleCancelLevelUp() {
    // No persistence — the rail handles UI revert; HP roll edits are already
    // persisted incrementally via handleHpRollChange (per Q2A semantics).
  }

  async function handleHpRollChange(key: string, record: HpRollRecord) {
    const newHpRolls = { ...(localChoices.hp_rolls ?? {}), [key]: record };
    const newChoices = { ...localChoices, hp_rolls: newHpRolls };

    const prev = localChoices;
    setLocalChoices(newChoices);

    setSaveError(null);
    try {
      await updateCharacter(characterId, { choices: newChoices });
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to save HP roll:", err);
      setSaveError("This class change could not be confirmed. Some changes may have saved. Reload the character before trying again.");
    }
  }

  async function handleRemoveClass(classIndex: number) {
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
    }
  }

  async function handleChoiceSelect(choiceId: string, selections: string[]) {
    const newResolved = {
      ...localChoices.resolved_choices,
      [choiceId]: selections,
    };
    const newChoices = { ...localChoices, resolved_choices: newResolved };

    const prev = localChoices;
    setLocalChoices(newChoices);

    setSaveError(null);
    try {
      await updateCharacter(characterId, { choices: newChoices });
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to save choice selection:", err);
      setSaveError("This class change could not be confirmed. Some changes may have saved. Reload the character before trying again.");
    }
  }

  async function handleFightingStyleSelect(
    featureSlug: string,
    classSlug: string,
    styleSlug: string | undefined,
  ) {
    const newResolved = {
      ...localChoices.resolved_choices,
      [featureSlug]: styleSlug ? [styleSlug] : [],
    };
    const newChoices = { ...localChoices, resolved_choices: newResolved };

    const prev = localChoices;
    setLocalChoices(newChoices);

    setSaveError(null);
    try {
      await updateCharacter(characterId, { choices: newChoices });

      const oldRef = contentRefs.find(
        (ref) =>
          ref.context?.source === "fighting_style" &&
          ref.context?.class === classSlug,
      );
      if (oldRef) {
        await removeContentRefById(oldRef.id);
      }

      if (styleSlug) {
        const styleContent = features.find((f) => f.slug === styleSlug);
        if (styleContent) {
          await insertContentRef({
            characterId,
            contentId: styleContent.id,
            contentVersion: styleContent.version,
            context: { source: "fighting_style", class: classSlug },
          });
        }
      }

      startTransition(() => router.refresh());
    } catch (err) {
      setLocalChoices(prev);
      console.error("Failed to save fighting style:", err);
      setSaveError("This class change could not be confirmed. Some changes may have saved. Reload the character before trying again.");
    }
  }

  async function handleSubclassSelect(
    classSlug: string,
    classIndex: number,
    subclassSlug: string | undefined,
  ) {
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
    }
  }

  async function handleAsiSelect(featureSlug: string, choice: AsiChoice) {
    const newAsiChoices = {
      ...localChoices.asi_choices,
      [featureSlug]: choice,
    };
    const newChoices = { ...localChoices, asi_choices: newAsiChoices };

    const prev = localChoices;
    setLocalChoices(newChoices);

    setSaveError(null);
    try {
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
      <div className="space-y-6 min-w-0">
        <h2 className="text-xl font-semibold">Class</h2>
        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}

        {conflictingPins.length > 0 && <p role="alert" className="text-sm text-destructive">Multiple saved snapshots match this class build. Reload the character and resolve its references before editing.</p>}
        {mismatchedSubclass && <p role="alert" className="text-sm text-destructive">The selected subclass is missing or does not belong to its class. Reload the character and check its references before editing.</p>}
        {snapshotConflict ? null : hasClass ? (
          <ClassStepRail
            characterName={character.name}
            classes={savedClasses.entries}
            subclasses={savedSubclasses.entries}
            features={savedFeatures.entries}
            feats={feats}
            onFeatSearch={handleFeatSearch}
            selectedClasses={selectedClasses}
            localChoices={localChoices}
            resolvedStats={resolvedStats}
            hpRule={hpRule}
            hpRolls={hpRolls}
            onLevelChange={handleLevelChange}
            onRemoveClass={handleRemoveClass}
            onSubclassSelect={handleSubclassSelect}
            onAsiSelect={handleAsiSelect}
            onFightingStyleSelect={handleFightingStyleSelect}
            onChoiceSelect={handleChoiceSelect}
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

        {/* Bottom navigation */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/characters/${characterId}/builder/race`)
            }
          >
            Previous: Race
          </Button>
          <Button
            className="bg-character-fg text-background hover:opacity-90"
            onClick={() =>
              router.push(`/characters/${characterId}/builder/abilities`)
            }
          >
            Next: Abilities
          </Button>
        </div>
      </div>

      {/* Sidebar: StatPreview */}
      {schema && !snapshotConflict && (
        <div className="hidden lg:block">
          <StatPreview
            baseStats={character.base_stats ?? {}}
            effects={allEffects}
            schema={schema}
            level={localLevel}
          />
        </div>
      )}
    </div>
  );
}
