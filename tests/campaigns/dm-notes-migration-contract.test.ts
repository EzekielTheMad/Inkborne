import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/00052_character_dm_notes_boundary.sql"),
  "utf8",
);
const atomicSaveMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/00054_atomic_character_narrative_save.sql"),
  "utf8",
);

describe("character DM notes boundary migration", () => {
  it("moves notes out of player-readable character JSON", () => {
    expect(migration).toContain("CREATE TABLE public.character_dm_notes");
    expect(migration).toContain("narrative_rich->'backstory_dm_notes'");
    expect(migration).toContain("narrative_rich = narrative_rich - 'backstory_dm_notes'");
  });

  it("limits reads to the character owner and campaign DM", () => {
    expect(migration).toContain("private.can_view_character_dm_notes");
    expect(migration).toContain("campaign.owner_id = (SELECT auth.uid())");
    expect(migration).toContain("private.is_character_owner(character_id)");
    expect(migration).toContain("REVOKE ALL ON public.character_dm_notes FROM PUBLIC, anon");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION private.is_character_owner(uuid) TO authenticated",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION private.can_view_character_dm_notes(uuid) TO authenticated",
    );
  });

  it("keeps DM notes inside the atomic character copy", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.copy_character");
    expect(migration).toContain("INSERT INTO public.character_dm_notes (character_id, content)");
    expect(migration).toContain("WHERE note.character_id = source_character_id");
  });

  it("saves shared narrative and DM notes in one owner-only transaction", () => {
    expect(atomicSaveMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.save_character_narrative_rich",
    );
    expect(atomicSaveMigration).toContain("AND user_id = (SELECT auth.uid())");
    expect(atomicSaveMigration).toContain("IF write_dm_notes THEN");
    expect(atomicSaveMigration).toContain(
      "GRANT EXECUTE ON FUNCTION public.save_character_narrative_rich",
    );
  });
});
