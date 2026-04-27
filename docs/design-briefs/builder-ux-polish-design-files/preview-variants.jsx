/* global React */
// Three Content Preview Modal variants.
// Each is a self-contained artboard renderer that takes a width/height and
// fills it with the modal + a dimmed builder behind it.

const { useState: _pvUseState } = React;

// ── Shared backdrop + behind-scene ─────────────────────────────
function BuilderBehind({ stepLabel = "Step 2 · Class" }) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      background: "var(--ink-bg)",
      overflow: "hidden",
      opacity: 0.55,
      filter: "blur(1px)",
    }}>
      {/* Topbar */}
      <div style={{ height: 52, display: "flex", alignItems: "center", padding: "0 24px", borderBottom: "1px solid var(--ink-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: "var(--ink-accent)", color: "var(--ink-accent-fg)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 13,
          }}>I</div>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 16, color: "var(--ink-accent)", fontStyle: "italic" }}>Inkborne</span>
        </div>
        <div style={{ marginLeft: 24, fontSize: 12, color: "var(--ink-muted-fg)" }}>
          {stepLabel}
        </div>
      </div>
      {/* Stepper */}
      <div style={{ display: "flex", gap: 8, padding: "18px 24px" }}>
        {["Race", "Class", "Abilities", "Background", "Equipment"].map((s, i) => (
          <div key={s} style={{
            height: 28, padding: "0 12px", borderRadius: 6,
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, fontWeight: 500,
            background: i === 1 ? "rgba(124,58,237,0.15)" : "transparent",
            color: i === 1 ? "#b594ff" : "var(--ink-muted-fg)",
            border: i === 1 ? "1px solid rgba(124,58,237,0.4)" : "1px solid var(--ink-border)",
          }}>
            <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.7 }}>{i + 1}</span>
            {s}
          </div>
        ))}
      </div>
      {/* Card grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, padding: "0 24px" }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="ink-card" style={{ height: 120, padding: 12 }} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Variant A — Left-nav tabs (Class view, portrait placeholder)
// ═══════════════════════════════════════════════════════════════
function PreviewModalA() {
  const cls = window.INKBORNE_DATA.fighterClass;
  const [tab, setTab] = React.useState("features");
  const tabs = [
    { id: "overview",   label: "Overview",     icon: IX.info },
    { id: "features",   label: "Features",     icon: IX.sparkles },
    { id: "equipment",  label: "Equipment",    icon: IX.shield },
    { id: "subclasses", label: "Subclasses",   icon: IX.swords },
    { id: "source",     label: "Source",       icon: IX.book },
  ];

  return (
    <Frame>
      <BuilderBehind />
      <div className="ink-modal-backdrop">
        <div className="ink-modal" style={{ width: "min(100%, 1120px)", maxHeight: "min(100%, 720px)", height: "100%" }}>
          {/* Header */}
          <div style={{ padding: "20px 24px 0", display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div style={{ width: 128, flexShrink: 0 }}>
              <PortraitSlot label={"class portrait\n128 × 170"} />
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span className="ink-eyebrow">SRD · Class</span>
                <span className="ink-dot ink-dot-muted" />
                <span style={{ fontSize: 11, color: "var(--ink-muted-fg)" }}>{cls.source}</span>
              </div>
              <h2 style={{ margin: 0, fontSize: 30, fontWeight: 600, color: "var(--ink-accent)", letterSpacing: "-0.01em" }}>
                {cls.name}
              </h2>
              <p style={{ margin: "6px 0 14px", fontSize: 13, color: "var(--ink-muted-fg)", lineHeight: 1.5, maxWidth: 640 }}>
                {cls.description}
              </p>
              {/* Stat row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {[
                  { l: "Hit Die", v: `d${cls.hit_die}` },
                  { l: "Primary", v: cls.primary_ability },
                  { l: "Saves", v: "STR, CON" },
                  { l: "Skills", v: `Choose ${cls.skills.choose} of 8` },
                ].map((x) => (
                  <div key={x.l} className="ink-card-inset" style={{ padding: "8px 10px" }}>
                    <div className="ink-eyebrow" style={{ fontSize: 9 }}>{x.l}</div>
                    <div style={{ fontSize: 13, marginTop: 2, color: "var(--ink-fg)" }}>{x.v}</div>
                  </div>
                ))}
              </div>
            </div>
            <button className="ink-btn ink-btn-ghost" style={{ width: 32, height: 32, padding: 0, flexShrink: 0 }} aria-label="Close">
              <Icon d={IX.close} size={16} />
            </button>
          </div>

          <div style={{ borderTop: "1px solid var(--ink-border)", marginTop: 20, flex: 1, display: "flex", minHeight: 0 }}>
            {/* Left nav */}
            <div style={{ width: 200, borderRight: "1px solid var(--ink-border)", padding: "14px 10px", display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
              <div className="ink-eyebrow" style={{ padding: "6px 10px 4px" }}>Sections</div>
              {tabs.map((t) => (
                <button key={t.id} className="ink-vtab" data-active={tab === t.id} onClick={() => setTab(t.id)}>
                  <Icon d={t.icon} size={14} />
                  {t.label}
                </button>
              ))}
            </div>
            {/* Content */}
            <div className="ink-scroll" style={{ flex: 1, padding: "18px 24px 24px", minWidth: 0 }}>
              {tab === "features" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <SectionHeading right={<span className="ink-badge ink-badge-outline">Levels 1–20</span>}>
                    Class Features by Level
                  </SectionHeading>
                  {[1, 2, 3, 4, 5].map((lvl) => {
                    const entry = window.INKBORNE_DATA.fighterLevels.find((l) => l.level === lvl);
                    if (!entry) return null;
                    return (
                      <div key={lvl}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: 5,
                            background: "rgba(201,164,74,0.12)", color: "var(--ink-accent)",
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                            border: "1px solid rgba(201,164,74,0.35)",
                          }}>{lvl}</span>
                          <span className="ink-heading" style={{ fontSize: 10 }}>
                            {lvl === 1 ? "1st Level" : lvl === 2 ? "2nd Level" : lvl === 3 ? "3rd Level" : `${lvl}th Level`}
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {entry.features.filter((f) => f.kind !== "subclass" && f.kind !== "asi").map((f) => (
                            <FeatureCard key={f.slug} name={f.name} description={f.description}
                              choice={f.kind === "choice"}
                              choiceLabel={f.slug === "fighting-style" ? "Choose a Fighting Style" : undefined}
                              options={f.options} selected={f.selected} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 0", color: "var(--ink-muted-fg)", fontSize: 11 }}>
                    <span>Levels 6–20 continue below</span>
                  </div>
                </div>
              )}
              {tab === "overview" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  <div>
                    <SectionHeading>Proficiencies</SectionHeading>
                    <KVLine label="Armor" value={cls.armor.join(", ")} />
                    <KVLine label="Weapons" value={cls.weapons.join(", ")} />
                    <KVLine label="Tools" value="—" />
                    <KVLine label="Saves" value="Strength, Constitution" />
                    <KVLine label="Skills" value={"Choose 2: Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Perception, Survival"} />
                  </div>
                  <div>
                    <SectionHeading>At a glance</SectionHeading>
                    <p style={{ fontSize: 13, color: "var(--ink-muted-fg)", lineHeight: 1.6 }}>{cls.description}</p>
                  </div>
                </div>
              )}
              {tab === "equipment" && (
                <div>
                  <SectionHeading>Starting Equipment</SectionHeading>
                  <p style={{ fontSize: 13, color: "var(--ink-fg)", lineHeight: 1.6 }}>{cls.starting_equipment}</p>
                </div>
              )}
              {tab === "subclasses" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <SectionHeading>Martial Archetypes</SectionHeading>
                  {cls.subclasses.map((s) => (
                    <div key={s.slug} className="ink-feat">
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-accent)" }}>{s.name}</div>
                      <div style={{ fontSize: 12.5, color: "var(--ink-muted-fg)", marginTop: 4 }}>{s.summary}</div>
                    </div>
                  ))}
                </div>
              )}
              {tab === "source" && (
                <div>
                  <SectionHeading>Source</SectionHeading>
                  <p style={{ fontSize: 13 }}>System Reference Document 5.1, licensed under CC-BY-4.0.</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: "1px solid var(--ink-border)", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--ink-muted-fg)" }}>
              <kbd className="ink-kbd">Esc</kbd> to close &nbsp;·&nbsp; <kbd className="ink-kbd">↑↓</kbd> navigate sections
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ink-btn ink-btn-outline">Cancel</button>
              <button className="ink-btn ink-btn-primary">Select {cls.name}</button>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ═══════════════════════════════════════════════════════════════
// Variant B — Top tabs (Race: Mountain Dwarf, emblem mark)
// ═══════════════════════════════════════════════════════════════
function PreviewModalB() {
  const race = window.INKBORNE_DATA.race;
  const [tab, setTab] = React.useState("traits");
  return (
    <Frame>
      <BuilderBehind stepLabel="Step 1 · Race" />
      <div className="ink-modal-backdrop">
        <div className="ink-modal" style={{ width: "min(100%, 1120px)", maxHeight: "min(100%, 720px)", height: "100%" }}>
          {/* Header */}
          <div style={{ padding: "22px 26px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Emblem letter="D" variant="gold" />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="ink-eyebrow">SRD · Race</span>
                  <span className="ink-dot ink-dot-muted" />
                  <span style={{ fontSize: 11, color: "var(--ink-muted-fg)" }}>Parent: {race.parent}</span>
                </div>
                <h2 style={{ margin: "2px 0 0", fontSize: 28, fontWeight: 600, color: "var(--ink-accent)", letterSpacing: "-0.01em" }}>
                  {race.name}
                </h2>
              </div>
              <button className="ink-btn ink-btn-ghost" style={{ width: 32, height: 32, padding: 0 }} aria-label="Close">
                <Icon d={IX.close} size={16} />
              </button>
            </div>
            {/* Quick stat strip */}
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {[
                { l: "Size", v: race.size },
                { l: "Speed", v: `${race.speed} ft` },
                { l: "ASI", v: "+2 CON, +2 STR" },
                { l: "Languages", v: race.languages.join(", ") },
                { l: "Vision", v: "Darkvision 60 ft" },
              ].map((x) => (
                <div key={x.l} className="ink-card-inset" style={{ padding: "8px 10px" }}>
                  <div className="ink-eyebrow" style={{ fontSize: 9 }}>{x.l}</div>
                  <div style={{ fontSize: 13, marginTop: 2, color: "var(--ink-fg)" }}>{x.v}</div>
                </div>
              ))}
            </div>
            {/* Tabs */}
            <div style={{ marginTop: 18, display: "flex", gap: 4, borderBottom: "1px solid var(--ink-border)" }}>
              {[
                { id: "traits", label: "Traits" },
                { id: "subraces", label: "Subraces" },
                { id: "age", label: "Age & Society" },
                { id: "source", label: "Source" },
              ].map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{
                    padding: "10px 14px", fontSize: 13, fontWeight: 500,
                    background: "transparent",
                    border: 0,
                    borderBottom: `2px solid ${tab === t.id ? "var(--ink-accent)" : "transparent"}`,
                    color: tab === t.id ? "var(--ink-accent)" : "var(--ink-muted-fg)",
                    cursor: "pointer",
                    marginBottom: -1,
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ink-scroll" style={{ flex: 1, padding: "18px 26px 24px", minHeight: 0 }}>
            {tab === "traits" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {race.traits.map((t) => (
                  <div key={t.slug} className={"ink-feat" + (t.kind === "choice" ? " ink-feat-choice" : "")}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-accent)" }}>{t.name}</span>
                      {t.kind === "choice" && <span className="ink-badge ink-badge-choice">Choice</span>}
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--ink-muted-fg)", lineHeight: 1.55 }}>{t.desc}</p>
                  </div>
                ))}
              </div>
            )}
            {tab === "subraces" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {race.subraces.map((s) => (
                  <div key={s.slug} className="ink-feat" style={{
                    borderColor: s.active ? "var(--ink-primary)" : "var(--ink-border)",
                    background: s.active ? "rgba(124,58,237,0.08)" : undefined,
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: s.active ? "#fff" : "var(--ink-accent)" }}>{s.name}</span>
                        {s.active && <span className="ink-badge ink-badge-purple">Selected</span>}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--ink-muted-fg)", marginTop: 4 }}>{s.summary}</div>
                    </div>
                    <button className={"ink-btn " + (s.active ? "ink-btn-outline" : "ink-btn-primary") + " ink-btn-sm"}>
                      {s.active ? "Selected" : "Choose"}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {tab === "age" && (
              <div style={{ maxWidth: 720 }}>
                <SectionHeading>Age</SectionHeading>
                <p style={{ fontSize: 13, color: "var(--ink-fg)", lineHeight: 1.65, marginTop: 4 }}>{race.age}</p>
                <div style={{ height: 16 }} />
                <SectionHeading>Speed notes</SectionHeading>
                <p style={{ fontSize: 13, color: "var(--ink-fg)", lineHeight: 1.65, marginTop: 4 }}>{race.speed_notes}</p>
              </div>
            )}
            {tab === "source" && (
              <div>
                <SectionHeading>Source</SectionHeading>
                <p style={{ fontSize: 13 }}>{race.source}</p>
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--ink-border)", padding: "14px 26px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="ink-btn ink-btn-outline">Cancel</button>
            <button className="ink-btn ink-btn-primary">Select {race.name}</button>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ═══════════════════════════════════════════════════════════════
// Variant C — Sticky section nav, single scroll (Background, type-only)
// ═══════════════════════════════════════════════════════════════
function PreviewModalC() {
  const bg = window.INKBORNE_DATA.background;
  const [active, setActive] = React.useState("feature");
  const sections = [
    { id: "summary",   label: "Summary" },
    { id: "feature",   label: "Feature" },
    { id: "personality", label: "Personality" },
    { id: "ideals",    label: "Ideals" },
    { id: "bonds",     label: "Bonds" },
    { id: "flaws",     label: "Flaws" },
    { id: "source",    label: "Source" },
  ];
  return (
    <Frame>
      <BuilderBehind stepLabel="Step 4 · Background" />
      <div className="ink-modal-backdrop">
        <div className="ink-modal" style={{ width: "min(100%, 1120px)", maxHeight: "min(100%, 720px)", height: "100%" }}>
          {/* Header */}
          <div style={{ padding: "24px 28px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, borderBottom: "1px solid var(--ink-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <TypeMark text="S" size={54} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="ink-eyebrow">SRD · Background</span>
                </div>
                <h2 style={{ margin: "2px 0 0", fontSize: 28, fontWeight: 600, color: "var(--ink-accent)", letterSpacing: "-0.01em" }}>
                  {bg.name}
                </h2>
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="ink-badge ink-badge-gold">Athletics</span>
                  <span className="ink-badge ink-badge-gold">Intimidation</span>
                  <span className="ink-badge ink-badge-outline">+ Gaming set</span>
                  <span className="ink-badge ink-badge-outline">+ Land vehicles</span>
                </div>
              </div>
            </div>
            <button className="ink-btn ink-btn-ghost" style={{ width: 32, height: 32, padding: 0 }} aria-label="Close">
              <Icon d={IX.close} size={16} />
            </button>
          </div>

          <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
            {/* Sticky nav */}
            <div style={{ width: 172, padding: "18px 14px", borderRight: "1px solid var(--ink-border)", flexShrink: 0 }}>
              <div className="ink-eyebrow" style={{ padding: "0 8px 10px" }}>On this page</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {sections.map((s) => (
                  <button key={s.id} onClick={() => setActive(s.id)}
                    style={{
                      textAlign: "left", border: 0, cursor: "pointer",
                      padding: "7px 10px", borderRadius: 6,
                      fontSize: 12.5, fontWeight: 500,
                      color: active === s.id ? "var(--ink-fg)" : "var(--ink-muted-fg)",
                      background: active === s.id ? "rgba(255,255,255,0.03)" : "transparent",
                      borderLeft: `2px solid ${active === s.id ? "var(--ink-accent)" : "transparent"}`,
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Scroll */}
            <div className="ink-scroll" style={{ flex: 1, padding: "22px 28px 28px", minHeight: 0 }}>
              <section id="summary" style={{ marginBottom: 26 }}>
                <SectionHeading>Summary</SectionHeading>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <KVLine label="Skills" value={bg.skills.join(", ")} />
                    <div style={{ height: 6 }} />
                    <KVLine label="Tool prof" value={bg.tools.join(", ")} />
                    <div style={{ height: 6 }} />
                    <KVLine label="Languages" value="None" />
                  </div>
                  <div>
                    <KVLine label="Equipment" value={bg.equipment} />
                  </div>
                </div>
              </section>
              <section id="feature" style={{ marginBottom: 26 }}>
                <SectionHeading>Feature</SectionHeading>
                <div className="ink-feat">
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-accent)" }}>{bg.feature.name}</div>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-fg)", lineHeight: 1.6 }}>{bg.feature.desc}</p>
                </div>
              </section>
              {["personality", "ideals", "bonds", "flaws"].map((k) => (
                <section key={k} id={k} style={{ marginBottom: 20 }}>
                  <SectionHeading right={<span className="ink-badge ink-badge-outline">d{bg.traits[k].length}</span>}>
                    {k.charAt(0).toUpperCase() + k.slice(1)}
                  </SectionHeading>
                  <ol style={{
                    margin: 0, padding: 0, listStyle: "none",
                    border: "1px solid var(--ink-border)", borderRadius: 8, overflow: "hidden",
                  }}>
                    {bg.traits[k].map((line, i) => (
                      <li key={i} style={{
                        display: "flex", gap: 14, padding: "9px 12px",
                        borderTop: i === 0 ? 0 : "1px solid var(--ink-border)",
                        fontSize: 13, lineHeight: 1.5,
                      }}>
                        <span style={{ width: 18, color: "var(--ink-muted-fg)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{i + 1}</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
              <section id="source">
                <SectionHeading>Source</SectionHeading>
                <p style={{ fontSize: 13, color: "var(--ink-muted-fg)" }}>{bg.source}</p>
              </section>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--ink-border)", padding: "14px 28px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="ink-btn ink-btn-outline">Cancel</button>
            <button className="ink-btn ink-btn-primary">Select {bg.name}</button>
          </div>
        </div>
      </div>
    </Frame>
  );
}

Object.assign(window, { PreviewModalA, PreviewModalB, PreviewModalC });
