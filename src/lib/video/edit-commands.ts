import { createClient } from "@/lib/supabase/server";
import {
  VideoProject,
  VideoEdits,
  VideoCut,
  LogoOverlay,
  VideoTranscription,
  formatTimestamp,
} from "./video-agent";

// ═══════════════════════════════════════════════════════════════════════
// EDIT OPERATIONS — translate agent actions into project edits
// ═══════════════════════════════════════════════════════════════════════

/**
 * Add a cut segment to the project
 */
export function addCut(
  project: VideoProject,
  start: number,
  end: number,
  label?: string
): VideoEdits {
  const newCut: VideoCut = {
    id: crypto.randomUUID(),
    start: Math.max(0, start),
    end: Math.min(end, project.duration_seconds),
    label: label || `Corte ${formatTimestamp(start)} - ${formatTimestamp(end)}`,
    created_at: new Date().toISOString(),
  };

  return {
    ...project.edits,
    cuts: [...project.edits.cuts, newCut].sort((a, b) => a.start - b.start),
  };
}

/**
 * Adjust an existing cut's start/end times
 */
export function adjustCut(
  project: VideoProject,
  cutIndex: number,
  newStart?: number,
  newEnd?: number
): VideoEdits {
  const cuts = [...project.edits.cuts];
  if (cutIndex < 0 || cutIndex >= cuts.length) {
    return project.edits; // invalid index, return unchanged
  }

  const cut = { ...cuts[cutIndex] };
  if (newStart !== undefined) cut.start = Math.max(0, newStart);
  if (newEnd !== undefined) cut.end = Math.min(newEnd, project.duration_seconds);

  // Ensure start < end
  if (cut.start >= cut.end) {
    return project.edits;
  }

  cut.label = cut.label || `Corte ${formatTimestamp(cut.start)} - ${formatTimestamp(cut.end)}`;
  cuts[cutIndex] = cut;

  return {
    ...project.edits,
    cuts: cuts.sort((a, b) => a.start - b.start),
  };
}

/**
 * Remove a cut by index
 */
export function removeCut(project: VideoProject, cutIndex: number): VideoEdits {
  const cuts = [...project.edits.cuts];
  if (cutIndex < 0 || cutIndex >= cuts.length) {
    return project.edits;
  }

  cuts.splice(cutIndex, 1);

  return {
    ...project.edits,
    cuts,
  };
}

/**
 * Toggle subtitles on/off
 */
export function addSubtitles(project: VideoProject, enabled: boolean): VideoEdits {
  const edits: VideoEdits = {
    ...project.edits,
    subtitles_enabled: enabled,
  };

  // If enabling subtitles and transcription exists, auto-generate SRT
  if (enabled && project.transcription) {
    edits.srt_content = generateSRT(
      project.transcription,
      0,
      project.duration_seconds
    );
  }

  return edits;
}

/**
 * Add/update logo overlay configuration
 */
export function addLogo(
  project: VideoProject,
  position: LogoOverlay["position"],
  logoUrl: string,
  size: number = 10,
  opacity: number = 0.9
): VideoEdits {
  return {
    ...project.edits,
    logo: {
      url: logoUrl,
      position,
      size: Math.min(25, Math.max(5, size)),
      opacity: Math.min(1, Math.max(0, opacity)),
    },
  };
}

/**
 * Remove logo overlay
 */
export function removeLogo(project: VideoProject): VideoEdits {
  const edits = { ...project.edits };
  delete edits.logo;
  return edits;
}

// ═══════════════════════════════════════════════════════════════════════
// SRT GENERATION
// ═══════════════════════════════════════════════════════════════════════

function formatSRTTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
}

/**
 * Generate SRT subtitle content from transcription for a specific time range
 */
export function generateSRT(
  transcription: VideoTranscription,
  startTime: number,
  endTime: number
): string {
  const filteredSegments = transcription.segments.filter(
    (seg) => seg.start >= startTime && seg.end <= endTime
  );

  if (filteredSegments.length === 0) return "";

  const lines: string[] = [];
  let counter = 1;

  for (const segment of filteredSegments) {
    // Split long segments into chunks of ~10 words for readability
    const words = segment.text.trim().split(/\s+/);
    const chunkSize = 10;

    if (words.length <= chunkSize) {
      lines.push(String(counter));
      lines.push(`${formatSRTTimestamp(segment.start)} --> ${formatSRTTimestamp(segment.end)}`);
      lines.push(segment.text.trim());
      lines.push("");
      counter++;
    } else {
      // Split into sub-chunks with interpolated timestamps
      const totalDuration = segment.end - segment.start;
      const numChunks = Math.ceil(words.length / chunkSize);
      const chunkDuration = totalDuration / numChunks;

      for (let i = 0; i < numChunks; i++) {
        const chunkWords = words.slice(i * chunkSize, (i + 1) * chunkSize);
        const chunkStart = segment.start + i * chunkDuration;
        const chunkEnd = segment.start + (i + 1) * chunkDuration;

        lines.push(String(counter));
        lines.push(`${formatSRTTimestamp(chunkStart)} --> ${formatSRTTimestamp(chunkEnd)}`);
        lines.push(chunkWords.join(" "));
        lines.push("");
        counter++;
      }
    }
  }

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════
// SUPABASE PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Save updated edits to Supabase video_projects table
 */
export async function saveEdits(
  projectId: string,
  edits: VideoEdits
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("video_projects")
    .update({
      edits,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(`Falha ao salvar edicoes: ${error.message}`);
  }
}

/**
 * Load a video project from Supabase
 */
export async function loadVideoProject(
  projectId: string
): Promise<VideoProject | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("video_projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    edits: data.edits || { cuts: [], subtitles_enabled: false },
    chat_messages: data.chat_messages || [],
  } as VideoProject;
}

/**
 * Save chat messages to the project
 */
export async function saveChatMessages(
  projectId: string,
  messages: Array<{ role: "user" | "assistant"; content: string; action?: unknown }>
): Promise<void> {
  const supabase = await createClient();

  const chatMessages = messages.map((m) => ({
    ...m,
    timestamp: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("video_projects")
    .update({
      chat_messages: chatMessages,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(`Falha ao salvar mensagens: ${error.message}`);
  }
}
