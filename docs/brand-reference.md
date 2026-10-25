# Inkborne brand guide

Version 2.10 · 24 October 2026

Inkborne brings playable character sheets and character stories together. Its visual identity is a player's fantasy notebook: useful at the table, personal between sessions, and full of the atmosphere of a living campaign. Evolve the current site's ink-purple, warm-gold manuscript character rather than replacing it with a neutral productivity app.

This is the canonical reference for brand, visual design, and public copy. Use it for new work and scoped updates to existing screens. It supersedes conflicting visual and marketing instructions in older [design briefs](design-briefs/). Functional requirements and release acceptance remain governed by the [game plan](GAME-PLAN.md) and [acceptance ledger](LAUNCH-ACCEPTANCE.md).

## Identity and audience

**Name:** Inkborne. Use this spelling and capitalization consistently.

**Short description:** Character sheets and character stories, kept together.

**Product description:** Inkborne helps tabletop players build and play characters while keeping their backstory and campaign notes close.

The primary audience is players and game masters who want useful character tools, room for homebrew, and a record of their campaign. Design for the recurring tasks of a real game: finding a modifier, tracking a resource, making a choice, and returning to a note.

Open source and community participation are part of the identity. Describe their practical benefits accurately. Claims about exports, offline operation, self-hosting, or independence from hosted services must match the actual supported workflow.

## Design principles

| Principle | Application |
| --- | --- |
| The character is the subject | Give identity, abilities, resources, and story clear places. Use representative product views to explain the app. |
| Craft supports atmosphere | Combine expressive type, notebook structure, and purposeful ornament with clear, practical controls. |
| The interface earns its space | Preserve useful information density. Favor grouped rows and sections over a separate card for every value. |
| The player stays oriented | Make the current location, next action, save state, and recovery path easy to find. |
| Personality survives both themes | Carry the same hierarchy and character through light and dark surfaces. Preserve user-selected character accents. |

The current site is the personality baseline. Preserve its expressive headings, gold italic emphasis, ink wash, folio numbering, and specific campaign details. Refine their placement and readability. The earlier neutral field-journal study removed too much of this character and is superseded by this revision.

| Detail | Use with purpose |
| --- | --- |
| Expressive typography | Marcellus headings and Garamond italic emphasis establish the manuscript voice. Keep controls and statistics practical. |
| Texture and atmosphere | Use faint grain around 1–2% and broad ink washes at no more than about 5% opacity on outer or editorial surfaces. Keep reading areas, forms, and data surfaces clear. Check the final composited contrast. |
| Notebook structure | Use selective Roman folios, ruled edges, a bound-page treatment, and short marginal notes to orient real sections. Avoid repeating every flourish in every panel. |
| Story details | A drop cap can introduce an actual journal excerpt. Specific fictional names, dates, locations, and spells give examples a campaign's personality. Label examples as fictional. |
| Ornament | The nib, an occasional small divider, and a restrained decorative rule can connect the identity to the page. Avoid heavy distressed paper, illegible handwriting, glowing controls, and oversized ambient blobs. |

## Visual reference

The homepage composition combines an original illustrated character, overlapping sheet and journal leaves, an explorable Character/Journal/Homebrew notebook, and a distinct open-source editorial band. Its implementation notes and earlier studies live in the homepage/auth release history at `d5c5020` under `docs/design-briefs/homepage-notebook-local/` and `docs/design-briefs/field-journal-pilot/`. They are not copied into this mechanics-integration-based checkout.

Direction A, The Scribe, remains selected. Use ink on light surfaces and the reverse treatment on dark surfaces. The [production lockups](../public/brand/README.md) are present in this branch. The original exploration and full export pack remain in the release history above; oxblood is an exploratory alternate, not the default product accent.

The [original character-sheet baseline](design-briefs/character-sheet-baseline/README.md) is the starting visual reference for sheet work. It records actual pre-refresh components and matched screenshots. The [first character-sheet notebook draft](design-briefs/character-sheet-notebook-refresh.md) was reviewed and found too sanitized; it is **not approved as a visual direction**. Its theme/accessibility work is useful implementation material, but its neutral header, flattened statistics, and ruled-column composition must not become the canonical sheet design. Earlier character HTML and version 1 vector studies are historical explorations, not evidence of the working application's presentation.

The auth notebook refresh continues this identity through sign in, signup, verification, and recovery: a restrained notebook spread on desktop, focused mobile forms, and scoped feedback colors. It deployed to dev as `99acb2c`, preserving authentication. Its receipt is retained at `d5c5020:docs/handoffs/2026-10-23-auth-dev-deployment-receipt.md`; its local evidence is under that release's `docs/design-briefs/auth-notebook-local/`. Hosted UI checks do not establish provider or mail acceptance.

