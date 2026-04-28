/**
 * Instagram API Client — Business Login for Instagram
 * Login direto pelo Instagram (sem precisar de Facebook)
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/
 */

const IG_OAUTH_URL = "https://www.instagram.com/oauth/authorize";
const IG_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const IG_GRAPH_URL = "https://graph.instagram.com";

/* ── Tipos ───────────────────────────────────────── */

export interface IGProfile {
  id: string;
  username: string;
  name: string;
  biography: string;
  profile_picture_url: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
  website: string;
}

export interface IGMedia {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

export interface IGInsight {
  name: string;
  period: string;
  values: { value: number; end_time?: string }[];
  title: string;
  description: string;
}

export interface IGPublishResult {
  id: string;
  status: "published" | "error";
  permalink?: string;
  error?: string;
}

export interface IGTokenResponse {
  access_token: string;
  user_id: string;
  permissions?: string;
}

export interface IGLongLivedToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/* ── Helpers ─────────────────────────────────────── */

async function igFetch<T>(
  path: string,
  token: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${IG_GRAPH_URL}${path}`);
  url.searchParams.set("access_token", token);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.error) {
    console.error(`[IG API Error] ${path}: [${data.error.code}] ${data.error.type} — ${data.error.message}`);
    throw new InstagramAPIError(
      data.error.message,
      data.error.code,
      data.error.type
    );
  }
  return data as T;
}

export class InstagramAPIError extends Error {
  code: number;
  type: string;

  constructor(message: string, code: number, type: string) {
    super(message);
    this.name = "InstagramAPIError";
    this.code = code;
    this.type = type;
  }
}

/* ── OAuth (Business Login for Instagram) ────────── */

export function getOAuthURL(appId: string, redirectUri: string, state: string): string {
  // Em dev mode, manage_messages pode causar erro se não aprovado
  // Pedir só os scopes essenciais primeiro
  const scopes = [
    "instagram_business_basic",
    "instagram_business_content_publish",
    "instagram_business_manage_comments",
    "instagram_business_manage_insights",
  ].join(",");

  const url = new URL(IG_OAUTH_URL);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  return url.toString();
}

/**
 * Troca o authorization code por um short-lived token
 * POST https://api.instagram.com/oauth/access_token
 */
export async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string
): Promise<IGTokenResponse> {
  const body = new URLSearchParams();
  body.set("client_id", appId);
  body.set("client_secret", appSecret);
  body.set("grant_type", "authorization_code");
  body.set("redirect_uri", redirectUri);
  body.set("code", code);

  const res = await fetch(IG_TOKEN_URL, {
    method: "POST",
    body,
  });

  const data = await res.json();

  if (data.error_type || data.error_message) {
    throw new InstagramAPIError(
      data.error_message || data.error_type,
      data.code || 400,
      data.error_type || "OAuthException"
    );
  }

  // Resposta pode vir em { data: [...] } ou direto
  if (data.data && Array.isArray(data.data)) {
    return data.data[0];
  }

  return data;
}

/**
 * Troca short-lived token por long-lived token (~60 dias)
 * GET https://graph.instagram.com/access_token
 */
export async function exchangeForLongLivedToken(
  shortToken: string,
  appSecret: string
): Promise<IGLongLivedToken> {
  const url = new URL(`${IG_GRAPH_URL}/access_token`);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("access_token", shortToken);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.error) {
    throw new InstagramAPIError(data.error.message, data.error.code, data.error.type);
  }

  return data;
}

/**
 * Renova um long-lived token (deve ter pelo menos 24h de vida)
 * GET https://graph.instagram.com/refresh_access_token
 */
export async function refreshLongLivedToken(
  token: string
): Promise<IGLongLivedToken> {
  const url = new URL(`${IG_GRAPH_URL}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.error) {
    throw new InstagramAPIError(data.error.message, data.error.code, data.error.type);
  }

  return data;
}

/* ── Profile ─────────────────────────────────────── */

