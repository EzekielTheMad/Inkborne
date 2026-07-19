# Campaign foundation design

**Status:** implemented locally; pending database apply and authenticated UAT
**Date:** 2026-07-19

## Product contract

- A character belongs to zero or one campaign. Reuse in another campaign is handled by copying the character into a new, independently owned record.
- A campaign belongs to the user who created it. That owner is the campaign DM and always retains campaign administration access.
- DMs can view character sheets and their supporting sheet data inside their campaigns, including private sheets, but cannot mutate player-owned characters.
- Campaign members can view a character when its owner marks it campaign-visible. Public character visibility remains separate.
- Every campaign page has one creator and one audience:
  - `campaign`: visible to the DM, creator, and campaign members.
  - `dm_only`: visible only to the DM and creator.
- The campaign owner and page creator can edit a campaign page. The campaign owner can remove any page because the campaign belongs to them.
- Public campaign publishing is deferred. It will require an explicit campaign opt-in and per-page publication audience; `dm_only` content must never be eligible implicitly.
- Initial collaboration uses revision-based optimistic concurrency. Automatic merge/CRDT behavior is deferred until the authorization and editor models are stable.

## Database boundary

Authorization is enforced in Postgres RLS, not only in route or component checks.

- Private `SECURITY DEFINER` helpers resolve owner/member/character visibility without recursive RLS joins. They use an empty `search_path`, fully-qualified relations, and are not exposed through the API schema.
- Creating a campaign automatically creates the owner's `dm` membership row.
- Players join only through `join_campaign_by_invite_code`; direct self-insertion into arbitrary campaigns is removed.
- Campaign identity (`owner_id`, `system_id`) is immutable until a dedicated transfer/migration flow exists.
- Character assignment requires membership or ownership and an exact game-system match.
- Sheet child tables follow character view permissions for `SELECT`, while their existing owner-only mutation policies remain unchanged.

## Campaign page model

`campaign_pages` stores a hierarchical wiki:

- `campaign_id`, optional `parent_id`
- immutable `created_by`, tracked `updated_by`
- title, campaign-unique slug, TipTap-compatible JSON content
- `campaign` or `dm_only` visibility
- monotonic `revision` for optimistic concurrency
- created/updated timestamps

Parents must belong to the same campaign. Moving a page across campaigns or changing its creator is rejected by a trigger.

## Delivery sequence

1. ✅ Repair campaign membership and character-view RLS; add campaign pages.
2. ✅ Add campaign CRUD, invite-code joining, roster, and character assignment.
3. ✅ Add character copy with an explicit copy manifest for sheet-owned child data.
4. ◐ Add wiki tree, page editor, backlinks, and revision-conflict handling. The tree, editor, and conflict protection are complete; backlinks remain.
5. Add short-lived edit leases/presence if concurrent editing warrants it.
6. Design public publishing as a separate filtered read model.

## Verification state

- Migrations `00041`–`00044` are committed but have not been applied to the hosted Supabase project from this environment.
- Static migration contracts, authorization unit tests, the full Vitest suite, strict lint, TypeScript, and the production build pass.
- Authenticated browser UAT is required after applying the migrations. Test DM and player sessions should cover hidden/shared pages, read-only DM character access, character copy/assignment, invite rotation, leave/remove cleanup, and stale page revisions.
