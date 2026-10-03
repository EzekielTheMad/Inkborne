-- Project default privileges added service_role execute to the new function.
-- Narrow this endpoint to the approved authenticated-only caller scope.
REVOKE ALL ON FUNCTION public.patch_character_state_if_current(uuid, jsonb, jsonb) FROM service_role;
