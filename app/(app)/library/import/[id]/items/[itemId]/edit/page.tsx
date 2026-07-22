import Link from "next/link";
import { AlertTriangle, ArrowLeft, ShieldCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { MpmbImportFeatRepairForm } from "@/components/library/mpmb-import-feat-repair-form";
import { MpmbImportSpellRepairForm } from "@/components/library/mpmb-import-spell-repair-form";
import { createClient } from "@/lib/supabase/server";
import { getOwnedMpmbImportRepairItem } from "@/lib/supabase/mpmb-imports-server";

interface MpmbImportRepairPageProps {
  params: Promise<{
    id: string;
    itemId: string;
  }>;
}

const SAVE_ABILITIES = new Set([
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
]);

export default async function MpmbImportRepairPage({
  params,
}: MpmbImportRepairPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id, itemId } = await params;
  const item = await getOwnedMpmbImportRepairItem(id, itemId);
  if (!item) notFound();

  const initialSaveAbility = item.contentType === "spell"
    && item.data.dc
    && SAVE_ABILITIES.has(item.data.dc.type)
    ? item.data.dc.type
    : undefined;
  const initialFeatPrerequisite = item.contentType === "feat"
    && SAVE_ABILITIES.has(item.data.prerequisites[0]?.stat ?? "")
    ? item.data.prerequisites[0]
    : undefined;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-7">
      <Link
        href={`/library/import/${item.importId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to import review
      </Link>

      <div>
        <p className="j-folio">Guided import repair</p>
        <h1 className="j-display mt-1.5 text-3xl text-foreground sm:text-4xl">
          Add missing details
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Review only the fields the static mapper could not determine safely
          for <span className="font-medium text-foreground">{item.candidateName}</span>.
        </p>
      </div>

      <div className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <ShieldCheck className="size-4 text-accent" />
          Narrow, audited correction
        </p>
        <p className="mt-1 leading-relaxed">
          Inkborne validates this correction on the server and records which
          normalized fields you supplied. The original JavaScript is not stored.
        </p>
      </div>

      {item.otherBlockingIssues > 0 && (
        <div
          role="note"
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
        >
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4" />
            More review will still be required
          </p>
          <p className="mt-1 leading-relaxed">
            This {item.contentType} has {item.otherBlockingIssues} additional blocking
            {item.otherBlockingIssues === 1 ? " issue" : " issues"} that this
            guided repair does not change.
          </p>
        </div>
      )}

      {item.contentType === "spell" ? (
        <MpmbImportSpellRepairForm
          importId={item.importId}
          itemId={item.itemId}
          revision={item.revision}
          candidateName={item.candidateName}
          repairFields={item.repairFields}
          initialMaterial={item.data.material}
          initialSaveAbility={initialSaveAbility}
          initialSaveSuccess={item.data.dc?.success}
        />
      ) : (
        <MpmbImportFeatRepairForm
          importId={item.importId}
          itemId={item.itemId}
          revision={item.revision}
          candidateName={item.candidateName}
          repairFields={item.repairFields}
          initialPrerequisiteAbility={initialFeatPrerequisite?.stat}
          initialPrerequisiteMinimum={initialFeatPrerequisite?.value}
          initialAction={item.data.action}
          initialRecovery={item.data.recovery}
          initialSpellcastingAbility={
            SAVE_ABILITIES.has(item.data.spellcastingAbility ?? "")
              ? item.data.spellcastingAbility
              : undefined
          }
        />
      )}
    </div>
  );
}
