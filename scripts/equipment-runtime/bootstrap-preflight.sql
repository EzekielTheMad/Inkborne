-- R07.1: read-only checks of the real official bootstrap, before application replay.
-- No surrogate roles/tables/functions, fixtures, grants or migration ledger writes.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
DO $check$
DECLARE role_name text; required_column text;
BEGIN
  IF current_database() <> 'postgres' OR current_user <> 'postgres' THEN
    RAISE EXCEPTION 'R07.1 database/actor mismatch';
  END IF;
  IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999 THEN
    RAISE EXCEPTION 'R07.1 requires PostgreSQL 17';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['postgres','anon','authenticated','service_role','supabase_auth_admin','supabase_storage_admin'] LOOP
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      RAISE EXCEPTION 'R07.1 required role absent';
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role' AND rolbypassrls AND NOT rolsuper)
     OR EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls OR rolcanlogin)) THEN
    RAISE EXCEPTION 'R07.1 API role attributes mismatch';
  END IF;
  IF pg_catalog.to_regclass('auth.users') IS NULL
     OR pg_catalog.to_regclass('auth.schema_migrations') IS NULL
     OR pg_catalog.to_regclass('storage.objects') IS NULL
     OR pg_catalog.to_regclass('storage.buckets') IS NULL
     OR pg_catalog.to_regclass('storage.migrations') IS NULL
     OR pg_catalog.to_regprocedure('auth.uid()') IS NULL
     OR pg_catalog.to_regprocedure('auth.jwt()') IS NULL
     OR pg_catalog.to_regprocedure('storage.foldername(text)') IS NULL THEN
    RAISE EXCEPTION 'R07.1 real Auth/Storage bootstrap incomplete';
  END IF;
  FOREACH required_column IN ARRAY ARRAY['id','raw_app_meta_data','raw_user_meta_data','email'] LOOP
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = required_column) THEN
      RAISE EXCEPTION 'R07.1 Auth user columns incomplete';
    END IF;
  END LOOP;
  IF EXISTS (SELECT FROM auth.users) OR EXISTS (SELECT FROM storage.objects)
     OR NOT EXISTS (SELECT FROM auth.schema_migrations) OR NOT EXISTS (SELECT FROM storage.migrations) THEN
    RAISE EXCEPTION 'R07.1 nonempty fixtures or missing official migration history';
  END IF;
  IF pg_catalog.to_regclass('public.profiles') IS NOT NULL
     OR pg_catalog.to_regclass('public.characters') IS NOT NULL
     OR pg_catalog.to_regclass('public.content_definitions') IS NOT NULL
     OR pg_catalog.to_regclass('public.character_starting_grants') IS NOT NULL THEN
    RAISE EXCEPTION 'R07.1 requires a fresh application database; no resume/reset';
  END IF;
END
$check$;
COMMIT;