export async function getProfile(igUserId: string, token: string): Promise<IGProfile> {
  // Tentar /me primeiro (mais confiável com Business Login), depois /{userId}
  const endpoints = ["/me", `/${igUserId}`];
  const fieldSets = [
    "id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count,website",
    "id,username,name,profile_picture_url,media_count",
    "id,username",
  ];

  for (const endpoint of endpoints) {
    for (const fields of fieldSets) {
      try {
        const data = await igFetch<Partial<IGProfile>>(endpoint, token, { fields });
        if (data.username) {
          return {
            id: data.id || igUserId,
            username: data.username,
            name: data.name || data.username,
            biography: data.biography || "",
            profile_picture_url: data.profile_picture_url || "",
            followers_count: data.followers_count || 0,
            follows_count: data.follows_count || 0,
            media_count: data.media_count || 0,
            website: data.website || "",
          };
        }
      } catch (e) {
        console.warn(`[IG getProfile] ${endpoint} fields=${fields.slice(0,30)}... failed:`, (e as Error).message);
        continue;
      }
    }
  }

  throw new Error("Nenhuma combinação de endpoint/campos retornou o perfil do Instagram");
}

/* ── Media ───────────────────────────────────────── */

export async function getMedia(
  igUserId: string,
  token: string,
  limit = 12
): Promise<IGMedia[]> {
  // Tentar /me/media primeiro, fallback pra /{userId}/media
  const endpoints = ["/me/media", `/${igUserId}/media`];
  const fieldSets = [
    "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    "id,caption,media_type,media_url,permalink,timestamp",
  ];

  for (const endpoint of endpoints) {
    for (const fields of fieldSets) {
      try {
        const res = await igFetch<{ data: IGMedia[] }>(endpoint, token, {
          fields,
          limit: String(limit),
        });
        return res.data ?? [];
      } catch (e) {
        console.warn(`[IG getMedia] ${endpoint} failed:`, (e as Error).message);
        continue;
      }
    }
  }
  console.warn("[IG getMedia] all attempts failed, returning empty");
  return [];
}

/* ── Media Insights (per-post) ──────────────────────────────────────── */

export interface IGMediaInsight {
  name: string;
  period: string;
  values: { value: number }[];
  title: string;
  description: string;
}

export async function getMediaInsights(
  mediaId: string,
  token: string,
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" = "IMAGE"
): Promise<Record<string, number>> {
  // Métricas variam por tipo de mídia (v22+)
  // NOTA: a API usa "saved" (não "saves") para media insights
  const baseMetrics = "reach,views,likes,comments,shares,saved,total_interactions";
  const reelsExtra = ",ig_reels_avg_watch_time";
  const metrics = mediaType === "VIDEO" ? baseMetrics + reelsExtra : baseMetrics;

  try {
    const res = await igFetch<{ data: IGMediaInsight[] }>(
      `/${mediaId}/insights`,
      token,
      { metric: metrics }
    );

    const result: Record<string, number> = {};
    for (const insight of res.data ?? []) {
      result[insight.name] = insight.values?.[0]?.value ?? 0;
    }
    return result;
  } catch (e) {
    // Fallback com métricas reduzidas
    try {
      const res = await igFetch<{ data: IGMediaInsight[] }>(
        `/${mediaId}/insights`,
        token,
        { metric: "reach,views,likes,comments" }
      );
      const result: Record<string, number> = {};
      for (const insight of res.data ?? []) {
        result[insight.name] = insight.values?.[0]?.value ?? 0;
      }
      return result;
    } catch {
      console.warn(`[IG getMediaInsights] ${mediaId} all attempts failed`);
      return {};
    }
  }
}

/* ── Insights ────────────────────────────────────── */

export async function getInsights(
  igUserId: string,
  token: string,
  period: "day" | "week" | "days_28" = "day"
): Promise<IGInsight[]> {
  const endpoints = ["/me/insights", `/${igUserId}/insights`];
  const metricSets = [
    "views,reach,follows_and_unfollows,total_interactions",
    "views,reach",
  ];

  for (const endpoint of endpoints) {
    for (const metric of metricSets) {
      try {
        const res = await igFetch<{ data: IGInsight[] }>(endpoint, token, {
          metric,
          period,
        });
        return res.data ?? [];
      } catch (e) {
        const err = e as Error;
        console.warn(`[IG getInsights] ${endpoint} metric=${metric} period=${period} failed:`, err.message);
        continue;
      }
    }
  }
  console.warn("[IG getInsights] all attempts failed, returning empty");
  return [];
}

/* ── Publicar ────────────────────────────────────── */

