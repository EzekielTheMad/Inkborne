-- Add per-character primary color (hex string) for the carry-through UX.
-- Nullable; null renders as gold (var(--accent)) via the CSS fallback.
alter table public.characters
  add column primary_color text;

alter table public.characters
  add constraint characters_primary_color_format
  check (primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$');
