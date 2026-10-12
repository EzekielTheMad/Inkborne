# R16.1 concrete monster foundation contract — proposed for challenge

Documentation-only checkpoint, 2026-10-12 UTC. Worker
`r16-monster-worker`, branch `codex/r16-monster-foundation`, base `0c37775`.
This makes the scope in [the approved design plan](2026-10-12-monster-foundation-plan.md)
implementation-ready for independent challenge. It does not approve its own
implementation or accept R16/M5. No install, product code, SQL, seed, hosted
request, credential access, migration, server or browser was used for this design.

## Source and permission inventory

| Existing source | Observed boundary; proposed use |
| --- | --- |
| `docs/ROADMAP.md:209` | M5 requires monsters' AC, HP, attacks, saves, abilities, lair/legendary actions, entitled encyclopedia discovery, importer and separate DM campaign use. Only schema/read-only discovery/display is this child. |
| `lib/schemas/content.ts:4` | Definition envelope validates system UUID, nonempty type/slug/name, record data, validated effects, source/scope/owner and positive integer content version. Effects default to `[]`, content version to `1`. Existing Zod objects strip unknown envelope keys. This child does not change these contracts. |
| `lib/schemas/content-types/index.ts:18,54` | Fixed canonical registry and `parseContentByType`; unknown types fail. Existing ordinary object payload schemas strip unknown keys. Register only `monster`; leave every other type unchanged. |
| `lib/supabase/content-definitions-parser.ts:57,112,157` | Parse current definition envelope, then registered payload; invalid rows are logged/omitted. Version parser validates the complete immutable snapshot envelope and delegates to the same definition parser. No latest-parent substitution. No monster-specific parallel catalog/parser. |
| `supabase/migrations/00003_content.sql` | Canonical type is text, data/effects are JSONB; both tables enable RLS. The application registry is not a database JSON-schema constraint. |
| `supabase/migrations/20260720171627_content_version_pinning_and_rls.sql:42,150,196,239,559` | Unique identity `(system_id, content_type, slug, owner_id)`; official `srd/platform/null-owner` or `homebrew/personal-or-shared/non-null-owner` invariant. Trigger fixes initial version to 1; identity fields cannot change; name/data/effects/scope changes advance the version and create a self-contained snapshot. Snapshot UPDATE is rejected, authenticated has SELECT only on snapshots. Generic owner homebrew INSERT/UPDATE/DELETE policy is not a monster-authoring acceptance. |
| `supabase/migrations/20260720173545_content_version_policy_performance.sql:277,356` | Current catalog SELECT is authenticated platform, current owner, or shared membership via `private.can_access_campaign`. Snapshot SELECT additionally allows existing authorized character references/inventory/spells. Read permissions are not inferred from a client-selected scope or provenance label. |
| `supabase/migrations/20260722044333_background_authoring_sharing.sql:6,47,205` | Latest existing `set_content_campaign_share` and campaign-owner shared-content list accept only spell/feat/background. This child neither extends them nor promises creation of shared monster records. Mock shared reads represent visibility-compatible returned fixtures only. |
| `app/(app)/library/page.tsx:18`, `app/(app)/library/[id]/page.tsx:24` | Both routes call `auth.getUser()` and redirect signed-out users. List chooses a published system; detail validates UUID and returns not-found for inaccessible/malformed/retired records. No new DM guard, anonymous route, service-role client or route required. |
| `lib/supabase/compendium-server.ts:22,40,127` | Published systems, selected system/type, non-retired content, bounded name search, provenance filters, stable name/id ordering and 24-row pages. Uses ordinary account client and existing RLS; errors reject, malformed rows are individually omitted. List count is the database count before malformed-row omission; preserve this behavior rather than inventing an exact validated count. Detail intentionally reads the current definition. |
| `lib/compendium/catalog.ts`, `components/compendium/compendium-browser.tsx` | Eight categories, query/href/reset helpers, existing `size` taxonomy query/filter. Add a ninth category and reuse the size filter. No CR/type/environment query or new catalog. |
| `lib/compendium/presentation.ts:58,94,208`, `components/compendium/compendium-detail.tsx:22,86` | Existing description/facts/eyebrow helpers and read-only detail shell provide name, provenance, content version, safe return link. Insert the stat block into this shell. Other categories retain their markup. |
| `lib/types/taxonomies.ts`, `lib/schemas/content-types/mechanical.ts` | Reuse exact `CREATURE_SIZES`, `DAMAGE_TYPES`, `VISION_TYPES`; existing speed schema is too permissive/unbounded for this new contract, so use the same mode names with local strict finite bounds. Existing numeric six-element ability arrays are PC grants, not monster absolute scores. |
| `lib/import/mpmb/map/index.ts`, `supabase/migrations/20260720233030_mpmb_import_review_persistence.sql:69` | Mapper/review persistence support spell/feat. No monster import claim, promotion or mapper changes. |

