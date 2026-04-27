// ─────────────────────────────────────────────────────────────────────────
// Level-up flow (Model B · in-rail button)
//
// Each class section has its own "+ Level up Paladin" button in the rail.
// User declares intent by which button they tap → drops them straight into
// the new level's choice pane. No modal, no extra question.
//
// Three artboards:
//   L1 — Desktop · in-rail "Level up" button (idle state)
//   L2 — Desktop · the new-level choice pane (Paladin 7 just added)
//   L3 — Mobile  · same flow on phone
// ─────────────────────────────────────────────────────────────────────────

// Reuse Frame, ClassBadge, LevelDropdown, Icon, IX, ClassStepHeader, ClassLevelPane
// from multiclass-variants.jsx.

// ── Shared bits ──────────────────────────────────────────────────────────

function LevelUpButton({ classLetter, classTone, classLabel, atLevel, disabled, reason }) {
  const gold = classTone === "gold";
  const baseColor = gold ? "var(--ink-accent)" : "#c7b0ff";
  const baseBg = gold ? "rgba(201,164,74,0.1)" : "rgba(124,58,237,0.12)";
  const baseBorder = gold ? "rgba(201,164,74,0.4)" : "rgba(124,58,237,0.45)";

  if (disabled) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 10px",
        borderRadius: 6,
        border: "1px dashed var(--ink-border)",
        background: "rgba(255,255,255,0.015)",
        color: "var(--ink-muted-fg)",
        fontSize: 11.5,
      }}>
        <span style={{
          width: 14, height: 14, borderRadius: 999,
          border: "1px dashed var(--ink-border)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, opacity: 0.6,
        }}>+</span>
        <span style={{ flex: 1, minWidth: 0 }}>Level up {classLabel}</span>
        <span style={{ fontSize: 10, opacity: 0.7 }}>{reason}</span>
      </div>
    );
  }

  return (
    <button style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 10px",
      borderRadius: 6,
      border: `1px solid ${baseBorder}`,
      background: baseBg,
      color: baseColor,
      cursor: "pointer",
      fontSize: 11.5, fontWeight: 600,
      width: "100%",
    }}>
      <span style={{
        width: 16, height: 16, borderRadius: 999,
        background: baseColor, color: "#1a1625",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700,
      }}>+</span>
      <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        Level up {classLabel}
      </span>
      <span style={{
        fontSize: 10, opacity: 0.8,
        fontVariantNumeric: "tabular-nums",
      }}>Lv {atLevel + 1}</span>
    </button>
  );
}

// Compact level pill (matches multiclass-variants vocabulary)
function LRailPill({ n, label, active, choice, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 10px",
      borderRadius: 6,
      border: `1px solid ${active ? "rgba(201,164,74,0.5)" : "var(--ink-border)"}`,
      background: active ? "rgba(201,164,74,0.12)" : "transparent",
      color: active ? "var(--ink-accent)" : "var(--ink-fg)",
      cursor: "pointer", width: "100%",
      position: "relative",
    }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, fontVariantNumeric: "tabular-nums",
        opacity: active ? 1 : 0.7, minWidth: 14, textAlign: "left" }}>{n}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 11.5,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{label}</span>
      {choice && (
        <span style={{ width: 6, height: 6, borderRadius: 999,
          background: "var(--ink-accent)", flexShrink: 0 }} />
      )}
    </button>
  );
}

