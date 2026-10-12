import { z } from "zod";

export const FEATURE_TRANSPORT_MAX_BYTES = 131_072;
export const FEATURE_VERSION_MAX = 2_147_483_647;
export const featureVersionSchema = z.number().int().min(1).max(FEATURE_VERSION_MAX);
export const FEATURE_CREATE_UNCERTAIN_MESSAGE = "The save could not be confirmed. Your draft is kept. Check Homebrew before creating again; the feature may already have saved.";
export const FEATURE_EDIT_UNCERTAIN_MESSAGE = "The save could not be confirmed. Your draft is kept. Reload this feature before saving again.";

const feedbackSchema = z.strictObject({
  status: z.enum(["idle", "error", "conflict", "uncertain"]),
  message: z.string().max(1_000).optional(),
  fieldErrors: z.record(z.string().max(100), z.array(z.string().max(200)).max(3))
    .refine(fields => Object.keys(fields).length <= 20).optional(),
});
export const featureActionStateSchema = z.union([
  feedbackSchema,
  z.strictObject({ status: z.literal("saved"), id: z.string().uuid(), version: featureVersionSchema, operation: z.enum(["create", "edit"]) }),
  z.strictObject({ status: z.literal("unchanged"), id: z.string().uuid(), version: featureVersionSchema, message: z.literal("No changes to save.") }),
]);
export type FeatureActionState = z.infer<typeof featureActionStateSchema>;
export type FeatureFeedback = z.infer<typeof feedbackSchema>;
export function featureUncertainty(mode: "create" | "edit"): FeatureFeedback {
  return { status: "uncertain", message: mode === "create" ? FEATURE_CREATE_UNCERTAIN_MESSAGE : FEATURE_EDIT_UNCERTAIN_MESSAGE };
}

const nonblank = (maximum: number, label: string) => z.string().min(1, `${label} is required.`).max(maximum)
  .refine(value => value.trim().length > 0, `${label} must contain a non-whitespace character.`);
const details = { name: nonblank(100, "Name"), description: nonblank(20_000, "Description") };
const associationSlug = z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Enter an unverified lowercase slug using letters, numbers and single hyphens.");
const createSchema = z.strictObject({ ...details, class: associationSlug,
  subclass: z.union([associationSlug, z.literal("")]).transform(value => value === "" ? null : value),
  level: z.string().regex(/^(?:[1-9]|1\d|20)$/, "Enter a whole gain level from 1 to 20.").transform(Number),
});
const editSchema = z.strictObject({ ...details, id: z.string().uuid(),
  expected_version: z.string().regex(/^[1-9]\d{0,9}$/, "Enter the stored positive decimal version.").transform(Number).pipe(featureVersionSchema),
});
export interface PassiveFeatureCreateValue { name: string; description: string; class: string; subclass: string | null; level: number }
export interface PassiveFeatureEditValue { name: string; description: string; id: string; expected_version: number }
type Result<T> = { success: true; data: T } | { success: false; fieldErrors: Record<string, string[]> };

function controls(form: FormData, keys: string[]): Result<Record<string, string>> {
  const values: Record<string, string> = {}, fieldErrors: Record<string, string[]> = {};
  // Framework-owned action metadata is not an authored/authority control.
  if ([...form.keys()].some(key => !keys.includes(key) && !key.startsWith("$ACTION_"))) fieldErrors.form = ["Only this form's named controls are accepted. Association, mechanics and authority cannot be changed here."];
  for (const key of keys) {
    const entries = form.getAll(key);
    if (entries.length !== 1 || typeof entries[0] !== "string") fieldErrors[key] = ["Submit exactly one text value for this control."];
    else values[key] = entries[0];
  }
  if (Object.keys(fieldErrors).length) return { success: false, fieldErrors };
  // Cumulative UTF-8 control budget, BEFORE numeric/schema parsing. Not total HTTP overhead.
  if (keys.reduce((bytes, key) => bytes + new TextEncoder().encode(values[key]).byteLength, 0) > FEATURE_TRANSPORT_MAX_BYTES) {
    return { success: false, fieldErrors: { form: ["Combined control values exceed the 128 KiB UTF-8 limit."] } };
  }
  return { success: true, data: values };
}
function boundedErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const errors = result[String(issue.path[0] ?? "form")] ??= [];
    if (errors.length < 3) errors.push(issue.message.slice(0, 200));
  }
  return result;
}
export function mapPassiveFeatureCreate(form: FormData): Result<PassiveFeatureCreateValue> {
  const raw = controls(form, ["name", "description", "class", "subclass", "level"]);
  if (!raw.success) return raw;
  const parsed = createSchema.safeParse(raw.data);
  return parsed.success ? { success: true, data: parsed.data } : { success: false, fieldErrors: boundedErrors(parsed.error) };
}
export function mapPassiveFeatureEdit(form: FormData): Result<PassiveFeatureEditValue> {
  const raw = controls(form, ["name", "description", "id", "expected_version"]);
  if (!raw.success) return raw;
  const parsed = editSchema.safeParse(raw.data);
  return parsed.success ? { success: true, data: parsed.data } : { success: false, fieldErrors: boundedErrors(parsed.error) };
}

/** Client correlation only; server authentication/CAS remain the authority. */
export function acceptFeatureActionResponse(response: unknown, mode: "create" | "edit", expected?: { id: string; version: number }): FeatureActionState {
  const parsed = featureActionStateSchema.safeParse(response);
  if (!parsed.success || parsed.data.status === "idle") return featureUncertainty(mode);
  const result = parsed.data;
  if (result.status !== "saved" && result.status !== "unchanged" && (!result.message?.trim() || (mode === "create" && result.status === "conflict"))) return featureUncertainty(mode);
  if (result.status === "saved" && (result.operation !== mode || (mode === "create" ? result.version !== 1
    : !expected || result.id !== expected.id || result.version !== expected.version + 1))) return featureUncertainty(mode);
  if (result.status === "unchanged" && (mode !== "edit" || !expected || result.id !== expected.id || result.version !== expected.version)) return featureUncertainty(mode);
  return result;
}