Prove the direction on the homepage and a representative character screen before extending their layouts through the app. Keep the resulting desktop and mobile references beside this guide and identify which design revision they represent.

## Color and themes

Design the homepage and working app for coordinated Light, Dark, and System choices. Preserve the saved preference when navigating between them. Both themes carry the same fantasy notebook personality; Dark retains the current site's atmosphere and Light translates it onto warm paper. A fresh design preview starts in Dark when no choice is saved; this does not authorize changing an existing player's preference.

These are version 2 target colors. Implement them through semantic tokens when the relevant surface is redesigned; do not paste these values throughout components.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| Page | `#F4F0E6` | `#0B0A10` | Main background |
| Surface | `#FFFCF5` | `#1A1626` | Panels, reading areas, forms, menus |
| Text | `#282A25` | `#F0EEF5` | Main text and numbers |
| Secondary text | `#655B6D` | `#BBB0CA` | Supporting labels and descriptions |
| Decorative rule | `#D7CEDD` | `#393047` | Nonessential dividers |
| Control boundary | `#8A7B92` | `#81718E` | Inputs and boundaries needed to identify controls |
| Primary action | `#785923` | `#C9A44A` | Main action, gold emphasis, default character accent |
| Primary action text | `#FFFCF5` | `#0B0A10` | Text on primary actions |
| Link and focus | `#70448D` | `#D0ABEE` | Underlined links and visible focus indicators |

Gold and ink-purple carry the shared identity. Keep success, warning, and destructive colors distinct through labels and icons as well as color. Character accents communicate character identity and follow the personalization contract below.

Target at least 4.5:1 contrast for ordinary text and 3:1 for essential control boundaries and focus indicators against adjacent surfaces. Decorative rules are not suitable input borders. Check actual rendered combinations, including transparency, selected states, character accents, and disabled controls; a palette table alone does not establish accessibility.

Theme changes must cover dialogs, menus, popovers, tooltips, editor content, charts, and loading states. Use one document-theme owner, preserve the existing preference interface, and avoid an initial flash of the wrong theme.

### Character personalization

Each character may use the site accent or a player-selected color. Preserve the existing preset and custom-color choices through the refresh.

| Choice | Light and dark behavior |
| --- | --- |
| Default / no saved color | Follow the active theme's **site primary-action accent** from the palette above: burnished gold in Light and warm gold in Dark. Use the semantic role, not a copied hex value or a legacy token name. System follows the effective app theme. |
| Saved custom color | Keep the saved hex as the source color. Derive readable foreground, control fill and its text, subtle background, border, and supporting tones for the active theme. Changing theme must not overwrite the player's choice. |
| Reset | Clear the custom choice and return to the theme-aware site default. A saved hex that happens to match today's site accent remains a custom choice until reset. |

Apply the character treatment consistently across the sheet, story, equipment, builder, and other pages belonging to that character. Use it for identity marks, section emphasis, character navigation, and character-owned controls. Related dialogs, menus, and popovers must receive the same character context even when rendered in a portal. Shared lists may show each character's accent within its own row or card; they must not recolor the whole page with the last-viewed character's choice.

Keep the Inkborne logo and global navigation in the brand treatment. Error, warning, success, and focus retain their semantic roles and appropriate theme values. Character color may tint a selected control, but a check, underline, boundary, shape, or label must also communicate selection. A red character accent must not make ordinary identity elements look like errors.

Use the existing character token family as the implementation starting point. Resolve derived tones where both the character color and active theme are available, and verify the actual computed styles on descendants and portaled content. Do not replace global brand tokens with a character color. Do not use an arbitrary saved hex directly for essential text, control boundaries, or text-on-fill combinations without checking the rendered contrast. Preserve recognizable color identity where practical; use a readable neutral treatment where a requested tone cannot serve the role safely.

Before adopting a refreshed character screen, review the default, representative presets, saturated yellow/red, near-white, and near-black custom colors in both themes. Use the character study above to assess these treatments, then verify the actual application separately. Verify default → custom → theme switch → reset, saved custom-color retention after reload, navigation between differently colored characters, and matching dialogs/popovers. Apply the contrast targets above to actual rendered combinations; a successful color save alone does not verify the design.

## Typography and identity mark

