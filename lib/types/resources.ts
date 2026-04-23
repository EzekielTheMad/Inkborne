// Feature Resources — shared types for class-feature usage counters.
//
// A FeatureResource represents one counter on the sheet (Rage, Ki, one entry
// from extraLimitedFeatures, etc.). Max is computed from content data; spent
// is tracked in CharacterState.feature_uses, keyed by `slug`.

export type ResourceRecovery = "short" | "long";

export interface FeatureResource {
  /** Key into CharacterState.feature_uses. For primary feature resources this is
   *  the feature content slug; for extraLimitedFeatures it is `${slug}.${extraKey}`. */
  slug: string;

  /** Display name, e.g. "Rage" or "Wild Shape: Rampage". */
  name: string;

  /** Maximum uses/points at the character's current level in the source class. */
  max: number;

  /** Normalized recovery type: "short" (short rest) or "long" (long rest).
   *  "dawn" and "day" from schema are both mapped to "long". */
  recovery: ResourceRecovery;

  /** Display label for source, e.g. "Barbarian 1". Shown on the feature card variant. */
  sourceLabel: string;

  /** Slug of the parent feature that owns this resource. Equals `slug` for primary
   *  resources; differs for extraLimitedFeatures (parent slug) vs sub-resource slug. */
  sourceFeatureSlug: string;
}
