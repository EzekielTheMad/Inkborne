# R17.2 private NPC authoring plan handoff

2026-10-12, clean owned `r17-library-npc-worker`, branch
`codex/r17-library-npc-plan-20261012`, inspected worker `fa8aa7b` and current root
`c18cf445b4ce7df24aa3e973330979f036f55c1e` read-only.

Only new docs: [finite private authoring plan](../specs/2026-10-12-private-npc-authoring-plan.md)
and this handoff. Actual monster/item/trait/passive form, mapper, DAL, actions,
Homebrew dispatch and locked Next action guides were inspected. No source,
schema/parser, story NPC/privacy/copy, SQL, dependency, root or old worker edits.

One bounded child: private NPC name/plain description/occupation, optional
structured personality and ordered duplicate-preserving relationship ideas.
Explicit presence controls preserve absent vs object/empty arrays; no JSON editor,
mechanics, secret storage or actual relations. Unknown strict v1 extensions and
effectful/missing/null-effects rows lock/refuse unchanged, rather than stripping
or repairing them. Server-owned private envelope and pg-bounded expected version,
all ownership/system/type/source/scope/active read/CAS/reread filters and raw
group merge; UPDATE omits effects. No-op, MAX and exact returned current plus
immutable snapshot confirmation are frozen. Snapshot confirmation is an explicit
bounded extra DAL read; missing/mismatch after write is uncertain, never a retry.

Passive-feature saved/conflict/uncertain states preserve native draft, pending
single submission and saved identity before navigation. Uncertain CREATE demands
manual Homebrew check and explicit acknowledgment before another deliberate
create, with duplicate/reload limits disclosed; this is not exactly-once authority.
Exact minimal paths and meaningful mapper/DAL/action/route/form/Homebrew tests,
offline actual form acceptance and separate G2 role/version/race/privacy gates are
listed. Remaining R17 sharing/import/DM/lifecycle and M5 stay required/open.

Documentation-only validation: `git diff --check`. No install/test/typecheck/lint,
full/build/browser/runtime/SQL or external writes. No process/listener started.
Root retains heavy/build/UI ownership. Ready for independent plan challenge;
ordinary scoped source implementation follows review, without a new human gate.
