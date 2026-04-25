-- Feature Resource data enrichment — round 2.
--
-- Extends the round-1 migration (00034) by enriching additional class features
-- and Eldritch Invocations whose descriptions match per-rest patterns. Found
-- via SQL audit of features lacking `usages` whose descriptions contained
-- phrases like "once per", "until you finish", "per (short|long) rest".
--
-- Scope (10 high-level features + 7 Eldritch Invocations):

-- ---- High-level class features ----

-- Natural Recovery (Druid Land L2): regain spell slots once per day.
-- Per-day = long rest in our normalizeRecovery mapping.
update public.content_definitions
set data = data || '{"usages": 1, "recovery": "long rest"}'::jsonb
where content_type = 'feature' and slug = 'natural-recovery';

-- Divine Intervention (Cleric L10): 1/long rest at L10-19. At L20 always
-- succeeds with 7-day cooldown — modeling that subtlety needs richer schema;
-- for alpha, just track 1/long rest.
update public.content_definitions
set data = data || '{"usages": 1, "recovery": "long rest"}'::jsonb
where content_type = 'feature' and slug = 'divine-intervention';

-- Wholeness of Body (Monk Way of the Open Hand L6): 1/long rest.
update public.content_definitions
set data = data || '{"usages": 1, "recovery": "long rest"}'::jsonb
where content_type = 'feature' and slug = 'wholeness-of-body';

-- Cleansing Touch (Paladin L14): CHA modifier uses per long rest. Without
-- formula support we use 1/long rest (RAW minimum).
update public.content_definitions
set data = data || '{"usages": 1, "recovery": "long rest"}'::jsonb
where content_type = 'feature' and slug = 'cleansing-touch';

-- Holy Nimbus (Paladin Oath of Devotion L20): 1/long rest.
update public.content_definitions
set data = data || '{"usages": 1, "recovery": "long rest"}'::jsonb
where content_type = 'feature' and slug = 'holy-nimbus';

-- Stroke of Luck (Rogue L20): 1 use, recover on short or long rest.
update public.content_definitions
set data = data || '{"usages": 1, "recovery": "short rest"}'::jsonb
where content_type = 'feature' and slug = 'stroke-of-luck';

-- Hurl Through Hell (Warlock Fiend L14): 1/long rest.
update public.content_definitions
set data = data || '{"usages": 1, "recovery": "long rest"}'::jsonb
where content_type = 'feature' and slug = 'hurl-through-hell';

-- Eldritch Master (Warlock L20): regain expended pact slots, 1/long rest.
update public.content_definitions
set data = data || '{"usages": 1, "recovery": "long rest"}'::jsonb
where content_type = 'feature' and slug = 'eldritch-master';

-- Overchannel (Wizard L14): 1/long rest free; then deals damage to use again.
-- Modeling the damage trade-off needs richer state; for alpha track the free use.
update public.content_definitions
set data = data || '{"usages": 1, "recovery": "long rest"}'::jsonb
where content_type = 'feature' and slug = 'overchannel';

-- Signature Spell (Wizard L20): 2 spells, each can be cast once per short rest
-- without using a slot.
update public.content_definitions
set data = data || '{"usages": 2, "recovery": "short rest"}'::jsonb
where content_type = 'feature' and slug = 'signature-spell';

-- ---- Eldritch Invocations granting per-long-rest spells ----
-- Each invocation grants the ability to cast a specific spell once per long rest
-- without expending a spell slot. Each invocation is its own feature row;
-- a Warlock player picks invocations during builder, and selected invocations
-- light up as separate counters.

update public.content_definitions
set data = data || '{"usages": 1, "recovery": "long rest"}'::jsonb
where content_type = 'feature' and slug in (
  'eldritch-invocation-thief-of-five-fates',     -- bane (L2)
  'eldritch-invocation-sign-of-ill-omen',        -- bestow curse (L5)
  'eldritch-invocation-mire-the-mind',           -- slow (L5)
  'eldritch-invocation-dreadful-word',           -- confusion (L7)
  'eldritch-invocation-sculptor-of-flesh',       -- polymorph (L7)
  'eldritch-invocation-bewitching-whispers',     -- compulsion (L7)
  'eldritch-invocation-minions-of-chaos'         -- conjure elemental (L9)
);
