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

const syntheticFonts = '.marcellus-font{--font-marcellus:"Synthetic Display","Fallback"}.garamond-font{--font-eb-garamond:"Synthetic Flourish","Fallback"}'
  + '@font-face{font-family:"Synthetic Display";font-style:normal;font-weight:400;src:url(../media/display.woff2)}'
  + '@font-face{font-family:"Synthetic Flourish";font-style:normal;font-weight:400 800;src:url(../media/flourish.woff2)}'
  + '@font-face{font-family:"Synthetic Flourish";font-style:italic;font-weight:400 800;src:url(../media/flourish-italic.woff2)}';
async function fontAssets(folder: string) {
  const directory = path.join(folder, ".next", "static", "media");
  await fs.mkdir(directory, { recursive: true });
  for (const name of ["display", "flourish", "flourish-italic"]) await fs.writeFile(path.join(directory, `${name}.woff2`), `synthetic metadata bytes ${name}`);
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
      await fs.writeFile(path.join(folder, ".next", "static", "chunks", "main.css"), syntheticFonts);
      await fontAssets(folder);
      const loaded = await loadProductionStyles(receipt);
      expect(loaded.buildId).toBe("synthetic-build");
      expect(loaded.styles).toHaveLength(1);
      expect(loaded.styles[0].sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(loaded.fontClasses).toEqual(["marcellus-font", "garamond-font"]);
      expect(loaded.fonts.map((font: { family: string }) => font.family)).toEqual(["Synthetic Display", "Synthetic Flourish"]);
      expect(loaded.fonts[1].faces.map((face: { style: string }) => face.style)).toEqual(["normal", "italic"]);
      expect(loaded.fonts[0].faces[0]).toMatchObject({ requestPath: "/_next/static/media/display.woff2", bytes: 32 });
      expect(loaded.fonts[0].faces[0].sha256).toMatch(/^[a-f0-9]{64}$/);
      await fs.writeFile(path.join(folder, ".next", "BUILD_ID"), "another-build");
      await expect(loadProductionStyles(receipt)).rejects.toThrow(/differs/);
    });
  });
  it.each([
    ["missing generated variable", syntheticFonts.replace('--font-eb-garamond', '--unrelated-font'), /generated production class/],
    ["missing italic face", syntheticFonts.replace('font-style:italic', 'font-style:normal'), /FontFaces missing/],
    ["remote font URL", syntheticFonts.replace('../media/display.woff2', 'https://example.com/display.woff2'), /Remote or ambiguous/],
    ["missing local asset", syntheticFonts.replace('../media/display.woff2', '../media/missing.woff2'), /Missing contained/],
  ])("refuses %s before launching any browser", async (_label, css, message) => {
    await productionFixture(async (folder, receipt) => {
      await fontAssets(folder);
      await fs.writeFile(path.join(folder, ".next", "static", "chunks", "main.css"), css);
      await expect(loadProductionStyles(receipt)).rejects.toThrow(message);
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
