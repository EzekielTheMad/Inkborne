import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileCode2,
  FlaskConical,
  GitCompareArrows,
  Import,
  LockKeyhole,
  PencilLine,
  ShieldCheck,
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
    repaired?: string | string[];
    resolved?: string | string[];
    previewed?: string | string[];
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
  const repaired = query.repaired === "1";
  const resolved = query.resolved === "1";
  const previewed = query.previewed === "1";
  const selectedCount = review.items.filter((item) => item.selected).length;
  const unresolvedSelectedConflicts = review.items.filter((item) =>
    item.selected
    && !item.conflictResolved
    && (item.hasLiveConflict || item.conflictResolution !== null)
  ).length;
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

      {(Number.isFinite(committed) || repaired || resolved || previewed || error) && (
        <div
          role={error ? "alert" : "status"}
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            error
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          )}
        >
          {error
            ?? (repaired
              ? "Missing details saved. The review has been updated."
              : resolved
                ? "Conflict resolution saved. The review has been updated."
                : previewed
                  ? "Calculation preview confirmed for this review revision."
                : `${committed} ${committed === 1 ? "definition" : "definitions"} added to your private library.`)}
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

      {review.status === "review" && review.previewValidated && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          <p className="flex items-center gap-2 font-medium">
            <ShieldCheck className="size-4" />
            Calculations confirmed for revision {review.revision}
          </p>
          <p className="mt-1 text-xs opacity-80">
            Changing a selection, repair, or conflict choice will require a new preview.
          </p>
        </div>
      )}

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
                <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
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
                      {item.userEditedFields.length > 0 && (
                        <Badge variant="secondary">User corrected</Badge>
                      )}
                      {!item.conflictResolved
                        && (item.hasLiveConflict || item.conflictResolution !== null) && (
                        <Badge variant="destructive">Conflict</Badge>
                      )}
                      {item.conflictResolved && item.conflictResolution === "keep_both" && (
                        <Badge variant="secondary">Keep both</Badge>
                      )}
                      {item.conflictResolved && item.conflictResolution === "replace" && (
                        <Badge variant="secondary">Replace</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.registry}.{item.sourceKey} · line {item.location.line}
                    </p>
                  </div>

                  <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:shrink-0 sm:items-end">
                    {item.mappingStatus === "valid" && !completed && review.status === "review" && (
                      <MpmbImportSelectionButton
                        importId={review.id}
                        itemId={item.id}
                        revision={review.revision}
                        selected={item.selected}
                      />
                    )}
                    {item.repairable && !completed && review.status === "review" && (
                      <Link
                        href={`/library/import/${review.id}/items/${item.id}/edit`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <PencilLine className="size-3.5" />
                        Add missing details
                      </Link>
                    )}
                    {(item.hasLiveConflict || item.conflictResolution !== null)
                      && !completed && review.status === "review" && (
                      <Link
                        href={`/library/import/${review.id}/items/${item.id}/conflict`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <GitCompareArrows className="size-3.5" />
                        {item.conflictResolved ? "Change resolution" : "Resolve conflict"}
                      </Link>
                    )}
                    {item.committedContentId && (
                      <Badge variant="secondary">Imported</Badge>
                    )}
                  </div>
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
            <div className="flex flex-col items-end gap-1.5">
              {selectedCount > 0 && unresolvedSelectedConflicts === 0 ? (
                <Link
                  href={`/library/import/${review.id}/preview`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  <FlaskConical className="size-4" />
                  {review.previewValidated ? "Review calculations" : "Preview calculations"}
                </Link>
              ) : (
                <Button type="button" variant="outline" disabled>
                  <FlaskConical className="size-4" />
                  Preview calculations
                </Button>
              )}
              <form action={finishMpmbImport}>
                <input type="hidden" name="import_id" value={review.id} />
                <input type="hidden" name="expected_revision" value={review.revision} />
                <Button
                  type="submit"
                  variant="gold"
                  disabled={
                    selectedCount === 0
                    || unresolvedSelectedConflicts > 0
                    || !review.previewValidated
                  }
                >
                  <Import className="size-4" />
                  Import {selectedCount || "selected"}
                </Button>
              </form>
              {unresolvedSelectedConflicts > 0 && (
                <p className="max-w-72 text-right text-xs text-amber-700 dark:text-amber-300">
                  Resolve {unresolvedSelectedConflicts} selected
                  {unresolvedSelectedConflicts === 1 ? " conflict" : " conflicts"} before importing.
                </p>
              )}
              {selectedCount > 0
                && unresolvedSelectedConflicts === 0
                && !review.previewValidated && (
                <p className="max-w-72 text-right text-xs text-muted-foreground">
                  Preview and confirm this revision before importing.
                </p>
              )}
            </div>
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
