# D&D 5e Character Builder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the character management experience with characters list, character dashboard, D&D 5e step-based creation flow, level up, and live stat computation.

**Architecture:** Step-based wizard under `/characters/[id]/builder/` with shared components (ContentBrowser, ContentPreview, ChoiceSelector, BuilderStepNav, StatPreview). Character state saved to Supabase on each step. Expression engine runs client-side for live stat preview.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, shadcn/ui, Tailwind CSS (semantic colors only), expression engine from lib/engine/

**Spec:** `docs/superpowers/specs/2026-04-08-character-builder-design.md`

---

## File Map

### Database
- `supabase/migrations/00007_character_builder.sql` — ALTER characters + CREATE character_content_refs + RLS policies

### Types (modify)
- `lib/types/character.ts` — Add level, base_stats, choices, state to Character interface; add CharacterContentRef type

### Data Access Layer (create)
- `lib/supabase/characters.ts` — CRUD functions for characters
- `lib/supabase/content-refs.ts` — CRUD functions for character_content_refs

### Pages (create/modify)
- `app/(app)/characters/page.tsx` — Replace stub with characters list
- `app/(app)/characters/new/page.tsx` — Create character form
- `app/(app)/characters/[id]/page.tsx` — Character dashboard (tabbed)
- `app/(app)/characters/[id]/builder/layout.tsx` — Builder layout with step nav + stat preview
- `app/(app)/characters/[id]/builder/page.tsx` — Builder overview (step completion status)
- `app/(app)/characters/[id]/builder/class/page.tsx` — Class step
- `app/(app)/characters/[id]/builder/race/page.tsx` — Race step
- `app/(app)/characters/[id]/builder/background/page.tsx` — Background step
- `app/(app)/characters/[id]/builder/abilities/page.tsx` — Abilities step
- `app/(app)/characters/[id]/builder/equipment/page.tsx` — Equipment step

### Shared Components (create)
- `components/builder/content-browser.tsx` — Searchable content card list
- `components/builder/content-preview.tsx` — Modal with content details
- `components/builder/choice-selector.tsx` — Choose N from options
- `components/builder/builder-step-nav.tsx` — Step navigation with status indicators
- `components/builder/stat-preview.tsx` — Live stat computation display
- `components/characters/character-card.tsx` — Card for characters list

### shadcn/ui (install)
- `components/ui/dialog.tsx` — Install for ContentPreview modal
- `components/ui/badge.tsx` — Install for choice count indicators
- `components/ui/select.tsx` — Install for dropdowns (system picker, ability method)
- `components/ui/accordion.tsx` — Install for class features

### Tests (create)
- `tests/lib/supabase/characters.test.ts` — Character data access tests
- `tests/lib/supabase/content-refs.test.ts` — Content ref data access tests
- `tests/components/builder/choice-selector.test.tsx` — ChoiceSelector unit tests
- `tests/components/builder/stat-preview.test.tsx` — StatPreview unit tests

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/00007_character_builder.sql`

- [ ] **Step 1: Write migration — ALTER characters table**

Create `supabase/migrations/00007_character_builder.sql`:

```sql
-- ============================================================
-- ALTER CHARACTERS TABLE — Add builder columns
-- ============================================================
alter table public.characters
  add column level integer not null default 1,
  add column base_stats jsonb not null default '{}',
  add column choices jsonb not null default '{}',
  add column state jsonb not null default '{}';
```

- [ ] **Step 2: Write migration — CREATE character_content_refs table**

Append to `supabase/migrations/00007_character_builder.sql`:

```sql
-- ============================================================
-- CHARACTER CONTENT REFS — Tracks content selections per character
-- ============================================================
create table public.character_content_refs (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  content_id uuid not null references public.content_definitions(id) on delete cascade,
  content_version integer not null default 1,
  context jsonb not null default '{}',
  choice_source text,
  created_at timestamptz not null default now()
);

alter table public.character_content_refs enable row level security;

create index idx_character_content_refs_character_id
  on public.character_content_refs(character_id);

create index idx_character_content_refs_choice_source
  on public.character_content_refs(choice_source)
  where choice_source is not null;
```

- [ ] **Step 3: Write migration — RLS policies for character_content_refs**

Append to `supabase/migrations/00007_character_builder.sql`:

```sql
-- ============================================================
-- RLS POLICIES — character_content_refs
-- ============================================================

-- Select: character owner can view
create policy "Owner can view character content refs"
  on public.character_content_refs for select
  to authenticated
  using (
    character_id in (
      select id from public.characters where user_id = auth.uid()
    )
  );

-- Select: campaign DM can view (if character is in a campaign)
create policy "Campaign DM can view character content refs"
  on public.character_content_refs for select
  to authenticated
  using (
    character_id in (
      select c.id from public.characters c
      join public.campaigns camp on camp.id = c.campaign_id
      where camp.owner_id = auth.uid()
    )
  );

-- Insert: character owner only
create policy "Owner can insert character content refs"
  on public.character_content_refs for insert
  to authenticated
  with check (
    character_id in (
      select id from public.characters where user_id = auth.uid()
    )
  );

-- Update: character owner only
create policy "Owner can update character content refs"
  on public.character_content_refs for update
  to authenticated
  using (
    character_id in (
      select id from public.characters where user_id = auth.uid()
    )
  );

-- Delete: character owner only
create policy "Owner can delete character content refs"
  on public.character_content_refs for delete
  to authenticated
  using (
    character_id in (
      select id from public.characters where user_id = auth.uid()
    )
  );
```

- [ ] **Step 4: Apply migration locally**

Run `npx supabase db push` or `npx supabase migration up` to apply the migration to the local development database.

- [ ] **Step 5: Commit**

```
git add supabase/migrations/00007_character_builder.sql
git commit -m "feat: add character builder migration — level/stats/choices columns + content refs table"
```

---

## Task 2: Update Character Types

**Files:**
- Modify: `lib/types/character.ts`

- [ ] **Step 1: Add builder fields to Character interface and create CharacterContentRef type**

Add to `lib/types/character.ts`:

```typescript
export type CharacterVisibility = "private" | "campaign" | "public";

export interface CharacterChoices {
  classes?: Array<{ slug: string; level: number; subclass?: string }>;
  race?: string;
  subrace?: string;
  background?: string;
  ability_method?: "standard_array" | "point_buy" | "manual";
  ability_assignments?: Record<string, number>;
  starting_equipment?: string;
  personality_traits?: string[];
  ideals?: string[];
  bonds?: string[];
  flaws?: string[];
  resolved_choices?: Record<string, string[]>;
}

export interface CharacterState {
  current_hp?: number;
  temp_hp?: number;
  spell_slots_used?: Record<string, number>;
  [key: string]: unknown;
}

export interface Character {
  id: string;
  user_id: string;
  system_id: string;
  campaign_id: string | null;
  name: string;
  visibility: CharacterVisibility;
  archived: boolean;
  level: number;
  base_stats: Record<string, number>;
  choices: CharacterChoices;
  state: CharacterState;
  created_at: string;
}

export interface CharacterContentRef {
  id: string;
  character_id: string;
  content_id: string;
  content_version: number;
  context: Record<string, unknown>;
  choice_source: string | null;
  created_at: string;
}

export interface CharacterWithSystem extends Character {
  game_systems: {
    id: string;
    name: string;
    slug: string;
    schema_definition: import("./system").SystemSchemaDefinition;
  };
}
```

Keep the existing `Campaign`, `CampaignMember`, and `Profile` interfaces unchanged.

- [ ] **Step 2: Commit**

```
git add lib/types/character.ts
git commit -m "feat: add builder types — CharacterChoices, CharacterContentRef, CharacterWithSystem"
```

---

## Task 3: Supabase Data Access Layer — Characters

**Files:**
- Create: `lib/supabase/characters.ts`
- Create: `tests/lib/supabase/characters.test.ts`

- [ ] **Step 1: Write tests for character data access**

Create `tests/lib/supabase/characters.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCharactersByUser,
  getCharacterById,
  createCharacter,
  updateCharacter,
  getCharacterWithSystem,
} from "@/lib/supabase/characters";

// Mock the server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

function mockSupabase(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
  // For non-single queries, the chain itself resolves
  chain.select.mockReturnValue(chain);
  chain.order.mockResolvedValue({ data, error });
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);

  const supabase = {
    from: vi.fn().mockReturnValue(chain),
  };

  const { createClient } = require("@/lib/supabase/server");
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);

  return { supabase, chain };
}

describe("getCharactersByUser", () => {
  it("queries characters filtered by user_id and ordered by created_at", async () => {
    const chars = [{ id: "1", name: "Thorn" }];
    const { chain } = mockSupabase(chars);

    const result = await getCharactersByUser("user-1");

    expect(result).toEqual(chars);
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });
});

describe("getCharacterById", () => {
  it("queries a single character by id", async () => {
    const char = { id: "1", name: "Thorn" };
    const { chain } = mockSupabase(char);

    const result = await getCharacterById("1");

    expect(result).toEqual(char);
    expect(chain.eq).toHaveBeenCalledWith("id", "1");
    expect(chain.single).toHaveBeenCalled();
  });
});

describe("createCharacter", () => {
  it("inserts a character with required fields", async () => {
    const char = { id: "new-1", name: "Elara", user_id: "u1", system_id: "s1" };
    const { chain } = mockSupabase(char);

    const result = await createCharacter({
      name: "Elara",
      user_id: "u1",
      system_id: "s1",
    });

    expect(result).toEqual(char);
    expect(chain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "Elara",
        user_id: "u1",
        system_id: "s1",
      }),
    ]);
  });
});

describe("updateCharacter", () => {
  it("updates specified fields on a character", async () => {
    const updated = { id: "1", name: "Thorn", level: 2 };
    const { chain } = mockSupabase(updated);

    const result = await updateCharacter("1", { level: 2 });

    expect(result).toEqual(updated);
    expect(chain.update).toHaveBeenCalledWith({ level: 2 });
    expect(chain.eq).toHaveBeenCalledWith("id", "1");
  });
});
```

- [ ] **Step 2: Implement character data access functions**

Create `lib/supabase/characters.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import type {
  Character,
  CharacterWithSystem,
  CharacterChoices,
  CharacterState,
} from "@/lib/types/character";

export async function getCharactersByUser(
  userId: string,
): Promise<Character[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getCharacterById(
  id: string,
): Promise<Character | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function getCharacterWithSystem(
  id: string,
): Promise<CharacterWithSystem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .select(
      `*, game_systems (id, name, slug, schema_definition)`,
    )
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as CharacterWithSystem | null;
}

