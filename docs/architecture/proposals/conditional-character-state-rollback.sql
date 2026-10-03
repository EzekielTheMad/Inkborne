-- Manual rollback only, after reverting local conditional client activation.
-- Drops only the newly approved function; no existing RPC/table/policy changes.
DROP FUNCTION public.patch_character_state_if_current(uuid, jsonb, jsonb);
