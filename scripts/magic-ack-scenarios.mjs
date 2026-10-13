import assert from "node:assert/strict";
export const magicAckScenarios = ["create", "edit-raw", "edit-absent", "validation", "pending", "malformed-create", "idle-create", "lost-create", "idle-edit", "drift-id", "drift-version", "no-op", "max-no-op", "max-change", "conflict", "saved-cache", "saved-navigation"];
const label = (page, name) => page.getByLabel(name, { exact: true });
const button = (page, name) => page.getByRole("button", { name, exact: true });
const journal = page => page.evaluate(() => ({ calls: window.magicAck.calls, writes: window.magicAck.writes, navigation: window.magicAck.navigation,
  originalRow: window.magicAck.originalRow, historicalPin: window.magicAck.historicalPin, pinAdmissions: window.magicAck.pinAdmissions, loaded: window.magicAck.loaded }));
const draft = page => page.evaluate(() => ({ name: document.getElementById("magic-item-name").value, rarity: document.getElementById("magic-item-rarity").value,
  description: document.getElementById("magic-item-description").value, category: document.getElementById("magic-item-equipment-category").value,
  attunement: document.getElementById("magic-item-requires-attunement").checked,
  id: document.querySelector('input[name="id"]')?.value ?? null, version: document.querySelector('input[name="expected_version"]')?.value ?? null }));
