"use client";

import { useTheme } from "@/components/theme-provider";
import { isTheme } from "@/lib/theme";
import { Moon, Sun, Monitor } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import styles from "./homepage-appearance.module.css";

export function HomepageAppearance({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`${styles.trigger} ${className ?? ""}`}
        aria-label="Appearance"
        title={`Appearance: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`}
        data-appearance={theme}
      >
        <Sun className={styles.sun} size={19} aria-hidden="true" />
        <Moon className={styles.moon} size={19} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className={styles.menu} align="end" sideOffset={8} aria-label="Appearance options">
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => { if (isTheme(value)) setTheme(value); }}>
          <DropdownMenuRadioItem className={styles.item} value="light" closeOnClick><Sun aria-hidden="true" />Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem className={styles.item} value="dark" closeOnClick><Moon aria-hidden="true" />Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem className={styles.item} value="system" closeOnClick><Monitor aria-hidden="true" />System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
