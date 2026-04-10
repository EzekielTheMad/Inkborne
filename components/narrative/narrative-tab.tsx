"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import type { CharacterWithSystem, CharacterChoices } from "@/lib/types/character";
import type { NarrativeData, NarrativeRichData } from "@/lib/types/narrative";
import {
  saveNarrative,
  saveNarrativeRich,
  savePersonalityChoices,
  uploadPortrait,
  uploadToken,
  deletePortrait,
  deleteToken,
} from "@/app/(app)/characters/[id]/narrative-actions";
import { Button } from "@/components/ui/button";
import { Pencil, X, Save, Loader2, Check } from "lucide-react";

// View components
import { CoreIdentityCard } from "./view/core-identity-card";
import { PersonalityCard } from "./view/personality-card";
import { BackstoryCard } from "./view/backstory-card";
import { DistinguishingFeaturesCard } from "./view/distinguishing-features-card";
import { FunTraitsCard } from "./view/fun-traits-card";

// Edit components
import { CoreIdentityForm } from "./edit/core-identity-form";
import { PersonalityForm } from "./edit/personality-form";
import { BackstoryForm } from "./edit/backstory-form";
import { DistinguishingFeaturesForm } from "./edit/distinguishing-features-form";
import { FunTraitsForm } from "./edit/fun-traits-form";

