// @vitest-environment node
import { describe, expect, it } from "vitest";
import path from "node:path";
import { build } from "esbuild";
import { traitOfflinePlugin, validateTraitBuildReceipt } from "../../../scripts/trait-production-assets.mjs";

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
    const result = await build({ entryPoints: [path.join(root, "e2e/local-traits/fixture.tsx")], bundle: true, write: false,
      platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, plugins: [traitOfflinePlugin(root)] });
    expect(result.errors).toEqual([]);
    expect(result.outputFiles[0].text).toContain("Simulated save succeeded but the response was lost");
    expect(result.outputFiles[0].text).toContain("I checked Homebrew; allow another create");
  });
  it("refuses an unapproved live server boundary before any bundle execution", async () => {
    const root = process.cwd();
    await expect(build({ stdin: { contents: "import '@/lib/supabase/server';", resolveDir: root }, bundle: true, write: false,
      platform: "browser", plugins: [traitOfflinePlugin(root)], logLevel: "silent" })).rejects.toThrow(/Unapproved live boundary/);
  });
});
