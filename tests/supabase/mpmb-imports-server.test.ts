import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClientMock, createClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: createAdminClientMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import {
  commitMpmbImport,
  confirmOwnedMpmbImportPreview,
  getOwnedMpmbImportConflictItem,
  getOwnedMpmbImportPreview,
  getOwnedMpmbImportRepairItem,
  getOwnedMpmbImportReview,
  repairMpmbImportFeatItem,
  repairMpmbImportSpellItem,
  resolveMpmbImportItemConflict,
  sanitizeMpmbImportFilename,
  stageMpmbImportFile,
} from "@/lib/supabase/mpmb-imports-server";
import { featDataSchema } from "@/lib/schemas/content-types/feat";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SYSTEM_ID = "22222222-2222-4222-8222-222222222222";
const IMPORT_ID = "33333333-3333-4333-8333-333333333333";
const ITEM_ID = "44444444-4444-4444-8444-444444444444";
const TARGET_ID = "55555555-5555-4555-8555-555555555555";
const SHARED_TARGET_ID = "66666666-6666-4666-8666-666666666666";

const validSource = `
  // RAW_SENTINEL_DO_NOT_PERSIST
  RequiredSheetVersion("13.1.14");
  SourceList.IBX = { name: "Inkborne Examples", abbreviation: "IBX" };
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
`;

interface DatabaseResponse {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

function fakeFile(name: string, content: string | Uint8Array, reportedSize?: number) {
  const bytes = typeof content === "string"
    ? new TextEncoder().encode(content)
    : content;
  return {
    name,
    size: reportedSize ?? bytes.byteLength,
    async arrayBuffer() {
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
    },
  };
}

function makeClient(
  authenticated = true,
  systemResponse: DatabaseResponse = { data: { id: SYSTEM_ID }, error: null },
  rpcResponse: DatabaseResponse = { data: IMPORT_ID, error: null },
) {
  const filters: Array<[string, unknown]> = [];
  const rpc = vi.fn().mockResolvedValue(rpcResponse);
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      filters.push([column, value]);
      return builder;
    }),
    maybeSingle: vi.fn().mockResolvedValue(systemResponse),
  };
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue(authenticated
        ? { data: { user: { id: USER_ID } }, error: null }
        : { data: { user: null }, error: { message: "missing" } }),
    },
    from: vi.fn(() => builder),
    rpc,
  };
  return { client, filters, rpc };
}

beforeEach(() => {
  createAdminClientMock.mockReset();
  createClientMock.mockReset();
  vi.unstubAllEnvs();
});

describe("sanitizeMpmbImportFilename", () => {
  it("keeps only a normalized basename without control characters", () => {
    expect(sanitizeMpmbImportFilename(" C:\\unsafe\\my\u0000-file.MPMB ")).toBe(
      "my-file.MPMB",
    );
    expect(sanitizeMpmbImportFilename("../..")) .toBe("import.mpmb");
  });
});

