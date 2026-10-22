// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const external = vi.hoisted(() => new Map<string, Buffer>());
vi.mock("node:fs", async importOriginal => {
  const original = await importOriginal<typeof import("node:fs")>();
  return { ...original,
    readFileSync: (file: string, ...args: unknown[]) => external.has(String(file)) ? external.get(String(file)) : Reflect.apply(original.readFileSync, original, [file, ...args]),
    realpathSync: (file: string, ...args: unknown[]) => external.has(String(file)) ? String(file) : Reflect.apply(original.realpathSync, original, [file, ...args]),
    lstatSync: (file: string, ...args: unknown[]) => external.has(String(file)) ? { isFile: () => true, isSymbolicLink: () => false } : Reflect.apply(original.lstatSync, original, [file, ...args]),
  };
});
import { CHARACTER_FILES, CHARACTER_OPERATIONS, CHARACTER_PROFILE, characterPackageHash, executeCharacterRows,
  freezeCharacterPackage, loadCharacterPackage, validateCharacterApproval, type CharacterApproval, type CharacterPackage } from "@/scripts/character-command-native";
import { TARGET } from "@/scripts/equipment-runtime";
import { framedCharacterSql } from "@/scripts/character-command-psql";

let root: string, pkg: CharacterPackage;
const git = (args: string[]) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
const approval = (): CharacterApproval => ({ gate: "G2", scope: CHARACTER_PROFILE, approvedBy: "Victor",
  approvedAtUTC: "2026-10-22T15:00:00Z", sourceSha: pkg.baseline.sourceSha,
  packageSha256: characterPackageHash(pkg), engineId: "engine:SIMULATED", operations: CHARACTER_OPERATIONS });
beforeAll(() => {
  root = mkdtempSync(path.join(realpathSync(os.tmpdir()), "inkborne-character-freeze-"));
  const paths = new Set([...CHARACTER_FILES, "supabase/migrations/00001_fixture.sql", "supabase/staged/starting-equipment-transaction.sql",
    "docs/specs/2026-10-12-equipment-runtime.compose.yaml", "scripts/equipment-runtime.ts", "scripts/equipment-runtime/bootstrap-preflight.sql",
    "scripts/equipment-runtime/baseline-assertions.sql", "scripts/equipment-runtime/stage-assertions.sql", "scripts/equipment-runtime/catalog-audit.sql"]);
  for (const file of paths) { mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); writeFileSync(path.join(root, file), "-- SIMULATED freeze bytes\n"); }
  git(["init", "--quiet"]); git(["add", "."]);
  git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "core.hooksPath=" + path.join(root, "no-hooks"), "commit", "--quiet", "-m", "Fixture"]);
});
beforeEach(() => {
  git(["restore", "."]); external.clear();
  for (const file of [path.join(TARGET.scratch, "bootstrap", "98-webhooks.sql"), path.join(TARGET.scratch, "bootstrap", "99-roles.sql"), path.join(TARGET.scratch, "character-command-run.mjs")]) external.set(file, Buffer.from("SIMULATED external bytes"));
  pkg = freezeCharacterPackage(root);
});
afterAll(() => {
  const parent = realpathSync(os.tmpdir());
  if (path.dirname(root) !== parent || !path.basename(root).startsWith("inkborne-character-freeze-")) throw Error("Fixture cleanup path refused");
  rmSync(root, { recursive: true, force: true });
});

describe("CP3 SIMULATED freeze/admission; no native runtime, provider or approval", () => {
  it("binds baseline, every added source and all executable external input", () => {
    expect(pkg.files.map(file => file.path)).toEqual(CHARACTER_FILES);
    expect(pkg.external).toHaveLength(3); expect(pkg.fixtureIds).toHaveLength(7);
    expect(loadCharacterPackage(root, pkg).has("scripts/character-command-concurrency.ts")).toBe(true);
  });
  it.each([{ scope: "R07.1-baseline-and-stage" }, { gate: "G1" }, { approvedBy: "Agent" }, { approvedAtUTC: "bad" },
    { engineId: "" }, { sourceSha: "0".repeat(40) }, { packageSha256: "0".repeat(64) }, { operations: [] }, { extra: true }])(
    "refuses inherited/malformed/expanded approval %#", change => {
      expect(() => validateCharacterApproval(pkg, { ...approval(), ...change } as CharacterApproval, characterPackageHash(pkg))).toThrow();
    },
  );
  it("requires exact explicit package confirmation", () => {
    expect(() => validateCharacterApproval(pkg, approval(), "")).toThrow();
    expect(() => validateCharacterApproval(pkg, approval(), characterPackageHash(pkg))).not.toThrow();
  });
  it("refuses changed repo source before runtime use", () => {
    writeFileSync(path.join(root, CHARACTER_FILES[0]), "changed\n");
    expect(() => loadCharacterPackage(root, pkg)).toThrow();
  });
  it("refuses changed external launcher/bootstrap bytes", () => {
    external.set(pkg.external[2].path, Buffer.from("changed external"));
    expect(() => loadCharacterPackage(root, pkg)).toThrow();
  });
  it("refuses any changed finite inventory/operation list", () => {
    expect(() => loadCharacterPackage(root, { ...pkg, files: pkg.files.slice(1) })).toThrow();
    expect(() => loadCharacterPackage(root, { ...pkg, fixtureIds: [...pkg.fixtureIds, "extra"] })).toThrow();
  });
  it("rejects approval before source/transport/process/evidence access", async () => {
    const transport = vi.fn(), save = vi.fn(), saveProcess = vi.fn();
    await expect(executeCharacterRows({ root: "MUST_NOT_READ", pkg, approval: { ...approval(), scope: "old" } as unknown as CharacterApproval,
      confirmation: characterPackageHash(pkg), baselineReceipt: {} as never, resourceIds: {} as never, transport, save, saveProcess })).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled(); expect(saveProcess).not.toHaveBeenCalled();
  });
  it("rejects unsupported escape strings before an earlier SQL error can be hidden", () => {
    const text = String.raw`UPDATE t SET x=E'\'x'; UPDATE missing_table SET x=1; UPDATE t SET x=2;--'`;
    expect(() => framedCharacterSql(text, "INKBORNE_BEGIN_" + "a".repeat(32), "INKBORNE_END_" + "b".repeat(32))).toThrow();
  });
});
