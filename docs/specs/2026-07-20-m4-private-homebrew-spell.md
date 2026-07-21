# M4 Private Homebrew Spell Vertical

**Status:** Implementation-ready  
**Date:** 2026-07-20  
**Milestone:** M4 — Homebrew + Importer  
**Scope:** First end-to-end, private-only homebrew content vertical

## 1. Purpose

Deliver the smallest complete homebrew workflow that proves Inkborne's content model from authoring through live play:

1. An authenticated user creates a private D&D 5e (2014) spell in `/library`.
2. The spell is validated into the same schema used by platform SRD spells.
3. The owner discovers and adds the spell from a character's existing spell picker.
4. The character pins the exact immutable spell version selected at that moment.
5. The owner can edit the library definition without silently changing an existing character.
6. Casting, rolls, duration tracking, and concentration use the existing data-driven gameplay pipeline.

This vertical is deliberately narrower than the full M4 milestone. It establishes the authoring, validation, ownership, versioning, discovery, and gameplay seams that later content types, imports, and sharing will reuse.

## 2. Product Outcome and Acceptance Criteria

The feature is complete when all of the following are true:

- A signed-in user can open `/library`, see an empty state or their private homebrew spells, and start a new spell.
- A valid form submission creates one `content_definitions` row with a database-generated immutable version 1 snapshot.
- Invalid spell data never reaches the database through the application authoring flow and produces field-level, recoverable feedback.
- Only the owner can list, open, or edit the private spell.
- The spell appears in the existing character spell picker for a compatible class.
- Adding the spell writes both `content_id` and its current `content_version` to `character_spells`.
- Editing the library spell creates version N+1 and leaves characters pinned to version N unchanged.
- The character sheet visibly identifies a pinned homebrew spell and its pinned version.
- A newly selected copy uses the newest version; the UI never upgrades an existing character silently.
- A schema-valid authored spell participates in the existing cast dialog, dice rolls, spell slots, concentration, and duration tracking without spell-specific code.
- Unit, action, component, RLS, and browser UAT coverage described below is green.

## 3. Scope

### 3.1 Included

- A top-level `/library` route and desktop/mobile navigation entry.
- A "My content" list initially containing private homebrew spells only.
- Create and edit routes for D&D 5e (2014) homebrew spells.
- A schema-driven spell form that produces `spellDataSchema`-valid data.
- Optional spell-roll automation fields for attacks, damage, healing, saves, and areas.
- Owner-only server queries and mutations using the authenticated Supabase client.
- Optimistic-concurrency protection using the definition's expected version.
- Current-version discovery in `AddSpellPanel` and exact-version character pinning.
- Homebrew and pinned-version indicators on the picker and character sheet.
- Service-role cleanup helpers used only by E2E tests.
- Documentation status updates after the vertical ships.

### 3.2 Non-goals

- Campaign sharing, public publishing, browsing another user's content, or remixing.
- A sharing settings UI or mutation of `content_shares`.
- Importing MPMB JavaScript, PDFs, or any other external format.
- Conflict resolution between imported and authored content.
- Authoring content types other than spells.
- Custom content-type authoring.
- A raw JSON editor.
- A general mechanical-effect editor. Authored spells store `effects: []` in this vertical.
- Version-history browsing, rollback, comparison, or explicit in-place character upgrade.
- Hard-delete or archive UI.
- Multi-system authoring. This vertical is fixed to published `dnd-5e-2014`.
- 2024 rules content.
- Collaborative editing or real-time presence.

## 4. Existing Architecture This Feature Must Reuse

No new database migration is required for the private-only vertical. It depends on the content-versioning release and these existing contracts:

- `content_definitions` is the mutable authoring/catalog record.
- `content_versions` is immutable and is populated only by database triggers.
- Definition inserts force version 1; meaningful updates increment the version and snapshot the complete content envelope atomically.
- Definition identity fields are immutable: `id`, `system_id`, `content_type`, `slug`, `source`, `owner_id`, and `created_at` cannot change in place.
- Owner RLS permits only owned homebrew inserts and updates.
- Private definitions are visible only to their owner.
- `character_spells(content_id, content_version)` references the exact composite key in `content_versions` with `ON DELETE RESTRICT`.
- Character-bound reads join the exact `content_versions` snapshot, not the current `content_definitions` record.
- `private.can_use_content_version(...)` and character-spell RLS ensure only a character owner can attach an authorized version. Campaign DMs may read permitted sheets but cannot mutate player spells.
- `searchSpells()` relies on RLS for platform, owned, and shared discovery and already returns the current definition version.
- `spellDataSchema`, the dice parser, the casting helpers, and active-effect helpers are the application boundary and gameplay pipeline.

