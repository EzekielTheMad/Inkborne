import assert from "node:assert/strict";
import path from "node:path";

const uncertain = "The save could not be confirmed. Your draft is retained. Check Homebrew before trying again.";
const state = page => page.evaluate(() => window.monsterAuthoringFixture.state());
async function open(page, label) {
  const summary = page.locator("details > summary").filter({ hasText: new RegExp("^" + label + "$") });
  assert.equal(await summary.count(), 1, "Exact structured section must exist: " + label);
  if (!await summary.evaluate(node => node.parentElement.open)) await summary.click();
}
async function keyboard(page, target) {
  await target.scrollIntoViewIfNeeded(); await target.focus();
  assert.equal(await target.evaluate(node => node === document.activeElement && node.tabIndex >= 0), true, "Native keyboard target not reachable");
  await page.keyboard.press("Enter");
}
async function reach(target) {
  await target.scrollIntoViewIfNeeded();
  assert.equal(await target.isVisible(), true);
  assert.equal(await target.evaluate(node => {
    const box = node.getBoundingClientRect();
    return box.width > 0 && box.left >= -1 && box.right <= innerWidth + 1 && box.top >= -1 && box.bottom <= innerHeight + 1;
  }), true, "Structured control must be reachable without clipping/overflow");
}
const save = page => page.getByRole("button", { name: "Save new version", exact: true });
const traits = page => page.getByRole("group", { name: "Traits", exact: true });

/** Finite actual-form checks. Save callbacks and session readback are deliberately
 * synthetic; no HTTP Server Action, Auth, RLS or immutable database receipt proof. */
