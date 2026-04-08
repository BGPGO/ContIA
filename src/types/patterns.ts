export interface StyleProfile {
  // Caption patterns
  caption_avg_length: number;
  caption_structure: string; // "hook → body → CTA" or "storytelling" etc.
  emoji_usage: "heavy" | "moderate" | "minimal" | "none";
  emoji_examples: string[]; // most used emojis
  line_break_style: string; // "frequent breaks" or "dense paragraphs"
  cta_patterns: string[]; // common CTAs used
  opening_patterns: string[]; // how posts typically start

  // Hashtag patterns
  hashtag_avg_count: number;
  hashtag_categories: string[]; // "brand", "niche", "trending"
  top_hashtags: string[];

  // Content patterns
  top_themes: string[]; // recurring themes
  content_pillars: string[]; // identified content pillars
  posting_frequency: string;
  best_performing_topics: string[]; // topics with highest engagement

  // Engagement insights
  avg_likes: number;
  avg_comments: number;
  best_time_to_post: string;
  best_format: string; // IMAGE, VIDEO, CAROUSEL_ALBUM
  engagement_rate: number;

  // Style replication data
  example_captions: string[]; // 5 best captions to use as reference
  tone_description: string; // AI-analyzed tone
  vocabulary_signature: string[]; // characteristic words/phrases

  // Metadata
  analyzed_posts_count: number;
  last_analyzed_at: string;
}

export interface PatternAnalysisRequest {
  empresa_id: string;
}

export interface PatternAnalysisResponse {
  style_profile: StyleProfile;
  source: "fresh" | "cache";
}
