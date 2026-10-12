# R18.1 companion Library foundation — finite plan for challenge

2026-10-12. Documentation only in clean `r09-hit-die-kernel-worker`, branch `codex/r09-hit-die-kernel`, base `5bdd9c12b85baba0da21aedef6aacd8ba58766ea`. Kernel source/tests/receipts remain frozen. Discovery inspected root `42abdbb64e4faec907843f57602368b2e114607e`; plan-path inspection observed root `073003d6cce8ee67ce642a7a38a5fa91d844afa6`. Other workers own NPC authoring/P1; root remains sole integrator and heavy-resource owner. These heads document read-only inspection, not a moving-HEAD authority shortcut.

## Required slice and limits

`docs/ROADMAP.md:216` requires stat-block companions tied to characters, including mounts, beast forms and summons. Its M5 exit at line221 also requires the shared entitled encyclopedia and separate DM campaign use. `docs/LAUNCH-ACCEPTANCE.md:805` keeps hybrid ownership/lifecycle, character/campaign links, transformations/summon dependencies and persistence/denial acceptance open. R19 at line806 requires its own Expert/Spellcaster/Warrior archetype/level/progression contract.

This child implements **only the read-only companion template encyclopedia foundation**. It is useful schema/parser/catalog/detail infrastructure; it is not a character-tied companion, playable summon, transformation, owner-character permission or full R18/M5 completion. No new familiar subtype/automation is inferred from the landing-page Familiar example; the requirements do not freeze a separate familiar rule contract. Mount/beast-form/summon labels are descriptive, never eligibility proofs.

No character/campaign instance/table/migration, actor/controller change, acquisition/attachment action, authoring/import/seed writer, copy/lifecycle/privacy reuse, stat replacement, gameplay state, HP/rest/payment/concentration mutation, rules automation or provider access. Do not repurpose `public.npcs` story relationships, disguise a sidekick as a full-PC class, or add creature state to open character JSON. Existing NPC privacy/copy and P1 source remain untouched.

## Minimal representation — declared stat template under its own identity

New content type is `companion`; category is `companions`. Use the existing mutable definition/immutable version envelope and current Library entitlement semantics. Exact template identity is the companion's **own** content ID/version; its declared stat block lives inside that same immutable snapshot. Do not invent an external monster UUID/slug reference or resolve today's monster catalog to display a pinned companion. An external source reference would require an additional entitlement/provenance policy and is unnecessary for this finite slice.

```ts
// Proposed shared companionDataSchema; no defaults/coercions/transformations.
{
  schema_version: 1;
  role: "mount" | "beast_form" | "summon";
  stat_block: MonsterData; // actual strict monsterDataSchema, including its v1 marker
}
```

Outer object and inner stat block are strict. Reuse/import actual `monsterDataSchema`; do not duplicate its AC/HP/abilities/speeds/attacks/actions/saves/traits/lair/legendary rules or reinterpret display dice/challenge text as arithmetic. Every mandatory stat field must be declared; missing values are unavailable, never guessed zero/average/empty lists. Existing optional narrative `stat_block.description` supplies the bounded plain-text description; no redundant outer description/personality/relations/source IDs. All optional absence, declared zero/false values, array order/duplicates and raw text are preserved.

`COMPANION_PAYLOAD_MAX_BYTES = 65_536` applies inclusively to the entire JSON payload, in addition to the imported inner budget. A valid inner block at its budget cannot evade the outer wrapper budget. No JavaScript expressions/functions, arbitrary effects field, unknown outer/inner extension, schema upgrade, coercion, repair or normalized persistence. Use original synthetic fixtures, not uninspected sourcebook/import material.

This representation does not certify the stat block is a legal mount/beast/summon, eligible at any class level or equal to a separate monster definition. Future instance/eligibility children must freeze exact selected source/dependency/controller evidence. No new product choice is needed to label a declared read-only template; automatic rule semantics remain outside this child.

