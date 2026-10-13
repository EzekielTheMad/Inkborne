import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
const CASES = ["create", "archive", "restore", "second-edit", "noop", "reset", "same-tick", "settlement-gap", "lost-absence",
  "reload", "storage", "response-tuple", "stale-owner", "stale-preview", "historical-source", "repeat-failure",
  "editAfter-refusal", "privacy", "unsupported-source", "literal-text", "native-controls", "roster"];
const MC = { campaign: "10000000-0000-4000-8000-000000000001", owner: "10000000-0000-4000-8000-000000000002",
  system: "10000000-0000-4000-8000-000000000003", source: "10000000-0000-4000-8000-000000000004",
  instance: "10000000-0000-4000-8000-000000000005", foreign: "10000000-0000-4000-8000-000000000007" };
const key = edit => "inkborne:campaign-monster:v1:" + MC.owner + ":" + MC.campaign + ":" + (edit ? MC.instance : "create");
async function model(page, kind, data = {}) { return page.evaluate(({ kind, data }) => window.campaignMonster.api(kind, data), { kind, data }); }
async function trace(page) { return page.evaluate(() => ({ calls: window.campaignMonster.calls, gaps: window.campaignMonster.gaps, props: window.campaignMonster.props,
  immediate: window.campaignMonster.immediate, received: window.campaignMonster.propsReceived, storage: Object.fromEntries(Object.keys(sessionStorage).map(key => [key, sessionStorage.getItem(key)])) })); }
