import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import { mapParsedMpmbSource } from "@/lib/import/mpmb/map";
import { parseMpmbSource } from "@/lib/import/mpmb/parser";
import {
  DEFAULT_MPMB_PARSER_LIMITS,
  MPMB_PARSER_VERSION,
  MpmbParseError,
} from "@/lib/import/mpmb/types";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const HOMEBREW_SYSTEM_SLUG = "dnd-5e-2014";
const PRIVATE_USE_ATTESTATION = "private_use_v1";
const ALLOWED_EXTENSIONS = [".js", ".mpmb"];

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type MpmbImportMutationResult =
  | { status: "success"; importId: string; importedCount?: number }
  | { status: "error" | "conflict"; message: string };

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
  diagnostics: Array<{
    code?: string;
    severity?: "warning" | "blocking";
    path?: string;
    message?: string;
  }>;
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
  summary: {
    valid: number;
    needsInfo: number;
    unsupported: number;
    warnings: number;
    blockingIssues: number;
  };
  items: MpmbImportReviewItem[];
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
  mapping_summary: z.object({
    valid: z.number().int().nonnegative(),
    needsInfo: z.number().int().nonnegative(),
    unsupported: z.number().int().nonnegative(),
    warnings: z.number().int().nonnegative(),
    blockingIssues: z.number().int().nonnegative(),
  }),
});

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
  diagnostics: z.array(
    z.object({
      code: z.string().optional(),
      severity: z.enum(["warning", "blocking"]).optional(),
      path: z.string().optional(),
      message: z.string().optional(),
    }).passthrough(),
  ),
});

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
  if (error?.code === "40001") {
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
      "id, original_filename, source_bytes, source_sha256, parser_version, mapper_version, required_sheet_version, status, revision, mapping_summary",
    )
    .eq("id", id.data)
    .eq("owner_id", session.userId)
    .maybeSingle();
  if (importError) throw importError;
  if (!importData) return null;

  const { data: itemData, error: itemError } = await session.supabase
    .from("content_import_items")
    .select(
      "id, ordinal, registry, source_key, content_type, location_line, location_column, mapping_status, candidate_name, selected, committed_content_id, diagnostics",
    )
    .eq("import_id", id.data)
    .order("ordinal");
  if (itemError) throw itemError;

  const envelope = importEnvelopeSchema.parse(importData);
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
    summary: envelope.mapping_summary,
    items: items.map((item) => ({
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
      diagnostics: item.diagnostics,
    })),
  };
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
