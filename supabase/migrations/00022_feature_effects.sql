BEGIN;

-- ============================================================================
-- FIGHTING STYLES — Defense: condition = wearing armor
-- Remove old unconditional +1 AC effects and add conditioned ones
-- ============================================================================

-- First remove old unconditional AC effects from defense styles
UPDATE content_definitions
SET effects = (
  SELECT coalesce(jsonb_agg(e), '[]'::jsonb)
  FROM jsonb_array_elements(effects) AS e
  WHERE NOT (e->>'type' = 'mechanical' AND e->>'stat' = 'armor_class')
)
WHERE slug LIKE '%-fighting-style-defense'
  AND content_type = 'feature' AND source = 'srd' AND scope = 'platform';

UPDATE content_definitions
SET effects = (
  SELECT coalesce(jsonb_agg(e), '[]'::jsonb)
  FROM jsonb_array_elements(effects) AS e
  WHERE NOT (e->>'type' = 'mechanical' AND e->>'stat' = 'armor_class')
)
WHERE slug = 'fighting-style-defense'
  AND content_type = 'feature' AND source = 'srd' AND scope = 'platform';

-- Now add conditional +1 AC (requires wearing armor)
UPDATE content_definitions
SET effects = effects || '[{"type":"mechanical","stat":"armor_class","op":"add","value":1,"condition":{"field":"equipped_armor","op":"neq","value":"none"}}]'::jsonb
WHERE (slug LIKE '%-fighting-style-defense' OR slug = 'fighting-style-defense')
  AND content_type = 'feature' AND source = 'srd' AND scope = 'platform';

-- ============================================================================
-- UNARMORED DEFENSE
-- ============================================================================

-- Barbarian: AC = 10 + DEX mod + CON mod (no armor, shield OK)
UPDATE content_definitions
SET effects = effects || '[{"type":"mechanical","stat":"armor_class","op":"formula","expr":"10 + mod(dexterity) + mod(constitution)","tag":"ac_formula","condition":{"field":"equipped_armor","op":"eq","value":"none"}}]'::jsonb
WHERE slug = 'barbarian-unarmored-defense'
  AND content_type = 'feature' AND source = 'srd' AND scope = 'platform';

-- Monk: AC = 10 + DEX mod + WIS mod (no armor, no shield)
UPDATE content_definitions
SET effects = effects || '[{"type":"mechanical","stat":"armor_class","op":"formula","expr":"10 + mod(dexterity) + mod(wisdom)","tag":"ac_formula","condition":[{"field":"equipped_armor","op":"eq","value":"none"},{"field":"shield_equipped","op":"eq","value":false}]}]'::jsonb
WHERE slug = 'monk-unarmored-defense'
  AND content_type = 'feature' AND source = 'srd' AND scope = 'platform';

-- ============================================================================
-- DRACONIC RESILIENCE (Sorcerer) — AC = 13 + DEX mod when unarmored
-- ============================================================================

UPDATE content_definitions
SET effects = effects || '[{"type":"mechanical","stat":"armor_class","op":"formula","expr":"13 + mod(dexterity)","tag":"ac_formula","condition":{"field":"equipped_armor","op":"eq","value":"none"}}]'::jsonb
WHERE slug = 'draconic-resilience'
  AND content_type = 'feature' AND source = 'srd' AND scope = 'platform';

-- ============================================================================
-- SPEED BONUSES
-- ============================================================================

-- Fast Movement (Barbarian L5): +10 speed, not heavy armor
UPDATE content_definitions
SET effects = effects || '[{"type":"mechanical","stat":"movement_speed","op":"add","value":10,"condition":{"field":"equipped_armor","op":"neq","value":"heavy"}}]'::jsonb
WHERE slug = 'fast-movement'
  AND content_type = 'feature' AND source = 'srd' AND scope = 'platform';

-- Unarmored Movement (Monk L2): +10 speed, no armor no shield
UPDATE content_definitions
SET effects = effects || '[{"type":"mechanical","stat":"movement_speed","op":"add","value":10,"condition":[{"field":"equipped_armor","op":"eq","value":"none"},{"field":"shield_equipped","op":"eq","value":false}]}]'::jsonb
WHERE slug = 'unarmored-movement-1'
  AND content_type = 'feature' AND source = 'srd' AND scope = 'platform';

-- ============================================================================
-- SAVING THROW PROFICIENCIES
-- ============================================================================

-- Slippery Mind (Rogue L15): WIS save proficiency
UPDATE content_definitions
SET effects = effects || '[{"type":"grant","stat":"saving_throw_wisdom","value":"proficient"}]'::jsonb
WHERE slug = 'slippery-mind'
  AND content_type = 'feature' AND source = 'srd' AND scope = 'platform';

-- Diamond Soul (Monk L14): all 6 save proficiencies
UPDATE content_definitions
SET effects = effects || '[{"type":"grant","stat":"saving_throw_strength","value":"proficient"},{"type":"grant","stat":"saving_throw_dexterity","value":"proficient"},{"type":"grant","stat":"saving_throw_constitution","value":"proficient"},{"type":"grant","stat":"saving_throw_intelligence","value":"proficient"},{"type":"grant","stat":"saving_throw_wisdom","value":"proficient"},{"type":"grant","stat":"saving_throw_charisma","value":"proficient"}]'::jsonb
WHERE slug = 'diamond-soul'
  AND content_type = 'feature' AND source = 'srd' AND scope = 'platform';

-- ============================================================================
-- RAGE (Barbarian) — conditional on rage_active
-- Resistance to bludgeoning/piercing/slashing while raging
-- ============================================================================

UPDATE content_definitions
SET effects = effects || '[{"type":"grant","stat":"dmgres","value":"bludgeoning","condition":{"field":"rage_active","op":"eq","value":true}},{"type":"grant","stat":"dmgres","value":"piercing","condition":{"field":"rage_active","op":"eq","value":true}},{"type":"grant","stat":"dmgres","value":"slashing","condition":{"field":"rage_active","op":"eq","value":true}}]'::jsonb
WHERE slug = 'rage'
  AND content_type = 'feature' AND source = 'srd' AND scope = 'platform';

COMMIT;