Retain **Marcellus 400** for display headings, character names, and major section titles. Use **EB Garamond** for narrative passages and **EB Garamond Italic 400** for editorial emphasis, journal annotations, and selected story phrases. Use the existing system sans-serif stack for controls, supporting product explanations, tables, and dense character information. Keep numerical columns aligned with tabular figures. This keeps the current site's expressive contrast while improving hierarchy and legibility.

| Role | Starting size | Treatment |
| --- | --- | --- |
| Homepage title | 48–64 px desktop; 32–40 px mobile | Marcellus, regular weight, selective Garamond italic emphasis |
| App page title | 32–44 px | Marcellus, clear hierarchy |
| Section heading | 22–30 px | Marcellus; consistent sans-serif subheadings within dense tools |
| Reading text | 16 px UI; 18–22 px narrative | Sans-serif for explanations; Garamond for story, line height around 1.5–1.65 |
| Controls and dense rows | 14–16 px | Sans-serif, legible labels and values |
| Secondary metadata | 12–13 px | Short supporting information only |

Allow content and available width to determine wrapping. Keep essential instructions and actions out of tiny uppercase text. Use a readable measure for narrative passages rather than stretching paragraphs across the full sheet.

Use the selected A nib and its transparent capital I counter as the identity direction. The primary treatment is dark ink on paper or warm white on dark surfaces. The alternate uses an oxblood symbol beside a dark-ink wordmark. Keep the counter transparent and each symbol a single solid color.

The full asset pack at `d5c5020:docs/design-briefs/field-journal-pilot/brand/README.md` contains an outlined EB Garamond 600 wordmark, horizontal and stacked lockups, symbol-only variants, and exports from one source. Keep clear space around the lockup, use the symbol alone when the name would become too small to read, and use the optical small-size exports for favicons. Avoid gradients, metallic effects, decorative type substitutions, and a different logo treatment on each screen.

The current app loads Marcellus and EB Garamond through `next/font`; retain that type relationship. The logo uses an outlined EB Garamond 600 wordmark and has no font-loading dependency. Bundle page fonts through the existing pipeline and keep sensible fallbacks. Study font sources and licenses remain at `d5c5020:docs/design-briefs/field-journal-pilot/fonts/README.md`.

## Layout and interface patterns

- Use a 4 px spacing scale. Start with 16–24 px section padding, consistent gaps, and a clear alignment grid.
- Use fine rules to separate related material. Reserve enclosing panels for meaningful groups, dialogs, and forms. Keep radii around 4–6 px, with larger values only where they serve an established component.
- Place the primary action near its task. Use plain verb labels such as “Create character,” “Save changes,” and “Add note.” Distinguish destructive actions by label and placement.
- Keep the public header quiet: one visible **Sign in** account entry on desktop and mobile. Place **Start building** in the hero and closing section. Use a compact sun/moon appearance button; its accessible menu retains Light, Dark, and System choices without an always-visible selector or label.
- Preserve readable density on the sheet: labels beside values, aligned statistics, and visible resource state. Maintain clear visual differences between editable fields, computed values, and unavailable choices.
- On mobile, stack sheet and story sections in a deliberate reading order. Keep important gameplay controls reachable and touch targets at least 44 px where practical. Avoid horizontal page scrolling for essential information.
- Design empty, loading, saving, success, validation, and failure states alongside the main view. Long names and real narrative content must fit.
- Keep motion short and functional. Respect reduced-motion preferences; no information or operation may depend on an animation.

On the homepage, give the expressive introduction a composed visual focal point: original character artwork, a readable sheet, and a journal leaf with purposeful overlap. Keep text and statistics unobscured; use the edges of the paper for depth. Carry the same fictional character through the sheet, journal, and homebrew subjects. These may share one explorable notebook rather than repeat equally sized enclosing cards. Keep the open-source editorial band as a quieter section after the product example.

Use Roman folios, bookmark navigation, page edges, and short marginal notes to connect the composition. Keep real product explanations beside specific fictional examples, such as a session entry at Shadepoint or a spell from the Coven of Greyfen. Mobile should deliberately stack the notebook's identity and reading areas while keeping all bookmarks and controls reachable. Interaction must work with keyboard navigation and reduced motion; avoid automatic carousels and motion that carries essential information. Original illustrations may retain their warm-paper background in both themes while interface surfaces follow the active theme.

The homepage accent selector is an illustrative, page-local experience. It defaults to the active theme's site gold, retains a chosen source color while switching chapters or themes, and resets on reload. Derive readable roles separately for both themes before paint. Keep global branding stable. This demo does not save to a player's character or establish a wider app theme migration.

