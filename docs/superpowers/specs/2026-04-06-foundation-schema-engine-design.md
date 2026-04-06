# Inkborne — Foundation & System Schema Engine Design Spec

**Date:** 2026-04-06
**Sub-project:** 1 of 9 — Foundation + System Schema Engine
**Scope:** Project scaffold, auth, database schema, expression engine, system schema definition, access control

---

## Overview

This is the first sub-project in the Inkborne build. It establishes the project scaffold, authentication, database schema, expression engine, and the system schema definition format that all downstream sub-projects depend on. No user-facing features are built here beyond auth and a basic dashboard shell — the goal is a solid foundation that the character builder, campaign management, and homebrew systems plug into.

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 15 (App Router) | Server components for fast loads, client components for interactive sheets. Mature App Router. |
| Styling | Tailwind CSS v4 | Utility-first, already in the developer's toolbox. |
| UI Components | shadcn/ui (Radix primitives) | Accessible, unstyled, copied into repo — not a dependency. Forms, dialogs, tabs, dropdowns. |
| Rich Text | Tiptap (ProseMirror) | Block-based editor for character backstories and narrative content. Extensible, headless, React-compatible. |
| Language | TypeScript (strict) | Essential for type safety across JSONB schemas, expression engine, and content payloads. |
| Backend/DB | Supabase (Postgres + RLS + Auth + Realtime + Storage) | Familiar to developer. RLS maps to content scoping. Auth handles email + OAuth. Realtime for future campaign features. Storage for character images. |
| Hosting | Vercel | Natural Next.js pairing. Preview deployments for iteration. |
| Validation | Zod | Runtime validation for JSONB data with TypeScript type inference. |

---

## Authentication

Three auth methods via Supabase Auth:

1. **Email + Password** — email verification required
2. **Discord OAuth** — primary audience lives on Discord
3. **Google OAuth** — universal fallback

On signup, a database trigger creates a row in the `profiles` table linked to `auth.users`. The profile stores display name, avatar URL, and bio.

---

## Database Schema

### 10 Foundation Tables

Organized into three groups: Identity & Access, System & Content, Homebrew & Sharing.

#### Identity & Access

**profiles**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | References auth.users |
| display_name | text | |
| avatar_url | text | |
| bio | text | |
| created_at | timestamptz | |

**campaigns**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| system_id | uuid FK → game_systems | |
| owner_id | uuid FK → profiles | The DM |
| name | text | |
| description | text | |
| invite_code | text unique | For player invitations |
| created_at | timestamptz | |

**campaign_members**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| campaign_id | uuid FK → campaigns | |
| user_id | uuid FK → profiles | |
| role | text | "dm" or "player" |
| joined_at | timestamptz | |

**characters**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → profiles | Owner |
| system_id | uuid FK → game_systems | |
| campaign_id | uuid FK → campaigns | Nullable — character may not be in a campaign |
| name | text | |
| visibility | text | "private", "campaign", or "public" |
| archived | bool | Soft delete |
| created_at | timestamptz | |

> Full character data columns (base_stats, choices, state, level, etc.) are added in the Character Builder sub-project. This table is created now for RLS policy dependencies.

#### System & Content

**game_systems**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| slug | text unique | e.g., "dnd-5e-2024" |
| name | text | e.g., "D&D 5th Edition (2024)" |
| version_label | text | e.g., "2024 Rules" |
| schema_definition | jsonb | Full system blueprint (see System Schema Definition section) |
| expression_context | jsonb | Base formulas and built-in functions |
| status | text | "draft" or "published" |
| created_at | timestamptz | |

> Game systems are platform-controlled. Only the Inkborne team (or trusted contributors) authors these. Users cannot create new game systems.

