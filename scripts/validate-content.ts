/**
 * One-shot dev script: walk every content_definitions row in the dev DB,
 * run it through parseContentDefinition, and report failures.
 *
 * Run with:
 *   npx tsx -r dotenv/config scripts/validate-content.ts dotenv_config_path=.env.local
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set
 *   (the script uses the service role to bypass RLS, since this is a dev
 *   tool and we want the full picture).
 *
 * Exit codes:
 *   0 — every row parsed clean
 *   1 — at least one row failed; details printed to stderr
 *   2 — configuration / connection error
 */
import { createClient } from "@supabase/supabase-js";
import { parseContentDefinition } from "@/lib/supabase/content-definitions";

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(2);
  }

  const supabase = createClient(url, key);

  // Paginate — supabase caps unranged selects at 1000 rows and the
  // content_definitions table is larger than that.
  const { count, error: countError } = await supabase
    .from("content_definitions")
    .select("id", { count: "exact", head: true });
  if (countError) {
    console.error("Supabase error:", countError.message);
    process.exit(2);
  }

  const pageSize = 1000;
  let checked = 0;
  let failures = 0;
  for (let from = 0; from < (count ?? 0); from += pageSize) {
    const { data, error } = await supabase
      .from("content_definitions")
      .select(
        "id, name, slug, content_type, data, effects, version, source, system_id, scope, owner_id",
      )
      .order("id")
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Supabase error:", error.message);
      process.exit(2);
    }

    for (const row of data ?? []) {
      checked += 1;
      const result = parseContentDefinition(row);
      if (result === null) {
        failures += 1;
      }
    }
  }

  console.log(`\nChecked ${checked} rows — ${failures} failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("validate-content crashed:", err);
  process.exit(2);
});
