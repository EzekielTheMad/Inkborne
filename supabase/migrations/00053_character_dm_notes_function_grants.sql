-- Migration 00052 revoked the private RLS helpers from PUBLIC but omitted the
-- explicit authenticated grant. Without it, policies fail closed before they
-- can evaluate ownership or campaign-DM access.

GRANT EXECUTE ON FUNCTION private.is_character_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_character_dm_notes(uuid) TO authenticated;
