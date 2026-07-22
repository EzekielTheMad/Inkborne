# M4 background authoring and campaign sharing

**Status:** Implemented for preview verification

## Goal

Let a signed-in player create and edit a structured D&D 5e (2014) homebrew
background, keep its history immutable, and grant or revoke access for exact
campaigns without giving a DM permission to edit the definition.

## Product contract

- New backgrounds begin private and remain owned by their author.
- Authoring uses finite named controls for the background feature, skills,
  tools, languages, resources, equipment description, and story prompts. The
  browser cannot submit ownership, scope, raw effects, or a content envelope.
- Effects are derived on the server from validated background data.
- Edits use optimistic version checks and create immutable snapshots through
  the existing content-definition version trigger.
- Only the author can grant campaign access. The author or the owning DM can
  revoke an existing share. Neither operation grants definition edit access.
- First share and final unshare change scope and therefore create a new
  immutable version; character pins continue to reference their exact version.
- Imported content remains private until a separate rights workflow exists.

## Implementation boundary

- Add `/library/backgrounds/new` and `/library/backgrounds/[id]/edit` surfaces.
- Add owner-only server records and server actions for create, update, list,
  and campaign access.
- Extend the existing generic spell/feat campaign-sharing RPC allowlist to
  include `background`; do not create a second sharing model.
- Surface owned backgrounds in `/library` and include them in DM revocation.

## Deferred builder work

This slice does not change background selection. The existing builder performs
multiple browser writes and renders a selected background from the mutable
current catalog. A follow-up must make selection atomic and render the exact
pinned snapshot before authoring is presented as full builder integration.

Confirmed-equipment replacement also needs an explicit product rule because
the current inventory and currency records do not retain enough provenance to
safely remove an earlier background's grants.

## Verification

- Mapper tests prove normalization, validation, derived effects, and rejection
  of browser-controlled envelopes.
- Server tests prove authentication, ownership, optimistic conflicts, immutable
  persistence inputs, exact campaign access, and safe database result parsing.
- Migration contract tests prove background support while retaining source,
  system, ownership, membership, import-rights, and revocation boundaries.
- Component/action/page tests cover accessible finite controls and user-visible
  version/share behavior.
- Release gate: strict typecheck/lint, full Vitest suite, production build,
  hosted migration/advisors, and protected-preview browser UAT.
