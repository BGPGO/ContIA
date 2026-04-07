-- ── Instagram Cache Tables ─────────────────────────────────
-- Cache de dados do Instagram para evitar chamadas excessivas à API
-- Snapshots diários de perfil + cache de mídia + insights

-- 1. Cache de mídia (posts)
CREATE TABLE IF NOT EXISTS instagram_media_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),

  ig_media_id TEXT NOT NULL,
  caption TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('IMAGE', 'VIDEO', 'CAROUSEL_ALBUM')),
  media_url TEXT,
  thumbnail_url TEXT,
  permalink TEXT,
  timestamp TIMESTAMPTZ,
  like_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  insights JSONB DEFAULT '{}',

  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(empresa_id, ig_media_id)
);

CREATE INDEX idx_ig_media_cache_empresa ON instagram_media_cache(empresa_id);
CREATE INDEX idx_ig_media_cache_timestamp ON instagram_media_cache(timestamp DESC);
CREATE INDEX idx_ig_media_cache_synced ON instagram_media_cache(synced_at);

ALTER TABLE instagram_media_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own media cache"
  ON instagram_media_cache FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own media cache"
  ON instagram_media_cache FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own media cache"
  ON instagram_media_cache FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own media cache"
  ON instagram_media_cache FOR DELETE
  USING (user_id = auth.uid());


-- 2. Cache de perfil (snapshots diários)
CREATE TABLE IF NOT EXISTS instagram_profile_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),

  username TEXT NOT NULL,
  followers_count INTEGER DEFAULT 0,
  follows_count INTEGER DEFAULT 0,
  media_count INTEGER DEFAULT 0,
  biography TEXT,
  profile_picture_url TEXT,

  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(empresa_id, snapshot_date)
);

CREATE INDEX idx_ig_profile_cache_empresa ON instagram_profile_cache(empresa_id);
CREATE INDEX idx_ig_profile_cache_date ON instagram_profile_cache(snapshot_date DESC);

ALTER TABLE instagram_profile_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile cache"
  ON instagram_profile_cache FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile cache"
  ON instagram_profile_cache FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own profile cache"
  ON instagram_profile_cache FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own profile cache"
  ON instagram_profile_cache FOR DELETE
  USING (user_id = auth.uid());


-- 3. Cache de insights (métricas diárias)
CREATE TABLE IF NOT EXISTS instagram_insights_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),

  metric_name TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('day', 'week', 'days_28', 'lifetime')),
  value INTEGER DEFAULT 0,
  end_time TIMESTAMPTZ,

  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(empresa_id, metric_name, period, end_time)
);

CREATE INDEX idx_ig_insights_cache_empresa ON instagram_insights_cache(empresa_id);
CREATE INDEX idx_ig_insights_cache_metric ON instagram_insights_cache(metric_name, period);
CREATE INDEX idx_ig_insights_cache_synced ON instagram_insights_cache(synced_at);

ALTER TABLE instagram_insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights cache"
  ON instagram_insights_cache FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own insights cache"
  ON instagram_insights_cache FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own insights cache"
  ON instagram_insights_cache FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own insights cache"
  ON instagram_insights_cache FOR DELETE
  USING (user_id = auth.uid());


-- 4. Tabela de controle de sync
CREATE TABLE IF NOT EXISTS instagram_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),

  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  profile_synced BOOLEAN DEFAULT false,
  media_count INTEGER DEFAULT 0,
  insights_count INTEGER DEFAULT 0,
  error TEXT,

  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_ig_sync_log_empresa ON instagram_sync_log(empresa_id);
CREATE INDEX idx_ig_sync_log_status ON instagram_sync_log(started_at DESC);

ALTER TABLE instagram_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync logs"
  ON instagram_sync_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sync logs"
  ON instagram_sync_log FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sync logs"
  ON instagram_sync_log FOR UPDATE
  USING (user_id = auth.uid());
