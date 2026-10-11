import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync("supabase/staged/starting-equipment-transaction.sql", "utf8");
const latest = readFileSync("supabase/migrations/20260722221534_atomic_background_selection.sql", "utf8");
const commit = sql.slice(sql.indexOf("CREATE FUNCTION public.commit_starting_equipment"), sql.indexOf("-- Latest copy"));
const copy = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.copy_character"));
describe("local staged equipment SQL contracts (no database execution)", () => {
  it("restricts new invoker entrypoints to service_role and enables owner-only receipt reads", () => {
    for (const signature of ["create_character_with_starting_grant(uuid, text, uuid)", "resolve_starting_equipment(uuid, uuid, jsonb)", "commit_starting_equipment(uuid, uuid, jsonb, jsonb, jsonb)"]) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated, service_role`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO service_role`);
    }
    expect(sql).toContain("ALTER TABLE public.character_starting_grants ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("c.user_id = (SELECT auth.uid())");
    expect(sql).toContain("UNIQUE (character_id, grant_kind)");
  });
  it("creates a character and eligible marker in the same function", () => {
    const create = sql.slice(sql.indexOf("CREATE FUNCTION public.create_character_with_starting_grant"), sql.indexOf("-- Terminal resolution"));
    expect(create).toContain("SECURITY INVOKER");
    expect(create).toContain("INSERT INTO public.characters");
    expect(create).toContain("VALUES (new_id, 'eligible')");
  });
  it("resolves ownership and receipt before pin validation and writes", () => {
    expect(commit.indexOf("public.resolve_starting_equipment")).toBeLessThan(commit.indexOf("expected_choices OR"));
    expect(commit.indexOf("public.resolve_starting_equipment")).toBeLessThan(commit.indexOf("INSERT INTO public.character_inventory"));
    expect(commit).toContain("canonical_intent - 'plan'");
    expect(sql).toContain("WHERE id = target_character_id AND user_id = actor_id FOR UPDATE");
    expect(sql).toContain("g.canonical_intent - 'plan' = request_intent");
  });
  it("locks ref parents, checks snapshots/access, and atomically writes items/currency/confirmation/receipt", () => {
    expect(sql).toContain("ORDER BY c.id FOR UPDATE");
    expect(sql).toContain("BEFORE INSERT OR UPDATE OR DELETE ON public.character_content_refs");
    expect(commit).toContain("actual_refs IS DISTINCT FROM expected_refs");
    expect(commit).toContain("private.starting_grant_can_use_version");
    expect(commit).toContain("next_currency := jsonb_set");
    expect(commit).toContain('confirmed');
    expect(commit).toContain("SET status = 'awarded'");
    expect(sql).toContain("Completed starting grants are immutable");
    expect(sql).toContain("FOREIGN KEY (starting_grant_id, character_id)");
  });
  it("retains latest copy guards and every current child-copy statement", () => {
    const original = latest.slice(latest.indexOf("CREATE OR REPLACE FUNCTION public.copy_character"));
    // Exact unchanged prefix includes background/ASI guards, campaign/content
    // access, state/choices and private notes/timeline copying.
    const strippedDeclarations = copy.replace(/  source_starting_grant public.character_starting_grants%ROWTYPE;\r?\n  target_grant_id uuid;\r?\n  inherited boolean := false;\r?\n/, "");
    expect(strippedDeclarations.slice(0, strippedDeclarations.indexOf("  SELECT * INTO source_starting_grant"))).toBe(original.slice(0, original.indexOf("  INSERT INTO public.character_inventory")));
    for (const table of ["character_content_refs", "character_inventory", "character_spells", "npcs"]) expect(copy).toContain(`INSERT INTO public.${table}`);
    expect(copy).toContain("VALUES (new_character_id, 'inherited_completion', now())");
    expect(copy).toContain("ELSIF source_starting_grant.status = 'eligible'");
    expect(copy).toContain("item.starting_grant_id = source_starting_grant.id THEN target_grant_id");
    expect(copy).not.toContain("INSERT INTO public.character_rolls");
    expect(copy).not.toContain("source_grant.receipt");
  });
});
