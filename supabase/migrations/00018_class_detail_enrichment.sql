-- Migration: Enrich SRD classes with Phase 3 fields
-- Source: D&D 5e SRD + MPMB ListsClasses.js
-- Fields: primaryAbility, subclassLabel, equipment, skillstxt, armorProfs, weaponProfs, toolProfs
-- Pattern: jsonb merge (data = data || '{...}'::jsonb) — idempotent

BEGIN;

-- ============================================================================
-- Barbarian: STR primary, Primal Path
-- Armor: light, medium, shields (multiclass: shields only)
-- Weapons: simple, martial (multiclass: none extra)
-- ============================================================================
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'primaryAbility', 'Strength',
  'subclassLabel', 'Primal Path',
  'skillstxt', 'Choose two from Animal Handling, Athletics, Intimidation, Nature, Perception, and Survival',
  'equipment', 'A greataxe or any martial melee weapon; two handaxes or any simple weapon; an explorer''s pack and four javelins',
  'armorProfs', jsonb_build_object(
    'primary', '["light", "medium", "shields"]'::jsonb,
    'secondary', '["shields"]'::jsonb
  ),
  'weaponProfs', jsonb_build_object(
    'primary', '["simple", "martial"]'::jsonb,
    'secondary', '[]'::jsonb
  ),
  'toolProfs', '[]'::jsonb
)
WHERE content_type = 'class'
  AND slug = 'barbarian'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- Bard: CHA primary, Bard College
-- Armor: light (multiclass: light)
-- Weapons: simple, hand crossbows, longswords, rapiers, shortswords (multiclass: none)
-- Tools: three musical instruments of your choice
-- ============================================================================
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'primaryAbility', 'Charisma',
  'subclassLabel', 'Bard College',
  'skillstxt', 'Choose any three skills',
  'equipment', 'A rapier, a longsword, or any simple weapon; a diplomat''s pack or an entertainer''s pack; a lute or any other musical instrument',
  'armorProfs', jsonb_build_object(
    'primary', '["light"]'::jsonb,
    'secondary', '["light"]'::jsonb
  ),
  'weaponProfs', jsonb_build_object(
    'primary', '["simple", "hand-crossbow", "longsword", "rapier", "shortsword"]'::jsonb,
    'secondary', '[]'::jsonb
  ),
  'toolProfs', '[{"choose": 3, "from": "musical instruments"}]'::jsonb
)
WHERE content_type = 'class'
  AND slug = 'bard'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- Cleric: WIS primary, Divine Domain
-- Armor: light, medium, shields (multiclass: light, medium, shields)
-- Weapons: simple (multiclass: none)
-- ============================================================================
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'primaryAbility', 'Wisdom',
  'subclassLabel', 'Divine Domain',
  'skillstxt', 'Choose two from History, Insight, Medicine, Persuasion, and Religion',
  'equipment', 'A mace or a warhammer (if proficient); scale mail, leather armor, or chain mail (if proficient); a light crossbow and 20 bolts or any simple weapon; a priest''s pack or an explorer''s pack; a shield and a holy symbol',
  'armorProfs', jsonb_build_object(
    'primary', '["light", "medium", "shields"]'::jsonb,
    'secondary', '["light", "medium", "shields"]'::jsonb
  ),
  'weaponProfs', jsonb_build_object(
    'primary', '["simple"]'::jsonb,
    'secondary', '[]'::jsonb
  ),
  'toolProfs', '[]'::jsonb
)
WHERE content_type = 'class'
  AND slug = 'cleric'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- Druid: WIS primary, Druid Circle
-- Armor: light, medium, shields (nonmetal only) (multiclass: light, medium, shields)
-- Weapons: clubs, daggers, darts, javelins, maces, quarterstaffs, scimitars, sickles, slings, spears (multiclass: none)
-- Tools: herbalism kit
-- ============================================================================
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'primaryAbility', 'Wisdom',
  'subclassLabel', 'Druid Circle',
  'skillstxt', 'Choose two from Arcana, Animal Handling, Insight, Medicine, Nature, Perception, Religion, and Survival',
  'equipment', 'A wooden shield or any simple weapon; a scimitar or any simple melee weapon; leather armor, an explorer''s pack, and a druidic focus',
  'armorProfs', jsonb_build_object(
    'primary', '["light", "medium", "shields"]'::jsonb,
    'secondary', '["light", "medium", "shields"]'::jsonb
  ),
  'weaponProfs', jsonb_build_object(
    'primary', '["club", "dagger", "dart", "javelin", "mace", "quarterstaff", "scimitar", "sickle", "sling", "spear"]'::jsonb,
    'secondary', '[]'::jsonb
  ),
  'toolProfs', '["herbalism-kit"]'::jsonb
)
WHERE content_type = 'class'
  AND slug = 'druid'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- Fighter: STR or DEX primary, Martial Archetype
