import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/00042_copy_character.sql"),
  "utf8",
).toLowerCase();

describe("copy character migration contract", () => {
  it("runs atomically as an authenticated security-definer RPC", () => {
    expect(migration).toContain("create or replace function public.copy_character");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("grant execute on function public.copy_character");
  });

  it("only copies characters owned by the caller", () => {
    expect(migration).toContain("character.user_id = actor_id");
    expect(migration).toContain("character not found or not owned by caller");
  });

  it("validates optional campaign assignment through the authorization helper", () => {
    expect(migration).toContain("private.can_assign_character_to_campaign");
    expect(migration).toContain("source_character.system_id");
  });

  it("copies durable character data but not roll history", () => {
    expect(migration).toContain("insert into public.character_content_refs");
    expect(migration).toContain("insert into public.character_inventory");
    expect(migration).toContain("insert into public.character_spells");
    expect(migration).toContain("insert into public.npcs");
    expect(migration).not.toContain("insert into public.character_rolls");
  });

  it("does not implicitly expose copied character or NPC data", () => {
    expect(migration).toMatch(/resolved_name,\s*'private'/);
    expect(migration).toMatch(/npc\.relationship,\s*'private'/);
  });
});
