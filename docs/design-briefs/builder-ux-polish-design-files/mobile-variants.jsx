// ─────────────────────────────────────────────────────────────────────────
// Mobile · Class Step on phone.
//
// The sidebar-by-level pattern (desktop Variant C) becomes a horizontal
// top rail of level pills. Body below = selected level's features.
// Character strip at top; add-class is a sticky CTA at the bottom of
// the rail.
//
// Four artboards:
//   M1 — Single class (Paladin 6) — baseline
//   M2 — Multiclass grouped — two rails stacked, character strip at top
//   M3 — Add-class picker as a half-sheet
//   M4 — Level-detail with inline ASI/Fighting Style choice UI
// ─────────────────────────────────────────────────────────────────────────

// ── Shared bits ──────────────────────────────────────────────────────────

function MClassBadge({ letter, tone = "gold", size = 18 }) {
  const gold = tone === "gold";
  return (
    <span style={{
      width: size, height: size, borderRadius: Math.round(size * 0.2),
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Georgia, serif", fontWeight: 700,
      fontSize: Math.round(size * 0.55),
      background: gold ? "rgba(201,164,74,0.18)" : "rgba(124,58,237,0.2)",
      border: gold ? "1px solid rgba(201,164,74,0.5)" : "1px solid rgba(124,58,237,0.55)",
      color: gold ? "var(--ink-accent)" : "#c7b0ff",
      flexShrink: 0,
    }}>{letter}</span>
  );
}

// Phone header — replaces the desktop step header. Keeps the same visual
// vocabulary (eyebrow + step # + title) but sized down.
function MHeader({ step = "4 of 7", title = "Class", subtitle, right }) {
  return (
    <div style={{
      padding: "10px 16px 12px", borderBottom: "1px solid var(--ink-border)",
      background: "rgba(255,255,255,0.015)",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: "0.1em",
          color: "var(--ink-muted-fg)", textTransform: "uppercase",
        }}>Step {step}</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink-fg)", marginTop: 1 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: "var(--ink-muted-fg)", marginTop: 1 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

// Character strip for multiclass header
function MCharStrip({ onTapAddClass }) {
  return (
    <div style={{
      padding: "10px 14px",
      borderBottom: "1px solid var(--ink-border)",
      background: "rgba(255,255,255,0.02)",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 999,
        background: "color-mix(in oklab, oklch(65% 0.18 300) 35%, #1a1625)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 600, color: "#fff", fontFamily: "Georgia, serif",
        flexShrink: 0,
      }}>KV</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-fg)" }}>Kaelith Vex</div>
        <div style={{ fontSize: 10.5, color: "var(--ink-muted-fg)", marginTop: 1 }}>
          Lv 9/20 · merged slots · +4 prof
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <MClassBadge letter="P" tone="gold" size={20} />
        <span style={{ fontSize: 11, color: "var(--ink-muted-fg)", fontVariantNumeric: "tabular-nums" }}>6</span>
        <span style={{ width: 3, height: 3, borderRadius: 999, background: "var(--ink-border)", margin: "0 2px" }} />
        <MClassBadge letter="S" tone="purple" size={20} />
        <span style={{ fontSize: 11, color: "var(--ink-muted-fg)", fontVariantNumeric: "tabular-nums" }}>3</span>
      </div>
    </div>
  );
}

