/* global React, JLandingNav, JLandingFooter, JLogo, JRule, JStarRule, JInkstain, JCornerOrnament, JImg, JDropCap, JQuill, JCharRow, SampleSheetPreview, TrustCol */

// ─── LANDING VARIANT B · Feature-forward ─────────────────────────────────
// Compressed hero, three concrete differentiator sections, social proof,
// closing CTA. Best for explaining what's actually different.
function LandingFeatureForward() {
  return (
    <div className="ink j-grain" style={{ minHeight: "100%", overflow: "hidden", position: "relative" }}>
      <JLandingNav />

      {/* Compressed hero */}
      <section style={{ padding: "70px 32px 50px", textAlign: "center", position: "relative" }}>
        <JInkstain width={520} height={300} opacity={0.05} style={{ left: "50%", top: 30, transform: "translateX(-50%)" }} />
        <div style={{ maxWidth: 720, margin: "0 auto", position: "relative" }}>
          <div className="j-folio" style={{ marginBottom: 20 }}>The sheet · The story · One place</div>
          <h1 className="j-display" style={{ fontSize: 56, lineHeight: 1.1, margin: 0, color: "var(--ink-fg)" }}>
            Your character sheet<br />
            and your <em className="j-display-italic" style={{ color: "var(--ink-accent)" }}>character's story</em>,<br />
            in the same notebook.
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--ink-muted-fg)", maxWidth: 560, margin: "20px auto 0" }}>
            Inkborne combines the dense character management of D&amp;D Beyond with
            the narrative depth of LegendKeeper — sheet, lore, sessions and secrets
            kept side by side.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28 }}>
            <button className="j-btn-gold">Request access</button>
            <button className="j-btn-quiet">Watch a 90-second tour</button>
          </div>
        </div>
      </section>

      {/* Three differentiators, alternating layout */}
      <section style={{ padding: "20px 32px 0" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <FeatureRow
            num="I"
            kicker="The sheet"
            title="Every modifier, computed. Every detail, in reach."
            body="A full character sheet that holds the math for you — stats, slots, resources, conditions, rests. Dense enough for a 20th-level paladin; calm enough to read across the table."
            visual={<FRSheetSnippet />}
          />
          <FeatureRow
            num="II"
            reverse
            kicker="The story"
            title="Sessions, NPCs, lore — beside the sheet, not in another tab."
            body="Your character's journal, the session you played last Thursday, the NPCs who owe you favors, the secrets you haven't told the party — all linked, all next to the stats they affect."
            visual={<FRNotebookSnippet />}
          />
          <FeatureRow
            num="III"
            kicker="One place, your way"
            title="Homebrew that flows through both."
            body="House rules, custom classes, signature items — defined once and valid in the sheet, the lore, and every character at your table. No syncing, no copy-paste, no contradictions."
            visual={<FRHomebrewSnippet />}
          />
        </div>
      </section>

      {/* Open-source moment */}
      <section style={{ padding: "70px 32px", marginTop: 30, background: "var(--ink-paper-2)", borderTop: "1px solid var(--ink-border)", borderBottom: "1px solid var(--ink-border)", position: "relative" }}>
        <JInkstain width={400} height={280} opacity={0.05} color="var(--ink-primary)" style={{ right: -80, top: 20 }} />
        <div style={{ maxWidth: 880, margin: "0 auto", display: "grid", gridTemplateColumns: "auto 1fr", gap: 36, alignItems: "center", position: "relative" }}>
          <JQuill size={120} opacity={0.4} />
          <div>
            <div className="j-folio" style={{ marginBottom: 12 }}>IV · Why open source matters here</div>
            <p className="j-pull" style={{ marginBottom: 16 }}>
              <span className="j-pull-mark">“</span>
              The character sheet outlives the platform. Your notebook should not require our blessing — or our servers — to keep working.
            </p>
            <div style={{ display: "flex", gap: 22, marginTop: 24, fontSize: 12, color: "var(--ink-muted-fg)" }}>
              <span><span style={{ color: "var(--ink-accent)" }}>★</span> MIT licensed</span>
              <span><span style={{ color: "var(--ink-accent)" }}>★</span> Self-hostable</span>
              <span><span style={{ color: "var(--ink-accent)" }}>★</span> JSON export, always</span>
              <span><span style={{ color: "var(--ink-accent)" }}>★</span> No telemetry by default</span>
            </div>
          </div>
        </div>
      </section>

      {/* Voices */}
      <section style={{ padding: "60px 32px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <JStarRule />
            <h2 className="j-display" style={{ fontSize: 30, marginTop: 14, color: "var(--ink-fg)" }}>From the table</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22 }}>
            <Quote name="DM, 12 years" body="Finally a sheet I can show on stream without it looking like a tax form." />
            <Quote name="Player, sorcadin enthusiast" body="Multiclass UI that doesn't make me cry. Set spell slots correctly the first time." gold />
            <Quote name="Forever-DM, homebrew shop" body="I made a custom class in an afternoon. The math just worked." />
          </div>
        </div>
      </section>

      {/* Closing */}
      <section style={{ padding: "70px 32px 96px", textAlign: "center", borderTop: "1px solid var(--ink-border)", background: "var(--ink-deep)" }}>
        <h2 className="j-display" style={{ fontSize: 42, color: "var(--ink-fg)", margin: 0 }}>
          Begin a character.
        </h2>
        <p style={{ color: "var(--ink-muted-fg)", marginTop: 12, marginBottom: 28, fontSize: 14 }}>
          One name. One system. The rest is yours.
        </p>
        <button className="j-btn-gold j-btn-lg">Start building →</button>
      </section>

      <JLandingFooter />
    </div>
  );
}