These are checked-in source facts, not inspected deployed grants/policies or
PostgreSQL runtime proof. Official [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)
distinguishes table grants from row visibility. Both remain prerequisites for
later authorized real acceptance. The [current changelog](https://supabase.com/changelog)
and linked September PostgreSQL minor-version notice were inspected; no database
upgrade or extension operation is part of this read-only application design.

## Exact new payload, independent of content revision

Export `monsterDataSchema` and inferred `MonsterData` from
`lib/schemas/content-types/monster.ts`. Canonical `content_type` is **`monster`**,
category key **`monsters`**. Required `data.schema_version` is literal **`1`**;
this is a payload format version, separate from database-managed envelope
`version`. Missing/unknown schema versions fail; no migration, guessed v1,
alternate alias or automatic upgrade. Format 1 is a D&D 5e-shaped declared stat
block, not a promise of arbitrary game-system creature rules.

Notation below is exact: `T(n)` is a string of 1..n UTF-16 code units containing
at least one non-whitespace character; validate without trimming or rewriting
the original value. `I(a,b)` is a finite safe integer in inclusive range a..b;
no coercion of strings, rounding, `NaN`, infinities or unsafe integers. Every
object is strict, including nested objects; every undeclared key is rejected.
Use existing Zod 4 `z.strictObject` / explicit bounded schemas. Default stripping
would silently discard unsupported mechanics; [Zod's documented strict-object
behavior](https://zod.dev/api#zstrictobject) is the intended new-type boundary.
Existing envelope and existing-type parsing stay unchanged.

The complete **validated monster data payload** has a second, aggregate maximum:
**65,536 UTF-8 bytes (64 KiB), inclusive**, measured by
`new TextEncoder().encode(JSON.stringify(parsedMonsterData)).byteLength`.
Run this refinement after strict field/shape validation, on the resulting plain
JSON payload, in the same schema used by browser and server. No Node-only Buffer,
character-count approximation, stripping/capping/truncating to fit, key sorting
or separate client policy. Known primitive/strict bounded shapes make this
serialization finite-depth and free of arbitrary user `toJSON` functions; no
unknown extensions are serialized into the accepted result.

This leaves room for the 8,000-character introduction plus multiple detailed
ordered sections while refusing the near-megabyte combination of every maximum
field. At a 24-row catalog page, accepted monster data contributes at most
1.5 MiB before outer response/escaping overhead; this is a data budget, not an
HTTP response-size guarantee. It also counts JSON escaping and multibyte text
instead of undercounting them as one character each. All original long-content
fixtures must pass the same budget. Envelope name/slug/effects retain their
existing inherited validation (nonempty names/slugs, effect-array validation,
without new length/count bounds here); do not claim this caps those fields or
change global envelope/persistence behavior as a hidden addition. Wrap long
monster titles on detail to contain those inherited display inputs.

**No new field is nullable. There are no payload defaults.** `?` means the JSON
key may be absent; present null, empty/whitespace-only text or wrong shape fails.
Optional array absent and `[]` both render no section, but parsing preserves the
difference; parsing never inserts an array, ability, movement mode, bonus or
statistic. Numeric zero and boolean false are preserved. Only actual bounded
input arrays are iterated; no `Array(n)`, progressions or user-number allocation.

| Top-level exact key | Contract | Rendering |
| --- | --- | --- |
| `schema_version` | Required literal `1` | Not a monster statistic; content revision badge stays envelope version. |
| `size` | Required enum `CREATURE_SIZES`: Tiny/Small/Medium/Large/Huge/Gargantuan | Metadata line and existing size query. |
| `creature_type` | Required `T(80)` | Plain text, e.g. original `construct`; no new creature-type taxonomy. |
| `alignment` | Optional `T(120)` | Metadata line only when declared; no assumed alignment. |
| `description` | Optional `T(8000)` | Existing Description section only when present; row's absence copy is `Monster stat block.` as interface text, not generated data. |
| `armor_class` | Required `{ value: I(0,100), notes?: T(500) }` | `Armor Class 12 (woven shell)`; declared value only. |
| `hit_points` | Required `{ average: I(1,1000000), dice_text?: T(120) }` | `Hit Points 18 (3d6 + 8)`; neither value is recomputed from the other. No current/temp HP state. |
| `speed` | Required movement object below | Declared speeds in feet; zero modes shown. |
| `ability_scores` | Required strict object with all six keys `strength`, `dexterity`, `constitution`, `intelligence`, `wisdom`, `charisma`, each `I(1,30)` | Fixed six named score cells in that order. A display-only modifier is `floor((score - 10)/2)`; use existing `formatModifier` for signs. No evaluator/system formula/effects call. |
| `saving_throws` | Optional strict object with those same six keys individually optional, each `I(-100,100)`; supplied object must have at least one key | Declared final bonuses only, canonical six-ability order. Never add derived ability/proficiency modifiers. `0` renders `+0`. |
| `skills` | Optional array, 0..30 `{ name: T(80), bonus: I(-100,100) }` | Declared display labels and final bonuses, supplied order; no PC proficiency grants or assumed skill taxonomy. |
| `senses` | Optional array, 0..8 `{ type: enum VISION_TYPES, range: I(0,10000), notes?: T(500) }` | Supplied order, ranges in feet; zero range is declared zero. |
| `senses_notes` | Optional `T(500)` | Additional senses text; not interpreted. |
| `passive_perception` | Optional `I(0,100)` | Declared value; not derived from Wisdom/skills. |
| `languages` | Optional array, 0..30 `T(120)` | Supplied order; no inferred language or telepathy. |
| `languages_notes` | Optional `T(500)` | Can declare inability to speak or additional constraints. |
| `challenge` | Optional `{ rating: T(40), experience_points?: I(0,10000000) }` | Declared label (including fractions/custom text) and optional XP; no CR-to-XP or proficiency calculation. |
| `damage_vulnerabilities`, `damage_resistances`, `damage_immunities` | Each optional array, 0..13 enum `DAMAGE_TYPES` | Supplied order; simple unconditional typed declarations. |
| `damage_notes` | Optional `T(1000)` | Conditional defense text; avoids pretending narrative conditions are machine-interpreted. |
| `condition_immunities` | Optional array, 0..30 `T(80)` | Declared condition labels; no new condition taxonomy or PC state mutation. |
| `traits` | Optional array, 0..30 plain named entries below | Ordered Traits section. |
| `actions`, `bonus_actions`, `reactions` | Each optional array, 0..30 rule entries below | Separately ordered sections; no guessed action economy. |
| `legendary_actions` | Optional legendary section below | Explicit legendary text, count, costs and ordered entries. |
| `lair_actions` | Optional lair section below | Explicit lair text, initiative and ordered entries. |

Movement object's complete allowed keys are `walk`, `fly`, `swim`, `climb`,
`burrow`, `encumbered` (each optional `I(0,10000)`), `hover?` boolean and `notes?`
`T(500)`. At least one numeric mode is required; `hover` requires a declared
`fly` key, including fly 0. No assumed walk speed. Render modes in the listed
order; false hover does not add hover text. These ranges, ability 1..30 and
per-list maxima are explicit initial product bounds, not a completeness claim
for arbitrary homebrew creatures. Out-of-range records are rejected, never capped.

## Rule entry and structured summaries

Plain named entry is strictly `{ name: T(120), description: T(4000) }`.
Rule entry has those same required fields plus optional `attack`,
`saving_throw`, `damage`. Neither descriptions nor display dice are executable
expressions, imported source, HTML or Markdown. Literal markup/URLs remain escaped
text; no `dangerouslySetInnerHTML`, eval, expression parser, RNG, links generated
from descriptions or dice buttons. Narrative supplies nuance unsupported by a
structured summary. No attempt to cross-check narrative against declared fields.

| Exact structure | Contract |
| --- | --- |
| `attack` | `{ kind: 'melee' \| 'ranged' \| 'melee_or_ranged', attack_type: 'weapon' \| 'spell', bonus: I(-100,100), reach?: I(0,10000), range?: { normal: I(1,10000), long?: I(1,10000) }, target?: T(200) }` |
| Attack refinements | `melee` requires reach and rejects range; `ranged` requires range and rejects reach; `melee_or_ranged` requires both. If long exists, long >= normal. No reach/range/to-hit fallback. All values are descriptive; no roll resolver. |
| `saving_throw` | `{ ability: one of the six long ability keys, dc: I(0,100), on_success?: T(500) }`; spell/melee/ranged save text remains independent of attack. No default half damage. |
| `damage` | Array of 1..8 `{ type: enum DAMAGE_TYPES, average?: I(0,1000000), roll_text?: T(120), notes?: T(500) }`; each damage entry needs average or roll_text (both allowed). No numeric/string conversion or dice evaluation. |
| `legendary_actions` | `{ description?: T(4000), actions_per_round?: I(1,20), entries: array 1..30 of rule entry + optional cost: I(1,20) }`; cost is only legal here. If count exists, each declared cost must be <= that count. Missing count/cost is omitted, not assumed 3/1. |
| `lair_actions` | `{ description?: T(4000), initiative_count?: I(0,100), entries: array 1..30 of rule entries }`; zero initiative is shown, no inferred initiative/lair frequency. |

Arrays retain their order and duplicate names, including distinct actions with
the same title. Renderer keys use section + source index, not entry name. Do not
sort/deduplicate rule, skill, damage, language or sense entries. Nested unknown
fields (e.g. `uses`, `formula`, `html`, bonus-action `cost`) fail validation.

Example **original synthetic data**, not a persisted definition or book content:

```json
{
  "schema_version": 1,
  "size": "Small",
  "creature_type": "construct",
  "description": "A woven lantern creature that guards discarded workshop keys.",
  "armor_class": { "value": 12, "notes": "woven shell" },
  "hit_points": { "average": 18, "dice_text": "3d6 + 8" },
  "speed": { "walk": 0, "fly": 30, "hover": true },
  "ability_scores": { "strength": 8, "dexterity": 12, "constitution": 10, "intelligence": 6, "wisdom": 10, "charisma": 9 },
  "saving_throws": { "strength": -1, "wisdom": 0 },
  "actions": [{
    "name": "Key flick",
    "description": "It flicks a dull brass key toward a nearby target.",
    "attack": { "kind": "ranged", "attack_type": "weapon", "bonus": 0, "range": { "normal": 20, "long": 40 }, "target": "one target" },
    "damage": [{ "type": "bludgeoning", "average": 2, "roll_text": "1d4" }]
  }]
}
```

## Minimal implementation and presentation wiring

First implementation child owns only the new schema/registry addition,
`components/compendium/monster-stat-block.tsx`, monster branches in existing
presentation/detail, category/size-filter additions, original fixtures and tests.
No form/action/API route, mutation button, builder integration, live data adapter,
importer, source promotion, instance state, campaign operation or effect evaluator.
No dependency changes. Check installed Next docs before writing its UI code.

Add category `{ label: 'Monsters', singular: 'Monster', description:
'Creature stat blocks, actions, and traits.', contentTypes: ['monster'] }` at
the end of the existing category registry. `/library?category=monsters` uses
unchanged system/q/provenance/sort/page handling. Query limit remains 120 search
characters, pages <=999, 24 rows; stale category filters reset as today.
Allow existing Size control/server `data->>size` equality for races **or monsters**.
No CR filter, advanced attack/ability search, result count fabrication or seed
count. Unsupported system or inaccessible content retains normal Library behavior.

Eyebrow is `Monster · <size> <creature_type>`; optional declared challenge can
append `· Challenge <rating>`. At-a-glance facts are Size, Type, Alignment (if
present), Armor Class, Hit Points, Challenge (if present). Keep the existing
provenance and **content** version badges and existing safe return navigation.
For monsters, place description (if present) and the actual stat block in the
detail shell's main column; suppress generic no-description boilerplate there.
Other detail types remain unchanged. Validate/narrow the monster data before
passing `MonsterData` to the renderer; a malformed direct component fixture
must not cause made-up statistics. Normal invalid rows already fail canonical
parsing and resolve to omitted/list or not-found/detail behavior.

Stat block order: AC/HP/Speed; six ability score/modifier cells; declared saves,
skills, defenses, senses/passive perception, languages, challenge; Traits,
Actions, Bonus Actions, Reactions, Legendary Actions, Lair Actions. Structured
attack, save and damage summaries follow each entry name, then its complete
escaped description. Never add ability/proficiency to a declared attack/save/
skill bonus or infer damage, defenses, passive perception, XP or action costs.
Envelope effects remain validated and preserved by existing parsers, but the
monster renderer ignores them mechanically; a valid nonempty effects fixture
must not alter displayed declared AC/HP/attacks or any PC state.

Use existing paper/accent UI primitives and semantic headings/definition lists;
ability cells wrap 3x2 at narrow widths, 6x1 when space allows. Monster titles,
descriptions and long unbroken text wrap, preserve newlines and remain fully visible on detail;
no fixed-height clipped rules or scrolling ability table. Library card's current
three-line excerpt is intentional, complete text remains on detail. Accessible
section names and Back/row/category links remain keyboard-reachable. No copied
external stat-block styling/assets or licensed monster prose is needed.

## Finite acceptance matrix before integration

Original fixtures only, in `tests/fixtures/monsters.ts`: **Cinderlit Kite** (Small
construct, zero walking/attack/save bonuses and negative Strength); **Glassroot
Sentinel** (Large plant, melee + save-only action, mixed damage/defenses, absent
legendary/lair); **Lantern Reef Regent** (Huge aberration, melee-or-ranged attack,
duplicate distinct action names, reactions/bonus/legendary/lair, long original
description). Fixture variants generate malformed/boundary cases in tests, never
promote sources or write live records.

| Acceptance layer / files | Measurable required cases |
| --- | --- |
| New `tests/schemas/monster.test.ts` | Three positive fixtures; missing each required top-level field and each of six abilities; each finite integer class at inclusive endpoints and just outside; fraction/NaN/infinity/unsafe integer/string/null rejection; wrong literal/version/taxonomy/casing; zero bonuses/distances and false hover survive; optional absent vs empty arrays preserved; array max/max+1; text max/max+1/whitespace-only; aggregate UTF-8 65,535/65,536 accepted and 65,537 rejected with all individual fields valid; same code-unit count with multibyte text crosses the byte budget correctly; every-per-field-valid maximum-description collection is rejected by aggregate limit. Strict extra keys at root and every nested shape; movement/hover, all attack variants/range ordering, damage minimum, legendary cost/count, nonempty section refinements. Test `parseContentByType('monster', ...)` and existing unknown-type refusal. |
| `tests/lib/supabase/content-definitions-parser.test.ts` | Complete personal/platform/shared original envelopes through actual parser; malformed new payload individually omitted, bad ID/source/effects/envelope still rejected. Complete immutable v1 snapshot remains its exact data/name/type/system/source/scope/owner/version when a separate parent v2 fixture differs; no latest substitution. Payload version and envelope content version stay independent. Existing type parser cases continue passing. These are parsing tests, not creation or database permission proof. |
| `tests/lib/compendium/catalog.test.ts`, `presentation.test.ts` | Ninth category only; monsters href/return links preserve system/search/provenance/sort/page/size; category switch clears incompatible filters. Monster facts/eyebrow/absent-description copy, declared zero/negative stats, existing categories unchanged. |
| `tests/lib/supabase/compendium-server.test.ts`, `tests/app/library-page.test.tsx` and existing detail-route tests where located | Monster exact type/system/non-retired filters, size JSON equality, no unrelated category filters, stable name/id sort, page range, bounded query. Canonical original platform/owner/shared returned rows parse. Error rejection/malformed omission/empty/not-found and signed-out redirects persist. No `.or` entitlement construction, service client or DM-only branch. Mock returned scopes do not prove real RLS; no fabricated deny proof from a stubbed response. |
| New `tests/components/compendium/monster-stat-block.test.tsx` and existing detail tests | All declared fields and six cells rendered, signed zero/negative bonus correct once, HP text not recomputed, ordered/duplicate names retained, optional sections absent, valid legendary cost displayed and cost 0 rejected by schema; initiative 0 visibly rendered. Literal script/HTML/javascript/event-handler text creates no executable nodes or dynamic link. Valid envelope effects cause no mechanics/execution/state calls. Existing read-only detail/provenance/version/back behavior retained. |
| Later offline `e2e/local-monsters/playwright.config.ts`, spec and `scripts/verify-monsters-local.mjs` | Mount actual CompendiumBrowser/CompendiumDetail/MonsterStatBlock with canonical parsed original fixtures and production global CSS, following existing isolated offline harnesses. Only Next Link/navigation and query transport simulated; no auth/RLS/database proof. Desktop 1440x900 and mobile 390x844: keyboard category -> row -> actual detail -> back retaining query; size control; all optional/rule sections, long text and duplicate entries visible. A near-budget long-content variant (>=60 KiB and <=64 KiB), including multibyte text and long unbroken names/descriptions, must have all ordered section entries in the DOM, visible final rule after scrolling and `documentElement.scrollWidth <= clientWidth + 1` at both widths. Zero page errors/remote requests; screenshots and meaningful DOM/layout assertions. Root must grant process/UI slot first. |

After challenge and resource release, use existing scripts: narrow
`npm.cmd test -- <above focused files> --maxWorkers=2`, `npm.cmd run typecheck`,
`npm.cmd run lint`; offline browser via `npm.cmd run test:e2e -- --config
e2e/local-monsters/playwright.config.ts`. Root owns combined `npm.cmd run check`,
build/final CSS acceptance and independent exact-source review. Record owned
PID/parent/working directory/port/start, stop only owned processes and confirm
closed ports. No install/gates/browser are authorized by this docs checkpoint.

## Rollout, rollback and remaining acceptance

An additive registry/category/renderer deployment alone creates no content or
entitlements; an empty Monsters category is honest until an authorized later
content source exists. Existing valid v1 monsters become readable by already
entitled accounts only if actual deployed schema/grants/RLS permit it. Strict
format 1 rejects unknown future extensions, so future formats must explicitly
retain old snapshot readers; never mutate stored historical payloads to appease
the current schema. Bounds are proposed product constraints subject to this
challenge; they are not silent data repair rules.

Rollback is revert of this future additive code checkpoint; existing categories
and SQL stay unchanged. That makes monster rows unrecognized by the prior app
again and does not delete persisted content/snapshots. Schema/parser and renderer
must ship together; no destructive cleanup/backfill is part of rollback.

Still open: real owner/foreign/DM/player/anonymous catalog privacy and direct ID
reads on the actual target; deployed grants/schema inspection; rights-safe content
availability; owner authoring/CAS/raw metadata/effects preservation; supported
monster input/review/import; campaign sharing permission extension; separate DM
assignment with exact immutable pins and instance state. NPC/companion/sidekick
contracts R17–R19 remain independent. No offline fixture or registry addition
closes any of those requirements or full M5/beta acceptance.
