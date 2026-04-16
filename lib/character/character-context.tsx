"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CharacterWithSystem, CharacterState } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type {
  EvaluationResult,
  StructuredSources,
} from "@/lib/engine/evaluator";
import { evaluate } from "@/lib/engine/evaluator";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { Effect } from "@/lib/types/effects";
import type { InventoryItem, Currency } from "@/lib/types/inventory";
import { DEFAULT_CURRENCY } from "@/lib/types/inventory";
import type { CropArea } from "@/components/narrative/character-portrait";
import { updateCharacterState } from "@/lib/sheet/update-state";
import {
  addInventoryItem,
  updateInventoryItem,
  removeInventoryItem,
  unequipAllArmor,
} from "@/lib/supabase/inventory";
import { generateArmorEffects } from "@/lib/inventory/armor-effects";
import { isBodyArmor, isShield, getItemData } from "@/lib/inventory/helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddItemPayload {
  content_id: string | null;
  name: string;
  content_type: string;
  quantity?: number;
  custom_data?: Record<string, unknown> | null;
}

export type InventoryUpdate = Partial<
  Pick<InventoryItem, "quantity" | "equipped" | "attuned" | "notes">
>;

interface PortraitData {
  url?: string;
  crop?: CropArea | null;
}

interface CharacterContextValue {
  // Identity
  character: CharacterWithSystem;
  schema: SystemSchemaDefinition;
  contentRefs: ContentRefWithContent[];
  isOwner: boolean;
  isDm: boolean;
  hasSheet: boolean;
  maxHp: number;

  // Play state
  state: CharacterState;
  patchState: (patch: Partial<CharacterState>) => Promise<void>;

  // Evaluation
  evalResult: EvaluationResult;

  // Portrait
  portrait: PortraitData;
  setPortrait: (updates: PortraitData) => void;

  // Inventory
  inventory: InventoryItem[];
  currency: Currency;
  addItem: (item: AddItemPayload) => Promise<void>;
  updateItem: (id: string, updates: InventoryUpdate) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  setCurrency: (currency: Currency) => void;
}

const CharacterContext = createContext<CharacterContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface CharacterProviderProps {
  character: CharacterWithSystem;
  schema: SystemSchemaDefinition;
  contentRefs: ContentRefWithContent[];
  initialState: CharacterState;
  initialInventory: InventoryItem[];
  allEffects: Effect[];
  baseStatsWithLevel: Record<string, number>;
  structuredSources: StructuredSources;
  isOwner: boolean;
  isDm: boolean;
  hasSheet: boolean;
  maxHp: number;
  children: ReactNode;
}

