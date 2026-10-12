import { describe, expect, it } from "vitest";
import { inspectRaceWalkingEditability, raceCoreAnnotation, raceWalkingEffect, RACE_CORE_ANNOTATION_KEY, RACE_WALKING_TAG } from "@/lib/homebrew/race-authoring";

const data = () => ({ speed: 40, speed_detail: { walk: 40, fly: 10, note: "Retain raw detail" }, [RACE_CORE_ANNOTATION_KEY]: raceCoreAnnotation(40) });
describe("race walking editing annotation", () => {
  it("finds one exact raw entry without moving or changing unrelated effects", () => {
    const effects = [{ type: "narrative", text: "Manual", extra: true }, raceWalkingEffect(40), { type: "mechanical", stat: "armor_class", op: "add", value: 1 }];
    const original = structuredClone(effects);
    expect(inspectRaceWalkingEditability(data(), effects)).toEqual({ editable: true, effectIndex: 1, speed: 40 });
    expect(effects).toEqual(original);
  });
  it("treats the annotation as editable owner JSON, not unforgeable provenance", () => {
    const deliberatelyAnnotated = { speed: 45, speed_detail: { walk: 45 }, [RACE_CORE_ANNOTATION_KEY]: raceCoreAnnotation(45) };
    expect(inspectRaceWalkingEditability(deliberatelyAnnotated, [raceWalkingEffect(45)])).toMatchObject({ editable: true });
  });
  it("does not infer legacy effect ownership from equal numeric values", () => {
    expect(inspectRaceWalkingEditability({ speed: 40, speed_detail: { walk: 40 } }, [{ type: "mechanical", stat: "movement_speed", op: "set", value: 40 }])).toEqual({ editable: false });
    expect(inspectRaceWalkingEditability(data(), [{ type: "mechanical", stat: "movement_speed", op: "set", value: 40 }])).toEqual({ editable: false });
  });
  it.each([
    { condition: { field: "x", op: "eq", value: true } }, { expr: "40" }, { extra: true },
    { type: "grant" }, { op: "add" }, { stat: "speed" }, { value: "40" }, { value: 40.5 }, { value: 0 }, { tag: "another-tag" },
  ])("rejects altered raw owned effect %j before parsing can strip extras", (change) => {
    expect(inspectRaceWalkingEditability(data(), [{ ...raceWalkingEffect(40), ...change }])).toEqual({ editable: false });
  });
  it("rejects missing/duplicate tags, competing target entries and inconsistent flat/detail values", () => {
    expect(inspectRaceWalkingEditability(data(), []).editable).toBe(false);
    expect(inspectRaceWalkingEditability(data(), [raceWalkingEffect(40), raceWalkingEffect(40)]).editable).toBe(false);
    expect(inspectRaceWalkingEditability(data(), [raceWalkingEffect(40), { type: "mechanical", stat: "movement_speed", op: "add", value: 5 }]).editable).toBe(false);
    expect(inspectRaceWalkingEditability(data(), [raceWalkingEffect(40), { type: "grant", stat: "movement_speed", value: "manual" }]).editable).toBe(false);
    expect(inspectRaceWalkingEditability({ ...data(), speed: 35 }, [raceWalkingEffect(40)]).editable).toBe(false);
    expect(inspectRaceWalkingEditability({ ...data(), speed_detail: { walk: 35 } }, [raceWalkingEffect(40)]).editable).toBe(false);
  });
  it.each([
    { contract_version: 2, walking_effect: raceWalkingEffect(40) },
    { ...raceCoreAnnotation(40), extra: true },
    { contract_version: 1, walking_effect: { ...raceWalkingEffect(40), condition: [] } },
    { contract_version: 1, walking_effect: { ...raceWalkingEffect(40), op: "formula", expr: "40" } },
  ])("rejects raw annotation drift %j", (annotation) => {
    expect(inspectRaceWalkingEditability({ ...data(), [RACE_CORE_ANNOTATION_KEY]: annotation }, [raceWalkingEffect(40)])).toEqual({ editable: false });
  });
  it("does not mistake a reserved tag on another effect type for an owned walking entry", () => {
    expect(inspectRaceWalkingEditability(data(), [{ type: "narrative", tag: RACE_WALKING_TAG, text: "Manual" }])).toEqual({ editable: false });
  });
});
