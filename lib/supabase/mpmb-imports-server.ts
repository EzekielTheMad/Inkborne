import "server-only";

import { createHash } from "node:crypto";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { z } from "zod";

import { mapParsedMpmbSource } from "@/lib/import/mpmb/map";
import { parseMpmbSource } from "@/lib/import/mpmb/parser";
import {
  buildMpmbCalculationPreview,
  type MpmbCalculationPreview,
  type MpmbPreviewCandidate,
  type MpmbPreviewItem,
} from "@/lib/import/mpmb/preview";
import {
  DEFAULT_MPMB_PARSER_LIMITS,
  MPMB_PARSER_VERSION,
  MpmbParseError,
} from "@/lib/import/mpmb/types";
import {
  featDataSchema,
  type FeatData,
} from "@/lib/schemas/content-types/feat";
import {
  spellDataSchema,
  type SpellData,
} from "@/lib/schemas/content-types/spell";
import { effectSchema } from "@/lib/schemas/effects";
import { systemSchemaDefinitionSchema } from "@/lib/schemas/system";
import type { Database, Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const HOMEBREW_SYSTEM_SLUG = "dnd-5e-2014";
const PRIVATE_USE_ATTESTATION = "private_use_v1";
const ALLOWED_EXTENSIONS = [".js", ".mpmb"];
const MATERIAL_REPAIR_CODE = "spell.material.required";
const SAVE_REPAIR_CODE = "spell.save.success_unknown";
const SPELL_SAVE_ABILITIES = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const;

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type MpmbImportMutationResult =
  | { status: "success"; importId: string; importedCount?: number }
  | { status: "error" | "conflict"; message: string };

export type MpmbImportConflictResolution = "keep_both" | "replace";

export interface MpmbImportConflictTarget {
  id: string;
  name: string;
  version: number;
  scope: "personal" | "shared";
  sharedCampaignCount: number;
  previouslyImported: boolean;
  replaceable: boolean;
}

export interface MpmbImportReviewItem {
  id: string;
  ordinal: number;
  registry: "SpellsList" | "FeatsList";
  sourceKey: string;
  contentType: "spell" | "feat";
  location: { line: number; column: number };
  mappingStatus: "valid" | "needs_info" | "unsupported";
  candidateName: string | null;
  selected: boolean;
  committedContentId: string | null;
  repairable: boolean;
  conflictResolution: MpmbImportConflictResolution | null;
  replacementContentId: string | null;
  replacementExpectedVersion: number | null;
  conflicts: MpmbImportConflictTarget[];
  hasLiveConflict: boolean;
  conflictResolved: boolean;
  userEditedFields: string[];
  userEditedAt: string | null;
  diagnostics: Array<{
    code?: string;
    severity?: "warning" | "blocking";
    path?: string;
    message?: string;
  }>;
}

export interface MpmbImportConflictItem {
  importId: string;
  itemId: string;
  revision: number;
  candidateName: string;
  contentType: "spell" | "feat";
  conflictResolution: MpmbImportConflictResolution | null;
  replacementContentId: string | null;
  replacementExpectedVersion: number | null;
  conflicts: MpmbImportConflictTarget[];
}

export interface MpmbImportSpellRepairItem {
  importId: string;
  itemId: string;
  revision: number;
  candidateName: string;
  data: SpellData;
  repairFields: {
    material: boolean;
    dc: boolean;
  };
  otherBlockingIssues: number;
  userEditedFields: string[];
}

export interface MpmbImportSpellRepairPatch {
  material?: string;
  dc?: {
    type: (typeof SPELL_SAVE_ABILITIES)[number];
    success: "half" | "none" | "other";
  };
}

export interface MpmbImportReview {
  id: string;
  originalFilename: string;
  sourceBytes: number;
  sourceSha256: string;
  parserVersion: string;
  mapperVersion: string;
  requiredSheetVersion: string | null;
  status: "review" | "completed" | "cancelled";
  revision: number;
  previewValidated: boolean;
  summary: {
    valid: number;
    needsInfo: number;
    unsupported: number;
    warnings: number;
    blockingIssues: number;
  };
  items: MpmbImportReviewItem[];
}

export interface MpmbImportCalculationPreview {
  id: string;
  originalFilename: string;
  revision: number;
  previewValidated: boolean;
  calculation: MpmbCalculationPreview;
}

interface FileLike {
  name: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

const importEnvelopeSchema = z.object({
  id: z.string().uuid(),
  original_filename: z.string().min(1),
  source_bytes: z.number().int().positive(),
  source_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  parser_version: z.string().min(1),
  mapper_version: z.string().min(1),
  required_sheet_version: z.string().nullable(),
  status: z.enum(["review", "completed", "cancelled"]),
  revision: z.number().int().positive(),
  preview_validated_revision: z.number().int().positive().nullable(),
  mapping_summary: z.object({
    valid: z.number().int().nonnegative(),
    needsInfo: z.number().int().nonnegative(),
    unsupported: z.number().int().nonnegative(),
    warnings: z.number().int().nonnegative(),
    blockingIssues: z.number().int().nonnegative(),
  }),
});

const previewImportEnvelopeSchema = z.object({
  id: z.string().uuid(),
  original_filename: z.string().min(1),
  owner_id: z.string().uuid(),
  system_id: z.string().uuid(),
  status: z.enum(["review", "completed", "cancelled"]),
  revision: z.number().int().positive(),
  preview_validated_revision: z.number().int().positive().nullable(),
});

const previewItemRowSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().nonnegative(),
  source_key: z.string().min(1),
  content_type: z.enum(["spell", "feat"]),
  candidate_name: z.string().nullable(),
  candidate_slug: z.string().nullable(),
  candidate_data: z.unknown().nullable(),
  candidate_effects: z.unknown().nullable(),
});

