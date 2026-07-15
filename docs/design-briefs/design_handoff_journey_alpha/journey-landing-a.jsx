/* global React, JLandingNav, JLandingFooter, JLogo, JRule, JStarRule, JInkstain, JCornerOrnament, JImg, JDropCap, JQuill, JCharRow */

// ─── LANDING VARIANT A · Hero-first ───────────────────────────────────────
// Big hero with sample sheet preview. Restrained ambient parchment.
// Dominant gold tagline + clear single CTA + trust strip.
function LandingHeroFirst() {
  return (
    <div className="ink j-grain j-grain-noise" style={{ minHeight: "100%", overflow: "hidden", position: "relative" }}>
      <JLandingNav />

      {/* Hero */}
      <section style={{ position: "relative", padding: "100px 32px 80px", textAlign: "center" }}>
        {/* Decorative inkstain washes */}
        <JInkstain width={420} height={300} opacity={0.04} color="var(--ink-accent)"
          style={{ left: -120, top: 30 }} />
        <JInkstain width={360} height={260} opacity={0.04} color="var(--ink-primary)"
          style={{ right: -100, top: 80, transform: "scaleX(-1)" }} />

        <div style={{ maxWidth: 760, margin: "0 auto", position: "relative" }}>
          <div className="j-folio" style={{ marginBottom: 24 }}>I · The Notebook</div>

          <h1 className="j-display" style={{
            fontSize: 78, lineHeight: 1.05, margin: 0,
            color: "var(--ink-fg)", fontWeight: 400,
          }}>
            Your characters are<br />
            <em className="j-display-italic" style={{ color: "var(--ink-accent)", fontStyle: "italic" }}>
              inkborne
            </em>
            <span style={{ color: "var(--ink-accent)", marginLeft: 4 }}>.</span>
          </h1>

          <div style={{ marginTop: 28, marginBottom: 28 }}>
            <JRule glyph="✦ ✦ ✦" />
          </div>

          <p style={{
            fontSize: 17, lineHeight: 1.65, color: "var(--ink-muted-fg)",
            maxWidth: 560, margin: "0 auto",
          }}>
            A character notebook that computes everything for you. Built by players,
            kept by you, open from the first page to the last.
          </p>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 36 }}>
            <button className="j-btn-gold j-btn-lg">Start a character →</button>
            <button className="j-btn-quiet j-btn-lg">See an example sheet</button>
          </div>

          <p style={{ marginTop: 22, fontSize: 12, color: "var(--ink-muted-fg)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            D&amp;D 5e &nbsp;·&nbsp; Daggerheart soon &nbsp;·&nbsp; Homebrew always
          </p>
        </div>

        {/* Sample sheet preview */}
        <div style={{ maxWidth: 1040, margin: "72px auto 0", position: "relative" }}>
          {/* corner ornaments */}
          <div style={{ position: "absolute", top: -12, left: -12 }}><JCornerOrnament /></div>
          <div style={{ position: "absolute", top: -12, right: -12, transform: "scaleX(-1)" }}><JCornerOrnament /></div>
          <div style={{ position: "absolute", bottom: -12, left: -12, transform: "scaleY(-1)" }}><JCornerOrnament /></div>
          <div style={{ position: "absolute", bottom: -12, right: -12, transform: "scale(-1)" }}><JCornerOrnament /></div>

          <SampleSheetPreview />
          <div style={{ position: "absolute", top: -12, right: 28 }}>
            <span className="j-chip">An example character</span>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section style={{ borderTop: "1px solid var(--ink-border)", borderBottom: "1px solid var(--ink-border)", background: "var(--ink-paper-2)", padding: "56px 32px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
          <TrustCol
            num="I"
            title="Open Source"
            body="Every line is on GitHub. Read it. Fork it. Send a pull request when something feels wrong."
          />
          <TrustCol
            num="II"
            title="Built by Players"
            body="Every feature solves a real problem at the table. We play the games we build for."
            highlight
          />
          <TrustCol
            num="III"
            title="Yours, Inkborne"
            body="Your characters belong to you — exportable, portable, never locked behind a subscription."
          />
        </div>
      </section>

      {/* Closing */}
      <section style={{ padding: "80px 32px", textAlign: "center", position: "relative" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <JStarRule />
          <h2 className="j-display" style={{ fontSize: 36, marginTop: 18, marginBottom: 10, color: "var(--ink-fg)" }}>
            Begin a story.
          </h2>
          <p style={{ fontSize: 14, color: "var(--ink-muted-fg)", marginBottom: 28 }}>
            One field, one click. The builder takes it from there.
          </p>
          <button className="j-btn-gold j-btn-lg">Request alpha access</button>
        </div>
      </section>

      <JLandingFooter />
    </div>
  );
}

function TrustCol({ num, title, body, highlight }) {
  return (
    <div style={{ position: "relative", paddingLeft: 24 }}>
      <span className="j-display" style={{
        position: "absolute", left: 0, top: 0,
        fontSize: 22, color: "var(--ink-accent)", opacity: 0.55,
      }}>{num}</span>
      <h3 className="j-display" style={{ fontSize: 22, color: highlight ? "var(--ink-accent)" : "var(--ink-fg)", margin: 0, marginBottom: 8 }}>
        {title}
      </h3>
      <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-muted-fg)", margin: 0 }}>{body}</p>
    </div>
  );
}

// Reusable mocked sheet — used in landing previews
function SampleSheetPreview() {
  const stats = [
    { n: "STR", v: 8, m: "−1" },
    { n: "DEX", v: 14, m: "+2" },
    { n: "CON", v: 13, m: "+1" },
    { n: "INT", v: 18, m: "+4" },
    { n: "WIS", v: 12, m: "+1" },
    { n: "CHA", v: 10, m: "+0" },
  ];
  return (
    <div className="j-card-paper" style={{ padding: 26, position: "relative", overflow: "hidden", boxShadow: "0 30px 80px -30px rgba(124,58,237,0.25), 0 0 0 1px rgba(201,164,74,0.04)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 22, alignItems: "center", marginBottom: 22 }}>
        <JImg label="PORTRAIT" height={120} style={{ width: 120, height: 120, borderRadius: 10 }} />
        <div>
          <div className="j-folio" style={{ color: "var(--ink-muted-fg)", marginBottom: 4 }}>The Twilight Archive · Folio 14</div>
          <h3 className="j-display" style={{ fontSize: 30, margin: 0, color: "var(--ink-fg)" }}>Thalindra Moonweave</h3>
          <p style={{ fontSize: 13, color: "var(--ink-muted-fg)", margin: "6px 0 0", letterSpacing: "0.02em" }}>
            Level 5 &nbsp;·&nbsp; High Elf Wizard &nbsp;·&nbsp; School of Chronurgy
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <span className="j-chip">Homebrew</span>
          <span className="j-chip j-chip-purple">Active</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 22 }}>
        {stats.map((s) => (
          <div key={s.n} style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--ink-border)",
            borderRadius: 8, padding: "12px 8px", textAlign: "center",
          }}>
            <div className="ink-eyebrow" style={{ marginBottom: 6 }}>{s.n}</div>
            <div className="j-display" style={{ fontSize: 28, color: "var(--ink-fg)", lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 11, color: "var(--ink-muted-fg)", marginTop: 4 }}>{s.m}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div>
          <div className="ink-heading" style={{ marginBottom: 10 }}>★ Features</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              "Arcane Recovery",
              "Spell Mastery: Shield",
              "School of Chronurgy",
              "Temporal Awareness",
            ].map((f) => (
              <div key={f} style={{
                fontSize: 12.5, padding: "8px 12px",
                background: "rgba(255,255,255,0.015)",
                border: "1px solid var(--ink-border)", borderRadius: 6,
                color: "var(--ink-fg)",
              }}>{f}</div>
            ))}
          </div>
        </div>
        <div>
          <div className="ink-heading" style={{ marginBottom: 10 }}>✶ Spell Slots</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {[
              { l: "1st", a: 3, b: 4 }, { l: "2nd", a: 2, b: 3 }, { l: "3rd", a: 1, b: 2 },
            ].map((s) => (
              <div key={s.l} style={{
                background: "rgba(255,255,255,0.015)",
                border: "1px solid var(--ink-border)", borderRadius: 6,
                padding: "10px 10px",
              }}>
                <div className="ink-eyebrow" style={{ marginBottom: 4 }}>{s.l}</div>
                <div style={{ fontSize: 14, color: "var(--ink-fg)" }}>
                  <span style={{ color: "var(--ink-accent)" }}>{s.a}</span>
                  <span style={{ color: "var(--ink-muted-fg)" }}> / {s.b}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="ink-heading" style={{ margin: "18px 0 10px" }}>⚔ Notes</div>
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-muted-fg)", margin: 0, fontStyle: "italic" }}>
            “Last night the bell tolled twice in Shadepoint. T. asks me to memorize Detect Magic before sundown.”
          </p>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LandingHeroFirst, SampleSheetPreview, TrustCol });
