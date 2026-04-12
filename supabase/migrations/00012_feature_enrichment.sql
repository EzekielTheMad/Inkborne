-- Migration: Enrich key SRD features with MPMB-sourced mechanical data
-- Source: MPMB ListsClasses.js + D&D 5e SRD
-- Fields: action, usages, recovery, additional, dmgres, savetxt, speed, source_refs
-- Pattern: jsonb merge (data = data || '{...}'::jsonb) — idempotent

BEGIN;

-- ============================================================================
-- BARBARIAN FEATURES
-- ============================================================================

-- Rage: bonus action, usages scale by level, long rest recovery
-- Rage damage: +2 (levels 1-8), +3 (levels 9-15), +4 (levels 16-20)
-- While raging: resistance to bludgeoning, piercing, slashing
-- Usages: 2,2,3,3,3,3,4,4,4,4,4,4,5,5,5,5,5,6,6,unlimited
UPDATE content_definitions
SET data = data || '{
  "action": "bonus action",
  "usages": [2,2,3,3,3,3,4,4,4,4,4,4,5,5,5,5,5,6,6,999],
  "recovery": "long rest",
  "additional": ["+2","+2","+2","+2","+2","+2","+2","+2","+3","+3","+3","+3","+3","+3","+3","+4","+4","+4","+4","+4"],
  "dmgres": ["bludgeoning","piercing","slashing"],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'rage'
  AND source = 'srd'
  AND scope = 'platform';

-- Barbarian Unarmored Defense: passive, AC = 10 + DEX + CON
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'barbarian-unarmored-defense'
  AND source = 'srd'
  AND scope = 'platform';

-- Reckless Attack: free action (part of first attack on your turn)
UPDATE content_definitions
SET data = data || '{
  "action": "free",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'reckless-attack'
  AND source = 'srd'
  AND scope = 'platform';

-- Danger Sense: passive, advantage on DEX saves you can see
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "savetxt": {"adv_vs": ["Dex saves vs effects you can see"], "immune": []},
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'danger-sense'
  AND source = 'srd'
  AND scope = 'platform';

-- Feral Instinct: passive, advantage on initiative
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'feral-instinct'
  AND source = 'srd'
  AND scope = 'platform';

-- Brutal Critical (1 die): passive
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "additional": [null,null,null,null,null,null,null,null,"1 extra die",null,null,null,null,null,null,null,null,null,null,null],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'brutal-critical-1-die'
  AND source = 'srd'
  AND scope = 'platform';

-- Brutal Critical (2 dice): passive
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "additional": [null,null,null,null,null,null,null,null,null,null,null,null,"2 extra dice",null,null,null,null,null,null,null],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'brutal-critical-2-dice'
  AND source = 'srd'
  AND scope = 'platform';

-- Brutal Critical (3 dice): passive
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "additional": [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"3 extra dice",null,null,null],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'brutal-critical-3-dice'
  AND source = 'srd'
  AND scope = 'platform';

-- Persistent Rage: passive (rage only ends early if unconscious or you choose)
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'persistent-rage'
  AND source = 'srd'
  AND scope = 'platform';

-- Fast Movement: passive, +10 ft walk while not in heavy armor
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "speed": {"walk": 10},
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'fast-movement'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- FIGHTER FEATURES
-- ============================================================================

-- Second Wind: bonus action, 1 use, short rest, heal 1d10 + fighter level
UPDATE content_definitions
SET data = data || '{
  "action": "bonus action",
  "usages": 1,
  "recovery": "short rest",
  "additional": ["1d10+1","1d10+2","1d10+3","1d10+4","1d10+5","1d10+6","1d10+7","1d10+8","1d10+9","1d10+10","1d10+11","1d10+12","1d10+13","1d10+14","1d10+15","1d10+16","1d10+17","1d10+18","1d10+19","1d10+20"],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'second-wind'
  AND source = 'srd'
  AND scope = 'platform';

