import { webcrypto } from "node:crypto";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "@/tests/fixtures/npc-json/original-npc.json";
import { createNpcJsonReview } from "@/lib/import/npc-json/review";
import { NpcJsonImportPreview } from "@/components/library/npc-json-import-preview";
beforeEach(() => vi.stubGlobal("crypto", webcrypto)); afterEach(() => vi.unstubAllGlobals());
async function review(raw: unknown = fixture) {
  const result = await createNpcJsonReview(new TextEncoder().encode(JSON.stringify(raw)), "original.json");
  if (!result.success) throw Error("Expected validated fixture"); return result.review;
}
describe("actual read-only NPC profile local prototype, no route or commit", () => {
  it("renders original escaped narrative, ordered duplicates and external source evidence without actions", async () => {
    const accepted = await review(); const { container } = render(<NpcJsonImportPreview review={accepted} />);
    expect(screen.getByRole("region", { name: "NPC profile" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Personality traits" })).getAllByText("Counts original footsteps.")).toHaveLength(2);
    expect(screen.getByText(fixture.data.description)).toBeInTheDocument(); expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("original.json")).toBeInTheDocument(); expect(screen.getByText(accepted.provenance.sourceSha256)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Nothing was imported or saved");
    expect(screen.queryByRole("button")).not.toBeInTheDocument(); expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Included empty list")).toBeInTheDocument();
  });
  it.each([{ schema_version: 1 }, { schema_version: 1, personality: {}, relationships: [] }])("exposes raw group presence without inventing story fields %j", async data => {
    render(<NpcJsonImportPreview review={await review({ ...fixture, data })} />);
    expect(screen.queryByRole("region", { name: "Description" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Template relationship ideas" })).not.toBeInTheDocument();
    if ("personality" in data) expect(screen.getByText("Included empty object")).toBeInTheDocument();
    else expect(screen.getAllByText("Not supplied")).toHaveLength(6);
  });
  it("labels prior source explicitly when a replacement is rejected, never claims current imported success", async () => {
    render(<NpcJsonImportPreview review={await review()} retained />);
    expect(screen.getByRole("status")).toHaveTextContent("Previous local preview retained; the new file was rejected");
    expect(screen.getByText("original.json")).toBeInTheDocument(); expect(screen.getByRole("status")).toHaveTextContent("Format choice remains provisional");
  });
});
