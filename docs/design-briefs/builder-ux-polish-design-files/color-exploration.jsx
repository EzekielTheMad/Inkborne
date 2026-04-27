// ─────────────────────────────────────────────────────────────────────────
// Color exploration — Victor's first comment.
// Two directions for how ability chips get tinted:
//   D1  Class-tinted — each class colors its own chips (gold for Paladin, purple for Sorcerer)
//   D2  Character primary — user picks one color for their character; everything adopts it
// ─────────────────────────────────────────────────────────────────────────

// ── Ability chip used by both directions ─────────────────────────────────
function AbilityChip({ label, value, tone, active }) {
  // tone: { bg, fg, border } — any color, including an oklch picker value
  const bg = tone?.bg || "rgba(255,255,255,0.03)";
  const border = tone?.border || "var(--ink-border)";
  const fg = tone?.fg || "var(--ink-fg)";
  const eyebrow = tone?.muted || "var(--ink-muted-fg)";
  return (
    <div style={{
      padding: "8px 10px 9px",
      border: `1px solid ${border}`, borderRadius: 7,
      background: bg,
      display: "flex", flexDirection: "column", alignItems: "center",
      minWidth: 0,
      transform: active ? "translateY(-1px)" : undefined,
      boxShadow: active ? `0 0 0 1px ${border}` : undefined,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
        color: eyebrow, textTransform: "uppercase",
      }}>{label}</div>
      <div style={{
        fontSize: 18, fontWeight: 600, color: fg,
        fontVariantNumeric: "tabular-nums", lineHeight: 1.1, marginTop: 2,
      }}>{value}</div>
    </div>
  );
}

// Tones for D1 (class-tinted)
const TONES = {
  gold: {
    bg: "rgba(201,164,74,0.10)",
    border: "rgba(201,164,74,0.4)",
    fg: "var(--ink-accent)",
    muted: "rgba(201,164,74,0.7)",
  },
  purple: {
    bg: "rgba(124,58,237,0.12)",
    border: "rgba(124,58,237,0.45)",
    fg: "#c7b0ff",
    muted: "rgba(199,176,255,0.75)",
  },
  neutral: {
    bg: "rgba(255,255,255,0.025)",
    border: "var(--ink-border)",
    fg: "var(--ink-fg)",
    muted: "var(--ink-muted-fg)",
  },
};

