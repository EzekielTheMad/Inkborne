/* global React */
// Multiclass exploration on Variant C (sidebar-by-level).
// Demo build: Paladin 6 / Sorcerer 3 — classic sorcadin.

window.INKBORNE_MC = (() => {
  const paladinLevels = [
    { level: 1, features: [
      { slug: "divine-sense", name: "Divine Sense", kind: "passive",
        description: "As an action, detect good and evil within 60 ft. Uses = 1 + CHA mod per long rest." },
      { slug: "lay-on-hands", name: "Lay on Hands", kind: "passive",
        description: "A pool of healing equal to paladin level × 5. Spend as an action to restore hit points or cure disease/poison." },
    ]},
    { level: 2, features: [
      { slug: "fighting-style-pal", name: "Fighting Style", kind: "choice",
        description: "Adopt a particular style of fighting as your specialty.",
        options: [
          { slug: "defense", name: "Defense", desc: "+1 AC while wearing armor." },
          { slug: "dueling", name: "Dueling", desc: "+2 damage with a one-handed weapon." },
          { slug: "great-weapon", name: "Great Weapon Fighting", desc: "Reroll 1s and 2s on two-handed damage." },
          { slug: "protection", name: "Protection", desc: "Impose disadvantage on an attack within 5 ft." },
        ],
        selected: "dueling",
      },
      { slug: "spellcasting-pal", name: "Spellcasting", kind: "passive",
        description: "You can prepare and cast paladin spells using Charisma." },
      { slug: "divine-smite", name: "Divine Smite", kind: "passive",
        description: "When you hit with a melee weapon attack, expend a spell slot to deal an extra 2d8 radiant damage." },
    ]},
    { level: 3, features: [
      { slug: "divine-health", name: "Divine Health", kind: "passive",
        description: "You are immune to disease." },
      { slug: "sacred-oath", name: "Sacred Oath", kind: "subclass-unlock",
        description: "Choose the oath that drives you as a paladin." },
      { slug: "channel-divinity", name: "Channel Divinity", kind: "subclass", subclass: "oath-of-devotion",
        description: "Two options: Sacred Weapon (add CHA to attack rolls, weapon sheds light) and Turn the Unholy." },
    ]},
    { level: 4, features: [
      { slug: "asi-pal-4", name: "Ability Score Improvement", kind: "asi",
        description: "Increase one ability score by 2, or two by 1. You can instead take a feat." },
    ]},
    { level: 5, features: [
      { slug: "extra-attack-pal", name: "Extra Attack", kind: "passive",
        description: "You can attack twice, instead of once, whenever you take the Attack action." },
    ]},
    { level: 6, features: [
      { slug: "aura-of-protection", name: "Aura of Protection", kind: "passive",
        description: "Whenever you or a friendly creature within 10 ft. must make a saving throw, the creature gains a bonus equal to your CHA modifier." },
    ]},
  ];

  const sorcererLevels = [
    { level: 1, features: [
      { slug: "spellcasting-sor", name: "Spellcasting", kind: "passive",
        description: "Cast sorcerer spells using Charisma. Learn cantrips and known spells." },
      { slug: "sorcerous-origin", name: "Sorcerous Origin", kind: "subclass-unlock",
        description: "Choose the source of your innate magical power." },
      { slug: "draconic-resilience", name: "Draconic Resilience", kind: "subclass", subclass: "draconic-bloodline",
        description: "Your hit point maximum increases by 1 and by 1 again every sorcerer level. AC = 13 + DEX when unarmored." },
    ]},
    { level: 2, features: [
      { slug: "font-of-magic", name: "Font of Magic", kind: "passive",
        description: "Gain sorcery points equal to your sorcerer level. Convert points ↔ spell slots as a bonus action." },
    ]},
    { level: 3, features: [
      { slug: "metamagic", name: "Metamagic", kind: "choice",
        description: "Twist spells to suit your needs. Learn 2 metamagic options.",
        options: [
          { slug: "twinned", name: "Twinned Spell", desc: "Target a second creature with a single-target spell." },
          { slug: "quickened", name: "Quickened Spell", desc: "Cast a 1-action spell as a bonus action." },
          { slug: "subtle", name: "Subtle Spell", desc: "Cast without verbal or somatic components." },
          { slug: "distant", name: "Distant Spell", desc: "Double range, or touch = 30 ft." },
          { slug: "heightened", name: "Heightened Spell", desc: "Target rolls first save with disadvantage." },
          { slug: "empowered", name: "Empowered Spell", desc: "Reroll up to CHA damage dice." },
        ],
        selected: "twinned",
        choose: 2,
      },
    ]},
  ];

  return { paladinLevels, sorcererLevels };
})();

