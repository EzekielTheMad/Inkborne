import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { transformTraits } from "./transformers/traits";
import { transformLanguages } from "./transformers/languages";
import { transformProficiencies } from "./transformers/proficiencies";
import { transformRaces } from "./transformers/races";
import { transformFeatures } from "./transformers/features";
import { transformClasses } from "./transformers/classes";
import { transformBackgrounds } from "./transformers/backgrounds";
import { transformFeats } from "./transformers/feats";
import { transformSpells } from "./transformers/spells";
import { transformEquipment } from "./transformers/equipment";
import { transformMagicItems } from "./transformers/magic-items";
import type { TransformedContent } from "./transformers/common";

const UPSERT_BATCH_SIZE = 50;
const DESTRUCTIVE_RETIREMENT_FLAG = "--allow-destructive-retirement";

export type ImportClient = SupabaseClient;

export interface ImportOptions {
  allowDestructiveRetirement?: boolean;
}

export function parseImportOptions(
  args: readonly string[] = process.argv.slice(2),
): ImportOptions {
  const unknown = args.filter((arg) => arg !== DESTRUCTIVE_RETIREMENT_FLAG);
  if (unknown.length > 0) {
    throw new Error(`Unknown SRD import option: ${unknown.join(", ")}`);
  }

  return {
    allowDestructiveRetirement: args.includes(DESTRUCTIVE_RETIREMENT_FLAG),
  };
}

export function requireImportEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. " +
        "The SRD importer cannot run with the public anon key.",
    );
  }

  return { supabaseUrl, serviceRoleKey };
}

export async function getSystemId(supabase: ImportClient): Promise<string> {
  const { data, error } = await supabase
    .from("game_systems")
    .select("id")
    .eq("slug", "dnd-5e-2014")
    .single();

  if (error) {
    throw new Error(
      `Could not query the dnd-5e-2014 game system: ${error.message}`,
      { cause: error },
    );
  }
  if (!data) {
    throw new Error("Could not find dnd-5e-2014 game system. Run seed.sql first.");
  }
  return (data as { id: string }).id;
}

export function buildImportRows(
  systemId: string,
  content: readonly TransformedContent[],
) {
  return content.map((c) => ({
    system_id: systemId,
    content_type: c.content_type,
    slug: c.slug,
    name: c.name,
    data: c.data,
    effects: c.effects,
    source: "srd",
    scope: "platform",
    owner_id: null,
  }));
}

function assertUniqueStableIdentities(
  content: readonly TransformedContent[],
): void {
  const seen = new Set<string>();

  for (const entry of content) {
    const identity = `${entry.content_type}\u0000${entry.slug}`;
    if (seen.has(identity)) {
      throw new Error(
        `Duplicate SRD stable identity: ${entry.content_type}/${entry.slug}`,
      );
    }
    seen.add(identity);
  }
}

export async function upsertContent(
  supabase: ImportClient,
  systemId: string,
  content: readonly TransformedContent[],
  batchSize = UPSERT_BATCH_SIZE,
  importBatchId = randomUUID(),
  allowDestructiveRetirement = false,
): Promise<void> {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new Error("SRD import batch size must be a positive integer.");
  }

  assertUniqueStableIdentities(content);
  if (content.length === 0) {
    throw new Error(
      "Refusing to publish an empty SRD import because it would retire the entire catalog.",
    );
  }

  const rows = buildImportRows(systemId, content);

  const { error: batchError } = await supabase
    .from("srd_import_batches")
    .insert({
      id: importBatchId,
      system_id: systemId,
      expected_count: rows.length,
      allow_destructive_retirement: allowDestructiveRetirement,
    });

  if (batchError) {
    throw new Error(`Could not create SRD import batch: ${batchError.message}`, {
      cause: batchError,
    });
  }

  try {
    // Staging may span HTTP requests, but none of these writes touch the live
    // catalog. The single RPC below owns the publication transaction.
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize).map((row) => ({
        batch_id: importBatchId,
        ...row,
      }));
      const { error } = await supabase
        .from("srd_import_staging")
        .insert(chunk);

      if (error) {
        throw new Error(
          `SRD staging failed for rows ${i}-${i + chunk.length - 1}: ${error.message}`,
          { cause: error },
        );
      }
    }

    // Postgres executes a Data API function call in one transaction. Stable
    // identity upserts and semantic version snapshots are database-owned; the
    // RPC also marks absent SRD definitions retired without deleting them.
    const { error: promoteError } = await supabase.rpc("promote_srd_import", {
      p_batch_id: importBatchId,
    });

    if (promoteError) {
      throw new Error(`SRD promotion failed: ${promoteError.message}`, {
        cause: promoteError,
      });
    }
  } catch (error) {
    // Successful promotion deletes the batch transactionally. On failure this
    // best-effort cleanup removes partial staging without masking the cause.
    const cleanup = await supabase
      .from("srd_import_batches")
      .delete()
      .eq("id", importBatchId);
    if (cleanup.error) {
      console.warn(
        `Could not clean up failed SRD import batch ${importBatchId}: ${cleanup.error.message}`,
      );
    }
    throw error;
  }
}

