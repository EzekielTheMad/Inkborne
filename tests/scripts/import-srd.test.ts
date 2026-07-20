import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it, vi } from "vitest";
import type { TransformedContent } from "@/scripts/transformers/common";
import {
  buildImportRows,
  getSystemId,
  importSrd,
  parseImportOptions,
  prepareImportSteps,
  requireImportEnvironment,
  upsertContent,
  type ImportClient,
} from "@/scripts/import-srd";

const SYSTEM_ID = "11111111-1111-4111-8111-111111111111";
const BATCH_ID = "22222222-2222-4222-8222-222222222222";

function content(
  slug: string,
  contentType = "spell",
): TransformedContent {
  return {
    content_type: contentType,
    slug,
    name: slug,
    data: { description: slug },
    effects: [],
  };
}

function importClient(options?: {
  systemError?: { message: string };
  batchError?: { message: string };
  stageErrors?: Array<{ message: string } | null>;
  promoteError?: { message: string };
  cleanupError?: { message: string };
}) {
  const single = vi.fn().mockResolvedValue(
    options?.systemError
      ? { data: null, error: options.systemError }
      : { data: { id: SYSTEM_ID }, error: null },
  );
  const batchInsert = vi.fn().mockResolvedValue({
    data: null,
    error: options?.batchError ?? null,
  });
  const stageInsert = vi.fn();
  for (const error of options?.stageErrors ?? []) {
    stageInsert.mockResolvedValueOnce({ data: null, error });
  }
  stageInsert.mockResolvedValue({ data: null, error: null });
  const cleanupEq = vi.fn().mockResolvedValue({
    data: null,
    error: options?.cleanupError ?? null,
  });
  const batchDelete = vi.fn(() => ({ eq: cleanupEq }));
  const rpc = vi.fn().mockResolvedValue({
    data: [{ upserted_count: 2, retired_count: 0 }],
    error: options?.promoteError ?? null,
  });
  const from = vi.fn((table: string) => {
    if (table === "game_systems") {
      return {
        select: () => ({
          eq: () => ({ single }),
        }),
      };
    }
    if (table === "srd_import_batches") {
      return { insert: batchInsert, delete: batchDelete };
    }
    if (table === "srd_import_staging") {
      return { insert: stageInsert };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: { from, rpc } as unknown as ImportClient,
    from,
    single,
    batchInsert,
    stageInsert,
    rpc,
    batchDelete,
    cleanupEq,
  };
}

describe("SRD importer stability contract", () => {
  it("requires service-role credentials even when an anon key exists", () => {
    expect(() =>
      requireImportEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-is-not-enough",
      }),
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);

    expect(
      requireImportEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "server-only",
      }),
    ).toEqual({
      supabaseUrl: "https://example.supabase.co",
      serviceRoleKey: "server-only",
    });
  });

  it("leaves IDs and versions to the database", () => {
    const [row] = buildImportRows(SYSTEM_ID, [content("magic-missile")]);

    expect(row).toMatchObject({
      system_id: SYSTEM_ID,
      content_type: "spell",
      slug: "magic-missile",
      source: "srd",
      scope: "platform",
      owner_id: null,
    });
    expect(row).not.toHaveProperty("id");
    expect(row).not.toHaveProperty("version");
  });

  it("stages every row before one atomic promotion RPC", async () => {
    const { client, from, batchInsert, stageInsert, rpc } = importClient();

    await upsertContent(
      client,
      SYSTEM_ID,
      [content("magic-missile"), content("shield")],
      1,
      BATCH_ID,
    );

    expect(batchInsert).toHaveBeenCalledWith({
      id: BATCH_ID,
      system_id: SYSTEM_ID,
      expected_count: 2,
      allow_destructive_retirement: false,
    });
    expect(stageInsert).toHaveBeenCalledTimes(2);
    expect(stageInsert).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({
        batch_id: BATCH_ID,
        slug: "magic-missile",
        source: "srd",
        scope: "platform",
        owner_id: null,
      }),
    ]);
    expect(stageInsert).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({ batch_id: BATCH_ID, slug: "shield" }),
    ]);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("promote_srd_import", {
      p_batch_id: BATCH_ID,
    });
    expect(stageInsert.mock.invocationCallOrder.at(-1)).toBeLessThan(
      rpc.mock.invocationCallOrder[0],
    );
    expect(from).not.toHaveBeenCalledWith("content_definitions");
  });

  it("does not promote a partially uploaded batch and cleans staging", async () => {
    const queryError = { message: "upload interrupted" };
    const { client, stageInsert, rpc, batchDelete, cleanupEq } = importClient({
      stageErrors: [null, queryError],
    });

    await expect(
      upsertContent(
        client,
        SYSTEM_ID,
        [content("magic-missile"), content("shield")],
        1,
        BATCH_ID,
      ),
    ).rejects.toMatchObject({ cause: queryError });

    expect(stageInsert).toHaveBeenCalledTimes(2);
    expect(rpc).not.toHaveBeenCalled();
    expect(batchDelete).toHaveBeenCalledOnce();
    expect(cleanupEq).toHaveBeenCalledWith("id", BATCH_ID);
  });

  it("surfaces a failed promotion and cleans its staged batch", async () => {
    const queryError = { message: "transaction rolled back" };
    const { client, rpc, cleanupEq } = importClient({
      promoteError: queryError,
    });

    await expect(
      upsertContent(client, SYSTEM_ID, [content("shield")], 50, BATCH_ID),
    ).rejects.toMatchObject({ cause: queryError });

    expect(rpc).toHaveBeenCalledOnce();
    expect(cleanupEq).toHaveBeenCalledWith("id", BATCH_ID);
  });

  it("refuses an empty publication before creating a batch", async () => {
    const { client, batchInsert, rpc } = importClient();

    await expect(
      upsertContent(client, SYSTEM_ID, [], 50, BATCH_ID),
    ).rejects.toThrow(/retire the entire catalog/);
    expect(batchInsert).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires a separate explicit option for destructive retirement", async () => {
    expect(parseImportOptions([])).toEqual({
      allowDestructiveRetirement: false,
    });
    expect(parseImportOptions(["--allow-destructive-retirement"])).toEqual({
      allowDestructiveRetirement: true,
    });
    expect(() => parseImportOptions(["--force"])).toThrow(
      "Unknown SRD import option: --force",
    );

    const { client, batchInsert } = importClient();
    await upsertContent(
      client,
      SYSTEM_ID,
      [content("shield")],
      50,
      BATCH_ID,
      true,
    );
    expect(batchInsert).toHaveBeenCalledWith(
      expect.objectContaining({ allow_destructive_retirement: true }),
    );
  });

  it("surfaces the game-system query error", async () => {
    const queryError = { message: "database unavailable" };
    const { client } = importClient({ systemError: queryError });

    await expect(getSystemId(client)).rejects.toMatchObject({
      cause: queryError,
    });
  });

  it("prepares every transform before writing raw data or staging rows", async () => {
    const { client, from, stageInsert } = importClient();
    const saveRaw = vi.fn().mockResolvedValue(undefined);
    const transformError = new Error("upstream API failed");

    await expect(
      importSrd(
        client,
        [
          { name: "spells", transform: async () => [content("shield")] },
          {
            name: "equipment",
            transform: async () => {
              throw transformError;
            },
          },
        ],
        saveRaw,
      ),
    ).rejects.toBe(transformError);

    expect(saveRaw).not.toHaveBeenCalled();
    expect(stageInsert).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalledWith("srd_import_batches");
  });

  it("rejects duplicate stable identities before any database mutation", async () => {
    const { client, batchInsert } = importClient();

    await expect(
      upsertContent(
        client,
        SYSTEM_ID,
        [content("shield"), content("shield")],
        50,
        BATCH_ID,
      ),
    ).rejects.toThrow("Duplicate SRD stable identity: spell/shield");
    expect(batchInsert).not.toHaveBeenCalled();

    await expect(
      prepareImportSteps([
        { name: "a", transform: async () => [content("shield")] },
        { name: "b", transform: async () => [content("shield")] },
      ]),
    ).rejects.toThrow("Duplicate SRD stable identity: spell/shield");
  });

  it("rejects an unexpectedly empty transform step", async () => {
    await expect(
      prepareImportSteps([
        { name: "spells", transform: async () => [] },
      ]),
    ).rejects.toThrow('Refusing empty SRD transform step "spells"');
  });
});