describe("stageMpmbImportFile", () => {
  it("requires authentication and a private-use attestation", async () => {
    const anonymous = makeClient(false);
    createClientMock.mockResolvedValue(anonymous.client);
    await expect(stageMpmbImportFile(fakeFile("test.mpmb", validSource), true))
      .resolves.toEqual({
        status: "error",
        message: "Sign in before importing content.",
      });
    expect(anonymous.rpc).not.toHaveBeenCalled();

    const authenticated = makeClient();
    createClientMock.mockResolvedValue(authenticated.client);
    await expect(stageMpmbImportFile(fakeFile("test.mpmb", validSource), false))
      .resolves.toEqual({
        status: "error",
        message: "Confirm that you have the right to use this file privately.",
      });
    expect(authenticated.rpc).not.toHaveBeenCalled();
  });

  it("rejects unsupported extensions, empty/oversize files, and invalid UTF-8", async () => {
    const db = makeClient();
    createClientMock.mockResolvedValue(db.client);

    await expect(stageMpmbImportFile(fakeFile("notes.txt", validSource), true))
      .resolves.toMatchObject({ status: "error", message: "Choose a .js or .mpmb file." });
    await expect(stageMpmbImportFile(fakeFile("empty.mpmb", ""), true))
      .resolves.toMatchObject({ status: "error", message: expect.stringContaining("2 MiB") });
    await expect(stageMpmbImportFile(fakeFile("large.mpmb", "x", 2_097_153), true))
      .resolves.toMatchObject({ status: "error", message: expect.stringContaining("2 MiB") });
    await expect(stageMpmbImportFile(
      fakeFile("invalid.mpmb", new Uint8Array([0xc3, 0x28])),
      true,
    )).resolves.toMatchObject({
      status: "error",
      message: "The file must contain valid UTF-8 text.",
    });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("reports fail-closed parser errors without staging partial data", async () => {
    const db = makeClient();
    createClientMock.mockResolvedValue(db.client);

    const result = await stageMpmbImportFile(
      fakeFile("unsafe.mpmb", `SpellsList.x = {}; doSomething();`),
      true,
    );
    expect(result).toMatchObject({
      status: "error",
      message: expect.stringContaining("UNSUPPORTED_STATEMENT"),
    });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("hashes, parses, maps, and stages only normalized review data", async () => {
    const db = makeClient();
    createClientMock.mockResolvedValue(db.client);
    const file = fakeFile("C:\\uploads\\Tést Fixture.MPMB", validSource);

    await expect(stageMpmbImportFile(file, true)).resolves.toEqual({
      status: "success",
      importId: IMPORT_ID,
    });

    expect(db.filters).toEqual([
      ["slug", "dnd-5e-2014"],
      ["status", "published"],
    ]);
    expect(db.rpc).toHaveBeenCalledTimes(1);
    const [rpcName, payload] = db.rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(rpcName).toBe("stage_mpmb_import");
    expect(payload).toMatchObject({
      target_system_id: SYSTEM_ID,
      safe_original_filename: "Tést Fixture.MPMB",
      source_sha256: createHash("sha256").update(new TextEncoder().encode(validSource)).digest("hex"),
      source_bytes: new TextEncoder().encode(validSource).byteLength,
      parser_version: "1.0.0",
      mapper_version: "1.1.0",
      required_sheet_version: "13.1.14",
      rights_attestation_version: "private_use_v1",
      mapping_summary: expect.objectContaining({ valid: 1, needsInfo: 0 }),
      mapped_items: [expect.objectContaining({
        sourceKey: "ember ward",
        status: "valid",
        candidate: expect.objectContaining({ content_type: "spell", name: "Ember Ward" }),
      })],
    });
    expect(Object.keys(payload)).not.toEqual(
      expect.arrayContaining(["raw_source", "source_text", "source_content", "file_bytes"]),
    );
    expect(JSON.stringify(payload)).not.toContain("RAW_SENTINEL_DO_NOT_PERSIST");
  });

  it("does not stage when the system is unavailable or the RPC fails", async () => {
    const unavailable = makeClient(true, { data: null, error: null });
    createClientMock.mockResolvedValue(unavailable.client);
    await expect(stageMpmbImportFile(fakeFile("test.mpmb", validSource), true))
      .resolves.toMatchObject({ status: "error", message: expect.stringContaining("unavailable") });
    expect(unavailable.rpc).not.toHaveBeenCalled();

    const failed = makeClient(
      true,
      { data: { id: SYSTEM_ID }, error: null },
      { data: null, error: { code: "42501" } },
    );
    createClientMock.mockResolvedValue(failed.client);
    await expect(stageMpmbImportFile(fakeFile("test.mpmb", validSource), true))
      .resolves.toEqual({
        status: "error",
        message: "The import could not be saved. Please try again.",
      });
  });
});

function queryBuilder(response: DatabaseResponse) {
  const filters: Array<[string, unknown]> = [];
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      filters.push([column, value]);
      return builder;
    }),
    maybeSingle: vi.fn().mockResolvedValue(response),
  };
  return { builder, filters };
}

function authenticatedClient(overrides?: {
  from?: ReturnType<typeof vi.fn>;
  rpc?: ReturnType<typeof vi.fn>;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: USER_ID } },
        error: null,
      }),
    },
    from: overrides?.from ?? vi.fn(),
    rpc: overrides?.rpc ?? vi.fn(),
  };
}