const previewEffectsSchema = z.array(effectSchema);

const reviewDiagnosticSchema = z.object({
  code: z.string().optional(),
  severity: z.enum(["warning", "blocking"]).optional(),
  path: z.string().optional(),
  message: z.string().optional(),
}).passthrough();

const reviewItemSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().nonnegative(),
  registry: z.enum(["SpellsList", "FeatsList"]),
  source_key: z.string().min(1),
  content_type: z.enum(["spell", "feat"]),
  location_line: z.number().int().positive(),
  location_column: z.number().int().positive(),
  mapping_status: z.enum(["valid", "needs_info", "unsupported"]),
  candidate_name: z.string().nullable(),
  selected: z.boolean(),
  committed_content_id: z.string().uuid().nullable(),
  candidate_data: z.unknown().nullable(),
  diagnostics: z.array(reviewDiagnosticSchema),
  resolved_diagnostics: z.array(reviewDiagnosticSchema),
  user_edited_fields: z.array(z.string()),
  user_edited_at: z.string().nullable(),
  conflict_resolution: z.enum(["keep_both", "replace"]).nullable(),
  replacement_content_id: z.string().uuid().nullable(),
  replacement_expected_version: z.number().int().positive().nullable(),
});

const conflictRpcRowSchema = z.object({
  import_item_id: z.string().uuid(),
  content_id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  version: z.number().int().positive(),
  scope: z.enum(["personal", "shared"]),
  shared_campaign_count: z.coerce.number().int().nonnegative(),
  replaceable: z.boolean(),
  previously_imported: z.boolean(),
}).strict();

const conflictResolutionInputSchema = z.object({
  importId: z.string().uuid(),
  itemId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  strategy: z.enum(["keep_both", "replace"]),
  replacementContentId: z.string().uuid().nullable(),
  replacementExpectedVersion: z.number().int().positive().nullable(),
}).strict().superRefine((value, context) => {
  const hasTarget = value.replacementContentId !== null;
  const hasVersion = value.replacementExpectedVersion !== null;
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
      path: ["replacementContentId"],
      message: "Choose the exact definition to replace.",
    });
  }
});

const spellRepairPatchSchema = z.object({
  material: z.string().trim().min(1).max(500).optional(),
  dc: z.object({
    type: z.enum(SPELL_SAVE_ABILITIES),
    success: z.enum(["half", "none", "other"]),
  }).strict().optional(),
}).strict().refine(
  (patch) => patch.material !== undefined || patch.dc !== undefined,
  "At least one repair is required.",
);

function isFileLike(value: unknown): value is FileLike {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FileLike>;
  return typeof candidate.name === "string"
    && typeof candidate.size === "number"
    && typeof candidate.arrayBuffer === "function";
}

