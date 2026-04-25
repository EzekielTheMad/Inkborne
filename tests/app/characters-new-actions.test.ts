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

  it("redirects to /characters/new with the encoded error message when insert fails", async () => {
    mockSupabase({
      insertResult: {
        data: null,
        error: { message: "duplicate key value", details: "", hint: "" },
      },
    });
    const fd = makeFormData({ name: "Elara", system_id: "sys-1" });
    const to = await captureRedirect(() => createCharacter(fd));
    expect(to).toBe(`/characters/new?error=${encodeURIComponent("duplicate key value")}`);
  });
});
