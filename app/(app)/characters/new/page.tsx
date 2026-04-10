import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewCharacterPage({ searchParams }: PageProps) {
  const { error: pageError } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: systems } = await supabase
    .from("game_systems")
    .select("id, name, slug")
    .eq("status", "published")
    .order("name");

  async function createCharacter(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const name = formData.get("name") as string;
    const systemId = formData.get("system_id") as string;

    if (!name?.trim() || !systemId) {
      console.error("[createCharacter] Missing fields:", { name, systemId });
      redirect("/characters/new?error=missing_fields");
    }

    console.log("[createCharacter] Inserting character:", {
      name: name.trim(),
      user_id: user.id,
      system_id: systemId,
    });

    const { data, error } = await supabase
      .from("characters")
      .insert([
        {
          name: name.trim(),
          user_id: user.id,
          system_id: systemId,
        },
      ])
      .select("id")
      .single();

    if (error) {
      console.error("[createCharacter] Insert failed:", error.message, error.details, error.hint);
      redirect(`/characters/new?error=${encodeURIComponent(error.message)}`);
    }

    redirect(`/characters/${data.id}`);
  }

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create New Character</CardTitle>
          <CardDescription>
            Choose a name and game system for your character.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pageError && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
              Error: {decodeURIComponent(pageError)}
            </p>
          )}
          <form action={createCharacter} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Character Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Enter character name"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="system_id">Game System</Label>
              <select
                id="system_id"
                name="system_id"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select a game system</option>
                {systems?.map((system) => (
                  <option key={system.id} value={system.id}>
                    {system.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1">
                Create Character
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
