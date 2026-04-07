import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY environment variables");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getSystemId(): Promise<string> {
  const { data, error } = await supabase
    .from("game_systems")
    .select("id")
    .eq("slug", "dnd-5e-2014")
    .single();

  if (error || !data) {
    throw new Error("Could not find dnd-5e-2014 game system. Run seed.sql first.");
  }
  return (data as { id: string }).id;
}

async function upsertContent(systemId: string, content: TransformedContent[]): Promise<void> {
  const rows = content.map((c) => ({
    system_id: systemId,
    content_type: c.content_type,
    slug: c.slug,
    name: c.name,
    data: c.data,
    effects: c.effects,
    source: "srd",
    scope: "platform",
    owner_id: null,
    version: 1,
  }));

  // Batch insert in chunks of 50
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await supabase
      .from("content_definitions")
      .upsert(chunk, { onConflict: "system_id,content_type,slug,owner_id" });

    if (error) {
      console.error(`Error inserting chunk at index ${i}:`, error.message);
    }
  }
}

async function saveRawData(name: string, data: unknown): Promise<void> {
  const dir = path.join(process.cwd(), "data", "srd-2014", "raw");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(data, null, 2));
}

interface ImportStep {
  name: string;
  transform: () => Promise<TransformedContent[]>;
}

const IMPORT_STEPS: ImportStep[] = [
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

async function main() {
  console.log("Starting D&D 5e 2014 SRD import...\n");

  const systemId = await getSystemId();
  console.log(`Found game system: ${systemId}\n`);

  let totalCount = 0;

  for (const step of IMPORT_STEPS) {
    console.log(`Transforming ${step.name}...`);
    try {
      const content = await step.transform();
      console.log(`  → ${content.length} entries`);

      await saveRawData(step.name, content);
      await upsertContent(systemId, content);

      totalCount += content.length;
      console.log(`  ✓ Loaded\n`);
    } catch (err) {
      console.error(`  ✗ Error in ${step.name}:`, err);
    }
  }

  console.log(`\nDone! Imported ${totalCount} total content entries.`);
}

main().catch(console.error);
