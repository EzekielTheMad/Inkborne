import path from "node:path";
import { z } from "zod";
// Playwright empties outputDir at the start of EVERY run. Never store a journal below it.
export const BROWSER_OUTPUT_DIR = path.resolve("test-results/bounded-browser");
export function runDirectory(runId: string) {
    return path.resolve("test-results/bounded-runs", z.string().uuid().parse(runId));
}
