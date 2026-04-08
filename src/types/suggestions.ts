import type { SuggestedPost } from "@/types/ai";

export interface SuggestionSource {
  type: "trending" | "news" | "gap" | "seasonal" | "engagement";
  label: string;
  detail?: string; // e.g., news headline or trend name
  url?: string; // link to source
}

export interface EnrichedSuggestion extends SuggestedPost {
  source: SuggestionSource;
  confidence: number; // 0-100 score
  category: string; // which content pillar it fits
  estimated_engagement: "alto" | "médio" | "baixo";
  related_news?: {
    titulo: string;
    fonte: string;
    url: string;
  };
}

export interface SuggestionsResponse {
  suggestions: EnrichedSuggestion[];
  generated_at: string;
  context: {
    news_count: number;
    recent_posts_analyzed: number;
    dna_available: boolean;
  };
}
