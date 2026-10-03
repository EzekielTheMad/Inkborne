import type { Locator, Page } from "@playwright/test";

/** The accessible label contains an em dash. Match its stable semantic prefix,
 * within the active sheet panel; desktop/mobile copies remain mounted behind CSS. */
export function hpTrigger(page: Page): Locator {
    return page.getByRole("tabpanel", { name: "Character Sheet", exact: true })
        .getByRole("button", { name: /^HP tracker\b/ });
}
