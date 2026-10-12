import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

let javascript: string, css: string;
test.beforeAll(async () => {
  await mkdir("test-results/canonical-weapon", { recursive: true });
  await writeFile("test-results/canonical-weapon/worker-process.json", JSON.stringify({ pid: process.pid, parentPid: process.ppid, command: process.argv, cwd: process.cwd(), startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(), ports: [], purpose: "Offline canonical ActionsTab/RollPopover/print with actual dice engine and deterministic fixture RNG" }, null, 2));
  const result = await build({ entryPoints: [path.resolve("e2e/print/weapon-harness.tsx")], bundle: true, write: false, outdir: "test-results/canonical-weapon/bundle", jsx: "automatic", loader: { ".css": "local-css" }, alias: { "@/lib/character/character-context": path.resolve("e2e/print/context-shim.ts"), "@": path.resolve(".") }, define: { "process.env.NODE_ENV": '"production"' } });
  javascript = result.outputFiles.find(file => file.path.endsWith(".js"))!.text;
  css = result.outputFiles.find(file => file.path.endsWith(".css"))!.text;
});
test("canonical attacks, crit requests and printable inventory agree", async ({ page }, testInfo) => {
  await page.setContent('<html><head><title>Canonical weapon fixture</title></head><body><div id="root"></div></body></html>');
  await page.addStyleTag({ content: css });
  await page.evaluate(() => { window.__canonicalWeaponUi = true; });
  await page.addScriptTag({ content: javascript });
  await expect(page.getByRole("button", { name: "Roll Trail Mallet attack" })).toHaveText("+4");
  await expect(page.getByRole("button", { name: "Roll Ridge Bow attack" })).toHaveText("+4");
  await expect(page.getByText("120/480 ft", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Roll Practice Baton damage" })).toBeDisabled();
  await page.getByRole("button", { name: "Roll Courier Needle attack" }).click();
  await page.getByRole("button", { name: "Roll", exact: true }).click();
  await expect(page.getByText("Crit!", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Roll Courier Needle damage" }).click();
  await expect(page.getByText("Crit!", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Roll Courier Needle damage" }).click();
  const rolls = await page.evaluate(() => ({ requests: window.__weaponRolls, results: window.__weaponResults }));
  expect(rolls.requests).toEqual([
    { kind: "attack", label: "Courier Needle — Attack", expression: "1d20+4" },
    { kind: "damage", label: "Courier Needle — Damage", expression: "1d8+4", crit: true, meta: { damage_type: "piercing" } },
    { kind: "damage", label: "Courier Needle — Damage", expression: "1d8+4", meta: { damage_type: "piercing" } },
  ]);
  expect(rolls.results?.[1].groups[0].rolls).toEqual([8, 8]);
  expect(rolls.results?.[1].modifier).toBe(4);
  expect(rolls.results?.[2].groups[0].rolls).toEqual([8]);
  await page.screenshot({ path: testInfo.outputPath("canonical-actions.png"), fullPage: true });
  await page.getByRole("button", { name: "Print / Save PDF", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Print preview" });
  await expect(preview).toContainText("Hit +4 | Damage 1d8 +4 piercing | 120/480 ft");
  await expect(preview).toContainText("1d8 piercing | 120/480 ft");
  await expect(preview).toContainText("Damage unavailable");
  await expect(preview).not.toContainText("1d4");
  await expect(preview).not.toContainText("FORBIDDEN_");
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("heading", { name: "Canonical weapon UI fixture" })).toBeHidden();
  expect(await preview.locator("main").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("canonical-print.png"), fullPage: true });
  await page.emulateMedia({ media: "screen" });
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
});
