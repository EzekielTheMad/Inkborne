BEGIN;
DO $seed$
DECLARE r jsonb := current_setting('inkborne.r07.roots')::jsonb; tag text := current_setting('inkborne.r07.run'); definition jsonb;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Seed actor mismatch'; END IF;
  -- No password, session, identity, email delivery or real account. Real signup-profile trigger is exercised.
  INSERT INTO auth.users(id,aud,role,email,raw_user_meta_data) VALUES
    ((r->>'owner')::uuid,'authenticated','authenticated',tag||'-owner@example.invalid',jsonb_build_object('name',tag||'-owner')),
    ((r->>'foreign')::uuid,'authenticated','authenticated',tag||'-foreign@example.invalid',jsonb_build_object('name',tag||'-foreign'));
  IF (SELECT count(*) FROM public.profiles WHERE id IN ((r->>'owner')::uuid,(r->>'foreign')::uuid)) <> 2 THEN RAISE EXCEPTION 'Real profile trigger failed'; END IF;
  INSERT INTO public.game_systems(id,slug,name,status,schema_definition) VALUES ((r->>'system')::uuid,tag,tag,'published',current_setting('inkborne.r07.system_schema')::jsonb);
  FOR definition IN SELECT value FROM jsonb_array_elements(current_setting('inkborne.r07.definitions')::jsonb) LOOP
    INSERT INTO public.content_definitions(id,system_id,content_type,slug,name,data,effects,source,scope,owner_id)
    VALUES ((definition->>'id')::uuid,(definition->>'system_id')::uuid,definition->>'content_type',definition->>'slug',definition->>'name',definition->'data',definition->'effects',definition->>'source',definition->>'scope',(definition->>'owner_id')::uuid);
  END LOOP;
  INSERT INTO public.characters(id,user_id,system_id,name) VALUES ((r->>'foreignCharacter')::uuid,(r->>'foreign')::uuid,(r->>'system')::uuid,tag||'-foreign-character');
END $seed$;
COMMIT;