describe("guided spell repair", () => {
  it("loads only an owned open candidate with a supported blocker", async () => {
    const importQuery = queryBuilder({
      data: { id: IMPORT_ID, revision: 4, status: "review" },
      error: null,
    });
    const itemQuery = queryBuilder({
      data: {
        id: ITEM_ID,
        import_id: IMPORT_ID,
        content_type: "spell",
        mapping_status: "needs_info",
        candidate_name: "Ash Veil",
        candidate_data: {
          level: 1,
          school: "abjuration",
          casting_time: "1 action",
          range: "Self",
          components: ["V", "S", "M"],
          duration: "1 minute",
          concentration: false,
          ritual: false,
          description: "A synthetic spell.",
          damage: null,
          heal_at_slot_level: null,
          dc: null,
          area_of_effect: null,
          classes: [],
          subclasses: [],
          dependencies: [],
        },
        committed_content_id: null,
        diagnostics: [
          {
            code: "spell.material.required",
            severity: "blocking",
            path: "compMaterial",
            message: "Material text is required.",
          },
          {
            code: "spell.damage.review",
            severity: "blocking",
            path: "damage",
            message: "Review damage.",
          },
        ],
        user_edited_fields: [],
      },
      error: null,
    });
    const from = vi.fn()
      .mockReturnValueOnce(importQuery.builder)
      .mockReturnValueOnce(itemQuery.builder);
    createClientMock.mockResolvedValue(authenticatedClient({ from }));

    await expect(
      getOwnedMpmbImportRepairItem(IMPORT_ID, ITEM_ID),
    ).resolves.toMatchObject({
      contentType: "spell",
      importId: IMPORT_ID,
      itemId: ITEM_ID,
      revision: 4,
      candidateName: "Ash Veil",
      repairFields: {
        material: true,
        dc: false,
        concentration: false,
        ritual: false,
      },
      otherBlockingIssues: 1,
    });
    expect(importQuery.filters).toEqual([
      ["id", IMPORT_ID],
      ["owner_id", USER_ID],
    ]);
    expect(itemQuery.filters).toEqual([
      ["id", ITEM_ID],
      ["import_id", IMPORT_ID],
    ]);
  });

  it("sends only the validated narrow repair patch to the RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    createClientMock.mockResolvedValue(authenticatedClient({ rpc }));

    await expect(repairMpmbImportSpellItem(
      IMPORT_ID,
      ITEM_ID,
      4,
      {
        material: "a silver thread",
        dc: { type: "wisdom", success: "half" },
        concentration: true,
        ritual: false,
      },
    )).resolves.toEqual({ status: "success", importId: IMPORT_ID });
    expect(rpc).toHaveBeenCalledWith("repair_mpmb_import_spell_item", {
      target_import_id: IMPORT_ID,
      target_item_id: ITEM_ID,
      expected_revision: 4,
      repair_patch: {
        material: "a silver thread",
        dc: { type: "wisdom", success: "half" },
        concentration: true,
        ritual: false,
      },
    });
  });

  it("rejects broad patches and maps stale revisions without leaking database errors", async () => {
    const rpc = vi.fn();
    createClientMock.mockResolvedValue(authenticatedClient({ rpc }));

    await expect(repairMpmbImportSpellItem(
      IMPORT_ID,
      ITEM_ID,
      4,
      { material: "" },
    )).resolves.toEqual({
      status: "error",
      message: "The spell repair is invalid.",
    });
    expect(rpc).not.toHaveBeenCalled();

    rpc.mockResolvedValue({
      data: null,
      error: { code: "40001", message: "internal detail" },
    });
    await expect(repairMpmbImportSpellItem(
      IMPORT_ID,
      ITEM_ID,
      3,
      { material: "a silver thread" },
    )).resolves.toEqual({
      status: "conflict",
      message: "This import changed in another session. Reload and try again.",
    });

    rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "Import review changed in another session" },
    });
    await expect(repairMpmbImportSpellItem(
      IMPORT_ID,
      ITEM_ID,
      3,
      { material: "a silver thread" },
    )).resolves.toEqual({
      status: "conflict",
      message: "This import changed in another session. Reload and try again.",
    });
  });
});

