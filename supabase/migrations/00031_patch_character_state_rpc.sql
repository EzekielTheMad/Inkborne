-- Atomic patch for characters.state JSONB
--
-- Eliminates the read-merge-write race in lib/sheet/update-state.ts fallback.
-- Before this RPC existed, every patchState() call went through the fallback
-- path (select state → JS merge → update state), which could lose writes when
-- two state patches interleaved (e.g., "spend Rage" + "spend Ki" in quick
-- succession).
--
-- Semantics: shallow merge via jsonb `||` operator. Matches the fallback's
-- `{ ...state, ...patch }` spread exactly. Top-level keys are replaced
-- wholesale — e.g., patching `feature_uses: { rage: 1 }` replaces the entire
-- feature_uses map, it does not deep-merge into it.
--
-- Security: security invoker (default) — the existing "Owner can update
-- characters" RLS policy on public.characters governs access. The caller can
-- only patch rows where auth.uid() = characters.user_id.

create or replace function public.patch_character_state(
  character_id uuid,
  state_patch jsonb
)
returns void
language sql
as $$
  update public.characters
  set state = coalesce(state, '{}'::jsonb) || state_patch
  where id = character_id;
$$;

-- Allow authenticated clients to call the RPC. RLS on the underlying
-- characters table enforces that only the owner can actually modify a row.
grant execute on function public.patch_character_state(uuid, jsonb) to authenticated;
