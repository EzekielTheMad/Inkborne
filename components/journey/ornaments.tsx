import { cn } from "@/lib/utils";

/**
 * Journey (M2) manuscript ornaments.
 *
 * Translated from docs/design-briefs/design_handoff_journey_alpha
 * (journey-primitives.jsx). All decorative — every component here is
 * aria-hidden and safe to drop from the accessibility tree.
 *
 * Restraint rule from the handoff: at most one inkstain per visible
 * region; rules and quills are sparse accents, not wallpaper.
 */

interface InkRuleProps {
  glyph?: string;
  className?: string;
}

/** Hairline rule with a centered manuscript glyph (✦ by default). */
export function InkRule({ glyph = "✦", className }: InkRuleProps) {
  return (
    <div className={cn("j-rule", className)} role="presentation">
      <span className="j-rule-glyph">{glyph}</span>
    </div>
  );
}

/** Three faint stars — cross-section divider. */
export function StarRule({ className }: { className?: string }) {
  return (
    <div className={cn("j-star-rule", className)} aria-hidden="true">
      ✦ &nbsp; ✦ &nbsp; ✦
    </div>
  );
}

interface InkstainProps {
  className?: string;
  /** Tone of the stain — gold (default) or purple. */
  tone?: "gold" | "purple";
}

/**
 * Abstract organic ink stain, used as ambient background behind heroes
 * and cards. Position/size it with the className (it renders
 * `position: absolute`); opacity should stay in the 0.04–0.08 range.
 */
export function Inkstain({ className, tone = "gold" }: InkstainProps) {
  return (
    <svg
      viewBox="0 0 320 220"
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute",
        tone === "gold" ? "text-accent" : "text-primary",
        className,
      )}
    >
      <g fill="currentColor">
        <path d="M70 30 c 40 -18 100 -18 140 0 c 50 22 70 70 50 110 c -22 40 -90 60 -150 50 c -60 -10 -110 -50 -100 -100 c 4 -22 24 -46 60 -60 z" opacity="0.95" />
        <circle cx="245" cy="35" r="6" />
        <circle cx="280" cy="60" r="3" />
        <circle cx="20" cy="170" r="4" />
        <circle cx="290" cy="180" r="5" />
        <circle cx="50" cy="200" r="2.5" />
      </g>
    </svg>
  );
}

/** Decorative quill — used on the open-source moment and verify page. */
export function Quill({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
      className={cn("text-accent", className)}
    >
      <path
        d="M62 14 c -22 4 -38 22 -42 42 c -4 14 8 18 16 8 c 8 -10 22 -22 30 -36 c 6 -10 4 -16 -4 -14 z"
        fill="currentColor"
        opacity="0.55"
      />
      <path d="M58 18 L 22 56 L 18 60" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      <path d="M18 60 L 14 64 L 14 70" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="14" cy="70" r="2" fill="currentColor" />
    </svg>
  );
}