## Raw admission and actual character-consumer fence

Add the schema to `lib/schemas/content-types/index.ts` and the existing generic parser. For raw `content_type === "companion"`, before generic current-envelope effects/version defaults, require:

- Explicit array `effects` with length exactly zero, including narrative/grant/choice/mechanical effects all forbidden. Missing/null/nonarray/nonempty is unavailable, not an empty repair.
- Explicit integer version1..2,147,483,647; generic default version1 must not manufacture companion identity.
- Existing canonical ID/system/type/slug/name/source/scope/owner envelope validation and exact companion data validation. No form/role claim supplies permission.

For raw immutable `content_type_snapshot === "companion"`, apply the same explicit empty `effects_snapshot` and PG-bounded explicit version before defaults/translation. Continue existing canonical snapshot fields (`content_id`, version and `*_snapshot` envelope/data), not a current definition lookup. Missing tuple/version/data/effects or invalid strict data is unavailable without altering the input. `created_at` remains version metadata under existing parser behavior, not a eligibility/creation proof. Require no new DB column or snapshot permission.

Preserve existing NPC raw-empty-effect checks and exact diagnostics; do not weaken its strict payload or rename its diagnostics as a side effect. Ordinary non-companion/non-NPC stat/proficiency/choice effects remain supported exactly as before. Validate raw values, not a stripped/repaired companion candidate. Do not broaden generic effects suppression to other content types.

Library-only code adds no character attachment endpoint. Nevertheless the actual existing `getCharacterContentRefSnapshot` and `CharacterPage` paths can encounter generic refs, so test the collector fence end to end with simulated transport. A valid effectless companion ref alongside the approved ASI fixture remains a narrative/stat template: original character stats/proficiency/choice collections are identical. Its nested stat block must never be interpreted as race/class/feature effects or replace character base/structured sources. Invalid effectful/missing-effects companion refs must be rejected by the canonical snapshot path, retain raw bytes, mark incomplete evidence and keep the established degraded-read behavior; never become accepted empty-effect refs. No evaluator special-case or second companion calculator is needed.

R09 durable hit-die DTO/authority/kernel are **not** extended in this child. If that deliberately narrow complete-snapshot contract cannot describe a future companion-containing character graph, it stays unavailable rather than filtering out dependencies or accepting unsupported mechanics. No P1 origin/earned-source proof is borrowed from role labels, catalog metadata or row order.

## Actual Library behavior

Append only `companions` to the existing category registry, `contentTypes:["companion"]`, label `Companions`, singular `Companion`. Use existing authenticated `/library` and `/library/[id]`, system/provenance/name search/sort/page/reset/return query semantics. No separate DM-only encyclopedia, privileged route/client, entitlement shortcut, static accepted catalog or blanket shared read. Keep the current platform/personal/campaign-shared union and retired-row exclusion; unsupported/denied/read-error/empty outcomes retain their existing distinctions.

Initial companion filters are generic search/system/provenance/sort/page only. Do not reuse outer monster-size JSON predicates for nested stat blocks or add subtype/CR/eligibility filters without an explicit follow-on contract. Existing monster/race size and other categories' query behavior must remain unchanged.

New `CompanionProfile` renders the exact role label and actual imported `MonsterStatBlock` for the declared inner data. Labels are exactly `Mount template`, `Beast form template`, `Summon template`. Use a clear visible boundary such as `Read-only companion template. Attaching, controlling, transforming and summoning are not available here.` No class/level recommendation, eligible status, owner HP/stat/proficiency change, effect/roll/cast/summon/attach button or lifecycle control. Generic narrative text remains escaped; roll/attack text remains display-only.

`CompendiumDetail` dispatches companion profiles alongside current monster/NPC profiles, with the existing version and provenance badges and return navigation. Preserve omitted description/optional stat fields instead of fabricating sections. Long names/text get the same min-width/word-wrap/reachability safeguards. Owner content offers no edit/manage link for this unsupported authoring family; Library viewing does not create a permission or writer. Direct invalid component input must show bounded unavailable state, not an empty stat block.

