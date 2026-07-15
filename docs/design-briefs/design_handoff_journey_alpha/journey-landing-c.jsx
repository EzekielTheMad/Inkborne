/* global React, JLandingNav, JLandingFooter, JLogo, JRule, JStarRule, JInkstain, JCornerOrnament, JImg, JDropCap, JQuill, JCharRow */

// ─── LANDING VARIANT C · Story-led ────────────────────────────────────────
// Ambient hero, walkthrough of one character's becoming (empty -> rich),
// closing CTA. Most ambitious — the "manuscript opening" framing.
function LandingStoryLed() {
  return (
    <div className="ink j-grain" style={{ minHeight: "100%", overflow: "hidden", position: "relative" }}>
      <JLandingNav />

      {/* Ambient hero — quiet, narrative */}
      <section style={{ padding: "110px 32px 60px", position: "relative" }}>
        <JInkstain width={620} height={420} opacity={0.06} style={{ left: -140, top: 40 }} />
        <JInkstain width={420} height={300} opacity={0.05} color="var(--ink-primary)" style={{ right: -100, top: 220, transform: "scaleX(-1)" }} />

        <div style={{ maxWidth: 760, margin: "0 auto", position: "relative", textAlign: "center" }}>
          <div className="j-folio" style={{ marginBottom: 30, opacity: 0.7 }}>An opening · Folio 1</div>

          <p className="j-display-italic" style={{
            fontSize: 28, lineHeight: 1.5, color: "var(--ink-muted-fg)",
            fontStyle: "italic", margin: 0, maxWidth: 600, marginInline: "auto",
          }}>
            “Every character begins as a smudge of ink — a name, a system, a half-thought
            of who they might be.”
          </p>

          <div style={{ margin: "40px auto", width: 80, height: 1, background: "var(--ink-vellum-line)" }} />

          <h1 className="j-display" style={{ fontSize: 64, lineHeight: 1.1, margin: 0, color: "var(--ink-fg)" }}>
            Watch one become <em className="j-display-italic" style={{ color: "var(--ink-accent)" }}>inkborne</em>.
          </h1>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 36 }}>
            <button className="j-btn-gold j-btn-lg">Begin a story</button>
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-muted-fg)", marginTop: 18, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            ↓ &nbsp; Or — read on
          </p>
        </div>
      </section>

      {/* Walkthrough — three folios */}
      <section style={{ padding: "60px 32px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <Folio
            num="II"
            title="A blank page."
            kicker="The character is named. Nothing else is decided."
            body="No race. No class. The notebook is open. The builder is patient — it suggests, never pushes."
            visual={<FolioBlank />}
          />
          <Folio
            num="III"
            title="A few choices in."
            reverse
            kicker="Race chosen. Class half-decided."
            body="The sheet starts to compute itself. Skills appear. Languages settle. The stat ribbon gains weight; the character starts looking back at you."
            visual={<FolioMidway />}
          />
          <Folio
            num="IV"
            title="A character, fully written."
            kicker="Builder complete. The sheet is theirs."
            body="Every modifier is correct. Every feature is tracked. The notebook closes neatly — and reopens to where you left off, on any device, forever."
            visual={<FolioComplete />}
          />
        </div>
      </section>

      {/* Quiet trust + open-source acknowledgement */}
      <section style={{ padding: "80px 32px", borderTop: "1px solid var(--ink-border)", background: "var(--ink-paper-2)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
          <JQuill size={70} opacity={0.4} />
          <h3 className="j-display" style={{ fontSize: 28, color: "var(--ink-fg)", margin: "14px 0 12px" }}>
            Built in the open. Kept by you.
          </h3>
          <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--ink-muted-fg)", maxWidth: 560, marginInline: "auto" }}>
            Inkborne is MIT-licensed and self-hostable. Your characters export as plain JSON. Nothing is held hostage —
            not your sheets, not your campaigns, not the math behind them.
          </p>
          <div style={{ display: "flex", gap: 18, justifyContent: "center", marginTop: 24, fontSize: 12, color: "var(--ink-muted-fg)", letterSpacing: "0.05em" }}>
            <span><span style={{ color: "var(--ink-accent)" }}>★</span> 1.2k stars</span>
            <span>·</span>
            <span><span style={{ color: "var(--ink-accent)" }}>★</span> 38 contributors</span>
            <span>·</span>
            <span><span style={{ color: "var(--ink-accent)" }}>★</span> Cut on every full moon</span>
          </div>
        </div>
      </section>

      {/* Closing */}
      <section style={{ padding: "90px 32px", textAlign: "center", position: "relative" }}>
        <JStarRule />
        <h2 className="j-display" style={{ fontSize: 44, marginTop: 18, color: "var(--ink-fg)" }}>
          What will you write?
        </h2>
        <button className="j-btn-gold j-btn-lg" style={{ marginTop: 20 }}>Request alpha access</button>
      </section>

      <JLandingFooter />
    </div>
  );
}

function Folio({ num, title, kicker, body, visual, reverse }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: reverse ? "1fr 1fr" : "1fr 1fr",
      gap: 56, alignItems: "center", padding: "70px 0",
      borderTop: num === "II" ? "1px solid var(--ink-border)" : "none",
      borderBottom: "1px solid var(--ink-border)",
    }}>
      <div style={{ order: reverse ? 2 : 1 }}>
        <div className="j-folio" style={{ marginBottom: 14 }}>{`Folio ${num} — ${kicker}`}</div>
        <h3 className="j-display" style={{ fontSize: 38, lineHeight: 1.15, margin: 0, color: "var(--ink-fg)" }}>{title}</h3>
        <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--ink-muted-fg)", marginTop: 16, maxWidth: 440 }}>{body}</p>
      </div>
      <div style={{ order: reverse ? 1 : 2 }}>{visual}</div>
    </div>
  );
}

