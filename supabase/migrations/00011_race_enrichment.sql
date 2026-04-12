-- Migration: Enrich SRD races with MPMB-sourced mechanical data
-- Source: MPMB ListsRaces.js + D&D 5e SRD
-- Fields: scores, speed_detail, vision, dmgres, savetxt, skills, weaponProfs, armorProfs, toolProfs, source_refs
-- Pattern: jsonb merge (data = data || '{...}'::jsonb) — idempotent, overwrites with correct values

BEGIN;

-- ============================================================================
-- BASE RACES
-- ============================================================================

-- Dragonborn: +2 STR, +1 CHA, 30ft walk, no darkvision
UPDATE content_definitions
SET data = data || '{
  "scores": [2,0,0,0,0,1],
  "speed_detail": {"walk": 30},
  "vision": [],
  "dmgres": [],
  "savetxt": {"adv_vs": [], "immune": []},
  "skills": [],
  "weaponProfs": [],
  "armorProfs": [],
  "toolProfs": [],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'race'
  AND slug = 'dragonborn'
  AND source = 'srd'
  AND scope = 'platform';

-- Dwarf: +2 CON, 25ft walk (not reduced by heavy armor), darkvision 60, poison resistance + save advantage
-- Weapon profs: battleaxe, handaxe, light hammer, warhammer
-- Tool profs: choice of smith's, brewer's, or mason's tools (stored as description)
UPDATE content_definitions
SET data = data || '{
  "scores": [0,0,2,0,0,0],
  "speed_detail": {"walk": 25, "encumbered": 25},
  "vision": [{"type": "darkvision", "range": 60}],
  "dmgres": ["poison"],
  "savetxt": {"adv_vs": ["poison"], "immune": []},
  "skills": [],
  "weaponProfs": ["battleaxe", "handaxe", "light hammer", "warhammer"],
  "armorProfs": [],
  "toolProfs": [],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'race'
  AND slug = 'dwarf'
  AND source = 'srd'
  AND scope = 'platform';

-- Elf: +2 DEX, 30ft walk, darkvision 60, charm save advantage, immune to magical sleep
-- Skill: Perception
UPDATE content_definitions
SET data = data || '{
  "scores": [0,2,0,0,0,0],
  "speed_detail": {"walk": 30},
  "vision": [{"type": "darkvision", "range": 60}],
  "dmgres": [],
  "savetxt": {"adv_vs": ["charmed"], "immune": ["magical sleep"]},
  "skills": ["perception"],
  "weaponProfs": [],
  "armorProfs": [],
  "toolProfs": [],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'race'
  AND slug = 'elf'
  AND source = 'srd'
  AND scope = 'platform';

-- Gnome: +2 INT, 25ft walk, darkvision 60, advantage on INT/WIS/CHA saves vs magic
UPDATE content_definitions
SET data = data || '{
  "scores": [0,0,0,2,0,0],
  "speed_detail": {"walk": 25},
  "vision": [{"type": "darkvision", "range": 60}],
  "dmgres": [],
  "savetxt": {"adv_vs": ["Intelligence saves vs magic", "Wisdom saves vs magic", "Charisma saves vs magic"], "immune": []},
  "skills": [],
  "weaponProfs": [],
  "armorProfs": [],
  "toolProfs": [],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'race'
  AND slug = 'gnome'
  AND source = 'srd'
  AND scope = 'platform';

-- Half-Elf: +2 CHA (+1 to two others, choice — stored as description), 30ft walk, darkvision 60
-- Charm advantage, immune magical sleep, 2 skill choices
UPDATE content_definitions
SET data = data || '{
  "scores": [0,0,0,0,0,2],
  "scorestxt": "+2 Charisma, +1 to two other ability scores of your choice",
  "speed_detail": {"walk": 30},
  "vision": [{"type": "darkvision", "range": 60}],
  "dmgres": [],
  "savetxt": {"adv_vs": ["charmed"], "immune": ["magical sleep"]},
  "skills": [],
  "skillstxt": "Choose any two skills",
  "weaponProfs": [],
  "armorProfs": [],
  "toolProfs": [],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'race'
  AND slug = 'half-elf'
  AND source = 'srd'
  AND scope = 'platform';

