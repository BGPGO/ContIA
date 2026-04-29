/**
 * AgencyReportData — estrutura unificada do Relatório Agência ContIA.
 * Criado na Wave 2 (Squad D). Sem IA — apenas dados agregados.
 *
 * Squad E consome este tipo para gerar a análise IA.
 */

export interface KpiValue {
  value: number | null;
  previousValue: number | null;
  /** diferença absoluta (value - previousValue) */
  delta: number | null;
  /** -1 a +inf, ou null se previousValue === 0 */
  deltaPercent: number | null;
  trend: "up" | "down" | "flat";
  format?: "integer" | "decimal" | "currency_brl" | "percent";
}

export interface AgencyReportData {
  meta: {
    empresaId: string;
    empresaNome: string;
    periodStart: string; // ISO date YYYY-MM-DD
    periodEnd: string;
    previousStart: string;
    previousEnd: string;
    generatedAt: string;
    providersIncluded: ("instagram" | "facebook" | "meta_ads")[];
  };

  panorama: {
    totalReach: KpiValue;
    totalEngagement: KpiValue;
    totalSpend: KpiValue;
    totalLeads: KpiValue;
    costPerLead: KpiValue;
    byNetwork: Array<{
      provider: string;
      label: string;
      reach: KpiValue;
      engagement: KpiValue;
    }>;
  };

  instagram: {
    perfil: {
      followers: KpiValue;
      reach: KpiValue;
      profileVisits: KpiValue;
      profileLinkTaps: KpiValue;
      viewsTotal: KpiValue;
      followersGrowth: Array<{ date: string; value: number }>;
      reachDaily: Array<{ date: string; value: number }>;
    };
    audience: {
      /** ex: "M.25-34" -> 1234 */
      genderAge: Record<string, number>;
      cities: Array<{ city: string; followers: number }>;
      /** email/call/etc */
      profileLinkTapsBreakdown: Record<string, number>;
    };
    feed: {
      interactions: KpiValue;
      postsCount: KpiValue;
      reach: KpiValue;
      comments: KpiValue;
      shares: KpiValue;
      likes: KpiValue;
      saves: KpiValue;
    };
    reels: {
      reelsCount: KpiValue;
      reach: KpiValue;
      views: KpiValue;
      interactions: KpiValue;
      topReels: Array<{
        id: string;
        thumbnail: string | null;
        caption: string | null;
        permalink: string | null;
        publishedAt: string;
        reach: number;
        views: number;
        likes: number;
        saves: number;
        comments: number;
        shares: number;
        interactions: number;
      }>;
    };
    stories: {
      storiesCount: KpiValue;
      profileVisits: KpiValue;
      followsFromStories: KpiValue;
      retention: KpiValue;
      interactions: KpiValue;
      individuals: Array<{
        id: string;
        thumbnail: string | null;
        publishedAt: string;
        impressions: number;
        reach: number;
        replies: number;
        exits: number;
        tapsForward: number;
        tapsBack: number;
        nextStory: number;
      }>;
    };
    bestTime: Array<{ dayOfWeek: number; hour: number; engagementAvg: number }>;
    topPosts: Array<{
      id: string;
      type: "post" | "carousel" | "reel";
      thumbnail: string | null;
      caption: string | null;
      permalink: string | null;
      publishedAt: string;
      reach: number;
      likes: number;
      comments: number;
      saves: number;
      shares: number;
      interactions: number;
    }>;
  };

  facebook: {
    perfil: {
      pageFollowers: KpiValue;
      newFollowers: KpiValue;
      pageReach: KpiValue;
      pageViews: KpiValue;
      pageMessagesNew: KpiValue;
      followersGrowth: Array<{ date: string; value: number }>;
      reachDaily: Array<{ date: string; value: number }>;
    };
    audience: {
      cities: Array<{ city: string; followers: number }>;
      genderAge: Record<string, number>;
    };
    posts: {
      postsCount: KpiValue;
      totalReach: KpiValue;
      organicReach: KpiValue;
      paidReach: KpiValue;
      reactions: KpiValue;
      comments: KpiValue;
      shares: KpiValue;
      topPosts: Array<{
        id: string;
        thumbnail: string | null;
        caption: string | null;
        permalink: string | null;
        publishedAt: string;
        type: "post" | "reel";
        totalReach: number;
        organicReach: number;
        paidReach: number;
        reactions: number;
        comments: number;
        shares: number;
        clicks: number;
      }>;
    };
    reels: {
      reelsCount: KpiValue;
      views: KpiValue;
      reach: KpiValue;
      avgWatchTime: KpiValue;
      topReels: Array<{
        id: string;
        thumbnail: string | null;
        title: string | null;
        permalink: string | null;
        publishedAt: string;
        views: number;
        reach: number;
        avgWatchTime: number;
        completeViews: number;
        /** TODO(wave5-K): driver FB precisa expor likes por reel */
        likes?: number;
        /** TODO(wave5-K): driver FB precisa expor comments por reel */
        comments?: number;
        /** TODO(wave5-K): driver FB precisa expor shares por reel */
        shares?: number;
      }>;
    };
  };

  metaAds: {
    overview: {
      spend: KpiValue;
      leads: KpiValue;
      costPerLead: KpiValue;
      reach: KpiValue;
      impressions: KpiValue;
      linkClicks: KpiValue;
      ctr: KpiValue;
      cpm: KpiValue;
      cpc: KpiValue;
      frequency: KpiValue;
    };
    byPlatform: {
      facebook: {
        reach: KpiValue;
        impressions: KpiValue;
        clicks: KpiValue;
        spend: KpiValue;
      };
      instagram: {
        reach: KpiValue;
        impressions: KpiValue;
        clicks: KpiValue;
        spend: KpiValue;
      };
    };
    spendTimeline: Array<{ date: string; value: number }>;
    topCampaigns: Array<{
      id: string;
      name: string;
      objective: string | null;
      reach: number;
      impressions: number;
      cpm: number;
      frequency: number;
      spend: number;
      /** contextual: leads se objetivo lead, etc */
      results: number;
      costPerResult: number;
    }>;
    topAds: Array<{
      id: string;
      name: string;
      thumbnail: string | null;
      campaignId: string | null;
      reach: number;
      impressions: number;
      clicks: number;
      cpm: number;
      cpc: number;
      spend: number;
      results: number;
      costPerResult: number;
    }>;
  };
}

/* ── AgencyRecommendation — adicionado pelo Squad E (Wave 2) ─────────────── */

export interface AgencyRecommendation {
  action: string;
  priority: "high" | "medium" | "low";
  rationale: string;
  estimatedImpact?: string;
}