Implementation must not introduce a parallel homebrew table, a homebrew-only spell renderer, or a homebrew-only casting path.

## 5. User Flows

### 5.1 Create a private spell

1. The user selects **Library** from application navigation.
2. `/library` shows owned spells or the empty state and a **Create spell** action.
3. `/library/spells/new` loads the published D&D 5e (2014) system and available platform classes on the server.
4. The user completes the spell form and submits it.
5. The server action authenticates again, parses the form, derives the trusted content envelope, and inserts the definition with the session-scoped Supabase client.
6. The database forces version 1 and creates the immutable snapshot in the same transaction.
7. Success redirects to `/library?created=<id>` with a non-sensitive success notice.

### 5.2 Edit a spell

1. The owner opens `/library/spells/[id]/edit`.
2. The server fetches a current definition only when it is owned by the caller, is homebrew, is a spell, and belongs to D&D 5e (2014).
3. The form carries the current version as `expected_version`.
4. The update mutation filters on the same ownership/type envelope and `version = expected_version`.
5. A changed name or payload causes the database to increment the version and create an immutable snapshot.
6. A zero-row update is inspected safely:
   - if the owned record now has a later version, return a recoverable conflict;
   - otherwise return a generic unavailable/error state without disclosing another user's content.
7. Success redirects to `/library?updated=<id>` and revalidates the library and edit routes.

### 5.3 Add and play the spell

1. The user opens the existing spell picker on an owned caster character.
2. The picker searches current visible `content_definitions`; class filtering includes the authored spell when its `data.classes` contains the selected class slug.
3. The result is labeled **Homebrew** and includes its current version.
4. Adding it sends both the definition ID and current version through the existing `addCharacterSpell` path.
5. The sheet reads the pinned snapshot and labels the row `Homebrew · vN`.
6. Casting consumes slots and derives rolls/duration/concentration from the pinned snapshot through the existing casting pipeline.

### 5.4 Edit after a character has selected the spell

1. Character A has spell version 1 pinned.
2. The owner edits the library spell; the current definition becomes version 2.
3. Character A continues rendering and casting version 1, including its old name, data, and effects snapshot.
4. The picker may indicate `Using v1 · latest v2`, but it must not replace the pin automatically.
5. In the first vertical, the user deliberately removes and re-adds the spell to select version 2. A dedicated upgrade action is deferred.

## 6. Routes, Modules, and Ownership

### 6.1 New files

| File | Responsibility |
|---|---|
| `lib/homebrew/spell-form.ts` | Pure FormData-to-domain parsing, normalization, dice validation, and form value types. No Next.js or Supabase imports. |
| `lib/supabase/homebrew-spells-server.ts` | Server-only list/get/create/update helpers with runtime result validation and structured failures. |
| `app/(app)/library/page.tsx` | Authenticated server-rendered owned-spell library and empty/error states. |
| `app/(app)/library/spells/actions.ts` | Authenticated create/update server actions, action state, safe error mapping, revalidation, and redirects. |
| `app/(app)/library/spells/new/page.tsx` | New-spell server page and system/class form context. |
| `app/(app)/library/spells/[id]/edit/page.tsx` | Owner-only edit page; awaits Next.js 16 `params` and returns `notFound()` for unavailable content. |
| `components/library/spell-form.tsx` | Focused client form island using `useActionState`; shared by create and edit routes. |
| `components/library/spell-card.tsx` | Optional presentational list card if the page would otherwise become difficult to scan. |
| `e2e/homebrew-spells.spec.ts` | End-to-end author/edit/pin/version-isolation flow. |

### 6.2 Existing files to modify

- `components/nav/app-nav.tsx`
- `components/nav/mobile-nav.tsx`
- `components/sheet/spells/add-spell-panel.tsx`
- `components/sheet/spells/spell-row.tsx`
- `e2e/helpers/supabase.ts`
- `e2e/global-teardown.ts`
- Related unit/component test files
- `docs/ROADMAP.md`
- `docs/GAME-PLAN.md`

Server Components remain the default. Only the interactive spell form and existing interactive sheet surfaces are Client Components.

## 7. Trusted Content Envelope

The browser supplies authored spell fields only. The server or database supplies every authorization and identity field.

### 7.1 Create envelope

