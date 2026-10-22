-- Read-only selected metadata. No Auth/application rows or function bodies.
WITH requested(schema_name,table_name,column_name,row_lock_read) AS (VALUES
 ('auth','users','id',true),('auth','users','aud',true),('auth','users','role',true),
 ('auth','users','is_anonymous',true),('auth','users','deleted_at',true),('auth','users','banned_until',true),
 ('auth','users','raw_user_meta_data',false),
 ('auth','sessions','id',true),('auth','sessions','user_id',true),('auth','sessions','not_after',true),
 ('public','profiles','id',true),('public','profiles','display_name',false),
 ('public','characters','id',true),('public','characters','user_id',true),('public','characters','system_id',false),
 ('public','characters','campaign_id',false),('public','characters','name',false),
 ('public','game_systems','id',false),('public','game_systems','slug',false),('public','game_systems','name',false),
 ('public','game_systems','status',false),('public','game_systems','schema_definition',false),
 ('public','game_systems','expression_context',false),
 ('private','character_writer_guard_v1','singleton',true),('private','character_writer_guard_v1','marker',false)
), relations AS (
 SELECT DISTINCT requested.schema_name,requested.table_name,c.oid,c.relowner,c.relrowsecurity,c.relforcerowsecurity,c.relkind
 FROM requested LEFT JOIN pg_catalog.pg_namespace n ON n.nspname=requested.schema_name
 LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=requested.table_name
), columns AS (
 SELECT requested.*,c.oid AS relation_id,a.attnum,a.atttypid,a.atttypmod,a.attnotnull,a.attidentity,a.attgenerated,d.adbin,d.adrelid
 FROM requested JOIN relations c USING(schema_name,table_name)
 JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attname=requested.column_name AND NOT a.attisdropped
 LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
), functions AS (
 SELECT p.*,n.nspname FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='public' AND p.proname='handle_new_user' AND p.pronargs=0)
 OR (n.nspname='private' AND p.proname='lock_character_command_rows_v1' AND p.proargtypes='3802 2950'::pg_catalog.oidvector)
 OR (n.nspname='private' AND p.proname='check_character_command_clock_v1' AND p.proargtypes='1184'::pg_catalog.oidvector)
), roles AS (
 SELECT oid,rolname,rolsuper,rolinherit,rolbypassrls,rolcanlogin FROM pg_catalog.pg_roles
 WHERE rolname IN ('postgres','anon','authenticated','service_role')
 OR oid IN (SELECT relowner FROM relations) OR oid IN (SELECT proowner FROM functions)
), memberships AS (
 SELECT m.* FROM pg_catalog.pg_auth_members m WHERE m.member IN (SELECT oid FROM roles) OR m.roleid IN (SELECT oid FROM roles)
), keys AS (
 SELECT k.* FROM pg_catalog.pg_constraint k WHERE k.conrelid IN (SELECT oid FROM relations) AND k.contype IN ('p','f')
), triggers AS (
 SELECT t.* FROM pg_catalog.pg_trigger t WHERE t.tgrelid IN (SELECT oid FROM relations)
), policies AS (
 SELECT p.* FROM pg_catalog.pg_policy p WHERE p.polrelid IN (SELECT oid FROM relations)
), payload AS (
 SELECT pg_catalog.jsonb_build_object('catalog_version',1,'status','complete','current_role',CURRENT_USER,
 'relations',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('schema',schema_name,'table',table_name,
   'present',oid IS NOT NULL,'kind',relkind,'owner',pg_catalog.pg_get_userbyid(relowner),'rls',relrowsecurity,
   'force_rls',relforcerowsecurity,'row_security_active_for_current_role',CASE WHEN oid IS NULL THEN NULL ELSE pg_catalog.row_security_active(oid) END)
   ORDER BY schema_name,table_name) FROM relations),
 'columns',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('schema',schema_name,'table',table_name,
   'column',column_name,'attnum',attnum,'type',pg_catalog.format_type(atttypid,atttypmod),'not_null',attnotnull,
   'row_lock_read',row_lock_read,'identity',attidentity,'generated',attgenerated,'has_default',adbin IS NOT NULL,
   'default_md5',pg_catalog.md5(pg_catalog.pg_get_expr(adbin,adrelid))) ORDER BY schema_name,table_name,attnum) FROM columns),
 'keys',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('relation',conrelid::pg_catalog.regclass::text,
   'name',conname,'kind',contype,'validated',convalidated,'deferrable',condeferrable,'deferred',condeferred,
   'target',CASE WHEN confrelid=0 THEN NULL ELSE confrelid::pg_catalog.regclass::text END,
   'on_delete',confdeltype,'on_update',confupdtype,'definition_md5',pg_catalog.md5(pg_catalog.pg_get_constraintdef(oid,true)),
   'column_map',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('position',m.position,
     'source_attnum',conkey[m.position],'source_column',a.attname,'target_attnum',confkey[m.position],'target_column',b.attname) ORDER BY m.position)
     FROM pg_catalog.generate_subscripts(conkey,1) AS m(position)
     LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=conrelid AND a.attnum=conkey[m.position]
     LEFT JOIN pg_catalog.pg_attribute b ON b.attrelid=confrelid AND b.attnum=confkey[m.position])) ORDER BY conrelid,conname),'[]'::jsonb) FROM keys),
 'roles',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role',rolname,'superuser',rolsuper,
   'inherit',rolinherit,'bypass_rls',rolbypassrls,'can_login',rolcanlogin) ORDER BY rolname) FROM roles),
 'memberships',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role',pg_catalog.pg_get_userbyid(roleid),
   'member',pg_catalog.pg_get_userbyid(member),'grantor',pg_catalog.pg_get_userbyid(grantor),'admin_option',admin_option,
   'inherit_option',inherit_option,'set_option',set_option) ORDER BY roleid,member,grantor),'[]'::jsonb) FROM memberships),
 'schema_privileges',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role',r.rolname,'schema',n.nspname,
   'usage',pg_catalog.has_schema_privilege(r.oid,n.oid,'USAGE'),'create',pg_catalog.has_schema_privilege(r.oid,n.oid,'CREATE'))
   ORDER BY r.rolname,n.nspname) FROM roles r CROSS JOIN pg_catalog.pg_namespace n WHERE n.nspname IN ('auth','public','private')),
 'table_privileges',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role',r.rolname,'schema',c.schema_name,'table',c.table_name,
   'select',pg_catalog.has_table_privilege(r.oid,c.oid,'SELECT'),'insert',pg_catalog.has_table_privilege(r.oid,c.oid,'INSERT'),
   'update',pg_catalog.has_table_privilege(r.oid,c.oid,'UPDATE'),'delete',pg_catalog.has_table_privilege(r.oid,c.oid,'DELETE'),
   'truncate',pg_catalog.has_table_privilege(r.oid,c.oid,'TRUNCATE'),'trigger',pg_catalog.has_table_privilege(r.oid,c.oid,'TRIGGER'))
   ORDER BY r.rolname,c.schema_name,c.table_name) FROM roles r CROSS JOIN relations c WHERE c.oid IS NOT NULL),
 'column_privileges',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role',r.rolname,'schema',c.schema_name,'table',c.table_name,
   'column',c.column_name,'row_lock_read',c.row_lock_read,'select',pg_catalog.has_column_privilege(r.oid,c.relation_id,c.attnum,'SELECT'),
   'update',pg_catalog.has_column_privilege(r.oid,c.relation_id,c.attnum,'UPDATE')) ORDER BY r.rolname,c.schema_name,c.table_name,c.attnum)
   FROM roles r CROSS JOIN columns c),
 'row_lock_privileges',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role',r.rolname,'schema',c.schema_name,'table',c.table_name,
   'all_referenced_columns_select',(SELECT pg_catalog.bool_and(pg_catalog.has_column_privilege(r.oid,a.relation_id,a.attnum,'SELECT'))
      FROM columns a WHERE a.relation_id=c.oid AND a.row_lock_read),
   'any_column_update',(SELECT pg_catalog.bool_or(pg_catalog.has_column_privilege(r.oid,a.attrelid,a.attnum,'UPDATE'))
      FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)) ORDER BY r.rolname,c.schema_name,c.table_name)
   FROM roles r CROSS JOIN relations c WHERE c.oid IS NOT NULL AND EXISTS(SELECT 1 FROM columns a WHERE a.relation_id=c.oid AND a.row_lock_read)),
 'functions',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('signature',oid::pg_catalog.regprocedure::text,
   'owner',pg_catalog.pg_get_userbyid(proowner),'security_definer',prosecdef,'volatility',provolatile,'return_type',pg_catalog.format_type(prorettype,NULL),
   'body_md5',pg_catalog.md5(prosrc),'acl_md5',pg_catalog.md5(COALESCE(proacl::text,'default')),
   'search_path',(SELECT pg_catalog.jsonb_agg(option) FROM pg_catalog.unnest(proconfig) option WHERE option LIKE 'search_path=%'),
   'role_execute',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role',r.rolname,'execute',pg_catalog.has_function_privilege(r.oid,f.oid,'EXECUTE')) ORDER BY r.rolname) FROM roles r))
   ORDER BY nspname,proname),'[]'::jsonb) FROM functions f),
 'triggers',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('relation',t.tgrelid::pg_catalog.regclass::text,'name',t.tgname,
   'internal',t.tgisinternal,'enabled',t.tgenabled,'type_bits',t.tgtype,'function',t.tgfoid::pg_catalog.regprocedure::text,
   'function_owner',pg_catalog.pg_get_userbyid(p.proowner),'function_body_md5',pg_catalog.md5(p.prosrc),
   'binding_md5',pg_catalog.md5(pg_catalog.pg_get_triggerdef(t.oid,true)),
   'column_map',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('attnum',a.attnum,'column',a.attname) ORDER BY a.attnum),'[]'::jsonb)
     FROM pg_catalog.pg_attribute a WHERE a.attrelid=t.tgrelid AND a.attnum=ANY(t.tgattr::smallint[]))) ORDER BY t.tgrelid,t.tgname),'[]'::jsonb)
   FROM triggers t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid),
 'policies',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('relation',polrelid::pg_catalog.regclass::text,'name',polname,
   'command',polcmd,'permissive',polpermissive,'roles',polroles,'using_md5',pg_catalog.md5(pg_catalog.pg_get_expr(polqual,polrelid)),
   'check_md5',pg_catalog.md5(pg_catalog.pg_get_expr(polwithcheck,polrelid))) ORDER BY polrelid,polname),'[]'::jsonb) FROM policies)
 ) AS value
), counts AS (
 SELECT pg_catalog.jsonb_build_object('columns',(SELECT pg_catalog.count(*) FROM columns),'keys',(SELECT pg_catalog.count(*) FROM keys),
   'triggers',(SELECT pg_catalog.count(*) FROM triggers),'policies',(SELECT pg_catalog.count(*) FROM policies),
   'memberships',(SELECT pg_catalog.count(*) FROM memberships)) AS value
)
SELECT CASE WHEN pg_catalog.octet_length(payload.value::text)<=1048576
 AND (SELECT pg_catalog.count(*) FROM columns)<=32 AND (SELECT pg_catalog.count(*) FROM keys)<=128
 AND (SELECT pg_catalog.count(*) FROM triggers)<=256 AND (SELECT pg_catalog.count(*) FROM policies)<=128
 AND (SELECT pg_catalog.count(*) FROM memberships)<=128
 THEN payload.value ELSE pg_catalog.jsonb_build_object('catalog_version',1,'status','refused','reason','metadata_budget','counts',counts.value) END AS catalog
FROM payload CROSS JOIN counts;
