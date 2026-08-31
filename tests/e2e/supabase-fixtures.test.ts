import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

import {
  seedCampaignCharacter,
  seedHomebrewSharingCampaign,
  seedSheetCharacter,
  seedWizardCharacter,
} from "@/e2e/helpers/supabase";

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

interface QueryFilter {
  column: string;
  value: unknown;
}

interface RecordedQuery {
  table: string;
  operation: "read" | "insert" | "upsert" | "delete";
  payload?: unknown;
  filters: QueryFilter[];
}

interface RecordedRpc {
  clientKind: "authenticated" | "service";
  signedInEmail: string | null;
  name: string;
  args: Record<string, unknown>;
}

interface HarnessState {
  queries: RecordedQuery[];
  rpcs: RecordedRpc[];
  rpcError: { message: string } | null;
}

const state: HarnessState = {
  queries: [],
  rpcs: [],
  rpcError: null,
};

function filterValue(query: RecordedQuery, column: string): unknown {
  return query.filters.find((filter) => filter.column === column)?.value;
}

function characterIdForPayload(payload: unknown): string {
  const row = payload as { name?: string };
  return `character-${row.name?.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
}

class FakeQuery implements PromiseLike<QueryResult> {
  private readonly record: RecordedQuery;

  constructor(table: string) {
    this.record = { table, operation: "read", filters: [] };
    state.queries.push(this.record);
  }

  select(): this {
    return this;
  }

  insert(payload: unknown): this {
    this.record.operation = "insert";
    this.record.payload = payload;
    return this;
  }

  upsert(payload: unknown): this {
    this.record.operation = "upsert";
    this.record.payload = payload;
    return this;
  }

  delete(): this {
    this.record.operation = "delete";
    return this;
  }

  eq(column: string, value: unknown): this {
    this.record.filters.push({ column, value });
    return this;
  }

  in(column: string, value: unknown): this {
    this.record.filters.push({ column, value });
    return this;
  }

  order(): this {
    return this;
  }

  limit(): this {
    return this;
  }

  single(): Promise<QueryResult> {
    return Promise.resolve(this.resolve());
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }

  private resolve(): QueryResult {
    if (this.record.table === "game_systems") {
      return { data: [{ id: "system-1" }], error: null };
    }

    if (this.record.table === "characters") {
      if (this.record.operation === "insert") {
        return {
          data: { id: characterIdForPayload(this.record.payload) },
          error: null,
        };
      }
      return { data: null, error: null };
    }

    if (this.record.table === "campaigns" && this.record.operation === "insert") {
      return { data: { id: "campaign-1" }, error: null };
    }

    if (this.record.table === "content_definitions") {
      const contentType = filterValue(this.record, "content_type");
      const slug = filterValue(this.record, "slug");
      if (contentType === "background") {
        return {
          data: {
            id: `background-${slug}`,
            version: 7,
          },
          error: null,
        };
      }
      if (contentType === "class") {
        return { data: { id: `class-${slug}`, version: 4 }, error: null };
      }
      if (contentType === "spell") {
        return {
          data: [
            {
              id: "spell-magic-missile",
              name: "Magic Missile",
              slug: "magic-missile",
              version: 2,
            },
            {
              id: "spell-mage-armor",
              name: "Mage Armor",
              slug: "mage-armor",
              version: 3,
            },
          ],
          error: null,
        };
      }
    }

    return { data: null, error: null };
  }
}

class FakeSupabaseClient {
  private signedInEmail: string | null = null;

  constructor(private readonly kind: "authenticated" | "service") {}

  readonly auth = {
    signInWithPassword: vi.fn(async (credentials: {
      email: string;
      password: string;
    }) => {
      this.signedInEmail = credentials.email;
      return {
        data: {
          user: {
            id: credentials.email === "player@example.test"
              ? "user-player"
              : "user-primary",
          },
        },
        error: null,
      };
    }),
  };

  from(table: string): FakeQuery {
    return new FakeQuery(table);
  }

  async rpc(name: string, args: Record<string, unknown>): Promise<QueryResult> {
    state.rpcs.push({
      clientKind: this.kind,
      signedInEmail: this.signedInEmail,
      name,
      args,
    });
    return { data: null, error: state.rpcError };
  }
}

function findCharacterInsert(name: string): RecordedQuery {
  const query = state.queries.find((candidate) => (
    candidate.table === "characters"
      && candidate.operation === "insert"
      && (candidate.payload as { name?: string }).name === name
  ));
  if (!query) throw new Error(`No character insert recorded for ${name}`);
  return query;
}

function findBackgroundQuery(slug: string): RecordedQuery {
  const query = state.queries.find((candidate) => (
    candidate.table === "content_definitions"
      && filterValue(candidate, "content_type") === "background"
      && filterValue(candidate, "slug") === slug
  ));
  if (!query) throw new Error(`No background query recorded for ${slug}`);
  return query;
}

function findGameSystemQuery(): RecordedQuery {
  const queries = state.queries.filter((candidate) => (
    candidate.table === "game_systems" && candidate.operation === "read"
  ));
  expect(queries).toHaveLength(1);
  return queries[0];
}

describe("E2E character fixture backgrounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.queries = [];
    state.rpcs = [];
    state.rpcError = null;

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    process.env.E2E_TEST_EMAIL = "primary@example.test";
    process.env.E2E_TEST_PASSWORD = "primary-password";

    createClientMock.mockImplementation((_url: string, key: string) => (
      new FakeSupabaseClient(key === "service-key" ? "service" : "authenticated")
    ));
  });

  it.each([
    {
      label: "campaign",
      name: "Campaign Fixture",
      backgroundSlug: "acolyte",
      expectedVersion: 7,
      expectedEmail: "player@example.test",
      seed: () => seedCampaignCharacter({
        name: "Campaign Fixture",
        systemId: "system-1",
        email: "player@example.test",
        password: "player-password",
      }),
    },
    {
      label: "sheet",
      name: "Sheet Fixture",
      backgroundSlug: "acolyte",
      expectedVersion: 7,
      expectedEmail: "primary@example.test",
      seed: () => seedSheetCharacter("Sheet Fixture"),
    },
    {
      label: "gameplay",
      name: "Gameplay Fixture",
      backgroundSlug: "acolyte",
      expectedVersion: 7,
      expectedEmail: "primary@example.test",
      seed: () => seedWizardCharacter("Gameplay Fixture"),
    },
  ])("seeds the $label fixture through the owning user's exact background RPC", async ({
    name,
    backgroundSlug,
    expectedVersion,
    expectedEmail,
    seed,
  }) => {
    const characterId = await seed();
    const insert = findCharacterInsert(name);
    const insertedChoices = (insert.payload as {
      choices: Record<string, unknown>;
    }).choices;

    expect(insertedChoices).not.toHaveProperty("background");

    const backgroundQuery = findBackgroundQuery(backgroundSlug);
    expect(backgroundQuery.filters).toEqual(expect.arrayContaining([
      { column: "system_id", value: "system-1" },
      { column: "content_type", value: "background" },
      { column: "slug", value: backgroundSlug },
      { column: "source", value: "srd" },
      { column: "scope", value: "platform" },
      { column: "is_retired", value: false },
    ]));

    expect(state.rpcs).toEqual([{
      clientKind: "authenticated",
      signedInEmail: expectedEmail,
      name: "set_character_background",
      args: {
        target_character_id: characterId,
        target_content_id: `background-${backgroundSlug}`,
        target_content_version: expectedVersion,
      },
    }]);
  });

  it.each([
    {
      label: "homebrew-sharing campaign",
      seed: async () => {
        const fixture = await seedHomebrewSharingCampaign({
          name: "Homebrew Campaign Fixture",
          playerEmail: "player@example.test",
          playerPassword: "player-password",
        });
        expect(fixture).toEqual({ id: "campaign-1", systemId: "system-1" });
      },
    },
    {
      label: "sheet",
      seed: () => seedSheetCharacter("System Sheet Fixture"),
    },
    {
      label: "gameplay",
      seed: () => seedWizardCharacter("System Gameplay Fixture"),
    },
  ])("selects the canonical published D&D 5e 2014 system for the $label fixture", async ({
    seed,
  }) => {
    await seed();

    expect(findGameSystemQuery().filters).toEqual(expect.arrayContaining([
      { column: "slug", value: "dnd-5e-2014" },
      { column: "status", value: "published" },
    ]));
  });

  it("deletes a partially seeded character when background application fails", async () => {
    state.rpcError = { message: "background rejected" };

    await expect(seedSheetCharacter("Failed Background Fixture")).rejects.toThrow(
      "Could not apply acolyte background: background rejected",
    );

    const characterId = characterIdForPayload(
      findCharacterInsert("Failed Background Fixture").payload,
    );
    expect(state.queries).toContainEqual(expect.objectContaining({
      table: "characters",
      operation: "delete",
      filters: [{ column: "id", value: characterId }],
    }));
  });

  it("preserves the canonical background when the MPMB fixture advances to level four", () => {
    const spec = readFileSync(
      path.resolve(process.cwd(), "e2e/mpmb-import-character.spec.ts"),
      "utf8",
    );
    const helper = spec.match(
      /async function makeWizardLevelFour\(\): Promise<string> \{[\s\S]*?\n\}/,
    )?.[0];

    expect(helper).toBeDefined();
    expect(helper).toContain('.select("choices")');
    expect(helper).toMatch(/choices:\s*\{\s*\.\.\.currentChoices,\s*classes:/);
    expect(helper).not.toMatch(/\bbackground\s*:/);
    expect(helper).not.toContain('"sage"');
  });
});
