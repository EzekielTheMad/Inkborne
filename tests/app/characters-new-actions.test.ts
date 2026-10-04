import { describe, it, expect, vi, beforeEach } from "vitest";

// `redirect()` in Next throws NEXT_REDIRECT to halt the action. Mock it as a
// throwing sentinel so we can assert the target without executing past it.
class TestRedirect extends Error {
  constructor(public to: string) {
    super(`REDIRECT:${to}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new TestRedirect(to);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/starting-equipment-server", () => ({ createStartingEquipmentClient: vi.fn(), startingEquipmentEnabled: vi.fn().mockReturnValue(false) }));
import { createStartingEquipmentClient, startingEquipmentEnabled } from "@/lib/supabase/starting-equipment-server";
import { createClient } from "@/lib/supabase/server";
import { createCharacter } from "@/app/(app)/characters/new/actions";

const mockedCreateClient = vi.mocked(createClient);

interface MockSupabaseOptions {
  user?: { id: string } | null;
  insertResult?: { data: { id: string } | null; error: { message: string; details?: string; hint?: string } | null };
}

function mockSupabase(opts: MockSupabaseOptions = {}) {
  const { user = { id: "user-1" }, insertResult = { data: { id: "char-new" }, error: null } } = opts;

  const chain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(insertResult),
  };

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn().mockReturnValue(chain),
  };

  mockedCreateClient.mockResolvedValue(supabase as never);

  return { supabase, chain };
}

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function captureRedirect(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof TestRedirect) return e.to;
    throw e;
  }
  throw new Error("expected createCharacter to redirect");
}

describe("createCharacter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(startingEquipmentEnabled).mockReturnValue(false);
  });

  it("redirects to /login when no user", async () => {
    mockSupabase({ user: null });
    const fd = makeFormData({ name: "Elara", system_id: "sys-1" });
    const to = await captureRedirect(() => createCharacter(fd));
    expect(to).toBe("/login");
  });

  it("redirects with missing_fields error when name is blank", async () => {
    mockSupabase();
    const fd = makeFormData({ name: "   ", system_id: "sys-1" });
    const to = await captureRedirect(() => createCharacter(fd));
    expect(to).toBe("/characters/new?error=missing_fields");
  });

  it("redirects with missing_fields error when system_id is blank", async () => {
    mockSupabase();
    const fd = makeFormData({ name: "Elara", system_id: "" });
    const to = await captureRedirect(() => createCharacter(fd));
    expect(to).toBe("/characters/new?error=missing_fields");
  });

  it("trims the name and inserts with user_id and system_id", async () => {
    const { chain } = mockSupabase();
    const fd = makeFormData({ name: "  Elara  ", system_id: "sys-1" });
    await captureRedirect(() => createCharacter(fd));

    expect(chain.insert).toHaveBeenCalledWith([
      {
        name: "Elara",
        user_id: "user-1",
        system_id: "sys-1",
      },
    ]);
  });

  it("redirects to the builder on successful insert", async () => {
    mockSupabase({ insertResult: { data: { id: "char-new" }, error: null } });
    const fd = makeFormData({ name: "Elara", system_id: "sys-1" });
    const to = await captureRedirect(() => createCharacter(fd));
    expect(to).toBe("/characters/char-new/builder");
  });

  it("offers a readable retry path without exposing a database error", async () => {
    mockSupabase({
      insertResult: {
        data: null,
        error: { message: "duplicate key value", details: "", hint: "" },
      },
    });
    const fd = makeFormData({ name: "Elara", system_id: "sys-1" });
    const to = await captureRedirect(() => createCharacter(fd));
    expect(to).toBe("/characters/new?error=creation_failed");
  });

  it.each(["name", "system_id"])("rejects a file in the %s field before inserting", async (field) => {
    const { chain } = mockSupabase();
    const fd = makeFormData({ name: "Elara", system_id: "sys-1" });
    fd.set(field, new File(["unexpected"], "value.txt"));
    expect(await captureRedirect(() => createCharacter(fd))).toBe("/characters/new?error=missing_fields");
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only game systems before inserting", async () => {
    const { chain } = mockSupabase();
    expect(await captureRedirect(() => createCharacter(makeFormData({ name: "Elara", system_id: "  " })))).toBe("/characters/new?error=missing_fields");
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("offers retry when the insert rejects or returns no row", async () => {
    const { chain } = mockSupabase();
    chain.single.mockRejectedValueOnce(new Error("network interrupted"));
    const fd = makeFormData({ name: "Elara", system_id: "sys-1" });
    expect(await captureRedirect(() => createCharacter(fd))).toBe("/characters/new?error=creation_failed");
    mockSupabase({ insertResult: { data: null, error: null } });
    expect(await captureRedirect(() => createCharacter(fd))).toBe("/characters/new?error=creation_failed");
  });
});

describe("atomic character eligibility", () => {
  it("derives the actor and redirects from the trusted creation transaction", async () => {
    const { chain } = mockSupabase();
    vi.mocked(startingEquipmentEnabled).mockReturnValue(true);
    const rpc = vi.fn().mockResolvedValue({ data: "new-eligible", error: null });
    vi.mocked(createStartingEquipmentClient).mockReturnValue({ rpc } as never);
    expect(await captureRedirect(() => createCharacter(makeFormData({ name: " Elara ", system_id: "sys-1", user_id: "forged" })))).toBe("/characters/new-eligible/builder");
    expect(rpc).toHaveBeenCalledWith("create_character_with_starting_grant", { actor_id: "user-1", character_name: "Elara", target_system_id: "sys-1" });
    expect(chain.insert).not.toHaveBeenCalled();
  });
  it.each(["error", "throw", "empty"])("never falls back after a %s creation response", async mode => {
    const { chain } = mockSupabase();
    vi.mocked(startingEquipmentEnabled).mockReturnValue(true);
    const rpc = mode === "throw" ? vi.fn().mockRejectedValue(new Error("private key")) : vi.fn().mockResolvedValue({ data: null, error: mode === "error" ? { message: "private key" } : null });
    vi.mocked(createStartingEquipmentClient).mockReturnValue({ rpc } as never);
    expect(await captureRedirect(() => createCharacter(makeFormData({ name: "Elara", system_id: "sys-1" })))).toBe("/characters/new?error=creation_failed");
    expect(chain.insert).not.toHaveBeenCalled();
  });
});

it("does not construct a privileged client when getUser returns both an error and user", async () => {
  const { supabase, chain } = mockSupabase();
  vi.mocked(startingEquipmentEnabled).mockReturnValue(true);
  vi.mocked(createStartingEquipmentClient).mockClear();
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: { message: "expired" } } as never);
  expect(await captureRedirect(() => createCharacter(makeFormData({ name: "Elara", system_id: "sys-1" })))).toBe("/login");
  expect(chain.insert).not.toHaveBeenCalled();
  expect(createStartingEquipmentClient).not.toHaveBeenCalled();
});
