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
  const scopes = [
    "instagram_business_basic",
    "instagram_business_content_publish",
    "instagram_business_manage_messages",
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
  return igFetch<IGProfile>(`/${igUserId}`, token, {
    fields:
      "id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count,website",
  });
}

/* ── Media ───────────────────────────────────────── */

export async function getMedia(
  igUserId: string,
  token: string,
  limit = 12
): Promise<IGMedia[]> {
  const res = await igFetch<{ data: IGMedia[] }>(
    `/${igUserId}/media`,
    token,
    {
      fields:
        "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
      limit: String(limit),
    }
  );
  return res.data ?? [];
}

/* ── Insights ────────────────────────────────────── */

export async function getInsights(
  igUserId: string,
  token: string,
  period: "day" | "week" | "days_28" = "day"
): Promise<IGInsight[]> {
  const metrics = [
    "impressions",
    "reach",
    "profile_views",
    "follower_count",
  ].join(",");

  const res = await igFetch<{ data: IGInsight[] }>(
    `/${igUserId}/insights`,
    token,
    { metric: metrics, period }
  );
  return res.data ?? [];
}

/* ── Publicar ────────────────────────────────────── */

export async function createMediaContainer(
  igUserId: string,
  token: string,
  options: {
    image_url?: string;
    video_url?: string;
    caption?: string;
    media_type?: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REELS";
    children?: string[];
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
