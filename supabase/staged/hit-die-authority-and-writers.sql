-- R09.3b2 SOURCE ONLY. Apply AFTER the reviewed staged hit-die kernel, only in
-- explicitly authorized G2. Never a migration or automatically executed.
-- Auth is UNCONDITIONALLY unavailable, all 13 readiness families false.
-- No lifecycle/cutover/client route or new order producer is enabled here.
BEGIN;
CREATE ROLE inkborne_hit_die_authority_owner NOLOGIN NOBYPASSRLS NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT USAGE ON SCHEMA public, private TO inkborne_hit_die_authority_owner;
DO $$ BEGIN
  IF pg_catalog.has_schema_privilege('inkborne_hit_die_authority_owner', 'public', 'CREATE')
    OR pg_catalog.has_schema_privilege('inkborne_hit_die_authority_owner', 'private', 'CREATE') THEN
    RAISE EXCEPTION 'Inherited CREATE requires deployment reconciliation' USING ERRCODE = '42501';
  END IF;
END $$;
CREATE TABLE private.character_writer_guard_v1(singleton boolean PRIMARY KEY CHECK (singleton), marker integer NOT NULL DEFAULT 1);
INSERT INTO private.character_writer_guard_v1(singleton) VALUES (true);
CREATE TABLE private.character_writer_readiness_v1 (
  family text PRIMARY KEY CHECK (family IN ('auth','order','state','character_choices','refs','feature_grants','spell_grants','inventory','spells','shared_rules_access','version_identity','copy_award','lifecycle')),
  protocol_version integer NOT NULL DEFAULT 1 CHECK (protocol_version = 1),
  ready boolean NOT NULL DEFAULT false,
  reviewed_objects jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_catalog.jsonb_typeof(reviewed_objects) = 'object')
);
INSERT INTO private.character_writer_readiness_v1(family) SELECT family_entry.value FROM pg_catalog.unnest(ARRAY[
  'auth','order','state','character_choices','refs','feature_grants','spell_grants','inventory','spells','shared_rules_access','version_identity','copy_award','lifecycle']) AS family_entry(value);
CREATE TABLE private.character_projection_order_v1 (
  character_id uuid PRIMARY KEY REFERENCES public.characters(id) ON DELETE CASCADE,
  producer_version integer NOT NULL CHECK (producer_version = 1),
  producer_revision bigint NOT NULL CHECK (producer_revision >= 0),
  pins uuid[] NOT NULL, inventory uuid[] NOT NULL, spells uuid[] NOT NULL, feature_grants uuid[] NOT NULL, spell_grants uuid[] NOT NULL
);
-- No guessed legacy rows, empty order backfill, caller producer or mark-ready API.
ALTER TABLE private.character_writer_guard_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.character_writer_readiness_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.character_projection_order_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.character_writer_guard_v1, private.character_writer_readiness_v1, private.character_projection_order_v1 FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, UPDATE(marker) ON private.character_writer_guard_v1 TO inkborne_hit_die_authority_owner;
GRANT SELECT ON private.character_writer_readiness_v1, private.character_projection_order_v1 TO inkborne_hit_die_authority_owner;
GRANT UPDATE(producer_revision) ON private.character_projection_order_v1 TO inkborne_hit_die_authority_owner;
CREATE POLICY hit_die_guard_owner ON private.character_writer_guard_v1 TO inkborne_hit_die_authority_owner USING (true) WITH CHECK (true);
CREATE POLICY hit_die_readiness_owner ON private.character_writer_readiness_v1 FOR SELECT TO inkborne_hit_die_authority_owner USING (true);
CREATE POLICY hit_die_order_owner_read ON private.character_projection_order_v1 FOR SELECT TO inkborne_hit_die_authority_owner USING (true);
CREATE POLICY hit_die_order_owner_rebind ON private.character_projection_order_v1 FOR UPDATE TO inkborne_hit_die_authority_owner USING (true) WITH CHECK (true);
GRANT SELECT ON public.characters, public.game_systems, public.campaigns, public.campaign_members, public.content_shares,
  public.content_definitions, public.content_versions, public.character_content_refs, public.character_inventory,
  public.character_spells, public.character_feature_grants, public.character_spell_grants TO inkborne_hit_die_authority_owner;