// Level pill for the horizontal rail
function MLevelPill({ n, label, active, tone, choice, onClick, showEmblem, letter }) {
  const gold = tone === "gold";
  const bg = active ? (gold ? "rgba(201,164,74,0.16)" : "rgba(124,58,237,0.16)") : "rgba(255,255,255,0.02)";
  const border = active ? (gold ? "rgba(201,164,74,0.5)" : "rgba(124,58,237,0.55)") : "var(--ink-border)";
  const fg = active ? (gold ? "var(--ink-accent)" : "#c7b0ff") : "var(--ink-muted-fg)";
  return (
    <button onClick={onClick} style={{
      flex: "0 0 auto",
      padding: "8px 12px",
      borderRadius: 10,
      border: `1px solid ${border}`,
      background: bg,
      color: fg,
      cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 12, fontWeight: 500,
      position: "relative",
      minWidth: 58,
    }}>
      {showEmblem && <MClassBadge letter={letter} tone={tone} size={14} />}
      <span style={{ fontSize: 11, opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>Lv</span>
      <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{n}</span>
      {choice && <span style={{
        position: "absolute", top: 6, right: 6,
        width: 6, height: 6, borderRadius: 999,
        background: "var(--ink-accent)",
      }} />}
    </button>
  );
}

// A feature card (passive or choice)
function MFeatureCard({ title, kind = "passive", desc, optionLabel, choiceMade }) {
  const isChoice = kind === "choice";
  return (
    <div style={{
      padding: "12px 14px",
      borderRadius: 10,
      border: "1px solid var(--ink-border)",
      background: "rgba(255,255,255,0.02)",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-fg)", flex: 1, minWidth: 0 }}>{title}</div>
        {isChoice && (
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
            padding: "2px 6px", borderRadius: 3,
            background: choiceMade ? "rgba(201,164,74,0.15)" : "rgba(220,38,38,0.15)",
            color: choiceMade ? "var(--ink-accent)" : "#f87171",
            border: `1px solid ${choiceMade ? "rgba(201,164,74,0.35)" : "rgba(220,38,38,0.35)"}`,
            textTransform: "uppercase", flexShrink: 0,
          }}>{choiceMade ? "Chosen" : "Choose"}</span>
        )}
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-muted-fg)", lineHeight: 1.45 }}>{desc}</div>
      {isChoice && optionLabel && (
        <div style={{
          marginTop: 4, padding: "8px 10px",
          border: "1px solid var(--ink-border)",
          borderRadius: 7, background: "rgba(255,255,255,0.015)",
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 12,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 999,
            background: "var(--ink-accent)", flexShrink: 0,
          }} />
          <span style={{ color: "var(--ink-fg)", flex: 1, minWidth: 0 }}>{optionLabel}</span>
          <span style={{ fontSize: 11, color: "var(--ink-muted-fg)" }}>Change</span>
        </div>
      )}
    </div>
  );
}

// Horizontal scroll rail wrapper
function MRail({ label, tone, children, onAdd, onLevel, currentLevel }) {
  return (
    <div style={{
      borderBottom: "1px solid var(--ink-border)",
      background: "rgba(255,255,255,0.01)",
      padding: "8px 0 10px",
    }}>
      {label && (
        <div style={{
          padding: "0 14px 6px", display: "flex", alignItems: "center", gap: 8,
        }}>
          <MClassBadge letter={label.letter} tone={tone} size={16} />
          <div style={{ fontSize: 12.5, fontWeight: 600, color: tone === "gold" ? "var(--ink-accent)" : "#c7b0ff" }}>
            {label.name}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--ink-muted-fg)" }}>
            Lv {currentLevel}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            <button style={{
              padding: "3px 8px", fontSize: 10.5, fontWeight: 600,
              borderRadius: 4, border: "1px solid var(--ink-border)",
              background: "transparent", color: "var(--ink-muted-fg)", cursor: "pointer",
            }} onClick={onLevel}>Set level</button>
          </div>
        </div>
      )}
      <div style={{
        display: "flex", gap: 6, padding: "0 14px",
        overflowX: "auto",
        scrollbarWidth: "none",
      }}>
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// M1 — Single class (Paladin 6). Baseline.
// ═══════════════════════════════════════════════════════════════
function MobileM1_SingleClass() {
  const [sel, setSel] = React.useState(6);
  const levels = [
    { n: 1, label: "Divine Sense", hasChoice: false },
    { n: 2, label: "Fighting Style", hasChoice: true, chosen: true },
    { n: 3, label: "Sacred Oath", hasChoice: true, chosen: true },
    { n: 4, label: "ASI", hasChoice: true, chosen: false },
    { n: 5, label: "Extra Attack", hasChoice: false },
    { n: 6, label: "Aura of Protection", hasChoice: false },
  ];
  const current = levels.find((l) => l.n === sel) || levels[0];

  return (
    <IOSDevice dark={true} width={390} height={844}>
      <div style={{
        height: "100%", display: "flex", flexDirection: "column",
        background: "var(--ink-bg)", color: "var(--ink-fg)",
        paddingTop: 54,
      }}>
        <MHeader step="4 of 7" title="Class" subtitle="Paladin · Oath of Devotion" />

        {/* Rail */}
        <MRail
          label={{ letter: "P", name: "Paladin" }}
          tone="gold"
          currentLevel={6}
          onLevel={() => {}}
        >
          {levels.map((l) => (
            <MLevelPill key={l.n} n={l.n}
              label={l.label} active={sel === l.n}
              tone="gold"
              choice={l.hasChoice && !l.chosen}
              onClick={() => setSel(l.n)} />
          ))}
        </MRail>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 80px" }}>
          <div style={{ fontSize: 10.5, color: "var(--ink-muted-fg)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
            Level {current.n}
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--ink-accent)", letterSpacing: "-0.01em" }}>
            {current.n === 6 ? "Aura of Protection" : current.label}
          </h2>
          <p style={{ margin: "3px 0 14px", fontSize: 12, color: "var(--ink-muted-fg)" }}>
            {current.n === 6
              ? "Unlocked at Paladin 6. Radiates from you to friendly creatures."
              : "Features unlocked at this level."}
          </p>

          {current.n === 6 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <MFeatureCard
                title="Aura of Protection"
                kind="passive"
                desc="You and friendly creatures within 10 ft add your CHA modifier to saving throws, as long as you are not incapacitated."
              />
            </div>
          )}

          {/* Upcoming peek */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", color: "var(--ink-muted-fg)", textTransform: "uppercase", marginBottom: 6 }}>
              Next
            </div>
            <div style={{
              padding: "10px 12px", borderRadius: 8,
              border: "1px dashed var(--ink-border)",
              background: "rgba(255,255,255,0.01)",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: 999,
                background: "rgba(255,255,255,0.05)",
                color: "var(--ink-muted-fg)", fontSize: 10, fontWeight: 700,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>7</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: "var(--ink-fg)" }}>Lv 7 · Aura improvement</div>
                <div style={{ fontSize: 11, color: "var(--ink-muted-fg)", marginTop: 1 }}>Devotion: Purity of Spirit</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom action bar */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "10px 14px 30px",
          background: "linear-gradient(to top, var(--ink-bg) 70%, transparent)",
          display: "flex", gap: 8,
        }}>
          <button className="ink-btn ink-btn-outline ink-btn-sm" style={{ flex: "0 0 auto" }}>Back</button>
          <button style={{
            flex: 1, padding: "10px 14px", fontSize: 13, fontWeight: 600,
            background: "var(--ink-accent)", color: "#1a1625",
            border: "1px solid rgba(201,164,74,0.5)",
            borderRadius: 7, cursor: "pointer",
          }}>Continue</button>
        </div>
      </div>
    </IOSDevice>
  );
}

