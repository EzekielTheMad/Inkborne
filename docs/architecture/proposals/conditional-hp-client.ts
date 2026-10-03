/** REVIEW-ONLY executable contract. No production imports, Supabase client or RPC calls.
 * Connect only after approved SQL, generated types and UI/provider integration. */
import { z } from "zod";

const persistedState = z.record(z.string(), z.json());
const reply = z.array(z.discriminatedUnion("status", [
  z.object({ status: z.literal("applied"), resulting_state: persistedState }).strict(),
  z.object({ status: z.literal("conflict"), resulting_state: persistedState }).strict(),
  z.object({ status: z.literal("missing"), resulting_state: z.null() }).strict(),
])).length(1);
export type PersistedState = z.infer<typeof persistedState>;
export interface ConditionalStateRequest {
  character_id: string;
  expected_state: PersistedState;
  state_patch: PersistedState;
}
export type ConditionalStateTransport = (request: ConditionalStateRequest) => Promise<unknown>;
export type ConditionalHpResult =
  | { status: "applied"; state: PersistedState }
  | { status: "conflict" | "missing" | "uncertain"; message: string; reloadRequired: true };

/** Capture the exact confirmed raw snapshot before computing the HP patch.
 * Failure never retries, recomputes damage/healing, or reports successful action. */
export async function submitConditionalHpProposal(
  transport: ConditionalStateTransport,
  request: ConditionalStateRequest,
): Promise<ConditionalHpResult> {
  try {
    const [result] = reply.parse(await transport(request));
    if (result.status === "applied") return { status: "applied", state: result.resulting_state };
    if (result.status === "conflict") return {
      status: "conflict", reloadRequired: true,
      message: "This character changed in another tab. Reload before choosing a new HP action. This action was not applied.",
    };
    return { status: "missing", reloadRequired: true,
      message: "This character could not be updated. Reload to check access before choosing another action." };
  } catch {
    // Includes network loss after commit and malformed response: cannot prove no commit.
    return { status: "uncertain", reloadRequired: true,
      message: "The HP save could not be confirmed. Reload and check the result before choosing another action.",
    };
  }
}