export async function saveRawData(name: string, data: unknown): Promise<void> {
  const dir = path.join(process.cwd(), "data", "srd-2014", "raw");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(data, null, 2));
}

export interface ImportStep {
  name: string;
  transform: () => Promise<TransformedContent[]>;
}

export interface PreparedImportStep {
  name: string;
  content: TransformedContent[];
}

export const IMPORT_STEPS: readonly ImportStep[] = [
  { name: "traits", transform: transformTraits },
  { name: "languages", transform: transformLanguages },
  { name: "proficiencies", transform: transformProficiencies },
  { name: "races", transform: transformRaces },
  { name: "features", transform: transformFeatures },
  { name: "classes", transform: transformClasses },
  { name: "backgrounds", transform: transformBackgrounds },
  { name: "feats", transform: transformFeats },
  { name: "spells", transform: transformSpells },
  { name: "equipment", transform: transformEquipment },
  { name: "magic-items", transform: transformMagicItems },
];

export async function prepareImportSteps(
  steps: readonly ImportStep[],
): Promise<PreparedImportStep[]> {
  const prepared: PreparedImportStep[] = [];

  // Complete every remote transform before the first database mutation. An
  // upstream API failure therefore leaves the existing catalog untouched.
  for (const step of steps) {
    const content = await step.transform();
    if (content.length === 0) {
      throw new Error(
        `Refusing empty SRD transform step "${step.name}" because it could retire a complete content category.`,
      );
    }
    prepared.push({ name: step.name, content });
  }

  assertUniqueStableIdentities(prepared.flatMap((step) => step.content));
  return prepared;
}

export async function importSrd(
  supabase: ImportClient,
  steps: readonly ImportStep[] = IMPORT_STEPS,
  saveRaw: (name: string, data: unknown) => Promise<void> = saveRawData,
  options: ImportOptions = {},
): Promise<number> {
  const systemId = await getSystemId(supabase);
  console.log(`Found game system: ${systemId}\n`);

  const prepared = await prepareImportSteps(steps);
  for (const step of prepared) {
    console.log(`Transformed ${step.name}: ${step.content.length} entries`);
  }

  // Raw output is also complete before database writes. A filesystem error
  // cannot leave the live catalog only partly updated.
  for (const step of prepared) {
    await saveRaw(step.name, step.content);
  }

  const content = prepared.flatMap((step) => step.content);
  await upsertContent(
    supabase,
    systemId,
    content,
    UPSERT_BATCH_SIZE,
    randomUUID(),
    options.allowDestructiveRetirement ?? false,
  );
  return content.length;
}

export async function main(): Promise<void> {
  console.log("Starting D&D 5e 2014 SRD import...\n");

  const options = parseImportOptions();
  const { supabaseUrl, serviceRoleKey } = requireImportEnvironment();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  if (options.allowDestructiveRetirement) {
    console.warn(
      "Destructive SRD retirement override enabled. Missing active identities will be retired.",
    );
  }

  const totalCount = await importSrd(
    supabase,
    IMPORT_STEPS,
    saveRawData,
    options,
  );
  console.log(`\nDone! Imported ${totalCount} total content entries.`);
}

const entrypoint = process.argv[1];
if (entrypoint && path.resolve(entrypoint) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error("SRD import failed:", error);
    process.exitCode = 1;
  });
}
