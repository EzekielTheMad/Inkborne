import assert from "node:assert/strict";

/** Pure gate evidence validation; no files, environment, processes or browser. */
export function validateMonsterBuildReceipt(receipt, expectedSourceSha) {
  assert.match(expectedSourceSha, /^[a-f0-9]{40}$/);
  assert.ok(receipt !== null && typeof receipt === "object" && !Array.isArray(receipt), "Build receipt must be a JSON object");
  assert.equal(receipt.gate, "build", "Receipt must record the production build gate");
  assert.equal(receipt.exitCode, 0, "Production build must have succeeded");
  assert.equal(receipt.sourceSha, expectedSourceSha, "Receipt source must match the current approved build source");
  const clean = receipt.sourceStatus === "" || (Array.isArray(receipt.sourceStatus) && receipt.sourceStatus.length === 0);
  assert.equal(clean, true, "Build receipt must record clean source status");
}
