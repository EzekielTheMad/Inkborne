-- Migration: Create character_inventory table for equipment tracking

CREATE TABLE character_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  content_id uuid REFERENCES content_definitions(id) ON DELETE SET NULL,
  name text NOT NULL,
  content_type text NOT NULL DEFAULT 'item',
  quantity int NOT NULL DEFAULT 1,
  equipped boolean NOT NULL DEFAULT false,
  attuned boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  notes text,
  custom_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_character ON character_inventory(character_id);
CREATE INDEX idx_inventory_character_equipped ON character_inventory(character_id, equipped);
CREATE INDEX idx_inventory_content ON character_inventory(content_id);

ALTER TABLE character_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage inventory"
ON character_inventory FOR ALL
TO authenticated
USING (
  character_id IN (
    SELECT id FROM characters WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  character_id IN (
    SELECT id FROM characters WHERE user_id = auth.uid()
  )
);
