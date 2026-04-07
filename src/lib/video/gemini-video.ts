import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";

const GEMINI_MODEL = "gemini-2.5-flash-preview-04-17";

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  return apiKey;
}

/**
 * Upload a video to Gemini File API, wait for processing, then analyze with a prompt.
 * Returns the raw text response from Gemini.
 */
async function analyzeVideoWithGemini(
  videoPath: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const apiKey = getApiKey();
  const fileManager = new GoogleAIFileManager(apiKey);
  const genAI = new GoogleGenerativeAI(apiKey);

  // Upload
  const upload = await fileManager.uploadFile(videoPath, {
    mimeType,
    displayName: "video",
  });

  // Wait for ACTIVE
  let file = upload.file;
  while (file.state === FileState.PROCESSING) {
    await new Promise((r) => setTimeout(r, 3000));
    file = await fileManager.getFile(file.name);
  }
  if (file.state !== FileState.ACTIVE) {
    throw new Error(`Video processing failed: state=${file.state}`);
  }

  try {
    // Analyze
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent([
      { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
      { text: prompt },
    ]);
    return result.response.text();
  } finally {
    // Cleanup uploaded file
    await fileManager.deleteFile(file.name).catch(() => {});
  }
}

/**
 * Parse a Gemini response that should contain JSON.
 * Handles markdown code fences if present.
 */
function parseJsonResponse<T>(raw: string): T {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
  }
  return JSON.parse(cleaned) as T;
}

// --- Types ---

export interface VideoAnalysis {
  summary: string;
  keyMoments: Array<{
    timestamp: string;
    startSeconds: number;
    endSeconds: number;
    description: string;
    mood: string;
  }>;
  overallMood: string;
  pacing: string;
  topics: string[];
  visualQuality: string;
  audienceTarget: string;
  duration_estimate_seconds: number;
}

export interface CutSuggestion {
  title: string;
  startSeconds: number;
  endSeconds: number;
  duration: number;
  hook: string;
  reason: string;
  viralityScore: number;
  platform: string;
  hashtags: string[];
}

export interface CutPreferences {
  style?: "viral" | "educational" | "emotional" | "technical";
  maxLengthSeconds?: number;
  minLengthSeconds?: number;
  count?: number;
  targetPlatform?: string;
}

// --- Public Functions ---

/**
 * Full video content analysis: summary, key moments with timestamps,
 * mood, pacing, topics, visual quality.
 */
export async function analyzeVideoContent(
  videoPath: string,
  mimeType: string
): Promise<VideoAnalysis> {
  const prompt = `Analyze this video in detail and return a JSON object with the following structure (and ONLY this JSON, no extra text):
{
  "summary": "A comprehensive summary of the video content in 2-3 paragraphs",
  "keyMoments": [
    {
      "timestamp": "MM:SS",
      "startSeconds": 0,
      "endSeconds": 10,
      "description": "What happens in this moment",
      "mood": "energetic/calm/funny/serious/etc"
    }
  ],
  "overallMood": "The overall mood/tone of the video",
  "pacing": "fast/moderate/slow - describe the editing rhythm",
  "topics": ["topic1", "topic2"],
  "visualQuality": "Assessment of lighting, framing, resolution, etc",
  "audienceTarget": "Who would enjoy this content",
  "duration_estimate_seconds": 120
}

Be thorough with key moments — identify at least the most important 5-10 moments.
All timestamps should be accurate to what you observe in the video.
Return ONLY valid JSON, no markdown fences, no explanation.`;

  const raw = await analyzeVideoWithGemini(videoPath, mimeType, prompt);
  return parseJsonResponse<VideoAnalysis>(raw);
}

/**
 * Suggest the best clips for short-form content (Reels, TikTok, Shorts).
 * Identifies hooks, viral potential, and optimal cut points.
 */
export async function suggestViralCuts(
  videoPath: string,
  mimeType: string,
  preferences?: CutPreferences
): Promise<CutSuggestion[]> {
  const style = preferences?.style || "viral";
  const maxLen = preferences?.maxLengthSeconds || 60;
  const minLen = preferences?.minLengthSeconds || 15;
  const count = preferences?.count || 5;
  const platform = preferences?.targetPlatform || "Instagram Reels, TikTok, YouTube Shorts";

  const prompt = `You are a viral content strategist. Watch this video and suggest the ${count} best clips to extract for short-form content.

Preferences:
- Style: ${style}
- Clip length: ${minLen}-${maxLen} seconds
- Target platform: ${platform}

Return a JSON array (and ONLY this JSON array, no extra text) with this structure:
[
  {
    "title": "Catchy title for this clip",
    "startSeconds": 0,
    "endSeconds": 30,
    "duration": 30,
    "hook": "The specific moment/phrase that hooks the viewer in the first 3 seconds",
    "reason": "Why this clip would perform well",
    "viralityScore": 85,
    "platform": "Best platform for this specific clip",
    "hashtags": ["#relevant", "#hashtags"]
  }
]

Rules:
- viralityScore is 0-100 based on hook strength, emotional impact, shareability
- Prioritize moments with strong hooks (surprising, emotional, or curiosity-inducing openings)
- Clips should be self-contained and make sense without the rest of the video
- Sort by viralityScore descending
- Return ONLY valid JSON, no markdown fences, no explanation.`;

  const raw = await analyzeVideoWithGemini(videoPath, mimeType, prompt);
  return parseJsonResponse<CutSuggestion[]>(raw);
}
