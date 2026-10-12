import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync("supabase/staged/hit-die-transaction.sql", "utf8");
const commit = sql.slice(sql.indexOf("CREATE FUNCTION public.commit_hit_die_v1"), sql.indexOf("-- Explicit ownership/ACL"));
const reader = sql.slice(sql.indexOf("CREATE FUNCTION private.read_locked_hit_die_dependencies_v1"), sql.indexOf("CREATE FUNCTION private.preserve_hit_die_receipt_v1"));
describe("staged hit-die source contracts; no SQL/ACL/lock execution", () => {
  it("installs role, objects, ownership and revocations in one transaction", () => {
    expect(sql.indexOf("BEGIN;")).toBeLessThan(sql.indexOf("CREATE ROLE"));
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
    expect(sql.match(/^COMMIT;/gm)).toHaveLength(1);
    expect(sql).toContain("GRANT USAGE ON SCHEMA public, private TO inkborne_hit_die_kernel_owner");
    expect(sql).toContain("Inherited schema CREATE must be reconciled");
    expect(sql).not.toMatch(/GRANT\s+CREATE|GRANT\s+inkborne_hit_die_kernel_owner\s+TO/i);
  });
  it("restricts all three entrypoints to service_role with an isolated owner", () => {
    for (const signature of ["read_hit_die_receipt_v1(uuid, jsonb, text)", "resolve_hit_die_snapshot_v1(uuid, uuid)", "commit_hit_die_v1(uuid, jsonb, jsonb, jsonb, text, timestamptz)"]) {
      expect(sql).toContain(`ALTER FUNCTION public.${signature} OWNER TO inkborne_hit_die_kernel_owner`);
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated, service_role`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO service_role`);
    }
    expect(sql).toContain("NOLOGIN NOBYPASSRLS NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION");
    expect(sql).toContain("SECURITY DEFINER SET search_path = ''");
    expect(sql).toContain("GRANT UPDATE (state, action_revision)");
  });
  it("leaves the gate off and dependency authority unavailable even if a gate is changed", () => {
    expect(sql).toContain("VALUES (true, false)");
    expect(reader).toContain("RAISE EXCEPTION"); expect(reader).not.toContain("RETURN p_");
    expect(sql).not.toMatch(/GRANT[^;]*UPDATE[^;]*hit_die_gate_v1/i);
    expect(commit).toContain("current_snapshot := private.read_locked_hit_die_dependencies_v1(c.id)");
    expect(commit).toContain("current_snapshot IS DISTINCT FROM p_snapshot");
    expect(commit).not.toContain("digest(");
  });
  it("serializes owner/replay before gate, dependency and candidate checks", () => {
    expect(commit.indexOf("AND user_id = p_actor_id FOR UPDATE")).toBeLessThan(commit.indexOf("lookup :="));
    expect(commit.indexOf("lookup->>'status' <> 'absent'")).toBeLessThan(commit.indexOf("SELECT enabled"));
    expect(commit.indexOf("lookup->>'status' <> 'absent'")).toBeLessThan(commit.indexOf("read_locked_hit_die_dependencies_v1(c.id)"));
    expect(commit.indexOf("lookup->>'status' <> 'absent'")).toBeLessThan(commit.indexOf("hit_die_exact_keys_v1(p_candidate"));
  });
  it("preserves lifetime receipt/roll links with deferred reciprocal integrity", () => {
    expect(sql).toContain("PRIMARY KEY (character_id, operation_id)");
    expect(sql).toContain("WHERE action_operation_id IS NOT NULL");
    expect(sql.match(/DEFERRABLE INITIALLY DEFERRED/g)).toHaveLength(2);
    expect(sql).toContain("WITH CHECK (action_operation_id IS NULL)");
    expect(sql).toContain("Character-lifetime hit-die receipt is immutable");
    expect(sql).toContain("Accepted action roll is immutable");
    expect(sql).toContain("verified_actor_id uuid NOT NULL, -- deliberately no profile cascade");
  });
  it("uses native post-lock acceptance and INT4 guard before every write/cast", () => {
    expect(commit.indexOf("total NOT BETWEEN -2147483648 AND 2147483647")).toBeLessThan(commit.indexOf("INSERT INTO private.character_action_receipts"));
    expect(commit.indexOf("total NOT BETWEEN -2147483648 AND 2147483647")).toBeLessThan(commit.indexOf("total::integer"));
    expect(commit).toContain("accepted := pg_catalog.clock_timestamp()");
    expect(commit).toContain("accepted >= deadline"); expect(sql).toContain("Unsupported expiry precision/profile");
    expect(sql).toContain("expiry IS DISTINCT FROM pg_catalog.date_trunc('milliseconds', expiry)");
    const writes = commit.slice(commit.indexOf("INSERT INTO private.character_action_receipts"));
    expect(writes).toContain("UPDATE public.characters SET state = next_state, action_revision");
    expect(writes).toContain("INSERT INTO public.character_rolls");
    expect(writes).not.toContain("EXCEPTION WHEN");
  });
});