```ts
{
  system_id: resolvedDnd2014SystemId,
  content_type: "spell",
  slug: generatedStableSlug,
  name: parsed.name,
  data: parsed.data,
  effects: [],
  source: "homebrew",
  scope: "personal",
  owner_id: authenticatedUser.id,
}
```

The client must not be allowed to choose `system_id`, `content_type`, `source`, `scope`, `owner_id`, `version`, `is_retired`, or `effects`.

### 7.2 Stable slug

On creation, generate a stable owner-scoped slug from a normalized name plus a short cryptographically random suffix, for example `ashen-step-a1b2c3d4`. Use `spell` as the normalized fallback when the name contains no ASCII alphanumeric characters. URLs use the content UUID, not the slug.

The slug never changes when the display name changes. This preserves content identity and satisfies the database identity trigger without making future labels immutable.

### 7.3 Update envelope

Updates may send only:

```ts
{
  name: parsed.name,
  data: parsed.data,
  effects: [],
}
```

The query must additionally filter by:

- definition `id`
- authenticated `owner_id`
- `source = 'homebrew'`
- `content_type = 'spell'`
- resolved D&D 5e (2014) `system_id`
- `version = expectedVersion`

Do not submit `version`; the database trigger owns it.

## 8. Form Fields and Validation

The form parser normalizes raw FormData into a spell payload and then runs `spellDataSchema.parse()` as the final authority. Store the parsed output, including schema defaults, rather than the untrusted intermediate object.

### 8.1 Core fields

| Field | UI | Validation and mapping |
|---|---|---|
| Name | Text | Trimmed, 1–120 characters. Stored in definition envelope. |
| Level | Select 0–9 | Integer. `0` means cantrip. |
| School | Select | One of `MAGIC_SCHOOLS`. |
| Casting time | Text | Trimmed, 1–120 characters. |
| Range | Text | Trimmed, 1–120 characters. |
| Components | V/S/M checkboxes | At least one of `V`, `S`, `M`; deduplicated in V/S/M order. |
| Material | Text | Trimmed, at most 500 characters; required when M is selected and omitted otherwise. |
| Duration | Text | Trimmed, 1–120 characters. Existing `parseSpellDuration` remains the runtime fallback. |
| Concentration | Checkbox | Boolean from field presence. |
| Ritual | Checkbox | Boolean from field presence. |
| Description | Textarea | Trimmed, 1–20,000 characters; rendered as plain text. |
| At higher levels | Textarea | Optional, trimmed, at most 10,000 characters. |
| Classes | Multi-select/checklist | At least one platform class slug for this vertical; deduplicated and verified against server-loaded D&D 5e (2014) classes. |

`subclasses` is stored as `[]` in this vertical. `descriptionFull`, `duration_structured`, `descriptionCantripDie`, and other importer/enrichment-only fields are not directly authored.

Requiring a class is intentional: the current character picker filters spells by the selected caster class. Classless homebrew cannot be discovered through that flow until feat/race-granted spell authoring exists.

### 8.2 Optional attack, damage, and healing automation

| Field | Validation and mapping |
|---|---|
| Attack type | Blank, melee, or ranged; blank maps to `null`. |
| Damage type | A `DAMAGE_TYPES` value or "varies/unspecified", which maps to `null`. |
| Damage rows | Repeatable `(level, dice)` rows mapped to `damage.dice_at_slot_level`; no rows maps `damage` to `null`. |
| Healing rows | Repeatable `(level, dice)` rows mapped to `heal_at_slot_level`; no rows maps to `null`. |

For leveled spells, row levels must be unique integers from the spell's base level through 9. For cantrips, damage breakpoint levels must be unique values from `1`, `5`, `11`, and `17`, matching the existing character-level lookup behavior.

Each dice expression must be trimmed and accepted by `parseDiceExpression`. For healing expressions that contain the supported `MOD` placeholder, validate by replacing whole-word `MOD` tokens with `0` before parsing while preserving the original stored expression. Reject empty, malformed, duplicate-level, or out-of-range rows with field feedback.

Damage type without a damage row is invalid. Damage rows may use a null type for spells whose damage type varies by choice or outcome.

### 8.3 Optional save and area automation

| Field | Validation and mapping |
|---|---|
| Save ability | Blank or a non-empty normalized ability slug. Blank maps `dc` to `null`. |
| Save success | Half, none, or other; required when a save ability is present. |
| Area type | Blank, sphere, cone, cylinder, line, or cube. Blank maps `area_of_effect` to `null`. |
| Area size | Positive finite number; required only when area type is present. |

