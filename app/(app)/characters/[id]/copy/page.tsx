import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CopyIcon } from "lucide-react";
import { copyCharacter } from "@/app/(app)/characters/[id]/copy/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";

interface CopyCharacterPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

const errorMessages: Record<string, string> = {
  invalid_input: "Enter a name between 1 and 100 characters.",
  copy_failed:
    "The character could not be copied. Check the campaign and try again.",
};

export default async function CopyCharacterPage({
  params,
  searchParams,
}: CopyCharacterPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: character } = await supabase
    .from("characters")
    .select("id, name, system_id, user_id, game_systems(name)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!character) notFound();

  const { data: campaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("id, name, owner_id")
    .eq("system_id", character.system_id)
    .order("name");

  if (campaignsError) {
    console.error(
      "[CopyCharacterPage] Failed to load campaigns:",
      campaignsError,
    );
  }

  const errorMessage = query.error ? errorMessages[query.error] : null;
  const system = Array.isArray(character.game_systems)
    ? character.game_systems[0]
    : character.game_systems;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="j-folio">A separate path</p>
        <h1 className="j-display mt-1.5 text-2xl text-foreground sm:text-3xl">
          Copy {character.name}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This creates an independent snapshot of the sheet, story, inventory,
          and spells. Future changes will not affect the original, and roll
          history stays with the original character.
        </p>
      </div>

      <form
        action={copyCharacter}
        className="j-card-paper space-y-5 p-5 sm:p-6"
      >
        <input type="hidden" name="source_character_id" value={character.id} />

        <div className="space-y-2">
          <Label htmlFor="copy-name">Copy name</Label>
          <Input
            id="copy-name"
            name="name"
            defaultValue={`${character.name} (Copy)`}
            maxLength={100}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="copy-campaign">Campaign</Label>
          <select
            id="copy-campaign"
            name="campaign_id"
            defaultValue=""
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">No campaign yet</option>
            {(campaigns ?? []).map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
                {campaign.owner_id === user.id ? " (DM)" : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Only campaigns using {system?.name ?? "this game system"} are shown.
            The copy starts private; the campaign DM can still view it.
          </p>
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errorMessage}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Link
            href={`/characters/${character.id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Cancel
          </Link>
          <Button type="submit" variant="gold">
            <CopyIcon />
            Create copy
          </Button>
        </div>
      </form>
    </div>
  );
}

