-- Migration: Add mechanical effects to fighting styles with quantifiable bonuses
-- Defense: +1 AC while wearing armor

UPDATE content_definitions
SET effects = '[{"tag":"Class Feature","text":"While you are wearing armor, you gain a +1 bonus to AC.","type":"narrative"},{"type":"mechanical","stat":"armor_class","op":"add","value":1}]'::jsonb
WHERE slug LIKE '%-fighting-style-defense'
  AND content_type = 'feature'
  AND source = 'srd'
  AND scope = 'platform';