describe("atomic SRD publication migration", () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/20260720185219_srd_import_atomic_promote.sql",
    ),
    "utf8",
  ).toLowerCase();
  const versioningSql = readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/20260720171627_content_version_pinning_and_rls.sql",
    ),
    "utf8",
  )
    .toLowerCase()
    .replace(/\s+/g, " ");

  it("keeps staging inaccessible to end-user roles", () => {
    expect(sql).toContain(
      "alter table public.srd_import_batches enable row level security",
    );
    expect(sql).toContain(
      "alter table public.srd_import_staging enable row level security",
    );
    expect(sql).toMatch(
      /revoke all on public\.srd_import_batches[\s\S]*?from public, anon, authenticated, service_role/,
    );
    expect(sql).toMatch(
      /revoke all on public\.srd_import_staging[\s\S]*?from public, anon, authenticated, service_role/,
    );
    expect(sql).not.toMatch(
      /grant [^;]+ on public\.srd_import_(?:batches|staging) to (?:anon|authenticated)/,
    );
    expect(sql).toMatch(
      /grant select, insert, update, delete\s+on public\.srd_import_batches to service_role/,
    );
    expect(sql).toMatch(
      /select batch\.\*[\s\S]*?from public\.srd_import_batches as batch[\s\S]*?for update/,
    );
  });

  it("exposes only an invoker-rights service-role promotion RPC", () => {
    expect(sql).toContain("security invoker");
    expect(sql).toMatch(
      /revoke all on function public\.promote_srd_import\(uuid\)[\s\S]*?from public, anon, authenticated, service_role/,
    );
    expect(sql).toContain(
      "grant execute on function public.promote_srd_import(uuid) to service_role",
    );
    expect(sql).not.toMatch(
      /grant execute on function public\.promote_srd_import\(uuid\) to (?:anon|authenticated)/,
    );
  });

  it("validates completeness, preserves stable IDs, and leaves versioning to triggers", () => {
    expect(sql).toContain("staged_count <> target_batch.expected_count");
    expect(sql).toContain("primary key (batch_id, content_type, slug)");
    expect(sql).toContain("check (source = 'srd')");
    expect(sql).toContain("check (scope = 'platform')");
    expect(sql).toContain(
      "on conflict on constraint content_definitions_identity_unique",
    );
    expect(sql).toContain("name = excluded.name");
    expect(sql).not.toMatch(/set\s+version\s*=/);
    expect(versioningSql).toContain(
      "if row(new.name, new.data, new.effects, new.scope) is distinct from row(old.name, old.data, old.effects, old.scope)",
    );
  });

  it("fails closed when any active SRD identity is missing", () => {
    expect(sql).toContain(
      "allow_destructive_retirement boolean not null default false",
    );
    expect(sql).toMatch(
      /if not target_batch\.allow_destructive_retirement then[\s\S]*?definition\.is_retired = false[\s\S]*?not exists \([\s\S]*?staged\.content_type = definition\.content_type[\s\S]*?staged\.slug = definition\.slug[\s\S]*?if missing_active_count > 0 then[\s\S]*?raise exception[\s\S]*?srd completeness guard rejected batch/,
    );
    expect(sql).toContain("--allow-destructive-retirement only for intentional removals");
  });

  it("retires missing SRD rows without deleting definitions or snapshots", () => {
    expect(sql).toContain(
      "add column is_retired boolean not null default false",
    );
    expect(sql).toMatch(
      /update public\.content_definitions as definition[\s\S]*?set is_retired = true/,
    );
    expect(sql).not.toMatch(/delete from public\.content_(?:definitions|versions)/);
    expect(sql).toContain("scope = 'platform' and is_retired = false");
  });

  it("serializes publications for the same game system", () => {
    expect(sql).toMatch(
      /pg_catalog\.pg_advisory_xact_lock\([\s\S]*?pg_catalog\.hashtextextended\([\s\S]*?target_batch\.system_id::text/,
    );
    expect(sql).not.toMatch(
      /from public\.game_systems as system[\s\S]*?for update/,
    );
    expect(sql).toContain("grant select on public.game_systems to service_role");
    expect(sql).not.toMatch(
      /grant [^;]*update[^;]* on public\.game_systems to service_role/,
    );
  });
});
