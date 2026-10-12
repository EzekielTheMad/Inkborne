import assert from "node:assert/strict";

// One system, one original earned occurrence; each case runs desktop and mobile.
export const asiScenarios = ["builder-strength", "con-baseline", "con-temporary", "denial-unearned", "denial-foreign", "denial-missing", "denial-duplicate", "denial-raw-metadata", "cap-warning", "background-state", "background-reject", "weapon-crit", "cast-prep", "rest-hitdie", "retained-cast", "retained-crit", "retained-print", "retained-rest", "ability-draft", "independent-actions", "feat-choice", "legacy-dual"];
const read = page => page.evaluate(() => structuredClone({ snapshot: window.asiHarness.snapshot, projection: window.asiHarness.projection,
  initialProjection: window.asiHarness.initialProjection, calls: window.asiHarness.calls, navigation: window.asiHarness.navigation,
  unexpectedCalls: window.asiHarness.unexpectedCalls, journal: window.asiHarness.journal }));
const count = journal => ({ rng: journal.rngAttempts.length, log: journal.persistedRolls.length, state: journal.stateWrites.length, spell: journal.spellWrites.length, print: journal.printCalls.length });
async function falseRefusal(page, action, previousLength) {
  await page.waitForFunction(({ action, previousLength }) => {
    const results = window.asiHarness.journal.probeResults;
    return results.length > previousLength && results.at(-1).action === action;
  }, { action, previousLength });
  const result = (await read(page)).journal.probeResults.at(-1);
  assert.deepEqual(result, { action, outcome: "refused", value: false }, "Ordinary rest refusal must be the actual false result, not success/throw");
  await page.getByRole("complementary", { name: "Fixture controls" }).getByRole("alert").waitFor({ state: "detached" });
}
async function view(page, name) { await page.getByRole("button", { name: `View ${name}`, exact: true }).click(); }
async function actualSheetTab(page, size, name) {
  if (size === "mobile") {
    const mobile = page.locator("div.md\\:hidden");
    await mobile.locator(":scope > nav").getByRole("button", { name, exact: true }).click();
    return mobile.locator(":scope > div > section").nth(["Stats", "Skills", "Actions", "Spells", "Inventory", "Features", "Notes"].indexOf(name));
  }
  if (name === "Stats") return page;
  const desktop = page.locator("div.hidden.md\\:grid");
  assert.equal(await desktop.count(), 1, "Exactly one actual desktop sheet grid must exist");
  assert.equal(await desktop.isVisible(), true, "Desktop tab controls must be in the visible sheet grid");
  await desktop.getByRole("button", { name, exact: true }).click();
  return desktop;
}
async function evidenceChange(page) {
  const before = await read(page);
  // Explicit modeled inbound read update while a product modal is still open.
  await page.evaluate(() => window.dispatchEvent(new Event("asi-fixture-evidence-change")));
  await page.waitForFunction(() => window.asiHarness.snapshot?.mechanics.status === "unavailable");
  const after = await read(page);
  assert.deepEqual(after.snapshot.state, before.snapshot.state, "Evidence-only change must preserve the same raw/committed state");
  assert.deepEqual(after.projection.rawRefs, before.projection.rawRefs, "Do not rewrite pins to provoke stale refusal");
  assert.deepEqual(count(after.journal), count(before.journal), "Inbound evidence change itself must not roll/log/write");
  return before;
}
async function previewStrength(page) {
  return page.getByText("Stats", { exact: true }).locator("..").getByText("STR", { exact: true }).evaluate(node => node.parentElement.children[1].textContent);
}
export async function executeAsiScenario(page, scenario, helpers) {
  const { size, layout, keyboardReach, capture } = helpers, checks = [];
  let backgroundPendingProof;
  const check = async (label, action) => { await action(); checks.push(label); };
  await page.waitForFunction(() => window.asiHarness.snapshot && window.asiHarness.projection);
  const initial = await read(page);
  await check("six explicit saved scores and raw immutable envelope/count projection", () => {
    for (const slug of ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]) assert.ok(Number.isFinite(initial.snapshot.stats[slug]));
    assert.equal(initial.projection.refCount, initial.projection.rawRefs.length);
    if (initial.projection.rawGrants === null) { assert.equal(initial.projection.grantCount, null); assert.equal(initial.projection.presentedEvidence.status, "unavailable"); }
    else assert.equal(initial.projection.grantCount, initial.projection.rawGrants.length);
    assert.ok(initial.projection.rawRefs.every(ref => Object.hasOwn(ref, "feature_grant_id") && ref.content_versions.version === ref.content_version));
  });
  if (scenario === "builder-strength") {
    await check("actual provider14, unchanged HP31; static/formula24 and independent equal add16", async () => {
      assert.equal(initial.snapshot.stats.strength, 14); assert.equal(initial.snapshot.maxHp, 31);
      assert.equal(await page.getByLabel("Static multiply ordering", { exact: true }).textContent(), "24");
      assert.equal(await page.getByLabel("Formula ordering", { exact: true }).textContent(), "24");
      assert.equal(await page.getByLabel("Independent same-number add", { exact: true }).textContent(), "16");
    });
    await view(page, "abilities");
    await check("actual Abilities total14 and base10, no second addition", async () => {
      const input = page.getByRole("spinbutton", { name: "Strength score", exact: true }); assert.equal(await input.inputValue(), "10");
      const card = input.locator('xpath=ancestor::*[@data-slot="card"][1]');
      assert.equal(await card.getByText("Total", { exact: true }).evaluate(node => node.nextElementSibling.textContent), "14");
    });
    await view(page, "race"); await check("actual Race immutable description is mounted without writes", async () => assert.ok(await page.getByText("Race", { exact: true }).count()));
    await view(page, "preview"); await check("actual visible StatPreview14 in both viewport widths", async () => assert.equal(await previewStrength(page), "14"));
    await view(page, "class"); await page.getByRole("button", { name: /Add a class/ }).click();
    await check("actual desktop/mobile Class STR13 prerequisite crosses with14", async () => assert.ok(await page.getByText(/STR 13 · met/).isVisible()));
    await evidenceChange(page);
    await check("open actual picker becomes unavailable after same-state evidence loss", async () => assert.ok(await page.getByText(/Saved ability mechanics unavailable/).isVisible()));
  } else if (["con-baseline", "con-temporary"].includes(scenario)) {
    await check("actual permanent/live Constitution and HP split", () => {
      assert.equal(initial.snapshot.stats.constitution, scenario === "con-baseline" ? 14 : 18);
      assert.equal(initial.snapshot.maxHp, scenario === "con-baseline" ? 31 : 35);
      assert.equal(initial.snapshot.state.current_hp, 5);
    });
    const scope = await actualSheetTab(page, size, "Stats");
    await scope.getByRole("button", { name: /HP tracker/ }).click();
    await check("actual HP popover shows permanent max, temporary effects did not rewrite HP history", async () => {
      assert.ok(await page.getByText(scenario === "con-baseline" ? "HP: 5 / 31" : "HP: 5 / 35", { exact: true }).isVisible());
      assert.deepEqual((await read(page)).initialProjection, initial.initialProjection);
    });
    if (scenario === "con-baseline") {
      await page.getByPlaceholder("Amount", { exact: true }).fill("2"); await page.getByRole("button", { name: "Damage", exact: true }).click();
      await page.waitForFunction(() => window.asiHarness.snapshot.state.current_hp === 3);
      await check("actual relative HP damage commits once without modifying immutable HP choices", async () => { const data = await read(page); assert.equal(data.journal.stateWrites.length, 1); assert.equal(data.snapshot.maxHp, 31); assert.deepEqual(data.initialProjection.characterSnapshot.choices.hp_rolls, initial.initialProjection.characterSnapshot.choices.hp_rolls); });
    }
  } else if (scenario.startsWith("denial-")) {
    await check("unearned/foreign/missing/duplicate/raw-extra evidence is unavailable", () => assert.equal(initial.snapshot.mechanics.status, "unavailable"));
    const scope = await actualSheetTab(page, size, "Stats");
    await check("actual ability action disabled", async () => assert.equal(await scope.getByRole("button", { name: "Roll Strength check", exact: true }).isDisabled(), true));
    for (const name of ["Dependent roll probe", "Dependent relative HP probe", "Dependent whole-rest probe"]) {
      const before = await read(page);
      await page.getByRole("button", { name, exact: true }).click();
      if (name === "Dependent whole-rest probe") await falseRefusal(page, name, before.journal.probeResults.length);
      else await page.getByRole("complementary", { name: "Fixture controls" }).getByRole("alert").waitFor();
      await check(`${name} refuses before native RNG/log/all DAL and preserves state/pins`, async () => {
        const after = await read(page);
        assert.deepEqual(count(after.journal), { rng: 0, log: 0, state: 0, spell: 0, print: 0 });
        assert.deepEqual(after.snapshot.state, before.snapshot.state);
        assert.deepEqual(after.projection.rawRefs, before.projection.rawRefs);
      });
    }
  } else if (scenario === "cap-warning") {
    await check("historical earned contribution is retained without clamp", () => { assert.equal(initial.snapshot.stats.strength, 24); assert.deepEqual(initial.snapshot.mechanics, { status: "available", capUnverified: true }); });
    await check("actual SheetPanel visible cap notice", async () => assert.ok(await page.getByText(/historical cap eligibility is unverified/).isVisible()));
    const scope = await actualSheetTab(page, size, "Stats"); await scope.getByRole("button", { name: "Roll Strength check", exact: true }).click(); await page.getByRole("button", { name: "Roll", exact: true }).click();
    await check("confirmed unclamped modifier7 reaches native roll once", async () => assert.equal((await read(page)).journal.rngAttempts[0].expression, "1d20+7"));
  } else if (scenario.startsWith("background")) {
    await view(page, "preview"); await check("saved conditional state yields actual preview17", async () => assert.equal(await previewStrength(page), "17"));
    await view(page, "background");
    if (scenario === "background-reject") {
      await page.getByRole("button", { name: /Change background/i }).click();
      await page.getByText("Original original-courier", { exact: true }).click(); await page.getByRole("button", { name: "Add Background", exact: true }).click();
      await page.waitForFunction(() => !!window.asiHarness.rejectBackground);
      // Actual preview is responsive/hidden on mobile; read the rendered draft notice there too.
      await check("pending native fieldset/selection controls are disabled and busy; preview explicitly draft (mobile sidebar hidden)", async () => {
        await page.waitForFunction(() => {
          const fieldset = document.querySelector('fieldset[aria-busy="true"]');
          return fieldset instanceof HTMLFieldSetElement && fieldset.disabled;
        });
        const fieldset = page.locator('fieldset[aria-busy="true"]');
        // Playwright isDisabled deliberately excludes FIELDSET itself. Read its
        // native reflected property, then check effective inherited disabling
        // on the supported form controls instead of relaxing this contract.
        const native = await fieldset.evaluate(node => ({ tagName: node.tagName, disabled: node.disabled,
          disabledAttribute: node.hasAttribute("disabled"), ariaBusy: node.getAttribute("aria-busy") }));
        assert.deepEqual(native, { tagName: "FIELDSET", disabled: true, disabledAttribute: true, ariaBusy: "true" });
        const controls = [];
        for (const [name, locator] of [
          ["Search Background", fieldset.getByRole("textbox", { name: "Search Background", exact: true })],
          ["Preview Original original-courier", fieldset.getByRole("button", { name: "Preview Original original-courier", exact: true })],
          ["Keep Current Background", fieldset.getByRole("button", { name: "Keep Current Background", exact: true })],
        ]) {
          const effectiveDisabled = await locator.isDisabled();
          const nativeDisabled = await locator.evaluate(node => node.matches(":disabled"));
          assert.equal(effectiveDisabled, true, `Pending ${name} must be effectively disabled`);
          assert.equal(nativeDisabled, true, `Pending ${name} must inherit native disabling`);
          controls.push({ name, effectiveDisabled, nativeDisabled });
        }
        assert.ok(await page.getByText(/Draft preview only/).count());
        backgroundPendingProof = { native, controls };
      });
      await check("pending native activation cannot select twice, cancel the selection or navigate", async () => {
        const before = await read(page), navigationControls = [];
        assert.equal(before.calls.filter(call => call.name === "backgroundSelection").length, 1);
        for (const name of ["Previous: Abilities", "Next: Equipment"]) {
          const button = page.getByRole("button", { name, exact: true });
          const inPendingFieldset = await button.evaluate(node => !!node.closest('fieldset[aria-busy="true"]'));
          const effectiveDisabled = await button.isDisabled();
          // Assert inheritance only if the actual navigation control is inside
          // the fieldset; an outside control must still obey saveBusy.
          if (inPendingFieldset) assert.equal(effectiveDisabled, true, `Pending ${name} must inherit disabling`);
          navigationControls.push({ name, inPendingFieldset, effectiveDisabled });
        }
        for (const name of ["Preview Original original-courier", "Keep Current Background", "Previous: Abilities", "Next: Equipment"]) {
          // Native click() respects disabled form controls. No forced pointer
          // or synthetic event bypasses the pending UI contract.
          await page.getByRole("button", { name, exact: true }).evaluate(node => { node.click(); node.click(); });
        }
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))));
        const after = await read(page);
        assert.deepEqual(after.calls, before.calls, "Pending controls must not invoke another action");
        assert.deepEqual(after.navigation, before.navigation, "Pending controls must not navigate");
        assert.deepEqual(count(after.journal), count(before.journal));
        assert.deepEqual(after.snapshot.state, before.snapshot.state);
        assert.deepEqual(after.projection.rawRefs, before.projection.rawRefs);
        assert.equal(await page.getByRole("button", { name: "Add Background", exact: true }).count(), 0, "Pending selection cannot reopen its confirmation");
        backgroundPendingProof.navigationControls = navigationControls;
        backgroundPendingProof.actionCount = after.calls.filter(call => call.name === "backgroundSelection").length;
      });
      await page.evaluate(() => window.asiHarness.rejectBackground());
      await page.getByRole("alert").filter({ hasText: /could not be selected/ }).waitFor();
      await check("rejected selection clears pending, retains draft notice and original immutable raw data", async () => {
        await page.waitForFunction(() => {
          const fieldset = document.querySelector("fieldset");
          return fieldset instanceof HTMLFieldSetElement && !fieldset.disabled && fieldset.getAttribute("aria-busy") === "false";
        });
        assert.ok(await page.getByText(/Draft preview only/).count());
        const after = await read(page);
        assert.deepEqual(after.initialProjection, initial.initialProjection);
        assert.deepEqual(after.projection.rawRefs, initial.projection.rawRefs);
        assert.deepEqual(after.snapshot.state, initial.snapshot.state);
        assert.equal(after.calls.filter(call => call.name === "backgroundSelection").length, 1);
      });
    }
  } else if (["weapon-crit", "retained-crit"].includes(scenario)) {
    const scope = await actualSheetTab(page, size, "Actions");
    await check("real weapon damage uses earnedSTR modifier2", async () => assert.ok((await scope.getByRole("button", { name: /original-asi-mallet damage/ }).textContent()).includes("1d6 +2")));
    await scope.getByRole("button", { name: /original-asi-mallet attack/ }).click(); await page.getByRole("button", { name: "Roll", exact: true }).click();
    await check("real crit state armed from openly simulated accepted natural20 after native RNG", async () => { assert.ok(await scope.getByText("Crit!", { exact: true }).isVisible()); const data = await read(page); assert.equal(data.journal.rngAttempts.length, 1); assert.equal(data.journal.rollResults[0].acceptedResultSimulated, true); assert.ok(data.journal.rollResults[0].original.groups[0].rolls[0] >= 1); });
    if (scenario === "retained-crit") {
      const before = await evidenceChange(page);
      await check("evidence change clears old crit and blocks damage before RNG/log/write", async () => { assert.equal(await scope.getByText("Crit!", { exact: true }).count(), 0); assert.equal(await scope.getByRole("button", { name: /original-asi-mallet damage/ }).isDisabled(), true); assert.deepEqual(count((await read(page)).journal), count(before.journal)); });
    } else {
      await scope.getByRole("button", { name: /original-asi-mallet damage/ }).click();
      await check("one-shot crit doubles native dice and clears arming", async () => { const data = await read(page); assert.equal(data.journal.rngAttempts[1].crit, true); assert.equal(data.journal.rollResults[1].original.groups[0].rolls.length, 2); assert.equal(await scope.getByText("Crit!", { exact: true }).count(), 0); });
    }
  } else if (["cast-prep", "retained-cast"].includes(scenario)) {
    const scope = await actualSheetTab(page, size, "Spells");
    if (scenario === "cast-prep") {
      await scope.getByTitle("Unprepare", { exact: true }).click(); await page.waitForFunction(() => window.asiHarness.journal.spellWrites.length === 1);
      await scope.getByTitle("Prepare", { exact: true }).click(); await page.waitForFunction(() => window.asiHarness.journal.spellWrites.length === 2);
      await check("actual preparation toggles use confirmed shared scores", async () => assert.deepEqual((await read(page)).journal.spellWrites.map(write => write.patch.is_prepared), [false, true]));
    }
    await scope.getByRole("button", { name: "Cast", exact: true }).click(); await page.getByRole("dialog").getByRole("button", { name: "Cast", exact: true }).click();
    await page.getByRole("button", { name: /Roll Attack/ }).waitFor();
    await check("actual cast result uses INT14/mod2 with one modeled slot patch", async () => { const data = await read(page); assert.equal(data.snapshot.stats.intelligence, 14); assert.equal(data.journal.stateWrites.length, 1); assert.ok((await page.getByRole("button", { name: /Roll Attack/ }).textContent()).includes("+4")); });
    if (scenario === "retained-cast") {
      const before = await evidenceChange(page); await page.getByRole("button", { name: /Roll Attack/ }).click(); await page.getByRole("alert").filter({ hasText: /changed/ }).waitFor();
      await check("retained open actual cast result refuses before RNG/log/DAL", async () => assert.deepEqual(count((await read(page)).journal), count(before.journal)));
    } else {
      await page.getByRole("button", { name: /Roll Attack/ }).click(); await page.getByRole("button", { name: /Roll Damage/ }).click();
      await check("confirmed actual cast attack/damage use native rolls", async () => { const data = await read(page); assert.equal(data.journal.rngAttempts[0].expression, "1d20+4"); assert.equal(data.journal.rngAttempts.length, 2); assert.equal(data.journal.persistedRolls.length, 2); });
    }
  } else if (scenario === "rest-hitdie") {
    const scope = await actualSheetTab(page, size, "Stats"); await scope.getByRole("button", { name: "Rest", exact: true }).click();
    await page.getByRole("button", { name: "Spend & Roll", exact: true }).click(); await page.waitForFunction(() => window.asiHarness.journal.stateWrites.length === 1);
    await check("actual rest hit die uses native1d8+3 from ASI CON16", async () => { const data = await read(page); assert.equal(data.snapshot.maxHp, 35); assert.equal(data.journal.rngAttempts[0].expression, "1d8+3"); assert.equal(data.journal.persistedRolls.length, 1); });
    await page.getByRole("button", { name: "Take Long Rest", exact: true }).click(); await page.waitForFunction(() => window.asiHarness.journal.stateWrites.length === 2);
    await check("actual whole long rest emits one complete patch after hitdie", async () => { const data = await read(page), patch = data.journal.stateWrites[1].patch; assert.equal(patch.current_hp, 35); assert.equal(patch.temp_hp, 0); assert.equal(patch.exhaustion, 1); assert.deepEqual(patch.spell_slots_used, { "1": 0 }); assert.deepEqual(patch.death_saves, { successes: 0, failures: 0 }); assert.deepEqual(patch.hit_dice_spent, { "original-guard": 0 }); });
  } else if (scenario === "retained-print") {
    await page.getByRole("button", { name: "Print / Save PDF", exact: true }).click(); const dialog = page.getByRole("dialog", { name: "Print preview", exact: true });
    await check("actual captured print model includes earned Strength14", async () => assert.ok(await dialog.getByRole("row").filter({ hasText: /Strength/ }).filter({ hasText: /14/ }).count()));
    await capture("preview");
    await dialog.getByRole("button", { name: "Print / Save PDF", exact: true }).click();
    await check("confirmed actual captured print callback reaches the disclosed invocation stub once", async () => assert.equal((await read(page)).journal.printCalls.length, 1));
    const before = await evidenceChange(page); await dialog.getByRole("button", { name: "Print / Save PDF", exact: true }).click(); await page.getByRole("alert").filter({ hasText: /changed/ }).waitFor();
    await check("captured actual print callback refuses window.print after evidence-only change", async () => assert.deepEqual(count((await read(page)).journal), count(before.journal)));
  } else if (scenario === "retained-rest") {
    await page.getByRole("button", { name: "Capture long-rest callback", exact: true }).click(); const before = await evidenceChange(page);
    await page.getByRole("button", { name: "Invoke retained long rest", exact: true }).click();
    await falseRefusal(page, "Invoke retained long rest", before.journal.probeResults.length);
    await check("retained actual whole-rest callback returns false without partial patch/RNG/log/state/pin changes", async () => {
      const after = await read(page);
      assert.deepEqual(count(after.journal), count(before.journal));
      assert.deepEqual(after.snapshot.state, before.snapshot.state);
      assert.deepEqual(after.projection.rawRefs, before.projection.rawRefs);
    });
  } else if (scenario === "ability-draft") {
    await view(page, "abilities"); const input = page.getByRole("spinbutton", { name: "Strength score", exact: true }); await keyboardReach(page, input);
    await input.fill("11"); await page.waitForFunction(() => !!window.asiHarness.rejectAbility);
    await check("actual native input creates a pending ordered draft, no navigation", async () => { assert.equal(await input.inputValue(), "11"); assert.ok(await page.getByText(/Saving ability scores/).count()); assert.equal((await read(page)).calls.filter(call => call.name === "save_character_abilities").length, 1); });
    await page.getByRole("button", { name: "Next: Background", exact: true }).click();
    await check("pending draft cannot navigate", async () => assert.deepEqual((await read(page)).navigation, []));
    await page.evaluate(() => window.asiHarness.rejectAbility()); await page.getByRole("button", { name: "Retry save", exact: true }).waitFor();
    await page.getByRole("button", { name: "Unmount ability editor", exact: true }).click(); await page.getByRole("button", { name: "Remount ability editor", exact: true }).click();
    await check("actual browser-memory draft survives SPA remount after rejection", async () => { assert.equal(await page.getByRole("spinbutton", { name: "Strength score", exact: true }).inputValue(), "11"); assert.ok(await page.getByText(/Could not save ability scores/).isVisible()); });
    await page.getByRole("button", { name: "Retry save", exact: true }).click(); await page.getByText("Changes save automatically.", { exact: true }).waitFor();
    await check("explicit retry carries original expected snapshot; no automatic retry", async () => { const calls = (await read(page)).calls.filter(call => call.name === "save_character_abilities"); assert.equal(calls.length, 2); assert.deepEqual(calls[1].args.expected_scores, calls[0].args.expected_scores); assert.equal(calls[1].args.ability_scores.strength, 11); });
  } else if (scenario === "independent-actions") {
    await page.getByRole("button", { name: "Independent native die", exact: true }).click(); await page.getByRole("button", { name: "Independent toggle", exact: true }).click(); await page.waitForFunction(() => window.asiHarness.journal.stateWrites.length === 1);
    await check("missing ASI evidence still permits independent native dice and explicit toggle", async () => { const data = await read(page); assert.equal(data.snapshot.mechanics.status, "unavailable"); assert.equal(data.journal.rngAttempts[0].expression, "1d6"); assert.equal(data.journal.persistedRolls.length, 1); assert.deepEqual(data.journal.stateWrites[0].patch, { original_independent_toggle: true }); });
  } else if (scenario === "feat-choice") {
    await check("exact null-grant chosen feat tuple retains independent Wisdom effect, no ASI+2", () => { assert.equal(initial.snapshot.stats.strength, 12); assert.equal(initial.snapshot.stats.wisdom, 12); assert.equal(initial.snapshot.mechanics.status, "available"); assert.ok(initial.projection.rawRefs.some(ref => ref.feature_grant_id === null && ref.choice_source?.startsWith("choice:asi:"))); });
  } else if (scenario === "legacy-dual") {
    await check("unchanged undeclared legacy dual race retains additive arithmetic", () => { assert.equal(initial.snapshot.stats.strength, 16); assert.equal(initial.snapshot.stats.constitution, 16); assert.equal(initial.snapshot.maxHp, 35); });
    await check("actual sheet keeps visible race ambiguity with associated original pins", async () => { assert.ok(await page.getByText(/ability bonuses in both scores and effects/).isVisible()); assert.deepEqual((await read(page)).initialProjection, initial.initialProjection); });
  } else throw Error(`Unimplemented finite scenario: ${scenario}`);
  await check("no unexpected boundary calls; real viewport/controls bounded", async () => { assert.deepEqual((await read(page)).unexpectedCalls, []); await layout(page, size, scenario); });
  await capture();
  return { checks, backgroundPendingProof, ...(await read(page)), limits: "Simulated read/auth/actions/CAS/navigation/print; native RNG untouched; actual consumer UI. Critical accepted result is openly simulated only in named crit cases." };
}