// ═══════════════════════════════════════════════════════════════
// M2 — Multiclass grouped. Two rails stacked.
// ═══════════════════════════════════════════════════════════════
function MobileM2_Multiclass() {
  // flat addressing: {cls, n}
  const [sel, setSel] = React.useState({ cls: "sor", n: 3 });
  const pal = [
    { n: 1, label: "Divine Sense" },
    { n: 2, label: "Style", hasChoice: true, chosen: true },
    { n: 3, label: "Oath", hasChoice: true, chosen: true },
    { n: 4, label: "ASI", hasChoice: true, chosen: false },
    { n: 5, label: "Extra Atk" },
    { n: 6, label: "Aura" },
  ];
  const sor = [
    { n: 1, label: "Sorcery" },
    { n: 2, label: "Font" },
    { n: 3, label: "Metamagic", hasChoice: true, chosen: true },
  ];

  const currentIsSor = sel.cls === "sor";
  const currentList = currentIsSor ? sor : pal;
  const current = currentList.find((l) => l.n === sel.n) || currentList[0];

  return (
    <IOSDevice dark={true} width={390} height={844}>
      <div style={{
        height: "100%", display: "flex", flexDirection: "column",
        background: "var(--ink-bg)", color: "var(--ink-fg)",
        paddingTop: 54,
      }}>
        <MHeader step="4 of 7" title="Class" />
        <MCharStrip />

        <MRail label={{ letter: "P", name: "Paladin" }} tone="gold" currentLevel={6}>
          {pal.map((l) => (
            <MLevelPill key={l.n} n={l.n} label={l.label}
              active={!currentIsSor && sel.n === l.n}
              tone="gold"
              choice={l.hasChoice && !l.chosen}
              onClick={() => setSel({ cls: "pal", n: l.n })} />
          ))}
        </MRail>
        <MRail label={{ letter: "S", name: "Sorcerer" }} tone="purple" currentLevel={3}>
          {sor.map((l) => (
            <MLevelPill key={l.n} n={l.n} label={l.label}
              active={currentIsSor && sel.n === l.n}
              tone="purple"
              choice={l.hasChoice && !l.chosen}
              onClick={() => setSel({ cls: "sor", n: l.n })} />
          ))}
          {/* trailing add-class pill */}
          <button style={{
            flex: "0 0 auto",
            padding: "8px 12px", minWidth: 58,
            borderRadius: 10,
            border: "1px dashed var(--ink-border)",
            background: "transparent",
            color: "var(--ink-muted-fg)",
            fontSize: 11, fontWeight: 500,
            cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
            Add class
          </button>
        </MRail>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 80px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--ink-muted-fg)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
            <MClassBadge letter={currentIsSor ? "S" : "P"} tone={currentIsSor ? "purple" : "gold"} size={12} />
            {currentIsSor ? "Sorcerer" : "Paladin"} · Level {current.n}
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600,
            color: currentIsSor ? "#c7b0ff" : "var(--ink-accent)",
            letterSpacing: "-0.01em" }}>
            {currentIsSor && current.n === 3 ? "Metamagic" : current.label}
          </h2>
          <p style={{ margin: "3px 0 14px", fontSize: 12, color: "var(--ink-muted-fg)" }}>
            {currentIsSor && current.n === 3
              ? "Choose 2 metamagic options to customize how you cast spells."
              : "Features unlocked at this level."}
          </p>

          {currentIsSor && current.n === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <MFeatureCard
                title="Metamagic"
                kind="choice"
                desc="At 3rd level you gain two metamagic options. Spend sorcery points to alter your spells."
                optionLabel="Quickened Spell · Twinned Spell"
                choiceMade
              />
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "10px 14px 30px",
          background: "linear-gradient(to top, var(--ink-bg) 70%, transparent)",
          display: "flex", gap: 8,
        }}>
          <button className="ink-btn ink-btn-outline ink-btn-sm" style={{ flex: "0 0 auto" }}>Back</button>
          <button style={{
            flex: 1, padding: "10px 14px", fontSize: 13, fontWeight: 600,
            background: "var(--ink-accent)", color: "#1a1625",
            border: "1px solid rgba(201,164,74,0.5)",
            borderRadius: 7, cursor: "pointer",
          }}>Continue</button>
        </div>
      </div>
    </IOSDevice>
  );
}