// ── Small helpers ──────────────────────────────────────────────
function ClassBadge({ letter, tone = "gold", size = 18 }) {
  const gold = tone === "gold";
  return (
    <span style={{
      width: size, height: size, borderRadius: 4,
      background: gold ? "rgba(201,164,74,0.15)" : "rgba(124,58,237,0.18)",
      border: `1px solid ${gold ? "rgba(201,164,74,0.5)" : "rgba(124,58,237,0.55)"}`,
      color: gold ? "var(--ink-accent)" : "#b594ff",
      fontFamily: "Georgia, serif", fontWeight: 700,
      fontSize: size <= 18 ? 10 : 12,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>{letter}</span>
  );
}

function LevelDropdown({ level, max, tone, onChange }) {
  // max clamps to whatever the 20-total budget allows for THIS class
  const options = Array.from({ length: max }, (_, i) => i + 1);
  const gold = tone === "gold";
  return (
    <div style={{ position: "relative" }}>
      <select
        value={level}
        onChange={(e) => onChange && onChange(Number(e.target.value))}
        title="Set class level"
        style={{
          appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
          padding: "4px 22px 4px 10px",
          fontSize: 11.5, fontWeight: 600,
          background: gold ? "rgba(201,164,74,0.12)" : "rgba(124,58,237,0.14)",
          color: gold ? "var(--ink-accent)" : "#b594ff",
          border: `1px solid ${gold ? "rgba(201,164,74,0.4)" : "rgba(124,58,237,0.45)"}`,
          borderRadius: 5, cursor: "pointer",
          fontFamily: "inherit",
        }}>
        {options.map((n) => <option key={n} value={n} style={{ background: "#13111d", color: "var(--ink-fg)" }}>Lv {n}</option>)}
      </select>
      <span style={{
        position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
        pointerEvents: "none",
        color: gold ? "var(--ink-accent)" : "#b594ff",
        display: "inline-flex",
      }}>
      <Icon d={IX.chevDown} size={10} />
      </span>
    </div>
  );
}

function RailSectionHead({ letter, tone, title, subtitle, level, maxLevel, collapsed, onToggle, onLevelChange }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      borderRadius: 7,
      border: "1px solid var(--ink-border)",
      background: "rgba(255,255,255,0.025)",
      padding: "6px 8px 6px 10px",
    }}>
      <button onClick={onToggle} style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        border: "none", background: "transparent",
        cursor: "pointer", textAlign: "left", color: "inherit", padding: 0,
        minWidth: 0, flex: 1,
      }}>
        <ClassBadge letter={letter} tone={tone} size={22} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: 10.5, color: "var(--ink-muted-fg)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>
        </div>
        <Icon d={collapsed ? IX.chevRight : IX.chevDown} size={13} />
      </button>
      <LevelDropdown level={level} max={maxLevel} tone={tone} onChange={onLevelChange} />
    </div>
  );
}

function LevelPill({ n, label, active, choice, onClick, classLetter, classTone, showEmblem }) {
  return (
    <button className="ink-level-pill" data-active={active} data-choice={choice || undefined} onClick={onClick}>
      <span className="lvlnum">{n}</span>
      {showEmblem && <ClassBadge letter={classLetter} tone={classTone} size={16} />}
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
        {label}
      </span>
      {choice && <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--ink-accent)" }} />}
    </button>
  );
}

