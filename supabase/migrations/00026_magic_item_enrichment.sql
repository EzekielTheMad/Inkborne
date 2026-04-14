-- Migration: Enrich SRD magic items with requires_attunement flag and mechanical effects
-- Adds requires_attunement to data jsonb for all 362 SRD magic items
-- Adds mechanical/grant effects to ~60 items with quantifiable bonuses

BEGIN;

-- ============================================================
-- Step 1: Add requires_attunement flag to ALL 362 magic items
-- ============================================================

-- Set requires_attunement = true for items whose description contains "requires attunement"
UPDATE content_definitions
SET data = data || '{"requires_attunement": true}'::jsonb
WHERE content_type = 'magic_item' AND source = 'srd' AND scope = 'platform'
AND data->>'description' ILIKE '%requires attunement%';

-- Set requires_attunement = false for everything else
UPDATE content_definitions
SET data = data || '{"requires_attunement": false}'::jsonb
WHERE content_type = 'magic_item' AND source = 'srd' AND scope = 'platform'
AND (data->>'requires_attunement') IS NULL;

-- ============================================================
-- Step 2: +X Weapons (attack + damage bonus)
-- ============================================================

UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"attack_bonus","op":"add","value":1},{"type":"mechanical","stat":"damage_bonus","op":"add","value":1}]'::jsonb
WHERE slug = 'weapon-1' AND content_type = 'magic_item' AND source = 'srd';

UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"attack_bonus","op":"add","value":2},{"type":"mechanical","stat":"damage_bonus","op":"add","value":2}]'::jsonb
WHERE slug = 'weapon-2' AND content_type = 'magic_item' AND source = 'srd';

UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"attack_bonus","op":"add","value":3},{"type":"mechanical","stat":"damage_bonus","op":"add","value":3}]'::jsonb
WHERE slug = 'weapon-3' AND content_type = 'magic_item' AND source = 'srd';

-- ============================================================
-- Step 3: +X Armor (AC bonus)
-- ============================================================

UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"armor_class","op":"add","value":1}]'::jsonb
WHERE slug = 'armor-1' AND content_type = 'magic_item' AND source = 'srd';

UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"armor_class","op":"add","value":2}]'::jsonb
WHERE slug = 'armor-2' AND content_type = 'magic_item' AND source = 'srd';

UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"armor_class","op":"add","value":3}]'::jsonb
WHERE slug = 'armor-3' AND content_type = 'magic_item' AND source = 'srd';

-- ============================================================
-- Step 4: +X Ammunition (attack + damage bonus)
-- ============================================================

UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"attack_bonus","op":"add","value":1},{"type":"mechanical","stat":"damage_bonus","op":"add","value":1}]'::jsonb
WHERE slug = 'ammunition-1' AND content_type = 'magic_item' AND source = 'srd';

UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"attack_bonus","op":"add","value":2},{"type":"mechanical","stat":"damage_bonus","op":"add","value":2}]'::jsonb
WHERE slug = 'ammunition-2' AND content_type = 'magic_item' AND source = 'srd';

UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"attack_bonus","op":"add","value":3},{"type":"mechanical","stat":"damage_bonus","op":"add","value":3}]'::jsonb
WHERE slug = 'ammunition-3' AND content_type = 'magic_item' AND source = 'srd';

-- ============================================================
-- Step 5: Wand of the War Mage (spell attack bonus)
-- ============================================================

UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"spell_attack_bonus","op":"add","value":1}]'::jsonb
WHERE slug = 'wand-of-the-war-mage-1' AND content_type = 'magic_item' AND source = 'srd';

UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"spell_attack_bonus","op":"add","value":2}]'::jsonb
WHERE slug = 'wand-of-the-war-mage-2' AND content_type = 'magic_item' AND source = 'srd';

UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"spell_attack_bonus","op":"add","value":3}]'::jsonb
WHERE slug = 'wand-of-the-war-mage-3' AND content_type = 'magic_item' AND source = 'srd';

-- ============================================================
-- Step 6: Stat-setting items
-- ============================================================

-- Amulet of Health: CON = 19
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"constitution","op":"set","value":19}]'::jsonb
WHERE slug = 'amulet-of-health' AND content_type = 'magic_item' AND source = 'srd';

-- Gauntlets of Ogre Power: STR = 19
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"strength","op":"set","value":19}]'::jsonb
WHERE slug = 'gauntlets-of-ogre-power' AND content_type = 'magic_item' AND source = 'srd';

-- Headband of Intellect: INT = 19
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"intelligence","op":"set","value":19}]'::jsonb
WHERE slug = 'headband-of-intellect' AND content_type = 'magic_item' AND source = 'srd';

