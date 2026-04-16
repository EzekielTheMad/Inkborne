"use client";

import { NarrativeTab } from "@/components/narrative/narrative-tab";
import { useCharacter, usePortrait } from "@/lib/character/character-context";

export function NarrativePanel() {
  const { character, isOwner, isDm } = useCharacter();
  const { setPortrait } = usePortrait();

  return (
    <div className="max-w-4xl mx-auto p-4">
      <NarrativeTab
        character={character}
        isOwner={isOwner}
        isDm={isDm}
        onPortraitChange={(url) => setPortrait({ url: url ?? undefined })}
        onCropChange={(crop) => setPortrait({ crop })}
      />
    </div>
  );
}
