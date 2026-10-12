BEGIN;
DO $roles$
DECLARE r jsonb := current_setting('inkborne.r07.roots')::jsonb; evidence jsonb := current_setting('inkborne.r07.state')::jsonb; owned jsonb := evidence->'ids';
  source_id uuid := (evidence->>'source')::uuid; copy_id uuid := (evidence->>'copy')::uuid; grant_id uuid := (evidence->'receipt'->>'grant_id')::uuid; item_id uuid := (evidence->'receipt'->'inventory_ids'->>0)::uuid;
  entry record; actor uuid; role_name text; statement text; expected_code text; actual_code text; affected bigint;
  before_rows jsonb := '{}'; after_rows jsonb := '{}'; rows jsonb; tracked_ids uuid[]; fixture_table text; api text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Role harness actor mismatch'; END IF;
  FOR entry IN SELECT key,value FROM jsonb_each(owned) LOOP
    SELECT array_agg(value::uuid) INTO tracked_ids FROM jsonb_array_elements_text(entry.value);
    EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id),''[]''::jsonb) FROM %I.%I t WHERE id=ANY($1)',split_part(entry.key,'.',1),split_part(entry.key,'.',2)) INTO rows USING tracked_ids;
    before_rows := before_rows || jsonb_build_object(entry.key,rows);
  END LOOP;
  FOREACH role_name IN ARRAY ARRAY['authenticated','anon'] LOOP
    actor := CASE WHEN role_name='authenticated' THEN (r->>'owner')::uuid ELSE NULL END;
    EXECUTE format('SET LOCAL ROLE %I',role_name);
    PERFORM set_config('request.jwt.claim.sub',COALESCE(actor::text,''),true);
    PERFORM set_config('request.jwt.claims',CASE WHEN actor IS NULL THEN '{}' ELSE jsonb_build_object('sub',actor,'role',role_name)::text END,true);
    IF current_user IS DISTINCT FROM role_name OR auth.uid() IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Actual role/claim mismatch'; END IF;
    FOREACH api IN ARRAY ARRAY['create','resolve','commit'] LOOP
      statement := CASE api WHEN 'create' THEN format('SELECT public.create_character_with_starting_grant(%L::uuid,%L,%L::uuid)',r->>'owner','R07 denied creation',r->>'system')
        WHEN 'resolve' THEN format('SELECT public.resolve_starting_equipment(%L::uuid,%L::uuid,''{}''::jsonb)',r->>'owner',source_id)
        ELSE format('SELECT public.commit_starting_equipment(%L::uuid,%L::uuid,''{}''::jsonb,''[]''::jsonb,''{}''::jsonb)',r->>'owner',source_id) END;
      actual_code := NULL;
      BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual_code=RETURNED_SQLSTATE; END;
      IF actual_code IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'API trusted execute denial SQLSTATE mismatch'; END IF;
    END LOOP;
    FOREACH statement IN ARRAY ARRAY[
      format('INSERT INTO public.character_starting_grants(character_id,status) VALUES (%L::uuid,''eligible'')',source_id),
      format('UPDATE public.character_starting_grants SET status=''eligible'' WHERE id=%L::uuid',grant_id),
      format('DELETE FROM public.character_starting_grants WHERE id=%L::uuid',grant_id)
    ] LOOP
      actual_code := NULL;
      BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual_code=RETURNED_SQLSTATE; END;
      IF actual_code IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'Direct marker DML denial SQLSTATE mismatch'; END IF;
    END LOOP;
    IF role_name='anon' THEN
      actual_code := NULL;
      BEGIN PERFORM 1 FROM public.character_starting_grants WHERE id=grant_id; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual_code=RETURNED_SQLSTATE; END;
      IF actual_code IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'Anonymous receipt read denial mismatch'; END IF;
      actual_code := NULL;
      BEGIN UPDATE public.character_inventory SET quantity=99 WHERE id=item_id; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual_code=RETURNED_SQLSTATE; END;
      IF actual_code IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'Anonymous inventory DML denial mismatch'; END IF;
    ELSE
      IF (SELECT count(*) FROM public.character_starting_grants WHERE character_id=source_id) <> 1 THEN RAISE EXCEPTION 'Owner receipt read failed'; END IF;
      FOR entry IN SELECT * FROM (VALUES
        (format('INSERT INTO public.character_inventory(character_id,content_id,content_version,name,content_type,quantity,starting_grant_id) VALUES (%L::uuid,%L::uuid,1,''R07 synthetic provisions'',''item'',1,%L::uuid)',source_id,r->>'item',grant_id),'42501'),
        (format('UPDATE public.character_inventory SET starting_grant_id=NULL WHERE id=%L::uuid',item_id),'23514'),
        (format('UPDATE public.character_inventory SET character_id=%L::uuid WHERE id=%L::uuid',copy_id,item_id),'23514')
      ) AS cases(sql,code) LOOP
        actual_code := NULL; statement := entry.sql; expected_code := entry.code;
        BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual_code=RETURNED_SQLSTATE; END;
        IF actual_code IS DISTINCT FROM expected_code THEN RAISE EXCEPTION 'Provenance denial SQLSTATE mismatch'; END IF;
      END LOOP;
    END IF;
    EXECUTE 'RESET ROLE';
  END LOOP;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub',r->>'foreign',true); PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',r->>'foreign','role','authenticated')::text,true);
  IF current_user <> 'authenticated' OR auth.uid() IS DISTINCT FROM (r->>'foreign')::uuid THEN RAISE EXCEPTION 'Foreign claims mismatch'; END IF;
  IF (SELECT count(*) FROM public.characters WHERE id=source_id) <> 0 OR (SELECT count(*) FROM public.character_starting_grants WHERE id=grant_id) <> 0 OR (SELECT count(*) FROM public.character_inventory WHERE id=item_id) <> 0 THEN RAISE EXCEPTION 'Foreign rows leaked'; END IF;
  UPDATE public.character_inventory SET quantity=99 WHERE id=item_id; GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'Foreign inventory RLS write was not zero-row'; END IF;
  UPDATE public.characters SET state='{}' WHERE id=source_id; GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'Foreign character RLS write was not zero-row'; END IF;
  actual_code := NULL;
  BEGIN PERFORM public.copy_character(source_id,NULL,'R07 foreign denied'); EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual_code=RETURNED_SQLSTATE; END;
  IF actual_code IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'Foreign copy denial SQLSTATE mismatch'; END IF;
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','{}',true);
  IF current_user <> 'service_role' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Trusted denial role/claims mismatch'; END IF;
  actual_code := NULL;
  BEGIN UPDATE public.character_starting_grants SET receipt='{}' WHERE id=grant_id; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual_code=RETURNED_SQLSTATE; END;
  IF actual_code IS DISTINCT FROM '23514' THEN RAISE EXCEPTION 'Completed receipt immutability SQLSTATE mismatch'; END IF;
  actual_code := NULL;
  BEGIN PERFORM public.resolve_starting_equipment((r->>'foreign')::uuid,source_id,current_setting('inkborne.r07.intent')::jsonb-'plan'); EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual_code=RETURNED_SQLSTATE; END;
  IF actual_code IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'Trusted foreign actor denial SQLSTATE mismatch'; END IF;
  IF public.resolve_starting_equipment((r->>'owner')::uuid,copy_id,current_setting('inkborne.r07.intent')::jsonb-'plan') IS DISTINCT FROM '{"status":"already_completed"}'::jsonb THEN RAISE EXCEPTION 'Inherited copy reaward not denied'; END IF;
  RESET ROLE;
  FOR entry IN SELECT key,value FROM jsonb_each(owned) LOOP
    SELECT array_agg(value::uuid) INTO tracked_ids FROM jsonb_array_elements_text(entry.value);
    EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id),''[]''::jsonb) FROM %I.%I t WHERE id=ANY($1)',split_part(entry.key,'.',1),split_part(entry.key,'.',2)) INTO rows USING tracked_ids;
    after_rows := after_rows || jsonb_build_object(entry.key,rows);
  END LOOP;
  IF before_rows IS DISTINCT FROM after_rows THEN RAISE EXCEPTION 'Denied operations changed marker/receipt/provenance/quantity/unrelated state'; END IF;
END $roles$;
COMMIT;
