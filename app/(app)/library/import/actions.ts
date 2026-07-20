"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  cancelMpmbImport,
  commitMpmbImport,
  setMpmbImportItemSelected,
  stageMpmbImportFile,
  type MpmbImportMutationResult,
} from "@/lib/supabase/mpmb-imports-server";

export type MpmbImportActionState =
  | { status: "idle"; message?: string }
  | MpmbImportMutationResult;

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
