# Inkborne shared domain contract

Version 1 — 2026-10-29 (America/Phoenix).

This is the common vocabulary and integration boundary for Inkborne development.
Read it at kickoff and every continuation, including after context compaction.
It is not another roadmap: [LAUNCH-ACCEPTANCE.md](LAUNCH-ACCEPTANCE.md) owns status,
priorities, pauses and release gates. [CONTINUE-INKBORNE.md](CONTINUE-INKBORNE.md)
owns execution and verification policy. A user's explicit lane assignment selects
work within that lane; a general continuation follows the canonical queue.

## Shared definitions and invariants

| Concept | Contract |
| --- | --- |
| Character | One owned record with a stable ID. Builder, sheet and narrative refer to the same character; none maintains a second authoritative character. |
| Campaign | A group with membership and a game system. A character belongs to zero or one campaign. Reuse elsewhere uses an independent copy with an explicit copy policy. Assignment requires compatible system IDs and authorization. |
| Owner, DM, member | Permissions are object-specific. A campaign DM can read permitted player-character data but cannot edit player-owned mechanics. UI hiding is not authorization. |
| Rules system | Use the existing system ID and supported rules version. Do not infer a ruleset from a display name or silently mix 2014 and 2024 rules. |
| Content definition | A reusable class, race, spell, item, monster or other registered content type. Library browsing and builder selection use the same access semantics. |
| Content version and pin | Existing consumers retain their exact immutable content version. Editing or withdrawing a definition must not silently rewrite a character or make private content newly discoverable. |
| Instance | A specific use of a template with its own state, such as a campaign monster. Template identity and instance identity are distinct. |
| Character relationship | A person in a character's story. Existing storage uses the `npcs` table; that does not make it a Library NPC definition or playable actor. |
| Character journal | Character-owned narrative entries. Link by character ID; do not embed another editable character snapshot. A dedicated journal remains a feature to scope, not an assumed existing table. |
| Campaign session | A campaign event that journals and wiki pages may reference. A distinct session model requires a bounded design before implementation; this contract does not create one. |
| Wiki page | Campaign-owned world knowledge with creator, audience and revision. It is not a second character sheet or a duplicate journal. |
| Visibility | Reuse each object's existing audience model. For character narrative, `dm_only` means owner plus campaign DM; for wiki pages it includes creator plus DM. Never interpret it as automatically secret from the creator/player. |
| Revision and operation identity | Detect stale writes and preserve drafts. An uncertain response is not proof of failure. Reuse existing recovery contracts where applicable; do not introduce a new global save framework. |

Display wording can differ from storage terminology through explicit mappings.
For example, ancestry/species wording must not silently rename the existing race
content type or change its rules. IDs are references; names and slugs are labels.
Do not rename existing database fields merely to match this glossary.

Narrative edits must not overwrite mechanics, choices, inventory or resources.
Mechanics edits must not overwrite narrative. Use the existing scoped write
boundary; if a shared write cannot preserve unrelated fields, resolve that
specific conflict before using it. Do not implement parallel calculation engines.

## Lane boundaries

These are ownership boundaries, not authorization to start additional chats or
change the roadmap. Assign a lane explicitly before starting its implementation.

| Lane | Owns | Consumes without independently redefining |
| --- | --- | --- |
| Character Flow | Builder, sheet mechanics, calculation, equipment/resource mutations and character save/recovery | Content definitions, campaign membership and narrative references |
| Library | Browse/search/filter/detail presentation and catalog coverage | Shared content registry, versions and access rules |
| Character Journal | Narrative entry editing, organization and character-story presentation | Character identity, campaign access and existing rich-text conventions |
| Campaigns and worldbuilding | Membership, invitations, roster, wiki and explicitly scoped sessions | Read-only character references and shared content access |
| Homebrew and creatures | Explicitly assigned authoring/template/instance features | Content versioning, access and approved mechanics contracts |

Use one writer per worktree. The integrating chat owns shared schema, permissions,
registry and persistence changes; other lanes propose their bounded dependency
and keep progressing on independent work. Agree file ownership before overlapping
changes. Do not solve a dependency by copying another lane's model or helpers.

## Minimal kickoff and handoff record

Keep this short in the lane's existing handoff, not in a second roadmap:

- Lane and existing requirement ID; branch/worktree and source commit.
- Contract version read; user-visible outcome for the current slice.
- Owned files/modules and explicit exclusions.
- Shared contracts consumed; any proposed change and affected consumers.
- Smallest relevant checks and the concrete risk each addresses.
- Delivered behavior, remaining blocker, and next product action.

At continuation, compare this record to the current contract and source. Resume
the next ready product action; do not restart an accepted slice or reread all
historical evidence. A general "continue" retains the lane assignment.

## Contract changes and drift prevention

1. Preserve existing contracts by default. A new UI or feature does not authorize
   a semantic change to ownership, visibility, identity, versioning or saves.
2. When a change is necessary, record the old/new behavior, affected consumers,
   compatibility/migration needs and smallest integration check in the existing
   handoff. The integration owner coordinates the shared edit. Escalate a product
   decision or consequential external action to the user; routine compatible
   local changes need no new permission.
3. Update this document in the same change as the implementation. Bump its version
   for a semantic change and add one concise change-log entry. Never silently
   reinterpret a term in a lane-specific document.
4. Before accepting integration, check the changed producer and actual consumer
   together. A journal change needs its save/reopen and audience behavior checked;
   it does not automatically require every builder scenario to be rerun.
5. If documentation and code disagree, identify the discrepancy and preserve the
   stricter applicable privacy/data-integrity boundary while resolving it. Do not
   claim a new contract is implemented merely because this document was edited.

These rules need adoption in each worktree. An already-running chat does not
receive a new document automatically. At a safe checkpoint, its owner integrates
the documentation commit and reads the contract before continuing. Older
worktrees must update deliberately; do not reset them or overwrite active work.

## Existing domain references

- [Campaign membership, ownership and wiki](specs/2026-07-19-campaign-foundation-design.md)
- [Character timeline and relationships](specs/2026-07-19-character-timeline-relationships.md)
- [Library and Homebrew access](specs/2026-07-22-closed-alpha-feedback-and-compendium-contract.md)
- [Durable gameplay state](specs/2026-10-11-durable-roll-state-contract.md)

## Change log

- Version 1: established common terminology, lane ownership and continuation
  checks. Preserves existing data contracts; journal/session distinctions guide
  future bounded design and do not claim new implementation.
