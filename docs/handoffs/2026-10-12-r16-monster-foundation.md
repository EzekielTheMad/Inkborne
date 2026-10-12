# R16.1 local schema and read-only catalog checkpoint

Base `0c37775`, branch `codex/r16-monster-foundation`, isolated
`r16-monster-worker`. Independently approved concrete design `9d53f08`:
[contract](../specs/2026-10-12-monster-foundation-contract.md).
The acceptance wording now correctly requires legendary cost 0 **rejection**
(valid range 1..20), while lair initiative 0 is visibly rendered.

Implemented only the approved foundation:

- `lib/schemas/content-types/monster.ts` and registry entry: literal
  `schema_version: 1`, strict objects at every declared level, finite bounded
  integers/text/arrays, six named scores, required AC/HP/movement, no coercion,
  payload defaults or nullable fields. Optional absence and empty arrays remain
  distinct. Full validated JSON data is bounded to **65,536 UTF-8 bytes**, using
  browser/server `TextEncoder`; this does not cap inherited envelope/effects or
  the complete transport. Existing type schemas and envelope remain unchanged.
- `components/compendium/monster-stat-block.tsx`: ordered declared AC/HP/speed,
  abilities, saves/skills/defenses/senses/languages/challenge and traits/actions/
  bonus actions/reactions/legendary/lair sections. Duplicate names retain their
  indices/order; numeric zero is visible. Ability-score display modifiers use
  only the approved fixed arithmetic; declared attack/save/skill bonuses are
  displayed exactly once, without proficiency/ability additions. HP/dice and
  damage average/dice text remain independent. No effect evaluation, expression
  execution, roll controls, mutable character state or persistence.
- Existing compendium category/query/presentation/detail integration: ninth
  `monsters` category, `['monster']` type filter, existing size control and JSON
  equality filter. Authentication, published systems, ordinary account client,
  RLS reliance, active-content predicate, provenance, name search, stable sort,
  pagination and return URL rules retain existing behavior. Monster detail
  narrows through the real schema, omits absent description and safely refuses
  malformed direct props. Its read-only footer does not advertise an absent
  monster authoring form. Other category markup stays unchanged.
- Original Small/Large/Huge synthetic fixtures: **Cinderlit Kite**, **Glassroot
  Sentinel**, **Lantern Reef Regent** (709 / 1,408 / 8,029 data bytes). No copied
  book prose or production records. Separate exact-byte long-content variants
  remain per-field-valid and reach the aggregate limit; no source promotion.

## Verification on this isolated source

`npm.cmd ci --ignore-scripts` **passed**, exact existing lock (804 packages);
package.json/package-lock remain untouched. Existing eight unresolved development
high findings remain outside this child's scope; install output is not acceptance.

Installed Next `16.3.8` guides read before React edits:
`01-app/01-getting-started/05-server-and-client-components.md`, `11-css.md`,
`04-linking-and-navigating.md`. Applied the installed Vercel React checklist:
pure component/no new client boundary or hook/effect state; no new fetching/cache;
direct runtime-neutral imports; explicit conditionals preserve zero; bounded maps
and stable section/index keys preserve order/duplicates; semantic headings and
definition lists; escaped text; existing Tailwind/paper primitives. No new
dependency, CSS framework or global styling configuration.

Final **12 focused files / 206 tests passed** with `--maxWorkers=2`:

```text
npm.cmd test -- tests/schemas/monster.test.ts tests/schemas/content-types.test.ts
  tests/lib/supabase/monster-parser.test.ts
  tests/lib/supabase/content-definitions-parser.test.ts
  tests/lib/supabase/compendium-server.test.ts
  tests/lib/compendium/catalog.test.ts tests/lib/compendium/presentation.test.ts
  tests/components/compendium/monster-stat-block.test.tsx
  tests/components/compendium/compendium-detail.test.tsx
  tests/components/compendium/compendium-browser.test.tsx
  tests/app/library-page.test.tsx tests/app/library-monster-detail-page.test.tsx
  --maxWorkers=2
```

Meaningful cases include required-field/six-score omission, numeric endpoint and
invalid nonfinite/coercion/unsafe inputs, per-text/array maxima and strict nested
unknowns, reach/range/hover/cost relationships, exact 65,535/65,536/65,537-byte
accept/refusal, multibyte overrun and summed individually valid long descriptions.
Actual canonical current/snapshot parsers preserve historical v1 identity/data
against separate current v2 drift; valid envelope effects survive but do not
change declared monster stats. Actual renderer/detail cover negative and zero
values, duplicate ordered rules, save-only actions, every optional section, last
long-content rule, plain script/HTML/handler/URL/formula text without executable
nodes and a read-only detail with provenance/revision/return link. Existing
Library routes exercise login and not-found/invalid-ID/return-URL handling with
mocked auth/transport; fixed server filter assertions use mocked query responses.
These are **not actual authenticated role or RLS acceptance**.

Initial focused run and one targeted locator iteration had the same
whitespace-sensitive split-heading locator failure; the rendered cost was
present. Corrected the accessible heading matcher, then
reran the complete focused set green. `npm.cmd run typecheck`, `npm.cmd run lint`
(zero warnings) and `git diff --check` **passed**.

## Process and evidence limits

Recorded task command shell PID / parent PID (`30200`), working directory and UTC
times; all commands ran in this worker:

| Command | Shell PID | UTC start / finish | Exit |
| --- | --- | --- | --- |
| Locked install, ignore scripts | `53540` | `02:40:45.582 / 02:41:22.638` | 0 |
| Initial twelve-file tests | `12184` | `02:47:54.436 / 02:48:25.616` | 1, locator |
| Typecheck | `55612` | `02:49:01.948 / 02:49:18.325` | 0 |
| Targeted locator/schema iteration | `32516` | `02:49:12.397 / 02:49:15.773` | 1, locator |
| Final twelve-file tests | `40444` | `02:49:35.608 / 02:49:46.878` | 0 |
| Lint | `45772` | `02:49:53.177 / 02:50:41.801` | 0 |

Aggregate before-install / after-validation: processes 456 -> 470; free physical
memory 9,213,860 -> 9,750,364 KiB; listeners 41 -> 41. Other workers remained
active, so these aggregate changes are not attributable solely to this task.
No server or listener started; exact-worktree readback at `02:52:31.343 UTC`
confirmed **zero owned Node processes and zero owned listeners**. No unrelated
process was stopped.

Browser/full/build are held per root instruction. **No desktop/mobile layout,
production CSS rendering, actual Auth/JWT/RLS permissions or browser-to-database
flow has been accepted.** The near-limit DOM test does not prove mobile geometry.
Next source-reviewed child must mount the real browser/detail/stat block and
production CSS with the documented 1440x900 / 390x844, long/multibyte/unbroken
content, keyboard query/navigation and no-overflow checks, using the independent
offline config after root releases the UI slot. Root owns combined check/build
and exact-source review.

No form, importer, campaign assignment/instance, sharing API, SQL/migration,
seed/source promotion, hosted request or credential/environment read was added.
Existing sharing APIs still limit spell/feat/background; MPMB remains spell/feat.
An additive registry/category creates no monster records or entitlements. Real
content availability, authoring/CAS, supported monster import, sharing permission
extension, separate DM use, actual target privacy and R17–R19 are still open.
This checkpoint does not complete R16, M5 or beta acceptance. Rollback is reverting
the additive code checkpoint; no stored content/snapshot deletion is implied.
