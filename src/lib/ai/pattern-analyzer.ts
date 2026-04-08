import { createClient } from "@/lib/supabase/server";
import { getOpenAIClient } from "@/lib/ai/config";
import { parseGPTJson } from "@/lib/ai/marca-dna";
import type { StyleProfile } from "@/types/patterns";

// In-memory cache with 2h TTL
const profileCache = new Map<string, { data: StyleProfile; expires: number }>();
const CACHE_TTL = 2 * 60 * 60 * 1000;

export async function analyzePostPatterns(empresaId: string): Promise<StyleProfile> {
  // 1. Check cache
  const cached = profileCache.get(empresaId);
  if (cached && cached.expires > Date.now()) return cached.data;

  // 2. Fetch posts from instagram_media_cache
  const supabase = await createClient();
  const { data: posts, error } = await supabase
    .from("instagram_media_cache")
    .select("caption, media_type, like_count, comments_count, timestamp, insights")
    .eq("empresa_id", empresaId)
    .order("timestamp", { ascending: false })
    .limit(50);

  if (error || !posts?.length) {
    throw new Error(`No posts found for empresa ${empresaId}`);
  }

  // 3. Calculate raw metrics first (no AI needed)
  const rawMetrics = calculateRawMetrics(posts);

  // 4. Use GPT to analyze style/tone from captions
  const openai = getOpenAIClient();
  const captionSample = posts
    .filter((p) => p.caption && p.caption.length > 20)
    .slice(0, 15)
    .map(
      (p, i) =>
        `Post ${i + 1} [${p.media_type}, ${p.like_count} likes, ${p.comments_count} comments]:\n${p.caption}`
    )
    .join("\n\n---\n\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Você é um analista de conteúdo especialista em Instagram. Analise as legendas e extraia padrões de estilo. Responda EXCLUSIVAMENTE em JSON válido, sem markdown.",
      },
      {
        role: "user",
        content: `Analise estas ${posts.length} legendas reais de uma marca no Instagram e extraia os PADRÕES DE ESTILO:

${captionSample}

Responda neste JSON EXATO:
{
  "caption_structure": "descreva a estrutura típica das legendas (ex: gancho → desenvolvimento → CTA)",
  "emoji_usage": "heavy|moderate|minimal|none",
  "emoji_examples": ["emoji1", "emoji2", "emoji3"],
  "line_break_style": "como usa quebras de linha",
  "cta_patterns": ["CTA típico 1", "CTA típico 2", "CTA típico 3"],
  "opening_patterns": ["como geralmente começa 1", "como geralmente começa 2", "como geralmente começa 3"],
  "top_themes": ["tema1", "tema2", "tema3", "tema4", "tema5"],
  "content_pillars": ["pilar1", "pilar2", "pilar3"],
  "best_performing_topics": ["tópico com mais engajamento 1", "tópico 2", "tópico 3"],
  "tone_description": "descrição detalhada do tom de voz usado nas legendas (3-5 frases)",
  "vocabulary_signature": ["palavra/expressão característica 1", "palavra 2", "palavra 3", "palavra 4", "palavra 5"],
  "example_captions": ["melhor legenda 1 completa", "melhor legenda 2", "melhor legenda 3", "melhor legenda 4", "melhor legenda 5"]
}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const aiAnalysis = parseGPTJson(
    completion.choices[0]?.message?.content || "{}",
    {}
  );

  // 5. Merge raw metrics + AI analysis
  const styleProfile: StyleProfile = {
    caption_avg_length: rawMetrics.avgCaptionLength,
    caption_structure: aiAnalysis.caption_structure || "não identificado",
    emoji_usage: aiAnalysis.emoji_usage || "moderate",
    emoji_examples: aiAnalysis.emoji_examples || [],
    line_break_style: aiAnalysis.line_break_style || "moderado",
    cta_patterns: aiAnalysis.cta_patterns || [],
    opening_patterns: aiAnalysis.opening_patterns || [],
    hashtag_avg_count: rawMetrics.avgHashtagCount,
    hashtag_categories: rawMetrics.hashtagCategories,
    top_hashtags: rawMetrics.topHashtags,
    top_themes: aiAnalysis.top_themes || [],
    content_pillars: aiAnalysis.content_pillars || [],
    posting_frequency: rawMetrics.postingFrequency,
    best_performing_topics: aiAnalysis.best_performing_topics || [],
    avg_likes: rawMetrics.avgLikes,
    avg_comments: rawMetrics.avgComments,
    best_time_to_post: rawMetrics.bestTimeToPost,
    best_format: rawMetrics.bestFormat,
    engagement_rate: rawMetrics.engagementRate,
    example_captions: aiAnalysis.example_captions || [],
    tone_description: aiAnalysis.tone_description || "",
    vocabulary_signature: aiAnalysis.vocabulary_signature || [],
    analyzed_posts_count: posts.length,
    last_analyzed_at: new Date().toISOString(),
  };

  // 6. Cache result
  profileCache.set(empresaId, {
    data: styleProfile,
    expires: Date.now() + CACHE_TTL,
  });

  return styleProfile;
}

// Helper function to calculate raw metrics from posts
function calculateRawMetrics(posts: any[]) {
  // Caption lengths
  const captionLengths = posts.map((p) => (p.caption || "").length);
  const avgCaptionLength = Math.round(
    captionLengths.reduce((a, b) => a + b, 0) / captionLengths.length
  );

  // Hashtag analysis
  const allHashtags: string[] = [];
  posts.forEach((p) => {
    const tags = (p.caption || "").match(/#\w+/g) || [];
    allHashtags.push(...tags);
  });
  const hashtagCounts = allHashtags.reduce(
    (acc: Record<string, number>, tag) => {
      acc[tag.toLowerCase()] = (acc[tag.toLowerCase()] || 0) + 1;
      return acc;
    },
    {}
  );
  const topHashtags = Object.entries(hashtagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tag]) => tag);
  const avgHashtagCount = Math.round(allHashtags.length / posts.length);

  // Categorize hashtags
  const hashtagCategories: string[] = [];
  if (topHashtags.some((t) => t.includes("marca") || t.includes("brand"))) {
    hashtagCategories.push("brand");
  }
  hashtagCategories.push("niche"); // always present
  if (topHashtags.length > 10) hashtagCategories.push("trending");

  // Engagement
  const avgLikes = Math.round(
    posts.reduce((sum, p) => sum + (p.like_count || 0), 0) / posts.length
  );
  const avgComments = Math.round(
    posts.reduce((sum, p) => sum + (p.comments_count || 0), 0) / posts.length
  );

  // Best format by engagement
  const formatEngagement: Record<string, { total: number; count: number }> = {};
  posts.forEach((p) => {
    const fmt = p.media_type || "IMAGE";
    if (!formatEngagement[fmt]) formatEngagement[fmt] = { total: 0, count: 0 };
    formatEngagement[fmt].total += (p.like_count || 0) + (p.comments_count || 0);
    formatEngagement[fmt].count++;
  });
  const bestFormat =
    Object.entries(formatEngagement)
      .map(([fmt, data]) => ({ fmt, avg: data.total / data.count }))
      .sort((a, b) => b.avg - a.avg)[0]?.fmt || "IMAGE";

  // Posting frequency
  const timestamps = posts
    .map((p) => new Date(p.timestamp).getTime())
    .filter((t) => !isNaN(t))
    .sort();
  let postingFrequency = "irregular";
  if (timestamps.length >= 2) {
    const daysBetween =
      (timestamps[0] - timestamps[timestamps.length - 1]) /
      (1000 * 60 * 60 * 24);
    const avgPerWeek =
      (posts.length / Math.max(Math.abs(daysBetween), 1)) * 7;
    if (avgPerWeek >= 7) postingFrequency = "diário";
    else if (avgPerWeek >= 4) postingFrequency = "4-6x por semana";
    else if (avgPerWeek >= 2) postingFrequency = "2-3x por semana";
    else postingFrequency = "1x por semana ou menos";
  }

  // Best time to post (by hour with highest avg engagement)
  const hourCounts: Record<number, { engagement: number; count: number }> = {};
  posts.forEach((p) => {
    const date = new Date(p.timestamp);
    if (!isNaN(date.getTime())) {
      const hour = date.getHours();
      if (!hourCounts[hour]) hourCounts[hour] = { engagement: 0, count: 0 };
      hourCounts[hour].engagement += (p.like_count || 0) + (p.comments_count || 0);
      hourCounts[hour].count++;
    }
  });
  const bestHour = Object.entries(hourCounts)
    .map(([h, d]) => ({ hour: parseInt(h), avg: d.engagement / d.count }))
    .sort((a, b) => b.avg - a.avg)[0]?.hour;
  const bestTimeToPost =
    bestHour !== undefined ? `${bestHour}:00 - ${bestHour + 1}:00` : "variado";

  // Engagement rate (simplified)
  const engagementRate =
    avgLikes > 0
      ? parseFloat(
          (((avgLikes + avgComments) / Math.max(avgLikes * 10, 1)) * 100).toFixed(2)
        )
      : 0;

  return {
    avgCaptionLength,
    avgHashtagCount,
    hashtagCategories,
    topHashtags,
    avgLikes,
    avgComments,
    bestFormat,
    postingFrequency,
    bestTimeToPost,
    engagementRate,
  };
}

// Export cache invalidation utility
export function invalidatePatternCache(empresaId: string) {
  profileCache.delete(empresaId);
}
