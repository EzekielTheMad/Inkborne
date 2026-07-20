// @vitest-environment node

import { describe, expect, it } from "vitest";

import { mapMpmbSpell } from "@/lib/import/mpmb/map/spells";
import {
  createMpmbSourceIndex,
  mapMpmbSources,
} from "@/lib/import/mpmb/map/sources";
import type { MpmbParsedEntry, MpmbStaticObject } from "@/lib/import/mpmb/types";
import {
  spellDataSchema,
  type SpellData,
} from "@/lib/schemas/content-types/spell";

const entry = (
  key: string,
  data: MpmbStaticObject,
  registry: MpmbParsedEntry["registry"] = "SpellsList",
): MpmbParsedEntry => ({
  registry,
  key,
  data,
  location: { line: 5, column: 1 },
});

const sourceEntry = entry(
  "IBX",
  { name: "Inkborne Examples", abbreviation: "IBX" },
  "SourceList",
);
const context = {
  sourcesByKey: createMpmbSourceIndex(mapMpmbSources([sourceEntry])),
};

function validSpell(overrides: MpmbStaticObject = {}): MpmbParsedEntry {
  return entry("ember ward", {
    name: "Ember Ward",
    source: ["IBX", 3],
    level: 1,
    school: "Abjur",
    time: "1 a",
    range: "30 feet",
    components: "V, S, M",
    compMaterial: "a harmless ember",
    duration: "Conc. 1 minute",
    ritual: false,
    description: {
      type: "mpmb-helper",
      name: "desc",
      arguments: [["First line", "Second line"]],
    },
    classes: ["Wizard", "Artificer"],
    ...overrides,
  });
}

function spellData(mapped: ReturnType<typeof mapMpmbSpell>): SpellData {
  if (!mapped.candidate || mapped.candidate.content_type !== "spell") {
    throw new Error("Expected a mapped spell candidate");
  }
  return mapped.candidate.data;
}

describe("MPMB spell mapping", () => {
  it("maps aliases and static fields into a schema-valid spell candidate", () => {
    const mapped = mapMpmbSpell(validSpell(), context);

    expect(mapped.status).toBe("valid");
    expect(mapped.sourceRefs).toEqual([{ book: "IBX", page: 3 }]);
    expect(mapped.candidate).toMatchObject({
      content_type: "spell",
      slug: "ember-ward",
      name: "Ember Ward",
      data: {
        level: 1,
        school: "abjuration",
        casting_time: "1 action",
        components: ["V", "S", "M"],
        material: "a harmless ember",
        concentration: true,
        description: "First line\nSecond line",
        classes: ["wizard", "artificer"],
        damage: null,
      },
      effects: [],
    });
    expect(spellDataSchema.safeParse(mapped.candidate?.data).success).toBe(true);
    expect("source_refs" in (mapped.candidate?.data ?? {})).toBe(false);
  });

  it("blocks an M component without material text", () => {
    const mapped = mapMpmbSpell(
      validSpell({ compMaterial: undefined as never }),
      context,
    );

    expect(mapped.status).toBe("needs_info");
    expect(mapped.candidate).not.toBeNull();
    expect(mapped.issues).toContainEqual(
      expect.objectContaining({
        code: "spell.material.required",
        severity: "blocking",
      }),
    );
  });

  it("does not infer damage or cantrip scaling from prose", () => {
    const mapped = mapMpmbSpell(
      validSpell({
        level: 0,
        components: "V, S",
        compMaterial: undefined as never,
        description: "The target takes 1d8 fire damage.",
        descriptionCantripDie: "`CD`d8",
        damageText: "1d8 fire",
      }),
      context,
    );

    expect(spellData(mapped).damage).toBeNull();
    expect(spellData(mapped).descriptionCantripDie).toBeUndefined();
    expect(mapped.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "spell.cantrip_die.not_automated",
          severity: "warning",
        }),
        expect.objectContaining({ code: "unmapped.damageText" }),
      ]),
    );
  });

  it("requires review when a save outcome cannot be inferred", () => {
    const mapped = mapMpmbSpell(validSpell({ save: "Dex" }), context);

    expect(mapped.status).toBe("needs_info");
    expect(spellData(mapped).dc).toBeNull();
    expect(mapped.issues).toContainEqual(
      expect.objectContaining({ code: "spell.save.success_unknown" }),
    );
  });

  it("keeps unknown platform source codes as provenance warnings", () => {
    const mapped = mapMpmbSpell(
      validSpell({ source: ["PHB", 211] }),
      context,
    );

    expect(mapped.status).toBe("valid");
    expect(mapped.sourceRefs).toEqual([{ book: "PHB", page: 211 }]);
    expect(mapped.issues).toContainEqual(
      expect.objectContaining({
        code: "source.unknown.PHB",
        severity: "warning",
      }),
    );
  });

  it("marks entries without a trustworthy identity as unsupported", () => {
    const mapped = mapMpmbSpell(validSpell({ name: "" }), context);
    expect(mapped.status).toBe("unsupported");
    expect(mapped.candidate).toBeNull();
  });
});
