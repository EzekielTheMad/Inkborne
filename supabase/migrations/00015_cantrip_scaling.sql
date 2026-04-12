-- Migration: Enrich SRD cantrips with scaling die formulas and full description text
-- Source: D&D 5e SRD spell descriptions (dnd5eapi.co)
-- Fields: descriptionCantripDie (die, levels), descriptionFull (complete rules text)
-- Pattern: jsonb merge (data = data || '{...}'::jsonb) — idempotent
-- Note: Only SRD 2014 cantrips are enriched. toll-the-dead is Xanathar's (not SRD).
--       true-strike (2014) has no damage die and is skipped.

BEGIN;

-- ============================================================================
-- DAMAGE CANTRIPS WITH STANDARD SCALING (die increases at 5/11/17)
-- ============================================================================

-- Acid Splash — 1d6 acid, scales at 5/11/17
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'descriptionCantripDie', jsonb_build_object(
    'die', '1d6',
    'levels', '[1,5,11,17]'::jsonb
  ),
  'descriptionFull', 'You hurl a bubble of acid. Choose one creature within range, or choose two creatures within range that are within 5 feet of each other. A target must succeed on a dexterity saving throw or take 1d6 acid damage.
This spell''s damage increases by 1d6 when you reach 5th level (2d6), 11th level (3d6), and 17th level (4d6).'
)
WHERE content_type = 'spell'
  AND slug = 'acid-splash'
  AND source = 'srd'
  AND scope = 'platform';

-- Chill Touch — 1d8 necrotic, scales at 5/11/17
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'descriptionCantripDie', jsonb_build_object(
    'die', '1d8',
    'levels', '[1,5,11,17]'::jsonb
  ),
  'descriptionFull', 'You create a ghostly, skeletal hand in the space of a creature within range. Make a ranged spell attack against the creature to assail it with the chill of the grave. On a hit, the target takes 1d8 necrotic damage, and it can''t regain hit points until the start of your next turn. Until then, the hand clings to the target.
If you hit an undead target, it also has disadvantage on attack rolls against you until the end of your next turn.
This spell''s damage increases by 1d8 when you reach 5th level (2d8), 11th level (3d8), and 17th level (4d8).'
)
WHERE content_type = 'spell'
  AND slug = 'chill-touch'
  AND source = 'srd'
  AND scope = 'platform';

-- Eldritch Blast — 1d10 force, scales by adding beams at 5/11/17 (not dice)
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'descriptionCantripDie', jsonb_build_object(
    'die', '1d10',
    'levels', '[1,5,11,17]'::jsonb
  ),
  'descriptionFull', 'A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 force damage. The spell creates more than one beam when you reach higher levels: two beams at 5th level, three beams at 11th level, and four beams at 17th level. You can direct the beams at the same target or at different ones. Make a separate attack roll for each beam.'
)
WHERE content_type = 'spell'
  AND slug = 'eldritch-blast'
  AND source = 'srd'
  AND scope = 'platform';

-- Fire Bolt — 1d10 fire, scales at 5/11/17
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'descriptionCantripDie', jsonb_build_object(
    'die', '1d10',
    'levels', '[1,5,11,17]'::jsonb
  ),
  'descriptionFull', 'You hurl a mote of fire at a creature or object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage. A flammable object hit by this spell ignites if it isn''t being worn or carried.
This spell''s damage increases by 1d10 when you reach 5th level (2d10), 11th level (3d10), and 17th level (4d10).'
)
WHERE content_type = 'spell'
  AND slug = 'fire-bolt'
  AND source = 'srd'
  AND scope = 'platform';

-- Poison Spray — 1d12 poison, scales at 5/11/17
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'descriptionCantripDie', jsonb_build_object(
    'die', '1d12',
    'levels', '[1,5,11,17]'::jsonb
  ),
  'descriptionFull', 'You extend your hand toward a creature you can see within range and project a puff of noxious gas from your palm. The creature must succeed on a constitution saving throw or take 1d12 poison damage.
