-- Migration: Enrich SRD caster classes with spellcasting known, spell lists, prepared flag
-- Source: MPMB ListsClasses.js + D&D 5e SRD PHB spellcasting tables
-- Fields: spellcastingKnown (cantrips, spells, prepared), spellcastingList (class, level)
-- Also: abilitySave for Monk (Ki save DC)
-- Pattern: jsonb merge (data = data || '{...}'::jsonb) — idempotent

BEGIN;

-- ============================================================================
-- KNOWN CASTERS — track specific spells known (spells = int array)
-- ============================================================================

-- Bard — known caster, cantrips + spells known per level
-- Spells known includes Magical Secrets bonus spells per PHB table
UPDATE content_definitions
SET data = data || '{
  "spellcastingKnown": {
    "cantrips": [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
    "spells": [4,5,6,7,8,9,10,11,12,14,15,15,16,18,19,19,20,22,22,22],
    "prepared": false
  },
  "spellcastingList": {
    "class": "bard",
    "level": [0,9]
  }
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'bard'
  AND source = 'srd'
  AND scope = 'platform';

-- Ranger — known caster, no cantrips, half-caster (spellcasting starts at level 2)
UPDATE content_definitions
SET data = data || '{
  "spellcastingKnown": {
    "spells": [0,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11],
    "prepared": false
  },
  "spellcastingList": {
    "class": "ranger",
    "level": [1,5]
  }
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'ranger'
  AND source = 'srd'
  AND scope = 'platform';

-- Sorcerer — known caster with cantrips
UPDATE content_definitions
SET data = data || '{
  "spellcastingKnown": {
    "cantrips": [4,4,4,5,5,5,5,5,5,6,6,6,6,6,6,6,6,6,6,6],
    "spells": [2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,14,15,15,15,15],
    "prepared": false
  },
  "spellcastingList": {
    "class": "sorcerer",
    "level": [0,9]
  }
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'sorcerer'
  AND source = 'srd'
  AND scope = 'platform';

-- Warlock — known caster with cantrips, pact magic
UPDATE content_definitions
SET data = data || '{
  "spellcastingKnown": {
    "cantrips": [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
    "spells": [2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15],
    "prepared": false
  },
  "spellcastingList": {
    "class": "warlock",
    "level": [0,5]
  }
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'warlock'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- PREPARED CASTERS — access full class spell list, prepare subset (spells = "all")
-- ============================================================================

-- Cleric — prepared caster, accesses full cleric spell list
UPDATE content_definitions
SET data = data || '{
  "spellcastingKnown": {
    "cantrips": [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
    "spells": "all",
    "prepared": true
  },
  "spellcastingList": {
    "class": "cleric",
    "level": [0,9]
  }
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'cleric'
  AND source = 'srd'
  AND scope = 'platform';

-- Druid — prepared caster, accesses full druid spell list
UPDATE content_definitions
SET data = data || '{
  "spellcastingKnown": {
    "cantrips": [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
    "spells": "all",
    "prepared": true
  },
  "spellcastingList": {
    "class": "druid",
    "level": [0,9]
  }
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'druid'
  AND source = 'srd'
  AND scope = 'platform';

-- Paladin — prepared caster, half-caster, no cantrips
-- Spellcasting starts at level 2; no cantrips array
UPDATE content_definitions
SET data = data || '{
  "spellcastingKnown": {
    "spells": "all",
    "prepared": true
  },
  "spellcastingList": {
    "class": "paladin",
    "level": [1,5]
  }
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'paladin'
  AND source = 'srd'
  AND scope = 'platform';

-- Wizard — prepared caster, spellbook mechanic
-- Schema tracks as prepared=true; the spellbook filter is a UI concern
UPDATE content_definitions
SET data = data || '{
  "spellcastingKnown": {
    "cantrips": [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
    "spells": "all",
    "prepared": true
  },
  "spellcastingList": {
    "class": "wizard",
    "level": [0,9]
  }
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'wizard'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- THIRD CASTERS — subclass entries (content_type = 'subclass')
-- ============================================================================

-- Eldritch Knight (Fighter subclass) — third caster, known caster
-- Spellcasting starts at class level 3
UPDATE content_definitions
SET data = data || '{
  "spellcastingKnown": {
    "cantrips": [0,0,2,2,2,2,2,2,2,3,3,3,3,3,3,3,3,3,3,3],
    "spells": [0,0,3,4,4,4,5,6,6,7,8,8,9,10,10,11,11,11,12,13],
    "prepared": false
  },
  "spellcastingList": {
    "class": "wizard",
    "level": [0,4]
  }
}'::jsonb
WHERE content_type = 'subclass'
  AND slug = 'eldritch-knight'
  AND source = 'srd'
  AND scope = 'platform';

-- Arcane Trickster (Rogue subclass) — third caster, known caster
-- Spellcasting starts at class level 3
UPDATE content_definitions
SET data = data || '{
  "spellcastingKnown": {
    "cantrips": [0,0,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
    "spells": [0,0,3,4,4,4,5,6,6,7,8,8,9,10,10,11,11,11,12,13],
    "prepared": false
  },
  "spellcastingList": {
    "class": "wizard",
    "level": [0,4]
  }
}'::jsonb
WHERE content_type = 'subclass'
  AND slug = 'arcane-trickster'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- NON-CASTER SAVE DC — abilitySave
-- ============================================================================

-- Monk — Ki save DC uses Wisdom
UPDATE content_definitions
SET data = data || '{
  "abilitySave": "wisdom"
}'::jsonb
WHERE content_type = 'class'
  AND slug = 'monk'
  AND source = 'srd'
  AND scope = 'platform';

COMMIT;
