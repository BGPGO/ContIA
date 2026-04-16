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

// ── Strategy 5: Puppeteer headless (renders JS, extracts posts) ─────────────

async function tryPuppeteerScrape(username: string): Promise<IGScrapedProfile | null> {
  try {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      // Bloquear imagens/CSS pra acelerar
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const rt = req.resourceType();
        if (rt === "image" || rt === "stylesheet" || rt === "font") {
          req.abort();
        } else {
          req.continue();
        }
      });

      await page.goto(`https://www.instagram.com/${username}/`, {
        waitUntil: "networkidle2",
        timeout: 25000,
      });

      // Esperar um pouco pra JS hidratar
      await new Promise((r) => setTimeout(r, 3000));

      // Extrair dados do DOM renderizado
      const data = await page.evaluate(() => {
        const getMeta = (prop: string) =>
          document.querySelector(`meta[property="${prop}"]`)?.getAttribute("content") || "";

        // Buscar posts do DOM renderizado
        const postElements = document.querySelectorAll("article a[href*='/p/']");
        const posts: Array<{
          shortcode: string;
          imageUrl: string;
          likes: number;
          comments: number;
        }> = [];

        postElements.forEach((el) => {
          const href = el.getAttribute("href") || "";
          const match = href.match(/\/p\/([^/]+)/);
          if (!match) return;

          const img = el.querySelector("img");
          posts.push({
            shortcode: match[1],
            imageUrl: img?.src || "",
            likes: 0,
            comments: 0,
          });
        });

        // Fallback: buscar todas imagens em articles
        if (posts.length === 0) {
          const imgs = document.querySelectorAll("article img[src*='cdninstagram']");
          const links = document.querySelectorAll("a[href*='/p/']");
          const shortcodes = Array.from(links)
            .map((l) => l.getAttribute("href")?.match(/\/p\/([^/]+)/)?.[1])
            .filter(Boolean);

          imgs.forEach((img, i) => {
            posts.push({
              shortcode: shortcodes[i] || `post-${i}`,
              imageUrl: (img as HTMLImageElement).src || "",
              likes: 0,
              comments: 0,
            });
          });
        }

        const desc = getMeta("og:description");
        const followersMatch = desc.match(/([\d,.]+[KkMm]?)\s*Followers/i);
        let followers = 0;
        if (followersMatch) {
          const raw = followersMatch[1].replace(/,/g, "");
          if (/[Kk]$/.test(raw)) followers = Math.round(parseFloat(raw) * 1000);
          else if (/[Mm]$/.test(raw)) followers = Math.round(parseFloat(raw) * 1_000_000);
          else followers = parseInt(raw, 10) || 0;
        }

        const followingMatch = desc.match(/([\d,.]+)\s*Following/i);
        const postCountMatch = desc.match(/([\d,.]+)\s*Posts/i);

        return {
          username: document.querySelector("header h2, header span")?.textContent?.replace("@", "") || "",
          fullName: document.querySelector('header span[dir="auto"]')?.textContent || "",
          biography: document.querySelector("header section > div > span")?.textContent || "",
          followers,
          following: parseInt(followingMatch?.[1]?.replace(/,/g, "") || "0", 10),
          postCount: parseInt(postCountMatch?.[1]?.replace(/,/g, "") || "0", 10),
          profilePicUrl: (document.querySelector('header img[alt*="profile"]') as HTMLImageElement)?.src || "",
          posts: posts.slice(0, 12),
          ogImage: getMeta("og:image"),
        };
      });

      await browser.close();

      if (!data || (!data.username && data.followers === 0 && data.posts.length === 0)) {
        return null;
      }

      return {
        username: data.username || username,
        fullName: data.fullName,
        biography: data.biography,
        followers: data.followers,
        following: data.following,
        postCount: data.postCount,
        profilePicUrl: data.profilePicUrl || data.ogImage,
        posts: data.posts.map((p) => ({
          id: p.shortcode,
          shortcode: p.shortcode,
          imageUrl: p.imageUrl,
          caption: "",
          likes: p.likes,
          comments: p.comments,
          timestamp: "",
          isVideo: false,
          permalink: `https://www.instagram.com/p/${p.shortcode}/`,
        })),
        scrapedAt: new Date().toISOString(),
        partial: data.posts.length === 0,
      };
    } catch (err) {
      await browser.close();
      throw err;
    }
  } catch (err) {
    console.error("[scraper/puppeteer]", err instanceof Error ? err.message : err);
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
  // 4. HTML scraping (gets followers from meta but no posts)
  if (!result) {
    result = await tryHTMLScraping(clean);
  }
  // 5. Puppeteer headless (if we got no posts from HTML, render JS to get them)
  if (!result || (result.partial && result.posts.length === 0)) {
    const puppeteerResult = await tryPuppeteerScrape(clean);
    if (puppeteerResult && (puppeteerResult.posts.length > 0 || !result)) {
      result = puppeteerResult;
    }
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
