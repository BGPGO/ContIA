import { NextRequest, NextResponse } from "next/server";
import { isAIConfigured } from "@/lib/ai/config";
import { analyzeContentIntelligence } from "@/lib/ai/content-intelligence";
import { getMedia, getProfile } from "@/lib/instagram";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/ai/content-analysis
 * Fetches Instagram posts and runs AI content intelligence analysis
 * Body: { empresa_id: string }
 */
export async function POST(req: NextRequest) {
  console.log("[content-analysis] OPENAI_API_KEY present:", !!process.env.OPENAI_API_KEY);

  if (!isAIConfigured()) {
    return NextResponse.json(
      { error: "OpenAI API nao configurada. Verifique a variavel OPENAI_API_KEY no servidor.", code: "AI_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  try {
    const { empresa_id } = await req.json();

    if (!empresa_id) {
      return NextResponse.json(
        { error: "empresa_id obrigatorio" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Nao autenticado" },
        { status: 401 }
      );
    }

    // Get Instagram connection
    const { data: connection } = await supabase
      .from("social_connections")
      .select("access_token, provider_user_id")
      .eq("empresa_id", empresa_id)
      .eq("provider", "instagram")
      .eq("is_active", true)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: "Instagram nao conectado", code: "NOT_CONNECTED" },
        { status: 404 }
      );
    }

    // Fetch profile for follower count
    let followerCount: number | undefined;
    try {
      const profile = await getProfile(
        connection.provider_user_id,
        connection.access_token
      );
      followerCount = profile.followers_count;
    } catch {
      // Non-critical — continue without follower count
    }

    // Fetch last 50 posts
    const media = await getMedia(
      connection.provider_user_id,
      connection.access_token,
      50
    );

    if (!media || media.length === 0) {
      return NextResponse.json(
        { error: "Nenhum post encontrado no Instagram", code: "NO_POSTS" },
        { status: 404 }
      );
    }

    // Run AI analysis
    const intelligence = await analyzeContentIntelligence(media, followerCount);

    return NextResponse.json({ intelligence });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro ao analisar conteudo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
