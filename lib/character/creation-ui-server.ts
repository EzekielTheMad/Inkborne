import "server-only";

// Preparation only. Native creation, writer fences and class acquisition must
// be accepted before enabling this server-only flag in any environment.
export function characterCreationUIEnabled(): boolean {
  return process.env.INKBORNE_CLASS_ORIGIN_CREATION_UI === "true";
}

/** Enabled only with the finite native overlay in the approved local profile. */
export function basicSheetCommandsEnabled(): boolean {
  return characterCreationUIEnabled() && process.env.INKBORNE_BASIC_SHEET_COMMANDS === "true";
}
