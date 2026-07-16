/**
 * Shared empty-state treatment for sheet tabs (journey brief §4.8:
 * "these should share a visual treatment — centered, muted, with
 * relevant CTA"). The hint line carries the what-to-do-next nudge.
 */
export function SheetEmptyState({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 text-center text-sm text-muted-foreground">
      <p>{children}</p>
      {hint && <p className="text-xs mt-1">{hint}</p>}
    </div>
  );
}
