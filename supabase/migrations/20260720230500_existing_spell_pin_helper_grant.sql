-- RLS policy expressions execute with the caller's function privileges. The
-- helper remains in the non-exposed private schema and performs its own exact
-- owner/pin checks, but authenticated needs this signature-level EXECUTE grant
-- for the policy to evaluate.

GRANT EXECUTE ON FUNCTION private.can_update_existing_character_spell_pin(
  uuid, uuid, uuid, integer
) TO authenticated;
