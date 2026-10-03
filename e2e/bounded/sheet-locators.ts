import type { Locator, Page } from "@playwright/test";

/** The accessible label contains an em dash. Match its stable semantic prefix,
 * within the active sheet panel; desktop/mobile copies remain mounted behind CSS. */
export function hpTrigger(page: Page): Locator {
    return page.getByRole("tabpanel", { name: "Character Sheet", exact: true })
        .getByRole("button", { name: /^HP tracker\b/ });
}

/** Read the displayed current/max pair separately so the maximum cannot satisfy
 * a current-HP assertion after a stale cached response. */
export async function hpReading(page: Page) {
    const values = (await hpTrigger(page).innerText()).match(/(\d+)\s*\/\s*(\d+)/);
    if (!values) throw new Error("The HP control did not expose a current/max pair");
    return { current: Number(values[1]), maximum: Number(values[2]) };
}
