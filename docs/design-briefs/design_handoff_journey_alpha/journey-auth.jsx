/* global React, JLogo, JRule, JStarRule, JInkstain, JCornerOrnament, JImg, JQuill */

// ─── AUTHENTICATION SURFACES ────────────────────────────────────────────
// Three connected surfaces with consistent paper-warm card framing,
// gold-on-vellum chrome, ambient inkstain backgrounds.

function AuthShell({ children, sub }) {
  return (
    <div className="ink j-grain" style={{
      minHeight: "100%",
      display: "flex", flexDirection: "column",
      background: "var(--ink-bg)", position: "relative", overflow: "hidden",
    }}>
      <JInkstain width={520} height={360} opacity={0.05} style={{ left: -120, top: -60 }} />
      <JInkstain width={420} height={300} opacity={0.04} color="var(--ink-primary)" style={{ right: -100, bottom: 40 }} />
      <header style={{ padding: "22px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
        <JLogo size={18} />
        {sub && <span className="j-marginalia" style={{ fontSize: 12 }}>{sub}</span>}
      </header>
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px", position: "relative" }}>
        {children}
      </main>
      <footer style={{ padding: "20px 28px", display: "flex", justifyContent: "center", color: "var(--ink-muted-fg)", fontSize: 11, letterSpacing: "0.05em" }}>
        ✦ &nbsp; Inkborne is in private alpha &nbsp; ✦
      </footer>
    </div>
  );
}

// ─── Login (centered card, polished) ───────────────────────────────
function AuthLogin() {
  return (
    <AuthShell sub="“Open the notebook.”">
      <div className="j-card-paper" style={{ width: 400, padding: 36, position: "relative" }}>
        <div className="j-folio" style={{ marginBottom: 10, textAlign: "center" }}>Folio I · Sign in</div>
        <h2 className="j-display" style={{ fontSize: 28, textAlign: "center", color: "var(--ink-fg)", margin: 0, marginBottom: 6 }}>
          Welcome back.
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-muted-fg)", textAlign: "center", margin: 0, marginBottom: 24 }}>
          Your characters are right where you left them.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          <button className="j-oauth"><span style={{ color: "#5865f2" }}>◆</span> Continue with Discord</button>
          <button className="j-oauth"><span style={{ color: "#ea4335" }}>◆</span> Continue with Google</button>
        </div>

        <div className="j-rule" style={{ marginBottom: 18, fontSize: 11, color: "var(--ink-muted-fg)" }}>
          <span className="j-rule-glyph" style={{ fontSize: 11 }}>or</span>
        </div>

        <label className="ink-eyebrow" style={{ display: "block", marginBottom: 6 }}>Email</label>
        <input className="j-input" placeholder="you@kindred.gg" defaultValue="" style={{ marginBottom: 14 }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <label className="ink-eyebrow">Password</label>
          <a className="j-nav-link" style={{ fontSize: 11 }}>Forgot?</a>
        </div>
        <input className="j-input" type="password" defaultValue="••••••••" style={{ marginBottom: 22 }} />

        <button className="j-btn-gold" style={{ width: "100%" }}>Sign in →</button>

        <p style={{ textAlign: "center", marginTop: 22, fontSize: 12.5, color: "var(--ink-muted-fg)" }}>
          New here? <a className="j-nav-link" style={{ color: "var(--ink-accent)", textDecoration: "underline", textUnderlineOffset: 3 }}>Request access</a>
        </p>
      </div>
    </AuthShell>
  );
}

// ─── Login error state ────────────────────────────────────────────
function AuthLoginError() {
  return (
    <AuthShell sub="“Try again, traveler.”">
      <div className="j-card-paper" style={{ width: 400, padding: 36, position: "relative", borderColor: "rgba(220,38,38,0.4)" }}>
        <div className="j-folio" style={{ marginBottom: 10, textAlign: "center" }}>Folio I · Sign in</div>
        <h2 className="j-display" style={{ fontSize: 28, textAlign: "center", color: "var(--ink-fg)", margin: 0, marginBottom: 24 }}>
          Welcome back.
        </h2>

        <div style={{
          padding: "12px 14px", marginBottom: 18,
          background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.35)",
          borderRadius: 6, color: "#f4a3a3", fontSize: 12.5, lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: "#fbb" }}>That didn't match.</div>
          The email or password isn't recognized. Try once more, or <a className="j-nav-link" style={{ color: "var(--ink-accent)", textDecoration: "underline" }}>reset your password</a>.
        </div>

        <label className="ink-eyebrow">Email</label>
        <input className="j-input" defaultValue="raven@kindred.gg" style={{ margin: "6px 0 14px", borderColor: "rgba(220,38,38,0.4)" }} />

        <label className="ink-eyebrow">Password</label>
        <input className="j-input" type="password" defaultValue="••••••" style={{ margin: "6px 0 22px", borderColor: "rgba(220,38,38,0.4)" }} />

        <button className="j-btn-gold" style={{ width: "100%" }}>Try again</button>
      </div>
    </AuthShell>
  );
}

// ─── Signup ─────────────────────────────────────────────────────────
function AuthSignup() {
  return (
    <AuthShell sub="“Open a new notebook.”">
      <div className="j-card-paper" style={{ width: 400, padding: 36, position: "relative" }}>
        <div className="j-folio" style={{ marginBottom: 10, textAlign: "center" }}>Folio I · Begin</div>
        <h2 className="j-display" style={{ fontSize: 28, textAlign: "center", color: "var(--ink-fg)", margin: 0, marginBottom: 6 }}>
          Open a notebook.
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-muted-fg)", textAlign: "center", margin: 0, marginBottom: 24 }}>
          Inkborne is in alpha. Access is gated, but free.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          <button className="j-oauth"><span style={{ color: "#5865f2" }}>◆</span> Continue with Discord</button>
          <button className="j-oauth"><span style={{ color: "#ea4335" }}>◆</span> Continue with Google</button>
        </div>

        <div className="j-rule" style={{ marginBottom: 18, fontSize: 11, color: "var(--ink-muted-fg)" }}>
          <span className="j-rule-glyph" style={{ fontSize: 11 }}>or</span>
        </div>

        <label className="ink-eyebrow" style={{ display: "block", marginBottom: 6 }}>What should we call you?</label>
        <input className="j-input" placeholder="A name (any will do)" style={{ marginBottom: 14 }} />

        <label className="ink-eyebrow" style={{ display: "block", marginBottom: 6 }}>Email</label>
        <input className="j-input" placeholder="you@kindred.gg" style={{ marginBottom: 14 }} />

        <label className="ink-eyebrow" style={{ display: "block", marginBottom: 6 }}>Choose a password</label>
        <input className="j-input" type="password" placeholder="At least 8 characters" style={{ marginBottom: 22 }} />

        <button className="j-btn-gold" style={{ width: "100%" }}>Request access →</button>

        <p style={{ textAlign: "center", marginTop: 18, fontSize: 11.5, color: "var(--ink-muted-fg)", lineHeight: 1.55 }}>
          By continuing you agree to our <a className="j-nav-link" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>terms</a>.<br />
          Already have an account? <a className="j-nav-link" style={{ color: "var(--ink-accent)", textDecoration: "underline" }}>Sign in</a>
        </p>
      </div>
    </AuthShell>
  );
}

