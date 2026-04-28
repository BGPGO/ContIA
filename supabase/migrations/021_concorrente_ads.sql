-- Migration 021: Tabela de anúncios da Meta Ad Library por concorrente
-- Aditiva/idempotente — sem DROP/TRUNCATE/RESET

-- 1. Adiciona meta_page_id em concorrente_plataformas (cache do Page ID descoberto)
ALTER TABLE public.concorrente_plataformas
  ADD COLUMN IF NOT EXISTS meta_page_id TEXT;

-- 2. Tabela principal de anúncios coletados da Meta Ad Library
CREATE TABLE IF NOT EXISTS public.concorrente_ads (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concorrente_id              UUID NOT NULL REFERENCES public.concorrentes(id) ON DELETE CASCADE,
  meta_ad_id                  TEXT NOT NULL,
  page_id                     TEXT,
  page_name                   TEXT,
  ad_snapshot_url             TEXT,
  ad_creative_bodies          JSONB,           -- array de strings (copy dos anúncios)
  ad_creative_link_titles     JSONB,           -- array de strings
  ad_creative_link_descriptions JSONB,         -- array de strings
  ad_creative_link_captions   JSONB,           -- array de strings
  publisher_platforms         JSONB,           -- array: ["FACEBOOK","INSTAGRAM",...]
  languages                   JSONB,           -- array de códigos de idioma
  ad_delivery_start_time      TIMESTAMPTZ,
  ad_delivery_stop_time       TIMESTAMPTZ,
  is_active                   BOOLEAN NOT NULL DEFAULT true,
  raw_data                    JSONB,           -- response completo da API para debug
  fetched_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT concorrente_ads_unique UNIQUE (concorrente_id, meta_ad_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_concorrente_ads_concorrente_id
  ON public.concorrente_ads (concorrente_id);

CREATE INDEX IF NOT EXISTS idx_concorrente_ads_is_active
  ON public.concorrente_ads (is_active);

-- 4. RLS — usa helper RBAC `is_empresa_member` (introduzido na migration 014)
-- consistente com policies de concorrentes / concorrente_plataformas.
ALTER TABLE public.concorrente_ads ENABLE ROW LEVEL SECURITY;

-- Limpar policies antigas (legadas/owner-only) se existirem, para garantir
-- consistência com o RBAC novo. Idempotente.
DROP POLICY IF EXISTS "Users can view own concorrente_ads" ON public.concorrente_ads;
DROP POLICY IF EXISTS "Users can insert own concorrente_ads" ON public.concorrente_ads;
DROP POLICY IF EXISTS "Users can update own concorrente_ads" ON public.concorrente_ads;
DROP POLICY IF EXISTS "Users can delete own concorrente_ads" ON public.concorrente_ads;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'concorrente_ads' AND policyname = 'members rbac concorrente_ads'
  ) THEN
    CREATE POLICY "members rbac concorrente_ads"
      ON public.concorrente_ads FOR ALL
      USING (
        concorrente_id IN (
          SELECT id FROM public.concorrentes
          WHERE public.is_empresa_member(empresa_id, 'creator')
        )
      )
      WITH CHECK (
        concorrente_id IN (
          SELECT id FROM public.concorrentes
          WHERE public.is_empresa_member(empresa_id, 'creator')
        )
      );
  END IF;
END;
$$;
