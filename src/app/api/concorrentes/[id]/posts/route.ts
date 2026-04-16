import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/concorrentes/[id]/posts
 *
 * Retorna dados básicos do concorrente (followers do meta tags) +
 * instrução para o frontend buscar posts via client-side.
 *
 * Instagram bloqueia APIs JSON de servidores (429). A solução é:
 * - Servidor: extrai followers/bio dos meta tags HTML (funciona)
 * - Cliente: exibe posts via Instagram embeds (não precisa de API)
 */

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Buscar username do concorrente
  let username: string | null = null;

  try {
    const supabase = await createClient();
    const { data: plataforma } = await supabase
      .from("concorrente_plataformas")
      .select("username")
      .eq("concorrente_id", id)
      .eq("rede", "instagram")
      .single();
    username = plataforma?.username || null;
  } catch { /* fallback */ }

  if (!username) {
    username = request.nextUrl.searchParams.get("username");
  }

  if (!username) {
    return NextResponse.json(
      { error: "Concorrente sem username Instagram configurado" },
      { status: 404 }
    );
  }

  const clean = username.replace(/^@/, "").trim().toLowerCase();

  // Buscar HTML da página pra extrair meta tags (funciona do servidor, HTTP 200)
  try {
    const res = await fetch(`https://www.instagram.com/${clean}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({
        profile: { username: clean, fullName: clean, followers: 0, following: 0, postCount: 0, biography: "", profilePicUrl: "", partial: true, scrapedAt: new Date().toISOString() },
        posts: [],
        error: `Instagram retornou HTTP ${res.status}`,
      });
    }

    const html = await res.text();

    // Extrair dados dos meta tags
    const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/i)?.[1] || "";
    const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i)?.[1] || "";
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "";

    // Parse followers/following/posts de og:description
    // Format: "1,840 Followers, 7 Following, 190 Posts - ..."
    let followers = 0;
    let following = 0;
    let postCount = 0;

    const followersMatch = ogDesc.match(/([\d,.]+[KkMm]?)\s*Followers/i);
    if (followersMatch) {
      const raw = followersMatch[1].replace(/,/g, "");
      if (/[Kk]$/.test(raw)) followers = Math.round(parseFloat(raw) * 1000);
      else if (/[Mm]$/.test(raw)) followers = Math.round(parseFloat(raw) * 1_000_000);
      else followers = parseInt(raw, 10) || 0;
    }

    const followingMatch = ogDesc.match(/([\d,.]+)\s*Following/i);
    if (followingMatch) following = parseInt(followingMatch[1].replace(/,/g, ""), 10) || 0;

    const postCountMatch = ogDesc.match(/([\d,.]+)\s*Posts/i);
    if (postCountMatch) postCount = parseInt(postCountMatch[1].replace(/,/g, ""), 10) || 0;

    const fullName = title.replace(/ \(.*/, "").replace(/@.*/, "").trim();
    const bioParts = ogDesc.split(" - ");
    const biography = bioParts.length > 1 ? bioParts.slice(1).join(" - ").replace(/See Instagram.*$/i, "").trim() : "";

    // Atualizar seguidores no banco
    if (followers > 0) {
      try {
        const supabase = await createClient();
        await supabase
          .from("concorrente_plataformas")
          .update({ seguidores: followers })
          .eq("concorrente_id", id)
          .eq("rede", "instagram");
      } catch { /* non-critical */ }
    }

    return NextResponse.json({
      profile: {
        username: clean,
        fullName,
        biography,
        followers,
        following,
        postCount,
        profilePicUrl: ogImage,
        partial: false,
        scrapedAt: new Date().toISOString(),
      },
      posts: [], // Posts serão carregados via embeds no frontend
      useEmbeds: true, // Flag pro frontend usar Instagram embeds
    });
  } catch (err) {
    return NextResponse.json({
      profile: { username: clean, fullName: clean, followers: 0, following: 0, postCount: 0, biography: "", profilePicUrl: "", partial: true, scrapedAt: new Date().toISOString() },
      posts: [],
      error: err instanceof Error ? err.message : "Erro ao acessar perfil",
    });
  }
}
