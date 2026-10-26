(function () {
  "use strict";
  const root = document.getElementById("inkborne-character-study");
  const colors = window.InkborneCharacterColors;
  if (!root || !colors) return;
  const byId = (id) => root.querySelector("#" + id);
  const LOGOS = window.InkborneCharacterStudyAssets || { light: "brand/inkborne-horizontal-ink.svg", dark: "brand/inkborne-horizontal-reverse.svg" };
  const STORAGE_KEY = "inkborne-character-study-v1";
  const validHex = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  const TABS = ["sheet", "story", "equipment", "builder"];
  const THEMES = ["light", "dark", "system"];
  const presets = colors.presets.concat([{ name: "Yellow", hex: "#ffff00" }, { name: "White", hex: "#ffffff" }, { name: "Black", hex: "#000000" }]);
  const characters = {
    mara: {
      name: "Mara Vale", initial: "M", campaign: "The Greyfen Road", description: "Human ranger · Level 4 · Outlander", signature: "M. Vale", hp: 31, maxHp: 36, armor: 15, initiative: "+3", speed: 30,
      abilities: [["Strength", "+1", 12], ["Dexterity", "+3", 16], ["Constitution", "+2", 14], ["Intelligence", "+0", 10], ["Wisdom", "+2", 14], ["Charisma", "−1", 8]], signatureAbility: 1,
      actions: [["Longbow", "Ranged · 150 / 600 ft", "+5", "1d8 + 3", "Piercing"], ["Shortsword", "Melee · 5 ft", "+5", "1d6 + 3", "Piercing"]],
      skills: [["Perception", "+4"], ["Survival", "+4"], ["Stealth", "+5"], ["Nature", "+2"]], resource: "1st-level spell slots", resourceTotal: 3, resourceRemaining: 2, resourceHelp: "One spell slot used since the last long rest.",
      journalTitle: "The road to Greyfen", journalLead: "The map ends at the river. My father’s notes go further.", journalSecond: "I found his mark on a milepost this morning: a small bird, facing east. For the first time in weeks, I know which way to go.",
      journalThird: "At the crossing, a woman selling lamp oil recognized the bird. She would not tell me his name, but she left a brass key beside my cup. I have put it with the map. Tomorrow I will ask the ferryman what lies beyond the old road.", thread: "Ask the ferryman about the winter crossing.", bonds: [["Person", "Edrin Vale · Father"], ["Place", "The eastern crossing"], ["Keepsake", "A weathered map"]],
      equipment: [["Longbow", "Equipped", "1", "2 lb"], ["Shortsword", "Equipped", "1", "2 lb"], ["Studded leather", "Worn", "1", "13 lb"], ["Arrows", "Quiver", "18", "1 lb"], ["Explorer’s pack", "Carried", "1", "59 lb"], ["Father’s field notes", "Carried", "1", "1 lb"]], gold: 24, itemNote: "A brass key, a small bird carved from ash, and a map with no eastern edge.",
      build: [["Ancestry", "Human", "A practical start, with a +1 increase to each ability score."], ["Class", "Ranger · Level 4", "Hunter archetype · Archery fighting style"], ["Background", "Outlander", "Athletics and Survival · A life spent following unfamiliar roads."], ["Abilities", "Dexterity 16 · Wisdom 14", "Ability score improvement applied at level 4."], ["Spells", "3 spells known", "Hunter’s mark · Cure wounds · Goodberry"]]
    },
    sera: {
      name: "Sera Quill", initial: "S", campaign: "The Lantern Archive", description: "High elf wizard · Level 3 · Sage", signature: "S. Quill", hp: 17, maxHp: 20, armor: 12, initiative: "+2", speed: 30,
      abilities: [["Strength", "−1", 8], ["Dexterity", "+2", 14], ["Constitution", "+1", 12], ["Intelligence", "+3", 16], ["Wisdom", "+1", 13], ["Charisma", "+0", 10]], signatureAbility: 3,
      actions: [["Fire bolt", "Cantrip · 120 ft", "+5", "1d10", "Fire"], ["Quarterstaff", "Melee · 5 ft", "+1", "1d6 − 1", "Bludgeoning"]],
      skills: [["Arcana", "+5"], ["History", "+5"], ["Investigation", "+5"], ["Insight", "+3"]], resource: "2nd-level spell slots", resourceTotal: 2, resourceRemaining: 1, resourceHelp: "One spell slot used since the last long rest.",
      journalTitle: "An unfinished catalogue", journalLead: "There is a blank page in every copy. Always the same page.", journalSecond: "The archivist called it a printing fault. But the paper is older than the binding, and something under the ink changes when I hold it to the lamplight.",
      journalThird: "I copied the marks before the library closed. They look less like letters now, and more like windows. In the morning I will find the bookbinder’s shop and ask who delivered the pages. Until then, I have left the lamp burning.", thread: "Visit the bookbinder before the archive opens.", bonds: [["Person", "Ilyen · Archivist"], ["Place", "The Lantern Archive"], ["Keepsake", "A page of silver ink"]],
      equipment: [["Quarterstaff", "Equipped", "1", "4 lb"], ["Spellbook", "Carried", "1", "3 lb"], ["Arcane focus", "Equipped", "1", "1 lb"], ["Scholar’s pack", "Carried", "1", "10 lb"], ["Ink and quill", "Carried", "1", "—"], ["Silver-ink page", "Carried", "1", "—"]], gold: 18, itemNote: "A folded catalogue page, a little brass lamp, and three letters with their seals intact.",
      build: [["Ancestry", "High elf", "Darkvision · Fey Ancestry · Trance"], ["Class", "Wizard · Level 3", "School of Divination · Arcane Recovery"], ["Background", "Sage", "Arcana and History · A question that would not stay in the library."], ["Abilities", "Intelligence 16 · Dexterity 14", "Intelligence is the spellcasting ability for this character."], ["Spellbook", "10 wizard spells", "Prepared spell choices remain a separate step."]]
    }
  };
  const initialState = () => ({ version: 1, theme: "dark", character: "mara", tab: "sheet", colors: { mara: null, sera: "#7c3aed" }, notes: { mara: [], sera: [] } });
  const cleanState = (input) => {
    const next = initialState();
    if (!input || typeof input !== "object") return next;
    if (THEMES.includes(input.theme)) next.theme = input.theme;
    if (Object.hasOwn(characters, input.character)) next.character = input.character;
    if (TABS.includes(input.tab)) next.tab = input.tab;
    for (const id of Object.keys(characters)) {
      if (input.colors && (input.colors[id] === null || validHex(input.colors[id]))) next.colors[id] = input.colors[id];
      if (input.notes && Array.isArray(input.notes[id])) next.notes[id] = input.notes[id].slice(0, 20).filter((note) => note && typeof note.title === "string" && typeof note.body === "string").map((note) => ({ title: note.title.slice(0, 80), body: note.body.slice(0, 1200) }));
    }
    return next;
  };
  const hostState = () => {
    const saved = window.openai && window.openai.widgetState;
    return saved && (saved.modelContent && saved.modelContent.characterStudy || saved.characterStudy);
  };
  let localSaved;
  try { localSaved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (_) { /* Storage can be unavailable in a preview host. */ }
  let state = cleanState(hostState() || localSaved);
  let draftColor = null;
  let dialogTrigger = null;
  let systemTheme;
  try { systemTheme = window.matchMedia("(prefers-color-scheme: dark)"); } catch (_) { systemTheme = null; }
  const effectiveTheme = () => state.theme === "system" ? systemTheme && systemTheme.matches ? "dark" : "light" : state.theme;
  const copyState = () => JSON.parse(JSON.stringify(state));
  const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  let lastEmittedHostState = null;
  const persist = () => {
    const saved = copyState();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch (_) { /* UI remains usable without storage. */ }
    if (window.openai && typeof window.openai.setWidgetState === "function") {
      try {
        const hostSaved = JSON.parse(JSON.stringify(saved));
        const snapshot = { modelContent: { characterStudy: hostSaved }, privateContent: null };
        const encoder = new TextEncoder();
        while (encoder.encode(JSON.stringify(snapshot)).byteLength > 15000) {
          const withNotes = Object.keys(hostSaved.notes).filter((id) => hostSaved.notes[id].length);
          if (!withNotes.length) break;
          const longest = withNotes.reduce((a, b) => hostSaved.notes[a].length >= hostSaved.notes[b].length ? a : b);
          hostSaved.notes[longest].shift();
        }
        lastEmittedHostState = JSON.stringify(hostSaved);
        Promise.resolve(window.openai.setWidgetState(snapshot)).catch(() => { /* Host persistence is optional. */ });
      } catch (_) { /* UI remains usable if host persistence is unavailable. */ }
    }
  };
  const announce = (message) => { byId("cs-announcement").textContent = message; };
  const setRoles = (element, seed) => {
    const resolved = colors.resolve(seed, effectiveTheme());
    for (const [role, value] of Object.entries(resolved)) element.style.setProperty("--character-" + role, value);
    return resolved;
  };
  const detailList = (entries) => `<dl class="cs-detail-list">${entries.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl>`;
  const noteButton = '<button type="button" class="cs-button cs-button-character" data-add-note><span aria-hidden="true">+</span> Add note</button>';
  const renderNotes = () => state.notes[state.character].map((note) => `<article class="cs-note-entry"><h3>${escape(note.title)}</h3><p>${escape(note.body)}</p><small>Preview note · Fictional character</small></article>`).join("");
  const renderSheet = (character) => {
    byId("cs-panel-sheet").innerHTML = `<div class="cs-sheet-layout"><div class="cs-sheet-primary"><dl class="cs-vitals"><div class="cs-hit-points"><dt class="cs-stat-label">Hit points</dt><dd><strong>${character.hp} <small>/ ${character.maxHp}</small></strong><div class="cs-health-track" aria-hidden="true"><span style="width:${Math.round(character.hp / character.maxHp * 100)}%"></span></div></dd></div><div><dt class="cs-stat-label">Armor class</dt><dd><strong>${character.armor}</strong></dd></div><div><dt class="cs-stat-label">Initiative</dt><dd><strong>${character.initiative}</strong></dd></div><div><dt class="cs-stat-label">Speed</dt><dd><strong>${character.speed} <small>ft</small></strong></dd></div></dl><div class="cs-section-heading"><h2>Abilities</h2><span class="cs-section-meta">Proficiency bonus +2</span></div><dl class="cs-abilities">${character.abilities.map(([name, bonus, value], index) => `<div class="cs-ability${index === character.signatureAbility ? " cs-signature" : ""}"><dt>${name}</dt><dd><strong>${bonus}</strong><span>${value}</span></dd></div>`).join("")}</dl><div class="cs-section-heading"><h2>Actions</h2><span class="cs-section-meta">Attack bonus / Damage</span></div><ul class="cs-action-list">${character.actions.map(([name, meta, bonus, damage, type]) => `<li><div><strong>${name}</strong><small>${meta}</small></div><span class="cs-action-bonus">${bonus}</span><span class="cs-action-damage">${damage}<small>${type}</small></span></li>`).join("")}</ul><div class="cs-lower-sheet"><section><div class="cs-section-heading"><h2>Skills</h2><span class="cs-section-meta">Proficient</span></div>${detailList(character.skills)}</section><section><div class="cs-section-heading"><h2>Resources</h2></div><p class="cs-resource-label"><span>${character.resource}</span><span>${character.resourceRemaining} / ${character.resourceTotal}</span></p><div class="cs-resource-marks" aria-hidden="true">${Array.from({ length: character.resourceTotal }, (_, index) => `<i${index >= character.resourceRemaining ? ' class="cs-spent"' : ""}></i>`).join("")}</div><p class="cs-help">${character.resourceHelp}</p></section></div></div><aside class="cs-sheet-aside" aria-labelledby="cs-sheet-journal-title"><p class="cs-eyebrow">From the journal</p><h2 class="cs-journal-title" id="cs-sheet-journal-title">${character.journalTitle}</h2><p class="cs-journal-excerpt">${character.journalLead}</p><p>${character.journalSecond}</p><p class="cs-journal-signature">${character.signature}</p><div class="cs-thread"><strong>A loose thread</strong><p>${character.thread}</p></div>${noteButton}</aside></div>`;
  };
  const renderStory = (character) => {
    byId("cs-panel-story").innerHTML = `<div class="cs-story-layout"><article class="cs-story-copy"><p class="cs-eyebrow">Journal · Last session</p><h2>${character.journalTitle}</h2><p>${character.journalLead}</p><p>${character.journalSecond}</p><p>${character.journalThird}</p><p class="cs-journal-signature">${character.signature}</p><div class="cs-note-list" id="cs-preview-notes">${renderNotes()}</div></article><aside class="cs-story-sidebar"><h3>People &amp; places</h3>${detailList(character.bonds)}<div class="cs-thread"><strong>A loose thread</strong><p>${character.thread}</p></div>${noteButton}<p class="cs-help" style="margin-top:12px">New notes stay in this design preview.</p></aside></div>`;
  };
  const renderEquipment = (character) => {
    byId("cs-panel-equipment").innerHTML = `<div class="cs-panel-intro"><div><h2>Equipment</h2><p>What ${character.name.split(" ")[0]} carries into the next session.</p></div><span class="cs-small-tag">6 item groups</span></div><div class="cs-equipment-layout"><div><table class="cs-inventory"><caption class="cs-sr-only">${character.name}’s example equipment</caption><thead><tr><th scope="col">Item</th><th scope="col">Location</th><th scope="col">Qty.</th><th scope="col">Weight</th></tr></thead><tbody>${character.equipment.map(([name, location, quantity, weight]) => `<tr><td>${name}</td><td class="cs-item-state">${location}</td><td>${quantity}</td><td>${weight}</td></tr>`).join("")}</tbody></table><p class="cs-help" style="margin-top:16px">Illustrative inventory. Weights and quantities are example data.</p></div><aside class="cs-equipment-aside"><div class="cs-coins"><span class="cs-stat-label">Coin pouch</span><strong>${character.gold} <small>gp</small></strong><p class="cs-help">Kept with the everyday essentials.</p></div><h3>Small things</h3><p class="cs-help">${character.itemNote}</p><div class="cs-thread"><strong>From the story</strong><p>${character.thread}</p></div></aside></div>`;
  };
  const renderBuilder = (character) => {
    byId("cs-panel-builder").innerHTML = `<div class="cs-panel-intro"><div><h2>Character choices</h2><p>The foundations behind the sheet.</p></div><span class="cs-small-tag">Example build</span></div><div class="cs-builder-layout"><ol class="cs-build-steps" aria-label="Example build sections">${["Ancestry", "Class", "Background", "Abilities", "Equipment", "Spells"].map((label) => `<li><span class="cs-step-check" aria-hidden="true">✓</span><span>${label}</span><span class="cs-sr-only">— chosen in example</span></li>`).join("")}</ol><div class="cs-build-summary"><dl>${character.build.map(([label, value, detail]) => `<div class="cs-build-row"><dt>${label}</dt><dd><strong>${value}</strong><p>${detail}</p></dd></div>`).join("")}</dl><p class="cs-build-note">These choices illustrate the layout. Game rules and character building are not interactive in this preview.</p></div></div>`;
  };
  const render = () => {
    const character = characters[state.character];
    const theme = effectiveTheme();
    root.dataset.theme = theme;
    const palette = colors.palette[theme];
    for (const [cssName, key] of Object.entries({ page: "bg", surface: "surface", ink: "text", muted: "muted", rule: "rule", boundary: "boundary", action: "action", "on-action": "onAction", focus: "focus" })) root.style.setProperty("--" + cssName, palette[key]);
    root.querySelector(".cs-logo").src = LOGOS[theme];
    byId("cs-theme").value = state.theme;
    byId("cs-character").value = state.character;
    byId("cs-breadcrumb-name").textContent = character.name;
    byId("cs-character-name").textContent = character.name;
    byId("cs-character-initial").textContent = character.initial;
    byId("cs-campaign").textContent = character.campaign;
    byId("cs-character-meta").textContent = character.description;
    const selected = state.colors[state.character];
    byId("cs-color-description").textContent = selected === null ? "Site accent · Follows appearance" : selected.toUpperCase() + " · Custom color";
    byId("cs-effective-theme").textContent = (theme === "dark" ? "Dark" : "Light") + " appearance" + (state.theme === "system" ? " · System" : "");
    setRoles(root.querySelector("[data-character-scope]"), selected);
    for (const dialog of root.querySelectorAll("[data-character-dialog]")) setRoles(dialog, selected);
    for (const label of root.querySelectorAll("[data-dialog-character]")) label.textContent = character.name;
    renderSheet(character);
    renderStory(character);
    renderEquipment(character);
    renderBuilder(character);
    for (const tab of root.querySelectorAll("[data-tab]")) {
      const active = state.tab === tab.dataset.tab;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      byId("cs-panel-" + tab.dataset.tab).hidden = !active;
    }
    if (byId("cs-color-dialog").open) renderDraftColor();
  };
  const selectTab = (tab, focus) => {
    if (!TABS.includes(tab)) return;
    state.tab = tab;
    render();
    persist();
    if (focus) byId("cs-tab-" + tab).focus();
  };
  const openDialog = (id, trigger) => {
    dialogTrigger = trigger;
    const dialog = byId(id);
    if (!dialog.open) dialog.showModal();
  };
  const closeDialog = (id) => { byId(id).close(); };
  const renderDraftColor = () => {
    const character = characters[state.character];
    const safeDraft = draftColor === null || validHex(draftColor) ? draftColor : state.colors[state.character];
    const resolved = setRoles(byId("cs-color-dialog"), safeDraft);
    byId("cs-use-default").setAttribute("aria-pressed", String(draftColor === null));
    byId("cs-sample-name").textContent = character.name;
    byId("cs-color-sample").querySelector(".cs-sample-mark").textContent = character.initial;
    for (const button of root.querySelectorAll("[data-preset]")) {
      const chosen = typeof draftColor === "string" && draftColor.toLowerCase() === button.dataset.preset.toLowerCase();
      button.setAttribute("aria-pressed", String(chosen));
      button.querySelector(".cs-preset-swatch").textContent = chosen ? "✓" : "";
    }
    byId("cs-color-source").textContent = draftColor === null ? "Site accent follows appearance. No custom color is saved." : "The selected source stays the same in both themes.";
    if (draftColor === null) {
      byId("cs-color-native").value = resolved.source;
      byId("cs-color-hex").value = resolved.source;
    }
  };
  const updateDraft = (seed, updateFields) => {
    draftColor = seed;
    const valid = seed === null || validHex(seed);
    byId("cs-color-error").hidden = valid;
    byId("cs-color-hex").setAttribute("aria-invalid", String(!valid));
    if (updateFields && valid && seed !== null) {
      byId("cs-color-native").value = seed;
      byId("cs-color-hex").value = seed;
    }
    renderDraftColor();
  };
  for (const preset of presets) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cs-preset";
    button.dataset.preset = preset.hex;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", preset.name + " " + preset.hex);
    const swatch = document.createElement("span");
    swatch.className = "cs-preset-swatch";
    swatch.setAttribute("aria-hidden", "true");
    swatch.style.background = preset.hex;
    swatch.style.color = colors.contrast(preset.hex, "#ffffff") >= 4.5 ? "#ffffff" : "#000000";
    const label = document.createElement("span");
    label.textContent = preset.name;
    button.append(swatch, label);
    byId("cs-presets").append(button);
    button.addEventListener("click", () => updateDraft(preset.hex, true));
  }
  byId("cs-theme").addEventListener("change", (event) => {
    state.theme = THEMES.includes(event.target.value) ? event.target.value : "light";
    render(); persist();
    announce("Appearance changed to " + state.theme + ". Character colors retained.");
  });
  byId("cs-character").addEventListener("change", (event) => {
    if (!Object.hasOwn(characters, event.target.value)) return;
    state.character = event.target.value;
    render(); persist();
    announce(characters[state.character].name + " selected.");
  });
  for (const tab of root.querySelectorAll("[data-tab]")) {
    tab.addEventListener("click", () => selectTab(tab.dataset.tab, false));
    tab.addEventListener("keydown", (event) => {
      const current = TABS.indexOf(tab.dataset.tab);
      let next;
      if (event.key === "ArrowRight") next = (current + 1) % TABS.length;
      if (event.key === "ArrowLeft") next = (current + TABS.length - 1) % TABS.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = TABS.length - 1;
      if (next !== undefined) { event.preventDefault(); selectTab(TABS[next], true); }
    });
  }
  byId("cs-open-color").addEventListener("click", (event) => {
    draftColor = state.colors[state.character];
    const source = colors.resolve(draftColor, effectiveTheme()).source;
    byId("cs-color-native").value = source;
    byId("cs-color-hex").value = source;
    byId("cs-color-error").hidden = true;
    byId("cs-color-hex").setAttribute("aria-invalid", "false");
    renderDraftColor();
    openDialog("cs-color-dialog", event.currentTarget);
  });
  byId("cs-use-default").addEventListener("click", () => updateDraft(null, true));
  byId("cs-color-native").addEventListener("input", (event) => updateDraft(event.target.value, true));
  byId("cs-color-hex").addEventListener("input", (event) => {
    draftColor = event.target.value;
    if (validHex(draftColor)) byId("cs-color-native").value = draftColor;
    updateDraft(draftColor, false);
  });
  const applyColor = () => {
    if (draftColor !== null && !validHex(draftColor)) { byId("cs-color-error").hidden = false; byId("cs-color-hex").setAttribute("aria-invalid", "true"); byId("cs-color-hex").focus(); return; }
    state.colors[state.character] = draftColor;
    closeDialog("cs-color-dialog"); render(); persist();
    announce("Preview color updated for " + characters[state.character].name + (draftColor === null ? ". Using site accent." : ". Custom source " + draftColor + "."));
  };
  byId("cs-apply-color").addEventListener("click", applyColor);
  byId("cs-color-form").addEventListener("submit", (event) => { event.preventDefault(); applyColor(); });
  byId("cs-color-form").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.tagName === "INPUT") { event.preventDefault(); applyColor(); }
  });
  root.addEventListener("click", (event) => {
    const addNote = event.target.closest("[data-add-note]");
    if (addNote && root.contains(addNote)) {
      byId("cs-note-form").reset();
      for (const id of ["cs-note-heading", "cs-note-body"]) { byId(id).setCustomValidity(""); byId(id).removeAttribute("aria-invalid"); }
      byId("cs-note-error").hidden = true;
      openDialog("cs-note-dialog", addNote);
    }
    const close = event.target.closest("[data-close-dialog]");
    if (close && root.contains(close)) closeDialog(close.dataset.closeDialog);
  });
  const saveNote = () => {
    const title = byId("cs-note-heading").value.trim();
    const body = byId("cs-note-body").value.trim();
    byId("cs-note-heading").setCustomValidity(title ? "" : "Enter a title for this note.");
    byId("cs-note-body").setCustomValidity(body ? "" : "Enter the note you want to keep.");
    byId("cs-note-heading").setAttribute("aria-invalid", String(!title));
    byId("cs-note-body").setAttribute("aria-invalid", String(!body));
    byId("cs-note-error").hidden = Boolean(title && body);
    if (!byId("cs-note-form").reportValidity()) { (!title ? byId("cs-note-heading") : byId("cs-note-body")).focus(); return; }
    state.notes[state.character].push({ title: title.slice(0, 80), body: body.slice(0, 1200) });
    state.notes[state.character] = state.notes[state.character].slice(-20);
    closeDialog("cs-note-dialog");
    state.tab = "story"; render(); persist();
    byId("cs-tab-story").focus();
    announce("Note saved in this preview for " + characters[state.character].name + ".");
  };
  byId("cs-save-note").addEventListener("click", saveNote);
  byId("cs-note-form").addEventListener("submit", (event) => { event.preventDefault(); saveNote(); });
  byId("cs-note-form").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.target.tagName === "INPUT" || event.ctrlKey || event.metaKey)) { event.preventDefault(); saveNote(); }
  });
  for (const id of ["cs-note-heading", "cs-note-body"]) byId(id).addEventListener("input", () => { byId(id).setCustomValidity(""); byId(id).removeAttribute("aria-invalid"); byId("cs-note-error").hidden = true; });
  for (const dialog of root.querySelectorAll("dialog")) dialog.addEventListener("close", () => { if (dialogTrigger && dialogTrigger.isConnected) dialogTrigger.focus(); });
  if (systemTheme) {
    const onSystemChange = () => { if (state.theme === "system") render(); };
    if (typeof systemTheme.addEventListener === "function") systemTheme.addEventListener("change", onSystemChange);
  }
  window.addEventListener("openai:set_globals", (event) => {
    const widgetState = event.detail && event.detail.globals && event.detail.globals.widgetState;
    const saved = widgetState && (widgetState.modelContent && widgetState.modelContent.characterStudy || widgetState.characterStudy);
    if (!saved) return;
    if (JSON.stringify(saved) === lastEmittedHostState) return;
    const restored = cleanState(saved);
    if (JSON.stringify(restored) !== JSON.stringify(state)) { state = restored; render(); }
  });
  window.InkborneCharacterStudy = {
    getState: copyState,
    setTheme: (theme) => { if (THEMES.includes(theme)) { state.theme = theme; render(); persist(); } },
    setCharacter: (id) => { if (Object.hasOwn(characters, id)) { state.character = id; render(); persist(); } },
    setColor: (seed) => { if (seed === null || validHex(seed)) { state.colors[state.character] = seed; render(); persist(); } },
    render
  };
  render();
})();