The form should hide or disable dependent fields when their controlling option is absent, but server validation remains authoritative.

### 8.4 Final normalized shape

At minimum, the stored data must resolve to:

```ts
{
  level,
  school,
  casting_time,
  range,
  components,
  ...(material ? { material } : {}),
  duration,
  concentration,
  ritual,
  description,
  ...(higher_level ? { higher_level } : {}),
  attack_type,
  damage,
  heal_at_slot_level,
  dc,
  area_of_effect,
  classes,
  subclasses: [],
  dependencies: [],
}
```

## 9. Server Query and Action Contracts

### 9.1 Server data helpers

`lib/supabase/homebrew-spells-server.ts` should expose narrowly scoped helpers similar to:

```ts
resolveDnd2014System(supabase)
listOwnedHomebrewSpells(supabase, { ownerId, systemId })
getOwnedHomebrewSpell(supabase, { ownerId, systemId, contentId })
createOwnedHomebrewSpell(supabase, { ownerId, systemId, spell })
updateOwnedHomebrewSpell(supabase, {
  ownerId,
  systemId,
  contentId,
  expectedVersion,
  spell,
})
```

All selected rows pass through existing content-definition/spell runtime parsing before rendering. Database failures retain structured internal context for logging but are mapped to safe user-facing states.

### 9.2 Action state

Create and update use a serializable action state:

```ts
type HomebrewSpellActionState = {
  status: "idle" | "error" | "conflict";
  message: string;
  fieldErrors?: Record<string, string[]>;
};
```

Both actions have the React 19 form signature:

```ts
(previousState: HomebrewSpellActionState, formData: FormData)
  => Promise<HomebrewSpellActionState>
```

On success they call `revalidatePath("/library")`, revalidate the relevant edit route, and redirect. On validation, permission, conflict, or database failure they return state so the user's entered values remain on screen.

### 9.3 Error behavior

- Unauthenticated action: redirect to `/login`.
- Invalid input: return field errors; do not query a mutation table.
- Duplicate/generated identity collision: retry slug generation once or return a safe creation error; never expose raw constraint text.
- Stale expected version: return `status: "conflict"` with instructions to reload before editing again.
- Missing or unauthorized edit target: return a generic unavailable error or `notFound()` on initial page load.
- Database failure: call the existing server error reporter with operation and IDs, excluding authored description text and secrets.

## 10. UI Behavior

### 10.1 Library

- Match the existing Inkborne paper/notebook visual system and responsive container widths.
- Header: **Library**, supporting copy, and **Create spell** gold action.
- Empty state explains that private homebrew is visible only to its author.
- Spell cards/rows show name, level/cantrip, school, class tags, `Private`, and `vN`.
- Each owned spell links to its edit page.
- Do not render share, publish, delete, duplicate, history, or import controls yet.
- Provide designed loading, empty, and recoverable query-error states rather than a blank page.

### 10.2 Form

- Use labels, descriptions, fieldset/legend grouping, and native semantics.
- Group fields into Basics, Casting, Description, Classes, and Optional automation.
- Keep optional automation collapsed or visually secondary so a narrative-only spell remains quick to create.
- Use `useActionState`; disable the submit button while pending and announce action errors with `role="alert"` or an appropriate live region.
- Preserve user input on recoverable failures.
- The edit page shows the current version and warns that saving creates a new version without changing characters already using the spell.
- Conflict state disables another blind submit and offers a reload link/button.

### 10.3 Character surfaces

- `AddSpellPanel` keeps relying on current visible definitions and class filtering.
- Homebrew results show a `Homebrew` label and `vN`.
- The insert payload always includes the result's exact `version`.
- Existing selection detection remains keyed by content identity and class.
- If an existing row is pinned older than the current result, show `Using vN · latest vM`; do not call an update mutation automatically.
- `SpellRow` shows `Homebrew · vN` using the pinned snapshot's source/version.
- The row's details and cast dialog continue to consume the pinned snapshot.

## 11. Versioning Invariants

These are release-blocking invariants:

1. Application code never inserts, updates, or deletes `content_versions`.
2. Application code never sets or increments `content_definitions.version`.
3. Create produces version 1 through the database trigger.
4. Edit uses an expected-version predicate and never performs last-write-wins silently.
5. Meaningful edit creates exactly one new immutable snapshot in the same transaction.
6. Character insertion always supplies both content ID and version or supplies neither.
7. Existing character pins remain unchanged after definition edits.
8. Character rendering and casting use the exact joined version snapshot.
9. Picker discovery may read the current definition, but selection persists the version returned by that same result.
10. No UI action silently upgrades, rewrites, or deletes an existing pin.