-- Belt of Hill Giant Strength: STR = 21
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"strength","op":"set","value":21}]'::jsonb
WHERE slug = 'belt-of-giant-strength-hill' AND content_type = 'magic_item' AND source = 'srd';

-- Belt of Frost Giant Strength: STR = 23
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"strength","op":"set","value":23}]'::jsonb
WHERE slug = 'belt-of-giant-strength-frost' AND content_type = 'magic_item' AND source = 'srd';

-- Belt of Stone Giant Strength: STR = 23
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"strength","op":"set","value":23}]'::jsonb
WHERE slug = 'belt-of-giant-strength-stone' AND content_type = 'magic_item' AND source = 'srd';

-- Belt of Fire Giant Strength: STR = 25
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"strength","op":"set","value":25}]'::jsonb
WHERE slug = 'belt-of-giant-strength-fire' AND content_type = 'magic_item' AND source = 'srd';

-- Belt of Cloud Giant Strength: STR = 27
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"strength","op":"set","value":27}]'::jsonb
WHERE slug = 'belt-of-giant-strength-cloud' AND content_type = 'magic_item' AND source = 'srd';

-- Belt of Storm Giant Strength: STR = 29
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"strength","op":"set","value":29}]'::jsonb
WHERE slug = 'belt-of-giant-strength-storm' AND content_type = 'magic_item' AND source = 'srd';

-- ============================================================
-- Step 7: AC/Save bonus items
-- ============================================================

-- Cloak of Protection: +1 AC, +1 saves
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"armor_class","op":"add","value":1},{"type":"mechanical","stat":"saving_throw_bonus","op":"add","value":1}]'::jsonb
WHERE slug = 'cloak-of-protection' AND content_type = 'magic_item' AND source = 'srd';

-- Ring of Protection: +1 AC, +1 saves
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"armor_class","op":"add","value":1},{"type":"mechanical","stat":"saving_throw_bonus","op":"add","value":1}]'::jsonb
WHERE slug = 'ring-of-protection' AND content_type = 'magic_item' AND source = 'srd';

-- Bracers of Defense: +2 AC (no armor/shield)
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"armor_class","op":"add","value":2,"condition":[{"field":"equipped_armor","op":"eq","value":"none"},{"field":"shield_equipped","op":"eq","value":false}]}]'::jsonb
WHERE slug = 'bracers-of-defense' AND content_type = 'magic_item' AND source = 'srd';

-- Ioun Stone of Protection: +1 AC
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"armor_class","op":"add","value":1}]'::jsonb
WHERE slug = 'ioun-stone-of-protection' AND content_type = 'magic_item' AND source = 'srd';

-- Bracers of Archery: +2 damage with ranged weapons
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"ranged_damage_bonus","op":"add","value":2}]'::jsonb
WHERE slug = 'bracers-of-archery' AND content_type = 'magic_item' AND source = 'srd';

-- Stone of Good Luck: +1 to ability checks and saves
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"ability_check_bonus","op":"add","value":1},{"type":"mechanical","stat":"saving_throw_bonus","op":"add","value":1}]'::jsonb
WHERE slug = 'stone-of-good-luck-luckstone' AND content_type = 'magic_item' AND source = 'srd';

-- Ioun Stone of Mastery: +1 proficiency bonus
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"proficiency_bonus","op":"add","value":1}]'::jsonb
WHERE slug = 'ioun-stone-of-mastery' AND content_type = 'magic_item' AND source = 'srd';

-- ============================================================
-- Step 8: Ioun Stones that boost stats (+2, up to 20)
-- ============================================================

-- Ioun Stone of Agility: DEX +2
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"dexterity","op":"add","value":2}]'::jsonb
WHERE slug = 'ioun-stone-of-agility' AND content_type = 'magic_item' AND source = 'srd';

-- Ioun Stone of Fortitude: CON +2
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"constitution","op":"add","value":2}]'::jsonb
WHERE slug = 'ioun-stone-of-fortitude' AND content_type = 'magic_item' AND source = 'srd';

-- Ioun Stone of Insight: WIS +2
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"wisdom","op":"add","value":2}]'::jsonb
WHERE slug = 'ioun-stone-of-insight' AND content_type = 'magic_item' AND source = 'srd';

-- Ioun Stone of Intellect: INT +2
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"intelligence","op":"add","value":2}]'::jsonb
WHERE slug = 'ioun-stone-of-intellect' AND content_type = 'magic_item' AND source = 'srd';

-- Ioun Stone of Leadership: CHA +2
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"charisma","op":"add","value":2}]'::jsonb
WHERE slug = 'ioun-stone-of-leadership' AND content_type = 'magic_item' AND source = 'srd';

