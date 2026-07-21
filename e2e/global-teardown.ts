/**
 * Global teardown: safety-net sweep of any E2E-prefixed characters left on the
 * test account (individual specs delete their own fixtures in afterAll; this
 * catches leftovers from crashed or interrupted runs).
 */
import {
  sweepE2ECampaigns,
  sweepE2ECharacters,
  sweepE2EHomebrewSpells,
} from "./helpers/supabase";

export default async function globalTeardown(): Promise<void> {
  try {
    const campaignsRemoved = await sweepE2ECampaigns();
    if (campaignsRemoved > 0) {
      console.log(`[e2e] Swept ${campaignsRemoved} leftover E2E campaign(s).`);
    }
    const removed = await sweepE2ECharacters();
    if (removed > 0) {
      console.log(`[e2e] Swept ${removed} leftover E2E character(s).`);
    }
    const spellsRemoved = await sweepE2EHomebrewSpells();
    if (spellsRemoved > 0) {
      console.log(`[e2e] Swept ${spellsRemoved} leftover E2E homebrew spell(s).`);
    }
  } catch (err) {
    // Best-effort: don't fail the run over a sweep error, but make it visible.
    console.warn(
      `[e2e] Character sweep failed: ${err instanceof Error ? err.message : err}`,
    );
  }
}
