# M4 Private Homebrew Feat Authoring

## Goal

Let an authenticated user create, list, and edit private D&D 5e (2014) feats in
the Library. Edits use the existing immutable content-version model, so
characters that later pin a feat keep the exact version they selected.

## Release boundary

This slice includes:

- owner-only feat creation and editing;
- Library cards for authored and imported feats;
- immutable version snapshots and optimistic version-conflict handling;
- a safe first automation set: one ability prerequisite, ability-score
  increases, action economy, uses/recovery, and a flat AC bonus;
- server-derived narrative and mechanical effects.

This slice does not yet include:

- selecting a feat for a character or consuming an ASI slot;
- prerequisite enforcement against a character;
- campaign sharing or public publishing;
- arbitrary effect JSON, executable formulas, or unsupported MPMB mechanics.

Those are separate releases because character selection must atomically enforce
slot eligibility, prerequisites, exact-version access, and duplicate rules.

## Trust boundary

The browser may submit only named form fields. It never controls `system_id`,
`content_type`, `slug`, `source`, `scope`, `owner_id`, `version`, raw `data`, or
raw `effects`.

Every server action authenticates the caller. The server-side data-access layer
authenticates again, resolves the published `dnd-5e-2014` system, maps form data
through a narrow Zod schema, builds the canonical `featDataSchema` payload,
derives effects, validates each effect with `effectSchema`, and fixes the
database envelope to personal homebrew owned by the caller.

Edit queries include owner, system, source, content type, active scope, retired
state, and expected version. A version mismatch returns a reload conflict rather
than overwriting another session.

## Form model

- Name: required, 1–100 characters.
- Description: required, 1–20,000 characters.
- Prerequisite: optional single ability and integer minimum from 1–30; both
  fields must be present together.
- Ability increases: six optional integers, STR through CHA, each 0–5. All-zero
  input is omitted from canonical data.
- Action: optional `action`, `bonus action`, `reaction`, or `free`.
- Uses/recovery: optional positive uses count and a supported recovery period;
  both fields must be present together.
- Flat AC bonus: optional integer from -10 to 10; zero is omitted.

Every other canonical feat field receives its schema default.

## Derived effects

- Description creates one narrative effect tagged `Feat`.
- Each non-zero ability increase creates an additive mechanical effect for the
  corresponding ability.
- A non-zero flat AC bonus creates an additive `armor_class` effect.

## Routes and UI

- `/library/feats/new`
- `/library/feats/[id]/edit`
- `/library` loads spells and feats in parallel and renders independent sections.

The edit form carries only `id` and `expected_version` as identity hints. Both
are treated as untrusted and revalidated server-side.

## Verification

- form-mapper tests cover canonical defaults, paired fields, bounds, derived
  effects, and ignored malicious envelope fields;
- DAL tests cover owner-scoped reads, exact update filters, server-owned
  envelopes, effect validation, and stale-vs-missing results;
- action tests cover signed-out access, validation, malformed identity,
  revalidation, redirect, and conflicts;
- component/page tests cover accessible create/edit forms, default values,
  Library sections, notices, links, and error/empty states;
- full typecheck, lint, unit suite, production build, and authenticated browser
  UAT are required before release.
