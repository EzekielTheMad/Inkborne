import "server-only";

// Preparation only. Native creation, writer fences and class acquisition must
// be accepted before enabling this server-only flag in any environment.
export function characterCreationUIEnabled(): boolean {
  return process.env.INKBORNE_CLASS_ORIGIN_CREATION_UI === "true";
}
