import type { WordTimestamp, Keyword } from './captions';

export interface VideoProject {
  id: string;
  empresaId: string;
  title: string;
  videoUrl: string;
  originalFileName: string;
  duration: number; // seconds
  transcription: TranscriptionSegment[];
  aiSummary: string;
  cuts: VideoCut[];
  edits: VideoEdit[];
  status: VideoProjectStatus;
  analysis?: VideoAnalysis | null;
  wordTimestamps?: WordTimestamp[]; // word-level timestamps from Whisper (migration 012)
  keywords?: Keyword[]; // prep Fase 3
  createdAt: string;
  updatedAt: string;
}

export interface VideoAnalysis {
  summary: string;
  type: string;
  viral_potential: { score: number; reason: string };
  strengths: string[];
  cuts: { title: string; startTime: number; endTime: number; description: string; viral_score: number }[];
}

export type VideoProjectStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "analyzed"
  | "editing";

export interface TranscriptionSegment {
  id: string;
  start: number; // seconds
  end: number; // seconds
  text: string;
}

export interface VideoCut {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  description: string;
  accepted: boolean;
}

export interface VideoEdit {
  type: "subtitle" | "logo" | "trim" | "speed";
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  actions?: ChatAction[];
}

export interface ChatAction {
  type: "cut_suggestion" | "subtitle_toggle" | "logo_position" | "speed_change";
  label: string;
  data: Record<string, unknown>;
  status: "pending" | "accepted" | "rejected";
}

export type LogoPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface SubtitleStyle {
  fontSize: "sm" | "md" | "lg" | "xl";
  color: string;
  bgColor: string;
  fontWeight: "normal" | "bold" | "extrabold";
  position: "bottom" | "center" | "top";
  animation: "none" | "fade" | "pop";
  fontFamily: "sans" | "mono" | "serif";
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontSize: "lg",
  color: "#FFFFFF",
  bgColor: "transparent",
  fontWeight: "extrabold",
  position: "bottom",
  animation: "pop",
  fontFamily: "sans",
};

// Re-export de CaptionStyle para conveniência
export type { CaptionStyle, WordTimestamp, Keyword } from './captions';

export const SUBTITLE_PRESETS: Record<string, { label: string; style: SubtitleStyle }> = {
  viral: {
    label: "Viral",
    style: {
      fontSize: "xl",
      color: "#FFFFFF",
      bgColor: "transparent",
      fontWeight: "extrabold",
      position: "center",
      animation: "pop",
      fontFamily: "sans",
    },
  },
  classico: {
    label: "Classico",
    style: {
      fontSize: "md",
      color: "#FFFFFF",
      bgColor: "#000000CC",
      fontWeight: "normal",
      position: "bottom",
      animation: "fade",
      fontFamily: "sans",
    },
  },
  minimalista: {
    label: "Minimalista",
    style: {
      fontSize: "sm",
      color: "#E5E7EB",
      bgColor: "transparent",
      fontWeight: "normal",
      position: "bottom",
      animation: "none",
      fontFamily: "sans",
    },
  },
  neon: {
    label: "Neon",
    style: {
      fontSize: "lg",
      color: "#00FF88",
      bgColor: "transparent",
      fontWeight: "bold",
      position: "bottom",
      animation: "pop",
      fontFamily: "mono",
    },
  },
};
