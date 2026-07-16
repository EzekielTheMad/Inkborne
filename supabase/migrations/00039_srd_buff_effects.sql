-- Migration: SRD buff-spell enrichment for the M3 effects/durations system (T6).
--
-- Adds `effects[]` + `data.duration_structured` to the starter set of 12 SRD
-- buff spells so casting them (T5) / applying them from the Active Effects
-- widget produces mechanical consequences through the evaluator.
--
-- Conventions (design 2026-07-15-m3-gameplay-foundations-design.md §6.4):
--   - Stat-shaped consequences are `mechanical` effects the existing
--     evaluator already folds (add / max / tagged ac_formula with
--     state conditions — same vocabulary as equipped armor and Rage).
--   - Per-roll consequences (Bless/Bane/Guidance/Resistance) use the
--     roll-modifier convention: stat `roll_attack` / `roll_save` /
--     `roll_check` with a dice-string value, consumed by the roll layer
--     (T2/T3), ignored by the evaluator by design.
--   - Mechanics exceeding the effect vocabulary stay `narrative` — visible
--     on the sheet, honest about what is automated (design: "Haste-lite",
--     Enlarge/Reduce, Protection from Evil and Good, Heroism).
--   - `duration_structured` pre-parses the SRD duration string; the client
--     parser remains the fallback for unenriched spells.
--
-- Scope guard: platform SRD spells only. Idempotent: plain UPDATEs, safe to
-- re-run.

-- Bless (1st, concentration, 1 minute): +1d4 to attack rolls and saves.
update public.content_definitions
set
  effects = '[
    {"type":"mechanical","stat":"roll_attack","op":"add","value":"1d4","tag":"Bless"},
    {"type":"mechanical","stat":"roll_save","op":"add","value":"1d4","tag":"Bless"},
    {"type":"narrative","text":"Whenever you make an attack roll or a saving throw, roll a d4 and add the number rolled.","tag":"Spell Effect"}
  ]'::jsonb,
  data = data || '{"duration_structured":{"type":"minutes","value":1}}'::jsonb
where content_type = 'spell' and slug = 'bless'
  and source = 'srd' and scope = 'platform';

-- Bane (1st, concentration, 1 minute): -1d4 to attack rolls and saves
-- (applied to a character suffering the debuff).
update public.content_definitions
set
  effects = '[
    {"type":"mechanical","stat":"roll_attack","op":"add","value":"-1d4","tag":"Bane"},
    {"type":"mechanical","stat":"roll_save","op":"add","value":"-1d4","tag":"Bane"},
    {"type":"narrative","text":"Whenever you make an attack roll or a saving throw, roll a d4 and subtract the number rolled.","tag":"Spell Effect"}
  ]'::jsonb,
  data = data || '{"duration_structured":{"type":"minutes","value":1}}'::jsonb
where content_type = 'spell' and slug = 'bane'
  and source = 'srd' and scope = 'platform';

-- Mage Armor (1st, 8 hours): AC = 13 + DEX mod while unarmored.
-- Same ac_formula + equipped_armor condition mechanism as Unarmored Defense;
-- the evaluator's best-of AC selection handles the rest.
update public.content_definitions
set
  effects = '[
    {"type":"mechanical","stat":"armor_class","op":"formula","expr":"13 + mod(dexterity)","tag":"ac_formula","condition":{"field":"equipped_armor","op":"eq","value":"none"}},
    {"type":"narrative","text":"Base AC becomes 13 + Dexterity modifier while you wear no armor. Ends if you don armor.","tag":"Spell Effect"}
  ]'::jsonb,
  data = data || '{"duration_structured":{"type":"hours","value":8}}'::jsonb
where content_type = 'spell' and slug = 'mage-armor'
  and source = 'srd' and scope = 'platform';

-- Shield (1st, reaction, 1 round): +5 AC.
update public.content_definitions
set
  effects = '[
    {"type":"mechanical","stat":"armor_class","op":"add","value":5},
    {"type":"narrative","text":"+5 bonus to AC, including against the triggering attack. No damage from Magic Missile.","tag":"Spell Effect"}
  ]'::jsonb,
  data = data || '{"duration_structured":{"type":"rounds","value":1}}'::jsonb
where content_type = 'spell' and slug = 'shield'
  and source = 'srd' and scope = 'platform';

-- Shield of Faith (1st, concentration, 10 minutes): +2 AC.
update public.content_definitions
set
  effects = '[
    {"type":"mechanical","stat":"armor_class","op":"add","value":2},
    {"type":"narrative","text":"A shimmering field grants a +2 bonus to AC for the duration.","tag":"Spell Effect"}
  ]'::jsonb,
  data = data || '{"duration_structured":{"type":"minutes","value":10}}'::jsonb
