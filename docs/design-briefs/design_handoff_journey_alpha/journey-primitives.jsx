/* global React */
// Shared primitives for the Inkborne journey prototypes.
// Logo, Nav, Footer, Ornaments, Placeholders, Marginalia.

const { useState: jUseState, useEffect: jUseEffect } = React;

// ── Logo: serif italic 'Inkborne' wordmark + corner ornament ──────────
function JLogo({ size = 22, mark = true }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {mark && (
        <svg width={size + 4} height={size + 4} viewBox="0 0 28 28" aria-hidden="true">
          <defs>
            <linearGradient id="logoGold" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#e1bf6c" />
              <stop offset="1" stopColor="#a07e2c" />
            </linearGradient>
          </defs>
          {/* nib mark — upturned quill tip */}
          <path
            d="M14 3 C 17 8 22 11 24 14 C 22 17 18 20 14 25 C 10 20 6 17 4 14 C 6 11 11 8 14 3 Z"
            fill="url(#logoGold)" opacity="0.9"
          />
          <path d="M14 8 L14 22" stroke="#0b0a10" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
          <circle cx="14" cy="14" r="1.4" fill="#0b0a10" opacity="0.7" />
        </svg>
      )}
      <span className="j-display" style={{
        fontSize: size, color: "var(--ink-fg)", letterSpacing: "0.02em",
        fontWeight: 400,
      }}>
        Inkborne
      </span>
    </div>
  );
}

// ── Nav (landing) ──────────────────────────────────────────────────────
function JLandingNav({ onSignIn, alpha = true }) {
  return (
    <>
      {alpha && (
        <div className="j-alpha-banner" style={{
          padding: "8px 24px", display: "flex", alignItems: "center",
          justifyContent: "center", gap: 14, textAlign: "center",
        }}>
          <span style={{ fontWeight: 600, opacity: 0.9 }}>★ Alpha</span>
          <span style={{ color: "var(--ink-muted-fg)", textTransform: "none", letterSpacing: 0 }}>
            Inkborne is in private alpha. Expect rough edges; characters made today are kept.
          </span>
          <span className="j-nav-link" style={{ color: "var(--ink-accent)", textDecoration: "underline", textUnderlineOffset: 3 }}>Read alpha notes →</span>
        </div>
      )}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 28px", borderBottom: "1px solid var(--ink-border)",
      }}>
        <JLogo size={20} />
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <a className="j-nav-link">Features</a>
          <a className="j-nav-link">For DMs</a>
          <a className="j-nav-link">Open source</a>
          <a className="j-nav-link">Changelog</a>
          <span style={{ width: 1, height: 16, background: "var(--ink-border-strong)" }} />
          <a className="j-nav-link" onClick={onSignIn}>Sign in</a>
          <button className="j-btn-gold j-btn-sm">Request access</button>
        </div>
      </nav>
    </>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────
function JLandingFooter({ slim = false }) {
  if (slim) {
    return (
      <footer style={{ padding: "22px 28px", borderTop: "1px solid var(--ink-border)", display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--ink-muted-fg)", fontSize: 12 }}>
        <JLogo size={15} />
        <span>© Inkborne · MIT-licensed · A community project</span>
        <span style={{ display: "flex", gap: 18 }}>
          <a className="j-nav-link">GitHub</a>
          <a className="j-nav-link">Discord</a>
          <a className="j-nav-link">Privacy</a>
        </span>
      </footer>
    );
  }
  return (
    <footer style={{ padding: "44px 32px 28px", borderTop: "1px solid var(--ink-border)", background: "var(--ink-paper-2)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 40, marginBottom: 32 }}>
        <div>
          <JLogo size={22} />
          <p className="j-marginalia" style={{ marginTop: 14, color: "var(--ink-muted-fg)", fontStyle: "italic", maxWidth: 280 }}>
            “Your characters are inkborne — written, kept, and yours.”
          </p>
        </div>
        <FootCol title="Product" items={["Features", "Roadmap", "Changelog", "For DMs"]} />
        <FootCol title="Community" items={["Discord", "GitHub", "Contribute", "Homebrew"]} />
        <FootCol title="Project" items={["About", "Open Source", "Privacy", "Terms"]} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 22, borderTop: "1px solid var(--ink-border)", color: "var(--ink-muted-fg)", fontSize: 12 }}>
        <span>© 2026 Inkborne. MIT-licensed. Not affiliated with Wizards of the Coast.</span>
        <span style={{ fontFamily: "var(--ink-display)", letterSpacing: "0.3em", color: "var(--ink-accent)", opacity: 0.6 }}>· · ·</span>
      </div>
    </footer>
  );
}
function FootCol({ title, items }) {
  return (
    <div>
      <div className="ink-heading" style={{ marginBottom: 12 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((i) => <a key={i} className="j-nav-link">{i}</a>)}
      </div>
    </div>
  );
}

// ── Ornaments ──────────────────────────────────────────────────────────
function JRule({ glyph = "✦" }) {
  return (
    <div className="j-rule" role="presentation">
      <span className="j-rule-glyph">{glyph}</span>
    </div>
  );
}
function JStarRule() {
  return <div className="j-star-rule">✦ &nbsp; ✦ &nbsp; ✦</div>;
}
function JCornerOrnament({ size = 60, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none"
      style={{ color: color || "var(--ink-accent)", opacity: 0.4 }}>
      <path d="M2 2 L 22 2 M2 2 L 2 22" stroke="currentColor" strokeWidth="0.8" />
      <path d="M30 2 c -2 6 -8 10 -16 12" stroke="currentColor" strokeWidth="0.8" fill="none" />
      <path d="M2 30 c 6 -2 10 -8 12 -16" stroke="currentColor" strokeWidth="0.8" fill="none" />
      <circle cx="22" cy="22" r="1.2" fill="currentColor" />
      <circle cx="32" cy="2" r="0.8" fill="currentColor" />
      <circle cx="2" cy="32" r="0.8" fill="currentColor" />
    </svg>
  );
}

// ── Inkblot / inkstain shape (decorative SVG) ─────────────────────────
function JInkstain({ width = 320, height = 220, opacity = 0.18, color }) {
  return (
    <svg width={width} height={height} viewBox="0 0 320 220" aria-hidden="true"
      style={{ color: color || "var(--ink-accent)", opacity, position: "absolute" }}>
      <g fill="currentColor">
        <path d="M70 30 c 40 -18 100 -18 140 0 c 50 22 70 70 50 110 c -22 40 -90 60 -150 50 c -60 -10 -110 -50 -100 -100 c 4 -22 24 -46 60 -60 z" opacity="0.95" />
        <circle cx="245" cy="35" r="6" />
        <circle cx="280" cy="60" r="3" />
        <circle cx="20" cy="170" r="4" />
        <circle cx="290" cy="180" r="5" />
        <circle cx="50" cy="200" r="2.5" />
      </g>
    </svg>
  );
}

// ── Drop-cap paragraph ────────────────────────────────────────────────
function JDropCap({ children, style }) {
  return <p className="j-dropcap" style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "var(--ink-fg)", ...style }}>{children}</p>;
}

