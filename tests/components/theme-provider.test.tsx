import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { HomepageAppearance } from "@/components/landing/homepage-appearance";
import { THEME_INITIALIZATION_SCRIPT, THEME_STORAGE_KEY } from "@/lib/theme";

let systemIsDark = false;
let systemListeners: Set<() => void>;

function ThemeSummary() {
  const { theme, resolvedTheme } = useTheme();
  return <output data-testid="theme-summary">{theme}:{resolvedTheme}</output>;
}

function ThemeControls() {
  const { setTheme } = useTheme();
  // Keep provider contract tests independent of the menu's pointer/keyboard
  // machinery, which the real-browser homepage suite exercises.
  return <><HomepageAppearance />{(["light", "dark", "system"] as const).map((theme) => (
    <button key={theme} onClick={() => setTheme(theme)} aria-label={`Use ${theme}`}>{theme}</button>
  ))}<ThemeSummary /></>;
}

function initializeDocumentTheme() {
  // Execute the exact static source placed in the layout, before hydration.
  new Function(THEME_INITIALIZATION_SCRIPT)();
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "dark existing-font-class";
  document.documentElement.style.removeProperty("color-scheme");
  systemIsDark = false;
  systemListeners = new Set();
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    get matches() { return systemIsDark; },
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_event: string, listener: () => void) => systemListeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => systemListeners.delete(listener),
  })));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ThemeProvider and homepage appearance", () => {
  it("keeps the shared Dark default without writing a new preference", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(<ThemeProvider><ThemeControls /></ThemeProvider>);

    expect(screen.getByRole("button", { name: "Appearance" })).toHaveAttribute("data-appearance", "dark");
    expect(screen.getByTestId("theme-summary")).toHaveTextContent("dark:dark");
    expect(document.documentElement).toHaveClass("dark", "existing-font-class");
    expect(document.documentElement.style.colorScheme).toBe("");
    expect(setItem).not.toHaveBeenCalled();
  });

  it("uses the existing shared saved preference and persists explicit changes", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    render(<ThemeProvider><ThemeControls /></ThemeProvider>);

    expect(screen.getByRole("button", { name: "Appearance" })).toHaveAttribute("data-appearance", "light");
    expect(document.documentElement).not.toHaveClass("dark");
    fireEvent.click(screen.getByRole("button", { name: "Use dark" }));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement).toHaveClass("dark", "existing-font-class");
  });

  it("falls back to Dark for an invalid preference without replacing stored data", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "neon");
    render(<ThemeProvider><ThemeControls /></ThemeProvider>);

    expect(screen.getByRole("button", { name: "Appearance" })).toHaveAttribute("data-appearance", "dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("neon");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("continues to switch themes when reading and writing storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<ThemeProvider><ThemeControls /></ThemeProvider>);

    expect(document.documentElement).toHaveClass("dark");
    fireEvent.click(screen.getByRole("button", { name: "Use light" }));
    expect(screen.getByTestId("theme-summary")).toHaveTextContent("light:light");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("follows System changes without overwriting the saved System choice", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");
    render(<ThemeProvider><ThemeControls /></ThemeProvider>);

    expect(screen.getByTestId("theme-summary")).toHaveTextContent("system:light");
    expect(document.documentElement).not.toHaveClass("dark");
    act(() => {
      systemIsDark = true;
      systemListeners.forEach((listener) => listener());
    });
    expect(screen.getByTestId("theme-summary")).toHaveTextContent("system:dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
    act(() => {
      systemIsDark = false;
      systemListeners.forEach((listener) => listener());
    });
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("preserves the optional initial default override and accepts later choices", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(<ThemeProvider defaultTheme="light"><ThemeControls /></ThemeProvider>);

    expect(screen.getByTestId("theme-summary")).toHaveTextContent("light:light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: "Use system" }));
    expect(screen.getByTestId("theme-summary")).toHaveTextContent("system:light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });

  it("hydrates consistent control markup without reversing the early saved appearance", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    const markup = renderToString(<ThemeProvider><ThemeControls /></ThemeProvider>);
    expect(markup).toContain('data-appearance="dark"');
    const container = document.createElement("div");
    container.innerHTML = markup;
    document.body.append(container);
    initializeDocumentTheme();
    expect(document.documentElement).not.toHaveClass("dark");
    const applyDark = vi.spyOn(document.documentElement.classList, "add");
    const onRecoverableError = vi.fn();
    let root: Root | undefined;

    try {
      await act(async () => {
        root = hydrateRoot(container, <ThemeProvider><ThemeControls /></ThemeProvider>, { onRecoverableError });
      });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Appearance" })).toHaveAttribute("data-appearance", "light");
      expect(screen.getByTestId("theme-summary")).toHaveTextContent("light:light");
      expect(applyDark).not.toHaveBeenCalledWith("dark");
      expect(document.documentElement).not.toHaveClass("dark");
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });
});

describe("early document theme script", () => {
  it.each([
    { saved: "light", systemDark: true, dark: false },
    { saved: "dark", systemDark: false, dark: true },
    { saved: "system", systemDark: false, dark: false },
    { saved: "system", systemDark: true, dark: true },
    { saved: "neon", systemDark: false, dark: true },
  ])("applies $saved with systemDark=$systemDark before paint", ({ saved, systemDark, dark }) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, saved);
    systemIsDark = systemDark;
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    initializeDocumentTheme();

    expect(document.documentElement.classList.contains("dark")).toBe(dark);
    expect(document.documentElement).toHaveClass("existing-font-class");
    expect(setItem).not.toHaveBeenCalled();
    expect(document.documentElement.style.colorScheme).toBe("");
  });

  it("safely keeps Dark when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(initializeDocumentTheme).not.toThrow();
    expect(document.documentElement).toHaveClass("dark");
  });
});
