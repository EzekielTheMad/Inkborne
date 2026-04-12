-- Migration: Enrich SRD classes with attacks progression and ASI improvement arrays
-- Source: MPMB ListsClasses.js + D&D 5e SRD
-- Fields: attacks (20-element int array), improvements (20-element boolean array), source_refs
-- Pattern: jsonb merge (data = data || '{...}'::jsonb) — idempotent

BEGIN;

-- ============================================================================
-- ATTACKS PER ACTION (20-element arrays, index 0 = level 1)
-- ============================================================================
-- Most classes: 1 attack at all levels
-- Fighter: Extra Attack at 5 (2), at 11 (3), at 20 (4)
-- Barbarian/Monk/Paladin/Ranger: Extra Attack at 5 (2)

-- ============================================================================
-- ASI IMPROVEMENTS (20-element boolean arrays, true = ASI at that level)
-- ============================================================================
-- Standard: 4, 8, 12, 16, 19 (5 ASIs)
-- Fighter: 4, 6, 8, 12, 14, 16, 19 (7 ASIs)
-- Rogue: 4, 8, 10, 12, 16, 19 (6 ASIs)

-- Barbarian: Extra Attack at 5, standard ASI (4,8,12,16,19)
UPDATE content_definitions
SET data = data || '{
  "attacks": [1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
  "improvements": [false,false,false,true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,true,false],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'barbarian'
  AND source = 'srd'
  AND scope = 'platform';

-- Bard: no Extra Attack (base), standard ASI (4,8,12,16,19)
UPDATE content_definitions
SET data = data || '{
  "attacks": [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  "improvements": [false,false,false,true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,true,false],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'bard'
  AND source = 'srd'
  AND scope = 'platform';

-- Cleric: no Extra Attack, standard ASI (4,8,12,16,19)
UPDATE content_definitions
SET data = data || '{
  "attacks": [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  "improvements": [false,false,false,true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,true,false],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'cleric'
  AND source = 'srd'
  AND scope = 'platform';

-- Druid: no Extra Attack, standard ASI (4,8,12,16,19)
UPDATE content_definitions
SET data = data || '{
  "attacks": [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  "improvements": [false,false,false,true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,true,false],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'druid'
  AND source = 'srd'
  AND scope = 'platform';

-- Fighter: Extra Attack at 5 (2), 11 (3), 20 (4). ASI at 4,6,8,12,14,16,19 (7 total)
UPDATE content_definitions
SET data = data || '{
  "attacks": [1,1,1,1,2,2,2,2,2,2,3,3,3,3,3,3,3,3,3,4],
  "improvements": [false,false,false,true,false,true,false,true,false,false,false,true,false,true,false,true,false,false,true,false],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'fighter'
  AND source = 'srd'
  AND scope = 'platform';

-- Monk: Extra Attack at 5 (2 only, not 3 or 4). Standard ASI (4,8,12,16,19)
UPDATE content_definitions
SET data = data || '{
  "attacks": [1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
  "improvements": [false,false,false,true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,true,false],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'monk'
  AND source = 'srd'
  AND scope = 'platform';

-- Paladin: Extra Attack at 5 (2). Standard ASI (4,8,12,16,19)
UPDATE content_definitions
SET data = data || '{
  "attacks": [1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
  "improvements": [false,false,false,true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,true,false],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'paladin'
  AND source = 'srd'
  AND scope = 'platform';

-- Ranger: Extra Attack at 5 (2). Standard ASI (4,8,12,16,19)
UPDATE content_definitions
SET data = data || '{
  "attacks": [1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
  "improvements": [false,false,false,true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,true,false],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'ranger'
  AND source = 'srd'
  AND scope = 'platform';

-- Rogue: no Extra Attack. ASI at 4,8,10,12,16,19 (6 total — extra at 10)
UPDATE content_definitions
SET data = data || '{
  "attacks": [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  "improvements": [false,false,false,true,false,false,false,true,false,true,false,true,false,false,false,true,false,false,true,false],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'rogue'
  AND source = 'srd'
  AND scope = 'platform';

-- Sorcerer: no Extra Attack. Standard ASI (4,8,12,16,19)
UPDATE content_definitions
SET data = data || '{
  "attacks": [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  "improvements": [false,false,false,true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,true,false],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'sorcerer'
  AND source = 'srd'
  AND scope = 'platform';

-- Warlock: no Extra Attack (Thirsting Blade invocation is separate). Standard ASI (4,8,12,16,19)
UPDATE content_definitions
SET data = data || '{
  "attacks": [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  "improvements": [false,false,false,true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,true,false],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'warlock'
  AND source = 'srd'
  AND scope = 'platform';

-- Wizard: no Extra Attack. Standard ASI (4,8,12,16,19)
UPDATE content_definitions
SET data = data || '{
  "attacks": [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  "improvements": [false,false,false,true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,true,false],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'wizard'
  AND source = 'srd'
  AND scope = 'platform';

COMMIT;
