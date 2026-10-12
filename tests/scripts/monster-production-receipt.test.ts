import { describe, expect, it } from "vitest";
import { validateMonsterBuildReceipt } from "@/scripts/monster-production-receipt.mjs";

const sourceSha = "cda325ae527c6c86ad7e45d4a886c1c85de2800d";
const good = { gate: "build", exitCode: 0, sourceSha, sourceStatus: "" };
describe("monster production receipt source-only gate controls", () => {
  it.each([{ sourceStatus: "" }, { sourceStatus: [] }])("accepts an explicit clean source status $sourceStatus", ({ sourceStatus }) => {
    expect(() => validateMonsterBuildReceipt({ ...good, sourceStatus }, sourceSha)).not.toThrow();
  });
  it.each([
    { gate: "check" }, { gate: undefined }, { exitCode: 1 }, { exitCode: null }, { exitCode: "0" },
    { sourceSha: "0".repeat(40) }, { sourceSha: undefined }, { sourceStatus: " M app/page.tsx" },
    { sourceStatus: [" M app/page.tsx"] }, { sourceStatus: null }, { sourceStatus: undefined }, { sourceStatus: {} },
  ])("rejects failed, missing, dirty or wrong-source receipt fields %j", (patch) => {
    expect(() => validateMonsterBuildReceipt({ ...good, ...patch }, sourceSha)).toThrow();
  });
  it.each([{ receipt: null }, { receipt: [] }, { receipt: "build succeeded" }])("rejects a non-object receipt $receipt", ({ receipt }) => {
    expect(() => validateMonsterBuildReceipt(receipt, sourceSha)).toThrow();
  });
});