GRANT UPDATE(state, action_revision) ON public.characters TO inkborne_hit_die_authority_owner;
-- Internal owner-only SELECT policies, never public read grants/auth bypass.
CREATE POLICY hit_die_authority_character_read ON public.characters FOR SELECT TO inkborne_hit_die_authority_owner USING (true);
CREATE POLICY hit_die_authority_character_write ON public.characters FOR UPDATE TO inkborne_hit_die_authority_owner USING (true) WITH CHECK (true);
CREATE POLICY hit_die_authority_system_read ON public.game_systems FOR SELECT TO inkborne_hit_die_authority_owner USING (true);
CREATE POLICY hit_die_authority_campaign_read ON public.campaigns FOR SELECT TO inkborne_hit_die_authority_owner USING (true);
CREATE POLICY hit_die_authority_member_read ON public.campaign_members FOR SELECT TO inkborne_hit_die_authority_owner USING (true);
CREATE POLICY hit_die_authority_share_read ON public.content_shares FOR SELECT TO inkborne_hit_die_authority_owner USING (true);
CREATE POLICY hit_die_authority_definition_read ON public.content_definitions FOR SELECT TO inkborne_hit_die_authority_owner USING (true);
CREATE POLICY hit_die_authority_version_read ON public.content_versions FOR SELECT TO inkborne_hit_die_authority_owner USING (true);
CREATE POLICY hit_die_authority_ref_read ON public.character_content_refs FOR SELECT TO inkborne_hit_die_authority_owner USING (true);
CREATE POLICY hit_die_authority_inventory_read ON public.character_inventory FOR SELECT TO inkborne_hit_die_authority_owner USING (true);
CREATE POLICY hit_die_authority_spell_read ON public.character_spells FOR SELECT TO inkborne_hit_die_authority_owner USING (true);
CREATE POLICY hit_die_authority_feature_grant_read ON public.character_feature_grants FOR SELECT TO inkborne_hit_die_authority_owner USING (true);
CREATE POLICY hit_die_authority_spell_grant_read ON public.character_spell_grants FOR SELECT TO inkborne_hit_die_authority_owner USING (true);
-- PG17 SELECT FOR SHARE requires UPDATE privilege on at least one column AND
-- UPDATE USING visibility. Give only the immutable key, with both permissive
-- lock visibility and restrictive WITH CHECK(false) to reject actual UPDATE.
-- No caller membership/UPDATE grant; effective lock/RLS semantics remain G2.
GRANT UPDATE(id) ON public.content_definitions, public.game_systems, public.campaigns, public.campaign_members, public.content_shares TO inkborne_hit_die_authority_owner;
GRANT UPDATE(content_id) ON public.content_versions TO inkborne_hit_die_authority_owner;
CREATE POLICY hit_die_definition_lock ON public.content_definitions FOR UPDATE TO inkborne_hit_die_authority_owner USING (true) WITH CHECK (false);
CREATE POLICY hit_die_definition_no_mutation ON public.content_definitions AS RESTRICTIVE FOR UPDATE TO inkborne_hit_die_authority_owner USING (true) WITH CHECK (false);
CREATE POLICY hit_die_system_lock ON public.game_systems FOR UPDATE TO inkborne_hit_die_authority_owner USING (true) WITH CHECK (false);
CREATE POLICY hit_die_system_no_mutation ON public.game_systems AS RESTRICTIVE FOR UPDATE TO inkborne_hit_die_authority_owner USING (true) WITH CHECK (false);
CREATE POLICY hit_die_campaign_lock ON public.campaigns FOR UPDATE TO inkborne_hit_die_authority_owner USING (true) WITH CHECK (false);
CREATE POLICY hit_die_campaign_no_mutation ON public.campaigns AS RESTRICTIVE FOR UPDATE TO inkborne_hit_die_authority_owner USING (true) WITH CHECK (false);
CREATE POLICY hit_die_member_lock ON public.campaign_members FOR UPDATE TO inkborne_hit_die_authority_owner USING (true) WITH CHECK (false);
CREATE POLICY hit_die_member_no_mutation ON public.campaign_members AS RESTRICTIVE FOR UPDATE TO inkborne_hit_die_authority_owner USING (true) WITH CHECK (false);
CREATE POLICY hit_die_share_lock ON public.content_shares FOR UPDATE TO inkborne_hit_die_authority_owner USING (true) WITH CHECK (false);
CREATE POLICY hit_die_share_no_mutation ON public.content_shares AS RESTRICTIVE FOR UPDATE TO inkborne_hit_die_authority_owner USING (true) WITH CHECK (false);
CREATE POLICY hit_die_version_lock ON public.content_versions FOR UPDATE TO inkborne_hit_die_authority_owner USING (true) WITH CHECK (false);
CREATE POLICY hit_die_version_no_mutation ON public.content_versions AS RESTRICTIVE FOR UPDATE TO inkborne_hit_die_authority_owner USING (true) WITH CHECK (false);
GRANT EXECUTE ON FUNCTION private.hit_die_exact_keys_v1(jsonb,text[]), private.hit_die_native_v1(timestamptz), private.hit_die_millis_v1(timestamptz), private.hit_die_deadline_v1(jsonb,timestamptz) TO inkborne_hit_die_authority_owner;

