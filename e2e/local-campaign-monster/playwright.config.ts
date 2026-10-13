import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const gateStart = Number(process.env.INKBORNE_M5_GATE_STARTED_AT);
assert.ok(Number.isSafeInteger(gateStart) && gateStart > 0 && gateStart <= Date.now() && Date.now() < gateStart + 900000,
  "Root must supply actual whole-gate launch time before framework/config loading");
const descriptor = process.env.INKBORNE_M5_REVIEW_DESCRIPTOR;
const digest = process.env.INKBORNE_M5_REVIEW_DESCRIPTOR_SHA256;
assert.ok(descriptor && digest, "Source-only preparation: independent descriptor/budget absent");
const bytes = readFileSync(descriptor);
assert.equal(createHash("sha256").update(bytes).digest("hex"), digest);
const input = JSON.parse(bytes.toString());
assert.equal(input.kind, "independently-reviewed-offline-m5-v1");
assert.deepEqual(input.nodeRuntime, { executable: process.execPath, version: process.version,
  executedSha256: createHash("sha256").update(readFileSync(process.execPath)).digest("hex") });
assert.equal(input.phaseAllocation?.status, "root-reviewed-measured");
assert.equal(input.phaseAllocation.wholeMs, 900000);
export default { testDir: ".", testMatch: "campaign-monster.spec.ts", workers: 1, retries: 0,
  timeout: 900000, reporter: "list", outputDir: "../../test-results/campaign-monster-playwright",
  expect: { timeout: 5000 } };
