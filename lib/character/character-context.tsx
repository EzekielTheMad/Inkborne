"use client";

import { resolveEffectiveCastingSources } from "@/lib/spells/effective-sources";
import { resolveCastingMath } from "@/lib/spells/casting-math";
import { resolveCastingAbility, type CastingAbilityResolution } from "@/lib/spells/casting-ability";

import {
  createContext,
  useLayoutEffect,
  useCallback,
  useContext,
  useMemo,
  useRef,
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
import { resolveSavingThrowBonus, resolveSavingThrowModifier, type SavingThrowBonus } from "@/lib/sheet/helpers";
import { resolveAbilityMechanics, assertAbilityMechanics, getConfirmedAbilityModifier, type AbilityMechanics, type MechanicsRequirement } from "@/lib/character/ability-mechanics";
import type { ContentRefWithContent } from "@/lib/supabase/content-refs";
import type { Effect } from "@/lib/types/effects";
import type { InventoryItem, Currency } from "@/lib/types/inventory";
import { DEFAULT_CURRENCY } from "@/lib/types/inventory";
import type { CropArea } from "@/components/narrative/character-portrait";
import { CharacterStateReloadError } from "@/lib/character/state-save-error";
import { createStateWriter } from "@/lib/character/state-writer";
import { updateCharacterState, updateManualHpState } from "@/lib/sheet/update-state";
import { manualHpParent } from "@/lib/character/basic-sheet-command";
import { builderClassRoleSchema, classRoleForRef } from "@/lib/character/builder-class-roles";
import { canonicalHitDieJson } from "@/lib/character/durable-hit-die-canonical";
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
  SlotResolution,
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
  computeMaxPrepared,
} from "@/lib/spells/helpers";
import {
  computeCastEffects,
  castSourceFromCharacterSpell,
  type CastChoice,
  type CastOutcome,
} from "@/lib/spells/casting";
import { computeResources } from "@/lib/resources/helpers";
import type { FeatureResource } from "@/lib/types/resources";
import { executeRoll } from "@/lib/dice/roller";
import type { RollRequest, RollResult } from "@/lib/dice/types";
import type { RollLogEntry } from "@/lib/types/rolls";
import { insertRoll } from "@/lib/supabase/rolls";
import {
  computeShortRestEffects,
  computeLongRestEffects,
} from "@/lib/rest/helpers";
import {
  arcaneRecoveryClassLevel,
  computeArcaneRecoveryInfo,
  mergeShortRestWithRecovery,
  totalPickedLevels,
  validateArcaneRecoveryPicks,
  type ArcaneRecoveryInfo,
  type ArcaneRecoveryPicks,
} from "@/lib/rest/arcane-recovery";
import type { ActiveEffect, CustomEffectInput } from "@/lib/types/active-effects";
import {
  collectActiveEffects,
  applyActiveEffectPatch,
  removeActiveEffectPatch,
  buildCustomActiveEffect,
} from "@/lib/active-effects/helpers";
import {
  computeConcentrationDropPatch,
  concentrationSaveDc,
  type PendingConcentrationCheck,
} from "@/lib/active-effects/concentration";
import {
  computeHitDicePools,
  buildHitDieRollRequest,
  spendHitDiePatch,
  type HitDicePool,
} from "@/lib/hit-dice/helpers";

/** Compare raw read payloads only after validating each role's own parent
 * revision. The stripped stamp exists only in this comparison value; loaded
 * provenance is never rewritten or reused as evidence for another revision. */
