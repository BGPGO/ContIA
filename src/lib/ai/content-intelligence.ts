/**
 * Content Intelligence — AI-powered analysis of Instagram content patterns
 * Uses GPT-4o-mini to deeply analyze posting history and generate actionable insights
 */

import { getOpenAIClient } from "./config";
import type { IGMedia } from "@/lib/instagram";

/* ── Types ───────────────────────────────────────── */

export interface ContentPillar {
  name: string;
  description: string;
  percentage: number;
  avgEngagement: number;
  color: string;
  postCount: number;
}

export interface PerformanceInsight {
  bestMediaType: string;
  bestMediaTypeEngagement: number;
  bestDayOfWeek: string;
  bestTimeOfDay: string;
  engagementByType: {
    type: string;
    avgEngagement: number;
    count: number;
  }[];
  avgEngagementRate: number;
}

export interface CaptionIntelligence {
  avgLength: number;
  topWords: { word: string; count: number }[];
  emojiUsage: string;
  ctaPatterns: string[];
  ctaEffectiveness: string;
  hashtagAnalysis: {
    mostUsed: string[];
    bestPerforming: string[];
    avgPerPost: number;
  };
  toneDescription: string;
}

export interface CalendarSuggestion {
  dayOfWeek: string;
  pillar: string;
  format: string;
  time: string;
  description: string;
}

export interface Opportunity {
  title: string;
  description: string;
  expectedImpact: "high" | "medium" | "low";
  category: string;
}

export interface ContentIntelligence {
  pillars: ContentPillar[];
  performance: PerformanceInsight;
  captionIntelligence: CaptionIntelligence;
  calendarSuggestions: CalendarSuggestion[];
  opportunities: Opportunity[];
  engagementDrivers: string[];
  contentScore: number;
  summary: string;
  analyzedPostsCount: number;
  analyzedAt: string;
}

/* ── Pillar colors ───────────────────────────────── */

const PILLAR_COLORS = [
  "#6c5ce7",
  "#4ecdc4",
  "#ff6b6b",
  "#feca57",
  "#54a0ff",
  "#5f27cd",
  "#01a3a4",
  "#ff9ff3",
];

/* ── Analysis ────────────────────────────────────── */

export async function analyzeContentIntelligence(
  media: IGMedia[],
  followerCount?: number
): Promise<ContentIntelligence> {
  const openai = getOpenAIClient();

  // Prepare media data for the prompt (strip URLs to save tokens)
  const mediaData = media.map((m) => ({
    id: m.id,
    caption: m.caption?.slice(0, 500) ?? "",
    media_type: m.media_type,
    timestamp: m.timestamp,
    like_count: m.like_count ?? 0,
    comments_count: m.comments_count ?? 0,
    engagement: (m.like_count ?? 0) + (m.comments_count ?? 0),
  }));

  const totalEngagement = mediaData.reduce((s, m) => s + m.engagement, 0);
  const avgEngagement = mediaData.length > 0 ? totalEngagement / mediaData.length : 0;

  const prompt = `You are an expert social media strategist and content intelligence analyst. Analyze the following Instagram content data and provide deep, actionable insights.

## DATA
Posts analyzed: ${mediaData.length}
${followerCount ? `Follower count: ${followerCount}` : ""}
Average engagement per post: ${avgEngagement.toFixed(1)}

## POSTS (JSON)
${JSON.stringify(mediaData, null, 0)}

## ANALYSIS REQUIRED

Respond with a valid JSON object (no markdown, no code blocks) with EXACTLY this structure:

{
  "pillars": [
    {
      "name": "Pillar Name in Portuguese",
      "description": "Brief description in Portuguese",
      "percentage": 30,
      "avgEngagement": 150,
      "postCount": 5
    }
  ],
  "performance": {
    "bestMediaType": "IMAGE|VIDEO|CAROUSEL_ALBUM",
    "bestMediaTypeEngagement": 200,
    "bestDayOfWeek": "Segunda-feira",
    "bestTimeOfDay": "18:00",
    "engagementByType": [
      { "type": "IMAGE", "avgEngagement": 120, "count": 10 },
      { "type": "VIDEO", "avgEngagement": 200, "count": 5 },
      { "type": "CAROUSEL_ALBUM", "avgEngagement": 180, "count": 3 }
    ],
    "avgEngagementRate": 3.5
  },
  "captionIntelligence": {
    "avgLength": 250,
    "topWords": [{ "word": "word", "count": 5 }],
    "emojiUsage": "Description of emoji usage patterns in Portuguese",
    "ctaPatterns": ["CTA pattern 1 in Portuguese"],
    "ctaEffectiveness": "Analysis in Portuguese",
    "hashtagAnalysis": {
      "mostUsed": ["#hashtag1"],
      "bestPerforming": ["#hashtag2"],
      "avgPerPost": 8
    },
    "toneDescription": "Description of the overall tone in Portuguese"
  },
  "calendarSuggestions": [
    {
      "dayOfWeek": "Segunda",
      "pillar": "Pillar name",
      "format": "Imagem|Video|Carrossel|Reels",
      "time": "18:00",
      "description": "Brief description of the suggested post in Portuguese"
    }
  ],
  "opportunities": [
    {
      "title": "Opportunity title in Portuguese",
      "description": "Detailed description with actionable advice in Portuguese",
      "expectedImpact": "high|medium|low",
      "category": "Formato|Conteudo|Engajamento|Horario|Hashtags"
    }
  ],
  "engagementDrivers": [
    "Driver 1 in Portuguese - what makes top posts succeed"
  ],
  "contentScore": 7,
  "summary": "Executive summary in Portuguese (2-3 sentences) of the overall content strategy health and key takeaway"
}

## RULES
1. Return 3-5 content pillars. Group posts by topic/theme intelligently from their captions
2. Calculate percentages accurately based on post count
3. The calendar should have 5-7 entries covering Mon-Sun
4. Provide 4-6 opportunities, mixing high/medium/low impact
5. Content score is 1-10 based on diversity, consistency, engagement patterns
6. ALL text content must be in Brazilian Portuguese (PT-BR)
7. Be specific and actionable — avoid generic advice
8. Base everything on the actual data, not assumptions
9. If there are few posts, acknowledge limitations but still provide insights
10. For engagement rates, if follower count is unknown, analyze relative engagement between posts`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a world-class social media intelligence analyst. You return ONLY valid JSON. No markdown formatting, no code blocks, just raw JSON.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 4000,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI returned invalid JSON for content intelligence");
  }

  // Assign colors to pillars
  const pillars = ((parsed.pillars as ContentPillar[]) ?? []).map(
    (p, i) => ({
      ...p,
      color: PILLAR_COLORS[i % PILLAR_COLORS.length],
    })
  );

  return {
    pillars,
    performance: parsed.performance as PerformanceInsight,
    captionIntelligence: parsed.captionIntelligence as CaptionIntelligence,
    calendarSuggestions: (parsed.calendarSuggestions as CalendarSuggestion[]) ?? [],
    opportunities: (parsed.opportunities as Opportunity[]) ?? [],
    engagementDrivers: (parsed.engagementDrivers as string[]) ?? [],
    contentScore: (parsed.contentScore as number) ?? 5,
    summary: (parsed.summary as string) ?? "",
    analyzedPostsCount: media.length,
    analyzedAt: new Date().toISOString(),
  };
}