async function eventually(page, predicate, argument) { await page.waitForFunction(predicate, argument, { timeout: 5000 }); }
async function createReady(page) {
  await page.locator("select[name=source]").selectOption(MC.source);
  await eventually(page, () => document.querySelector('input[name=current_hp]')?.value === "17");
  await page.locator("input[name=name]").fill("Bridge sentinel"); await page.locator("input[name=current_hp]").fill("0");
  await page.locator("textarea[name=notes]").fill("Original private note.");
}
async function submit(page, count = 1) {
  await page.evaluate(count => { const form = document.querySelector("form"); for (let i = 0; i < count; i++) form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true })); }, count);
}
async function saved(page) { await page.getByRole("link", { name: "Saved instance " + MC.instance, exact: true }).waitFor({ timeout: 5000 }); }
async function gap(page, mode) {
  // ONE evaluation: no fetch, polling, held release or host-task barrier between
  // the first native submit, actual response consumption and second submit.
  const probe = await page.evaluate(async ({ mode, storageKey }) => {
    const bridge = window.campaignMonster, form = document.querySelector("form");
    bridge.mode(mode);
    const initialEnabled = !!form && !form.querySelector("fieldset").disabled && !form.querySelector('button[type="submit"]').disabled;
    bridge.startTransition(() => form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true })));
    const original = structuredClone(bridge.calls.find(call => call.kind === "commit")?.intent);
    let ticks = 0, sourceResponseObserved = false, savedEffectObserved = false;
    for (; ticks < 8; ticks++) {
      await Promise.resolve(); // Native microtick only; no scheduler substitution.
      sourceResponseObserved = bridge.immediate[0]?.responseConsumed === true;
      const marker = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      savedEffectObserved = marker?.saved_id === "10000000-0000-4000-8000-000000000005";
      if (sourceResponseObserved && (mode !== "settlement-saved" || savedEffectObserved)) break;
    }
    const fieldset = form.querySelector("fieldset"), button = form.querySelector('button[type="submit"]');
    const markerBefore = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    const captured = { mode, ticks, immediateBoundary: "Explicit modeled reply; actual request/receipt validation and React/native events",
      initialEnabled, sourceResponseObserved, savedEffectObserved,
      originalEnabledDom: !fieldset.disabled && !button.disabled,
      originalIntent: original, markerBefore, callsBefore: bridge.calls.filter(call => call.kind === "commit").length };
    bridge.startTransition(() => form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true })));
    Object.assign(captured, { markerAfter: JSON.parse(sessionStorage.getItem(storageKey) ?? "null"),
      intentAfter: structuredClone(bridge.calls.find(call => call.kind === "commit")?.intent),
      callsAfter: bridge.calls.filter(call => call.kind === "commit").length });
    bridge.gaps.push(captured); return captured;
  }, { mode, storageKey: key(false) });
  assert.equal(probe.initialEnabled, true); assert.equal(probe.sourceResponseObserved, true, "Actual parser access unproved before host task");
  if (mode === "settlement-saved") assert.equal(probe.savedEffectObserved, true, "Actual accepted storage effect unproved");
  assert.equal(probe.originalEnabledDom, true, "Original enabled-DOM condition is UNPROVEN; pending-only controls cannot substitute");
  assert.ok(probe.originalIntent?.operation_id); assert.equal(probe.markerBefore?.operation_id, probe.originalIntent.operation_id);
  assert.equal(probe.markerAfter?.operation_id, probe.originalIntent.operation_id); assert.deepEqual(probe.intentAfter, probe.originalIntent);
  assert.equal(probe.callsBefore, 1); assert.equal(probe.callsAfter, 1); return probe;
}
async function inspectFonts(page, viewport) {
  const sample = await page.evaluate(async () => {
    const fonts = [];
    for (const variable of ["--font-marcellus", "--font-eb-garamond"]) {
      const family = getComputedStyle(document.documentElement).getPropertyValue(variable).trim().split(",")[0].replace(/^['"]|['"]$/g, "");
      if (!family) throw Error("Missing complete production font variable");
      for (const style of variable === "--font-eb-garamond" ? ["normal", "italic"] : ["normal"]) {
        const query = style + ' 400 16px "' + family + '"', faces = await document.fonts.load(query, "Mossglass Sentinel");
        if (!faces.length || !document.fonts.check(query, "Mossglass Sentinel") || !faces.some(face => face.status === "loaded" && face.style === style)) throw Error("Actual FontFace unavailable");
        fonts.push({ family, style, statuses: faces.map(face => face.status) });
      }
    }
    return { fonts, viewport: innerWidth, bodyWidth: document.body.scrollWidth, documentWidth: document.documentElement.scrollWidth };
  });
  assert.equal(sample.fonts.length, 3); assert.ok(sample.bodyWidth <= viewport.width + 1 && sample.documentWidth <= viewport.width + 1); return sample;
}
export async function runCampaignMonsterCases(options) {
  const { browser, origin, output, evidence, screenshots, fontEvidence, pageErrors, networkErrors, diagnostics, allowedAssets, deadline } = options;
  for (const [size, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
    for (const [index, scenario] of CASES.entries()) {
      await options.checkpoint("case " + size + ":" + scenario);
      assert.ok(Date.now() < deadline, "Browser case deadline; preserve full proof reserves");
      const context = await browser.newContext({ viewport }), page = await context.newPage();
      page.on("pageerror", error => pageErrors.push(error.message));
      page.on("console", message => { if (["error", "warning"].includes(message.type())) diagnostics.push(message.text()); });
      await page.route("**/*", route => {
        const request = route.request(), url = new URL(request.url());
        const permitted = url.origin === origin && (["/fixture", "/fixture.js", "/favicon.ico"].includes(url.pathname)
          || allowedAssets.includes(url.pathname) || /^\/__model\/(control|inspect|preview|resolve|commit)$/.test(url.pathname)
          || ["/campaigns/" + MC.campaign + "/monsters/" + MC.instance, "/campaigns/" + MC.foreign + "/monsters/" + MC.instance,
            "/campaigns/" + MC.campaign + "/monsters/" + MC.foreign].includes(url.pathname));
        if (!permitted) { networkErrors.push({ path: url.pathname, origin: url.origin }); return route.abort(); } return route.continue();
      });
      const edit = ["archive", "restore", "second-edit", "noop", "repeat-failure", "historical-source"].includes(scenario);
      let assertionCount = 0;
      const check = (actual, expected) => { assertionCount++; assert.deepEqual(actual, expected); };
      try {
        await options.configure({ initial: edit, mode: "normal" });
        await page.goto(origin + "/fixture");
        if (edit) await eventually(page, () => !document.querySelector("fieldset")?.disabled);
        else await createReady(page);
        if (scenario === "create") {
          await submit(page); await saved(page); const seen = await trace(page), committed = seen.calls.filter(call => call.kind === "commit");
          check(committed.length, 1); check(committed[0].intent.current_hp, 0); check(committed[0].intent.source_version, 1);
          check((await model(page, "inspect")).detail.declared_max_hp, 17); check((await model(page, "inspect")).receipts.length, 1);
        } else if (scenario === "archive" || scenario === "restore") {
          if (scenario === "restore") {
            const detail = (await model(page, "inspect")).detail;
            await model(page, "control", { initial: true, detail: { ...detail, archived: true } }); await page.reload();
            await eventually(page, () => !document.querySelector("fieldset")?.disabled); await page.locator("input[name=archived]").uncheck(); await page.locator("textarea[name=notes]").fill("");
          } else await page.locator("input[name=archived]").check();
          await submit(page); await saved(page); const result = await model(page, "inspect");
          check(result.detail.archived, scenario === "archive"); check(result.detail.revision, "1"); check(result.detail.current_hp, 0);
          if (scenario === "restore") check(result.detail.notes, "");
          check(result.detail.source_version, 1);
        } else if (scenario === "second-edit" || scenario === "noop") {
          if (scenario === "second-edit") await page.locator("input[name=current_hp]").fill("3");
          await submit(page); await saved(page);
          const before = await model(page, "inspect"), operation = before.receipts[0].operation_id;
          check(before.receipts[0].outcome, scenario === "noop" ? "noop" : "updated");
          await page.getByRole("button", { name: "Edit latest instance", exact: true }).click();
          await page.waitForURL("**/monsters/" + MC.instance + "?editAfter=" + operation, { timeout: 5000 });
          await eventually(page, () => !document.querySelector("fieldset")?.disabled);
          check(await page.locator("input[name=current_hp]").inputValue(), scenario === "noop" ? "0" : "3");
          await page.locator("input[name=current_hp]").fill("4"); await submit(page); await saved(page);
          const after = await model(page, "inspect"); check(after.receipts.length, 2);
          check(after.detail.revision, scenario === "noop" ? "1" : "2");
          const route = after.calls.filter(call => call.kind.startsWith("route-")).map(call => call.kind);
          check(route.slice(-2), ["route-resolve", "route-detail"]);
          check(after.receipts[1].canonical_intent.expected_revision, before.detail.revision);
        } else if (scenario === "reset" || scenario === "same-tick") {
          await page.evaluate(() => window.campaignMonster.mode("hold"));
          await submit(page, scenario === "same-tick" ? 2 : 1);
          await eventually(page, () => window.campaignMonster.readyHeld());
          const before = await trace(page), operation = before.calls.find(call => call.kind === "commit").intent.operation_id;
          await page.evaluate(() => document.querySelector("form").reset());
          check(await page.locator("input[name=current_hp]").inputValue(), "0"); check(await page.locator("textarea[name=notes]").inputValue(), "Original private note.");
          check((await trace(page)).calls.filter(call => call.kind === "commit").length, 1);
          check(JSON.parse((await trace(page)).storage[key(false)]).operation_id, operation);
          await page.evaluate(() => window.campaignMonster.release()); await saved(page);
          await page.evaluate(() => document.querySelector("form").reset());
          check(await page.locator("input[name=current_hp]").inputValue(), "0");
          check(JSON.parse((await trace(page)).storage[key(false)]).operation_id, operation);
        } else if (scenario === "settlement-gap") {
          for (const mode of ["settlement-saved", "settlement-uncertain", "settlement-refusal"]) {
            // Independent fixtures for three outcomes, not product recovery.
            await page.evaluate(() => sessionStorage.clear()); await model(page, "control", {}); await page.reload(); await createReady(page);
            const probe = await gap(page, mode);
            if (mode === "settlement-saved") {
              await saved(page); await submit(page, 2); check((await trace(page)).calls.filter(call => call.kind === "commit").length, 1);
            } else if (mode === "settlement-uncertain") {
              await page.getByRole("button", { name: "Check campaign monsters", exact: true }).click();
              await eventually(page, () => document.body.textContent.includes("No receipt was found"));
              check(JSON.parse((await trace(page)).storage[key(false)]).operation_id, probe.originalIntent.operation_id);
              await page.evaluate(() => window.campaignMonster.mode("settlement-replay"));
              await page.getByRole("button", { name: "Resubmit same operation", exact: true }).click(); await saved(page);
              const commits = (await trace(page)).calls.filter(call => call.kind === "commit");
              check(commits.length, 2); check(commits[1].intent, probe.originalIntent);
            } else {
              await eventually(page, key => sessionStorage.getItem(key) === null, key(false));
              await eventually(page, () => !document.querySelector("fieldset").disabled);
              await page.evaluate(() => window.campaignMonster.mode("settlement-saved")); await submit(page); await saved(page);
              const commits = (await trace(page)).calls.filter(call => call.kind === "commit"); check(commits.length, 2);
              check(commits[1].intent.operation_id !== probe.originalIntent.operation_id, true);
            }
          }
          assertionCount++;
        } else if (scenario === "lost-absence" || scenario === "reload") {
          await page.evaluate(() => window.campaignMonster.mode("lost")); await submit(page);
          await page.getByRole("button", { name: "Check campaign monsters", exact: true }).waitFor();
          const initial = (await trace(page)).calls.find(call => call.kind === "commit").intent;
          if (scenario === "reload") {
            await page.reload(); await page.getByRole("button", { name: "Check campaign monsters", exact: true }).waitFor();
            check(await page.getByRole("button", { name: "Resubmit same operation", exact: true }).count(), 0);
            await page.getByRole("button", { name: "Check campaign monsters", exact: true }).click();
            check((await trace(page)).calls.filter(call => call.kind === "commit").length, 0);
          } else {
            await page.getByRole("button", { name: "Check campaign monsters", exact: true }).click();
            await eventually(page, () => document.body.textContent.includes("No receipt was found"));
            check(JSON.parse((await trace(page)).storage[key(false)]).operation_id, initial.operation_id);
            await page.evaluate(() => window.campaignMonster.mode("normal")); await page.getByRole("button", { name: "Resubmit same operation", exact: true }).click(); await saved(page);
            const calls = (await trace(page)).calls.filter(call => call.kind === "commit"); check(calls[1].intent, calls[0].intent); check((await model(page, "inspect")).receipts.length, 1);
          }
        } else if (scenario === "storage") {
          for (const marker of ["{", '{"operation_id":"bad"}']) {
            await page.evaluate(({ key, marker }) => sessionStorage.setItem(key, marker), { key: key(false), marker }); await page.reload();
            await eventually(page, () => document.body.textContent.includes("malformed"));
            check((await trace(page)).calls.filter(call => call.kind === "commit").length, 0);
          }
          await page.evaluate(() => sessionStorage.clear()); await page.reload(); await createReady(page);
          await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function() { throw Error("Modeled storage denial"); }; window.restoreStorage = () => { Storage.prototype.setItem = original; }; });
          await submit(page); await eventually(page, () => document.body.textContent.includes("not submitted"));
          check((await trace(page)).calls.filter(call => call.kind === "commit").length, 0);
          await page.evaluate(() => window.restoreStorage());
          await page.reload(); await createReady(page); await page.evaluate(() => window.campaignMonster.mode("hold"));
          await submit(page); await eventually(page, () => window.campaignMonster.readyHeld());
          const submitted = (await trace(page)).calls.find(call => call.kind === "commit").intent;
          await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function() { throw Error("Modeled accepted storage-update denial"); }; window.restoreStorage = () => { Storage.prototype.setItem = original; }; });
          await page.evaluate(() => window.campaignMonster.release()); await saved(page);
          await eventually(page, () => document.body.textContent.includes("Saved receipt confirmed"));
          const retained = JSON.parse((await trace(page)).storage[key(false)]);
          check(retained, { operation_id: submitted.operation_id }); check((await model(page, "inspect")).receipts.length, 1);
          check(Object.values((await trace(page)).storage).some(value => value.includes("Original private note") || value.includes("source_snapshot")), false);
          await page.evaluate(() => window.restoreStorage());
        } else if (scenario === "response-tuple") {
          for (const mode of ["malformed", "wrong-tuple", "wrong-instance", "wrong-operation", "wrong-intent"]) {
            const update = mode === "wrong-instance";
            await page.evaluate(() => sessionStorage.clear()); await model(page, "control", { initial: update }); await page.reload();
            if (update) { await eventually(page, () => !document.querySelector("fieldset")?.disabled); await page.locator("input[name=current_hp]").fill("2"); }
            else await createReady(page);
            await page.evaluate(mode => window.campaignMonster.mode(mode), mode); await submit(page);
            await page.getByRole("button", { name: "Check campaign monsters", exact: true }).waitFor();
            check(await page.getByRole("link", { name: "Saved instance " + MC.instance }).count(), 0);
            const seen = await trace(page); check(JSON.parse(seen.storage[key(update)]).operation_id, seen.calls.find(call => call.kind === "commit").intent.operation_id);
          }
          await page.evaluate(() => sessionStorage.clear()); await model(page, "control", {}); await page.reload(); await createReady(page);
          await page.evaluate(() => window.campaignMonster.mode("historical-actor")); await submit(page); await saved(page);
          check((await model(page, "inspect")).receipts[0].original_actor_id, MC.foreign);
        } else if (scenario === "stale-owner") {
          await page.evaluate(() => window.campaignMonster.mode("late")); await submit(page); await eventually(page, () => window.campaignMonster.readyHeld());
          const before = await trace(page), operation = before.calls.find(call => call.kind === "commit").intent.operation_id;
          await page.evaluate(owner => window.campaignMonster.rerender({ ...window.campaignMonster.props, ownerId: owner }), MC.foreign);
          await page.getByRole("alert").waitFor(); await page.evaluate(() => window.campaignMonster.release());
          await eventually(page, key => sessionStorage.getItem(key)?.includes("saved_id"), key(false));
          check(JSON.parse((await trace(page)).storage[key(false)]).operation_id, operation);
          check(Object.keys((await trace(page)).storage).some(value => value.includes(MC.foreign)), false); check(await page.locator("form").count(), 0);
          await page.evaluate(() => sessionStorage.clear()); await model(page, "control", {}); await page.reload(); await createReady(page);
          await page.evaluate(() => window.campaignMonster.mode("late")); await submit(page); await eventually(page, () => window.campaignMonster.readyHeld());
          const late = (await trace(page)).calls.find(call => call.kind === "commit").intent;
          const detail = (await model(page, "inspect")).detail;
          await page.evaluate(({ next, key, newer }) => { sessionStorage.setItem(key, JSON.stringify({ operation_id: newer })); window.campaignMonster.rerender({ ...window.campaignMonster.props, initial: next, generation: "different-editor" }); }, { next: detail, key: key(false), newer: MC.foreign });
          await eventually(page, () => window.campaignMonster.props.initial?.id === "10000000-0000-4000-8000-000000000005");
          await page.evaluate(() => window.campaignMonster.release());
          await eventually(page, key => sessionStorage.getItem(key)?.includes("saved_id"), key(false) + ":accepted:" + late.operation_id);
          check(JSON.parse((await trace(page)).storage[key(false)]).operation_id, MC.foreign);
          check(JSON.parse((await trace(page)).storage[key(false) + ":accepted:" + late.operation_id]).saved_id, MC.instance);
          check(await page.getByRole("link", { name: "Saved instance " + MC.instance, exact: true }).count(), 0);
        } else if (scenario === "stale-preview") {
          for (const drift of ["version", "removed", "system", "selection"]) {
            await page.evaluate(() => sessionStorage.clear()); await model(page, "control", {}); await page.reload(); await page.evaluate(() => window.campaignMonster.mode("hold-preview"));
            await page.locator("select[name=source]").selectOption(MC.source); await eventually(page, () => window.campaignMonster.readyPreview());
            if (drift === "selection") {
              check(await page.locator("select[name=source]").isDisabled(), true);
              // An explicit native DOM change attempt cannot alter the busy source ref.
              await page.evaluate(() => { const select = document.querySelector("select[name=source]"); select.value = ""; select.dispatchEvent(new Event("change", { bubbles: true })); });
            }
            else await page.evaluate(({ drift, foreign }) => { const props = window.campaignMonster.props;
              window.campaignMonster.rerender({ ...props, ...(drift === "system" ? { systemId: foreign } : { sources: drift === "version" ? props.sources.map(value => ({ ...value, version: 2 })) : [] }) });
            }, { drift, foreign: MC.foreign });
            await page.evaluate(() => window.campaignMonster.releasePreview());
            if (drift !== "selection") await eventually(page, drift => document.body.textContent.includes(drift === "system" ? "Editor identity changed" : "stale"), drift);
            else await eventually(page, () => !document.body.textContent.includes("Loading source preview"));
            check((await trace(page)).calls.filter(call => call.kind === "commit").length, 0);
            if (drift === "selection") {
              // Actual pending selection guard keeps the original controlled choice.
              check(await page.locator("select[name=source]").inputValue(), MC.source);
              check(await page.locator("input[name=current_hp]").inputValue(), "17");
            } else if (drift !== "system") check(await page.locator("input[name=current_hp]").inputValue(), "");
          }
        } else if (scenario === "historical-source") {
          const before = await model(page, "inspect"); await model(page, "control", { initial: true, detail: before.detail, sourceVersion: 2 }); await page.reload();
          check((await trace(page)).props.initial.source_version, 1); check((await trace(page)).props.initial.source_snapshot, before.detail.source_snapshot);
          check(await page.getByText("Declared source: Mossglass Sentinel · v1", { exact: true }).count(), 1);
          await model(page, "control", { initial: true, detail: before.detail, sources: [] }); await page.reload();
          check((await trace(page)).props.initial.source_snapshot, before.detail.source_snapshot);
          check(await page.getByText("Declared source: Mossglass Sentinel · v1", { exact: true }).count(), 1);
        } else if (scenario === "repeat-failure") {
          await page.locator("input[name=current_hp]").fill("2"); await submit(page); await saved(page);
          const operation = (await model(page, "inspect")).receipts[0].operation_id;
          await page.evaluate(({ key, id }) => sessionStorage.setItem(key, JSON.stringify({ operation_id: id })), { key: key(true), id: MC.foreign });
          await page.getByRole("button", { name: "Edit latest instance", exact: true }).click();
          await eventually(page, () => document.body.textContent.includes("could not open"));
          check(JSON.parse((await trace(page)).storage[key(true)]).operation_id, MC.foreign);
          await page.evaluate(key => sessionStorage.setItem(key, "{"), key(true));
          await page.getByRole("button", { name: "Edit latest instance", exact: true }).click();
          await eventually(page, () => document.body.textContent.includes("could not open"));
          check((await trace(page)).storage[key(true)], "{");
          await page.evaluate(({ key, operation }) => sessionStorage.setItem(key, JSON.stringify({ operation_id: operation })), { key: key(true), operation });
          await page.evaluate(() => { const original = Storage.prototype.getItem; Storage.prototype.getItem = function() { throw Error("Modeled storage read denial"); }; window.restoreStorage = () => { Storage.prototype.getItem = original; }; });
          await page.getByRole("button", { name: "Edit latest instance", exact: true }).click();
          await eventually(page, () => document.body.textContent.includes("could not open"));
          await page.evaluate(() => window.restoreStorage()); check(JSON.parse((await trace(page)).storage[key(true)]).operation_id, operation);
          // Explicit failure boundary only; normal repeat cases use native Location.
          await page.evaluate(() => { const actual = globalThis; window.realGlobal = actual; window.globalThis = new Proxy(actual, { get(target, name) { return name === "location" ? { assign() { throw Error("Modeled navigation throw"); } } : Reflect.get(target, name); } }); });
          await page.getByRole("button", { name: "Edit latest instance", exact: true }).click();
          await eventually(page, () => document.body.textContent.includes("could not open"));
          check(JSON.parse((await trace(page)).storage[key(true)]).operation_id, operation); check((await trace(page)).calls.filter(call => call.kind === "commit").length, 1);
          await page.evaluate(() => { window.globalThis = window.realGlobal; });
          await page.evaluate(() => { const actual = globalThis; window.realGlobal = actual; window.globalThis = new Proxy(actual, { get(target, name) { return name === "location" ? { assign() { /* Explicit modeled navigation never completes. */ } } : Reflect.get(target, name); } }); });
          await page.getByRole("button", { name: "Edit latest instance", exact: true }).click();
          await eventually(page, () => document.body.textContent.includes("Opening a fresh latest"));
          check(await page.getByRole("button", { name: "Edit latest instance", exact: true }).isDisabled(), true);
          await submit(page, 2); check((await trace(page)).calls.filter(call => call.kind === "commit").length, 1);
          check(JSON.parse((await trace(page)).storage[key(true) + ":accepted:" + operation]).saved_id, MC.instance);
          await page.evaluate(() => { window.globalThis = window.realGlobal; });
        } else if (scenario === "editAfter-refusal") {
          await page.goto(origin + "/campaigns/" + MC.campaign + "/monsters/" + MC.instance + "?editAfter=" + MC.foreign);
          await page.getByRole("alert").waitFor(); check(await page.locator("form").count(), 0); check((await trace(page)).calls.filter(call => call.kind === "commit").length, 0);
          for (const suffix of ["?editAfter=bad", "?editAfter=", "?editAfter=" + MC.foreign + "&editAfter=" + MC.foreign,
            "?editAfter=A0000000-0000-4000-8000-000000000007", "?editAfter=" + MC.foreign + "&unknown=1"]) {
            await model(page, "control", {});
            await page.goto(origin + "/campaigns/" + MC.campaign + "/monsters/" + MC.instance + suffix);
            await page.getByRole("alert").waitFor(); check(await page.locator("form").count(), 0); check((await trace(page)).calls.filter(call => call.kind === "route-resolve").length, 0);
          }
          await model(page, "control", { initial: true }); await page.goto(origin + "/fixture");
          await eventually(page, () => !document.querySelector("fieldset")?.disabled); await page.locator("input[name=current_hp]").fill("2"); await submit(page); await saved(page);
          const accepted = await model(page, "inspect"), receipt = accepted.receipts[0], operation = receipt.operation_id;
          await page.evaluate(() => sessionStorage.clear());
          for (const route of ["/campaigns/" + MC.foreign + "/monsters/" + MC.instance, "/campaigns/" + MC.campaign + "/monsters/" + MC.foreign]) {
            await model(page, "control", { initial: true, detail: accepted.detail, receiptOverrides: [[operation, receipt]] });
            await page.goto(origin + route + "?editAfter=" + operation);
            await page.getByRole("alert").waitFor(); check(await page.locator("form").count(), 0); check((await trace(page)).calls.filter(call => call.kind === "commit").length, 0);
          }
          for (const kind of ["foreign", "malformed", "stale", "invalid-detail", "detail-id", "detail-campaign", "detail-system"]) {
            const changed = structuredClone(receipt), detail = structuredClone(accepted.detail);
            if (kind === "foreign") changed.campaign_id = MC.foreign;
            if (kind === "malformed") delete changed.canonical_intent;
            if (kind === "stale") detail.revision = "0";
            if (kind === "invalid-detail") detail.source_snapshot.effects_snapshot = [{}];
            if (kind === "detail-id") detail.id = MC.foreign;
            if (kind === "detail-campaign") detail.campaign_id = MC.foreign;
            if (kind === "detail-system") detail.system_id = MC.foreign;
            await model(page, "control", { initial: true, detail, receiptOverrides: [[operation, changed]] });
            await page.goto(origin + "/campaigns/" + MC.campaign + "/monsters/" + MC.instance + "?editAfter=" + operation);
            await page.getByRole("alert").waitFor(); check(await page.locator("form").count(), 0); check((await trace(page)).calls.filter(call => call.kind === "commit").length, 0);
          }
          await model(page, "control", { initial: true, detail: accepted.detail, receiptOverrides: [[operation, receipt]] });
          await page.evaluate(({ key, operation }) => sessionStorage.setItem(key, JSON.stringify({ operation_id: operation })), { key: key(true), operation });
          await page.goto(origin + "/campaigns/" + MC.campaign + "/monsters/" + MC.instance + "?editAfter=" + operation);
          await page.getByRole("button", { name: "Check campaign monsters", exact: true }).waitFor();
          check(await page.locator("fieldset").isDisabled(), true); check(await page.getByRole("button", { name: "Resubmit same operation", exact: true }).count(), 0);
        } else if (scenario === "privacy") {
          for (const role of ["anonymous", "player", "dm-label-nonowner"]) {
            await model(page, "control", { role }); await page.reload();
            const seen = await trace(page); check(Object.keys(seen.props).sort(), ["generation", "role", "rows"]);
            check(await page.locator("form").count(), 0); check((await model(page, "inspect")).detail, null);
            check(seen.storage, {}); check((await page.locator("body").innerText()).includes("Original private note."), false);
            check((await model(page, "preview", { campaign: MC.campaign, source: MC.source, version: 1 })).status, "error");
            check((await model(page, "resolve", { campaign: MC.campaign, operation: MC.foreign })).status, "error");
          }
        } else if (scenario === "unsupported-source") {
          const detail = (await model(page, "inspect")).detail;
          const bad = [row => { row.source_snapshot.effects_snapshot = [{ type: "mechanical", stat: "strength", op: "add", value: 1 }]; },
            row => { delete row.source_snapshot.effects_snapshot; }, row => { row.source_snapshot.data_snapshot.schema_version = 99; },
            row => { row.source_snapshot.version = 2; }, row => { row.source_snapshot.system_id_snapshot = MC.foreign; },
            row => { row.declared_max_hp = 18; }, row => { row.source_snapshot.content_type_snapshot = "npc"; }, row => { row.source_snapshot.data_snapshot.unexpected = true; }];
          for (const change of bad) { const row = structuredClone(detail); change(row); await model(page, "control", { initial: true, detail: row }); await page.reload();
            await page.getByRole("alert").waitFor(); check(await page.locator("form").count(), 0); }
          await model(page, "control", { initial: true, detail }); await page.reload(); await page.locator("form").waitFor(); assertionCount++;
        } else if (scenario === "literal-text") {
          await page.locator("input[name=name]").fill("L".repeat(100)); await page.locator("textarea[name=notes]").fill("<script>window.__m5Executed=true</script>" + "Z".repeat(1000));
          await submit(page); await saved(page);
          check(await page.evaluate(() => window.__m5Executed), undefined);
          check((await page.locator("body").innerText()).includes("<script>literal only</script>"), true);
          check((await model(page, "inspect")).detail.notes.startsWith("<script>"), true);
          check((await page.locator("body").innerText()).includes("Wisdom +0, Charisma -2"), true);
        } else if (scenario === "native-controls") {
          for (const kind of ["duplicate", "unknown", "file"]) {
            await page.evaluate(kind => { const element = document.createElement("input"); element.name = kind === "duplicate" ? "name" : "unknown";
              if (kind === "file") { element.type = "file"; const files = new DataTransfer(); files.items.add(new File(["original"], "original.txt")); element.files = files.files; } else element.value = "outside draft";
              element.id = "injected-control"; document.querySelector("form").append(element); }, kind);
            await submit(page); await eventually(page, () => document.body.textContent.includes("outside this draft")); await page.locator("#injected-control").evaluate(element => element.remove());
            check((await trace(page)).calls.filter(call => call.kind === "commit").length, 0);
          }
          for (const hp of ["0.5", "18", "9007199254740992", "1e100"]) { await page.locator("input[name=current_hp]").fill(hp); await submit(page);
            await eventually(page, () => document.body.textContent.includes("Check name")); check((await trace(page)).calls.filter(call => call.kind === "commit").length, 0); }
          await page.locator("input[name=current_hp]").fill("0"); await submit(page); await saved(page); check((await model(page, "inspect")).receipts.length, 1);
        } else if (scenario === "roster") {
          const detail = (await model(page, "inspect")).detail, summary = Object.fromEntries(["id", "campaign_id", "name", "current_hp", "declared_max_hp", "archived", "revision"].map(key => [key, detail[key]]));
          await model(page, "control", { rows: [{ ...summary, archived: true }] }); await page.reload();
          await page.getByRole("region", { name: "DM monster roster" }).waitFor();
          check((await page.getByRole("region", { name: "DM monster roster" }).innerText()).includes("Archived"), true);
          check((await page.getByRole("region", { name: "DM monster roster" }).innerText()).includes("Original private note."), false);
          await page.getByRole("link", { name: "Bridge sentinel", exact: true }).click(); await page.waitForURL("**/monsters/" + MC.instance);
          check((await trace(page)).props.initial.source_version, 1);
          await model(page, "control", { rows: null }); await page.goto(origin + "/fixture"); await page.getByRole("alert").waitFor(); check(await page.locator("form").count(), 0);
          await model(page, "control", { rows: [] }); await page.reload(); check((await page.getByRole("region", { name: "DM monster roster" }).innerText()).includes("No matching monster instances."), true);
        }
        assert.ok(assertionCount > 0, "Case must assert actual behavior");
        const sample = await inspectFonts(page, viewport), filename = size + "-" + String(index + 1).padStart(2, "0") + "-" + scenario + ".png";
        await page.screenshot({ path: path.join(output, filename) }); screenshots.push(filename); fontEvidence.push({ size, scenario, ...sample });
        evidence.push({ size, scenario, assertionCount, passed: true, boundaries: "Auth/RPC/ledger/owner/source/cache modeled", actual: await trace(page) });
      } catch (error) {
        // Preserve the actual failed precondition before closing this document.
        const stem = size + "-" + String(index + 1).padStart(2, "0") + "-" + scenario + "-FAILED";
        const captureErrors = []; let actual = null, dom = null, bodyText = null, image = null;
        try { actual = await trace(page); } catch (failure) { captureErrors.push("trace: " + failure.message); }
        try { dom = await page.content(); bodyText = await page.locator("body").innerText(); } catch (failure) { captureErrors.push("DOM: " + failure.message); }
        try { image = stem + ".png"; await page.screenshot({ path: path.join(output, image) }); } catch (failure) { captureErrors.push("screenshot: " + failure.message); image = null; }
        await fs.writeFile(path.join(output, stem + ".json"), JSON.stringify({ size, scenario, expectedCaseCount: 44, assertionCount,
          passed: false, failure: error.message, actual, dom, bodyText, screenshot: image, captureErrors,
          requiredSettlementPrecondition: scenario === "settlement-gap" ? "Consumed actual response + original enabled DOM before matching layout commit; never waived" : null,
          boundaries: "Auth/RPC/ledger/owner/source/cache modeled" }, null, 2), { flag: "wx" });
        evidence.push({ size, scenario, assertionCount, passed: false, failure: error.message, actual, screenshot: image, captureErrors });
        throw error;
      } finally { await context.close(); }
    }
  }
  await fs.writeFile(path.join(output, "case-counts.json"), JSON.stringify({ expected: 44, actual: evidence.length, screenshots: screenshots.length }), { flag: "wx" });
}
