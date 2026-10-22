# Inkborne fantasy notebook pilot

22 October 2026 · Revision 3: evolution of the current site · Direction A, The Scribe · Context review pending

This revision preserves the current site's fantasy notebook personality: ink-purple surfaces, warm gold, expressive headings, italic emphasis, faint grain, selective folio numbering, and specific campaign details. Light translates that atmosphere onto warm paper; Dark retains its familiar inky character. It replaces the earlier neutral homepage composition, which removed too much personality.

The Scribe identity remains selected. Use the ink lockup on Light and the reverse lockup on Dark. Gold and purple support the site identity; the asset pack's oxblood exports remain earlier exploration rather than the current default product accent. The [brand guide, version 2](../../brand-reference.md), is the canonical reference.

These are design studies and an asset candidate. They do not change the application, its current logo, or `dev.inkborne.app`. Final appearance still needs review in context.

The subsequent [local homepage implementation](../homepage-notebook-local/README.md) adopts this approved composition in the application. The files in this pilot remain standalone studies; use the implementation notes for current application review and verification.

## Review the previews

Open [preview.html](preview.html) for the homepage and [character-preview.html](character-preview.html) for the character study. Both files embed their fonts, logos, styles, and behavior, so they can be opened without a server or network font request. The standalone homepage links to the character study.

Both previews provide **Light / Dark / System** appearance. An unconfigured study starts in Dark; a saved preview choice takes precedence. System follows the browser's effective preference. Preview settings are separate from the application's saved theme and character data.

The homepage evolves the existing centered introduction and three alternating vignettes: a character sheet, a Session XII journal excerpt from Shadepoint, and a fictional Coven of Greyfen spell. Marcellus display headings, actual EB Garamond italics, selective notebook ornament, and a distinct open-source editorial section carry its personality. The page avoids competitor comparisons, invented testimonials, and unverified self-hosting or offline-product promises.

Sign in and Start building open the current dev site's `/login` and `/signup` routes. The remaining homepage illustrations are static and use fictional content; they are neither captures of shipped screens nor proof of working character-sheet behavior.

In the character preview, use **Appearance**, **Character**, and **Character color**. Sheet, Story, Equipment, and Builder carry the selected character's treatment. Characters without a custom choice follow the site's theme-aware gold action accent. Saved presets and custom colors retain their source hex while the resolver derives readable text, fill, tint, and border roles for the effective theme. Reset returns to the site default.

The color dialog offers the existing six presets, stress-test colors, a custom hex/native picker, and the site-default choice. **Apply** commits within the preview; **Cancel** discards the draft. **Add a note** opens a related dialog outside the inner character wrapper, with the same resolved character roles. These controls demonstrate interaction and context handling using fictional data.

Local changes stay within the study's browser storage, or conversation state where supported. No game, character, or account data is sent to the app. The character preview keeps a bounded note history locally and caps the conversation snapshot below 15,000 bytes by removing older notes from that snapshot. The browser-local history can therefore be larger than the host copy. This is a review convenience, not a supported character-data storage workflow. Optional persistence failures must leave the controls usable.

## Files and sources

| File | Purpose |
| --- | --- |
| [index.html](index.html), [preview.css](preview.css), [preview.js](preview.js) | Editable homepage source, root-scoped notebook styling, and preview-only appearance behavior. |
| [character-study.html](character-study.html), [character-study.css](character-study.css), [character-study.js](character-study.js) | Editable character study, four related views, dialogs, and preview-local state. |
| [character-colors.js](character-colors.js), [character-colors.check.cjs](character-colors.check.cjs) | Proposed color-role resolver and independent contrast/source-retention checks; not an application token migration. |
| [brand/README.md](brand/README.md) | Vector master, transparent lockups, symbol exports, app icons, favicon, proof board, manifest, and regeneration instructions. |
| [fonts/README.md](fonts/README.md) | Marcellus and normal/italic EB Garamond sources, subsets, hashes, and licenses. |
| [build-preview.py](build-preview.py), [build-character-preview.py](build-character-preview.py) | Standard-library Python builders for the self-contained offline pages and conversation fragments. |
| [preview.html](preview.html), [character-preview.html](character-preview.html) | Generated standalone pages with the same source behavior and embedded assets. |
| `inkborne-logo-context.html`, `inkborne-character-context.html` | Generated conversation fragments with the product's own appearance and character controls. The homepage filename is retained for continuity; it now contains the complete notebook homepage. |
| [screenshots/](screenshots/) | Review captures. `notebook-*` filenames belong to Revision 3; earlier names record previous studies. |

Rebuild from the repository root:

```powershell
python docs/design-briefs/field-journal-pilot/build-preview.py
python docs/design-briefs/field-journal-pilot/build-character-preview.py
```

For an inline conversation preview, also export to an **existing thread-readable directory supplied by the current environment**. The repository path alone may not be readable by the visualization host; that mismatch previously produced `Invalid visualization read request`.

