-- Frozen graph assertion shared by readback and cleanup; no DDL.
DO $ownership$
DECLARE owned jsonb := current_setting('inkborne.r07.readback')::jsonb->'ids'; entry record; all_ids uuid[]; expected uuid[]; extra bigint; relation text; key_column text;
BEGIN
  SELECT array_agg(DISTINCT candidate.id::uuid) INTO all_ids FROM jsonb_each(owned) e CROSS JOIN LATERAL jsonb_array_elements_text(e.value) AS candidate(id);
  -- Enumerate every actual UUID FK edge, including composite constraints and unknown child tables.
  FOR entry IN SELECT DISTINCT ns.nspname AS schema_name,c.relname AS table_name,a.attname AS column_name
    FROM pg_catalog.pg_constraint f JOIN pg_catalog.pg_class c ON c.oid=f.conrelid JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
    CROSS JOIN LATERAL unnest(f.conkey) k(attnum) JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.attnum
    WHERE f.contype='f' AND a.atttypid='uuid'::regtype AND ns.nspname IN ('public','private','auth','storage') LOOP
    relation := entry.schema_name||'.'||entry.table_name;
    SELECT array_agg(value::uuid) INTO expected FROM jsonb_array_elements_text(COALESCE(owned->relation,'[]'));
    SELECT a.attname INTO key_column FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=entry.schema_name AND c.relname=entry.table_name AND a.attname='id' AND a.atttypid='uuid'::regtype AND NOT a.attisdropped;
    IF key_column IS NULL OR expected IS NULL THEN
      EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I=ANY($1)',entry.schema_name,entry.table_name,entry.column_name) INTO extra USING all_ids;
    ELSE
      EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I=ANY($1) AND NOT (id=ANY($2))',entry.schema_name,entry.table_name,entry.column_name) INTO extra USING all_ids,expected;
    END IF;
    IF extra<>0 THEN RAISE EXCEPTION 'Closed fixture ownership graph violated'; END IF;
    IF key_column IS NOT NULL AND expected IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM %I.%I WHERE id=ANY($1) AND %I IS NOT NULL AND NOT (%I=ANY($2))',entry.schema_name,entry.table_name,entry.column_name,entry.column_name) INTO extra USING expected,all_ids;
      IF extra<>0 THEN RAISE EXCEPTION 'Foreign parent outside closed fixture ownership graph'; END IF;
    END IF;
  END LOOP;
END $ownership$;