function orderedQueryBuilder(response: DatabaseResponse) {
  const filters: Array<[string, unknown]> = [];
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      filters.push([column, value]);
      return builder;
    }),
    is: vi.fn((column: string, value: unknown) => {
      filters.push([column, value]);
      return builder;
    }),
    order: vi.fn().mockResolvedValue(response),
    maybeSingle: vi.fn().mockResolvedValue(response),
  };
  return { builder, filters };
}

const PREVIEW_SCHEMA = {
  ability_scores: [
    { slug: "strength", name: "Strength", abbr: "STR" },
    { slug: "dexterity", name: "Dexterity", abbr: "DEX" },
    { slug: "constitution", name: "Constitution", abbr: "CON" },
    { slug: "intelligence", name: "Intelligence", abbr: "INT" },
    { slug: "wisdom", name: "Wisdom", abbr: "WIS" },
    { slug: "charisma", name: "Charisma", abbr: "CHA" },
  ],
  proficiency_levels: [{ slug: "proficient", name: "Proficient", multiplier: 1 }],
  derived_stats: [{ slug: "armor_class", name: "Armor Class", formula: "10 + mod(dexterity)" }],
  skills: [],
  resources: [],
  content_types: [{ slug: "feat", name: "Feat" }],
  currencies: [],
  creation_steps: [{ step: 1, type: "details", label: "Details" }],
  sheet_sections: [{ slug: "header", label: "Header" }],
};

const PREVIEW_FEAT_DATA = featDataSchema.parse({
  description: "RAW_PREVIEW_RULES_SENTINEL",
  prerequisites: [],
  speed: { walk: 5 },
  vision: [],
  dmgres: [],
  skills: [],
  weaponProfs: [],
  armorProfs: [],
  toolProfs: [],
  languageProfs: [],
  spellcastingBonus: [],
  extraLimitedFeatures: [],
  calcChanges: [],
  addMod: [],
  source_refs: [],
});