**content_definitions**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| system_id | uuid FK → game_systems | |
| content_type | text | System types: "species", "class", "subclass", "spell", "feat", "item", etc. For custom content types, this matches the custom type's slug (e.g., "ship_roles"). |
| slug | text | |
| name | text | |
| data | jsonb | Content payload — varies by content_type |
| effects | jsonb[] | Array of effects (see Expression Engine section) |
| source | text | "srd" or "homebrew" |
| scope | text | "platform", "personal", or "shared" |
| owner_id | uuid FK → profiles | Null for platform content |
| version | int | Current version number |
| created_at | timestamptz | |

**content_versions**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| content_id | uuid FK → content_definitions | |
| version | int | |
| data_snapshot | jsonb | Frozen copy of data at this version |
| effects_snapshot | jsonb[] | Frozen copy of effects at this version |
| changelog | text | What changed |
| created_at | timestamptz | |

> When content is updated, a new version row is created with a snapshot of the previous state. Characters reference content at a specific version via `character_content_refs` (created in the Character Builder sub-project).

#### Homebrew & Sharing

**custom_content_types**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| system_id | uuid FK → game_systems | |
| owner_id | uuid FK → profiles | Creator and sole editor |
| slug | text | e.g., "ship_roles" |
| name | text | e.g., "Ship Roles" |
| description | text | |
| allow_multiple | bool | Can a character have more than one? |
| entry_conditions | jsonb | When can a character first pick one? Array of conditions. |
| has_progression | bool | Does this type have tiered progression? |
| scope | text | "personal" or "shared" |
| version | int | |

**content_shares**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| content_id | uuid FK → content_definitions | |
| campaign_id | uuid FK → campaigns | |
| shared_by | uuid FK → profiles | Must be a member of the campaign |
| shared_at | timestamptz | |

> Any campaign member can share their own homebrew content with any campaign they belong to. One piece of content can be shared to multiple campaigns. Sharing grants read access only — the owner retains edit rights.

**content_type_shares**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| content_type_id | uuid FK → custom_content_types | |
| campaign_id | uuid FK → campaigns | |
| shared_by | uuid FK → profiles | Must be a member of the campaign |
| shared_at | timestamptz | |

> Sharing a custom content type shares the type definition and all its content entries with the campaign.

---

## Row Level Security Policies

### Content Visibility (content_definitions)
- **platform** scope → visible to all authenticated users
- **personal** scope → visible to owner only
- **shared** scope → visible to owner + members of any campaign listed in `content_shares`

### Character Visibility (characters)
- **private** → owner + DM of the character's campaign
- **campaign** → owner + all members of the character's campaign
- **public** → all authenticated users

### Campaign Visibility (campaigns)
- Visible to campaign members only
- Editable by DM (owner) only

### Custom Content Types (custom_content_types)
- **personal** scope → owner only
- **shared** scope → owner + members of campaigns listed in `content_type_shares`

### Edit Access (all tables)
- Characters → owner only (DM can view but not edit)
- Content definitions → owner only
- Custom content types → owner only
- Campaigns → DM manages settings; members can leave
- Content shares → any campaign member can share their own content

---

## Expression Engine

The expression engine computes derived character stats (AC, initiative, spell save DC, etc.) from base values and content effects. It runs client-side for instant feedback and is a pure TypeScript module that can also run server-side for PDF export or API responses.

### Three Tiers of Effects

Content (species, classes, feats, homebrew, custom content types) carries an `effects` array. Each effect modifies character stats through one of three tiers:

#### Tier 1: Static Effects

Covers ~90% of homebrew needs. Form-based UI — DM picks stat, operation, and value from dropdowns.

```json
{ "type": "mechanical", "stat": "dexterity", "op": "add", "value": 2 }
{ "type": "mechanical", "stat": "darkvision", "op": "set", "value": 60 }
{ "type": "mechanical", "stat": "perception", "op": "grant", "value": "proficient" }
```

Operations: `add`, `set`, `multiply`, `grant` (proficiencies/features), `max`, `min`

#### Tier 2: Expressions

Formulas that reference other stats. Text input with autocomplete. AI can generate these from natural language descriptions.

