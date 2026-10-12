import { describe, expect, it } from "vitest";
import { mapHomebrewRaceFormData } from "@/lib/homebrew/race-form";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ name: "  Aster Kin  ", size: "Medium", speed: "40", age_description: " Original age notes. ",
    alignment_description: " Original alignment notes. ", size_description: " Original size notes. ", language_description: " Original language notes. ", ...overrides })) data.set(key, value);
  return data;
}
describe("core race mapper", () => {
  it("maps only finite metadata and walking controls without invented score/link mechanics", () => {
    expect(mapHomebrewRaceFormData(form(), true)).toEqual({ success: true, data: { name: "Aster Kin", walkingSpeed: 40,
      metadata: { size: "Medium", age_description: "Original age notes.", alignment_description: "Original alignment notes.", size_description: "Original size notes.", language_description: "Original language notes." } } });
  });
  it.each(["", "0", "-1", "40.5", "1e2", "Infinity", "NaN", "0x28", "9007199254740992"])("rejects invalid editable speed %s", (value) => {
    expect(mapHomebrewRaceFormData(form({ speed: value }), true)).toMatchObject({ success: false, fieldErrors: { speed: [expect.any(String)] } });
  });
  it("ignores speed and forged eligibility when the server permits only metadata", () => {
    expect(mapHomebrewRaceFormData(form({ speed: "forged invalid speed", walkingEditable: "true" }), false)).toMatchObject({ success: true, data: { name: "Aster Kin" } });
    const result = mapHomebrewRaceFormData(form(), false);
    if (!result.success) throw new Error("Expected valid metadata");
    expect(result.data).not.toHaveProperty("walkingSpeed");
  });
  it("bounds every description and uses actual size taxonomy", () => {
    expect(mapHomebrewRaceFormData(form({ name: "x".repeat(101), size: "Colossal", age_description: "x".repeat(20_001), alignment_description: "x".repeat(20_001),
      size_description: "x".repeat(20_001), language_description: "x".repeat(20_001) }), true)).toMatchObject({ success: false, fieldErrors: {
      name: [expect.any(String)], size: [expect.any(String)], age_description: [expect.any(String)], alignment_description: [expect.any(String)], size_description: [expect.any(String)], language_description: [expect.any(String)],
    } });
  });
  it("ignores forged envelopes, effects, annotation, scores, links and raw extensions", () => {
    expect(mapHomebrewRaceFormData(form({ owner_id: "attacker", system_id: "attacker", scope: "shared", source: "srd", content_type: "subrace", version: "99",
      effects: "[]", _inkborne_race_core: "{}", scores: "[9,9,9,9,9,9]", traits: "[]", subraces: "[]", speed_detail: "{}", data: "{}" }), true))
      .toEqual(mapHomebrewRaceFormData(form(), true));
  });
});
