"use client";

import { useEffect, useState } from "react";
import { StarRule } from "@/components/journey/ornaments";

const STORAGE_PREFIX = "inkborne:first-arrival:";

/**
 * Called by the builder's final step right before navigating to the
 * sheet, so the sheet knows this load is the moment of completion.
 */
export function markFirstArrival(characterId: string) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + characterId, "1");
  } catch {
    // Storage unavailable (private mode etc.) — the moment is skippable.
  }
}

function consumeFirstArrival(characterId: string): boolean {
  try {
    const key = STORAGE_PREFIX + characterId;
    if (sessionStorage.getItem(key) === "1") {
      sessionStorage.removeItem(key);
      return true;
    }
  } catch {
    // Ignore storage failures.
  }
  return false;
}

interface FirstArrivalProps {
  characterId: string;
  characterName: string;
  /** Persisted flag — once true the moment never replays. */
  seenBefore: boolean;
  /** Persist the seen flag (patches character state). */
  onSeen: () => void;
}

/**
 * One-time "your character is ready" arrival moment (journey brief
 * §4.7): a brief fade-from-dark overlay with the character's name
 * blooming in gold. Plays only when the builder's Finish navigation
 * marked the session AND the character hasn't seen it before; then
 * persists the seen flag. Purely decorative — pointer-events pass
 * through and it dismisses itself.
 */
export function FirstArrival({
  characterId,
  characterName,
  seenBefore,
  onSeen,
}: FirstArrivalProps) {
  const [phase, setPhase] = useState<"hidden" | "showing" | "leaving">("hidden");

  useEffect(() => {
    if (seenBefore) return;
    if (!consumeFirstArrival(characterId)) return;

    const show = setTimeout(() => {
      setPhase("showing");
      onSeen();
    }, 0);
    const leave = setTimeout(() => setPhase("leaving"), 2300);
    const done = setTimeout(() => setPhase("hidden"), 3100);
    return () => {
      clearTimeout(show);
      clearTimeout(leave);
      clearTimeout(done);
    };
    // Intentionally run once per mount for this character.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden="true"
      data-testid="first-arrival"
      className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/95 transition-opacity duration-700 ${
        phase === "leaving" ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="px-6 text-center">
        <p className="j-folio j-fade-in mb-5">Your character is ready</p>
        <p className="j-display j-name-bloom text-4xl text-accent sm:text-5xl">
          {characterName}
        </p>
        <StarRule className="j-fade-in mt-7" />
      </div>
    </div>
  );
}
