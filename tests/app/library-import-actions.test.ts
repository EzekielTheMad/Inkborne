import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  stage: vi.fn(),
  toggle: vi.fn(),
  repair: vi.fn(),
  repairFeat: vi.fn(),
  resolveConflict: vi.fn(),
  confirmPreview: vi.fn(),
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
  repairMpmbImportSpellItem: mocks.repair,
  repairMpmbImportFeatItem: mocks.repairFeat,
  resolveMpmbImportItemConflict: mocks.resolveConflict,
  confirmOwnedMpmbImportPreview: mocks.confirmPreview,
  commitMpmbImport: mocks.commit,
  cancelMpmbImport: mocks.cancel,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  abandonMpmbImport,
  confirmMpmbImportPreview,
  finishMpmbImport,
  repairMpmbImportSpell,
  repairMpmbImportFeat,
  resolveMpmbImportConflict,
  startMpmbImport,
  toggleMpmbImportItem,
} from "@/app/(app)/homebrew/import/actions";

const IMPORT_ID = "33333333-3333-4333-8333-333333333333";
const ITEM_ID = "44444444-4444-4444-8444-444444444444";
const TARGET_ID = "55555555-5555-4555-8555-555555555555";
const idle = { status: "idle" as const };
const idleRepair = { status: "idle" as const, message: "" };
const idleConflict = { status: "idle" as const, message: "" };

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
      `REDIRECT:/homebrew/import/${IMPORT_ID}`,
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
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/homebrew/import/${IMPORT_ID}`);
  });

  it("returns field errors before invoking an invalid spell repair", async () => {
    const formData = new FormData();
    formData.set("import_id", IMPORT_ID);
    formData.set("item_id", ITEM_ID);
    formData.set("expected_revision", "3");
    formData.set("repair_material", "true");

    await expect(repairMpmbImportSpell(idleRepair, formData)).resolves.toEqual(
      expect.objectContaining({
        status: "error",
        fieldErrors: expect.objectContaining({
          material: expect.arrayContaining([expect.any(String)]),
        }),
      }),
    );
    expect(mocks.repair).not.toHaveBeenCalled();
  });

  it("submits only supported repair fields, revalidates, then redirects", async () => {
    const formData = new FormData();
    formData.set("import_id", IMPORT_ID);
    formData.set("item_id", ITEM_ID);
    formData.set("expected_revision", "3");
    formData.set("repair_material", "true");
    formData.set("repair_dc", "true");
    formData.set("material", "  a silver thread  ");
    formData.set("save_ability", "wisdom");
    formData.set("save_success", "half");
    formData.set("repair_concentration", "true");
    formData.set("repair_ritual", "true");
    formData.set("concentration", "false");
    formData.set("ritual", "true");
    mocks.repair.mockResolvedValue({
      status: "success",
      importId: IMPORT_ID,
    });

    await expect(repairMpmbImportSpell(idleRepair, formData)).rejects.toThrow(
      `REDIRECT:/homebrew/import/${IMPORT_ID}?repaired=1`,
    );
    expect(mocks.repair).toHaveBeenCalledWith(IMPORT_ID, ITEM_ID, 3, {
      material: "a silver thread",
      dc: { type: "wisdom", success: "half" },
      concentration: false,
      ritual: true,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/homebrew/import/${IMPORT_ID}`,
    );
    expect(mocks.revalidatePath.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.redirect.mock.invocationCallOrder[0],
    );
  });

  it("requires an explicit Yes or No for diagnosed spell booleans", async () => {
    const formData = new FormData();
    formData.set("import_id", IMPORT_ID);
    formData.set("item_id", ITEM_ID);
    formData.set("expected_revision", "3");
    formData.set("repair_concentration", "true");

    await expect(repairMpmbImportSpell(idleRepair, formData)).resolves.toEqual(
      expect.objectContaining({
        status: "error",
        fieldErrors: expect.objectContaining({
          concentration: expect.arrayContaining([expect.any(String)]),
        }),
      }),
    );
    expect(mocks.repair).not.toHaveBeenCalled();
  });

  it("submits a strict finite feat repair without trusting browser patch data", async () => {
    const formData = new FormData();
    formData.set("import_id", IMPORT_ID);
    formData.set("item_id", ITEM_ID);
    formData.set("expected_revision", "5");
    formData.set("repair_prerequisites", "true");
    formData.set("repair_action", "true");
    formData.set("repair_recovery", "true");
    formData.set("repair_spellcasting_ability", "true");
    formData.set("prerequisite_ability", "dexterity");
    formData.set("prerequisite_minimum", "13");
    formData.set("action", "bonus action");
    formData.set("recovery", "long rest");
    formData.set("spellcasting_ability", "charisma");
    formData.set("candidate_data", JSON.stringify({ secret: "must-not-cross" }));
    formData.set("diagnostic_code", "feat.action.invalid");
    mocks.repairFeat.mockResolvedValue({
      status: "success",
      importId: IMPORT_ID,
    });

    await expect(repairMpmbImportFeat(idleRepair, formData)).rejects.toThrow(
      `REDIRECT:/homebrew/import/${IMPORT_ID}?repaired=1`,
    );
    expect(mocks.repairFeat).toHaveBeenCalledWith(IMPORT_ID, ITEM_ID, 5, {
      prerequisites: [{ stat: "dexterity", op: "gte", value: 13 }],
      action: "bonus action",
      recovery: "long rest",
      spellcastingAbility: "charisma",
    });
    expect(JSON.stringify(mocks.repairFeat.mock.calls)).not.toContain(
      "must-not-cross",
    );
    expect(mocks.revalidatePath.mock.invocationCallOrder.at(-1)).toBeLessThan(
      mocks.redirect.mock.invocationCallOrder.at(-1)!,
    );
  });

  it("supports clearing optional feat repairs and rejects partial prerequisites", async () => {
    const partial = new FormData();
    partial.set("import_id", IMPORT_ID);
    partial.set("item_id", ITEM_ID);
    partial.set("expected_revision", "5");
    partial.set("repair_prerequisites", "true");
    partial.set("prerequisite_ability", "wisdom");

    await expect(repairMpmbImportFeat(idleRepair, partial)).resolves.toEqual(
      expect.objectContaining({
        status: "error",
        fieldErrors: expect.objectContaining({
          prerequisite_minimum: expect.arrayContaining([expect.any(String)]),
        }),
      }),
    );
    expect(mocks.repairFeat).not.toHaveBeenCalled();

    const clear = new FormData();
    clear.set("import_id", IMPORT_ID);
    clear.set("item_id", ITEM_ID);
    clear.set("expected_revision", "5");
    clear.set("repair_prerequisites", "true");
    clear.set("repair_action", "true");
    clear.set("repair_recovery", "true");
    clear.set("repair_spellcasting_ability", "true");
    mocks.repairFeat.mockResolvedValue({
      status: "conflict",
      message: "This import changed in another session. Reload and try again.",
    });

    await expect(repairMpmbImportFeat(idleRepair, clear)).resolves.toEqual({
      status: "conflict",
      message: "This import changed in another session. Reload and try again.",
    });
    expect(mocks.repairFeat).toHaveBeenLastCalledWith(IMPORT_ID, ITEM_ID, 5, {
      prerequisites: [],
      action: null,
      recovery: null,
      spellcastingAbility: null,
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects feat values outside the finite UI enums", async () => {
    const formData = new FormData();
    formData.set("import_id", IMPORT_ID);
    formData.set("item_id", ITEM_ID);
    formData.set("expected_revision", "5");
    formData.set("repair_action", "true");
    formData.set("action", "legendary action");

    await expect(repairMpmbImportFeat(idleRepair, formData)).resolves.toEqual(
      expect.objectContaining({
        status: "error",
        fieldErrors: expect.objectContaining({
          action: expect.arrayContaining([expect.any(String)]),
        }),
      }),
    );
    expect(mocks.repairFeat).not.toHaveBeenCalled();
  });

  it("returns a stale repair conflict without revalidating", async () => {
    const formData = new FormData();
    formData.set("import_id", IMPORT_ID);
    formData.set("item_id", ITEM_ID);
    formData.set("expected_revision", "2");
    formData.set("repair_material", "true");
    formData.set("material", "a silver thread");
    mocks.repair.mockResolvedValue({
      status: "conflict",
      message: "This import changed in another session. Reload and try again.",
    });

    await expect(repairMpmbImportSpell(idleRepair, formData)).resolves.toEqual({
      status: "conflict",
      message: "This import changed in another session. Reload and try again.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects malformed conflict choices before invoking the data layer", async () => {
    const formData = new FormData();
    formData.set("import_id", IMPORT_ID);
    formData.set("item_id", ITEM_ID);
    formData.set("expected_revision", "3");
    formData.set("strategy", "merge");
    formData.set("target_content_id", "not-a-uuid");
    formData.set("target_content_version", "0");

    await expect(
      resolveMpmbImportConflict(idleConflict, formData),
    ).resolves.toMatchObject({ status: "error", fieldErrors: expect.any(Object) });
    expect(mocks.resolveConflict).not.toHaveBeenCalled();
  });

  it("accepts only the documented conflict FormData field names", async () => {
    const formData = new FormData();
    formData.set("import_id", IMPORT_ID);
    formData.set("item_id", ITEM_ID);
    formData.set("expected_revision", "3");
    formData.set("resolution", "replace");
    formData.set("replacement_content_id", TARGET_ID);
    formData.set("replacement_expected_version", "7");

    await expect(
      resolveMpmbImportConflict(idleConflict, formData),
    ).resolves.toMatchObject({ status: "error" });
    expect(mocks.resolveConflict).not.toHaveBeenCalled();
  });

  it("submits only exact replacement identity, revalidates, then redirects", async () => {
    const formData = new FormData();
    formData.set("import_id", IMPORT_ID);
    formData.set("item_id", ITEM_ID);
    formData.set("expected_revision", "3");
    formData.set("strategy", "replace");
    formData.set("target_content_id", TARGET_ID);
    formData.set("target_content_version", "7");
    formData.set("candidate_data", JSON.stringify({ secret: "must-not-cross" }));
    mocks.resolveConflict.mockResolvedValue({
      status: "success",
      importId: IMPORT_ID,
    });

    await expect(
      resolveMpmbImportConflict(idleConflict, formData),
    ).rejects.toThrow(`REDIRECT:/homebrew/import/${IMPORT_ID}?resolved=1`);
    expect(mocks.resolveConflict).toHaveBeenCalledWith(
      IMPORT_ID,
      ITEM_ID,
      3,
      "replace",
      TARGET_ID,
      7,
    );
    expect(JSON.stringify(mocks.resolveConflict.mock.calls)).not.toContain(
      "must-not-cross",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/homebrew/import/${IMPORT_ID}`,
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/homebrew/import/${IMPORT_ID}/items/${ITEM_ID}/conflict`,
    );
    expect(mocks.revalidatePath.mock.invocationCallOrder.at(-1)).toBeLessThan(
      mocks.redirect.mock.invocationCallOrder.at(-1)!,
    );
  });

  it("submits keep-both without trusting a replacement target", async () => {
    const formData = new FormData();
    formData.set("import_id", IMPORT_ID);
    formData.set("item_id", ITEM_ID);
    formData.set("expected_revision", "3");
    formData.set("strategy", "keep_both");
    mocks.resolveConflict.mockResolvedValue({
      status: "conflict",
      message: "This import changed in another session. Reload and try again.",
    });

    await expect(
      resolveMpmbImportConflict(idleConflict, formData),
    ).resolves.toEqual({
      status: "conflict",
      message: "This import changed in another session. Reload and try again.",
    });
    expect(mocks.resolveConflict).toHaveBeenCalledWith(
      IMPORT_ID,
      ITEM_ID,
      3,
      "keep_both",
      null,
      null,
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
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
      `REDIRECT:/homebrew/import/${IMPORT_ID}?committed=2`,
    );
    expect(mocks.commit).toHaveBeenCalledWith(IMPORT_ID, 4);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/homebrew");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/library");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/homebrew/import/${IMPORT_ID}`);
  });

  it("confirms only an exact preview revision, revalidates, then returns to review", async () => {
    const formData = new FormData();
    formData.set("import_id", IMPORT_ID);
    formData.set("expected_revision", "4");
    mocks.confirmPreview.mockResolvedValue({
      status: "success",
      importId: IMPORT_ID,
    });

    await expect(confirmMpmbImportPreview(formData)).rejects.toThrow(
      `REDIRECT:/homebrew/import/${IMPORT_ID}?previewed=1`,
    );
    expect(mocks.confirmPreview).toHaveBeenCalledWith(IMPORT_ID, 4);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/homebrew/import/${IMPORT_ID}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/homebrew/import/${IMPORT_ID}/preview`,
    );
  });

  it("returns preview conflicts to the preview route without revalidating", async () => {
    const formData = new FormData();
    formData.set("import_id", IMPORT_ID);
    formData.set("expected_revision", "3");
    mocks.confirmPreview.mockResolvedValue({
      status: "conflict",
      message: "Reload and preview again.",
    });

    await expect(confirmMpmbImportPreview(formData)).rejects.toThrow(
      `REDIRECT:/homebrew/import/${IMPORT_ID}/preview?error=Reload%20and%20preview%20again.`,
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects malformed commit identifiers before using them in a redirect", async () => {
    const formData = new FormData();
    formData.set("import_id", "../../settings");
    formData.set("expected_revision", "1");

    await expect(finishMpmbImport(formData)).rejects.toThrow(
      "REDIRECT:/homebrew/import?error=The%20import%20identifier%20is%20invalid.",
    );
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("redirects recoverable commit conflicts back to the review", async () => {
    const formData = new FormData();
    formData.set("import_id", IMPORT_ID);
    formData.set("expected_revision", "2");
    mocks.commit.mockResolvedValue({ status: "conflict", message: "Reload this review." });

    await expect(finishMpmbImport(formData)).rejects.toThrow(
      `REDIRECT:/homebrew/import/${IMPORT_ID}?error=Reload%20this%20review.`,
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("cancels an open review and returns to the library", async () => {
    const formData = new FormData();
    formData.set("import_id", IMPORT_ID);
    mocks.cancel.mockResolvedValue({ status: "success", importId: IMPORT_ID });

    await expect(abandonMpmbImport(formData)).rejects.toThrow("REDIRECT:/homebrew");
    expect(mocks.cancel).toHaveBeenCalledWith(IMPORT_ID);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/homebrew");
  });
});
