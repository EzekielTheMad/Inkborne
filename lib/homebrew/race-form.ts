import { z } from "zod";
import { CREATURE_SIZES } from "@/lib/types/taxonomies";
import type { RaceData } from "@/lib/schemas/content-types/race";

export type HomebrewRaceMetadata = Pick<RaceData,
  "size" | "age_description" | "alignment_description" | "size_description" | "language_description">;
export interface HomebrewRaceFormValue { name: string; metadata: HomebrewRaceMetadata; walkingSpeed?: number }
export type HomebrewRaceFormParseResult =
  | { success: true; data: HomebrewRaceFormValue }
  | { success: false; fieldErrors: Record<string, string[]> };

const metadataSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  size: z.enum(CREATURE_SIZES),
  age_description: z.string().trim().max(20_000),
  alignment_description: z.string().trim().max(20_000),
  size_description: z.string().trim().max(20_000),
  language_description: z.string().trim().max(20_000),
});
const speedSchema = z.string().trim().max(30).transform((value, context) => {
  const speed = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(speed) || speed <= 0) {
    context.addIssue({ code: "custom", message: "Enter a positive whole-number walking speed in feet." });
    return z.NEVER;
  }
  return speed;
});

/** walkingEditable is derived from the server's owned row, not form controls. */
export function mapHomebrewRaceFormData(formData: FormData, walkingEditable: boolean): HomebrewRaceFormParseResult {
  const metadata = metadataSchema.safeParse(Object.fromEntries(
    ["name", "size", "age_description", "alignment_description", "size_description", "language_description"]
      .map((key) => [key, String(formData.get(key) ?? "")]),
  ));
  const speed = walkingEditable ? speedSchema.safeParse(String(formData.get("speed") ?? "")) : null;
  const fieldErrors: Record<string, string[]> = {};
  if (!metadata.success) {
    for (const issue of metadata.error.issues) (fieldErrors[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
  }
  if (speed && !speed.success) fieldErrors.speed = speed.error.issues.map((issue) => issue.message);
  if (!metadata.success || (speed && !speed.success)) return { success: false, fieldErrors };
  const { name, ...fields } = metadata.data;
  return { success: true, data: { name, metadata: fields, ...(speed?.success ? { walkingSpeed: speed.data } : {}) } };
}