function CharacterSummaryPanel() {
  // Pressure-test: Paladin 6 / Sorcerer 3 = character L9
  // Multiclass spell slots: Paladin adds half level, Sorcerer adds full
  // Slot level: 6/2 + 3 = 6. Table at "caster level 6" → 4/3/3 slots.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div className="ink-eyebrow" style={{ marginBottom: 8 }}>Build</div>
        <div style={{
          border: "1px solid var(--ink-border)", borderRadius: 10,
          background: "rgba(255,255,255,0.015)", padding: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ClassBadge letter="P" tone="gold" size={28} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-accent)" }}>Paladin</div>
                <div style={{ fontSize: 11, color: "var(--ink-muted-fg)" }}>Oath of Devotion · Lv 6</div>
              </div>
            </div>
            <div style={{ width: 1, height: 36, background: "var(--ink-border)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ClassBadge letter="S" tone="purple" size={28} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-accent)" }}>Sorcerer</div>
                <div style={{ fontSize: 11, color: "var(--ink-muted-fg)" }}>Draconic Bloodline · Lv 3</div>
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ textAlign: "right" }}>
              <div className="ink-eyebrow" style={{ fontSize: 9 }}>Character Level</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: "var(--ink-fg)" }}>9</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="ink-eyebrow" style={{ marginBottom: 8 }}>Merged Spell Slots</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {[
            { l: "1st", v: 4 },
            { l: "2nd", v: 3 },
            { l: "3rd", v: 3 },
            { l: "4th", v: 0 },
            { l: "5th", v: 0 },
          ].map((s) => (
            <div key={s.l} className="ink-card-inset" style={{ padding: "10px 12px", textAlign: "center", opacity: s.v === 0 ? 0.4 : 1 }}>
              <div className="ink-eyebrow" style={{ fontSize: 9 }}>{s.l}</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: "var(--ink-fg)" }}>{s.v}</div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 8, fontSize: 11, color: "var(--ink-muted-fg)", lineHeight: 1.5 }}>
          Slots use the multiclass spellcaster table: Paladin 6 (half) + Sorcerer 3 (full) = effective caster 6.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div className="ink-card-inset" style={{ padding: "10px 12px" }}>
          <div className="ink-eyebrow" style={{ fontSize: 9 }}>Prof. Bonus</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink-fg)", marginTop: 2 }}>+4</div>
        </div>
        <div className="ink-card-inset" style={{ padding: "10px 12px" }}>
          <div className="ink-eyebrow" style={{ fontSize: 9 }}>ASIs taken</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink-fg)", marginTop: 2 }}>1 of 1</div>
        </div>
        <div className="ink-card-inset" style={{ padding: "10px 12px" }}>
          <div className="ink-eyebrow" style={{ fontSize: 9 }}>Sorcery Pts</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink-accent)", marginTop: 2 }}>3</div>
        </div>
      </div>

      <div className="ink-feat ink-feat-choice">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span className="ink-badge ink-badge-choice">Choice</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-accent)" }}>Multiclass Proficiencies</span>
        </div>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--ink-muted-fg)", lineHeight: 1.55 }}>
          When adding Sorcerer to an existing class, you gain reduced proficiencies: no new armor, no new weapons. Your second class only grants a subset.
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span className="ink-badge ink-badge-outline">+ Daggers (from Sor.)</span>
          <span className="ink-badge ink-badge-outline">No new armor prof.</span>
          <span className="ink-badge ink-badge-outline">No new save prof.</span>
        </div>
      </div>
    </div>
  );
}