Description preview can use the declared inner description or display `Companion stat template.`; that fallback is explanatory UI text, never persisted data. Facts may expose only the declared template role and creature-type/size fields; no derived eligibility/stat modifiers. Preserve all ordinary category labels/descriptions/facts and return/query links.

## Bounded source ownership and sequence

Parent first integrates the approved current root dependency into a dedicated companion worker or this clean worker before source implementation; do not copy/cherry-pick another worker's unreviewed files. Keep r09 kernel and NPC/P1 writer ownership frozen. Independent challenge precedes implementation.

1. New `lib/schemas/content-types/companion.ts`; minimal shared registry and raw current/snapshot parser admission. New original `tests/fixtures/companions.ts`. No SQL/data/default schema changes.
2. Minimal `lib/compendium/catalog.ts`, `presentation.ts` and `components/compendium/compendium-detail.tsx` dispatch; new `components/compendium/companion-profile.tsx`. Existing DAL/routes handle the new registered category. Change DAL only if necessary for a precise existing shared-type exhaustive check; no new query/authority path. Leave `MonsterStatBlock` source unchanged by wrapping it.
3. Source tests: new `tests/schemas/companion.test.ts`, `tests/supabase/companion-admission.test.ts`, `tests/app/companion-character-admission.test.tsx`, `tests/components/compendium/companion-profile.test.tsx`; narrowly extend existing catalog/DAL/detail tests for the new category and preserved behavior. Exact final test paths may follow neighboring repository naming without expanding responsibility.
4. New explicit offline `e2e/local-companions/fixture.tsx`, `playwright.config.ts`, `companions.spec.ts`; new bounded `scripts/companion-production-inputs.mjs`/`verify-companions-local.mjs`. Reuse reviewed asset/capture/process helpers through independently verified executable imports. Keep original queries/auth/Next link transport simulations labeled. No generic QA framework/refactor/install/download or live route fallback.
5. Freeze unverified source/handoff for exact independent review. Root releases narrow tests maxWorkers2 and sequential repository typecheck/lint; root owns combined check/build and later bounded offline browser release. No concurrent worktree servers or activation.

Shared files overlap existing companion-independent NPC/monster guards. If their hard source anchors include newly changed registry/catalog/detail/parser files, root must coordinate **separate exact reviewed blob/anchor amendments** before reaccepting those existing harnesses. Do not relax required inputs, point at arbitrary HEAD or reuse the old NPC-specific loader's stale anchor as authority. The actual inherited production asset helper and process helper must retain their own reviewed immutable identities. Review only owned diffs; preserve unrelated fixtures, receipts, actor/privacy decisions and other worker source.

## Meaningful controls and offline acceptance

Schema/current/snapshot tests include all three role labels; complete original stat blocks; absent optional fields; zeros/false and ordered duplicate actions; strict unknown/null/missing/unsupported version/data; every shared inner bound; inclusive outer aggregate bytes; valid empty effects vs missing/null/nonarray and **independently valid** mechanical/proficiency/choice/narrative payloads. Check EffectSchema validity before injection, then canonical current+snapshot rejection without mutating raw input. Positive ordinary feature/race/feat effects controls must remain available.

Actual collector tests execute real `getCharacterContentRefSnapshot` and `CharacterPage` **before** rejection assertions, mocking only transport/auth/sync/navigation boundaries as in reviewed NPC tests. Log only original synthetic characterization where meaningful failing-before evidence is required. Valid companion nested ability/proficiency/action text must not modify approved ASI character totals/collected effects/choices. Rejected companion must remain unaccepted and unavailable with the same raw evidence; ordinary non-companion effects still evaluate. Missing/malformed refs are not confirmed empty arrays. No fabricated injected validator or parser-only assertion may stand in for real consumer coverage.

