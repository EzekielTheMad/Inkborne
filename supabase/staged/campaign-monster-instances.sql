-- M5 SOURCE ONLY / UNAPPLIED. No R09/P1 dependency, activation or native proof.
-- Install after existing campaign authorization and immutable content versions.
BEGIN;
DO $$ BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN('campaigns','game_systems','content_definitions','content_versions') AND c.relrowsecurity)<>4 THEN
    RAISE EXCEPTION 'Existing source/parent RLS required for lock-only rights' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'inkborne_campaign_monster_owner') THEN
    CREATE ROLE inkborne_campaign_monster_owner NOLOGIN NOBYPASSRLS NOINHERIT;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname='inkborne_campaign_monster_owner' AND (r.rolcanlogin OR r.rolbypassrls OR r.rolinherit OR r.rolsuper))
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.member OR r.oid=m.roleid WHERE r.rolname='inkborne_campaign_monster_owner') THEN
    RAISE EXCEPTION 'Isolated runtime owner required' USING ERRCODE='42501';
  END IF;
END $$;
CREATE TABLE public.campaign_monster_instances (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES public.game_systems(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL, created_at timestamptz NOT NULL,
  source_content_id uuid NOT NULL, source_version integer NOT NULL CHECK (source_version BETWEEN 1 AND 2147483647),
  source_snapshot jsonb NOT NULL, source_digest text NOT NULL CHECK (source_digest ~ '^[a-f0-9]{64}$'),
  declared_max_hp integer NOT NULL CHECK (declared_max_hp BETWEEN 1 AND 1000000),
  name text NOT NULL, current_hp integer NOT NULL CHECK (current_hp BETWEEN 0 AND declared_max_hp),
  notes text NOT NULL, archived boolean NOT NULL DEFAULT false,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0)
);
CREATE INDEX campaign_monster_roster ON public.campaign_monster_instances(campaign_id,archived,name,id);
CREATE TABLE private.campaign_monster_commands_v1 (
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL, instance_id uuid NOT NULL REFERENCES public.campaign_monster_instances(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  canonical_intent jsonb NOT NULL, receipt jsonb NOT NULL,
  PRIMARY KEY(campaign_id,operation_id)
);
ALTER TABLE public.campaign_monster_instances OWNER TO inkborne_campaign_monster_owner;
ALTER TABLE private.campaign_monster_commands_v1 OWNER TO inkborne_campaign_monster_owner;
ALTER TABLE public.campaign_monster_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_monster_instances FORCE ROW LEVEL SECURITY;
ALTER TABLE private.campaign_monster_commands_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.campaign_monster_commands_v1 FORCE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,private,auth TO inkborne_campaign_monster_owner;
REVOKE ALL ON public.campaign_monster_instances,private.campaign_monster_commands_v1 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.campaign_monster_instances TO authenticated;
CREATE POLICY campaign_monster_internal ON public.campaign_monster_instances TO inkborne_campaign_monster_owner USING(true) WITH CHECK(true);
CREATE POLICY campaign_monster_command_internal ON private.campaign_monster_commands_v1 TO inkborne_campaign_monster_owner USING(true) WITH CHECK(true);

CREATE FUNCTION private.campaign_monster_enabled_v1() RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT false $$;
-- Both native and product gates remain false until independent G2/G3/recovery acceptance.
CREATE POLICY campaign_monster_dm_read ON public.campaign_monster_instances FOR SELECT TO authenticated
  USING(private.campaign_monster_enabled_v1() AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id=campaign_id AND c.owner_id=(SELECT auth.uid())));

