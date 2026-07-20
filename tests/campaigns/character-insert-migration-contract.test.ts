import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/00056_character_insert_returning_visibility.sql",
  ),
  "utf8",
);

describe("character INSERT ... RETURNING visibility migration contract", () => {
  it("makes the inserted character directly visible to its owner", () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Authorized users can view characters"',
    );
    expect(migration).toMatch(
      /CREATE POLICY "Authorized users can view characters"[\s\S]*?FOR SELECT[\s\S]*?TO authenticated[\s\S]*?USING \([\s\S]*?user_id = \(SELECT auth\.uid\(\)\)/,
    );
  });

  it("falls back to the existing helper for all shared visibility paths", () => {
    expect(migration).toMatch(
      /user_id = \(SELECT auth\.uid\(\)\)[\s\S]*?OR private\.can_view_character\(id\)/,
    );
  });
});
