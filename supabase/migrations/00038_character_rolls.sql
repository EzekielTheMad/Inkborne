-- Migration: character_rolls — append-only per-character roll log.
-- Design: docs/specs/2026-07-15-m3-gameplay-foundations-design.md §3.5 (D2).
--
-- The log is append-only by design (honesty at the table): the owner can
-- SELECT and INSERT, and there are intentionally NO UPDATE or DELETE policies.
-- Campaign-visible rolls later become purely additive: one RLS policy for
-- campaign members + a realtime subscription, zero schema change.

CREATE TABLE character_rolls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  -- Who rolled (owner today; DM later). Defaults to the authenticated user.
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'check', 'save', 'attack', 'damage', 'heal',
    'death_save', 'initiative', 'hit_die', 'concentration', 'custom'
  )),
  label text NOT NULL,
  expression text NOT NULL,
  -- Full RollResult breakdown (groups, kept, natural, request).
  result jsonb NOT NULL,
  -- Denormalized for cheap list rendering.
  total integer NOT NULL,
  rolled_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rolls_character_rolled_at
  ON character_rolls(character_id, rolled_at DESC);

ALTER TABLE character_rolls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view rolls"
ON character_rolls FOR SELECT
TO authenticated
USING (
  character_id IN (SELECT id FROM characters WHERE user_id = auth.uid())
);

CREATE POLICY "Owner can insert rolls"
ON character_rolls FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND character_id IN (SELECT id FROM characters WHERE user_id = auth.uid())
);

-- No UPDATE/DELETE policies: the roll log is append-only.
