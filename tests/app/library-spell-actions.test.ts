import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/homebrew-spells-server", () => ({
  createHomebrewSpellRecord: mocks.create,
  updateHomebrewSpellRecord: mocks.update,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }),
}));

import {
  createHomebrewSpell,
  updateHomebrewSpell,
} from "@/app/(app)/library/spells/actions";

const idle = { status: "idle" as const, message: "" };

describe("homebrew spell actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
  });

  it("redirects unauthenticated mutations before touching content", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(createHomebrewSpell(idle, new FormData())).rejects.toThrow("REDIRECT:/login");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("returns recoverable create validation errors", async () => {
    const failure = { status: "error" as const, message: "Check the spell fields." };
    mocks.create.mockResolvedValue(failure);
    await expect(createHomebrewSpell(idle, new FormData())).resolves.toEqual(failure);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("revalidates and redirects after create", async () => {
    mocks.create.mockResolvedValue({ id: "spell-id" });
    await expect(createHomebrewSpell(idle, new FormData())).rejects.toThrow(
      "REDIRECT:/library?created=spell-id",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/library");
  });

  it("rejects a malformed edit identity before the data helper", async () => {
    await expect(updateHomebrewSpell(idle, new FormData())).resolves.toMatchObject({
      status: "error",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns stale edit conflicts without redirecting", async () => {
    const formData = new FormData();
    formData.set("id", "spell-id");
    formData.set("expected_version", "2");
    const conflict = { status: "conflict" as const, message: "Reload the latest version." };
    mocks.update.mockResolvedValue(conflict);

    await expect(updateHomebrewSpell(idle, formData)).resolves.toEqual(conflict);
    expect(mocks.update).toHaveBeenCalledWith("spell-id", 2, formData);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("revalidates the library and edit route after update", async () => {
    const formData = new FormData();
    formData.set("id", "spell-id");
    formData.set("expected_version", "2");
    mocks.update.mockResolvedValue({ id: "spell-id" });

    await expect(updateHomebrewSpell(idle, formData)).rejects.toThrow(
      "REDIRECT:/library?updated=spell-id",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/library");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/library/spells/spell-id/edit");
  });
});
