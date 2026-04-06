-- D&D 5e 2014 SRD (primary launch system — content sourced from dnd5eapi.co)
insert into public.game_systems (slug, name, version_label, status, schema_definition, expression_context)
values (
  'dnd-5e-2014',
  'D&D 5th Edition (2014)',
  '2014 Rules',
  'published',
  '{
    "ability_scores": [
      {"slug": "strength", "name": "Strength", "abbr": "STR"},
      {"slug": "dexterity", "name": "Dexterity", "abbr": "DEX"},
      {"slug": "constitution", "name": "Constitution", "abbr": "CON"},
      {"slug": "intelligence", "name": "Intelligence", "abbr": "INT"},
      {"slug": "wisdom", "name": "Wisdom", "abbr": "WIS"},
      {"slug": "charisma", "name": "Charisma", "abbr": "CHA"}
    ],
    "proficiency_levels": [
      {"slug": "none", "name": "Not Proficient", "multiplier": 0},
      {"slug": "half", "name": "Half Proficiency", "multiplier": 0.5},
      {"slug": "proficient", "name": "Proficient", "multiplier": 1},
      {"slug": "expertise", "name": "Expertise", "multiplier": 2}
    ],
    "derived_stats": [
      {"slug": "proficiency_bonus", "name": "Proficiency Bonus", "formula": "floor((level - 1) / 4) + 2"},
      {"slug": "armor_class", "name": "Armor Class", "formula": "10 + mod(dexterity)"},
      {"slug": "initiative", "name": "Initiative", "formula": "mod(dexterity)"},
      {"slug": "movement_speed", "name": "Speed", "base": 30},
      {"slug": "hit_points_max", "name": "Hit Point Maximum", "formula": "hit_die_total + (mod(constitution) * level)"},
      {"slug": "passive_perception", "name": "Passive Perception", "formula": "10 + mod(wisdom) + proficiency_if(''perception'')"},
      {"slug": "spell_save_dc", "name": "Spell Save DC", "formula": "8 + proficiency_bonus + mod(spellcasting_ability)"},
      {"slug": "spell_attack_bonus", "name": "Spell Attack Bonus", "formula": "proficiency_bonus + mod(spellcasting_ability)"}
    ],
    "skills": [
      {"slug": "acrobatics", "name": "Acrobatics", "ability": "dexterity"},
      {"slug": "animal_handling", "name": "Animal Handling", "ability": "wisdom"},
      {"slug": "arcana", "name": "Arcana", "ability": "intelligence"},
      {"slug": "athletics", "name": "Athletics", "ability": "strength"},
      {"slug": "deception", "name": "Deception", "ability": "charisma"},
      {"slug": "history", "name": "History", "ability": "intelligence"},
      {"slug": "insight", "name": "Insight", "ability": "wisdom"},
      {"slug": "intimidation", "name": "Intimidation", "ability": "charisma"},
      {"slug": "investigation", "name": "Investigation", "ability": "intelligence"},
      {"slug": "medicine", "name": "Medicine", "ability": "wisdom"},
      {"slug": "nature", "name": "Nature", "ability": "intelligence"},
      {"slug": "perception", "name": "Perception", "ability": "wisdom"},
      {"slug": "performance", "name": "Performance", "ability": "charisma"},
      {"slug": "persuasion", "name": "Persuasion", "ability": "charisma"},
      {"slug": "religion", "name": "Religion", "ability": "intelligence"},
      {"slug": "sleight_of_hand", "name": "Sleight of Hand", "ability": "dexterity"},
      {"slug": "stealth", "name": "Stealth", "ability": "dexterity"},
      {"slug": "survival", "name": "Survival", "ability": "wisdom"}
    ],
    "resources": [
      {"slug": "hit_points", "name": "Hit Points", "type": "current_max_temp"},
      {"slug": "hit_dice", "name": "Hit Dice", "type": "pool", "per": "level"},
      {"slug": "spell_slots", "name": "Spell Slots", "type": "slots_by_level", "levels": [1,2,3,4,5,6,7,8,9]},
      {"slug": "death_saves", "name": "Death Saves", "type": "success_fail", "max_each": 3}
    ],
    "content_types": [
      {"slug": "race", "name": "Race", "plural": "Races", "required": true, "max": 1},
      {"slug": "class", "name": "Class", "plural": "Classes", "required": true, "max": null},
      {"slug": "subclass", "name": "Subclass", "plural": "Subclasses", "parent": "class"},
      {"slug": "background", "name": "Background", "plural": "Backgrounds", "required": true, "max": 1},
      {"slug": "feat", "name": "Feat", "plural": "Feats", "max": null},
      {"slug": "spell", "name": "Spell", "plural": "Spells"},
      {"slug": "item", "name": "Item", "plural": "Items"},
      {"slug": "weapon", "name": "Weapon", "plural": "Weapons"},
      {"slug": "armor", "name": "Armor", "plural": "Armor"}
    ],
    "currencies": [
      {"slug": "cp", "name": "Copper", "rate": 1},
      {"slug": "sp", "name": "Silver", "rate": 10},
      {"slug": "ep", "name": "Electrum", "rate": 50},
      {"slug": "gp", "name": "Gold", "rate": 100},
      {"slug": "pp", "name": "Platinum", "rate": 1000}
    ],
    "creation_steps": [
      {"step": 1, "type": "race", "label": "Choose Race"},
      {"step": 2, "type": "class", "label": "Choose Class"},
      {"step": 3, "type": "abilities", "label": "Set Ability Scores", "methods": ["standard_array", "point_buy", "manual"]},
      {"step": 4, "type": "background", "label": "Choose Background"},
      {"step": 5, "type": "equipment", "label": "Starting Equipment"},
      {"step": 6, "type": "details", "label": "Character Details", "fields": ["name", "alignment", "backstory", "appearance", "personality_traits", "ideals", "bonds", "flaws"]}
    ],
    "sheet_sections": [
      {"slug": "header", "label": "Character Header", "contains": ["name", "class_level", "race", "background"]},
      {"slug": "abilities", "label": "Ability Scores"},
      {"slug": "combat", "label": "Combat", "contains": ["armor_class", "initiative", "speed", "hit_points"]},
      {"slug": "skills", "label": "Skills & Saves"},
      {"slug": "actions", "label": "Actions", "tab": true},
      {"slug": "spells", "label": "Spells", "tab": true},
      {"slug": "inventory", "label": "Inventory", "tab": true},
      {"slug": "features", "label": "Features & Traits", "tab": true, "extension_zone": true},
      {"slug": "background", "label": "Background", "tab": true},
      {"slug": "notes", "label": "Notes", "tab": true},
      {"slug": "extras", "label": "Extras", "tab": true}
    ]
  }'::jsonb,
  '{}'::jsonb
);

-- D&D 5e 2024 SRD (content sourced later from PDF/MPMB — draft until content is loaded)
insert into public.game_systems (slug, name, version_label, status, schema_definition, expression_context)
values (
  'dnd-5e-2024',
  'D&D 5th Edition (2024)',
  '2024 Rules',
  'draft',
  '{
    "ability_scores": [
      {"slug": "strength", "name": "Strength", "abbr": "STR"},
      {"slug": "dexterity", "name": "Dexterity", "abbr": "DEX"},
      {"slug": "constitution", "name": "Constitution", "abbr": "CON"},
      {"slug": "intelligence", "name": "Intelligence", "abbr": "INT"},
      {"slug": "wisdom", "name": "Wisdom", "abbr": "WIS"},
      {"slug": "charisma", "name": "Charisma", "abbr": "CHA"}
    ],
    "proficiency_levels": [
      {"slug": "none", "name": "Not Proficient", "multiplier": 0},
      {"slug": "half", "name": "Half Proficiency", "multiplier": 0.5},
      {"slug": "proficient", "name": "Proficient", "multiplier": 1},
      {"slug": "expertise", "name": "Expertise", "multiplier": 2}
    ],
    "derived_stats": [
      {"slug": "proficiency_bonus", "name": "Proficiency Bonus", "formula": "floor((level - 1) / 4) + 2"},
      {"slug": "armor_class", "name": "Armor Class", "formula": "10 + mod(dexterity)"},
      {"slug": "initiative", "name": "Initiative", "formula": "mod(dexterity)"},
      {"slug": "movement_speed", "name": "Speed", "base": 30},
      {"slug": "hit_points_max", "name": "Hit Point Maximum", "formula": "hit_die_total + (mod(constitution) * level)"},
      {"slug": "passive_perception", "name": "Passive Perception", "formula": "10 + mod(wisdom) + proficiency_if(''perception'')"},
      {"slug": "spell_save_dc", "name": "Spell Save DC", "formula": "8 + proficiency_bonus + mod(spellcasting_ability)"},
      {"slug": "spell_attack_bonus", "name": "Spell Attack Bonus", "formula": "proficiency_bonus + mod(spellcasting_ability)"}
    ],
    "skills": [
      {"slug": "acrobatics", "name": "Acrobatics", "ability": "dexterity"},
      {"slug": "animal_handling", "name": "Animal Handling", "ability": "wisdom"},
      {"slug": "arcana", "name": "Arcana", "ability": "intelligence"},
      {"slug": "athletics", "name": "Athletics", "ability": "strength"},
      {"slug": "deception", "name": "Deception", "ability": "charisma"},
      {"slug": "history", "name": "History", "ability": "intelligence"},
      {"slug": "insight", "name": "Insight", "ability": "wisdom"},
      {"slug": "intimidation", "name": "Intimidation", "ability": "charisma"},
      {"slug": "investigation", "name": "Investigation", "ability": "intelligence"},
      {"slug": "medicine", "name": "Medicine", "ability": "wisdom"},
      {"slug": "nature", "name": "Nature", "ability": "intelligence"},
      {"slug": "perception", "name": "Perception", "ability": "wisdom"},
      {"slug": "performance", "name": "Performance", "ability": "charisma"},
      {"slug": "persuasion", "name": "Persuasion", "ability": "charisma"},
      {"slug": "religion", "name": "Religion", "ability": "intelligence"},
      {"slug": "sleight_of_hand", "name": "Sleight of Hand", "ability": "dexterity"},
      {"slug": "stealth", "name": "Stealth", "ability": "dexterity"},
      {"slug": "survival", "name": "Survival", "ability": "wisdom"}
    ],
    "resources": [
      {"slug": "hit_points", "name": "Hit Points", "type": "current_max_temp"},
      {"slug": "hit_dice", "name": "Hit Dice", "type": "pool", "per": "level"},
      {"slug": "spell_slots", "name": "Spell Slots", "type": "slots_by_level", "levels": [1,2,3,4,5,6,7,8,9]},
      {"slug": "death_saves", "name": "Death Saves", "type": "success_fail", "max_each": 3}
    ],
    "content_types": [
      {"slug": "species", "name": "Species", "plural": "Species", "required": true, "max": 1},
      {"slug": "class", "name": "Class", "plural": "Classes", "required": true, "max": null},
      {"slug": "subclass", "name": "Subclass", "plural": "Subclasses", "parent": "class"},
      {"slug": "background", "name": "Background", "plural": "Backgrounds", "required": true, "max": 1},
      {"slug": "feat", "name": "Feat", "plural": "Feats", "max": null},
      {"slug": "spell", "name": "Spell", "plural": "Spells"},
      {"slug": "item", "name": "Item", "plural": "Items"},
      {"slug": "weapon", "name": "Weapon", "plural": "Weapons"},
      {"slug": "armor", "name": "Armor", "plural": "Armor"}
    ],
    "currencies": [
      {"slug": "cp", "name": "Copper", "rate": 1},
      {"slug": "sp", "name": "Silver", "rate": 10},
      {"slug": "ep", "name": "Electrum", "rate": 50},
      {"slug": "gp", "name": "Gold", "rate": 100},
      {"slug": "pp", "name": "Platinum", "rate": 1000}
    ],
    "creation_steps": [
      {"step": 1, "type": "species", "label": "Choose Species"},
      {"step": 2, "type": "class", "label": "Choose Class"},
      {"step": 3, "type": "abilities", "label": "Set Ability Scores", "methods": ["standard_array", "point_buy", "manual"]},
      {"step": 4, "type": "background", "label": "Choose Background"},
      {"step": 5, "type": "equipment", "label": "Starting Equipment"},
      {"step": 6, "type": "details", "label": "Character Details", "fields": ["name", "alignment", "backstory", "appearance", "personality_traits", "ideals", "bonds", "flaws"]}
    ],
    "sheet_sections": [
      {"slug": "header", "label": "Character Header", "contains": ["name", "class_level", "species", "background"]},
      {"slug": "abilities", "label": "Ability Scores"},
      {"slug": "combat", "label": "Combat", "contains": ["armor_class", "initiative", "speed", "hit_points"]},
      {"slug": "skills", "label": "Skills & Saves"},
      {"slug": "actions", "label": "Actions", "tab": true},
      {"slug": "spells", "label": "Spells", "tab": true},
      {"slug": "inventory", "label": "Inventory", "tab": true},
      {"slug": "features", "label": "Features & Traits", "tab": true, "extension_zone": true},
      {"slug": "background", "label": "Background", "tab": true},
      {"slug": "notes", "label": "Notes", "tab": true},
      {"slug": "extras", "label": "Extras", "tab": true}
    ]
  }'::jsonb,
  '{}'::jsonb
);
