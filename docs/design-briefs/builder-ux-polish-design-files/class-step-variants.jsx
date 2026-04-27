/* global React */
// Three Class Step variants. All use Fighter L12 as the pressure test,
// with Battle Master as the chosen subclass so subclass features thread in.

// ── Shared builder chrome (step header w/ level select) ─────────
function ClassStepHeader({ level = 12, setLevel, subclass = "Battle Master" }) {
  return (
    <div>
      {/* Topbar */}
      <div style={{ height: 52, display: "flex", alignItems: "center", padding: "0 24px", borderBottom: "1px solid var(--ink-border)", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "var(--ink-accent)", color: "var(--ink-accent-fg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 13 }}>I</div>
            <span style={{ fontFamily: "Georgia, serif", fontSize: 16, color: "var(--ink-accent)", fontStyle: "italic" }}>Inkborne</span>
          </div>
          <span style={{ fontSize: 12, color: "var(--ink-muted-fg)" }}>Aric Stonebeard · Mountain Dwarf Fighter</span>
        </div>
        <button className="ink-btn ink-btn-outline ink-btn-sm">
          <Icon d={IX.check} size={12} /> Auto-save
        </button>
      </div>
      {/* Stepper */}
      <div style={{ display: "flex", gap: 8, padding: "14px 24px", borderBottom: "1px solid var(--ink-border)" }}>
        {["Race", "Class", "Abilities", "Background", "Equipment"].map((s, i) => {
          const done = i < 1;
          const active = i === 1;
          return (
            <div key={s} style={{
              height: 30, padding: "0 12px", borderRadius: 7,
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 12.5, fontWeight: 500,
              background: active ? "rgba(124,58,237,0.15)" : "transparent",
              color: active ? "#d8c7ff" : done ? "var(--ink-fg)" : "var(--ink-muted-fg)",
              border: active ? "1px solid rgba(124,58,237,0.45)" : "1px solid var(--ink-border)",
            }}>
              <span style={{
                width: 16, height: 16, borderRadius: 4,
                background: done ? "var(--ink-accent)" : active ? "var(--ink-primary)" : "transparent",
                color: done ? "var(--ink-accent-fg)" : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700, border: done || active ? "none" : "1px solid var(--ink-border)",
              }}>
                {done ? <Icon d={IX.check} size={9} stroke={3} /> : i + 1}
              </span>
              {s}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Hero block — shared across variants ─────────────────────────
function ClassHero({ compact = false, subclass = "Battle Master", level, setLevel, subclassPosition = "below" }) {
  return (
    <div style={{
      borderRadius: 12,
      background: "linear-gradient(180deg, rgba(201,164,74,0.06) 0%, transparent 60%), var(--ink-card)",
      border: "1px solid var(--ink-border)",
      padding: compact ? 16 : 20,
      display: "flex", gap: 18, alignItems: "flex-start",
    }}>
      <div style={{ width: compact ? 64 : 84, flexShrink: 0 }}>
        <Emblem letter="F" variant="gold" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span className="ink-eyebrow">SRD · Class</span>
          <span className="ink-dot ink-dot-muted" />
          <span style={{ fontSize: 11, color: "var(--ink-muted-fg)" }}>Selected · change anytime</span>
        </div>
        <h2 style={{ margin: 0, fontSize: compact ? 22 : 26, fontWeight: 600, color: "var(--ink-accent)", letterSpacing: "-0.01em" }}>Fighter</h2>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span className="ink-badge ink-badge-outline">Hit Die d10</span>
          <span className="ink-badge ink-badge-outline">STR · CON saves</span>
          <span className="ink-badge ink-badge-outline">All armor · shields</span>
          <span className="ink-badge ink-badge-outline">Martial weapons</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        <label style={{ fontSize: 11, color: "var(--ink-muted-fg)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Level</label>
        <select className="ink-select" value={level} onChange={(e) => setLevel(parseInt(e.target.value, 10))}
          style={{ width: 70, height: 34 }}>
          {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// Count level features excluding subclass and asi
function countFeatures(levels, upTo) {
  let count = 0;
  levels.forEach((l) => { if (l.level <= upTo) count += l.features.length; });
  return count;
}

// ═══════════════════════════════════════════════════════════════
// Variant A — Single scroll, level-grouped, subclass dominant top
// ═══════════════════════════════════════════════════════════════
function ClassStepA() {
  const [level, setLevel] = React.useState(12);
  const [fightingStyle, setFightingStyle] = React.useState("defense");
  const [asi, setAsi] = React.useState({ 4: { str: 2 }, 6: { dex: 1, con: 1 }, 8: { str: 1, dex: 1 }, 12: {} });
  const levels = window.INKBORNE_DATA.fighterLevels.filter((l) => l.level <= level);

  return (
    <Frame>
      <ClassStepHeader />
      <div className="ink-scroll" style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 960, padding: "20px 24px 40px" }}>
          <ClassHero level={level} setLevel={setLevel} />

          {/* Subclass — dominant at top */}
          <div style={{ marginTop: 16 }}>
            <div style={{
              border: "1px solid rgba(124,58,237,0.45)",
              background: "linear-gradient(180deg, rgba(124,58,237,0.1) 0%, rgba(124,58,237,0.02) 100%)",
              borderRadius: 12, padding: 18,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span className="ink-eyebrow" style={{ color: "#b594ff" }}>Martial Archetype · unlocked at 3</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "var(--ink-accent)" }}>Battle Master</div>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-muted-fg)", maxWidth: 560 }}>
                    A tactician who employs maneuvers fueled by superiority dice. Features thread into levels 3, 7, 10, 15, 18.
                  </p>
                </div>
                <div style={{ minWidth: 220 }}>
                  <label style={{ fontSize: 11, color: "var(--ink-muted-fg)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Archetype</label>
                  <select className="ink-select" style={{ marginTop: 4 }} defaultValue="battle-master">
                    <option value="champion">Champion</option>
                    <option value="battle-master">Battle Master</option>
                    <option value="eldritch-knight">Eldritch Knight</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Progress summary */}
          <div style={{
            marginTop: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10,
          }}>
            {[
              { l: "Features", v: countFeatures(levels, level) },
              { l: "ASI slots", v: "4 of 4" },
              { l: "Choices open", v: 2, tone: "gold" },
              { l: "Superiority dice", v: "5 × d10" },
            ].map((x) => (
              <div key={x.l} className="ink-card-inset" style={{ padding: "10px 12px" }}>
                <div className="ink-eyebrow" style={{ fontSize: 9 }}>{x.l}</div>
                <div style={{ fontSize: 18, marginTop: 2, color: x.tone === "gold" ? "var(--ink-accent)" : "var(--ink-fg)", fontWeight: 600 }}>{x.v}</div>
              </div>
            ))}
          </div>

          {/* Level-grouped features */}
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 22 }}>
            {levels.map((lvl) => {
              return (
                <div key={lvl.level}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: 6,
                      background: "rgba(201,164,74,0.12)", color: "var(--ink-accent)",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                      border: "1px solid rgba(201,164,74,0.35)",
                    }}>{lvl.level}</span>
                    <span className="ink-heading">
                      {lvl.level === 1 ? "1st Level" : lvl.level === 2 ? "2nd Level" : lvl.level === 3 ? "3rd Level" : `${lvl.level}th Level`}
                    </span>
                    <div style={{ flex: 1, height: 1, background: "var(--ink-border)" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {lvl.features.map((f) => {
                      if (f.kind === "asi") {
                        return (
                          <ASIControl key={f.slug}
                            id={f.slug}
                            allocations={asi[lvl.level] || {}}
                            onChange={(next) => setAsi({ ...asi, [lvl.level]: next })} />
                        );
                      }
                      if (f.kind === "subclass-unlock") return null; // shown in hero
                      return (
                        <FeatureCard key={f.slug}
                          name={f.name}
                          description={f.description}
                          choice={f.kind === "choice"}
                          subclassFeature={f.kind === "subclass"}
                          choiceLabel={f.slug === "fighting-style" ? "Choose a Fighting Style" : f.choiceLabel}
                          options={f.options}
                          selected={f.slug === "fighting-style" ? fightingStyle : f.selected}
                          onSelect={f.slug === "fighting-style" ? setFightingStyle : undefined}
                          collapsed
                        />
                      );
                    })}
                    {/* Maneuver picker at L3 */}
                    {lvl.level === 3 && (
                      <div className="ink-feat ink-feat-choice">
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-accent)" }}>Maneuvers</span>
                          <span className="ink-badge ink-badge-choice">Choose 3</span>
                          <span style={{ fontSize: 11, color: "var(--ink-muted-fg)", marginLeft: "auto" }}>2 of 3 picked</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          {window.INKBORNE_DATA.maneuvers.map((m, i) => (
                            <label key={m.slug} style={{
                              display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer",
                              padding: 8, borderRadius: 6,
                              border: `1px solid ${i < 2 ? "var(--ink-primary)" : "var(--ink-border)"}`,
                              background: i < 2 ? "rgba(124,58,237,0.1)" : "transparent",
                            }}>
                              <span className="ink-check" data-on={i < 2}>
                                {i < 2 && <Icon d={IX.check} size={10} stroke={3} />}
                              </span>
                              <div>
                                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{m.name}</div>
                                <div style={{ fontSize: 11, color: "var(--ink-muted-fg)", lineHeight: 1.4, marginTop: 2 }}>{m.desc}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ═══════════════════════════════════════════════════════════════
// Variant B — Accordion per level (subclass inline at unlock)
// ═══════════════════════════════════════════════════════════════
function ClassStepB() {
  const [level, setLevel] = React.useState(12);
  const [openLevel, setOpenLevel] = React.useState(3);
  const [fightingStyle, setFightingStyle] = React.useState("defense");
  const [asi, setAsi] = React.useState({ 4: { str: 2 }, 6: { dex: 1, con: 1 }, 8: { str: 1, dex: 1 }, 12: {} });
  const levels = window.INKBORNE_DATA.fighterLevels.filter((l) => l.level <= level);

  return (
    <Frame>
      <ClassStepHeader />
      <div className="ink-scroll" style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 960, padding: "20px 24px 40px" }}>
          <ClassHero level={level} setLevel={setLevel} compact />

          {/* Summary strip */}
          <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className="ink-badge ink-badge-gold">2 choices need attention</span>
            <span className="ink-badge ink-badge-outline">12 levels · {countFeatures(levels, level)} features</span>
            <span className="ink-badge ink-badge-outline">4 ASI slots</span>
            <button className="ink-btn ink-btn-ghost ink-btn-sm" style={{ marginLeft: "auto" }}>
              Expand all
            </button>
          </div>

          {/* Accordion per level */}
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {levels.map((lvl) => {
              const open = lvl.level === openLevel;
              // Inject subclass banner at level 3
              const choiceCount = lvl.features.filter((f) => f.kind === "choice" || f.kind === "asi" || f.kind === "subclass-unlock").length;
              const featureCount = lvl.features.filter((f) => f.kind !== "subclass-unlock").length;

              return (
                <div key={lvl.level} className="ink-acc-row" style={{
                  borderColor: open ? "rgba(124,58,237,0.35)" : "var(--ink-border)",
                }}>
                  <button className="ink-acc-head"
                    onClick={() => setOpenLevel(open ? -1 : lvl.level)}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: open ? "var(--ink-primary)" : "rgba(255,255,255,0.04)",
                      color: open ? "#fff" : "var(--ink-fg)",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                      border: open ? "none" : "1px solid var(--ink-border)",
                      flexShrink: 0,
                    }}>{lvl.level}</span>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                        {lvl.features.map((f) => f.name).filter((n) => !n.startsWith("Martial Archetype")).slice(0, 2).join(", ") || "—"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-muted-fg)", marginTop: 2, display: "flex", gap: 8 }}>
                        <span>{featureCount} {featureCount === 1 ? "feature" : "features"}</span>
                        {choiceCount > 0 && <span style={{ color: "var(--ink-accent)" }}>· {choiceCount} choice{choiceCount > 1 ? "s" : ""}</span>}
                        {lvl.level === 3 && <span style={{ color: "#b594ff" }}>· Subclass unlocks</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginRight: 4 }}>
                      {lvl.features.some((f) => f.kind === "asi") && <span className="ink-badge ink-badge-choice">ASI</span>}
                      {lvl.features.some((f) => f.kind === "choice") && <span className="ink-badge ink-badge-choice">Choice</span>}
                    </div>
                    <Icon d={open ? IX.chevUp : IX.chevDown} size={16} />
                  </button>
                  {open && (
                    <div style={{ padding: "4px 14px 14px", display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--ink-border)" }}>
                      {lvl.level === 3 && (
                        /* Subclass inline at unlock */
                        <div style={{
                          marginTop: 10,
                          border: "1px solid rgba(124,58,237,0.45)",
                          background: "rgba(124,58,237,0.08)",
                          borderRadius: 8, padding: 12,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <Emblem letter="B" variant="purple" />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, color: "#b594ff", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Martial Archetype</div>
                              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-accent)" }}>Battle Master</div>
                            </div>
                            <select className="ink-select" style={{ width: 180 }} defaultValue="battle-master">
                              <option value="champion">Champion</option>
                              <option value="battle-master">Battle Master</option>
                              <option value="eldritch-knight">Eldritch Knight</option>
                            </select>
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-muted-fg)" }}>
                            Features thread into levels 3, 7, 10, 15, 18.
                          </p>
                        </div>
                      )}
                      {lvl.features.map((f) => {
                        if (f.kind === "asi") return (
                          <ASIControl key={f.slug} id={f.slug}
                            allocations={asi[lvl.level] || {}}
                            onChange={(next) => setAsi({ ...asi, [lvl.level]: next })} />
                        );
                        if (f.kind === "subclass-unlock") return null;
                        return (
                          <FeatureCard key={f.slug}
                            name={f.name}
                            description={f.description}
                            choice={f.kind === "choice"}
                            subclassFeature={f.kind === "subclass"}
                            choiceLabel={f.slug === "fighting-style" ? "Choose a Fighting Style" : f.choiceLabel}
                            options={f.options}
                            selected={f.slug === "fighting-style" ? fightingStyle : f.selected}
                            onSelect={f.slug === "fighting-style" ? setFightingStyle : undefined}
                            collapsed={false}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ═══════════════════════════════════════════════════════════════
// Variant C — Sidebar-nav-by-level + right pane (DDB-style)
// ═══════════════════════════════════════════════════════════════
function ClassStepC() {
  const [level, setLevel] = React.useState(12);
  const [focusLevel, setFocusLevel] = React.useState(3);
  const [fightingStyle, setFightingStyle] = React.useState("defense");
  const [asi, setAsi] = React.useState({ 4: { str: 2 }, 6: { dex: 1, con: 1 }, 8: { str: 1, dex: 1 }, 12: {} });
  const levels = window.INKBORNE_DATA.fighterLevels.filter((l) => l.level <= level);

  // Map which levels have choices to surface
  const levelChoice = {};
  levels.forEach((l) => {
    if (l.features.some((f) => f.kind === "asi" || f.kind === "choice" || f.kind === "subclass-unlock")) {
      levelChoice[l.level] = true;
    }
  });

  return (
    <Frame>
      <ClassStepHeader />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Left rail */}
        <div style={{
          width: 208, flexShrink: 0,
          borderRight: "1px solid var(--ink-border)",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "16px 16px 8px" }}>
            <div className="ink-eyebrow" style={{ marginBottom: 6 }}>Class</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Emblem letter="F" variant="gold" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-accent)" }}>Fighter</div>
                <div style={{ fontSize: 11, color: "var(--ink-muted-fg)" }}>Battle Master</div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 11, color: "var(--ink-muted-fg)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Level</label>
              <select className="ink-select" value={level} onChange={(e) => setLevel(parseInt(e.target.value, 10))} style={{ marginTop: 4 }}>
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ padding: "8px 12px 4px" }}>
            <div className="ink-eyebrow" style={{ padding: "0 4px 6px" }}>Levels</div>
          </div>
          <div className="ink-scroll" style={{ flex: 1, padding: "0 12px 16px", display: "flex", flexDirection: "column", gap: 1 }}>
            {levels.map((lvl) => (
              <button key={lvl.level} className="ink-level-pill"
                data-active={lvl.level === focusLevel}
                data-choice={levelChoice[lvl.level] || undefined}
                onClick={() => setFocusLevel(lvl.level)}>
                <span className="lvlnum">{lvl.level}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
                  {lvl.features.filter((f) => f.kind !== "subclass-unlock").map((f) => f.name.replace("Ability Score Improvement", "ASI")).slice(0, 1).join(", ") || "—"}
                </span>
                {levelChoice[lvl.level] && <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--ink-accent)" }} />}
              </button>
            ))}
          </div>
        </div>

        {/* Right pane */}
        <div className="ink-scroll" style={{ flex: 1, padding: "24px 28px" }}>
          {(() => {
            const lvl = levels.find((l) => l.level === focusLevel);
            if (!lvl) return null;

            return (
              <div style={{ maxWidth: 760 }}>
                {/* Breadcrumb */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-muted-fg)", marginBottom: 8 }}>
                  <span>Fighter</span>
                  <Icon d={IX.chevRight} size={10} />
                  <span>Level {focusLevel}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                  <h2 style={{ margin: 0, fontSize: 26, fontWeight: 600, color: "var(--ink-accent)", letterSpacing: "-0.01em" }}>
                    {focusLevel === 1 ? "1st Level" : focusLevel === 2 ? "2nd Level" : focusLevel === 3 ? "3rd Level" : `${focusLevel}th Level`}
                  </h2>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="ink-btn ink-btn-outline ink-btn-sm" disabled={focusLevel === 1} onClick={() => setFocusLevel(focusLevel - 1)}>
                      <Icon d={IX.back} size={12} /> Prev
                    </button>
                    <button className="ink-btn ink-btn-outline ink-btn-sm" disabled={focusLevel === level} onClick={() => setFocusLevel(focusLevel + 1)}>
                      Next <Icon d={IX.chevRight} size={12} />
                    </button>
                  </div>
                </div>

                {/* Subclass banner — nested inside level group when unlocking */}
                {focusLevel === 3 && (
                  <div style={{
                    marginTop: 14,
                    border: "1px solid rgba(124,58,237,0.45)",
                    background: "linear-gradient(180deg, rgba(124,58,237,0.1) 0%, rgba(124,58,237,0.02) 100%)",
                    borderRadius: 10, padding: 14,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Emblem letter="B" variant="purple" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: "#b594ff", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Martial Archetype</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-accent)" }}>Battle Master</div>
                        <div style={{ fontSize: 12, color: "var(--ink-muted-fg)", marginTop: 2 }}>Features continue at 7, 10, 15, 18</div>
                      </div>
                      <select className="ink-select" style={{ width: 200 }} defaultValue="battle-master">
                        <option value="champion">Champion</option>
                        <option value="battle-master">Battle Master</option>
                        <option value="eldritch-knight">Eldritch Knight</option>
                      </select>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  {lvl.features.map((f) => {
                    if (f.kind === "asi") return (
                      <ASIControl key={f.slug} id={f.slug}
                        allocations={asi[lvl.level] || {}}
                        onChange={(next) => setAsi({ ...asi, [lvl.level]: next })} />
                    );
                    if (f.kind === "subclass-unlock") return null;
                    return (
                      <FeatureCard key={f.slug}
                        name={f.name}
                        description={f.description}
                        choice={f.kind === "choice"}
                        subclassFeature={f.kind === "subclass"}
                        choiceLabel={f.slug === "fighting-style" ? "Choose a Fighting Style" : f.choiceLabel}
                        options={f.options}
                        selected={f.slug === "fighting-style" ? fightingStyle : f.selected}
                        onSelect={f.slug === "fighting-style" ? setFightingStyle : undefined}
                        collapsed={false}
                      />
                    );
                  })}
                  {focusLevel === 3 && (
                    <div className="ink-feat ink-feat-choice">
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-accent)" }}>Maneuvers</span>
                        <span className="ink-badge ink-badge-choice">Choose 3</span>
                        <span style={{ fontSize: 11, color: "var(--ink-muted-fg)", marginLeft: "auto" }}>2 of 3 picked</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                        {window.INKBORNE_DATA.maneuvers.map((m, i) => (
                          <label key={m.slug} style={{
                            display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer",
                            padding: 8, borderRadius: 6,
                            border: `1px solid ${i < 2 ? "var(--ink-primary)" : "var(--ink-border)"}`,
                            background: i < 2 ? "rgba(124,58,237,0.1)" : "transparent",
                          }}>
                            <span className="ink-check" data-on={i < 2}>
                              {i < 2 && <Icon d={IX.check} size={10} stroke={3} />}
                            </span>
                            <div>
                              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{m.name}</div>
                              <div style={{ fontSize: 11, color: "var(--ink-muted-fg)", lineHeight: 1.4, marginTop: 2 }}>{m.desc}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </Frame>
  );
}

Object.assign(window, { ClassStepA, ClassStepB, ClassStepC });
