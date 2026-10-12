import { NpcProfile } from "@/components/compendium/npc-profile";
import type { NpcJsonReview } from "@/lib/import/npc-json/types";

/** Read-only validated local review. No app route, actions, Auth or persistence. */
export function NpcJsonImportPreview({ review, retained = false }: { review: NpcJsonReview; retained?: boolean }) {
  const { candidate, provenance } = review;
  return <section aria-label="Local NPC JSON review" className="j-card-paper min-w-0 space-y-6 p-5 [overflow-wrap:anywhere]">
    <p role="status">{retained ? "Previous local preview retained; it does not describe the selected file." : "Validated local prototype preview."} Format choice remains provisional. Nothing was imported or saved.</p>
    <h1 className="text-2xl font-semibold whitespace-pre-line">{candidate.name}</h1>
    <dl className="space-y-2 text-sm"><div><dt>Original file</dt><dd>{provenance.safeFilename}</dd></div>
      <div><dt>Original bytes</dt><dd>{provenance.sourceBytes}</dd></div><div><dt>SHA-256 of original bytes</dt><dd className="font-mono">{provenance.sourceSha256}</dd></div></dl>
    <p className="text-sm text-muted-foreground">Optional fields stay absent or explicitly empty. Array order and duplicate story ideas are retained. Object-key order is not a PostgreSQL JSONB promise.</p>
    <dl aria-label="Declared optional groups" className="space-y-2 text-sm">
      <div><dt>Personality</dt><dd>{candidate.data.personality === undefined ? "Not supplied" : Object.keys(candidate.data.personality).length === 0 ? "Included empty object" : "Included"}</dd></div>
      {(["personality_traits", "ideals", "bonds", "flaws"] as const).map(key => <div key={key}><dt>{key.replaceAll("_", " ")}</dt>
        <dd>{candidate.data.personality?.[key] === undefined ? "Not supplied" : candidate.data.personality[key]!.length === 0 ? "Included empty list" : `${candidate.data.personality[key]!.length} declared ideas`}</dd></div>)}
      <div><dt>Relationship ideas</dt><dd>{candidate.data.relationships === undefined ? "Not supplied" : candidate.data.relationships.length === 0 ? "Included empty list" : `${candidate.data.relationships.length} declared ideas`}</dd></div>
    </dl>
    {candidate.data.description !== undefined ? <section aria-label="Description"><h2 className="j-folio">Description</h2><p className="whitespace-pre-line text-sm">{candidate.data.description}</p></section> : null}
    {candidate.data.occupation !== undefined ? <section aria-label="Occupation"><h2 className="j-folio">Occupation</h2><p className="whitespace-pre-line text-sm">{candidate.data.occupation}</p></section> : null}
    <NpcProfile data={candidate.data} />
  </section>;
}
