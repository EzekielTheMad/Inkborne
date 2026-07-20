import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  stage: vi.fn(),
  toggle: vi.fn(),
  commit: vi.fn(),
  cancel: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/mpmb-imports-server", () => ({
  stageMpmbImportFile: mocks.stage,
  setMpmbImportItemSelected: mocks.toggle,
  commitMpmbImport: mocks.commit,
  cancelMpmbImport: mocks.cancel,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  abandonMpmbImport,
  finishMpmbImport,
  startMpmbImport,
  toggleMpmbImportItem,
} from "@/app/(app)/library/import/actions";

const IMPORT_ID = "33333333-3333-4333-8333-333333333333";
const ITEM_ID = "44444444-4444-4444-8444-444444444444";
const idle = { status: "idle" as const };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MPMB import actions", () => {
  it("returns upload validation errors and redirects successful staging", async () => {
    const formData = new FormData();
    formData.set("file", "file-value");
    formData.set("private_use_attestation", "on");
    const failure = { status: "error" as const, message: "Choose a file." };
    mocks.stage.mockResolvedValueOnce(failure);

    await expect(startMpmbImport(idle, formData)).resolves.toEqual(failure);
    expect(mocks.stage).toHaveBeenCalledWith("file-value", true);

    mocks.stage.mockResolvedValueOnce({ status: "success", importId: IMPORT_ID });
    await expect(startMpmbImport(idle, formData)).rejects.toThrow(
      `REDIRECT:/library/import/${IMPORT_ID}`,
    );
  });

  it("validates selections before invoking the data layer", async () => {
    await expect(toggleMpmbImportItem(idle, new FormData())).resolves.toEqual({
      status: "error",
      message: "The import selection is invalid.",
    });
    expect(mocks.toggle).not.toHaveBeenCalled();
  });

  it("updates a selection with its optimistic revision and revalidates", async () => {
    const formData = new FormData();
    formData.set("import_id", IMPORT_ID);
    formData.set("item_id", ITEM_ID);
    formData.set("expected_revision", "3");
    formData.set("selected", "false");
    mocks.toggle.mockResolvedValue({ status: "success", importId: IMPORT_ID });

    await expect(toggleMpmbImportItem(idle, formData)).resolves.toEqual({
      status: "success",
      importId: IMPORT_ID,
    });
    expect(mocks.toggle).toHaveBeenCalledWith(IMPORT_ID, ITEM_ID, false, 3);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/library/import/${IMPORT_ID}`);
  });

  it("commits, revalidates the library, and redirects to the completed review", async () => {
    const formData = new FormData();
    formData.set("import_id", IMPORT_ID);
    formData.set("expected_revision", "4");
    mocks.commit.mockResolvedValue({
      status: "success",
      importId: IMPORT_ID,
      importedCount: 2,
    });

    await expect(finishMpmbImport(formData)).rejects.toThrow(
      `REDIRECT:/library/import/${IMPORT_ID}?committed=2`,
    );
    expect(mocks.commit).toHaveBeenCalledWith(IMPORT_ID, 4);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/library");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/library/import/${IMPORT_ID}`);
  });

  it("rejects malformed commit identifiers before using them in a redirect", async () => {
    const formData = new FormData();
    formData.set("import_id", "../../settings");
    formData.set("expected_revision", "1");

    await expect(finishMpmbImport(formData)).rejects.toThrow(
      "REDIRECT:/library/import?error=The%20import%20identifier%20is%20invalid.",
    );
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("redirects recoverable commit conflicts back to the review", async () => {
    const formData = new FormData();
    formData.set("import_id", IMPORT_ID);
    formData.set("expected_revision", "2");
    mocks.commit.mockResolvedValue({ status: "conflict", message: "Reload this review." });

    await expect(finishMpmbImport(formData)).rejects.toThrow(
      `REDIRECT:/library/import/${IMPORT_ID}?error=Reload%20this%20review.`,
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("cancels an open review and returns to the library", async () => {
    const formData = new FormData();
    formData.set("import_id", IMPORT_ID);
    mocks.cancel.mockResolvedValue({ status: "success", importId: IMPORT_ID });

    await expect(abandonMpmbImport(formData)).rejects.toThrow("REDIRECT:/library");
    expect(mocks.cancel).toHaveBeenCalledWith(IMPORT_ID);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/library");
  });
});
