(() => {
  "use strict";
  const root = document.getElementById("inkborne-home-study");
  if (!root) return;
  const preferenceKey = "inkborne-home-study-v2";
  const appearance = root.querySelector("#home-appearance");
  const status = root.querySelector("#home-theme-status");
  const logos = root.querySelectorAll("[data-home-logo]");
  const assets = window.InkborneHomepageAssets || {
    light: "brand/inkborne-horizontal-ink.svg",
    dark: "brand/inkborne-horizontal-reverse.svg",
  };
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const valid = (value) => ["light", "dark", "system"].includes(value);
  let selected = "dark";

  function readSavedPreference() {
    const hostValue = window.openai?.widgetState?.modelContent?.homeAppearance;
    if (valid(hostValue)) return hostValue;
    try {
      const localValue = window.localStorage.getItem(preferenceKey);
      if (valid(localValue)) return localValue;
    } catch (_) {
      // The embedded review can disable browser storage.
    }
    return "dark";
  }

  function persistPreference() {
    try { window.localStorage.setItem(preferenceKey, selected); } catch (_) { /* Optional preview storage. */ }
    if (typeof window.openai?.setWidgetState === "function") {
      const next = {
        modelContent: { homeAppearance: selected },
        privateContent: null,
      };
      try {
        const saved = window.openai.setWidgetState(next);
        if (saved && typeof saved.catch === "function") saved.catch(() => {});
      } catch (_) { /* Optional host persistence must not prevent theme changes. */ }
    }
  }

  function render(announce) {
    const effective = selected === "system" ? (darkQuery.matches ? "dark" : "light") : selected;
    root.dataset.theme = effective;
    root.dataset.appearance = selected;
    if (appearance) appearance.value = selected;
    logos.forEach((logo) => { logo.src = assets[effective]; });
    if (announce && status) {
      status.textContent = `${selected === "system" ? "System appearance" : `${effective === "dark" ? "Dark" : "Light"} appearance`} selected${selected === "system" ? `; currently ${effective}` : ""}. This preference applies only to this design preview.`;
    }
  }

  selected = readSavedPreference();
  render(false);
  appearance?.addEventListener("change", () => {
    selected = valid(appearance.value) ? appearance.value : "dark";
    render(true);
    persistPreference();
  });
  darkQuery.addEventListener("change", () => { if (selected === "system") render(true); });
  window.addEventListener("openai:set_globals", (event) => {
    const hostValue = event.detail?.globals?.widgetState?.modelContent?.homeAppearance
      ?? window.openai?.widgetState?.modelContent?.homeAppearance;
    if (valid(hostValue) && hostValue !== selected) {
      selected = hostValue;
      render(false);
    }
  });
})();
