-- ============================================================
-- Platform Polish: Add preferences column to profiles
-- ============================================================

-- Add preferences JSONB column to profiles table
-- Stores user preferences like theme choice: { "theme": "dark" | "light" | "system" }
alter table public.profiles
  add column preferences jsonb not null default '{}';
