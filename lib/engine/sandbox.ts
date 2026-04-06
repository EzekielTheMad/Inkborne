/**
 * Tier 3: Script Sandbox (Stub)
 *
 * This module will provide sandboxed JavaScript execution for complex
 * conditional effects (e.g., Barbarian Unarmored Defense).
 *
 * For this sub-project, Tier 3 is stubbed. The evaluator skips script
 * effects. Full implementation comes in a later sub-project.
 */

export interface SandboxResult {
  modifications: Record<string, number>;
}

export function executeScript(
  _script: string,
  _characterContext: Record<string, unknown>
): SandboxResult {
  // Stub — returns no modifications
  return { modifications: {} };
}
