"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  listUsableFeatsForCharacter,
  setCharacterAsiChoiceRecord,
  type SetCharacterAsiChoiceResult,
} from "@/lib/supabase/feat-selection-server";
import type { UsableFeatOption } from "@/lib/types/character";
import { syncClassFeatureRefs } from "@/lib/supabase/feature-refs-server";
import { getContentRefsByCharacter, type ContentRefWithContent } from "@/lib/supabase/content-refs";
import { createClient } from "@/lib/supabase/server";

const allocationSchema = z.object({
  ability: z.enum([
    "strength",
    "dexterity",
    "constitution",
    "intelligence",
    "wisdom",
    "charisma",
  ]),
  amount: z.union([z.literal(1), z.literal(2)]),
}).strict();

const asiChoiceSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("asi"),
    allocations: z.array(allocationSchema).min(1).max(2),
  }).strict(),
  z.object({
    mode: z.literal("feat"),
    featId: z.string().uuid(),
    featVersion: z.number().int().positive(),
  }).strict(),
]);

const inputSchema = z.object({
  characterId: z.string().uuid(),
  featureSlug: z.string().trim().min(1).max(200),
  choice: asiChoiceSchema,
}).strict();

const searchInputSchema = z.object({
  characterId: z.string().uuid(),
  featureSlug: z.string().trim().min(1).max(200),
  query: z.string().max(200),
}).strict();

export type SearchUsableFeatsActionResult =
  | { status: "success"; feats: UsableFeatOption[] }
  | { status: "error"; message: string };

export async function searchUsableFeatsAction(
  input: unknown,
): Promise<SearchUsableFeatsActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "Sign in before searching for feats." };
  }

  const parsed = searchInputSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "This feat search is invalid." };
  }

  try {
    const feats = await listUsableFeatsForCharacter(
      parsed.data.characterId,
      parsed.data.query,
      parsed.data.featureSlug,
    );
    return { status: "success", feats };
  } catch {
    return {
      status: "error",
      message: "Available feats could not be loaded. Please try again.",
    };
  }
}

export async function setCharacterAsiChoiceAction(
  input: unknown,
): Promise<SetCharacterAsiChoiceResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      status: "error",
      code: "unauthorized",
      message: "Sign in before changing this character.",
    };
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      code: "invalid",
      message: "This Ability Score Improvement choice is invalid.",
    };
  }

  const result = await setCharacterAsiChoiceRecord(parsed.data);
  if (result.status === "success") {
    revalidatePath(`/characters/${parsed.data.characterId}/builder/class`);
    revalidatePath(`/characters/${parsed.data.characterId}`);
  }
  return result;
}


/** Restore exact feature versions from existing immutable grants. Never infer a
 * lost class pin or rewrite a valid historical version from the current catalog. */
export async function reconcileClassFeatureRefsAction(input: unknown): Promise<
  { status: "success"; refs: ContentRefWithContent[] } | { status: "error"; message: string }
> {
  const parsed = z.object({ characterId: z.string().uuid() }).strict().safeParse(input);
  if (!parsed.success) return { status: "error", message: "This character reference request is invalid." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Sign in before restoring saved class features." };
  try {
    // Existing RPC verifies owner authorization and preserves active grant pins.
    await syncClassFeatureRefs(supabase, { characterId: parsed.data.characterId });
    const refs = await getContentRefsByCharacter(parsed.data.characterId);
    revalidatePath(`/characters/${parsed.data.characterId}/builder`);
    revalidatePath(`/characters/${parsed.data.characterId}`);
    return { status: "success", refs };
  } catch {
    return { status: "error", message: "Saved class features could not be restored. Please try again." };
  }
}
