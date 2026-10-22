import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { characterCreationUIEnabled } from "@/lib/character/creation-ui-server";
import { classRoleRevisionSchema } from "@/lib/character/class-role-effects-schema";
import { createClient } from "@/lib/supabase/server";
import { getContentRefsByCharacter } from "@/lib/supabase/content-refs";
import { FirstClassForm } from "./first-class-form";
import { checkFirstClass, submitFirstClass } from "./actions";

const savedChoices = z.object({ classes: z.tuple([z.strictObject({
  occurrence_id: z.uuid(), slug: z.string().min(1).max(200), level: z.literal(1),
})]) });
const controllerContext = z.strictObject({ source: z.literal("class"), level: z.literal(1) });

export default async function FirstClassPage({ params }: { params: Promise<{ id: string }> }) {
  if (!characterCreationUIEnabled()) notFound();
  const { id } = await params;
  const client = await createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) redirect("/login");
  const { data: character, error } = await client.from("characters")
    .select("id,user_id,system_id,campaign_id,level,action_revision,choices,game_systems(slug,status)").eq("id", id).single();
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
  let savedClass: { name: string; level: 1 } | null = null;
  let savedClassUnavailable = false;
  if (character.choices !== null && typeof character.choices === "object" && !Array.isArray(character.choices)
    && "classes" in character.choices) {
    try {
      const selected = savedChoices.safeParse(character.choices);
      const rawRevision = typeof character.action_revision === "string" ? character.action_revision
        : Number.isSafeInteger(character.action_revision) ? String(character.action_revision) : null;
      const revision = classRoleRevisionSchema.safeParse(rawRevision);
      if (!selected.success || !revision.success || revision.data === "0" || character.level !== 1
        || !system.success || system.data.slug !== "dnd-5e-2014") throw Error("Saved class unavailable");
      // Reuse the complete public-row/pinned-version reader. Never substitute
      // today's catalog, infer an absent pin or display a partially read graph.
      const refs = await getContentRefsByCharacter(id, { requireCompleteSnapshots: true, fresh: true });
      const controllers = refs.filter(ref => ["class", "subclass"].includes(ref.content_definitions.content_type));
      const selectedClass = selected.data.classes[0];
      if (controllers.length !== 1 || refs.some(ref => ref.character_id !== id)) throw Error("Saved class unavailable");
      const pin = controllers[0], snapshot = pin.content_definitions;
      if (snapshot.content_type !== "class" || snapshot.system_id !== character.system_id || snapshot.slug !== selectedClass.slug
        || pin.content_id !== snapshot.id || pin.content_version !== snapshot.version
        || pin.feature_grant_id !== null || pin.choice_source !== null || !controllerContext.safeParse(pin.context).success)
        throw Error("Saved class unavailable");
      savedClass = { name: snapshot.name, level: selectedClass.level };
    } catch { savedClassUnavailable = true; }
  }
  return <div className="mx-auto max-w-lg space-y-4">
    <h1 className="text-2xl font-semibold">{savedClass ? "Your first class" : "Choose your first class"}</h1>
    {savedClass ? <section aria-labelledby="saved-first-class" className="space-y-2 rounded-md border p-4">
      <h2 id="saved-first-class" className="font-semibold">Saved class</h2>
      <p>{savedClass.name} · Level {savedClass.level}</p>
      <p>Your class is saved to this notebook.</p>
      <Link href="/characters" className="text-sm underline">Back to your characters</Link>
    </section> : <p className="text-muted-foreground">Save one class to begin this notebook.</p>}
    {savedClassUnavailable && <p role="status">Your saved class could not be read completely. Keep any unfinished request and reload before making changes.</p>}
    {contentError && <p role="status">Available classes could not be loaded. Your unfinished save is still available below.</p>}
    <FirstClassForm accountId={user.id} characterId={id} classes={classes} canStart={canStart} hasSavedClass={savedClass !== null}
      submitAction={submitFirstClass.bind(null, user.id)} checkAction={checkFirstClass.bind(null, user.id)} />
  </div>;
}
