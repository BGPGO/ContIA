/* ═══════════════════════════════════════════════════════════════════════════
   Canvas & Visual Template Types — Fabric.js v6 visual editor system
   ═══════════════════════════════════════════════════════════════════════════ */

// Roles that elements can have (for smart text injection)
export type CanvasElementRole =
  | 'headline'
  | 'subheadline'
  | 'body'
  | 'cta'
  | 'brand'
  | 'category'
  | 'hashtags'
  | 'slide-number'
  | 'decoration'
  | 'background'
  | 'background-image';

// Custom metadata we attach to Fabric objects
export interface ContiaObjectData {
  role: CanvasElementRole;
  editable: boolean;
  locked?: boolean;
  originalText?: string; // Text extracted from image (for revert after copy injection)
}

// Visual template stored in Supabase
export interface VisualTemplate {
  id: string;
  empresa_id: string;
  user_id: string;
  name: string;
  description: string;
  canvas_json: object; // Fabric.js serialized JSON via canvas.toJSON()
  thumbnail_url: string | null;
  format: 'post' | 'carousel' | 'story';
  aspect_ratio: '1:1' | '4:5' | '9:16';
  source: 'manual' | 'ai_chat' | 'image_extraction' | 'psd' | 'import' | 'preset';
  source_image_url: string | null;
  ai_prompt: string | null;
  tags: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

// Lighter version for lists
export interface VisualTemplateSummary {
  id: string;
  name: string;
  thumbnail_url: string | null;
  format: string;
  aspect_ratio: string;
  source: string;
  tags: string[];
  updated_at: string;
}

// Canvas dimensions per aspect ratio (full resolution for export)
export const CANVAS_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
};

// Preview dimensions (scaled down for UI)
export const PREVIEW_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 400, height: 400 },
  '4:5': { width: 400, height: 500 },
  '9:16': { width: 400, height: 711 },
};

// What's needed to apply copy to a template
export interface CopyToTemplatePayload {
  headline: string;
  subheadline?: string;
  body?: string;
  cta?: string;
  brandName?: string;
  category?: string;
  hashtags?: string[];
  slideNumber?: number;
  totalSlides?: number;
}

// Canvas editor state
export interface CanvasEditorState {
  selectedObjectId: string | null;
  selectedObjectType: string | null;
  selectedObjectRole: CanvasElementRole | null;
  zoom: number;
  aspectRatio: '1:1' | '4:5' | '9:16';
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

// Export options
export interface ExportOptions {
  format: 'png' | 'jpg';
  quality: number; // 0-1 for jpg
  multiplier: number; // 1-4 for resolution
  backgroundColor?: string;
}