// Portrait
import { CharacterPortrait } from "./character-portrait";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NarrativeTabProps {
  character: CharacterWithSystem;
  campaignId?: string | null;
  isOwner: boolean;
  isDm: boolean;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NarrativeTab({
  character,
  campaignId,
  isOwner,
  isDm,
}: NarrativeTabProps) {
  const router = useRouter();

  // ---- Edit mode toggle ----
  const [editMode, setEditMode] = useState(false);

  // ---- Saved state (updated after successful save so view mode shows latest) ----
  const [savedNarrative, setSavedNarrative] = useState<NarrativeData>(character.narrative ?? {});
  const [savedRich, setSavedRich] = useState<NarrativeRichData>(character.narrative_rich ?? {});
  const [savedChoices, setSavedChoices] = useState<CharacterChoices>(character.choices ?? {});

  // ---- Local editable state (only used in edit mode) ----
  const [localNarrative, setLocalNarrative] = useState<NarrativeData>(
    character.narrative ?? {},
  );
  const [localRich, setLocalRich] = useState<NarrativeRichData>(
    character.narrative_rich ?? {},
  );
  const [localChoices, setLocalChoices] = useState<CharacterChoices>(
    character.choices ?? {},
  );

  // ---- Portrait URLs tracked locally so view updates after upload ----
  const [portraitUrl, setPortraitUrl] = useState<string | null>(
    character.narrative?.portrait_url ?? null,
  );
  const [tokenUrl, setTokenUrl] = useState<string | null>(
    character.narrative?.token_url ?? null,
  );

  // ---- Save status ----
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // ---- Dirty flags ----
  const dirtyNarrative = useRef(false);
  const dirtyRich = useRef(false);
  const dirtyChoices = useRef(false);

  // ---- Debounce timer ----
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Debounced save logic ----
  const scheduleAutoSave = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      void flushSave();
    }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use refs for latest state so the flush closure always reads current values
  const narrativeRef = useRef(localNarrative);
  narrativeRef.current = localNarrative;
  const richRef = useRef(localRich);
  richRef.current = localRich;
  const choicesRef = useRef(localChoices);
  choicesRef.current = localChoices;

  const flushSave = useCallback(async () => {
    const promises: Promise<unknown>[] = [];

    if (dirtyNarrative.current) {
      dirtyNarrative.current = false;
      promises.push(saveNarrative(character.id, narrativeRef.current));
    }
    if (dirtyRich.current) {
      dirtyRich.current = false;
      promises.push(saveNarrativeRich(character.id, richRef.current));
    }
    if (dirtyChoices.current) {
      dirtyChoices.current = false;
      promises.push(
        savePersonalityChoices(character.id, {
          personality_traits: choicesRef.current.personality_traits,
          ideals: choicesRef.current.ideals,
          bonds: choicesRef.current.bonds,
          flaws: choicesRef.current.flaws,
        }),
      );
    }

    if (promises.length === 0) return;

    setSaveStatus("saving");
    try {
      const results = await Promise.all(promises);
      const hasError = results.some(
        (r) => r && typeof r === "object" && "error" in r,
      );
      setSaveStatus(hasError ? "error" : "saved");
    } catch {
      setSaveStatus("error");
    }
  }, [character.id]);

  // ---- Field change handlers ----
  const handleNarrativeChange = useCallback(
    (field: string, value: string) => {
      setLocalNarrative((prev) => ({ ...prev, [field]: value }));
      dirtyNarrative.current = true;
      scheduleAutoSave();
    },
    [scheduleAutoSave],
  );

  const handleFunTraitChange = useCallback(
    (field: string, value: string) => {
      setLocalNarrative((prev) => ({
        ...prev,
        fun_traits: { ...prev.fun_traits, [field]: value },
      }));
      dirtyNarrative.current = true;
      scheduleAutoSave();
    },
    [scheduleAutoSave],
  );

  const handleRichChange = useCallback(
    (field: string, content: JSONContent) => {
      setLocalRich((prev) => ({ ...prev, [field]: content }));
      dirtyRich.current = true;
      scheduleAutoSave();
    },
    [scheduleAutoSave],
  );

  const handleChoiceChange = useCallback(
    (field: string, value: string[]) => {
      setLocalChoices((prev) => ({ ...prev, [field]: value }));
      dirtyChoices.current = true;
      scheduleAutoSave();
    },
    [scheduleAutoSave],
  );

  // ---- Portrait wrappers ----
  const handleUpload = useCallback(
    async (formData: FormData) => {
      const file = formData.get("file") as File | null;
      const type = formData.get("type") as string;
      if (!file) return { error: "No file" };

      const fd = new FormData();
      fd.set(type === "token" ? "token" : "portrait", file);

      const result =
        type === "token"
          ? await uploadToken(character.id, fd)
          : await uploadPortrait(character.id, fd);

      if ("url" in result) {
        return { success: true, url: result.url };
      }
      return result;
    },
    [character.id],
  );

  const handleDelete = useCallback(
    async (_characterId: string, type: "portrait" | "token") => {
      const result =
        type === "token"
          ? await deleteToken(character.id)
          : await deletePortrait(character.id);
      return result;
    },
    [character.id],
  );

  const handlePortraitChange = useCallback(
    (url: string | null) => {
      setPortraitUrl(url);
      setLocalNarrative((prev) => ({ ...prev, portrait_url: url ?? undefined }));
    },
    [],
  );

  const handleTokenChange = useCallback(
    (url: string | null) => {
      setTokenUrl(url);
      setLocalNarrative((prev) => ({ ...prev, token_url: url ?? undefined }));
    },
    [],
  );

  // ---- Manual save ----
  const handleManualSave = useCallback(async () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    // Mark all as dirty to ensure full save
    dirtyNarrative.current = true;
    dirtyRich.current = true;
    dirtyChoices.current = true;
    await flushSave();
    // Persist to saved state so view mode shows latest
    setSavedNarrative({ ...localNarrative });
    setSavedRich({ ...localRich });
    setSavedChoices({ ...localChoices });
    // Exit edit mode and refresh server data
    setEditMode(false);
    router.refresh();
  }, [flushSave, localNarrative, localRich, localChoices, router]);

  // ---- Cancel ----
  const handleCancel = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setLocalNarrative(savedNarrative);
    setLocalRich(savedRich);
    setLocalChoices(savedChoices);
    setPortraitUrl(savedNarrative.portrait_url ?? null);
    setTokenUrl(savedNarrative.token_url ?? null);
    dirtyNarrative.current = false;
    dirtyRich.current = false;
    dirtyChoices.current = false;
    setSaveStatus("idle");
    setEditMode(false);
  }, [savedNarrative, savedRich, savedChoices]);

  // ---- Enter edit mode ----
  const enterEdit = useCallback(() => {
    setLocalNarrative(savedNarrative);
    setLocalRich(savedRich);
    setLocalChoices(savedChoices);
    setSaveStatus("idle");
    setEditMode(true);
  }, [savedNarrative, savedRich, savedChoices]);

  // ---- Determine if view has any content ----
  const narrative = editMode ? localNarrative : savedNarrative;
  const rich = editMode ? localRich : savedRich;
  const choices = editMode ? localChoices : savedChoices;

  const hasAnyViewContent =
    narrative.full_name ||
    narrative.aliases ||
    narrative.one_liner ||
    narrative.age ||
    narrative.build ||
    narrative.origin ||
    narrative.motivation ||
    narrative.mannerisms ||
    narrative.fear ||
    (choices.personality_traits && choices.personality_traits.length > 0) ||
    (choices.ideals && choices.ideals.length > 0) ||
    (choices.bonds && choices.bonds.length > 0) ||
    (choices.flaws && choices.flaws.length > 0) ||
    rich.distinguishing_features ||
    rich.backstory_origin ||
    rich.backstory_turning_point ||
    rich.backstory_left_behind ||
    rich.backstory_dm_notes ||
    (narrative.fun_traits &&
      Object.values(narrative.fun_traits).some(Boolean)) ||
    portraitUrl ||
    tokenUrl;

  // ---- Render ----
  return (
    <div className="space-y-4">
      {/* Header row: title + action buttons */}
      <div className="flex items-center justify-between">
        <div />
        <div className="flex items-center gap-2">
          {editMode && (
            <>
              <SaveStatusBadge status={saveStatus} />
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="mr-1 size-3.5" />
                Cancel
              </Button>
              <Button variant="secondary" size="sm" onClick={handleManualSave}>
                <Save className="mr-1 size-3.5" />
                Save
              </Button>
            </>
          )}
          {isOwner && !editMode && (
            <Button onClick={enterEdit}>
              <Pencil className="mr-1 size-4" />
              Edit Character
            </Button>
          )}
        </div>
      </div>

      {/* Portrait */}
      <div className="flex justify-center">
        <CharacterPortrait
          characterId={character.id}
          characterName={character.name}
          portraitUrl={portraitUrl}
          tokenUrl={tokenUrl}
          editable={editMode}
          onPortraitChange={handlePortraitChange}
          onTokenChange={handleTokenChange}
          uploadAction={handleUpload}
          deleteAction={handleDelete}
        />
      </div>

      {/* Edit mode */}
      {editMode && (
        <div className="space-y-4">
          <CoreIdentityForm
            narrative={localNarrative}
            onChange={handleNarrativeChange}
          />
          <PersonalityForm
            choices={localChoices}
            narrative={localNarrative}
            onChoiceChange={handleChoiceChange}
            onNarrativeChange={handleNarrativeChange}
          />
          <DistinguishingFeaturesForm
            content={localRich.distinguishing_features ?? null}
            campaignId={campaignId}
            onChange={(content) =>
              handleRichChange("distinguishing_features", content)
            }
          />
          <BackstoryForm
            narrativeRich={localRich}
            campaignId={campaignId}
            onRichChange={handleRichChange}
            isOwner={isOwner}
          />
          <FunTraitsForm
            funTraits={localNarrative.fun_traits}
            onChange={handleFunTraitChange}
          />
        </div>
      )}

      {/* View mode */}
      {!editMode && (
        <>
          {hasAnyViewContent ? (
            <div className="space-y-4">
              <CoreIdentityCard narrative={narrative} />
              <PersonalityCard choices={choices} narrative={narrative} />
              <DistinguishingFeaturesCard
                content={rich.distinguishing_features}
              />
              <BackstoryCard
                title="Where They Came From"
                content={rich.backstory_origin}
              />
              <BackstoryCard
                title="The Turning Point"
                content={rich.backstory_turning_point}
              />
              <BackstoryCard
                title="What They Left Behind"
                content={rich.backstory_left_behind}
              />
              {(isOwner || isDm) && (
                <BackstoryCard
                  title="What the DM Should Know"
                  content={rich.backstory_dm_notes}
                  dmOnly
                />
              )}
              <FunTraitsCard funTraits={narrative.fun_traits} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-muted-foreground">
                No narrative details yet.
              </p>
              {isOwner && (
                <p className="text-sm text-muted-foreground">
                  Click <span className="font-medium text-foreground">Edit</span>{" "}
                  to bring your character to life.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Save status badge
// ---------------------------------------------------------------------------

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      {status === "saving" && (
        <>
          <Loader2 className="size-3 animate-spin" />
          Saving...
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="size-3 text-green-500" />
          Saved
        </>
      )}
      {status === "error" && (
        <span className="text-destructive">Save failed</span>
      )}
    </span>
  );
}
