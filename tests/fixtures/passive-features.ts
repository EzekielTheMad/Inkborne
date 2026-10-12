// Original synthetic feature records; never seeded, attached or granted.
export const passiveFeatureId = "11111111-1111-4111-8111-111111111111";
export const passiveFeatureOwner = "22222222-2222-4222-8222-222222222222";
export const passiveFeatureSystem = "33333333-3333-4333-8333-333333333333";
export const passiveFeatureData = { feature_type: "passive" as const, class: "workshop-scout", subclass: null, level: 3,
  description: "  Original lantern cadence: a workshop hand recognizes three quiet taps.\n" };
export const extendedFeatureData = {
  class: "Legacy workshop label / unverified", level: 5, description: "Original source description.", feature_type: "choice" as const,
  usages: Array.from({ length: 20 }, (_, index) => index + 1),
  additional: Array.from({ length: 20 }, (_, index) => index % 2 ? "Original cadence" : index),
  choices: [{ name: "Original echo", count: 1, options: ["original-first", "original-second"] }],
  weaponOptions: [{ name: "Glimmer tool", damage: { dice: "1d4", type: "radiant" }, description: "Original static tool." }],
  unknownLore: { orderedNotes: ["Second note", "First note"], retained: true },
};
export const extendedFeatureEffects = [
  { type: "narrative", text: "An original note stays first.", extraMetadata: { sourceOrder: 1 } },
  { type: "mechanical", stat: "strength", op: "add", value: 1, extraMetadata: { sourceOrder: 2 } },
];
export function passiveFeatureRow(version = 1, overrides: Record<string, unknown> = {}) {
  return { id: passiveFeatureId, system_id: passiveFeatureSystem, content_type: "feature", slug: "lantern-cadence-11111111", name: "Lantern Cadence",
    data: structuredClone(passiveFeatureData), effects: [], source: "homebrew", scope: "personal", owner_id: passiveFeatureOwner,
    version, created_at: "2026-10-12T00:00:00Z", is_retired: false, ...overrides };
}
export function passiveFeatureCreateForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: "Lantern Cadence", description: passiveFeatureData.description, class: "workshop-scout", subclass: "", level: "3" })) form.set(key, value);
  return form;
}
export function passiveFeatureEditForm(version = 1, name = "Lantern Cadence", description = passiveFeatureData.description) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ name, description, id: passiveFeatureId, expected_version: String(version) })) form.set(key, value);
  return form;
}