// ── Image placeholder (parchment) ─────────────────────────────────────
function JImg({ label, height = 200, aspect, tone = "gold", style }) {
  const isGold = tone === "gold";
  return (
    <div style={{
      position: "relative",
      height: aspect ? undefined : height,
      aspectRatio: aspect,
      width: "100%",
      borderRadius: 8,
      overflow: "hidden",
      background: "var(--ink-paper-2)",
      border: `1px dashed ${isGold ? "rgba(201,164,74,0.3)" : "rgba(124,58,237,0.3)"}`,
      backgroundImage: `repeating-linear-gradient(135deg, ${isGold ? "rgba(201,164,74,0.04)" : "rgba(124,58,237,0.04)"} 0 8px, transparent 8px 18px)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: isGold ? "rgba(201,164,74,0.7)" : "rgba(124,58,237,0.6)",
      fontSize: 11, fontFamily: "var(--ink-font-mono)", letterSpacing: "0.06em",
      textTransform: "uppercase",
      ...style,
    }}>
      <span style={{ opacity: 0.85 }}>{label}</span>
    </div>
  );
}

// ── Decorative quill SVG ──────────────────────────────────────────────
function JQuill({ size = 80, opacity = 0.6 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none"
      style={{ color: "var(--ink-accent)", opacity }}>
      <path d="M62 14 c -22 4 -38 22 -42 42 c -4 14 8 18 16 8 c 8 -10 22 -22 30 -36 c 6 -10 4 -16 -4 -14 z"
        fill="currentColor" opacity="0.55" />
      <path d="M58 18 L 22 56 L 18 60" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      <path d="M18 60 L 14 64 L 14 70" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="14" cy="70" r="2" fill="currentColor" />
    </svg>
  );
}

// ── Mini character chip (avatar + class+race) ─────────────────────────
function JCharRow({ name, sub, level, tone = "gold", thumb = "PORTRAIT", lastEdited }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "12px 14px",
      background: "rgba(255,255,255,0.015)",
      border: "1px solid var(--ink-border)",
      borderRadius: 8,
      transition: "background .12s, border-color .12s",
    }}>
      <JImg label="" height={48} style={{ width: 48, height: 48, borderRadius: 6, flexShrink: 0 }} tone={tone} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="j-display" style={{ fontSize: 15, color: "var(--ink-fg)" }}>{name}</span>
          <span style={{ fontSize: 11, color: "var(--ink-muted-fg)", letterSpacing: "0.04em" }}>· LVL {level}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-muted-fg)", marginTop: 2 }}>{sub}</div>
      </div>
      {lastEdited && (
        <span style={{ fontSize: 11, color: "var(--ink-muted-fg)", fontStyle: "italic", whiteSpace: "nowrap" }}>{lastEdited}</span>
      )}
    </div>
  );
}

Object.assign(window, {
  JLogo, JLandingNav, JLandingFooter, JRule, JStarRule, JCornerOrnament,
  JInkstain, JDropCap, JImg, JQuill, JCharRow, jUseState, jUseEffect,
});