-- Ioun Stone of Strength: STR +2
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"strength","op":"add","value":2}]'::jsonb
WHERE slug = 'ioun-stone-of-strength' AND content_type = 'magic_item' AND source = 'srd';

-- ============================================================
-- Step 9: Resistance rings
-- ============================================================

UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"acid"}]'::jsonb WHERE slug = 'ring-of-resistance-acid' AND content_type = 'magic_item' AND source = 'srd';
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"cold"}]'::jsonb WHERE slug = 'ring-of-resistance-cold' AND content_type = 'magic_item' AND source = 'srd';
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"fire"}]'::jsonb WHERE slug = 'ring-of-resistance-fire' AND content_type = 'magic_item' AND source = 'srd';
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"force"}]'::jsonb WHERE slug = 'ring-of-resistance-force' AND content_type = 'magic_item' AND source = 'srd';
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"lightning"}]'::jsonb WHERE slug = 'ring-of-resistance-lightning' AND content_type = 'magic_item' AND source = 'srd';
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"necrotic"}]'::jsonb WHERE slug = 'ring-of-resistance-necrotic' AND content_type = 'magic_item' AND source = 'srd';
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"poison"}]'::jsonb WHERE slug = 'ring-of-resistance-poison' AND content_type = 'magic_item' AND source = 'srd';
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"psychic"}]'::jsonb WHERE slug = 'ring-of-resistance-psychic' AND content_type = 'magic_item' AND source = 'srd';
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"radiant"}]'::jsonb WHERE slug = 'ring-of-resistance-radiant' AND content_type = 'magic_item' AND source = 'srd';
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"thunder"}]'::jsonb WHERE slug = 'ring-of-resistance-thunder' AND content_type = 'magic_item' AND source = 'srd';

-- ============================================================
-- Step 10: Dragon Scale Mail resistance
-- ============================================================

UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"acid"}]'::jsonb WHERE slug = 'dragon-scale-mail-black' AND content_type = 'magic_item' AND source = 'srd';
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"lightning"}]'::jsonb WHERE slug = 'dragon-scale-mail-blue' AND content_type = 'magic_item' AND source = 'srd';
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"fire"}]'::jsonb WHERE slug = 'dragon-scale-mail-brass' AND content_type = 'magic_item' AND source = 'srd';
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"lightning"}]'::jsonb WHERE slug = 'dragon-scale-mail-bronze' AND content_type = 'magic_item' AND source = 'srd';
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"acid"}]'::jsonb WHERE slug = 'dragon-scale-mail-copper' AND content_type = 'magic_item' AND source = 'srd';
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"fire"}]'::jsonb WHERE slug = 'dragon-scale-mail-gold' AND content_type = 'magic_item' AND source = 'srd';
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"poison"}]'::jsonb WHERE slug = 'dragon-scale-mail-green' AND content_type = 'magic_item' AND source = 'srd';
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"fire"}]'::jsonb WHERE slug = 'dragon-scale-mail-red' AND content_type = 'magic_item' AND source = 'srd';
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"cold"}]'::jsonb WHERE slug = 'dragon-scale-mail-silver' AND content_type = 'magic_item' AND source = 'srd';
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"cold"}]'::jsonb WHERE slug = 'dragon-scale-mail-white' AND content_type = 'magic_item' AND source = 'srd';

-- ============================================================
-- Step 11: Other notable items
-- ============================================================

-- Frost Brand: fire resistance + extra cold damage
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"fire"}]'::jsonb
WHERE slug = 'frost-brand' AND content_type = 'magic_item' AND source = 'srd';

-- Staff of Striking: +3 attack/damage
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"attack_bonus","op":"add","value":3},{"type":"mechanical","stat":"damage_bonus","op":"add","value":3}]'::jsonb
WHERE slug = 'staff-of-striking' AND content_type = 'magic_item' AND source = 'srd';

-- Brooch of Shielding: force resistance
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"force"}]'::jsonb
WHERE slug = 'brooch-of-shielding' AND content_type = 'magic_item' AND source = 'srd';

-- Ring of Warmth: cold resistance
UPDATE content_definitions SET effects = '[{"type":"grant","stat":"dmgres","value":"cold"}]'::jsonb
WHERE slug = 'ring-of-warmth' AND content_type = 'magic_item' AND source = 'srd';

-- Demon Armor: +1 AC
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"armor_class","op":"add","value":1}]'::jsonb
WHERE slug = 'demon-armor' AND content_type = 'magic_item' AND source = 'srd';

-- Glamoured Studded Leather: +1 AC
UPDATE content_definitions SET effects = '[{"type":"mechanical","stat":"armor_class","op":"add","value":1}]'::jsonb
WHERE slug = 'glamoured-studded-leather-armor' AND content_type = 'magic_item' AND source = 'srd';

COMMIT;
