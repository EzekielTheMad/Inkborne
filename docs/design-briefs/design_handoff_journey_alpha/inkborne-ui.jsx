/* global React */
// Shared primitives used by every variant.
// All components are attached to window at the bottom so sibling Babel
// scripts can import them by name.

const { useState, useMemo, useEffect, useRef } = React;

// ── Icons (simple, stroked) ────────────────────────────────────
function Icon({ d, size = 14, stroke = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={stroke}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
         style={{ flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}
const IX = {
  close: "M18 6 6 18M6 6l12 12",
  chevDown: "m6 9 6 6 6-6",
  chevRight: "m9 6 6 6-6 6",
  chevUp: "m18 15-6-6-6 6",
  check: "M20 6 9 17l-5-5",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  back: "m15 18-6-6 6-6",
  info: "M12 16v-4M12 8h.01M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  menu: "M3 6h18M3 12h18M3 18h18",
  star: "m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2Z",
  sparkles: "M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8",
  bolt: "M13 2 3 14h7l-1 8 10-12h-7l1-8z",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z",
  shield: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z",
  swords: "m14.5 17.5 4-4L22 10l-3-3-3.5 3.5-4 4M14.5 17.5l-3 3L9 18l-1.5 1.5L5 17l2.5-2.5L9 16l3-3M14.5 17.5 9 12",
  scroll: "M8 21h12a2 2 0 0 0 2-2v-2H10M8 21a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2 2 2 0 0 0-2 2v3h4M8 21a2 2 0 0 0 2-2v-2",
};

// ── Portrait / Emblem / Type logo slots ────────────────────────
function PortraitSlot({ label = "class portrait", aspect = "3 / 4", style }) {
  return (
    <div className="ink-placeholder" style={{ aspectRatio: aspect, width: "100%", ...style }}>
      {label}
    </div>
  );
}

function Emblem({ letter, variant = "gold" }) {
  const gold = variant === "gold";
  return (
    <div style={{
      width: 56, height: 56, borderRadius: 12,
      background: gold ? "rgba(201,164,74,0.08)" : "rgba(124,58,237,0.1)",
      border: `1px solid ${gold ? "rgba(201,164,74,0.4)" : "rgba(124,58,237,0.5)"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", flexShrink: 0,
    }}>
      {/* Diamond mark */}
      <div style={{
        position: "absolute", inset: 6, borderRadius: 8,
        border: `1px solid ${gold ? "rgba(201,164,74,0.18)" : "rgba(124,58,237,0.22)"}`,
        transform: "rotate(45deg)",
      }} />
      <span style={{
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontWeight: 600, fontSize: 22,
        color: gold ? "var(--ink-accent)" : "#b594ff",
        letterSpacing: "0.02em",
        position: "relative", zIndex: 1,
      }}>
        {letter}
      </span>
    </div>
  );
}

function TypeMark({ text, size = 34 }) {
  return (
    <div style={{
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontWeight: 500,
      fontStyle: "italic",
      color: "var(--ink-accent)",
      fontSize: size,
      letterSpacing: "-0.015em",
      lineHeight: 1,
    }}>
      {text}
    </div>
  );
}

// ── Tag list ───────────────────────────────────────────────────
function StatRow({ label, value, muted }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "6px 0" }}>
      <span className="ink-eyebrow">{label}</span>
      <span style={{ fontSize: 13, color: muted ? "var(--ink-muted-fg)" : "var(--ink-fg)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function KVLine({ label, value }) {
  return (
    <div style={{ fontSize: 13, display: "flex", gap: 8 }}>
      <span style={{ color: "var(--ink-muted-fg)", minWidth: 96, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "var(--ink-fg)" }}>{value}</span>
    </div>
  );
}

// ── Section heading ────────────────────────────────────────────
function SectionHeading({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <div className="ink-heading">{children}</div>
      {right}
    </div>
  );
}

// ── Feature card ───────────────────────────────────────────────
function FeatureCard({ name, description, choice, choiceLabel, options, selected, onSelect, collapsed: initCollapsed = true, badge, subclassFeature }) {
  const [collapsed, setCollapsed] = useState(initCollapsed);
  const long = description && description.length > 140;
  return (
    <div className={"ink-feat" + (choice ? " ink-feat-choice" : "")} style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-accent)" }}>{name}</span>
            {choice && <span className="ink-badge ink-badge-choice">Choice</span>}
            {subclassFeature && <span className="ink-badge ink-badge-purple">Battle Master</span>}
            {badge}
          </div>
          {description && (
            <p style={{
              marginTop: 6, marginBottom: 0,
              fontSize: 12.5, lineHeight: 1.55,
              color: "var(--ink-muted-fg)",
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: collapsed && long ? 2 : 99,
              overflow: "hidden",
            }}>
              {description}
            </p>
          )}
          {long && (
            <button type="button" onClick={() => setCollapsed(!collapsed)}
              style={{
                marginTop: 6, fontSize: 11, padding: 0, border: 0, background: "transparent",
                color: "var(--ink-primary)", cursor: "pointer", fontWeight: 500,
              }}>
              {collapsed ? "Show more" : "Show less"}
            </button>
          )}
        </div>
      </div>
      {choice && options && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, color: "var(--ink-muted-fg)", fontWeight: 500 }}>
            {choiceLabel || "Choose one"}
          </label>
          <select className="ink-select"
            value={selected || ""}
            onChange={(e) => onSelect && onSelect(e.target.value)}>
            <option value="" disabled>— Select —</option>
            {options.map((o) => (
              <option key={o.slug} value={o.slug}>{o.name}</option>
            ))}
          </select>
          {selected && options.find((o) => o.slug === selected)?.desc && (
            <p style={{ fontSize: 12, margin: 0, color: "var(--ink-fg)", lineHeight: 1.5 }}>
              <span style={{ color: "var(--ink-muted-fg)" }}>— </span>
              {options.find((o) => o.slug === selected).desc}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── ASI mini control ───────────────────────────────────────────
function ASIControl({ id, allocations, onChange }) {
  const abilities = [
    { slug: "str", name: "STR" }, { slug: "dex", name: "DEX" }, { slug: "con", name: "CON" },
    { slug: "int", name: "INT" }, { slug: "wis", name: "WIS" }, { slug: "cha", name: "CHA" },
  ];
  const spent = Object.values(allocations).reduce((a, b) => a + b, 0);
  const has2 = Object.values(allocations).some((v) => v === 2);

  function inc(slug) {
    const cur = allocations[slug] || 0;
    if (cur >= 2 || spent >= 2) return;
    if (has2 && cur === 0) return;
    if (cur === 1 && spent === 1) {
      onChange({ [slug]: 2 });
      return;
    }
    onChange({ ...allocations, [slug]: cur + 1 });
  }
  function dec(slug) {
    const cur = allocations[slug] || 0;
    if (cur <= 0) return;
    const next = { ...allocations };
    if (cur === 1) delete next[slug];
    else next[slug] = cur - 1;
    onChange(next);
  }

  return (
    <div style={{
      borderRadius: 10, border: "1px solid rgba(201,164,74,0.3)",
      background: "rgba(201,164,74,0.05)", padding: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="ink-badge ink-badge-choice">Choose</span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Ability Score Improvement</span>
        </div>
        <span style={{ fontSize: 11, color: "var(--ink-muted-fg)" }}>{spent} / 2 points</span>
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--ink-muted-fg)" }}>
        Increase one ability by 2, or two abilities by 1 each. Or take a feat instead.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {abilities.map((a) => {
          const v = allocations[a.slug] || 0;
          const canInc = spent < 2 && v < 2 && !(has2 && v === 0);
          return (
            <div key={a.slug} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              borderRadius: 7, padding: "6px 8px",
              border: `1px solid ${v > 0 ? "var(--ink-primary)" : "var(--ink-border)"}`,
              background: v > 0 ? "rgba(124,58,237,0.12)" : "transparent",
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em" }}>{a.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button className="ink-step" onClick={() => dec(a.slug)} disabled={v <= 0}
                  style={{ width: 20, height: 20, fontSize: 12, opacity: v <= 0 ? 0.4 : 1 }}>−</button>
                <span style={{
                  minWidth: 22, textAlign: "center", fontSize: 12, fontWeight: 600,
                  color: v > 0 ? "var(--ink-accent)" : "var(--ink-muted-fg)",
                  fontVariantNumeric: "tabular-nums",
                }}>{v > 0 ? `+${v}` : "0"}</span>
                <button className="ink-step" onClick={() => inc(a.slug)} disabled={!canInc}
                  style={{ width: 20, height: 20, fontSize: 12, opacity: canInc ? 1 : 0.4 }}>+</button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
        <button className="ink-btn ink-btn-outline ink-btn-sm" type="button">
          Take feat instead
        </button>
      </div>
    </div>
  );
}

// ── Frame for a static prototype artboard ──────────────────────
function Frame({ children, style, pad = 0 }) {
  return (
    <div className="ink" style={{
      width: "100%", height: "100%",
      background: "var(--ink-bg)",
      padding: pad,
      display: "flex", flexDirection: "column",
      ...style,
    }}>
      {children}
    </div>
  );
}

// Expose globally for other Babel modules
Object.assign(window, {
  Icon, IX,
  PortraitSlot, Emblem, TypeMark,
  StatRow, KVLine, SectionHeading,
  FeatureCard, ASIControl, Frame,
});
