# Mobile class save feedback — October 2, 2026

> Historical milestone record. Counts/status describe this checkpoint. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current authority.

The actual mobile ClassStepClient level-up drawer had no accessible pending or failed-save message in its own dialog. Parent feedback was behind the modal, and portal controls did not inherit the parent's disabled fieldset. A real-drawer regression failed before repair.

The existing parent savePending/saveError state is now threaded through the rail into mobile level-up and level-detail drawers. Both render pending/error feedback inside the drawer and disable their actual portal controls during persistence. Synchronous parent action gates remain in place. No new save owner, cancellation protocol or automatic retry was added; native routing/back behavior remains unchanged.

Actual UI tests cover both drawer paths: pending control/confirmation refusal, failed HP or proficiency rollback, readable error without backend details, and explicit retry. `npm.cmd run check`: strict types, zero-warning lint, 203 files / 1,940 tests passed. Loopback-placeholder build: Next 16.2.10, TypeScript and 24 static pages passed. Twelve isolated builder Chrome checks passed; the existing mobile HP case now checks pending disabled controls and visible error inside the drawer. Pending/failure screenshots inspected. No remote requests or page errors; prior five play-save checks cover unchanged play code.

The initial browser locator assumed the pending selected radio was named Manual; it actually displays Manual (+3). The corrected name-prefix locator passed. This was a fixture issue, not evidence of a hidden control.

No hosted operations, schema changes, installs, remote Git changes or secret reads. Cross-client and ambiguous outcomes, durable equipment grants and full system readiness remain unresolved. Not release-ready.
