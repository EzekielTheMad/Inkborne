"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import type { CharacterWithSystem, CharacterChoices } from "@/lib/types/character";
import type { NarrativeData, NarrativeRichData } from "@/lib/types/narrative";
import {
  saveNarrative,
  saveNarrativeRich,
  savePersonalityChoices,
} from "@/app/(app)/characters/[id]/narrative-actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseNarrativeEditorArgs {
  character: CharacterWithSystem;
  onPortraitChange?: (url: string | null) => void;
  onTokenChange?: (url: string | null) => void;
}

export interface UseNarrativeEditorReturn {
  // Edit-mode toggle
  editMode: boolean;
  enterEdit: () => void;

  // Saved (server) state — what view-mode renders
  savedNarrative: NarrativeData;
  savedRich: NarrativeRichData;
  savedChoices: CharacterChoices;

  // Local (editing) state — what edit-mode renders
  localNarrative: NarrativeData;
  localRich: NarrativeRichData;
  localChoices: CharacterChoices;
  // Setters needed by narrative-tab for inline portrait_crop updates
  setLocalNarrative: React.Dispatch<React.SetStateAction<NarrativeData>>;

  // Save status
  saveStatus: SaveStatus;

  // Portrait/token URLs (kept locally so view updates after upload)
  portraitUrl: string | null;
  tokenUrl: string | null;

  // Field change handlers — signatures match the existing edit form props
  handleNarrativeChange: (field: string, value: string) => void;
  handleFunTraitChange: (field: string, value: string) => void;
  handleRichChange: (field: string, content: JSONContent) => void;
  handleChoiceChange: (field: string, value: string[]) => void;

  // Portrait/token change handlers
  handlePortraitChange: (url: string | null) => void;
  handleTokenChange: (url: string | null) => void;

  // Manual save / cancel
  handleManualSave: () => Promise<void>;
  handleCancel: () => void;

  // Internal — needed so narrative-tab can flag dirty + schedule auto-save
  // when it mutates localNarrative directly (portrait_crop case).
  markNarrativeDirty: () => void;
  scheduleAutoSave: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNarrativeEditor({
  character,
  onPortraitChange,
  onTokenChange,
}: UseNarrativeEditorArgs): UseNarrativeEditorReturn {
  const router = useRouter();

  // ---- Edit mode toggle ----
  const [editMode, setEditMode] = useState(false);

  // ---- Saved state (updated after successful save so view mode shows latest) ----
  const [savedNarrative, setSavedNarrative] = useState<NarrativeData>(
    character.narrative ?? {},
  );
  const [savedRich, setSavedRich] = useState<NarrativeRichData>(
    character.narrative_rich ?? {},
  );
  const [savedChoices, setSavedChoices] = useState<CharacterChoices>(
    character.choices ?? {},
  );

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

  // Use refs for latest state so the flush closure always reads current values
  const narrativeRef = useRef(localNarrative);
  narrativeRef.current = localNarrative;
  const richRef = useRef(localRich);
  richRef.current = localRich;
  const choicesRef = useRef(localChoices);
  choicesRef.current = localChoices;

  // ---- Flush save (sends only dirty sections) ----
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

  // ---- Debounced save scheduler ----
  const scheduleAutoSave = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      void flushSave();
    }, 500);
  }, [flushSave]);

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

  // ---- Portrait / token change handlers ----
  const handlePortraitChange = useCallback(
    (url: string | null) => {
      setPortraitUrl(url);
      setLocalNarrative((prev) => ({ ...prev, portrait_url: url ?? undefined }));
      onPortraitChange?.(url);
    },
    [onPortraitChange],
  );

  const handleTokenChange = useCallback(
    (url: string | null) => {
      setTokenUrl(url);
      setLocalNarrative((prev) => ({ ...prev, token_url: url ?? undefined }));
      onTokenChange?.(url);
    },
    [onTokenChange],
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
    setSavedNarrative({ ...narrativeRef.current });
    setSavedRich({ ...richRef.current });
    setSavedChoices({ ...choicesRef.current });
    // Exit edit mode and refresh server data
    setEditMode(false);
    router.refresh();
  }, [flushSave, router]);

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

  // ---- Imperative dirty marker (used by callers that mutate localNarrative directly) ----
  const markNarrativeDirty = useCallback(() => {
    dirtyNarrative.current = true;
  }, []);

  return {
    editMode,
    enterEdit,
    savedNarrative,
    savedRich,
    savedChoices,
    localNarrative,
    localRich,
    localChoices,
    setLocalNarrative,
    saveStatus,
    portraitUrl,
    tokenUrl,
    handleNarrativeChange,
    handleFunTraitChange,
    handleRichChange,
    handleChoiceChange,
    handlePortraitChange,
    handleTokenChange,
    handleManualSave,
    handleCancel,
    markNarrativeDirty,
    scheduleAutoSave,
  };
}
