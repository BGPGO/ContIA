export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createReadStream } from "fs";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

/**
 * POST /api/video/transcribe
 * Receives a video file directly and transcribes with Whisper.
 * Returns word-level timestamps + segments + SRT.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("video") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No video file provided" }, { status: 400 });
    }

    console.log(`[transcribe] Processing: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);

    // Save to temp file (Whisper API needs a file)
    const bytes = await file.arrayBuffer();
    const ext = file.name.split(".").pop() || "mp4";
    const tmpPath = join(tmpdir(), `whisper-${Date.now()}.${ext}`);
    await writeFile(tmpPath, Buffer.from(bytes));

    try {
      const openai = new OpenAI({ apiKey });

      // Use Whisper with verbose JSON for timestamps
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcription = await openai.audio.transcriptions.create({
        file: createReadStream(tmpPath) as any,
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["word", "segment"],
        language: "pt",
      });

      const segments = (transcription as any).segments?.map((s: any, i: number) => ({
        id: `seg-${i}`,
        start: s.start,
        end: s.end,
        text: s.text.trim(),
      })) || [];

      const words = (transcription as any).words || [];

      // Generate SRT
      const srt = segments.map((s: any, i: number) => {
        const startSRT = formatSRTTime(s.start);
        const endSRT = formatSRTTime(s.end);
        return `${i + 1}\n${startSRT} --> ${endSRT}\n${s.text}\n`;
      }).join("\n");

      console.log(`[transcribe] Done: ${segments.length} segments, ${words.length} words`);

      return NextResponse.json({
        text: transcription.text || "",
        segments,
        words,
        srt,
        language: (transcription as any).language || "pt",
        duration: (transcription as any).duration || 0,
      });
    } finally {
      await unlink(tmpPath).catch(() => {});
    }
  } catch (err) {
    console.error("[transcribe] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Transcription failed" },
      { status: 500 }
    );
  }
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}
