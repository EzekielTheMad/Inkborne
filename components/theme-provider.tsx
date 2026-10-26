"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  useCallback,
  useSyncExternalStore,
} from "react";
import {
  DEFAULT_THEME,
  isTheme,
  THEME_STORAGE_KEY,
  type Theme,
  type ResolvedTheme,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: ResolvedTheme;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_CHANGE_EVENT = "inkborne-theme-change";

function getStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function getServerTheme(): "dark" {
  return "dark";
}

function subscribeToTheme(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

function getSystemTheme(): ResolvedTheme {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "dark";
  }
}

function subscribeToSystemTheme(onChange: () => void) {
  try {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  } catch {
    return () => {};
  }
}

function resolveTheme(theme: Theme, systemTheme: ResolvedTheme): ResolvedTheme {
  return theme === "system" ? systemTheme : theme;
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({
  children,
  defaultTheme,
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  // The server and first hydration render use the same snapshot. The document
  // itself already has its saved appearance from the small script in <head>.
  const storedTheme = useSyncExternalStore(subscribeToTheme, getStoredTheme, getServerTheme);
  const systemPreference = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemTheme,
    getServerTheme,
  );
  // A supplied default retains the existing initial override behavior. Explicit
  // changes also work for this session when browser storage is unavailable.
  const [selectedTheme, setSelectedTheme] = useState<Theme | undefined>(defaultTheme);
  const theme = selectedTheme ?? storedTheme;
  const resolvedTheme = resolveTheme(theme, systemPreference);

  const setTheme = useCallback((newTheme: Theme) => {
    setSelectedTheme(newTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Keep the current page usable when storage is blocked or full.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  useLayoutEffect(() => {
    // Read the actual browser preference here, rather than applying the Dark
    // hydration snapshot over the early script's Light/System result. This also
    // restores the class after development Strict Mode document remounts.
    applyTheme(resolveTheme(selectedTheme ?? getStoredTheme(), getSystemTheme()));
  }, [selectedTheme, theme, systemPreference]);

  return (
    <ThemeContext value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