export function sanitizeMpmbImportFilename(name: string): string {
  const basename = name.normalize("NFKC").split(/[\\/]/).at(-1) ?? "";
  const cleaned = basename
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255);
  return cleaned && cleaned !== "." && cleaned !== ".."
    ? cleaned
    : "import.mpmb";
}

function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

async function authenticatedSession(): Promise<
  | { supabase: ServerSupabaseClient; userId: string }
  | null
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { supabase, userId: user.id };
}

function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Import preview confirmation is not configured.");
  }
  return createAdminClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolvePublishedSystem(
  supabase: ServerSupabaseClient,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("game_systems")
    .select("id")
    .eq("slug", HOMEBREW_SYSTEM_SLUG)
    .eq("status", "published")
    .maybeSingle();
  if (error || !data) return null;
  return z.string().uuid().parse(data.id);
}

function databaseFailure(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  if (
    error?.code === "40001"
    || (error?.code === "P0001" && /(changed|revision|version|stale)/.test(message))
  ) {
    return {
      status: "conflict" as const,
      message: "This import changed in another session. Reload and try again.",
    };
  }
  return {
    status: "error" as const,
    message: "The import could not be saved. Please try again.",
  };
}

type DatabaseError = { code?: string; message?: string };

async function listOwnedMpmbImportConflicts(
  supabase: ServerSupabaseClient,
  importId: string,
): Promise<Map<string, MpmbImportConflictTarget[]>> {
  const { data, error } = await supabase.rpc("list_mpmb_import_item_conflicts", {
    target_import_id: importId,
  });
  if (error) throw new Error("Import conflicts could not be loaded.");

  const parsed = z.array(conflictRpcRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    throw new Error("The database returned invalid import conflicts.");
  }

  const grouped = new Map<string, MpmbImportConflictTarget[]>();
  for (const row of parsed.data) {
    const target: MpmbImportConflictTarget = {
      id: row.content_id,
      name: row.name,
      version: row.version,
      scope: row.scope,
      sharedCampaignCount: row.shared_campaign_count,
      previouslyImported: row.previously_imported,
      replaceable: row.replaceable,
    };
    const existing = grouped.get(row.import_item_id);
    if (existing) existing.push(target);
    else grouped.set(row.import_item_id, [target]);
  }
  return grouped;
}

function isResolvedLiveConflict(
  resolution: MpmbImportConflictResolution | null,
  replacementContentId: string | null,
  replacementExpectedVersion: number | null,
  conflicts: MpmbImportConflictTarget[],
): boolean {
  if (conflicts.length === 0 || resolution === null) return false;
  if (resolution === "keep_both") return true;
  return conflicts.some(
    (target) => target.id === replacementContentId
      && target.version === replacementExpectedVersion
      && target.replaceable,
  );
}

function conflictResolutionFailure(error: DatabaseError | null) {
  const message = error?.message?.toLowerCase() ?? "";
  if (/share|campaign/.test(message)) {
    return {
      status: "conflict" as const,
      message: "That definition is shared with a campaign. Unshare it or keep both.",
    };
  }
  if (
    error?.code === "40001"
    || (error?.code === "P0001" && /(stale|version|conflict|changed)/.test(message))
  ) {
    return {
      status: "conflict" as const,
      message: "This import or replacement changed in another session. Reload and try again.",
    };
  }
  if (error?.code === "P0001" && /(target|replace|available|valid)/.test(message)) {
    return {
      status: "conflict" as const,
      message: "That replacement is no longer available. Reload and choose again.",
    };
  }
  return {
    status: "error" as const,
    message: "The conflict choice could not be saved. Please try again.",
  };
}