function nativeHpContentBinding(refs: ContentRefWithContent[], character: CharacterWithSystem, revision: string) {
  const requiresRoles = character.choices.classes?.some(entry => entry.occurrence_id);
  return refs.map(ref => {
    if (ref.class_role === undefined) {
      if (requiresRoles && ref.content_definitions.content_type === "class") throw new Error("Missing native class role");
      return ref;
    }
    if (!builderClassRoleSchema.safeParse(ref.class_role).success) throw new Error("Invalid native class role");
    const { action_revision, ...rawRole } = ref.class_role;
    if (action_revision !== revision || !classRoleForRef(ref, character.choices)) throw new Error("Unbound native class role");
    return { ...ref, class_role: rawRole };
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddItemPayload {
  content_id: string | null;
  content_version?: number | null;
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
      /** Hit die size (e.g. 10 for a d10). Drives hit-dice pools + max HP. */
      hit_die?: number;
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
        level: number;
        spellcasting?: { cantrips_known?: number; spell_slots?: number[] } | null;
      }>;
    };
  }
>;

export interface CharacterContextValue {
  // Identity
  character: CharacterWithSystem;
  schema: SystemSchemaDefinition;
  contentRefs: ContentRefWithContent[];
  contentSnapshotsComplete: boolean;
  isOwner: boolean;
  isDm: boolean;
  hasSheet: boolean;
  maxHp: number;

  // Play state
  state: CharacterState;
  reloadRequired: boolean;
  patchState: ReturnType<typeof createStateWriter>;

  // Evaluation
  evalResult: EvaluationResult;
  savingThrowBonus: SavingThrowBonus;
  mechanics: AbilityMechanics;
  mechanicsToken: object;
  assertMechanics: (requirement?: MechanicsRequirement) => void;

  // Portrait
  portrait: PortraitData;
  setPortrait: (updates: PortraitData) => void;

  // Inventory
  inventory: InventoryItem[];
  currency: Currency;
  addItem: (item: AddItemPayload) => Promise<void>;
  updateItem: (id: string, updates: InventoryUpdate) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  setCurrency: (currency: Currency) => Promise<boolean>;

  // Feature resources
  resources: FeatureResource[];

  // Rolls (hydrated history + session, newest first)
  rolls: RollLogEntry[];
  roll: (request: RollRequest, requirement?: MechanicsRequirement) => RollResult;
  rollWithPersistence: (request: RollRequest, requirement?: MechanicsRequirement) => { result: RollResult; persistence: Promise<void> };
  rollPersistencePending: boolean;
  rollPersistenceUncertain: boolean;

  // Hit dice (per-class pools; max computed from class levels)
  hitDicePools: HitDicePool[];
  spendHitDie: (classSlug: string) => Promise<RollResult | null>;

  // Spells
  spells: CharacterSpell[];
  slotState: SpellSlotsUsed;
  maxSlots: MaxSlotsByLevel;
  slotResolution: SlotResolution;
  /** Slot level of separately resolved Pact Magic slots (null without pact magic). */
  pactSlotLevel: number | null;
  casterInfo: CasterInfo;
  concentration: ConcentrationState | null;
  addSpell: (payload: AddSpellPayload) => Promise<void>;
  updateSpell: (id: string, updates: SpellUpdate) => Promise<void>;
  removeSpell: (id: string) => Promise<void>;
  getCastingAbility: (spell: CharacterSpell) => CastingAbilityResolution;
  castSpell: (spell: CharacterSpell, choice: CastChoice) => Promise<CastOutcome>;
  setConcentration: (spell: Omit<ConcentrationState, "started_at"> | null) => Promise<void>;

  // Concentration lifecycle (T7)
  /** Damage-triggered CON save awaiting resolution; null when none pending. */
  pendingConcentrationCheck: PendingConcentrationCheck | null;
  /** Raise the concentration-check prompt for damage taken while concentrating. */
  requestConcentrationCheck: (damage: number) => void;
  /** Resolve the pending check: "drop" applies the atomic drop patch; "keep" just clears it. */
  resolveConcentrationCheck: (outcome: "keep" | "drop") => Promise<void>;
  /** Drop patch for the current state (concentrating_on: null + linked effects stripped). */
  concentrationDropPatch: Partial<CharacterState>;

  // Active effects
  activeEffects: ActiveEffect[];
  applyEffect: (entry: ActiveEffect) => Promise<boolean>;
  removeEffect: (id: string) => Promise<boolean>;
  addCustomEffect: (input: CustomEffectInput) => Promise<boolean>;

  // Primary color (sheet header theming)
  primaryColor: string | null;
  setPrimaryColor: (color: string | null) => void;
}

const CharacterContext = createContext<CharacterContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface CharacterProviderProps {
  character: CharacterWithSystem;
  schema: SystemSchemaDefinition;
  contentRefs: ContentRefWithContent[];
  /** True only when the server read every recorded ref and its exact pin. */
  contentSnapshotsComplete?: boolean;
  nativeManualHp?: boolean;
  initialState: CharacterState;
  initialInventory: InventoryItem[];
  initialSpells: CharacterSpell[];
  /** Server-fetched recent rolls (newest first). Optional: defaults to empty. */
  initialRolls?: RollLogEntry[];
  classData: ClassContentData;
  allEffects: Effect[];
  baseStatsWithLevel: Record<string, number>;
  structuredSources: StructuredSources;
  isOwner: boolean;
  isDm: boolean;
  hasSheet: boolean;
  maxHp: number;
  primaryColor: string | null;
  onPrimaryColorChange: (color: string | null) => void;
  children: ReactNode;
}

export function CharacterProvider({
  character,
  schema,
  contentRefs,
  contentSnapshotsComplete = false,
  nativeManualHp = false,
  initialState,
  initialInventory,
  initialSpells,
  initialRolls,
  classData,
  allEffects,
  baseStatsWithLevel,
  structuredSources,
  isOwner,
  isDm,
  hasSheet,
  maxHp,
  primaryColor,
  onPrimaryColorChange,
  children,
}: CharacterProviderProps) {
  // The parent row is selected with its native revision. Never infer it from
  // attached roles when a partial/legacy parent projection omits the column.
  const parentActionRevision = (character as CharacterWithSystem & { action_revision?: string | number }).action_revision;
  const [state, setState] = useState<CharacterState>(initialState);
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [portrait, setPortraitState] = useState<PortraitData>({
    url: character.narrative?.portrait_url as string | undefined,
    crop: (character.narrative?.portrait_crop as CropArea | undefined) ?? null,
  });

  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadRequired, setReloadRequired] = useState(false);
  const hpRead = useRef({ character, contentRefs, maxHp, schema, baseStatsWithLevel, initialInventory });
  const hpRefresh = useRef<{ parent: ReturnType<typeof manualHpParent>; state: CharacterState; revision: string } | null>(null);
  const [patchState] = useState(() =>
    createStateWriter(
      initialState,
      async (patch, expectedState, writeOptions) => {
        if (nativeManualHp && ("current_hp" in patch || "temp_hp" in patch)) {
          if (hpRefresh.current || !expectedState) throw new CharacterStateReloadError("Wait for the confirmed sheet to reload before another HP change.");
          const loaded = hpRead.current;
          const parent = manualHpParent(loaded.character, expectedState);
          const saved = await updateManualHpState(loaded.character.user_id, {
            character_id: loaded.character.id, expected_parent: parent, expected_max_hp: loaded.maxHp, patch,
          });
          if (saved.status === "applied") {
            hpRefresh.current = { parent, state: saved.state as CharacterState, revision: saved.revision };
            setReloadRequired(true);
          }
          return saved.state as CharacterState;
        }
        return writeOptions?.requireCurrent || "current_hp" in patch || "temp_hp" in patch
          ? updateCharacterState(character.id, patch, expectedState)
          : updateCharacterState(character.id, patch);
      },
      setState,
      (error) => {
        if (error instanceof CharacterStateReloadError) {
          setReloadRequired(true); setSaveError(error.message);
        } else setSaveError("A character change could not be saved. Check your connection and try that action again.");
      },
      { persistedState: character.state ?? {} },
    ),
  );
  // A complete server refresh replaces the settled writer baseline without
  // remounting children (in particular an open Journal draft). Never stamp old
  // class/content mechanics with a new revision or replace a pending write.
  useLayoutEffect(() => {
    if (!nativeManualHp || hpRead.current.character === character || patchState.hasPendingWrites()) return;
    try {
      const previous = hpRead.current, expected = hpRefresh.current;
      const fresh = manualHpParent(character, character.state ?? {});
      const old = manualHpParent(previous.character, previous.character.state ?? {});
      const sameRevision = fresh.action_revision === old.action_revision;
      const expectedParent = expected ? { ...expected.parent, state: expected.state, action_revision: expected.revision } : old;
      if (!contentSnapshotsComplete || maxHp !== previous.maxHp
        || canonicalHitDieJson(nativeHpContentBinding(contentRefs, character, fresh.action_revision))
          !== canonicalHitDieJson(nativeHpContentBinding(previous.contentRefs, previous.character, old.action_revision))
        || canonicalHitDieJson(schema) !== canonicalHitDieJson(previous.schema)
        || canonicalHitDieJson(baseStatsWithLevel) !== canonicalHitDieJson(previous.baseStatsWithLevel)
        || canonicalHitDieJson(initialInventory) !== canonicalHitDieJson(previous.initialInventory)
        || canonicalHitDieJson(fresh) !== canonicalHitDieJson(sameRevision ? old : expectedParent)
        || (!sameRevision && !expected)) throw new Error("Unconfirmed mechanical read");
      hpRead.current = { character, contentRefs, maxHp, schema, baseStatsWithLevel, initialInventory };
      if (!sameRevision) {
        patchState.acceptConfirmedRead(initialState, character.state ?? {});
        hpRefresh.current = null; setReloadRequired(false); setSaveError(null);
      }
    } catch {
      setReloadRequired(true); setSaveError("The refreshed mechanical inputs could not be confirmed. Reload before another action.");
    }
  }, [character, contentRefs, contentSnapshotsComplete, initialState, maxHp, schema, baseStatsWithLevel, initialInventory, nativeManualHp, patchState, state]);

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
      return patchState.runAction(state, () => ({ patch: { currency: newCurrency }, result: true }), { requireCurrent: true });
    },
    [patchState, state],
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

  // Derived: active effects (runtime buffs) from state
  const activeEffects = useMemo(
    () => (state.active_effects ?? []) as ActiveEffect[],
    [state.active_effects],
  );

  // Derived: Effect[] contributions of non-expired active effects.
  // Snapshotted at apply time, so this is a pure flatMap — no content fetch.
  const activeEffectEffects = useMemo(
    () => collectActiveEffects(activeEffects),
    [activeEffects],
  );

  const evaluationEffects = useMemo(() => [
    ...allEffects, ...equippedArmorEffects, ...activeEffectEffects,
  ], [allEffects, equippedArmorEffects, activeEffectEffects]);
  // Derived: evaluation result, retaining the same ordered bonus admission inputs.
  const evalResult = useMemo(() => {
    return evaluate(
      baseStatsWithLevel,
      evaluationEffects,
      schema,
      structuredSources,
      derivedState as Record<string, unknown>,
    );
  }, [
    baseStatsWithLevel,
    evaluationEffects,
    schema,
    structuredSources,
    derivedState,
  ]);
  const savingThrowBonus = useMemo(() => resolveSavingThrowBonus(evalResult, schema, evaluationEffects),
    [evalResult, schema, evaluationEffects]);

  const currency = (state.currency as Currency) ?? DEFAULT_CURRENCY;
  const [spells, setSpells] = useState<CharacterSpell[]>(initialSpells);
  const [pendingConcentrationCheck, setPendingConcentrationCheck] = useState<PendingConcentrationCheck | null>(null);
  const permanentResult = useMemo(() => evaluate(baseStatsWithLevel, allEffects, schema, structuredSources, state as Record<string, unknown>),
    [baseStatsWithLevel, allEffects, schema, structuredSources, state]);
  const mechanics = useMemo(() => resolveAbilityMechanics(baseStatsWithLevel, evalResult, schema, permanentResult), [baseStatsWithLevel, evalResult, schema, permanentResult]);
  const mechanicsSnapshot = useMemo(() => ({ character, contentRefs, contentSnapshotsComplete, schema, structuredSources, baseStatsWithLevel, allEffects,
    derivedState, inventory, mechanics, evalResult, evaluationEffects, savingThrowBonus, permanentResult, maxHp, isOwner, spells, pendingConcentrationCheck }),
  [character, contentRefs, contentSnapshotsComplete, schema, structuredSources, baseStatsWithLevel, allEffects, derivedState, inventory, mechanics, evalResult, evaluationEffects, savingThrowBonus, permanentResult, maxHp, isOwner, spells, pendingConcentrationCheck]);
  const committedMechanics = useRef(mechanicsSnapshot);
  useLayoutEffect(() => { committedMechanics.current = mechanicsSnapshot; }, [mechanicsSnapshot]);
  const assertMechanics = useCallback((requirement: MechanicsRequirement = {}) => {
    if (reloadRequired) throw new CharacterStateReloadError("Reload the confirmed character before another action.");
    patchState.assertActionReady(state);
    if (committedMechanics.current !== mechanicsSnapshot) throw new Error("Saved mechanical inputs changed. Use the current loaded controls before trying again.");
    if (!isOwner || !contentSnapshotsComplete) throw new Error("Complete owned saved mechanics are required for this action.");
    assertAbilityMechanics(mechanics, evalResult, schema, requirement);
    for (const ability of requirement.savingThrows ?? []) {
      const savingThrow = resolveSavingThrowModifier(getConfirmedAbilityModifier(evalResult, schema, ability),
        evalResult.computed.proficiency_bonus, evalResult.grants, `saving_throw_${ability}`, savingThrowBonus);
      if (savingThrow.status !== "available") throw new Error(savingThrow.reason);
    }
  }, [mechanicsSnapshot, isOwner, contentSnapshotsComplete, mechanics, evalResult, schema, patchState, state, savingThrowBonus, reloadRequired]);

  // --- Spells ---

  const castingSources = useMemo(() => resolveEffectiveCastingSources(
    character.choices?.classes ?? [], contentRefs, { id: character.id, system_id: character.system_id },
  ), [character.choices, character.id, character.system_id, contentRefs]);
  const slotResolution = castingSources.status === "available" ? castingSources.slots : castingSources;
  const addSourceSnapshot = useMemo(() => ({ castingSources, isOwner }), [castingSources, isOwner]);
  const currentAddSourceSnapshot = useRef(addSourceSnapshot);
  useLayoutEffect(() => { currentAddSourceSnapshot.current = addSourceSnapshot; }, [addSourceSnapshot]);
  const addSpell = useCallback(
    async (payload: AddSpellPayload) => {
      if (currentAddSourceSnapshot.current !== addSourceSnapshot) throw new Error("The casting source changed. Choose the current casting class before adding spells.");
      if (slotResolution.status !== "available") throw new Error(slotResolution.reason);
      if (!isOwner) throw new Error("This character is read-only. Only its owner can add spells.");
      if (castingSources.status !== "available" || !castingSources.sources.some(source => source.classSlug === payload.class_slug && source.active)) throw new Error("The selected casting source is unavailable. Reload or choose a current casting class before adding spells.");
      const newSpell = await addCharacterSpell(character.id, payload);
      if (newSpell) {
        setSpells((prev) => [...prev, newSpell]);
      }
    },
    [character.id, slotResolution, castingSources, isOwner, addSourceSnapshot],
  );

  const updateSpell = useCallback(
    async (id: string, updates: SpellUpdate) => {
      if (Object.hasOwn(updates, "is_prepared")) {
        const spell = spells.find(entry => entry.id === id);
        if (!spell) throw new Error("Saved spell is unavailable.");
        assertMechanics();
        const resolved = resolveCastingAbility(spell, { character: { id: character.id, system_id: character.system_id, choices: character.choices,
          level: character.level, action_revision: parentActionRevision }, contentSnapshotsComplete, spells, contentRefs,
          abilities: schema.ability_scores, abilityScores: evalResult.stats, proficiencyBonus: evalResult.computed.proficiency_bonus });
        if (resolved.status !== "available") throw new Error(resolved.reason);
        assertMechanics({ abilities: [resolved.profile.ability], computed: ["proficiency_bonus"] });
        const sources = resolveEffectiveCastingSources(character.choices.classes ?? [], contentRefs, { id: character.id, system_id: character.system_id });
        const source = sources.status === "available" ? sources.sources.find(entry => entry.classSlug === spell.class_slug) : null;
        const modifier = getConfirmedAbilityModifier(evalResult, schema, resolved.profile.ability);
        if (!source?.prepared || modifier === null) throw new Error("Saved preparation mechanics are unavailable.");
        const maximum = source.preparationRule === "parent" ? computeMaxPrepared(source.classSlug, source.classLevel, modifier)
          : Math.max(1, modifier + (source.preparationRule === "half-class-level-plus-ability" ? Math.floor(source.classLevel / 2) : source.classLevel));
        assertMechanics({ values: [maximum] });
      }
      await updateCharacterSpell(id, updates);
      setSpells((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    },
    [spells, assertMechanics, character, contentRefs, contentSnapshotsComplete, parentActionRevision, schema, evalResult],
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
      await patchState.runAction(state, (confirmed) => ({
        patch: !spell ? computeConcentrationDropPatch(confirmed) : {
          concentrating_on: { ...spell, started_at: new Date().toISOString() },
        },
        result: true,
      }), { requireCurrent: true });
    },
    [patchState, state],
  );

  // --- Concentration lifecycle (T7) ---
  // The damage path (HP tracker) raises a pending CON-save check; the
  // ConcentrationPrompt dialog resolves it. Drop resolution applies the same
  // atomic drop patch as every other concentration-ending path.

  const requestConcentrationCheck = useCallback((damage: number) => {
    if (damage <= 0) return;
    setPendingConcentrationCheck({ damage, dc: concentrationSaveDc(damage) });
  }, []);

  const resolveConcentrationCheck = useCallback(
    async (outcome: "keep" | "drop") => {
      if (outcome === "drop") {
        await patchState.runAction(state, (confirmed) => ({
          patch: computeConcentrationDropPatch(confirmed), result: true,
        }), { requireCurrent: true });
      }
      setPendingConcentrationCheck(current => current === pendingConcentrationCheck ? null : current);
    },
    [patchState, state, pendingConcentrationCheck],
  );

  const concentrationDropPatch = useMemo(
    () => computeConcentrationDropPatch(state),
    [state],
  );

  // --- Active-effect mutations (each is one atomic patchState) ---
  const applyEffect = useCallback(
    async (entry: ActiveEffect) => {
      return patchState.runAction(state, (confirmed) => ({ patch: applyActiveEffectPatch(confirmed, entry), result: true }), { requireCurrent: true });
    },
    [state, patchState],
  );

  const removeEffect = useCallback(
    async (id: string) => {
      return patchState.runAction(state, (confirmed) => ({ patch: removeActiveEffectPatch(confirmed, id), result: true }), { requireCurrent: true });
    },
    [state, patchState],
  );

  const addCustomEffect = useCallback(
    async (input: CustomEffectInput) => {
      return patchState.runAction(state, (confirmed) => ({
        patch: applyActiveEffectPatch(confirmed, buildCustomActiveEffect(input)), result: true,
      }), { requireCurrent: true });
    },
    [state, patchState],
  );

  // --- Derived caster info ---
  const casterInfo = useMemo<CasterInfo>(() => {
    const profBonus = evalResult.computed.proficiency_bonus;
    const abilityScores = (evalResult.stats ?? {}) as Record<string, number>;
    const classes: CasterClass[] = [];
    if (castingSources.status === "available") for (const source of castingSources.sources) {
      if (!source.active || !source.config) continue;
      const sc = source.config;
      const normalMath = resolveCastingMath(sc.ability, schema.ability_scores, abilityScores, profBonus);
      const modifier = getConfirmedAbilityModifier(evalResult, schema, sc.ability);
      const castingMath = mechanics.status !== "available" || modifier === null || normalMath.status !== "available" || !Number.isFinite(profBonus + modifier + 8)
        ? { status: "unavailable" as const, reason: "Saved casting mechanics are unavailable." }
        : { ...normalMath, abilityModifier: modifier, spellAttackBonus: profBonus + modifier, spellDc: 8 + profBonus + modifier };
      const maxPrepared = castingMath.status !== "available" ? null : !source.prepared ? 0 : source.preparationRule === "parent"
        ? computeMaxPrepared(source.classSlug, source.classLevel, castingMath.abilityModifier)
        : Math.max(1, castingMath.abilityModifier + (source.preparationRule === "half-class-level-plus-ability" ? Math.floor(source.classLevel / 2) : source.classLevel));
      classes.push({ slug: source.classSlug, level: source.classLevel, type: sc.type, ability: sc.ability,
        prepared: source.prepared, cantripsKnown: source.cantripsKnown, spellsKnown: source.spellsKnown, maxPrepared,
        ritualCasting: sc.ritual_casting ?? false, focus: sc.focus,
        spellList: source.spellList, maxLearnableLevel: source.maxLearnableLevel,
        castingMath, sourceKey: JSON.stringify(source),
      });
    }

    // Spell DC and attack: highest across classes
    const castingMathStatus = castingSources.status !== "available" || classes.some(c => c.castingMath?.status !== "available") ? "unavailable" : "available";
    const finiteProfiles = classes.flatMap(c => c.castingMath?.status === "available" ? [c.castingMath] : []);
    const spellDc = castingMathStatus === "unavailable" ? null : finiteProfiles.length ? Math.max(...finiteProfiles.map(math => math.spellDc)) : 0;
    const spellAttackBonus = castingMathStatus === "unavailable" ? null : finiteProfiles.length ? Math.max(...finiteProfiles.map(math => math.spellAttackBonus)) : 0;

    return {
      isCaster: classes.length > 0,
      classes,
      spellDc,
      spellAttackBonus,
      castingMathStatus,
    };
  }, [castingSources, evalResult, schema, mechanics]);

  // Compatibility aliases are usable only alongside the explicit resolution.
  const maxSlots = slotResolution.status === "available" ? slotResolution.maxSlots : {};
  const pactSlotLevel = slotResolution.status === "available" ? slotResolution.pactSlotLevel : null;

  const slotState = (state.spell_slots_used ?? {}) as SpellSlotsUsed;
  const concentration = (state.concentrating_on ?? null) as ConcentrationState | null;

  // Cast a spell: compute the full consequence (slot consumption +
  // concentration + active effects) as ONE atomic patch, apply it, and hand
  // back the roll requests the dialog's result pane offers (design §4.3).
  const castingInputs = useMemo(() => ({
    character: { id: character.id, system_id: character.system_id, choices: character.choices,
      level: character.level, action_revision: parentActionRevision }, contentSnapshotsComplete,
    spells, contentRefs, abilities: schema.ability_scores,
    abilityScores: evalResult.stats, proficiencyBonus: evalResult.computed.proficiency_bonus,
  }), [character.id, character.system_id, character.choices, character.level, parentActionRevision, contentSnapshotsComplete,
    spells, contentRefs, schema.ability_scores, evalResult.stats, evalResult.computed.proficiency_bonus]);
  // State may be unchanged while an acquisition, pin, evaluated ability or viewer
  // changes. Reject callbacks from a previous committed source as well as state.
  const castingSnapshot = useMemo(() => ({ inputs: castingInputs, isOwner, characterLevel: character.level }), [castingInputs, isOwner, character.level]);
  const currentCastingSnapshot = useRef(castingSnapshot);
  useLayoutEffect(() => { currentCastingSnapshot.current = castingSnapshot; }, [castingSnapshot]);
  const getCastingAbility = useCallback((target: CharacterSpell): CastingAbilityResolution => {
    if (mechanics.status !== "available") return { status: "unavailable", reason: mechanics.reason };
    const resolved = resolveCastingAbility(target, castingInputs);
    if (resolved.status !== "available") return resolved;
    const modifier = getConfirmedAbilityModifier(evalResult, schema, resolved.profile.ability);
    const proficiency = evalResult.computed.proficiency_bonus;
    if (modifier === null || !Number.isFinite(proficiency) || !Number.isFinite(modifier + proficiency)) return { status: "unavailable", reason: "Saved casting modifier is unavailable." };
    return { ...resolved, profile: { ...resolved.profile, abilityModifier: modifier, spellAttackBonus: modifier + proficiency, spellDc: 8 + modifier + proficiency } };
  }, [castingInputs, mechanics, evalResult, schema]);

  const castSpell = useCallback(
    async (spell: CharacterSpell, choice: CastChoice): Promise<CastOutcome> => {
      if (currentCastingSnapshot.current !== castingSnapshot) throw new Error("The saved casting source changed. Choose the spell again using its current loaded content before casting.");
      if (!isOwner) throw new Error("This character is read-only. Only its owner can cast spells.");
      assertMechanics();
      if (slotResolution.status !== "available") throw new Error(slotResolution.reason);
      const resolved = getCastingAbility(spell);
      if (resolved.status !== "available") throw new Error(resolved.reason);
      if (resolved.earnedRacial) throw new Error("Racial spell casting and once-per-long-rest use tracking are not available.");
      assertMechanics({ abilities: [resolved.profile.ability], computed: ["proficiency_bonus"] });
      const source = castSourceFromCharacterSpell(resolved.spell);
      if (!source) {
        throw new Error(`Spell "${spell.name}" has no castable content data.`);
      }
      return patchState.runAction(state, (confirmedState) => {
        assertMechanics({ abilities: [resolved.profile.ability], computed: ["proficiency_bonus"] });
        const outcome = computeCastEffects({
          spell: source,
          choice,
          state: confirmedState,
          castingProfile: resolved.profile,
          characterLevel: character.level,
        });
        return { patch: outcome.statePatch, result: outcome };
      }, { requireCurrent: true });
    },
    [state, isOwner, getCastingAbility, character.level, patchState, slotResolution, castingSnapshot, assertMechanics],
  );

  // --- Rolls ---
  // Newest first: hydrated history seeds the list; session rolls prepend.
  const [rolls, setRolls] = useState<RollLogEntry[]>(initialRolls ?? []);

  const recordRoll = useCallback(
    (request: RollRequest, requireConfirmation = false, requirement?: MechanicsRequirement) => {
      if (["check", "save", "attack", "initiative", "hit_die", "concentration"].includes(request.kind) && !requirement) throw new Error("This derived roll needs current saved mechanical inputs.");
      if (["save", "concentration"].includes(request.kind) && !requirement?.savingThrows?.length) throw new Error("This saving throw needs its current evaluated bonus inputs.");
      if (requirement) assertMechanics(requirement);
      // Active-effect roll modifiers (Bless +1d4, Bane -1d4…) are collected
      // by the roll SURFACES (RollPopover, ConcentrationPrompt) via
      // `collectRollModifiers` and arrive already baked into the request —
      // execution here stays a pure pass-through.
      const result = executeRoll(request);
      const entry: RollLogEntry = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `roll-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        character_id: character.id,
        user_id: character.user_id,
        kind: request.kind,
        label: request.label,
        expression: request.expression,
        result,
        total: result.total,
        rolled_at: result.rolled_at,
      };
      setRolls((prev) => [entry, ...prev]);
      const persistence = requireConfirmation
        ? insertRoll(character.id, result, { requireConfirmation: true })
        : insertRoll(character.id, result);
      return { result, persistence: Promise.resolve(persistence) };
    },
    [character.id, character.user_id, assertMechanics],
  );
  const roll = useCallback((request: RollRequest, requirement?: MechanicsRequirement): RollResult => {
    const tracked = recordRoll(request, false, requirement);
    void tracked.persistence.catch(err => console.error("Failed to persist roll:", err));
    return tracked.result;
  }, [recordRoll]);
  const trackedRollPending = useRef(false);
  const trackedRollUncertain = useRef(false);
  const [rollPersistencePending, setRollPersistencePending] = useState(false);
  const [rollPersistenceUncertain, setRollPersistenceUncertain] = useState(false);
  const rollWithPersistence = useCallback((request: RollRequest, requirement?: MechanicsRequirement) => {
    if (trackedRollUncertain.current) throw new CharacterStateReloadError("The death-save roll record could not be confirmed. Reload before rolling again.");
    if (trackedRollPending.current) throw new Error("A death-save roll record is still saving.");
    const tracked = recordRoll(request, true, requirement);
    trackedRollPending.current = true;
    setRollPersistencePending(true);
    const persistence = tracked.persistence.catch(error => {
      // Natural-20 HP can hide the death-save control before its insert settles.
      setReloadRequired(true);
      trackedRollUncertain.current = true;
      setRollPersistenceUncertain(true);
      throw error;
    }).finally(() => {
      trackedRollPending.current = false;
      setRollPersistencePending(false);
    });
    return { result: tracked.result, persistence };
  }, [recordRoll]);

  const resources = useMemo<FeatureResource[]>(() => {
    const classChoices = (character.choices?.classes ?? []).map((c) => ({
      slug: c.slug,
      level: c.level,
    }));
    return computeResources(contentRefs, classChoices, {
      systemId: character.system_id,
      systemSlug: character.game_systems?.slug ?? "",
      charismaModifier: mechanics.status === "available" ? getConfirmedAbilityModifier(evalResult, schema, "charisma") : null,
    });
  }, [contentRefs, character.choices?.classes, character.system_id, character.game_systems?.slug, mechanics, evalResult, schema]);

  // --- Hit dice ---
  // Pools are fully derived: max = class level, die = class content hit_die,
  // spent read (clamped) from state.hit_dice_spent.
  const hitDicePools = useMemo<HitDicePool[]>(() => {
    const classChoices = (character.choices?.classes ?? []).map((c) => ({
      slug: c.slug,
      level: c.level,
    }));
    return computeHitDicePools(classChoices, classData, state);
  }, [character.choices?.classes, classData, state]);

  // Spend one hit die: roll 1dX+CON through the shared pipeline (toast → log
  // → persist), then apply the spend + heal as ONE atomic patch. Gated on
  // dice remaining and HP not already full; returns null when it can't spend.
  const spendHitDie = useCallback(
    async (classSlug: string): Promise<RollResult | null> => {
      assertMechanics({ abilities: ["constitution"], values: [maxHp, state.current_hp!, state.temp_hp!] });
      const pool = hitDicePools.find((p) => p.classSlug === classSlug);
      if (!pool || pool.spent >= pool.max) return null;

      const currentHp = state.current_hp ?? maxHp;
      if (currentHp >= maxHp) return null;

      const conMod = getConfirmedAbilityModifier(evalResult, schema, "constitution")!;
      // Keep the existing R09 hit-die protocol and result schema unchanged.
      if (conMod !== Math.floor((evalResult.stats.constitution - 10) / 2)) throw new Error("The declared Constitution modifier is incompatible with the saved hit-die protocol.");

      return patchState.runAction(state, (confirmedState) => {
        // Refuse dependent work before rolling or logging a resource spend.
        assertMechanics({ abilities: ["constitution"], values: [maxHp, conMod] });
        const result = roll(buildHitDieRollRequest(pool, conMod), { abilities: ["constitution"], values: [maxHp, conMod] });
        return { patch: spendHitDiePatch(confirmedState, classSlug, result.total, maxHp), result };
      });
    },
    [hitDicePools, state, maxHp, evalResult, schema, roll, patchState, assertMechanics],
  );

  const value: CharacterContextValue = {
    mechanics,
    mechanicsToken: mechanicsSnapshot,
    assertMechanics,
    character,
    schema,
    contentRefs,
    contentSnapshotsComplete,
    isOwner,
    isDm,
    hasSheet,
    maxHp,
    state,
    reloadRequired,
    patchState,
    evalResult,
    savingThrowBonus,
    portrait,
    setPortrait,
    inventory,
    currency,
    addItem,
    updateItem,
    removeItem,
    setCurrency,
    resources,
    rolls,
    roll,
    rollWithPersistence,
    rollPersistencePending,
    rollPersistenceUncertain,
    hitDicePools,
    spendHitDie,
    spells,
    slotState,
    maxSlots,
    slotResolution,
    pactSlotLevel,
    casterInfo,
    concentration,
    addSpell,
    updateSpell,
    removeSpell,
    castSpell,
    getCastingAbility,
    setConcentration,
    pendingConcentrationCheck,
    requestConcentrationCheck,
    resolveConcentrationCheck,
    concentrationDropPatch,
    activeEffects,
    applyEffect,
    removeEffect,
    addCustomEffect,
    primaryColor,
    setPrimaryColor: onPrimaryColorChange,
  };

  return (
    <CharacterContext.Provider value={value}>
      {(saveError || rollPersistenceUncertain) && (
        <div role="alert" className="flex items-center justify-between gap-3 border-b border-destructive bg-background px-4 py-3 text-sm text-destructive">
          <div className="space-y-1">
            {saveError && <p>{saveError}</p>}
            {rollPersistenceUncertain && <p>The death-save roll record could not be confirmed. Reload and review the roll log before rolling again.</p>}
          </div>
          {reloadRequired ? (
            <button type="button" className="underline" disabled={patchState.hasPendingWrites() || rollPersistencePending} onClick={() => window.location.reload()}>Reload character</button>
          ) : (
            <button type="button" className="underline" onClick={() => setSaveError(null)}>Dismiss</button>
          )}
        </div>
      )}
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
    contentSnapshotsComplete: ctx.contentSnapshotsComplete,
    isOwner: ctx.isOwner,
    isDm: ctx.isDm,
    hasSheet: ctx.hasSheet,
    evalResult: ctx.evalResult,
    savingThrowBonus: ctx.savingThrowBonus,
    mechanics: ctx.mechanics,
    mechanicsToken: ctx.mechanicsToken,
    assertMechanics: ctx.assertMechanics,
    maxHp: ctx.maxHp,
    primaryColor: ctx.primaryColor,
    setPrimaryColor: ctx.setPrimaryColor,
  };
}

export function useCharacterState() {
  const ctx = useCharacterContext();
  return {
    state: ctx.state,
    reloadRequired: ctx.reloadRequired,
    patchState: ctx.patchState,
    // Explicit state-only UI patches are derived from this render. Refuse a
    // stale or pending render before saving against the separate raw baseline.
    patchConditionalState: (patch: Partial<CharacterState>) =>
      ctx.patchState.runAction(ctx.state, () => ({ patch, result: true }), { requireCurrent: true }),
    // Relative HP callers computed their patch from this render. Keep raw
    // absolute edits on patchState; only this action path requires settled state.
    patchActionState: (patch: Partial<CharacterState>) =>
      ctx.patchState.runAction(ctx.state, () => {
        ctx.assertMechanics({ abilities: ["constitution"], values: [ctx.maxHp, ctx.state.current_hp!, ctx.state.temp_hp!] });
        return { patch, result: true };
      }),
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
    slotResolution: ctx.slotResolution,
    pactSlotLevel: ctx.pactSlotLevel,
    casterInfo: ctx.casterInfo,
    concentration: ctx.concentration,
    addSpell: ctx.addSpell,
    updateSpell: ctx.updateSpell,
    removeSpell: ctx.removeSpell,
    castSpell: ctx.castSpell,
    getCastingAbility: ctx.getCastingAbility,
    setConcentration: ctx.setConcentration,
  };
}

/**
 * Concentration lifecycle (M3 T7): what the character is concentrating on,
 * the pending damage-triggered CON-save check, and its resolution paths.
 * `dropPatch` is the current atomic drop patch — the HP tracker merges it
 * into the damage patch when damage reduces HP to 0 (RAW auto-drop).
 */
export function useConcentration(): {
  concentration: ConcentrationState | null;
  pendingCheck: PendingConcentrationCheck | null;
  requestCheck: (damage: number) => void;
  resolveCheck: (outcome: "keep" | "drop") => Promise<void>;
  dropPatch: Partial<CharacterState>;
} {
  const ctx = useCharacterContext();
  return {
    concentration: ctx.concentration,
    pendingCheck: ctx.pendingConcentrationCheck,
    requestCheck: ctx.requestConcentrationCheck,
    resolveCheck: ctx.resolveConcentrationCheck,
    dropPatch: ctx.concentrationDropPatch,
  };
}

/**
 * Access the character's active effects (runtime buffs/debuffs with durations):
 * read, apply, remove (concentration-aware), and add custom entries.
 */
export function useActiveEffects(): {
  activeEffects: ActiveEffect[];
  applyEffect: (entry: ActiveEffect) => Promise<boolean>;
  removeEffect: (id: string) => Promise<boolean>;
  addCustomEffect: (input: CustomEffectInput) => Promise<boolean>;
} {
  const ctx = useCharacterContext();
  return {
    activeEffects: ctx.activeEffects,
    applyEffect: ctx.applyEffect,
    removeEffect: ctx.removeEffect,
    addCustomEffect: ctx.addCustomEffect,
  };
}

export function usePortrait() {
  const ctx = useCharacterContext();
  return {
    portrait: ctx.portrait,
    setPortrait: ctx.setPortrait,
  };
}

/**
 * Roll dice for this character: execute → append to the session log →
 * fire-and-forget persist. The full toast → log → persist pipeline runs for
 * any `roll(request)` call; the RollResult returns synchronously.
 */
export function useRolls(): {
  /** Hydrated + session rolls, newest first. */
  rolls: RollLogEntry[];
  roll: (request: RollRequest, requirement?: MechanicsRequirement) => RollResult;
  rollWithPersistence: (request: RollRequest, requirement?: MechanicsRequirement) => { result: RollResult; persistence: Promise<void> };
  assertMechanics: (requirement?: MechanicsRequirement) => void;
  mechanics: AbilityMechanics;
  mechanicsToken: object;
  rollPersistencePending: boolean;
  rollPersistenceUncertain: boolean;
} {
  const ctx = useCharacterContext();
  return {
    rolls: ctx.rolls,
    assertMechanics: ctx.assertMechanics,
    mechanics: ctx.mechanics,
    mechanicsToken: ctx.mechanicsToken,
    roll: ctx.roll,
    rollWithPersistence: ctx.rollWithPersistence,
    rollPersistencePending: ctx.rollPersistencePending,
    rollPersistenceUncertain: ctx.rollPersistenceUncertain,
  };
}

/** Access feature usage counters. Every mutation starts from a settled render
 * and conditionally saves the whole nested map against the raw baseline. */
export function useResources(): {
  resources: FeatureResource[];
  uses: Record<string, number>;
  spend: (slug: string, amount?: number) => Promise<boolean>;
  restore: (slug: string, amount?: number) => Promise<boolean>;
  setUsed: (slug: string, newUsed: number) => Promise<boolean>;
} {
  const { resources, state, patchState } = useCharacterContext();
  const uses = (state.feature_uses ?? {}) as Record<string, number>;
  const changeUsed = (slug: string, compute: (current: number) => number) =>
    patchState.runAction(state, (confirmed) => {
      const confirmedUses = confirmed.feature_uses ?? {};
      const current = confirmedUses[slug] ?? 0;
      const resource = resources.find((r) => r.slug === slug);
      const value = compute(current);
      if (!Number.isFinite(value)) throw new Error("Resource usage must be a finite number.");
      const next = Math.max(0, resource ? Math.min(resource.max, value) : value);
      return {
        patch: next === current ? {} : { feature_uses: { ...confirmedUses, [slug]: next } },
        result: true,
      };
    }, { requireCurrent: true });

  const setUsed = (slug: string, newUsed: number) => changeUsed(slug, () => newUsed);
  const spend = (slug: string, amount = 1) => changeUsed(slug, (current) => current + amount);
  const restore = (slug: string, amount = 1) => changeUsed(slug, (current) => current - amount);
  return { resources, uses, spend, restore, setUsed };
}

/** Orchestrate short and long rests: compute effects, apply atomic state patch.
 *  Also owns hit dice — pools are a rest-time resource: spend-to-heal during a
 *  short rest, ⌊total/2⌋ (min 1, largest die first) recovery on a long rest —
 *  and Arcane Recovery: valid slot picks fold into the short-rest patch so the
 *  executed rest stays ONE `patchState` write. */
export function useRest(): {
  exhaustion: number;
  /** Execute a short rest. Optional Arcane Recovery picks (slot level →
   *  count) are validated and folded into the same atomic patch; invalid or
   *  unavailable picks are ignored with a console warning. */
  shortRest: (arcaneRecoveryPicks?: ArcaneRecoveryPicks) => Promise<boolean>;
  longRest: () => Promise<boolean>;
  setExhaustion: (level: number) => Promise<boolean>;
  canShortRest: boolean;
  canLongRest: boolean;
  /** Per-class hit-dice pools (max = class level, die from class content). */
  hitDicePools: HitDicePool[];
  /** Roll 1dX+CON and apply spend + heal in one atomic patch. Resolves null
   *  when the pool is empty or HP is already full. */
  spendHitDie: (classSlug: string) => Promise<RollResult | null>;
  /** Arcane Recovery availability + budget + recoverable slot levels for the
   *  short-rest pane (design §4.6 / D8). */
  arcaneRecovery: ArcaneRecoveryInfo;
  slotResolution: SlotResolution;
} {
  const ctx = useCharacterContext();
  const {
    state,
    resources,
    maxHp,
    patchState,
    hitDicePools,
    spendHitDie,
    character,
    contentRefs,
    maxSlots,
    slotResolution,
  } = ctx;
  const exhaustion = (state.exhaustion as number | undefined) ?? 0;

  const shortEffects = computeShortRestEffects(state, resources);
  const longEffects = ctx.mechanics.status === "available" && Number.isSafeInteger(maxHp) && maxHp > 0
    ? computeLongRestEffects(state, maxHp, resources, hitDicePools) : { canApply: false, statePatch: {} };

  const arcaneRecovery = slotResolution.status !== "available"
    ? { available: false, budget: 0, recoverableSlots: {} }
    : computeArcaneRecoveryInfo({
    wizardLevel: arcaneRecoveryClassLevel(
      character.choices?.classes ?? [],
      contentRefs,
    ),
    resources,
    state,
    maxSlots,
  });

  const shortRest = (arcaneRecoveryPicks?: ArcaneRecoveryPicks) => {
    if (slotResolution.status !== "available") return Promise.resolve(false);
    return patchState.runAction(state, (confirmed) => {
      // Gate first, then validate and compute from the settled display state.
      // Persistence compares the separate raw snapshot, without display defaults.
      const effects = computeShortRestEffects(confirmed, resources);
      const recovery = computeArcaneRecoveryInfo({
        wizardLevel: arcaneRecoveryClassLevel(character.choices?.classes ?? [], contentRefs),
        resources, state: confirmed, maxSlots,
      });
      let picks: ArcaneRecoveryPicks | null = null;
      if (arcaneRecoveryPicks && totalPickedLevels(arcaneRecoveryPicks) > 0) {
        if (!recovery.available) {
          console.warn("[arcane-recovery] Ignoring picks - Arcane Recovery is not available.");
        } else {
          const check = validateArcaneRecoveryPicks(
            arcaneRecoveryPicks, recovery.budget, maxSlots,
            (confirmed.spell_slots_used ?? {}) as SpellSlotsUsed,
          );
          if (check.valid) picks = arcaneRecoveryPicks;
          else console.warn(`[arcane-recovery] Ignoring invalid picks: ${check.reason}`);
        }
      }
      if (!effects.canApply && !picks) return { patch: {}, result: false };
      return {
        patch: picks ? mergeShortRestWithRecovery(confirmed, effects.statePatch, picks) : effects.statePatch,
        result: true,
      };
    }, { requireCurrent: true }).catch((error: unknown) => {
      // Dialogs must distinguish a reload boundary from a safe explicit retry.
      if (error instanceof CharacterStateReloadError) throw error;
      return false;
    });
  };

  const longRest = () => {
    if (slotResolution.status !== "available" || !longEffects.canApply) return Promise.resolve(false);
    return patchState.runAction(state, () => {
      ctx.assertMechanics({ abilities: ["constitution"], values: [maxHp, state.current_hp!, state.temp_hp!, ...resources.map(entry => entry.max), ...hitDicePools.flatMap(pool => [pool.max, pool.spent, pool.die])] });
      return { patch: longEffects.statePatch, result: true };
    }).catch((error: unknown) => {
      if (error instanceof CharacterStateReloadError) throw error;
      return false;
    });
  };

  const setExhaustion = (level: number) => {
    return patchState.runAction(state, () => {
      if (!Number.isFinite(level)) throw new Error("Exhaustion must be a finite number.");
      return { patch: { exhaustion: Math.max(0, Math.min(6, Math.floor(level))) }, result: true };
    }, { requireCurrent: true });
  };

  return {
    exhaustion,
    shortRest,
    longRest,
    setExhaustion,
    canShortRest: slotResolution.status === "available" && shortEffects.canApply,
    canLongRest: slotResolution.status === "available" && longEffects.canApply,
    hitDicePools,
    spendHitDie,
    arcaneRecovery,
    slotResolution,
  };
}
