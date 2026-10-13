import { instanceRequestSchema, type InstanceRequest } from "./monster-instance-schema";

// Combined serialized transport bound before JSON parse; never ignore extra controls.
export function instanceIntentFromForm(form: FormData): InstanceRequest {
  let total = 0;
  const values: string[] = [];
  for (const [key, value] of form.entries()) {
    if (typeof value !== "string" || key !== "intent") throw new Error("Unsupported form control");
    total += new TextEncoder().encode(key + value).length;
    if (total > 40960) throw new Error("Command exceeds transport budget");
    values.push(value);
  }
  if (values.length !== 1) throw new Error("One intent is required");
  return instanceRequestSchema.parse(JSON.parse(values[0]));
}
export function instanceIntentForm(intent: InstanceRequest) { const form = new FormData(); form.set("intent", JSON.stringify(intent)); return form; }