/**
 * Tipos de mídia que suportam o parâmetro `collaborators` na Graph API.
 * Children de CAROUSEL_ALBUM NÃO devem receber collaborators.
 */
const COLLAB_SUPPORTED_TYPES = new Set<string>(["IMAGE", "REELS", "CAROUSEL_ALBUM"]);

/**
 * Valida se a conta suporta posts Collab (requer BUSINESS ou CREATOR).
 * Reutiliza `detectAccountType` internamente via chamada à Graph API.
 */
export async function validateCollabSupport(
  igUserId: string,
  accessToken: string
): Promise<{ supported: boolean; accountType: string | null; reason?: string }> {
  const FB_GRAPH_URL = "https://graph.facebook.com/v21.0";
  let accountType: "BUSINESS" | "CREATOR" | "PERSONAL" | null = null;

  try {
    const url = new URL(`${FB_GRAPH_URL}/${igUserId}`);
    url.searchParams.set("fields", "account_type");
    url.searchParams.set("access_token", accessToken);

    const res = await fetch(url.toString());
    if (res.ok) {
      const data = (await res.json()) as { account_type?: string; error?: unknown };
      if (!data.error) {
        const t = data.account_type;
        if (t === "BUSINESS" || t === "CREATOR" || t === "PERSONAL") {
          accountType = t;
        }
      }
    }
  } catch {
    // Falha ao detectar tipo de conta
  }

  if (accountType === "BUSINESS" || accountType === "CREATOR") {
    return { supported: true, accountType };
  }

  return {
    supported: false,
    accountType,
    reason: `Collab requer perfil Business/Creator. Tipo atual: ${accountType ?? "desconhecido"}`,
  };
}

export async function createMediaContainer(
  igUserId: string,
  token: string,
  options: {
    image_url?: string;
    video_url?: string;
    caption?: string;
    media_type?: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REELS";
    children?: string[];
    /** Usernames dos colaboradores (sem "@"). Apenas para IMAGE, REELS, CAROUSEL_ALBUM raiz. */
    collaborators?: string[];
  }
): Promise<string> {
  const url = new URL(`${IG_GRAPH_URL}/${igUserId}/media`);
  url.searchParams.set("access_token", token);

  if (options.caption) url.searchParams.set("caption", options.caption);

  if (options.media_type === "CAROUSEL_ALBUM" && options.children) {
    url.searchParams.set("media_type", "CAROUSEL_ALBUM");
    url.searchParams.set("children", options.children.join(","));
  } else if (options.media_type === "REELS" && options.video_url) {
    url.searchParams.set("media_type", "REELS");
    url.searchParams.set("video_url", options.video_url);
  } else if (options.video_url) {
    url.searchParams.set("media_type", "VIDEO");
    url.searchParams.set("video_url", options.video_url);
  } else if (options.image_url) {
    url.searchParams.set("image_url", options.image_url);
  }

  // Adicionar collaborators apenas para tipos suportados (IMAGE, REELS, CAROUSEL_ALBUM raiz)
  const effectiveType = options.media_type ?? "IMAGE";
  if (
    options.collaborators &&
    options.collaborators.length > 0 &&
    COLLAB_SUPPORTED_TYPES.has(effectiveType)
  ) {
    url.searchParams.set("collaborators", JSON.stringify(options.collaborators));
  }

  const res = await fetch(url.toString(), { method: "POST" });
  const data = await res.json();

  if (data.error) {
    throw new InstagramAPIError(data.error.message, data.error.code, data.error.type);
  }

  return data.id;
}

export async function publishMedia(
  igUserId: string,
  token: string,
  containerId: string
): Promise<IGPublishResult> {
  const url = new URL(`${IG_GRAPH_URL}/${igUserId}/media_publish`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("creation_id", containerId);

  const res = await fetch(url.toString(), { method: "POST" });
  const data = await res.json();

  if (data.error) {
    return { id: "", status: "error", error: data.error.message };
  }

  const post = await igFetch<{ permalink: string }>(
    `/${data.id}`,
    token,
    { fields: "permalink" }
  );

  return { id: data.id, status: "published", permalink: post.permalink };
}

export async function checkContainerStatus(
  containerId: string,
  token: string
): Promise<{ status: string; status_code?: string }> {
  return igFetch(`/${containerId}`, token, {
    fields: "status,status_code",
  });
}
