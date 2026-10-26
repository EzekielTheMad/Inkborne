# Local auth notebook refresh

User-authorized scope: sign in, signup, and recovery pages, with the approved
notebook personality, Scribe identity, and coordinated themes. Preserve the
existing authentication behavior and keep the result local for review.

- Use a shared scoped notebook shell for login, signup, forgot/reset password,
  verification, and its no-email/loading variants.
- Preserve native form fields/validation, server actions, provider gating,
  redirects, callback/session handling, and recovery/resend SDK calls.
- Keep new theme colors inside the auth surface and its appearance menu.
- Preserve functional identity and existing ink-purple/gold personality; use the
  approved logo assets and existing font pipeline. Mobile favors a readable form.
- Review both themes, saved/System preference, keyboard focus, 44 px controls,
  long content, pending/error/success states, and responsive bounds.
- Validate real local Next.js routes with loopback-only fixtures. Existing/new
  mocked tests verify preserved auth contracts; no hosted accounts, mail, password
  updates, security settings, or deployment are authorized by this UI refresh.

The [implementation and review record](../design-briefs/auth-notebook-local/README.md)
contains source ancestry, local commands, evidence, and limitations.
