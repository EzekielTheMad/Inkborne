// @vitest-environment node
import { describe, expect, it } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { assertHeadWorkingTree, traitOfflinePlugin, traitProjectInputPlugin, validateTraitBuildReceipt } from "../../../scripts/trait-production-assets.mjs";

describe("trait browser preparation only (no server/browser/provider)", () => {
  it("requires a successful matching clean production build receipt", () => {
    const sourceSha = "a".repeat(40);
    expect(() => validateTraitBuildReceipt({ gate: "build", exitCode: 0, sourceSha, sourceStatus: "" }, sourceSha)).not.toThrow();
    expect(() => validateTraitBuildReceipt({ gate: "build", exitCode: 0, sourceSha, sourceStatus: [] }, sourceSha)).not.toThrow();
    for (const patch of [{ gate: "check" }, { exitCode: 1 }, { sourceSha: "b".repeat(40) }, { sourceStatus: [" M source.ts"] }, { sourceStatus: undefined }]) {
      expect(() => validateTraitBuildReceipt({ gate: "build", exitCode: 0, sourceSha, sourceStatus: "", ...patch }, sourceSha)).toThrow();
    }
  });
  it("bundles the actual form/mapper with declared action/navigation boundaries only", async () => {
    const root = process.cwd();
    const captured = new Map();
    const result = await build({ absWorkingDir: root, entryPoints: [path.join(root, "e2e/local-traits/fixture.tsx")], bundle: true, write: false, metafile: true,
      platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, plugins: [traitOfflinePlugin(root), traitProjectInputPlugin(root, captured)] });
    expect(result.errors).toEqual([]);
    expect(result.outputFiles[0].text).toContain("Simulated save succeeded but the response was lost");
    expect(result.outputFiles[0].text).toContain("I checked Homebrew; allow another create");
    for (const relativePath of ["components/library/trait-form.tsx", "lib/homebrew/trait-form.ts", "lib/schemas/content-types/trait.ts", "lib/schemas/content-types/mechanical.ts"]) {
      const absolute = await fs.realpath(path.join(root, relativePath));
      expect(captured.get(absolute)?.sha256).toBe(createHash("sha256").update(await fs.readFile(absolute)).digest("hex"));
      expect(Object.keys(result.metafile.inputs).some(input => path.resolve(root, input) === absolute)).toBe(true);
    }
  });
  it("rejects staged changes even when ordinary unstaged git diff is empty", async () => {
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "trait-head-guard-"));
    const git = (...args: string[]) => execFileSync("git", ["-C", temporary, ...args], { encoding: "utf8", windowsHide: true }).trim();
    try {
      git("init", "--quiet");
      await fs.writeFile(path.join(temporary, "input.ts"), "export const original = 1;\n");
      git("add", "input.ts");
      git("-c", "user.name=Offline fixture", "-c", "user.email=fixture@example.invalid", "commit", "--quiet", "-m", "Synthetic guard fixture");
      expect(() => assertHeadWorkingTree(temporary, "input.ts")).not.toThrow();
      await fs.writeFile(path.join(temporary, "input.ts"), "export const original = 2;\n");
      git("add", "input.ts");
      expect(git("diff", "--", "input.ts")).toBe("");
      expect(() => assertHeadWorkingTree(temporary, "input.ts")).toThrow(/HEAD-to-working-tree drift/);
      await fs.writeFile(path.join(temporary, "untracked.ts"), "export const untracked = true;\n");
      expect(() => assertHeadWorkingTree(temporary, "untracked.ts")).toThrow();
    } finally {
      await fs.rm(temporary, { recursive: true, force: true });
    }
  });
  it("refuses an unapproved live server boundary before any bundle execution", async () => {
    const root = process.cwd();
    await expect(build({ stdin: { contents: "import '@/lib/supabase/server';", resolveDir: root }, bundle: true, write: false,
      platform: "browser", plugins: [traitOfflinePlugin(root)], logLevel: "silent" })).rejects.toThrow(/Unapproved live boundary/);
  });
});
