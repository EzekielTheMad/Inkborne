import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
let javascript: string, css: string;
test.beforeAll(async () => {
  await mkdir("test-results/r21-slots/browser", { recursive: true });
  await writeFile(`test-results/r21-slots/browser/process-${process.pid}.json`, JSON.stringify({ pid: process.pid, parentPid: process.ppid, command: process.argv, cwd: process.cwd(), startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(), ports: [], purpose: "Offline actual CharacterProvider slot workflows; in-memory conditional persistence, no provider authorization proof" }, null, 2));
  const shim = path.resolve("e2e/slots/provider-shim.ts");
  const aliases = Object.fromEntries(["@/lib/sheet/update-state", "@/lib/supabase/client", "@/lib/supabase/inventory", "@/lib/supabase/spells", "@/lib/supabase/rolls"].map(name => [name, shim]));
  const result = await build({ entryPoints: [path.resolve("e2e/slots/harness.tsx")], bundle: true, write: false, outdir: "test-results/r21-slots/browser/bundle", jsx: "automatic", loader: { ".css": "local-css" }, alias: { ...aliases, "@": path.resolve(".") }, define: { "process.env.NODE_ENV": '"production"' } });
  javascript = result.outputFiles.find(file => file.path.endsWith(".js"))!.text;
  css = result.outputFiles.find(file => file.path.endsWith(".css"))!.text;
});
for (const kind of ["half", "pact", "unavailable", "noncaster", "large"] as const) test(`${kind} actual provider slot controls`, async ({ page }, info) => {
  await page.setContent('<html><body><div id="root"></div></body></html>');
  await page.addStyleTag({ content: css + `
    /* Isolated fixture dialog positioning; app Tailwind is intentionally omitted. */
    body { font-family: sans-serif; padding: 16px; }
    output { display: block; overflow-wrap: anywhere; }
    [data-slot="dialog-overlay"] { position: fixed; inset: 0; z-index: 50; background: #0003; }
    [data-slot="dialog-content"] { position: fixed; z-index: 51; left: 50%; top: 50%; transform: translate(-50%, -50%); max-width: 560px; max-height: 85vh; overflow: auto; background: white; border: 1px solid #888; padding: 20px; }
  ` });
  await page.evaluate(kind => { window.__slotKind = kind; }, kind);
  await page.addScriptTag({ content: javascript });
  const unresolved = kind === "unavailable";
  await expect(page.getByLabel("Slot resolution")).toContainText(unresolved ? "unavailable" : "available");
  if (kind === "large") {
    await expect(page.getByText("4294967295/4294967296", { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("large-desktop-counter.png"), fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByText("4294967295/4294967296", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath("large-mobile-counter.png"), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByRole("button", { name: "Mark 1st slot used" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Restore 1st slot" })).toHaveCount(1);
    await page.getByRole("button", { name: "Mark 1st slot used" }).click();
    await expect.poll(() => page.evaluate(() => window.__slotStored.spell_slots_used?.["1"])).toBe(2);
    await page.getByRole("button", { name: "Print / Save PDF", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Print preview" })).toContainText("4294967294/4294967296 remaining");
    await page.getByRole("button", { name: "Back to character" }).click();
    await page.getByRole("button", { name: "Open cast" }).click();
    await page.getByRole("button", { name: "Cast", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__slotWrites.length)).toBe(2);
    expect(await page.evaluate(() => window.__slotStored.spell_slots_used?.["1"])).toBe(3);
  } else if (kind === "half" || kind === "pact") {
    await expect(page.getByText("2/3", { exact: true })).toBeVisible();
    if (kind === "pact") await expect(page.getByText("2/2", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Print / Save PDF", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Print preview" })).toContainText("2/3 remaining");
    if (kind === "pact") await expect(page.getByRole("dialog", { name: "Print preview" })).toContainText("Pact slots (level 2)");
    await page.getByRole("button", { name: "Back to character" }).click();
    await page.getByRole("button", { name: "Open cast" }).click();
    if (kind === "pact") await expect(page.getByRole("radiogroup", { name: "Spell slot level" })).toContainText("Pact");
    await page.getByRole("button", { name: "Cast", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__slotWrites.length)).toBe(1);
    expect(await page.evaluate(() => window.__slotStored.spell_slots_used?.["1"])).toBe(2);
  } else {
    if (unresolved) await expect(page.getByRole("button", { name: "Print / Save PDF" })).toBeDisabled();
    await page.getByRole("button", { name: "Open rest" }).click();
    if (unresolved) {
      await expect(page.getByRole("button", { name: "Take Short Rest" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Take Long Rest" })).toBeDisabled();
      expect(await page.evaluate(() => window.__slotWrites)).toEqual([]);
    } else {
      await page.getByRole("button", { name: "Take Long Rest" }).click();
      await expect.poll(() => page.evaluate(() => window.__slotWrites.length)).toBe(1);
      expect(await page.evaluate(() => window.__slotStored.current_hp)).toBe(20);
    }
  }
  await page.screenshot({ path: info.outputPath(`${kind}.png`), fullPage: true });
});