-- Action Surge (1 use): free, 1 use, short rest
UPDATE content_definitions
SET data = data || '{
  "action": "free",
  "usages": [null,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  "recovery": "short rest",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'action-surge-1-use'
  AND source = 'srd'
  AND scope = 'platform';

-- Action Surge (2 uses): replaces 1-use version at level 17
UPDATE content_definitions
SET data = data || '{
  "action": "free",
  "usages": [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,2,2,2,2],
  "recovery": "short rest",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'action-surge-2-uses'
  AND source = 'srd'
  AND scope = 'platform';

-- Fighter Fighting Style: passive
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'fighter-fighting-style'
  AND source = 'srd'
  AND scope = 'platform';

-- Indomitable (1 use): free, 1 use, long rest — reroll a saving throw
UPDATE content_definitions
SET data = data || '{
  "action": "free",
  "usages": [null,null,null,null,null,null,null,null,1,1,1,1,1,1,1,1,1,1,1,1],
  "recovery": "long rest",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'indomitable-1-use'
  AND source = 'srd'
  AND scope = 'platform';

-- Indomitable (2 uses): replaces at level 13
UPDATE content_definitions
SET data = data || '{
  "action": "free",
  "usages": [null,null,null,null,null,null,null,null,null,null,null,null,2,2,2,2,2,2,2,2],
  "recovery": "long rest",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'indomitable-2-uses'
  AND source = 'srd'
  AND scope = 'platform';

-- Indomitable (3 uses): replaces at level 17
UPDATE content_definitions
SET data = data || '{
  "action": "free",
  "usages": [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,3,3,3,3],
  "recovery": "long rest",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'indomitable-3-uses'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- ROGUE FEATURES
-- ============================================================================

-- Sneak Attack: free (once per turn), damage scales every 2 levels
-- 1d6 at 1, 2d6 at 3, 3d6 at 5, ... 10d6 at 19
UPDATE content_definitions
SET data = data || '{
  "action": "free",
  "additional": ["1d6","1d6","2d6","2d6","3d6","3d6","4d6","4d6","5d6","5d6","6d6","6d6","7d6","7d6","8d6","8d6","9d6","9d6","10d6","10d6"],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'sneak-attack'
  AND source = 'srd'
  AND scope = 'platform';

-- Cunning Action: bonus action (Dash, Disengage, or Hide)
UPDATE content_definitions
SET data = data || '{
  "action": "bonus action",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'cunning-action'
  AND source = 'srd'
  AND scope = 'platform';

-- Uncanny Dodge: reaction, halve damage from one attack you can see
UPDATE content_definitions
SET data = data || '{
  "action": "reaction",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'uncanny-dodge'
  AND source = 'srd'
  AND scope = 'platform';

-- Rogue Evasion: passive, DEX saves = no damage on success, half on failure
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "savetxt": {"adv_vs": [], "immune": ["Dex save effects on success (half on fail)"]},
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'rogue-evasion'
  AND source = 'srd'
  AND scope = 'platform';

-- Reliable Talent: passive, minimum 10 on proficient ability checks
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'reliable-talent'
  AND source = 'srd'
  AND scope = 'platform';

-- Blindsense: passive, 10ft blindsight
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "vision": [{"type": "blindsight", "range": 10}],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'blindsense'
  AND source = 'srd'
  AND scope = 'platform';

-- Slippery Mind: passive, proficiency in WIS saves
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'slippery-mind'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- MONK FEATURES
-- ============================================================================

-- Martial Arts: passive, scales die size per level
-- d4 (1-4), d6 (5-10), d8 (11-16), d10 (17-20)
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "additional": ["1d4","1d4","1d4","1d4","1d6","1d6","1d6","1d6","1d6","1d6","1d8","1d8","1d8","1d8","1d8","1d8","1d10","1d10","1d10","1d10"],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'martial-arts'
  AND source = 'srd'
  AND scope = 'platform';

-- Ki: resource pool = monk level, short rest recovery
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "usages": [null,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],
  "recovery": "short rest",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'ki'
  AND source = 'srd'
  AND scope = 'platform';

-- Flurry of Blows: bonus action, costs 1 ki
UPDATE content_definitions
SET data = data || '{
  "action": "bonus action",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'flurry-of-blows'
  AND source = 'srd'
  AND scope = 'platform';

-- Patient Defense: bonus action, costs 1 ki (Dodge action)
UPDATE content_definitions
SET data = data || '{
  "action": "bonus action",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'patient-defense'
  AND source = 'srd'
  AND scope = 'platform';

-- Step of the Wind: bonus action, costs 1 ki (Dash or Disengage + double jump)
UPDATE content_definitions
SET data = data || '{
  "action": "bonus action",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'step-of-the-wind'
  AND source = 'srd'
  AND scope = 'platform';

-- Monk Unarmored Defense: passive, AC = 10 + DEX + WIS
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'monk-unarmored-defense'
  AND source = 'srd'
  AND scope = 'platform';

-- Unarmored Movement 1: +10 ft at level 2, scaling: +10/+15/+20/+25/+30 at 2/6/10/14/18
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "speed": {"walk": 10},
  "additional": [null,"+10 ft","+10 ft","+10 ft","+10 ft","+15 ft","+15 ft","+15 ft","+15 ft","+20 ft","+20 ft","+20 ft","+20 ft","+25 ft","+25 ft","+25 ft","+25 ft","+30 ft","+30 ft","+30 ft"],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'unarmored-movement-1'
  AND source = 'srd'
  AND scope = 'platform';

-- Unarmored Movement 2: can move along vertical surfaces and across liquids
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'unarmored-movement-2'
  AND source = 'srd'
  AND scope = 'platform';

-- Deflect Missiles: reaction, reduce damage by 1d10 + DEX + monk level
UPDATE content_definitions
SET data = data || '{
  "action": "reaction",
  "additional": ["1d10+Dex+1","1d10+Dex+2","1d10+Dex+3","1d10+Dex+4","1d10+Dex+5","1d10+Dex+6","1d10+Dex+7","1d10+Dex+8","1d10+Dex+9","1d10+Dex+10","1d10+Dex+11","1d10+Dex+12","1d10+Dex+13","1d10+Dex+14","1d10+Dex+15","1d10+Dex+16","1d10+Dex+17","1d10+Dex+18","1d10+Dex+19","1d10+Dex+20"],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'deflect-missiles'
  AND source = 'srd'
  AND scope = 'platform';

-- Slow Fall: reaction, reduce falling damage by 5 * monk level
UPDATE content_definitions
SET data = data || '{
  "action": "reaction",
  "additional": [null,null,null,"20",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'slow-fall'
  AND source = 'srd'
  AND scope = 'platform';

-- Stunning Strike: costs 1 ki per use, no separate action (part of attack)
UPDATE content_definitions
SET data = data || '{
  "action": "free",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'stunning-strike'
  AND source = 'srd'
  AND scope = 'platform';

-- Ki-Empowered Strikes: passive, unarmed strikes count as magical
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'ki-empowered-strikes'
  AND source = 'srd'
  AND scope = 'platform';

-- Monk Evasion: passive (same as Rogue Evasion)
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "savetxt": {"adv_vs": [], "immune": ["Dex save effects on success (half on fail)"]},
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'monk-evasion'
  AND source = 'srd'
  AND scope = 'platform';

-- Stillness of Mind: action, end one charmed or frightened effect on self
UPDATE content_definitions
SET data = data || '{
  "action": "action",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'stillness-of-mind'
  AND source = 'srd'
  AND scope = 'platform';

-- Diamond Soul: passive, proficiency in all saving throws
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'diamond-soul'
  AND source = 'srd'
  AND scope = 'platform';

-- Purity of Body: passive, immune to disease and poison
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "savetxt": {"adv_vs": [], "immune": ["disease", "poison"]},
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'purity-of-body'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- CLERIC FEATURES
-- ============================================================================

-- Channel Divinity: action, 1 use at 2, 2 at 6, 3 at 18, short rest
UPDATE content_definitions
SET data = data || '{
  "action": "action",
  "usages": [null,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,3,3,3],
  "recovery": "short rest",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'channel-divinity'
  AND source = 'srd'
  AND scope = 'platform';

-- Channel Divinity: Turn Undead: action (uses Channel Divinity charge)
UPDATE content_definitions
SET data = data || '{
  "action": "action",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'channel-divinity-turn-undead'
  AND source = 'srd'
  AND scope = 'platform';

-- Channel Divinity (1/rest, 2/rest, 3/rest variants)
UPDATE content_definitions
SET data = data || '{
  "action": "action",
  "usages": 1,
  "recovery": "short rest",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'channel-divinity-1-rest'
  AND source = 'srd'
  AND scope = 'platform';

UPDATE content_definitions
SET data = data || '{
  "action": "action",
  "usages": 2,
  "recovery": "short rest",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'channel-divinity-2-rest'
  AND source = 'srd'
  AND scope = 'platform';

UPDATE content_definitions
SET data = data || '{
  "action": "action",
  "usages": 3,
  "recovery": "short rest",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'channel-divinity-3-rest'
  AND source = 'srd'
  AND scope = 'platform';

-- Divine Intervention: action, 1 use, long rest
UPDATE content_definitions
SET data = data || '{
  "action": "action",
  "usages": 1,
  "recovery": "long rest",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'divine-intervention'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- PALADIN FEATURES
-- ============================================================================

-- Divine Sense: action, 1 + CHA modifier uses, long rest
UPDATE content_definitions
SET data = data || '{
  "action": "action",
  "usages": 1,
  "recovery": "long rest",
  "additional": ["1+CHA mod uses","1+CHA mod uses","1+CHA mod uses","1+CHA mod uses","1+CHA mod uses","1+CHA mod uses","1+CHA mod uses","1+CHA mod uses","1+CHA mod uses","1+CHA mod uses","1+CHA mod uses","1+CHA mod uses","1+CHA mod uses","1+CHA mod uses","1+CHA mod uses","1+CHA mod uses","1+CHA mod uses","1+CHA mod uses","1+CHA mod uses","1+CHA mod uses"],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'divine-sense'
  AND source = 'srd'
  AND scope = 'platform';

-- Lay on Hands: action, pool = 5 * paladin level, long rest
UPDATE content_definitions
SET data = data || '{
  "action": "action",
  "usages": [5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,100],
  "recovery": "long rest",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'lay-on-hands'
  AND source = 'srd'
  AND scope = 'platform';

-- Divine Smite: free (part of melee weapon attack), uses spell slots
-- 2d8 base + 1d8 per slot level above 1st, +1d8 vs undead/fiend (max 5d8)
UPDATE content_definitions
SET data = data || '{
  "action": "free",
  "additional": [null,"2d8 radiant",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'divine-smite'
  AND source = 'srd'
  AND scope = 'platform';

-- Aura of Protection: passive, CHA mod bonus to saves within 10 ft (30 ft at 18)
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "additional": [null,null,null,null,null,"10 ft aura","10 ft aura","10 ft aura","10 ft aura","10 ft aura","10 ft aura","10 ft aura","10 ft aura","10 ft aura","10 ft aura","10 ft aura","10 ft aura","30 ft aura","30 ft aura","30 ft aura"],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'aura-of-protection'
  AND source = 'srd'
  AND scope = 'platform';

-- Aura of Courage: passive, 10 ft (30 ft at 18), immune to frightened within aura
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'aura-of-courage'
  AND source = 'srd'
  AND scope = 'platform';

-- Improved Divine Smite: passive, +1d8 radiant on every melee hit
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "additional": [null,null,null,null,null,null,null,null,null,null,"+1d8 radiant",null,null,null,null,null,null,null,null,null],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'improved-divine-smite'
  AND source = 'srd'
  AND scope = 'platform';

-- Cleansing Touch: action, CHA modifier uses, long rest
UPDATE content_definitions
SET data = data || '{
  "action": "action",
  "usages": 1,
  "recovery": "long rest",
  "additional": ["CHA mod uses","CHA mod uses","CHA mod uses","CHA mod uses","CHA mod uses","CHA mod uses","CHA mod uses","CHA mod uses","CHA mod uses","CHA mod uses","CHA mod uses","CHA mod uses","CHA mod uses","CHA mod uses","CHA mod uses","CHA mod uses","CHA mod uses","CHA mod uses","CHA mod uses","CHA mod uses"],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'cleansing-touch'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- DRUID FEATURES
-- ============================================================================

-- Wild Shape (CR 1/4): action, 2 uses, short rest
UPDATE content_definitions
SET data = data || '{
  "action": "action",
  "usages": 2,
  "recovery": "short rest",
  "additional": [null,"CR 1/4 (no fly/swim)","CR 1/4 (no fly/swim)","CR 1/2 (no fly)","CR 1/2 (no fly)","CR 1/2 (no fly)","CR 1/2 (no fly)","CR 1","CR 1","CR 1","CR 1","CR 1","CR 1","CR 1","CR 1","CR 1","CR 1","CR 1","CR 1","CR 1"],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'wild-shape-cr-1-4-or-below-no-flying-or-swim-speed'
  AND source = 'srd'
  AND scope = 'platform';

-- Wild Shape (CR 1/2): same resource, higher CR
UPDATE content_definitions
SET data = data || '{
  "action": "action",
  "usages": 2,
  "recovery": "short rest",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'wild-shape-cr-1-2-or-below-no-flying-speed'
  AND source = 'srd'
  AND scope = 'platform';

-- Wild Shape (CR 1): same resource
UPDATE content_definitions
SET data = data || '{
  "action": "action",
  "usages": 2,
  "recovery": "short rest",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'wild-shape-cr-1-or-below'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- BARD FEATURES
-- ============================================================================

-- Bardic Inspiration d6: bonus action, CHA mod uses, long rest (short rest at 5+)
UPDATE content_definitions
SET data = data || '{
  "action": "bonus action",
  "usages": 1,
  "recovery": "long rest",
  "additional": ["d6","d6","d6","d6","d6","d6","d6","d6","d6","d6","d6","d6","d6","d6","d6","d6","d6","d6","d6","d6"],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'bardic-inspiration-d6'
  AND source = 'srd'
  AND scope = 'platform';

-- Bardic Inspiration d8
UPDATE content_definitions
SET data = data || '{
  "action": "bonus action",
  "usages": 1,
  "recovery": "short rest",
  "additional": [null,null,null,null,"d8","d8","d8","d8","d8","d8","d8","d8","d8","d8","d8","d8","d8","d8","d8","d8"],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'bardic-inspiration-d8'
  AND source = 'srd'
  AND scope = 'platform';

-- Bardic Inspiration d10
UPDATE content_definitions
SET data = data || '{
  "action": "bonus action",
  "usages": 1,
  "recovery": "short rest",
  "additional": [null,null,null,null,null,null,null,null,null,"d10","d10","d10","d10","d10","d10","d10","d10","d10","d10","d10"],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'bardic-inspiration-d10'
  AND source = 'srd'
  AND scope = 'platform';

-- Bardic Inspiration d12
UPDATE content_definitions
SET data = data || '{
  "action": "bonus action",
  "usages": 1,
  "recovery": "short rest",
  "additional": [null,null,null,null,null,null,null,null,null,null,null,null,null,null,"d12","d12","d12","d12","d12","d12"],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'bardic-inspiration-d12'
  AND source = 'srd'
  AND scope = 'platform';

-- Font of Inspiration: passive (changes Bardic Inspiration recovery to short rest at level 5)
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'font-of-inspiration'
  AND source = 'srd'
  AND scope = 'platform';

-- Jack of All Trades: passive, half proficiency to non-proficient checks
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'jack-of-all-trades'
  AND source = 'srd'
  AND scope = 'platform';

-- Countercharm: action
UPDATE content_definitions
SET data = data || '{
  "action": "action",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'countercharm'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- SORCERER FEATURES
-- ============================================================================

-- Font of Magic (Sorcery Points): resource pool = sorcerer level, long rest
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "usages": [null,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],
  "recovery": "long rest",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'font-of-magic'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- WIZARD FEATURES
-- ============================================================================

-- Arcane Recovery: 1 use, long rest, recover spell slots up to half wizard level (rounded up)
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "usages": 1,
  "recovery": "long rest",
  "additional": ["1 slot level","1 slot level","2 slot levels","2 slot levels","3 slot levels","3 slot levels","4 slot levels","4 slot levels","5 slot levels","5 slot levels","6 slot levels","6 slot levels","7 slot levels","7 slot levels","8 slot levels","8 slot levels","9 slot levels","9 slot levels","10 slot levels","10 slot levels"],
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'arcane-recovery'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- WARLOCK FEATURES
-- ============================================================================

-- Pact Magic: noted as feature, handled by spellcasting system
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'pact-magic'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- RANGER FEATURES
-- ============================================================================

-- Primeval Awareness: action, uses spell slot
UPDATE content_definitions
SET data = data || '{
  "action": "action",
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'primeval-awareness'
  AND source = 'srd'
  AND scope = 'platform';

-- Vanish: passive (Hide as bonus action, can't be tracked nonmagically)
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'vanish'
  AND source = 'srd'
  AND scope = 'platform';

-- Feral Senses: passive, no disadvantage attacking invisible creatures you can't see
UPDATE content_definitions
SET data = data || '{
  "action": null,
  "source_refs": [{"book": "SRD", "page": 0}]
}'::jsonb
WHERE content_type = 'feature'
  AND slug = 'feral-senses'
  AND source = 'srd'
  AND scope = 'platform';

COMMIT;
