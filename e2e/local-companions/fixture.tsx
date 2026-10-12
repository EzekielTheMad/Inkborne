import React from "react";
import { createRoot } from "react-dom/client";
import { CompendiumBrowser } from "@/components/compendium/compendium-browser";
import { CompendiumDetail } from "@/components/compendium/compendium-detail";
import { parseCompendiumQuery } from "@/lib/compendium/catalog";
import type { CompendiumEntry } from "@/lib/compendium/types";
import { parseContentDefinition } from "@/lib/supabase/content-definitions-parser";
import { companionEnvelope, companionId, companionOwnerId, companionSystemId, originalCompanion, companionWithBytes } from "@/tests/fixtures/companions";
import { COMPANION_PAYLOAD_MAX_BYTES } from "@/lib/schemas/content-types/companion";

const absent = originalCompanion("beast_form"); delete absent.stat_block.description; delete absent.stat_block.actions; delete absent.stat_block.skills;
const long = companionWithBytes(COMPANION_PAYLOAD_MAX_BYTES - 256);
long.stat_block.actions![0].description = "The final original companion action is still reachable.";
const injection = '<script>window.compromised=true</script><img src=x onerror="alert(1)">';
const escaped = originalCompanion("summon"); escaped.stat_block.description = injection;
const rows = [companionEnvelope(), { ...companionEnvelope(originalCompanion("beast_form")), id: companionId(4), name: "Original Grove Beast Form" },
  { ...companionEnvelope(originalCompanion("summon")), id: companionId(5), name: "Original Workshop Summon" },
  { ...companionEnvelope(absent), id: companionId(6), name: "Original Quiet Template" },
  { ...companionEnvelope(long), id: companionId(7), name: "OriginalArchive" + "W".repeat(500) },
  { ...companionEnvelope(escaped), id: companionId(8), name: "Original Text Courier", scope: "shared" as const, owner_id: companionId(9) }];
const parsed = rows.map(row => {
  const entry = parseContentDefinition(row); if (!entry) throw Error("Original companion fixture must pass canonical admission");
  return entry as CompendiumEntry;
});
const params = Object.fromEntries(new URLSearchParams(location.search)), scenario = params.scenario ?? "normal";
const query = { ...parseCompendiumQuery({ ...params, category: "companions" }), system: companionSystemId };
const systems = [{ id: companionSystemId, name: "Original fixture", slug: "fixture", versionLabel: "2014" }];
let view: React.ReactNode;
if (scenario === "denied") view = <p role="alert">Simulated catalog read unavailable. No companion data was delivered.</p>;
else if (location.pathname.startsWith("/library/")) {
  const entry = parsed.find(row => row.id === location.pathname.split("/").at(-1));
  if (!entry) throw Error("Unknown local companion fixture ID");
  view = <CompendiumDetail entry={entry} userId={companionOwnerId} returnHref="/library?category=companions" />;
} else {
  let entries = scenario === "empty" ? [] : parsed;
  if (scenario === "malformed") {
    if (parseContentDefinition({ ...companionEnvelope(), effects: [{ type: "mechanical", stat: "strength", op: "add", value: 2 }] }) !== null) throw Error("Effectful companion became accepted");
    entries = [];
  }
  if (query.q) entries = entries.filter(row => row.name.toLowerCase().includes(query.q.toLowerCase()));
  if (query.provenance === "mine") entries = entries.filter(row => row.owner_id === companionOwnerId);
  if (query.provenance === "shared") entries = entries.filter(row => row.owner_id !== companionOwnerId);
  if (query.provenance === "srd") entries = entries.filter(row => row.source === "srd");
  entries = [...entries].sort((a,b) => a.name.localeCompare(b.name) * (query.sort === "name-desc" ? -1 : 1));
  view = <CompendiumBrowser systems={systems} query={query} result={{ entries, total: entries.length, page: 1, pageSize: 24 }} userId={companionOwnerId} />;
}
createRoot(document.getElementById("root")!).render(<>
  <p className="mb-4 text-sm">Offline companion template QA: original canonical fixtures; auth, catalog entitlements/query responses and Next links simulated. Instances, eligibility, mechanics, database and persistence unavailable.</p>
  {scenario === "malformed" ? <p role="status">Malformed companion unavailable; rejected without altering its effects.</p> : null}{view}
</>);
