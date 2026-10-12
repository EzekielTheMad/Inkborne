import assert from "node:assert/strict";
const scenarios = ["structured", "invalid", "pending", "uncertain", "malformed", "idle-create", "idle-edit", "saved", "conflict"];
const label = (page, name) => page.getByLabel(name, { exact: true });
const button = (page, name) => page.getByRole("button", { name, exact: true });
const draft = page => page.locator('input[name="npc_data"]').inputValue().then(JSON.parse);
const journal = page => page.evaluate(() => ({ calls: window.npcAuthoring.calls, navigation: window.npcAuthoring.navigation }));
async function retained(page, name, before) {
  await page.locator("form").evaluate(form => form.reset());
  assert.equal(await label(page, "Name").inputValue(), name);
  assert.deepEqual(await draft(page), before);
}
export async function runNpcAuthoringCases({ browser, origin, inspect, pageErrors, blockedRequests, unexpectedRequests, diagnostics, evidence, setActive }) {
  for (const [size, width] of [["desktop", 1280], ["mobile", 390]]) for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin !== origin) { blockedRequests.push(route.request().url()); return route.abort(); }
      if (route.request().method() !== "GET") { unexpectedRequests.push({ method: route.request().method(), url: route.request().url() }); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage(); setActive(page);
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("console", message => { if (message.type() === "error") diagnostics.push(message.text()); });
    await page.goto(`${origin}/fixture?scenario=${scenario}`);
    await label(page, "Name").waitFor();
    const edit = scenario === "conflict" || scenario === "idle-edit";
    const name = scenario === "structured" ? "N".repeat(120) : `Original ${scenario} draft`;
    await label(page, "Name").fill(name);
    await label(page, "Description (optional)").fill(scenario === "structured" ? "Original bounded narrative. ".repeat(285).slice(0, 8000) : "Retained original narrative.");
    if (scenario === "structured") {
      assert.deepEqual(await draft(page), { schema_version: 1, description: "Original bounded narrative. ".repeat(285).slice(0, 8000) });
      await label(page, "Include personality").check();
      assert.deepEqual((await draft(page)).personality, {});
      await label(page, "Include personality traits").check();
      assert.deepEqual((await draft(page)).personality.personality_traits, []);
      for (const [index, text] of ["Duplicate original hook", "Second original hook", "Duplicate original hook"].entries()) {
        await button(page, "Add personality traits").click(); await label(page, `Personality traits ${index + 1}`).fill(text);
      }
      await button(page, "Move personality traits 2 up").click();
      assert.deepEqual((await draft(page)).personality.personality_traits, ["Second original hook", "Duplicate original hook", "Duplicate original hook"]);
      await label(page, "Include personality").uncheck(); assert.equal(Object.hasOwn(await draft(page), "personality"), false);
      await label(page, "Include personality").check(); assert.equal((await draft(page)).personality.personality_traits.length, 3);
      await label(page, "Include relationship ideas").check();
      await button(page, "Add relationship idea").click();
      await label(page, "Idea 1 name").fill("Original bell maker"); await label(page, "Idea 1 relationship").fill("An original acquaintance");
      await button(page, "Remove idea 1").click(); assert.deepEqual((await draft(page)).relationships, []);
      await inspect(page, size, "structured-top");
    }
    if (scenario === "invalid") await label(page, "Occupation (optional)").fill("   ");
    const before = await draft(page);
    await button(page, edit ? "Save new version" : "Create private NPC").scrollIntoViewIfNeeded();
    await button(page, edit ? "Save new version" : "Create private NPC").click();
    if (scenario === "pending") {
      const fieldset = page.locator('form > fieldset[aria-busy="true"]'); await fieldset.waitFor();
      assert.equal(await fieldset.evaluate(node => node.disabled), true);
      assert.equal(await label(page, "Name").isDisabled(), true);
      assert.equal(await button(page, "Saving…").isDisabled(), true);
      await page.locator("form").evaluate(form => form.requestSubmit());
      assert.equal((await journal(page)).calls.length, 1);
      await inspect(page, size, "pending");
      await page.evaluate(() => window.npcAuthoring.release({ status: "error", message: "Simulated pending refusal." }));
    }
    await page.getByRole(scenario === "saved" ? "status" : "alert").waitFor();
    await retained(page, name, before);
    let receipt = await journal(page); assert.equal(receipt.calls.length, 1);
    assert.equal(receipt.calls[0].name, name); assert.deepEqual(receipt.calls[0].data, before);
    if (scenario === "invalid") {
      assert.equal(await label(page, "Occupation (optional)").evaluate(node => node === document.activeElement), true);
      assert.equal(await button(page, "Create private NPC").isDisabled(), false);
      assert.deepEqual(receipt.navigation, []);
    } else if (["uncertain", "malformed", "idle-create", "idle-edit", "conflict"].includes(scenario)) {
      assert.equal(await button(page, edit ? "Save new version" : "Create private NPC").isDisabled(), true);
      await page.locator("form").evaluate(form => form.requestSubmit());
      assert.equal((await journal(page)).calls.length, 1); assert.deepEqual(receipt.navigation, []);
      if (!edit) {
        await page.getByRole("link", { name: "Check Homebrew", exact: true }).click();
        receipt = await journal(page); assert.deepEqual(receipt.navigation, [{ kind: "anchor", href: "/homebrew" }]);
        assert.equal(receipt.calls.length, 1);
        assert.equal(await button(page, "Create private NPC").isDisabled(), true);
        await button(page, "I checked Homebrew; allow another create").click();
        assert.equal(await button(page, "Create private NPC").isDisabled(), false);
        assert.equal((await journal(page)).calls.length, 1);
      } else {
        assert.equal(await page.locator('input[name="expected_version"]').inputValue(), "1");
        assert.equal(await button(page, "Reload latest").isVisible(), true);
      }
    } else if (scenario === "saved") {
      assert.deepEqual(receipt.navigation, [{ kind: "push", href: "/homebrew" }]);
      assert.match(await page.getByRole("status").innerText(), /version 1 was saved/);
      assert.equal(await button(page, "Create private NPC").isDisabled(), true);
      await page.locator("form").evaluate(form => form.requestSubmit()); assert.equal((await journal(page)).calls.length, 1);
    } else { assert.deepEqual(receipt.navigation, []); assert.equal(await button(page, "Create private NPC").isDisabled(), false); }
    if (scenario !== "pending") await inspect(page, size, scenario);
    if (scenario === "conflict") {
      await button(page, "Reload latest").click(); await page.getByText("Simulated loaded version 2", { exact: true }).waitFor();
      assert.equal(await label(page, "Name").inputValue(), "Original NPC");
      assert.equal(await label(page, "Description (optional)").inputValue(), "Stored simulated version 2.");
      assert.equal(await page.locator('input[name="expected_version"]').inputValue(), "2");
      assert.equal((await journal(page)).calls.length, 0);
    }
    evidence.push({ size, scenario, passed: true, actionCountBeforeReload: receipt.calls.length, boundary: "modeled actions/navigation/read; real form/reset/reload" });
    await context.close(); setActive(undefined);
  }
}
