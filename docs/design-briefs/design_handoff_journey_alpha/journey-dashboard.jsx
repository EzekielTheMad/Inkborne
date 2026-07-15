/* global React, JLogo, JRule, JStarRule, JInkstain, JCornerOrnament, JImg, JCharRow */

const { useState: dUseState } = React;

// ── Authenticated nav + alpha banner ─────────────────────────────
function AppNav({ active = "characters" }) {
  return (
    <header style={{
      borderBottom: "1px solid var(--ink-border)",
      padding: "14px 28px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "var(--ink-bg)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
        <JLogo size={18} />
        <nav style={{ display: "flex", gap: 18 }}>
          {["Dashboard", "Library", "Homebrew"].map((t) => {
            const k = t.toLowerCase();
            const on = k === active || (k === "dashboard" && active === "characters");
            return (
              <a key={t} className="j-nav-link" style={{
                color: on ? "var(--ink-accent)" : "var(--ink-muted-fg)",
                fontWeight: on ? 600 : 500,
                position: "relative",
                paddingBottom: 14, marginBottom: -14,
                borderBottom: on ? "1px solid var(--ink-accent)" : "1px solid transparent",
              }}>{t}</a>
            );
          })}
        </nav>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span className="j-chip">★ Alpha</span>
        <button className="j-btn-quiet j-btn-sm">+ New character</button>
        <div style={{ width: 32, height: 32, borderRadius: 16, background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--ink-display)", fontSize: 13, color: "var(--ink-fg)" }}>R</div>
      </div>
    </header>
  );
}

// ─── Dashboard A · Characters-dominant ─────────────────────────────
function DashboardA() {
  return (
    <div className="ink j-grain" style={{ minHeight: "100%", overflow: "hidden", position: "relative" }}>
      <AppNav active="characters" />
      <main style={{ padding: "40px 32px", maxWidth: 1080, margin: "0 auto" }}>
        {/* Welcome */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <div className="j-folio" style={{ marginBottom: 8 }}>Folio I · Welcome back</div>
            <h1 className="j-display" style={{ fontSize: 38, color: "var(--ink-fg)", margin: 0 }}>
              Good evening, <em className="j-display-italic" style={{ color: "var(--ink-accent)" }}>Raven</em>.
            </h1>
            <p style={{ fontSize: 13.5, color: "var(--ink-muted-fg)", margin: "6px 0 0" }}>
              You have 4 characters across 2 campaigns.
            </p>
          </div>
          <button className="j-btn-gold">+ Begin a new character</button>
        </div>

        <div style={{ margin: "30px 0" }}><JRule glyph="✦" /></div>

        {/* Jump back in */}
        <div style={{
          display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, marginBottom: 28,
        }}>
          <div className="j-card-paper" style={{ padding: 22, position: "relative", overflow: "hidden" }}>
            <JInkstain width={300} height={200} opacity={0.06} style={{ right: -60, top: -40 }} />
            <div className="j-folio" style={{ marginBottom: 8 }}>Last opened · 2 hours ago</div>
            <h3 className="j-display" style={{ fontSize: 22, color: "var(--ink-fg)", margin: 0, marginBottom: 4 }}>Resume — Thalindra Moonweave</h3>
            <p style={{ fontSize: 12.5, color: "var(--ink-muted-fg)", margin: "0 0 14px" }}>Lvl 5 High Elf Wizard · The Twilight Archive</p>
            <button className="j-btn-purple j-btn-sm">Open sheet →</button>
          </div>
          <div className="j-card-paper" style={{ padding: 22 }}>
            <div className="j-folio" style={{ marginBottom: 8 }}>Alpha note · This week</div>
            <p style={{ fontSize: 13, color: "var(--ink-fg)", margin: 0, marginBottom: 12, lineHeight: 1.55 }}>
              <span className="j-display-italic" style={{ color: "var(--ink-accent)" }}>Conditions</span> got a redesign.
              The death-saves widget now rolls into the HP popover.
            </p>
            <a className="j-nav-link" style={{ color: "var(--ink-accent)", textDecoration: "underline", textUnderlineOffset: 3, fontSize: 12 }}>Read changelog →</a>
          </div>
        </div>

        {/* Characters */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <h2 className="ink-heading" style={{ fontSize: 12 }}>★ Your characters</h2>
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--ink-muted-fg)" }}>
            <span style={{ color: "var(--ink-accent)" }}>All</span>
            <span>Active</span>
            <span>Archived</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <JCharRow name="Thalindra Moonweave" sub="High Elf Wizard · Chronurgy · The Twilight Archive" level={5} lastEdited="2h ago" />
          <JCharRow name="Bram Hollowstone" sub="Mountain Dwarf Fighter · Battle Master · Solo" level={12} tone="purple" lastEdited="3d ago" />
          <JCharRow name="Veyra Stormhollow" sub="Half-Elf Sorcerer · Storm Sorcery · The Coven of Greyfen" level={5} lastEdited="last week" />
          <JCharRow name="Aric (paused)" sub="Variant Human Paladin · Oath of Devotion" level={3} tone="purple" lastEdited="2 weeks ago" />
        </div>

        {/* Campaigns subtle strip */}
        <div style={{ marginTop: 36, padding: "20px 22px", border: "1px solid var(--ink-border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--ink-paper-2)" }}>
          <div>
            <div className="ink-eyebrow" style={{ marginBottom: 4 }}>Coming next folio</div>
            <span style={{ fontSize: 13, color: "var(--ink-muted-fg)" }}>Campaigns — sessions, NPCs, secrets, in one place.</span>
          </div>
          <a className="j-nav-link" style={{ color: "var(--ink-accent)" }}>Watch this space →</a>
        </div>
      </main>
    </div>
  );
}

// ─── Dashboard B · Home base / cockpit ─────────────────────────────
function DashboardB() {
  return (
    <div className="ink j-grain" style={{ minHeight: "100%", overflow: "hidden", position: "relative" }}>
      <AppNav active="characters" />
      <main style={{ padding: "32px", maxWidth: 1140, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22 }}>
          <div>
            <div className="j-folio">Home</div>
            <h1 className="j-display" style={{ fontSize: 32, color: "var(--ink-fg)", margin: "6px 0 0" }}>
              Welcome back, <em className="j-display-italic" style={{ color: "var(--ink-accent)" }}>Raven</em>.
            </h1>
          </div>
          <span className="j-marginalia">A waxing crescent · 26 Apr</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
          {/* Jump back in — large hero card */}
          <div className="j-card-paper" style={{ padding: 24, position: "relative", overflow: "hidden", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 18, alignItems: "center" }}>
            <JInkstain width={300} height={200} opacity={0.05} style={{ right: -40, top: -20 }} />
            <JImg label="PORTRAIT" height={84} style={{ width: 84, height: 84, borderRadius: 8 }} />
            <div>
              <div className="j-folio">Pick up where you left</div>
              <h3 className="j-display" style={{ fontSize: 22, color: "var(--ink-fg)", margin: "4px 0 4px" }}>Thalindra Moonweave</h3>
              <p style={{ fontSize: 12, color: "var(--ink-muted-fg)", margin: 0 }}>Lvl 5 · Chronurgy Wizard · The Twilight Archive</p>
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-muted-fg)" }}>
                Last edited — “Memorized Detect Magic. Marked Folio 14.”
              </div>
            </div>
            <button className="j-btn-gold j-btn-sm">Open →</button>
          </div>

          {/* Alpha card */}
          <div className="j-card-paper" style={{ padding: 22 }}>
            <div className="j-folio" style={{ marginBottom: 8 }}>Alpha · what's new</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 12.5, color: "var(--ink-muted-fg)", lineHeight: 1.7 }}>
              <li><span style={{ color: "var(--ink-accent)" }}>● </span> Multiclass: spell-slot math fixed</li>
              <li><span style={{ color: "var(--ink-accent)" }}>● </span> New rest dialog</li>
              <li><span style={{ color: "var(--ink-accent)" }}>● </span> Conditions redesign</li>
            </ul>
            <a className="j-nav-link" style={{ color: "var(--ink-accent)", textDecoration: "underline", textUnderlineOffset: 3, fontSize: 11.5, display: "inline-block", marginTop: 10 }}>Full changelog →</a>
          </div>
        </div>

        {/* Campaigns: owned vs playing in */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
          <CampaignsCol
            kicker="II · Campaigns you run"
            count={1}
            items={[
              ["The Coven of Greyfen", "DMing · 6 players · Session 14 — Thursday", "gold"],
            ]}
            cta="+ New campaign"
          />
          <CampaignsCol
            kicker="III · Campaigns you play in"
            count={2}
            items={[
              ["The Twilight Archive", "Playing Thalindra · DM: Mira · Wed bi-weekly", "purple"],
              ["Solo · Hollowstone", "Playing Bram · solo journal", "purple"],
            ]}
            cta="Browse all →"
            quiet
          />
        </div>

        {/* Characters list (mirrors Dashboard A) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <h2 className="ink-heading" style={{ fontSize: 12 }}>★ Your characters</h2>
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--ink-muted-fg)" }}>
            <span style={{ color: "var(--ink-accent)" }}>All (4)</span>
            <span>Active (3)</span>
            <span>Archived (1)</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <JCharRow name="Thalindra Moonweave" sub="High Elf Wizard · Chronurgy · The Twilight Archive" level={5} lastEdited="2h ago" />
          <JCharRow name="Bram Hollowstone" sub="Mountain Dwarf Fighter · Battle Master · Solo" level={12} tone="purple" lastEdited="3d ago" />
          <JCharRow name="Veyra Stormhollow" sub="Half-Elf Sorcerer · Storm Sorcery · The Coven of Greyfen" level={5} lastEdited="last week" />
          <JCharRow name="Aric (paused)" sub="Variant Human Paladin · Oath of Devotion" level={3} tone="purple" lastEdited="2 weeks ago" />
        </div>
      </main>
    </div>
  );
}

function Tile({ title, body, cta, gold, muted }) {
  return (
    <div className="j-card-paper" style={{
      padding: 22, position: "relative",
      borderColor: gold ? "rgba(201,164,74,0.3)" : "var(--ink-border-strong)",
      background: gold ? "rgba(201,164,74,0.04)" : "var(--ink-paper)",
      opacity: muted ? 0.85 : 1,
    }}>
      <h4 className="j-display" style={{ fontSize: 20, color: gold ? "var(--ink-accent)" : "var(--ink-fg)", margin: 0, marginBottom: 6 }}>{title}</h4>
      <p style={{ fontSize: 12.5, color: "var(--ink-muted-fg)", lineHeight: 1.55, margin: 0, marginBottom: 14 }}>{body}</p>
      <a className="j-nav-link" style={{ color: gold ? "var(--ink-accent)" : "var(--ink-fg)", fontSize: 12, fontWeight: 600 }}>{cta}</a>
    </div>
  );
}

function CampaignsCol({ kicker, count, items, cta, quiet }) {
  return (
    <div className="j-card-paper" style={{
      padding: 22, position: "relative", overflow: "hidden",
      borderColor: quiet ? "var(--ink-border-strong)" : "rgba(201,164,74,0.3)",
      background: quiet ? "var(--ink-paper)" : "rgba(201,164,74,0.04)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <div className="j-folio">{kicker}</div>
        <span className="j-marginalia" style={{ fontSize: 11 }}>{count} {count === 1 ? "campaign" : "campaigns"}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map(([title, sub, tone], i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center", padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid var(--ink-border)" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 6,
              background: tone === "gold" ? "rgba(201,164,74,0.12)" : "rgba(124,58,237,0.14)",
              border: `1px solid ${tone === "gold" ? "rgba(201,164,74,0.4)" : "rgba(124,58,237,0.4)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--ink-display)", fontStyle: "italic",
              fontSize: 16, color: tone === "gold" ? "var(--ink-accent)" : "rgba(167,139,250,0.95)",
            }}>{title.charAt(0)}</div>
            <div>
              <div className="j-display" style={{ fontSize: 15, color: "var(--ink-fg)" }}>{title}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-muted-fg)", marginTop: 2 }}>{sub}</div>
            </div>
            <a className="j-nav-link" style={{ fontSize: 11, color: "var(--ink-muted-fg)" }}>Open →</a>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--ink-border)" }}>
        <a className="j-nav-link" style={{ color: quiet ? "var(--ink-fg)" : "var(--ink-accent)", fontSize: 12, fontWeight: 600 }}>{cta}</a>
      </div>
    </div>
  );
}

// ─── Dashboard C · Portal — minimal, list dominates ────────────────
function DashboardC() {
  return (
    <div className="ink j-grain" style={{ minHeight: "100%", overflow: "hidden", position: "relative" }}>
      <AppNav active="characters" />
      <main style={{ padding: "40px 32px", maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36, position: "relative" }}>
          <div className="j-folio" style={{ marginBottom: 10 }}>The Portfolio</div>
          <h1 className="j-display" style={{ fontSize: 40, color: "var(--ink-fg)", margin: 0 }}>
            <em className="j-display-italic" style={{ color: "var(--ink-accent)" }}>Raven's</em> notebooks
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--ink-muted-fg)", marginTop: 8 }}>4 characters · 2 campaigns · 1 in progress</p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
            <span style={{ color: "var(--ink-accent)" }}>● All (4)</span>
            <span style={{ color: "var(--ink-muted-fg)" }}>Active (3)</span>
            <span style={{ color: "var(--ink-muted-fg)" }}>Archived (1)</span>
            <span style={{ width: 1, background: "var(--ink-border)", height: 14 }} />
            <span style={{ color: "var(--ink-muted-fg)" }}>By class</span>
            <span style={{ color: "var(--ink-muted-fg)" }}>By campaign</span>
          </div>
          <button className="j-btn-gold j-btn-sm">+ Begin</button>
        </div>

        {/* Big card grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {[
            ["Thalindra Moonweave", "High Elf Wizard · Chronurgy", 5, "The Twilight Archive", "INT 18", "gold"],
            ["Bram Hollowstone", "Mountain Dwarf Fighter · Battle Master", 12, "Solo", "STR 17", "purple"],
            ["Veyra Stormhollow", "Half-Elf Sorcerer · Storm Sorcery", 5, "The Coven of Greyfen", "CHA 17", "gold"],
            ["Aric", "Variant Human Paladin · Devotion", 3, "Paused", "STR 16", "purple"],
          ].map(([n, sub, lvl, camp, stat, tone], i) => (
            <BigCard key={i} name={n} sub={sub} level={lvl} campaign={camp} stat={stat} tone={tone} />
          ))}
        </div>
      </main>
    </div>
  );
}

function BigCard({ name, sub, level, campaign, stat, tone }) {
  return (
    <div className="j-card-paper" style={{ padding: 18, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 16, alignItems: "center", position: "relative" }}>
      <JImg label="" height={64} style={{ width: 64, height: 64, borderRadius: 8 }} tone={tone} />
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="j-display" style={{ fontSize: 18, color: "var(--ink-fg)" }}>{name}</span>
          <span className="j-display" style={{ fontSize: 11, color: "var(--ink-accent)", letterSpacing: "0.1em" }}>· LVL {level}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-muted-fg)", marginTop: 2 }}>{sub}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 11, color: "var(--ink-muted-fg)" }}>
          <span style={{ color: "var(--ink-accent)" }}>★ {campaign}</span>
          <span>· {stat}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <span className="j-marginalia" style={{ fontSize: 11 }}>2h ago</span>
        <button className="j-btn-quiet j-btn-sm">Open</button>
      </div>
    </div>
  );
}

// ─── Dashboard empty state ─────────────────────────────────────────
function DashboardEmpty() {
  return (
    <div className="ink j-grain" style={{ minHeight: "100%", overflow: "hidden", position: "relative" }}>
      <AppNav active="characters" />
      <main style={{ padding: "60px 32px", maxWidth: 720, margin: "0 auto", textAlign: "center", position: "relative" }}>
        <JInkstain width={500} height={340} opacity={0.05} style={{ left: "50%", top: 60, transform: "translateX(-50%)" }} />
        <div style={{ position: "relative" }}>
          <div className="j-folio" style={{ marginBottom: 12 }}>Folio I · A blank notebook</div>
          <h1 className="j-display" style={{ fontSize: 36, color: "var(--ink-fg)", margin: 0 }}>
            Welcome, <em className="j-display-italic" style={{ color: "var(--ink-accent)" }}>Raven</em>.
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-muted-fg)", lineHeight: 1.65, marginTop: 14, marginInline: "auto", maxWidth: 480 }}>
            Your notebook is open. Nothing has been written yet —
            and that's the most exciting part.
          </p>

          <div className="j-card-paper" style={{ padding: 22, marginTop: 32, textAlign: "left" }}>
            <div className="ink-heading" style={{ marginBottom: 12 }}>★ Begin a character — what to expect</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, fontSize: 11.5, color: "var(--ink-muted-fg)" }}>
              {["I · Race", "II · Class", "III · Abilities", "IV · Background", "V · Equipment"].map((s, i) => (
                <div key={s} style={{ padding: "10px 8px", textAlign: "center", border: "1px solid var(--ink-border)", borderRadius: 6, background: i === 0 ? "rgba(201,164,74,0.05)" : "transparent" }}>
                  <div className="j-display" style={{ fontSize: 13, color: i === 0 ? "var(--ink-accent)" : "var(--ink-fg)" }}>{s}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: "var(--ink-muted-fg)", marginTop: 14, marginBottom: 0, fontStyle: "italic" }}>
              Most players finish in 8–12 minutes. You can save and come back.
            </p>
          </div>

          <button className="j-btn-gold j-btn-lg" style={{ marginTop: 24 }}>Begin a character →</button>
        </div>
      </main>
    </div>
  );
}

// ─── Library · system-scoped catalog ───────────────────────────────
function Library() {
  const [system, setSystem] = dUseState("dnd5e");
  const [cat, setCat] = dUseState("classes");
  const [open, setOpen] = dUseState(null); // expanded row id
  const [filters, setFilters] = dUseState({}); // { catId: { groupId: value } }

  const setFilter = (group, value) => {
    setFilters((f) => ({
      ...f,
      [cat]: { ...(f[cat] || {}), [group]: f[cat]?.[group] === value ? null : value },
    }));
  };
  const activeFilters = filters[cat] || {};

  const systems = [
    { id: "dnd5e", label: "D&D 5e", note: "official + homebrew" },
    { id: "pf2e", label: "Pathfinder 2e", note: "placeholder" },
    { id: "coc", label: "Call of Cthulhu", note: "placeholder" },
    { id: "custom", label: "Custom system", note: "your rules" },
  ];

  const cats = {
    dnd5e: [
      { id: "classes", label: "Classes", count: 13 },
      { id: "races", label: "Races", count: 42 },
      { id: "monsters", label: "Monsters", count: 318 },
      { id: "feats", label: "Feats", count: 87 },
      { id: "spells", label: "Spells", count: 514 },
      { id: "items", label: "Items", count: 1206 },
      { id: "backgrounds", label: "Backgrounds", count: 28 },
      { id: "conditions", label: "Conditions", count: 16 },
    ],
    pf2e: [
      { id: "classes", label: "Classes", count: 0 },
      { id: "ancestries", label: "Ancestries", count: 0 },
      { id: "feats", label: "Feats", count: 0 },
    ],
    coc: [
      { id: "occupations", label: "Occupations", count: 0 },
      { id: "skills", label: "Skills", count: 0 },
    ],
    custom: [
      { id: "classes", label: "Classes", count: 0 },
    ],
  };

  // sample classes for the right pane (5e only fleshed out)
  const classRows = [
    { name: "Barbarian", primary: "STR", hd: "d12", tag: "Primal rage", src: "PHB", desc: "A fierce warrior of primal background who can enter a battle rage. Hit points lean d12; high STR/CON; few proficiencies, savage combat output.", features: ["Rage (uses per long rest)", "Reckless Attack at L2", "Danger Sense at L2", "Subclass at L3 — Berserker, Totem, Zealot…"] },
    { name: "Bard", primary: "CHA", hd: "d8", tag: "Jack of all trades", src: "PHB", desc: "A versatile spellcaster who weaves magic through music and words. Full caster, ritual caster, expertise on two skills.", features: ["Spellcasting (CHA)", "Bardic Inspiration (d6 → d12)", "Jack of All Trades at L2", "Subclass at L3 — Lore, Valor, Eloquence…"] },
    { name: "Cleric", primary: "WIS", hd: "d8", tag: "Divine spellcaster", src: "PHB", desc: "A priestly champion who wields divine magic in service of a higher power. Full caster, prepared spells, heavy domain variety.", features: ["Spellcasting (WIS)", "Divine Domain at L1", "Channel Divinity at L2", "Destroy Undead at L5"] },
    { name: "Druid", primary: "WIS", hd: "d8", tag: "Wild shape, nature", src: "PHB", desc: "A priest of the Old Faith. Full caster with the unique ability to transform into beasts.", features: ["Druidic", "Spellcasting (WIS)", "Wild Shape at L2", "Circle at L2 — Land, Moon, Stars…"] },
    { name: "Fighter", primary: "STR/DEX", hd: "d10", tag: "Martial mastery", src: "PHB", desc: "A master of weapons and armor. The most extra attacks of any class; fighting styles and maneuvers.", features: ["Fighting Style at L1", "Second Wind at L1", "Action Surge at L2", "Subclass at L3 — Champion, Battle Master, Eldritch Knight…"] },
    { name: "Monk", primary: "DEX/WIS", hd: "d8", tag: "Ki, unarmed", src: "PHB", desc: "A martial artist channeling inner ki. Unarmored Defense, fast movement, lots of attacks per turn.", features: ["Unarmored Defense", "Martial Arts", "Ki at L2", "Monastic Tradition at L3"] },
    { name: "Paladin", primary: "STR/CHA", hd: "d10", tag: "Oath, smites", src: "PHB", desc: "A holy warrior bound by sacred oaths. Half-caster with smite spells and aura buffs.", features: ["Divine Sense", "Lay on Hands", "Spellcasting (CHA) at L2", "Sacred Oath at L3"] },
    { name: "Ranger", primary: "DEX/WIS", hd: "d10", tag: "Favored foe", src: "PHB", desc: "A wilderness warrior, half-caster, marksman or two-weapon dervish.", features: ["Favored Enemy / Foe", "Natural Explorer", "Spellcasting (WIS) at L2", "Conclave at L3"] },
    { name: "Rogue", primary: "DEX", hd: "d8", tag: "Sneak attack, expertise", src: "PHB", desc: "A skilled scout and assassin. Sneak attack scaling, expertise in two skills, Cunning Action.", features: ["Expertise", "Sneak Attack", "Thieves' Cant", "Cunning Action at L2"] },
    { name: "Sorcerer", primary: "CHA", hd: "d6", tag: "Innate magic, metamagic", src: "PHB", desc: "An innate spellcaster shaping raw magical force with metamagic options.", features: ["Spellcasting (CHA)", "Sorcerous Origin at L1", "Font of Magic at L2", "Metamagic at L3"] },
    { name: "Warlock", primary: "CHA", hd: "d8", tag: "Pact magic, invocations", src: "PHB", desc: "A wielder of magic from a pact with an otherworldly patron. Short-rest spell slots, invocations.", features: ["Otherworldly Patron at L1", "Pact Magic", "Eldritch Invocations at L2", "Pact Boon at L3"] },
    { name: "Wizard", primary: "INT", hd: "d6", tag: "Prepared spellbook", src: "PHB", desc: "A scholar of magic who prepares spells from a personal spellbook. Broadest spell list in the game.", features: ["Spellcasting (INT)", "Arcane Recovery", "Arcane Tradition at L2", "Ritual Casting"] },
    { name: "Witch", primary: "WIS", hd: "d8", tag: "Curses, familiar", src: "Homebrew · Raven", desc: "A custom class focused on curses and a bound familiar. Half-caster; Evil Eye gaze; hexes scale with proficiency.", features: ["Familiar Bond at L1", "Evil Eye at L1 (curse a creature you can see)", "Spellcasting (WIS) at L2", "Coven Pact at L3"] },
  ];

  // Sample spells for filtering demo (subset)
  const spellRows = [
    { name: "Fireball", level: 3, school: "Evocation", classes: "Sorcerer, Wizard", time: "1 action", range: "150 ft", desc: "A bright streak flashes from your pointing finger to a point you choose, then blossoms into an explosion of flame. Each creature in a 20-ft-radius sphere makes a DEX save, taking 8d6 fire damage on a fail, half on success." },
    { name: "Cure Wounds", level: 1, school: "Evocation", classes: "Bard, Cleric, Druid, Paladin, Ranger", time: "1 action", range: "Touch", desc: "A creature you touch regains 1d8 + spellcasting modifier hit points. No effect on undead or constructs." },
    { name: "Shield", level: 1, school: "Abjuration", classes: "Sorcerer, Wizard", time: "1 reaction", range: "Self", desc: "An invisible barrier of magical force appears and protects you. Until the start of your next turn you have +5 AC, including against the triggering attack, and take no damage from magic missile." },
    { name: "Detect Magic", level: 1, school: "Divination", classes: "Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Wizard", time: "1 action (R)", range: "Self", desc: "For the duration, you sense the presence of magic within 30 feet of you. If you sense magic, you can use your action to see a faint aura around any visible creature or object that bears magic." },
    { name: "Eldritch Blast", level: 0, school: "Evocation", classes: "Warlock", time: "1 action", range: "120 ft", desc: "A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack. On a hit, the target takes 1d10 force damage. The spell creates more beams at higher levels." },
    { name: "Counterspell", level: 3, school: "Abjuration", classes: "Sorcerer, Warlock, Wizard", time: "1 reaction", range: "60 ft", desc: "You attempt to interrupt a creature in the process of casting a spell. If the creature is casting a spell of 3rd level or lower, its spell fails and has no effect." },
    { name: "Wish", level: 9, school: "Conjuration", classes: "Sorcerer, Wizard", time: "1 action", range: "Self", desc: "The mightiest spell a mortal creature can cast. By simply speaking aloud, you can alter the very foundations of reality in accord with your desires." },
    { name: "Healing Word", level: 1, school: "Evocation", classes: "Bard, Cleric, Druid", time: "1 bonus action", range: "60 ft", desc: "A creature of your choice that you can see within range regains hit points equal to 1d4 + your spellcasting modifier." },
    { name: "Misty Step", level: 2, school: "Conjuration", classes: "Sorcerer, Warlock, Wizard", time: "1 bonus action", range: "Self", desc: "Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space that you can see." },
    { name: "Mage Hand", level: 0, school: "Conjuration", classes: "Bard, Sorcerer, Warlock, Wizard", time: "1 action", range: "30 ft", desc: "A spectral, floating hand appears at a point you choose within range. Lasts 1 minute; can manipulate objects up to 10 lbs." },
  ];

  // Sample monsters for filtering demo
  const monsterRows = [
    { name: "Goblin", cr: "1/4", type: "Humanoid", size: "Small", env: "Forest, Hill", desc: "Goblins are small, black-hearted humanoids that lair in despoiled dungeons and other dismal settings. Stealthy and cunning in groups; fragile alone. AC 15, HP 7, Speed 30 ft." },
    { name: "Owlbear", cr: "3", type: "Monstrosity", size: "Large", env: "Forest", desc: "A monstrous cross between a giant owl and a bear, with a thick coat of feathers and fur. Aggressive, territorial. AC 13, HP 59, Speed 40 ft. Multiattack: beak + claws." },
    { name: "Beholder", cr: "13", type: "Aberration", size: "Large", env: "Underdark", desc: "A nightmarish floating orb of flesh with a central eye and ten eyestalks, each capable of a different magical ray. Antimagic Cone is a defining terror. AC 18, HP 180." },
    { name: "Ancient Red Dragon", cr: "24", type: "Dragon", size: "Gargantuan", env: "Mountain, Volcanic", desc: "The largest and proudest of the chromatic dragons. Greedy, fearless, hot-tempered. Fire breath in a 90-ft cone for 91 fire damage on a failed save. AC 22, HP 546." },
    { name: "Skeleton", cr: "1/4", type: "Undead", size: "Medium", env: "Tomb, Battlefield", desc: "Animated bones held together by dark magic. Vulnerable to bludgeoning. AC 13, HP 13. Often serve as guardians or shock troops." },
    { name: "Orc", cr: "1/2", type: "Humanoid", size: "Medium", env: "Mountain, Plains", desc: "Savage raiders and pillagers organized into warbands. Aggressive in melee; Aggressive trait grants a free dash toward enemies. AC 13, HP 15." },
    { name: "Mind Flayer", cr: "7", type: "Aberration", size: "Medium", env: "Underdark", desc: "Tentacled humanoid telepaths from the Far Realm. Mind Blast in a 60-ft cone (INT save or stunned). Extract Brain finishes incapacitated foes. AC 15, HP 71." },
    { name: "Tarrasque", cr: "30", type: "Monstrosity", size: "Gargantuan", env: "Anywhere", desc: "The mightiest of monstrosities — a 50-foot-tall horror that legend says erupts every few centuries. Magic Resistance, Reflective Carapace, Siege Monster. AC 25, HP 676." },
    { name: "Kobold", cr: "1/8", type: "Humanoid", size: "Small", env: "Cave, Underdark", desc: "Small reptilian creatures who live by ambush, traps, and sheer numbers. Pack Tactics on attack rolls. AC 12, HP 5." },
    { name: "Lich", cr: "21", type: "Undead", size: "Medium", env: "Anywhere", desc: "An undead spellcaster who has cheated death by transferring its soul to a phylactery. 9th-level spellcaster. AC 17, HP 135. Legendary actions and resistances." },
  ];

  const activeCats = cats[system] || [];
  const empty = (cats[system] || []).every((c) => c.count === 0);

  // Filter groups per category (5e only fleshed out)
  const filterGroups = {
    classes: [
      { id: "primary", label: "Primary ability", options: ["STR", "DEX", "CON", "INT", "WIS", "CHA"] },
      { id: "hd", label: "Hit die", options: ["d6", "d8", "d10", "d12"] },
      { id: "src", label: "Source", options: ["PHB", "Homebrew"] },
    ],
    spells: [
      { id: "level", label: "Level", options: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] },
      { id: "school", label: "School", options: ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"] },
      { id: "time", label: "Casting time", options: ["1 action", "1 bonus action", "1 reaction"] },
    ],
    monsters: [
      { id: "cr", label: "CR", options: ["0–1", "2–4", "5–10", "11–16", "17+"] },
      { id: "type", label: "Type", options: ["Aberration", "Beast", "Construct", "Dragon", "Humanoid", "Monstrosity", "Undead"] },
      { id: "size", label: "Size", options: ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"] },
      { id: "env", label: "Environment", options: ["Forest", "Mountain", "Underdark", "Coastal", "Urban"] },
    ],
    feats: [
      { id: "type", label: "Type", options: ["General", "Origin", "Fighting Style", "Epic Boon"] },
      { id: "prereq", label: "Prerequisite", options: ["None", "Spellcasting", "Ability score"] },
    ],
    items: [
      { id: "rarity", label: "Rarity", options: ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"] },
      { id: "type", label: "Type", options: ["Weapon", "Armor", "Wondrous", "Potion", "Ring", "Rod", "Wand"] },
      { id: "attune", label: "Attunement", options: ["Required", "None"] },
    ],
    races: [
      { id: "size", label: "Size", options: ["Small", "Medium"] },
      { id: "type", label: "Type", options: ["Humanoid", "Fey", "Construct"] },
    ],
  };
  const groups = filterGroups[cat] || [];

  // Apply filters
  const filterRow = (row) => {
    return Object.entries(activeFilters).every(([groupId, value]) => {
      if (!value) return true;
      if (cat === "classes") {
        if (groupId === "primary") return row.primary.includes(value);
        if (groupId === "hd") return row.hd === value;
        if (groupId === "src") return value === "Homebrew" ? row.src.startsWith("Homebrew") : row.src === value;
      }
      if (cat === "spells") {
        if (groupId === "level") return String(row.level) === value;
        if (groupId === "school") return row.school === value;
        if (groupId === "time") return row.time.includes(value);
      }
      if (cat === "monsters") {
        if (groupId === "type") return row.type === value;
        if (groupId === "size") return row.size === value;
        if (groupId === "env") return row.env.includes(value);
        if (groupId === "cr") {
          const n = row.cr.includes("/") ? 0.25 : parseFloat(row.cr);
          if (value === "0–1") return n <= 1;
          if (value === "2–4") return n >= 2 && n <= 4;
          if (value === "5–10") return n >= 5 && n <= 10;
          if (value === "11–16") return n >= 11 && n <= 16;
          if (value === "17+") return n >= 17;
        }
      }
      return true;
    });
  };

  return (
    <div className="ink j-grain" style={{ minHeight: "100%", overflow: "hidden", position: "relative" }}>
      <AppNav active="library" />
      <main style={{ padding: "32px", maxWidth: 1240, margin: "0 auto" }}>
        {/* Page header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
          <div>
            <div className="j-folio" style={{ marginBottom: 8 }}>The Library</div>
            <h1 className="j-display" style={{ fontSize: 34, color: "var(--ink-fg)", margin: 0 }}>
              Compendium &amp; <em className="j-display-italic" style={{ color: "var(--ink-accent)" }}>catalog</em>
            </h1>
            <p style={{ fontSize: 13, color: "var(--ink-muted-fg)", margin: "6px 0 0" }}>
              Browse rules, races, monsters and more — scoped to the system you're playing.
            </p>
          </div>
          <button className="j-btn-quiet j-btn-sm">⌘K · Search the library</button>
        </div>

        {/* System submenu */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, padding: "8px 10px", border: "1px solid var(--ink-border)", borderRadius: 8, background: "var(--ink-paper-2)" }}>
          <span className="ink-eyebrow" style={{ alignSelf: "center", marginRight: 8, paddingLeft: 4 }}>System</span>
          {systems.map((s) => {
            const on = s.id === system;
            return (
              <button key={s.id} onClick={() => setSystem(s.id)} className="j-nav-link" style={{
                padding: "8px 14px", borderRadius: 6, border: "none",
                background: on ? "rgba(201,164,74,0.1)" : "transparent",
                color: on ? "var(--ink-accent)" : "var(--ink-muted-fg)",
                fontWeight: on ? 600 : 500,
                fontSize: 13, cursor: "pointer",
                display: "flex", alignItems: "baseline", gap: 8,
              }}>
                <span>{s.label}</span>
                <span style={{ fontSize: 10.5, color: "var(--ink-muted-fg)", fontStyle: "italic", fontWeight: 400 }}>{s.note}</span>
              </button>
            );
          })}
        </div>

        {/* Two-pane layout */}
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16 }}>
          {/* Catalog rail */}
          <aside className="j-card-paper" style={{ padding: 14 }}>
            <div className="ink-heading" style={{ marginBottom: 10, fontSize: 11 }}>★ Catalog</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {activeCats.map((c) => {
                const on = c.id === cat;
                return (
                  <button key={c.id} onClick={() => setCat(c.id)} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "9px 12px", borderRadius: 6, border: "none",
                    background: on ? "rgba(201,164,74,0.08)" : "transparent",
                    color: on ? "var(--ink-accent)" : "var(--ink-fg)",
                    fontFamily: "inherit", fontSize: 13, cursor: "pointer",
                    borderLeft: on ? "2px solid var(--ink-accent)" : "2px solid transparent",
                  }}>
                    <span>{c.label}</span>
                    <span style={{ fontSize: 11, color: "var(--ink-muted-fg)", fontVariantNumeric: "tabular-nums" }}>{c.count || "—"}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ borderTop: "1px solid var(--ink-border)", marginTop: 14, paddingTop: 14 }}>
              <a className="j-nav-link" style={{ fontSize: 11.5, color: "var(--ink-muted-fg)" }}>Manage sources →</a>
            </div>
          </aside>

          {/* Catalog body */}
          <section className="j-card-paper" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
            <JInkstain width={400} height={260} opacity={0.04} style={{ right: -100, top: -50 }} />

            {empty ? (
              <div style={{ padding: "60px 32px", textAlign: "center", position: "relative" }}>
                <div className="j-folio" style={{ marginBottom: 10 }}>Placeholder</div>
                <h3 className="j-display" style={{ fontSize: 22, color: "var(--ink-fg)", margin: 0, marginBottom: 8 }}>
                  <em className="j-display-italic" style={{ color: "var(--ink-accent)" }}>{(systems.find(s => s.id === system) || {}).label}</em> catalog — coming soon
                </h3>
                <p style={{ fontSize: 13, color: "var(--ink-muted-fg)", maxWidth: 440, margin: "0 auto" }}>
                  System-specific catalogs will replace this view. Categories and contents will change per system.
                </p>
              </div>
            ) : (
              <>
                {/* Toolbar */}
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--ink-border)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <h2 className="j-display" style={{ fontSize: 22, color: "var(--ink-fg)", margin: 0 }}>
                      {(activeCats.find(c => c.id === cat) || {}).label || "Classes"}
                    </h2>
                    <span style={{ fontSize: 12, color: "var(--ink-muted-fg)", fontStyle: "italic" }}>
                      {(activeCats.find(c => c.id === cat) || {}).count || 0} entries
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <input placeholder="Filter…" style={{
                      padding: "6px 12px", border: "1px solid var(--ink-border)", borderRadius: 4,
                      background: "var(--ink-paper)", color: "var(--ink-fg)", fontSize: 12, minWidth: 180,
                      fontFamily: "inherit",
                    }} />
                    <span style={{ fontSize: 11, color: "var(--ink-muted-fg)" }}>Sort: A–Z ▾</span>
                  </div>
                </div>

                {/* Filter chips per category */}
                {groups.length > 0 && (
                  <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--ink-border)", background: "var(--ink-paper-2)", display: "flex", flexDirection: "column", gap: 8 }}>
                    {groups.map((g) => (
                      <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span className="ink-eyebrow" style={{ fontSize: 10, minWidth: 110 }}>{g.label}</span>
                        {g.options.map((opt) => {
                          const on = activeFilters[g.id] === opt;
                          return (
                            <button key={opt} onClick={() => setFilter(g.id, opt)} style={{
                              padding: "3px 10px", borderRadius: 999, fontSize: 11,
                              border: `1px solid ${on ? "var(--ink-accent)" : "var(--ink-border)"}`,
                              background: on ? "rgba(201,164,74,0.12)" : "transparent",
                              color: on ? "var(--ink-accent)" : "var(--ink-muted-fg)",
                              cursor: "pointer", fontFamily: "inherit",
                            }}>{opt}</button>
                          );
                        })}
                      </div>
                    ))}
                    {Object.values(activeFilters).some(Boolean) && (
                      <a onClick={() => setFilters((f) => ({ ...f, [cat]: {} }))} className="j-nav-link" style={{ fontSize: 11, color: "var(--ink-muted-fg)", fontStyle: "italic", cursor: "pointer", marginTop: 2 }}>Clear filters</a>
                    )}
                  </div>
                )}

                {/* Body */}
                {system === "dnd5e" && cat === "classes" && (
                  <ExpandableList
                    rows={classRows.filter(filterRow)}
                    open={open} setOpen={setOpen}
                    keyOf={(r) => r.name}
                    renderRow={(r) => {
                      const isHB = r.src.startsWith("Homebrew");
                      return {
                        glyphTone: isHB ? "purple" : "gold",
                        title: r.name,
                        sub: `${r.primary} · ${r.hd} · ${r.tag}`,
                        meta: r.src,
                      };
                    }}
                    renderDetail={(r) => (
                      <>
                        <p style={{ fontSize: 13, color: "var(--ink-fg)", lineHeight: 1.6, margin: "0 0 12px" }}>{r.desc}</p>
                        <div className="ink-eyebrow" style={{ marginBottom: 8 }}>★ Class features</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--ink-muted-fg)", lineHeight: 1.7 }}>
                          {r.features.map((f) => <li key={f}>{f}</li>)}
                        </ul>
                      </>
                    )}
                  />
                )}

                {system === "dnd5e" && cat === "spells" && (
                  <ExpandableList
                    rows={spellRows.filter(filterRow)}
                    open={open} setOpen={setOpen}
                    keyOf={(r) => r.name}
                    renderRow={(r) => ({
                      glyphTone: "gold",
                      title: r.name,
                      sub: `${r.level === 0 ? "Cantrip" : `Lvl ${r.level}`} · ${r.school} · ${r.classes}`,
                      meta: r.time,
                    })}
                    renderDetail={(r) => (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12, fontSize: 11.5 }}>
                          <KV label="Casting time" value={r.time} />
                          <KV label="Range" value={r.range} />
                          <KV label="School" value={r.school} />
                        </div>
                        <p style={{ fontSize: 13, color: "var(--ink-fg)", lineHeight: 1.6, margin: 0 }}>{r.desc}</p>
                      </>
                    )}
                  />
                )}

                {system === "dnd5e" && cat === "monsters" && (
                  <ExpandableList
                    rows={monsterRows.filter(filterRow)}
                    open={open} setOpen={setOpen}
                    keyOf={(r) => r.name}
                    renderRow={(r) => ({
                      glyphTone: "purple",
                      title: r.name,
                      sub: `CR ${r.cr} · ${r.size} ${r.type} · ${r.env}`,
                      meta: `CR ${r.cr}`,
                    })}
                    renderDetail={(r) => (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12, fontSize: 11.5 }}>
                          <KV label="Challenge" value={`CR ${r.cr}`} />
                          <KV label="Type" value={r.type} />
                          <KV label="Size" value={r.size} />
                          <KV label="Environment" value={r.env} />
                        </div>
                        <p style={{ fontSize: 13, color: "var(--ink-fg)", lineHeight: 1.6, margin: 0 }}>{r.desc}</p>
                      </>
                    )}
                  />
                )}

                {system === "dnd5e" && !["classes", "spells", "monsters"].includes(cat) && (
                  <div style={{ padding: "40px 20px", textAlign: "center" }}>
                    <p style={{ fontSize: 12.5, color: "var(--ink-muted-fg)", fontStyle: "italic", margin: 0 }}>
                      {(activeCats.find(c => c.id === cat) || {}).label} catalog — same expandable + filter pattern as Classes / Spells / Monsters.
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { DashboardA, DashboardB, DashboardC, DashboardEmpty, Library, AppNav });

function KV({ label, value }) {
  return (
    <div style={{ borderLeft: "2px solid var(--ink-border)", paddingLeft: 10 }}>
      <div className="ink-eyebrow" style={{ fontSize: 9.5, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: "var(--ink-fg)" }}>{value}</div>
    </div>
  );
}

function ExpandableList({ rows, open, setOpen, keyOf, renderRow, renderDetail }) {
  if (!rows.length) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 12.5, color: "var(--ink-muted-fg)", fontStyle: "italic", margin: 0 }}>
          No entries match the current filters.
        </p>
      </div>
    );
  }
  return (
    <div>
      {rows.map((r, i) => {
        const k = keyOf(r);
        const view = renderRow(r);
        const isOpen = open === k;
        const isPurple = view.glyphTone === "purple";
        return (
          <div key={k} style={{ borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--ink-border)" }}>
            <button
              onClick={() => setOpen(isOpen ? null : k)}
              style={{
                width: "100%", textAlign: "left", border: "none", background: isOpen ? "var(--ink-paper-2)" : "transparent",
                cursor: "pointer", fontFamily: "inherit",
                display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 16, alignItems: "center",
                padding: "14px 20px",
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 6,
                background: isPurple ? "rgba(124,58,237,0.14)" : "rgba(201,164,74,0.08)",
                border: `1px solid ${isPurple ? "rgba(124,58,237,0.4)" : "rgba(201,164,74,0.3)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--ink-display)", fontStyle: "italic",
                fontSize: 16, color: isPurple ? "rgba(167,139,250,0.95)" : "var(--ink-accent)",
              }}>{view.title.charAt(0)}</div>
              <div>
                <div className="j-display" style={{ fontSize: 16, color: "var(--ink-fg)" }}>{view.title}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-muted-fg)", marginTop: 2 }}>{view.sub}</div>
              </div>
              <span style={{ fontSize: 10.5, color: "var(--ink-muted-fg)", fontStyle: "italic", letterSpacing: "0.03em" }}>{view.meta}</span>
              <span style={{ fontSize: 14, color: "var(--ink-muted-fg)", transition: "transform 150ms", transform: isOpen ? "rotate(90deg)" : "none" }}>›</span>
            </button>
            {isOpen && (
              <div style={{ padding: "16px 20px 22px 72px", borderTop: "1px solid var(--ink-border)", background: "var(--ink-paper-2)" }}>
                {renderDetail(r)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
