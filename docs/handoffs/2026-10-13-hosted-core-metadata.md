# Read-only hosted core metadata

Observed 2026-10-13 21:35–21:37 UTC through the connected Supabase tools. Exact
project selection was `Inkborne`, ID `etcaodglvcspcmwecyxq`, region us-west-1;
project listing reported ACTIVE_HEALTHY. Calls were project discovery, migration
listing and compact/verbose table metadata. No user rows, credentials, Auth tokens,
environment files, policies or function bodies were requested. No hosted mutation,
stage application, provider UAT, deployment or publication occurred.

The hosted migration inventory has 69 entries, ending with the recorded
conditional-character-state owner/authenticated migrations and
`20261010232200 save_character_abilities`. The local repository contains 83 migration
files. Comparing names yields 16 unmatched local names, but historical rename or
combined execution has not been reconciled. `characters.primary_color` is present
even though its local migration name is unmatched. Counts/names therefore do not
prove which SQL is effectively installed; do not apply presumed missing migrations.

Focused observed schema:

| Table | Observation |
| --- | --- |
| public.characters | 15 base columns, including narrative_rich and primary_color; no staged action_revision. RLS enabled. |
| public.character_content_refs | Existing identity/pin/context/choice_source fields plus feature_grant_id. RLS enabled. |
| public.character_feature_grants | Current generation UUID, controller ref/type/slug, feature slug/content/version, unlock level and created_at; no protected earned-occurrence lineage fields. RLS enabled. |

This is administrative metadata evidence. Project health and an enabled RLS flag
do not prove login, effective actor permissions, private-row denial, trigger binding,
receipt recovery, concurrency, copy or any changed user journey. The new private
staged protocol remains unaccepted; native/local G2 and provider UAT remain separate.

Non-sensitive ignored artifact:
`test-results/hosted-core-metadata-20261013.json`, SHA256
`1F7FDB5350A1A129D6F4239B8FBAC762D89457912E6A4AA55D9481A366A10F03`.
It records selected project status, migration-name comparison and focused column
names/types only, plus these limits. No raw connector response or row data is saved.