async function reachable(page, control) {
  await control.scrollIntoViewIfNeeded(); const box = await control.boundingBox(); assert.ok(box && box.width > 0 && box.height > 0);
  const viewport = page.viewportSize(); assert.ok(box.x >= -1 && box.x + box.width <= viewport.width + 1 && box.y >= -1 && box.y + box.height <= viewport.height + 1, "Control not reachable inside viewport");
}
export async function runMagicAckCases({ browser, origin, inspect, pageErrors, blockedRequests, unexpectedRequests, diagnostics, evidence, setActive }) {
  for (const [size, width] of [["desktop", 1280], ["mobile", 390]]) for (const scenario of magicAckScenarios) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin !== origin) { blockedRequests.push(route.request().url()); return route.abort(); }
      if (route.request().method() !== "GET") { unexpectedRequests.push({ method: route.request().method(), url: route.request().url() }); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage(); setActive(page);
    page.on("pageerror", error => pageErrors.push(error.message)); page.on("console", message => { if (message.type() === "error") diagnostics.push(message.text()); });
    await page.goto(`${origin}/fixture?scenario=${scenario}`); await label(page, "Name").waitFor();
    const edit = ["edit-raw", "edit-absent", "idle-edit", "drift-id", "drift-version", "no-op", "max-no-op", "max-change", "conflict"].includes(scenario);
    assert.equal(await page.locator('[name="effects"]').count(), 0); assert.equal(await page.locator('[name="data"]').count(), 0);
    if (scenario === "create") {
      await label(page, "Name").fill("N".repeat(100)); await label(page, "Name").focus(); await page.keyboard.press("Tab");
      assert.equal(await label(page, "Rarity").evaluate(node => node === document.activeElement), true);
      await label(page, "Rarity").selectOption("Legendary"); await label(page, "Magic item description").fill("Original bounded narrative. ".repeat(1000).slice(0, 20_000));
      await label(page, "Equipment category").fill("C".repeat(100)); await label(page, "Requires attunement").check();
      await page.locator("form").evaluate(form => { for (const [name, value] of [["owner_id", "forged"], ["scope", "shared"], ["effects", '[{"type":"narrative","text":"forged"}]']]) {
        const input = document.createElement("input"); input.type = "hidden"; input.name = name; input.value = value; form.append(input);
      } });
    } else if (scenario === "edit-raw") {
      await label(page, "Name").fill("Metadata-only Compass"); await label(page, "Magic item description").fill("Changed original narrative."); await label(page, "Equipment category").fill("");
    } else if (scenario === "edit-absent") {
      assert.equal(await label(page, "Rarity").inputValue(), "Common"); assert.equal(await label(page, "Requires attunement").isChecked(), false); assert.equal(await label(page, "Equipment category").inputValue(), "");
      await label(page, "Name").fill("Metadata-only Compass");
    } else if (!["no-op", "max-no-op"].includes(scenario)) {
      await label(page, "Name").fill(`Kept ${scenario} Compass`); await label(page, "Magic item description").fill(scenario === "validation" ? "   " : "Retained original narrative.");
    }
    const before = await draft(page), initialJournal = await journal(page), submitName = edit ? "Save new version" : "Create private magic item";
    await reachable(page, button(page, submitName));
    if (scenario.startsWith("drift-")) {
      await page.evaluate(() => window.magicAck.drift()); await page.getByText(/This form's identity or version changed/).waitFor();
      assert.deepEqual(await draft(page), before); assert.equal(await button(page, submitName).isDisabled(), true);
      await page.locator("form").evaluate(form => form.requestSubmit()); assert.equal((await journal(page)).calls.length, 0);
    } else if (scenario === "pending") {
      await page.locator("form").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
      await page.locator('fieldset[aria-busy="true"]').waitFor();
      assert.equal(await page.locator("fieldset").evaluate(node => node.disabled), true); assert.equal(await label(page, "Name").isDisabled(), true); assert.equal(await label(page, "Rarity").isDisabled(), true);
      assert.equal(await button(page, "Saving...").isDisabled(), true); assert.equal((await journal(page)).calls.length, 1); assert.equal((await journal(page)).writes.length, 0);
      await page.locator("form").evaluate(form => form.requestSubmit()); assert.equal((await journal(page)).calls.length, 1);
      await inspect(page, size, "pending-busy");
      await page.evaluate(() => window.magicAck.release({ status: "error", message: "Modeled pending rejection.", fieldErrors: { description: ["Revise the original description."] } }));
      await page.getByRole("alert").waitFor();
      await page.waitForFunction(() => document.activeElement?.id === "magic-item-description");
      assert.equal(await label(page, "Magic item description").evaluate(node => node === document.activeElement), true);
    } else await button(page, submitName).click();
    if (!scenario.startsWith("drift-")) {
      const saved = ["create", "edit-raw", "edit-absent", "saved-cache", "saved-navigation"].includes(scenario);
      await page.getByRole(saved ? "status" : "alert").waitFor();
      const receipt = await journal(page); assert.equal(receipt.calls.length, 1);
      assert.equal(receipt.calls[0].entries.find(([key]) => key === "name")[1], before.name);
      if (saved) {
        assert.equal(receipt.writes.length, 1); assert.equal(receipt.pinAdmissions.length, 1); assert.equal(receipt.pinAdmissions[0].version, edit ? 2 : 1);
        assert.deepEqual(receipt.navigation, [{ kind: "push", href: "/homebrew" }]);
        assert.match(await page.getByRole("status").innerText(), edit ? /exact magic-item version 2/ : /exact magic-item version 1/);
        assert.equal(await button(page, submitName).isDisabled(), true); await page.locator("form").evaluate(form => form.requestSubmit()); assert.equal((await journal(page)).calls.length, 1);
        if (edit) {
          assert.deepEqual(receipt.writes[0].row.effects, initialJournal.originalRow.effects); assert.equal(Object.hasOwn(receipt.writes[0].payload, "effects"), false);
          assert.deepEqual(receipt.writes[0].row.data.custom, initialJournal.originalRow.data.custom); assert.deepEqual(receipt.writes[0].row.data.source_refs, initialJournal.originalRow.data.source_refs);
          if (scenario === "edit-raw") assert.equal(Object.hasOwn(receipt.writes[0].row.data, "equipment_category"), false);
          else for (const field of ["rarity", "requires_attunement", "equipment_category"]) assert.equal(Object.hasOwn(receipt.writes[0].row.data, field), false);
          if (scenario === "edit-absent") assert.equal(receipt.writes[0].row.data.description, "  Original narrative.  ");
        } else { assert.deepEqual(receipt.writes[0].row.effects, []); assert.equal(receipt.writes[0].row.scope, "personal"); assert.equal(receipt.writes[0].row.owner_id, "33333333-3333-4333-8333-333333333333"); }
        if (scenario === "saved-cache") assert.match(await page.getByRole("alert").innerText(), /catalog refresh failed/);
        if (scenario === "saved-navigation") assert.match(await page.getByRole("alert").innerText(), /Navigation failed/);
      } else if (["malformed-create", "idle-create", "lost-create", "idle-edit", "conflict"].includes(scenario)) {
        assert.equal(await button(page, submitName).isDisabled(), true); await page.locator("form").evaluate(form => form.requestSubmit()); assert.equal((await journal(page)).calls.length, 1); assert.deepEqual(receipt.navigation, []);
        assert.equal(receipt.writes.length, edit ? 0 : 1);
        if (!edit) {
          const link = page.getByRole("link", { name: "Check Homebrew", exact: true }); await reachable(page, link); await link.click();
          assert.deepEqual((await journal(page)).navigation, [{ kind: "anchor", href: "/homebrew" }]); assert.equal(await button(page, submitName).isDisabled(), true); assert.equal((await journal(page)).calls.length, 1);
          await reachable(page, button(page, "I checked; allow another create")); await button(page, "I checked; allow another create").click();
          assert.equal(await button(page, submitName).isDisabled(), false); assert.equal((await journal(page)).calls.length, 1); assert.equal((await journal(page)).writes.length, 1);
        } else { assert.equal(await page.locator('input[name="expected_version"]').inputValue(), "1"); assert.equal(await button(page, "Reload latest").isVisible(), true); }
      } else {
        assert.equal(receipt.writes.length, 0); assert.deepEqual(receipt.navigation, []); assert.equal(await button(page, submitName).isDisabled(), false);
        if (scenario === "validation") {
          await page.waitForFunction(() => document.activeElement?.id === "magic-item-description");
          assert.equal(await label(page, "Magic item description").evaluate(node => node === document.activeElement), true);
        }
        if (["no-op", "max-no-op"].includes(scenario)) assert.match(await page.getByRole("alert").innerText(), /invocation did not write/);
        if (scenario === "max-change") assert.match(await page.getByRole("alert").innerText(), /version limit/);
      }
      assert.deepEqual(receipt.historicalPin, initialJournal.historicalPin);
    }
    await page.locator("form").evaluate(form => form.reset()); assert.deepEqual(await draft(page), before);
    await inspect(page, size, scenario);
    const receipt = await journal(page);
    if (["drift-id", "drift-version", "idle-edit", "conflict"].includes(scenario)) {
      assert.match(await page.getByText("Reload discards this unsaved draft.", { exact: true }).innerText(), /discards/);
      await reachable(page, button(page, "Reload latest")); await Promise.all([page.waitForEvent("load"), button(page, "Reload latest").click()]);
      await label(page, "Name").waitFor();
      const reloaded = await journal(page); assert.equal(reloaded.calls.length, 0); assert.equal(reloaded.writes.length, 0); assert.equal(await label(page, "Name").inputValue(), reloaded.loaded.name);
      assert.equal(await page.locator('input[name="id"]').inputValue(), reloaded.loaded.id); assert.equal(await page.locator('input[name="expected_version"]').inputValue(), String(reloaded.loaded.version));
      assert.equal(await label(page, "Magic item description").inputValue(), reloaded.loaded.data.description);
    }
    evidence.push({ size, scenario, passed: true, actionCountBeforeReload: receipt.calls.length, modeledWrites: receipt.writes.length, boundary: "real form/mapper/response/current+pin parsers/events/reset/reload; modeled Auth/DAL/cache/router/write/read" });
    await context.close(); setActive(undefined);
  }
}
