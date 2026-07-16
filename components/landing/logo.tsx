import Link from "next/link";

interface LogoProps {
  src?: string;
  linkTo?: string;
  className?: string;
}

/** Gold nib mark — the journey-bundle placeholder logo glyph. */
function NibMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 28 28" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="ink-logo-gold" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#e1bf6c" />
          <stop offset="1" stopColor="#a07e2c" />
        </linearGradient>
      </defs>
      <path
        d="M14 3 C 17 8 22 11 24 14 C 22 17 18 20 14 25 C 10 20 6 17 4 14 C 6 11 11 8 14 3 Z"
        fill="url(#ink-logo-gold)"
        opacity="0.9"
      />
      <path d="M14 8 L14 22" stroke="#0b0a10" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
      <circle cx="14" cy="14" r="1.4" fill="#0b0a10" opacity="0.7" />
    </svg>
  );
}

export function Logo({ src, linkTo = "/", className }: LogoProps) {
  const content = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="Inkborne" className={className || "h-8"} />
  ) : (
    <span className={`inline-flex items-center gap-2 ${className || ""}`}>
      <NibMark />
      <span className="j-display text-xl text-foreground">Inkborne</span>
    </span>
  );

  return (
    <Link href={linkTo} className="flex items-center">
      {content}
    </Link>
  );
}