Catalog/DAL tests assert `companions` category/content type, shared filters/retired/system predicates, name search/sort/pagination/return/reset and permission-denied/read-error behavior; preserve all monster/NPC/category/query tests. Component tests render the actual Library/browser/detail/profile, exact descriptive role, declared statistics/narrative/absence/version/provenance, escaped script-looking text and no mutation controls. Differently owned synthetic shared fixture must assert the **visible** `Campaign shared` badge. Original snapshots of one companion ID/version stay unchanged while a simulated current definition has a later version; no replacement/current source lookup is introduced. This is parser/fixture evidence, not PostgreSQL immutability proof.

Offline browser exercises actual profile for all roles at desktop1280/mobile390; keyboard category/detail/back/search, declared/absent/long maximum stat/narrative fields, final action reachability, escaped text, shared badge, empty/malformed/denied simulations. Original fixtures only; simulation notice states no actor/instance/persistence/eligibility proof. Production compiled CSS/local font faces/current clean build receipt/lock/installed runtime/all-transitive bundle inputs must be hash-bound to a root-approved fixed source. No fallback CSS, remote resource, unexpected write, SQL or network service fallback.

Executable inherited helpers must be anchored **before dynamic import/invocation**: reviewed Git blob OID plus actual worker/root HEAD+stage0 OIDs, separate cached/unstaged diffs, no unmerged stages, canonical LF blob digest and actual checkout-filtered mounted-byte SHA equality. Record narrow nonsecret checkout configuration/attributes; refuse external filters/unexpected encoding, recheck all identities after bundle. Do not normalize newlines into a fake executed hash or rely on a helper's own self-check. Include the full transitive Node-side project import closure outside the bundle metafile, not just browser inputs. Preserve six-or-more actual owned harness paths separately from inherited-helper receipts; exact count must match the final reviewed harness, not a copied NPC expectation.

Record task OS PID birth/parent/command/cwd/start/listeners and process/resource before/after, preserve failures/screenshots/receipts, use cooperative cleanup and reverified exact owned-tree fallback only, confirm closed ports/no owned remnants. Existing Codex/connector/user/other-worker processes remain untouched. Actual acceptance counts are observed later, never preclaimed.

## Parent requirements and remaining decision/authority gates

R18 remains open after this child: playable/manual companion instances tied to characters and campaigns; controller/owner vs DM permissions and inherited visibility; source acquisition/pinned continuity; HP/state and lifecycle across detach/archive/death/delete/copy/leave; safe supported stat blocks; mounts; Wild Shape selection/eligibility/transition/stat replacement/rest/provenance; summon spell acquisition/payment/choice/scaling/concentration/duration lifecycle. Freeze a finite rules/controller/lifecycle contract before implementing those behaviors, using current rights-safe sources and actual class/spell authority. ActiveEffect snapshots/advisory duration and Wild Shape counters alone do not establish creature semantics. `companionCallback`/`creaturesAdd` importer names are explicitly not automated today, not imported companion support.

A separately scoped first manual-mount instance may be planned independently of automatic class mechanics, but its owner/controller/DM/visibility/copy/lifecycle choices are not settled by this template. R19's Expert/Spellcaster/Warrior schema, base/progression/build/play behavior and entitlement/DM management remain separate; no renamed ordinary-PC class shortcut.

G2 remains required for real catalog actor roles/entitlement denial, current/immutable snapshot tuple visibility/persistence, direct malformed JSON/effects Data API boundaries and character/campaign privacy/copy. Existing generic SQL does not enforce the new Zod payload; do not claim an actual database schema prohibition or hosted playable companion. No fixture implies permission for new real data, migration, provider accounts, keys, deployment or release. No new human gate is needed for the independently challenged ordinary local template source child; missing instance/rule policies do not get silently filled by it.