export async function stageMpmbImportFile(
  file: unknown,
  attestedForPrivateUse: boolean,
): Promise<MpmbImportMutationResult> {
  const session = await authenticatedSession();
  if (!session) {
    return { status: "error", message: "Sign in before importing content." };
  }
  if (!attestedForPrivateUse) {
    return {
      status: "error",
      message: "Confirm that you have the right to use this file privately.",
    };
  }
  if (!isFileLike(file)) {
    return { status: "error", message: "Choose an MPMB JavaScript file." };
  }

  const filename = sanitizeMpmbImportFilename(file.name);
  const lowerName = filename.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    return { status: "error", message: "Choose a .js or .mpmb file." };
  }
  if (file.size < 1 || file.size > DEFAULT_MPMB_PARSER_LIMITS.maxSourceBytes) {
    return {
      status: "error",
      message: "The file must be between 1 byte and 2 MiB.",
    };
  }

  let bytes: Uint8Array;
  let source: string;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size) {
      return { status: "error", message: "The uploaded file size changed. Try again." };
    }
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { status: "error", message: "The file must contain valid UTF-8 text." };
  }

  let parsed;
  try {
    parsed = parseMpmbSource(source);
  } catch (error) {
    if (error instanceof MpmbParseError) {
      const location = error.location
        ? ` at line ${error.location.line}, column ${error.location.column}`
        : "";
      return {
        status: "error",
        message: `The file could not be safely parsed (${error.code}${location}).`,
      };
    }
    return { status: "error", message: "The file could not be safely parsed." };
  }
  const mapped = mapParsedMpmbSource(parsed);
  const systemId = await resolvePublishedSystem(session.supabase);
  if (!systemId) {
    return { status: "error", message: "The D&D 5e (2014) system is unavailable." };
  }

  const sourceSha256 = createHash("sha256").update(bytes).digest("hex");
  const { data, error } = await session.supabase.rpc("stage_mpmb_import", {
    target_system_id: systemId,
    safe_original_filename: filename,
    source_sha256: sourceSha256,
    source_bytes: bytes.byteLength,
    parser_version: MPMB_PARSER_VERSION,
    mapper_version: mapped.mapperVersion,
    required_sheet_version: parsed.requiredSheetVersion == null
      ? null
      : String(parsed.requiredSheetVersion),
    source_metadata: asJson(mapped.sources),
    file_diagnostics: asJson(mapped.fileDiagnostics),
    mapping_summary: asJson(mapped.summary),
    mapped_items: asJson(mapped.items),
    rights_attestation_version: PRIVATE_USE_ATTESTATION,
  });

  if (error || !data) return databaseFailure(error);
  const importId = z.string().uuid().safeParse(data);
  if (!importId.success) {
    return { status: "error", message: "The database returned an invalid import." };
  }
  return { status: "success", importId: importId.data };
}

