import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FlaskConical,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { confirmMpmbImportPreview } from "@/app/(app)/library/import/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  getOwnedMpmbImportPreview,
  type MpmbImportCalculationPreview,
} from "@/lib/supabase/mpmb-imports-server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

interface MpmbImportPreviewPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}

function formatDelta(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function FeatPreview({
  item,
}: {
  item: Extract<
    MpmbImportCalculationPreview["calculation"]["items"][number],
    { contentType: "feat"; status: "passed" }
  >;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {item.levels.map((level) => {
          const hasChanges = level.abilities.length > 0
            || level.derivedStats.length > 0
            || level.speed.length > 0
            || level.visionAdded.length > 0
            || level.damageResistancesAdded.length > 0
            || level.saveAdvantagesAdded.length > 0
            || level.saveImmunitiesAdded.length > 0;
          return (
            <section
              key={level.level}
              aria-label={`Level ${level.level} result`}
              className="rounded-lg border border-border/80 bg-muted/20 p-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Level {level.level}
              </p>
              {!hasChanges ? (
                <p className="mt-2 text-xs text-muted-foreground">No calculated sheet changes.</p>
              ) : (
                <dl className="mt-2 space-y-2 text-xs">
                  {[...level.abilities, ...level.derivedStats, ...level.speed].map((change) => (
                    <div key={`${change.slug}-${change.label}`} className="flex items-center justify-between gap-3">
                      <dt className="min-w-0 truncate text-muted-foreground capitalize">{change.label}</dt>
                      <dd className="shrink-0 font-mono text-foreground">
                        {change.before} → {change.after}{" "}
                        <span className="text-emerald-700 dark:text-emerald-300">
                          ({formatDelta(change.delta)})
                        </span>
                      </dd>
                    </div>
                  ))}
                  {level.visionAdded.map((entry) => (
                    <div key={`${entry.type}-${entry.range}`} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground capitalize">{entry.type}</dt>
                      <dd className="font-mono text-foreground">+{entry.range} ft</dd>
                    </div>
                  ))}
                  {level.damageResistancesAdded.length > 0 && (
                    <div>
                      <dt className="text-muted-foreground">Resistances</dt>
                      <dd className="text-foreground">{level.damageResistancesAdded.join(", ")}</dd>
                    </div>
                  )}
                  {level.saveAdvantagesAdded.length > 0 && (
                    <div>
                      <dt className="text-muted-foreground">Save advantage</dt>
                      <dd className="text-foreground">{level.saveAdvantagesAdded.join(", ")}</dd>
                    </div>
                  )}
                  {level.saveImmunitiesAdded.length > 0 && (
                    <div>
                      <dt className="text-muted-foreground">Save immunity</dt>
                      <dd className="text-foreground">{level.saveImmunitiesAdded.join(", ")}</dd>
                    </div>
                  )}
                </dl>
              )}
            </section>
          );
        })}
      </div>

      {(item.narratives.length > 0 || item.grants.length > 0) && (
        <details className="rounded-lg border border-border/80 px-3 py-2 text-xs">
          <summary className="cursor-pointer font-medium text-foreground">
            Narrative and grant output
          </summary>
          <div className="mt-2 space-y-2 text-muted-foreground">
            {item.narratives.map((narrative, index) => (
              <p key={`${narrative.tag ?? "narrative"}-${index}`} className="whitespace-pre-wrap leading-relaxed">
                {narrative.tag && <span className="font-medium text-foreground">{narrative.tag}: </span>}
                {narrative.text}
              </p>
            ))}
            {item.grants.map((grant, index) => (
              <p key={`${grant.stat}-${grant.value}-${index}`}>
                Grant: <span className="text-foreground">{grant.stat} — {grant.value}</span>
              </p>
            ))}
          </div>
        </details>
      )}

      {item.warnings.map((warning) => (
        <p key={warning} className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {warning}
        </p>
      ))}
    </div>
  );
}

function SpellPreview({
  item,
}: {
  item: Extract<
    MpmbImportCalculationPreview["calculation"]["items"][number],
    { contentType: "spell"; status: "passed" }
  >;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{item.castingTime}</Badge>
        <Badge variant="outline">{item.range}</Badge>
        <Badge variant="outline">{item.components.join(", ") || "No components"}</Badge>
        {item.concentration && <Badge variant="secondary">Concentration</Badge>}
        {item.ritual && <Badge variant="secondary">Ritual</Badge>}
      </div>

      <div className="overflow-hidden rounded-lg border border-border/80">
        {item.casts.map((cast, index) => (
          <div
            key={`${cast.label}-${cast.castLevel}`}
            className={cn(
              "grid gap-2 px-3 py-3 text-xs sm:grid-cols-[minmax(10rem,1fr)_2fr]",
              index > 0 && "border-t border-border/70",
            )}
          >
            <div>
              <p className="font-medium text-foreground">{cast.label}</p>
              <p className="mt-0.5 text-muted-foreground">
                Test character level {cast.characterLevel}
              </p>
            </div>
            <div className="space-y-1 text-muted-foreground">
              {cast.rolls.map((roll) => (
                <p key={`${roll.kind}-${roll.label}-${roll.expression}`}>
                  {roll.label}: <span className="font-mono text-foreground">{roll.expression}</span>
                </p>
              ))}
              {cast.dc && (
                <p>
                  {cast.dc.ability} save: <span className="font-mono text-foreground">DC {cast.dc.value}</span>
                  {cast.dc.success !== "other" ? ` · ${cast.dc.success} on success` : ""}
                </p>
              )}
              {cast.persistentEffect && <p>Creates a persistent active effect.</p>}
              {cast.rolls.length === 0 && !cast.dc && !cast.persistentEffect && (
                <p>No automated cast output at this level.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {item.warnings.map((warning) => (
        <p key={warning} className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {warning}
        </p>
      ))}
    </div>
  );
}

export default async function MpmbImportPreviewPage({
  params,
  searchParams,
}: MpmbImportPreviewPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const preview = await getOwnedMpmbImportPreview(id);
  if (!preview) notFound();
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error.slice(0, 300) : null;
  const failures = preview.calculation.items.filter((item) => item.status === "failed").length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7">
      <Link
        href={`/library/import/${preview.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to import review
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="j-folio flex items-center gap-2">
            <FlaskConical className="size-4 text-accent" />
            Calculation harness
          </p>
          <h1 className="j-display mt-1.5 text-3xl text-foreground sm:text-4xl">
            Preview imported content
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{preview.originalFilename}</p>
        </div>
        <Badge variant={preview.calculation.passed ? "secondary" : "destructive"}>
          {preview.calculation.passed
            ? `${preview.calculation.items.length} passed`
            : `${failures} failed`}
        </Badge>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section aria-labelledby="assumptions-heading" className="rounded-lg border border-accent/30 bg-accent/5 p-4">
        <h2 id="assumptions-heading" className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Sparkles className="size-4 text-accent" />
          Neutral test character
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Levels {preview.calculation.assumptions.levels.join(", ")} · abilities {preview.calculation.assumptions.abilityScore}
          {" "}· casting ability {preview.calculation.assumptions.castingAbilityScore} · spell DC {preview.calculation.assumptions.spellSaveDc}
          {" "}· spell attack +{preview.calculation.assumptions.spellAttackBonus}. {preview.calculation.assumptions.equipment}.
          Each definition is tested independently.
        </p>
      </section>

      {preview.calculation.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-5 py-10 text-center">
          <p className="font-medium text-foreground">Nothing is selected for preview.</p>
          <p className="mt-1 text-sm text-muted-foreground">Return to the review and select at least one ready item.</p>
        </div>
      ) : (
        <section aria-label="Calculation results" className="space-y-4">
          {preview.calculation.items.map((item) => (
            <article key={item.id} className="j-card-paper p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {item.status === "passed"
                  ? <CheckCircle2 className="size-4 text-emerald-600" />
                  : <AlertTriangle className="size-4 text-destructive" />}
                <h2 className="j-display text-xl text-foreground">{item.name}</h2>
                <Badge variant="outline" className="capitalize">{item.contentType}</Badge>
                <Badge variant={item.status === "passed" ? "secondary" : "destructive"}>
                  {item.status === "passed" ? "Passed" : "Failed"}
                </Badge>
              </div>

              {item.status === "failed" ? (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {item.message}
                </p>
              ) : item.contentType === "feat" ? (
                <FeatPreview item={item} />
              ) : (
                <SpellPreview item={item} />
              )}
            </article>
          ))}
        </section>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Confirmation applies only to revision {preview.revision}. Any later selection,
          repair, or conflict change makes it stale automatically.
        </p>
        {preview.previewValidated ? (
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <span className="inline-flex items-center justify-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="size-4" />
              Revision confirmed
            </span>
            <Link href={`/library/import/${preview.id}`} className={buttonVariants({ variant: "gold" })}>
              Return to import
            </Link>
          </div>
        ) : (
          <form action={confirmMpmbImportPreview}>
            <input type="hidden" name="import_id" value={preview.id} />
            <input type="hidden" name="expected_revision" value={preview.revision} />
            <Button type="submit" variant="gold" disabled={!preview.calculation.passed}>
              <ShieldCheck className="size-4" />
              Confirm calculations
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
