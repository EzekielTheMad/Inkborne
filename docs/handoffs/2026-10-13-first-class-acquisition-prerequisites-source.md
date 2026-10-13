# First-class acquisition child A — source-only, UNVERIFIED

Reviewed plan bc9ec36, fixed root710c3fc. Three NEW owned files only: staged
class-origin-first-acquisition-prerequisites.sql, its static source-contract test,
and this handoff. Existing bootstrap/P1/joint/R09 stages, original migrations,
app/schema/parser/UI, package/lock and all prior receipts remain unchanged.

No Node/npm/tests/typecheck/lint/build/browser, SQL/PGlite/PostgreSQL, provider,
network or flags were run. Whitespace/source inspection is not SQL compilation.
Original R09 + M1 source reviews and explicit narrow-lane release are required.

## What the additive stage contains

One installation-owned, immediate-FK proof table; strict fixed first-add mode,
initial shared/class revisions 0→1, bounded full raw before/after/planned rows and
current-xid identity. Both isolated existing owners can SELECT; only authority has
INSERT and UPDATE(phase,observed_parent,observed_order), with independently false
restrictive RLS checks. The immediate proof guard unconditionally refuses even
self-consistent direct-owner evidence. No DELETE/identity mutation/caller rights.

Exactly two NEW cross-owner EXECUTE pairs: class inputs(uuid) to authority;
authority observe(jsonb,uuid) to class. No journal/grant/ref/order/parent writer
privileges, finalizer grants, new role or helper transfer. All NEW functions are
SECURITY DEFINER under their exact original class/authority owners with empty
qualified search_path; the two replaced callbacks preserve their original modes
(acceptance guard definer, normal finalizer invoker), owners and remaining bodies.

Input, observer and direct proof admission independently deny. Input has an
unconditional missing-native-planner refusal before journal admission. Observer
uses original native Auth/exclusive guard/current-owned-parent/native equality-
expiry checks, and independently refuses missing genuine updater OLD/RETURNING
provenance. It contains NO UPDATE/INSERT. Hypothetically matching current rows
are not evidence of an authorized ordinary choices write. No positive proof
issuance is implemented; future B must couple actual native typed updater rows
to the protected phase transition in the same transaction, after separate review.

Pre-finalized observed evidence is separate from finalized receipt closure.
The internal observed helper binds protected target/actor/operation/xid, original
before/order, immutable expected graph and actual stored full parent/order/graph;
it does not demand an already-finalized journal/inserted receipt. One-use consumer
then changes only the existing revision_transition_consumed bit while pending.
The finalized assertion separately requires finalized+consumed, retained exact
receipt and original common full-graph closure. The class-owned deferred proof
callback re-reads that evidence; all original P1 deferred closures remain armed.

Only two callback dispatch points change: add_class uses ordinary observed/final
checks; confirm_origin retains original metadata checks. Other class commands
refuse. No ordinary R09 trigger rewrite, metadata-event widening, bootstrap
variant, automatic primary confirmation or first-class issuer is present.

Preflight preserves the approved original bootstrap source/type/default/trigger
wiring checks plus four exact joint body/owner/config/mode fingerprints. The new
table must be created by the actual original installation-table owner; no guessed
materializer owner or runtime owner/table bypass is used. Eight fixed root710
Git blobs are bound by the STATIC tests. Their normalized bytes and all original
callback bodies except the two exact dispatch substitutions are test oracles.

## Verification and remaining work

The new static suite is UNRUN. It checks frozen hashes/catalog expectations,
owner/ACL/independent denial/order, no positive writer, phase/identity/full-raw
constraints, and exact original callback-body preservation. Such source checks
are not modeled gameplay, semantic native before/after tests or PostgreSQL proof.
No new calculator/model/QA framework was added.

After both source reviews, proposed narrow package-script gate is npm.cmd test --
tests/supabase/class-origin-first-acquisition-prerequisites-staged.test.ts
tests/supabase/class-origin-fresh-bootstrap-staged.test.ts
tests/supabase/class-origin-staged-contract.test.ts --maxWorkers=2, then existing
npm.cmd run typecheck and lint. This is a proposal, not a runtime release.

Native G2 remains unapproved. Auth always denies, existing class gate false/all13
readiness false. Genuine actual class updater, protected native row allocation,
original materializer-owner/capability inventory, immutable full expected graph,
derived refs/spells/order reconciliation and all-writer fences are future B.
Receipt-first current-owner/expiry replay remains in unchanged original producers
before NEW acquisition/source/revision gates; no application entry was added.
The genuine empty original bootstrap, subsequent builder changes, actual add_class
issuer, compiler/feature-generation lineage, copy/restore and C2 remain open.
This checkpoint is not first-class acquisition, private-class authoring or M4/M6
acceptance, and no stage has been applied.