Evolve the working character sheet from its existing character-colored header, compact bounded stat cards, gold section labels, distinct panels, and useful density. The first draft's larger book frame, neutral identity panel, thin rules, and editorial stat strip removed too much of that identity. Further layout choices must be judged against the actual baseline, rather than inferred from the word "notebook." Retain reachable mobile sections, mounted drafts, keyboard access, and readable spell names.

Resolve both character accent maps from the saved source value before paint. Carry them through character-owned portals, keep global menus in the brand scope, and retain independent warning, success, error, and focus roles. Where a print view exists, keep its paper snapshot independent of the screen theme. The dev sheet release does not add the newer integration's print action or change character persistence, calculations, permissions, or activation gates.

The revised sheet study restores the original's broad character-color banner, circular portrait, compact bounded stat tiles, gold panel labels, purple brand contrast, and distinct reference/play panels. Keep the exact chosen color at the banner's leading edge; choose opaque black or white identity text by contrast and move the far stop away from that ink in sRGB. White and black character choices may produce monochrome banners. Body text and controls still use separately derived theme-aware roles. The user approved this second composition for the dev release. The [matched original/revision views](design-briefs/character-sheet-baseline/README.md) record its visual reference.

The [local dashboard and character-shelf candidate](design-briefs/overview-notebook-local/README.md) continues the original greeting, gold italic name, folios, star rules, portrait-led feature, compact rows and warm card grid. Each entry owns its accent; the surrounding page and navigation remain branded. Preserve the original successful-empty states and distinguish read failures. This candidate has matched before/after references and local verification, but still awaits user review and separate deployment approval.

Use supported homebrew types; an example must not imply an unimplemented custom-class authoring workflow. Keep previews independent of authenticated data and actions. Do not invent statistics, customer feedback, or product behavior to fill the layout.

## Voice and public claims

Write with the clarity of a useful note at the table: direct, specific, and welcoming. Use the game's vocabulary where it helps players act. Let character content supply the atmosphere.

| Situation | Preferred wording |
| --- | --- |
| Product introduction | “Character sheets and character stories, kept together.” |
| Primary action | “Create a character” |
| Empty journal | “Add your first note.” |
| Save error | “We couldn't save your changes. Try again.” |
| Alpha notice | “Inkborne is in private alpha. Expect rough edges.” |

Use “Your changes are saved” only after a confirmed save. Describe draft retention, permissions, calculations, and recovery according to the real behavior of that screen. Prefer specific supported capabilities to promises such as “every modifier,” “no contradictions,” or “works without our servers.”

Remove D&D Beyond and LegendKeeper comparisons from homepage positioning and do not reintroduce them through an old design handoff. Explain Inkborne in its own terms. Required attribution, factual compatibility documentation, and an actual integration may still name another product where relevant.

Avoid generic promises about epic adventures, stacks of promotional badges, decorative pull quotes, and anonymous testimonials. Publish feedback only with a real source and permission for its intended use. Never turn fictional example data into a customer claim.

## Applying and maintaining the guide

1. Read this guide before changing UI, brand assets, or public copy. Reuse the existing component system and preserve the workflow's behavior.
   Before editing an existing layout, render the actual screen and capture representative before views. Identify its visual anchors and compare after views with matching data, viewport, theme, and accent. Preserve the status of approved and unapproved studies; passing functional tests does not establish design acceptance.
2. Establish the direction now and roll it out screen by screen as layouts and workflows settle. Homepage work can proceed separately from unfinished character mechanics.
3. Keep visual changes bounded. A feature or bug fix does not authorize a global restyle. Introduce coordinated themes and shared primitives in a dedicated change, then migrate surfaces deliberately.
4. For a changed screen, review desktop and mobile layouts, keyboard focus, long content, all relevant states, and both app themes. Exercise the actual affected workflow as required by [AGENTS.md](../AGENTS.md).
5. Update this guide and its reference examples in the same change when a deliberate brand decision changes. Record substantial decisions below; use Git history for exact edits.

### Relationship to the current implementation

The public homepage first deployed to dev as the isolated `bc85889` release, with distinct Light and Dark palettes and the shared appearance preference. The auth notebook refresh deployed to dev as `99acb2c`, with its own scoped palettes and unchanged authentication implementation. The approved second character-sheet composition deployed to dev as `0142f3e`. The original review used mechanics integration `dc13dbf`; this release transplants only its presentation into the dev baseline `99acb2c`, preserving existing gameplay and excluding newer unreleased mechanics and print features. The [deployment receipt](handoffs/2026-10-23-sheet-dev-deployment-receipt.md) records validation and hosted limits. Other authenticated pages retain their existing presentation. The app's global light and dark CSS palettes remain identical; migrated palettes are deliberately scoped to each surface.

