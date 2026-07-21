// @vitest-environment node

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { mapParsedMpmbSource } from "@/lib/import/mpmb/map";
import { parseMpmbSource } from "@/lib/import/mpmb/parser";
import { featDataSchema } from "@/lib/schemas/content-types/feat";
import { spellDataSchema } from "@/lib/schemas/content-types/spell";
import { effectSchema } from "@/lib/schemas/effects";

const mixedSource = `
  var iFileName = "Mixed mapper fixture.js";
  RequiredSheetVersion("13.1.14");
  SourceList.IBX = {
    name: "Inkborne Examples",
    abbreviation: "IBX"
  };
  SpellsList["ember ward"] = {
    name: "Ember Ward",
    source: ["IBX", 3],
    level: 1,
    school: "Abjur",
    time: "1 a",
    range: "30 feet",
    components: "V, S",
    duration: "1 minute",
    ritual: false,
    description: "A harmless synthetic ward.",
    classes: ["Wizard"]
  };
  FeatsList["cross-trained"] = {
    name: "Cross-Trained",
    source: ["IBX", 9],
    description: desc(["A synthetic feat."]),
    prerequisite: "Strength 13 or Dexterity 13"
  };
`;

describe("MPMB parser-to-mapper integration", () => {
  it("preserves file order and summarizes valid and review-required items", () => {
    const parsed = parseMpmbSource(mixedSource);
    const mapped = mapParsedMpmbSource(parsed);

    expect(mapped.items.map((item) => item.sourceKey)).toEqual([
      "ember ward",
      "cross-trained",
    ]);
    expect(mapped.items.map((item) => item.status)).toEqual([
      "valid",
      "needs_info",
    ]);
    expect(mapped.summary).toMatchObject({
      valid: 1,
      needsInfo: 1,
      unsupported: 0,
      warnings: 0,
      blockingIssues: 1,
    });
  });

  it("is deterministic and does not mutate parser output", () => {
    const parsed = parseMpmbSource(mixedSource);
    const before = structuredClone(parsed);

    const first = mapParsedMpmbSource(parsed);
    const second = mapParsedMpmbSource(parsed);

    expect(first).toEqual(second);
    expect(parsed).toEqual(before);
  });

  it("emits only schema-valid candidates and effects for valid items", () => {
    const mapped = mapParsedMpmbSource(parseMpmbSource(mixedSource));

    for (const item of mapped.items.filter((entry) => entry.status === "valid")) {
      expect(item.candidate).not.toBeNull();
      if (!item.candidate) continue;

      const schema = item.candidate.content_type === "spell"
        ? spellDataSchema
        : featDataSchema;
      expect(schema.safeParse(item.candidate.data).success).toBe(true);
      for (const effect of item.candidate.effects) {
        expect(effectSchema.safeParse(effect).success).toBe(true);
      }
    }
  });
});

describe("MPMB mapper architecture", () => {
  it("remains a pure library without UI, database, network, or code execution dependencies", () => {
    const mapDirectory = join(process.cwd(), "lib", "import", "mpmb", "map");
    const productionSource = readdirSync(mapDirectory)
      .filter((name) => name.endsWith(".ts"))
      .map((name) => readFileSync(join(mapDirectory, name), "utf8"))
      .join("\n");

    const forbidden = [
      /from\s+["'](?:react|next(?:\/[^"']*)?)["']/,
      /from\s+["'][^"']*supabase[^"']*["']/,
      /from\s+["']node:(?:fs|http|https|net|tls|vm|child_process)["']/,
      /\b(?:eval|fetch)\s*\(/,
      /\bnew\s+Function\s*\(/,
      /\bimport\s*\(/,
    ];

    for (const pattern of forbidden) {
      expect(productionSource).not.toMatch(pattern);
    }
  });
});
