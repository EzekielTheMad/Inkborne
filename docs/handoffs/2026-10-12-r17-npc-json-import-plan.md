# Proposed NPC JSON import plan handoff

2026-10-12. **Plan only; proposed format decision pending.** Human optional
JSON-versus-evidenced-MPMB preference has not been answered in this record. No
dependent implementation, upload/write enablement or import acceptance claimed.

Owned clean r17-library-npc-worker, branch
codex/r17-library-npc-plan-20261012; predecessor48af0f6 preserved. Root inspected
fe236dbf, owned product1fc3620. Only new
`docs/specs/2026-10-12-npc-json-import-plan.md` and this handoff are changed.
No code, SQL, migrations, installs, tests, typecheck/lint/build/browser, provider,
network, source upload, campaign instance or other worktree changes.

Proposal: exactly one UTF-8 JSON NPC, strict versioned format/name/data/effects[]
envelope; source version and payload version distinct from saved content version.
Raw128KiB/depth8/nodes2048/member512 bounds, fatal UTF-8/BOM rejection, duplicate
decoded-key detection/dangerous-key refusal, strict grammar and byte-offset
diagnostics. Actual existing NPC data/name validation, no coercion/defaults/
trimming/array dedup; preserve absent/empty/ordered/plaintext. Mandatory explicit
empty effects throughout upload/current/immutable boundary; never strip grants.
Original synthetic Bell Keeper fixture; no external book or MPMB field guessing.

First implementation child, after decision/challenge: pure codec/review DTOs,
actual NpcProfile/native-file review component and authenticated explicit format
route. No commit control/job/success claim. Pure and offline source/UI tests must
separate native behavior from Auth/navigation/persistence models and use reviewed
production CSS/fonts/process cleanup. Existing spell/feat imports untouched.

Durable extension is a separate reviewed child. Existing content_imports/items/
origins only admit mpmb/spell/feat. Proposed discriminators inkborne_npc_json_v1
are JSON audit identity, not a fabricated NPC MPMB registry. Exact staged SQL TEXT,
schema/empty-effects admission, protected validation/revision evidence, default-off
switch, full role/transaction G2 required before enabled commit. External origin
records file hash/safe filename/version/offset/attestation/written pin; no source
metadata injection into NPC payload or fabricated sharing entitlement.

Freeze replace/keep-both/current eligibility/pg CAS/no-op audit semantics,
confirmed-revision invalidation, exact immutable response/pin correlation and
uncertain-commit retained draft/manual read-only reconciliation/no automatic
duplicate. Successful exit goes to Library NPC detail/Homebrew, no character
attachment. Actual DB permission/concurrency/atomicity/idempotency and hosted
shell proof are required later; mocks/static SQL are insufficient.

MPMB CreaturesList and any NPC registry remain rejected by the current parser;
no observed creature/NPC mapping fixture was found. Monster/PDF import support,
sharing/DM instances/lifecycle and full R17 remain open. Root will batch the
material format decision; this worker asks no additional user question.

Static whitespace diff validation only for this documentation checkpoint. Freeze
exact docs SHA for independent challenge, then idle; implementation must await
the decision and reviewed plan authorization.
