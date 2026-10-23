# Native multiclass acquisition source handoff

Implementation checkpoint `4471c14`, based on root `6af51d2`. This worker has
not installed SQL, started services, added dependencies, or claimed runtime
acceptance. Root must prove the finite workflow through real Auth, PostgREST,
PostgreSQL and the application before recording product acceptance.

Install `supabase/staged/character-builder-multiclass.sql` after the existing
baseline, first-acquisition stages, builder steps, catalog, progression,
race-score repair and Expertise. Do not install the parked original-confirmation
role seam. This companion verifies the genuine consumed empty bootstrap and
initial 0-to-1 class acquisition instead; it never fabricates confirmation or
changes the historical origin/command rows. The existing original occurrence
stays provisional and retains its exact identity, source and controller.

The stage SHA256 is
`3b865f6c6615836394ac4527ddebdeb62eb235e95e9bdbc2aca17aa4f2826d0b`.
All new private functions have closed ACLs. Authenticated callers receive only
the existing finite command and the new owner/session-checked role projection.
Readiness, class-origin and hit-die gates remain false; service-role private
schema usage stays unavailable. Source installation is one transaction.

## Transport and semantics

The existing `public.character_builder_command_v1(p_context,p_request)` accepts
`command: "add_class"` and exact fields:

```json
{"class_id":"UUID","class_version":1,"expected_action_revision":"client-observed decimal"}
```

The operation ID retains the existing idempotent receipt semantics. An exact
replay returns the accepted receipt even though its original CAS is now old;
another intent with that operation ID refuses. A new stale CAS refuses before
allocating rows. Both candidate and every current class must meet the reviewed
SRD multiclass prerequisites, including Fighter's Strength-or-Dexterity rule.
Duplicate classes and a total above 20 refuse atomically.

Acquisition appends a level-one class choice with a new native occurrence and
controller. The secondary occurrence is accepted and its frozen profile is tied
to the new builder receipt and append-only graph history. Source manifests are
resolved using the existing read-only immutable dependency resolver. No starting
equipment, new currency, starting save proficiency or primary class proficiency
allowance is awarded. Secondary level-one HP defaults to the die average.

Existing level, subclass, class-choice, fighting-style, ASI and class-spell
commands retain their finite DTOs. The owning occurrence determines each class
level, active grant and pruning scope. Other classes' choices, immutable pins,
ASI allocations, HP and spells are retained. Capacity reductions validate each
caster at its own level and ability modifier. HP level one can be saved only for
a secondary occurrence; server rolls are retained by occurrence and class level.

`public.character_builder_class_role_projection_v1(p_context,p_character_id)`
returns the exact public DTO agreed with the UI worker:

```text
{status:'available', contract_version:1, character_id, system_id,
 action_revision:string, original_occurrence_id, source_order:UUID[],
 class_sources:[{occurrence_id, controller_ref_id, content_id, content_version,
   role:'original'|'secondary', raw_effects, evaluation_effects,
   raw_data, evaluation_data}]}
```

`source_order` is the full physical pin order, including race, subrace and
background roots. Raw source snapshots remain unchanged. Evaluation fields
remove secondary starting saving throws and primary-only proficiency choices,
use secondary armor/weapon allowances, and reduce Bard/Ranger/Rogue skill
choices to one. The original role comes from consumed native acquisition
evidence, independent of current array position. Legacy, copy, campaign and
non-SRD class flows remain unsupported by this bounded companion.

## Root verification targets

Use one focused browser story and native readback for Fighter-to-Cleric:

1. Create/save Fighter with effective Wisdom below 13; failed Cleric acquisition
   leaves parent, graph, order, receipts, acquisition profiles and inventory
   unchanged. Save effective Wisdom 13 or higher and acquire Cleric.
2. Reload; exact Fighter and Cleric occurrences, controllers and versions remain.
   Fighter Strength/Constitution saves remain; Cleric Wisdom/Charisma starting
   saves and primary skill/weapon/equipment allowances are absent.
3. Select Life, save Cleric spells and independent class levels, then reload.
   Original Fighter ASI, style, skills, gear, currency and receipt are retained.
   Class spell limits and feature unlocks use the owning class level.
4. Save secondary HP1, switch average/rolled and reload; the accepted server
   draw is retained once per occurrence/level. Original HP1 cannot be changed.
5. Verify all five order arrays are physical row-ID bijections, parent revision
   matches producer revision, no capability survives, profiles/history/receipts
   agree, and all global gates and legacy writer denials remain closed.
6. Refuse stale acquisition CAS, duplicate class, unmet current-class
   prerequisites and total level 21 without partial writes. Owner/session and
   foreign-account access checks must use real sessions.

The source reconstruction check matched the two prior reviewed planner body
hashes before producing the new per-controller functions. Static envelope and
definition checks pass. No broad mirrored source test was added; the actual app
and native rollback/readback checks are the acceptance evidence still required.

Final base body MD5 profiles for subsequent finite companions:

| Function | MD5 |
| --- | --- |
| apply_builder_catalog_command_v1 | a42a35c4646b26a33ec91a3402dcfae4 |
| prepare_builder_progression_v1 | d0f8cb403bc4e03dfa0c7d80b61bd4c3 |
| character_builder_command_v1 | 7e94f605c0281935ffc69f4acaec2afb |

Champion Additional Fighting Style and remaining class feature children belong
to the subsequent class-choice companion. Class removal is deliberately not
enabled: it needs a separate occurrence-ending transition preserving the
historical original role.
