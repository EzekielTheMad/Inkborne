// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { build } from "esbuild";
// Runtime-neutral fixture preparation helpers; no browser/server launch.
import { loadProductionStyles, staticAssetPath, offlineParityPlugin } from "../../../scripts/race-parity-browser-support.mjs";

async function productionFixture(check: (folder: string, receipt: string) => Promise<void>) {
  const tempRoot = await fs.realpath(tmpdir());
  const folder = await fs.mkdtemp(path.join(tempRoot, "inkborne-race-parity-"));
  try {
    await fs.mkdir(path.join(folder, ".next", "static", "chunks"), { recursive: true });
    await fs.writeFile(path.join(folder, ".next", "BUILD_ID"), "synthetic-build");
    const receipt = path.join(folder, "receipt.json");
    await fs.writeFile(receipt, JSON.stringify({ buildRoot: folder, sourceSha: "a".repeat(40), buildId: "synthetic-build" }));
    await check(folder, receipt);
  } finally {
    if (!path.resolve(folder).startsWith(tempRoot + path.sep + "inkborne-race-parity-")) throw Error("Unexpected temporary target; cleanup refused.");
    await fs.rm(folder, { recursive: true, force: true });
  }
}

describe("bounded offline race parity fixture preparation", () => {
  it("bundles actual clients with only declared navigation/draft/persistence stubs, without launching UI", async () => {
    const root = process.cwd();
    const result = await build({ entryPoints: [path.join(root, "e2e/local-race-parity/fixture.tsx")], bundle: true,
      write: false, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, plugins: [offlineParityPlugin(root)] });
    expect(result.errors).toEqual([]);
    expect(result.outputFiles[0].text).toContain("Offline writes prohibited");
    expect(result.outputFiles[0].text).toContain("Actual canonical definition/snapshot parser rejected");
  });
  it("requires completed production CSS and a matching explicit BUILD_ID; no globals fallback", async () => {
    await productionFixture(async (folder, receipt) => {
      await expect(loadProductionStyles(receipt)).rejects.toThrow(/no CSS/);
      await fs.writeFile(path.join(folder, ".next", "static", "chunks", "main.css"), '.synthetic-font{--font-marcellus:"Synthetic"}');
      const loaded = await loadProductionStyles(receipt);
      expect(loaded.buildId).toBe("synthetic-build");
      expect(loaded.styles).toHaveLength(1);
      expect(loaded.styles[0].sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(loaded.fontClasses).toEqual(["synthetic-font"]);
      await fs.writeFile(path.join(folder, ".next", "BUILD_ID"), "another-build");
      await expect(loadProductionStyles(receipt)).rejects.toThrow(/differs/);
    });
  });
  it("rejects unknown receipt fields and serves only contained CSS/font/image files", async () => {
    await productionFixture(async (folder, receipt) => {
      const staticRoot = path.join(folder, ".next", "static");
      await fs.writeFile(path.join(staticRoot, "chunks", "main.css"), "body{color:white}");
      expect(await staticAssetPath(staticRoot, "/_next/static/chunks/main.css")).toBe(path.join(staticRoot, "chunks", "main.css"));
      expect(await staticAssetPath(staticRoot, "/_next/static/chunks/main.js")).toBeNull();
      expect(await staticAssetPath(staticRoot, "/_next/static/..%2f..%2foutside.css")).toBeNull();
      const original = JSON.parse(await fs.readFile(receipt, "utf8"));
      await fs.writeFile(receipt, JSON.stringify({ ...original, instructions: "unexpected" }));
      await expect(loadProductionStyles(receipt)).rejects.toThrow(/explicit/);
    });
  });
});