export async function getOwnedMpmbImportReview(
  importId: string,
): Promise<MpmbImportReview | null> {
  const session = await authenticatedSession();
  if (!session) throw new Error("Authentication required.");
  const id = z.string().uuid().safeParse(importId);
  if (!id.success) return null;

  const { data: importData, error: importError } = await session.supabase
    .from("content_imports")
    .select(
      "id, original_filename, source_bytes, source_sha256, parser_version, mapper_version, required_sheet_version, status, revision, preview_validated_revision, mapping_summary",
    )
    .eq("id", id.data)
    .eq("owner_id", session.userId)
    .maybeSingle();
  if (importError) throw importError;
  if (!importData) return null;
  const envelope = importEnvelopeSchema.parse(importData);

  const [itemResult, conflictsByItem] = await Promise.all([
    session.supabase
      .from("content_import_items")
      .select(
        "id, ordinal, registry, source_key, content_type, location_line, location_column, mapping_status, candidate_name, candidate_data, selected, committed_content_id, diagnostics, resolved_diagnostics, user_edited_fields, user_edited_at, conflict_resolution, replacement_content_id, replacement_expected_version",
      )
      .eq("import_id", id.data)
      .order("ordinal"),
    envelope.status === "review"
      ? listOwnedMpmbImportConflicts(session.supabase, id.data)
      : Promise.resolve(new Map<string, MpmbImportConflictTarget[]>()),
  ]);
  const { data: itemData, error: itemError } = itemResult;
  if (itemError) throw itemError;

  const items = z.array(reviewItemSchema).parse(itemData ?? []);
  return {
    id: envelope.id,
    originalFilename: envelope.original_filename,
    sourceBytes: envelope.source_bytes,
    sourceSha256: envelope.source_sha256,
    parserVersion: envelope.parser_version,
    mapperVersion: envelope.mapper_version,
    requiredSheetVersion: envelope.required_sheet_version,
    status: envelope.status,
    revision: envelope.revision,
    previewValidated:
      envelope.preview_validated_revision === envelope.revision,
    summary: envelope.mapping_summary,
    items: items.map((item) => {
      const conflicts = conflictsByItem.get(item.id) ?? [];
      // A saved choice is no longer actionable once every live same-name
      // definition disappears. Normalize stale persistence out of the DTO so
      // the review does not block a now-conflict-free item or offer a dead
      // replacement link. Commit independently rechecks live conflicts.
      const staleOpenResolution = envelope.status === "review"
        && conflicts.length === 0;
      const conflictResolution = staleOpenResolution
        ? null
        : item.conflict_resolution;
      const replacementContentId = staleOpenResolution
        ? null
        : item.replacement_content_id;
      const replacementExpectedVersion = staleOpenResolution
        ? null
        : item.replacement_expected_version;
      return {
        id: item.id,
        ordinal: item.ordinal,
        registry: item.registry,
        sourceKey: item.source_key,
        contentType: item.content_type,
        location: { line: item.location_line, column: item.location_column },
        mappingStatus: item.mapping_status,
        candidateName: item.candidate_name,
        selected: item.selected,
        committedContentId: item.committed_content_id,
        repairable: envelope.status === "review"
          && item.mapping_status === "needs_info"
          && item.content_type === "spell"
          && item.candidate_data !== null
          && spellDataSchema.safeParse(item.candidate_data).success
          && item.committed_content_id === null
          && item.diagnostics.some(
            (diagnostic) =>
              diagnostic.severity === "blocking"
              && (
                diagnostic.code === MATERIAL_REPAIR_CODE
                || diagnostic.code === SAVE_REPAIR_CODE
              ),
          ),
        conflictResolution,
        replacementContentId,
        replacementExpectedVersion,
        conflicts,
        hasLiveConflict: conflicts.length > 0,
        conflictResolved: envelope.status !== "review"
          ? conflictResolution !== null
          : isResolvedLiveConflict(
              conflictResolution,
              replacementContentId,
              replacementExpectedVersion,
              conflicts,
            ),
        userEditedFields: item.user_edited_fields,
        userEditedAt: item.user_edited_at,
        diagnostics: item.diagnostics,
      };
    }),
  };
}

function invalidPreviewItem(
  item: z.infer<typeof previewItemRowSchema>,
  message: string,
): Extract<MpmbPreviewItem, { status: "failed" }> {
  return {
    id: item.id,
    contentType: item.content_type,
    name: item.candidate_name ?? item.source_key,
    status: "failed",
    message,
  };
}

function parsePreviewCandidate(
  item: z.infer<typeof previewItemRowSchema>,
): MpmbPreviewCandidate | Extract<MpmbPreviewItem, { status: "failed" }> {
  if (!item.candidate_name || !item.candidate_slug) {
    return invalidPreviewItem(
      item,
      "This staged item no longer has a complete content identity.",
    );
  }
  const effects = previewEffectsSchema.safeParse(item.candidate_effects);
  if (!effects.success) {
    return invalidPreviewItem(
      item,
      "This staged item's effects no longer match the supported calculation schema.",
    );
  }

  if (item.content_type === "feat") {
    const data = featDataSchema.safeParse(item.candidate_data);
    if (!data.success) {
      return invalidPreviewItem(
        item,
        "This staged feat no longer matches the supported content schema.",
      );
    }
    return {
      id: item.id,
      contentType: "feat",
      name: item.candidate_name,
      slug: item.candidate_slug,
      data: data.data satisfies FeatData,
      effects: effects.data,
    };
  }

  const data = spellDataSchema.safeParse(item.candidate_data);
  if (!data.success) {
    return invalidPreviewItem(
      item,
      "This staged spell no longer matches the supported content schema.",
    );
  }
  return {
    id: item.id,
    contentType: "spell",
    name: item.candidate_name,
    slug: item.candidate_slug,
    data: data.data,
    effects: effects.data,
  };
}

