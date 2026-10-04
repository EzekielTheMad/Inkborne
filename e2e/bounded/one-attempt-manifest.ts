import { BoundedManifest, type Reservation } from "./manifest";
/** Separate renewed allowance; never extends or resets the exhausted original run. */
export class OneAttemptManifest extends BoundedManifest {
  constructor(file: string, runId: string) {
    super(file, runId);
    if (this.attempts.length > 1) { this.close(); throw new Error("State-controls journal exceeds its one-attempt allowance"); }
  }
  override reserve(ownerId: string, label: string): Reservation {
    if (process.env.INKBORNE_STATE_CONTROLS_APPROVED_RUN_ID !== this.runId)
      throw new Error("State-controls creation requires the exact approved run gate");
    if (this.attempts.length !== 0) throw new Error("State-controls one creation attempt is already consumed");
    return super.reserve(ownerId, label);
  }
}