-- Armor: all armor, shields (multiclass: light, medium, shields)
-- Weapons: simple, martial (multiclass: simple, martial)
-- ============================================================================
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'primaryAbility', 'Strength or Dexterity',
  'subclassLabel', 'Martial Archetype',
  'skillstxt', 'Choose two from Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Perception, and Survival',
  'equipment', 'Chain mail or leather armor, a longbow, and 20 arrows; a martial weapon and a shield or two martial weapons; a light crossbow and 20 bolts or two handaxes; a dungeoneer''s pack or an explorer''s pack',
  'armorProfs', jsonb_build_object(
    'primary', '["light", "medium", "heavy", "shields"]'::jsonb,
    'secondary', '["light", "medium", "shields"]'::jsonb
  ),
  'weaponProfs', jsonb_build_object(
    'primary', '["simple", "martial"]'::jsonb,
    'secondary', '["simple", "martial"]'::jsonb
  ),
  'toolProfs', '[]'::jsonb
)
WHERE content_type = 'class'
  AND slug = 'fighter'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- Monk: DEX & WIS primary, Monastic Tradition
-- Armor: none (multiclass: none)
-- Weapons: simple, shortswords (multiclass: simple, shortswords)
-- ============================================================================
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'primaryAbility', 'Dexterity & Wisdom',
  'subclassLabel', 'Monastic Tradition',
  'skillstxt', 'Choose two from Acrobatics, Athletics, History, Insight, Religion, and Stealth',
  'equipment', 'A shortsword or any simple weapon; a dungeoneer''s pack or an explorer''s pack; 10 darts',
  'armorProfs', jsonb_build_object(
    'primary', '[]'::jsonb,
    'secondary', '[]'::jsonb
  ),
  'weaponProfs', jsonb_build_object(
    'primary', '["simple", "shortsword"]'::jsonb,
    'secondary', '["simple", "shortsword"]'::jsonb
  ),
  'toolProfs', '[{"choose": 1, "from": ["any artisan tool", "any musical instrument"]}]'::jsonb
)
WHERE content_type = 'class'
  AND slug = 'monk'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- Paladin: STR & CHA primary, Sacred Oath
-- Armor: all armor, shields (multiclass: light, medium, shields)
-- Weapons: simple, martial (multiclass: simple, martial)
-- ============================================================================
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'primaryAbility', 'Strength & Charisma',
  'subclassLabel', 'Sacred Oath',
  'skillstxt', 'Choose two from Athletics, Insight, Intimidation, Medicine, Persuasion, and Religion',
  'equipment', 'A martial weapon and a shield or two martial weapons; five javelins or any simple melee weapon; a priest''s pack or an explorer''s pack; chain mail and a holy symbol',
  'armorProfs', jsonb_build_object(
    'primary', '["light", "medium", "heavy", "shields"]'::jsonb,
    'secondary', '["light", "medium", "shields"]'::jsonb
  ),
  'weaponProfs', jsonb_build_object(
    'primary', '["simple", "martial"]'::jsonb,
    'secondary', '["simple", "martial"]'::jsonb
  ),
  'toolProfs', '[]'::jsonb
)
WHERE content_type = 'class'
  AND slug = 'paladin'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- Ranger: DEX & WIS primary, Ranger Archetype
-- Armor: light, medium, shields (multiclass: light, medium, shields)
-- Weapons: simple, martial (multiclass: simple, martial)
-- ============================================================================
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'primaryAbility', 'Dexterity & Wisdom',
  'subclassLabel', 'Ranger Archetype',
  'skillstxt', 'Choose three from Animal Handling, Athletics, Insight, Investigation, Nature, Perception, Stealth, and Survival',
  'equipment', 'Scale mail or leather armor; two shortswords or two simple melee weapons; a dungeoneer''s pack or an explorer''s pack; a longbow and a quiver of 20 arrows',
  'armorProfs', jsonb_build_object(
    'primary', '["light", "medium", "shields"]'::jsonb,
    'secondary', '["light", "medium", "shields"]'::jsonb
  ),
  'weaponProfs', jsonb_build_object(
    'primary', '["simple", "martial"]'::jsonb,
    'secondary', '["simple", "martial"]'::jsonb
  ),
  'toolProfs', '[]'::jsonb
)
WHERE content_type = 'class'
  AND slug = 'ranger'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- Rogue: DEX primary, Roguish Archetype
