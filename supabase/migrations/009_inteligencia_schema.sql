-- ── 009: Inteligência + Relatórios — Schema Aditivo ──────────────────────────
-- Migration ADITIVA. NÃO destrói dados existentes.
-- Expande social_connections e cria tabelas genéricas para multi-provider.

-- ══════════════════════════════════════════════════════════════════════════════
-- (a) Expandir social_connections
-- ══════════════════════════════════════════════════════════════════════════════

-- Remover constraint UNIQUE antiga (1 conta por provider por empresa)
-- e substituir por UNIQUE que permite múltiplas contas do mesmo provider
ALTER TABLE social_connections
  DROP CONSTRAINT IF EXISTS social_connections_empresa_id_provider_key;

ALTER TABLE social_connections
  ADD CONSTRAINT social_connections_empresa_provider_user_key
  UNIQUE (empresa_id, provider, provider_user_id);

-- Expandir CHECK de provider para incluir novos providers
-- Primeiro remove o check antigo, depois adiciona o novo
ALTER TABLE social_connections
  DROP CONSTRAINT IF EXISTS social_connections_provider_check;

ALTER TABLE social_connections
  ADD CONSTRAINT social_connections_provider_check
  CHECK (provider IN (
    'instagram', 'facebook', 'linkedin', 'twitter', 'youtube', 'tiktok',
    'ga4', 'google_ads', 'meta_ads', 'greatpages', 'crm'
  ));

-- Nova coluna: nome amigável para o usuário quando tem múltiplas contas
ALTER TABLE social_connections
  ADD COLUMN IF NOT EXISTS display_label TEXT;

-- Popular display_label com username existente para conexões já criadas
UPDATE social_connections
  SET display_label = COALESCE(username, display_name, provider_user_id)
  WHERE display_label IS NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- (b) provider_snapshots — série temporal diária por conta
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS provider_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES social_connections(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(connection_id, snapshot_date)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- (c) content_items — posts/reels/videos/LPs/campanhas unificados
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS content_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES social_connections(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN (
    'post', 'reel', 'story', 'video', 'landing_page',
    'ad_campaign', 'email', 'whatsapp', 'youtube_video', 'youtube_short'
  )),
  title TEXT,
  caption TEXT,
  url TEXT,
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ,
  metrics JSONB DEFAULT '{}',
  raw JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(connection_id, provider_content_id)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- (d) metric_events — eventos pontuais de métricas
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS metric_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES social_connections(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  metric_value NUMERIC,
  dimension JSONB DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL,
  collected_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(connection_id, metric_key, occurred_at, dimension)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- (e) reports — relatórios gerados
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('weekly', 'monthly', 'quarterly', 'custom')),
  providers TEXT[] NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  data JSONB DEFAULT '{}',
  ai_analysis JSONB DEFAULT '{}',
  pdf_url TEXT,
  status TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- (f) scheduled_reports — agendamento de relatórios
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  schedule_cron TEXT NOT NULL,
  providers TEXT[] NOT NULL,
  template_id TEXT,
  recipients TEXT[] NOT NULL,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- (g) ai_analyses — cache de análises IA (evita recomputar)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  provider TEXT,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  inputs_hash TEXT NOT NULL,
  analysis JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE NULLS NOT DISTINCT (empresa_id, scope, provider, period_start, period_end, inputs_hash)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- (h) sync_jobs — fila de sincronização
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES social_connections(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN (
    'profile_sync', 'content_sync', 'insights_sync', 'backfill', 'token_refresh'
  )),
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'cancelled'
  )),
  priority INT DEFAULT 5,
  scheduled_for TIMESTAMPTZ DEFAULT now(),
  attempts INT DEFAULT 0,
  last_error TEXT,
  payload JSONB DEFAULT '{}',
  result JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- (i) RLS — mesmo padrão de 004_social_connections
-- ══════════════════════════════════════════════════════════════════════════════

-- Helper: empresa_id pertence ao user autenticado
-- Reutiliza o padrão existente: empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid())

-- provider_snapshots
ALTER TABLE provider_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own provider_snapshots"
  ON provider_snapshots FOR SELECT
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own provider_snapshots"
  ON provider_snapshots FOR INSERT
  WITH CHECK (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own provider_snapshots"
  ON provider_snapshots FOR UPDATE
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own provider_snapshots"
  ON provider_snapshots FOR DELETE
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

-- content_items
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own content_items"
  ON content_items FOR SELECT
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own content_items"
  ON content_items FOR INSERT
  WITH CHECK (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own content_items"
  ON content_items FOR UPDATE
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own content_items"
  ON content_items FOR DELETE
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

-- metric_events
ALTER TABLE metric_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own metric_events"
  ON metric_events FOR SELECT
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own metric_events"
  ON metric_events FOR INSERT
  WITH CHECK (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own metric_events"
  ON metric_events FOR UPDATE
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own metric_events"
  ON metric_events FOR DELETE
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

-- reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own reports"
  ON reports FOR INSERT
  WITH CHECK (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own reports"
  ON reports FOR UPDATE
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own reports"
  ON reports FOR DELETE
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

-- scheduled_reports
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduled_reports"
  ON scheduled_reports FOR SELECT
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own scheduled_reports"
  ON scheduled_reports FOR INSERT
  WITH CHECK (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own scheduled_reports"
  ON scheduled_reports FOR UPDATE
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own scheduled_reports"
  ON scheduled_reports FOR DELETE
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

-- ai_analyses
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai_analyses"
  ON ai_analyses FOR SELECT
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own ai_analyses"
  ON ai_analyses FOR INSERT
  WITH CHECK (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own ai_analyses"
  ON ai_analyses FOR UPDATE
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own ai_analyses"
  ON ai_analyses FOR DELETE
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

-- sync_jobs
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync_jobs"
  ON sync_jobs FOR SELECT
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own sync_jobs"
  ON sync_jobs FOR INSERT
  WITH CHECK (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own sync_jobs"
  ON sync_jobs FOR UPDATE
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own sync_jobs"
  ON sync_jobs FOR DELETE
  USING (empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid()));

-- ══════════════════════════════════════════════════════════════════════════════
-- (j) Indexes para performance
-- ══════════════════════════════════════════════════════════════════════════════

CREATE INDEX idx_provider_snapshots_empresa_provider_date
  ON provider_snapshots(empresa_id, provider, snapshot_date DESC);

CREATE INDEX idx_content_items_empresa_provider_published
  ON content_items(empresa_id, provider, published_at DESC);

CREATE INDEX idx_content_items_connection_synced
  ON content_items(connection_id, synced_at DESC);

CREATE INDEX idx_metric_events_empresa_provider_occurred
  ON metric_events(empresa_id, provider, occurred_at DESC);

CREATE INDEX idx_reports_empresa_created
  ON reports(empresa_id, created_at DESC);

CREATE INDEX idx_sync_jobs_pending
  ON sync_jobs(status, scheduled_for) WHERE status = 'pending';

CREATE INDEX idx_ai_analyses_empresa_scope_period
  ON ai_analyses(empresa_id, scope, period_end DESC);

-- Triggers de updated_at para tabelas que precisam
CREATE TRIGGER set_updated_at_scheduled_reports
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