```json
{ "type": "mechanical", "stat": "armor_class", "op": "formula", "expr": "10 + mod(dexterity) + mod(constitution)" }
{ "type": "mechanical", "stat": "spell_save_dc", "op": "formula", "expr": "8 + proficiency_bonus + mod(spellcasting_ability)" }
```

Safe expression parser — arithmetic, stat references, and built-in functions: `mod()`, `max()`, `min()`, `floor()`, `ceil()`, `proficiency_if()`.

#### Tier 3: Scripts

Sandboxed JavaScript for complex conditional logic. Power user feature with code editor UI. AI-assisted generation from natural language.

```javascript
function compute(char) {
  if (!char.armor_equipped) {
    return {
      armor_class: 10 + char.mod("dex") + char.mod("con")
    };
  }
  return {};
}
```

Sandboxed runtime: no DOM, no network, no filesystem access. Character object is read-only. Function returns stat modifications.

### Effect Types

Each effect in the array has a `type` field:

- **mechanical** — modifies a stat value (processed by the expression engine)
- **narrative** — descriptive text displayed on the character sheet with no mechanical impact (e.g., `{ "type": "narrative", "text": "50% discount at org headquarters shop", "tag": "Organization Perk" }`)
- **grant** — grants proficiencies, features, or access permissions

Effects are anonymous — they don't carry names themselves. Named abilities come from the content that contains them. A feat called "Alert" has effects like `+5 to initiative`, but the name "Alert" lives on the `content_definition`, not on the individual effect. For progression tiers, the tier's name (e.g., "Expert Rigger") serves as the ability name, and its effects are listed beneath it.

### Evaluation Pipeline

1. **Base Stats** — load the character's raw ability scores and base values
2. **Collect Effects** — gather all effects from the character's content refs (species, class, feats, items, homebrew, custom content)
3. **Sort by Priority** — `set` → `add` → `multiply` → `formula` → `script`
4. **Evaluate** — apply each effect in priority order
5. **Cache** — store computed results in client-side memory; recompute only when underlying data changes

No computed values are persisted to the database. The source of truth is always base values + content refs.

---

## System Schema Definition

The `schema_definition` JSONB column in `game_systems` contains the full blueprint for a game system. This is authored by the Inkborne team and defines what a character looks like, how it's created, and how the sheet is organized.

### Schema Structure

