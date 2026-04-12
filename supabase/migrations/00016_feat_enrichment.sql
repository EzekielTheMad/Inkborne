-- Migration: Enrich SRD feat (Grappler) with Phase 3 fields
-- Source: D&D 5e SRD + MPMB ListsFeats.js
-- Fields: scores, source_refs
-- Pattern: jsonb merge (data = data || '{...}'::jsonb) — idempotent

BEGIN;

-- Grappler feat — STR 13 prerequisite (already stored in prerequisites)
-- Grants: advantage on attack rolls against grappled creatures, can pin (restrain) grappled creatures
-- No ability score bonus; mechanical effects are mostly narrative
UPDATE content_definitions
SET data = data || '{
  "scores": [0,0,0,0,0,0],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feat'
  AND slug = 'grappler'
  AND source = 'srd'
  AND scope = 'platform';

COMMIT;
