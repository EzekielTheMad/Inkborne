import { z } from "zod";

export const homebrewTraitVersionSchema = z.number().int().min(1).max(2_147_483_647);
export const TRAIT_UNCERTAIN_MESSAGE = "The save could not be confirmed. Your draft is kept. Check your private Homebrew traits before creating again; the trait may already have saved.";

const feedbackSchema = z.object({
  status: z.enum(["idle", "error", "conflict", "uncertain"]),
  message: z.string().optional(),
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
}).strict();
export const homebrewTraitActionStateSchema = z.union([
  feedbackSchema,
  z.object({ status: z.literal("saved"), id: z.string().uuid() }).strict(),
]);
export type HomebrewTraitActionState = z.infer<typeof homebrewTraitActionStateSchema>;

const usesSchema = z.string().trim().transform((value, context) => {
  if (!value) return undefined;
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 0) {
    context.addIssue({ code: "custom", message: "Enter a nonnegative whole number no greater than 9007199254740991." });
    return z.NEVER;
  }
  return number;
});
const detailsSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  description: z.string().trim().min(1, "Description is required.").max(20_000),
});
const resourceSchema = z.object({
  usages: usesSchema,
  recovery: z.enum(["", "short rest", "long rest"]).transform(value => value || null),
}).superRefine((value, context) => {
  if (value.usages === undefined && value.recovery !== null) context.addIssue({ code: "custom", path: ["usages"], message: "Enter uses with the recovery, or choose None." });
  if (value.usages !== undefined && value.usages > 0 && value.recovery === null) context.addIssue({ code: "custom", path: ["recovery"], message: "Choose short or long rest for positive uses." });
});
export interface TraitResourceControls { usages?: number; recovery: "short rest" | "long rest" | null }
export interface HomebrewTraitFormValue { name: string; description: string; resource?: TraitResourceControls }
export type HomebrewTraitFormResult =
  | { success: true; data: HomebrewTraitFormValue }
  | { success: false; fieldErrors: Record<string, string[]> };

function field(form: FormData, key: string): unknown {
  const entries = form.getAll(key);
  return entries.length === 0 ? "" : entries.length === 1 && typeof entries[0] === "string" ? entries[0] : entries;
}
function errors(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) (fields[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
  return fields;
}
/** Only named authored controls are read. Locked resource input is ignored. */
export function mapHomebrewTraitFormData(form: FormData, resourceEditable: boolean): HomebrewTraitFormResult {
  const details = detailsSchema.safeParse({ name: field(form, "name"), description: field(form, "description") });
  const resource = resourceEditable ? resourceSchema.safeParse({ usages: field(form, "usages"), recovery: field(form, "recovery") }) : null;
  if (!details.success || (resource && !resource.success)) return { success: false,
    fieldErrors: { ...(!details.success ? errors(details.error) : {}), ...(resource && !resource.success ? errors(resource.error) : {}) } };
  return { success: true, data: { ...details.data, ...(resource?.success ? { resource: resource.data } : {}) } };
}

/** Editing eligibility is a subset check, never provenance or authorization. */
export function inspectTraitResourceEditability(raw: Record<string, unknown>): boolean {
  const uses = raw.usages;
  const recovery = raw.recovery ?? null;
  if (uses === undefined) return recovery === null;
  if (typeof uses !== "number" || !Number.isSafeInteger(uses) || uses < 0) return false;
  return recovery === "short rest" || recovery === "long rest" || (uses === 0 && recovery === null);
}

/** Overlay only deliberately changed controls; preserve absent/null/zero keys. */
export function overlayTraitResourceControls(raw: Record<string, unknown>, controls: TraitResourceControls): Record<string, unknown> {
  const merged = { ...raw };
  if (controls.usages !== raw.usages) {
    if (controls.usages === undefined) delete merged.usages;
    else merged.usages = controls.usages;
  }
  if (controls.recovery !== (raw.recovery ?? null)) merged.recovery = controls.recovery;
  return merged;
}
