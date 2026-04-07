-- ── Social Connections ─────────────────────────────────────
-- Armazena credenciais de redes sociais de forma segura
-- Separado da tabela empresas para manter secrets isolados

CREATE TABLE IF NOT EXISTS social_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),

  -- Identificação da rede
  provider TEXT NOT NULL CHECK (provider IN ('instagram', 'facebook', 'linkedin', 'twitter', 'youtube', 'tiktok')),

  -- Dados do perfil
  provider_user_id TEXT NOT NULL,        -- ex: IG Business Account ID
  username TEXT,
  display_name TEXT,
  profile_picture_url TEXT,

  -- Credenciais (sensíveis)
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Meta/Facebook específico
  page_id TEXT,                          -- Facebook Page ID (necessário para IG)
  page_access_token TEXT,
  app_id TEXT,

  -- Permissões concedidas
  scopes TEXT[] DEFAULT '{}',

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  last_error TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Uma conexão por rede por empresa
  UNIQUE(empresa_id, provider)
);

-- Índices
CREATE INDEX idx_social_connections_empresa ON social_connections(empresa_id);
CREATE INDEX idx_social_connections_provider ON social_connections(provider);
CREATE INDEX idx_social_connections_active ON social_connections(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connections"
  ON social_connections FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own connections"
  ON social_connections FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own connections"
  ON social_connections FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own connections"
  ON social_connections FOR DELETE
  USING (user_id = auth.uid());

-- Trigger de updated_at
CREATE TRIGGER set_updated_at_social_connections
  BEFORE UPDATE ON social_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
