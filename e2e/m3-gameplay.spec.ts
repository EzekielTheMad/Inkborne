/**
 * M3 gameplay UAT (GAME-PLAN Track D / M3 task T9) — proves the milestone's
 * exit criteria end-to-end against the live stack, per the design's §10
 * verification script (docs/specs/2026-07-15-m3-gameplay-foundations-design.md):
 *
 * A. Cast Mage Armor at 1st level → slot consumed, Active Effects entry,
 *    AC becomes 13 + DEX mod (strong assertion: 12 → 15 with DEX 14).
 * B. Upcast Magic Missile at 2nd level → 4d4+4 damage roll from the result
 *    pane, roll toast + roll-log entry, and a persisted `character_rolls`
 *    row with kind "damage".
 * C. Damage while a NON-concentration effect (Mage Armor) is active → no
 *    concentration prompt; short rest spends a d6 hit die (HP increases,
 *    hit_die roll persisted) and completes with an Arcane Recovery pick.
 *
 * A fully-built level-3 Wizard is seeded directly through Supabase (see
 * helpers/supabase.ts) and deleted in afterAll — which doubles as the check
 * that `character_rolls` rows cascade with the character.
 *
 * The scenarios share one character and build on each other's state, so they
 * run in serial mode: on a retry the whole file re-runs in a fresh worker,
 * beforeAll seeds a NEW character, and every id is tracked for cleanup.
 * Rolls are random — assertions use presence/ranges, never exact totals.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  seedWizardCharacter,
  deleteCharactersById,
  countCharacterRolls,
  E2E_CHARACTER_PREFIX,
} from "./helpers/supabase";

test.describe.configure({ mode: "serial" });

/** Every character this worker seeded (serial retries re-seed) — all deleted. */
const seededIds: string[] = [];
let characterId: string;

test.beforeAll(async () => {
  characterId = await seedWizardCharacter(
    `${E2E_CHARACTER_PREFIX} Wizard ${Date.now()}`,
  );
  seededIds.push(characterId);
});

test.afterAll(async () => {
  if (seededIds.length === 0) return;
  await deleteCharactersById(seededIds);
  // Deleting the character must cascade its roll log (FK ON DELETE CASCADE).
  expect(await countCharacterRolls(characterId)).toBe(0);
});

/** The mobile sheet duplicates most widgets in the DOM (hidden at the desktop
 *  viewport via CSS) — scope every shared-name query to visible elements. */
function visible(locator: Locator): Locator {
  return locator.filter({ visible: true });
}

async function openSheet(page: Page): Promise<void> {
  await page.goto(`/characters/${characterId}`);
  await expect(page.getByRole("tab", { name: /character sheet/i })).toBeVisible();
}

async function openSpellsTab(page: Page): Promise<void> {
  await visible(page.getByRole("button", { name: /^spells$/i })).first().click();
  await expect(visible(page.getByText(/^slots$/i)).first()).toBeVisible();
}

/** The AC combat-stat card — its text content is exactly "AC" + the value. */
function acCard(page: Page): Locator {
  return visible(page.locator("div").filter({ hasText: /^AC\s*\d+\s*$/ })).first();
}

test("Scenario A — cast Mage Armor: slot consumed, active effect, AC 13+DEX", async ({
  page,
}) => {
  await openSheet(page);

  // Baseline AC: 10 + DEX mod (+2) — no armor, no effects.
  await expect(acCard(page)).toHaveText(/^\s*AC\s*12\s*$/);

  await openSpellsTab(page);

  // Wizard 3: 4× 1st-level slots, all free.
  await expect(
    visible(page.getByRole("button", { name: "Mark 1st slot used" })),
  ).toHaveCount(4);
  await expect(
    visible(page.getByRole("button", { name: "Restore 1st slot" })),
  ).toHaveCount(0);

  // Cast Mage Armor at 1st level.
  await visible(page.getByRole("button", { name: /^cast mage armor$/i }))
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: /cast: mage armor/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: "1st" }).click();
  await dialog.getByRole("button", { name: /^cast$/i }).click();

  // Post-cast result pane confirms level and the active-effect application.
  await expect(dialog.getByText(/mage armor cast at 1st level/i)).toBeVisible();
  await expect(dialog.getByText(/added to active effects/i)).toBeVisible();
  await dialog.getByRole("button", { name: /^done$/i }).click();
  await expect(dialog).not.toBeVisible();

  // Slot consumption reflected in the tracker: 3 free, 1 used.
  await expect(
    visible(page.getByRole("button", { name: "Mark 1st slot used" })),
  ).toHaveCount(3);
  await expect(
    visible(page.getByRole("button", { name: "Restore 1st slot" })),
  ).toHaveCount(1);

  // Active Effects widget lists Mage Armor.
  await expect(
    visible(page.getByText("Active Effects", { exact: true })).first(),
  ).toBeVisible();
  await expect(
    visible(page.getByRole("button", { name: /remove mage armor/i })).first(),
  ).toBeVisible();

  // Strong assertion: AC is now 13 + DEX mod (+2) = 15 while unarmored.
  await expect(acCard(page)).toHaveText(/^\s*AC\s*15\s*$/);
});

