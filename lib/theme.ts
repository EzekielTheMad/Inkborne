export type Theme = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "inkborne-theme";
export const DEFAULT_THEME: Theme = "dark";

export function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light" || value === "system";
}

// Static source only: this runs while the document is parsed, before React or
// page content paints. Keep its validation/default aligned with the provider.
export const THEME_INITIALIZATION_SCRIPT = `(function(){var theme="dark";try{var saved=window.localStorage.getItem("inkborne-theme");if(saved==="dark"||saved==="light"||saved==="system")theme=saved;}catch(error){}var dark=theme!=="light";if(theme==="system"){try{dark=window.matchMedia("(prefers-color-scheme: dark)").matches;}catch(error){dark=true;}}document.documentElement.classList.toggle("dark",dark);})();`;