function LRailPillPurple({ n, label, active, choice, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 10px", borderRadius: 6,
      border: `1px solid ${active ? "rgba(124,58,237,0.55)" : "var(--ink-border)"}`,
      background: active ? "rgba(124,58,237,0.15)" : "transparent",
      color: active ? "#c7b0ff" : "var(--ink-fg)",
      cursor: "pointer", width: "100%", position: "relative",
    }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, fontVariantNumeric: "tabular-nums",
        opacity: active ? 1 : 0.7, minWidth: 14, textAlign: "left" }}>{n}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 11.5,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{label}</span>
      {choice && (
        <span style={{ width: 6, height: 6, borderRadius: 999,
          background: "#c7b0ff", flexShrink: 0 }} />
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// L1 — Desktop · in-rail "Level up" button (idle / pre-tap)
// ═══════════════════════════════════════════════════════════════
function LevelUpL1_RailIdle() {
  return (
    <Frame>
      <ClassStepHeader />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Sidebar */}
        <div style={{
          width: 240, borderRight: "1px solid var(--ink-border)",
          padding: "14px 12px",
          display: "flex", flexDirection: "column", gap: 10,
          background: "rgba(255,255,255,0.01)",
          overflow: "auto",
        }}>
          {/* Character entry */}
          <div style={{
            padding: "10px 12px", borderRadius: 7,
            border: "1px solid var(--ink-border)",
            background: "rgba(255,255,255,0.02)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 999,
              background: "color-mix(in oklab, oklch(65% 0.18 300) 35%, #1a1625)",
              fontSize: 10, color: "#fff", fontFamily: "Georgia, serif",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontWeight: 600,
            }}>KV</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>Character</div>
              <div style={{ fontSize: 10.5, color: "var(--ink-muted-fg)", marginTop: 1 }}>
                Lv 9/20 · merged slots · +4 prof
              </div>
            </div>
          </div>

          {/* Paladin section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <RailSectionHead letter="P" tone="gold" title="Paladin"
              subtitle="Oath of Devotion" level={6} maxLevel={17}
              collapsed={false} onToggle={() => {}} onLevelChange={() => {}} />
            <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 4 }}>
              <LRailPill n={1} label="Divine Sense, LoH" />
              <LRailPill n={2} label="Fighting Style, Smite" />
              <LRailPill n={3} label="Sacred Oath" />
              <LRailPill n={4} label="ASI" />
              <LRailPill n={5} label="Extra Attack" />
              <LRailPill n={6} label="Aura of Protection" active />
            </div>
            {/* In-rail level-up button */}
            <div style={{ paddingLeft: 4, paddingTop: 4 }}>
              <LevelUpButton classLetter="P" classTone="gold" classLabel="Paladin"
                atLevel={6} />
            </div>
          </div>

          {/* Sorcerer section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <RailSectionHead letter="S" tone="purple" title="Sorcerer"
              subtitle="Draconic" level={3} maxLevel={14}
              collapsed={false} onToggle={() => {}} onLevelChange={() => {}} />
            <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 4 }}>
              <LRailPillPurple n={1} label="Sorcery, Origin" />
              <LRailPillPurple n={2} label="Font of Magic" />
              <LRailPillPurple n={3} label="Metamagic" />
            </div>
            <div style={{ paddingLeft: 4, paddingTop: 4 }}>
              <LevelUpButton classLetter="S" classTone="purple" classLabel="Sorcerer"
                atLevel={3} />
            </div>
          </div>

          {/* Add a class */}
          <button style={{
            marginTop: 6,
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px dashed var(--ink-border)",
            background: "transparent",
            color: "var(--ink-muted-fg)",
            cursor: "pointer", fontSize: 11.5, fontWeight: 500,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 13, opacity: 0.7 }}>＋</span>
            Add a class
          </button>
        </div>

        {/* Main pane — currently showing Aura of Protection (Pal 6) */}
        <div className="ink-scroll" style={{ flex: 1, padding: "24px 28px" }}>
          <div style={{ maxWidth: 720 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-muted-fg)", marginBottom: 8 }}>
              <ClassBadge letter="P" tone="gold" size={14} />
              <span>Paladin</span>
              <Icon d={IX.chevRight} size={10} />
              <span>Level 6</span>
            </div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600,
              color: "var(--ink-accent)", letterSpacing: "-0.01em" }}>
              Aura of Protection
            </h2>
            <p style={{ margin: "6px 0 18px", fontSize: 13, color: "var(--ink-muted-fg)", maxWidth: 520 }}>
              You and friendly creatures within 10 ft of you add your CHA modifier to saving throws, as long as you are not incapacitated.
            </p>

            {/* Empty hint — gentle nudge to next level */}
            <div style={{
              padding: "14px 16px",
              borderRadius: 8,
              border: "1px solid var(--ink-border)",
              background: "rgba(255,255,255,0.015)",
              display: "flex", alignItems: "center", gap: 12,
              maxWidth: 520, marginTop: 16,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 999,
                background: "rgba(201,164,74,0.15)",
                border: "1px solid rgba(201,164,74,0.4)",
                color: "var(--ink-accent)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>↑</div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                <div style={{ color: "var(--ink-fg)", fontWeight: 500 }}>Ready to keep going?</div>
                <div style={{ color: "var(--ink-muted-fg)", marginTop: 1 }}>
                  Use the <strong style={{ color: "var(--ink-accent)" }}>+ Level up Paladin</strong> button in the sidebar to add Lv 7 (Aura improvement), or pick a different class.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ═══════════════════════════════════════════════════════════════
// L2 — Desktop · just-tapped "Level up Paladin" → choice pane
// ═══════════════════════════════════════════════════════════════
function LevelUpL2_NewLevelChoice() {
  const [hp, setHp] = React.useState("avg"); // "avg" | "roll" | "manual"
  return (
    <Frame>
      <ClassStepHeader />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Sidebar — Pal 7 now exists, ACTIVE; "Level up" button reflects new state */}
        <div style={{
          width: 240, borderRight: "1px solid var(--ink-border)",
          padding: "14px 12px",
          display: "flex", flexDirection: "column", gap: 10,
          background: "rgba(255,255,255,0.01)",
          overflow: "auto",
        }}>
          <div style={{
            padding: "10px 12px", borderRadius: 7,
            border: "1px solid rgba(201,164,74,0.35)",
            background: "rgba(201,164,74,0.08)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 999,
              background: "color-mix(in oklab, oklch(65% 0.18 300) 35%, #1a1625)",
              fontSize: 10, color: "#fff", fontFamily: "Georgia, serif",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontWeight: 600,
            }}>KV</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>Character</div>
              <div style={{ fontSize: 10.5, color: "var(--ink-accent)", marginTop: 1 }}>
                Lv 9 → 10 · adding Pal 7
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <RailSectionHead letter="P" tone="gold" title="Paladin"
              subtitle="Adding Lv 7" level={7} maxLevel={17}
              collapsed={false} onToggle={() => {}} onLevelChange={() => {}} />
            <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 4 }}>
              <LRailPill n={1} label="Divine Sense, LoH" />
              <LRailPill n={2} label="Fighting Style, Smite" />
              <LRailPill n={3} label="Sacred Oath" />
              <LRailPill n={4} label="ASI" />
              <LRailPill n={5} label="Extra Attack" />
              <LRailPill n={6} label="Aura of Protection" />
              <LRailPill n={7} label="Aura improvement" active choice />
            </div>
            <div style={{ paddingLeft: 4, paddingTop: 4 }}>
              {/* Disabled because we're mid-flow, with active label */}
              <LevelUpButton classLetter="P" classTone="gold" classLabel="Paladin"
                atLevel={7} disabled reason="In progress" />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <RailSectionHead letter="S" tone="purple" title="Sorcerer"
              subtitle="Draconic" level={3} maxLevel={13}
              collapsed={false} onToggle={() => {}} onLevelChange={() => {}} />
            <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 4 }}>
              <LRailPillPurple n={1} label="Sorcery, Origin" />
              <LRailPillPurple n={2} label="Font of Magic" />
              <LRailPillPurple n={3} label="Metamagic" />
            </div>
            <div style={{ paddingLeft: 4, paddingTop: 4 }}>
              <LevelUpButton classLetter="S" classTone="purple" classLabel="Sorcerer"
                atLevel={3} disabled reason="Finish Pal 7 first" />
            </div>
          </div>
        </div>

        {/* Main pane — the new level's choice screen */}
        <div className="ink-scroll" style={{ flex: 1, padding: "24px 28px" }}>
          <div style={{ maxWidth: 720 }}>
            {/* Breadcrumb + commit-state ribbon */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <ClassBadge letter="P" tone="gold" size={14} />
              <span style={{ fontSize: 11, color: "var(--ink-muted-fg)" }}>Paladin</span>
              <Icon d={IX.chevRight} size={10} />
              <span style={{ fontSize: 11, color: "var(--ink-muted-fg)" }}>Level 7</span>
              <span style={{
                marginLeft: 8, padding: "2px 7px",
                fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
                background: "rgba(201,164,74,0.15)",
                border: "1px solid rgba(201,164,74,0.4)",
                color: "var(--ink-accent)",
                borderRadius: 3, textTransform: "uppercase",
              }}>New level</span>
            </div>

            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600,
              color: "var(--ink-accent)", letterSpacing: "-0.01em" }}>
              Aura improvement
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-muted-fg)" }}>
              Your Aura of Protection's range increases — and you gain a feature from your Sacred Oath.
            </p>

            {/* What this level grants */}
            <div className="ink-eyebrow" style={{ marginTop: 22 }}>What this level grants</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              <div style={{
                padding: "12px 14px", borderRadius: 8,
                border: "1px solid var(--ink-border)",
                background: "rgba(255,255,255,0.02)",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-fg)" }}>Aura of Devotion</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-muted-fg)", marginTop: 2 }}>
                  Devotion · You and friendly creatures within 10 ft of you can't be charmed.
                </div>
              </div>
              <div style={{
                padding: "12px 14px", borderRadius: 8,
                border: "1px solid var(--ink-border)",
                background: "rgba(255,255,255,0.02)",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-fg)" }}>Spell slot upgrade</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-muted-fg)", marginTop: 2 }}>
                  Slots become 4 / 3 / 3 / 1 · gains 4th-level slots.
                </div>
              </div>
            </div>

            {/* HP roll — the only choice at this level */}
            <div className="ink-eyebrow" style={{ marginTop: 22 }}>Hit points</div>
            <div style={{
              padding: "14px 16px", borderRadius: 8,
              border: "1px solid rgba(201,164,74,0.35)",
              background: "rgba(201,164,74,0.06)",
              display: "flex", flexDirection: "column", gap: 12, marginTop: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--ink-muted-fg)" }}>
                  Paladin uses <strong style={{ color: "var(--ink-fg)" }}>d10</strong>. With CON +3, you'll add <strong style={{ color: "var(--ink-fg)" }}>+3</strong> either way.
                </div>
                <div style={{ display: "inline-flex", padding: 2, borderRadius: 6,
                  border: "1px solid var(--ink-border)", background: "rgba(0,0,0,0.2)" }}>
                  {[
                    { id: "avg", label: "Average (6)" },
                    { id: "roll", label: "Roll d10" },
                    { id: "manual", label: "Manual" },
                  ].map((opt) => {
                    const on = hp === opt.id;
                    return (
                      <button key={opt.id} onClick={() => setHp(opt.id)} style={{
                        padding: "5px 10px", fontSize: 11, fontWeight: 500,
                        borderRadius: 5, border: "none", cursor: "pointer",
                        background: on ? "rgba(201,164,74,0.18)" : "transparent",
                        color: on ? "var(--ink-accent)" : "var(--ink-muted-fg)",
                      }}>{opt.label}</button>
                    );
                  })}
                </div>
              </div>
              <div style={{
                padding: "8px 12px", borderRadius: 6,
                background: "rgba(0,0,0,0.25)",
                fontSize: 12, fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                color: "var(--ink-muted-fg)",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <span>HP delta:</span>
                <span style={{ color: "var(--ink-fg)", fontVariantNumeric: "tabular-nums" }}>
                  +{hp === "avg" ? "9" : hp === "roll" ? "8" : "—"}
                </span>
                <span style={{ marginLeft: "auto" }}>
                  Total: <span style={{ color: "var(--ink-accent)", fontVariantNumeric: "tabular-nums" }}>
                    {hp === "avg" ? "77" : hp === "roll" ? "76" : "68 + ?"}
                  </span>
                </span>
              </div>
            </div>

            {/* Bottom action bar */}
            <div style={{
              marginTop: 22, padding: "12px 0",
              display: "flex", alignItems: "center", gap: 10,
              borderTop: "1px solid var(--ink-border)",
            }}>
              <button className="ink-btn ink-btn-outline ink-btn-sm">Cancel level-up</button>
              <span style={{ fontSize: 11, color: "var(--ink-muted-fg)", marginLeft: 8 }}>
                Will set Paladin to Lv 7 · character to Lv 10
              </span>
              <button style={{
                marginLeft: "auto",
                padding: "8px 16px", fontSize: 12.5, fontWeight: 600,
                background: "var(--ink-accent)", color: "#1a1625",
                border: "1px solid rgba(201,164,74,0.5)",
                borderRadius: 6, cursor: "pointer",
              }}>Confirm level 7</button>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ═══════════════════════════════════════════════════════════════
// L3 — Mobile · in-rail level-up flow
// ═══════════════════════════════════════════════════════════════
function LevelUpL3_Mobile() {
  return (
    <IOSDevice dark={true} width={390} height={844}>
      <div style={{
        height: "100%", display: "flex", flexDirection: "column",
        background: "var(--ink-bg)", color: "var(--ink-fg)",
        paddingTop: 54,
      }}>
        <MHeader step="4 of 7" title="Class" />
        <MCharStrip />

        {/* Paladin rail with trailing level-up pill */}
        <MRail label={{ letter: "P", name: "Paladin" }} tone="gold" currentLevel={6}>
          {[
            { n: 1, label: "Divine" },
            { n: 2, label: "Style" },
            { n: 3, label: "Oath" },
            { n: 4, label: "ASI" },
            { n: 5, label: "Extra" },
            { n: 6, label: "Aura" },
          ].map((l) => (
            <MLevelPill key={l.n} n={l.n} tone="gold" label={l.label}
              active={l.n === 6} onClick={() => {}} />
          ))}
          {/* Level-up pill */}
          <button style={{
            flex: "0 0 auto", padding: "8px 12px", minWidth: 88,
            borderRadius: 10,
            border: "1px solid rgba(201,164,74,0.4)",
            background: "rgba(201,164,74,0.1)",
            color: "var(--ink-accent)", cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 12, fontWeight: 600,
          }}>
            <span style={{
              width: 14, height: 14, borderRadius: 999,
              background: "var(--ink-accent)", color: "#1a1625",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700,
            }}>+</span>
            Level up
            <span style={{ fontSize: 10.5, opacity: 0.8, fontVariantNumeric: "tabular-nums" }}>
              · Lv 7
            </span>
          </button>
        </MRail>

        {/* Sorcerer rail with trailing level-up pill */}
        <MRail label={{ letter: "S", name: "Sorcerer" }} tone="purple" currentLevel={3}>
          {[
            { n: 1, label: "Sorcery" },
            { n: 2, label: "Font" },
            { n: 3, label: "Meta" },
          ].map((l) => (
            <MLevelPill key={l.n} n={l.n} tone="purple" label={l.label}
              active={false} onClick={() => {}} />
          ))}
          <button style={{
            flex: "0 0 auto", padding: "8px 12px", minWidth: 88,
            borderRadius: 10,
            border: "1px solid rgba(124,58,237,0.45)",
            background: "rgba(124,58,237,0.12)",
            color: "#c7b0ff", cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 12, fontWeight: 600,
          }}>
            <span style={{
              width: 14, height: 14, borderRadius: 999,
              background: "#c7b0ff", color: "#1a1625",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700,
            }}>+</span>
            Level up
            <span style={{ fontSize: 10.5, opacity: 0.8, fontVariantNumeric: "tabular-nums" }}>
              · Lv 4
            </span>
          </button>
          <button style={{
            flex: "0 0 auto", padding: "8px 12px", minWidth: 58,
            borderRadius: 10,
            border: "1px dashed var(--ink-border)",
            background: "transparent",
            color: "var(--ink-muted-fg)", cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 500,
          }}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
            New class
          </button>
        </MRail>

        {/* Body — current level (Pal 6 / Aura) but a callout shows level-up CTA */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 90px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--ink-muted-fg)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
            <MClassBadge letter="P" tone="gold" size={12} />
            Paladin · Level 6
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600,
            color: "var(--ink-accent)", letterSpacing: "-0.01em" }}>
            Aura of Protection
          </h2>
          <p style={{ margin: "3px 0 14px", fontSize: 12, color: "var(--ink-muted-fg)" }}>
            Friendly creatures within 10 ft add your CHA modifier to saves.
          </p>

          {/* Level-up callout — same intent as the rail button, more prominent in body */}
          <div style={{
            padding: "12px 14px", borderRadius: 10,
            border: "1px solid rgba(201,164,74,0.4)",
            background: "rgba(201,164,74,0.08)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 999,
              background: "var(--ink-accent)", color: "#1a1625",
              fontSize: 14, fontWeight: 700,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>↑</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-fg)" }}>
                Add Paladin Lv 7
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-muted-fg)", marginTop: 1 }}>
                Aura improvement · 4th-level spell slots
              </div>
            </div>
            <button style={{
              padding: "7px 12px", fontSize: 12, fontWeight: 600,
              background: "var(--ink-accent)", color: "#1a1625",
              border: "1px solid rgba(201,164,74,0.5)",
              borderRadius: 6, cursor: "pointer", flexShrink: 0,
            }}>Level up</button>
          </div>

          <div style={{ marginTop: 18, fontSize: 11, color: "var(--ink-muted-fg)", textAlign: "center" }}>
            Or use the <strong style={{ color: "var(--ink-fg)" }}>Level up</strong> pills at the end of any class rail above.
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

Object.assign(window, {
  LevelUpL1_RailIdle,
  LevelUpL2_NewLevelChoice,
  LevelUpL3_Mobile,
});
