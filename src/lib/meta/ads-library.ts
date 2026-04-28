/**
 * Cliente para a Meta Ad Library API
 * Docs: https://www.facebook.com/ads/library/api/
 * Endpoint: GET https://graph.facebook.com/v21.0/ads_archive
 */

export interface AdLibraryAd {
  id: string;
  page_id?: string;
  page_name?: string;
  ad_snapshot_url?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_descriptions?: string[];
  ad_creative_link_captions?: string[];
  publisher_platforms?: string[];
  languages?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
}

export interface SearchAdsLibraryOptions {
  /** Termos de busca (nome/handle do anunciante) */
  searchTerms?: string;
  /** IDs de páginas do Facebook para busca precisa */
  searchPageIds?: string[];
  /** Países alvo (default: ['BR']) */
  countries?: string[];
  /** Status dos anúncios (default: 'ALL') */
  activeStatus?: "ACTIVE" | "ALL";
  /** Máximo de resultados por requisição (default: 50) */
  limit?: number;
  /** Tipo de mídia: IMAGE, VIDEO, MEME, ALL (default: omitido = ALL) */
  mediaType?: string;
  /** Plataformas do publisher: ['FACEBOOK','INSTAGRAM',...] */
  publisherPlatforms?: string[];
  /** Cursor de paginação (after) */
  after?: string;
}

export interface SearchAdsLibraryResult {
  ads: AdLibraryAd[];
  nextCursor?: string;
}

const AD_LIBRARY_ENDPOINT = "https://graph.facebook.com/v21.0/ads_archive";

const AD_FIELDS = [
  "id",
  "page_id",
  "page_name",
  "ad_snapshot_url",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_descriptions",
  "ad_creative_link_captions",
  "publisher_platforms",
  "languages",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
].join(",");

/**
 * Busca anúncios na Meta Ad Library.
 * Requer `META_APP_ID` e `META_APP_SECRET` nas variáveis de ambiente.
 */
export async function searchAdsLibrary(
  opts: SearchAdsLibraryOptions
): Promise<SearchAdsLibraryResult> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error(
      "Variáveis META_APP_ID e META_APP_SECRET não configuradas. " +
        "Defina-as no Coolify (ou .env.local para dev)."
    );
  }

  if (!opts.searchTerms && (!opts.searchPageIds || opts.searchPageIds.length === 0)) {
    throw new Error(
      "Informe ao menos searchTerms ou searchPageIds para buscar na Ad Library."
    );
  }

  const accessToken = `${appId}|${appSecret}`;
  const countries = opts.countries ?? ["BR"];
  const activeStatus = opts.activeStatus ?? "ALL";
  const limit = opts.limit ?? 50;

  const params = new URLSearchParams({
    access_token: accessToken,
    ad_reached_countries: JSON.stringify(countries),
    ad_active_status: activeStatus,
    fields: AD_FIELDS,
    limit: String(limit),
  });

  if (opts.searchTerms) {
    params.set("search_terms", opts.searchTerms);
  }

  if (opts.searchPageIds && opts.searchPageIds.length > 0) {
    params.set("search_page_ids", opts.searchPageIds.join(","));
  }

  if (opts.mediaType && opts.mediaType !== "ALL") {
    params.set("media_type", opts.mediaType);
  }

  if (opts.publisherPlatforms && opts.publisherPlatforms.length > 0) {
    params.set("publisher_platforms", JSON.stringify(opts.publisherPlatforms));
  }

  if (opts.after) {
    params.set("after", opts.after);
  }

  const url = `${AD_LIBRARY_ENDPOINT}?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw new Error(
      `Falha ao conectar à Meta Ad Library API: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      `Meta Ad Library retornou resposta inválida (HTTP ${response.status}).`
    );
  }

  if (!response.ok) {
    const errMsg: string =
      body?.error?.message ??
      body?.error?.type ??
      `HTTP ${response.status}`;

    if (response.status === 401) {
      throw new Error(
        `Credenciais Meta inválidas ou expiradas: ${errMsg}. ` +
          "Verifique META_APP_ID e META_APP_SECRET."
      );
    }

    if (response.status === 400) {
      throw new Error(
        `Requisição inválida para Meta Ad Library: ${errMsg}. ` +
          "Verifique os parâmetros de busca."
      );
    }

    throw new Error(`Meta Ad Library API erro ${response.status}: ${errMsg}`);
  }

  const rawAds: AdLibraryAd[] = (body.data ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (item: any): AdLibraryAd => ({
      id: item.id,
      page_id: item.page_id,
      page_name: item.page_name,
      ad_snapshot_url: item.ad_snapshot_url,
      ad_creative_bodies: item.ad_creative_bodies,
      ad_creative_link_titles: item.ad_creative_link_titles,
      ad_creative_link_descriptions: item.ad_creative_link_descriptions,
      ad_creative_link_captions: item.ad_creative_link_captions,
      publisher_platforms: item.publisher_platforms,
      languages: item.languages,
      ad_delivery_start_time: item.ad_delivery_start_time,
      ad_delivery_stop_time: item.ad_delivery_stop_time,
    })
  );

  const nextCursor: string | undefined =
    body.paging?.cursors?.after ?? body.paging?.next
      ? body.paging.cursors?.after
      : undefined;

  return { ads: rawAds, nextCursor };
}
