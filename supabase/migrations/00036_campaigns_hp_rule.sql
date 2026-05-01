-- Campaign-level HP rule override for the level-up flow (PR-D of M2).
--
-- Adds an optional per-campaign HP rule that the builder respects when a
-- character is in a campaign. NULL = inherit from the game system's default
-- (read from `game_systems.schema_definition.hp_rule`).
--
-- Allowed values match the HpRule TypeScript enum in
-- lib/builder/level-up-rules.ts. The CHECK constraint enforces this at the
-- database level so application bugs can't insert garbage values.
--
-- Per-character HP rolls live in `characters.choices.hp_rolls` (JSONB);
-- no migration needed for that part.

ALTER TABLE campaigns
  ADD COLUMN hp_rule TEXT NULL;

ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_hp_rule_check
  CHECK (
    hp_rule IS NULL
    OR hp_rule IN (
      'free_choice',
      'average_only',
      'rolled_only',
      'max_first_level_each_class',
      'max_for_all'
    )
  );

COMMENT ON COLUMN campaigns.hp_rule IS
  'Per-campaign HP rule override. NULL inherits from game_systems.schema_definition.hp_rule. See lib/builder/level-up-rules.ts HpRule enum.';