describe("guided feat repair", () => {
  it("loads a schema-valid blocked feat without exposing arbitrary candidate fields", async () => {
    const importQuery = queryBuilder({
      data: { id: IMPORT_ID, revision: 7, status: "review" },
      error: null,
    });
    const itemQuery = queryBuilder({
      data: {
        id: ITEM_ID,
        import_id: IMPORT_ID,
        content_type: "feat",
        mapping_status: "needs_info",
        candidate_name: "Steadfast Adept",
        candidate_data: PREVIEW_FEAT_DATA,
        candidate_effects: [],
        committed_content_id: null,
        diagnostics: [
          {
            code: "feat.prerequisite.compound",
            severity: "blocking",
            path: "prerequisite",
            message: "Choose one supported prerequisite.",
          },
          {
            code: "feat.action.invalid",
            severity: "blocking",
            path: "action",
            message: "Choose a supported action.",
          },
          {
            code: "feat.other.review",
            severity: "blocking",
            path: "other",
            message: "Review another field.",
          },
        ],
        user_edited_fields: [],
      },
      error: null,
    });
    const from = vi.fn()
      .mockReturnValueOnce(importQuery.builder)
      .mockReturnValueOnce(itemQuery.builder);
    createClientMock.mockResolvedValue(authenticatedClient({ from }));

    const item = await getOwnedMpmbImportRepairItem(IMPORT_ID, ITEM_ID);
    expect(item).toMatchObject({
      contentType: "feat",
      revision: 7,
      repairFields: {
        prerequisites: true,
        action: true,
        recovery: false,
        spellcastingAbility: false,
      },
      otherBlockingIssues: 1,
    });
    expect(JSON.stringify(item)).not.toContain("candidate_effects");
  });

  it("sends only a strict canonical feat patch to the RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    createClientMock.mockResolvedValue(authenticatedClient({ rpc }));

    await expect(repairMpmbImportFeatItem(
      IMPORT_ID,
      ITEM_ID,
      7,
      {
        prerequisites: [{ stat: "dexterity", op: "gte", value: 13 }],
        action: "reaction",
        recovery: null,
        spellcastingAbility: null,
      },
    )).resolves.toEqual({ status: "success", importId: IMPORT_ID });
    expect(rpc).toHaveBeenCalledWith("repair_mpmb_import_feat_item", {
      target_import_id: IMPORT_ID,
      target_item_id: ITEM_ID,
      expected_revision: 7,
      repair_patch: {
        prerequisites: [{ stat: "dexterity", op: "gte", value: 13 }],
        action: "reaction",
        recovery: null,
        spellcastingAbility: null,
      },
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("candidate_data");
  });

  it("rejects empty, broad, and out-of-range feat repairs before the RPC", async () => {
    const rpc = vi.fn();
    createClientMock.mockResolvedValue(authenticatedClient({ rpc }));

    for (const patch of [
      {},
      { diagnostics: ["feat.action.invalid"] },
      { prerequisites: [{ stat: "wisdom", op: "gte", value: 31 }] },
    ]) {
      await expect(repairMpmbImportFeatItem(
        IMPORT_ID,
        ITEM_ID,
        7,
        patch as never,
      )).resolves.toEqual({
        status: "error",
        message: "The feat repair is invalid.",
      });
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});

function previewReviewClient({
  previewRevision = null,
  effects = [{ type: "mechanical", stat: "armor_class", op: "add", value: 1 }],
}: {
  previewRevision?: number | null;
  effects?: unknown[];
} = {}) {
  const importQuery = orderedQueryBuilder({
    data: {
      id: IMPORT_ID,
      original_filename: "preview.mpmb",
      owner_id: USER_ID,
      system_id: SYSTEM_ID,
      status: "review",
      revision: 4,
      preview_validated_revision: previewRevision,
    },
    error: null,
  });
  const systemQuery = orderedQueryBuilder({
    data: { schema_definition: PREVIEW_SCHEMA },
    error: null,
  });
  const itemQuery = orderedQueryBuilder({
    data: [{
      id: ITEM_ID,
      ordinal: 0,
      source_key: "steadfast adept",
      content_type: "feat",
      candidate_name: "Steadfast Adept",
      candidate_slug: "steadfast-adept",
      candidate_data: PREVIEW_FEAT_DATA,
      candidate_effects: effects,
    }],
    error: null,
  });
  const from = vi.fn()
    .mockReturnValueOnce(importQuery.builder)
    .mockReturnValueOnce(systemQuery.builder)
    .mockReturnValueOnce(itemQuery.builder);
  return {
    client: authenticatedClient({ from }),
    importQuery,
    itemQuery,
  };
}

describe("MPMB import calculation preview", () => {
  it("loads owner-only candidates but returns only sanitized calculation output", async () => {
    const db = previewReviewClient();
    createClientMock.mockResolvedValue(db.client);

    const preview = await getOwnedMpmbImportPreview(IMPORT_ID);

    expect(db.importQuery.filters).toEqual([
      ["id", IMPORT_ID],
      ["owner_id", USER_ID],
    ]);
    expect(db.itemQuery.filters).toContainEqual(["import_id", IMPORT_ID]);
    expect(preview).toMatchObject({
      id: IMPORT_ID,
      revision: 4,
      previewValidated: false,
      calculation: {
        passed: true,
        items: [{
          id: ITEM_ID,
          contentType: "feat",
          status: "passed",
        }],
      },
    });
    const serialized = JSON.stringify(preview);
    expect(serialized).not.toContain("candidate_data");
    expect(serialized).not.toContain("candidate_effects");
  });

  it("reports a current validation stamp only for the same revision", async () => {
    const db = previewReviewClient({ previewRevision: 4 });
    createClientMock.mockResolvedValue(db.client);

    await expect(getOwnedMpmbImportPreview(IMPORT_ID)).resolves.toMatchObject({
      previewValidated: true,
    });
  });

  it("recomputes before using the service-only stamp RPC", async () => {
    const db = previewReviewClient();
    const adminRpc = vi.fn().mockResolvedValue({ data: 4, error: null });
    createClientMock.mockResolvedValue(db.client);
    createAdminClientMock.mockReturnValue({ rpc: adminRpc });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-test-key");

    await expect(confirmOwnedMpmbImportPreview(IMPORT_ID, 4)).resolves.toEqual({
      status: "success",
      importId: IMPORT_ID,
    });
    expect(adminRpc).toHaveBeenCalledWith("record_mpmb_import_preview", {
      target_import_id: IMPORT_ID,
      validated_owner_id: USER_ID,
      expected_revision: 4,
    });
  });

  it("refuses stale or failed previews before the stamp RPC", async () => {
    const stale = previewReviewClient();
    createClientMock.mockResolvedValue(stale.client);
    await expect(confirmOwnedMpmbImportPreview(IMPORT_ID, 3)).resolves.toMatchObject({
      status: "conflict",
    });
    expect(createAdminClientMock).not.toHaveBeenCalled();

    const failed = previewReviewClient({
      effects: [{
        type: "mechanical",
        stat: "armor_class",
        op: "formula",
        expr: "not(",
      }],
    });
    createClientMock.mockResolvedValue(failed.client);
    await expect(confirmOwnedMpmbImportPreview(IMPORT_ID, 4)).resolves.toEqual({
      status: "error",
      message: "Resolve every calculation failure before confirming this preview.",
    });
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });
});

function conflictReviewClient(
  status: "review" | "completed" = "review",
  hasLiveConflict = true,
) {
  const importQuery = orderedQueryBuilder({
    data: {
      id: IMPORT_ID,
      original_filename: "conflicts.mpmb",
      source_bytes: 128,
      source_sha256: "a".repeat(64),
      parser_version: "1.0.0",
      mapper_version: "1.0.0",
      required_sheet_version: null,
      status,
      revision: 4,
      preview_validated_revision: null,
      mapping_summary: {
        valid: 1,
        needsInfo: 0,
        unsupported: 0,
        warnings: 0,
        blockingIssues: 0,
      },
    },
    error: null,
  });
  const itemQuery = orderedQueryBuilder({
    data: [{
      id: ITEM_ID,
      ordinal: 0,
      registry: "SpellsList",
      source_key: "ash veil",
      content_type: "spell",
      location_line: 2,
      location_column: 3,
      mapping_status: "valid",
      candidate_name: "Ash Veil",
      candidate_data: { secret_rules_payload: "must-not-cross" },
      selected: true,
      committed_content_id: null,
      diagnostics: [],
      resolved_diagnostics: [],
      user_edited_fields: [],
      user_edited_at: null,
      conflict_resolution: "replace",
      replacement_content_id: TARGET_ID,
      replacement_expected_version: 7,
    }],
    error: null,
  });
  const rpc = vi.fn().mockResolvedValue({
    data: hasLiveConflict ? [
      {
        import_item_id: ITEM_ID,
        content_id: TARGET_ID,
        name: "Ash Veil",
        slug: "ash-veil",
        version: 7,
        scope: "personal",
        shared_campaign_count: 0,
        replaceable: true,
        previously_imported: true,
      },
      {
        import_item_id: ITEM_ID,
        content_id: SHARED_TARGET_ID,
        name: "Ash Veil",
        slug: "ash-veil-shared",
        version: 2,
        scope: "shared",
        shared_campaign_count: 1,
        replaceable: false,
        previously_imported: false,
      },
    ] : [],
    error: null,
  });
  const from = vi.fn()
    .mockReturnValueOnce(importQuery.builder)
    .mockReturnValueOnce(itemQuery.builder);
  return { client: authenticatedClient({ from, rpc }), importQuery, itemQuery, rpc };
}

describe("MPMB import conflict resolution", () => {
  it("does not ask the open-import RPC to resolve completed review conflicts", async () => {
    const db = conflictReviewClient("completed");
    createClientMock.mockResolvedValue(db.client);

    const review = await getOwnedMpmbImportReview(IMPORT_ID);

    expect(review?.status).toBe("completed");
    expect(review?.items[0]).toMatchObject({
      conflicts: [],
      hasLiveConflict: false,
      conflictResolved: true,
      conflictResolution: "replace",
      replacementContentId: TARGET_ID,
      replacementExpectedVersion: 7,
    });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("loads one sanitized conflict batch and never returns candidate JSON", async () => {
    const db = conflictReviewClient();
    createClientMock.mockResolvedValue(db.client);

    const review = await getOwnedMpmbImportReview(IMPORT_ID);

    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith("list_mpmb_import_item_conflicts", {
      target_import_id: IMPORT_ID,
    });
    expect(db.importQuery.filters).toEqual([
      ["id", IMPORT_ID],
      ["owner_id", USER_ID],
    ]);
    expect(db.itemQuery.filters).toEqual([["import_id", IMPORT_ID]]);
    expect(review?.items[0]).toMatchObject({
      conflictResolution: "replace",
      replacementContentId: TARGET_ID,
      replacementExpectedVersion: 7,
      hasLiveConflict: true,
      conflictResolved: true,
      conflicts: [
        {
          id: TARGET_ID,
          name: "Ash Veil",
          version: 7,
          scope: "personal",
          sharedCampaignCount: 0,
          previouslyImported: true,
          replaceable: true,
        },
        {
          id: SHARED_TARGET_ID,
          scope: "shared",
          sharedCampaignCount: 1,
          previouslyImported: false,
          replaceable: false,
        },
      ],
    });
    expect(JSON.stringify(review)).not.toContain("candidate_data");
    expect(JSON.stringify(review)).not.toContain("must-not-cross");
    expect(JSON.stringify(review)).not.toContain("ash-veil-shared");
  });

  it("normalizes a saved choice away after its live conflict disappears", async () => {
    const db = conflictReviewClient("review", false);
    createClientMock.mockResolvedValue(db.client);

    const review = await getOwnedMpmbImportReview(IMPORT_ID);

    expect(review?.items[0]).toMatchObject({
      hasLiveConflict: false,
      conflictResolved: false,
      conflictResolution: null,
      replacementContentId: null,
      replacementExpectedVersion: null,
      conflicts: [],
    });
  });

  it("does not expose the conflict route after every live match disappears", async () => {
    const db = conflictReviewClient("review", false);
    createClientMock.mockResolvedValue(db.client);

    await expect(
      getOwnedMpmbImportConflictItem(IMPORT_ID, ITEM_ID),
    ).resolves.toBeNull();
  });

  it("returns a conflict-page DTO with the same sanitized targets", async () => {
    const db = conflictReviewClient();
    createClientMock.mockResolvedValue(db.client);

    const item = await getOwnedMpmbImportConflictItem(IMPORT_ID, ITEM_ID);

    expect(item).toMatchObject({
      importId: IMPORT_ID,
      itemId: ITEM_ID,
      revision: 4,
      candidateName: "Ash Veil",
      contentType: "spell",
      conflictResolution: "replace",
      replacementContentId: TARGET_ID,
      replacementExpectedVersion: 7,
      conflicts: expect.any(Array),
    });
    expect(JSON.stringify(item)).not.toContain("candidate_data");
    expect(JSON.stringify(item)).not.toContain("must-not-cross");
  });

  it("validates the exact choice shape before calling the resolution RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    createClientMock.mockResolvedValue(authenticatedClient({ rpc }));

    await expect(resolveMpmbImportItemConflict(
      IMPORT_ID,
      ITEM_ID,
      4,
      "keep_both",
      TARGET_ID,
      7,
    )).resolves.toEqual({
      status: "error",
      message: "The conflict choice is invalid.",
    });
    await expect(resolveMpmbImportItemConflict(
      IMPORT_ID,
      ITEM_ID,
      4,
      "replace",
    )).resolves.toEqual({
      status: "error",
      message: "The conflict choice is invalid.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires an authenticated session before resolving a conflict", async () => {
    const db = makeClient(false);
    createClientMock.mockResolvedValue(db.client);

    await expect(resolveMpmbImportItemConflict(
      IMPORT_ID,
      ITEM_ID,
      4,
      "keep_both",
    )).resolves.toEqual({
      status: "error",
      message: "Sign in to resolve this import conflict.",
    });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("sends only IDs, revisions, and strategy to the resolution RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ revision: 5 }], error: null });
    createClientMock.mockResolvedValue(authenticatedClient({ rpc }));

    await expect(resolveMpmbImportItemConflict(
      IMPORT_ID,
      ITEM_ID,
      4,
      "replace",
      TARGET_ID,
      7,
    )).resolves.toEqual({ status: "success", importId: IMPORT_ID });
    expect(rpc).toHaveBeenCalledWith("resolve_mpmb_import_item_conflict", {
      target_import_id: IMPORT_ID,
      target_item_id: ITEM_ID,
      expected_revision: 4,
      resolution_strategy: "replace",
      target_content_id: TARGET_ID,
      target_content_version: 7,
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("candidate");
  });

  it("maps stale and shared targets to recoverable, non-leaking conflicts", async () => {
    const rpc = vi.fn();
    createClientMock.mockResolvedValue(authenticatedClient({ rpc }));

    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "40001", message: "Replacement target changed in another session: private detail" },
    });
    await expect(resolveMpmbImportItemConflict(
      IMPORT_ID,
      ITEM_ID,
      4,
      "replace",
      TARGET_ID,
      7,
    )).resolves.toEqual({
      status: "conflict",
      message: "This import or replacement changed in another session. Reload and try again.",
    });

    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "P0001", message: "Import review changed in another session" },
    });
    await expect(resolveMpmbImportItemConflict(
      IMPORT_ID,
      ITEM_ID,
      4,
      "keep_both",
    )).resolves.toEqual({
      status: "conflict",
      message: "This import or replacement changed in another session. Reload and try again.",
    });

    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "Shared content must be unshared before replacement: private detail" },
    });
    await expect(resolveMpmbImportItemConflict(
      IMPORT_ID,
      ITEM_ID,
      4,
      "replace",
      SHARED_TARGET_ID,
      2,
    )).resolves.toEqual({
      status: "conflict",
      message: "That definition is shared with a campaign. Unshare it or keep both.",
    });
  });

  it("maps non-retryable commit revision conflicts to a reload response", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "Import review changed in another session" },
    });
    createClientMock.mockResolvedValue(authenticatedClient({ rpc }));

    await expect(commitMpmbImport(IMPORT_ID, 4)).resolves.toEqual({
      status: "conflict",
      message: "This import changed in another session. Reload and try again.",
    });
  });
});