-- Armor: light (multiclass: light)
-- Weapons: simple, hand crossbows, longswords, rapiers, shortswords (multiclass: none)
-- Tools: thieves' tools
-- ============================================================================
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'primaryAbility', 'Dexterity',
  'subclassLabel', 'Roguish Archetype',
  'skillstxt', 'Choose four from Acrobatics, Athletics, Deception, Insight, Intimidation, Investigation, Perception, Performance, Persuasion, Sleight of Hand, and Stealth',
  'equipment', 'A rapier or a shortsword; a shortbow and a quiver of 20 arrows or a shortsword; a burglar''s pack, a dungeoneer''s pack, or an explorer''s pack; leather armor, two daggers, and thieves'' tools',
  'armorProfs', jsonb_build_object(
    'primary', '["light"]'::jsonb,
    'secondary', '["light"]'::jsonb
  ),
  'weaponProfs', jsonb_build_object(
    'primary', '["simple", "hand-crossbow", "longsword", "rapier", "shortsword"]'::jsonb,
    'secondary', '[]'::jsonb
  ),
  'toolProfs', '["thieves-tools"]'::jsonb
)
WHERE content_type = 'class'
  AND slug = 'rogue'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- Sorcerer: CHA primary, Sorcerous Origin
-- Armor: none (multiclass: none)
-- Weapons: daggers, darts, slings, quarterstaffs, light crossbows (multiclass: none)
-- ============================================================================
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'primaryAbility', 'Charisma',
  'subclassLabel', 'Sorcerous Origin',
  'skillstxt', 'Choose two from Arcana, Deception, Insight, Intimidation, Persuasion, and Religion',
  'equipment', 'A light crossbow and 20 bolts or any simple weapon; a component pouch or an arcane focus; a dungeoneer''s pack or an explorer''s pack; two daggers',
  'armorProfs', jsonb_build_object(
    'primary', '[]'::jsonb,
    'secondary', '[]'::jsonb
  ),
  'weaponProfs', jsonb_build_object(
    'primary', '["dagger", "dart", "sling", "quarterstaff", "light-crossbow"]'::jsonb,
    'secondary', '[]'::jsonb
  ),
  'toolProfs', '[]'::jsonb
)
WHERE content_type = 'class'
  AND slug = 'sorcerer'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- Warlock: CHA primary, Otherworldly Patron
-- Armor: light (multiclass: light)
-- Weapons: simple (multiclass: none)
-- ============================================================================
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'primaryAbility', 'Charisma',
  'subclassLabel', 'Otherworldly Patron',
  'skillstxt', 'Choose two from Arcana, Deception, History, Intimidation, Investigation, Nature, and Religion',
  'equipment', 'A light crossbow and 20 bolts or any simple weapon; a component pouch or an arcane focus; a scholar''s pack or a dungeoneer''s pack; leather armor, any simple weapon, and two daggers',
  'armorProfs', jsonb_build_object(
    'primary', '["light"]'::jsonb,
    'secondary', '["light"]'::jsonb
  ),
  'weaponProfs', jsonb_build_object(
    'primary', '["simple"]'::jsonb,
    'secondary', '[]'::jsonb
  ),
  'toolProfs', '[]'::jsonb
)
WHERE content_type = 'class'
  AND slug = 'warlock'
  AND source = 'srd'
  AND scope = 'platform';

-- ============================================================================
-- Wizard: INT primary, Arcane Tradition
-- Armor: none (multiclass: none)
-- Weapons: daggers, darts, slings, quarterstaffs, light crossbows (multiclass: none)
-- ============================================================================
UPDATE content_definitions
SET data = data || jsonb_build_object(
  'primaryAbility', 'Intelligence',
  'subclassLabel', 'Arcane Tradition',
  'skillstxt', 'Choose two from Arcana, History, Insight, Investigation, Medicine, and Religion',
  'equipment', 'A quarterstaff or a dagger; a component pouch or an arcane focus; a scholar''s pack or an explorer''s pack; a spellbook',
  'armorProfs', jsonb_build_object(
    'primary', '[]'::jsonb,
    'secondary', '[]'::jsonb
  ),
  'weaponProfs', jsonb_build_object(
    'primary', '["dagger", "dart", "sling", "quarterstaff", "light-crossbow"]'::jsonb,
    'secondary', '[]'::jsonb
  ),
  'toolProfs', '[]'::jsonb
)
WHERE content_type = 'class'
  AND slug = 'wizard'
  AND source = 'srd'
  AND scope = 'platform';

COMMIT;
