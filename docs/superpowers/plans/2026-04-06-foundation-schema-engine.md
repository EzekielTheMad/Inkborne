# Foundation & System Schema Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the Inkborne project scaffold, authentication, database schema (10 tables with RLS), expression engine (Tier 1 + 2), and D&D 5e 2024 system schema definition.

**Architecture:** Next.js 15 App Router with Supabase backend. Game system definitions stored as structured JSONB. Expression engine is a pure TypeScript module that evaluates effects against base stats to produce derived values. All content scoping enforced by Postgres RLS.

**Tech Stack:** Next.js 15, TypeScript (strict), Tailwind CSS v4, shadcn/ui, Supabase (Postgres + Auth + RLS), Zod, Vitest

**Spec:** `docs/superpowers/specs/2026-04-06-foundation-schema-engine-design.md`

---

## File Map

### Types & Validation
- `lib/types/effects.ts` — Effect type definitions (mechanical, narrative, grant), conditions, progression tiers
- `lib/types/system.ts` — Game system schema types (ability scores, skills, resources, content types, etc.)
- `lib/types/content.ts` — Content definition, content version, custom content type types
- `lib/types/character.ts` — Character type (structural columns only for this sub-project)
- `lib/schemas/effects.ts` — Zod schemas for effects and conditions
- `lib/schemas/system.ts` — Zod schema for game system schema_definition
- `lib/schemas/content.ts` — Zod schemas for content definitions and custom content types
- `lib/schemas/character.ts` — Zod schema for character data

### Expression Engine
- `lib/engine/effects.ts` — Effect collection, sorting by priority, grouping by stat
- `lib/engine/parser.ts` — Safe expression parser (arithmetic, stat refs, built-in functions)
- `lib/engine/evaluator.ts` — Full evaluation pipeline: base stats → collect → sort → evaluate → result
- `lib/engine/sandbox.ts` — Tier 3 script sandbox (stub for this sub-project)

### Database
- `supabase/migrations/00001_profiles.sql` — profiles table + trigger
- `supabase/migrations/00002_game_systems.sql` — game_systems table
- `supabase/migrations/00003_content.sql` — content_definitions + content_versions
- `supabase/migrations/00004_campaigns.sql` — campaigns + campaign_members + characters
- `supabase/migrations/00005_homebrew_sharing.sql` — custom_content_types + content_shares + content_type_shares
- `supabase/migrations/00006_rls_policies.sql` — All RLS policies
- `supabase/seed.sql` — D&D 5e 2024 system schema seed

### Supabase Helpers
- `lib/supabase/client.ts` — Browser Supabase client
- `lib/supabase/server.ts` — Server-side Supabase client (cookies-based)
- `lib/supabase/middleware.ts` — Auth session refresh middleware

### App
- `app/layout.tsx` — Root layout with fonts and metadata
- `app/page.tsx` — Landing page
- `app/(auth)/login/page.tsx` — Login page
- `app/(auth)/signup/page.tsx` — Signup page
- `app/(auth)/auth/callback/route.ts` — OAuth callback handler
- `app/(app)/layout.tsx` — Authenticated layout shell
- `app/(app)/dashboard/page.tsx` — Dashboard page

### Tests
- `tests/engine/effects.test.ts` — Effect collection and sorting tests
- `tests/engine/parser.test.ts` — Expression parser tests
- `tests/engine/evaluator.test.ts` — Full pipeline evaluation tests
- `tests/schemas/effects.test.ts` — Effect schema validation tests
- `tests/schemas/system.test.ts` — System schema validation tests

### Config
- `middleware.ts` — Next.js middleware (auth session refresh)
- `vitest.config.ts` — Vitest configuration
- `.env.local.example` — Environment variable template

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `vitest.config.ts`, `.env.local.example`, `.gitignore`

- [ ] **Step 1: Create Next.js project**

```bash
cd C:/Projects/Inkborne
npx create-next-app@latest . --typescript --tailwind --eslint --app --src=no --import-alias "@/*" --use-npm
```

Select: Yes to all defaults. This creates the Next.js 15 project with App Router, TypeScript, Tailwind, and ESLint.

- [ ] **Step 2: Install core dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr zod
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

Select: New York style, Zinc base color, CSS variables: yes.

- [ ] **Step 4: Add commonly needed shadcn components**

```bash
npx shadcn@latest add button input label card tabs separator avatar dropdown-menu
```

- [ ] **Step 5: Create Vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 6: Add test script to package.json**

Add to `scripts` in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Create environment variable template**

Create `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

- [ ] **Step 8: Update .gitignore**

Append to `.gitignore`:

```
.env.local
.superpowers/
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 project with Tailwind, shadcn/ui, Supabase, Vitest"
```

---

## Task 2: TypeScript Types — Effects & Conditions

**Files:**
- Create: `lib/types/effects.ts`
- Test: `tests/schemas/effects.test.ts` (later in Task 5)

- [ ] **Step 1: Create effect types**

Create `lib/types/effects.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/types/effects.ts
git commit -m "feat: add TypeScript types for effects, conditions, and progression"
```

---

## Task 3: TypeScript Types — System Schema, Content, Character

**Files:**
- Create: `lib/types/system.ts`, `lib/types/content.ts`, `lib/types/character.ts`

- [ ] **Step 1: Create system schema types**

Create `lib/types/system.ts`:

```typescript
export interface AbilityScoreDefinition {
  slug: string;
  name: string;
  abbr: string;
}

export interface ProficiencyLevel {
  slug: string;
  name: string;
  multiplier: number;
}

export interface DerivedStatDefinition {
  slug: string;
  name: string;
  formula?: string;
  base?: number;
  note?: string;
}

export interface SkillDefinition {
  slug: string;
  name: string;
  ability: string; // slug of ability score
}

export interface ResourceDefinition {
  slug: string;
  name: string;
  type: "current_max_temp" | "pool" | "slots_by_level" | "success_fail";
  per?: string;
  levels?: number[];
  max_each?: number;
}

export interface ContentTypeDefinition {
  slug: string;
  name: string;
  plural?: string;
  required?: boolean;
  max?: number | null;
  parent?: string;
}

export interface CurrencyDefinition {
  slug: string;
  name: string;
  rate: number;
}

export interface CreationStep {
  step: number;
  type: string;
  label: string;
  methods?: string[];
  fields?: string[];
}

export interface SheetSection {
  slug: string;
  label: string;
  contains?: string[];
  tab?: boolean;
  extension_zone?: boolean;
}

export interface SystemSchemaDefinition {
  ability_scores: AbilityScoreDefinition[];
  proficiency_levels: ProficiencyLevel[];
  derived_stats: DerivedStatDefinition[];
  skills: SkillDefinition[];
  resources: ResourceDefinition[];
  content_types: ContentTypeDefinition[];
  currencies: CurrencyDefinition[];
  creation_steps: CreationStep[];
  sheet_sections: SheetSection[];
}

export interface GameSystem {
  id: string;
  slug: string;
  name: string;
  version_label: string;
  schema_definition: SystemSchemaDefinition;
  expression_context: Record<string, unknown>;
  status: "draft" | "published";
  created_at: string;
}
```

- [ ] **Step 2: Create content types**

Create `lib/types/content.ts`:

```typescript
import type { Effect, StatCondition } from "./effects";

export type ContentScope = "platform" | "personal" | "shared";
export type ContentSource = "srd" | "homebrew";

export interface ContentDefinition {
  id: string;
  system_id: string;
  content_type: string;
  slug: string;
  name: string;
  data: Record<string, unknown>;
  effects: Effect[];
  source: ContentSource;
  scope: ContentScope;
  owner_id: string | null;
  version: number;
  created_at: string;
}

export interface ContentVersion {
  id: string;
  content_id: string;
  version: number;
  data_snapshot: Record<string, unknown>;
  effects_snapshot: Effect[];
  changelog: string;
  created_at: string;
}

