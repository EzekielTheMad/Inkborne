import Link from "next/link";

interface LogoProps {
  src?: string;
  linkTo?: string;
  className?: string;
}

export function Logo({ src, linkTo = "/", className }: LogoProps) {
  const content = src ? (
    <img src={src} alt="Inkborne" className={className || "h-8"} />
  ) : (
    <span className={`text-xl font-bold text-accent ${className || ""}`}>
      Inkborne
    </span>
  );

  return (
    <Link href={linkTo} className="flex items-center">
      {content}
    </Link>
  );
}
