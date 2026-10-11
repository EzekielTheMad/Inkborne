-- Save only ability method + scores. Never accept a replacement choices object.
-- Row locking + expected values make stale editors fail without overwriting.
create or replace function public.save_character_abilities(
  target_character_id uuid,
  ability_method text,
  ability_scores jsonb,
  expected_method text,
  expected_scores jsonb
)
returns table (saved_method text, saved_scores jsonb)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_choices jsonb;
  current_scores jsonb;
  character_system_id uuid;
  system_abilities jsonb;
  entry record;
  score numeric;
  points_used integer := 0;
  assigned_scores numeric[] := '{}';
begin
  if auth.uid() is null then
    raise exception 'Character not available.' using errcode = '42501';
  end if;

  select coalesce(c.choices, '{}'::jsonb), coalesce(c.base_stats, '{}'::jsonb), c.system_id
    into current_choices, current_scores, character_system_id
    from public.characters c
    where c.id = target_character_id and c.user_id = auth.uid()
    for update;
  if not found then
    raise exception 'Character not available.' using errcode = '42501';
  end if;

  if ability_method is null or ability_method not in ('standard_array', 'point_buy', 'manual')
    or jsonb_typeof(ability_scores) is distinct from 'object'
    or jsonb_typeof(expected_scores) is distinct from 'object' then
    raise exception 'Invalid ability-score method or scores.' using errcode = '22023';
  end if;

  if (current_choices ->> 'ability_method') is distinct from expected_method
    or current_scores is distinct from expected_scores then
    -- Application conflict, deliberately not serialization_failure (40001),
    -- so infrastructure cannot silently retry with changed expectations.
    raise exception 'ABILITY_SCORES_CHANGED' using errcode = 'P0001';
  end if;

  select g.schema_definition -> 'ability_scores' into system_abilities
    from public.game_systems g where g.id = character_system_id;
  if jsonb_typeof(system_abilities) is distinct from 'array' then
    raise exception 'The character ability schema is unavailable.' using errcode = '22023';
  end if;

  for entry in select key, value from jsonb_each(ability_scores) loop
    if not exists (
      select 1 from jsonb_array_elements(system_abilities) a
      where a ->> 'slug' = entry.key
    ) or jsonb_typeof(entry.value) is distinct from 'number' then
      raise exception 'Invalid ability-score entry.' using errcode = '22023';
    end if;
    score := entry.value::text::numeric;
    if score < 1 or score > 30 or score <> trunc(score) then
      raise exception 'Ability scores must be whole numbers from 1 to 30.' using errcode = '22023';
    end if;
    if ability_method = 'standard_array' then
      if not (score = any(array[15, 14, 13, 12, 10, 8])) or score = any(assigned_scores) then
        raise exception 'Standard-array scores must use each available value at most once.' using errcode = '22023';
      end if;
      assigned_scores := array_append(assigned_scores, score);
    elsif ability_method = 'point_buy' then
      if score < 8 or score > 15 then
        raise exception 'Point-buy scores must be from 8 to 15.' using errcode = '22023';
      end if;
      points_used := points_used + case score when 14 then 7 when 15 then 9 else score::integer - 8 end;
    end if;
  end loop;
  if points_used > 27 then
    raise exception 'Point-buy scores exceed the 27-point budget.' using errcode = '22023';
  end if;

  return query
    update public.characters c
      set base_stats = ability_scores,
          choices = jsonb_set(coalesce(c.choices, '{}'::jsonb), '{ability_method}', to_jsonb(ability_method), true)
      where c.id = target_character_id and c.user_id = auth.uid()
      returning c.choices ->> 'ability_method', c.base_stats;
  if not found then
    raise exception 'Character not available.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.save_character_abilities(uuid, text, jsonb, text, jsonb) from public, anon;
grant execute on function public.save_character_abilities(uuid, text, jsonb, text, jsonb) to authenticated;