function FeatureRow({ num, kicker, title, body, reverse, visual }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: reverse ? "1fr 1.05fr" : "1.05fr 1fr",
      gap: 56, alignItems: "center", padding: "56px 0",
      borderBottom: "1px solid var(--ink-border)",
    }}>
      <div style={{ order: reverse ? 2 : 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 12 }}>
          <span className="j-display" style={{ fontSize: 30, color: "var(--ink-accent)", opacity: 0.5 }}>{num}.</span>
          <span className="j-folio">{kicker}</span>
        </div>
        <h3 className="j-display" style={{ fontSize: 30, lineHeight: 1.2, margin: 0, color: "var(--ink-fg)" }}>{title}</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--ink-muted-fg)", marginTop: 14, maxWidth: 460 }}>{body}</p>
      </div>
      <div style={{ order: reverse ? 1 : 2 }}>{visual}</div>
    </div>
  );
}

function FRSheetSnippet() {
  return (
    <div className="j-card-paper" style={{ padding: 18 }}>
      <div className="ink-heading" style={{ marginBottom: 10 }}>★ SAVING THROWS</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {[["STR","−1","muted"],["DEX","+2","muted"],["CON","+1","muted"],["INT","+7","gold"],["WIS","+4","gold"],["CHA","+0","muted"]].map(([n,v,t]) => (
          <div key={n} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--ink-border)",
            borderRadius: 6, padding: "9px 12px", fontSize: 12,
          }}>
            <span style={{ color: "var(--ink-muted-fg)", letterSpacing: "0.05em" }}>{n}</span>
            <span style={{ color: t === "gold" ? "var(--ink-accent)" : "var(--ink-fg)", fontFamily: "var(--ink-display)", fontSize: 14 }}>
              {t === "gold" && <span style={{ marginRight: 4 }}>●</span>}{v}
            </span>
          </div>
        ))}
      </div>
      <div className="ink-heading" style={{ margin: "16px 0 10px" }}>⚔ DEFENSES</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[["AC","17"],["INIT","+2"],["SPD","30"]].map(([n,v]) => (
          <div key={n} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--ink-border)", borderRadius: 6, padding: "10px", textAlign: "center" }}>
            <div className="ink-eyebrow">{n}</div>
            <div className="j-display" style={{ fontSize: 22, color: "var(--ink-fg)", marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FRNotebookSnippet() {
  return (
    <div className="j-card-paper" style={{ padding: 20, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span className="j-folio">Session XII</span>
        <span style={{ fontSize: 11, color: "var(--ink-muted-fg)", fontStyle: "italic" }}>Last waxing crescent</span>
      </div>
      <h4 className="j-display" style={{ fontSize: 18, color: "var(--ink-fg)", margin: 0, marginBottom: 8 }}>The Tolling at Shadepoint</h4>
      <JDropCap style={{ fontSize: 13, lineHeight: 1.65, color: "var(--ink-muted-fg)" }}>
        We arrived past second bell. The keeper would not look us in the eye, and yet he had set out three cups. Thalindra
        marked the page with iron filings — proof of recent abjuration — and slipped the keeper a coin he did not want to take.
      </JDropCap>
      <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
        <span className="j-chip">★ The Keeper</span>
        <span className="j-chip j-chip-purple">⚔ Combat: 2</span>
        <span className="j-chip">★ Iron filings</span>
      </div>
    </div>
  );
}

function FRHomebrewSnippet() {
  return (
    <div className="j-card-paper" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span className="j-folio">House rules · The Coven of Greyfen</span>
        <span style={{ color: "var(--ink-accent)", fontSize: 10, letterSpacing: "0.1em" }}>● ACTIVE</span>
      </div>
      <h4 className="j-display" style={{ fontSize: 18, color: "var(--ink-fg)", margin: 0, marginBottom: 4 }}>The Witch</h4>
      <p style={{ fontSize: 12, color: "var(--ink-muted-fg)", margin: 0, marginBottom: 14, fontStyle: "italic" }}>
        A custom class · CHA-based · Hit die d8
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[
          ["Lvl 1", "Evil Eye", "Curse a creature you can see (Prof. Mod / short rest)"],
          ["Lvl 1", "Familiar", "A toad, raven, or hare. Speaks one tongue you do not."],
          ["Lvl 3", "Coven Pact", "Choose your patronage — Hearth, Hollow, or Tide."],
        ].map(([lvl, name, desc]) => (
          <div key={name} style={{
            display: "grid", gridTemplateColumns: "auto auto 1fr", gap: 10, alignItems: "baseline",
            padding: "8px 12px",
            background: "rgba(255,255,255,0.015)",
            border: "1px solid var(--ink-border)", borderRadius: 6,
          }}>
            <span className="ink-eyebrow" style={{ color: "var(--ink-accent)" }}>{lvl}</span>
            <span style={{ fontSize: 12.5, color: "var(--ink-fg)", fontWeight: 600 }}>{name}</span>
            <span style={{ fontSize: 11.5, color: "var(--ink-muted-fg)" }}>{desc}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: "var(--ink-muted-fg)" }}>
        ✦ &nbsp;Shared with 3 players at your table — math handled.
      </div>
    </div>
  );
}

function Quote({ name, body, gold }) {
  return (
    <div style={{
      padding: 22,
      background: gold ? "rgba(201,164,74,0.04)" : "rgba(255,255,255,0.015)",
      border: `1px solid ${gold ? "rgba(201,164,74,0.3)" : "var(--ink-border)"}`,
      borderRadius: 10, position: "relative",
    }}>
      <span className="j-pull-mark" style={{ position: "absolute", left: 14, top: 14 }}>“</span>
      <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--ink-fg)", margin: 0, marginLeft: 26, marginTop: 8, marginBottom: 14, fontFamily: "var(--ink-display)", fontStyle: "normal" }}>
        {body}
      </p>
      <div style={{ marginLeft: 26, fontSize: 11, color: "var(--ink-muted-fg)", letterSpacing: "0.05em", textTransform: "uppercase" }}>— {name}</div>
    </div>
  );
}

Object.assign(window, { LandingFeatureForward });
