# Align displayed HP gain with the sheet - October 2, 2026

Actual ClassStepClient level-up controls reproduced zero/negative HP gain labels for a low-Constitution wizard, while the existing computeMaxHp calculation already applies a minimum of one per level. Free-choice Average and locked Average regressions failed before repair.

All HP picker gain labels now apply that existing minimum: deterministic Average/Max, the Average button, stored Manual/Rolled labels and total gain. This is display alignment only. Raw die contributions, roll generation, persisted records, campaign rules and sheet math are unchanged. Real-client tests verify Average displays +1 but saves raw value 4; additional picker cases cover stored Manual/Rolled and locked Max. Existing max-HP tests were included in targeted verification.

Full npm.cmd run check passed strict types, zero-warning lint and 203 files / 1,966 tests. A test fixture extra-property type error was corrected using the existing campaign fixture shape; final strict checks passed. Loopback-placeholder build passed Next 16.2.10 compile, TypeScript and 24 static pages. Eighteen isolated builder Chrome checks passed with no remote requests/page errors, including mobile low-Constitution preview and exact raw persistence. Existing five play-save checks cover unchanged play code. No hosted operations, installs, schema/security/credential changes or remote Git operations.

Rolled-only handling of existing Manual/Average records remains unchanged while its policy is clarified. This does not add HP rules or certify system-wide readiness. Cross-client/ambiguous outcomes, durable grants and choice/reference atomicity remain open; not release-ready.
