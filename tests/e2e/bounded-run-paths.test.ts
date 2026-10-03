// @vitest-environment node
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { BROWSER_OUTPUT_DIR, runDirectory } from "@/e2e/bounded/run-paths";
it("keeps durable fixture journals outside browser output clearing across invocations", () => {
    const relative = path.relative(BROWSER_OUTPUT_DIR, runDirectory(randomUUID()));
    expect(relative.startsWith(".." + path.sep)).toBe(true);
    const root = mkdtempSync(path.join(tmpdir(), "inkborne-output-clear-unit-"));
    try {
        const browser = path.join(root, "bounded-browser"), journal = path.join(root, "bounded-runs", "run", "fixtures.jsonl");
        mkdirSync(browser);
        mkdirSync(path.dirname(journal), { recursive: true });
        writeFileSync(journal, "durable known fixture IDs");
        // Simulate Playwright's output cleanup rather than accepting one successful run as persistence proof.
        rmSync(browser, { recursive: true });
        mkdirSync(browser);
        expect(readFileSync(journal, "utf8")).toBe("durable known fixture IDs");
    }
    finally {
        rmSync(root, { recursive: true });
    }
});