```powershell
$taskInlineDirectory = '<current thread visualization directory>'
python docs/design-briefs/field-journal-pilot/build-preview.py --inline-dir $taskInlineDirectory
python docs/design-briefs/field-journal-pilot/build-character-preview.py --inline-dir $taskInlineDirectory
```

The builders retain the repository copies, write identical fragment copies to that directory, and verify their hashes. Point the inline visualization reference at the exported absolute file path. Use the current thread's provided directory in future sessions; do not assume the example above is available or authorized in another environment. Each fragment must remain below 1 MB and contain no document-level HTML wrappers.

Edit the source files or canonical logo source and regenerate derivatives. Do not hand-edit packaged previews or individual logo exports. The packages embed local font and logo assets, and the inline copies do not depend on cross-file preview navigation.

Check the character resolver with Node:

```powershell
node docs/design-briefs/field-journal-pilot/character-colors.check.cjs
```

The resolver preserves the saved source hex, builds opaque theme-specific roles, and checks rounded output against the page, surface, and tint colors. It adjusts text and boundary tones toward readable neutrals while retaining the source for identity fills. Each fill gets readable text and a visible boundary. Site default uses the exact primary-action color for the active theme; a saved hex matching today's default remains a custom choice until reset.

## Review evidence

<!-- revision-3-verification -->
Revision 3 verification completed locally:

- The revised resolver passes **1,486** Light/Dark role sets, including 14 named cases and 729 RGB samples per theme. Independent calculations verify at least 4.5:1 for ordinary accent text and text-on-fill, and 3:1 for essential accent boundaries on the actual opaque page, surface, and tint colors. Base text, muted text, control boundary, and focus colors also pass their role checks.
- Browser inspection covered the homepage and character study at desktop, 840, 390, and 320 CSS px. Essential content and all four character views fit without horizontal page overflow. Both themes, theme-specific logos, and the browser's current System preference were checked. The three embedded font files decode, and the rendered headings and italic text use their intended font families. No failed images were found.
- Character checks covered theme-aware default gold, custom white/yellow/black, custom retention across theme changes and reloads, reset, character isolation, all four views, related note-dialog roles, invalid color input, Apply/Cancel, and Enter-to-apply. Required-note validation and an 80-character unbroken title were checked; the title wraps within the reading column.
- Both generated conversation fragments were exercised in the renderer's `allow-scripts` sandbox. Homepage appearance changes, character color Apply, note Save, and keyboard color Apply worked. The character content and dialog fit the narrow review width. No browser console errors were reported in the packaged checks.
- An independent source review found no remaining material issue. The study retains the existing Scribe geometry and removes homepage competitor comparisons, invented testimonials, and unsupported product promises.

A live operating-system appearance change and the native operating-system color picker were not automated. These checks do not establish full accessibility conformance or verify the authenticated application. Both fragments are below 1 MB; exported conversation copies match their repository originals by hash.

Historical evidence from Revisions 1–2 is retained for context and does not verify the revised palette or composition:

- Earlier source and packaged pages were reviewed at 1440, 840, 390, and 320 CSS px without horizontal overflow or failed images. Earlier character checks covered all four views, color Apply/Cancel/Escape, invalid input, reset, per-character isolation, reload persistence, and note dialogs inside the conversation renderer's `allow-scripts` sandbox.
- The previous resolver passed 1,486 role sets across both themes, including a 729-color RGB sample. Those historical results applied to the previous palette; Revision 3 results are recorded above. Role checks alone do not establish accessibility conformance.
- All 44 logo exports previously matched the manifest's hashes, sizes, and dimensions. SVGs parsed without active/external content, rasters and ICO decoded, the nib counter was transparent, and reverse preserved its shape. The logo geometry is retained in this revision.
- Prior review exercised direct Light/Dark changes and the browser's current System preference. It did not exercise a live operating-system appearance change or automate the operating system's native color-picker UI.

This is documentation, asset, and static-prototype work. Application-wide checks and authenticated end-to-end workflows are outside this study because no application code is migrated. No hosted data, deployment, or Figma canvas is modified. Local prototype inspection does not establish accessibility conformance or product workflow acceptance.

## Decisions still open

Confirm that the revised composition retains the current site's personality in both themes, that the ornament stays subordinate to reading and play, and that the Scribe wordmark remains readable in smaller footer/mobile placements. The existing 112–180 px lockup placements are review sizes, not an approved minimum. The 16 px icon preserves the nib silhouette; the internal I is a secondary detail at that size.

Character accents follow the [brand guide's personalization contract](../../brand-reference.md#character-personalization). Review default gold and custom accents in both themes, including bright and near-black/near-white choices, across all four related views and a dialog. The precise derived tones and placements remain candidates for visual approval; application adoption requires separate workflow and accessibility verification.

After context approval, implement the chosen homepage and identity assets in a scoped application change, preserving existing authentication, navigation, saved appearance, and character color behavior. Extend the notebook direction through representative app screens before a wider visual pass.
