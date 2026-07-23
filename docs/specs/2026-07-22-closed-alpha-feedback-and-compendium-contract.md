# Closed-alpha feedback and compendium contract

**Status:** Shipped and production-UAT verified on 2026-07-22
**Owner:** Victor
**Date:** 2026-07-22

## Purpose

Closed alpha must let testers report problems from wherever they encounter them and browse the rules content they are allowed to use without first creating or editing a character.

These are two distinct surfaces:

- **Library / Compendium:** a read-oriented encyclopedia of accessible game content.
- **Homebrew:** the ownership, authoring, importing, versioning, and campaign-sharing workspace that currently lives at `/library`.

The preferred information architecture is to make `/library` the compendium and move the current authoring workspace to `/homebrew`, preserving redirects and deep links during the transition.

## Feedback contract

The existing feedback subsystem remains the foundation. Before closed-alpha invitations:

- Feedback is directly reachable from the persistent authenticated header on desktop and mobile; it is not hidden only inside the mobile menu.
- The form accepts freeform feedback and an optional Bug, Feature, Question, or Other category.
- Submission automatically records the current path and query string plus browser information. Character, campaign, wiki-page, and content identifiers already present in the route remain part of that captured path.
- Feedback is tied to the signed-in tester and stored under the existing row-level security rules.
- Admins can review, filter, annotate, and move submissions through New, Triaged, Resolved, or Won't Fix.
- A browser test proves that a tester can open the control from a representative page and submit feedback with that page context.

Do not capture form contents, character secrets, screenshots, or other page data implicitly. Richer diagnostic context can be added later only when it has a clear privacy boundary.

## Compendium access contract

The compendium is available to every authenticated user. It is not a DM-only feature. A person's role changes what they may manage inside a campaign, not whether they can browse game content.

The visible set is the union of content that the current user may access:

1. Platform/SRD content for the selected game system.
2. The user's own content, including private homebrew and imports.
3. Content shared with a campaign in which the user is currently a member.
4. Publicly published content, once public publishing exists.

It must exclude another user's private content, content shared only with unrelated campaigns, withdrawn content the user never pinned, and campaign-secret material not shared with that player. Existing character pins remain usable under their immutable-pin rules even when an entry is no longer discoverable for new use.

The builder and the compendium must use the same authorization semantics. A definition discoverable for character selection should be discoverable in the compendium, and the compendium must not become a broader data-leak path.

## Catalog behavior

The v1 catalog follows the existing journey design handoff:

- Select a game system, then a category.
- Search, sort, and apply category-specific filters.
- Browse paginated or virtualized results and open a useful read-only detail view.
- Show source/provenance such as SRD, personal homebrew, campaign-shared homebrew, and exact version where relevant.
- Support every implemented content type rather than a hand-maintained DM-only subset.

Initial categories should cover the seeded character-facing content already in the database: classes, species/races, backgrounds, feats, spells, items, weapons, armor, and conditions where structured data exists. Monsters, library NPCs, companions, and sidekicks join the same catalog as M5 introduces them.

## Closed-alpha exit checks

- Desktop and mobile testers can reach feedback without leaving their current page.
- A submitted report displays the captured page in the admin feedback dashboard.
- A normal player can browse and filter SRD spells and magic items outside a character sheet.
- Personal and campaign-shared homebrew appear for an entitled player; unrelated private content does not.
- A DM and player with the same content entitlement see the same compendium entry. DM status alone is not required.
- Category and detail layouts remain usable at desktop, tablet, and mobile breakpoints.

## Sequence

1. Finish the active atomic-background selection slice.
2. Harden the existing feedback control for persistent desktop/mobile access and add its browser test.
3. Build the v1 compendium shell and shared accessible-content query boundary for existing seeded categories.
4. Run the closed-alpha launch gate, then invite testers.
5. Add M5 creature/NPC content to the same catalog as each type ships.
