import type { ContentEntry } from "@/components/builder/content-browser";

interface OverviewTabProps {
  classContent: ContentEntry;
}

export function OverviewTab({ classContent }: OverviewTabProps) {
  const data = classContent.data as Record<string, unknown>;
  const description = typeof data.description === "string" ? data.description : null;
  const primaryAbility = typeof data.primaryAbility === "string" ? data.primaryAbility : null;
  const savingThrows = (data.saving_throws as string[] | undefined) ?? [];
  const hitDie = data.hit_die as number | undefined;

  return (
    <div className="space-y-4">
      {description && (
        <p className="text-sm leading-relaxed text-foreground">{description}</p>
      )}

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {hitDie != null && (
          <div className="flex justify-between sm:block">
            <dt className="text-muted-foreground">Hit die</dt>
            <dd className="sm:mt-0.5 font-medium">d{hitDie}</dd>
          </div>
        )}
        {primaryAbility && (
          <div className="flex justify-between sm:block">
            <dt className="text-muted-foreground">Primary ability</dt>
            <dd className="sm:mt-0.5 font-medium">{primaryAbility}</dd>
          </div>
        )}
        {savingThrows.length > 0 && (
          <div className="flex justify-between sm:block">
            <dt className="text-muted-foreground">Saving throws</dt>
            <dd className="sm:mt-0.5 font-medium capitalize">
              {savingThrows.join(", ")}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