This spell''s damage increases by 1d12 when you reach 5th level (2d12), 11th level (3d12), and 17th level (4d12).'
)
WHERE content_type = 'spell'
  AND slug = 'poison-spray'
  AND source = 'srd'
  AND scope = 'platform';

-- Produce Flame — 1d8 fire, scales at 5/11/17
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'descriptionCantripDie', jsonb_build_object(
    'die', '1d8',
    'levels', '[1,5,11,17]'::jsonb
  ),
  'descriptionFull', 'A flickering flame appears in your hand. The flame remains there for the duration and harms neither you nor your equipment. The flame sheds bright light in a 10-foot radius and dim light for an additional 10 feet. The spell ends if you dismiss it as an action or if you cast it again.
You can also attack with the flame, although doing so ends the spell. When you cast this spell, or as an action on a later turn, you can hurl the flame at a creature within 30 feet of you. Make a ranged spell attack. On a hit, the target takes 1d8 fire damage.
This spell''s damage increases by 1d8 when you reach 5th level (2d8), 11th level (3d8), and 17th level (4d8).'
)
WHERE content_type = 'spell'
  AND slug = 'produce-flame'
  AND source = 'srd'
  AND scope = 'platform';

-- Ray of Frost — 1d8 cold, scales at 5/11/17
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'descriptionCantripDie', jsonb_build_object(
    'die', '1d8',
    'levels', '[1,5,11,17]'::jsonb
  ),
  'descriptionFull', 'A frigid beam of blue-white light streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, it takes 1d8 cold damage, and its speed is reduced by 10 feet until the start of your next turn.
The spell''s damage increases by 1d8 when you reach 5th level (2d8), 11th level (3d8), and 17th level (4d8).'
)
WHERE content_type = 'spell'
  AND slug = 'ray-of-frost'
  AND source = 'srd'
  AND scope = 'platform';

-- Sacred Flame — 1d8 radiant, scales at 5/11/17
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'descriptionCantripDie', jsonb_build_object(
    'die', '1d8',
    'levels', '[1,5,11,17]'::jsonb
  ),
  'descriptionFull', 'Flame-like radiance descends on a creature that you can see within range. The target must succeed on a dexterity saving throw or take 1d8 radiant damage. The target gains no benefit from cover for this saving throw.
The spell''s damage increases by 1d8 when you reach 5th level (2d8), 11th level (3d8), and 17th level (4d8).'
)
WHERE content_type = 'spell'
  AND slug = 'sacred-flame'
  AND source = 'srd'
  AND scope = 'platform';

-- Shocking Grasp — 1d8 lightning, scales at 5/11/17
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'descriptionCantripDie', jsonb_build_object(
    'die', '1d8',
    'levels', '[1,5,11,17]'::jsonb
  ),
  'descriptionFull', 'Lightning springs from your hand to deliver a shock to a creature you try to touch. Make a melee spell attack against the target. You have advantage on the attack roll if the target is wearing armor made of metal. On a hit, the target takes 1d8 lightning damage, and it can''t take reactions until the start of its next turn.
The spell''s damage increases by 1d8 when you reach 5th level (2d8), 11th level (3d8), and 17th level (4d8).'
)
WHERE content_type = 'spell'
  AND slug = 'shocking-grasp'
  AND source = 'srd'
  AND scope = 'platform';

-- Vicious Mockery — 1d4 psychic, scales at 5/11/17
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'descriptionCantripDie', jsonb_build_object(
    'die', '1d4',
    'levels', '[1,5,11,17]'::jsonb
  ),
  'descriptionFull', 'You unleash a string of insults laced with subtle enchantments at a creature you can see within range. If the target can hear you (though it need not understand you), it must succeed on a wisdom saving throw or take 1d4 psychic damage and have disadvantage on the next attack roll it makes before the end of its next turn.
This spell''s damage increases by 1d4 when you reach 5th level (2d4), 11th level (3d4), and 17th level (4d4).'
)
WHERE content_type = 'spell'
  AND slug = 'vicious-mockery'
  AND source = 'srd'
  AND scope = 'platform';

COMMIT;
