import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchAdsLibrary, AdLibraryAd } from "@/lib/meta/ads-library";

export const runtime = "nodejs";

/**
 * GET /api/concorrentes/[id]/ads
 *
 * Busca anúncios do concorrente na Meta Ad Library, persiste no banco
 * e retorna os resultados.
 *
 * Query params:
 *   ?force=true   — re-busca mesmo que já exista cache recente
 *   ?refresh=true — além de re-buscar, marca como is_active=false os
 *                   anúncios que sumiram da resposta
 */

interface AdsRouteResponse {
  ads: AdLibraryAd[];
  total: number;
  has_more: boolean;
  cached?: boolean;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const force = request.nextUrl.searchParams.get("force") === "true";
  const refresh = request.nextUrl.searchParams.get("refresh") === "true";

  if (!id) {
    return NextResponse.json(
      { error: "ID do concorrente é obrigatório" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // 0. Auth — exigir usuário logado
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // 1. Buscar concorrente — RLS garante que só retorna se pertencer a empresa do user
  const { data: concorrente, error: concorrenteErr } = await supabase
    .from("concorrentes")
    .select("id, nome")
    .eq("id", id)
    .single();

  if (concorrenteErr || !concorrente) {
    return NextResponse.json(
      { error: "Concorrente não encontrado" },
      { status: 404 }
    );
  }

  // 2. Buscar plataforma (Instagram) com meta_page_id já cacheado
  const { data: plataforma } = await supabase
    .from("concorrente_plataformas")
    .select("username, meta_page_id")
    .eq("concorrente_id", id)
    .eq("rede", "instagram")
    .single();

  const cachedPageId: string | null = plataforma?.meta_page_id ?? null;
  const username: string | null = plataforma?.username ?? null;

  // 3. Se não é force/refresh, retornar dados já persistidos
  if (!force && !refresh) {
    const { data: existingAds, error: existingErr } = await supabase
      .from("concorrente_ads")
      .select("*")
      .eq("concorrente_id", id)
      .order("fetched_at", { ascending: false });

    if (!existingErr && existingAds && existingAds.length > 0) {
      const mapped = existingAds.map(rowToAdLibraryAd);
      return NextResponse.json<AdsRouteResponse>({
        ads: mapped,
        total: mapped.length,
        has_more: false,
        cached: true,
      });
    }
  }

  // 4. Chamar a Meta Ad Library
  const searchOpts = cachedPageId
    ? { searchPageIds: [cachedPageId] }
    : { searchTerms: username || concorrente.nome };

  let apiResult: { ads: AdLibraryAd[]; nextCursor?: string };

  try {
    apiResult = await searchAdsLibrary({
      ...searchOpts,
      countries: ["BR"],
      activeStatus: "ALL",
      limit: 50,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Erro ao consultar Meta Ad Library",
      },
      { status: 502 }
    );
  }

  const { ads: freshAds, nextCursor } = apiResult;

  // 5. Descobrir page_id da resposta e cachear em concorrente_plataformas
  if (!cachedPageId && freshAds.length > 0) {
    const discoveredPageId = freshAds.find((a) => a.page_id)?.page_id;
    if (discoveredPageId && plataforma) {
      await supabase
        .from("concorrente_plataformas")
        .update({ meta_page_id: discoveredPageId })
        .eq("concorrente_id", id)
        .eq("rede", "instagram");
    }
  }

  // 6. Persistir anúncios via UPSERT
  if (freshAds.length > 0) {
    const upsertRows = freshAds.map((ad) => ({
      concorrente_id: id,
      meta_ad_id: ad.id,
      page_id: ad.page_id ?? null,
      page_name: ad.page_name ?? null,
      ad_snapshot_url: ad.ad_snapshot_url ?? null,
      ad_creative_bodies: ad.ad_creative_bodies ?? null,
      ad_creative_link_titles: ad.ad_creative_link_titles ?? null,
      ad_creative_link_descriptions: ad.ad_creative_link_descriptions ?? null,
      ad_creative_link_captions: ad.ad_creative_link_captions ?? null,
      publisher_platforms: ad.publisher_platforms ?? null,
      languages: ad.languages ?? null,
      ad_delivery_start_time: ad.ad_delivery_start_time ?? null,
      ad_delivery_stop_time: ad.ad_delivery_stop_time ?? null,
      is_active: true,
      raw_data: ad,
      fetched_at: new Date().toISOString(),
    }));

    await supabase
      .from("concorrente_ads")
      .upsert(upsertRows, { onConflict: "concorrente_id,meta_ad_id" });
  }

  // 7. Se refresh=true, marcar como inativo os anúncios que sumiram
  if (refresh && freshAds.length > 0) {
    const activeIds = freshAds.map((a) => a.id);

    await supabase
      .from("concorrente_ads")
      .update({ is_active: false })
      .eq("concorrente_id", id)
      .not("meta_ad_id", "in", `(${activeIds.map((i) => `"${i}"`).join(",")})`);
  }

  return NextResponse.json<AdsRouteResponse>({
    ads: freshAds,
    total: freshAds.length,
    has_more: !!nextCursor,
    cached: false,
  });
}

// ── helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAdLibraryAd(row: any): AdLibraryAd {
  return {
    id: row.meta_ad_id,
    page_id: row.page_id ?? undefined,
    page_name: row.page_name ?? undefined,
    ad_snapshot_url: row.ad_snapshot_url ?? undefined,
    ad_creative_bodies: row.ad_creative_bodies ?? undefined,
    ad_creative_link_titles: row.ad_creative_link_titles ?? undefined,
    ad_creative_link_descriptions: row.ad_creative_link_descriptions ?? undefined,
    ad_creative_link_captions: row.ad_creative_link_captions ?? undefined,
    publisher_platforms: row.publisher_platforms ?? undefined,
    languages: row.languages ?? undefined,
    ad_delivery_start_time: row.ad_delivery_start_time ?? undefined,
    ad_delivery_stop_time: row.ad_delivery_stop_time ?? undefined,
  };
}
