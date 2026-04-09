-- ============================================================
-- Migration 007: Copy Studio sessions + Visual Templates + Canvas
-- ============================================================

-- ── Copy Sessions table ──

CREATE TABLE IF NOT EXISTS public.copy_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'post',
  tone TEXT NOT NULL DEFAULT 'casual',
  platforms TEXT[] DEFAULT '{}',
  topic TEXT DEFAULT '',
  current_copy JSONB,
  messages JSONB NOT NULL DEFAULT '[]',
  dna_context JSONB,
  style_profile JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','designed','exported')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Visual Templates table (Phase 2, created now to avoid future migration) ──

CREATE TABLE IF NOT EXISTS public.visual_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  canvas_json JSONB NOT NULL DEFAULT '{}',
  thumbnail_url TEXT,
  format TEXT DEFAULT 'post',
  aspect_ratio TEXT DEFAULT '1:1',
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual','ai_chat','image_extraction','psd','import')),
  source_image_url TEXT,
  ai_prompt TEXT,
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Add canvas_data and copy_session_id to posts table ──

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS canvas_data JSONB;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS copy_session_id UUID REFERENCES public.copy_sessions(id) ON DELETE SET NULL;

-- ── Triggers: updated_at ──

CREATE TRIGGER copy_sessions_updated_at
  BEFORE UPDATE ON public.copy_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER visual_templates_updated_at
  BEFORE UPDATE ON public.visual_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Indexes ──

CREATE INDEX IF NOT EXISTS idx_copy_sessions_empresa ON public.copy_sessions(empresa_id);
CREATE INDEX IF NOT EXISTS idx_copy_sessions_user ON public.copy_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_copy_sessions_status ON public.copy_sessions(status);
CREATE INDEX IF NOT EXISTS idx_copy_sessions_updated ON public.copy_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_visual_templates_empresa ON public.visual_templates(empresa_id);
CREATE INDEX IF NOT EXISTS idx_visual_templates_format ON public.visual_templates(format);
CREATE INDEX IF NOT EXISTS idx_posts_copy_session ON public.posts(copy_session_id) WHERE copy_session_id IS NOT NULL;

-- ── RLS ──

ALTER TABLE public.copy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_templates ENABLE ROW LEVEL SECURITY;

-- copy_sessions: acesso via empresa -> user
CREATE POLICY "Users can view own copy_sessions" ON public.copy_sessions
  FOR SELECT USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own copy_sessions" ON public.copy_sessions
  FOR INSERT WITH CHECK (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own copy_sessions" ON public.copy_sessions
  FOR UPDATE USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own copy_sessions" ON public.copy_sessions
  FOR DELETE USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

-- visual_templates: acesso via empresa -> user
CREATE POLICY "Users can view own visual_templates" ON public.visual_templates
  FOR SELECT USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own visual_templates" ON public.visual_templates
  FOR INSERT WITH CHECK (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own visual_templates" ON public.visual_templates
  FOR UPDATE USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own visual_templates" ON public.visual_templates
  FOR DELETE USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );
