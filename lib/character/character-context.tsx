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
import type {
  CharacterSpell,
  AddSpellPayload,
  SpellUpdate,
  SpellSlotsUsed,
  MaxSlotsByLevel,
  CasterInfo,
  CasterClass,
  ConcentrationState,
} from "@/lib/types/spells";
import {
  addCharacterSpell,
  updateCharacterSpell,
  removeCharacterSpell,
} from "@/lib/supabase/spells";
import {
  computeSpellDc,
  computeSpellAttackBonus,
  computeMaxPrepared,
  computeMaxSlots,
} from "@/lib/spells/helpers";

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

export type ClassContentData = Record<
  string,
  {
    slug: string;
    data: {
      spellcasting?: {
        ability?: string;
        type?: CasterClass["type"];
        focus?: string;
        ritual_casting?: boolean;
      } | null;
      spellcastingKnown?: {
        cantrips?: number[];
        spells?: number[] | "all";
        prepared?: boolean;
      };
      levels?: Array<{
        spellcasting?: { cantrips_known?: number; spell_slots?: number[] } | null;
      }>;
    };
  }
>;

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

  // Spells
  spells: CharacterSpell[];
  slotState: SpellSlotsUsed;
  maxSlots: MaxSlotsByLevel;
  casterInfo: CasterInfo;
  concentration: ConcentrationState | null;
  addSpell: (payload: AddSpellPayload) => Promise<void>;
  updateSpell: (id: string, updates: SpellUpdate) => Promise<void>;
  removeSpell: (id: string) => Promise<void>;
  setConcentration: (spell: Omit<ConcentrationState, "started_at"> | null) => Promise<void>;
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
  initialSpells: CharacterSpell[];
  classData: ClassContentData;
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
  initialSpells,
  classData,
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

  // --- Spells ---
  const [spells, setSpells] = useState<CharacterSpell[]>(initialSpells);

  const addSpell = useCallback(
    async (payload: AddSpellPayload) => {
      const newSpell = await addCharacterSpell(character.id, payload);
      if (newSpell) {
        setSpells((prev) => [...prev, newSpell]);
      }
    },
    [character.id],
  );

  const updateSpell = useCallback(
    async (id: string, updates: SpellUpdate) => {
      await updateCharacterSpell(id, updates);
      setSpells((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    },
    [],
  );

  const removeSpell = useCallback(
    async (id: string) => {
      await removeCharacterSpell(id);
      setSpells((prev) => prev.filter((s) => s.id !== id));
    },
    [],
  );

  const setConcentration = useCallback(
    async (spell: Omit<ConcentrationState, "started_at"> | null) => {
      if (!spell) {
        await patchState({ concentrating_on: null });
      } else {
        await patchState({
          concentrating_on: {
            ...spell,
            started_at: new Date().toISOString(),
          },
        });
      }
    },
    [patchState],
  );

  // --- Derived caster info ---
  const casterInfo = useMemo<CasterInfo>(() => {
    const classChoices =
      (character.choices as { classes?: Array<{ slug: string; level: number; subclass?: string }> })
        ?.classes ?? [];

    const profBonus = Number(evalResult.computed?.proficiency_bonus ?? 2);
    const abilityScores = (evalResult.stats ?? {}) as Record<string, number>;

    const classes: CasterClass[] = [];
    for (const cls of classChoices) {
      const cd = classData[cls.slug];
      const sc = cd?.data?.spellcasting;
      if (!sc || !sc.type) continue;

      const ability = sc.ability ?? "intelligence";
      const abilityMod = Math.floor(((abilityScores[ability] ?? 10) - 10) / 2);
      const prepared = cd.data.spellcastingKnown?.prepared ?? false;
      const cantripsArr = cd.data.spellcastingKnown?.cantrips ?? [];
      const knownArr = cd.data.spellcastingKnown?.spells ?? "all";
      const cantripsKnown = cantripsArr[cls.level - 1] ?? 0;
      const spellsKnown: number | "all" =
        knownArr === "all" ? "all" : knownArr[cls.level - 1] ?? 0;

      classes.push({
        slug: cls.slug,
        level: cls.level,
        type: sc.type,
        ability,
        prepared,
        cantripsKnown,
        spellsKnown,
        maxPrepared: prepared ? computeMaxPrepared(cls.slug, cls.level, abilityMod) : 0,
        ritualCasting: sc.ritual_casting ?? false,
        focus: sc.focus,
      });
    }

    // Spell DC and attack: highest across classes
    let spellDc = 0;
    let spellAttackBonus = 0;
    for (const c of classes) {
      const dc = computeSpellDc(c, abilityScores, profBonus);
      const atk = computeSpellAttackBonus(c, abilityScores, profBonus);
      if (dc > spellDc) spellDc = dc;
      if (atk > spellAttackBonus) spellAttackBonus = atk;
    }

    return {
      isCaster: classes.length > 0,
      classes,
      spellDc,
      spellAttackBonus,
    };
  }, [character.choices, classData, evalResult]);

  const maxSlots = useMemo<MaxSlotsByLevel>(() => {
    const classChoices =
      (character.choices as { classes?: Array<{ slug: string; level: number; subclass?: string }> })
        ?.classes ?? [];
    const forCalc = classChoices.map((c) => {
      const cd = classData[c.slug];
      const type = cd?.data?.spellcasting?.type ?? null;
      return { slug: c.slug, level: c.level, type };
    });
    // computeMaxSlots expects { levels } directly; ClassContentData nests it under .data
    const classDataForSlots: Record<string, { levels?: Array<{ spellcasting?: { spell_slots?: number[] } | null }> }> = {};
    for (const [slug, content] of Object.entries(classData)) {
      classDataForSlots[slug] = { levels: content.data.levels };
    }
    return computeMaxSlots(forCalc, classDataForSlots);
  }, [character.choices, classData]);

  const slotState = (state.spell_slots_used ?? {}) as SpellSlotsUsed;
  const concentration = (state.concentrating_on ?? null) as ConcentrationState | null;

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
    spells,
    slotState,
    maxSlots,
    casterInfo,
    concentration,
    addSpell,
    updateSpell,
    removeSpell,
    setConcentration,
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

export function useSpells() {
  const ctx = useCharacterContext();
  return {
    spells: ctx.spells,
    slotState: ctx.slotState,
    maxSlots: ctx.maxSlots,
    casterInfo: ctx.casterInfo,
    concentration: ctx.concentration,
    addSpell: ctx.addSpell,
    updateSpell: ctx.updateSpell,
    removeSpell: ctx.removeSpell,
    setConcentration: ctx.setConcentration,
  };
}

export function usePortrait() {
  const ctx = useCharacterContext();
  return {
    portrait: ctx.portrait,
    setPortrait: ctx.setPortrait,
  };
}
