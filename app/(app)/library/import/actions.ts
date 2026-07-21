"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  cancelMpmbImport,
  commitMpmbImport,
  repairMpmbImportSpellItem,
  resolveMpmbImportItemConflict,
  setMpmbImportItemSelected,
  stageMpmbImportFile,
  type MpmbImportMutationResult,
} from "@/lib/supabase/mpmb-imports-server";

export type MpmbImportActionState =
  | { status: "idle"; message?: string }
  | MpmbImportMutationResult;

export interface MpmbSpellRepairActionState {
  status: "idle" | "error" | "conflict";
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export interface MpmbImportConflictActionState {
  status: "idle" | "error" | "conflict";
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

const nullableUuid = z.preprocess(
  (value) => value === "" || value === null ? null : value,
  z.string().uuid("Choose a valid replacement.").nullable(),
);

const nullablePositiveInteger = z.preprocess(
  (value) => value === "" || value === null ? null : value,
  z.coerce.number().int().positive().nullable(),
);

const conflictResolutionFormSchema = z.object({
  import_id: z.string().uuid("The import identifier is invalid."),
  item_id: z.string().uuid("The item identifier is invalid."),
  expected_revision: z.coerce.number().int().positive(),
  strategy: z.enum(["keep_both", "replace"], {
    message: "Choose whether to keep both or replace a definition.",
  }),
  target_content_id: nullableUuid,
  target_content_version: nullablePositiveInteger,
}).strict().superRefine((value, context) => {
  const hasTarget = value.target_content_id !== null;
  const hasVersion = value.target_content_version !== null;
  if (value.strategy === "keep_both" && (hasTarget || hasVersion)) {
    context.addIssue({
      code: "custom",
      path: ["strategy"],
      message: "Keep both cannot include a replacement target.",
    });
  }
  if (value.strategy === "replace" && (!hasTarget || !hasVersion)) {
    context.addIssue({
      code: "custom",
      path: ["target_content_id"],
      message: "Choose the exact definition to replace.",
    });
  }
});

const spellRepairFormSchema = z.object({
  import_id: z.string().uuid("The import identifier is invalid."),
  item_id: z.string().uuid("The item identifier is invalid."),
  expected_revision: z.coerce.number().int().positive(),
  repair_material: z.boolean(),
  repair_dc: z.boolean(),
  material: z.string().max(500),
  save_ability: z.string(),
  save_success: z.string(),
}).superRefine((value, context) => {
  if (!value.repair_material && !value.repair_dc) {
    context.addIssue({
      code: "custom",
      path: ["import_id"],
      message: "This item has no supported repair fields.",
    });
  }
  if (value.repair_material && value.material.trim().length === 0) {
    context.addIssue({
      code: "custom",
      path: ["material"],
      message: "Enter the spell's material component.",
    });
  }
  if (
    value.repair_dc
    && ![
      "strength",
      "dexterity",
      "constitution",
      "intelligence",
      "wisdom",
      "charisma",
    ].includes(value.save_ability)
  ) {
    context.addIssue({
      code: "custom",
      path: ["save_ability"],
      message: "Choose the saving throw ability.",
    });
  }
  if (
    value.repair_dc
    && !["half", "none", "other"].includes(value.save_success)
  ) {
    context.addIssue({
      code: "custom",
      path: ["save_success"],
      message: "Choose what happens on a successful save.",
    });
  }
});

export async function startMpmbImport(
  _previousState: MpmbImportActionState,
  formData: FormData,
): Promise<MpmbImportActionState> {
  const result = await stageMpmbImportFile(
    formData.get("file"),
    formData.get("private_use_attestation") === "on",
  );
  if (result.status !== "success") return result;
  redirect(`/library/import/${result.importId}`);
}

export async function toggleMpmbImportItem(
  _previousState: MpmbImportActionState,
  formData: FormData,
): Promise<MpmbImportActionState> {
  const importId = String(formData.get("import_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");
  const expectedRevision = Number(formData.get("expected_revision"));
  const selectedValue = String(formData.get("selected") ?? "");
  if (!["true", "false"].includes(selectedValue)) {
    return { status: "error", message: "The import selection is invalid." };
  }
  const result = await setMpmbImportItemSelected(
    importId,
    itemId,
    selectedValue === "true",
    expectedRevision,
  );
  if (result.status === "success") revalidatePath(`/library/import/${importId}`);
  return result;
}

export async function repairMpmbImportSpell(
  _previousState: MpmbSpellRepairActionState,
  formData: FormData,
): Promise<MpmbSpellRepairActionState> {
  const parsed = spellRepairFormSchema.safeParse({
    import_id: formData.get("import_id"),
    item_id: formData.get("item_id"),
    expected_revision: formData.get("expected_revision"),
    repair_material: formData.get("repair_material") === "true",
    repair_dc: formData.get("repair_dc") === "true",
    material: String(formData.get("material") ?? ""),
    save_ability: String(formData.get("save_ability") ?? ""),
    save_success: String(formData.get("save_success") ?? ""),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Correct the highlighted repair fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const patch = {
    ...(parsed.data.repair_material
      ? { material: parsed.data.material.trim() }
      : {}),
    ...(parsed.data.repair_dc
      ? {
          dc: {
            type: parsed.data.save_ability as
              | "strength"
              | "dexterity"
              | "constitution"
              | "intelligence"
              | "wisdom"
              | "charisma",
            success: parsed.data.save_success as "half" | "none" | "other",
          },
        }
      : {}),
  };
  const result = await repairMpmbImportSpellItem(
    parsed.data.import_id,
    parsed.data.item_id,
    parsed.data.expected_revision,
    patch,
  );
  if (result.status !== "success") {
    return { status: result.status, message: result.message };
  }

  revalidatePath(`/library/import/${parsed.data.import_id}`);
  redirect(`/library/import/${parsed.data.import_id}?repaired=1`);
}

export async function resolveMpmbImportConflict(
  _previousState: MpmbImportConflictActionState,
  formData: FormData,
): Promise<MpmbImportConflictActionState> {
  const parsed = conflictResolutionFormSchema.safeParse({
    import_id: formData.get("import_id"),
    item_id: formData.get("item_id"),
    expected_revision: formData.get("expected_revision"),
    strategy: formData.get("strategy"),
    target_content_id: formData.get("target_content_id"),
    target_content_version: formData.get("target_content_version"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Correct the highlighted conflict choice.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await resolveMpmbImportItemConflict(
    parsed.data.import_id,
    parsed.data.item_id,
    parsed.data.expected_revision,
    parsed.data.strategy,
    parsed.data.target_content_id,
    parsed.data.target_content_version,
  );
  if (result.status !== "success") {
    return { status: result.status, message: result.message };
  }

  const reviewPath = `/library/import/${parsed.data.import_id}`;
  revalidatePath(reviewPath);
  revalidatePath(`${reviewPath}/items/${parsed.data.item_id}/conflict`);
  redirect(`${reviewPath}?resolved=1`);
}

export async function finishMpmbImport(formData: FormData): Promise<void> {
  const importIdResult = z.string().uuid().safeParse(formData.get("import_id"));
  if (!importIdResult.success) {
    redirect("/library/import?error=The%20import%20identifier%20is%20invalid.");
  }
  const importId = importIdResult.data;
  const expectedRevision = Number(formData.get("expected_revision"));
  const result = await commitMpmbImport(importId, expectedRevision);
  if (result.status !== "success") {
    redirect(
      `/library/import/${encodeURIComponent(importId)}?error=${encodeURIComponent(result.message)}`,
    );
  }
  revalidatePath("/library");
  revalidatePath(`/library/import/${importId}`);
  redirect(
    `/library/import/${importId}?committed=${result.importedCount ?? 0}`,
  );
}

export async function abandonMpmbImport(formData: FormData): Promise<void> {
  const importIdResult = z.string().uuid().safeParse(formData.get("import_id"));
  if (!importIdResult.success) {
    redirect("/library/import?error=The%20import%20identifier%20is%20invalid.");
  }
  const importId = importIdResult.data;
  const result = await cancelMpmbImport(importId);
  if (result.status !== "success") {
    redirect(
      `/library/import/${encodeURIComponent(importId)}?error=${encodeURIComponent(result.message)}`,
    );
  }
  revalidatePath("/library");
  redirect("/library");
}