```json
{
  "ability_scores": [
    { "slug": "strength", "name": "Strength", "abbr": "STR" },
    { "slug": "dexterity", "name": "Dexterity", "abbr": "DEX" }
    // ... all ability scores for this system
  ],

  "proficiency_levels": [
    { "slug": "none", "name": "Not Proficient", "multiplier": 0 },
    { "slug": "half", "name": "Half Proficiency", "multiplier": 0.5 },
    { "slug": "proficient", "name": "Proficient", "multiplier": 1 },
    { "slug": "expertise", "name": "Expertise", "multiplier": 2 }
  ],

  "derived_stats": [
    { "slug": "proficiency_bonus", "name": "Proficiency Bonus",
      "formula": "floor((level - 1) / 4) + 2" },
    { "slug": "armor_class", "name": "Armor Class",
      "formula": "10 + mod(dexterity)" },
    { "slug": "initiative", "name": "Initiative",
      "formula": "mod(dexterity)" },
    { "slug": "movement_speed", "name": "Speed", "base": 30 },
    { "slug": "hit_points_max", "name": "Hit Point Maximum",
      "formula": "hit_die_total + (mod(constitution) * level)" },
    { "slug": "passive_perception", "name": "Passive Perception",
      "formula": "10 + mod(wisdom) + proficiency_if('perception')" }
  ],

  "skills": [
    { "slug": "acrobatics", "name": "Acrobatics", "ability": "dexterity" },
    { "slug": "athletics", "name": "Athletics", "ability": "strength" }
    // ... all skills for this system
  ],

  "resources": [
    { "slug": "hit_points", "name": "Hit Points", "type": "current_max_temp" },
    { "slug": "hit_dice", "name": "Hit Dice", "type": "pool", "per": "level" },
    { "slug": "spell_slots", "name": "Spell Slots", "type": "slots_by_level",
      "levels": [1,2,3,4,5,6,7,8,9] },
    { "slug": "death_saves", "name": "Death Saves", "type": "success_fail",
      "max_each": 3 }
  ],

  "content_types": [
    { "slug": "species", "name": "Species", "required": true, "max": 1 },
    { "slug": "class", "name": "Class", "required": true, "max": null },
    { "slug": "subclass", "name": "Subclass", "parent": "class" },
    { "slug": "background", "name": "Background", "required": true, "max": 1 },
    { "slug": "feat", "name": "Feat", "max": null },
    { "slug": "spell", "name": "Spell" },
    { "slug": "item", "name": "Item" },
    { "slug": "weapon", "name": "Weapon" },
    { "slug": "armor", "name": "Armor" }
  ],

  "currencies": [
    { "slug": "cp", "name": "Copper", "rate": 1 },
    { "slug": "sp", "name": "Silver", "rate": 10 },
    { "slug": "ep", "name": "Electrum", "rate": 50 },
    { "slug": "gp", "name": "Gold", "rate": 100 },
    { "slug": "pp", "name": "Platinum", "rate": 1000 }
  ],

  "creation_steps": [
    { "step": 1, "type": "species", "label": "Choose Species" },
    { "step": 2, "type": "class", "label": "Choose Class" },
    { "step": 3, "type": "abilities", "label": "Set Ability Scores",
      "methods": ["standard_array", "point_buy", "manual"] },
    { "step": 4, "type": "background", "label": "Choose Background" },
    { "step": 5, "type": "equipment", "label": "Starting Equipment" },
    { "step": 6, "type": "details", "label": "Character Details",
      "fields": ["name", "alignment", "backstory", "appearance",
                 "personality_traits", "ideals", "bonds", "flaws"] }
  ],

  "sheet_sections": [
    { "slug": "header", "label": "Character Header",
      "contains": ["name", "class_level", "species", "background"] },
    { "slug": "abilities", "label": "Ability Scores" },
    { "slug": "combat", "label": "Combat",
      "contains": ["armor_class", "initiative", "speed", "hit_points"] },
    { "slug": "skills", "label": "Skills & Saves" },
    { "slug": "actions", "label": "Actions", "tab": true },
    { "slug": "spells", "label": "Spells", "tab": true },
    { "slug": "inventory", "label": "Inventory", "tab": true },
    { "slug": "features", "label": "Features & Traits", "tab": true,
      "extension_zone": true },
    { "slug": "background", "label": "Background", "tab": true },
    { "slug": "notes", "label": "Notes", "tab": true },
    { "slug": "extras", "label": "Extras", "tab": true }
  ]
}
```

### Custom Skills

Players can add custom skills that integrate into the standard skills list. A custom skill defines a name, linked ability score, and proficiency level. Custom skills use the same formula as system skills: `mod(ability) + (proficiency_bonus * multiplier)`. They appear alphabetically alongside system skills with no visual distinction.

### Multi-System Support

Each game system gets its own schema definition. Dagger Heart would define different ability scores (Agility, Strength, Finesse), different resources (Hope, Stress), and different content types (Ancestry, Class, Subclass, Domain). The expression engine, content system, and character builder work identically — only the schema changes.

Game systems are versioned snapshots: "D&D 5e 2024" and "D&D 5e 2014" are separate systems. Characters belong to one system. No migration between system versions.

---

## Custom Content Types & Progression

DMs can create novel mechanic categories (Ship Roles, Organization Ranks, Piety Tracks) scoped to specific campaigns. These are not shoehorned into existing content types — they get their own section on the character sheet via the Features & Traits extension zone.

