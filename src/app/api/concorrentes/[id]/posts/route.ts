import { NextRequest, NextResponse } from "next/server";
import { scrapeInstagramPublicProfile } from "@/lib/instagram-scraper";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// ── GET /api/concorrentes/[id]/posts ─────────────────────────────────────────
// Scrapes Instagram posts for a given concorrente and returns them.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";

  // We need to look up the concorrente's Instagram username
  let username: string | null = null;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data: plataforma } = await supabase
        .from("concorrente_plataformas")
        .select("username")
        .eq("concorrente_id", id)
        .eq("rede", "instagram")
        .single();

      username = plataforma?.username || null;
    } catch {
      // fallback
    }
  }

  // Also allow passing username directly as query param (for mock mode)
  if (!username) {
    username = searchParams.get("username");
  }

  if (!username) {
    return NextResponse.json(
      { error: "Concorrente sem username Instagram configurado" },
      { status: 404 }
    );
  }

  try {
    const profile = await scrapeInstagramPublicProfile(username, forceRefresh);

    if (!profile) {
      return NextResponse.json({
        profile: null,
        posts: [],
        error: "Nao foi possivel acessar o perfil. O Instagram pode estar bloqueando requisicoes do servidor.",
      });
    }

    // If we got profile data, update the concorrente_plataformas with follower count
    if (isSupabaseConfigured() && profile.followers > 0) {
      try {
        const supabase = await createClient();
        await supabase
          .from("concorrente_plataformas")
          .update({ seguidores: profile.followers })
          .eq("concorrente_id", id)
          .eq("rede", "instagram");
      } catch {
        // non-critical
      }
    }

    return NextResponse.json({
      profile: {
        username: profile.username,
        fullName: profile.fullName,
        biography: profile.biography,
        followers: profile.followers,
        following: profile.following,
        postCount: profile.postCount,
        profilePicUrl: profile.profilePicUrl,
        partial: profile.partial,
        scrapedAt: profile.scrapedAt,
      },
      posts: profile.posts,
    });
  } catch (err: any) {
    console.error("Scrape error for", username, err);
    return NextResponse.json(
      {
        profile: null,
        posts: [],
        error: err.message || "Erro ao scrape do perfil",
      },
      { status: 500 }
    );
  }
}