export async function createCharacter(params: {
  name: string;
  user_id: string;
  system_id: string;
  campaign_id?: string | null;
}): Promise<Character> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .insert([
      {
        name: params.name,
        user_id: params.user_id,
        system_id: params.system_id,
        campaign_id: params.campaign_id ?? null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCharacter(
  id: string,
  updates: Partial<
    Pick<Character, "name" | "level" | "base_stats" | "choices" | "state" | "visibility" | "archived" | "campaign_id">
  >,
): Promise<Character> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPublishedSystems(): Promise<
  Array<{ id: string; name: string; slug: string }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_systems")
    .select("id, name, slug")
    .eq("status", "published");

  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 3: Run tests and commit**

```
npx vitest run tests/lib/supabase/characters.test.ts
git add lib/supabase/characters.ts tests/lib/supabase/characters.test.ts
git commit -m "feat: add character data access layer with tests"
```

---

## Task 4: Supabase Data Access Layer — Content Refs

**Files:**
- Create: `lib/supabase/content-refs.ts`
- Create: `tests/lib/supabase/content-refs.test.ts`

- [ ] **Step 1: Write tests for content ref data access**

Create `tests/lib/supabase/content-refs.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import {
  getContentRefsByCharacter,
  addContentRef,
  removeContentRef,
  removeContentRefsByChoiceSource,
  getContentRefsByChoiceSource,
} from "@/lib/supabase/content-refs";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

function mockSupabase(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockImplementation(() => chain);
  // For non-single terminal calls
  chain.delete.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);

  const supabase = {
    from: vi.fn().mockReturnValue(chain),
  };

  const { createClient } = require("@/lib/supabase/server");
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase);

  return { supabase, chain };
}

describe("getContentRefsByCharacter", () => {
  it("queries refs with joined content definitions", async () => {
    const refs = [{ id: "r1", content_id: "c1" }];
    const { chain } = mockSupabase(refs);
    // Override: the terminal call for this is the select chain, not single
    chain.eq.mockResolvedValue({ data: refs, error: null });

    const result = await getContentRefsByCharacter("char-1");

    expect(result).toEqual(refs);
  });
});

describe("addContentRef", () => {
  it("inserts a content ref and returns the result", async () => {
    const ref = { id: "r1", character_id: "c1", content_id: "cd1" };
    const { chain } = mockSupabase(ref);

    const result = await addContentRef({
      character_id: "c1",
      content_id: "cd1",
      content_version: 1,
      context: { source: "class", level: 1 },
    });

    expect(result).toEqual(ref);
  });
});

describe("removeContentRefsByChoiceSource", () => {
  it("deletes refs matching character and choice_source", async () => {
    const { chain } = mockSupabase(null);
    chain.eq.mockResolvedValue({ data: null, error: null });

    await removeContentRefsByChoiceSource("char-1", "choice-skill-1");

    expect(chain.delete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement content ref data access functions**

Create `lib/supabase/content-refs.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import type { CharacterContentRef } from "@/lib/types/character";

export interface ContentRefWithContent extends CharacterContentRef {
  content_definitions: {
    id: string;
    name: string;
    slug: string;
    content_type: string;
    data: Record<string, unknown>;
    effects: import("@/lib/types/effects").Effect[];
  };
}

export async function getContentRefsByCharacter(
  characterId: string,
): Promise<ContentRefWithContent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("character_content_refs")
    .select(
      `*, content_definitions (id, name, slug, content_type, data, effects)`,
    )
    .eq("character_id", characterId);

  if (error) throw error;
  return (data ?? []) as ContentRefWithContent[];
}

export async function addContentRef(params: {
  character_id: string;
  content_id: string;
  content_version: number;
  context: Record<string, unknown>;
  choice_source?: string | null;
}): Promise<CharacterContentRef> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("character_content_refs")
    .insert([
      {
        character_id: params.character_id,
        content_id: params.content_id,
        content_version: params.content_version,
        context: params.context,
        choice_source: params.choice_source ?? null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeContentRef(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("character_content_refs")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function removeContentRefsByChoiceSource(
  characterId: string,
  choiceSource: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("character_content_refs")
    .delete()
    .eq("character_id", characterId)
    .eq("choice_source", choiceSource);

  if (error) throw error;
}

export async function getContentRefsByChoiceSource(
  characterId: string,
  choiceSource: string,
): Promise<CharacterContentRef[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("character_content_refs")
    .select("*")
    .eq("character_id", characterId)
    .eq("choice_source", choiceSource);

  if (error) throw error;
  return data ?? [];
}

export async function getContentByTypeAndSystem(
  systemId: string,
  contentType: string,
): Promise<
  Array<{
    id: string;
    name: string;
    slug: string;
    content_type: string;
    data: Record<string, unknown>;
    effects: import("@/lib/types/effects").Effect[];
    version: number;
    source: string;
  }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data, effects, version, source")
    .eq("system_id", systemId)
    .eq("content_type", contentType)
    .order("name");

  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 3: Run tests and commit**

```
npx vitest run tests/lib/supabase/content-refs.test.ts
git add lib/supabase/content-refs.ts tests/lib/supabase/content-refs.test.ts
git commit -m "feat: add content refs data access layer with tests"
```

---

## Task 5: Install Required shadcn/ui Components

**Files:**
- Create: `components/ui/dialog.tsx`
- Create: `components/ui/badge.tsx`
- Create: `components/ui/select.tsx`
- Create: `components/ui/accordion.tsx`

- [ ] **Step 1: Install dialog, badge, select, and accordion**

```bash
npx shadcn@latest add dialog badge select accordion
```

- [ ] **Step 2: Commit**

```
git add components/ui/dialog.tsx components/ui/badge.tsx components/ui/select.tsx components/ui/accordion.tsx
git commit -m "chore: install shadcn/ui dialog, badge, select, accordion components"
```

---

## Task 6: Characters List Page

**Files:**
- Modify: `app/(app)/characters/page.tsx`
- Create: `components/characters/character-card.tsx`

- [ ] **Step 1: Create CharacterCard component**

Create `components/characters/character-card.tsx`:

```tsx
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Character } from "@/lib/types/character";

interface CharacterCardProps {
  character: Character & {
    game_systems?: { name: string } | null;
    campaigns?: { name: string } | null;
  };
}

export function CharacterCard({ character }: CharacterCardProps) {
  const classInfo = character.choices?.classes;
  const primaryClass = classInfo?.[0];

  return (
    <Link href={`/characters/${character.id}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{character.name}</CardTitle>
          <CardDescription>
            {character.game_systems?.name ?? "Unknown System"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {primaryClass ? (
              <span className="capitalize">
                Level {character.level} {primaryClass.slug}
              </span>
            ) : (
              <span className="italic">No class selected</span>
            )}
          </div>
          {character.campaigns?.name && (
            <p className="text-xs text-muted-foreground mt-1">
              {character.campaigns.name}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Replace characters list stub page**

Replace the contents of `app/(app)/characters/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CharacterCard } from "@/components/characters/character-card";

export default async function CharactersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: characters } = await supabase
    .from("characters")
    .select("*, game_systems (name), campaigns (name)")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Characters</h1>
          <p className="text-muted-foreground mt-1">
            Manage your characters across all game systems.
          </p>
        </div>
        <Link href="/characters/new">
          <Button>Create New Character</Button>
        </Link>
      </div>

      {characters && characters.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-xl font-semibold mb-2">No characters yet</h2>
          <p className="text-muted-foreground mb-4">
            Create your first character to get started.
          </p>
          <Link href="/characters/new">
            <Button>Create New Character</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```
git add app/(app)/characters/page.tsx components/characters/character-card.tsx
git commit -m "feat: implement characters list page with character cards"
```

---

## Task 7: Create Character Page

**Files:**
- Create: `app/(app)/characters/new/page.tsx`

- [ ] **Step 1: Create the new character form page**

Create `app/(app)/characters/new/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function NewCharacterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: systems } = await supabase
    .from("game_systems")
    .select("id, name, slug")
    .eq("status", "published")
    .order("name");

  async function createCharacter(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const name = formData.get("name") as string;
    const systemId = formData.get("system_id") as string;

    if (!name?.trim() || !systemId) {
      redirect("/characters/new?error=missing_fields");
    }

    const { data, error } = await supabase
      .from("characters")
      .insert([
        {
          name: name.trim(),
          user_id: user.id,
          system_id: systemId,
        },
      ])
      .select("id")
      .single();

    if (error) {
      redirect("/characters/new?error=create_failed");
    }

    redirect(`/characters/${data.id}`);
  }

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create New Character</CardTitle>
          <CardDescription>
            Choose a name and game system for your character.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createCharacter} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Character Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Enter character name"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="system_id">Game System</Label>
              <select
                id="system_id"
                name="system_id"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select a game system</option>
                {systems?.map((system) => (
                  <option key={system.id} value={system.id}>
                    {system.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1">
                Create Character
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add app/(app)/characters/new/page.tsx
git commit -m "feat: add create character page with name and system selection"
```

---

## Task 8: Character Dashboard

**Files:**
- Create: `app/(app)/characters/[id]/page.tsx`

- [ ] **Step 1: Create the character dashboard page with tabs**

Create `app/(app)/characters/[id]/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CharacterDashboardPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: character } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (!character) notFound();

  const hasSheet =
    character.choices?.classes && character.choices.classes.length > 0;

  const primaryClass = character.choices?.classes?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{character.name}</h1>
          <p className="text-muted-foreground">
            {character.game_systems?.name}
            {primaryClass && (
              <span>
                {" "}
                &middot; Level {character.level}{" "}
                <span className="capitalize">{primaryClass.slug}</span>
              </span>
            )}
          </p>
        </div>
        <Link href="/characters">
          <Button variant="outline">Back to Characters</Button>
        </Link>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="narrative">Narrative</TabsTrigger>
          <TabsTrigger value="sheet">Sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Character Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {hasSheet ? (
                <div className="space-y-2">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Class</p>
                      <p className="font-medium capitalize">
                        {character.choices.classes
                          ?.map(
                            (c: { slug: string; level: number }) =>
                              `${c.slug} ${c.level}`,
                          )
                          .join(" / ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Race</p>
                      <p className="font-medium capitalize">
                        {character.choices.race ?? "Not selected"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Background</p>
                      <p className="font-medium capitalize">
                        {character.choices.background ?? "Not selected"}
                      </p>
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <div className="grid gap-4 sm:grid-cols-6">
                    {Object.entries(character.base_stats || {}).map(
                      ([stat, value]) => (
                        <div key={stat} className="text-center">
                          <p className="text-xs text-muted-foreground uppercase">
                            {stat.slice(0, 3)}
                          </p>
                          <p className="text-2xl font-bold">{value as number}</p>
                          <p className="text-sm text-muted-foreground">
                            {Math.floor(((value as number) - 10) / 2) >= 0
                              ? "+"
                              : ""}
                            {Math.floor(((value as number) - 10) / 2)}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    No character sheet yet. Build your character to see a
                    summary here.
                  </p>
                  <Link href={`/characters/${character.id}/builder`}>
                    <Button>Build Character Sheet</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="narrative" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Backstory</CardTitle>
              <CardDescription>
                A polished narrative editing experience is coming in a future
                update.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {character.choices?.personality_traits &&
                  character.choices.personality_traits.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Personality Traits
                      </p>
                      {character.choices.personality_traits.map(
                        (trait: string, i: number) => (
                          <p key={i} className="text-sm">
                            {trait}
                          </p>
                        ),
                      )}
                    </div>
                  )}
                {character.choices?.ideals &&
                  character.choices.ideals.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Ideals
                      </p>
                      {character.choices.ideals.map(
                        (ideal: string, i: number) => (
                          <p key={i} className="text-sm">
                            {ideal}
                          </p>
                        ),
                      )}
                    </div>
                  )}
                {character.choices?.bonds &&
                  character.choices.bonds.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Bonds
                      </p>
                      {character.choices.bonds.map(
                        (bond: string, i: number) => (
                          <p key={i} className="text-sm">
                            {bond}
                          </p>
                        ),
                      )}
                    </div>
                  )}
                {character.choices?.flaws &&
                  character.choices.flaws.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Flaws
                      </p>
                      {character.choices.flaws.map(
                        (flaw: string, i: number) => (
                          <p key={i} className="text-sm">
                            {flaw}
                          </p>
                        ),
                      )}
                    </div>
                  )}
                {!character.choices?.personality_traits?.length &&
                  !character.choices?.ideals?.length &&
                  !character.choices?.bonds?.length &&
                  !character.choices?.flaws?.length && (
                    <p className="text-sm text-muted-foreground italic">
                      No narrative details yet. Choose a background in the
                      builder to set personality traits, ideals, bonds, and
                      flaws.
                    </p>
                  )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sheet" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Character Sheet</CardTitle>
              <CardDescription>
                {hasSheet
                  ? "View your character sheet details or edit in the builder."
                  : "Build your character sheet to see it here."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Link href={`/characters/${character.id}/builder`}>
                  <Button>{hasSheet ? "Edit Character" : "Build Character Sheet"}</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add app/(app)/characters/[id]/page.tsx
git commit -m "feat: add character dashboard with Overview, Narrative, and Sheet tabs"
```

---

## Task 9: Builder Layout and Step Nav

**Files:**
- Create: `components/builder/builder-step-nav.tsx`
- Create: `app/(app)/characters/[id]/builder/layout.tsx`
- Create: `app/(app)/characters/[id]/builder/page.tsx`

- [ ] **Step 1: Create BuilderStepNav component**

Create `components/builder/builder-step-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { CreationStep } from "@/lib/types/system";

interface StepStatus {
  [stepType: string]: "complete" | "in_progress" | "untouched";
}

interface BuilderStepNavProps {
  characterId: string;
  steps: CreationStep[];
  stepStatus: StepStatus;
}

export function BuilderStepNav({
  characterId,
  steps,
  stepStatus,
}: BuilderStepNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b pb-3 mb-6">
      <Link
        href={`/characters/${characterId}/builder`}
        className={cn(
          "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          pathname === `/characters/${characterId}/builder`
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        Overview
      </Link>
      {steps.map((step) => {
        const status = stepStatus[step.type] ?? "untouched";
        const isActive = pathname.endsWith(`/builder/${step.type}`);

        return (
          <Link
            key={step.type}
            href={`/characters/${characterId}/builder/${step.type}`}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <span
              className={cn(
                "inline-block w-2 h-2 rounded-full",
                status === "complete" && "bg-green-500",
                status === "in_progress" && "bg-blue-500",
                status === "untouched" && "bg-muted-foreground/30",
              )}
            />
            {step.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Create builder layout**

Create `app/(app)/characters/[id]/builder/layout.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BuilderStepNav } from "@/components/builder/builder-step-nav";
import type { CreationStep } from "@/lib/types/system";
import type { CharacterChoices } from "@/lib/types/character";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

function computeStepStatus(
  steps: CreationStep[],
  choices: CharacterChoices,
  baseStats: Record<string, number>,
): Record<string, "complete" | "in_progress" | "untouched"> {
  const status: Record<string, "complete" | "in_progress" | "untouched"> = {};

  for (const step of steps) {
    switch (step.type) {
      case "class":
        if (choices.classes && choices.classes.length > 0) {
          status.class = "complete";
        } else {
          status.class = "untouched";
        }
        break;
      case "race":
        if (choices.race) {
          status.race = "complete";
        } else {
          status.race = "untouched";
        }
        break;
      case "background":
        if (choices.background) {
          status.background = "complete";
        } else {
          status.background = "untouched";
        }
        break;
      case "abilities":
        if (
          choices.ability_method &&
          Object.keys(baseStats).length > 0
        ) {
          status.abilities = "complete";
        } else if (choices.ability_method) {
          status.abilities = "in_progress";
        } else {
          status.abilities = "untouched";
        }
        break;
      case "equipment":
        if (choices.starting_equipment) {
          status.equipment = "complete";
        } else {
          status.equipment = "untouched";
        }
        break;
      default:
        status[step.type] = "untouched";
    }
  }

  return status;
}

export default async function BuilderLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: character } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (!character) notFound();
  if (character.user_id !== user.id) notFound();

  const schema = character.game_systems?.schema_definition;
  const steps: CreationStep[] = schema?.creation_steps ?? [];
  const stepStatus = computeStepStatus(
    steps,
    character.choices ?? {},
    character.base_stats ?? {},
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{character.name}</h1>
          <p className="text-sm text-muted-foreground">Character Builder</p>
        </div>
        <Link href={`/characters/${id}`}>
          <Button variant="outline" size="sm">
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <BuilderStepNav
        characterId={id}
        steps={steps}
        stepStatus={stepStatus}
      />

      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create builder overview page**

Create `app/(app)/characters/[id]/builder/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CreationStep } from "@/lib/types/system";
import type { CharacterChoices } from "@/lib/types/character";

interface PageProps {
  params: Promise<{ id: string }>;
}

function getStepSummary(
  step: CreationStep,
  choices: CharacterChoices,
): string {
  switch (step.type) {
    case "class":
      return choices.classes?.length
        ? choices.classes
            .map((c) => `${c.slug} ${c.level}`)
            .join(", ")
        : "Not selected";
    case "race":
      return choices.race
        ? `${choices.race}${choices.subrace ? ` (${choices.subrace})` : ""}`
        : "Not selected";
    case "background":
      return choices.background ?? "Not selected";
    case "abilities":
      return choices.ability_method ?? "Not selected";
    case "equipment":
      return choices.starting_equipment ?? "Not selected";
    default:
      return "Not started";
  }
}

function getStepStatus(
  step: CreationStep,
  choices: CharacterChoices,
  baseStats: Record<string, number>,
): "complete" | "in_progress" | "untouched" {
  switch (step.type) {
    case "class":
      return choices.classes?.length ? "complete" : "untouched";
    case "race":
      return choices.race ? "complete" : "untouched";
    case "background":
      return choices.background ? "complete" : "untouched";
    case "abilities":
      if (choices.ability_method && Object.keys(baseStats).length > 0)
        return "complete";
      if (choices.ability_method) return "in_progress";
      return "untouched";
    case "equipment":
      return choices.starting_equipment ? "complete" : "untouched";
    default:
      return "untouched";
  }
}

export default async function BuilderOverviewPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: character } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (!character) notFound();

  const schema = character.game_systems?.schema_definition;
  const steps: CreationStep[] = schema?.creation_steps ?? [];
  const choices: CharacterChoices = character.choices ?? {};
  const baseStats: Record<string, number> = character.base_stats ?? {};

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Complete each step to build your character. Steps can be done in any
        order.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, index) => {
          const status = getStepStatus(step, choices, baseStats);
          const summary = getStepSummary(step, choices);

          return (
            <Link
              key={step.type}
              href={`/characters/${id}/builder/${step.type}`}
            >
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                        status === "complete" &&
                          "bg-green-500/10 text-green-500",
                        status === "in_progress" &&
                          "bg-blue-500/10 text-blue-500",
                        status === "untouched" &&
                          "bg-muted text-muted-foreground",
                      )}
                    >
                      {status === "complete" ? "\u2713" : index + 1}
                    </span>
                    <CardTitle className="text-base">{step.label}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p
                    className={cn(
                      "text-sm capitalize",
                      status === "untouched"
                        ? "text-muted-foreground italic"
                        : "text-foreground",
                    )}
                  >
                    {summary}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```
git add components/builder/builder-step-nav.tsx app/(app)/characters/[id]/builder/layout.tsx app/(app)/characters/[id]/builder/page.tsx
git commit -m "feat: add builder layout, step navigation, and overview page"
```

---

## Task 10: ContentBrowser Component

**Files:**
- Create: `components/builder/content-browser.tsx`

- [ ] **Step 1: Create ContentBrowser component**

Create `components/builder/content-browser.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Effect } from "@/lib/types/effects";

export interface ContentEntry {
  id: string;
  name: string;
  slug: string;
  content_type: string;
  data: Record<string, unknown>;
  effects: Effect[];
  version: number;
  source: string;
}

interface ContentBrowserProps {
  entries: ContentEntry[];
  contentTypeLabel: string;
  onSelect: (entry: ContentEntry) => void;
}

export function ContentBrowser({
  entries,
  contentTypeLabel,
  onSelect,
}: ContentBrowserProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const lower = search.toLowerCase();
    return entries.filter((e) => e.name.toLowerCase().includes(lower));
  }, [entries, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder={`Search ${contentTypeLabel}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-sm text-muted-foreground">
          {filtered.length} {contentTypeLabel.toLowerCase()}
          {filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4">
          No {contentTypeLabel.toLowerCase()}s found.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <Card
              key={entry.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => onSelect(entry)}
            >
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium">
                  {entry.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground capitalize">
                  {entry.source === "srd" ? "SRD" : "Homebrew"}
                </p>
                {entry.data.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {String(entry.data.description).slice(0, 120)}
                    {String(entry.data.description).length > 120 ? "..." : ""}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add components/builder/content-browser.tsx
git commit -m "feat: add ContentBrowser component — searchable content card list"
```

---

## Task 11: ContentPreview Component

**Files:**
- Create: `components/builder/content-preview.tsx`

- [ ] **Step 1: Create ContentPreview modal component**

Create `components/builder/content-preview.tsx`:

```tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { ContentEntry } from "./content-browser";
import type { Effect, GrantEffect, MechanicalEffect } from "@/lib/types/effects";

interface ContentPreviewProps {
  content: ContentEntry | null;
  contentTypeLabel: string;
  onConfirm: (content: ContentEntry) => void;
  onCancel: () => void;
}

function formatEffect(effect: Effect): string {
  switch (effect.type) {
    case "mechanical":
      return `${effect.stat}: ${effect.op} ${effect.value ?? effect.expr ?? ""}`;
    case "grant":
      return `${effect.stat}: ${effect.value}`;
    case "narrative":
      return effect.text;
    case "choice":
      return `Choose ${effect.choose} ${effect.grant_type}`;
    default:
      return "";
  }
}

export function ContentPreview({
  content,
  contentTypeLabel,
  onConfirm,
  onCancel,
}: ContentPreviewProps) {
  if (!content) return null;

  const grants = content.effects.filter(
    (e): e is GrantEffect => e.type === "grant",
  );
  const mechanicals = content.effects.filter(
    (e): e is MechanicalEffect => e.type === "mechanical",
  );
  const choices = content.effects.filter((e) => e.type === "choice");

  return (
    <Dialog open={!!content} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{content.name}</DialogTitle>
          <DialogDescription className="capitalize">
            {content.source === "srd" ? "SRD" : "Homebrew"}{" "}
            {contentTypeLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {content.data.description && (
            <p className="text-sm text-foreground">
              {String(content.data.description)}
            </p>
          )}

          {/* Key stats from data */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {content.data.hit_die && (
              <div>
                <span className="text-muted-foreground">Hit Die: </span>
                <span className="font-medium">d{String(content.data.hit_die)}</span>
              </div>
            )}
            {content.data.speed && (
              <div>
                <span className="text-muted-foreground">Speed: </span>
                <span className="font-medium">{String(content.data.speed)} ft</span>
              </div>
            )}
            {content.data.size && (
              <div>
                <span className="text-muted-foreground">Size: </span>
                <span className="font-medium capitalize">
                  {String(content.data.size)}
                </span>
              </div>
            )}
            {content.data.primary_ability && (
              <div>
                <span className="text-muted-foreground">Primary: </span>
                <span className="font-medium capitalize">
                  {String(content.data.primary_ability)}
                </span>
              </div>
            )}
          </div>

          {/* Grants */}
          {grants.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Proficiencies & Grants</p>
                <div className="flex flex-wrap gap-1.5">
                  {grants.map((g, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {g.stat}: {g.value}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Mechanical effects */}
          {mechanicals.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Stat Bonuses</p>
                <div className="flex flex-wrap gap-1.5">
                  {mechanicals.map((m, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {formatEffect(m)}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Choices */}
          {choices.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Choices to Resolve</p>
                <div className="space-y-1">
                  {choices.map((c, i) => (
                    <p key={i} className="text-sm text-muted-foreground">
                      {formatEffect(c)}
                    </p>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(content)}>
            Add {contentTypeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```
git add components/builder/content-preview.tsx
git commit -m "feat: add ContentPreview modal — content details with confirm/cancel"
```

---

## Task 12: ChoiceSelector Component

**Files:**
- Create: `components/builder/choice-selector.tsx`
- Create: `tests/components/builder/choice-selector.test.tsx`

- [ ] **Step 1: Write tests for ChoiceSelector**

Create `tests/components/builder/choice-selector.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChoiceSelector } from "@/components/builder/choice-selector";
import type { ChoiceEffect } from "@/lib/types/effects";

const mockChoice: ChoiceEffect = {
  type: "choice",
  choose: 2,
  from: ["athletics", "acrobatics", "stealth", "perception"],
  grant_type: "skill_proficiency",
  choice_id: "fighter-skills",
};

describe("ChoiceSelector", () => {
  it("renders all options", () => {
    render(
      <ChoiceSelector
        choiceEffect={mockChoice}
        currentSelections={[]}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("athletics")).toBeTruthy();
    expect(screen.getByText("acrobatics")).toBeTruthy();
    expect(screen.getByText("stealth")).toBeTruthy();
    expect(screen.getByText("perception")).toBeTruthy();
  });

  it("shows selection count", () => {
    render(
      <ChoiceSelector
        choiceEffect={mockChoice}
        currentSelections={["athletics"]}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("1 / 2 selected")).toBeTruthy();
  });

  it("calls onSelect when an option is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ChoiceSelector
        choiceEffect={mockChoice}
        currentSelections={[]}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText("athletics"));
    expect(onSelect).toHaveBeenCalledWith(["athletics"]);
  });

  it("deselects when a selected option is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ChoiceSelector
        choiceEffect={mockChoice}
        currentSelections={["athletics"]}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText("athletics"));
    expect(onSelect).toHaveBeenCalledWith([]);
  });

  it("prevents selecting more than allowed", () => {
    const onSelect = vi.fn();
    render(
      <ChoiceSelector
        choiceEffect={mockChoice}
        currentSelections={["athletics", "acrobatics"]}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText("stealth"));
    // Should not call onSelect since 2/2 are already selected
    expect(onSelect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement ChoiceSelector component**

Create `components/builder/choice-selector.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ChoiceEffect } from "@/lib/types/effects";

interface ChoiceSelectorProps {
  choiceEffect: ChoiceEffect;
  currentSelections: string[];
  onSelect: (selections: string[]) => void;
  label?: string;
}

export function ChoiceSelector({
  choiceEffect,
  currentSelections,
  onSelect,
  label,
}: ChoiceSelectorProps) {
  const options = Array.isArray(choiceEffect.from)
    ? choiceEffect.from
    : [];
  const maxSelections = choiceEffect.choose;

  function handleToggle(option: string) {
    if (currentSelections.includes(option)) {
      // Deselect
      onSelect(currentSelections.filter((s) => s !== option));
    } else if (currentSelections.length < maxSelections) {
      // Select
      onSelect([...currentSelections, option]);
    }
    // If at max, do nothing (already at limit)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {label ?? `Choose ${maxSelections} ${choiceEffect.grant_type.replace(/_/g, " ")}`}
        </p>
        <span className="text-xs text-muted-foreground">
          {currentSelections.length} / {maxSelections} selected
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = currentSelections.includes(option);
          const isDisabled =
            !isSelected && currentSelections.length >= maxSelections;

          return (
            <button
              key={option}
              type="button"
              onClick={() => handleToggle(option)}
              disabled={isDisabled}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm border transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : isDisabled
                    ? "bg-muted text-muted-foreground border-border cursor-not-allowed opacity-50"
                    : "bg-card text-card-foreground border-border hover:bg-accent hover:text-accent-foreground cursor-pointer",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run tests and commit**

```
npx vitest run tests/components/builder/choice-selector.test.tsx
git add components/builder/choice-selector.tsx tests/components/builder/choice-selector.test.tsx
git commit -m "feat: add ChoiceSelector component with tests — choose N from options"
```

---

## Task 13: StatPreview Component

**Files:**
- Create: `components/builder/stat-preview.tsx`
- Create: `tests/components/builder/stat-preview.test.tsx`

- [ ] **Step 1: Write tests for StatPreview**

Create `tests/components/builder/stat-preview.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatPreview } from "@/components/builder/stat-preview";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { Effect } from "@/lib/types/effects";

// Minimal schema for testing
const mockSchema: SystemSchemaDefinition = {
  ability_scores: [
    { slug: "strength", name: "Strength", abbr: "STR" },
    { slug: "dexterity", name: "Dexterity", abbr: "DEX" },
  ],
  proficiency_levels: [{ slug: "proficient", name: "Proficient", multiplier: 1 }],
  derived_stats: [
    { slug: "proficiency_bonus", name: "Proficiency Bonus", formula: "floor(level / 4) + 2" },
    { slug: "armor_class", name: "Armor Class", base: 10 },
  ],
  skills: [{ slug: "athletics", name: "Athletics", ability: "strength" }],
  resources: [],
  content_types: [],
  currencies: [],
  creation_steps: [],
  sheet_sections: [],
};

describe("StatPreview", () => {
  it("displays ability score modifiers", () => {
    render(
      <StatPreview
        baseStats={{ strength: 16, dexterity: 14 }}
        effects={[]}
        schema={mockSchema}
        level={1}
      />,
    );

    // Strength 16 = modifier +3
    expect(screen.getByText("+3")).toBeTruthy();
    // Dexterity 14 = modifier +2
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("renders when no stats are set", () => {
    render(
      <StatPreview
        baseStats={{}}
        effects={[]}
        schema={mockSchema}
        level={1}
      />,
    );

    // Should show the component without crashing
    expect(screen.getByText("Stats")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement StatPreview component**

Create `components/builder/stat-preview.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { evaluate } from "@/lib/engine/evaluator";
import { Separator } from "@/components/ui/separator";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { Effect } from "@/lib/types/effects";

interface StatPreviewProps {
  baseStats: Record<string, number>;
  effects: Effect[];
  schema: SystemSchemaDefinition;
  level: number;
}

export function StatPreview({
  baseStats,
  effects,
  schema,
  level,
}: StatPreviewProps) {
  const result = useMemo(() => {
    const statsWithLevel = { ...baseStats, level };
    return evaluate(statsWithLevel, effects, schema);
  }, [baseStats, effects, schema, level]);

  const hasStats = Object.keys(baseStats).length > 0;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold">Stats</h3>

      {hasStats ? (
        <>
          {/* Ability Scores */}
          <div className="grid grid-cols-3 gap-2">
            {schema.ability_scores.map((ability) => {
              const score = result.stats[ability.slug] ?? baseStats[ability.slug] ?? 10;
              const mod = Math.floor((score - 10) / 2);

              return (
                <div
                  key={ability.slug}
                  className="text-center rounded-md border bg-background p-2"
                >
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">
                    {ability.abbr}
                  </p>
                  <p className="text-lg font-bold">{score}</p>
                  <p className="text-xs text-muted-foreground">
                    {mod >= 0 ? "+" : ""}
                    {mod}
                  </p>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Derived Stats */}
          <div className="space-y-1">
            {schema.derived_stats.map((stat) => {
              const value = result.computed[stat.slug];
              if (value === undefined) return null;

              return (
                <div
                  key={stat.slug}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">{stat.name}</span>
                  <span className="font-medium">{value}</span>
                </div>
              );
            })}
          </div>

          {/* Grants */}
          {result.grants.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Proficiencies
                </p>
                <div className="flex flex-wrap gap-1">
                  {result.grants.map((g, i) => (
                    <span
                      key={i}
                      className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded"
                    >
                      {g.stat}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          Assign ability scores to see computed stats.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run tests and commit**

```
npx vitest run tests/components/builder/stat-preview.test.tsx
git add components/builder/stat-preview.tsx tests/components/builder/stat-preview.test.tsx
git commit -m "feat: add StatPreview component with tests — live stat computation display"
```

---

## Task 14: Class Step

**Files:**
- Create: `app/(app)/characters/[id]/builder/class/page.tsx`

- [ ] **Step 1: Create the class builder step page**

Create `app/(app)/characters/[id]/builder/class/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ClassStepClient } from "./class-step-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ClassStepPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: character } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (!character || character.user_id !== user.id) notFound();

  const systemId = character.system_id;

  const { data: classContent } = await supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data, effects, version, source")
    .eq("system_id", systemId)
    .eq("content_type", "class")
    .order("name");

  const { data: subclassContent } = await supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data, effects, version, source")
    .eq("system_id", systemId)
    .eq("content_type", "subclass")
    .order("name");

  const { data: featureContent } = await supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data, effects, version, source")
    .eq("system_id", systemId)
    .eq("content_type", "feature")
    .order("name");

  const { data: contentRefs } = await supabase
    .from("character_content_refs")
    .select("*, content_definitions (id, name, slug, content_type, data, effects)")
    .eq("character_id", id);

  return (
    <ClassStepClient
      characterId={id}
      character={character}
      classes={classContent ?? []}
      subclasses={subclassContent ?? []}
      features={featureContent ?? []}
      contentRefs={contentRefs ?? []}
      schema={character.game_systems?.schema_definition}
    />
  );
}
```

- [ ] **Step 2: Create the class step client component**

Create `app/(app)/characters/[id]/builder/class/class-step-client.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ContentBrowser, type ContentEntry } from "@/components/builder/content-browser";
import { ContentPreview } from "@/components/builder/content-preview";
import { ChoiceSelector } from "@/components/builder/choice-selector";
import { StatPreview } from "@/components/builder/stat-preview";
import type { CharacterChoices } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { Effect, ChoiceEffect } from "@/lib/types/effects";

interface ClassStepClientProps {
  characterId: string;
  character: {
    id: string;
    level: number;
    base_stats: Record<string, number>;
    choices: CharacterChoices;
  };
  classes: ContentEntry[];
  subclasses: ContentEntry[];
  features: ContentEntry[];
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
    };
  }>;
  schema: SystemSchemaDefinition | undefined;
}

export function ClassStepClient({
  characterId,
  character,
  classes,
  subclasses,
  features,
  contentRefs,
  schema,
}: ClassStepClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
  const [previewContent, setPreviewContent] = useState<ContentEntry | null>(null);
  const [localChoices, setLocalChoices] = useState<CharacterChoices>(
    character.choices ?? {},
  );
  const [localLevel, setLocalLevel] = useState(character.level);

  const selectedClasses = localChoices.classes ?? [];
  const hasClass = selectedClasses.length > 0;

  const allEffects: Effect[] = contentRefs.flatMap(
    (ref) => ref.content_definitions?.effects ?? [],
  );

  async function handleSelectClass(content: ContentEntry) {
    setPreviewContent(null);

    const newClasses = [...selectedClasses, { slug: content.slug, level: 1 }];
    const totalLevel = newClasses.reduce((sum, c) => sum + c.level, 0);
    const newChoices = { ...localChoices, classes: newClasses };

    setLocalChoices(newChoices);
    setLocalLevel(totalLevel);

    // Save to database
    await supabase
      .from("characters")
      .update({ choices: newChoices, level: totalLevel })
      .eq("id", characterId);

    // Create content ref
    await supabase.from("character_content_refs").insert([
      {
        character_id: characterId,
        content_id: content.id,
        content_version: content.version,
        context: { source: "class", level: 1 },
      },
    ]);

    startTransition(() => router.refresh());
  }

  async function handleLevelChange(classIndex: number, newLevel: number) {
    const updatedClasses = [...selectedClasses];
    updatedClasses[classIndex] = { ...updatedClasses[classIndex], level: newLevel };
    const totalLevel = updatedClasses.reduce((sum, c) => sum + c.level, 0);
    const newChoices = { ...localChoices, classes: updatedClasses };

    setLocalChoices(newChoices);
    setLocalLevel(totalLevel);

    await supabase
      .from("characters")
      .update({ choices: newChoices, level: totalLevel })
      .eq("id", characterId);

    startTransition(() => router.refresh());
  }

  async function handleRemoveClass(classIndex: number) {
    const removedClass = selectedClasses[classIndex];
    const updatedClasses = selectedClasses.filter((_, i) => i !== classIndex);
    const totalLevel = updatedClasses.reduce((sum, c) => sum + c.level, 0);
    const newChoices = { ...localChoices, classes: updatedClasses };

    setLocalChoices(newChoices);
    setLocalLevel(Math.max(totalLevel, 1));

    await supabase
      .from("characters")
      .update({ choices: newChoices, level: Math.max(totalLevel, 1) })
      .eq("id", characterId);

    // Remove content ref for this class
    const classContentRef = contentRefs.find(
      (ref) =>
        ref.content_definitions?.slug === removedClass.slug &&
        ref.content_definitions?.content_type === "class",
    );
    if (classContentRef) {
      await supabase
        .from("character_content_refs")
        .delete()
        .eq("id", classContentRef.id);
    }

    startTransition(() => router.refresh());
  }

  async function handleChoiceSelect(choiceId: string, selections: string[]) {
    const newResolved = {
      ...localChoices.resolved_choices,
      [choiceId]: selections,
    };
    const newChoices = { ...localChoices, resolved_choices: newResolved };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);
  }

  // Get features for a specific class at a specific level
  function getFeaturesForClass(classSlug: string, level: number) {
    return features.filter((f) => {
      const data = f.data as Record<string, unknown>;
      return (
        data.class === classSlug &&
        typeof data.level === "number" &&
        data.level <= level
      );
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Class</h2>

        {hasClass ? (
          <div className="space-y-4">
            {selectedClasses.map((cls, index) => {
              const classData = classes.find((c) => c.slug === cls.slug);
              const classFeatures = getFeaturesForClass(cls.slug, cls.level);
              const choiceEffects = classFeatures.flatMap((f) =>
                f.effects.filter((e): e is ChoiceEffect => e.type === "choice"),
              );

              return (
                <Card key={`${cls.slug}-${index}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="capitalize">{cls.slug}</CardTitle>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-muted-foreground">
                          Level:
                        </label>
                        <select
                          value={cls.level}
                          onChange={(e) =>
                            handleLevelChange(index, parseInt(e.target.value))
                          }
                          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {Array.from({ length: 20 }, (_, i) => i + 1).map(
                            (lvl) => (
                              <option key={lvl} value={lvl}>
                                {lvl}
                              </option>
                            ),
                          )}
                        </select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleLevelChange(
                              index,
                              Math.min(cls.level + 1, 20),
                            )
                          }
                          disabled={cls.level >= 20}
                        >
                          Level Up
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {classData?.data.hit_die && (
                      <p className="text-sm text-muted-foreground mb-3">
                        Hit Die: d{String(classData.data.hit_die)}
                      </p>
                    )}

                    {classFeatures.length > 0 && (
                      <Accordion type="multiple" className="w-full">
                        {classFeatures.map((feature) => {
                          const featureChoices = feature.effects.filter(
                            (e): e is ChoiceEffect => e.type === "choice",
                          );

                          return (
                            <AccordionItem
                              key={feature.id}
                              value={feature.id}
                            >
                              <AccordionTrigger className="text-sm">
                                <span className="flex items-center gap-2">
                                  {feature.name}
                                  {featureChoices.length > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      {featureChoices.length} choice
                                      {featureChoices.length > 1 ? "s" : ""}
                                    </Badge>
                                  )}
                                </span>
                              </AccordionTrigger>
                              <AccordionContent className="space-y-3">
                                {feature.data.description && (
                                  <p className="text-sm text-muted-foreground">
                                    {String(feature.data.description)}
                                  </p>
                                )}
                                {featureChoices.map((choice) => (
                                  <ChoiceSelector
                                    key={choice.choice_id}
                                    choiceEffect={choice}
                                    currentSelections={
                                      localChoices.resolved_choices?.[
                                        choice.choice_id
                                      ] ?? []
                                    }
                                    onSelect={(selections) =>
                                      handleChoiceSelect(
                                        choice.choice_id,
                                        selections,
                                      )
                                    }
                                  />
                                ))}
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    )}

                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveClass(index)}
                      >
                        Remove Class
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            <Separator />
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Add another class for multiclassing:
              </p>
              <ContentBrowser
                entries={classes.filter(
                  (c) => !selectedClasses.some((sc) => sc.slug === c.slug),
                )}
                contentTypeLabel="Class"
                onSelect={setPreviewContent}
              />
            </div>
          </div>
        ) : (
          <ContentBrowser
            entries={classes}
            contentTypeLabel="Class"
            onSelect={setPreviewContent}
          />
        )}

        <ContentPreview
          content={previewContent}
          contentTypeLabel="Class"
          onConfirm={handleSelectClass}
          onCancel={() => setPreviewContent(null)}
        />

        {/* Bottom navigation */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => router.push(`/characters/${characterId}/builder`)}
          >
            Back to Overview
          </Button>
          <Button
            onClick={() =>
              router.push(`/characters/${characterId}/builder/race`)
            }
          >
            Next: Race
          </Button>
        </div>
      </div>

      {/* Sidebar: StatPreview */}
      {schema && (
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
```

- [ ] **Step 3: Commit**

```
git add app/(app)/characters/[id]/builder/class/page.tsx app/(app)/characters/[id]/builder/class/class-step-client.tsx
git commit -m "feat: add class builder step — selection, management, level up, and feature choices"
```

---

## Task 15: Race Step

**Files:**
- Create: `app/(app)/characters/[id]/builder/race/page.tsx`
- Create: `app/(app)/characters/[id]/builder/race/race-step-client.tsx`

- [ ] **Step 1: Create the race step server page**

Create `app/(app)/characters/[id]/builder/race/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { RaceStepClient } from "./race-step-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RaceStepPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: character } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (!character || character.user_id !== user.id) notFound();

  const systemId = character.system_id;

  const { data: raceContent } = await supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data, effects, version, source")
    .eq("system_id", systemId)
    .eq("content_type", "race")
    .order("name");

  const { data: subraceContent } = await supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data, effects, version, source")
    .eq("system_id", systemId)
    .eq("content_type", "subrace")
    .order("name");

  const { data: contentRefs } = await supabase
    .from("character_content_refs")
    .select("*, content_definitions (id, name, slug, content_type, data, effects)")
    .eq("character_id", id);

  return (
    <RaceStepClient
      characterId={id}
      character={character}
      races={raceContent ?? []}
      subraces={subraceContent ?? []}
      contentRefs={contentRefs ?? []}
      schema={character.game_systems?.schema_definition}
    />
  );
}
```

- [ ] **Step 2: Create the race step client component**

Create `app/(app)/characters/[id]/builder/race/race-step-client.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ContentBrowser, type ContentEntry } from "@/components/builder/content-browser";
import { ContentPreview } from "@/components/builder/content-preview";
import { ChoiceSelector } from "@/components/builder/choice-selector";
import { StatPreview } from "@/components/builder/stat-preview";
import type { CharacterChoices } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { Effect, ChoiceEffect } from "@/lib/types/effects";

interface RaceStepClientProps {
  characterId: string;
  character: {
    id: string;
    level: number;
    base_stats: Record<string, number>;
    choices: CharacterChoices;
  };
  races: ContentEntry[];
  subraces: ContentEntry[];
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
    };
  }>;
  schema: SystemSchemaDefinition | undefined;
}

export function RaceStepClient({
  characterId,
  character,
  races,
  subraces,
  contentRefs,
  schema,
}: RaceStepClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
  const [previewContent, setPreviewContent] = useState<ContentEntry | null>(null);
  const [localChoices, setLocalChoices] = useState<CharacterChoices>(
    character.choices ?? {},
  );

  const selectedRace = localChoices.race;
  const selectedSubrace = localChoices.subrace;
  const hasRace = !!selectedRace;

  // Get content type label from schema (Race vs Species)
  const raceTypeLabel =
    schema?.content_types?.find((ct) => ct.slug === "race")?.name ?? "Race";

  // Get the selected race's content entry
  const selectedRaceContent = races.find((r) => r.slug === selectedRace);
  const availableSubraces = subraces.filter(
    (sr) => (sr.data as Record<string, unknown>).parent_race === selectedRace,
  );
  const selectedSubraceContent = subraces.find(
    (sr) => sr.slug === selectedSubrace,
  );

  // Collect all effects for stat preview
  const allEffects: Effect[] = contentRefs.flatMap(
    (ref) => ref.content_definitions?.effects ?? [],
  );

  // Get choice effects from race and subrace
  const raceChoices: ChoiceEffect[] = (selectedRaceContent?.effects ?? []).filter(
    (e): e is ChoiceEffect => e.type === "choice",
  );
  const subraceChoices: ChoiceEffect[] = (
    selectedSubraceContent?.effects ?? []
  ).filter((e): e is ChoiceEffect => e.type === "choice");

  async function handleSelectRace(content: ContentEntry) {
    setPreviewContent(null);

    const newChoices = {
      ...localChoices,
      race: content.slug,
      subrace: undefined,
    };
    setLocalChoices(newChoices);

    // Save to database
    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);

    // Remove old race content ref (if any)
    const oldRaceRef = contentRefs.find(
      (ref) => ref.content_definitions?.content_type === "race",
    );
    if (oldRaceRef) {
      await supabase
        .from("character_content_refs")
        .delete()
        .eq("id", oldRaceRef.id);
    }

    // Remove old subrace content ref (if any)
    const oldSubraceRef = contentRefs.find(
      (ref) => ref.content_definitions?.content_type === "subrace",
    );
    if (oldSubraceRef) {
      await supabase
        .from("character_content_refs")
        .delete()
        .eq("id", oldSubraceRef.id);
    }

    // Create new content ref
    await supabase.from("character_content_refs").insert([
      {
        character_id: characterId,
        content_id: content.id,
        content_version: content.version,
        context: { source: "race" },
      },
    ]);

    startTransition(() => router.refresh());
  }

  async function handleSelectSubrace(subrace: ContentEntry) {
    const newChoices = { ...localChoices, subrace: subrace.slug };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);

    // Remove old subrace ref
    const oldSubraceRef = contentRefs.find(
      (ref) => ref.content_definitions?.content_type === "subrace",
    );
    if (oldSubraceRef) {
      await supabase
        .from("character_content_refs")
        .delete()
        .eq("id", oldSubraceRef.id);
    }

    // Create new content ref
    await supabase.from("character_content_refs").insert([
      {
        character_id: characterId,
        content_id: subrace.id,
        content_version: subrace.version,
        context: { source: "subrace" },
      },
    ]);

    startTransition(() => router.refresh());
  }

  async function handleChangeRace() {
    const newChoices = {
      ...localChoices,
      race: undefined,
      subrace: undefined,
    };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);

    // Remove race and subrace content refs
    const raceRefs = contentRefs.filter(
      (ref) =>
        ref.content_definitions?.content_type === "race" ||
        ref.content_definitions?.content_type === "subrace",
    );
    for (const ref of raceRefs) {
      await supabase
        .from("character_content_refs")
        .delete()
        .eq("id", ref.id);
    }

    startTransition(() => router.refresh());
  }

  async function handleChoiceSelect(choiceId: string, selections: string[]) {
    const newResolved = {
      ...localChoices.resolved_choices,
      [choiceId]: selections,
    };
    const newChoices = { ...localChoices, resolved_choices: newResolved };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">{raceTypeLabel}</h2>

        {hasRace && selectedRaceContent ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{selectedRaceContent.name}</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleChangeRace}
                  >
                    Change {raceTypeLabel}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedRaceContent.data.description && (
                  <p className="text-sm text-muted-foreground">
                    {String(selectedRaceContent.data.description)}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 text-sm">
                  {selectedRaceContent.data.speed && (
                    <Badge variant="outline">
                      Speed: {String(selectedRaceContent.data.speed)} ft
                    </Badge>
                  )}
                  {selectedRaceContent.data.size && (
                    <Badge variant="outline" className="capitalize">
                      Size: {String(selectedRaceContent.data.size)}
                    </Badge>
                  )}
                </div>

                {/* Grants from race */}
                {selectedRaceContent.effects
                  .filter((e) => e.type === "grant")
                  .length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Traits</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedRaceContent.effects
                        .filter((e) => e.type === "grant")
                        .map((e, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {(e as { stat: string }).stat}:{" "}
                            {(e as { value: string }).value}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}

                {/* Race choices */}
                {raceChoices.map((choice) => (
                  <ChoiceSelector
                    key={choice.choice_id}
                    choiceEffect={choice}
                    currentSelections={
                      localChoices.resolved_choices?.[choice.choice_id] ?? []
                    }
                    onSelect={(selections) =>
                      handleChoiceSelect(choice.choice_id, selections)
                    }
                  />
                ))}
              </CardContent>
            </Card>

            {/* Subrace selector */}
            {availableSubraces.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Subrace</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedSubraceContent ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">
                          {selectedSubraceContent.name}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newChoices = {
                              ...localChoices,
                              subrace: undefined,
                            };
                            setLocalChoices(newChoices);
                            supabase
                              .from("characters")
                              .update({ choices: newChoices })
                              .eq("id", characterId);
                            startTransition(() => router.refresh());
                          }}
                        >
                          Change Subrace
                        </Button>
                      </div>
                      {selectedSubraceContent.data.description && (
                        <p className="text-sm text-muted-foreground">
                          {String(selectedSubraceContent.data.description)}
                        </p>
                      )}
                      {subraceChoices.map((choice) => (
                        <ChoiceSelector
                          key={choice.choice_id}
                          choiceEffect={choice}
                          currentSelections={
                            localChoices.resolved_choices?.[
                              choice.choice_id
                            ] ?? []
                          }
                          onSelect={(selections) =>
                            handleChoiceSelect(choice.choice_id, selections)
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {availableSubraces.map((sr) => (
                        <Card
                          key={sr.id}
                          className="cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => handleSelectSubrace(sr)}
                        >
                          <CardContent className="p-3">
                            <p className="font-medium text-sm">{sr.name}</p>
                            {sr.data.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {String(sr.data.description).slice(0, 100)}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <ContentBrowser
            entries={races}
            contentTypeLabel={raceTypeLabel}
            onSelect={setPreviewContent}
          />
        )}

        <ContentPreview
          content={previewContent}
          contentTypeLabel={raceTypeLabel}
          onConfirm={handleSelectRace}
          onCancel={() => setPreviewContent(null)}
        />

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/characters/${characterId}/builder/class`)
            }
          >
            Previous: Class
          </Button>
          <Button
            onClick={() =>
              router.push(`/characters/${characterId}/builder/background`)
            }
          >
            Next: Background
          </Button>
        </div>
      </div>

      {schema && (
        <div className="hidden lg:block">
          <StatPreview
            baseStats={character.base_stats ?? {}}
            effects={allEffects}
            schema={schema}
            level={character.level}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```
git add app/(app)/characters/[id]/builder/race/page.tsx app/(app)/characters/[id]/builder/race/race-step-client.tsx
git commit -m "feat: add race builder step — selection, subrace, and trait choices"
```

---

## Task 16: Background Step

**Files:**
- Create: `app/(app)/characters/[id]/builder/background/page.tsx`
- Create: `app/(app)/characters/[id]/builder/background/background-step-client.tsx`

- [ ] **Step 1: Create the background step server page**

Create `app/(app)/characters/[id]/builder/background/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { BackgroundStepClient } from "./background-step-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BackgroundStepPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: character } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (!character || character.user_id !== user.id) notFound();

  const { data: backgroundContent } = await supabase
    .from("content_definitions")
    .select("id, name, slug, content_type, data, effects, version, source")
    .eq("system_id", character.system_id)
    .eq("content_type", "background")
    .order("name");

  const { data: contentRefs } = await supabase
    .from("character_content_refs")
    .select("*, content_definitions (id, name, slug, content_type, data, effects)")
    .eq("character_id", id);

  return (
    <BackgroundStepClient
      characterId={id}
      character={character}
      backgrounds={backgroundContent ?? []}
      contentRefs={contentRefs ?? []}
      schema={character.game_systems?.schema_definition}
    />
  );
}
```

- [ ] **Step 2: Create the background step client component**

Create `app/(app)/characters/[id]/builder/background/background-step-client.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ContentBrowser, type ContentEntry } from "@/components/builder/content-browser";
import { ContentPreview } from "@/components/builder/content-preview";
import { ChoiceSelector } from "@/components/builder/choice-selector";
import { StatPreview } from "@/components/builder/stat-preview";
import type { CharacterChoices } from "@/lib/types/character";
import type { SystemSchemaDefinition } from "@/lib/types/system";
import type { Effect, ChoiceEffect } from "@/lib/types/effects";

interface BackgroundStepClientProps {
  characterId: string;
  character: {
    id: string;
    level: number;
    base_stats: Record<string, number>;
    choices: CharacterChoices;
  };
  backgrounds: ContentEntry[];
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
    };
  }>;
  schema: SystemSchemaDefinition | undefined;
}

export function BackgroundStepClient({
  characterId,
  character,
  backgrounds,
  contentRefs,
  schema,
}: BackgroundStepClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
  const [previewContent, setPreviewContent] = useState<ContentEntry | null>(null);
  const [localChoices, setLocalChoices] = useState<CharacterChoices>(
    character.choices ?? {},
  );

  const selectedBackground = localChoices.background;
  const hasBackground = !!selectedBackground;
  const selectedBgContent = backgrounds.find(
    (b) => b.slug === selectedBackground,
  );

  const allEffects: Effect[] = contentRefs.flatMap(
    (ref) => ref.content_definitions?.effects ?? [],
  );

  const bgChoices: ChoiceEffect[] = (selectedBgContent?.effects ?? []).filter(
    (e): e is ChoiceEffect => e.type === "choice",
  );

  // Personality tables from background data
  const personalityTraits =
    (selectedBgContent?.data.personality_traits as string[] | undefined) ?? [];
  const ideals =
    (selectedBgContent?.data.ideals as string[] | undefined) ?? [];
  const bonds =
    (selectedBgContent?.data.bonds as string[] | undefined) ?? [];
  const flaws =
    (selectedBgContent?.data.flaws as string[] | undefined) ?? [];

  async function handleSelectBackground(content: ContentEntry) {
    setPreviewContent(null);

    const newChoices = {
      ...localChoices,
      background: content.slug,
      personality_traits: [],
      ideals: [],
      bonds: [],
      flaws: [],
    };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);

    // Remove old background ref
    const oldRef = contentRefs.find(
      (ref) => ref.content_definitions?.content_type === "background",
    );
    if (oldRef) {
      await supabase
        .from("character_content_refs")
        .delete()
        .eq("id", oldRef.id);
    }

    await supabase.from("character_content_refs").insert([
      {
        character_id: characterId,
        content_id: content.id,
        content_version: content.version,
        context: { source: "background" },
      },
    ]);

    startTransition(() => router.refresh());
  }

  async function handleChangeBackground() {
    const newChoices = {
      ...localChoices,
      background: undefined,
      personality_traits: [],
      ideals: [],
      bonds: [],
      flaws: [],
    };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);

    const bgRef = contentRefs.find(
      (ref) => ref.content_definitions?.content_type === "background",
    );
    if (bgRef) {
      await supabase
        .from("character_content_refs")
        .delete()
        .eq("id", bgRef.id);
    }

    startTransition(() => router.refresh());
  }

  async function handleNarrativeChange(
    field: "personality_traits" | "ideals" | "bonds" | "flaws",
    value: string[],
  ) {
    const newChoices = { ...localChoices, [field]: value };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);
  }

  async function handleChoiceSelect(choiceId: string, selections: string[]) {
    const newResolved = {
      ...localChoices.resolved_choices,
      [choiceId]: selections,
    };
    const newChoices = { ...localChoices, resolved_choices: newResolved };
    setLocalChoices(newChoices);

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);
  }

  function NarrativeSelector({
    label,
    field,
    options,
    max,
  }: {
    label: string;
    field: "personality_traits" | "ideals" | "bonds" | "flaws";
    options: string[];
    max: number;
  }) {
    const current = localChoices[field] ?? [];

    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {label} ({current.length}/{max})
        </p>
        {options.length > 0 ? (
          <div className="space-y-1">
            {options.map((option, i) => {
              const isSelected = current.includes(option);
              const isDisabled = !isSelected && current.length >= max;

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      handleNarrativeChange(
                        field,
                        current.filter((v) => v !== option),
                      );
                    } else if (!isDisabled) {
                      handleNarrativeChange(field, [...current, option]);
                    }
                  }}
                  disabled={isDisabled}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm border transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : isDisabled
                        ? "bg-muted text-muted-foreground border-border cursor-not-allowed opacity-50"
                        : "bg-card text-card-foreground border-border hover:bg-accent hover:text-accent-foreground cursor-pointer"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        ) : (
          <Input
            placeholder={`Enter custom ${label.toLowerCase()}`}
            value={current[0] ?? ""}
            onChange={(e) => handleNarrativeChange(field, [e.target.value])}
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Background</h2>

        {hasBackground && selectedBgContent ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{selectedBgContent.name}</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleChangeBackground}
                  >
                    Change Background
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedBgContent.data.description && (
                  <p className="text-sm text-muted-foreground">
                    {String(selectedBgContent.data.description)}
                  </p>
                )}

                {selectedBgContent.effects
                  .filter((e) => e.type === "grant")
                  .length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedBgContent.effects
                      .filter((e) => e.type === "grant")
                      .map((e, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {(e as { stat: string }).stat}:{" "}
                          {(e as { value: string }).value}
                        </Badge>
                      ))}
                  </div>
                )}

                {bgChoices.map((choice) => (
                  <ChoiceSelector
                    key={choice.choice_id}
                    choiceEffect={choice}
                    currentSelections={
                      localChoices.resolved_choices?.[choice.choice_id] ?? []
                    }
                    onSelect={(selections) =>
                      handleChoiceSelect(choice.choice_id, selections)
                    }
                  />
                ))}
              </CardContent>
            </Card>

            <Separator />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Personality</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <NarrativeSelector
                  label="Personality Traits"
                  field="personality_traits"
                  options={personalityTraits}
                  max={2}
                />
                <NarrativeSelector
                  label="Ideals"
                  field="ideals"
                  options={ideals}
                  max={1}
                />
                <NarrativeSelector
                  label="Bonds"
                  field="bonds"
                  options={bonds}
                  max={1}
                />
                <NarrativeSelector
                  label="Flaws"
                  field="flaws"
                  options={flaws}
                  max={1}
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          <ContentBrowser
            entries={backgrounds}
            contentTypeLabel="Background"
            onSelect={setPreviewContent}
          />
        )}

        <ContentPreview
          content={previewContent}
          contentTypeLabel="Background"
          onConfirm={handleSelectBackground}
          onCancel={() => setPreviewContent(null)}
        />

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
            onClick={() =>
              router.push(`/characters/${characterId}/builder/abilities`)
            }
          >
            Next: Abilities
          </Button>
        </div>
      </div>

      {schema && (
        <div className="hidden lg:block">
          <StatPreview
            baseStats={character.base_stats ?? {}}
            effects={allEffects}
            schema={schema}
            level={character.level}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```
git add app/(app)/characters/[id]/builder/background/page.tsx app/(app)/characters/[id]/builder/background/background-step-client.tsx
git commit -m "feat: add background builder step — selection, choices, and personality traits"
```

---

## Task 17: Abilities Step

**Files:**
- Create: `app/(app)/characters/[id]/builder/abilities/page.tsx`
- Create: `app/(app)/characters/[id]/builder/abilities/abilities-step-client.tsx`

- [ ] **Step 1: Create the abilities step server page**

Create `app/(app)/characters/[id]/builder/abilities/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { AbilitiesStepClient } from "./abilities-step-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AbilitiesStepPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: character } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (!character || character.user_id !== user.id) notFound();

  const { data: contentRefs } = await supabase
    .from("character_content_refs")
    .select("*, content_definitions (id, name, slug, content_type, data, effects)")
    .eq("character_id", id);

  return (
    <AbilitiesStepClient
      characterId={id}
      character={character}
      contentRefs={contentRefs ?? []}
      schema={character.game_systems?.schema_definition}
    />
  );
}
```

- [ ] **Step 2: Create the abilities step client component**

Create `app/(app)/characters/[id]/builder/abilities/abilities-step-client.tsx`:

```tsx
"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { StatPreview } from "@/components/builder/stat-preview";
import type { CharacterChoices } from "@/lib/types/character";
import type { SystemSchemaDefinition, AbilityScoreDefinition } from "@/lib/types/system";
import type { Effect, MechanicalEffect } from "@/lib/types/effects";

type AbilityMethod = "standard_array" | "point_buy" | "manual";

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const POINT_BUY_BUDGET = 27;
const POINT_BUY_COSTS: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};

interface AbilitiesStepClientProps {
  characterId: string;
  character: {
    id: string;
    level: number;
    base_stats: Record<string, number>;
    choices: CharacterChoices;
  };
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
    };
  }>;
  schema: SystemSchemaDefinition | undefined;
}

export function AbilitiesStepClient({
  characterId,
  character,
  contentRefs,
  schema,
}: AbilitiesStepClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const abilities = schema?.ability_scores ?? [];

  const [method, setMethod] = useState<AbilityMethod>(
    character.choices?.ability_method ?? "standard_array",
  );
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const existing = character.base_stats ?? {};
    if (Object.keys(existing).length > 0) return existing;
    // Default: all scores at 10 for manual, empty for standard_array
    const defaults: Record<string, number> = {};
    for (const ability of abilities) {
      defaults[ability.slug] = method === "point_buy" ? 8 : 10;
    }
    return defaults;
  });

  // For standard array: track which array value is assigned to which ability
  const [arrayAssignments, setArrayAssignments] = useState<Record<string, number>>(() => {
    if (character.choices?.ability_method === "standard_array") {
      return character.base_stats ?? {};
    }
    return {};
  });

  const allEffects: Effect[] = contentRefs.flatMap(
    (ref) => ref.content_definitions?.effects ?? [],
  );

  // Racial bonuses from effects
  const racialBonuses = useMemo(() => {
    const bonuses: Record<string, number> = {};
    for (const effect of allEffects) {
      if (
        effect.type === "mechanical" &&
        effect.op === "add" &&
        abilities.some((a) => a.slug === effect.stat)
      ) {
        bonuses[effect.stat] = (bonuses[effect.stat] ?? 0) + (typeof effect.value === "number" ? effect.value : 0);
      }
    }
    return bonuses;
  }, [allEffects, abilities]);

  // Point buy points remaining
  const pointsUsed = useMemo(() => {
    if (method !== "point_buy") return 0;
    return Object.values(scores).reduce(
      (sum, score) => sum + (POINT_BUY_COSTS[score] ?? 0),
      0,
    );
  }, [scores, method]);

  const currentScores = method === "standard_array" ? arrayAssignments : scores;

  async function saveScores(newScores: Record<string, number>) {
    const newChoices = { ...character.choices, ability_method: method };

    await supabase
      .from("characters")
      .update({
        base_stats: newScores,
        choices: newChoices,
      })
      .eq("id", characterId);
  }

  function handleMethodChange(newMethod: AbilityMethod) {
    setMethod(newMethod);
    const defaults: Record<string, number> = {};
    for (const ability of abilities) {
      defaults[ability.slug] = newMethod === "point_buy" ? 8 : 10;
    }
    setScores(defaults);
    setArrayAssignments({});
  }

  function handleStandardArrayAssign(abilitySlug: string, value: string) {
    const numValue = parseInt(value);
    if (isNaN(numValue)) return;

    const newAssignments = { ...arrayAssignments };

    // Remove this value from any other ability
    for (const key of Object.keys(newAssignments)) {
      if (newAssignments[key] === numValue && key !== abilitySlug) {
        delete newAssignments[key];
      }
    }

    if (numValue === 0) {
      delete newAssignments[abilitySlug];
    } else {
      newAssignments[abilitySlug] = numValue;
    }

    setArrayAssignments(newAssignments);
    saveScores(newAssignments);
  }

  function handlePointBuyChange(abilitySlug: string, delta: number) {
    const current = scores[abilitySlug] ?? 8;
    const next = current + delta;
    if (next < 8 || next > 15) return;

    const newScores = { ...scores, [abilitySlug]: next };
    const newPointsUsed = Object.values(newScores).reduce(
      (sum, score) => sum + (POINT_BUY_COSTS[score] ?? 0),
      0,
    );
    if (newPointsUsed > POINT_BUY_BUDGET) return;

    setScores(newScores);
    saveScores(newScores);
  }

  function handleManualChange(abilitySlug: string, value: string) {
    const numValue = parseInt(value);
    if (isNaN(numValue) || numValue < 1 || numValue > 30) return;

    const newScores = { ...scores, [abilitySlug]: numValue };
    setScores(newScores);
    saveScores(newScores);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Ability Scores</h2>

        {/* Method selector */}
        <div className="space-y-2">
          <Label>Method</Label>
          <div className="flex gap-2">
            {(
              [
                { value: "standard_array", label: "Standard Array" },
                { value: "point_buy", label: "Point Buy" },
                { value: "manual", label: "Manual Entry" },
              ] as const
            ).map(({ value, label }) => (
              <Button
                key={value}
                variant={method === value ? "default" : "outline"}
                size="sm"
                onClick={() => handleMethodChange(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {method === "point_buy" && (
          <p className="text-sm text-muted-foreground">
            Points remaining:{" "}
            <span className="font-bold">
              {POINT_BUY_BUDGET - pointsUsed} / {POINT_BUY_BUDGET}
            </span>
          </p>
        )}

        {method === "standard_array" && (
          <p className="text-sm text-muted-foreground">
            Assign these values: {STANDARD_ARRAY.join(", ")}
          </p>
        )}

        {/* Ability score grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {abilities.map((ability) => {
            const base = currentScores[ability.slug] ?? 0;
            const bonus = racialBonuses[ability.slug] ?? 0;
            const total = base + bonus;
            const mod = Math.floor((total - 10) / 2);

            return (
              <Card key={ability.slug}>
                <CardContent className="p-4 text-center space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    {ability.name}
                  </p>

                  {method === "standard_array" && (
                    <select
                      value={arrayAssignments[ability.slug] ?? ""}
                      onChange={(e) =>
                        handleStandardArrayAssign(ability.slug, e.target.value)
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-center text-lg font-bold"
                    >
                      <option value="">--</option>
                      {STANDARD_ARRAY.map((val) => {
                        const assignedTo = Object.entries(
                          arrayAssignments,
                        ).find(
                          ([, v]) => v === val,
                        )?.[0];
                        const isAvailable =
                          !assignedTo || assignedTo === ability.slug;
                        return (
                          <option
                            key={val}
                            value={val}
                            disabled={!isAvailable}
                          >
                            {val}
                          </option>
                        );
                      })}
                    </select>
                  )}

                  {method === "point_buy" && (
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handlePointBuyChange(ability.slug, -1)
                        }
                        disabled={
                          (scores[ability.slug] ?? 8) <= 8
                        }
                        className="h-8 w-8 p-0"
                      >
                        -
                      </Button>
                      <span className="text-2xl font-bold w-10 text-center">
                        {scores[ability.slug] ?? 8}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handlePointBuyChange(ability.slug, 1)
                        }
                        disabled={
                          (scores[ability.slug] ?? 8) >= 15
                        }
                        className="h-8 w-8 p-0"
                      >
                        +
                      </Button>
                    </div>
                  )}

                  {method === "manual" && (
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={scores[ability.slug] ?? 10}
                      onChange={(e) =>
                        handleManualChange(ability.slug, e.target.value)
                      }
                      className="text-center text-lg font-bold"
                    />
                  )}

                  {bonus !== 0 && (
                    <p className="text-xs text-muted-foreground">
                      Racial: {bonus > 0 ? "+" : ""}
                      {bonus}
                    </p>
                  )}

                  <Separator />

                  <div>
                    <p className="text-lg font-bold">{total || "--"}</p>
                    <p className="text-sm text-muted-foreground">
                      {total
                        ? `${mod >= 0 ? "+" : ""}${mod}`
                        : "--"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/characters/${characterId}/builder/background`)
            }
          >
            Previous: Background
          </Button>
          <Button
            onClick={() =>
              router.push(`/characters/${characterId}/builder/equipment`)
            }
          >
            Next: Equipment
          </Button>
        </div>
      </div>

      {schema && (
        <div className="hidden lg:block">
          <StatPreview
            baseStats={currentScores}
            effects={allEffects}
            schema={schema}
            level={character.level}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```
git add app/(app)/characters/[id]/builder/abilities/page.tsx app/(app)/characters/[id]/builder/abilities/abilities-step-client.tsx
git commit -m "feat: add abilities builder step — standard array, point buy, and manual entry"
```

---

## Task 18: Equipment Step (Placeholder)

**Files:**
- Create: `app/(app)/characters/[id]/builder/equipment/page.tsx`
- Create: `app/(app)/characters/[id]/builder/equipment/equipment-step-client.tsx`

- [ ] **Step 1: Create the equipment step server page**

Create `app/(app)/characters/[id]/builder/equipment/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { EquipmentStepClient } from "./equipment-step-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EquipmentStepPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: character } = await supabase
    .from("characters")
    .select("*, game_systems (id, name, slug, schema_definition)")
    .eq("id", id)
    .single();

  if (!character || character.user_id !== user.id) notFound();

  // Load class content to get starting equipment bundles
  const classSlug = character.choices?.classes?.[0]?.slug;
  let classContent = null;
  if (classSlug) {
    const { data } = await supabase
      .from("content_definitions")
      .select("id, name, slug, data")
      .eq("system_id", character.system_id)
      .eq("content_type", "class")
      .eq("slug", classSlug)
      .single();
    classContent = data;
  }

  return (
    <EquipmentStepClient
      characterId={id}
      character={character}
      classContent={classContent}
    />
  );
}
```

- [ ] **Step 2: Create the equipment step client component**

Create `app/(app)/characters/[id]/builder/equipment/equipment-step-client.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CharacterChoices } from "@/lib/types/character";

interface EquipmentStepClientProps {
  characterId: string;
  character: {
    id: string;
    level: number;
    choices: CharacterChoices;
  };
  classContent: {
    id: string;
    name: string;
    slug: string;
    data: Record<string, unknown>;
  } | null;
}

export function EquipmentStepClient({
  characterId,
  character,
  classContent,
}: EquipmentStepClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string>(
    character.choices?.starting_equipment ?? "",
  );

  // Try to get equipment bundles from class data
  const equipmentBundles =
    (classContent?.data?.starting_equipment as
      | Array<{ label: string; items: string[] }>
      | undefined) ?? [];
  const startingGold = classContent?.data?.starting_gold as string | undefined;

  async function handleSelect(bundle: string) {
    setSelected(bundle);

    const newChoices = {
      ...character.choices,
      starting_equipment: bundle,
    };

    await supabase
      .from("characters")
      .update({ choices: newChoices })
      .eq("id", characterId);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Starting Equipment</h2>

      {equipmentBundles.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choose one of the starting equipment packages for your class.
          </p>
          {equipmentBundles.map((bundle, i) => {
            const bundleId = `bundle_${i}`;
            const isSelected = selected === bundleId;

            return (
              <Card
                key={bundleId}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? "border-primary bg-accent/50"
                    : "hover:bg-accent/30"
                }`}
                onClick={() => handleSelect(bundleId)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? "border-primary"
                          : "border-muted-foreground"
                      }`}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{bundle.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {bundle.items.join(", ")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {startingGold && (
            <Card
              className={`cursor-pointer transition-colors ${
                selected === "gold"
                  ? "border-primary bg-accent/50"
                  : "hover:bg-accent/30"
              }`}
              onClick={() => handleSelect("gold")}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selected === "gold"
                        ? "border-primary"
                        : "border-muted-foreground"
                    }`}
                  >
                    {selected === "gold" && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">Starting Gold</p>
                    <p className="text-xs text-muted-foreground">
                      {startingGold}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Equipment</CardTitle>
            <CardDescription>
              {classContent
                ? "No starting equipment bundles defined for this class."
                : "Select a class first to see starting equipment options."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Full equipment and inventory management will be available in a
              future update.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={() =>
            router.push(`/characters/${characterId}/builder/abilities`)
          }
        >
          Previous: Abilities
        </Button>
        <Button
          onClick={() => router.push(`/characters/${characterId}`)}
        >
          Finish &amp; Return to Dashboard
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```
git add app/(app)/characters/[id]/builder/equipment/page.tsx app/(app)/characters/[id]/builder/equipment/equipment-step-client.tsx
git commit -m "feat: add equipment builder step — placeholder with starting equipment bundles"
```

---

## Task 19: Final Verification

- [ ] **Step 1: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Fix any type errors that arise. Common issues: missing imports, incorrect generic arguments, async params types.

- [ ] **Step 2: Run ESLint**

```bash
npm run lint
```

Fix any linting issues. Common issues: unused variables, missing keys, any-types.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Ensure all tests pass, including the new ones from Tasks 3, 4, 12, and 13.

- [ ] **Step 4: Build verification**

```bash
npm run build
```

Ensure the production build completes without errors.

- [ ] **Step 5: Final commit (if any fixes needed)**

```
git add -A
git commit -m "fix: resolve type check and lint issues from character builder implementation"
```
