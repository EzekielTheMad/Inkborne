import { cn } from "@/lib/utils";
import { Logo } from "@/components/landing/logo";
import { Inkstain } from "@/components/journey/ornaments";

/**
 * Shared chrome for the auth surfaces (login / signup / verify /
 * forgot / reset). Journey handoff: AuthShell in journey-auth.jsx —
 * paper-warm centered card, ambient inkstains, quiet alpha footer.
 */
export function AuthShell({
  marginalia,
  children,
}: {
  /** Small italic flourish shown top-right ("Open the notebook."). */
  marginalia?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="j-grain relative flex min-h-screen flex-col overflow-hidden bg-background">
      <Inkstain className="-left-28 -top-14 h-[360px] w-[520px] opacity-5" />
      <Inkstain tone="purple" className="-right-24 bottom-10 h-[300px] w-[420px] opacity-[0.04]" />
      <header className="relative flex items-center justify-between px-6 py-5 sm:px-7">
        <Logo />
        {marginalia && (
          <span className="j-marginalia hidden text-xs sm:inline">{marginalia}</span>
        )}
      </header>
      <main className="relative flex flex-1 items-center justify-center p-4 sm:p-8">
        {children}
      </main>
      <footer className="relative flex justify-center px-6 py-5 text-[11px] tracking-[0.05em] text-muted-foreground">
        ✦ &nbsp; Inkborne is in private alpha &nbsp; ✦
      </footer>
    </div>
  );
}

/** Paper card that frames every auth form. */
export function AuthCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("j-card-paper w-full max-w-md p-6 sm:p-9", className)}>{children}</div>
  );
}

/** Folio kicker + serif title + optional subtitle. */
export function AuthHeading({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mb-6 text-center">
      <p className="j-folio mb-2.5">{kicker}</p>
      <h1 className="j-display text-[28px] leading-tight text-foreground">{title}</h1>
      {sub && <p className="mt-1.5 text-[13px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Hairline "or" divider between OAuth and the email form. */
export function AuthDivider() {
  return (
    <div className="j-rule my-4" role="presentation">
      <span className="j-rule-glyph text-[11px]">or</span>
    </div>
  );
}

/** Inline error rail — red-tinted band above the form fields. */
export function AuthErrorBanner({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="mb-4 rounded-md border border-destructive/35 bg-destructive/[0.06] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#f4a3a3]"
    >
      <p className="mb-1 font-semibold text-[#fbb]">{title}</p>
      {children}
    </div>
  );
}

/** Eyebrow-styled field label used across the auth forms. */
export function AuthLabel({
  htmlFor,
  children,
  className,
}: {
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </label>
  );
}
