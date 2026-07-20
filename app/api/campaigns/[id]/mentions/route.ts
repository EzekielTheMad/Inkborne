import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const campaignIdResult = z.string().uuid().safeParse((await params).id);
  if (!campaignIdResult.success) {
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });
  }
  const campaignId = campaignIdResult.data;
  const queryText = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  const kind = request.nextUrl.searchParams.get("kind");
  if (kind !== "page" && kind !== "character") {
    return NextResponse.json({ error: "Invalid mention kind" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (kind === "page") {
    let query = supabase
      .from("campaign_pages")
      .select("id, title")
      .eq("campaign_id", campaignId)
      .order("title")
      .limit(10);
    if (queryText) query = query.ilike("title", `%${queryText}%`);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(
      (data ?? []).map((page) => ({
        id: page.id,
        label: page.title,
        entityType: "page" as const,
      })),
    );
  }

  let query = supabase
    .from("characters")
    .select("id, name")
    .eq("campaign_id", campaignId)
    .eq("archived", false)
    .order("name")
    .limit(10);
  if (queryText) query = query.ilike("name", `%${queryText}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    (data ?? []).map((character) => ({
      id: character.id,
      label: character.name,
      entityType: "character" as const,
    })),
  );
}
