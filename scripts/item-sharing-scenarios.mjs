import assert from "node:assert/strict";
export const itemSharingScenarios = ["workflow", "stale", "malformed", "wrong-tuple", "lost", "cache-loss", "pending", "same-tick", "draft-version", "draft-identity", "supersession", "author-refusal"];
const button = (page, name) => page.getByRole("button", { name, exact: true });
const journal = page => page.evaluate(() => window.itemSharing.calls);
const shares = async page => (await journal(page)).filter(call => call.kind === "share");
const form = (page, name) => button(page, name).locator("..");
export async function runItemSharingCases({ browser, origin, inspect, pageErrors, blockedRequests, unexpectedRequests, diagnostics, evidence, setActive }) {
  for (const [size, width] of [["desktop", 1280], ["mobile", 390]]) for (const scenario of itemSharingScenarios) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin !== origin) { blockedRequests.push(route.request().url()); return route.abort(); }
      if (route.request().method() !== "GET") { unexpectedRequests.push({ method: route.request().method(), url: route.request().url() }); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage(); setActive(page);
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("console", message => { if (message.type() === "error") diagnostics.push(message.text()); });
    await page.goto(origin + "/fixture?scenario=" + scenario);
    await page.getByLabel("Name", { exact: true }).waitFor();
    await page.getByLabel("Name", { exact: true }).fill("Original retained author draft");
    await page.getByLabel("Item description", { exact: true }).fill("Retained original narrative.");
    const authorForm = page.getByLabel("Name", { exact: true }).locator("xpath=ancestor::form");
    await authorForm.evaluate(node => node.reset());
    assert.equal(await page.getByLabel("Name", { exact: true }).inputValue(), "Original retained author draft");
    assert.equal(await page.getByLabel("Item description", { exact: true }).inputValue(), "Retained original narrative.");
    const firstForm = form(page, "Share with Original Tuesday");
    assert.deepEqual(await firstForm.evaluate(node => Object.fromEntries(new FormData(node))), {
      content_id: "33333333-3333-4333-8333-333333333333", campaign_id: "44444444-4444-4444-8444-444444444444", enabled: "true", expected_version: "1",
    });
    if (scenario === "author-refusal") {
      await button(page, "Save new version").click();
      await page.getByRole("alert").waitFor();
      const calls = await journal(page); assert.equal(calls.length, 1); assert.equal(calls[0].kind, "edit");
      assert.equal(calls[0].fields.name, "Original retained author draft");
      assert.equal(calls[0].fields.expected_version, "1");
      assert.equal(await page.getByLabel("Name", { exact: true }).inputValue(), "Original retained author draft");
      assert.equal(await page.getByLabel("Item description", { exact: true }).inputValue(), "Retained original narrative.");
      assert.equal(await button(page, "Save new version").isDisabled(), false);
      await inspect(page, size, scenario);
    } else if (scenario.startsWith("draft-")) {
      await page.evaluate(kind => window.itemSharing.revalidate(kind), scenario === "draft-identity" ? "identity" : "version");
      await page.getByRole("alert").waitFor();
      assert.equal(await page.getByLabel("Name", { exact: true }).inputValue(), "Original retained author draft");
      assert.equal(await page.getByLabel("Item description", { exact: true }).inputValue(), "Retained original narrative.");
      assert.equal(await authorForm.locator('input[name="expected_version"]').inputValue(), "1");
      assert.equal(await authorForm.locator('input[name="id"]').inputValue(), "33333333-3333-4333-8333-333333333333");
      assert.equal(await button(page, "Save new version").isDisabled(), true);
      await authorForm.evaluate(node => node.requestSubmit()); assert.deepEqual(await journal(page), []);
      assert.equal(await button(page, "Reload latest").isVisible(), true);
    } else {
      if (scenario === "same-tick") {
        await page.evaluate(() => {
          const forms = [...document.querySelectorAll('form')].filter(node => node.querySelector('[name="campaign_id"]'));
          forms[0].requestSubmit(); forms[1].requestSubmit();
        });
      } else await button(page, "Share with Original Tuesday").click();
      if (scenario === "pending" || scenario === "same-tick") {
        await page.waitForFunction(() => window.itemSharing.calls.length === 1);
        assert.equal((await shares(page)).length, 1);
        assert.equal(await button(page, "Share with Original Weekend").isDisabled(), true);
        await firstForm.evaluate(node => node.requestSubmit());
        assert.equal((await shares(page)).length, 1);
        await inspect(page, size, scenario + "-pending");
        await page.evaluate(() => window.itemSharing.release());
      }
      if (["stale", "malformed", "wrong-tuple", "lost", "cache-loss"].includes(scenario)) {
        await page.getByRole("alert").waitFor();
        assert.equal(await button(page, "Share with Original Tuesday").isDisabled(), true);
        assert.equal(await button(page, "Share with Original Weekend").isDisabled(), true);
        assert.equal((await shares(page)).length, 1);
        await firstForm.evaluate(node => node.requestSubmit()); assert.equal((await shares(page)).length, 1);
        assert.equal(await button(page, "Reload latest access").isVisible(), true);
        if (scenario !== "stale") assert.match(await page.getByRole("alert").innerText(), /could not be confirmed/);
        await inspect(page, size, scenario);
        await button(page, "Reload latest access").click();
        await page.getByRole("status").waitFor();
        assert.equal((await journal(page)).length, 0);
        assert.equal(await page.getByLabel("Name", { exact: true }).inputValue(), "Original Lantern");
        const reloaded = scenario === "stale" || scenario === "cache-loss" || scenario === "wrong-tuple";
        assert.equal(await page.getByRole("status").innerText(), "Modeled loaded version " + (reloaded ? "2" : "1"));
        await inspect(page, size, scenario + "-reload");
      } else {
        await button(page, "Stop sharing with Original Tuesday").waitFor();
        assert.equal((await shares(page)).length, 1);
        if (scenario === "workflow") {
          await button(page, "Share with Original Weekend").click(); await button(page, "Stop sharing with Original Weekend").waitFor();
          await button(page, "Stop sharing with Original Tuesday").click(); await button(page, "Share with Original Tuesday").waitFor();
          await button(page, "Stop sharing with Original Weekend").click(); await button(page, "Share with Original Weekend").waitFor();
          const requests = (await shares(page)).map(call => call.request);
          assert.deepEqual(requests.map(request => [request.campaignId, request.enabled, request.expectedVersion]), [
            ["44444444-4444-4444-8444-444444444444", true, 1], ["55555555-5555-4555-8555-555555555555", true, 2],
            ["44444444-4444-4444-8444-444444444444", false, 2], ["55555555-5555-4555-8555-555555555555", false, 2],
          ]);
          assert.equal(await form(page, "Share with Original Tuesday").locator('[name="expected_version"]').inputValue(), "3");
        }
        if (scenario === "supersession") {
          await page.evaluate(() => window.itemSharing.revalidate("access"));
          await button(page, "Share with Original Tuesday").waitFor();
          assert.equal(await form(page, "Share with Original Tuesday").locator('[name="expected_version"]').inputValue(), "3");
          assert.equal((await shares(page)).length, 1);
        }
        assert.equal(await page.getByLabel("Name", { exact: true }).inputValue(), "Original retained author draft");
        assert.equal(await page.getByLabel("Item description", { exact: true }).inputValue(), "Retained original narrative.");
        await inspect(page, size, scenario);
      }
    }
    if (scenario.startsWith("draft-")) await inspect(page, size, scenario);
    evidence.push({ size, scenario, passed: true, boundary: "real forms/events/admission/render/reset/reload; modeled server/authority/cache/clocks" });
    await context.close(); setActive(undefined);
  }
}