// Common right-pane renderer for a class-level
function ClassLevelPane({ className, classLetter, classTone, levels, focusLevel, subclassName, subclassEmblem, subclassPurple }) {
  const lvl = levels.find((l) => l.level === focusLevel);
  if (!lvl) return null;
  const ord = (n) => n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-muted-fg)", marginBottom: 8 }}>
        <ClassBadge letter={classLetter} tone={classTone} size={14} />
        <span>{className}</span>
        <Icon d={IX.chevRight} size={10} />
        <span>Level {focusLevel}</span>
      </div>
      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: "var(--ink-accent)", letterSpacing: "-0.01em" }}>
        {className} · {ord(focusLevel)} Level
      </h2>

      {/* Subclass banner when it's this class's unlock level */}
      {lvl.features.some((f) => f.kind === "subclass-unlock") && (
        <div style={{
          marginTop: 14,
          border: `1px solid ${subclassPurple ? "rgba(124,58,237,0.45)" : "rgba(201,164,74,0.45)"}`,
          background: subclassPurple
            ? "linear-gradient(180deg, rgba(124,58,237,0.1) 0%, rgba(124,58,237,0.02) 100%)"
            : "linear-gradient(180deg, rgba(201,164,74,0.08) 0%, rgba(201,164,74,0.015) 100%)",
          borderRadius: 10, padding: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Emblem letter={subclassEmblem} variant={subclassPurple ? "purple" : "gold"} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: subclassPurple ? "#b594ff" : "var(--ink-accent)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
                {className === "Paladin" ? "Sacred Oath" : "Sorcerous Origin"}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-accent)" }}>{subclassName}</div>
              <div style={{ fontSize: 12, color: "var(--ink-muted-fg)", marginTop: 2 }}>
                {className === "Paladin" ? "Features at 3, 7, 15, 20" : "Features at 1, 6, 14, 18"}
              </div>
            </div>
            <select className="ink-select" style={{ width: 200 }} defaultValue={subclassName.toLowerCase().replace(/ /g, "-")}>
              {className === "Paladin" ? (
                <>
                  <option value="oath-of-devotion">Oath of Devotion</option>
                  <option value="oath-of-the-ancients">Oath of the Ancients</option>
                  <option value="oath-of-vengeance">Oath of Vengeance</option>
                </>
              ) : (
                <>
                  <option value="draconic-bloodline">Draconic Bloodline</option>
                  <option value="wild-magic">Wild Magic</option>
                </>
              )}
            </select>
          </div>
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {lvl.features.map((f) => {
          if (f.kind === "asi") return <ASIControl key={f.slug} id={f.slug} allocations={{ str: 2 }} onChange={() => {}} />;
          if (f.kind === "subclass-unlock") return null;
          return (
            <FeatureCard key={f.slug}
              name={f.name}
              description={f.description}
              choice={f.kind === "choice"}
              subclassFeature={f.kind === "subclass"}
              choiceLabel={f.slug.startsWith("fighting-style") ? "Choose a Fighting Style" : f.slug === "metamagic" ? "Choose 2 Metamagic" : undefined}
              options={f.options}
              selected={f.selected}
              collapsed={false}
            />
          );
        })}
      </div>
    </div>
  );
}

function AddClassRow({ onClick }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 8,
      padding: "10px 12px", marginTop: 6,
      borderRadius: 7,
      border: "1px dashed rgba(201,164,74,0.35)",
      background: "transparent", color: "var(--ink-accent)",
      fontSize: 12, fontWeight: 500, cursor: "pointer",
      textAlign: "left",
    }}>
      <Icon d={IX.plus} size={14} />
      Add a class
      <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-muted-fg)" }}>Multiclass</span>
    </button>
  );
}

// List of eligible multiclass entries with prereqs (2014 rules)
const MULTICLASS_PREREQS = [
  { slug: "barbarian", name: "Barbarian", hit: "d12", prereq: "STR 13", met: false, current: { str: 10, dex: 14, con: 16, int: 11, wis: 12, cha: 12 } },
  { slug: "bard", name: "Bard", hit: "d8", prereq: "CHA 13", met: false },
  { slug: "cleric", name: "Cleric", hit: "d8", prereq: "WIS 13", met: false },
  { slug: "druid", name: "Druid", hit: "d8", prereq: "WIS 13", met: false },
  { slug: "fighter", name: "Fighter", hit: "d10", prereq: "STR 13 or DEX 13", met: true },
  { slug: "monk", name: "Monk", hit: "d8", prereq: "DEX 13 and WIS 13", met: false },
  { slug: "paladin", name: "Paladin", hit: "d10", prereq: "STR 13 and CHA 13", met: false, current: "already in build" },
  { slug: "ranger", name: "Ranger", hit: "d10", prereq: "DEX 13 and WIS 13", met: false },
  { slug: "rogue", name: "Rogue", hit: "d8", prereq: "DEX 13", met: true },
  { slug: "sorcerer", name: "Sorcerer", hit: "d6", prereq: "CHA 13", met: false, current: "already in build" },
  { slug: "warlock", name: "Warlock", hit: "d8", prereq: "CHA 13", met: false },
  { slug: "wizard", name: "Wizard", hit: "d8", prereq: "INT 13", met: false },
];

