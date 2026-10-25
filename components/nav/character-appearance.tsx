"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/landing/logo";
import { HomepageAppearance } from "@/components/landing/homepage-appearance";
import { isNotebookAppPath } from "@/lib/character/notebook-route";
import styles from "@/components/character/character-notebook.module.css";

export function CharacterAppBrand() {
  const notebook = isNotebookAppPath(usePathname());
  if (!notebook) return <Logo linkTo="/dashboard" />;
  return <Link href="/dashboard" className={styles.appBrand} aria-label="Inkborne dashboard">
    <Image className={styles.logoLight} src="/brand/inkborne-horizontal-ink.svg" alt="Inkborne" width={407} height={96} unoptimized />
    <Image className={styles.logoDark} src="/brand/inkborne-horizontal-reverse.svg" alt="Inkborne" width={407} height={96} unoptimized />
  </Link>;
}

export function CharacterAppearance() {
  return isNotebookAppPath(usePathname()) ? <HomepageAppearance /> : null;
}
