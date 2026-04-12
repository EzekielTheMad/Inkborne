-- ============================================================
-- ADD feature_type TO EXISTING FEATURES
-- Categorizes features for builder interaction detection
-- ============================================================

-- ASI features
UPDATE content_definitions
SET data = data || '{"feature_type": "asi"}'::jsonb
WHERE content_type = 'feature'
AND name = 'Ability Score Improvement'
AND (data->>'feature_type') IS NULL;

-- Subclass selection features
UPDATE content_definitions
SET data = data || '{"feature_type": "subclass"}'::jsonb
WHERE content_type = 'feature'
AND (
  name LIKE '%Archetype%' OR name LIKE '%Tradition%' OR
  name LIKE '%Sacred Oath%' OR name LIKE '%Patron%' OR
  name LIKE '%Circle%' OR name LIKE '%Domain%' OR
  name LIKE '%College%' OR name LIKE '%Monastic%' OR
  name LIKE '%Primal Path%' OR name LIKE '%Sorcerous Origin%' OR
  name LIKE '%Roguish Archetype%' OR name LIKE '%Ranger Archetype%'
)
AND (data->>'feature_type') IS NULL;

-- Fighting style features
UPDATE content_definitions
SET data = data || '{"feature_type": "fighting_style"}'::jsonb
WHERE content_type = 'feature'
AND name LIKE 'Fighting Style%'
AND (data->>'feature_type') IS NULL;

-- Everything else defaults to passive
UPDATE content_definitions
SET data = data || '{"feature_type": "passive"}'::jsonb
WHERE content_type = 'feature'
AND (data->>'feature_type') IS NULL;
