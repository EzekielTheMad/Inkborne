import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { HomepageAppearance as AppearanceControl } from "@/components/landing/homepage-appearance";
import styles from "./auth-shell.module.css";

/**
 * Notebook presentation shared by the existing authentication pages.
 * Tokens stay inside this shell; session handling belongs to the existing routes.
 */
export function AuthShell({
  marginalia,
  children,
}: {
  /** Small italic flourish in the desktop notebook margin. */
  marginalia?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.root} data-testid="auth-notebook">
      <a className={styles.skipLink} href="#auth-main">Skip to form</a>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Inkborne home">
          <Image className={styles.logoLight} data-logo-theme="light" src="/brand/inkborne-horizontal-ink.svg" width={407} height={96} alt="Inkborne" unoptimized />
          <Image className={styles.logoDark} data-logo-theme="dark" src="/brand/inkborne-horizontal-reverse.svg" width={407} height={96} alt="Inkborne" unoptimized />
        </Link>
        <AppearanceControl />
      </header>
      <main className={styles.main} id="auth-main" tabIndex={-1}>
        <div className={styles.spread}>
          <aside className={styles.margin} aria-label="Inkborne notebook">
            <p className={styles.eyebrow}>The sheet · The story</p>
            <p className={styles.marginTitle}>The sheet.<br /><em>The story.</em><br />One place.</p>
            <p className={styles.marginDescription}>Character sheets and character stories, kept together.</p>
            {marginalia && <p className={styles.marginalia}><span aria-hidden="true">✦</span>{marginalia}</p>}
          </aside>
          <div className={styles.formPage}>{children}</div>
        </div>
      </main>
      <footer className={styles.footer}>
        <span aria-hidden="true">✦</span> Inkborne is in private alpha
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
    <div className={cn(styles.card, className)}>{children}</div>
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
    <div className={styles.heading}>
      <p className={styles.eyebrow}>{kicker}</p>
      <h1>{title}</h1>
      {sub && <p className={styles.subtitle}>{sub}</p>}
    </div>
  );
}

/** Hairline "or" divider between OAuth and the email form. */
export function AuthDivider() {
  return (
    <div className={styles.divider} role="presentation">
      <span>or</span>
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
      className={styles.error}
    >
      <p className={styles.errorTitle}>{title}</p>
      {children}
    </div>
  );
}

/** Readable field label used across the auth forms. */
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
        styles.label,
        className,
      )}
    >
      {children}
    </label>
  );
}

export function AuthNotice({ children }: { children: React.ReactNode }) {
  return <p className={styles.notice} role="status">{children}</p>;
}
