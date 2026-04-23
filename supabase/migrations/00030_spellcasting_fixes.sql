-- Migration: Fix ritual_casting flag on SRD classes, enrich subclass spellcastingExtra.

-- 1. Set ritual_casting = true on Wizard, Cleric, Druid, Bard.
UPDATE content_definitions
SET data = jsonb_set(
  data,
  '{spellcasting,ritual_casting}',
  'true'::jsonb,
  true
)
WHERE content_type = 'class'
  AND source = 'srd'
  AND scope = 'platform'
  AND slug IN ('wizard', 'cleric', 'druid', 'bard');

-- 2. Enrich Life Domain (Cleric) with domain spells per PHB p60.
-- Format: array of tier objects, each tier = {level: N, spells: [slug, ...]}
-- L1: Bless, Cure Wounds; L3: Lesser Restoration, Spiritual Weapon;
-- L5: Beacon of Hope, Revivify; L7: Death Ward, Guardian of Faith;
-- L9: Mass Cure Wounds, Raise Dead
UPDATE content_definitions
SET data = jsonb_set(
  data,
  '{spellcastingExtra}',
  '[
    {"level": 1, "spells": ["bless", "cure-wounds"]},
    {"level": 3, "spells": ["lesser-restoration", "spiritual-weapon"]},
    {"level": 5, "spells": ["beacon-of-hope", "revivify"]},
    {"level": 7, "spells": ["death-ward", "guardian-of-faith"]},
    {"level": 9, "spells": ["mass-cure-wounds", "raise-dead"]}
  ]'::jsonb,
  true
)
WHERE content_type = 'subclass'
  AND source = 'srd'
  AND scope = 'platform'
  AND slug = 'life';

-- 3. Enrich Fiend (Warlock patron) with expanded spell list per PHB p109.
-- Class level tiers for Warlock expanded list:
-- L1: Burning Hands, Command; L3: Blindness/Deafness, Scorching Ray;
-- L5: Fireball, Stinking Cloud; L7: Fire Shield, Wall of Fire;
-- L9: Flame Strike, Hallow
UPDATE content_definitions
SET data = jsonb_set(
  data,
  '{spellcastingExtra}',
  '[
    {"level": 1, "spells": ["burning-hands", "command"]},
    {"level": 3, "spells": ["blindness-deafness", "scorching-ray"]},
    {"level": 5, "spells": ["fireball", "stinking-cloud"]},
    {"level": 7, "spells": ["fire-shield", "wall-of-fire"]},
    {"level": 9, "spells": ["flame-strike", "hallow"]}
  ]'::jsonb,
  true
)
WHERE content_type = 'subclass'
  AND source = 'srd'
  AND scope = 'platform'
  AND slug = 'fiend';

-- 4. Enrich Oath of Devotion (Paladin) with oath spells per PHB p86.
-- Paladin oath tiers use paladin levels:
-- L3: Protection from Evil and Good, Sanctuary;
-- L5: Lesser Restoration, Zone of Truth;
-- L9: Beacon of Hope, Dispel Magic;
-- L13: Freedom of Movement, Guardian of Faith;
-- L17: Commune, Flame Strike
UPDATE content_definitions
SET data = jsonb_set(
  data,
  '{spellcastingExtra}',
  '[
    {"level": 3, "spells": ["protection-from-evil-and-good", "sanctuary"]},
    {"level": 5, "spells": ["lesser-restoration", "zone-of-truth"]},
    {"level": 9, "spells": ["beacon-of-hope", "dispel-magic"]},
    {"level": 13, "spells": ["freedom-of-movement", "guardian-of-faith"]},
    {"level": 17, "spells": ["commune", "flame-strike"]}
  ]'::jsonb,
  true
)
WHERE content_type = 'subclass'
  AND source = 'srd'
  AND scope = 'platform'
  AND slug = 'devotion';