// ─── Verify (the redesigned "what now") ──────────────────────────────
function AuthVerify() {
  return (
    <AuthShell sub="“Mid-stitch.”">
      <div className="j-card-paper" style={{ width: 480, padding: 40, position: "relative", textAlign: "center" }}>
        <JQuill size={56} opacity={0.5} />
        <div className="j-folio" style={{ marginTop: 12, marginBottom: 10 }}>Folio II · Confirm</div>
        <h2 className="j-display" style={{ fontSize: 26, color: "var(--ink-fg)", margin: 0, marginBottom: 10 }}>
          We sent you a letter.
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--ink-muted-fg)", lineHeight: 1.6, margin: 0, marginBottom: 24 }}>
          Check <span style={{ color: "var(--ink-accent)" }}>raven@kindred.gg</span> for a confirmation link.
          Most arrive within 30 seconds.
        </p>

        {/* Step indicators */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--ink-border)", borderRadius: 8, padding: 16, textAlign: "left", marginBottom: 18 }}>
          <div className="ink-heading" style={{ marginBottom: 12 }}>If it doesn't arrive…</div>
          <Step n="I" body="Check your spam or promotions tab — alpha mail sometimes lands there." />
          <Step n="II" body="Add inkborne@inkborne.app to your contacts and try resending." />
          <Step n="III" body="Still nothing after 5 minutes? Use the alternate confirm link below." />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 16 }}>
          <button className="j-btn-quiet j-btn-sm">Resend email</button>
          <button className="j-btn-quiet j-btn-sm">Use alternate confirm link</button>
        </div>

        <p style={{ fontSize: 11.5, color: "var(--ink-muted-fg)", margin: 0 }}>
          Wrong address? <a className="j-nav-link" style={{ color: "var(--ink-accent)", textDecoration: "underline", textUnderlineOffset: 3 }}>Restart</a>
        </p>
      </div>
    </AuthShell>
  );
}