export interface CustomContentType {
  id: string;
  system_id: string;
  owner_id: string;
  slug: string;
  name: string;
  description: string;
  allow_multiple: boolean;
  entry_conditions: StatCondition[];
  has_progression: boolean;
  scope: "personal" | "shared";
  version: number;
}

export interface ContentShare {
  id: string;
  content_id: string;
  campaign_id: string;
  shared_by: string;
  shared_at: string;
}

export interface ContentTypeShare {
  id: string;
  content_type_id: string;
  campaign_id: string;
  shared_by: string;
  shared_at: string;
}
```

- [ ] **Step 3: Create character types**

Create `lib/types/character.ts`:

```typescript
export type CharacterVisibility = "private" | "campaign" | "public";

export interface Character {
  id: string;
  user_id: string;
  system_id: string;
  campaign_id: string | null;
  name: string;
  visibility: CharacterVisibility;
  archived: boolean;
  created_at: string;
}

export type CampaignMemberRole = "dm" | "player";

export interface Campaign {
  id: string;
  system_id: string;
  owner_id: string;
  name: string;
  description: string;
  invite_code: string;
  created_at: string;
}

export interface CampaignMember {
  id: string;
  campaign_id: string;
  user_id: string;
  role: CampaignMemberRole;
  joined_at: string;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/types/
git commit -m "feat: add TypeScript types for system schema, content, characters, and profiles"
```

---

## Task 4: Zod Validation Schemas

**Files:**
- Create: `lib/schemas/effects.ts`, `lib/schemas/system.ts`, `lib/schemas/content.ts`, `lib/schemas/character.ts`
- Test: `tests/schemas/effects.test.ts`, `tests/schemas/system.test.ts`

- [ ] **Step 1: Write failing test for effect schema validation**

Create `tests/schemas/effects.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  mechanicalEffectSchema,
  narrativeEffectSchema,
  grantEffectSchema,
  effectSchema,
  statConditionSchema,
  progressionTierSchema,
} from "@/lib/schemas/effects";

