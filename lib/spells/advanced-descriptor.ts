import { z } from "zod";
import { parseContentVersionSnapshot, type ParsedContentDefinition } from "@/lib/supabase/content-definitions-parser";

const nonblank = z.string().refine(value => value.trim().length > 0);
/** Model-only extension: production feature parsing deliberately stays unchanged. */
export const arcanumDescriptorSchema = z.strictObject({
  kind: z.literal("arcanum"),
  listClass: nonblank,
  spellLevel: z.number().int().min(6).max(9),
  selectionCount: z.literal(1),
  castLevel: z.number().int().min(6).max(9),
}).refine(value => value.castLevel === value.spellLevel);
export type ArcanumDescriptor = z.infer<typeof arcanumDescriptorSchema>;
export type ArcanumDescriptorResolution =
  | { status: "available"; feature: ParsedContentDefinition; descriptor: ArcanumDescriptor }
  | { status: "unavailable"; reason: string };

export function parseArcanumFeatureSnapshot(raw: unknown): ArcanumDescriptorResolution {
  const unavailable = (reason: string): ArcanumDescriptorResolution => ({ status: "unavailable", reason });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return unavailable("Missing original immutable feature snapshot");
  const data = (raw as { data_snapshot?: unknown }).data_snapshot;
  if (!data || typeof data !== "object" || Array.isArray(data) || !Object.hasOwn(data, "advanced_casting")) return unavailable("Missing declared Arcanum descriptor");
  const feature = parseContentVersionSnapshot(raw);
  if (!feature || feature.content_type !== "feature") return unavailable("Invalid immutable feature snapshot");
  const payload = data as Record<string, unknown>;
  const descriptor = arcanumDescriptorSchema.safeParse(payload.advanced_casting);
  if (!descriptor.success || payload.usages !== 1 || payload.recovery !== "long rest") return unavailable("Invalid declared Arcanum descriptor or resource payment");
  // This bounded adapter has no second bonus/fixed/free-cast policy.
  if (["atwill", "oncelr", "oncesr", "fixedDC", "fixedSpAttack", "spellcastingAbility"].some(key => Object.hasOwn(payload, key)) ||
    (Object.hasOwn(payload, "spellcastingBonus") && (!Array.isArray(payload.spellcastingBonus) || payload.spellcastingBonus.length > 0))) return unavailable("Conflicting advanced casting policy");
  return { status: "available", feature, descriptor: descriptor.data };
}
