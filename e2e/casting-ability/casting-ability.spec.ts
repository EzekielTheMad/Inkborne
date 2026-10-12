import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
let javascript: string, css: string;
test.beforeAll(async () => {
  await mkdir("test-results/r21-ability/browser", { recursive: true });
  await writeFile(`test-results/r21-ability/browser/process-${process.pid}.json`, JSON.stringify({ pid: process.pid, parentPid: process.ppid, command: process.argv, cwd: process.cwd(), startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(), ports: [], purpose: "Offline actual provider casting; original fixtures, in-memory conditional persistence and rolls, no provider authority/freshness proof" }, null, 2));
  const shim = path.resolve("e2e/casting-ability/provider-shim.ts");
  const aliases = Object.fromEntries(["@/lib/sheet/update-state", "@/lib/supabase/client", "@/lib/supabase/inventory", "@/lib/supabase/spells", "@/lib/supabase/rolls"].map(name => [name, shim]));
  const result = await build({ entryPoints: [path.resolve("e2e/casting-ability/harness.tsx")], bundle: true, write: false, outdir: "test-results/r21-ability/browser/bundle", jsx: "automatic", loader: { ".css": "local-css" }, alias: { ...aliases, "@": path.resolve(".") }, define: { "process.env.NODE_ENV": '"production"' } });
  javascript = result.outputFiles.find(file => file.path.endsWith(".js"))!.text;
  css = result.outputFiles.find(file => file.path.endsWith(".css"))?.text ?? "";
});
for (const kind of ["int-wizard", "int-warlock", "cha-wizard", "cha-warlock", "missing", "viewer"] as const) test(`${kind} actual provider casting`, async ({ page }, info) => {
  const errors: string[] = [], remote: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => { remote.push(route.request().url()); return route.abort(); });
  // Intercepted loopback document supplies the secure context required by the
  // actual active-effect UUID generator. No HTTP server/provider is contacted.
  await page.route("http://127.0.0.1/casting-fixture", route => route.fulfill({
    contentType: "text/html", body: '<html><body><div id="root"></div></body></html>',
  }));
  await page.goto("http://127.0.0.1/casting-fixture");
  expect(await page.evaluate(() => isSecureContext)).toBe(true);
  await page.addStyleTag({ content: css + `
    /* Offline fixture positioning; compiled app Tailwind intentionally omitted. */
    body { font-family: sans-serif; padding: 16px; } output { display: block; overflow-wrap: anywhere; }
    [data-slot="dialog-overlay"] { position: fixed; inset: 0; z-index: 50; background: #0003; }
    [data-slot="dialog-content"] { position: fixed; z-index: 51; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(560px, 80vw); max-height: 85vh; overflow: auto; background: white; border: 1px solid #888; padding: 20px; }
  ` });
  await page.evaluate(kind => { window.__castingKind = kind; }, kind);
  await page.addScriptTag({ content: javascript });
  await expect(page.getByText(/Highest class save DC and attack/)).toBeVisible();
  await page.getByRole("button", { name: "Open cast", exact: true }).click();
  const dialog = page.getByRole("dialog");
  if (kind === "missing") {
    await expect(dialog).toContainText("saved casting source is unavailable");
    await expect(dialog).not.toContainText("save DC 15");
    await expect(dialog.getByRole("button", { name: "Cast", exact: true })).toBeDisabled();
  } else {
    const strong = kind === "int-wizard" || kind === "cha-warlock";
    const bonus = strong ? 7 : 3;
    await expect(dialog).toContainText(`spell attack +${bonus}`);
    await expect(dialog).toContainText(`save DC ${8 + bonus}`);
    await expect(dialog).toContainText(`1d8 + ${bonus - 3}`);
    if (kind === "viewer") await expect(dialog.getByRole("button", { name: "Cast", exact: true })).toBeDisabled();
    else {
      if (kind.endsWith("warlock")) {
        await dialog.getByRole("radio", { name: /Pact/ }).click();
        await expect(dialog).toContainText(`2d8 + ${bonus - 3}`);
      }
      await page.screenshot({ path: info.outputPath(`${kind}-preview.png`), fullPage: true });
      expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe("function");
      await dialog.getByRole("button", { name: "Cast", exact: true }).click();
      await expect(dialog.getByRole("button", { name: "Done", exact: true })).toBeVisible();
      expect(await page.evaluate(() => window.__castingWrites.length)).toBe(1);
      expect(await page.evaluate(() => window.__castingStored.concentrating_on?.spell_slug)).toBe("prism-signal");
      expect(await page.evaluate(() => window.__castingStored.active_effects?.length)).toBe(1);
      expect(await page.evaluate(() => window.__castingStored.spell_slots_used)).toEqual(kind.endsWith("warlock") ? { pact: 1 } : { "1": 1 });
      await page.evaluate(() => { Math.random = () => 0.999; });
      await dialog.getByRole("button", { name: /Roll Attack/ }).click();
      await expect.poll(() => page.evaluate(() => window.__castingRolls.length)).toBe(1);
      expect(await page.evaluate(() => window.__castingRolls[0].request.expression)).toBe(`1d20+${bonus}`);
      expect(await page.evaluate(() => window.__castingRolls[0].natural)).toBe(20);
    }
  }
  if (kind === "missing" || kind === "viewer") expect(await page.evaluate(() => window.__castingWrites.length)).toBe(0);
  await page.screenshot({ path: info.outputPath(`${kind}.png`), fullPage: true });
  expect(errors).toEqual([]); expect(remote).toEqual([]);
});
