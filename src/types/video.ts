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
  createdAt: string;
  updatedAt: string;
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