CREATE FUNCTION private.require_verified_hit_die_auth_v1(p_verified_context jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
BEGIN
  -- No guessed auth.users/auth.sessions/config SQL or grants. Context parsing
  -- is not authentication. Real columns/provider RI roles/order require G2.
  RAISE EXCEPTION 'auth_unavailable' USING ERRCODE = 'P0001';
END $$;
CREATE FUNCTION private.hit_die_context_shape_v1(value jsonb) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE expiry timestamptz;
BEGIN
  IF NOT private.hit_die_exact_keys_v1(value, ARRAY['context_version','actor_id','session_id','jwt_expires_at'])
    OR value->'context_version' IS DISTINCT FROM '1'::jsonb
    OR pg_catalog.jsonb_typeof(value->'actor_id') IS DISTINCT FROM 'string' OR pg_catalog.jsonb_typeof(value->'session_id') IS DISTINCT FROM 'string'
    OR value->>'jwt_expires_at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$'
    OR pg_catalog.jsonb_typeof(value->'jwt_expires_at') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
  PERFORM (value->>'actor_id')::uuid, (value->>'session_id')::uuid;
  expiry := (value->>'jwt_expires_at')::timestamptz;
  RETURN pg_catalog.isfinite(expiry) AND expiry >= '0001-01-01T00:00:00Z'::timestamptz AND expiry < '10000-01-01T00:00:00Z'::timestamptz
    AND private.hit_die_native_v1(expiry) = value->>'jwt_expires_at';
EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN RETURN false;
END $$;
CREATE FUNCTION private.lock_character_writer_guard_v1() RETURNS void
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
BEGIN
  PERFORM guard_row.singleton FROM private.character_writer_guard_v1 AS guard_row WHERE guard_row.singleton FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'writers_unready' USING ERRCODE = 'P0001'; END IF;
END $$;
CREATE FUNCTION private.hit_die_writers_ready_v1() RETURNS boolean
LANGUAGE sql VOLATILE SET search_path = '' AS $$
  SELECT pg_catalog.count(*) = 13 AND COALESCE(pg_catalog.bool_and(readiness.protocol_version = 1 AND readiness.ready AND readiness.reviewed_objects <> '{}'::jsonb), false)
    FROM private.character_writer_readiness_v1 AS readiness
$$;
CREATE FUNCTION private.hit_die_order_matches_v1(ids uuid[], rows jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT ids IS NOT NULL AND pg_catalog.jsonb_typeof(rows) = 'array'
    AND (pg_catalog.cardinality(ids) = 0 OR pg_catalog.array_ndims(ids) = 1)
    AND pg_catalog.cardinality(ids) = pg_catalog.jsonb_array_length(rows)
    AND (SELECT pg_catalog.count(DISTINCT id_entry.value) FROM pg_catalog.unnest(ids) AS id_entry(value)) = pg_catalog.cardinality(ids)
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.unnest(ids) WITH ORDINALITY item(id, position)
      WHERE item.id IS NULL OR rows->(item.position::integer - 1)->>'id' IS DISTINCT FROM item.id::text)
$$;
CREATE FUNCTION private.hit_die_version_dto_v1(p_version_row public.content_versions) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE WHEN (p_version_row).content_id IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object(
    'id',(p_version_row).content_id,'version',(p_version_row).version,'system_id',(p_version_row).system_id_snapshot,'content_type',(p_version_row).content_type_snapshot,
    'slug',(p_version_row).slug_snapshot,'name',(p_version_row).name_snapshot,'data',(p_version_row).data_snapshot,'effects',(p_version_row).effects_snapshot,
    'source',(p_version_row).source_snapshot,'scope',(p_version_row).scope_snapshot,'owner_id',(p_version_row).owner_id_snapshot) END
$$;

CREATE FUNCTION private.read_locked_hit_die_graph_v1(p_character_id uuid, p_verified_context jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE c public.characters%ROWTYPE; system_row public.game_systems%ROWTYPE; campaign_row public.campaigns%ROWTYPE; ordering private.character_projection_order_v1%ROWTYPE;
  pins jsonb; inventory jsonb; spells jsonb; features jsonb; spell_grants jsonb; versions jsonb; version_times jsonb; access_rows jsonb; metadata jsonb; snapshot jsonb; counts jsonb;
  n_pins bigint; n_inventory bigint; n_spells bigint; n_features bigint; n_spell_grants bigint; n_versions bigint; domain text; rows jsonb; entry jsonb;
  selected_content_id uuid; selected_content_version integer; native_clock timestamptz;
BEGIN
  -- Caller has established auth prefix and writer guard in this transaction.
  IF NOT private.hit_die_writers_ready_v1() THEN RETURN '{"status":"unready","reason":"writers_unready"}'::jsonb; END IF;
  SELECT target.* INTO c FROM public.characters AS target WHERE target.id = p_character_id AND target.user_id = (p_verified_context->>'actor_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"status":"inaccessible"}'::jsonb; END IF;
  SELECT order_row.* INTO ordering FROM private.character_projection_order_v1 AS order_row WHERE order_row.character_id = c.id;
  IF NOT FOUND OR ordering.producer_version <> 1 OR ordering.producer_revision <> c.action_revision THEN RETURN '{"status":"unready","reason":"legacy_order_unproven"}'::jsonb; END IF;
  -- Lock acquisition sorts stable IDs; projection below uses ONLY proved order.
  PERFORM d.id FROM public.content_definitions d WHERE d.id IN (
    SELECT ref.content_id FROM public.character_content_refs AS ref WHERE ref.character_id = c.id UNION
    SELECT item.content_id FROM public.character_inventory AS item WHERE item.character_id = c.id UNION
    SELECT spell.content_id FROM public.character_spells AS spell WHERE spell.character_id = c.id UNION
    SELECT feature.feature_content_id FROM public.character_feature_grants AS feature WHERE feature.character_id = c.id UNION
    SELECT grant_row.spell_content_id FROM public.character_spell_grants AS grant_row WHERE grant_row.character_id = c.id) ORDER BY d.id FOR SHARE;
  SELECT system_source.* INTO system_row FROM public.game_systems AS system_source WHERE system_source.id = c.system_id FOR SHARE;
  IF NOT FOUND OR system_row.slug <> 'dnd-5e-2014' OR system_row.expression_context IS DISTINCT FROM '{}'::jsonb THEN RETURN '{"status":"unready","reason":"schema_unready"}'::jsonb; END IF;
  IF c.campaign_id IS NOT NULL THEN
    SELECT campaign_source.* INTO campaign_row FROM public.campaigns AS campaign_source WHERE campaign_source.id = c.campaign_id FOR SHARE;
    IF NOT FOUND OR campaign_row.system_id <> c.system_id THEN RETURN '{"status":"unready","reason":"incomplete_graph"}'::jsonb; END IF;
    PERFORM member.id FROM public.campaign_members AS member WHERE member.campaign_id = c.campaign_id AND member.user_id = c.user_id ORDER BY member.id FOR SHARE;
    PERFORM share.id FROM public.content_shares AS share WHERE share.campaign_id = c.campaign_id AND share.content_id IN (
      SELECT ref.content_id FROM public.character_content_refs AS ref WHERE ref.character_id = c.id UNION SELECT item.content_id FROM public.character_inventory AS item WHERE item.character_id = c.id UNION
      SELECT spell.content_id FROM public.character_spells AS spell WHERE spell.character_id = c.id UNION SELECT feature.feature_content_id FROM public.character_feature_grants AS feature WHERE feature.character_id = c.id UNION
      SELECT grant_row.spell_content_id FROM public.character_spell_grants AS grant_row WHERE grant_row.character_id = c.id) ORDER BY share.id FOR SHARE;
  END IF;
  PERFORM v.content_id FROM public.content_versions v WHERE (v.content_id,v.version) IN (
    SELECT ref.content_id,ref.content_version FROM public.character_content_refs AS ref WHERE ref.character_id = c.id UNION
    SELECT item.content_id,item.content_version FROM public.character_inventory AS item WHERE item.character_id = c.id AND item.content_id IS NOT NULL UNION
    SELECT spell.content_id,spell.content_version FROM public.character_spells AS spell WHERE spell.character_id = c.id AND spell.content_id IS NOT NULL UNION
    SELECT feature.feature_content_id,feature.feature_version FROM public.character_feature_grants AS feature WHERE feature.character_id = c.id UNION
    SELECT grant_row.spell_content_id,grant_row.spell_version FROM public.character_spell_grants AS grant_row WHERE grant_row.character_id = c.id) ORDER BY v.content_id,v.version FOR SHARE;
  -- Raw counts BEFORE version joins and before order projection. Never count
  -- just a successful inner join, drop a bad row or page a Data API response.
  SELECT pg_catalog.count(*) INTO n_pins FROM public.character_content_refs AS ref WHERE ref.character_id = c.id;
  SELECT pg_catalog.count(*) INTO n_inventory FROM public.character_inventory AS item WHERE item.character_id = c.id;
  SELECT pg_catalog.count(*) INTO n_spells FROM public.character_spells AS spell WHERE spell.character_id = c.id;
  SELECT pg_catalog.count(*) INTO n_features FROM public.character_feature_grants AS feature WHERE feature.character_id = c.id;
  SELECT pg_catalog.count(*) INTO n_spell_grants FROM public.character_spell_grants AS grant_row WHERE grant_row.character_id = c.id;
  IF EXISTS (SELECT 1 FROM public.character_spells AS custom_spell WHERE custom_spell.character_id = c.id
    AND custom_spell.content_id IS NULL AND custom_spell.content_version IS NOT NULL) THEN RETURN '{"status":"unready","reason":"invalid_graph"}'::jsonb; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',r.id,'character_id',r.character_id,'content_id',r.content_id,
    'content_version',r.content_version,'context',r.context,'choice_source',r.choice_source,'feature_grant_id',r.feature_grant_id,'resolved',private.hit_die_version_dto_v1(v)) ORDER BY ordered.position), '[]'::jsonb)
    INTO pins FROM pg_catalog.unnest(ordering.pins) WITH ORDINALITY ordered(id,position)
    LEFT JOIN public.character_content_refs r ON r.id = ordered.id AND r.character_id = c.id
    LEFT JOIN public.content_versions v ON v.content_id = r.content_id AND v.version = r.content_version;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',r.id,'character_id',r.character_id,'content_id',r.content_id,'content_version',r.content_version,
    'content_type',r.content_type,'equipped',r.equipped,'attuned',r.attuned,'quantity',r.quantity,'sort_order',r.sort_order,'custom_data',r.custom_data,'resolved',private.hit_die_version_dto_v1(v)) ORDER BY ordered.position), '[]'::jsonb)
    INTO inventory FROM pg_catalog.unnest(ordering.inventory) WITH ORDINALITY ordered(id,position)
    LEFT JOIN public.character_inventory r ON r.id = ordered.id AND r.character_id = c.id
    LEFT JOIN public.content_versions v ON v.content_id = r.content_id AND v.version = r.content_version;
  SELECT COALESCE(pg_catalog.jsonb_agg((pg_catalog.to_jsonb(r) || pg_catalog.jsonb_build_object('created_at',private.hit_die_native_v1(r.created_at),'resolved',private.hit_die_version_dto_v1(v))) ORDER BY ordered.position), '[]'::jsonb)
    INTO spells FROM pg_catalog.unnest(ordering.spells) WITH ORDINALITY ordered(id,position)
    LEFT JOIN public.character_spells r ON r.id = ordered.id AND r.character_id = c.id
    LEFT JOIN public.content_versions v ON v.content_id = r.content_id AND v.version = r.content_version;
  SELECT COALESCE(pg_catalog.jsonb_agg((pg_catalog.to_jsonb(r) || pg_catalog.jsonb_build_object('created_at',private.hit_die_native_v1(r.created_at))) ORDER BY ordered.position), '[]'::jsonb)
    INTO features FROM pg_catalog.unnest(ordering.feature_grants) WITH ORDINALITY ordered(id,position)
    LEFT JOIN public.character_feature_grants r ON r.id = ordered.id AND r.character_id = c.id;
  SELECT COALESCE(pg_catalog.jsonb_agg((pg_catalog.to_jsonb(r) || pg_catalog.jsonb_build_object('created_at',private.hit_die_native_v1(r.created_at))) ORDER BY ordered.position), '[]'::jsonb)
    INTO spell_grants FROM pg_catalog.unnest(ordering.spell_grants) WITH ORDINALITY ordered(id,position)
    LEFT JOIN public.character_spell_grants r ON r.id = ordered.id AND r.character_id = c.id;
  IF pg_catalog.cardinality(ordering.pins) <> n_pins OR pg_catalog.cardinality(ordering.inventory) <> n_inventory OR pg_catalog.cardinality(ordering.spells) <> n_spells
    OR pg_catalog.cardinality(ordering.feature_grants) <> n_features OR pg_catalog.cardinality(ordering.spell_grants) <> n_spell_grants
    OR NOT private.hit_die_order_matches_v1(ordering.pins,pins) OR NOT private.hit_die_order_matches_v1(ordering.inventory,inventory)
    OR NOT private.hit_die_order_matches_v1(ordering.spells,spells) OR NOT private.hit_die_order_matches_v1(ordering.feature_grants,features)
    OR NOT private.hit_die_order_matches_v1(ordering.spell_grants,spell_grants) THEN RETURN '{"status":"unready","reason":"incomplete_graph"}'::jsonb; END IF;
  WITH required AS (
    SELECT ref.content_id,ref.content_version FROM public.character_content_refs AS ref WHERE ref.character_id = c.id UNION
    SELECT item.content_id,item.content_version FROM public.character_inventory AS item WHERE item.character_id = c.id AND item.content_id IS NOT NULL UNION
    SELECT spell.content_id,spell.content_version FROM public.character_spells AS spell WHERE spell.character_id = c.id AND spell.content_id IS NOT NULL UNION
    SELECT feature.feature_content_id,feature.feature_version FROM public.character_feature_grants AS feature WHERE feature.character_id = c.id UNION
    SELECT grant_row.spell_content_id,grant_row.spell_version FROM public.character_spell_grants AS grant_row WHERE grant_row.character_id = c.id)
    SELECT pg_catalog.count(*), COALESCE(pg_catalog.jsonb_agg(private.hit_die_version_dto_v1(v) ORDER BY required.content_id,required.content_version), '[]'::jsonb),
      COALESCE(pg_catalog.jsonb_agg(CASE WHEN v.content_id IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object(
        'content_id',v.content_id,'content_version',v.version,'created_at',private.hit_die_native_v1(v.created_at)) END ORDER BY required.content_id,required.content_version), '[]'::jsonb)
    INTO n_versions, versions, version_times FROM required LEFT JOIN public.content_versions v ON v.content_id = required.content_id AND v.version = required.content_version;
  -- Version-time metadata has the same independently counted LEFT JOIN closure,
  -- including inactive grants. Never grant/ref creation or current catalog time.
  -- Immutability/materializer lineage and writer fences still require G2.
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(versions) AS version_entry(value) WHERE version_entry.value = 'null'::jsonb OR version_entry.value->>'system_id' IS DISTINCT FROM c.system_id::text)
    THEN RETURN '{"status":"unready","reason":"incomplete_graph"}'::jsonb; END IF;
  IF pg_catalog.jsonb_array_length(versions) <> n_versions OR pg_catalog.jsonb_array_length(version_times) <> n_versions
    OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(version_times) AS time_entry(value) WHERE time_entry.value = 'null'::jsonb)
    THEN RETURN '{"status":"unready","reason":"incomplete_graph"}'::jsonb; END IF;
  access_rows := pg_catalog.jsonb_build_array(p_verified_context - 'context_version' || '{"kind":"verified_session"}'::jsonb,
    pg_catalog.jsonb_build_object('kind','current_owner','character_id',c.id,'owner_id',c.user_id,'system_id',c.system_id,'campaign_id',c.campaign_id,'archived',c.archived));
  FOREACH domain IN ARRAY ARRAY['pin','inventory','spell','feature_grant','spell_grant'] LOOP
    rows := CASE domain WHEN 'pin' THEN pins WHEN 'inventory' THEN inventory WHEN 'spell' THEN spells WHEN 'feature_grant' THEN features ELSE spell_grants END;
    FOR entry IN SELECT row_entry.value FROM pg_catalog.jsonb_array_elements(rows) AS row_entry(value) LOOP
      selected_content_id := CASE domain WHEN 'feature_grant' THEN (entry->>'feature_content_id')::uuid WHEN 'spell_grant' THEN (entry->>'spell_content_id')::uuid ELSE (entry->>'content_id')::uuid END;
      selected_content_version := CASE domain WHEN 'feature_grant' THEN (entry->>'feature_version')::integer WHEN 'spell_grant' THEN (entry->>'spell_version')::integer ELSE (entry->>'content_version')::integer END;
      IF selected_content_id IS NOT NULL THEN access_rows := access_rows || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('kind','pinned_continuity','domain',domain,'row_id',entry->>'id','content_id',selected_content_id,'content_version',selected_content_version)); END IF;
    END LOOP;
  END LOOP;
  IF c.campaign_id IS NOT NULL THEN
    access_rows := access_rows || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('kind','campaign','id',campaign_row.id,'system_id',campaign_row.system_id,'owner_id',campaign_row.owner_id,'hp_rule',campaign_row.hp_rule));
    SELECT COALESCE(pg_catalog.jsonb_agg(selected.value ORDER BY selected.kind,selected.id), '[]'::jsonb) INTO metadata FROM (
      SELECT 'campaign_member' kind,m.id,pg_catalog.jsonb_build_object('kind','campaign_member','id',m.id,'campaign_id',m.campaign_id,'user_id',m.user_id,'role',m.role) value
        FROM public.campaign_members m WHERE m.campaign_id = c.campaign_id AND m.user_id = c.user_id UNION ALL
      SELECT 'content_share',s.id,pg_catalog.jsonb_build_object('kind','content_share','id',s.id,'content_id',s.content_id,'campaign_id',s.campaign_id,'shared_by',s.shared_by)
        FROM public.content_shares s WHERE s.campaign_id = c.campaign_id AND s.content_id IN (
          SELECT ref.content_id FROM public.character_content_refs AS ref WHERE ref.character_id = c.id UNION SELECT item.content_id FROM public.character_inventory AS item WHERE item.character_id = c.id UNION
          SELECT spell.content_id FROM public.character_spells AS spell WHERE spell.character_id = c.id UNION SELECT feature.feature_content_id FROM public.character_feature_grants AS feature WHERE feature.character_id = c.id UNION
          SELECT grant_row.spell_content_id FROM public.character_spell_grants AS grant_row WHERE grant_row.character_id = c.id)) selected;
    access_rows := access_rows || metadata;
  END IF;
  snapshot := pg_catalog.jsonb_build_object('contract_version',1,'character',pg_catalog.jsonb_build_object('id',c.id,'owner_id',c.user_id,'system_id',c.system_id,'campaign_id',c.campaign_id,
    'archived',c.archived,'revision',c.action_revision::text,'level',c.level,'base_stats',c.base_stats,'choices',c.choices,'state',c.state),
    'system',pg_catalog.jsonb_build_object('id',system_row.id,'slug',system_row.slug,'schema_definition',system_row.schema_definition,'expression_context',system_row.expression_context),
    'campaign',CASE WHEN c.campaign_id IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object('id',campaign_row.id,'hp_rule',campaign_row.hp_rule) END,
    'pins',pins,'inventory',inventory,'spells',spells,'feature_grants',features,'spell_grants',spell_grants,'access_rows',access_rows);
  counts := pg_catalog.jsonb_build_object('pins',n_pins::text,'inventory',n_inventory::text,'spells',n_spells::text,'feature_grants',n_features::text,'spell_grants',n_spell_grants::text,'resolved_versions',n_versions::text,'access_rows',pg_catalog.jsonb_array_length(access_rows)::text);
  native_clock := pg_catalog.clock_timestamp();
  IF native_clock >= (p_verified_context->>'jwt_expires_at')::timestamptz THEN RETURN '{"status":"inaccessible"}'::jsonb; END IF;
  PERFORM private.hit_die_deadline_v1(c.state,native_clock); -- rejects unsupported stored expiry profile, never rounds it
  -- Structural v2 is consumed by real JS ASI/spell validators. SQL does not
  -- claim their acceptance or historical catalog/access winner reconstruction.
  RETURN pg_catalog.jsonb_build_object('status','complete','graph_version',2,'readiness',pg_catalog.jsonb_build_object('protocol_version',1,'writers_complete',true,'auth_complete',true,'order_complete',true),
    'counts',counts,'order',pg_catalog.jsonb_build_object('producer_version',1,'character_id',c.id,'producer_revision',ordering.producer_revision::text,
      'pins',ordering.pins,'inventory',ordering.inventory,'spells',ordering.spells,'feature_grants',ordering.feature_grants,'spell_grants',ordering.spell_grants),'versions',versions,'version_times',version_times,'snapshot',snapshot);
