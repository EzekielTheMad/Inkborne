// --- Condition System ---
// Used for: entry_conditions, progression triggers, prerequisites

export type ConditionOp = "gte" | "lte" | "gt" | "lt" | "eq" | "neq";

export interface StatCondition {
  stat: string;
  op: ConditionOp;
  value: number;
}

// --- Effect Types ---

export type EffectOp = "add" | "set" | "multiply" | "grant" | "max" | "min";

export interface MechanicalEffect {
  type: "mechanical";
  stat: string;
  op: EffectOp | "formula";
  value?: number | string;
  expr?: string; // Tier 2 formula expression
}

export interface NarrativeEffect {
  type: "narrative";
  text: string;
  tag?: string;
}

export interface GrantEffect {
  type: "grant";
  stat: string;
  value: string; // e.g., "proficient", "expertise", feature name
}

export type Effect = MechanicalEffect | NarrativeEffect | GrantEffect;

// --- Progression ---

export interface ProgressionTriggerAuto {
  type: "auto";
  conditions: StatCondition[];
}

export interface ProgressionTriggerManual {
  type: "manual";
  dm_only?: boolean;
}

export type ProgressionTrigger = ProgressionTriggerAuto | ProgressionTriggerManual;

export interface ProgressionTier {
  name: string;
  description: string;
  trigger: ProgressionTrigger;
  effects: Effect[];
}

export interface ProgressionTrack {
  tiers: ProgressionTier[];
}

// --- Effect Priority (evaluation order) ---

export const EFFECT_OP_PRIORITY: Record<string, number> = {
  set: 0,
  add: 1,
  min: 2,
  max: 3,
  multiply: 4,
  grant: 5,
  formula: 6,
};