async function loadOwnedMpmbImportPreview(
  session: { supabase: ServerSupabaseClient; userId: string },
  importId: string,
): Promise<MpmbImportCalculationPreview | null> {
  const { data: importData, error: importError } = await session.supabase
    .from("content_imports")
    .select(
      "id, original_filename, owner_id, system_id, status, revision, preview_validated_revision",
    )
    .eq("id", importId)
    .eq("owner_id", session.userId)
    .maybeSingle();
  if (importError) throw importError;
  if (!importData) return null;
  const envelope = previewImportEnvelopeSchema.parse(importData);
  if (envelope.status !== "review") return null;

  const [systemResult, itemResult] = await Promise.all([
    session.supabase
      .from("game_systems")
      .select("schema_definition")
      .eq("id", envelope.system_id)
      .maybeSingle(),
    session.supabase
      .from("content_import_items")
      .select(
        "id, ordinal, source_key, content_type, candidate_name, candidate_slug, candidate_data, candidate_effects",
      )
      .eq("import_id", envelope.id)
      .eq("mapping_status", "valid")
      .eq("selected", true)
      .is("committed_content_id", null)
      .order("ordinal"),
  ]);
  if (systemResult.error) throw systemResult.error;
  if (itemResult.error) throw itemResult.error;
  const schema = systemSchemaDefinitionSchema.safeParse(
    systemResult.data?.schema_definition,
  );
  if (!schema.success) {
    throw new Error("The import's game system has an invalid calculation schema.");
  }

  const rows = z.array(previewItemRowSchema).parse(itemResult.data ?? []);
  const parsed = rows.map(parsePreviewCandidate);
  const candidates = parsed.filter(
    (item): item is MpmbPreviewCandidate => !("status" in item),
  );
  const invalidById = new Map(
    parsed
      .filter(
        (item): item is Extract<MpmbPreviewItem, { status: "failed" }> =>
          "status" in item,
      )
      .map((item) => [item.id, item]),
  );
  const calculated = buildMpmbCalculationPreview(schema.data, candidates);
  const calculatedById = new Map(calculated.items.map((item) => [item.id, item]));
  const items = rows.map((row) =>
    invalidById.get(row.id)
    ?? calculatedById.get(row.id)
    ?? invalidPreviewItem(row, "This staged item could not be evaluated."),
  );

  return {
    id: envelope.id,
    originalFilename: envelope.original_filename,
    revision: envelope.revision,
    previewValidated:
      envelope.preview_validated_revision === envelope.revision,
    calculation: {
      ...calculated,
      passed: items.length > 0 && items.every((item) => item.status === "passed"),
      items,
    },
  };
}

export async function getOwnedMpmbImportPreview(
  importId: string,
): Promise<MpmbImportCalculationPreview | null> {
  const session = await authenticatedSession();
  if (!session) throw new Error("Authentication required.");
  const id = z.string().uuid().safeParse(importId);
  if (!id.success) return null;
  return loadOwnedMpmbImportPreview(session, id.data);
}

export async function confirmOwnedMpmbImportPreview(
  importId: string,
  expectedRevision: number,
): Promise<MpmbImportMutationResult> {
  const session = await authenticatedSession();
  if (!session) {
    return { status: "error", message: "Sign in to confirm this preview." };
  }
  const input = z.object({
    importId: z.string().uuid(),
    expectedRevision: z.number().int().positive(),
  }).safeParse({ importId, expectedRevision });
  if (!input.success) {
    return { status: "error", message: "The preview confirmation is invalid." };
  }

  const preview = await loadOwnedMpmbImportPreview(session, input.data.importId);
  if (!preview) {
    return { status: "error", message: "This import preview is no longer available." };
  }
  if (preview.revision !== input.data.expectedRevision) {
    return {
      status: "conflict",
      message: "This import changed in another session. Reload and preview it again.",
    };
  }
  if (!preview.calculation.passed) {
    return {
      status: "error",
      message: "Resolve every calculation failure before confirming this preview.",
    };
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return { status: "error", message: "The preview could not be confirmed." };
  }
  const { data, error } = await admin.rpc("record_mpmb_import_preview", {
    target_import_id: input.data.importId,
    validated_owner_id: session.userId,
    expected_revision: input.data.expectedRevision,
  });
  if (error) return databaseFailure(error);
  if (data !== input.data.expectedRevision) {
    return { status: "error", message: "The preview could not be confirmed." };
  }
  return { status: "success", importId: input.data.importId };
}