Global token values live in [app/globals.css](../app/globals.css), sheet values in [character-notebook.module.css](../components/character/character-notebook.module.css), accent derivation in [notebook-colors.ts](../lib/character/notebook-colors.ts), and typography in [app/layout.tsx](../app/layout.tsx). The homepage's `landing-content.module.css` and auth's `auth-shell.module.css` live in their release branches; this mechanics-integration-based branch does not import those page layouts. See the [local sheet review](../e2e/local-sheet/README.md) for simulated browser verification and its limits. Verify deployment state separately from this guide.

Older HTML/JSX bundles and screenshots under `docs/design-briefs/` preserve earlier work. They remain useful for workflow context, but their color, ornament, typography, and competitor-copy instructions do not override this guide. They are not proof that a feature is implemented or released.

### Decision record

| Date | Decision |
| --- | --- |
| 2026-10-24 | Version 2.10: continue locally with Dashboard and Characters, using their actual pre-change renders as the reference. Polish the existing composition, add scoped themes and per-entry character accents, and retain data/auth/navigation contracts. This is a review candidate, not a new approved template for every page. |
| 2026-10-23 | Version 2.9: approve the second sheet composition for dev; transplant presentation only into the current dev baseline and preserve gameplay, theme preference, custom colors, auth, dependencies and hosted configuration. |
| 2026-10-23 | Version 2.8: revise the local sheet using the actual original as inspiration. Restore the broad personalized banner, bounded stat tiles, panel depth and compact labels while retaining theme-aware custom colors. The second composition was subsequently approved for the bounded dev release. |
| 2026-10-23 | Version 2.7: the first sheet refresh felt sanitized. Establish the actual pre-refresh sheet as the visual baseline before further edits, preserve its character-colored identity and game-sheet structure, and distinguish useful theme/accessibility implementation from an unapproved visual draft. |
| 2026-10-23 | Version 2.6: extend the approved notebook identity into the working character sheet locally. Preserve gameplay and print, add scoped Light/Dark/System and readable character roles, and review with isolated fictional characters before any deployment. |
| 2026-10-23 | Version 2.5: release the approved auth notebook refresh to dev, preserving authentication and existing hosted configuration. Record hosted UI evidence separately from real account, provider, and mail testing. |
| 2026-10-22 | Version 2.3: simplify the homepage header to an icon-only appearance menu and Sign in. Keep character creation in the hero and closing section. |
| 2026-10-22 | Version 2.2: evolve the homepage from three alternating blocks into an illustrated hero and one explorable character notebook. Preserve the Scribe identity, coordinated themes, and scoped character accents. Keep this implementation local for review. |
| 2026-10-22 | Adopt a player's field-journal direction and a staged site-wide refresh. |
| 2026-10-22 | Initially choose a paper-toned homepage. Superseded by version 2: coordinated Light/Dark/System on both homepage and app, preserving the saved preference. |
| 2026-10-22 | Lead the homepage with sheet and story together; remove homepage competitor comparisons. |
| 2026-10-22 | Establish this versioned guide before implementation. Palette, type scale, and reference studies are version 1 defaults to refine through the first representative screens. |
| 2026-10-22 | Select logo direction A for continued development. Use monochrome primarily with an oxblood alternate; confirm the vector treatment in homepage and app contexts before adoption. |
| 2026-10-22 | Default character accents follow the site's primary-action accent in the active theme. Preserve custom colors as source values and derive readable light/dark treatments consistently across related character pages and dialogs. |
| 2026-10-22 | Evolve the current fantasy notebook instead of adopting the sanitized first pilot. Restore ink-purple/gold, Marcellus/Garamond contrast, purposeful texture and folios, substantial alternating vignettes, and the open-source band. Keep the selected Scribe logo, distinct themes, and character personalization. This supersedes version 1's neutral palette, Garamond-only display direction, and blanket ornament restrictions. |
| 2026-10-22 | Implement the approved homepage and Scribe identity locally for review. Reuse the shared theme preference, keep new palettes scoped to the homepage, and preserve authenticated navigation, character colors, and data. Deployment and wider app migration remain separate work. |
| 2026-10-22 | Extend the selected identity into a local auth notebook review. Scope palettes and feedback styles to auth pages, retain the shared appearance preference and existing authentication behavior, and review desktop/mobile before release. |
