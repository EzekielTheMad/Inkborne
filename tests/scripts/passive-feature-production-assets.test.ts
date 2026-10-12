import { describe, expect, it } from "vitest";
import { validatePassiveFeatureBuildReceipt, approvedPassiveFeatureSource, passiveFeatureSourcePaths } from "../../scripts/passive-feature-production-assets.mjs";
const source = "1".repeat(40);
const good = { gate:"build", exitCode:0, sourceSha:source, sourceStatus:[] };
describe("passive feature offline preflight, source-only controls until resource release",()=>{
 it("accepts only successful current clean build receipts",()=>{expect(()=>validatePassiveFeatureBuildReceipt(good,source)).not.toThrow();expect(()=>validatePassiveFeatureBuildReceipt({...good,sourceStatus:""},source)).not.toThrow();});
 it.each([null,[],{}, { ...good,gate:"check" }, { ...good,exitCode:1 }, { ...good,sourceSha:"2".repeat(40) },
   { ...good,sourceStatus:[" M components/library/passive-feature-form.tsx"] }, { ...good,sourceStatus:"dirty" }, { ...good,sourceStatus:null },
   { ...good,sourceStatus:undefined }].map(receipt=>({receipt})))("rejects failed/stale/malformed/dirty receipt $receipt",({receipt})=>{expect(()=>validatePassiveFeatureBuildReceipt(receipt,source)).toThrow();});
 it("binds the immutable approved product rather than a harness or unverified later source",()=>{
  expect(approvedPassiveFeatureSource).toBe("6f43b57b574faaeb7536aad4ded592cb1bb1e449");
  expect(passiveFeatureSourcePaths).toEqual(["components/library/passive-feature-form.tsx","lib/homebrew/passive-feature-form.ts","lib/supabase/homebrew-passive-features-server.ts","app/(app)/homebrew/features/actions.ts"]);
 });
});
