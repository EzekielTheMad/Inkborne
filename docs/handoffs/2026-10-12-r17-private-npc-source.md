# R17.2 private NPC source checkpoint — unverified

2026-10-12, owned `r17-library-npc-worker`, branch
`codex/r17-library-npc-plan-20261012`, base `293c3d1` approved authoring plan over
reviewed R17.1. No root changes cherry-picked. Existing strict NPC schema,
canonical empty-effects parser, story/private/copy/pins/table and algorithms
remain unchanged.

New NPC mapper/form/DAL/actions/new/edit routes and minimal Homebrew family.
Bounded narrative controls preserve optional object/list absence, empty lists,
order and duplicate ideas; local row keys stay out of JSON. Native draft reset,
pending single submission, invalid field focus, uncertain-create manual check/
acknowledgment and edit reload lock follow the approved passive-feature pattern.
Confirmed saved version is retained before navigation to plain `/homebrew`, with
no unconditional created/updated query notice or latest-version/private claim.

Server derives authentication/system/private envelope and freezes UUID/slug
before INSERT. Raw group merge validates without serializing stripped parser
output; invalid raw extensions/effects/missing effects refuse without repair.
UPDATE omits effects; owner/system/type/source/scope/active expected-version read,
CAS and missing reread remain scoped. Only strictly newer eligible reread is
conflict; same/older is uncertain. No-op asserts only no write by this invocation;
changed pg MAX refuses. Saved response requires exact returned v1/v+1 plus exact
immutable version snapshot/owner/system/type/scope/raw data, never latest. A later
v+2/scope race does not alter the saved pin or imply its current privacy.

Prepared tests: finite mapper/intent/shape/order/transport/name/version/response,
modeled DAL authority/CAS and isolated immutable confirmation failures, raw
unsupported originals/no-op/MAX/foreign denial, actions revalidation, routes,
actual form/native reset/pending/conflict/uncertainty/no-reinsert and Homebrew
discovery/read-error isolation. All are SOURCE ONLY; no test/type/lint or browser
result claimed. Modeled PostgREST/auth/actions/nav do not prove SQL/RLS/CAS races.

Static `git diff --check` only; root owns heavy/build/UI, no install/server/test/
typecheck/lint/full/build/browser/network/SQL/provider/hosted action. No owned
process/listener started. Next source preparation is separately guarded actual
form offline fixture/config. G2 authorities/snapshot triggers/concurrency/cleanup
and remaining sharing/import/DM/lifecycle children remain open. Independent exact
source review precedes resource/browser release.