export async function exerciseMonsterAuthoring({ page, origin, output, size, record, fonts, layout }) {
  await page.goto(origin + "/authoring");
  await page.getByLabel("Name", { exact: true }).waitFor();
  for (const label of ["Name", "Creature type", "Declared AC", "Declared HP average", "Strength score"]) assert.equal(await page.getByLabel(label, { exact: true }).inputValue(), "");
  assert.equal(await page.getByLabel("Size", { exact: true }).inputValue(), "");
  const loadedFonts = await fonts(page); await layout(page);
  await page.getByRole("button", { name: "Create private monster", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByLabel("Name", { exact: true }).evaluate(node => node === document.activeElement), true);
  assert.equal((await state(page)).calls.length, 0);
  await page.screenshot({ path: path.join(output, size + "-blank-required.png"), fullPage: true });
  record(size, "blank required controls/no guessed mechanics; keyboard focus/no action and real fonts", { fonts: loadedFonts });

  for (const [label, value] of [["Name", "Original Workshop Kite"], ["Creature type", "construct"], ["Declared AC", "12"], ["Declared HP average", "18"],
    ["Strength score", "8"], ["Dexterity score", "12"], ["Constitution score", "10"], ["Intelligence score", "6"], ["Wisdom score", "10"], ["Charisma score", "9"],
    ["Walk (ft.) (optional)", "0"], ["HP dice text (optional)", "3d6 + 8"]]) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel("Size", { exact: true }).selectOption("Small");
  await open(page, "Traits"); await page.getByLabel("Include traits", { exact: true }).check();
  await keyboard(page, page.getByRole("button", { name: "Add trait", exact: true }));
  await traits(page).getByLabel("Entry name", { exact: true }).nth(0).fill("Echo");
  await traits(page).getByLabel("Entry description", { exact: true }).nth(0).fill("First original echo.");
  await keyboard(page, page.getByRole("button", { name: "Add trait", exact: true }));
  await traits(page).getByLabel("Entry name", { exact: true }).nth(1).fill("Echo");
  await traits(page).getByLabel("Entry description", { exact: true }).nth(1).fill("Second original echo.");
  await keyboard(page, page.getByRole("button", { name: "Move Traits 2 up", exact: true }));
  assert.deepEqual(await traits(page).getByLabel("Entry description", { exact: true }).evaluateAll(nodes => nodes.map(node => node.value)), ["Second original echo.", "First original echo."]);
  await keyboard(page, page.getByRole("button", { name: "Add trait", exact: true }));
  await keyboard(page, page.getByRole("button", { name: "Remove Traits 3", exact: true }));
  await reach(traits(page).getByLabel("Entry description", { exact: true }).nth(1)); await layout(page);
  record(size, "real structured create inputs and keyboard Add/Move/Remove keep duplicate order and zero");

  await page.getByRole("button", { name: "Create private monster", exact: true }).click();
  await page.getByText("Simulated save recorded. Reload simulated store to inspect.", { exact: true }).waitFor();
  const created = await state(page);
  assert.equal(created.record.version, 1); assert.equal(created.record.data.speed.walk, 0);
  assert.deepEqual(created.record.data.traits.map(entry => entry.description), ["Second original echo.", "First original echo."]);
  assert.equal(created.calls.length, 1); assert.equal(created.calls[0].mode, "create");
  assert.ok(!JSON.stringify(created.record.data).includes("rowId"));
  await page.getByRole("button", { name: "Reload simulated store", exact: true }).click();
  await save(page).waitFor(); assert.equal(await page.getByLabel("Name", { exact: true }).inputValue(), "Original Workshop Kite");
  record(size, "synthetic create/readback reload uses actual mapper/form; no database save authority");

  await open(page, "Languages"); await page.getByLabel("Include languages", { exact: true }).check();
  await save(page).click(); await page.getByText("Simulated save recorded. Reload simulated store to inspect.", { exact: true }).waitFor();
  const empty = await state(page); assert.deepEqual(empty.record.data.languages, []);
  assert.deepEqual(empty.calls.at(-1).submitted.changedFields, ["languages"]);
  await page.getByRole("button", { name: "Reload simulated store", exact: true }).click(); await open(page, "Languages");
  assert.equal(await page.getByLabel("Include languages", { exact: true }).isChecked(), true);
  await page.getByLabel("Include languages", { exact: true }).uncheck(); await save(page).click();
  await page.getByText("Simulated save recorded. Reload simulated store to inspect.", { exact: true }).waitFor();
  const absent = await state(page); assert.equal(Object.hasOwn(absent.record.data, "languages"), false);
  assert.deepEqual(absent.history[0], created.history[0]);
  await page.getByRole("button", { name: "Reload simulated store", exact: true }).click();
  record(size, "explicit absent/empty/clear intent and synthetic version-one history stay distinct");

  await page.getByRole("button", { name: "Set recoverable response", exact: true }).click();
  await page.getByLabel("Creature type", { exact: true }).fill("Retained lantern construct");
  await open(page, "Traits"); await keyboard(page, page.getByRole("button", { name: "Move Traits 2 up", exact: true }));
  const recoveryBefore = await state(page); await save(page).click();
  await page.getByText("Synthetic recoverable error. Draft retained.", { exact: true }).waitFor();
  await page.locator("form").evaluate(node => node.reset());
  assert.equal(await page.getByLabel("Creature type", { exact: true }).inputValue(), "Retained lantern construct");
  assert.deepEqual(await traits(page).getByLabel("Entry description", { exact: true }).evaluateAll(nodes => nodes.map(node => node.value)), ["First original echo.", "Second original echo."]);
  const recoveryAfter = await state(page); assert.deepEqual(recoveryAfter.record, recoveryBefore.record);
  assert.deepEqual(recoveryAfter.calls.at(-1).submitted.changedFields, ["creature_type", "traits"]);
  record(size, "recoverable response/native reset retain actual values, ordered rows and changed intent");

  await page.getByRole("button", { name: "Set pending response", exact: true }).click();
  const pendingBefore = (await state(page)).calls.length; await save(page).click();
  await page.getByRole("button", { name: "Saving…", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Saving…", exact: true }).isDisabled(), true);
  assert.equal(await page.getByLabel("Creature type", { exact: true }).isDisabled(), true);
  await page.locator("form").evaluate(node => node.requestSubmit());
  assert.equal((await state(page)).calls.length, pendingBefore + 1);
  await page.getByRole("button", { name: "Resolve pending response", exact: true }).click();
  await page.getByText("Pending synthetic response released. Draft retained.", { exact: true }).waitFor();
  record(size, "pending duplicate request prevented; controlled draft survives synthetic release");

  await page.getByRole("button", { name: "Set conflict response", exact: true }).click();
  await page.getByLabel("Creature type", { exact: true }).fill("Unsaved stale type"); await save(page).click();
  await page.getByText("Synthetic concurrent change. Reload latest before saving again.", { exact: true }).waitFor();
  assert.equal(await save(page).isDisabled(), true);
  assert.equal(await page.getByLabel("Creature type", { exact: true }).inputValue(), "Unsaved stale type");
  const conflictCalls = (await state(page)).calls.length;
  await page.getByRole("button", { name: "Reload latest", exact: true }).click();
  await save(page).waitFor();
  assert.equal(await page.getByLabel("Creature type", { exact: true }).inputValue(), "construct");
  assert.equal(await page.getByLabel("Description (optional)", { exact: true }).inputValue(), "Original simulated concurrent revision.");
  assert.equal((await state(page)).calls.length, conflictCalls);
  record(size, "actual conflict lock and explicit native reload discard stale draft without resubmission");

  for (const response of ["reject", "malformed"]) {
    await page.getByRole("button", { name: "Set " + response + " response", exact: true }).click();
    await page.getByLabel("Creature type", { exact: true }).fill("Retained " + response + " draft");
    const beforeCalls = (await state(page)).calls.length; await save(page).click();
    await page.getByText(uncertain, { exact: true }).waitFor();
    await page.locator("form").evaluate(node => node.reset());
    assert.equal(await page.getByLabel("Creature type", { exact: true }).inputValue(), "Retained " + response + " draft");
    assert.equal(await page.getByRole("link", { name: "Check Homebrew", exact: true }).getAttribute("href"), "/homebrew");
    const after = await state(page); assert.equal(after.calls.length, beforeCalls + 1);
    assert.equal(after.record.data.creature_type, "Retained " + response + " draft"); // Synthetic store changed before response loss: never infer rollback.
    assert.equal(await page.getByText("Simulated save recorded. Reload simulated store to inspect.", { exact: true }).count(), 0);
    await layout(page); await page.screenshot({ path: path.join(output, size + "-" + response + "-retained.png") });
    record(size, "actual " + response + " action result retains draft and Check Homebrew after synthetic write; no automatic retry/confirmation");
    await page.getByRole("button", { name: "Reload simulated store", exact: true }).click();
  }

  await page.getByRole("button", { name: "Set normal response", exact: true }).click();
  const nameControl = page.getByLabel("Name", { exact: true }), nameBefore = await nameControl.inputValue();
  assert.equal(await nameControl.getAttribute("maxlength"), "100");
  await nameControl.fill("N".repeat(101)); const beforeBudgetCalls = (await state(page)).calls.length;
  await save(page).click(); await page.getByRole("alert").waitFor();
  assert.equal((await state(page)).calls.length, beforeBudgetCalls); assert.equal(await nameControl.inputValue(), "N".repeat(101));
  assert.equal(await nameControl.evaluate(node => node === document.activeElement), true);
  await reach(nameControl); await layout(page); await nameControl.fill(nameBefore);
  record(size, "101-character draft is refused before action and retained; no silent name truncation");

  await page.getByRole("button", { name: "Load all fields fixture", exact: true }).click();
  await open(page, "Lair actions"); assert.equal(await page.getByLabel("Lair initiative (optional)", { exact: true }).inputValue(), "0");
  await open(page, "Declared saves"); assert.equal(await page.getByLabel("Charisma save bonus (optional)", { exact: true }).inputValue(), "-2");
  await open(page, "Stat block preview"); await page.getByLabel("Monster stat block", { exact: true }).waitFor();
  const allBefore = await state(page); await save(page).click(); await page.getByText("No changes to save.", { exact: true }).waitFor();
  const allAfter = await state(page); assert.deepEqual(allAfter.record, allBefore.record);
  assert.deepEqual(allAfter.calls[0].submitted.data, allBefore.record.data); assert.deepEqual(allAfter.calls[0].submitted.changedFields, []);
  record(size, "all-fields controls/actual mapper preserve zero/negative declared values and no-op data/version");
  const preview = page.getByLabel("Monster stat block", { exact: true });
  assert.equal(await preview.getByText(allAfter.injection, { exact: true }).count(), 1);
  assert.equal(await page.evaluate(() => Object.hasOwn(globalThis, "compromised")), false);
  assert.equal(await page.locator('#root script,#root img,#root [onerror],a[href^="javascript:"]').count(), 0);
  await layout(page); await page.screenshot({ path: path.join(output, size + "-all-fields-preview.png"), fullPage: true });
  record(size, "actual stat-block preview escapes original literal HTML/script/handler/URL text");

  await page.getByRole("button", { name: "Load near budget fixture", exact: true }).click();
  const longState = await state(page); assert.ok(longState.longBytes > 61_440 && longState.longBytes <= 65_536);
  await open(page, "Traits"); assert.equal(await traits(page).getByLabel("Entry description", { exact: true }).count(), 20);
  await fonts(page); await layout(page); await page.screenshot({ path: path.join(output, size + "-near-budget-top.png") });
  record(size, "original >60KiB validated data and unbroken text mount with exact fonts/no body overflow", { bytes: longState.longBytes });
  const tail = traits(page).getByLabel("Entry description", { exact: true }).nth(19);
  await reach(tail); assert.equal(await tail.inputValue(), "The final lantern keeps its place.");
  await open(page, "Stat block preview"); const last = page.getByLabel("Monster stat block", { exact: true }).getByText("The final lantern keeps its place.", { exact: true });
  await reach(last); await layout(page);
  assert.equal(await last.evaluate(node => { for (let current = node; current && current !== document.body; current = current.parentElement) {
    const css = getComputedStyle(current); if (["hidden", "clip"].includes(css.overflowY) && current.scrollHeight > current.clientHeight + 1) return false;
  } return true; }), true, "Complete near-budget tail must not be clipped");
  await page.screenshot({ path: path.join(output, size + "-near-budget-tail.png") });
  record(size, "last structured control and complete preview tail remain reachable and unclipped");
}
