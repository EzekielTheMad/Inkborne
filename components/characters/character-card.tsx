import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Character } from "@/lib/types/character";

interface CharacterCardProps {
  character: Character & {
    game_systems?: { name: string } | null;
    campaigns?: { name: string } | null;
  };
}

export function CharacterCard({ character }: CharacterCardProps) {
  const classInfo = character.choices?.classes;
  const primaryClass = classInfo?.[0];

  return (
    <Link href={`/characters/${character.id}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{character.name}</CardTitle>
          <CardDescription>
            {character.game_systems?.name ?? "Unknown System"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {primaryClass ? (
              <span className="capitalize">
                Level {character.level} {primaryClass.slug}
              </span>
            ) : (
              <span className="italic">No class selected</span>
            )}
          </div>
          {character.campaigns?.name && (
            <p className="text-xs text-muted-foreground mt-1">
              {character.campaigns.name}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
