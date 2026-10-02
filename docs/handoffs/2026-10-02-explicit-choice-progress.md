# Explicit pinned-choice progress — October 2, 2026

> Historical milestone record. Counts/status describe this checkpoint. Use [CURRENT-STATE](../CURRENT-STATE.md) and the [release checklist](../RELEASE-READINESS.md) for current authority.

The actual builder overview/navigation previously marked a background Complete despite an unselected required proficiency, duplicate picks or a pick outside the saved definition's explicit options. Three journey regressions reproduced that behavior before repair.

The shared status helper now validates direct explicit-array ChoiceEffects on the uniquely matched selected class/subclass/race/subrace/background pins. Required pick count, uniqueness and membership must match the pinned option list. Successful complete picks and incomplete picks are checked through both actual overview and navigation. This reads saved choices/refs only and adds no navigation hard gate or writes.

`npm.cmd run check`: types, zero-warning lint, 203 files / 1,931 tests passed. Local placeholder `npm.cmd run build` passed Next 16.2.10 compile, TypeScript and 24 static pages. Existing builder nine and play-save five isolated Chrome checks cover unchanged browser interaction paths; this server status change uses rendered journey tests. No installs, hosted reads/writes, schema changes or remote operations.

This is bounded progress, not whole-character readiness: category-string sources (for example language catalogs), independently referenced race traits, per-level features, ASI/feat eligibility and system-specific playability still need their authoritative resolvers. Malformed rows omitted by the existing fetcher and cross-query snapshots remain separate integrity risks. Equipment durable atomicity and cross-client/ambiguous write outcomes remain unresolved. No pins or choices are repaired automatically.
