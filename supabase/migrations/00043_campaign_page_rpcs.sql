-- Narrow mutation APIs for campaign pages. These functions derive authorship
-- from auth.uid() and make page updates revision-aware so simultaneous editors
-- cannot silently overwrite one another.

CREATE OR REPLACE FUNCTION public.create_campaign_page(
  target_campaign_id uuid,
  page_title text,
  page_visibility text DEFAULT 'campaign',
  parent_page_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  page_id uuid;
  base_slug text;
  generated_slug text;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT private.can_access_campaign(target_campaign_id) THEN
    RAISE EXCEPTION 'Campaign not found or unavailable' USING ERRCODE = '42501';
  END IF;

  page_title := btrim(page_title);
  IF char_length(page_title) < 1 OR char_length(page_title) > 200 THEN
    RAISE EXCEPTION 'Page title must be between 1 and 200 characters'
      USING ERRCODE = '22023';
  END IF;

  IF page_visibility NOT IN ('campaign', 'dm_only') THEN
    RAISE EXCEPTION 'Invalid page visibility' USING ERRCODE = '22023';
  END IF;

  base_slug := trim(BOTH '-' FROM regexp_replace(lower(page_title), '[^a-z0-9]+', '-', 'g'));
  IF base_slug = '' THEN
    base_slug := 'page';
  END IF;
  generated_slug := left(base_slug, 180) || '-' || left(gen_random_uuid()::text, 8);

  INSERT INTO public.campaign_pages (
    campaign_id,
    parent_id,
    created_by,
    updated_by,
    title,
    slug,
    visibility
  )
  VALUES (
    target_campaign_id,
    parent_page_id,
    actor_id,
    actor_id,
    page_title,
    generated_slug,
    page_visibility
  )
  RETURNING id INTO page_id;

  RETURN page_id;
END;
$$;

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
      content = COALESCE(page_content, '{}'::jsonb),
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

REVOKE ALL ON FUNCTION public.create_campaign_page(uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_campaign_page(uuid, bigint, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_campaign_page(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_campaign_page(uuid, bigint, text, jsonb, text) TO authenticated;