export async function getOwnedMpmbImportSpellRepairItem(
  importId: string,
  itemId: string,
): Promise<MpmbImportSpellRepairItem | null> {
  const session = await authenticatedSession();
  if (!session) throw new Error("Authentication required.");
  const identifiers = z.object({
    importId: z.string().uuid(),
    itemId: z.string().uuid(),
  }).safeParse({ importId, itemId });
  if (!identifiers.success) return null;

  const { data: importData, error: importError } = await session.supabase
    .from("content_imports")
    .select("id, revision, status")
    .eq("id", identifiers.data.importId)
    .eq("owner_id", session.userId)
    .maybeSingle();
  if (importError) throw importError;
  if (!importData || importData.status !== "review") return null;

  const { data: itemData, error: itemError } = await session.supabase
    .from("content_import_items")
    .select(
      "id, import_id, content_type, mapping_status, candidate_name, candidate_data, committed_content_id, diagnostics, user_edited_fields",
    )
    .eq("id", identifiers.data.itemId)
    .eq("import_id", identifiers.data.importId)
    .maybeSingle();
  if (itemError) throw itemError;
  if (
    !itemData
    || itemData.content_type !== "spell"
    || itemData.mapping_status !== "needs_info"
    || itemData.committed_content_id !== null
    || !itemData.candidate_name
  ) {
    return null;
  }

  const data = spellDataSchema.safeParse(itemData.candidate_data);
  const diagnostics = z.array(reviewDiagnosticSchema).safeParse(
    itemData.diagnostics,
  );
  const userEditedFields = z.array(z.string()).safeParse(
    itemData.user_edited_fields,
  );
  if (!data.success || !diagnostics.success || !userEditedFields.success) {
    return null;
  }

  const repairFields = {
    material: diagnostics.data.some(
      (diagnostic) =>
        diagnostic.severity === "blocking"
        && diagnostic.code === MATERIAL_REPAIR_CODE,
    ),
    dc: diagnostics.data.some(
      (diagnostic) =>
        diagnostic.severity === "blocking"
        && diagnostic.code === SAVE_REPAIR_CODE,
    ),
  };
  if (!repairFields.material && !repairFields.dc) return null;

  return {
    importId: identifiers.data.importId,
    itemId: identifiers.data.itemId,
    revision: z.number().int().positive().parse(importData.revision),
    candidateName: itemData.candidate_name,
    data: data.data,
    repairFields,
    otherBlockingIssues: diagnostics.data.filter(
      (diagnostic) =>
        diagnostic.severity === "blocking"
        && diagnostic.code !== MATERIAL_REPAIR_CODE
        && diagnostic.code !== SAVE_REPAIR_CODE,
    ).length,
    userEditedFields: userEditedFields.data,
  };
}

export async function getOwnedMpmbImportConflictItem(
  importId: string,
  itemId: string,
): Promise<MpmbImportConflictItem | null> {
  const identifiers = z.object({
    importId: z.string().uuid(),
    itemId: z.string().uuid(),
  }).strict().safeParse({ importId, itemId });
  if (!identifiers.success) return null;

  // Reuse the owned review DTO so this route receives the same live conflict
  // calculation as the review page. Candidate data is consumed only inside
  // the server-only DAL and is deliberately absent from the returned object.
  const review = await getOwnedMpmbImportReview(identifiers.data.importId);
  if (!review || review.status !== "review") return null;
  const item = review.items.find(
    (candidate) => candidate.id === identifiers.data.itemId,
  );
  if (
    !item
    || item.mappingStatus !== "valid"
    || item.committedContentId !== null
    || item.candidateName === null
    || (item.conflicts.length === 0 && item.conflictResolution === null)
  ) {
    return null;
  }

  return {
    importId: review.id,
    itemId: item.id,
    revision: review.revision,
    candidateName: item.candidateName,
    contentType: item.contentType,
    conflictResolution: item.conflictResolution,
    replacementContentId: item.replacementContentId,
    replacementExpectedVersion: item.replacementExpectedVersion,
    conflicts: item.conflicts,
  };
}

