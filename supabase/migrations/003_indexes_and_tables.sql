-- ============================================================
-- Migration 003: Índices faltantes + Tabelas para features futuras
-- ============================================================

-- ── Índices faltantes nas tabelas existentes ──

-- Índice para buscar posts agendados (usado pelo futuro scheduler)
CREATE INDEX IF NOT EXISTS idx_posts_agendado_para
  ON public.posts(agendado_para)
  WHERE agendado_para IS NOT NULL;

-- Índice para buscar DNA por status
CREATE INDEX IF NOT EXISTS idx_marca_dna_status
  ON public.marca_dna(status);

-- Índice composto para DNA por empresa + status
CREATE INDEX IF NOT EXISTS idx_marca_dna_empresa_status
  ON public.marca_dna(empresa_id, status);

-- Índice composto para posts por status + empresa
CREATE INDEX IF NOT EXISTS idx_posts_status_empresa
  ON public.posts(status, empresa_id);


-- ── Tabelas para features futuras ──

-- Rastrear publicações em redes sociais
CREATE TABLE IF NOT EXISTS public.post_publishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  plataforma VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pendente',
  plataforma_post_id VARCHAR(200),
  error_message TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cache de analytics diário
CREATE TABLE IF NOT EXISTS public.analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  plataforma VARCHAR(50) NOT NULL,
  impressoes INTEGER DEFAULT 0,
  curtidas INTEGER DEFAULT 0,
  comentarios INTEGER DEFAULT 0,
  compartilhamentos INTEGER DEFAULT 0,
  seguidores_novos INTEGER DEFAULT 0,
  seguidores_total INTEGER DEFAULT 0,
  alcance INTEGER DEFAULT 0,
  engajamento DECIMAL(5, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, data, plataforma)
);

-- Jobs agendados
CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  platforms TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates persistentes (substituir localStorage)
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tone TEXT,
  platforms TEXT[] DEFAULT '{}',
  site_analysis JSONB,
  ig_analysis JSONB,
  visual_style JSONB,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger updated_at para templates
CREATE TRIGGER templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ── Índices para novas tabelas ──

CREATE INDEX IF NOT EXISTS idx_post_publishes_post_id ON public.post_publishes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_publishes_status ON public.post_publishes(status);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_empresa_data ON public.analytics_daily(empresa_id, data);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON public.scheduled_jobs(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_templates_empresa ON public.templates(empresa_id);


-- ── RLS ──

ALTER TABLE public.post_publishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- post_publishes: acesso via post → empresa → user
CREATE POLICY "Users can view own post_publishes" ON public.post_publishes
  FOR SELECT USING (
    post_id IN (
      SELECT id FROM public.posts
      WHERE empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert own post_publishes" ON public.post_publishes
  FOR INSERT WITH CHECK (
    post_id IN (
      SELECT id FROM public.posts
      WHERE empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can update own post_publishes" ON public.post_publishes
  FOR UPDATE USING (
    post_id IN (
      SELECT id FROM public.posts
      WHERE empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can delete own post_publishes" ON public.post_publishes
  FOR DELETE USING (
    post_id IN (
      SELECT id FROM public.posts
      WHERE empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
    )
  );

-- analytics_daily: acesso via empresa → user
CREATE POLICY "Users can view own analytics_daily" ON public.analytics_daily
  FOR SELECT USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own analytics_daily" ON public.analytics_daily
  FOR INSERT WITH CHECK (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own analytics_daily" ON public.analytics_daily
  FOR UPDATE USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own analytics_daily" ON public.analytics_daily
  FOR DELETE USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

-- scheduled_jobs: acesso via empresa → user
CREATE POLICY "Users can view own scheduled_jobs" ON public.scheduled_jobs
  FOR SELECT USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own scheduled_jobs" ON public.scheduled_jobs
  FOR INSERT WITH CHECK (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own scheduled_jobs" ON public.scheduled_jobs
  FOR UPDATE USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own scheduled_jobs" ON public.scheduled_jobs
  FOR DELETE USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

-- templates: acesso via empresa → user
CREATE POLICY "Users can view own templates" ON public.templates
  FOR SELECT USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own templates" ON public.templates
  FOR INSERT WITH CHECK (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own templates" ON public.templates
  FOR UPDATE USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own templates" ON public.templates
  FOR DELETE USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );
