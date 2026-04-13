-- Migration: Add flavor descriptions to SRD classes
-- Source: D&D 5e SRD class summaries

UPDATE content_definitions SET data = data || '{"description": "A fierce warrior who can enter a battle rage"}'::jsonb WHERE content_type = 'class' AND slug = 'barbarian' AND source = 'srd' AND scope = 'platform';
UPDATE content_definitions SET data = data || '{"description": "An inspiring magician whose power echoes the music of creation"}'::jsonb WHERE content_type = 'class' AND slug = 'bard' AND source = 'srd' AND scope = 'platform';
UPDATE content_definitions SET data = data || '{"description": "A priestly champion who wields divine magic in service of a higher power"}'::jsonb WHERE content_type = 'class' AND slug = 'cleric' AND source = 'srd' AND scope = 'platform';
UPDATE content_definitions SET data = data || '{"description": "A priest of the Old Faith, wielding the powers of nature and adopting animal forms"}'::jsonb WHERE content_type = 'class' AND slug = 'druid' AND source = 'srd' AND scope = 'platform';
UPDATE content_definitions SET data = data || '{"description": "A master of martial combat, skilled with a variety of weapons and armor"}'::jsonb WHERE content_type = 'class' AND slug = 'fighter' AND source = 'srd' AND scope = 'platform';
UPDATE content_definitions SET data = data || '{"description": "A master of martial arts, harnessing the power of the body in pursuit of physical and spiritual perfection"}'::jsonb WHERE content_type = 'class' AND slug = 'monk' AND source = 'srd' AND scope = 'platform';
UPDATE content_definitions SET data = data || '{"description": "A holy warrior bound to a sacred oath"}'::jsonb WHERE content_type = 'class' AND slug = 'paladin' AND source = 'srd' AND scope = 'platform';
UPDATE content_definitions SET data = data || '{"description": "A warrior who combats threats on the edges of civilization"}'::jsonb WHERE content_type = 'class' AND slug = 'ranger' AND source = 'srd' AND scope = 'platform';
UPDATE content_definitions SET data = data || '{"description": "A scoundrel who uses stealth and trickery to overcome obstacles and enemies"}'::jsonb WHERE content_type = 'class' AND slug = 'rogue' AND source = 'srd' AND scope = 'platform';
UPDATE content_definitions SET data = data || '{"description": "A spellcaster who draws on inherent magic from a gift or bloodline"}'::jsonb WHERE content_type = 'class' AND slug = 'sorcerer' AND source = 'srd' AND scope = 'platform';
UPDATE content_definitions SET data = data || '{"description": "A wielder of magic derived from a bargain with an extraplanar entity"}'::jsonb WHERE content_type = 'class' AND slug = 'warlock' AND source = 'srd' AND scope = 'platform';
UPDATE content_definitions SET data = data || '{"description": "A scholarly magic-user capable of manipulating the structures of reality"}'::jsonb WHERE content_type = 'class' AND slug = 'wizard' AND source = 'srd' AND scope = 'platform';
