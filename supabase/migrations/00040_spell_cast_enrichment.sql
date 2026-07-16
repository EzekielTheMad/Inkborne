-- Migration: spell-cast data enrichment for the M3 cast dialog (T5).
--
-- 1) `data.attack_type` ("melee" | "ranged") backfill for every platform SRD
--    spell whose rules text makes a spell attack. dnd5eapi carries this field
--    natively but the original seed transformer dropped it (now captured by
--    scripts/transformers/spells.ts for future re-seeds). The cast dialog's
--    "Roll Attack" offer is driven by this field — no per-spell code paths.
--    The slug list below was derived from the seeded descriptions themselves
--    (description ~* 'melee|ranged spell attack').
--
-- 2) Magic Missile `dice_at_slot_level` fix: dnd5eapi lists PER-DART damage
--    ("1d4 + 1" at every level), which makes upcasting a no-op in the dialog.
--    All darts hit simultaneously with no attack roll, so the practical roll
--    is the TOTAL: 3 darts at 1st +1 per slot level above (3d4+3 → 11d4+11).
--    (Per-beam data on Eldritch Blast / Scorching Ray is left alone — each
--    beam/ray is a separate attack roll, so per-projectile dice are correct.)
--
-- Note: the design's "~14 cantrips missing descriptionCantripDie" backfill is
-- NOT needed: audit of the seeded data (2026-07-16) shows every damage cantrip
-- already carries per-character-level `dice_at_slot_level` breakpoints
-- (1/5/11/17); the 14 without `descriptionCantripDie` are all non-damage
-- cantrips (Light, Mage Hand, Guidance, …) with nothing to scale.
--
-- Scope guard: platform SRD spells only. Idempotent: plain UPDATEs, safe to
-- re-run.

-- Ranged spell attacks
update public.content_definitions
set data = data || '{"attack_type":"ranged"}'::jsonb
where content_type = 'spell' and source = 'srd' and scope = 'platform'
  and slug in (
    'chill-touch',
    'eldritch-blast',
    'fire-bolt',
    'produce-flame',
    'ray-of-frost',
    'guiding-bolt',
    'acid-arrow',
    'ray-of-enfeeblement',
    'scorching-ray'
  );

-- Melee spell attacks
update public.content_definitions
set data = data || '{"attack_type":"melee"}'::jsonb
where content_type = 'spell' and source = 'srd' and scope = 'platform'
  and slug in (
    'shocking-grasp',
    'inflict-wounds',
    'flame-blade',
    'spiritual-weapon',
    'vampiric-touch',
    'arcane-hand',
    'contagion',
    'dispel-evil-and-good',
    'arcane-sword',
    'plane-shift'
  );

-- Magic Missile: total-dart damage per slot level (3 darts + 1/level above 1st)
update public.content_definitions
set data = jsonb_set(
  data,
  '{damage,dice_at_slot_level}',
  '{
    "1": "3d4 + 3",
    "2": "4d4 + 4",
    "3": "5d4 + 5",
    "4": "6d4 + 6",
    "5": "7d4 + 7",
    "6": "8d4 + 8",
    "7": "9d4 + 9",
    "8": "10d4 + 10",
    "9": "11d4 + 11"
  }'::jsonb
)
where content_type = 'spell' and source = 'srd' and scope = 'platform'
  and slug = 'magic-missile'
  and data->'damage' is not null and data->'damage' != 'null'::jsonb;
