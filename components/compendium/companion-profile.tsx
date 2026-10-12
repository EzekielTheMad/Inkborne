import { companionDataSchema, COMPANION_ROLE_LABELS } from "@/lib/schemas/content-types/companion";
import { MonsterStatBlock } from "./monster-stat-block";

/** Plain declared statistics only. Never resolves/attaches a creature or applies
 * its ability scores, proficiency, choices or actions to a character. */
export function CompanionProfile({ data }: { data: unknown }) {
  const parsed = companionDataSchema.safeParse(data);
  if (!parsed.success) return <p role="status" className="text-sm">Companion template unavailable.</p>;
  return <section aria-label="Companion template" className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
    <h2 className="j-folio">{COMPANION_ROLE_LABELS[parsed.data.role]}</h2>
    <p className="text-sm text-muted-foreground">Read-only companion template. Attaching, controlling, transforming and summoning are not available here.</p>
    <MonsterStatBlock data={parsed.data.stat_block} />
  </section>;
}
