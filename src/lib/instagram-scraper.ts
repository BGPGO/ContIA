// ── Instagram Public Profile Scraper ─────────────────────────────────────────
// Scrapes public Instagram profiles to get posts with engagement metrics.
// Uses multiple strategies with graceful degradation.
// Strategy priority: Business Discovery API > Public API > HTML Scraping

import { AnalysisCache, cacheKey } from "@/lib/cache";
import { createClient } from "@supabase/supabase-js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface IGScrapedPost {
  id: string;
  shortcode: string;
  imageUrl: string;
  caption: string;
  likes: number;
  comments: number;
  timestamp: string;
  isVideo: boolean;
  permalink: string;
}

export interface IGScrapedProfile {
  username: string;
  fullName: string;
  biography: string;
  followers: number;
  following: number;
  postCount: number;
  profilePicUrl: string;
  posts: IGScrapedPost[];
  scrapedAt: string;
  partial: boolean; // true if we only got partial data (e.g. meta tags only)
}

// ── Cache (6h TTL) ──────────────────────────────────────────────────────────

const scrapeCache = new AnalysisCache(6 * 60 * 60 * 1000); // 6 hours

// ── Rate limiter (1 scrape/min per profile) ─────────────────────────────────

const lastScrapeTime = new Map<string, number>();
const RATE_LIMIT_MS = 60_000; // 1 minute

function isRateLimited(username: string): boolean {
  const last = lastScrapeTime.get(username);
  if (!last) return false;
  return Date.now() - last < RATE_LIMIT_MS;
}

function recordScrape(username: string): void {
  lastScrapeTime.set(username, Date.now());
}

// ── User-Agent headers ──────────────────────────────────────────────────────

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

// ── Strategy 0: Mobile API (i.instagram.com — less blocked on servers) ──────

async function tryMobileAPI(username: string): Promise<IGScrapedProfile | null> {
  try {
    const res = await fetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      {
        headers: {
          "User-Agent": "Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; en_US; 458229258)",
          "X-IG-App-ID": "936619743392459",
          Accept: "*/*",
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) return null;

    const json = await res.json();
    const user = json?.data?.user;
    if (!user) return null;

    const posts: IGScrapedPost[] = (user.edge_owner_to_timeline_media?.edges || [])
      .slice(0, 12)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((edge: any) => {
        const node = edge.node;
        const shortcode = node.shortcode || "";
        return {
          id: node.id || shortcode,
          shortcode,
          imageUrl: node.display_url || node.thumbnail_src || "",
          caption: node.edge_media_to_caption?.edges?.[0]?.node?.text || "",
          likes: node.edge_liked_by?.count || node.edge_media_preview_like?.count || 0,
          comments: node.edge_media_to_comment?.count || 0,
          timestamp: node.taken_at_timestamp
            ? new Date(node.taken_at_timestamp * 1000).toISOString()
            : "",
          isVideo: node.is_video || false,
          permalink: shortcode ? `https://www.instagram.com/p/${shortcode}/` : "",
        };
      });

    return {
      username: user.username,
      fullName: user.full_name || "",
      biography: user.biography || "",
      followers: user.edge_followed_by?.count || 0,
      following: user.edge_follow?.count || 0,
      postCount: user.edge_owner_to_timeline_media?.count || 0,
      profilePicUrl: user.profile_pic_url_hd || user.profile_pic_url || "",
      posts,
      scrapedAt: new Date().toISOString(),
      partial: false,
    };
  } catch {
    return null;
  }
}

// ── Strategy 1: Business Discovery API (official, preferred) ────────────────
// Uses our own IG Business token to query any public profile via
// the Business Discovery endpoint. No scraping needed.

async function tryBusinessDiscovery(
  username: string
): Promise<IGScrapedProfile | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;

    const admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: conn } = await admin
      .from("social_connections")
      .select("access_token, provider_user_id")
      .eq("provider", "instagram")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!conn?.access_token || !conn.provider_user_id) return null;

    const fields = [
      "username",
      "name",
      "biography",
      "profile_picture_url",
      "followers_count",
      "follows_count",
      "media_count",
      "media.limit(12){id,caption,timestamp,media_type,media_url,thumbnail_url,permalink,like_count,comments_count}",
    ].join(",");

    const apiUrl =
      `https://graph.instagram.com/v23.0/${conn.provider_user_id}` +
      `?fields=business_discovery.fields(${fields}).username(${username})` +
      `&access_token=${conn.access_token}`;

    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(
        "[business-discovery] Erro:",
        err?.error?.message || res.status
      );
      return null;
    }

    const json = await res.json();
    const bd = json.business_discovery;
    if (!bd) return null;

    const posts: IGScrapedPost[] = (bd.media?.data || []).map((m: any) => ({
      id: m.id,
      shortcode:
        m.permalink?.split("/p/")?.[1]?.replace("/", "") || m.id,
      imageUrl: m.media_url || m.thumbnail_url || "",
      caption: m.caption || "",
      likes: m.like_count || 0,
      comments: m.comments_count || 0,
      timestamp: m.timestamp || "",
      isVideo: m.media_type === "VIDEO",
      permalink: m.permalink || "",
    }));

    return {
      username: bd.username,
      fullName: bd.name || "",
      biography: bd.biography || "",
      followers: bd.followers_count || 0,
      following: bd.follows_count || 0,
      postCount: bd.media_count || 0,
      profilePicUrl: bd.profile_picture_url || "",
      posts,
      scrapedAt: new Date().toISOString(),
      partial: false,
    };
  } catch (e) {
    console.error("[business-discovery] Exception:", (e as Error).message);
    return null;
  }
}

