-- Migration: Fix Monk proficiency-choice-1 empty from array
-- Monk gets choice of 1 artisan tool or 1 musical instrument

UPDATE content_definitions
SET effects = (
  SELECT jsonb_agg(
    CASE
      WHEN e->>'choice_id' = 'monk-proficiency-choice-1'
      THEN jsonb_set(e, '{from}', '["smiths-tools","brewers-supplies","masons-tools","carpenters-tools","cobblers-tools","cooks-utensils","glassblowers-tools","jewelers-tools","leatherworkers-tools","painters-supplies","potters-tools","tinkers-tools","weavers-tools","woodcarvers-tools","bagpipes","drum","dulcimer","flute","lute","lyre","horn","pan-flute","shawm","viol"]'::jsonb)
      ELSE e
    END
  )
  FROM jsonb_array_elements(effects) as e
)
WHERE content_type = 'class'
  AND slug = 'monk'
  AND source = 'srd'
  AND scope = 'platform';