function FolioBlank() {
  return (
    <div className="j-card-paper j-corners" style={{ padding: 28, position: "relative" }}>
      <div className="j-folio" style={{ marginBottom: 12, opacity: 0.55 }}>UNTITLED · Folio 1</div>
      <h4 className="j-display" style={{ fontSize: 24, color: "var(--ink-fg)", margin: 0, marginBottom: 10 }}>
        Veyra<span style={{ color: "var(--ink-muted-fg)" }}>—</span>
      </h4>
      <p style={{ fontSize: 12.5, color: "var(--ink-muted-fg)", margin: 0, fontStyle: "italic" }}>
        Race: <span style={{ opacity: 0.5 }}>not chosen</span><br />
        Class: <span style={{ opacity: 0.5 }}>not chosen</span><br />
        Background: <span style={{ opacity: 0.5 }}>—</span>
      </p>
      <div style={{ marginTop: 22, padding: "14px 16px", border: "1px dashed var(--ink-border-strong)", borderRadius: 6, color: "var(--ink-accent)", fontSize: 12, textAlign: "center", letterSpacing: "0.05em" }}>
        ✦ &nbsp; Begin: choose a race
      </div>
    </div>
  );
}

function FolioMidway() {
  return (
    <div className="j-card-paper" style={{ padding: 22 }}>
      <div className="j-folio" style={{ marginBottom: 12 }}>VEYRA · Folio 1 · half-built</div>
      <h4 className="j-display" style={{ fontSize: 22, color: "var(--ink-fg)", margin: 0, marginBottom: 4 }}>Veyra Stormhollow</h4>
      <p style={{ fontSize: 12, color: "var(--ink-muted-fg)", margin: 0, marginBottom: 14 }}>Half-Elf · Sorcerer (subclass pending)</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginBottom: 14 }}>
        {["8","12","13","10","14","17"].map((v, i) => (
          <div key={i} style={{ textAlign: "center", padding: "8px 0", background: "rgba(255,255,255,0.02)", border: "1px solid var(--ink-border)", borderRadius: 6 }}>
            <div className="ink-eyebrow" style={{ fontSize: 9 }}>{["STR","DEX","CON","INT","WIS","CHA"][i]}</div>
            <div className="j-display" style={{ fontSize: 16, color: i === 5 ? "var(--ink-accent)" : "var(--ink-fg)" }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--ink-muted-fg)" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
          <span className="ink-dot ink-dot-gold" /> Languages: Common, Elvish, Draconic
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
          <span className="ink-dot ink-dot-gold" /> Skills: Arcana, Persuasion
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--ink-accent)" }}>
          <span className="ink-dot ink-dot-purple" /> 2 choices remaining
        </div>
      </div>
    </div>
  );
}

function FolioComplete() {
  return (
    <div className="j-card-paper" style={{ padding: 0, overflow: "hidden", boxShadow: "0 30px 80px -30px rgba(124,58,237,0.3)" }}>
      <div style={{ background: "linear-gradient(180deg, rgba(201,164,74,0.06), transparent)", padding: "16px 20px", borderBottom: "1px solid var(--ink-border)" }}>
        <div className="j-folio" style={{ marginBottom: 4 }}>VEYRA · Complete · Lv 5</div>
        <h4 className="j-display" style={{ fontSize: 22, color: "var(--ink-fg)", margin: 0 }}>Veyra Stormhollow</h4>
        <p style={{ fontSize: 11.5, color: "var(--ink-muted-fg)", margin: "2px 0 0" }}>Half-Elf Sorcerer · Storm Sorcery · Folk Hero</p>
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <div className="ink-heading" style={{ marginBottom: 8 }}>★ FEATURES</div>
            {["Tempestuous Magic", "Heart of the Storm", "Folk Hero"].map((f) => (
              <div key={f} style={{ fontSize: 11.5, color: "var(--ink-fg)", padding: "5px 0" }}>· {f}</div>
            ))}
          </div>
          <div>
            <div className="ink-heading" style={{ marginBottom: 8 }}>✶ SLOTS</div>
            <div style={{ display: "flex", gap: 4 }}>
              {[1,1,1,1,0].map((on, i) => (
                <div key={i} style={{ width: 18, height: 18, borderRadius: 4, background: on ? "var(--ink-primary)" : "transparent", border: "1px solid var(--ink-border-strong)" }} />
              ))}
            </div>
            <div className="ink-heading" style={{ margin: "14px 0 6px" }}>HP</div>
            <div className="j-display" style={{ fontSize: 22, color: "var(--ink-fg)" }}>34<span style={{ color: "var(--ink-muted-fg)", fontSize: 14 }}> / 38</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LandingStoryLed });
