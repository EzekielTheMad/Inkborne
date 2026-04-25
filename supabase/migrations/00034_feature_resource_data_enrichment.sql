-- Feature Resource data enrichment.
--
-- Lights up the Feature Resources system (shipped earlier) by populating
-- `usages` + `recovery` metadata on class features and racial traits that
-- had it missing or broken.
--
-- Scope (10 class features + 2 racial traits):
--   - Fix broken: Ki (was all nulls), Channel Divinity (Paladin) (was flat 1).
--   - Add missing: Channel Divinity (Cleric L2), Wild Shape, Lay on Hands,
--     Indomitable, Font of Magic (Sorcery Points), Arcane Recovery,
--     Dark One's Own Luck, Mystic Arcanum (×4 levels).
--   - Add traits: Breath Weapon, Relentless Endurance.
--
-- Out of scope:
--   - Tiefling Infernal Legacy spells: needs level-gated `extraLimitedFeatures`
--     which the trait schema doesn't model yet (Hellish Rebuke unlocks at L3,
--     Darkness at L5; adding them as bare extras would show counters from L1).
--   - Bardic Inspiration: requires CHA-mod scaling we deferred to formula
--     support. Current 1/long-rest is RAW-min and serves alpha purposes.
--   - Halfling racial Lucky / High Elf cantrip: passive features, no counter.
--
-- Display-name caveat (acceptable for alpha):
--   Some features were modeled as separate scaling-tier rows (e.g.,
--   `channel-divinity-1-rest`, `-2-rest`, `-3-rest`). We enrich only the
--   base-tier row so the counter doesn't double-count. The displayed name
--   on the resource counter will be the base-tier name (e.g., "Channel
--   Divinity (1/rest)") even at higher levels where the max correctly shows
--   2 or 3. Counter values are accurate; names are misleading. Renaming is
--   content cleanup for a future pass.

-- ---- Class features ----

-- Ki (Monk L2): usages = monk level starting at L2.
update public.content_definitions
set data = data || '{"usages": [null, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], "recovery": "short rest"}'::jsonb
where content_type = 'feature' and slug = 'ki';

-- Channel Divinity (Cleric L2): 1 use at L2-5, 2 at L6-17, 3 at L18-20.
-- Enrich the L2 base row only; the L6 (`channel-divinity-2-rest`) and L18
-- (`channel-divinity-3-rest`) tier rows stay bare so they don't double-count.
update public.content_definitions
set data = data || '{"usages": [null, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3], "recovery": "short rest"}'::jsonb
where content_type = 'feature' and slug = 'channel-divinity-1-rest';

-- Channel Divinity (Paladin L3): 1 at L3-10, 2 at L11-17, 3 at L18-20.
-- Existing data has flat-1 array; replace with proper scaling.
update public.content_definitions
set data = data || '{"usages": [null, null, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3], "recovery": "short rest"}'::jsonb
where content_type = 'feature' and slug = 'channel-divinity';

-- Wild Shape (Druid L2): 2 uses per short rest. Enrich the L2 base CR row only;
-- L4 and L8 CR-progression rows stay bare.
update public.content_definitions
set data = data || '{"usages": 2, "recovery": "short rest"}'::jsonb
where content_type = 'feature' and slug = 'wild-shape-cr-1-4-or-below-no-flying-or-swim-speed';

-- Lay on Hands (Paladin L1): pool of 5 × paladin level HP, recovers on long rest.
update public.content_definitions
set data = data || '{"usages": [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100], "recovery": "long rest"}'::jsonb
where content_type = 'feature' and slug = 'lay-on-hands';

-- Indomitable (Fighter L9): 1 at L9-12, 2 at L13-16, 3 at L17-20.
-- Enrich the L9 base row; L13 and L17 tier rows stay bare.
update public.content_definitions
set data = data || '{"usages": [null, null, null, null, null, null, null, null, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3], "recovery": "long rest"}'::jsonb
where content_type = 'feature' and slug = 'indomitable-1-use';

-- Font of Magic / Sorcery Points (Sorcerer L2): usages = sorcerer level.
update public.content_definitions
set data = data || '{"usages": [null, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], "recovery": "long rest"}'::jsonb
where content_type = 'feature' and slug = 'font-of-magic';

-- Arcane Recovery (Wizard L1): 1 per long rest. (RAW says "once per day" — our
-- normalizeRecovery treats day → long, so either works. Using long rest for
-- consistency.)
update public.content_definitions
set data = data || '{"usages": 1, "recovery": "long rest"}'::jsonb
where content_type = 'feature' and slug = 'arcane-recovery';

-- Dark One's Own Luck (Warlock Fiend Patron L6): 1 use, recover on short or
-- long rest. Using short rest (recovers earlier of the two).
update public.content_definitions
set data = data || '{"usages": 1, "recovery": "short rest"}'::jsonb
where content_type = 'feature' and slug = 'dark-ones-own-luck';

-- Mystic Arcanum (Warlock L11/13/15/17): 1 cast per long rest, each level.
-- These are independent features, each with its own slot.
update public.content_definitions
set data = data || '{"usages": 1, "recovery": "long rest"}'::jsonb
where content_type = 'feature' and slug in (
  'mystic-arcanum-6th-level',
  'mystic-arcanum-7th-level',
  'mystic-arcanum-8th-level',
  'mystic-arcanum-9th-level'
);

-- ---- Racial traits ----

-- Breath Weapon (Dragonborn): 1 use per short rest.
update public.content_definitions
set data = data || '{"usages": 1, "recovery": "short rest"}'::jsonb
where content_type = 'trait' and slug = 'breath-weapon';

-- Relentless Endurance (Half-Orc): 1 use per long rest (drop to 1 HP instead of 0).
update public.content_definitions
set data = data || '{"usages": 1, "recovery": "long rest"}'::jsonb
where content_type = 'trait' and slug = 'relentless-endurance';
