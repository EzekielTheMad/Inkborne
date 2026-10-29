<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Shared contracts and productive continuation

- At kickoff and every continuation (including context compaction), read
  `docs/SHARED-DOMAIN-CONTRACT.md` and `docs/CONTINUE-INKBORNE.md` before product
  work. Preserve the explicitly assigned lane and consult only relevant current
  ledger/handoff sections. Do not restart the global queue from a lane chat.
- Keep shared identity, ownership, permissions, content versions and write
  boundaries consistent with that contract. Coordinate changes through the
  integration owner; do not invent parallel models.
- Follow the continuation prompt's focused-validation and verification stopping
  rules. Report usable behavior delivered, not test counts as progress. Preserve
  mandatory security, data-integrity and release checks.
- Check the [canonical reporting ownership record](docs/dashboard/OWNERSHIP.md)
  at every continuation and edit only assigned reports. Maintain them at meaningful
  checkpoints under [Project Dashboard SOP v1](<C:/Projects/Project Dashboard/docs/REPORTING-SOP.md>).
  Reports summarize the canonical ledger; reporting alone adds no app checks.