export function CharacterProvider({
  character,
  schema,
  contentRefs,
  initialState,
  initialInventory,
  allEffects,
  baseStatsWithLevel,
  structuredSources,
  isOwner,
  isDm,
  hasSheet,
  maxHp,
  children,
}: CharacterProviderProps) {
  const [state, setState] = useState<CharacterState>(initialState);
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [portrait, setPortraitState] = useState<PortraitData>({
    url: character.narrative?.portrait_url as string | undefined,
    crop: (character.narrative?.portrait_crop as CropArea | undefined) ?? null,
  });

  // Patch character.state (immediate server write)
  const patchState = useCallback(
    async (patch: Partial<CharacterState>) => {
      setState((prev) => ({ ...prev, ...patch }));
      try {
        await updateCharacterState(character.id, patch);
      } catch (err) {
        console.error("Failed to save state:", err);
      }
    },
    [character.id],
  );

  // Inventory handlers
  const addItem = useCallback(
    async (item: AddItemPayload) => {
      const newItem = await addInventoryItem(character.id, item);
      if (newItem) {
        setInventory((prev) => [...prev, newItem]);
      }
    },
    [character.id],
  );

  const updateItem = useCallback(
    async (id: string, updates: InventoryUpdate) => {
      // Armor mutual exclusion: equipping body armor unequips other body armor
      if (updates.equipped === true) {
        const item = inventory.find((i) => i.id === id);
        if (item && isBodyArmor(item)) {
          await unequipAllArmor(character.id);
          setInventory((prev) =>
            prev.map((i) =>
              isBodyArmor(i) && i.id !== id ? { ...i, equipped: false } : i,
            ),
          );
        }
      }
      await updateInventoryItem(id, updates);
      setInventory((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      );
    },
    [inventory, character.id],
  );

  const removeItem = useCallback(
    async (id: string) => {
      await removeInventoryItem(id);
      setInventory((prev) => prev.filter((i) => i.id !== id));
    },
    [],
  );

  const setCurrency = useCallback(
    (newCurrency: Currency) => {
      patchState({ currency: newCurrency });
    },
    [patchState],
  );

  // Portrait updates (merges partial updates)
  const setPortrait = useCallback((updates: PortraitData) => {
    setPortraitState((prev) => ({
      url: updates.url !== undefined ? updates.url : prev.url,
      crop: updates.crop !== undefined ? updates.crop : prev.crop,
    }));
  }, []);

  // Derived: AC effects from equipped body armor
  const equippedArmorEffects = useMemo(() => {
    const equipped = inventory.find((i) => i.equipped && isBodyArmor(i));
    if (!equipped) return [];
    const data = getItemData(equipped) as {
      armor_category: string;
      armor_class: { base: number; dex_bonus: boolean; max_bonus?: number };
    };
    return generateArmorEffects(data);
  }, [inventory]);

  // Derived: state augmented with equipment-derived fields
  const derivedState = useMemo(() => {
    const equippedBody = inventory.find((i) => i.equipped && isBodyArmor(i));
    const hasShield = inventory.some((i) => i.equipped && isShield(i));
    const armorCategory = equippedBody
      ? String(getItemData(equippedBody).armor_category ?? "none").toLowerCase()
      : "none";
    return {
      ...state,
      equipped_armor: armorCategory,
      shield_equipped: hasShield,
    };
  }, [inventory, state]);

  // Derived: evaluation result
  const evalResult = useMemo(() => {
    const combinedEffects = [...allEffects, ...equippedArmorEffects];
    return evaluate(
      baseStatsWithLevel,
      combinedEffects,
      schema,
      structuredSources,
      derivedState as Record<string, unknown>,
    );
  }, [
    baseStatsWithLevel,
    allEffects,
    equippedArmorEffects,
    schema,
    structuredSources,
    derivedState,
  ]);

  const currency = (state.currency as Currency) ?? DEFAULT_CURRENCY;

  const value: CharacterContextValue = {
    character,
    schema,
    contentRefs,
    isOwner,
    isDm,
    hasSheet,
    maxHp,
    state,
    patchState,
    evalResult,
    portrait,
    setPortrait,
    inventory,
    currency,
    addItem,
    updateItem,
    removeItem,
    setCurrency,
  };

  return (
    <CharacterContext.Provider value={value}>
      {children}
    </CharacterContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hooks
// ---------------------------------------------------------------------------

function useCharacterContext(): CharacterContextValue {
  const ctx = useContext(CharacterContext);
  if (!ctx) {
    throw new Error(
      "Character hook used outside CharacterProvider. Wrap the tree in <CharacterProvider>.",
    );
  }
  return ctx;
}

export function useCharacter() {
  const ctx = useCharacterContext();
  return {
    character: ctx.character,
    schema: ctx.schema,
    contentRefs: ctx.contentRefs,
    isOwner: ctx.isOwner,
    isDm: ctx.isDm,
    hasSheet: ctx.hasSheet,
    evalResult: ctx.evalResult,
    maxHp: ctx.maxHp,
  };
}

export function useCharacterState() {
  const ctx = useCharacterContext();
  return {
    state: ctx.state,
    patchState: ctx.patchState,
  };
}

export function useInventory() {
  const ctx = useCharacterContext();
  return {
    inventory: ctx.inventory,
    currency: ctx.currency,
    addItem: ctx.addItem,
    updateItem: ctx.updateItem,
    removeItem: ctx.removeItem,
    setCurrency: ctx.setCurrency,
  };
}

export function usePortrait() {
  const ctx = useCharacterContext();
  return {
    portrait: ctx.portrait,
    setPortrait: ctx.setPortrait,
  };
}