where content_type = 'spell' and slug = 'shield-of-faith'
  and source = 'srd' and scope = 'platform';

-- Guidance (cantrip, concentration, 1 minute): +1d4 to one ability check.
update public.content_definitions
set
  effects = '[
    {"type":"mechanical","stat":"roll_check","op":"add","value":"1d4","tag":"Guidance"},
    {"type":"narrative","text":"Once before the spell ends, roll a d4 and add the number rolled to one ability check of your choice.","tag":"Spell Effect"}
  ]'::jsonb,
  data = data || '{"duration_structured":{"type":"minutes","value":1}}'::jsonb
where content_type = 'spell' and slug = 'guidance'
  and source = 'srd' and scope = 'platform';

-- Resistance (cantrip, concentration, 1 minute): +1d4 to one saving throw.
update public.content_definitions
set
  effects = '[
    {"type":"mechanical","stat":"roll_save","op":"add","value":"1d4","tag":"Resistance"},
    {"type":"narrative","text":"Once before the spell ends, roll a d4 and add the number rolled to one saving throw of your choice.","tag":"Spell Effect"}
  ]'::jsonb,
  data = data || '{"duration_structured":{"type":"minutes","value":1}}'::jsonb
where content_type = 'spell' and slug = 'resistance'
  and source = 'srd' and scope = 'platform';

-- Haste (3rd, concentration, 1 minute): +2 AC is mechanical; doubled speed,
-- DEX-save advantage, and the extra action stay narrative ("Haste-lite").
update public.content_definitions
set
  effects = '[
    {"type":"mechanical","stat":"armor_class","op":"add","value":2},
    {"type":"narrative","text":"Speed is doubled, advantage on Dexterity saving throws, and one additional action each turn (Attack [one weapon attack only], Dash, Disengage, Hide, or Use an Object). When the spell ends: no move or actions until after your next turn.","tag":"Spell Effect"}
  ]'::jsonb,
  data = data || '{"duration_structured":{"type":"minutes","value":1}}'::jsonb
where content_type = 'spell' and slug = 'haste'
  and source = 'srd' and scope = 'platform';

-- Barkskin (2nd, concentration, 1 hour): AC cannot be less than 16.
update public.content_definitions
set
  effects = '[
    {"type":"mechanical","stat":"armor_class","op":"max","value":16},
    {"type":"narrative","text":"AC cannot be less than 16, regardless of what kind of armor is worn.","tag":"Spell Effect"}
  ]'::jsonb,
  data = data || '{"duration_structured":{"type":"hours","value":1}}'::jsonb
where content_type = 'spell' and slug = 'barkskin'
  and source = 'srd' and scope = 'platform';

-- Heroism (1st, concentration, 1 minute): narrative only (temp HP each turn
-- and the frightened immunity exceed the effect vocabulary).
update public.content_definitions
set
  effects = '[
    {"type":"narrative","text":"Immune to being frightened; gain temporary hit points equal to the caster''s spellcasting ability modifier at the start of each of your turns.","tag":"Spell Effect"}
  ]'::jsonb,
  data = data || '{"duration_structured":{"type":"minutes","value":1}}'::jsonb
where content_type = 'spell' and slug = 'heroism'
  and source = 'srd' and scope = 'platform';

-- Enlarge/Reduce (2nd, concentration, 1 minute): narrative only.
update public.content_definitions
set
  effects = '[
    {"type":"narrative","text":"Enlarge: size doubles, advantage on Strength checks and saves, +1d4 weapon damage. Reduce: size halves, disadvantage on Strength checks and saves, -1d4 weapon damage.","tag":"Spell Effect"}
  ]'::jsonb,
  data = data || '{"duration_structured":{"type":"minutes","value":1}}'::jsonb
where content_type = 'spell' and slug = 'enlarge-reduce'
  and source = 'srd' and scope = 'platform';

-- Protection from Evil and Good (1st, concentration, 10 minutes): narrative only.
update public.content_definitions
set
  effects = '[
    {"type":"narrative","text":"Aberrations, celestials, elementals, fey, fiends, and undead have disadvantage on attacks against you; you cannot be charmed, frightened, or possessed by them.","tag":"Spell Effect"}
  ]'::jsonb,
  data = data || '{"duration_structured":{"type":"minutes","value":10}}'::jsonb
where content_type = 'spell' and slug = 'protection-from-evil-and-good'
  and source = 'srd' and scope = 'platform';
