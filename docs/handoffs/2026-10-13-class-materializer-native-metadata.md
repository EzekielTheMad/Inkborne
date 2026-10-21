# Class materializer ownership — bounded capture and historical query

October21 update: this exact 13-signature query was executed in the authorized
disposable G2 baseline at source29b6cc8. All13 functions were actually postgres-owned
locally, and root body/declaration comparison passed13/13. Effective role/schema/
function privileges, default ACLs and11 trigger rows were captured. See
[native facts, receipts and limits](2026-10-21-g2-baseline-complete.md).
No application command was invoked by the catalog reads; independent-family
challenge and B implementation remain open. Earlier UNEXECUTED/UNKNOWN statements
below describe the October13 preparation and are superseded only for this local
baseline, not for hosted targets or future source/role changes.

Discovery used fixed root710c3fc source, still unchanged at tested236ebcf. It read
maintained files/Git only. No SQL, provider query, function invocation, user-row
read, runtime installation or G2 execution occurred.

Original ownership remains unproved. Source declares these functions SECURITY
DEFINER with empty search_path, but has no explicit owner assignment/SET ROLE.
R09/P1 owner declarations cover their own functions. Do not guess postgres owners
from missing ALTER statements or public-schema default privileges.

| Function | Latest maintained source and blob |
| --- | --- |
| private.materialize_feature_grants_for_ref(uuid) | 20260720185127_feature_grant_integrity.sql:152;57aeceb8b06aa0dd13a597e3e24747991ef58a73 |
| private.materialize_feature_grants_trigger() | 20260720173545_content_version_policy_performance.sql:226;c4c2c49192effdec992db0cdb4881c508afe8859 |
| private.materialize_spell_grants_for_ref(uuid) | 20260720185149_feature_spell_grants.sql:46;2c1a957971b0b677e48d3303c0ea99c4285b482d |
| private.materialize_spell_grants_trigger() | Same spell migration:421 |
| public.sync_character_spell_grants(uuid) | Same spell migration:697 |
| public.sync_character_feature_refs(uuid) | 20260720185305_character_content_boundary_guards.sql:352;7a99c4e92fbb3005f13c7fd2052e6d06a96017b5 |
| private.prune_inactive_feature_refs_after_choices() | 20260721221108_feat_selection_and_campaign_revocation.sql:684;f62b745518db1a221b862f0f613b773617678f30 |

Materializer functions/triggers revoke PUBLIC/anon/authenticated; that does not
establish effective service_role privileges. Both public reconciliation RPCs
grant authenticated and derive actor identity from auth.uid(). Latest pruning
also revokes service_role. 00045_campaign_api_least_privilege.sql specifies public
default privileges FOR ROLE postgres (blob08f37d22374a8a9e67149453fc40383eeeadf15f);
it does not establish these owners or private-schema defaults.

## Prepared catalog-only read

Execute only after the separately approved G2 baseline/target/source freeze. This
query is UNEXECUTED. It calls only PostgreSQL catalog utilities, no application
function, and reads no user rows or raw function bodies. Unexpected proconfig
values must not be dumped.

```sql
WITH wanted(signature) AS (VALUES
  ('private.materialize_feature_grants_for_ref(uuid)'),
  ('private.materialize_feature_grants_trigger()'),
  ('private.materialize_spell_grants_for_ref(uuid)'),
  ('private.materialize_spell_grants_trigger()'),
  ('public.sync_character_feature_refs(uuid)'),
  ('public.sync_character_spell_grants(uuid)'),
  ('private.prune_inactive_feature_refs_after_choices()'),
  ('private.character_can_access_content_version(uuid,uuid,integer)'),
  ('private.is_character_feature_grant_active(uuid)'),
  ('private.is_character_spell_grant_active(uuid)'),
  ('private.active_character_spell_grant_representatives(uuid)'),
  ('private.enforce_character_feature_grant()'),
  ('private.enforce_character_spell_grant()')
)
SELECT w.signature, p.oid, p.proowner, r.rolname,
       r.rolsuper, r.rolbypassrls, r.rolinherit, r.rolcanlogin,
       p.prosecdef, l.lanname, p.provolatile, p.proretset,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_catalog.pg_get_function_result(p.oid) AS result,
       p.proacl,
       ARRAY(SELECT value FROM pg_catalog.unnest(p.proconfig) value
             WHERE value LIKE 'search_path=%') AS search_path_config,
       pg_catalog.cardinality(p.proconfig) AS config_count,
       pg_catalog.md5(pg_catalog.replace(p.prosrc,E'\r\n',E'\n')) AS body_md5
FROM wanted w
LEFT JOIN pg_catalog.pg_proc p
  ON p.oid=pg_catalog.to_regprocedure(w.signature)
LEFT JOIN pg_catalog.pg_roles r ON r.oid=p.proowner
LEFT JOIN pg_catalog.pg_language l ON l.oid=p.prolang
ORDER BY w.signature;
```

Pair with bounded pg_trigger capture for characters, character_content_refs and
character_spells: function OID, enabled mode, event/column set, args and deferred
flags. Capture effective schema USAGE/function EXECUTE for discovered original
owners and fixed staged roles, plus relevant pg_default_acl entries. Do not
execute any application function to obtain these facts.

Missing objects, owner/body/config/trigger drift or unresolved effective privileges
are blockers. Native row-plan/materializer implementation is not released before
the original-owner metadata is authorized, captured and independently challenged.
