import React from "react";
import { createRoot } from "react-dom/client";
import { CompendiumBrowser } from "@/components/compendium/compendium-browser";
import { CompendiumDetail } from "@/components/compendium/compendium-detail";
import { parseCompendiumQuery } from "@/lib/compendium/catalog";
import type { CompendiumEntry } from "@/lib/compendium/types";
import { parseContentDefinition } from "@/lib/supabase/content-definitions-parser";
import { longNpc, npcEnvelope, npcId, npcOwnerId, npcSystemId } from "@/tests/fixtures/npcs";

const injection = '<script>window.compromised=true</script><img src=x onerror="alert(1)">';
const long = longNpc(); long.relationships![19].description = "The final original hook is still reachable.";
const rows = [npcEnvelope(), { ...npcEnvelope({ schema_version: 1 }), id: npcId(4), name: "Original Quiet Visitor" },
  { ...npcEnvelope(long), id: npcId(5), name: "OriginalArchive" + "W".repeat(500) },
  { ...npcEnvelope({ schema_version: 1, description: injection }), id: npcId(6), name: "Original Text Courier", scope: "shared" as const, owner_id: npcId(7) }];
const parsed = rows.map(row => {
  const entry = parseContentDefinition(row);
  if (!entry) throw Error("Original NPC fixture must pass the canonical parser");
  return entry as CompendiumEntry;
});
const params = Object.fromEntries(new URLSearchParams(location.search));
const scenario = params.scenario ?? "normal";
const query = { ...parseCompendiumQuery({ ...params, category: "npcs" }), system: npcSystemId };
const systems = [{ id: npcSystemId, name: "Original local fixture", slug: "fixture", versionLabel: "2014" }];
let view: React.ReactNode;
if (scenario === "denied") {
  // Read failure boundary is simulated; no success/empty response is manufactured.
  view = <p role="alert">Simulated catalog read unavailable. No NPC data was delivered.</p>;
} else if (location.pathname.startsWith("/library/")) {
  const entry = parsed.find(row => row.id === location.pathname.split("/").at(-1));
  if (!entry) throw Error("Unknown local NPC fixture ID");
  view = <CompendiumDetail entry={entry} userId={npcOwnerId} returnHref="/library?category=npcs" />;
} else {
  let entries = scenario === "empty" ? [] : parsed;
  if (scenario === "malformed") {
    const bad = parseContentDefinition({ ...npcEnvelope(), effects: [{ type: "mechanical", stat: "strength", op: "add", value: 2 }] });
    if (bad !== null) throw Error("Effectful NPC must not become an accepted catalog entry");
    entries = [];
  }
  if (query.q) entries = entries.filter(row => row.name.toLowerCase().includes(query.q.toLowerCase()));
  if (query.provenance === "mine") entries = entries.filter(row => row.owner_id === npcOwnerId);
  if (query.provenance === "shared") entries = entries.filter(row => row.owner_id !== npcOwnerId);
  if (query.provenance === "srd") entries = entries.filter(row => row.source === "srd");
  entries = [...entries].sort((a, b) => a.name.localeCompare(b.name) * (query.sort === "name-desc" ? -1 : 1));
  view = <CompendiumBrowser systems={systems} query={query} result={{ entries, total: entries.length, page: 1, pageSize: 24 }} userId={npcOwnerId} />;
}
createRoot(document.getElementById("root")!).render(<>
  <p className="mb-4 text-sm">Offline NPC QA: original canonical fixtures; account, entitlement, query responses and Next links simulated. Database, sharing, campaign secrets and persistence unavailable.</p>
  {scenario === "malformed" ? <p role="status">Malformed NPC unavailable; rejected without altering its effects.</p> : null}
  {view}
</>);
