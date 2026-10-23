import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { characterCreationUIEnabled } from "@/lib/character/creation-ui-server";
import { saveBuilderStep } from "../step-actions";
import { DetailsStepClient } from "./details-step-client";

export default async function DetailsStepPage({ params }: { params: Promise<{ id: string }> }) {
  if (!characterCreationUIEnabled()) notFound();
  const { id } = await params;
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");
  const { data: character, error } = await client.from("characters").select("id,user_id,name,choices").eq("id", id).single();
  if (error || !character || character.user_id !== user.id) notFound();
  if (!character.choices?.classes?.length) redirect(`/characters/${id}/builder/first-class`);
  return <DetailsStepClient characterId={id} name={character.name} alignment={character.choices.alignment ?? ""}
    confirmed={character.choices.details_confirmed === true} saveAction={saveBuilderStep.bind(null, user.id, id)} />;
}
