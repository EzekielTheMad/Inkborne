"use client";

import type { CharacterChoices } from "@/lib/types/character";
import type { NarrativeData } from "@/lib/types/narrative";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PersonalityCardProps {
  choices: CharacterChoices;
  narrative: NarrativeData;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground whitespace-pre-line">{value}</dd>
    </div>
  );
}

export function PersonalityCard({ choices, narrative }: PersonalityCardProps) {
  const traits = choices.personality_traits?.filter(Boolean);
  const ideals = choices.ideals?.filter(Boolean);
  const bonds = choices.bonds?.filter(Boolean);
  const flaws = choices.flaws?.filter(Boolean);
  const { motivation, mannerisms, fear } = narrative;

  const hasContent =
    (traits && traits.length > 0) ||
    (ideals && ideals.length > 0) ||
    (bonds && bonds.length > 0) ||
    (flaws && flaws.length > 0) ||
    motivation ||
    mannerisms ||
    fear;

  if (!hasContent) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-accent">Personality</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          {traits && traits.length > 0 && (
            <Field label="Personality Traits" value={traits.join("\n")} />
          )}
          {motivation && <Field label="Motivation" value={motivation} />}
          {ideals && ideals.length > 0 && (
            <Field label="Ideals" value={ideals.join("\n")} />
          )}
          {bonds && bonds.length > 0 && (
            <Field label="Bonds" value={bonds.join("\n")} />
          )}
          {flaws && flaws.length > 0 && (
            <Field label="Flaws" value={flaws.join("\n")} />
          )}
          {mannerisms && <Field label="Mannerisms" value={mannerisms} />}
          {fear && <Field label="Fear / Secret" value={fear} />}
        </dl>
      </CardContent>
    </Card>
  );
}
