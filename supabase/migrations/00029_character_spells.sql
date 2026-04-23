-- Migration: Create character_spells table for spell tracking
-- Mirrors the character_inventory pattern.

CREATE TABLE character_spells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  content_id uuid REFERENCES content_definitions(id) ON DELETE SET NULL,
  name text NOT NULL,
  class_slug text NOT NULL,
  is_known boolean NOT NULL DEFAULT false,
  is_prepared boolean NOT NULL DEFAULT false,
  always_prepared boolean NOT NULL DEFAULT false,
  in_spellbook boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'selection',
  custom_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_spells_character ON character_spells(character_id);
CREATE INDEX idx_spells_character_prepared ON character_spells(character_id, is_prepared);
CREATE INDEX idx_spells_character_class ON character_spells(character_id, class_slug);
CREATE INDEX idx_spells_content ON character_spells(content_id);

-- Unique: no duplicate spell for the same character + spell + class combo.
-- Custom spells (null content_id) are allowed to duplicate.
CREATE UNIQUE INDEX idx_spells_character_spell_class_unique
  ON character_spells(character_id, content_id, class_slug)
  WHERE content_id IS NOT NULL;

ALTER TABLE character_spells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage spells"
ON character_spells FOR ALL
TO authenticated
USING (
  character_id IN (SELECT id FROM characters WHERE user_id = auth.uid())
)
WITH CHECK (
  character_id IN (SELECT id FROM characters WHERE user_id = auth.uid())
);
