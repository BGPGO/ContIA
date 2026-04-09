-- ═══════════════════════════════════════════════════════════════════════════
-- 008: Brand Assets — Logos, fonts, elements, textures, photos
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('logo','font','element','texture','photo')),
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_brand_assets_empresa ON public.brand_assets(empresa_id);
CREATE INDEX idx_brand_assets_type ON public.brand_assets(type);

ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as other tables)
CREATE POLICY "Users can view own brand_assets" ON public.brand_assets
  FOR SELECT USING (empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own brand_assets" ON public.brand_assets
  FOR INSERT WITH CHECK (empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own brand_assets" ON public.brand_assets
  FOR UPDATE USING (empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete own brand_assets" ON public.brand_assets
  FOR DELETE USING (empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid()));

CREATE TRIGGER brand_assets_updated_at
  BEFORE UPDATE ON public.brand_assets FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add brand palette columns to empresas if not present
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS brand_colors TEXT[] DEFAULT '{}';
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS brand_fonts TEXT[] DEFAULT '{}';
