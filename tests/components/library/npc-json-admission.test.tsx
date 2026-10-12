import { webcrypto } from "node:crypto";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNpcJsonReview } from "@/lib/import/npc-json/review";
import { NpcJsonImportPreview } from "@/components/library/npc-json-import-preview";
const tail = '"name":"Original admission control","data":{"schema_version":1,"description":"Original visible narrative."},"effects":[]';
const positive = `{"format":"inkborne-npc","format_version":1,${tail}}`;
const cases = [
  ["otherwise-valid mechanical effect overwritten by empty effects", positive.replace('"effects":[]', '"effects":[{"type":"mechanical","stat":"strength","op":"add","value":2}],"effects":[]')],
  ["unsupported format version overwritten by version1", positive.replace('"format_version":1', '"format_version":2,"format_version":1')],
  ["escaped duplicate version alias", positive.replace('"format_version":1', '"format_version":2,"format_\\u0076ersion":1')],
  ["dangerous original key hidden by duplicate data", positive.replace('"data":', '"data":{"__proto__":{"compromised":true}},"data":')],
  ["NUL original key hidden by duplicate data", positive.replace('"data":', '"data":{"\\u0000":0},"data":')],
  ["decoded NUL in ordinary narrative", positive.replace('Original visible narrative.', 'Original\\u0000 visible narrative.')],
  ["decoded lone high surrogate in ordinary narrative", positive.replace('Original visible narrative.', 'Original\\ud800 visible narrative.')],
  ["decoded lone low surrogate in ordinary narrative", positive.replace('Original visible narrative.', 'Original\\udc00 visible narrative.')],
] as const;
beforeEach(() => vi.stubGlobal("crypto", webcrypto)); afterEach(() => vi.unstubAllGlobals());
describe("otherwise-valid unsafe reader admission reaches actual profile before refusal assertions", () => {
  it.each(cases)("never admits %s into local hash/profile review", async (_label, source) => {
    const result = await createNpcJsonReview(new TextEncoder().encode(source), "admission.json");
    if (result.success) render(<NpcJsonImportPreview review={result.review} />);
    expect(screen.queryByRole("region", { name: "NPC profile" })).not.toBeInTheDocument();
    expect(result.success).toBe(false); expect("review" in result).toBe(false);
  });
  it("malformed UTF8 replacement cannot be accepted even when replacement text fits the NPC schema", async () => {
    const input = new TextEncoder().encode(positive); input[positive.indexOf("visible")] = 0xff;
    const result = await createNpcJsonReview(input, "utf8-admission.json");
    if (result.success) render(<NpcJsonImportPreview review={result.review} />);
    expect(screen.queryByRole("region", { name: "NPC profile" })).not.toBeInTheDocument(); expect(result.success).toBe(false);
  });
  it("keeps the complete codec/review/hash/actual profile positive without writer IDs or format activation", async () => {
    const result = await createNpcJsonReview(new TextEncoder().encode(positive), "positive.json");
    expect(result.success).toBe(true); if (!result.success) throw Error("Valid original control refused");
    render(<NpcJsonImportPreview review={result.review} />); expect(screen.getByRole("region", { name: "NPC profile" })).toBeInTheDocument();
    expect(screen.getByText("Original visible narrative.")).toBeInTheDocument();
    expect(result.review.provenance.sourceSha256).toMatch(/^[a-f0-9]{64}$/); expect(Object.hasOwn(result.review.candidate, "id")).toBe(false);
  });
});