## 12. Security and RLS Requirements

- Use the normal server SSR client bound to the user's cookies. The application must never use the service-role client for authoring.
- Every action calls `auth.getUser()` and derives `owner_id` from the returned user.
- Do not trust FormData, query parameters, hidden inputs, user metadata, or JWT-editable user metadata for authorization.
- Owner/type/system/source predicates in server queries are defense in depth; RLS remains authoritative.
- Do not rely on the application layout or proxy as the only auth boundary.
- Private content must not be made `shared`, and no `content_shares` row is created.
- Descriptions render as text, not injected HTML.
- Bound text lengths and repeatable automation rows to avoid oversized JSON payloads.
- Runtime-validate database rows before passing them to React or gameplay code.
- Cross-account UAT must prove another authenticated user cannot select the definition, read its snapshot without an authorized character reference, or update it.

The current database permits an owner to hard-delete an unreferenced homebrew definition. Exact-version `RESTRICT` constraints prevent deletion while a character references one of its snapshots. This vertical exposes no delete UI, but omission is not a database-level no-delete guarantee; see Deferred Decisions.

## 13. Test Plan

### 13.1 Pure form parser tests

Add `tests/lib/homebrew/spell-form.test.ts` covering:

- Complete valid normalization and `spellDataSchema` output.
- Required fields and length bounds.
- Level and enum validation.
- Component ordering/deduplication and material dependency.
- Class allowlist enforcement and at-least-one requirement.
- Blank optional values mapping to omitted fields or `null` as specified.
- Valid/invalid damage and healing dice expressions, including supported `MOD` validation.
- Unique and allowed scaling levels for cantrip and leveled spells.
- Paired save and area fields.
- Untrusted envelope fields in FormData being ignored.

### 13.2 Server helper tests

Add `tests/supabase/homebrew-spells-server.test.ts` covering:

- List/get queries include owner, system, type, and source predicates.
- Create sends only the trusted, server-derived envelope.
- Create never sends a version or writes `content_versions`.
- Update includes the expected-version predicate and immutable identity predicates.
- Zero-row update is represented distinctly from a successful update.
- Structured Supabase errors are preserved internally.
- Malformed returned definitions fail closed.

### 13.3 Server action tests

Add `tests/app/library-spell-actions.test.ts` covering:

- Unauthenticated redirects.
- Validation failures do not mutate.
- User/system/envelope values are server-derived.
- Successful create/update revalidate and redirect.
- Stale update returns a conflict.
- Missing/unauthorized rows return a safe error.
- Error reporting omits authored body text.

### 13.4 Component tests

Add `tests/components/library/spell-form.test.tsx` covering:

- Create and edit initial values.
- Accessible labels and grouped controls.
- Material, automation, save, and area conditional UI.
- Pending button behavior.
- Field, general, and conflict feedback.
- Edit warning about immutable character pins.

Extend existing spell picker and row coverage:

- Homebrew discovery is not restricted to platform scope.
- Add sends exact current version.
- Homebrew/version labels render.
- An older pin is not auto-upgraded.
- Pinned snapshot data remains the source rendered on the sheet.

### 13.5 Migration and live RLS evidence

Existing content-versioning migration contract tests remain required. Add or retain live rollback-only smoke coverage proving:

- Owned private insert succeeds and creates version 1.
- Another authenticated user cannot select/update the private definition.
- An owner edit creates version 2 while version 1 remains immutable.
- A character pinned to version 1 still reads version 1 after the edit.
- A new pin to version 2 succeeds for the owner.
- A character owner cannot attach another user's private version.

## 14. Browser UAT

Use the built-in browser and the designated DM/player UAT accounts. Do not expose credentials in screenshots, DOM dumps, logs, or reports.

Required scenario:

1. Sign in as the DM UAT user.
2. Open Library and verify the private empty/list state.
3. Create an `E2E Homebrew ...` spell with components, a class, damage automation, duration, and concentration.
4. Verify it appears in Library as private version 1.
5. Open an owned compatible caster, find the spell in Add Spell, and add it.
6. Verify the sheet shows `Homebrew · v1`; cast it and verify the expected roll/duration/concentration behavior.
7. Edit the library spell's name, description, and damage to version 2.
8. Return to the first character and verify its v1 name/data/roll remains unchanged.
9. Use a second compatible character, or deliberately remove/re-add, and verify version 2 is selected.
10. Sign out and sign in as the player UAT user.
11. Verify the DM's private spell is absent from Library and character spell search and cannot be opened by guessed UUID.
12. Return to the DM account and clean up character references before service-role test cleanup removes the definition.

