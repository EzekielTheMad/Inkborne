-- Keep campaign page content valid for TipTap. The original table and RPC
-- used `{}` as their empty value, which is not a document node and produces
-- editor warnings before a page has been saved for the first time.

ALTER TABLE public.campaign_pages
  ALTER COLUMN content SET DEFAULT '{"type":"doc","content":[]}'::jsonb;

UPDATE public.campaign_pages
SET content = '{"type":"doc","content":[]}'::jsonb
WHERE jsonb_typeof(content) IS DISTINCT FROM 'object'
   OR content->>'type' IS DISTINCT FROM 'doc'
   OR jsonb_typeof(content->'content') IS DISTINCT FROM 'array';

ALTER TABLE public.campaign_pages
  ADD CONSTRAINT campaign_pages_content_document
  CHECK (
    jsonb_typeof(content) = 'object'
    AND content->>'type' = 'doc'
    AND jsonb_typeof(content->'content') = 'array'
  ) NOT VALID;

ALTER TABLE public.campaign_pages
  VALIDATE CONSTRAINT campaign_pages_content_document;

CREATE OR REPLACE FUNCTION public.update_campaign_page(
  target_page_id uuid,
  expected_revision bigint,
  page_title text,
  page_content jsonb,
  page_visibility text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  existing_page public.campaign_pages%ROWTYPE;
  next_revision bigint;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT page.*
  INTO existing_page
  FROM public.campaign_pages AS page
  WHERE page.id = target_page_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign page not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    private.is_campaign_owner(existing_page.campaign_id)
    OR existing_page.created_by = actor_id
  ) THEN
    RAISE EXCEPTION 'Not authorized to edit this page' USING ERRCODE = '42501';
  END IF;

  page_title := btrim(page_title);
  IF char_length(page_title) < 1 OR char_length(page_title) > 200 THEN
    RAISE EXCEPTION 'Page title must be between 1 and 200 characters'
      USING ERRCODE = '22023';
  END IF;

  IF page_visibility NOT IN ('campaign', 'dm_only') THEN
    RAISE EXCEPTION 'Invalid page visibility' USING ERRCODE = '22023';
  END IF;

  UPDATE public.campaign_pages
  SET title = page_title,
      content = COALESCE(
        page_content,
        '{"type":"doc","content":[]}'::jsonb
      ),
      visibility = page_visibility
  WHERE id = target_page_id
    AND revision = expected_revision
  RETURNING revision INTO next_revision;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign page changed since it was opened'
      USING ERRCODE = '40001';
  END IF;

  RETURN next_revision;
END;
$$;

REVOKE ALL ON FUNCTION public.update_campaign_page(uuid, bigint, text, jsonb, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_campaign_page(uuid, bigint, text, jsonb, text)
  TO authenticated;
