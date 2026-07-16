# Equipment step chooser (Track A2)

**Date:** 2026-07-15 · **Status:** implemented · **PR:** feat(builder): equipment step choice selection (UAT A2)

## Problem

The builder's equipment step rendered starting-equipment choices ("a mace or a warhammer") as
static text with a single "Confirm Equipment" button that only wrote
`choices.starting_equipment = "acknowledged"`. Nothing could actually be picked and nothing
landed in the character's inventory.

> **Product decision (session default, Victor may veto):** build a chooser UI rather than
> silently granting defaults (GAME-PLAN §6, decision #1).

## Design

### Data sources

- **Class:** `content_definitions.data.equipment` — MPMB-seeded prose (migration 00018),
  semicolon-separated groups: `"A mace or a warhammer (if proficient); scale mail, leather
  armor, or chain mail (if proficient); …"`.
- **Background:** `content_definitions.data.equipment` — one comma list (migration 00017):
  `"A holy symbol, a prayer book or prayer wheel, 5 sticks of incense, …, and a pouch
  containing 15 gp"`.

### Parsing (`lib/builder/equipment-choices.ts`, pure + unit-tested)

- Class text: split groups on `;`. Groups with `", or "` are serial-comma choice lists;
  groups with `" or "` split into (possibly bundled) options; otherwise fixed grants.
- Background text: split the comma list into elements; an element containing `" or "`
  becomes its own choice group, runs of fixed elements merge into fixed groups.
- Item phrases handle: quantities ("two handaxes", "10 darts", "four javelins"),
  containers ("a quiver of 20 arrows" → Quiver + 20 Arrows), currency ("a pouch containing
  15 gp" → Pouch + 15 gp), parenthetical notes ("(if proficient)"), and category
  placeholders ("any simple weapon", "two martial weapons", "a holy symbol", "an arcane
  focus", "a druidic focus", "any other musical instrument").

### Category slots

Options containing a category placeholder expose one **pick slot per count** ("two martial
weapons" = two slots), rendered as Base UI `Select` dropdowns. Weapon categories filter the
item catalog by `weapon_category`/`weapon_range`; the focus/symbol/instrument categories use
static SRD name lists resolved against the catalog (unresolved names grant as custom items).

### Granting

"Confirm Equipment" is disabled until every choice group has a selection **and** every
category slot has a pick. Confirming:

1. resolves selected/fixed items against a server-fetched catalog of platform
   weapon/armor/item definitions (name-normalized: `"Crossbow, light"` ⇄ `"light crossbow"`,
   plural stripping, aliases like `bolts → crossbow bolt`, `wooden shield → shield`);
2. inserts each grant via the existing `addInventoryItem` helper (linked `content_id` when
   resolved, custom item fallback otherwise), merging duplicate grants into quantities;
3. grants parsed currency through the `patch_character_state` RPC wrapper
   (`updateCharacterState`), merged over existing currency;
4. writes `choices.starting_equipment = { selections, picks, confirmed: true }` via
   `updateCharacter`.

Background `data.gold` is **not** granted separately — for the SRD acolyte it is the same
15 gp already present in the equipment text.

### Persistence & compatibility

- `choices.starting_equipment` becomes `string | StartingEquipmentSelections`.
  Selections/picks are persisted (optimistic, revert-on-error) as they are made, so
  revisiting the step restores them; `confirmed` locks the step (no re-grant path).
- Legacy string values (`"acknowledged"`, `"bundle_N"`) render as a read-only confirmed
  state; the builder overview/nav treat an unconfirmed selections object as `in_progress`.

### Out of scope

- The "start with N gp and buy equipment" alternative (still shown as informational text).
- Editing granted equipment after confirm (inventory tab owns that).
