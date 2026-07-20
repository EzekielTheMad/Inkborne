import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileCode2,
  Import,
  LockKeyhole,
  XCircle,
} from "lucide-react";
import { notFound, redirect } from "next/navigation";

import {
  abandonMpmbImport,
  finishMpmbImport,
} from "@/app/(app)/library/import/actions";
import { MpmbImportSelectionButton } from "@/components/library/mpmb-import-selection-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getOwnedMpmbImportReview } from "@/lib/supabase/mpmb-imports-server";
import { cn } from "@/lib/utils";

interface MpmbImportReviewPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    committed?: string | string[];
    error?: string | string[];
  }>;
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KiB`;
}

const statusPresentation = {
  valid: {
    label: "Ready",
    icon: CheckCircle2,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  needs_info: {
    label: "Needs review",
    icon: AlertTriangle,
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  unsupported: {
    label: "Unsupported",
    icon: XCircle,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
} as const;

export default async function MpmbImportReviewPage({
  params,
  searchParams,
}: MpmbImportReviewPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const review = await getOwnedMpmbImportReview(id);
  if (!review) notFound();
  const query = await searchParams;
  const committed = typeof query.committed === "string"
    ? Number(query.committed)
    : null;
  const error = typeof query.error === "string" ? query.error.slice(0, 300) : null;
  const selectedCount = review.items.filter((item) => item.selected).length;
  const completed = review.status === "completed";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7">
      <Link href="/library" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Back to library
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="j-folio">Static import review</p>
          <h1 className="j-display mt-1.5 text-3xl text-foreground sm:text-4xl">
            {review.originalFilename}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{formatBytes(review.sourceBytes)}</span>
            <span>Parser {review.parserVersion}</span>
            <span>Mapper {review.mapperVersion}</span>
            {review.requiredSheetVersion && (
              <span>Sheet {review.requiredSheetVersion}</span>
            )}
          </p>
        </div>
        <Badge variant={completed ? "secondary" : "outline"}>
          {completed ? "Committed" : review.status === "cancelled" ? "Cancelled" : "Private review"}
        </Badge>
      </div>

      {(Number.isFinite(committed) || error) && (
        <div
          role={error ? "alert" : "status"}
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            error
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          )}
        >
          {error ?? `${committed} ${committed === 1 ? "definition" : "definitions"} added to your private library.`}
        </div>
      )}

      <section aria-label="Import summary" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["Ready", review.summary.valid],
          ["Needs info", review.summary.needsInfo],
          ["Unsupported", review.summary.unsupported],
          ["Warnings", review.summary.warnings],
          ["Blocking", review.summary.blockingIssues],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>

      <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <LockKeyhole className="size-4 text-accent" />
          Imported definitions stay private
        </p>
        <p className="mt-1 leading-relaxed">
          The database records their provenance and rejects campaign sharing until
          a separate sharing-rights workflow exists.
        </p>
      </div>

      <section aria-labelledby="mapped-items-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="size-4 text-accent" />
            <h2 id="mapped-items-heading" className="j-folio">Mapped items</h2>
          </div>
          {!completed && review.status === "review" && (
            <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
          )}
        </div>

        <div className="space-y-3">
          {review.items.map((item) => {
            const presentation = statusPresentation[item.mappingStatus];
            const StatusIcon = presentation.icon;
            return (
              <article key={item.id} className="j-card-paper p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="j-display truncate text-lg text-foreground">
                        {item.candidateName ?? item.sourceKey}
                      </h3>
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", presentation.className)}>
                        <StatusIcon className="size-3" />
                        {presentation.label}
                      </span>
                      <Badge variant="outline" className="capitalize">{item.contentType}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.registry}.{item.sourceKey} · line {item.location.line}
                    </p>
                  </div>

                  {item.mappingStatus === "valid" && !completed && review.status === "review" && (
                    <MpmbImportSelectionButton
                      importId={review.id}
                      itemId={item.id}
                      revision={review.revision}
                      selected={item.selected}
                    />
                  )}
                  {item.committedContentId && (
                    <Badge variant="secondary">Imported</Badge>
                  )}
                </div>

                {item.diagnostics.length > 0 && (
                  <ul className="mt-4 space-y-1.5 border-t border-border/70 pt-3">
                    {item.diagnostics.map((diagnostic, index) => (
                      <li key={`${diagnostic.code ?? "issue"}-${index}`} className="text-xs leading-relaxed text-muted-foreground">
                        <span className={diagnostic.severity === "blocking" ? "font-medium text-amber-700 dark:text-amber-300" : "font-medium text-foreground"}>
                          {diagnostic.code ?? "Review note"}
                        </span>
                        {diagnostic.message ? ` — ${diagnostic.message}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        {review.status === "review" ? (
          <>
            <form action={abandonMpmbImport}>
              <input type="hidden" name="import_id" value={review.id} />
              <Button type="submit" variant="ghost">Cancel import</Button>
            </form>
            <form action={finishMpmbImport}>
              <input type="hidden" name="import_id" value={review.id} />
              <input type="hidden" name="expected_revision" value={review.revision} />
              <Button type="submit" variant="gold" disabled={selectedCount === 0}>
                <Import className="size-4" />
                Import {selectedCount || "selected"}
              </Button>
            </form>
          </>
        ) : (
          <Link href="/library" className={buttonVariants({ variant: "gold" })}>
            View library
          </Link>
        )}
      </div>
    </div>
  );
}
