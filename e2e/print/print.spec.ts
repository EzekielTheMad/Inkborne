import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

let javascript: string, css: string;
test.beforeAll(async () => {
  await mkdir("test-results/character-print", { recursive: true });
  await writeFile("test-results/character-print/worker-process.json", JSON.stringify({ pid: process.pid, parentPid: process.ppid, command: process.argv, cwd: process.cwd(), startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(), ports: [], purpose: "Offline character print fixtures; no server or provider access" }, null, 2));
  const result = await build({ entryPoints: [path.resolve("e2e/print/harness.tsx")], bundle: true, write: false, outdir: "test-results/character-print/bundle", jsx: "automatic", loader: { ".css": "local-css" }, alias: { "@/lib/character/character-context": path.resolve("e2e/print/context-shim.ts"), "@": path.resolve(".") }, define: { "process.env.NODE_ENV": '"production"' } });
  javascript = result.outputFiles.find(file => file.path.endsWith(".js"))!.text;
  css = result.outputFiles.find(file => file.path.endsWith(".css"))!.text;
});
for (const kind of ["martial", "caster", "long"] as const) for (const format of ["Letter", "A4"] as const) {
  test(`${kind} ${format} print/save PDF`, async ({ page }, testInfo) => {
    await page.setContent('<html><head><title>Character</title></head><body><div id="root"></div></body></html>');
    await page.addStyleTag({ content: css });
    await page.evaluate(fixture => { window.__printFixture = fixture; }, kind);
    await page.addScriptTag({ content: javascript });
    await page.getByRole("button", { name: "Print / Save PDF", exact: true }).click();
    const preview = page.getByRole("dialog", { name: "Print preview" });
    await expect(preview).toBeVisible();
    await expect(preview).not.toContainText("FORBIDDEN_");
    await expect(preview.getByRole("button", { name: "Back to character" })).toBeFocused();
    await page.emulateMedia({ media: "print" });
    await expect(page.getByText("FORBIDDEN_DM_OUTSIDE_PREVIEW")).toBeHidden();
    await expect(preview.getByRole("button", { name: "Print / Save PDF" })).toBeHidden();
    expect(await preview.locator("main").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.pdf({ path: testInfo.outputPath(`${kind}-${format}.pdf`), format, displayHeaderFooter: false, printBackground: true });
    await page.emulateMedia({ media: "screen" });
    await page.keyboard.press("Escape");
    await expect(preview).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Print / Save PDF", exact: true })).toBeFocused();
  });
}
