import { NextRequest, NextResponse } from "next/server";

/**
 * DEBUG ENDPOINT — testar scraping de Instagram do servidor.
 * Remover depois de diagnosticar o problema.
 * GET /api/debug/scrape-test?username=aimocorp
 */
export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username") || "aimocorp";
  const results: Record<string, unknown> = {};

  // Strategy 1: Mobile API
  try {
    const res = await fetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      {
        headers: {
          "User-Agent": "Instagram 275.0.0.27.98 Android",
          "X-IG-App-ID": "936619743392459",
          Accept: "*/*",
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    const text = await res.text();
    const hasUser = text.includes('"username"');
    const hasPosts = text.includes("edge_owner_to_timeline_media");
    results.mobile_api = {
      status: res.status,
      size: text.length,
      hasUser,
      hasPosts,
      preview: text.slice(0, 300),
    };
  } catch (err) {
    results.mobile_api = { error: err instanceof Error ? err.message : String(err) };
  }

  // Strategy 2: Web API
  try {
    const res = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "X-IG-App-ID": "936619743392459",
          Accept: "*/*",
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    const text = await res.text();
    const hasUser = text.includes('"username"');
    results.web_api = {
      status: res.status,
      size: text.length,
      hasUser,
      preview: text.slice(0, 300),
    };
  } catch (err) {
    results.web_api = { error: err instanceof Error ? err.message : String(err) };
  }

  // Strategy 3: HTML page
  try {
    const res = await fetch(`https://www.instagram.com/${username}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    const hasSharedData = text.includes("window._sharedData");
    const hasOgDesc = text.includes('og:description');
    const descMatch = text.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/i);
    results.html_page = {
      status: res.status,
      size: text.length,
      hasSharedData,
      hasOgDesc,
      ogDescription: descMatch?.[1]?.slice(0, 200) || null,
      redirected: res.redirected,
      finalUrl: res.url,
    };
  } catch (err) {
    results.html_page = { error: err instanceof Error ? err.message : String(err) };
  }

  // Strategy 4: Business Discovery
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data: conn } = await admin
        .from("social_connections")
        .select("access_token, provider_user_id")
        .eq("provider", "instagram")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (conn?.access_token && conn.provider_user_id) {
        const bdUrl = `https://graph.instagram.com/v21.0/${conn.provider_user_id}?fields=business_discovery.fields(username,followers_count).username(${username})&access_token=${conn.access_token}`;
        const bdRes = await fetch(bdUrl, { signal: AbortSignal.timeout(10000) });
        const bdText = await bdRes.text();
        results.business_discovery = {
          status: bdRes.status,
          size: bdText.length,
          preview: bdText.slice(0, 500),
        };
      } else {
        results.business_discovery = { error: "Sem conexao IG ativa no banco" };
      }
    } else {
      results.business_discovery = { error: "Sem SUPABASE_SERVICE_ROLE_KEY" };
    }
  } catch (err) {
    results.business_discovery = { error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json({ username, tested_at: new Date().toISOString(), results });
}
