import Link from "next/link";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { PassiveFeatureForm } from "@/components/library/passive-feature-form";
import { getOwnedHomebrewPassiveFeature } from "@/lib/supabase/homebrew-passive-features-server";
import { createClient } from "@/lib/supabase/server";
export default async function EditPassiveFeaturePage({ params }: { params: Promise<{ id: string }> }) {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  const { id } = await params;
  let feature;
  try { feature = await getOwnedHomebrewPassiveFeature(id); } catch (error) {
    // No mutation/normalization of unsupported definitions from an edit route.
    unstable_rethrow(error);
    return <div role="alert" className="j-card-paper mx-auto max-w-3xl space-y-3 p-6"><h1 className="j-display text-2xl">Feature unavailable for editing</h1>
      <p>The feature could not be loaded or contains unsupported data. No changes were saved.</p><Link href="/homebrew">Return to Homebrew</Link></div>;
  }
  if (!feature) notFound();
  return <div className="mx-auto w-full max-w-3xl space-y-6"><div><p className="j-folio">Private standalone feature · version {feature.version}</p>
    <h1 className="j-display mt-2 text-3xl [overflow-wrap:anywhere]">Edit {feature.name}</h1></div><PassiveFeatureForm key={`${feature.id}:${feature.version}`} mode="edit" initialValue={feature} /></div>;
}
