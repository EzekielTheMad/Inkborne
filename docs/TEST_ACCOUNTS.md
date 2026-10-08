# Test accounts and documentation hygiene

## Use isolated, private test identities

- Create disposable users in a development Supabase project with synthetic
  characters and campaigns. Never use a production account or real user data.
- Store credentials only in an uncommitted `.env.local` or an approved secret
  store. In documentation, refer to variable names rather than literal values.
- Playwright uses `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD`. Flows with a separate
  player also use `E2E_PLAYER_EMAIL` and `E2E_PLAYER_PASSWORD`; consult
  `e2e/helpers/supabase.ts` for the exact fallback behavior.
- Keep `e2e/.auth/`, traces, screenshots, logs, and generated test artifacts out
  of Git. These can contain live sessions or private information.
- Use reserved example domains such as `example.test` in static mock data.
  An example address is not an invitation to create a shared public account.

## Historical credential cleanup

Archived design and implementation documents previously included reusable
login details. The current-tree cleanup replaces those literals with environment
variable references. It does not prove that the account was disposable, empty,
or unable to access a live deployment. No login was attempted to check validity.

Before treating the exposure as contained, the account owner should:

1. Locate the matching account privately and determine its deployment, data,
   permissions, and active sessions.
2. Replace its credential and revoke sessions, or disable it if no longer needed.
   Do not post the old or new values in an issue or pull request.
3. Check for reused credentials and review relevant access logs.
4. Decide separately whether published Git history, PR refs, cached views, or
   downstream copies need remediation. Editing the current tree is not erasure.

The automated secret scan is a guardrail, not proof of absence. Low-entropy
passwords and ordinary-looking personal data may evade a generic scanner.