function Step({ n, body }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0" }}>
      <span className="j-display" style={{ fontSize: 14, color: "var(--ink-accent)", opacity: 0.8, flexShrink: 0, width: 18 }}>{n}.</span>
      <span style={{ fontSize: 12.5, color: "var(--ink-muted-fg)", lineHeight: 1.5 }}>{body}</span>
    </div>
  );
}

// ─── Split-screen variant (visual half) ──────────────────────────────
function AuthSplitScreen() {
  return (
    <div className="ink" style={{ minHeight: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden" }}>
      {/* Visual panel */}
      <div className="j-grain j-grain-noise" style={{ background: "var(--ink-deep)", padding: 44, position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <JInkstain width={420} height={300} opacity={0.08} style={{ left: -80, top: 80 }} />
        <JInkstain width={360} height={260} opacity={0.06} color="var(--ink-primary)" style={{ right: -60, bottom: 100 }} />

        <JLogo size={20} />

        <div style={{ position: "relative", maxWidth: 420 }}>
          <div className="j-folio" style={{ marginBottom: 16 }}>From an open folio</div>
          <p className="j-display-italic" style={{
            fontSize: 26, lineHeight: 1.45, color: "var(--ink-fg)", fontStyle: "italic", margin: 0,
          }}>
            “Last night the bell tolled twice in Shadepoint. T. asks me to memorize Detect Magic before sundown.”
          </p>
          <p style={{ fontFamily: "var(--ink-display)", marginTop: 18, color: "var(--ink-accent)", fontSize: 13, letterSpacing: "0.1em" }}>
            — Thalindra Moonweave, Folio 14
          </p>
        </div>

        <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--ink-muted-fg)" }}>
          <span>Your characters, kept by you.</span>
          <span style={{ color: "var(--ink-accent)" }}>★ MIT licensed</span>
        </div>
      </div>

      {/* Form panel */}
      <div style={{ background: "var(--ink-bg)", padding: 60, display: "flex", alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: 360 }}>
          <div className="j-folio" style={{ marginBottom: 8 }}>Sign in</div>
          <h2 className="j-display" style={{ fontSize: 32, color: "var(--ink-fg)", margin: 0, marginBottom: 8 }}>Welcome back.</h2>
          <p style={{ fontSize: 13.5, color: "var(--ink-muted-fg)", margin: 0, marginBottom: 28 }}>
            Pick up where you left off.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
            <button className="j-oauth"><span style={{ color: "#5865f2" }}>◆</span> Continue with Discord</button>
            <button className="j-oauth"><span style={{ color: "#ea4335" }}>◆</span> Continue with Google</button>
          </div>

          <div className="j-rule" style={{ marginBottom: 18, fontSize: 11, color: "var(--ink-muted-fg)" }}>
            <span className="j-rule-glyph" style={{ fontSize: 11 }}>or</span>
          </div>

          <label className="ink-eyebrow" style={{ display: "block", marginBottom: 6 }}>Email</label>
          <input className="j-input" placeholder="you@kindred.gg" style={{ marginBottom: 14 }} />
          <label className="ink-eyebrow" style={{ display: "block", marginBottom: 6 }}>Password</label>
          <input className="j-input" type="password" defaultValue="••••••••" style={{ marginBottom: 22 }} />

          <button className="j-btn-gold" style={{ width: "100%" }}>Sign in →</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AuthLogin, AuthLoginError, AuthSignup, AuthVerify, AuthSplitScreen });
