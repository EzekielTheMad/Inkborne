import { describe, expect, it } from "vitest";
import { findFiendContentUpdate, parseSubclassContentUpdateResponse, subclassContentUpdateFieldsSchema,
  subclassPreviewMatches } from "@/lib/builder/subclass-content-update";

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const account = id(1), character = id(2), occurrence = id(3), reference = id(4), content = id(5), system = id(6);
const tiers = [{ level: 1, spells: ["burning-hands", "command"] }, { level: 3, spells: ["blindness-deafness", "scorching-ray"] }];
const base = { id: content, system_id: system, content_type: "subclass", slug: "fiend", name: "Fiend", source: "srd", scope: "platform", owner_id: null,
  effects: [], data: { parent_class: "warlock", description: "Original description", levels: [{ level: 1, features: ["dark-ones-blessing"] }] } };
const saved = { ...base, version: 1, data: { ...base.data, spellcastingExtra: tiers } };
const target = { ...base, version: 2, data: { ...base.data, spellcastingExpanded: tiers } };
const refs = [{ id: reference, character_id: character, content_id: content, content_version: 1,
  context: { source: "subclass", class: "warlock" }, content_definitions: saved }];
const classes = [{ slug: "warlock", subclass: "fiend", occurrence_id: occurrence }];
const candidate = () => findFiendContentUpdate(character, classes, refs, [target])!;
const fields = () => ({ class_slug: "warlock" as const, occurrence_id: occurrence, subclass_ref_id: reference, content_id: content,
  expected_content_version: 1, target_content_version: 2, expected_action_revision: "7", preview_digest: "a".repeat(64) });
const preview = () => ({ contract_version: 1 as const, character_id: character, actor_id: account, fields: fields(), saved_name: "Fiend", target_name: "Fiend",
  retained: [{ kind: "ordinary_spell" as const, label: "Charm Person" }], removed: [{ kind: "spell_grant" as const, label: "Burning Hands" }],
  added: [{ kind: "expanded_spell" as const, label: "Burning Hands available as an ordinary choice" }], automatic_spells_learned: 0 as const });

describe("Fiend content-update display discovery", () => {
  it("offers only a newer same-identity extras-to-expanded correction without changing either snapshot", () => {
    const before = JSON.stringify([refs, target, classes]);
    expect(candidate()).toEqual({ occurrence_id: occurrence, subclass_ref_id: reference, content_id: content,
      expected_content_version: 1, target_content_version: 2, saved_name: "Fiend", target_name: "Fiend" });
    expect(JSON.stringify([refs, target, classes])).toBe(before); expect(Object.isFrozen(candidate())).toBe(true);
  });
  it.each([
    { ...target, id: id(9) }, { ...target, system_id: id(9) }, { ...target, source: "homebrew" },
    { ...target, scope: "personal" }, { ...target, owner_id: account }, { ...target, slug: "land" },
    { ...target, content_type: "class" }, { ...target, name: "Different Fiend" }, { ...target, version: 1 },
    { ...target, version: 0 }, { ...target, effects: [{ type: "mechanical", stat: "strength", op: "add", value: 1 }] },
    { ...target, data: { ...target.data, description: "Unreviewed prose change" } },
    { ...target, data: { ...target.data, parent_class: "wizard" } },
    { ...target, data: { ...target.data, spellcastingExtra: tiers } },
    { ...target, data: { ...target.data, spellcastingExpanded: [{ level: 1, spells: ["fireball"] }] } },
  ])("refuses a broader or mismatched catalog change %j", changed => {
    expect(findFiendContentUpdate(character, classes, refs, [changed])).toBeNull();
  });
  it("refuses missing/duplicate targets, ambiguous refs, foreign refs and unaccepted class identity", () => {
    expect(findFiendContentUpdate(character, classes, refs, [])).toBeNull();
    expect(findFiendContentUpdate(character, classes, refs, [target, target])).toBeNull();
    expect(findFiendContentUpdate(character, classes, [...refs, refs[0]], [target])).toBeNull();
    expect(findFiendContentUpdate(id(9), classes, refs, [target])).toBeNull();
    expect(findFiendContentUpdate(character, [{ slug: "warlock", subclass: "fiend" }], refs, [target])).toBeNull();
    expect(findFiendContentUpdate(character, [...classes, classes[0]], refs, [target])).toBeNull();
    expect(findFiendContentUpdate(character, classes, [{ ...refs[0], content_version: 2 }], [target])).toBeNull();
  });
});

describe("complete native content-update review DTO", () => {
  it("accepts named consequences and binds actor, character, source, target and revision", () => {
    expect(parseSubclassContentUpdateResponse({ status: "available", preview: preview() })).toEqual({ status: "available", preview: preview() });
    expect(subclassPreviewMatches(preview(), candidate(), account, character, "7")).toBe(true);
    expect(subclassPreviewMatches(preview(), candidate(), id(9), character, "7")).toBe(false);
    expect(subclassPreviewMatches(preview(), candidate(), account, id(9), "7")).toBe(false);
    expect(subclassPreviewMatches(preview(), candidate(), account, character, "8")).toBe(false);
    expect(subclassPreviewMatches({ ...preview(), fields: { ...fields(), occurrence_id: id(9) } }, candidate(), account, character, "7")).toBe(false);
    expect(subclassPreviewMatches({ ...preview(), fields: { ...fields(), target_content_version: 3 } }, candidate(), account, character, "7")).toBe(false);
  });
  it.each([
    { ...preview(), token: "extra" }, { ...preview(), automatic_spells_learned: 1 },
    { ...preview(), fields: { ...fields(), target_content_version: 1 } },
    { ...preview(), fields: { ...fields(), preview_digest: "not-a-digest" } },
    { ...preview(), fields: { ...fields(), expected_action_revision: "-1" } },
    { ...preview(), added: [{ kind: "arbitrary", label: "Unknown consequence" }] },
    { ...preview(), removed: [{ kind: "spell_grant", label: " " }] },
    { ...preview(), retained: [{ kind: "feature", label: "F".repeat(501) }] },
  ])("refuses malformed or expanded review data %j", changed => {
    expect(parseSubclassContentUpdateResponse({ status: "available", preview: changed })).toBeNull();
  });
  it("accepts finite unavailable reasons and rejects unknown statuses/request fields", () => {
    for (const reason of ["no_update", "unsupported", "conflict", "unavailable"]) {
      expect(parseSubclassContentUpdateResponse({ status: "unavailable", reason })).toEqual({ status: "unavailable", reason });
    }
    expect(parseSubclassContentUpdateResponse({ status: "unavailable", reason: "unknown" })).toBeNull();
    expect(parseSubclassContentUpdateResponse({ status: "available", preview: preview(), extra: true })).toBeNull();
    expect(subclassContentUpdateFieldsSchema.safeParse({ ...fields(), client_choices: {} }).success).toBe(false);
  });
});
