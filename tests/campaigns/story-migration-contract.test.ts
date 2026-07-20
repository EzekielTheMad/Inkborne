import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/00055_character_timeline_relationships.sql"),
  "utf8",
);

describe("character story migration", () => {
  it("creates ordered timeline events with valid rich-text documents", () => {
    expect(migration).toContain("CREATE TABLE public.character_timeline_events");
    expect(migration).toContain("character_timeline_description_document CHECK");
    expect(migration).toContain("character_id, sort_order, created_at");
  });

  it("reuses and hardens character relationships", () => {
    expect(migration).toContain("ALTER TABLE public.npcs");
    expect(migration).toContain("npcs_description_document CHECK");
    expect(migration).toContain("DROP POLICY IF EXISTS \"Creator can update own NPCs\"");
    expect(migration).toContain("Character owners can update relationships");
  });

  it("enforces owner, DM, and campaign-member visibility", () => {
    expect(migration).toContain("private.can_view_character_story_entry");
    expect(migration).toContain("campaign.owner_id = (SELECT auth.uid())");
    expect(migration).toContain("entry_visibility = 'campaign'");
    expect(migration).toContain("private.is_campaign_member(character.campaign_id)");
    expect(migration).toContain("private.is_character_owner(character_id)");
  });

  it("keeps API grants least-privilege", () => {
    expect(migration).toContain(
      "REVOKE ALL ON public.character_timeline_events FROM PUBLIC, anon",
    );
    expect(migration).toContain("REVOKE ALL ON public.npcs FROM PUBLIC, anon");
  });

  it("copies story records atomically without sharing them to a new group", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.copy_character");
    expect(migration).toContain("INSERT INTO public.character_timeline_events");
    expect(migration).toContain("event.description, 'dm_only', event.sort_order");
    expect(migration).toContain("'dm_only', npc.portrait_url, npc.metadata");
  });
});