// ═══════════════════════════════════════════════════════════════
// D1 — Class-tinted abilities
// Shows Class Step with STR/DEX/... chips tinted to the current class.
// When viewing Paladin → gold; Sorcerer → purple. Primary ability (the
// class's main ability) is "active" (stronger tint).
// ═══════════════════════════════════════════════════════════════
function ColorD1_ClassTinted() {
  const [cls, setCls] = React.useState("paladin");
  const tone = cls === "paladin" ? TONES.gold : TONES.purple;
  const primary = cls === "paladin" ? "CHA" : "CHA";
  const saves = cls === "paladin" ? new Set(["WIS", "CHA"]) : new Set(["CON", "CHA"]);

  const abilities = [
    { l: "STR", v: 10 }, { l: "DEX", v: 14 }, { l: "CON", v: 16 },
    { l: "INT", v: 11 }, { l: "WIS", v: 12 }, { l: "CHA", v: 12 },
  ];

  return (
    <Frame>
      <ClassStepHeader />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px 28px", gap: 16, minHeight: 0 }}>
        {/* Class toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="ink-eyebrow" style={{ margin: 0 }}>Viewing</div>
          <div style={{
            display: "inline-flex", padding: 2, borderRadius: 7,
            border: "1px solid var(--ink-border)", background: "rgba(255,255,255,0.025)",
          }}>
            {[
              { id: "paladin", label: "Paladin", tone: TONES.gold, letter: "P" },
              { id: "sorcerer", label: "Sorcerer", tone: TONES.purple, letter: "S" },
            ].map((c) => {
              const active = cls === c.id;
              return (
                <button key={c.id} onClick={() => setCls(c.id)} style={{
                  padding: "6px 12px", fontSize: 12, fontWeight: 600,
                  borderRadius: 5, border: "none", cursor: "pointer",
                  background: active ? c.tone.bg : "transparent",
                  color: active ? c.tone.fg : "var(--ink-muted-fg)",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 3,
                    background: c.tone.bg, border: `1px solid ${c.tone.border}`,
                    color: c.tone.fg, fontSize: 9, fontWeight: 700,
                    fontFamily: "Georgia, serif",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>{c.letter}</span>
                  {c.label}
                </button>
              );
            })}
          </div>
          <div style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--ink-muted-fg)" }}>
            Abilities inherit the active class's color. Primary + Saves are tinted; the rest stay neutral.
          </div>
        </div>

        {/* Abilities */}
        <div>
          <div className="ink-eyebrow" style={{ marginBottom: 8 }}>Abilities</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
            {abilities.map((a) => {
              const isPrimary = a.l === primary;
              const isSave = saves.has(a.l);
              const useTone = isPrimary || isSave ? tone : TONES.neutral;
              return (
                <div key={a.l} style={{ position: "relative" }}>
                  <AbilityChip label={a.l} value={a.v} tone={useTone} active={isPrimary} />
                  {(isPrimary || isSave) && (
                    <span style={{
                      position: "absolute", top: -6, right: -4,
                      fontSize: 8, fontWeight: 700, letterSpacing: "0.08em",
                      padding: "1px 5px", borderRadius: 3,
                      background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`,
                      textTransform: "uppercase",
                    }}>{isPrimary ? "Primary" : "Save"}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Level pills strip mock */}
        <div>
          <div className="ink-eyebrow" style={{ marginBottom: 8 }}>Levels</div>
          <div style={{ display: "flex", gap: 6 }}>
            {Array.from({ length: cls === "paladin" ? 6 : 3 }).map((_, i) => {
              const active = i === (cls === "paladin" ? 5 : 2);
              return (
                <div key={i} style={{
                  flex: 1, padding: "8px 10px",
                  borderRadius: 6,
                  border: `1px solid ${active ? tone.border : "var(--ink-border)"}`,
                  background: active ? tone.bg : "rgba(255,255,255,0.015)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 999,
                    background: active ? tone.fg : "rgba(255,255,255,0.08)",
                    color: active ? (cls === "paladin" ? "#1a1625" : "#fff") : "var(--ink-muted-fg)",
                    fontSize: 10, fontWeight: 700,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontVariantNumeric: "tabular-nums",
                  }}>{i + 1}</span>
                  <span style={{ fontSize: 11, color: active ? tone.fg : "var(--ink-muted-fg)", fontWeight: active ? 600 : 500 }}>
                    Lv {i + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ASI panel mock */}
        <div>
          <div className="ink-eyebrow" style={{ marginBottom: 8 }}>ASI panel (level 4)</div>
          <div style={{
            padding: 14, borderRadius: 8,
            border: `1px solid ${tone.border}`,
            background: tone.bg,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{
                padding: "2px 8px", borderRadius: 4,
                fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                background: tone.fg,
                color: cls === "paladin" ? "#1a1625" : "#fff",
                textTransform: "uppercase",
              }}>Choose</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: tone.fg }}>Ability Score Improvement</span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-muted-fg)", marginBottom: 10 }}>
              Raise one ability by 2 or two by 1. Cannot exceed 20.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
              {abilities.map((a) => (
                <button key={a.l} style={{
                  padding: "6px 8px", borderRadius: 5,
                  border: `1px solid ${a.l === primary ? tone.border : "var(--ink-border)"}`,
                  background: a.l === primary ? tone.bg : "rgba(255,255,255,0.02)",
                  color: a.l === primary ? tone.fg : "var(--ink-fg)",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center",
                }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: a.l === primary ? tone.muted : "var(--ink-muted-fg)" }}>{a.l}</span>
                  <span style={{ fontSize: 13, marginTop: 1 }}>+1</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ═══════════════════════════════════════════════════════════════
// D2 — Character primary color
// User picks one color for their character. Chips, level pills, ASI panels,
// primary buttons all pick it up. Classes keep their letter emblems so
// multiclass identity is still visible, but color doesn't split by class.
// ═══════════════════════════════════════════════════════════════
const SWATCHES = [
  { id: "amber", name: "Amber", oklch: "oklch(72% 0.15 70)" },
  { id: "rose", name: "Rose", oklch: "oklch(65% 0.15 20)" },
  { id: "violet", name: "Violet", oklch: "oklch(65% 0.18 300)" },
  { id: "teal", name: "Teal", oklch: "oklch(68% 0.12 190)" },
  { id: "moss", name: "Moss", oklch: "oklch(65% 0.12 140)" },
  { id: "slate", name: "Slate", oklch: "oklch(70% 0.02 240)" },
];

function toneFromOklch(color) {
  // Build bg/border/fg from a single oklch lightness anchor
  return {
    bg: `color-mix(in oklab, ${color} 14%, transparent)`,
    border: `color-mix(in oklab, ${color} 45%, transparent)`,
    fg: color,
    muted: `color-mix(in oklab, ${color} 70%, var(--ink-muted-fg))`,
  };
}

function ColorD2_CharacterPrimary() {
  const [swatch, setSwatch] = React.useState("amber");
  const [hex, setHex] = React.useState("#c9a44a");
  const [hexOpen, setHexOpen] = React.useState(false);
  const hexValid = /^#?[0-9a-fA-F]{6}$/.test(hex);
  const isCustom = swatch === "__custom";
  const preset = SWATCHES.find((s) => s.id === swatch);
  const activeColor = isCustom ? (hexValid ? (hex.startsWith("#") ? hex : "#" + hex) : "#c9a44a") : preset.oklch;
  const tone = toneFromOklch(activeColor);

  const abilities = [
    { l: "STR", v: 10 }, { l: "DEX", v: 14 }, { l: "CON", v: 16 },
    { l: "INT", v: 11 }, { l: "WIS", v: 12 }, { l: "CHA", v: 12 },
  ];
  // Highlight the user's character's primary (CHA for sorcadin)
  const primary = "CHA";
  const saves = new Set(["WIS", "CHA"]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>
      {/* Artboard-level demo control — NOT part of the builder. Lives on the canvas, outside the Frame. */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
        fontSize: 10.5, color: "rgba(255,255,255,0.45)",
        fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
        letterSpacing: "0.03em",
      }}>
        <span style={{ opacity: 0.8 }}>◐ ARTBOARD · preview character color as:</span>
        {SWATCHES.map((s) => {
          const on = s.id === swatch;
          return (
            <button key={s.id} onClick={() => { setSwatch(s.id); setHexOpen(false); }}
              title={s.name}
              style={{
                width: 14, height: 14, borderRadius: 999,
                background: s.oklch, cursor: "pointer",
                border: on ? `1px solid color-mix(in oklab, ${s.oklch} 70%, white)` : "1px solid rgba(255,255,255,0.15)",
                boxShadow: on ? `0 0 0 1px #0a0810, 0 0 0 2px ${s.oklch}` : "none",
              }} />
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
    <Frame>
      <ClassStepHeader />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px 28px", gap: 16, minHeight: 0 }}>
        {/* Identity strip — both classes visible, but neutral chrome */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14, padding: "12px 14px",
          border: "1px solid var(--ink-border)", borderRadius: 8,
          background: "rgba(255,255,255,0.015)",
        }}>
          <span style={{
            width: 32, height: 32, borderRadius: 999,
            background: activeColor,
            flexShrink: 0,
          }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: tone.fg }}>Kaelith Vex</div>
            <div style={{ fontSize: 11, color: "var(--ink-muted-fg)", marginTop: 1 }}>Paladin 6 · Sorcerer 3 · Tiefling</div>
          </div>
          <div style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 10px", borderRadius: 999, border: "1px solid var(--ink-border)",
              fontSize: 11, color: "var(--ink-muted-fg)",
            }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: "rgba(201,164,74,0.18)", border: "1px solid rgba(201,164,74,0.5)", color: "var(--ink-accent)", fontFamily: "Georgia,serif", fontSize: 8, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>P</span>
              Paladin 6
            </span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 10px", borderRadius: 999, border: "1px solid var(--ink-border)",
              fontSize: 11, color: "var(--ink-muted-fg)",
            }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.5)", color: "#b594ff", fontFamily: "Georgia,serif", fontSize: 8, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>S</span>
              Sorcerer 3
            </span>
          </div>
        </div>

        {/* Abilities */}
        <div>
          <div className="ink-eyebrow" style={{ marginBottom: 8 }}>Abilities</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
            {abilities.map((a) => {
              const isPrimary = a.l === primary;
              const isSave = saves.has(a.l);
              const useTone = isPrimary || isSave ? tone : TONES.neutral;
              return (
                <div key={a.l} style={{ position: "relative" }}>
                  <AbilityChip label={a.l} value={a.v} tone={useTone} active={isPrimary} />
                  {(isPrimary || isSave) && (
                    <span style={{
                      position: "absolute", top: -6, right: -4,
                      fontSize: 8, fontWeight: 700, letterSpacing: "0.08em",
                      padding: "1px 5px", borderRadius: 3,
                      background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`,
                      textTransform: "uppercase",
                    }}>{isPrimary ? "Primary" : "Save"}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Level pills strip */}
        <div>
          <div className="ink-eyebrow" style={{ marginBottom: 8 }}>Levels (character sequence)</div>
          <div style={{ display: "flex", gap: 4 }}>
            {Array.from({ length: 9 }).map((_, i) => {
              const active = i === 8;
              const cls = i < 6 ? "P" : "S";
              const isPal = i < 6;
              return (
                <div key={i} style={{
                  flex: 1, padding: "8px 6px",
                  borderRadius: 6,
                  border: `1px solid ${active ? tone.border : "var(--ink-border)"}`,
                  background: active ? tone.bg : "rgba(255,255,255,0.015)",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: 999,
                    background: active ? tone.fg : "rgba(255,255,255,0.08)",
                    color: active ? "#1a1625" : "var(--ink-muted-fg)",
                    fontSize: 10, fontWeight: 700,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontVariantNumeric: "tabular-nums",
                  }}>{i + 1}</span>
                  <span style={{
                    width: 12, height: 12, borderRadius: 2,
                    background: isPal ? "rgba(201,164,74,0.18)" : "rgba(124,58,237,0.18)",
                    border: `1px solid ${isPal ? "rgba(201,164,74,0.5)" : "rgba(124,58,237,0.5)"}`,
                    color: isPal ? "var(--ink-accent)" : "#b594ff",
                    fontFamily: "Georgia,serif", fontSize: 8, fontWeight: 700,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>{cls}</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 6, fontSize: 10.5, color: "var(--ink-muted-fg)" }}>
            Active highlight uses the character color. Class is conveyed by the small letter emblem — shape, not color.
          </div>
        </div>

        {/* Primary button sample */}
        <div>
          <div className="ink-eyebrow" style={{ marginBottom: 8 }}>Actions</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{
              padding: "8px 16px", fontSize: 12, fontWeight: 600,
              border: `1px solid ${tone.border}`,
              background: tone.fg, color: "#1a1625",
              borderRadius: 6, cursor: "pointer",
            }}>Confirm selection</button>
            <button className="ink-btn ink-btn-outline">Cancel</button>
          </div>
        </div>
      </div>
    </Frame>
      </div>
    </div>
  );
}

Object.assign(window, { ColorD1_ClassTinted, ColorD2_CharacterPrimary, ColorD2_CarryThrough });

// ═══════════════════════════════════════════════════════════════
// D2 carry-through — shows the chosen character color on other surfaces:
//   - Race step (builder)
//   - Character sheet header
// Uses the same swatch/hex picker pattern.
// ═══════════════════════════════════════════════════════════════
function ColorD2_CarryThrough() {
  const [hex, setHex] = React.useState("#7c3aed");
  const hexValid = /^#?[0-9a-fA-F]{6}$/.test(hex);
  const color = hexValid ? (hex.startsWith("#") ? hex : "#" + hex) : "#7c3aed";
  const tone = toneFromOklch(color);

  return (
    <Frame>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 18px",
        borderBottom: "1px solid var(--ink-border)", background: "rgba(255,255,255,0.015)",
        flexShrink: 0,
      }}>
        <div className="ink-eyebrow" style={{ margin: 0 }}>Character color</div>
        <label style={{
          width: 24, height: 24, borderRadius: 5,
          border: "1px solid var(--ink-border)",
          background: color, cursor: "pointer", position: "relative", overflow: "hidden",
        }}>
          <input type="color" value={color} onChange={(e) => setHex(e.target.value)}
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
        </label>
        <input type="text" value={hex} onChange={(e) => setHex(e.target.value)}
          spellCheck={false}
          style={{
            width: 96, padding: "4px 8px", fontSize: 11.5,
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${hexValid ? "var(--ink-border)" : "rgba(220,38,38,0.5)"}`,
            borderRadius: 5, color: "var(--ink-fg)", textTransform: "uppercase",
          }} />
        <div style={{ display: "flex", gap: 4, marginLeft: 4 }}>
          {["#c9a44a", "#7c3aed", "#b91c1c", "#059669", "#2563eb", "#db2777"].map((c) => (
            <button key={c} onClick={() => setHex(c)}
              style={{
                width: 18, height: 18, borderRadius: 4, background: c, cursor: "pointer",
                border: hex.toLowerCase() === c.toLowerCase()
                  ? `1px solid color-mix(in oklab, ${c} 70%, white)` : "1px solid var(--ink-border)",
              }} />
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-muted-fg)" }}>
          Same color, three surfaces
        </div>
      </div>

      <div style={{ flex: 1, padding: "18px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, minHeight: 0 }}>
        {/* Race step */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
          <div className="ink-eyebrow" style={{ margin: 0 }}>Builder · Race step</div>
          <div style={{
            flex: 1, border: "1px solid var(--ink-border)", borderRadius: 8,
            background: "var(--ink-card)", padding: 14, display: "flex", flexDirection: "column", gap: 10,
          }}>
            {/* stepper */}
            <div style={{ display: "flex", gap: 4, marginBottom: 2 }}>
              {["Race", "Class", "Background", "Abilities", "Equipment"].map((s, i) => {
                const done = i < 1;
                const active = i === 0;
                return (
                  <div key={s} style={{
                    flex: 1, padding: "5px 8px", borderRadius: 5,
                    border: `1px solid ${active ? tone.border : "var(--ink-border)"}`,
                    background: active ? tone.bg : "rgba(255,255,255,0.015)",
                    fontSize: 10.5, color: active ? tone.fg : "var(--ink-muted-fg)",
                    fontWeight: active ? 600 : 500, textAlign: "center",
                  }}>{i + 1}. {s}</div>
                );
              })}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: tone.fg }}>Choose your race</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { name: "Tiefling", sub: "+2 CHA, +1 INT", sel: true },
                { name: "Human", sub: "+1 to all", sel: false },
                { name: "Half-Elf", sub: "+2 CHA, +1 / +1", sel: false },
                { name: "Dragonborn", sub: "+2 STR, +1 CHA", sel: false },
              ].map((r) => (
                <div key={r.name} style={{
                  padding: "10px 12px", borderRadius: 6,
                  border: `1px solid ${r.sel ? tone.border : "var(--ink-border)"}`,
                  background: r.sel ? tone.bg : "rgba(255,255,255,0.015)",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: 999,
                    background: r.sel ? tone.fg : "rgba(255,255,255,0.06)",
                    color: r.sel ? "#1a1625" : "var(--ink-muted-fg)",
                    fontSize: 11, fontWeight: 700,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "Georgia, serif",
                  }}>{r.name[0]}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: r.sel ? tone.fg : "var(--ink-fg)" }}>{r.name}</div>
                    <div style={{ fontSize: 10.5, color: "var(--ink-muted-fg)", marginTop: 1 }}>{r.sub}</div>
                  </div>
                  {r.sel && <span style={{
                    marginLeft: "auto", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
                    padding: "2px 6px", borderRadius: 3,
                    background: tone.fg, color: "#1a1625", textTransform: "uppercase",
                  }}>Picked</span>}
                </div>
              ))}
            </div>
            <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
              <button className="ink-btn ink-btn-outline ink-btn-sm">Back</button>
              <button style={{
                marginLeft: "auto", padding: "6px 14px", fontSize: 11.5, fontWeight: 600,
                border: `1px solid ${tone.border}`, background: tone.fg, color: "#1a1625",
                borderRadius: 5, cursor: "pointer",
              }}>Continue</button>
            </div>
          </div>
        </div>

        {/* Character sheet */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
          <div className="ink-eyebrow" style={{ margin: 0 }}>Character sheet</div>
          <div style={{
            flex: 1, borderRadius: 8, overflow: "hidden",
            border: "1px solid var(--ink-border)", background: "var(--ink-card)",
            display: "flex", flexDirection: "column",
          }}>
            {/* Sheet header — color-driven */}
            <div style={{
              padding: "14px 16px",
              background: `linear-gradient(135deg, ${color} 0%, color-mix(in oklab, ${color} 55%, #0a0810) 100%)`,
              color: "#fff", display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 999,
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.3)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 600, fontFamily: "Georgia, serif",
              }}>KV</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Kaelith Vex</div>
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>Tiefling · Paladin 6 / Sorcerer 3</div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 11, opacity: 0.85 }}>
                <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }}>9</div>
                <div style={{ marginTop: 2 }}>Character lv</div>
              </div>
            </div>
            {/* body */}
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {[
                  { k: "HP", v: "68 / 68" }, { k: "AC", v: "19" }, { k: "Init", v: "+2" },
                ].map((s) => (
                  <div key={s.k} style={{
                    padding: "8px 10px", borderRadius: 6,
                    border: `1px solid ${tone.border}`, background: tone.bg,
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: tone.muted, textTransform: "uppercase" }}>{s.k}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: tone.fg, marginTop: 1 }}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div className="ink-eyebrow" style={{ marginTop: 4 }}>Abilities</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {[
                  ["STR", 10], ["DEX", 14], ["CON", 16], ["INT", 11], ["WIS", 12], ["CHA", 12],
                ].map(([l, v]) => {
                  const hi = l === "CHA";
                  return (
                    <div key={l} style={{
                      padding: "7px 8px", borderRadius: 5,
                      border: `1px solid ${hi ? tone.border : "var(--ink-border)"}`,
                      background: hi ? tone.bg : "rgba(255,255,255,0.02)",
                      display: "flex", flexDirection: "column", alignItems: "center",
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: hi ? tone.muted : "var(--ink-muted-fg)" }}>{l}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: hi ? tone.fg : "var(--ink-fg)", marginTop: 1 }}>{v}</div>
                    </div>
                  );
                })}
              </div>
              <div className="ink-eyebrow" style={{ marginTop: 4 }}>Actions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {["Divine Smite", "Lay on Hands (30)", "Sorcery Points (3)"].map((a) => (
                  <div key={a} style={{
                    padding: "6px 10px", borderRadius: 5,
                    border: "1px solid var(--ink-border)",
                    background: "rgba(255,255,255,0.015)",
                    fontSize: 12, color: "var(--ink-fg)",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: tone.fg }} />
                    {a}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}
