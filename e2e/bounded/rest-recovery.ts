import { expect, type Page } from "@playwright/test";

/** Called only after a known no-commit rejection settled while away, and after
 * the caller verified the returned sheet and persisted baseline. Back may remount
 * a page-owned dialog. A fresh session must not inherit the destroyed session's error. */
export async function restAfterSettledBack(page: Page) {
    const dialog = page.getByRole("dialog", { name: "Rest", exact: true });
    const present = await dialog.count() > 0;
    if (present) {
        await expect(dialog.getByRole("alert")).toContainText("The rest could not be saved");
    } else {
        await page.getByRole("button", { name: "Rest", exact: true }).click();
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole("alert")).toHaveCount(0);
    }
    await expect(dialog).toHaveAttribute("aria-busy", "false");
    await expect(dialog.getByRole("status")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Take Long Rest", exact: true })).toBeEnabled();
    return { dialog, lifecycle: present ? "dialog-present" : "dialog-reopened" } as const;
}