// ── Strategy 2: Instagram public API endpoint (fallback) ────────────────────

async function tryPublicAPI(username: string): Promise<IGScrapedProfile | null> {
  try {
    const res = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      {
        headers: {
          ...BROWSER_HEADERS,
          "X-IG-App-ID": "936619743392459",
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) return null;

    const json = await res.json();
    const user = json?.data?.user;
    if (!user) return null;

    const posts: IGScrapedPost[] = (user.edge_owner_to_timeline_media?.edges || [])
      .slice(0, 12)
      .map((edge: any) => {
        const node = edge.node;
        const shortcode = node.shortcode || "";
        return {
          id: node.id || shortcode,
          shortcode,
          imageUrl: node.display_url || node.thumbnail_src || "",
          caption: node.edge_media_to_caption?.edges?.[0]?.node?.text || "",
          likes: node.edge_liked_by?.count || node.edge_media_preview_like?.count || 0,
          comments: node.edge_media_to_comment?.count || 0,
          timestamp: node.taken_at_timestamp
            ? new Date(node.taken_at_timestamp * 1000).toISOString()
            : "",
          isVideo: node.is_video || false,
          permalink: shortcode ? `https://www.instagram.com/p/${shortcode}/` : "",
        };
      });

    return {
      username: user.username,
      fullName: user.full_name || "",
      biography: user.biography || "",
      followers: user.edge_followed_by?.count || 0,
      following: user.edge_follow?.count || 0,
      postCount: user.edge_owner_to_timeline_media?.count || 0,
      profilePicUrl: user.profile_pic_url_hd || user.profile_pic_url || "",
      posts,
      scrapedAt: new Date().toISOString(),
      partial: false,
    };
  } catch {
    return null;
  }
}

// ── Strategy 3: HTML scraping with embedded JSON (last resort) ──────────────

async function tryHTMLScraping(username: string): Promise<IGScrapedProfile | null> {
  try {
    const res = await fetch(`https://www.instagram.com/${username}/`, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const html = await res.text();

    // Try window._sharedData
    const sharedDataMatch = html.match(/window\._sharedData\s*=\s*({.+?});/);
    if (sharedDataMatch) {
      try {
        const sharedData = JSON.parse(sharedDataMatch[1]);
        const user = sharedData?.entry_data?.ProfilePage?.[0]?.graphql?.user;
        if (user) {
          const posts: IGScrapedPost[] = (user.edge_owner_to_timeline_media?.edges || [])
            .slice(0, 12)
            .map((edge: any) => {
              const shortcode = edge.node.shortcode || "";
              return {
                id: edge.node.id || shortcode,
                shortcode,
                imageUrl: edge.node.display_url || "",
                caption: edge.node.edge_media_to_caption?.edges?.[0]?.node?.text || "",
                likes: edge.node.edge_liked_by?.count || 0,
                comments: edge.node.edge_media_to_comment?.count || 0,
                timestamp: edge.node.taken_at_timestamp
                  ? new Date(edge.node.taken_at_timestamp * 1000).toISOString()
                  : "",
                isVideo: edge.node.is_video || false,
                permalink: shortcode ? `https://www.instagram.com/p/${shortcode}/` : "",
              };
            });

          return {
            username: user.username,
            fullName: user.full_name || "",
            biography: user.biography || "",
            followers: user.edge_followed_by?.count || 0,
            following: user.edge_follow?.count || 0,
            postCount: user.edge_owner_to_timeline_media?.count || 0,
            profilePicUrl: user.profile_pic_url_hd || "",
            posts,
            scrapedAt: new Date().toISOString(),
            partial: false,
          };
        }
      } catch {
        // JSON parse failed, continue to meta fallback
      }
    }

    // Fallback: extract meta tags for partial data
    const description =
      html.match(
        /<meta[^>]*(?:name="description"|property="og:description")[^>]*content="([^"]*)"[^>]*>/i
      )?.[1] || "";
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "";
    const ogImage =
      html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i)?.[1] || "";

    // Try to extract follower count from description like "123K Followers, 456 Following, 78 Posts"
    let followers = 0;
    const followerMatch = description.match(/([\d,.]+[KkMm]?)\s*Followers/i);
    if (followerMatch) {
      const raw = followerMatch[1].replace(/,/g, "");
      if (raw.match(/[Kk]$/)) {
        followers = Math.round(parseFloat(raw) * 1000);
      } else if (raw.match(/[Mm]$/)) {
        followers = Math.round(parseFloat(raw) * 1_000_000);
      } else {
        followers = parseInt(raw, 10) || 0;
      }
    }

    if (description || title) {
      return {
        username,
        fullName: title.replace(/ \(.*/, "").replace(/@.*/, "").trim(),
        biography: description,
        followers,
        following: 0,
        postCount: 0,
        profilePicUrl: ogImage,
        posts: [],
        scrapedAt: new Date().toISOString(),
        partial: true,
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ── Main scraper function ───────────────────────────────────────────────────

export async function scrapeInstagramPublicProfile(
  username: string,
  forceRefresh = false
): Promise<IGScrapedProfile | null> {
  const clean = username.replace(/^@/, "").trim().toLowerCase();
  if (!clean) return null;

  // Check cache first
  const ck = cacheKey("ig-scrape", clean);
  if (!forceRefresh) {
    const cached = scrapeCache.get<IGScrapedProfile>(ck);
    if (cached) return cached;
  }

  // Rate limit check
  if (isRateLimited(clean)) {
    // Return cached even if expired, or null
    const stale = scrapeCache.get<IGScrapedProfile>(ck);
    return stale || null;
  }

  recordScrape(clean);

  // Try strategies in order of reliability
  // 1. Mobile API (i.instagram.com — less blocked on servers)
  let result = await tryMobileAPI(clean);
  // 2. Web Public API (www.instagram.com)
  if (!result) {
    result = await tryPublicAPI(clean);
  }
  // 3. Business Discovery API (requires valid IG Business token)
  if (!result) {
    result = await tryBusinessDiscovery(clean);
  }
  // 4. HTML scraping (last resort, often blocked)
  if (!result) {
    result = await tryHTMLScraping(clean);
  }

  // Cache the result if we got anything
  if (result) {
    scrapeCache.set(ck, result);
  }

  return result;
}

// ── Utility: get cached profile without scraping ────────────────────────────

export function getCachedProfile(username: string): IGScrapedProfile | null {
  const clean = username.replace(/^@/, "").trim().toLowerCase();
  const ck = cacheKey("ig-scrape", clean);
  return scrapeCache.get<IGScrapedProfile>(ck);
}
