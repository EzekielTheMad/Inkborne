import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  getCompendiumEntryDescription,
  getCompendiumEntryEyebrow,
} from "@/lib/compendium/presentation";
import {
  getCompendiumProvenance,
  type CompendiumEntry,
} from "@/lib/compendium/types";

interface CompendiumRowProps {
  entry: CompendiumEntry;
  userId: string;
  returnHref: string;
}

export function CompendiumRow({ entry, userId, returnHref }: CompendiumRowProps) {
  const provenance = getCompendiumProvenance(entry, userId);

  return (
    <Link
      href={`/library/${entry.id}?returnTo=${encodeURIComponent(returnHref)}`}
      className="j-card-paper group flex h-full flex-col p-5 transition-colors hover:border-accent/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="j-folio text-[10px] text-muted-foreground">
            {getCompendiumEntryEyebrow(entry)}
          </p>
          <h2 className="j-display mt-1 truncate text-xl text-foreground transition-colors group-hover:text-accent">
            {entry.name}
          </h2>
        </div>
        <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-accent" />
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {getCompendiumEntryDescription(entry)}
      </p>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-5">
        <Badge variant={provenance === "SRD" ? "secondary" : "outline"}>
          {provenance}
        </Badge>
        <Badge variant="outline">v{entry.version}</Badge>
      </div>
    </Link>
  );
}
