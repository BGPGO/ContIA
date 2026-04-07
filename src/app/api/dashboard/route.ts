import { NextRequest, NextResponse } from "next/server";
import { getProfile, getMedia, getInsights } from "@/lib/instagram";
import { createClient } from "@/lib/supabase/server";
import type { IGProfile, IGMedia, IGInsight } from "@/lib/instagram";
import type { MarcaDNA } from "@/types";

/**
 * GET /api/dashboard?empresa_id=xxx
 * Aggregates Instagram profile, recent media, insights, and DNA status
 * in a single request for the dashboard.
 */

interface DashboardResponse {
  connected: boolean;
  profile: IGProfile | null;
  recentPosts: IGMedia[];
  insights: IGInsight[];
  dna: MarcaDNA | null;
}

export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) {
    return NextResponse.json({ error: "empresa_id obrigatório" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Check Instagram connection
  const { data: connection } = await supabase
    .from("social_connections")
    .select("access_token, provider_user_id, username")
    .eq("empresa_id", empresaId)
    .eq("provider", "instagram")
    .eq("is_active", true)
    .single();

  // Load DNA (always, regardless of Instagram connection)
  const { data: dnaRow } = await supabase
    .from("marca_dna")
    .select("*")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!connection) {
    const result: DashboardResponse = {
      connected: false,
      profile: null,
      recentPosts: [],
      insights: [],
      dna: (dnaRow as MarcaDNA) ?? null,
    };
    return NextResponse.json(result);
  }

  // Fetch Instagram data in parallel — each one is safe-guarded
  const [profileResult, mediaResult, insightsResult] = await Promise.allSettled([
    getProfile(connection.provider_user_id, connection.access_token),
    getMedia(connection.provider_user_id, connection.access_token, 6),
    getInsights(connection.provider_user_id, connection.access_token, "day"),
  ]);

  const profile =
    profileResult.status === "fulfilled" ? profileResult.value : null;
  const recentPosts =
    mediaResult.status === "fulfilled" ? mediaResult.value : [];
  const insights =
    insightsResult.status === "fulfilled" ? insightsResult.value : [];

  const result: DashboardResponse = {
    connected: true,
    profile,
    recentPosts,
    insights,
    dna: (dnaRow as MarcaDNA) ?? null,
  };

  return NextResponse.json(result);
}