EXCEPTION WHEN invalid_text_representation OR invalid_parameter_value OR numeric_value_out_of_range THEN RETURN '{"status":"unready","reason":"invalid_graph"}'::jsonb;
END $$;

CREATE FUNCTION public.read_hit_die_graph_v1(p_verified_context jsonb,p_character_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE message text; graph jsonb;
BEGIN
  IF p_character_id IS NULL OR NOT private.hit_die_context_shape_v1(p_verified_context) THEN RETURN '{"status":"unready","reason":"invalid_graph"}'::jsonb; END IF;
  BEGIN PERFORM private.require_verified_hit_die_auth_v1(p_verified_context);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN GET STACKED DIAGNOSTICS message = MESSAGE_TEXT;
    IF message = 'auth_unavailable' THEN RETURN '{"status":"unready","reason":"auth_unavailable"}'::jsonb; ELSE RAISE; END IF;
  END;
  PERFORM private.lock_character_writer_guard_v1();
  graph := private.read_locked_hit_die_graph_v1(p_character_id,p_verified_context);
  IF graph->>'status' = 'complete' AND graph->'graph_version' IS DISTINCT FROM '2'::jsonb
    THEN RETURN '{"status":"unready","reason":"schema_unready"}'::jsonb; END IF;
  RETURN graph;
END $$;

CREATE FUNCTION private.read_locked_hit_die_dependencies_v2(p_verified_context jsonb,p_character_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE graph jsonb;
BEGIN
  -- Signature evolution is explicit: no sessionless legacy reader can call the
  -- new authoritative projection. The verified-context command is a later child.
  graph := public.read_hit_die_graph_v1(p_verified_context,p_character_id);
  IF graph->>'status' IS DISTINCT FROM 'complete' OR graph->'graph_version' IS DISTINCT FROM '2'::jsonb
    THEN RAISE EXCEPTION 'Verified dependency graph unavailable' USING ERRCODE = 'P0001'; END IF;
  RETURN graph->'snapshot';
END $$;

CREATE FUNCTION private.hit_die_character_revision_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (NEW.state,NEW.base_stats,NEW.choices,NEW.level,NEW.system_id,NEW.campaign_id,NEW.archived,NEW.user_id)
    IS DISTINCT FROM (OLD.state,OLD.base_stats,OLD.choices,OLD.level,OLD.system_id,OLD.campaign_id,OLD.archived,OLD.user_id) THEN
    IF OLD.action_revision = 9223372036854775807 THEN RAISE EXCEPTION 'Revision exhausted' USING ERRCODE = '22003'; END IF;
    NEW.action_revision := OLD.action_revision + 1;
  ELSE
    IF NEW.action_revision IS DISTINCT FROM OLD.action_revision THEN RAISE EXCEPTION 'Revision is database controlled' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hit_die_character_revision BEFORE UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION private.hit_die_character_revision_v1();
CREATE FUNCTION private.hit_die_order_revision_rebind_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.action_revision IS DISTINCT FROM OLD.action_revision THEN
    UPDATE private.character_projection_order_v1 AS order_row SET producer_revision = NEW.action_revision WHERE order_row.character_id = NEW.id;
  END IF;
  -- No domain array UPDATE, order synthesis or legacy row INSERT.
  RETURN NEW;
END $$;
CREATE TRIGGER hit_die_order_revision_rebind AFTER UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION private.hit_die_order_revision_rebind_v1();

CREATE FUNCTION public.patch_character_state_at_revision_v1(p_verified_context jsonb,p_character_id uuid,p_expected_revision text,p_patch jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.characters%ROWTYPE; expected bigint; next_state jsonb; graph jsonb; message text; ordering private.character_projection_order_v1%ROWTYPE;
BEGIN
  IF p_character_id IS NULL OR NOT private.hit_die_context_shape_v1(p_verified_context)
    OR p_expected_revision IS NULL OR p_expected_revision !~ '^(0|[1-9][0-9]{0,18})$'
    OR NOT private.hit_die_exact_keys_v1(p_patch,ARRAY['inspiration']) OR pg_catalog.jsonb_typeof(p_patch->'inspiration') IS DISTINCT FROM 'boolean' THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
  BEGIN expected := p_expected_revision::bigint;
  EXCEPTION WHEN numeric_value_out_of_range THEN RETURN '{"status":"invalid"}'::jsonb; END;
  BEGIN PERFORM private.require_verified_hit_die_auth_v1(p_verified_context);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN GET STACKED DIAGNOSTICS message = MESSAGE_TEXT;
    IF message = 'auth_unavailable' THEN RETURN '{"status":"unready","reason":"auth_unavailable"}'::jsonb; ELSE RAISE; END IF;
  END;
  PERFORM private.lock_character_writer_guard_v1();
  graph := private.read_locked_hit_die_graph_v1(p_character_id,p_verified_context);
  IF graph->>'status' <> 'complete' THEN RETURN graph; END IF;
  IF graph->'graph_version' IS DISTINCT FROM '2'::jsonb THEN RETURN '{"status":"unready","reason":"schema_unready"}'::jsonb; END IF;
  SELECT target.* INTO c FROM public.characters AS target WHERE target.id = p_character_id AND target.user_id = (p_verified_context->>'actor_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"status":"inaccessible"}'::jsonb; END IF;
  IF pg_catalog.clock_timestamp() >= (p_verified_context->>'jwt_expires_at')::timestamptz THEN RETURN '{"status":"inaccessible"}'::jsonb; END IF;
  IF c.action_revision <> expected THEN RETURN pg_catalog.jsonb_build_object('status','conflict','character_id',c.id,'state',c.state,'revision',c.action_revision::text); END IF;
  IF c.action_revision = 9223372036854775807 OR pg_catalog.jsonb_typeof(c.state) <> 'object' THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
  next_state := c.state || p_patch;
  IF next_state = c.state THEN RETURN pg_catalog.jsonb_build_object('status','unchanged','character_id',c.id,'state',c.state,'revision',c.action_revision::text); END IF;
  -- Native JWT acceptance check immediately before the only UPDATE. Auth seam
  -- later rechecks actual session/config after waits; no guessed auth SQL here.
  IF pg_catalog.clock_timestamp() >= (p_verified_context->>'jwt_expires_at')::timestamptz THEN RETURN '{"status":"inaccessible"}'::jsonb; END IF;
  UPDATE public.characters AS target SET state = next_state WHERE target.id = c.id RETURNING target.* INTO c;
  -- Character trigger advances once; same-transaction AFTER trigger rebinds
  -- producer_revision ONLY, keeping every semantic ID array unchanged.
  SELECT order_row.* INTO ordering FROM private.character_projection_order_v1 AS order_row WHERE order_row.character_id = c.id;
  IF NOT FOUND OR ordering.producer_revision <> c.action_revision OR c.action_revision <> expected + 1 THEN
    RAISE EXCEPTION 'Atomic order/revision rebinding failed' USING ERRCODE = '23514'; END IF;
  RETURN pg_catalog.jsonb_build_object('status','applied','character_id',c.id,'state',c.state,'revision',c.action_revision::text);
  -- No post-write exception handler: any trigger/confirmation fault rolls back.
END $$;

-- No sessionless v1 execution remains once this source stage is applied.
-- Source-only kernel legacy text remains preserved; existing application had no
-- imports/routes for it. A future verified-context receipt endpoint is required.
REVOKE ALL ON FUNCTION public.read_hit_die_receipt_v1(uuid,jsonb,text), public.resolve_hit_die_snapshot_v1(uuid,uuid),
  public.commit_hit_die_v1(uuid,jsonb,jsonb,jsonb,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION private.require_verified_hit_die_auth_v1(jsonb) OWNER TO inkborne_hit_die_authority_owner;
ALTER FUNCTION private.hit_die_context_shape_v1(jsonb) OWNER TO inkborne_hit_die_authority_owner;
ALTER FUNCTION private.lock_character_writer_guard_v1() OWNER TO inkborne_hit_die_authority_owner;
ALTER FUNCTION private.hit_die_writers_ready_v1() OWNER TO inkborne_hit_die_authority_owner;
ALTER FUNCTION private.hit_die_order_matches_v1(uuid[],jsonb) OWNER TO inkborne_hit_die_authority_owner;
ALTER FUNCTION private.hit_die_version_dto_v1(public.content_versions) OWNER TO inkborne_hit_die_authority_owner;
ALTER FUNCTION private.read_locked_hit_die_graph_v1(uuid,jsonb) OWNER TO inkborne_hit_die_authority_owner;
ALTER FUNCTION private.read_locked_hit_die_dependencies_v2(jsonb,uuid) OWNER TO inkborne_hit_die_authority_owner;
ALTER FUNCTION private.hit_die_character_revision_v1() OWNER TO inkborne_hit_die_authority_owner;
ALTER FUNCTION private.hit_die_order_revision_rebind_v1() OWNER TO inkborne_hit_die_authority_owner;
ALTER FUNCTION public.read_hit_die_graph_v1(jsonb,uuid) OWNER TO inkborne_hit_die_authority_owner;
ALTER FUNCTION public.patch_character_state_at_revision_v1(jsonb,uuid,text,jsonb) OWNER TO inkborne_hit_die_authority_owner;
REVOKE ALL ON FUNCTION private.require_verified_hit_die_auth_v1(jsonb),private.hit_die_context_shape_v1(jsonb),private.lock_character_writer_guard_v1(),
  private.hit_die_writers_ready_v1(),private.hit_die_order_matches_v1(uuid[],jsonb),private.hit_die_version_dto_v1(public.content_versions),
  private.read_locked_hit_die_graph_v1(uuid,jsonb),private.read_locked_hit_die_dependencies_v2(jsonb,uuid),private.hit_die_character_revision_v1(),private.hit_die_order_revision_rebind_v1()
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.read_hit_die_graph_v1(jsonb,uuid), public.patch_character_state_at_revision_v1(jsonb,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.read_hit_die_graph_v1(jsonb,uuid), public.patch_character_state_at_revision_v1(jsonb,uuid,text,jsonb) TO service_role;
-- FINAL CUTOVER MANIFEST (not an applied/implemented cutover):
-- auth: require_verified_hit_die_auth_v1; exact Auth/config/RI-prefix G2 proof.
-- order: approved new-producer/consumer order rows; no legacy backfill.
-- state: inspiration adapter is the ONLY implemented key; HP/rest/maps pending.
-- character_choices: save_character_abilities/set_character_asi_choice/
--   set_character_background and class/race/level builders need versioned adapters.
-- refs/feature_grants/spell_grants: materializers/pruners/sync RPCs need parent-
--   first guard protocol and all child DML direct privileges removed.
-- inventory/spells: all add/equip/prepare/remove/custom/currency paths pending.
-- shared_rules_access/version_identity: campaign/member/share/system/catalog/
--   import/version DELETE and provider cascades need exact fenced adapters.
-- copy_award: preserve latest copy/starting-equipment/provenance; revision/guard.
-- lifecycle: actual Auth/RI/profile/Storage/product-policy proof; NO new trigger.
-- Before ready, remove TABLE-LEVEL mechanical UPDATE/child DML from caller roles
--   then regrant only reviewed independent columns; revoke/replace EVERY old
--   definer mechanical signature, not just an individual column grant.
-- No statement-role guard activation, readiness marking or broad revocation is
--   supplied. Every required family is FALSE; metadata cannot activate Auth seam.
COMMIT;