Automated Playwright coverage should follow the same v1 → edit v2 → old pin/new pin sequence with deterministic cleanup.

## 15. E2E Fixture and Cleanup Requirements

The content-versioning release requires every definition-backed `character_spells` fixture to include `content_version`. Update existing E2E seeding helpers to select the current definition version and insert it with `content_id`.

Add service-role-only helpers that:

- Track homebrew definition IDs created by tests.
- Remove dependent test characters/character spell rows before definitions.
- Delete only owned, `source = 'homebrew'`, `content_type = 'spell'` records with the reserved `E2E Homebrew` name prefix.
- Sweep leftovers in global teardown after campaign and character cleanup.
- Never expose the service-role key to a page or client bundle.

Cleanup failures should be visible without masking the primary test failure.

## 16. Rollout and Observability

### 16.1 Prerequisites

- The content-versioning, feature-grant, boundary-guard, and advisor-hardening migrations are deployed.
- Generated Supabase types include the version snapshot envelope and exact spell-version relationship.
- Full typecheck, lint, unit tests, production build, and existing browser smoke suite are green.

### 16.2 Deployment sequence

1. Merge and deploy the content-versioning release.
2. Run production smoke tests for existing character spells and auth.
3. Merge this vertical as a separate feature branch.
4. Run database/RLS smoke checks against the deployed schema.
5. Run built-in-browser DM/player UAT.
6. Verify Vercel checks and production logs before marking the vertical complete.

No feature-specific schema migration means rollback can remove the new routes and UI without deleting authored definitions. Existing valid definitions and immutable versions remain safe for a later redeploy.

### 16.3 Error reporting

Record operation names and non-sensitive identifiers for:

- library list/get failure
- spell create/update failure
- stale-version conflict counts
- malformed returned content omitted by runtime validation
- character add failure caused by content authorization/version mismatch

Never log full descriptions, material text, session values, access tokens, or credentials.

## 17. Deferred Decisions and Follow-ups

### 17.1 Sharing and publishing

The project's broader decision between campaign-only sharing and public publishing remains open. This vertical always creates `scope = 'personal'` and does not create shares. A later specification must define:

- campaign share/unshare transactions
- whether scope changes create versions and how old shared snapshots behave
- public discovery/moderation/licensing
- copying/remixing attribution
- DM versus player sharing permissions

### 17.2 Delete versus archive

This vertical has no delete UI. Before exposing deletion, choose one of:

1. **Archive recommended:** add archive metadata, hide archived definitions from new discovery, preserve definitions and every version indefinitely.
2. **Restricted hard delete:** allow hard delete only when no immutable snapshot is referenced, with explicit confirmation.
3. **No owner delete:** revoke authenticated DELETE and reserve cleanup for administrative/service workflows.

The existing database currently permits option 2 for unreferenced owner content and blocks referenced deletion through exact-version foreign keys. Do not describe the product as having a database-enforced no-delete guarantee until this decision is implemented.

### 17.3 Explicit character upgrades

A later flow may compare the pinned version with the current version, preview changes, and atomically update the character pin after confirmation. It must never become an implicit side effect of editing the library definition.

### 17.4 Later M4 work

- Campaign sharing and public publishing.
- Additional schema-driven content types.
- Version history and changelogs.
- Duplication/remixing.
- MPMB JavaScript importer, validation repair wizard, conflicts, audit log, and preview character.
- General mechanical-effect authoring.
- Custom content types.

## 18. Definition of Done

- All acceptance criteria in Section 2 have direct automated or UAT evidence.
- No new database policy, table, or homebrew-only gameplay path was introduced unnecessarily.
- Create/edit actions derive the trusted envelope server-side and use optimistic concurrency.
- Current definitions and pinned snapshots are visibly and behaviorally distinct.
- Old character pins survive and render correctly after a library edit.
- Cross-account private-content isolation is proven against the live RLS policies.
- Existing E2E fixtures include exact content versions and clean up safely.
- Typecheck, lint, unit/integration tests, production build, and browser UAT are green.
- Roadmap/game-plan status accurately describes this as the first private spell vertical, not completion of all M4.

