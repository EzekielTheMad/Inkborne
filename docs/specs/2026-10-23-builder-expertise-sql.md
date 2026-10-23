# Native builder Expertise companion

Source: `supabase/staged/character-builder-expertise.sql`, prepared from base `94afe14ca3548fbedb91790787e4e9b2daacb442`.

Install in the disposable native profile after steps, catalog, progression, and race-score repair. This is staged source; preparation alone is not PostgreSQL or application acceptance.

## Contract

`private.normalize_builder_expertise_v1(target, pending_choices, active_refs, strict_choice_id)` reads exact immutable versions for a server-compiled complete set of pending pin rows. It returns pending choices with only source-owned Expertise selections normalized. It creates no pins, grants, history, receipts, role proofs, or original-class acquisitions.

Eligibility is the eighteen canonical `skill-*` proficiencies and exact `thieves-tools`. Exact plain skill names are accepted only as aliases during proficiency derivation. Fixed proficient grants, fixed snapshot `skills`/`toolProfs`, and valid saved proficiency/skill/tool choices contribute eligibility. Class snapshot grants/data/choices additionally require the sole selected class slug to match, and only such a class contributes `starting_proficiencies`. Expertise never proves proficiency.

A saved proficiency choice contributes only when exactly one active source owns its ID, its options are a finite array, and every saved selection is allowed, distinct, and within its positive integer allowance. Partial selections are accepted. Invalid or ambiguous choices prove nothing.

An active Expertise choice likewise requires a unique source, finite allowed options, distinct canonical selections, and its positive integer allowance. Existing invalid/untrained selections are removed, preserving other valid picks. Values claimed by multiple active Expertise choices are removed from every such choice; fixed Expertise reserves its value. A submitted `class_choice` targeting Expertise rejects any such invalid/untrained/duplicate pick atomically instead of silently accepting a reduced submission.

Catalog and progression hooks run before `expected_choices` is sealed and before applying the existing graph. They supply pending physical refs plus pending race roots and retained background roots, or retained race/subrace/background roots for progression. The legacy background hook reads the new exact physical roots after its finite write, then normalizes before the unchanged finisher and receipt creation. Its additional parent write occurs only when normalization changes choices.

## Profile checks

Offline reconstruction verified each exact preimage and one insertion point. The installer additionally verifies owner `postgres`, exact owner-only EXECUTE ACL, SECURITY DEFINER, volatile, empty search path, and exact postimage. Existing function ACLs and attributes are preserved through `pg_get_functiondef`. New helpers are owner-only and private.

| Routine | Before body MD5 | After body MD5 |
| --- | --- | --- |
| Catalog planner after progression | `d66d7dc3f0cc06e8ccfd1c2d98aa12d5` | `18863da6716ad4e18aa59c4a596d3a52` |
| Progression planner | `96cf137a75a162e435e349de70323ca1` | `c2d24db409de1cb538f340d0742f5bd8` |
| Legacy before-catalog command | `2afef22d9ed582b85c56d7ad4735e7c7` | `8cceb057257f8ce9eed3af251c0c3cb6` |

The install refuses drift, active capabilities, open writer/class/hit-die gates, service-role private schema USAGE, or an absent race-score repair. No existing finisher or deferred history validator is modified. No hosted installation, runtime execution, service start, or database acceptance was performed while preparing this source.

## Focused native acceptance still required

1. Import genuine versioned Rogue Expertise effects; save four class proficiencies and level-one Expertise in Stealth and thieves' tools. Reload and verify sheet Expertise.
2. Change the class skill Stealth to Deception. Verify only the obsolete Stealth Expertise is pruned in the accepted receipt and persisted choices, with thieves' tools retained.
3. Reject an untrained-skill Expertise submission without changing choices, pins, order, receipts, or history; retry/replay the accepted operation safely.
4. Save the remaining valid pick, reach level six, and save two other trained proficiencies. Reject a duplicate of level-one Expertise. Reload, then downgrade and confirm unearned selections no longer apply.
5. Exercise source loss from race and background as well as class choices; preserve unaffected selections. Direct helper vectors should cover ambiguous source IDs, malformed/oversized choices, fixed Expertise reservation, duplicates removed from both existing source choices, and Expertise without genuine proficiency.
6. Confirm all five physical projection orders, parent/producer revisions, original occurrence and origin ledger, immutable snapshots, capability exhaustion, privilege closure, and writer gates. Compare the accepted receipt with saved choices and progression history where applicable.

Multiclass acquisition and its original/secondary proficiency contract remain separate. This stage intentionally refuses class-derived eligibility without a sole matching class.