-- Row locks require UPDATE privilege. These policies prohibit resulting source DML.
GRANT SELECT(id,owner_id,system_id),UPDATE(id) ON public.campaigns TO inkborne_campaign_monster_owner;
GRANT SELECT,UPDATE(id) ON public.game_systems,public.content_definitions TO inkborne_campaign_monster_owner;
GRANT SELECT,UPDATE(content_id) ON public.content_versions TO inkborne_campaign_monster_owner;
GRANT SELECT(content_id) ON public.content_import_origins TO inkborne_campaign_monster_owner;
CREATE POLICY campaign_monster_parent_read ON public.campaigns FOR SELECT TO inkborne_campaign_monster_owner USING(true);
CREATE POLICY campaign_monster_parent_lock ON public.campaigns FOR UPDATE TO inkborne_campaign_monster_owner USING(true) WITH CHECK(false);
CREATE POLICY campaign_monster_parent_no_write ON public.campaigns AS RESTRICTIVE FOR UPDATE TO inkborne_campaign_monster_owner USING(true) WITH CHECK(false);
CREATE POLICY campaign_monster_system_read ON public.game_systems FOR SELECT TO inkborne_campaign_monster_owner USING(true);
CREATE POLICY campaign_monster_system_lock ON public.game_systems FOR UPDATE TO inkborne_campaign_monster_owner USING(true) WITH CHECK(false);
CREATE POLICY campaign_monster_system_no_write ON public.game_systems AS RESTRICTIVE FOR UPDATE TO inkborne_campaign_monster_owner USING(true) WITH CHECK(false);
CREATE POLICY campaign_monster_definition_read ON public.content_definitions FOR SELECT TO inkborne_campaign_monster_owner USING(content_type='monster');
CREATE POLICY campaign_monster_definition_lock ON public.content_definitions FOR UPDATE TO inkborne_campaign_monster_owner USING(content_type='monster') WITH CHECK(false);
CREATE POLICY campaign_monster_definition_no_write ON public.content_definitions AS RESTRICTIVE FOR UPDATE TO inkborne_campaign_monster_owner USING(true) WITH CHECK(false);
CREATE POLICY campaign_monster_version_read ON public.content_versions FOR SELECT TO inkborne_campaign_monster_owner USING(content_type_snapshot='monster');
CREATE POLICY campaign_monster_version_lock ON public.content_versions FOR UPDATE TO inkborne_campaign_monster_owner USING(content_type_snapshot='monster') WITH CHECK(false);
CREATE POLICY campaign_monster_version_no_write ON public.content_versions AS RESTRICTIVE FOR UPDATE TO inkborne_campaign_monster_owner USING(true) WITH CHECK(false);
CREATE POLICY campaign_monster_import_read ON public.content_import_origins FOR SELECT TO inkborne_campaign_monster_owner USING(true);

CREATE FUNCTION private.campaign_monster_actor_v1() RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE actor uuid := auth.uid(); expiration numeric;
BEGIN
  IF NOT private.campaign_monster_enabled_v1() OR actor IS NULL OR COALESCE(auth.jwt()->>'is_anonymous','false') IS DISTINCT FROM 'false'
    OR COALESCE(auth.jwt()->>'exp','') !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Campaign monsters unavailable' USING ERRCODE='42501';
  END IF;
  expiration := (auth.jwt()->>'exp')::numeric;
  IF expiration <= extract(epoch FROM pg_catalog.clock_timestamp()) THEN RAISE EXCEPTION 'Authentication expired' USING ERRCODE='42501'; END IF;
  RETURN actor;
END $$;
CREATE FUNCTION private.campaign_monster_owner_v1(target uuid, actor uuid) RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE parent_owner uuid; parent_system uuid;
BEGIN
  SELECT c.owner_id,c.system_id INTO parent_owner,parent_system FROM public.campaigns c WHERE c.id=target FOR SHARE;
  IF NOT FOUND OR parent_owner IS DISTINCT FROM actor OR private.campaign_monster_actor_v1() IS DISTINCT FROM actor THEN
    RAISE EXCEPTION 'Campaign owner required' USING ERRCODE='42501';
  END IF;
  RETURN parent_system;
END $$;
CREATE FUNCTION private.campaign_monster_utf16_v1(value text) RETURNS integer LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$
  SELECT COALESCE(sum(CASE WHEN ascii(substr(value,n,1))>65535 THEN 2 ELSE 1 END),0)::integer FROM generate_series(1,length(value)) n
