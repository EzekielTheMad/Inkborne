import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
const button = page => page.getByRole("button", { name: "Preview local file", exact: true });
async function file(page, source, name = "original.json") { await page.getByLabel("Original local JSON file", { exact: true }).setInputFiles({ name, mimeType: "application/json", buffer: Buffer.from(source) }); }
export async function runNpcJsonCases({ browser, origin, root, inspect, setActive, evidence, pageErrors, blockedRequests, unexpectedRequests, diagnostics }) {
  const original = await fs.readFile(path.join(root, "tests/fixtures/npc-json/original-npc.json"));
  for (const [size, width] of [["desktop", 1280], ["mobile", 390]]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin !== origin) { blockedRequests.push(route.request().url()); return route.abort(); }
      if (route.request().method() !== "GET") { unexpectedRequests.push(route.request().method()); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage(); setActive(page);
    page.on("pageerror", error => pageErrors.push(error.message)); page.on("console", msg => { if (msg.type() === "error") diagnostics.push(msg.text()); });
    await page.goto(`${origin}/fixture`); await file(page, original); await button(page).click();
    await page.getByRole("region", { name: "NPC profile", exact: true }).waitFor();
    assert.equal(await page.getByText("Counts original footsteps.", { exact: true }).count(), 2);
    assert.equal(await page.locator("script:not([src])").count(), 0); assert.equal(await page.evaluate(() => Boolean(window.compromised)), false);
    assert.match(await page.getByRole("status").innerText(), /Nothing was imported or saved/);
    const hash = await page.locator("dd.font-mono").innerText(); assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(await page.getByRole("link").count(), 0); await inspect(page, size, "original"); evidence.push({ size, scenario: "original", passed: true });
    const invalid = '{"name":"é😀\\ud800"}'; await file(page, invalid, "rejected.json"); await button(page).click();
    await page.getByRole("alert").waitFor();
    assert.match(await page.getByRole("alert").innerText(), /INVALID_STRING/);
    assert.match(await page.getByRole("alert").innerText(), new RegExp(`byte ${Buffer.byteLength(invalid.slice(0, invalid.indexOf("\\ud800")))}`));
    await page.waitForFunction(() => document.activeElement?.id === "json-errors");
    assert.equal(await page.getByRole("alert").evaluate(node => document.activeElement === node), true);
    assert.match(await page.getByRole("status").innerText(), /Previous local preview retained/);
    assert.equal(await page.locator("dd.font-mono").innerText(), hash); await inspect(page, size, "rejected-retained"); evidence.push({ size, scenario: "rejected retained byte-offset preview", passed: true });
    const minimal = { format: "inkborne-npc", format_version: 1, name: "Original pair 😀", data: { schema_version: 1, personality: {}, relationships: [] }, effects: [] };
    await file(page, JSON.stringify(minimal), "pair.json"); await button(page).click();
    await page.getByRole("heading", { name: "Original pair 😀", exact: true }).waitFor();
    assert.equal(await page.getByText("Included empty object", { exact: true }).isVisible(), true);
    assert.equal(await page.getByText("Included empty list", { exact: true }).isVisible(), true);
    assert.equal(await page.getByRole("region", { name: "Template relationship ideas", exact: true }).count(), 0);
    await inspect(page, size, "pair-empty"); evidence.push({ size, scenario: "valid pair and explicit empty groups", passed: true });
    await page.getByLabel("Hold result for offline timing control", { exact: true }).check();
    await file(page, original, "pending.json");
    assert.match(await page.getByRole("status").innerText(), /Previous local preview retained; it does not describe the selected file/);
    assert.doesNotMatch(await page.getByRole("status").innerText(), /was rejected/);
    await button(page).click();
    const fieldset = page.locator('fieldset[aria-busy="true"]'); await fieldset.waitFor();
    assert.equal(await fieldset.evaluate(node => node.disabled), true); assert.equal(await page.getByLabel("Original local JSON file", { exact: true }).isDisabled(), true);
    assert.match(await page.getByRole("status").innerText(), /Previous local preview retained; it does not describe the selected file/);
    assert.doesNotMatch(await page.getByRole("status").innerText(), /was rejected/);
    const reads = await page.evaluate(() => window.npcJsonHarness.reads); await page.locator("form").evaluate(form => form.requestSubmit());
    assert.equal(await page.evaluate(() => window.npcJsonHarness.reads), reads);
    await inspect(page, size, "pending");
    await page.waitForFunction(() => window.npcJsonHarness.held);
    // Journal release refuses until the codec/hash has actually finished; no substituted crypto or RNG.
    await page.waitForFunction(() => document.querySelector('fieldset[aria-busy="true"]'));
    await page.evaluate(() => window.npcJsonHarness.release()); await page.getByText("pending.json", { exact: true }).waitFor();
    assert.equal(await page.getByRole("alert").count(), 0); evidence.push({ size, scenario: "native pending single read with modeled timing", passed: true });
    await context.close(); setActive(undefined);
  }
}