### Custom Content Type Definition

A custom content type defines:
- **name** and **description** — displayed on the character sheet
- **allow_multiple** — can a character have more than one (e.g., one ship role, but multiple organization memberships)?
- **entry_conditions** — when can a character first select one? Array of stat conditions.
- **has_progression** — does this type have tiered abilities that unlock over time?

### Progression Tracks

Each choice within a custom content type is a `content_definition` entry. The `content_type` field references the custom content type's slug (e.g., `"ship_roles"`), and the `data` JSONB contains the progression track as an ordered array of tiers.

A progression tier contains:
- **name** — the ability name (e.g., "Expert Rigger")
- **description** — flavor text
- **trigger** — how it unlocks:
  - `auto` with conditions: unlocks when any stat(s) reach a threshold (e.g., `level >= 8`, `gold >= 500`, `max_hp >= 50`). Uses the same condition syntax as entry_conditions: `{ "stat": "...", "op": "gte", "value": ... }`. Supports AND chaining of multiple conditions.
  - `manual`: player or DM explicitly advances to this tier via a button on the character sheet. DM can restrict manual advancement to DM-only.
- **effects** — array of mechanical, narrative, and grant effects

Each tier independently chooses its trigger type, so auto and manual triggers can be mixed within a single progression track.

### Example: Ship Roles (stat-gated)

```json
{
  "name": "Ship Roles",
  "allow_multiple": false,
  "entry_conditions": [{ "stat": "level", "op": "gte", "value": 4 }],
  "has_progression": true
}
```

Topman progression:
- **Tier 1: Expert Rigger** (auto: level >= 4) — +10 climbing speed
- **Tier 2: Crow's Nest Marksman** (auto: level >= 8) — ignore half cover, +2 ranged attacks from elevation
- **Tier 3: Storm Rider** (auto: level >= 12) — +10 movement speed, lightning resistance

### Example: Criminal Organization Ranks (mixed triggers)

```json
{
  "name": "Organization Rank",
  "allow_multiple": false,
  "entry_conditions": [],
  "has_progression": true
}
```

- **Tier 1: Underling** (manual) — advantage on Deception within org
- **Tier 2: Enforcer** (manual) — +1 Intimidation, narrative: "access to org safehouses"
- **Tier 3: Lieutenant** (auto: gold >= 5000) — command 2d4 thugs, +2 CHA for org dealings

### Character Sheet Display

Custom content types appear as filter tabs within the Features & Traits section (alongside Class Features, Species Traits, Feats). Each tier displays as a named ability with its effects (both mechanical and narrative) listed beneath it — matching the D&D Beyond Features & Traits pattern. Locked future tiers are shown grayed out with their unlock conditions.

### Version Pinning

Custom content types and their progression tiers follow the same version pinning model as all other content. When a DM updates a custom content type, existing characters remain on the pinned version until the player accepts the update.

---

## Content Sharing Model

Content ownership and sharing follow these rules:

1. **Platform content** (SRD) — created by the Inkborne team, visible to everyone, not editable by users
2. **Personal content** — created by a user, visible only to them until shared
3. **Shared content** — personal content that the owner has shared with specific campaigns

Any campaign member can share their own homebrew with any campaign they belong to. A single piece of content can be shared to multiple campaigns. Sharing grants read access only — the owner retains exclusive edit rights.

The `content_shares` table handles the many-to-many relationship between content and campaigns. The `content_type_shares` table does the same for custom content types (sharing the type shares all its content entries).

---

## Project Structure