function ClassPickerPanel({ onClose, currentClasses = [], budget = 20, used = 0 }) {
  const remaining = budget - used;
  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
        <div>
          <div className="ink-eyebrow" style={{ marginBottom: 4 }}>Multiclass</div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--ink-accent)", letterSpacing: "-0.01em" }}>
            Add another class
          </h2>
        </div>
        <button onClick={onClose} className="ink-btn ink-btn-ghost ink-btn-sm">
          <Icon d={IX.close} size={12} /> Close
        </button>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--ink-muted-fg)", lineHeight: 1.5 }}>
        Each class has ability-score prerequisites. Classes that aren't met are shown for reference but can't be selected.
        <span style={{ marginLeft: 6, color: "var(--ink-fg)" }}>Character budget: {used}/{budget} (remaining {remaining}).</span>
      </p>

      {/* Current ability scores strip (so the gating is explainable in context) */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6,
        marginBottom: 14, padding: "8px 10px",
        border: "1px solid var(--ink-border)", borderRadius: 8,
        background: "rgba(255,255,255,0.02)",
      }}>
        {[
          { l: "STR", v: 10 }, { l: "DEX", v: 14 }, { l: "CON", v: 16 },
          { l: "INT", v: 11 }, { l: "WIS", v: 12 }, { l: "CHA", v: 12 },
        ].map((a) => (
          <div key={a.l} style={{ textAlign: "center" }}>
            <div className="ink-eyebrow" style={{ fontSize: 9 }}>{a.l}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: a.v < 13 ? "#f87171" : "var(--ink-fg)", fontVariantNumeric: "tabular-nums" }}>{a.v}</div>
          </div>
        ))}
      </div>

      <div style={{
        border: "1px solid var(--ink-border)", borderRadius: 8,
        overflow: "hidden",
      }}>
        {MULTICLASS_PREREQS.map((c, i) => {
          const inBuild = c.current === "already in build";
          const disabled = !c.met || inBuild || remaining < 1;
          const reason = inBuild
            ? "Already in this build"
            : !c.met
              ? `Prereq not met (need ${c.prereq})`
              : remaining < 1
                ? "No levels remaining (20 cap)"
                : null;
          return (
            <div key={c.slug} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 14px",
              borderTop: i === 0 ? "none" : "1px solid var(--ink-border)",
              background: disabled ? "transparent" : "rgba(201,164,74,0.03)",
              opacity: disabled ? 0.55 : 1,
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: 6,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--ink-border)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 13,
                color: disabled ? "var(--ink-muted-fg)" : "var(--ink-accent)",
                flexShrink: 0,
              }}>{c.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: disabled ? "var(--ink-muted-fg)" : "var(--ink-fg)" }}>
                  {c.name}
                  <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 500, color: "var(--ink-muted-fg)" }}>
                    Hit Die {c.hit}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, marginTop: 2, display: "flex", alignItems: "center", gap: 6, color: "var(--ink-muted-fg)" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "1px 6px", borderRadius: 4,
                    background: c.met ? "rgba(34,197,94,0.12)" : "rgba(220,38,38,0.1)",
                    color: c.met ? "#86efac" : "#f87171",
                    border: `1px solid ${c.met ? "rgba(34,197,94,0.3)" : "rgba(220,38,38,0.3)"}`,
                    fontSize: 10, fontWeight: 600,
                  }}>
                    <Icon d={c.met ? IX.check : IX.lock} size={9} />
                    {c.prereq}
                  </span>
                  {reason && <span>· {reason}</span>}
                </div>
              </div>
              <button
                disabled={disabled}
                className={"ink-btn " + (disabled ? "ink-btn-outline" : "ink-btn-primary") + " ink-btn-sm"}
                style={disabled ? { cursor: "not-allowed" } : undefined}>
                {inBuild ? "In build" : "Add"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Variant C1 — Grouped by class (recommended)
// ═══════════════════════════════════════════════════════════════
function ClassStepC_MC_Grouped() {
  const [focus, setFocus] = React.useState({ cls: "paladin", level: 6 });
  const [palOpen, setPalOpen] = React.useState(true);
  const [sorOpen, setSorOpen] = React.useState(true);
  const [showChar, setShowChar] = React.useState(false);
  const [showPicker, setShowPicker] = React.useState(false);

  // Levels per class (mutable in this demo)
  const [palLevel, setPalLevel] = React.useState(6);
  const [sorLevel, setSorLevel] = React.useState(3);
  const BUDGET = 20;
  const used = palLevel + sorLevel;
  const remaining = BUDGET - used;

  const paladinLevels = window.INKBORNE_MC.paladinLevels;
  const sorcererLevels = window.INKBORNE_MC.sorcererLevels;

  const palChoice = new Set([2, 3, 4]); // choice levels
  const sorChoice = new Set([1, 3]);

  function renderMain() {
    if (showPicker) {
      return (
        <ClassPickerPanel
          onClose={() => setShowPicker(false)}
          used={used}
          budget={BUDGET} />
      );
    }
    if (showChar) {
      return (
        <div style={{ maxWidth: 760 }}>
          <div style={{ fontSize: 11, color: "var(--ink-muted-fg)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
            Character
          </div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: "var(--ink-accent)", letterSpacing: "-0.01em" }}>
            Cross-class Summary
          </h2>
          <p style={{ margin: "4px 0 18px", fontSize: 13, color: "var(--ink-muted-fg)" }}>
            Aggregated numbers that don't belong to a single class: merged spell slots, proficiency bonus, ASI budget, and multiclass proficiencies.
          </p>
          <CharacterSummaryPanel />
        </div>
      );
    }
    if (focus.cls === "paladin") {
      return (
        <ClassLevelPane
          className="Paladin" classLetter="P" classTone="gold"
          levels={paladinLevels} focusLevel={focus.level}
          subclassName="Oath of Devotion" subclassEmblem="D" subclassPurple={false}
        />
      );
    }
    return (
      <ClassLevelPane
        className="Sorcerer" classLetter="S" classTone="purple"
        levels={sorcererLevels} focusLevel={focus.level}
        subclassName="Draconic Bloodline" subclassEmblem="Dr" subclassPurple={true}
      />
    );
  }

  return (
    <Frame>
      <ClassStepHeader />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Rail */}
        <div style={{
          width: 236, flexShrink: 0,
          borderRight: "1px solid var(--ink-border)",
          display: "flex", flexDirection: "column",
        }}>
          <div className="ink-scroll" style={{ flex: 1, padding: "16px 12px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
            {/* Character section */}
            <button onClick={() => setShowChar(true)} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 10px", borderRadius: 7,
              border: `1px solid ${showChar ? "rgba(201,164,74,0.45)" : "var(--ink-border)"}`,
              background: showChar ? "rgba(201,164,74,0.08)" : "rgba(255,255,255,0.015)",
              cursor: "pointer", textAlign: "left", color: "inherit",
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 5,
                background: "rgba(201,164,74,0.15)", color: "var(--ink-accent)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Icon d={IX.star} size={11} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>Character</div>
                <div style={{ fontSize: 10.5, color: "var(--ink-muted-fg)", marginTop: 1 }}>
                  Lv {used}/{BUDGET} · merged slots · +{Math.ceil(used / 4) + 1} prof
                </div>
              </div>
            </button>

            <div style={{ height: 8 }} />
            <div className="ink-eyebrow" style={{ padding: "0 4px 4px", display: "flex", justifyContent: "space-between" }}>
              <span>Classes</span>
              <span style={{ color: "var(--ink-muted-fg)", fontWeight: 500, letterSpacing: 0, textTransform: "none" }}>2</span>
            </div>

            {/* Paladin group */}
            <RailSectionHead letter="P" tone="gold" title="Paladin" subtitle="Oath of Devotion"
              level={palLevel} maxLevel={Math.min(20, palLevel + remaining)}
              collapsed={!palOpen}
              onToggle={() => setPalOpen(!palOpen)}
              onLevelChange={(n) => {
                const clamped = Math.min(n, palLevel + remaining);
                setPalLevel(clamped);
                setPalOpen(true);
                setShowChar(false); setShowPicker(false);
                setFocus({ cls: "paladin", level: Math.min(focus.cls === "paladin" ? focus.level : clamped, clamped) });
              }} />
            {palOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 1, paddingLeft: 6 }}>
                {paladinLevels.filter((l) => l.level <= palLevel).map((l) => (
                  <LevelPill key={l.level} n={l.level}
                    label={l.features.filter((f) => f.kind !== "subclass-unlock").map((f) => f.name.replace("Ability Score Improvement", "ASI")).slice(0, 1).join(", ") || "—"}
                    active={!showChar && !showPicker && focus.cls === "paladin" && focus.level === l.level}
                    choice={palChoice.has(l.level)}
                    onClick={() => { setShowChar(false); setShowPicker(false); setFocus({ cls: "paladin", level: l.level }); }} />
                ))}
              </div>
            )}

            <div style={{ height: 6 }} />
            {/* Sorcerer group */}
            <RailSectionHead letter="S" tone="purple" title="Sorcerer" subtitle="Draconic Bloodline"
              level={sorLevel} maxLevel={Math.min(20, sorLevel + remaining)}
              collapsed={!sorOpen}
              onToggle={() => setSorOpen(!sorOpen)}
              onLevelChange={(n) => {
                const clamped = Math.min(n, sorLevel + remaining);
                setSorLevel(clamped);
                setSorOpen(true);
                setShowChar(false); setShowPicker(false);
                setFocus({ cls: "sorcerer", level: Math.min(focus.cls === "sorcerer" ? focus.level : clamped, clamped) });
              }} />
            {sorOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 1, paddingLeft: 6 }}>
                {sorcererLevels.filter((l) => l.level <= sorLevel).map((l) => (
                  <LevelPill key={l.level} n={l.level}
                    label={l.features.filter((f) => f.kind !== "subclass-unlock").map((f) => f.name).slice(0, 1).join(", ") || "—"}
                    active={!showChar && !showPicker && focus.cls === "sorcerer" && focus.level === l.level}
                    choice={sorChoice.has(l.level)}
                    onClick={() => { setShowChar(false); setShowPicker(false); setFocus({ cls: "sorcerer", level: l.level }); }} />
                ))}
              </div>
            )}

            <AddClassRow onClick={() => { setShowPicker(true); setShowChar(false); }} />
          </div>
        </div>

        <div className="ink-scroll" style={{ flex: 1, padding: "24px 28px" }}>
          {renderMain()}
        </div>
      </div>
    </Frame>
  );
}

