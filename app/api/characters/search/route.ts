import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q") ?? "";
  const campaignId = searchParams.get("campaign_id") ?? searchParams.get("campaignId") ?? "";

  console.log("[GET /api/characters/search] q:", q, "campaignId:", campaignId);

  // Return empty array for missing params — don't error out
  if (!campaignId) {
    return NextResponse.json([]);
  }

  const supabase = await createClient();

  // Auth check — only authenticated users may search
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log("[GET /api/characters/search] Unauthenticated request rejected");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Query characters within the campaign matching the search term
  const query = supabase
    .from("characters")
    .select("id, name")
    .eq("campaign_id", campaignId)
    .limit(10);

  // Apply name filter only when a search term is provided
  const { data, error } = q
    ? await query.ilike("name", `%${q}%`)
    : await query;

  if (error) {
    console.error("[GET /api/characters/search] Query error:", error.message, error.details);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = (data ?? []).map((character) => ({
    id: character.id,
    label: character.name,
    entityType: "character" as const,
  }));

  console.log("[GET /api/characters/search] Returning", results.length, "results");

  return NextResponse.json(results);
}