```
inkborne/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Login, signup, OAuth callback
│   ├── (app)/                    # Authenticated app shell
│   │   ├── dashboard/            # User's characters & campaigns
│   │   ├── characters/           # Stub for Character Builder sub-project
│   │   └── campaigns/            # Stub for Campaign Management sub-project
│   ├── layout.tsx
│   └── page.tsx                  # Landing page
│
├── lib/                          # Shared logic
│   ├── supabase/                 # Client & server Supabase helpers
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── engine/                   # Expression engine
│   │   ├── evaluator.ts          # Core evaluation pipeline
│   │   ├── parser.ts             # Expression parser (Tier 2)
│   │   ├── sandbox.ts            # Script sandbox (Tier 3)
│   │   └── effects.ts            # Effect collection & sorting
│   ├── schemas/                  # Zod validation schemas
│   │   ├── system.ts             # Game system schema validation
│   │   ├── content.ts            # Content definition validation
│   │   ├── character.ts          # Character data validation
│   │   └── effects.ts            # Effect & expression validation
│   └── types/                    # TypeScript type definitions
│       ├── system.ts
│       ├── content.ts
│       └── character.ts
│
├── components/                   # React components
│   ├── ui/                       # shadcn/ui base components
│   └── auth/                     # Auth forms, OAuth buttons
│
├── supabase/                     # Supabase config
│   ├── migrations/               # SQL migrations (all 10 tables + RLS)
│   ├── seed.sql                  # D&D 5e 2024 system schema seed
│   └── config.toml
│
└── tests/                        # Tests
    ├── engine/                   # Expression engine unit tests
    └── schemas/                  # Schema validation tests
```

---

## What This Sub-Project Delivers

1. **Working auth** — signup, login, OAuth (Discord + Google), user profiles
2. **All 10 foundation tables** with migrations and RLS policies
3. **D&D 5e 2024 system schema** seeded into game_systems
4. **Expression engine** — evaluator, parser, effect collection (Tier 1 + 2 functional, Tier 3 stubbed)
5. **Zod validation schemas** for system definitions, content, effects, and characters
6. **TypeScript types** for all data structures
7. **Basic dashboard shell** — authenticated layout with navigation stubs
8. **Tests** for expression engine and schema validation

## What This Sub-Project Does NOT Deliver

- Character builder UI or character creation flow
- Character sheet view
- Campaign management UI (invites, player views, etc.)
- Homebrew creation forms
- PDF export
- Dice roller
- Any SRD content beyond the system schema definition itself (species, classes, spells, etc. come in the D&D 5e SRD Content sub-project)

---

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Launch system | D&D 5e 2014 SRD first, 2024 later | 2014 has structured API data (dnd5eapi.co); 2024 added as separate system once content is sourced from PDF/MPMB |
| System versioning | Separate snapshots | "D&D 5e 2024" and "D&D 5e 2014" are distinct systems, not versions of one system |
| Schema approach | Schema-as-Data | System definitions live in DB as structured JSON; enables multi-system without code deploys |
| System authoring | Platform-controlled | Only the Inkborne team creates game systems; users create content within systems |
| Effect system | 3-tier (static + expressions + scripts) | Covers 90% of homebrew with forms; expressions for formulas; scripts for power users |
| AI integration | Expression generation | AI translates natural language to Tier 2/3 expressions — makes the expression layer accessible |
| Sheet layout | Curated per system + extension zones | Hand-crafted layouts for polished UX; extension zones for homebrew sections |
| Content scoping | platform / personal / shared | Shared content uses many-to-many join table for multi-campaign sharing |
| Version pinning | Content referenced at specific version | Characters pin to a content version; updates don't propagate until player accepts |
| Custom content types | Campaign-scoped with progression | DMs create novel mechanics with stat-gated or manual progression tracks |
| Progression triggers | Stat-gated (any stat) + manual | Any computable stat can gate progression; manual for narrative milestones |
| Custom skills | Inline with system skills | Players add custom skills that appear alphabetically in the standard skills list |
| Character narrative | First-class pillar | Rich backstory editing (Tiptap), images, timelines, relationships — not an afterthought |
| Backend | Supabase | Developer familiarity; RLS fits content scoping; auth, realtime, storage included |
| Computed values | Never persisted | Expression engine recomputes on change; source of truth is base values + content refs |
