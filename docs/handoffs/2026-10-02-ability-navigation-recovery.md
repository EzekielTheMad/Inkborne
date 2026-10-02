# Ability editor navigation and closed sessions

The isolated playable-core branch now warns before same-window header/app links leave pending or failed ability drafts. Declining keeps the editor open with an accessible recovery notice. Successful confirmation clears the block; browser unload also requests the browser's unsaved-changes warning. Existing builder Previous/Next controls remain disabled while saving or failed.

Closing the editor aborts its transport signal, drops unsent queued drafts, and ignores old completion callbacks. The real Supabase client receives the signal for both its guarded read and patch; closing during a read prevents the patch. An already accepted server write cannot be rolled back by aborting a request.

Interaction tests use the actual editor and Next Link, with only persistence mocked. They cover header navigation, unload, recovery after success, old queued drafts and completion after reopening. Transport tests use the real client with mocked fetch and assert no patch after closure; no hosted requests occur.

Limits: SPA history back/forward and direct router commands require separate integration. Browser unload warnings depend on browser behavior. New-tab/modifier, download and same-page hash links are allowed. Multi-client concurrency and ambiguous server completion remain release/UAT prerequisites. No schema, hosted writes, dependency install, push or deploy.

Validation: npm run check passed (TypeScript, zero-warning lint, 1,860 tests across 201 files). Production build passed with local placeholder service configuration and reused matching dependencies. This is not hosted acceptance or a fresh dependency installation.
