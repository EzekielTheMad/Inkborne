import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { characterCreationUIEnabled } from "@/lib/character/creation-ui-server";
import { createClient } from "@/lib/supabase/server";
import { FirstClassForm } from "./first-class-form";
import { checkFirstClass, submitFirstClass } from "./actions";

export default async function FirstClassPage({ params }: { params: Promise<{ id: string }> }) {
  if (!characterCreationUIEnabled()) notFound();
  const { id } = await params;
  const client = await createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) redirect("/login");
  const { data: character, error } = await client.from("characters")
    .select("id,user_id,system_id,campaign_id,action_revision,choices,game_systems(slug,status)").eq("id", id).single();
  if (error || !character || character.user_id !== user.id) notFound();
  // This only controls whether the UI offers a new choice. The RPC independently
  // requires the genuine committed bootstrap, current owner and exact empty graph.
  const system = z.object({ slug: z.string(), status: z.string() }).safeParse(character.game_systems);
  const canStart = system.success && system.data.slug === "dnd-5e-2014" && system.data.status === "published" && character.campaign_id === null
    && (character.action_revision === 0 || character.action_revision === "0")
    && character.choices !== null && typeof character.choices === "object" && !Array.isArray(character.choices)
    && Object.keys(character.choices).length === 0;
  const { data: rows, error: contentError } = canStart ? await client.from("content_definitions")
    .select("id,name,version").eq("system_id", character.system_id).eq("content_type", "class").order("name")
    : { data: [], error: null };
  const classes = contentError ? [] : (rows ?? []);
  return <div className="mx-auto max-w-lg space-y-4">
    <h1 className="text-2xl font-semibold">Choose your first class</h1>
    <p className="text-muted-foreground">Save one class to begin this notebook.</p>
    {contentError && <p role="status">Available classes could not be loaded. Your unfinished save is still available below.</p>}
    <FirstClassForm accountId={user.id} characterId={id} classes={classes} canStart={canStart}
      submitAction={submitFirstClass.bind(null, user.id)} checkAction={checkFirstClass.bind(null, user.id)} />
  </div>;
}