$$;
CREATE FUNCTION private.campaign_monster_controls_v1(label text,hp integer,memo text,maximum integer) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF label IS NULL OR private.campaign_monster_utf16_v1(label) NOT BETWEEN 1 AND 100 OR octet_length(label)>400
    OR length(btrim(label,U&'\0009\000a\000b\000c\000d\0020\00a0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200a\2028\2029\202f\205f\3000\feff'))=0
    OR memo IS NULL OR private.campaign_monster_utf16_v1(memo)>8000 OR octet_length(memo)>32000
    OR maximum IS NULL OR maximum NOT BETWEEN 1 AND 1000000 OR hp IS NULL OR hp NOT BETWEEN 0 AND maximum THEN
    RAISE EXCEPTION 'Invalid manual controls' USING ERRCODE='22023';
  END IF;
END $$;
CREATE FUNCTION private.campaign_monster_snapshot_v1(snapshot jsonb,content uuid,version integer,system_id uuid) RETURNS integer LANGUAGE plpgsql SET search_path='' AS $$
DECLARE maximum integer; declared numeric;
BEGIN
  IF snapshot IS NULL OR jsonb_typeof(snapshot) IS DISTINCT FROM 'object' OR octet_length(snapshot::text)>131072
    OR snapshot->>'content_id' IS DISTINCT FROM content::text OR snapshot->>'version' IS DISTINCT FROM version::text
    OR snapshot->>'system_id_snapshot' IS DISTINCT FROM system_id::text OR snapshot->>'content_type_snapshot' IS DISTINCT FROM 'monster'
    OR snapshot->'effects_snapshot' IS DISTINCT FROM '[]'::jsonb OR jsonb_typeof(snapshot->'data_snapshot') IS DISTINCT FROM 'object'
    OR snapshot#>'{data_snapshot,schema_version}' IS DISTINCT FROM '1'::jsonb OR octet_length((snapshot->'data_snapshot')::text)>65536
    OR jsonb_typeof(snapshot->'name_snapshot') IS DISTINCT FROM 'string' OR jsonb_typeof(snapshot->'slug_snapshot') IS DISTINCT FROM 'string'
    OR private.campaign_monster_utf16_v1(snapshot->>'name_snapshot') NOT BETWEEN 1 AND 200
    OR private.campaign_monster_utf16_v1(snapshot->>'slug_snapshot') NOT BETWEEN 1 AND 200
    OR jsonb_typeof(snapshot#>'{data_snapshot,hit_points,average}') IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'Unsupported native source profile' USING ERRCODE='22023';
  END IF;
  declared := (snapshot#>>'{data_snapshot,hit_points,average}')::numeric;
  IF declared NOT BETWEEN 1 AND 1000000 OR trunc(declared) IS DISTINCT FROM declared THEN RAISE EXCEPTION 'Invalid declared HP' USING ERRCODE='22023'; END IF;
  maximum := declared::integer;
  -- Deliberately NOT complete Zod descriptive parity; canonical preview/render required.
  RETURN maximum;
END $$;
CREATE FUNCTION private.campaign_monster_source_v1(target uuid,content uuid,expected_version integer,actor uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE definition public.content_definitions%ROWTYPE; system_row public.game_systems%ROWTYPE; snapshot public.content_versions%ROWTYPE; campaign_system uuid; raw jsonb; maximum integer;
BEGIN
  SELECT d.* INTO definition FROM public.content_definitions d WHERE d.id=content FOR SHARE;
  IF NOT FOUND OR definition.content_type IS DISTINCT FROM 'monster' OR definition.is_retired IS DISTINCT FROM false OR definition.version IS DISTINCT FROM expected_version
    OR (definition.scope='platform' AND definition.owner_id IS NULL OR definition.scope='personal' AND definition.owner_id=actor) IS NOT TRUE THEN
    RAISE EXCEPTION 'Active supported source changed or unavailable' USING ERRCODE='40001';
  END IF;
  SELECT s.* INTO system_row FROM public.game_systems s WHERE s.id=definition.system_id FOR SHARE;
  IF NOT FOUND OR system_row.slug IS DISTINCT FROM 'dnd-5e-2014' OR system_row.status IS DISTINCT FROM 'published'
    OR (SELECT count(*) FROM public.game_systems s WHERE s.slug='dnd-5e-2014' AND s.status='published')<>1 THEN
    RAISE EXCEPTION 'Published system unavailable' USING ERRCODE='42501';
  END IF;
  campaign_system := private.campaign_monster_owner_v1(target,actor);
  IF campaign_system IS DISTINCT FROM definition.system_id THEN RAISE EXCEPTION 'System mismatch' USING ERRCODE='42501'; END IF;
  SELECT v.* INTO snapshot FROM public.content_versions v WHERE v.content_id=content AND v.version=expected_version FOR SHARE;
  IF NOT FOUND OR ROW(snapshot.content_id,snapshot.version,snapshot.system_id_snapshot,snapshot.content_type_snapshot,snapshot.slug_snapshot,snapshot.name_snapshot,
    snapshot.data_snapshot,snapshot.effects_snapshot,snapshot.source_snapshot,snapshot.scope_snapshot,snapshot.owner_id_snapshot)
    IS DISTINCT FROM ROW(definition.id,definition.version,definition.system_id,definition.content_type,definition.slug,definition.name,
    definition.data,definition.effects,definition.source,definition.scope,definition.owner_id)
    OR EXISTS (SELECT 1 FROM public.content_import_origins origin WHERE origin.content_id=content) THEN
    RAISE EXCEPTION 'Exact unsupported source version' USING ERRCODE='40001';
  END IF;
  IF private.campaign_monster_actor_v1() IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Authentication changed after version wait' USING ERRCODE='42501'; END IF;
  raw := to_jsonb(snapshot); maximum := private.campaign_monster_snapshot_v1(raw,content,expected_version,campaign_system);
  RETURN jsonb_build_object('source_id',content,'source_version',expected_version,'system_id',campaign_system,
    'snapshot',raw,'source_digest',encode(sha256(convert_to(raw::text,'UTF8')),'hex'),'declared_max_hp',maximum);
END $$;
CREATE FUNCTION private.campaign_monster_row_guard_v1() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id=OLD.campaign_id) THEN RAISE EXCEPTION 'Archive instead of delete' USING ERRCODE='23514'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' THEN
    IF ROW(NEW.id,NEW.campaign_id,NEW.system_id,NEW.created_by,NEW.created_at,NEW.source_content_id,NEW.source_version,NEW.source_snapshot,NEW.source_digest,NEW.declared_max_hp)
      IS DISTINCT FROM ROW(OLD.id,OLD.campaign_id,OLD.system_id,OLD.created_by,OLD.created_at,OLD.source_content_id,OLD.source_version,OLD.source_snapshot,OLD.source_digest,OLD.declared_max_hp)
      OR NEW.revision IS DISTINCT FROM OLD.revision THEN RAISE EXCEPTION 'Immutable identity/source/revision' USING ERRCODE='23514'; END IF;
    IF ROW(NEW.name,NEW.current_hp,NEW.notes,NEW.archived) IS DISTINCT FROM ROW(OLD.name,OLD.current_hp,OLD.notes,OLD.archived) THEN
      IF OLD.revision=9223372036854775807 THEN RAISE EXCEPTION 'Revision exhausted' USING ERRCODE='22003'; END IF;
      NEW.revision := OLD.revision+1;
    END IF;
  ELSE
    IF NEW.revision<>0 OR NEW.archived IS DISTINCT FROM false OR NEW.created_by IS DISTINCT FROM private.campaign_monster_actor_v1() THEN
      RAISE EXCEPTION 'Initial identity invalid' USING ERRCODE='23514'; END IF;
  END IF;
  IF private.campaign_monster_owner_v1(NEW.campaign_id,private.campaign_monster_actor_v1()) IS DISTINCT FROM NEW.system_id
    OR private.campaign_monster_snapshot_v1(NEW.source_snapshot,NEW.source_content_id,NEW.source_version,NEW.system_id) IS DISTINCT FROM NEW.declared_max_hp
    OR encode(sha256(convert_to(NEW.source_snapshot::text,'UTF8')),'hex') IS DISTINCT FROM NEW.source_digest THEN
    RAISE EXCEPTION 'Source/parent integrity invalid' USING ERRCODE='23514'; END IF;
  PERFORM private.campaign_monster_controls_v1(NEW.name,NEW.current_hp,NEW.notes,NEW.declared_max_hp);
  RETURN NEW;
END $$;
CREATE FUNCTION private.campaign_monster_receipt_guard_v1() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item public.campaign_monster_instances%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM public.campaigns c WHERE c.id=OLD.campaign_id) THEN RETURN OLD; END IF;
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Immutable command receipt' USING ERRCODE='23514'; END IF;
  SELECT i.* INTO item FROM public.campaign_monster_instances i WHERE i.id=NEW.instance_id AND i.campaign_id=NEW.campaign_id;
  IF NOT FOUND OR NEW.receipt->>'campaign_id' IS DISTINCT FROM NEW.campaign_id::text OR NEW.receipt->>'operation_id' IS DISTINCT FROM NEW.operation_id::text
    OR NEW.receipt->>'instance_id' IS DISTINCT FROM NEW.instance_id::text OR NEW.receipt->'canonical_intent' IS DISTINCT FROM NEW.canonical_intent
    OR NEW.receipt->>'original_actor_id' IS DISTINCT FROM private.campaign_monster_actor_v1()::text
    OR NEW.receipt->'readback' IS DISTINCT FROM jsonb_build_object('id',item.id,'campaign_id',item.campaign_id,'name',item.name,'current_hp',item.current_hp,
      'declared_max_hp',item.declared_max_hp,'notes',item.notes,'archived',item.archived,'revision',item.revision::text) THEN
    RAISE EXCEPTION 'Receipt readback correspondence invalid' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER campaign_monster_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.campaign_monster_instances FOR EACH ROW EXECUTE FUNCTION private.campaign_monster_row_guard_v1();
CREATE TRIGGER campaign_monster_receipt_guard BEFORE INSERT OR UPDATE OR DELETE ON private.campaign_monster_commands_v1 FOR EACH ROW EXECUTE FUNCTION private.campaign_monster_receipt_guard_v1();

CREATE FUNCTION public.read_campaign_monster_source_v1(target_campaign_id uuid,target_content_id uuid,target_version integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := private.campaign_monster_actor_v1();
BEGIN
  IF target_campaign_id IS NULL OR target_content_id IS NULL OR target_version NOT BETWEEN 1 AND 2147483647 THEN RAISE EXCEPTION 'Invalid preview identity' USING ERRCODE='22023'; END IF;
  RETURN private.campaign_monster_source_v1(target_campaign_id,target_content_id,target_version,actor);
END $$;
CREATE FUNCTION public.resolve_campaign_monster_command_v1(target_campaign_id uuid,target_operation_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := private.campaign_monster_actor_v1(); prior jsonb;
BEGIN
  IF target_campaign_id IS NULL OR target_operation_id IS NULL THEN RAISE EXCEPTION 'Invalid operation' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('campaign-monster-v1:'||target_campaign_id::text||':'||target_operation_id::text,0));
  PERFORM private.campaign_monster_owner_v1(target_campaign_id,actor);
  SELECT command.receipt INTO prior FROM private.campaign_monster_commands_v1 command WHERE command.campaign_id=target_campaign_id AND command.operation_id=target_operation_id;
  -- Absence never cancels a delayed request or permits a replacement operation.
  RETURN CASE WHEN FOUND THEN jsonb_build_object('status','saved','receipt',prior) ELSE jsonb_build_object('status','absent') END;
END $$;
CREATE FUNCTION public.commit_campaign_monster_instance_v1(target_campaign_id uuid,request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := private.campaign_monster_actor_v1(); op uuid; prior private.campaign_monster_commands_v1%ROWTYPE;
  source jsonb; item public.campaign_monster_instances%ROWTYPE; patch jsonb; maximum integer; outcome text; result jsonb; expected bigint;
BEGIN
  IF target_campaign_id IS NULL OR jsonb_typeof(request) IS DISTINCT FROM 'object' OR octet_length(request::text)>40960
    OR request->'command_version' IS DISTINCT FROM '1'::jsonb OR jsonb_typeof(request->'operation_id') IS DISTINCT FROM 'string'
    OR COALESCE(request->>'operation_id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR (request->>'command' IN ('create','update')) IS NOT TRUE THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='22023'; END IF;
  op := (request->>'operation_id')::uuid;
  PERFORM pg_advisory_xact_lock(hashtextextended('campaign-monster-v1:'||target_campaign_id::text||':'||op::text,0));
  IF NOT EXISTS(SELECT 1 FROM public.campaigns c WHERE c.id=target_campaign_id AND c.owner_id=actor) THEN RAISE EXCEPTION 'Campaign owner required' USING ERRCODE='42501'; END IF;
  SELECT command.* INTO prior FROM private.campaign_monster_commands_v1 command WHERE command.campaign_id=target_campaign_id AND command.operation_id=op;
  IF FOUND THEN
    PERFORM private.campaign_monster_owner_v1(target_campaign_id,actor);
    IF prior.canonical_intent IS DISTINCT FROM request THEN RAISE EXCEPTION 'Operation intent conflict' USING ERRCODE='40001'; END IF;
    RETURN prior.receipt; -- Before all NEW source/revision/retirement/exhaustion checks.
  END IF;
  IF request->>'command'='create' THEN
    IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(request) k) IS DISTINCT FROM ARRAY['command','command_version','current_hp','name','notes','operation_id','source_digest','source_id','source_version']::text[]
      OR jsonb_typeof(request->'source_id') IS DISTINCT FROM 'string' OR COALESCE(request->>'source_id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR jsonb_typeof(request->'source_version') IS DISTINCT FROM 'number'
      OR COALESCE(request->>'source_version','') !~ '^[0-9]{1,10}$' OR (request->>'source_version')::numeric NOT BETWEEN 1 AND 2147483647
      OR jsonb_typeof(request->'source_digest') IS DISTINCT FROM 'string' OR COALESCE(request->>'source_digest','') !~ '^[a-f0-9]{64}$'
      OR jsonb_typeof(request->'name') IS DISTINCT FROM 'string' OR jsonb_typeof(request->'notes') IS DISTINCT FROM 'string'
      OR jsonb_typeof(request->'current_hp') IS DISTINCT FROM 'number' OR COALESCE(request->>'current_hp','') !~ '^[0-9]{1,7}$' THEN
      RAISE EXCEPTION 'Invalid create controls' USING ERRCODE='22023'; END IF;
    source := private.campaign_monster_source_v1(target_campaign_id,(request->>'source_id')::uuid,(request->>'source_version')::integer,actor);
    IF source->>'source_digest' IS DISTINCT FROM request->>'source_digest' THEN RAISE EXCEPTION 'Source preview changed' USING ERRCODE='40001'; END IF;
    maximum := (source->>'declared_max_hp')::integer;
    PERFORM private.campaign_monster_controls_v1(request->>'name',(request->>'current_hp')::integer,request->>'notes',maximum);
    INSERT INTO public.campaign_monster_instances(campaign_id,system_id,created_by,created_at,source_content_id,source_version,source_snapshot,source_digest,declared_max_hp,name,current_hp,notes)
      VALUES(target_campaign_id,(source->>'system_id')::uuid,actor,clock_timestamp(),(request->>'source_id')::uuid,(request->>'source_version')::integer,
        source->'snapshot',source->>'source_digest',maximum,request->>'name',(request->>'current_hp')::integer,request->>'notes') RETURNING * INTO item;
    outcome := 'created';
  ELSE
    IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(request) k) IS DISTINCT FROM ARRAY['command','command_version','expected_revision','instance_id','operation_id','patch']::text[]
      OR jsonb_typeof(request->'instance_id') IS DISTINCT FROM 'string' OR COALESCE(request->>'instance_id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR jsonb_typeof(request->'expected_revision') IS DISTINCT FROM 'string'
      OR COALESCE(request->>'expected_revision','') !~ '^(0|[1-9][0-9]{0,18})$' OR (request->>'expected_revision')::numeric>9223372036854775807
      OR jsonb_typeof(request->'patch') IS DISTINCT FROM 'object' OR request->'patch'='{}'::jsonb THEN RAISE EXCEPTION 'Invalid update controls' USING ERRCODE='22023'; END IF;
    patch := request->'patch';
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE k NOT IN('name','current_hp','notes','archived'))
      OR (patch ? 'name' AND jsonb_typeof(patch->'name') IS DISTINCT FROM 'string') OR (patch ? 'notes' AND jsonb_typeof(patch->'notes') IS DISTINCT FROM 'string')
      OR (patch ? 'archived' AND jsonb_typeof(patch->'archived') IS DISTINCT FROM 'boolean')
      OR (patch ? 'current_hp' AND (jsonb_typeof(patch->'current_hp') IS DISTINCT FROM 'number' OR COALESCE(patch->>'current_hp','') !~ '^[0-9]{1,7}$')) THEN RAISE EXCEPTION 'Invalid patch' USING ERRCODE='22023'; END IF;
    PERFORM private.campaign_monster_owner_v1(target_campaign_id,actor);
    SELECT i.* INTO item FROM public.campaign_monster_instances i WHERE i.id=(request->>'instance_id')::uuid AND i.campaign_id=target_campaign_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Instance unavailable' USING ERRCODE='42501'; END IF;
    PERFORM private.campaign_monster_owner_v1(target_campaign_id,actor); -- Auth expiry after target-row wait.
    expected := (request->>'expected_revision')::bigint;
    IF item.revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Instance revision conflict' USING ERRCODE='40001'; END IF;
    outcome := CASE WHEN ROW(item.name,item.current_hp,item.notes,item.archived) IS NOT DISTINCT FROM ROW(COALESCE(patch->>'name',item.name),COALESCE((patch->>'current_hp')::integer,item.current_hp),COALESCE(patch->>'notes',item.notes),COALESCE((patch->>'archived')::boolean,item.archived)) THEN 'noop' ELSE 'updated' END;
    PERFORM private.campaign_monster_controls_v1(COALESCE(patch->>'name',item.name),COALESCE((patch->>'current_hp')::integer,item.current_hp),COALESCE(patch->>'notes',item.notes),item.declared_max_hp);
    IF outcome='updated' THEN
      UPDATE public.campaign_monster_instances i SET name=COALESCE(patch->>'name',i.name),current_hp=COALESCE((patch->>'current_hp')::integer,i.current_hp),
        notes=COALESCE(patch->>'notes',i.notes),archived=COALESCE((patch->>'archived')::boolean,i.archived) WHERE i.id=item.id AND i.revision=expected RETURNING i.* INTO item;
      IF NOT FOUND OR item.revision<>expected+1 THEN RAISE EXCEPTION 'Atomic readback failed' USING ERRCODE='23514'; END IF;
    END IF;
  END IF;
  result := jsonb_build_object('command_version',1,'campaign_id',target_campaign_id,'operation_id',op,'canonical_intent',request,'instance_id',item.id,
    'original_actor_id',actor,'accepted_at',clock_timestamp(),'outcome',outcome,'readback',jsonb_build_object('id',item.id,'campaign_id',item.campaign_id,'name',item.name,
      'current_hp',item.current_hp,'declared_max_hp',item.declared_max_hp,'notes',item.notes,'archived',item.archived,'revision',item.revision::text));
  INSERT INTO private.campaign_monster_commands_v1(campaign_id,operation_id,instance_id,canonical_intent,receipt) VALUES(target_campaign_id,op,item.id,request,result);
  RETURN result; -- Any failure rolls back BOTH instance and receipt in this transaction.
END $$;

-- Read projections keep BIGINT out of numeric JSON. Bounded DM summaries omit notes/snapshots.
CREATE FUNCTION public.list_campaign_monster_instances_v1(target_campaign_id uuid,show_archived boolean,name_search text,page_number integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := private.campaign_monster_actor_v1(); result jsonb; pattern text;
BEGIN
  IF target_campaign_id IS NULL OR show_archived IS NULL OR name_search IS NULL OR private.campaign_monster_utf16_v1(name_search)>100
    OR page_number IS NULL OR page_number NOT BETWEEN 0 AND 500 THEN RAISE EXCEPTION 'Invalid roster query' USING ERRCODE='22023'; END IF;
  PERFORM private.campaign_monster_owner_v1(target_campaign_id,actor);
  pattern := '%'||replace(replace(replace(name_search,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
  SELECT COALESCE(jsonb_agg(rows.summary ORDER BY rows.name,rows.id),'[]'::jsonb) INTO result FROM (
    SELECT i.name,i.id,jsonb_build_object('id',i.id,'campaign_id',i.campaign_id,'name',i.name,'current_hp',i.current_hp,
      'declared_max_hp',i.declared_max_hp,'archived',i.archived,'revision',i.revision::text) summary
    FROM public.campaign_monster_instances i WHERE i.campaign_id=target_campaign_id AND i.archived=show_archived AND i.name ILIKE pattern ESCAPE E'\\'
    ORDER BY i.name,i.id LIMIT 20 OFFSET page_number*20
  ) rows;
  RETURN result;
END $$;
CREATE FUNCTION public.get_campaign_monster_instance_v1(target_campaign_id uuid,target_instance_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := private.campaign_monster_actor_v1(); item public.campaign_monster_instances%ROWTYPE;
BEGIN
  IF target_campaign_id IS NULL OR target_instance_id IS NULL THEN RAISE EXCEPTION 'Invalid instance identity' USING ERRCODE='22023'; END IF;
  PERFORM private.campaign_monster_owner_v1(target_campaign_id,actor);
  SELECT i.* INTO item FROM public.campaign_monster_instances i WHERE i.id=target_instance_id AND i.campaign_id=target_campaign_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id',item.id,'campaign_id',item.campaign_id,'system_id',item.system_id,'name',item.name,'current_hp',item.current_hp,
    'declared_max_hp',item.declared_max_hp,'notes',item.notes,'archived',item.archived,'revision',item.revision::text,
    'source_content_id',item.source_content_id,'source_version',item.source_version,'source_digest',item.source_digest,'source_snapshot',item.source_snapshot);
END $$;

-- Owners assigned only after definitions. Close default EXECUTE in the same transaction.
DO $$ DECLARE signature text; BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'private.campaign_monster_enabled_v1()', 'private.campaign_monster_actor_v1()', 'private.campaign_monster_owner_v1(uuid,uuid)',
    'private.campaign_monster_utf16_v1(text)', 'private.campaign_monster_controls_v1(text,integer,text,integer)',
    'private.campaign_monster_snapshot_v1(jsonb,uuid,integer,uuid)', 'private.campaign_monster_source_v1(uuid,uuid,integer,uuid)',
    'private.campaign_monster_row_guard_v1()', 'private.campaign_monster_receipt_guard_v1()',
    'public.read_campaign_monster_source_v1(uuid,uuid,integer)', 'public.resolve_campaign_monster_command_v1(uuid,uuid)',
    'public.commit_campaign_monster_instance_v1(uuid,jsonb)', 'public.list_campaign_monster_instances_v1(uuid,boolean,text,integer)',
    'public.get_campaign_monster_instance_v1(uuid,uuid)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO inkborne_campaign_monster_owner',signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',signature);
  END LOOP;
  IF has_schema_privilege('inkborne_campaign_monster_owner','public','CREATE') OR has_schema_privilege('inkborne_campaign_monster_owner','private','CREATE') THEN
    RAISE EXCEPTION 'Runtime owner must have no CREATE (including inherited PUBLIC rights)' USING ERRCODE='42501';
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION private.campaign_monster_enabled_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.read_campaign_monster_source_v1(uuid,uuid,integer),public.resolve_campaign_monster_command_v1(uuid,uuid),public.commit_campaign_monster_instance_v1(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_campaign_monster_instances_v1(uuid,boolean,text,integer),public.get_campaign_monster_instance_v1(uuid,uuid) TO authenticated;
COMMIT;