// ═══════════════════════════════════════════════════════════════
// Variant C2 — Unified character-level rail
// ═══════════════════════════════════════════════════════════════
function ClassStepC_MC_Unified() {
  // Order as taken: P1, P2, P3, P4, P5, P6, S1, S2, S3
  const sequence = [
    { cls: "paladin", level: 1, letter: "P", tone: "gold" },
    { cls: "paladin", level: 2, letter: "P", tone: "gold" },
    { cls: "paladin", level: 3, letter: "P", tone: "gold" },
    { cls: "paladin", level: 4, letter: "P", tone: "gold" },
    { cls: "paladin", level: 5, letter: "P", tone: "gold" },
    { cls: "paladin", level: 6, letter: "P", tone: "gold" },
    { cls: "sorcerer", level: 1, letter: "S", tone: "purple" },
    { cls: "sorcerer", level: 2, letter: "S", tone: "purple" },
    { cls: "sorcerer", level: 3, letter: "S", tone: "purple" },
  ];

  const [focusIdx, setFocusIdx] = React.useState(6); // Sorcerer 1
  const [showChar, setShowChar] = React.useState(false);
  const [showPicker, setShowPicker] = React.useState(false);
  const [palLevel, setPalLevel] = React.useState(6);
  const [sorLevel, setSorLevel] = React.useState(3);
  const BUDGET = 20;
  const used = palLevel + sorLevel;
  const remaining = BUDGET - used;

  const paladinLevels = window.INKBORNE_MC.paladinLevels;
  const sorcererLevels = window.INKBORNE_MC.sorcererLevels;
  const palChoice = new Set([2, 3, 4]);
  const sorChoice = new Set([1, 3]);

  function choiceFor(item) {
    return item.cls === "paladin" ? palChoice.has(item.level) : sorChoice.has(item.level);
  }

  function labelFor(item) {
    const levels = item.cls === "paladin" ? paladinLevels : sorcererLevels;
    const lvl = levels.find((l) => l.level === item.level);
    if (!lvl) return "—";
    return lvl.features.filter((f) => f.kind !== "subclass-unlock").map((f) => f.name.replace("Ability Score Improvement", "ASI")).slice(0, 1).join(", ") || "—";
  }

  const focusItem = sequence[focusIdx];

  return (
    <Frame>
      <ClassStepHeader />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Rail */}
        <div style={{
          width: 232, flexShrink: 0,
          borderRight: "1px solid var(--ink-border)",
          display: "flex", flexDirection: "column",
        }}>
          <div className="ink-scroll" style={{ flex: 1, padding: "16px 12px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
            <button onClick={() => setShowChar(true)} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 10px", borderRadius: 7,
              border: `1px solid ${showChar ? "rgba(201,164,74,0.45)" : "var(--ink-border)"}`,
              background: showChar ? "rgba(201,164,74,0.08)" : "rgba(255,255,255,0.015)",
              cursor: "pointer", textAlign: "left", color: "inherit",
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 5,
                background: "rgba(201,164,74,0.15)", color: "var(--ink-accent)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Icon d={IX.star} size={11} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>Character</div>
                <div style={{ fontSize: 10.5, color: "var(--ink-muted-fg)", marginTop: 1 }}>
                  Lv {used}/{BUDGET} · 2 classes
                </div>
              </div>
            </button>

            <div style={{ height: 8 }} />
            <div className="ink-eyebrow" style={{ padding: "0 4px 4px", display: "flex", justifyContent: "space-between" }}>
              <span>Level sequence</span>
              <span style={{ color: "var(--ink-muted-fg)", fontWeight: 500, letterSpacing: 0, textTransform: "none" }}>9</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 1, position: "relative" }}>
              {/* Sub-rail connecting line */}
              <div style={{ position: "absolute", left: 15, top: 8, bottom: 8, width: 1, background: "var(--ink-border)" }} />
              {sequence.map((item, i) => {
                const active = !showChar && i === focusIdx;
                const isBoundary = i > 0 && sequence[i - 1].cls !== item.cls;
                return (
                  <React.Fragment key={i}>
                    {isBoundary && (
                      <div style={{
                        margin: "6px 4px 4px 30px",
                        fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em",
                        color: "var(--ink-muted-fg)",
                        display: "flex", alignItems: "center", gap: 6,
                      }}>
                        <ClassBadge letter={item.letter} tone={item.tone} size={14} />
                        <span style={{ textTransform: "uppercase" }}>{item.cls === "sorcerer" ? "Sorcerer added" : item.cls}</span>
                      </div>
                    )}
                    <button className="ink-level-pill" data-active={active} data-choice={choiceFor(item) || undefined}
                      onClick={() => { setShowChar(false); setFocusIdx(i); }}
                      style={{ position: "relative" }}>
                      <span className="lvlnum" style={{ fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                      <ClassBadge letter={item.letter} tone={item.tone} size={14} />
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left", fontSize: 11.5 }}>
                        {labelFor(item)}
                      </span>
                      {choiceFor(item) && <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--ink-accent)" }} />}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>

            <div style={{ height: 8 }} />
            <div className="ink-eyebrow" style={{ padding: "0 4px 4px" }}>Set levels</div>
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "6px 8px",
                border: "1px solid var(--ink-border)", borderRadius: 6, background: "rgba(255,255,255,0.02)" }}>
                <ClassBadge letter="P" tone="gold" size={16} />
                <LevelDropdown level={palLevel} max={Math.min(20, palLevel + remaining)} tone="gold"
                  onChange={(n) => setPalLevel(Math.min(n, palLevel + remaining))} />
              </div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "6px 8px",
                border: "1px solid var(--ink-border)", borderRadius: 6, background: "rgba(255,255,255,0.02)" }}>
                <ClassBadge letter="S" tone="purple" size={16} />
                <LevelDropdown level={sorLevel} max={Math.min(20, sorLevel + remaining)} tone="purple"
                  onChange={(n) => setSorLevel(Math.min(n, sorLevel + remaining))} />
              </div>
            </div>

            <AddClassRow onClick={() => { setShowPicker(true); setShowChar(false); }} />
          </div>
        </div>

        <div className="ink-scroll" style={{ flex: 1, padding: "24px 28px" }}>
          {showPicker ? (
            <ClassPickerPanel onClose={() => setShowPicker(false)} used={used} budget={BUDGET} />
          ) : showChar ? (
            <div style={{ maxWidth: 760 }}>
              <div style={{ fontSize: 11, color: "var(--ink-muted-fg)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
                Character
              </div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: "var(--ink-accent)", letterSpacing: "-0.01em" }}>
                Cross-class Summary
              </h2>
              <p style={{ margin: "4px 0 18px", fontSize: 13, color: "var(--ink-muted-fg)" }}>
                Aggregated numbers across both classes.
              </p>
              <CharacterSummaryPanel />
            </div>
          ) : focusItem.cls === "paladin" ? (
            <ClassLevelPane
              className="Paladin" classLetter="P" classTone="gold"
              levels={paladinLevels} focusLevel={focusItem.level}
              subclassName="Oath of Devotion" subclassEmblem="D" subclassPurple={false}
            />
          ) : (
            <ClassLevelPane
              className="Sorcerer" classLetter="S" classTone="purple"
              levels={sorcererLevels} focusLevel={focusItem.level}
              subclassName="Draconic Bloodline" subclassEmblem="Dr" subclassPurple={true}
            />
          )}
        </div>
      </div>
    </Frame>
  );
}

Object.assign(window, { ClassStepC_MC_Grouped, ClassStepC_MC_Unified });
