import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import {
  getOwnedMpmbImportSpellRepairItem,
  repairMpmbImportSpellItem,
  sanitizeMpmbImportFilename,
  stageMpmbImportFile,
} from "@/lib/supabase/mpmb-imports-server";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SYSTEM_ID = "22222222-2222-4222-8222-222222222222";
const IMPORT_ID = "33333333-3333-4333-8333-333333333333";
const ITEM_ID = "44444444-4444-4444-8444-444444444444";

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
  createClientMock.mockReset();
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
      mapper_version: "1.0.0",
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
      getOwnedMpmbImportSpellRepairItem(IMPORT_ID, ITEM_ID),
    ).resolves.toMatchObject({
      importId: IMPORT_ID,
      itemId: ITEM_ID,
      revision: 4,
      candidateName: "Ash Veil",
      repairFields: { material: true, dc: false },
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
      },
    )).resolves.toEqual({ status: "success", importId: IMPORT_ID });
    expect(rpc).toHaveBeenCalledWith("repair_mpmb_import_spell_item", {
      target_import_id: IMPORT_ID,
      target_item_id: ITEM_ID,
      expected_revision: 4,
      repair_patch: {
        material: "a silver thread",
        dc: { type: "wisdom", success: "half" },
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
  });
});
