import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
let javascript: string, css: string;
test.beforeAll(async () => {
  await mkdir("test-results/r21-subclass/browser", { recursive: true });
  await writeFile(`test-results/r21-subclass/browser/process-${process.pid}.json`, JSON.stringify({ pid: process.pid, parentPid: process.ppid, command: process.argv, cwd: process.cwd(), ports: [], startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(), purpose: "Offline subclass source integration, original private snapshots, in-memory state/spell/roll boundaries; no live authority/freshness proof" }, null, 2));
  const shim = path.resolve("e2e/subclass-casting/provider-shim.ts");
  const aliases = Object.fromEntries(["@/lib/sheet/update-state", "@/lib/supabase/client", "@/lib/supabase/inventory", "@/lib/supabase/spells", "@/lib/supabase/rolls"].map(name => [name, shim]));
  const result = await build({ entryPoints: [path.resolve("e2e/subclass-casting/harness.tsx")], bundle: true, write: false, outdir: "test-results/r21-subclass/browser/bundle", jsx: "automatic", loader: { ".css": "local-css" }, alias: { ...aliases, "@": path.resolve(".") }, define: { "process.env.NODE_ENV": '"production"' } });
  javascript = result.outputFiles.find(file => file.path.endsWith(".js"))!.text; css = result.outputFiles.find(file => file.path.endsWith(".css"))?.text ?? "";
});
for (const kind of ["third", "prepared", "inactive", "missing", "grant-full", "grant-half", "grant-pact", "viewer", "multiclass"] as const) test(`${kind} effective subclass source`, async ({ page }, info) => {
  const errors: string[] = [], remote: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => { remote.push(route.request().url()); return route.abort(); });
  // Secure intercepted loopback document, matching reviewed root159441e.
  // Native crypto remains real; no HTTP server/provider is contacted.
  await page.route("http://127.0.0.1/subclass-fixture", route => route.fulfill({ contentType: "text/html", body: '<html><body><div id="root"></div></body></html>' }));
  await page.goto("http://127.0.0.1/subclass-fixture");
  expect(await page.evaluate(() => isSecureContext && typeof crypto.randomUUID === "function")).toBe(true);
  await page.addStyleTag({ content: css + `
    /* Fixture positions only; compiled app Tailwind intentionally omitted. */
    body { font-family: sans-serif; padding: 16px; } output { display: block; overflow-wrap: anywhere; }
    [data-slot="dialog-overlay"] { position: fixed; inset: 0; z-index: 50; background: #0003; }
    [data-slot="dialog-content"] { position: fixed; z-index: 51; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(560px, 80vw); max-height: 85vh; overflow: auto; background: white; border: 1px solid #888; padding: 20px; }
  ` });
  await page.evaluate(kind => { window.__subclassKind = kind; }, kind);
  await page.addScriptTag({ content: javascript });
  await expect(page.getByLabel("Slot resolution")).toContainText(kind === "missing" ? "unavailable" : "available");
  if (kind === "missing" || kind === "inactive") {
    await expect(page.getByRole("button", { name: "Cast Prism Mark" })).toHaveCount(0);
    if (kind === "missing") { await expect(page.getByText("Prism Mark", { exact: true })).toBeVisible(); await expect(page.getByRole("button", { name: "Print / Save PDF" })).toBeDisabled(); }
    await page.getByRole("button", { name: "Open rest" }).click();
    if (kind === "missing") await expect(page.getByRole("button", { name: "Take Long Rest" })).toBeDisabled();
    else { await page.getByRole("button", { name: "Take Long Rest" }).click(); await expect.poll(() => page.evaluate(() => window.__subclassWrites.length)).toBe(1); }
  } else {
    const grant = kind.startsWith("grant-"), bonus = grant ? 7 : 4;
    if (kind === "prepared") {
      await expect(page.getByRole("button", { name: "Cast Prism Mark" })).toHaveCount(0);
      await page.getByTitle("Prepare", { exact: true }).click();
      await expect(page.getByRole("button", { name: "Cast Prism Mark" })).toBeVisible();
      expect(await page.evaluate(() => window.__subclassUpdates.length)).toBe(1);
    }
    if (kind === "viewer") await page.getByRole("button", { name: "Inspect source" }).click();
    else await page.getByRole("button", { name: "Cast Prism Mark" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`spell attack +${bonus}`); await expect(dialog).toContainText(`save DC ${8 + bonus}`);
    if (kind === "viewer") await expect(dialog.getByRole("button", { name: "Cast", exact: true })).toBeDisabled();
    else {
      if (kind === "multiclass") await dialog.getByRole("radio", { name: /^3rd/ }).click();
      await page.screenshot({ path: info.outputPath(`${kind}-preview.png`), fullPage: true });
      await dialog.getByRole("button", { name: "Cast", exact: true }).click(); await expect(dialog.getByRole("button", { name: "Done" })).toBeVisible();
      expect(await page.evaluate(() => window.__subclassWrites.length)).toBe(1);
      expect(await page.evaluate(() => window.__subclassStored.spell_slots_used)).toEqual(kind === "grant-pact" ? { pact: 1 } : kind === "multiclass" ? { "3": 1 } : { "1": 1 });
      expect(await page.evaluate(() => window.__subclassStored.concentrating_on?.spell_slug)).toBe("prism-mark");
      await page.evaluate(() => { Math.random = () => 0.999; });
      await dialog.getByRole("button", { name: /Roll Attack/ }).click(); await expect.poll(() => page.evaluate(() => window.__subclassRolls.length)).toBe(1);
      expect(await page.evaluate(() => window.__subclassRolls[0].request.expression)).toBe(`1d20+${bonus}`);
      await dialog.getByRole("button", { name: "Done" }).click();
      await page.getByRole("button", { name: "Print / Save PDF", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Print preview" })).toContainText(`DC ${8 + bonus}; attack +${bonus}`);
      await expect(page.getByRole("dialog", { name: "Print preview" })).toContainText("lumen-adept v1");
    }
  }
  await page.screenshot({ path: info.outputPath(`${kind}.png`), fullPage: true });
  expect(errors).toEqual([]); expect(remote).toEqual([]);
});