test("Scenario B — upcast Magic Missile: damage roll, toast, roll log, persistence", async ({
  page,
}) => {
  await openSheet(page);
  await openSpellsTab(page);

  // Cast Magic Missile upcast at 2nd level.
  await visible(page.getByRole("button", { name: /^cast magic missile$/i }))
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: /cast: magic missile/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: "2nd" }).click();
  await dialog.getByRole("button", { name: /^cast$/i }).click();
  await expect(dialog.getByText(/magic missile cast at 2nd level/i)).toBeVisible();

  // Upcast damage is total-dart dice: 4d4 + 4 (3 darts + 1 for the 2nd level).
  const damageButton = dialog.getByRole("button", { name: /roll damage/i });
  await expect(damageButton).toContainText("4d4 + 4");
  await damageButton.click();

  // The result pane shows a total in the 4d4+4 range (8–20).
  await expect(dialog.getByText(/→\s*\d+/)).toBeVisible();

  // A roll toast appears with the roll's label and an in-range total.
  const toast = page.getByTestId("roll-toast").last();
  await expect(toast).toBeVisible();
  await expect(toast).toContainText(/magic missile/i);
  // The total is the toast's only <p> that is purely a number (the breakdown
  // renders individual dice as <span>s).
  const toastTotal = Number(
    await toast.locator("p").filter({ hasText: /^\d+$/ }).first().innerText(),
  );
  expect(toastTotal).toBeGreaterThanOrEqual(8);
  expect(toastTotal).toBeLessThanOrEqual(20);

  await dialog.getByRole("button", { name: /^done$/i }).click();
  await expect(dialog).not.toBeVisible();

  // The 2nd-level slot was consumed: 1 free, 1 used.
  await expect(
    visible(page.getByRole("button", { name: "Restore 2nd slot" })),
  ).toHaveCount(1);

  // The roll log panel lists the damage roll.
  await page.getByRole("button", { name: /open roll log/i }).click();
  const history = page.getByRole("list", { name: /roll history/i });
  const entry = history
    .getByRole("listitem")
    .filter({ hasText: /magic missile/i })
    .filter({ hasText: "Damage" })
    .first();
  await expect(entry).toBeVisible();
  await page.keyboard.press("Escape");

  // Persistence is fire-and-forget — poll the live table via service client.
  await expect
    .poll(() => countCharacterRolls(characterId, "damage"), {
      timeout: 15_000,
      message: "expected a persisted character_rolls row with kind 'damage'",
    })
    .toBeGreaterThanOrEqual(1);
});

test("Scenario C — damage without concentration prompt, hit die, short rest", async ({
  page,
}) => {
  await openSheet(page);

  const hpTracker = visible(
    page.getByLabel("HP tracker — click to heal or damage"),
  ).first();
  await expect(hpTracker).toBeVisible();
  const hpMatch = (await hpTracker.innerText()).match(/(\d+)\s*\/\s*(\d+)/);
  if (!hpMatch) throw new Error("Could not parse HP tracker text");
  const startHp = Number(hpMatch[1]);
  const maxHp = Number(hpMatch[2]);
  const damage = 8; // drops HP but stays well conscious (wizard 3 ≈ 20 max)
  expect(startHp).toBeGreaterThan(damage);

  // Apply damage through the HP tracker popover.
  await hpTracker.click();
  await page.getByPlaceholder("Amount").fill(String(damage));
  await page.getByRole("button", { name: /^damage$/i }).click();
  await expect(hpTracker).toContainText(`${startHp - damage}/${maxHp}`);

  // Mage Armor is active but is NOT a concentration spell — no CON-save
  // prompt may fire, and the effect must survive the damage.
  await expect(page.getByText(/concentration check/i)).toHaveCount(0);
  await expect(
    visible(page.getByRole("button", { name: /remove mage armor/i })).first(),
  ).toBeVisible();

  // Open the rest dialog.
  await visible(page.getByRole("button", { name: /^rest$/i })).first().click();
  const dialog = page.getByRole("dialog", { name: /^rest$/i });
  await expect(dialog).toBeVisible();

  // Spend one d6 hit die (wizard pool 3/3).
  await expect(dialog.getByText(/wizard d6/i)).toBeVisible();
  await expect(dialog.getByText(/3\/3/)).toBeVisible();
  await dialog.getByRole("button", { name: /spend & roll/i }).click();

  // Pool decrements and HP increases by 1d6 + CON mod (+2) → at least 3.
  await expect(dialog.getByText(/2\/3/)).toBeVisible();
  await expect
    .poll(async () => {
      const text = await dialog.getByText(/HP \d+\/\d+/).innerText();
      return Number(text.match(/HP (\d+)\//)![1]);
    })
    .toBeGreaterThanOrEqual(startHp - damage + 3);

  // The hit-die roll toasts…
  await expect(page.getByTestId("roll-toast").last()).toContainText(/hit die/i);
  // …and lands in the persisted roll log.
  await expect
    .poll(() => countCharacterRolls(characterId, "hit_die"), {
      timeout: 15_000,
      message: "expected a persisted character_rolls row with kind 'hit_die'",
    })
    .toBeGreaterThanOrEqual(1);

  // Complete the short rest, recovering the spent 2nd-level slot via Arcane
  // Recovery (wizard 3 budget: 2 slot levels).
  await expect(dialog.getByText("Arcane Recovery").first()).toBeVisible();
  await dialog
    .getByRole("button", { name: "Recover one more 2nd-level slot" })
    .click();
  await expect(dialog.getByText("2/2 slot levels")).toBeVisible();
  const shortRestButton = dialog.getByRole("button", { name: /take short rest/i });
  await expect(shortRestButton).toBeEnabled();
  await shortRestButton.click();
  await expect(dialog).not.toBeVisible();

  // The 2nd-level slot is back: 2 free, 0 used.
  await openSpellsTab(page);
  await expect(
    visible(page.getByRole("button", { name: "Mark 2nd slot used" })),
  ).toHaveCount(2);
  await expect(
    visible(page.getByRole("button", { name: "Restore 2nd slot" })),
  ).toHaveCount(0);
});
