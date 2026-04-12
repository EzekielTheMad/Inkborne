-- Migration: Enrich SRD backgrounds with Phase 3 proficiency and equipment data
-- Source: D&D 5e SRD + MPMB ListsBackgrounds.js
-- Fields: skills, languageProfs, toolProfs, gold, equipment, source_refs
-- Pattern: jsonb merge (data = data || '{...}'::jsonb) — idempotent

BEGIN;

-- Acolyte — the only background in the 2014 SRD
-- Skills: Insight, Religion
-- Languages: Choose 2 from any
-- Tool proficiencies: none
-- Starting gold: 15 gp
-- Equipment: holy symbol, prayer book/wheel, incense, vestments, common clothes, pouch with 15 gp
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'skills', '["insight", "religion"]'::jsonb,
  'languageProfs', '[{"choose": 2, "from": "any"}]'::jsonb,
  'toolProfs', '[]'::jsonb,
  'gold', 15,
  'equipment', 'A holy symbol, a prayer book or prayer wheel, 5 sticks of incense, vestments, a set of common clothes, and a pouch containing 15 gp',
  'source_refs', '[{"book": "SRD", "page": 0}]'::jsonb
)
WHERE content_type = 'background'
  AND slug = 'acolyte'
  AND source = 'srd'
  AND scope = 'platform';

COMMIT;