describe("Effect Schemas", () => {
  describe("mechanicalEffectSchema", () => {
    it("validates a static add effect", () => {
      const result = mechanicalEffectSchema.safeParse({
        type: "mechanical",
        stat: "dexterity",
        op: "add",
        value: 2,
      });
      expect(result.success).toBe(true);
    });

    it("validates a formula effect", () => {
      const result = mechanicalEffectSchema.safeParse({
        type: "mechanical",
        stat: "armor_class",
        op: "formula",
        expr: "10 + mod(dexterity)",
      });
      expect(result.success).toBe(true);
    });

    it("rejects effect with missing stat", () => {
      const result = mechanicalEffectSchema.safeParse({
        type: "mechanical",
        op: "add",
        value: 2,
      });
      expect(result.success).toBe(false);
    });

    it("rejects formula effect without expr", () => {
      const result = mechanicalEffectSchema.safeParse({
        type: "mechanical",
        stat: "armor_class",
        op: "formula",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("narrativeEffectSchema", () => {
    it("validates a narrative effect", () => {
      const result = narrativeEffectSchema.safeParse({
        type: "narrative",
        text: "50% discount at org HQ",
        tag: "Organization Perk",
      });
      expect(result.success).toBe(true);
    });

    it("validates without optional tag", () => {
      const result = narrativeEffectSchema.safeParse({
        type: "narrative",
        text: "Can sleep in a crow's nest",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("grantEffectSchema", () => {
    it("validates a grant effect", () => {
      const result = grantEffectSchema.safeParse({
        type: "grant",
        stat: "perception",
        value: "proficient",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("effectSchema (union)", () => {
    it("discriminates mechanical effects", () => {
      const result = effectSchema.safeParse({
        type: "mechanical",
        stat: "strength",
        op: "add",
        value: 1,
      });
      expect(result.success).toBe(true);
    });

    it("discriminates narrative effects", () => {
      const result = effectSchema.safeParse({
        type: "narrative",
        text: "Access to safehouses",
      });
      expect(result.success).toBe(true);
    });

    it("rejects unknown type", () => {
      const result = effectSchema.safeParse({
        type: "unknown",
        stat: "strength",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("statConditionSchema", () => {
    it("validates a condition", () => {
      const result = statConditionSchema.safeParse({
        stat: "level",
        op: "gte",
        value: 4,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid op", () => {
      const result = statConditionSchema.safeParse({
        stat: "level",
        op: "between",
        value: 4,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("progressionTierSchema", () => {
    it("validates an auto trigger tier", () => {
      const result = progressionTierSchema.safeParse({
        name: "Expert Rigger",
        description: "Years of climbing...",
        trigger: {
          type: "auto",
          conditions: [{ stat: "level", op: "gte", value: 4 }],
        },
        effects: [
          { type: "mechanical", stat: "climbing_speed", op: "add", value: 10 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("validates a manual trigger tier with narrative effect", () => {
      const result = progressionTierSchema.safeParse({
        name: "Enforcer",
        description: "You enforce the org's will",
        trigger: { type: "manual" },
        effects: [
          { type: "mechanical", stat: "intimidation", op: "add", value: 1 },
          { type: "narrative", text: "Access to org safehouses" },
        ],
      });
      expect(result.success).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/schemas/effects.test.ts
```

Expected: FAIL — cannot find module `@/lib/schemas/effects`

- [ ] **Step 3: Implement effect schemas**

Create `lib/schemas/effects.ts`:

```typescript
import { z } from "zod";

const conditionOpSchema = z.enum(["gte", "lte", "gt", "lt", "eq", "neq"]);

export const statConditionSchema = z.object({
  stat: z.string().min(1),
  op: conditionOpSchema,
  value: z.number(),
});

const effectOpSchema = z.enum(["add", "set", "multiply", "grant", "max", "min"]);

export const mechanicalEffectSchema = z
  .object({
    type: z.literal("mechanical"),
    stat: z.string().min(1),
    op: z.union([effectOpSchema, z.literal("formula")]),
    value: z.union([z.number(), z.string()]).optional(),
    expr: z.string().optional(),
  })
  .refine(
    (e) => {
      if (e.op === "formula") return typeof e.expr === "string" && e.expr.length > 0;
      return e.value !== undefined;
    },
    { message: "Formula effects require 'expr'; other effects require 'value'" }
  );

export const narrativeEffectSchema = z.object({
  type: z.literal("narrative"),
  text: z.string().min(1),
  tag: z.string().optional(),
});

export const grantEffectSchema = z.object({
  type: z.literal("grant"),
  stat: z.string().min(1),
  value: z.string().min(1),
});

export const effectSchema = z.discriminatedUnion("type", [
  mechanicalEffectSchema.innerType(),
  narrativeEffectSchema,
  grantEffectSchema,
]);

const progressionTriggerAutoSchema = z.object({
  type: z.literal("auto"),
  conditions: z.array(statConditionSchema).min(1),
});

const progressionTriggerManualSchema = z.object({
  type: z.literal("manual"),
  dm_only: z.boolean().optional(),
});

const progressionTriggerSchema = z.discriminatedUnion("type", [
  progressionTriggerAutoSchema,
  progressionTriggerManualSchema,
]);

export const progressionTierSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  trigger: progressionTriggerSchema,
  effects: z.array(effectSchema),
});

export const progressionTrackSchema = z.object({
  tiers: z.array(progressionTierSchema).min(1),
});
```

**Note:** The `mechanicalEffectSchema` uses `.refine()` for cross-field validation. Since `discriminatedUnion` needs the base object (not the refined version), we use `.innerType()` to get the pre-refinement schema for the union, and apply the refinement separately when validating mechanical effects directly. If this causes issues with the discriminated union, an alternative approach is to split into two separate schemas (static mechanical and formula mechanical) and use a plain `z.union` instead.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/schemas/effects.test.ts
```

Expected: All tests PASS. If the `.innerType()` approach fails, replace the `effectSchema` with:

```typescript
export const effectSchema = z.union([
  mechanicalEffectSchema,
  narrativeEffectSchema,
  grantEffectSchema,
]);
```

And update the discriminator logic manually via a `.refine()` or `z.preprocess`.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/effects.ts tests/schemas/effects.test.ts
git commit -m "feat: add Zod schemas for effects, conditions, and progression tiers"
```

- [ ] **Step 6: Write failing test for system schema validation**

Create `tests/schemas/system.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { systemSchemaDefinitionSchema } from "@/lib/schemas/system";

const MINIMAL_VALID_SCHEMA = {
  ability_scores: [{ slug: "strength", name: "Strength", abbr: "STR" }],
  proficiency_levels: [
    { slug: "none", name: "Not Proficient", multiplier: 0 },
    { slug: "proficient", name: "Proficient", multiplier: 1 },
  ],
  derived_stats: [
    { slug: "armor_class", name: "Armor Class", formula: "10 + mod(dexterity)" },
  ],
  skills: [{ slug: "athletics", name: "Athletics", ability: "strength" }],
  resources: [{ slug: "hit_points", name: "Hit Points", type: "current_max_temp" }],
  content_types: [{ slug: "species", name: "Species", required: true, max: 1 }],
  currencies: [{ slug: "gp", name: "Gold", rate: 100 }],
  creation_steps: [{ step: 1, type: "species", label: "Choose Species" }],
  sheet_sections: [{ slug: "header", label: "Character Header" }],
};

describe("System Schema Definition", () => {
  it("validates a minimal valid schema", () => {
    const result = systemSchemaDefinitionSchema.safeParse(MINIMAL_VALID_SCHEMA);
    expect(result.success).toBe(true);
  });

  it("rejects schema missing ability_scores", () => {
    const { ability_scores, ...rest } = MINIMAL_VALID_SCHEMA;
    const result = systemSchemaDefinitionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("validates derived stat with base instead of formula", () => {
    const schema = {
      ...MINIMAL_VALID_SCHEMA,
      derived_stats: [{ slug: "movement_speed", name: "Speed", base: 30 }],
    };
    const result = systemSchemaDefinitionSchema.safeParse(schema);
    expect(result.success).toBe(true);
  });

  it("validates sheet section with extension_zone", () => {
    const schema = {
      ...MINIMAL_VALID_SCHEMA,
      sheet_sections: [
        { slug: "features", label: "Features & Traits", tab: true, extension_zone: true },
      ],
    };
    const result = systemSchemaDefinitionSchema.safeParse(schema);
    expect(result.success).toBe(true);
  });

  it("validates content type with parent reference", () => {
    const schema = {
      ...MINIMAL_VALID_SCHEMA,
      content_types: [
        { slug: "class", name: "Class", required: true, max: null },
        { slug: "subclass", name: "Subclass", parent: "class" },
      ],
    };
    const result = systemSchemaDefinitionSchema.safeParse(schema);
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

```bash
npx vitest run tests/schemas/system.test.ts
```

Expected: FAIL — cannot find module `@/lib/schemas/system`

- [ ] **Step 8: Implement system schema**

Create `lib/schemas/system.ts`:

```typescript
import { z } from "zod";

const abilityScoreDefSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  abbr: z.string().min(1).max(5),
});

const proficiencyLevelSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  multiplier: z.number(),
});

const derivedStatDefSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  formula: z.string().optional(),
  base: z.number().optional(),
  note: z.string().optional(),
});

const skillDefSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  ability: z.string().min(1),
});

const resourceDefSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["current_max_temp", "pool", "slots_by_level", "success_fail"]),
  per: z.string().optional(),
  levels: z.array(z.number()).optional(),
  max_each: z.number().optional(),
});

const contentTypeDefSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  plural: z.string().optional(),
  required: z.boolean().optional(),
  max: z.number().nullable().optional(),
  parent: z.string().optional(),
});

const currencyDefSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  rate: z.number().positive(),
});

const creationStepSchema = z.object({
  step: z.number().int().positive(),
  type: z.string().min(1),
  label: z.string().min(1),
  methods: z.array(z.string()).optional(),
  fields: z.array(z.string()).optional(),
});

const sheetSectionSchema = z.object({
  slug: z.string().min(1),
  label: z.string().min(1),
  contains: z.array(z.string()).optional(),
  tab: z.boolean().optional(),
  extension_zone: z.boolean().optional(),
});

export const systemSchemaDefinitionSchema = z.object({
  ability_scores: z.array(abilityScoreDefSchema).min(1),
  proficiency_levels: z.array(proficiencyLevelSchema).min(1),
  derived_stats: z.array(derivedStatDefSchema),
  skills: z.array(skillDefSchema),
  resources: z.array(resourceDefSchema),
  content_types: z.array(contentTypeDefSchema).min(1),
  currencies: z.array(currencyDefSchema),
  creation_steps: z.array(creationStepSchema).min(1),
  sheet_sections: z.array(sheetSectionSchema).min(1),
});
```

- [ ] **Step 9: Run tests to verify they pass**

```bash
npx vitest run tests/schemas/system.test.ts
```

Expected: All tests PASS

- [ ] **Step 10: Create content and character schemas**

Create `lib/schemas/content.ts`:

```typescript
import { z } from "zod";
import { effectSchema, statConditionSchema } from "./effects";

export const contentDefinitionSchema = z.object({
  system_id: z.string().uuid(),
  content_type: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  data: z.record(z.unknown()),
  effects: z.array(effectSchema).default([]),
  source: z.enum(["srd", "homebrew"]),
  scope: z.enum(["platform", "personal", "shared"]),
  owner_id: z.string().uuid().nullable(),
  version: z.number().int().positive().default(1),
});

export const customContentTypeSchema = z.object({
  system_id: z.string().uuid(),
  owner_id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  allow_multiple: z.boolean().default(false),
  entry_conditions: z.array(statConditionSchema).default([]),
  has_progression: z.boolean().default(false),
  scope: z.enum(["personal", "shared"]),
  version: z.number().int().positive().default(1),
});
```

Create `lib/schemas/character.ts`:

```typescript
import { z } from "zod";

export const characterSchema = z.object({
  user_id: z.string().uuid(),
  system_id: z.string().uuid(),
  campaign_id: z.string().uuid().nullable().default(null),
  name: z.string().min(1),
  visibility: z.enum(["private", "campaign", "public"]).default("private"),
  archived: z.boolean().default(false),
});
```

- [ ] **Step 11: Commit**

```bash
git add lib/schemas/ tests/schemas/
git commit -m "feat: add Zod validation schemas for system definitions, content, and characters"
```

---

## Task 5: Expression Engine — Effect Collection & Sorting

**Files:**
- Create: `lib/engine/effects.ts`
- Test: `tests/engine/effects.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/engine/effects.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { collectEffects, sortEffectsByPriority } from "@/lib/engine/effects";
import type { Effect, MechanicalEffect } from "@/lib/types/effects";

describe("collectEffects", () => {
  it("flattens effects from multiple content entries", () => {
    const contentEffects: Effect[][] = [
      [{ type: "mechanical", stat: "strength", op: "add", value: 2 }],
      [
        { type: "mechanical", stat: "dexterity", op: "add", value: 1 },
        { type: "narrative", text: "Darkvision 60ft" },
      ],
    ];
    const result = collectEffects(contentEffects);
    expect(result).toHaveLength(3);
  });

  it("returns empty array for no content", () => {
    const result = collectEffects([]);
    expect(result).toEqual([]);
  });
});

describe("sortEffectsByPriority", () => {
  it("sorts set before add before multiply before formula", () => {
    const effects: MechanicalEffect[] = [
      { type: "mechanical", stat: "armor_class", op: "formula", expr: "10 + mod(dexterity)" },
      { type: "mechanical", stat: "strength", op: "add", value: 2 },
      { type: "mechanical", stat: "armor_class", op: "set", value: 10 },
      { type: "mechanical", stat: "strength", op: "multiply", value: 1.5 },
    ];
    const sorted = sortEffectsByPriority(effects);
    expect(sorted[0].op).toBe("set");
    expect(sorted[1].op).toBe("add");
    expect(sorted[2].op).toBe("multiply");
    expect(sorted[3].op).toBe("formula");
  });

  it("preserves order for same priority", () => {
    const effects: MechanicalEffect[] = [
      { type: "mechanical", stat: "strength", op: "add", value: 2 },
      { type: "mechanical", stat: "dexterity", op: "add", value: 1 },
    ];
    const sorted = sortEffectsByPriority(effects);
    expect(sorted[0].stat).toBe("strength");
    expect(sorted[1].stat).toBe("dexterity");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/engine/effects.test.ts
```

Expected: FAIL — cannot find module `@/lib/engine/effects`

- [ ] **Step 3: Implement effects module**

Create `lib/engine/effects.ts`:

```typescript
import type { Effect, MechanicalEffect } from "@/lib/types/effects";
import { EFFECT_OP_PRIORITY } from "@/lib/types/effects";

export function collectEffects(contentEffects: Effect[][]): Effect[] {
  return contentEffects.flat();
}

export function sortEffectsByPriority(
  effects: MechanicalEffect[]
): MechanicalEffect[] {
  return [...effects].sort((a, b) => {
    const aPriority = EFFECT_OP_PRIORITY[a.op] ?? 99;
    const bPriority = EFFECT_OP_PRIORITY[b.op] ?? 99;
    return aPriority - bPriority;
  });
}

export function groupEffectsByStat(
  effects: MechanicalEffect[]
): Map<string, MechanicalEffect[]> {
  const grouped = new Map<string, MechanicalEffect[]>();
  for (const effect of effects) {
    const existing = grouped.get(effect.stat) ?? [];
    existing.push(effect);
    grouped.set(effect.stat, existing);
  }
  return grouped;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/engine/effects.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/effects.ts tests/engine/effects.test.ts
git commit -m "feat: add effect collection, sorting, and grouping"
```

---

## Task 6: Expression Engine — Parser

**Files:**
- Create: `lib/engine/parser.ts`
- Test: `tests/engine/parser.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/engine/parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseExpression } from "@/lib/engine/parser";

describe("parseExpression", () => {
  const stats: Record<string, number> = {
    strength: 16,
    dexterity: 14,
    constitution: 12,
    wisdom: 10,
    level: 5,
    proficiency_bonus: 3,
  };

  const builtins = {
    mod: (score: number) => Math.floor((score - 10) / 2),
    proficiency_if: (skill: string) =>
      skill === "perception" ? stats.proficiency_bonus : 0,
  };

  it("evaluates simple arithmetic", () => {
    expect(parseExpression("10 + 2", stats, builtins)).toBe(12);
  });

  it("evaluates stat references", () => {
    expect(parseExpression("strength", stats, builtins)).toBe(16);
  });

  it("evaluates mod() function", () => {
    // mod(16) = floor((16-10)/2) = 3
    expect(parseExpression("mod(strength)", stats, builtins)).toBe(3);
  });

  it("evaluates complex formula: AC", () => {
    // 10 + mod(14) = 10 + 2 = 12
    expect(parseExpression("10 + mod(dexterity)", stats, builtins)).toBe(12);
  });

  it("evaluates proficiency bonus formula", () => {
    // floor((5-1)/4) + 2 = floor(1) + 2 = 3
    expect(parseExpression("floor((level - 1) / 4) + 2", stats, builtins)).toBe(3);
  });

  it("evaluates nested functions", () => {
    // 10 + mod(wisdom=10) + proficiency_if(perception) = 10 + 0 + 3 = 13
    expect(
      parseExpression("10 + mod(wisdom) + proficiency_if('perception')", stats, builtins)
    ).toBe(13);
  });

  it("evaluates multiplication and parentheses", () => {
    // mod(12) * 5 = 1 * 5 = 5
    expect(parseExpression("mod(constitution) * level", stats, builtins)).toBe(5);
  });

  it("throws on invalid expression", () => {
    expect(() => parseExpression("DROP TABLE users", stats, builtins)).toThrow();
  });

  it("throws on unknown stat reference", () => {
    expect(() => parseExpression("charisma + 1", stats, builtins)).toThrow();
  });

  it("evaluates floor() built-in", () => {
    expect(parseExpression("floor(7 / 2)", stats, builtins)).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/engine/parser.test.ts
```

Expected: FAIL — cannot find module `@/lib/engine/parser`

- [ ] **Step 3: Implement expression parser**

Create `lib/engine/parser.ts`:

```typescript
type BuiltinFn = (...args: unknown[]) => number;
type BuiltinMap = Record<string, BuiltinFn>;

interface Token {
  type: "number" | "ident" | "op" | "paren" | "string" | "comma";
  value: string;
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    if (/\s/.test(expr[i])) {
      i++;
      continue;
    }
    if (/[0-9]/.test(expr[i]) || (expr[i] === "." && /[0-9]/.test(expr[i + 1]))) {
      let num = "";
      while (i < expr.length && (/[0-9]/.test(expr[i]) || expr[i] === ".")) {
        num += expr[i++];
      }
      tokens.push({ type: "number", value: num });
      continue;
    }
    if (/[a-zA-Z_]/.test(expr[i])) {
      let ident = "";
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        ident += expr[i++];
      }
      tokens.push({ type: "ident", value: ident });
      continue;
    }
    if ("+-*/".includes(expr[i])) {
      tokens.push({ type: "op", value: expr[i++] });
      continue;
    }
    if ("()".includes(expr[i])) {
      tokens.push({ type: "paren", value: expr[i++] });
      continue;
    }
    if (expr[i] === ",") {
      tokens.push({ type: "comma", value: expr[i++] });
      continue;
    }
    if (expr[i] === "'" || expr[i] === '"') {
      const quote = expr[i++];
      let str = "";
      while (i < expr.length && expr[i] !== quote) {
        str += expr[i++];
      }
      i++; // skip closing quote
      tokens.push({ type: "string", value: str });
      continue;
    }
    throw new Error(`Unexpected character: ${expr[i]} at position ${i}`);
  }
  return tokens;
}

class Parser {
  private tokens: Token[];
  private pos: number;
  private stats: Record<string, number>;
  private builtins: BuiltinMap;

  constructor(tokens: Token[], stats: Record<string, number>, builtins: BuiltinMap) {
    this.tokens = tokens;
    this.pos = 0;
    this.stats = stats;
    this.builtins = builtins;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  parse(): number {
    const result = this.parseAddSub();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token: ${this.tokens[this.pos].value}`);
    }
    return result;
  }

  private parseAddSub(): number {
    let left = this.parseMulDiv();
    while (this.peek()?.type === "op" && (this.peek()!.value === "+" || this.peek()!.value === "-")) {
      const op = this.consume().value;
      const right = this.parseMulDiv();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  private parseMulDiv(): number {
    let left = this.parseUnary();
    while (this.peek()?.type === "op" && (this.peek()!.value === "*" || this.peek()!.value === "/")) {
      const op = this.consume().value;
      const right = this.parseUnary();
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }

  private parseUnary(): number {
    if (this.peek()?.type === "op" && this.peek()!.value === "-") {
      this.consume();
      return -this.parsePrimary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const token = this.peek();
    if (!token) throw new Error("Unexpected end of expression");

    if (token.type === "number") {
      this.consume();
      return parseFloat(token.value);
    }

    if (token.type === "paren" && token.value === "(") {
      this.consume();
      const result = this.parseAddSub();
      const close = this.consume();
      if (!close || close.value !== ")") throw new Error("Missing closing parenthesis");
      return result;
    }

    if (token.type === "ident") {
      this.consume();
      const name = token.value;

      // Check if it's a function call
      if (this.peek()?.type === "paren" && this.peek()!.value === "(") {
        this.consume(); // consume '('
        const args: unknown[] = [];
        while (this.peek() && !(this.peek()!.type === "paren" && this.peek()!.value === ")")) {
          if (this.peek()?.type === "comma") {
            this.consume();
            continue;
          }
          if (this.peek()?.type === "string") {
            args.push(this.consume().value);
          } else {
            args.push(this.parseAddSub());
          }
        }
        const close = this.consume();
        if (!close || close.value !== ")") throw new Error("Missing closing parenthesis");

        // Check built-in functions first
        if (name in this.builtins) {
          return this.builtins[name](...args);
        }
        // Math built-ins
        if (name === "floor") return Math.floor(args[0] as number);
        if (name === "ceil") return Math.ceil(args[0] as number);
        if (name === "max") return Math.max(...(args as number[]));
        if (name === "min") return Math.min(...(args as number[]));

        throw new Error(`Unknown function: ${name}`);
      }

      // It's a stat reference
      if (name in this.stats) {
        return this.stats[name];
      }

      throw new Error(`Unknown stat: ${name}`);
    }

    throw new Error(`Unexpected token: ${token.value}`);
  }
}

export function parseExpression(
  expr: string,
  stats: Record<string, number>,
  builtins: BuiltinMap = {}
): number {
  const tokens = tokenize(expr);
  if (tokens.length === 0) throw new Error("Empty expression");
  const parser = new Parser(tokens, stats, builtins);
  return parser.parse();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/engine/parser.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/engine/parser.ts tests/engine/parser.test.ts
git commit -m "feat: add safe expression parser with stat refs and built-in functions"
```

---

## Task 7: Expression Engine — Evaluator Pipeline

**Files:**
- Create: `lib/engine/evaluator.ts`
- Test: `tests/engine/evaluator.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/engine/evaluator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { evaluate } from "@/lib/engine/evaluator";
import type { Effect } from "@/lib/types/effects";
import type { SystemSchemaDefinition } from "@/lib/types/system";

const MINIMAL_SCHEMA: SystemSchemaDefinition = {
  ability_scores: [
    { slug: "strength", name: "Strength", abbr: "STR" },
    { slug: "dexterity", name: "Dexterity", abbr: "DEX" },
    { slug: "constitution", name: "Constitution", abbr: "CON" },
    { slug: "wisdom", name: "Wisdom", abbr: "WIS" },
  ],
  proficiency_levels: [
    { slug: "none", name: "Not Proficient", multiplier: 0 },
    { slug: "proficient", name: "Proficient", multiplier: 1 },
  ],
  derived_stats: [
    { slug: "proficiency_bonus", name: "Proficiency Bonus", formula: "floor((level - 1) / 4) + 2" },
    { slug: "armor_class", name: "Armor Class", formula: "10 + mod(dexterity)" },
    { slug: "initiative", name: "Initiative", formula: "mod(dexterity)" },
    { slug: "movement_speed", name: "Speed", base: 30 },
  ],
  skills: [{ slug: "athletics", name: "Athletics", ability: "strength" }],
  resources: [],
  content_types: [],
  currencies: [],
  creation_steps: [{ step: 1, type: "species", label: "Choose Species" }],
  sheet_sections: [{ slug: "header", label: "Header" }],
};

describe("evaluate", () => {
  it("computes derived stats from base stats", () => {
    const baseStats = { strength: 16, dexterity: 14, constitution: 12, wisdom: 10, level: 5 };
    const effects: Effect[] = [];

    const result = evaluate(baseStats, effects, MINIMAL_SCHEMA);

    expect(result.computed.proficiency_bonus).toBe(3); // floor((5-1)/4)+2
    expect(result.computed.armor_class).toBe(12); // 10 + mod(14)
    expect(result.computed.initiative).toBe(2); // mod(14)
    expect(result.computed.movement_speed).toBe(30); // base
  });

  it("applies static add effects", () => {
    const baseStats = { strength: 16, dexterity: 14, constitution: 12, wisdom: 10, level: 5 };
    const effects: Effect[] = [
      { type: "mechanical", stat: "dexterity", op: "add", value: 2 },
    ];

    const result = evaluate(baseStats, effects, MINIMAL_SCHEMA);

    // dexterity is now 16, so mod = 3
    expect(result.computed.armor_class).toBe(13); // 10 + mod(16)
    expect(result.computed.initiative).toBe(3); // mod(16)
  });

  it("applies set before add", () => {
    const baseStats = { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, level: 1 };
    const effects: Effect[] = [
      { type: "mechanical", stat: "strength", op: "add", value: 2 },
      { type: "mechanical", stat: "strength", op: "set", value: 15 },
    ];

    const result = evaluate(baseStats, effects, MINIMAL_SCHEMA);

    // set(15) then add(2) = 17
    expect(result.stats.strength).toBe(17);
  });

  it("applies movement speed bonus", () => {
    const baseStats = { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, level: 1 };
    const effects: Effect[] = [
      { type: "mechanical", stat: "movement_speed", op: "add", value: 10 },
    ];

    const result = evaluate(baseStats, effects, MINIMAL_SCHEMA);

    expect(result.computed.movement_speed).toBe(40); // 30 base + 10
  });

  it("collects narrative effects without modifying stats", () => {
    const baseStats = { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, level: 1 };
    const effects: Effect[] = [
      { type: "narrative", text: "50% discount at org HQ", tag: "Perk" },
      { type: "mechanical", stat: "strength", op: "add", value: 1 },
    ];

    const result = evaluate(baseStats, effects, MINIMAL_SCHEMA);

    expect(result.narratives).toHaveLength(1);
    expect(result.narratives[0].text).toBe("50% discount at org HQ");
    expect(result.stats.strength).toBe(11);
  });

  it("collects grant effects", () => {
    const baseStats = { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, level: 1 };
    const effects: Effect[] = [
      { type: "grant", stat: "athletics", value: "proficient" },
    ];

    const result = evaluate(baseStats, effects, MINIMAL_SCHEMA);

    expect(result.grants).toHaveLength(1);
    expect(result.grants[0].stat).toBe("athletics");
    expect(result.grants[0].value).toBe("proficient");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/engine/evaluator.test.ts
```

Expected: FAIL — cannot find module `@/lib/engine/evaluator`

- [ ] **Step 3: Implement evaluator**

Create `lib/engine/evaluator.ts`:

```typescript
import type { Effect, MechanicalEffect, NarrativeEffect, GrantEffect } from "@/lib/types/effects";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import { sortEffectsByPriority } from "./effects";
import { parseExpression } from "./parser";

export interface EvaluationResult {
  /** Base stats with static effects applied (set, add, multiply, min, max) */
  stats: Record<string, number>;
  /** Derived stats computed from formulas in the system schema */
  computed: Record<string, number>;
  /** Narrative effects to display on the character sheet */
  narratives: NarrativeEffect[];
  /** Grant effects (proficiencies, features) */
  grants: GrantEffect[];
}

export function evaluate(
  baseStats: Record<string, number>,
  effects: Effect[],
  schema: SystemSchemaDefinition
): EvaluationResult {
  // Separate effects by type
  const mechanical: MechanicalEffect[] = [];
  const narratives: NarrativeEffect[] = [];
  const grants: GrantEffect[] = [];

  for (const effect of effects) {
    switch (effect.type) {
      case "mechanical":
        mechanical.push(effect);
        break;
      case "narrative":
        narratives.push(effect);
        break;
      case "grant":
        grants.push(effect);
        break;
    }
  }

  // Sort mechanical effects by priority and split out formulas
  const staticEffects = mechanical.filter((e) => e.op !== "formula");
  const formulaEffects = mechanical.filter((e) => e.op === "formula");
  const sortedStatic = sortEffectsByPriority(staticEffects);

  // Apply static effects to base stats
  const stats = { ...baseStats };

  for (const effect of sortedStatic) {
    const current = stats[effect.stat] ?? 0;
    switch (effect.op) {
      case "set":
        stats[effect.stat] = effect.value as number;
        break;
      case "add":
        stats[effect.stat] = current + (effect.value as number);
        break;
      case "multiply":
        stats[effect.stat] = current * (effect.value as number);
        break;
      case "max":
        stats[effect.stat] = Math.max(current, effect.value as number);
        break;
      case "min":
        stats[effect.stat] = Math.min(current, effect.value as number);
        break;
    }
  }

  // Build built-in functions for expression evaluation
  const builtins = {
    mod: (score: number) => Math.floor((score - 10) / 2),
    proficiency_if: (skill: string) => {
      const hasProf = grants.some(
        (g) => g.stat === skill && g.value === "proficient"
      );
      return hasProf ? (stats.proficiency_bonus ?? computed.proficiency_bonus ?? 0) : 0;
    },
  };

  // Compute derived stats from schema formulas
  const computed: Record<string, number> = {};

  // We need to evaluate in order, since some derived stats depend on others
  // First pass: evaluate all derived stats using base + static-modified stats
  const evalContext = { ...stats };

  for (const derived of schema.derived_stats) {
    if (derived.formula) {
      try {
        computed[derived.slug] = parseExpression(derived.formula, evalContext, builtins);
        evalContext[derived.slug] = computed[derived.slug];
      } catch {
        computed[derived.slug] = 0;
      }
    } else if (derived.base !== undefined) {
      computed[derived.slug] = derived.base;
      evalContext[derived.slug] = computed[derived.slug];
    }
  }

  // Apply static effects that target derived stats
  for (const effect of sortedStatic) {
    if (effect.stat in computed) {
      const current = computed[effect.stat];
      switch (effect.op) {
        case "set":
          computed[effect.stat] = effect.value as number;
          break;
        case "add":
          computed[effect.stat] = current + (effect.value as number);
          break;
        case "multiply":
          computed[effect.stat] = current * (effect.value as number);
          break;
        case "max":
          computed[effect.stat] = Math.max(current, effect.value as number);
          break;
        case "min":
          computed[effect.stat] = Math.min(current, effect.value as number);
          break;
      }
    }
  }

  // Apply formula effects (Tier 2)
  for (const effect of formulaEffects) {
    try {
      const fullContext = { ...stats, ...computed };
      computed[effect.stat] = parseExpression(effect.expr!, fullContext, builtins);
    } catch {
      // Formula evaluation failed — leave existing value
    }
  }

  return { stats, computed, narratives, grants };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/engine/evaluator.test.ts
```

Expected: All tests PASS. The `proficiency_if` builtin reference to `computed` before it's defined will need a small fix — use a getter or lazy evaluation. If it fails, update `builtins` to be defined after the `computed` object, or make `proficiency_if` look up from the `evalContext` directly:

```typescript
proficiency_if: (skill: string) => {
  const hasProf = grants.some((g) => g.stat === skill && g.value === "proficient");
  return hasProf ? (evalContext.proficiency_bonus ?? 0) : 0;
},
```

- [ ] **Step 5: Commit**

```bash
git add lib/engine/evaluator.ts tests/engine/evaluator.test.ts
git commit -m "feat: add expression evaluation pipeline with Tier 1 + 2 support"
```

---

## Task 8: Expression Engine — Sandbox Stub

**Files:**
- Create: `lib/engine/sandbox.ts`

- [ ] **Step 1: Create Tier 3 sandbox stub**

Create `lib/engine/sandbox.ts`:

```typescript
/**
 * Tier 3: Script Sandbox (Stub)
 *
 * This module will provide sandboxed JavaScript execution for complex
 * conditional effects (e.g., Barbarian Unarmored Defense).
 *
 * For this sub-project, Tier 3 is stubbed. The evaluator skips script
 * effects. Full implementation comes in a later sub-project.
 */

export interface SandboxResult {
  modifications: Record<string, number>;
}

export function executeScript(
  _script: string,
  _characterContext: Record<string, unknown>
): SandboxResult {
  // Stub — returns no modifications
  return { modifications: {} };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/engine/sandbox.ts
git commit -m "feat: stub Tier 3 script sandbox for future implementation"
```

---

## Task 9: Supabase Setup & Database Migrations

**Files:**
- Create: `supabase/config.toml`, all migration files

- [ ] **Step 1: Initialize Supabase**

```bash
npx supabase init
```

This creates `supabase/config.toml` and the migrations directory.

- [ ] **Step 2: Create migration — profiles**

Create `supabase/migrations/00001_profiles.sql`:

```sql
-- Profiles table (linked to auth.users via trigger)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 3: Create migration — game_systems**

Create `supabase/migrations/00002_game_systems.sql`:

```sql
create table public.game_systems (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  version_label text not null default '',
  schema_definition jsonb not null default '{}',
  expression_context jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);

alter table public.game_systems enable row level security;
```

- [ ] **Step 4: Create migration — content**

Create `supabase/migrations/00003_content.sql`:

```sql
create table public.content_definitions (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.game_systems(id) on delete cascade,
  content_type text not null,
  slug text not null,
  name text not null,
  data jsonb not null default '{}',
  effects jsonb not null default '[]',
  source text not null default 'homebrew' check (source in ('srd', 'homebrew')),
  scope text not null default 'personal' check (scope in ('platform', 'personal', 'shared')),
  owner_id uuid references public.profiles(id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  unique(system_id, content_type, slug, owner_id)
);

alter table public.content_definitions enable row level security;

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_definitions(id) on delete cascade,
  version integer not null,
  data_snapshot jsonb not null,
  effects_snapshot jsonb not null default '[]',
  changelog text not null default '',
  created_at timestamptz not null default now(),
  unique(content_id, version)
);

alter table public.content_versions enable row level security;
```

- [ ] **Step 5: Create migration — campaigns & characters**

Create `supabase/migrations/00004_campaigns.sql`:

```sql
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.game_systems(id),
  owner_id uuid not null references public.profiles(id),
  name text not null,
  description text not null default '',
  invite_code text unique not null default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);

alter table public.campaigns enable row level security;

create table public.campaign_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'player' check (role in ('dm', 'player')),
  joined_at timestamptz not null default now(),
  unique(campaign_id, user_id)
);

alter table public.campaign_members enable row level security;

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  system_id uuid not null references public.game_systems(id),
  campaign_id uuid references public.campaigns(id) on delete set null,
  name text not null,
  visibility text not null default 'private' check (visibility in ('private', 'campaign', 'public')),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.characters enable row level security;
```

- [ ] **Step 6: Create migration — homebrew sharing**

Create `supabase/migrations/00005_homebrew_sharing.sql`:

```sql
create table public.custom_content_types (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.game_systems(id),
  owner_id uuid not null references public.profiles(id),
  slug text not null,
  name text not null,
  description text not null default '',
  allow_multiple boolean not null default false,
  entry_conditions jsonb not null default '[]',
  has_progression boolean not null default false,
  scope text not null default 'personal' check (scope in ('personal', 'shared')),
  version integer not null default 1,
  unique(system_id, slug, owner_id)
);

alter table public.custom_content_types enable row level security;

create table public.content_shares (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_definitions(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  shared_by uuid not null references public.profiles(id),
  shared_at timestamptz not null default now(),
  unique(content_id, campaign_id)
);

alter table public.content_shares enable row level security;

create table public.content_type_shares (
  id uuid primary key default gen_random_uuid(),
  content_type_id uuid not null references public.custom_content_types(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  shared_by uuid not null references public.profiles(id),
  shared_at timestamptz not null default now(),
  unique(content_type_id, campaign_id)
);

alter table public.content_type_shares enable row level security;
```

- [ ] **Step 7: Commit**

```bash
git add supabase/
git commit -m "feat: add database migrations for all 10 foundation tables"
```

---

## Task 10: RLS Policies

**Files:**
- Create: `supabase/migrations/00006_rls_policies.sql`

- [ ] **Step 1: Create RLS policies migration**

Create `supabase/migrations/00006_rls_policies.sql`:

```sql
-- ============================================================
-- PROFILES
-- ============================================================
create policy "Users can view any profile"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid());

-- ============================================================
-- GAME SYSTEMS
-- ============================================================
create policy "Published systems visible to all"
  on public.game_systems for select
  to authenticated
  using (status = 'published');

-- ============================================================
-- CONTENT DEFINITIONS
-- ============================================================
create policy "Platform content visible to all"
  on public.content_definitions for select
  to authenticated
  using (scope = 'platform');

create policy "Personal content visible to owner"
  on public.content_definitions for select
  to authenticated
  using (scope = 'personal' and owner_id = auth.uid());

create policy "Shared content visible to owner and campaign members"
  on public.content_definitions for select
  to authenticated
  using (
    scope = 'shared' and (
      owner_id = auth.uid()
      or id in (
        select cs.content_id from public.content_shares cs
        join public.campaign_members cm on cm.campaign_id = cs.campaign_id
        where cm.user_id = auth.uid()
      )
    )
  );

create policy "Owner can insert content"
  on public.content_definitions for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owner can update content"
  on public.content_definitions for update
  to authenticated
  using (owner_id = auth.uid());

create policy "Owner can delete content"
  on public.content_definitions for delete
  to authenticated
  using (owner_id = auth.uid());

-- ============================================================
-- CONTENT VERSIONS
-- ============================================================
create policy "Content versions follow parent visibility"
  on public.content_versions for select
  to authenticated
  using (
    content_id in (
      select id from public.content_definitions
    )
  );

-- ============================================================
-- CAMPAIGNS
-- ============================================================
create policy "Campaign visible to members"
  on public.campaigns for select
  to authenticated
  using (
    id in (
      select campaign_id from public.campaign_members
      where user_id = auth.uid()
    )
  );

create policy "Owner can create campaigns"
  on public.campaigns for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owner can update campaigns"
  on public.campaigns for update
  to authenticated
  using (owner_id = auth.uid());

-- ============================================================
-- CAMPAIGN MEMBERS
-- ============================================================
create policy "Members can view campaign membership"
  on public.campaign_members for select
  to authenticated
  using (
    campaign_id in (
      select campaign_id from public.campaign_members
      where user_id = auth.uid()
    )
  );

create policy "Campaign owner can manage members"
  on public.campaign_members for insert
  to authenticated
  with check (
    campaign_id in (
      select id from public.campaigns where owner_id = auth.uid()
    )
    or user_id = auth.uid()
  );

create policy "Members can remove themselves"
  on public.campaign_members for delete
  to authenticated
  using (
    user_id = auth.uid()
    or campaign_id in (
      select id from public.campaigns where owner_id = auth.uid()
    )
  );

-- ============================================================
-- CHARACTERS
-- ============================================================
create policy "Owner can view own characters"
  on public.characters for select
  to authenticated
  using (user_id = auth.uid());

create policy "Public characters visible to all"
  on public.characters for select
  to authenticated
  using (visibility = 'public' and archived = false);

create policy "Campaign characters visible to campaign members"
  on public.characters for select
  to authenticated
  using (
    visibility = 'campaign'
    and archived = false
    and campaign_id in (
      select campaign_id from public.campaign_members
      where user_id = auth.uid()
    )
  );

create policy "Private characters visible to campaign DM"
  on public.characters for select
  to authenticated
  using (
    visibility = 'private'
    and campaign_id in (
      select cm.campaign_id from public.campaign_members cm
      join public.campaigns c on c.id = cm.campaign_id
      where c.owner_id = auth.uid()
    )
  );

create policy "Owner can insert characters"
  on public.characters for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Owner can update characters"
  on public.characters for update
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- CUSTOM CONTENT TYPES
-- ============================================================
create policy "Personal custom types visible to owner"
  on public.custom_content_types for select
  to authenticated
  using (scope = 'personal' and owner_id = auth.uid());

create policy "Shared custom types visible to owner and campaign members"
  on public.custom_content_types for select
  to authenticated
  using (
    scope = 'shared' and (
      owner_id = auth.uid()
      or id in (
        select cts.content_type_id from public.content_type_shares cts
        join public.campaign_members cm on cm.campaign_id = cts.campaign_id
        where cm.user_id = auth.uid()
      )
    )
  );

create policy "Owner can insert custom types"
  on public.custom_content_types for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owner can update custom types"
  on public.custom_content_types for update
  to authenticated
  using (owner_id = auth.uid());

-- ============================================================
-- CONTENT SHARES
-- ============================================================
create policy "Shares visible to campaign members"
  on public.content_shares for select
  to authenticated
  using (
    campaign_id in (
      select campaign_id from public.campaign_members
      where user_id = auth.uid()
    )
  );

create policy "Members can share own content"
  on public.content_shares for insert
  to authenticated
  with check (
    shared_by = auth.uid()
    and campaign_id in (
      select campaign_id from public.campaign_members
      where user_id = auth.uid()
    )
    and content_id in (
      select id from public.content_definitions
      where owner_id = auth.uid()
    )
  );

create policy "Owner can unshare content"
  on public.content_shares for delete
  to authenticated
  using (shared_by = auth.uid());

-- ============================================================
-- CONTENT TYPE SHARES
-- ============================================================
create policy "Type shares visible to campaign members"
  on public.content_type_shares for select
  to authenticated
  using (
    campaign_id in (
      select campaign_id from public.campaign_members
      where user_id = auth.uid()
    )
  );

create policy "Members can share own custom types"
  on public.content_type_shares for insert
  to authenticated
  with check (
    shared_by = auth.uid()
    and campaign_id in (
      select campaign_id from public.campaign_members
      where user_id = auth.uid()
    )
    and content_type_id in (
      select id from public.custom_content_types
      where owner_id = auth.uid()
    )
  );

create policy "Owner can unshare custom types"
  on public.content_type_shares for delete
  to authenticated
  using (shared_by = auth.uid());
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/00006_rls_policies.sql
git commit -m "feat: add RLS policies for all tables — content scoping, character visibility, sharing"
```

---

## Task 11: D&D 5e 2024 System Schema Seed

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Create seed data**

Create `supabase/seed.sql`:

```sql
insert into public.game_systems (slug, name, version_label, status, schema_definition, expression_context)
values (
  'dnd-5e-2024',
  'D&D 5th Edition (2024)',
  '2024 Rules',
  'published',
  '{
    "ability_scores": [
      {"slug": "strength", "name": "Strength", "abbr": "STR"},
      {"slug": "dexterity", "name": "Dexterity", "abbr": "DEX"},
      {"slug": "constitution", "name": "Constitution", "abbr": "CON"},
      {"slug": "intelligence", "name": "Intelligence", "abbr": "INT"},
      {"slug": "wisdom", "name": "Wisdom", "abbr": "WIS"},
      {"slug": "charisma", "name": "Charisma", "abbr": "CHA"}
    ],
    "proficiency_levels": [
      {"slug": "none", "name": "Not Proficient", "multiplier": 0},
      {"slug": "half", "name": "Half Proficiency", "multiplier": 0.5},
      {"slug": "proficient", "name": "Proficient", "multiplier": 1},
      {"slug": "expertise", "name": "Expertise", "multiplier": 2}
    ],
    "derived_stats": [
      {"slug": "proficiency_bonus", "name": "Proficiency Bonus", "formula": "floor((level - 1) / 4) + 2"},
      {"slug": "armor_class", "name": "Armor Class", "formula": "10 + mod(dexterity)"},
      {"slug": "initiative", "name": "Initiative", "formula": "mod(dexterity)"},
      {"slug": "movement_speed", "name": "Speed", "base": 30},
      {"slug": "hit_points_max", "name": "Hit Point Maximum", "formula": "hit_die_total + (mod(constitution) * level)"},
      {"slug": "passive_perception", "name": "Passive Perception", "formula": "10 + mod(wisdom) + proficiency_if(''perception'')"},
      {"slug": "spell_save_dc", "name": "Spell Save DC", "formula": "8 + proficiency_bonus + mod(spellcasting_ability)"},
      {"slug": "spell_attack_bonus", "name": "Spell Attack Bonus", "formula": "proficiency_bonus + mod(spellcasting_ability)"}
    ],
    "skills": [
      {"slug": "acrobatics", "name": "Acrobatics", "ability": "dexterity"},
      {"slug": "animal_handling", "name": "Animal Handling", "ability": "wisdom"},
      {"slug": "arcana", "name": "Arcana", "ability": "intelligence"},
      {"slug": "athletics", "name": "Athletics", "ability": "strength"},
      {"slug": "deception", "name": "Deception", "ability": "charisma"},
      {"slug": "history", "name": "History", "ability": "intelligence"},
      {"slug": "insight", "name": "Insight", "ability": "wisdom"},
      {"slug": "intimidation", "name": "Intimidation", "ability": "charisma"},
      {"slug": "investigation", "name": "Investigation", "ability": "intelligence"},
      {"slug": "medicine", "name": "Medicine", "ability": "wisdom"},
      {"slug": "nature", "name": "Nature", "ability": "intelligence"},
      {"slug": "perception", "name": "Perception", "ability": "wisdom"},
      {"slug": "performance", "name": "Performance", "ability": "charisma"},
      {"slug": "persuasion", "name": "Persuasion", "ability": "charisma"},
      {"slug": "religion", "name": "Religion", "ability": "intelligence"},
      {"slug": "sleight_of_hand", "name": "Sleight of Hand", "ability": "dexterity"},
      {"slug": "stealth", "name": "Stealth", "ability": "dexterity"},
      {"slug": "survival", "name": "Survival", "ability": "wisdom"}
    ],
    "resources": [
      {"slug": "hit_points", "name": "Hit Points", "type": "current_max_temp"},
      {"slug": "hit_dice", "name": "Hit Dice", "type": "pool", "per": "level"},
      {"slug": "spell_slots", "name": "Spell Slots", "type": "slots_by_level", "levels": [1,2,3,4,5,6,7,8,9]},
      {"slug": "death_saves", "name": "Death Saves", "type": "success_fail", "max_each": 3}
    ],
    "content_types": [
      {"slug": "species", "name": "Species", "plural": "Species", "required": true, "max": 1},
      {"slug": "class", "name": "Class", "plural": "Classes", "required": true, "max": null},
      {"slug": "subclass", "name": "Subclass", "plural": "Subclasses", "parent": "class"},
      {"slug": "background", "name": "Background", "plural": "Backgrounds", "required": true, "max": 1},
      {"slug": "feat", "name": "Feat", "plural": "Feats", "max": null},
      {"slug": "spell", "name": "Spell", "plural": "Spells"},
      {"slug": "item", "name": "Item", "plural": "Items"},
      {"slug": "weapon", "name": "Weapon", "plural": "Weapons"},
      {"slug": "armor", "name": "Armor", "plural": "Armor"}
    ],
    "currencies": [
      {"slug": "cp", "name": "Copper", "rate": 1},
      {"slug": "sp", "name": "Silver", "rate": 10},
      {"slug": "ep", "name": "Electrum", "rate": 50},
      {"slug": "gp", "name": "Gold", "rate": 100},
      {"slug": "pp", "name": "Platinum", "rate": 1000}
    ],
    "creation_steps": [
      {"step": 1, "type": "species", "label": "Choose Species"},
      {"step": 2, "type": "class", "label": "Choose Class"},
      {"step": 3, "type": "abilities", "label": "Set Ability Scores", "methods": ["standard_array", "point_buy", "manual"]},
      {"step": 4, "type": "background", "label": "Choose Background"},
      {"step": 5, "type": "equipment", "label": "Starting Equipment"},
      {"step": 6, "type": "details", "label": "Character Details", "fields": ["name", "alignment", "backstory", "appearance", "personality_traits", "ideals", "bonds", "flaws"]}
    ],
    "sheet_sections": [
      {"slug": "header", "label": "Character Header", "contains": ["name", "class_level", "species", "background"]},
      {"slug": "abilities", "label": "Ability Scores"},
      {"slug": "combat", "label": "Combat", "contains": ["armor_class", "initiative", "speed", "hit_points"]},
      {"slug": "skills", "label": "Skills & Saves"},
      {"slug": "actions", "label": "Actions", "tab": true},
      {"slug": "spells", "label": "Spells", "tab": true},
      {"slug": "inventory", "label": "Inventory", "tab": true},
      {"slug": "features", "label": "Features & Traits", "tab": true, "extension_zone": true},
      {"slug": "background", "label": "Background", "tab": true},
      {"slug": "notes", "label": "Notes", "tab": true},
      {"slug": "extras", "label": "Extras", "tab": true}
    ]
  }'::jsonb,
  '{}'::jsonb
);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat: add D&D 5e 2024 system schema seed data"
```

---

## Task 12: Supabase Auth Helpers & Middleware

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `middleware.ts`

- [ ] **Step 1: Create browser Supabase client**

Create `lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create server Supabase client**

Create `lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — ignore
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create middleware helper**

Create `lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from protected routes
  if (
    !user &&
    request.nextUrl.pathname.startsWith("/dashboard")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 4: Create Next.js middleware**

Create `middleware.ts` (project root):

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/ middleware.ts
git commit -m "feat: add Supabase auth helpers and Next.js middleware for session management"
```

---

## Task 13: Auth UI Pages

**Files:**
- Create: `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/(auth)/auth/callback/route.ts`

- [ ] **Step 1: Create OAuth callback route**

Create `app/(auth)/auth/callback/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

- [ ] **Step 2: Create login page**

Create `app/(auth)/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  async function handleOAuth(provider: "discord" | "google") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Sign in to Inkborne</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => handleOAuth("discord")} className="w-full">
              Continue with Discord
            </Button>
            <Button variant="outline" onClick={() => handleOAuth("google")} className="w-full">
              Continue with Google
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-sm text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Create signup page**

Create `app/(auth)/signup/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  }

  async function handleOAuth(provider: "discord" | "google") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold">Check your email</h2>
            <p className="mt-2 text-muted-foreground">
              We sent a confirmation link to {email}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Create an account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => handleOAuth("discord")} className="w-full">
              Continue with Discord
            </Button>
            <Button variant="outline" onClick={() => handleOAuth("google")} className="w-full">
              Continue with Google
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-sm text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Sign up"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/
git commit -m "feat: add login, signup, and OAuth callback pages"
```

---

## Task 14: Dashboard Shell

**Files:**
- Create: `app/(app)/layout.tsx`, `app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Create authenticated layout**

Create `app/(app)/layout.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-bold">
              Inkborne
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
              <Link href="/characters" className="text-muted-foreground hover:text-foreground">
                Characters
              </Link>
              <Link href="/campaigns" className="text-muted-foreground hover:text-foreground">
                Campaigns
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {profile?.display_name || user.email}
            </span>
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create dashboard page**

Create `app/(app)/dashboard/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user!.id)
    .single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome{profile?.display_name ? `, ${profile.display_name}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">
          Your characters and campaigns will appear here.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-2">Characters</h2>
          <p className="text-muted-foreground text-sm">
            No characters yet. The character builder is coming soon.
          </p>
        </div>
        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-2">Campaigns</h2>
          <p className="text-muted-foreground text-sm">
            No campaigns yet. Campaign management is coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create sign-out route**

Create `app/(auth)/auth/signout/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`);
}
```

- [ ] **Step 4: Create stub pages for characters and campaigns**

Create `app/(app)/characters/page.tsx`:

```tsx
export default function CharactersPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Characters</h1>
      <p className="text-muted-foreground mt-1">Character builder coming in the next sub-project.</p>
    </div>
  );
}
```

Create `app/(app)/campaigns/page.tsx`:

```tsx
export default function CampaignsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Campaigns</h1>
      <p className="text-muted-foreground mt-1">Campaign management coming in a future sub-project.</p>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add app/
git commit -m "feat: add authenticated dashboard shell with nav, sign-out, and stub pages"
```

---

## Task 15: Final Verification

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass (effects, parser, evaluator, schema validation).

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: No lint errors (or only warnings from generated shadcn files).

- [ ] **Step 4: Run dev server**

```bash
npm run dev
```

Expected: App starts on localhost:3000. Landing page loads. Login/signup pages render. Auth requires a connected Supabase project.

- [ ] **Step 5: Commit any fixes**

If any of the above steps surfaced issues, fix and commit:

```bash
git add -A
git commit -m "fix: resolve issues found during final verification"
```
