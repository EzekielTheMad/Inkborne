# M4 Feat Sharing and Character Selection

**Status:** Approved implementation slice  
**Date:** 2026-07-21  
**Milestone:** M4 — Homebrew + Importer

## Goal

Complete the first non-spell homebrew vertical: an author can share a released
homebrew feat with a campaign, an eligible player can choose that feat instead
of an Ability Score Improvement, and the character sheet evaluates the exact
version that was chosen.

This slice must preserve the product rules already established for Inkborne:

- a character belongs to at most one campaign;
- the character owner, not the DM, edits the character sheet;
- a DM owns the campaign and may remove content access from that campaign;
- content authors retain edit ownership;
- existing character pins survive edits and later unsharing;
- imported content remains private until a rights workflow exists.

## User flow

1. A user creates or edits a private homebrew feat in `/library`.
2. The feat edit page exposes the same campaign-access controls as a homebrew
   spell. The author can share only to a same-system campaign they currently
   belong to.
3. A campaign DM can see content shared to their campaign and revoke that
   campaign's access. Revocation does not grant edit rights.
4. At an earned Ability Score Improvement, the character owner chooses either:
   - one ability by +2;
   - two abilities by +1; or
   - one eligible feat.
5. The feat picker shows platform feats, the user's own active feats, and feats
   shared to this character's exact campaign. It does not use the caller's
   aggregate campaign memberships.
6. A feat with an unmet supported prerequisite is visible but disabled with a
   concise reason.
7. Saving replaces the previous choice for that ASI occurrence atomically. A
   feat choice creates one exact-version `character_content_refs` pin; an ASI
   choice removes that pin.
8. The builder refreshes derived stats and the sheet shows the selected feat,
   its effects, resources, and action metadata from the pinned snapshot.

## Data and authorization contract

### Share boundary

`set_content_campaign_share` remains the sole mutation boundary and is
hardened as follows:

- only released shareable types (`spell`, `feat`) are accepted;
- only active `source = 'homebrew'` content may be shared;
- enabling access requires content ownership and current same-system campaign
  membership;
- disabling access is allowed for either the content owner or the campaign
  owner;
- the expected content version is required and stale mutations fail closed;
- first share and final unshare continue to produce immutable scope snapshots;
- imported content cannot be shared.

The campaign-owner revocation path may change only the share/scope snapshot. It
must not permit editing content data, effects, ownership, or other campaigns.

### Character-aware discovery

Add `search_usable_feats_for_character`. It requires authentication and
character ownership, clamps input lengths/result count, and returns current,
active, same-system feat definitions only when the exact target character can
use the returned version. Each result includes a server-derived prerequisite
status and reason. Unsupported prerequisite shapes are not selectable.

### Atomic choice mutation

Add one owner-only `set_character_asi_choice` RPC. The function locks the
character, resolves exactly one active `character_feature_grants` occurrence
whose pinned feature snapshot has `feature_type = 'asi'`, validates the choice,
then updates both `characters.choices.asi_choices` and the associated content
reference in one transaction.

The browser may submit only:

- character id;
- ASI feature slug;
- mode (`asi` or `feat`);
- validated ability allocations for ASI mode; or
- feat id and the exact version shown by discovery for feat mode.

The database owns the remaining envelope. The feat pin uses stable
`choice_source = 'choice:asi:' || feature_grant_id` and server-derived context.
It validates:

- caller owns the character;
- the ASI occurrence is currently earned and unambiguous;
- the content type is `feat` and the exact version is accessible to this
  character now;
- the selected version is the current released version;
- supported prerequisites are met before applying the candidate feat's own
  effects;
- the same feat is not selected in another ASI slot;
- ASI allocations are two distinct +1 choices or one +2 choice, and do not
  raise an ability above 20.

Replacing or clearing a choice deletes only the ref for that ASI grant. It must
not disturb class-feature projections or refs created by other builder steps.

## Type and UI contract

`AsiChoice` becomes a discriminated union:

```ts
type AsiChoice =
  | { mode: "asi"; allocations: AsiAllocation[] }
  | { mode: "feat"; featId: string; featVersion: number; featName: string };
```

The stored name is display-only. Authorization and sheet evaluation always use
the exact pinned content/version row.

The class rail's ASI card adds an `Ability scores` / `Feat` mode switch, search,
prerequisite messaging, provenance, and current-version labels. Persist only
complete choices; a partial two-score selection remains local UI state.

The old standalone `components/builder/asi-selector.tsx` must either consume the
same shared selector contract or be retired if it is unused. There must not be
two divergent ASI implementations.

## Failure behavior

- Authorization, campaign mismatch, stale content, unearned slots, duplicate
  selections, and unmet prerequisites fail closed in the RPC.
- The client rolls optimistic state back and presents an actionable error.
- An existing pinned feat remains readable/evaluable after edit or unshare.
  It cannot be newly selected elsewhere unless it is currently discoverable.
- Removing a class level that deactivates an ASI occurrence prunes that
  occurrence's feat ref and stored choice together.

## Verification

Automated coverage must include:

- migration contracts for grants/revocations, type allowlisting, least
  privilege, exact-campaign discovery, prerequisite handling, atomic swapping,
  duplicate rejection, and level-down pruning;
- DAL/action tests for narrow inputs and error mapping;
- ASI union, builder completion state, picker interaction, partial split
  behavior, rollback, and exact-version rendering;
- evaluator/sheet coverage proving a selected feat changes derived stats and
  appears in features/actions/resources where applicable;
- full lint, typecheck, Vitest, production build, and Playwright smoke.

Hosted UAT uses two accounts and two campaigns and proves:

- own/private/shared discovery boundaries;
- wrong-campaign exclusion;
- player selection and exact version pinning;
- old pin survival after edit and final unshare;
- DM read-only character access;
- DM campaign-share revocation without content edit access;
- imported feats remain unshareable;
- no disposable fixtures remain afterward.

## Deferred

- public publishing and public profiles;
- arbitrary/compound prerequisite expressions;
- feat-internal subchoices (languages, proficiencies, spells, etc.);
- variant-human or other non-ASI feat grants;
- real-time multi-user editing/presence;
- licensing/rights attestation for imported content.
