# Content and licensing review

**Status: unresolved.** This is a review checklist, not a license grant or a
finding that all repository content is cleared for distribution.

## Separate the rights involved

| Material | Current evidence | Remaining decision or check |
| --- | --- | --- |
| Inkborne application code | No root `LICENSE` is present | Owner chooses a software license after confirming the rights needed to license the contribution set |
| D&D 5e (2014) rules and text | Seed, migrations, and importer target a 2014 ruleset; importer uses the D&D 5e API | Map actual copied/adapted content to the appropriate SRD/source and include the required notices |
| API implementation and dataset | Upstream code/data licenses may differ from the game-text license | Inspect the exact upstream versions and dataset provenance; an API's MIT label alone is insufficient |
| MPMB imports and homebrew | User-provided scripts/content enter a private review workflow | Track author, source, license, and permission to import/share; static parsing does not confer content rights |
| Design mockups, fonts, icons, and other assets | Repository includes design bundles and game-text examples | Inventory sources and confirm reuse/redistribution terms, including non-SRD examples |

## Review before a public release

1. Inventory game text in migrations, transformations, fixtures, UI examples,
   screenshots, and imported catalogs. Record exact source and version for each
   content family. Keep unrelated private campaign data out of this inventory.
2. Confirm which material is covered by the applicable SRD and which is not.
   Do not assume that a named D&D subclass, setting, character, illustration, or
   sourcebook excerpt is included just because an import tool accepts it.
3. Add the relevant attribution and license notices for verified content.
   Remove or replace material where provenance or permission cannot be resolved.
4. Have the owner choose the application-code license. Do not copy a license
   from a dependency or another repository as a substitute for that decision.
5. Validate the resulting source tree and release artifacts, not only this
   checklist. Retain evidence of the review with each release.

## Authoritative starting points

- [Wizards of the Coast / D&D Beyond SRD guidance](https://www.dndbeyond.com/srd)
  distinguishes SRD versions and their licensing/attribution requirements.
- [D&D 5e API project](https://github.com/5e-bits/5e-srd-api) is the upstream API
  project; its code license does not automatically settle every content source.
- [D&D 5e API data](https://github.com/5e-bits/5e-database) and its
  [current monorepo location](https://github.com/5e-bits/5e-srd-api/tree/main/packages/5e-database)
  should be examined alongside the exact import paths and adapted material.

No legal-compliance conclusion, third-party permission, or selected software
license is implied by this checklist. Content outside a clearly applicable
license needs permission or replacement before redistribution.