export async function repairMpmbImportSpellItem(
  importId: string,
  itemId: string,
  expectedRevision: number,
  patch: MpmbImportSpellRepairPatch,
): Promise<MpmbImportMutationResult> {
  const session = await authenticatedSession();
  if (!session) {
    return { status: "error", message: "Sign in to repair this import." };
  }
  const input = z.object({
    importId: z.string().uuid(),
    itemId: z.string().uuid(),
    expectedRevision: z.number().int().positive(),
    patch: spellRepairPatchSchema,
  }).safeParse({ importId, itemId, expectedRevision, patch });
  if (!input.success) {
    return { status: "error", message: "The spell repair is invalid." };
  }

  const { error } = await session.supabase.rpc(
    "repair_mpmb_import_spell_item",
    {
      target_import_id: input.data.importId,
      target_item_id: input.data.itemId,
      expected_revision: input.data.expectedRevision,
      repair_patch: asJson(input.data.patch),
    },
  );
  if (error) return databaseFailure(error);
  return { status: "success", importId: input.data.importId };
}

export async function setMpmbImportItemSelected(
  importId: string,
  itemId: string,
  selected: boolean,
  expectedRevision: number,
): Promise<MpmbImportMutationResult> {
  const session = await authenticatedSession();
  if (!session) return { status: "error", message: "Sign in to update this import." };
  const input = z.object({
    importId: z.string().uuid(),
    itemId: z.string().uuid(),
    selected: z.boolean(),
    expectedRevision: z.number().int().positive(),
  }).safeParse({ importId, itemId, selected, expectedRevision });
  if (!input.success) return { status: "error", message: "The import selection is invalid." };

  const { error } = await session.supabase.rpc("set_mpmb_import_item_selected", {
    target_import_id: input.data.importId,
    target_item_id: input.data.itemId,
    selected: input.data.selected,
    expected_revision: input.data.expectedRevision,
  });
  if (error) return databaseFailure(error);
  return { status: "success", importId: input.data.importId };
}

export async function resolveMpmbImportItemConflict(
  importId: string,
  itemId: string,
  expectedRevision: number,
  strategy: MpmbImportConflictResolution,
  replacementContentId: string | null = null,
  replacementExpectedVersion: number | null = null,
): Promise<MpmbImportMutationResult> {
  const session = await authenticatedSession();
  if (!session) {
    return { status: "error", message: "Sign in to resolve this import conflict." };
  }
  const input = conflictResolutionInputSchema.safeParse({
    importId,
    itemId,
    expectedRevision,
    strategy,
    replacementContentId,
    replacementExpectedVersion,
  });
  if (!input.success) {
    return { status: "error", message: "The conflict choice is invalid." };
  }

  const { error } = await session.supabase.rpc("resolve_mpmb_import_item_conflict", {
    target_import_id: input.data.importId,
    target_item_id: input.data.itemId,
    expected_revision: input.data.expectedRevision,
    resolution_strategy: input.data.strategy,
    target_content_id: input.data.replacementContentId ?? undefined,
    target_content_version: input.data.replacementExpectedVersion ?? undefined,
  });
  if (error) return conflictResolutionFailure(error);
  return { status: "success", importId: input.data.importId };
}

export async function commitMpmbImport(
  importId: string,
  expectedRevision: number,
): Promise<MpmbImportMutationResult> {
  const session = await authenticatedSession();
  if (!session) return { status: "error", message: "Sign in to commit this import." };
  const input = z.object({
    importId: z.string().uuid(),
    expectedRevision: z.number().int().positive(),
  }).safeParse({ importId, expectedRevision });
  if (!input.success) return { status: "error", message: "The import commit is invalid." };

  const { data, error } = await session.supabase.rpc("commit_mpmb_import", {
    target_import_id: input.data.importId,
    expected_revision: input.data.expectedRevision,
  });
  if (error) return databaseFailure(error);
  return {
    status: "success",
    importId: input.data.importId,
    importedCount: data?.length ?? 0,
  };
}

export async function cancelMpmbImport(
  importId: string,
): Promise<MpmbImportMutationResult> {
  const session = await authenticatedSession();
  if (!session) return { status: "error", message: "Sign in to cancel this import." };
  const id = z.string().uuid().safeParse(importId);
  if (!id.success) return { status: "error", message: "The import identifier is invalid." };
  const { data, error } = await session.supabase.rpc("cancel_mpmb_import", {
    target_import_id: id.data,
  });
  if (error) return databaseFailure(error);
  if (!data) return { status: "error", message: "This import is no longer cancellable." };
  return { status: "success", importId: id.data };
}
