"use client";

import { Moon, Sun } from "lucide-react";
import { useResources } from "@/lib/character/character-context";
import { groupByRecovery } from "@/lib/resources/helpers";
import { ResourceCounter } from "@/components/sheet/resource-counter";
import type { FeatureResource } from "@/lib/types/resources";

/**
 * Left-column panel listing every active feature resource, grouped by recovery
 * type (short rest first). Renders nothing when the character has no resources.
 */
export function ResourcesWidget() {
  const { resources, uses, setUsed } = useResources();

  if (resources.length === 0) return null;

  const grouped = groupByRecovery(resources);

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
      <p className="text-xs text-muted-foreground">Resources</p>

      {grouped.short.length > 0 && (
        <ResourceGroup
          label="Short Rest"
          icon={<Moon className="size-3" />}
          resources={grouped.short}
          uses={uses}
          setUsed={setUsed}
        />
      )}
      {grouped.long.length > 0 && (
        <ResourceGroup
          label="Long Rest"
          icon={<Sun className="size-3" />}
          resources={grouped.long}
          uses={uses}
          setUsed={setUsed}
        />
      )}
    </div>
  );
}

interface ResourceGroupProps {
  label: string;
  icon: React.ReactNode;
  resources: FeatureResource[];
  uses: Record<string, number>;
  setUsed: (slug: string, n: number) => void;
}

function ResourceGroup({ label, icon, resources, uses, setUsed }: ResourceGroupProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="space-y-1">
        {resources.map((r) => (
          <ResourceCounter
            key={r.slug}
            resource={r}
            used={uses[r.slug] ?? 0}
            onChange={(n) => setUsed(r.slug, n)}
            layout="widget"
          />
        ))}
      </div>
    </div>
  );
}
