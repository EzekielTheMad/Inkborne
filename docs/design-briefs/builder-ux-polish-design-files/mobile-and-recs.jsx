/* global React */
// Mobile Sheet mock — shared pattern used across Race/Class/Background on < md.
// Frames itself as an iPhone-ish portrait artboard.

function MobileSheet() {
  const bg = window.INKBORNE_DATA.background;
  return (
    <Frame style={{ background: "#050409", padding: 20, alignItems: "center", justifyContent: "center" }}>
      <div style={{
        width: 360, height: 740, borderRadius: 38,
        border: "1px solid #2a2640",
        background: "var(--ink-bg)",
        overflow: "hidden", position: "relative",
        boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
      }}>
        {/* notch */}
        <div style={{
          position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
          width: 92, height: 24, borderRadius: 14, background: "#000", zIndex: 10,
        }} />
        {/* status bar */}
        <div style={{ height: 40, padding: "0 22px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--ink-fg)", fontWeight: 600 }}>
          <span>9:41</span>
          <span style={{ width: 60 }} />
          <span>● ●●●</span>
        </div>
        {/* builder header + stepper */}
        <div style={{ padding: "8px 16px 0", borderBottom: "1px solid var(--ink-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="ink-btn ink-btn-ghost" style={{ width: 30, height: 30, padding: 0 }}>
              <Icon d={IX.back} size={14} />
            </button>
            <span style={{ fontSize: 13, color: "var(--ink-muted-fg)" }}>Step 4 of 5</span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-muted-fg)" }}>Background</span>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 10, paddingBottom: 10 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{
                flex: 1, height: 3, borderRadius: 2,
                background: i <= 3 ? "var(--ink-accent)" : "var(--ink-border)",
              }} />
            ))}
          </div>
        </div>
        {/* Selected card + preview trigger */}
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, height: "calc(100% - 95px)", overflow: "hidden", position: "relative" }}>
          {/* Backdrop behind sheet */}
          <div style={{ opacity: 0.4 }}>
            <input className="ink-input" placeholder="Search backgrounds" style={{ paddingLeft: 34 }} />
          </div>
          <div style={{ opacity: 0.4, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {["Acolyte", "Charlatan", "Criminal", "Folk Hero"].map((n) => (
              <div key={n} className="ink-card" style={{ padding: 10, height: 70 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-accent)" }}>{n}</div>
              </div>
            ))}
          </div>
          {/* Bottom sheet */}
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 0,
            height: "82%",
            background: "var(--ink-card)",
            borderTop: "1px solid var(--ink-border-strong)",
            borderTopLeftRadius: 18, borderTopRightRadius: 18,
            boxShadow: "0 -20px 40px rgba(0,0,0,0.5)",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 999, background: "var(--ink-border-strong)" }} />
            </div>
            {/* Sheet header */}
            <div style={{ padding: "6px 18px 12px", borderBottom: "1px solid var(--ink-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <TypeMark text="S" size={38} />
                <div style={{ flex: 1 }}>
                  <div className="ink-eyebrow" style={{ fontSize: 9 }}>SRD · Background</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "var(--ink-accent)", letterSpacing: "-0.01em" }}>Soldier</div>
                </div>
                <button className="ink-btn ink-btn-ghost" style={{ width: 28, height: 28, padding: 0 }}>
                  <Icon d={IX.close} size={14} />
                </button>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 10, overflowX: "auto" }}>
                <span className="ink-badge ink-badge-gold">Athletics</span>
                <span className="ink-badge ink-badge-gold">Intimidation</span>
                <span className="ink-badge ink-badge-outline">+Gaming</span>
              </div>
            </div>
            {/* Horizontal tab strip */}
            <div style={{ display: "flex", gap: 2, padding: "0 12px", borderBottom: "1px solid var(--ink-border)", overflowX: "auto" }}>
              {["Summary", "Feature", "Traits", "Source"].map((t, i) => (
                <button key={t} style={{
                  padding: "10px 10px", fontSize: 12, fontWeight: 500,
                  border: 0, background: "transparent", cursor: "pointer",
                  color: i === 1 ? "var(--ink-accent)" : "var(--ink-muted-fg)",
                  borderBottom: `2px solid ${i === 1 ? "var(--ink-accent)" : "transparent"}`,
                  marginBottom: -1, whiteSpace: "nowrap",
                }}>{t}</button>
              ))}
            </div>
            {/* Scrollable content */}
            <div className="ink-scroll" style={{ flex: 1, padding: "14px 18px" }}>
              <div className="ink-heading" style={{ marginBottom: 8 }}>Feature</div>
              <div className="ink-feat">
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-accent)" }}>{bg.feature.name}</div>
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-muted-fg)", lineHeight: 1.55 }}>
                  {bg.feature.desc}
                </p>
              </div>
              <div style={{ height: 14 }} />
              <div className="ink-heading" style={{ marginBottom: 8 }}>Personality</div>
              <div style={{ border: "1px solid var(--ink-border)", borderRadius: 7, overflow: "hidden" }}>
                {bg.traits.personality.slice(0, 2).map((line, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 10, padding: "9px 12px", fontSize: 12,
                    borderTop: i === 0 ? 0 : "1px solid var(--ink-border)", lineHeight: 1.5,
                  }}>
                    <span style={{ color: "var(--ink-muted-fg)", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Sticky footer */}
            <div style={{ padding: "10px 14px", borderTop: "1px solid var(--ink-border)", display: "flex", gap: 8 }}>
              <button className="ink-btn ink-btn-outline" style={{ flex: 1 }}>Cancel</button>
              <button className="ink-btn ink-btn-primary" style={{ flex: 2 }}>Select Soldier</button>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function RecommendationsCard() {
  return (
    <Frame style={{ padding: 28, alignItems: "stretch", justifyContent: "flex-start", background: "#f0eee9" }}>
      <div style={{
        width: "100%", height: "100%",
        padding: 28, borderRadius: 10,
        background: "#fef4a8", color: "#3a2f10",
        fontFamily: "'Caveat', Georgia, serif",
        display: "flex", flexDirection: "column", gap: 10,
        boxShadow: "0 2px 0 rgba(0,0,0,0.06)",
      }}>
        <div style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 18, letterSpacing: "0.02em", color: "#3a2f10" }}>
          Recommendations
        </div>
        <div style={{ fontFamily: "-apple-system, system-ui, sans-serif", fontSize: 13, lineHeight: 1.55, color: "#3a2f10" }}>
          <p style={{ margin: "6px 0" }}>
            <strong>Preview Modal → B (Top tabs)</strong>. The emblem + stat-strip header reads fast; horizontal tabs match the sheet's existing tab vocabulary; it scales from narrow to wide without restructuring. Reserve A (left-nav) for Class only — it wins when there are 5+ peer sections.
          </p>
          <p style={{ margin: "6px 0" }}>
            <strong>Class Step → C (Sidebar-by-level)</strong>. Holds up best at L12+ — the level rail gives a scannable progression map with choice dots, while the right pane keeps one level's density focused. A gets noisy past L8; B is clean but hides cross-level context.
          </p>
          <p style={{ margin: "6px 0" }}>
            <strong>Subclass</strong>: lean on C's pattern — nested inside the unlock level with the banner treatment, plus a persistent entry in the left rail at its unlock level.
          </p>
          <p style={{ margin: "6px 0" }}>
            <strong>Choice distinction</strong>: gold left-border + "Choose" pill reads clearly without a separate section split. Keep ASIs visually distinct via their own gold-tinted panel.
          </p>
          <p style={{ margin: "6px 0" }}>
            <strong>Portrait style</strong>: emblem. Portraits are expensive to source at scale; type-only loses brand warmth. Emblem matches the manuscript tone and ships today.
          </p>
        </div>
      </div>
    </Frame>
  );
}

Object.assign(window, { MobileSheet, RecommendationsCard });
