import Link from "next/link";
import { ArrowLeft, GitCompareArrows, ShieldCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { MpmbImportConflictResolutionForm } from "@/components/library/mpmb-import-conflict-resolution-form";
import { getOwnedMpmbImportConflictItem } from "@/lib/supabase/mpmb-imports-server";
import { createClient } from "@/lib/supabase/server";

interface MpmbImportConflictPageProps {
  params: Promise<{
    id: string;
    itemId: string;
  }>;
}

export default async function MpmbImportConflictPage({
  params,
}: MpmbImportConflictPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id, itemId } = await params;
  const item = await getOwnedMpmbImportConflictItem(id, itemId);
  if (!item) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-7">
      <Link
        href={`/homebrew/import/${item.importId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to import review
      </Link>

      <div>
        <p className="j-folio">Import conflict</p>
        <h1 className="j-display mt-1.5 text-3xl text-foreground sm:text-4xl">
          Choose what to keep
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Your private Homebrew collection already contains {item.contentType === "spell" ? "a spell" : "a feat"}
          {" "}named <span className="font-medium text-foreground">{item.candidateName}</span>.
          Pick an explicit outcome before this import can commit.
        </p>
      </div>

      <div className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <GitCompareArrows className="size-4 text-accent" />
          No automatic merge
        </p>
        <p className="mt-1 leading-relaxed">
          Rules payloads can look structurally compatible while meaning different
          things at the table. This release uses an auditable keep-or-replace
          choice instead of guessing field-level intent.
        </p>
      </div>

      <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <ShieldCheck className="size-4 text-accent" />
          Owner-only and revision-safe
        </p>
        <p className="mt-1 leading-relaxed">
          Inkborne rechecks ownership, the target version, sharing state, system,
          type, and normalized name inside one database transaction.
        </p>
      </div>

      <MpmbImportConflictResolutionForm
        importId={item.importId}
        itemId={item.itemId}
        revision={item.revision}
        candidateName={item.candidateName}
        conflicts={item.conflicts}
        conflictResolution={item.conflictResolution}
        replacementContentId={item.replacementContentId}
        replacementExpectedVersion={item.replacementExpectedVersion}
      />
    </div>
  );
}
