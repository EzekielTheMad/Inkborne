import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { MonsterFormState } from "@/lib/homebrew/monster-form";

export const MONSTER_ACTION_UNCERTAIN_MESSAGE = "The save could not be confirmed. Your draft is retained. Check Homebrew before trying again.";
const responseSchema = z.strictObject({
  status: z.enum(["idle", "error", "conflict"]),
  message: z.string().min(1).max(1_000),
  fieldErrors: z.record(z.string().max(120), z.array(z.string().max(200)).max(3))
    .refine((fields) => Object.keys(fields).length <= 40).optional(),
});
const uncertain = (): MonsterFormState => ({ status: "error", message: MONSTER_ACTION_UNCERTAIN_MESSAGE });

/** A client response boundary, not confirmation of database rollback or a retry.
 * Confirmed saves navigate using the existing server redirect. Next's own
 * control-flow exceptions must escape this catch, including nested causes. */
export async function guardMonsterActionResponse(invoke: () => Promise<unknown>): Promise<MonsterFormState> {
  try {
    const parsed = responseSchema.safeParse(await invoke());
    return parsed.success ? parsed.data : uncertain();
  } catch (error) {
    unstable_rethrow(error);
    return uncertain();
  }
}
