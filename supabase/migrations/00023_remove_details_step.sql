-- Migration: Remove Character Details step from creation_steps
-- Builder now goes Equipment → Character Sheet directly

UPDATE game_systems
SET schema_definition = jsonb_set(
  schema_definition,
  '{creation_steps}',
  '[{"step":1,"type":"race","label":"Choose Race"},{"step":2,"type":"class","label":"Choose Class"},{"step":3,"type":"abilities","label":"Set Ability Scores","methods":["standard_array","point_buy","manual"]},{"step":4,"type":"background","label":"Choose Background"},{"step":5,"type":"equipment","label":"Starting Equipment"}]'::jsonb
)
WHERE slug = 'dnd-5e-2014';