// ═══════════════════════════════════════════════════════════════
// M3 — Add-class picker as a bottom sheet.
// ═══════════════════════════════════════════════════════════════
function MobileM3_AddClassSheet() {
  const classes = [
    { id: "barbarian", name: "Barbarian", req: "STR 13", met: false, letter: "B", tone: "gold" },
    { id: "bard", name: "Bard", req: "CHA 13", met: false, letter: "B", tone: "gold" },
    { id: "cleric", name: "Cleric", req: "WIS 13", met: false, letter: "C", tone: "gold" },
    { id: "druid", name: "Druid", req: "WIS 13", met: false, letter: "D", tone: "gold" },
    { id: "fighter", name: "Fighter", req: "STR 13 or DEX 13", met: true, letter: "F", tone: "gold" },
    { id: "monk", name: "Monk", req: "DEX 13 & WIS 13", met: false, letter: "M", tone: "gold" },
    { id: "paladin", name: "Paladin", req: "In build", met: false, letter: "P", tone: "gold", inBuild: true },
    { id: "ranger", name: "Ranger", req: "DEX 13 & WIS 13", met: false, letter: "R", tone: "gold" },
    { id: "rogue", name: "Rogue", req: "DEX 13", met: true, letter: "R", tone: "gold" },
    { id: "sorcerer", name: "Sorcerer", req: "In build", met: false, letter: "S", tone: "purple", inBuild: true },
    { id: "warlock", name: "Warlock", req: "CHA 13", met: false, letter: "W", tone: "purple" },
    { id: "wizard", name: "Wizard", req: "INT 13", met: false, letter: "W", tone: "purple" },
  ];

  return (
    <IOSDevice dark={true} width={390} height={844}>
      <div style={{
        height: "100%", position: "relative",
        background: "var(--ink-bg)", color: "var(--ink-fg)",
        paddingTop: 54,
      }}>
        {/* Backdrop — the page behind the sheet, blurred/dimmed */}
        <div style={{ filter: "blur(3px) saturate(0.7)", opacity: 0.45, pointerEvents: "none" }}>
          <MHeader step="4 of 7" title="Class" />
          <MCharStrip />
          <MRail label={{ letter: "P", name: "Paladin" }} tone="gold" currentLevel={6}>
            {[1,2,3,4,5,6].map((n) => (
              <MLevelPill key={n} n={n} tone="gold" label="" active={n === 6} onClick={() => {}} />
            ))}
          </MRail>
          <MRail label={{ letter: "S", name: "Sorcerer" }} tone="purple" currentLevel={3}>
            {[1,2,3].map((n) => (
              <MLevelPill key={n} n={n} tone="purple" label="" active={false} onClick={() => {}} />
            ))}
          </MRail>
        </div>

        {/* Dim scrim */}
        <div style={{
          position: "absolute", inset: 0, top: 54,
          background: "rgba(10, 8, 16, 0.55)",
        }} />

        {/* Sheet */}
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          height: "74%",
          background: "var(--ink-card)",
          borderRadius: "20px 20px 0 0",
          borderTop: "1px solid var(--ink-border)",
          display: "flex", flexDirection: "column",
          boxShadow: "0 -20px 40px rgba(0,0,0,0.4)",
        }}>
          {/* Grabber */}
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.18)" }} />
          </div>
          {/* Title */}
          <div style={{ padding: "4px 16px 10px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-fg)" }}>Add a class</div>
              <div style={{ fontSize: 11, color: "var(--ink-muted-fg)", marginTop: 1 }}>
                11 levels remaining · current build CHA 12
              </div>
            </div>
            <button style={{
              padding: "6px 10px", fontSize: 12, fontWeight: 500,
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--ink-accent)",
            }}>Cancel</button>
          </div>

          {/* Search */}
          <div style={{ padding: "0 16px 8px" }}>
            <div style={{
              padding: "8px 12px", borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--ink-border)",
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 13, color: "var(--ink-muted-fg)",
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M8 8l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Search classes
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 0 20px" }}>
            {classes.map((c, i) => {
              const disabled = !c.met || c.inBuild;
              return (
                <div key={c.id} style={{
                  padding: "12px 16px",
                  borderTop: i === 0 ? "1px solid var(--ink-border)" : "none",
                  borderBottom: "1px solid var(--ink-border)",
                  display: "flex", alignItems: "center", gap: 12,
                  opacity: disabled ? 0.55 : 1,
                }}>
                  <MClassBadge letter={c.letter} tone={c.tone} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-fg)" }}>{c.name}</div>
                    <div style={{ fontSize: 11, marginTop: 1,
                      color: c.inBuild ? "var(--ink-muted-fg)" : (c.met ? "#6ee7b7" : "#f87171") }}>
                      {c.inBuild ? "Already in this build" : c.req + (c.met ? " · met" : " · not met")}
                    </div>
                  </div>
                  {c.met && !c.inBuild ? (
                    <button style={{
                      padding: "6px 14px", fontSize: 12, fontWeight: 600,
                      background: "var(--ink-accent)", color: "#1a1625",
                      border: "1px solid rgba(201,164,74,0.5)",
                      borderRadius: 6, cursor: "pointer",
                    }}>Add</button>
                  ) : (
                    <span style={{
                      padding: "6px 10px", fontSize: 11,
                      border: "1px solid var(--ink-border)",
                      borderRadius: 6, color: "var(--ink-muted-fg)",
                    }}>—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

// ═══════════════════════════════════════════════════════════════
// M4 — Level detail with inline ASI choice flow
// ═══════════════════════════════════════════════════════════════
function MobileM4_LevelDetail() {
  const [pick, setPick] = React.useState("str+con");
  const abilities = [
    { l: "STR", v: 10 }, { l: "DEX", v: 14 }, { l: "CON", v: 16 },
    { l: "INT", v: 11 }, { l: "WIS", v: 12 }, { l: "CHA", v: 12 },
  ];
  const levels = [1, 2, 3, 4, 5, 6];

  return (
    <IOSDevice dark={true} width={390} height={844}>
      <div style={{
        height: "100%", display: "flex", flexDirection: "column",
        background: "var(--ink-bg)", color: "var(--ink-fg)",
        paddingTop: 54,
      }}>
        <MHeader step="4 of 7" title="Class" subtitle="Paladin · Lv 4 needs an ASI" />

        <MRail label={{ letter: "P", name: "Paladin" }} tone="gold" currentLevel={6}>
          {levels.map((n) => (
            <MLevelPill key={n} n={n} tone="gold" label=""
              active={n === 4}
              choice={n === 4}
              onClick={() => {}} />
          ))}
        </MRail>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 90px" }}>
          <div style={{ fontSize: 10.5, color: "var(--ink-muted-fg)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
            Paladin · Level 4
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--ink-accent)", letterSpacing: "-0.01em" }}>
            Ability Score Improvement
          </h2>
          <p style={{ margin: "3px 0 14px", fontSize: 12, color: "var(--ink-muted-fg)" }}>
            Raise one ability by 2, or two abilities by 1 each. Cannot exceed 20.
          </p>

          {/* Mode toggle */}
          <div style={{
            display: "inline-flex", padding: 2, borderRadius: 8,
            border: "1px solid var(--ink-border)", background: "rgba(255,255,255,0.02)",
            marginBottom: 12,
          }}>
            {[
              { id: "str+con", label: "Two +1" },
              { id: "con+2", label: "One +2" },
              { id: "feat", label: "Feat instead" },
            ].map((m) => {
              const on = pick === m.id;
              return (
                <button key={m.id} onClick={() => setPick(m.id)} style={{
                  padding: "6px 10px", fontSize: 11.5, fontWeight: 500,
                  borderRadius: 6, border: "none", cursor: "pointer",
                  background: on ? "rgba(201,164,74,0.16)" : "transparent",
                  color: on ? "var(--ink-accent)" : "var(--ink-muted-fg)",
                }}>{m.label}</button>
              );
            })}
          </div>

          {pick !== "feat" && (
            <>
              <div className="ink-eyebrow" style={{ marginBottom: 6 }}>Abilities</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {abilities.map((a) => {
                  const selected = (pick === "str+con" && (a.l === "STR" || a.l === "CON"))
                    || (pick === "con+2" && a.l === "CON");
                  const delta = selected ? (pick === "con+2" ? 2 : 1) : 0;
                  return (
                    <button key={a.l} style={{
                      padding: "10px 8px", borderRadius: 8,
                      border: selected ? "1px solid rgba(201,164,74,0.5)" : "1px solid var(--ink-border)",
                      background: selected ? "rgba(201,164,74,0.12)" : "rgba(255,255,255,0.02)",
                      display: "flex", flexDirection: "column", alignItems: "center",
                      cursor: "pointer",
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                        color: selected ? "rgba(201,164,74,0.8)" : "var(--ink-muted-fg)" }}>{a.l}</div>
                      <div style={{ fontSize: 16, fontWeight: 600,
                        color: selected ? "var(--ink-accent)" : "var(--ink-fg)",
                        fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
                        {a.v}{delta > 0 && <span style={{ fontSize: 11, marginLeft: 2 }}>→{a.v + delta}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-muted-fg)", marginTop: 8 }}>
                Tap an ability to adjust. Total change: +2.
              </div>
            </>
          )}

          {pick === "feat" && (
            <div style={{
              padding: "14px", borderRadius: 10,
              border: "1px dashed var(--ink-border)",
              background: "rgba(255,255,255,0.01)",
              fontSize: 12, color: "var(--ink-muted-fg)",
            }}>
              Browse feats — opens a searchable list (tap to select).
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "10px 14px 30px",
          background: "linear-gradient(to top, var(--ink-bg) 70%, transparent)",
          display: "flex", gap: 8,
        }}>
          <button className="ink-btn ink-btn-outline ink-btn-sm" style={{ flex: "0 0 auto" }}>Skip</button>
          <button style={{
            flex: 1, padding: "10px 14px", fontSize: 13, fontWeight: 600,
            background: "var(--ink-accent)", color: "#1a1625",
            border: "1px solid rgba(201,164,74,0.5)",
            borderRadius: 7, cursor: "pointer",
          }}>Confirm · STR 10 → 11, CON 16 → 17</button>
        </div>
      </div>
    </IOSDevice>
  );
}

Object.assign(window, {
  MobileM1_SingleClass,
  MobileM2_Multiclass,
  MobileM3_AddClassSheet,
  MobileM4_LevelDetail,
});
