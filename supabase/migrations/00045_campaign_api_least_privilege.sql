-- Correct legacy Supabase default privileges discovered during production
-- verification. Every exposed campaign RPC authenticates internally, but the
-- anon role should not be able to invoke privileged functions at all.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

REVOKE ALL ON public.campaign_pages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.campaign_pages TO authenticated;

REVOKE ALL ON FUNCTION public.join_campaign_by_invite_code(text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rotate_campaign_invite_code(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.copy_character(uuid, uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_campaign_page(uuid, text, text, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_campaign_page(uuid, bigint, text, jsonb, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_campaign(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_campaign_member(uuid, uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.join_campaign_by_invite_code(text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_campaign_invite_code(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.copy_character(uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_campaign_page(uuid, text, text, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_campaign_page(uuid, bigint, text, jsonb, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_campaign(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_campaign_member(uuid, uuid)
  TO authenticated;
