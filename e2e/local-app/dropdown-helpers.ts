import { expect, type Locator, type Page } from "@playwright/test";

type Scope = Locator | Page;
const exact = (name: string) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

/** Only native options in the currently visible builder panel are candidates. */
export function choiceOption(scope: Scope, name: string | RegExp): Locator {
  return scope.locator("select:visible option").filter({ hasText: typeof name === "string" ? exact(name) : name });
}

export function choiceGroup(scope: Scope, label: string): Locator {
  const name = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: [0-9]+)?$`);
  return scope.getByRole("combobox", { name }).first().locator("..").locator("..").locator("..");
}

export async function optionPicked(options: Locator): Promise<boolean> {
  for (let index = 0; index < await options.count(); index++) {
    if (await options.nth(index).evaluate(node => (node as HTMLOptionElement).selected)) return true;
  }
  return false;
}

export async function pickOption(options: Locator): Promise<void> {
  await expect(options.first()).toBeAttached();
  if (await options.first().evaluate(node => node.tagName) !== "OPTION") {
    // Equipment category slots retain the existing Base UI catalog menu.
    await expect(options).toHaveCount(1);
    await expect(options).toHaveAttribute("role", "option");
    await options.click(); return;
  }
  // A multi-pick choice offers the same valid candidate in its unfilled slots.
  // Fill a free slot before replacing a filled selection.
  for (let index = 0; index < await options.count(); index++) {
    const option = options.nth(index), control = option.locator("..");
    if (await control.inputValue() === "") {
      await control.selectOption(await option.getAttribute("value") ?? ""); return;
    }
  }
  const option = options.first();
  await option.locator("..").selectOption(await option.getAttribute("value") ?? "");
}

export async function clearOption(options: Locator): Promise<void> {
  for (let index = 0; index < await options.count(); index++) {
    const option = options.nth(index);
    if (await option.evaluate(node => (node as HTMLOptionElement).selected)) {
      await option.locator("..").selectOption(""); return;
    }
  }
  throw Error("The exact saved option must be selected before clearing it");
}

export function hpOption(scope: Scope, method: "average" | "rolled" | "manual"): Locator {
  return scope.getByRole("combobox", { name: "Hit point method", exact: true }).locator(`option[value="${method}"]`);
}

export function asiOption(scope: Scope, ability: string): Locator {
  return scope.getByRole("combobox", { name: "Ability to increase by 2", exact: true }).locator(`option[value="${ability}"]`);
}

export function selectedSpell(scope: Scope, name: string): Locator {
  return scope.locator("select:visible option:checked").filter({ hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: —|$)`) });
}

export async function setSpell(scope: Scope, name: string, selected = true): Promise<void> {
  const saved = selectedSpell(scope, name);
  if (!selected) { await expect(saved).toHaveCount(1); await saved.locator("..").selectOption(""); return; }
  if (await saved.count()) { await expect(saved).toHaveCount(1); return; }
  const searches = scope.getByRole("textbox", { name: /^Search / });
  for (let index = 0; index < await searches.count(); index++) await searches.nth(index).fill(name);
  const control = scope.getByRole("combobox", { name: /^Add / }).filter({ has: scope.locator("option").filter({
    hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: —|$)`),
  }) });
  await expect(control).toHaveCount(1);
  const option = control.locator("option").filter({ hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: —|$)`) });
  await expect(option).toHaveCount(1);
  await control.selectOption(await option.getAttribute("value") ?? "");
  await expect(selectedSpell(scope, name)).toHaveCount(1);
}

export async function setPrepared(scope: Scope, name: string, prepared: boolean): Promise<void> {
  const control = scope.getByRole("combobox", { name: `Prepare ${name}`, exact: true });
  await control.selectOption(prepared ? "prepared" : "not-prepared");
  await expect(control).toHaveValue(prepared ? "prepared" : "not-prepared");
}
