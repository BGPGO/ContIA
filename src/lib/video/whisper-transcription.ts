import OpenAI from "openai";
import { Readable } from "stream";

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptionResult {
  fullText: string;
  segments: TranscriptionSegment[];
  words: TranscriptionWord[];
  srt: string;
  language: string;
  duration: number;
}

/**
 * Format seconds to SRT time format (HH:MM:SS,mmm)
 */
function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

/**
 * Generate SRT subtitle string from transcription segments
 */
function generateSrt(segments: TranscriptionSegment[]): string {
  return segments
    .map(
      (seg, i) =>
        `${i + 1}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n${seg.text.trim()}\n`
    )
    .join("\n");
}

/**
 * Transcribe a video/audio file using OpenAI Whisper API.
 * Returns structured transcription with word-level timestamps and SRT format.
 *
 * @param audioBuffer - The audio/video file as a Buffer
 * @param filename - Original filename (used to determine format, e.g. "video.mp4")
 */
export async function transcribeVideo(
  audioBuffer: Buffer,
  filename: string = "audio.mp4"
): Promise<TranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const openai = new OpenAI({ apiKey });

  // Create a File object from the buffer for the API
  const uint8 = new Uint8Array(audioBuffer);
  const file = new File([uint8], filename, {
    type: getMimeType(filename),
  });

  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    response_format: "verbose_json",
    timestamp_granularities: ["word", "segment"],
  });

  // The verbose_json response includes segments and words
  const data = response as any;

  const segments: TranscriptionSegment[] = (data.segments || []).map(
    (seg: any, i: number) => ({
      id: i,
      start: seg.start,
      end: seg.end,
      text: seg.text,
    })
  );

  const words: TranscriptionWord[] = (data.words || []).map((w: any) => ({
    word: w.word,
    start: w.start,
    end: w.end,
  }));

  const srt = generateSrt(segments);

  return {
    fullText: data.text || "",
    segments,
    words,
    srt,
    language: data.language || "unknown",
    duration: data.duration || 0,
  };
}

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/m4a",
    ogg: "audio/ogg",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
  };
  return mimeTypes[ext || ""] || "video/mp4";
}
