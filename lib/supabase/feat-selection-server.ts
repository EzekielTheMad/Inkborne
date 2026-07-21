import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type {
  AsiChoice,
  CharacterChoices,
  UsableFeatOption,
} from "@/lib/types/character";

const abilitySchema = z.enum([
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
]);

const asiChoiceInputSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("asi"),
    allocations: z.array(z.object({
      ability: abilitySchema,
      amount: z.union([z.literal(1), z.literal(2)]),
    })).min(1).max(2),
  }),
  z.object({
    mode: z.literal("feat"),
    featId: z.string().uuid(),
    featVersion: z.number().int().positive(),
    featName: z.string().optional(),
  }),
]);

const savedAsiChoiceSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("asi"),
    allocations: z.array(z.object({
      ability: abilitySchema,
      amount: z.union([z.literal(1), z.literal(2)]),
    })).min(1).max(2),
  }),
  z.object({
    mode: z.literal("feat"),
    featId: z.string().uuid(),
    featVersion: z.number().int().positive(),
    featName: z.string().min(1),
  }),
]);

const usableFeatRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  version: z.number().int().positive(),
  source: z.enum(["platform", "homebrew", "imported"]),
  scope: z.enum(["platform", "personal", "shared"]),
  prerequisite_met: z.boolean(),
  prerequisite_reason: z.string().nullable(),
});

const characterChoicesSchema = z.record(z.string(), z.unknown());

const choiceMutationRowSchema = z.object({
  saved_feature_slug: z.string().min(1),
  saved_choice: savedAsiChoiceSchema,
  saved_choices: characterChoicesSchema,
});

type AsiChoiceInput =
  | Extract<AsiChoice, { mode: "asi" }>
  | (Omit<Extract<AsiChoice, { mode: "feat" }>, "featName"> & {
      featName?: string;
    });

export interface SetCharacterAsiChoiceInput {
  characterId: string;
  featureSlug: string;
  choice: AsiChoiceInput;
}

export type SetCharacterAsiChoiceResult =
  | {
      status: "success";
      featureSlug: string;
      choice: AsiChoice;
      choices: CharacterChoices;
    }
  | {
      status: "error";
      code: "unauthorized" | "invalid" | "conflict" | "unavailable";
      message: string;
    };

function parseUsableFeat(value: unknown): UsableFeatOption {
  const row = usableFeatRowSchema.parse(value);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    version: row.version,
    source: row.source,
    scope: row.scope,
    prerequisiteMet: row.prerequisite_met,
    prerequisiteReason: row.prerequisite_reason,
  };
}

function mutationFailure(error: { code?: string; message?: string } | null): SetCharacterAsiChoiceResult {
  const safeMessage = error?.message?.trim() || "The ASI choice could not be saved.";
  if (error?.code === "40001") {
    return { status: "error", code: "conflict", message: safeMessage };
  }
  if (error?.code === "42501") {
    return { status: "error", code: "unauthorized", message: safeMessage };
  }
  if (error?.code === "22023" || error?.code === "23514") {
    return { status: "error", code: "invalid", message: safeMessage };
  }
  if (error?.code === "P0001") {
    return { status: "error", code: "unavailable", message: safeMessage };
  }
  return {
    status: "error",
    code: "unavailable",
    message: "The ASI choice could not be saved. Please try again.",
  };
}

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return supabase;
}

/**
 * Return the current feat versions usable by this exact owned character.
 * Campaign access and prerequisite results are derived inside the RPC.
 */
export async function listUsableFeatsForCharacter(
  characterId: string,
  search = "",
  featureSlug?: string,
): Promise<UsableFeatOption[]> {
  const input = z.object({
    characterId: z.string().uuid(),
    search: z.string().max(200),
    featureSlug: z.string().trim().min(1).max(200).optional(),
  }).safeParse({ characterId, search, featureSlug });
  if (!input.success) throw new Error("The character or feat search is invalid.");

  const supabase = await authenticatedClient();
  if (!supabase) throw new Error("Authentication required.");

  const { data, error } = await supabase.rpc("search_usable_feats_for_character", {
    target_character_id: input.data.characterId,
    search_query: input.data.search,
    result_limit: 50,
    target_feature_slug: input.data.featureSlug ?? null,
  });
  if (error) throw new Error("Usable feats could not be loaded.");

  return z.array(usableFeatRowSchema).parse(data ?? []).map(parseUsableFeat);
}

/**
 * Persist one complete ASI-or-feat decision through the transaction boundary.
 * `featName` from the caller is ignored; the database snapshots the live name.
 */
export async function setCharacterAsiChoiceRecord(
  input: SetCharacterAsiChoiceInput,
): Promise<SetCharacterAsiChoiceResult> {
  const identity = z.object({
    characterId: z.string().uuid(),
    featureSlug: z.string().trim().min(1).max(200),
  }).safeParse(input);
  const choice = asiChoiceInputSchema.safeParse(input.choice);
  if (!identity.success || !choice.success) {
    return {
      status: "error",
      code: "invalid",
      message: "Choose a complete Ability Score Improvement or feat.",
    };
  }

  const supabase = await authenticatedClient();
  if (!supabase) {
    return {
      status: "error",
      code: "unauthorized",
      message: "Sign in before changing this character.",
    };
  }

  const rpcInput = choice.data.mode === "feat"
    ? {
        target_character_id: identity.data.characterId,
        target_feature_slug: identity.data.featureSlug,
        choice_mode: choice.data.mode,
        ability_allocations: null,
        target_feat_id: choice.data.featId,
        target_feat_version: choice.data.featVersion,
      }
    : {
        target_character_id: identity.data.characterId,
        target_feature_slug: identity.data.featureSlug,
        choice_mode: choice.data.mode,
        ability_allocations: choice.data.allocations,
        target_feat_id: null,
        target_feat_version: null,
      };
  const { data, error } = await supabase.rpc("set_character_asi_choice", rpcInput);
  if (error) return mutationFailure(error);

  const candidate = Array.isArray(data) ? data[0] : data;
  const parsed = choiceMutationRowSchema.safeParse(candidate);
  if (!parsed.success || parsed.data.saved_feature_slug !== identity.data.featureSlug) {
    return {
      status: "error",
      code: "unavailable",
      message: "The database returned an invalid ASI choice result.",
    };
  }

  return {
    status: "success",
    featureSlug: parsed.data.saved_feature_slug,
    choice: parsed.data.saved_choice,
    choices: parsed.data.saved_choices as CharacterChoices,
  };
}