-- Half-Orc: +2 STR, +1 CON, 30ft walk, darkvision 60
-- Skill: Intimidation
UPDATE content_definitions
SET data = data || '{
  "scores": [2,0,1,0,0,0],
  "speed_detail": {"walk": 30},
  "vision": [{"type": "darkvision", "range": 60}],
  "dmgres": [],
  "savetxt": {"adv_vs": [], "immune": []},
  "skills": ["intimidation"],
  "weaponProfs": [],
  "armorProfs": [],
  "toolProfs": [],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'race'
  AND slug = 'half-orc'
  AND source = 'srd'
  AND scope = 'platform';

-- Halfling: +2 DEX, 25ft walk, no darkvision
-- Advantage vs frightened (Brave trait)
UPDATE content_definitions
SET data = data || '{
  "scores": [0,2,0,0,0,0],
  "speed_detail": {"walk": 25},
  "vision": [],
  "dmgres": [],
  "savetxt": {"adv_vs": ["frightened"], "immune": []},
  "skills": [],
  "weaponProfs": [],
  "armorProfs": [],
  "toolProfs": [],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'race'
  AND slug = 'halfling'
  AND source = 'srd'
  AND scope = 'platform';

-- Human: +1 to all, 30ft walk, no darkvision, no resistances
UPDATE content_definitions
SET data = data || '{
  "scores": [1,1,1,1,1,1],
  "speed_detail": {"walk": 30},
  "vision": [],
  "dmgres": [],
  "savetxt": {"adv_vs": [], "immune": []},
  "skills": [],
  "weaponProfs": [],
  "armorProfs": [],
  "toolProfs": [],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'race'
  AND slug = 'human'
  AND source = 'srd'
  AND scope = 'platform';

-- Tiefling: +1 INT, +2 CHA, 30ft walk, darkvision 60, fire resistance
UPDATE content_definitions
SET data = data || '{
  "scores": [0,0,0,1,0,2],
  "speed_detail": {"walk": 30},
  "vision": [{"type": "darkvision", "range": 60}],
  "dmgres": ["fire"],
  "savetxt": {"adv_vs": [], "immune": []},
  "skills": [],
  "weaponProfs": [],
  "armorProfs": [],
  "toolProfs": [],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'race'
  AND slug = 'tiefling'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- SUBRACES
-- ============================================================================

-- Hill Dwarf: +1 WIS (on top of Dwarf +2 CON)
-- Dwarven Toughness: +1 HP per level (tracked via feature, not race data)
UPDATE content_definitions
SET data = data || '{
  "scores": [0,0,0,0,1,0],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'subrace'
  AND slug = 'hill-dwarf'
  AND source = 'srd'
  AND scope = 'platform';

-- High Elf: +1 INT (on top of Elf +2 DEX)
-- Weapon profs: longsword, shortsword, shortbow, longbow
-- One wizard cantrip (choice, not stored here)
UPDATE content_definitions
SET data = data || '{
  "scores": [0,0,0,1,0,0],
  "weaponProfs": ["longsword", "shortsword", "shortbow", "longbow"],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'subrace'
  AND slug = 'high-elf'
  AND source = 'srd'
  AND scope = 'platform';

-- Lightfoot Halfling: +1 CHA (on top of Halfling +2 DEX)
-- Naturally Stealthy: can hide behind Medium+ creatures
UPDATE content_definitions
SET data = data || '{
  "scores": [0,0,0,0,0,1],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'subrace'
  AND slug = 'lightfoot-halfling'
  AND source = 'srd'
  AND scope = 'platform';

-- Rock Gnome: +1 CON (on top of Gnome +2 INT)
-- Tool prof: tinker's tools
UPDATE content_definitions
SET data = data || '{
  "scores": [0,0,1,0,0,0],
  "toolProfs": ["tinkers tools"],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'subrace'
  AND slug = 'rock-gnome'
  AND source = 'srd'
  AND scope = 'platform';

COMMIT;
