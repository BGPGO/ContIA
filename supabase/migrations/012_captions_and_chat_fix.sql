-- ============================================================
-- 012_captions_and_chat_fix.sql
-- Fase 1 — Legendas Virais DIY
-- Adiciona colunas em video_projects e cria caption_styles
-- ============================================================

BEGIN;

-- ----- 1. Colunas novas em video_projects ------------------------

ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS chat_messages JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS word_timestamps JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS keywords JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS selected_style_id UUID NULL;

-- ----- 2. Tabela caption_styles ---------------------------------

CREATE TABLE IF NOT EXISTS public.caption_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  slug         TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT NULL,
  category     TEXT NOT NULL CHECK (category IN ('viral','minimal','entertainment','business','aesthetic')),

  is_preset    BOOLEAN NOT NULL DEFAULT false,
  empresa_id   UUID NULL,
  user_id      UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cloned_from  UUID NULL REFERENCES public.caption_styles(id) ON DELETE SET NULL,

  font_family  TEXT NOT NULL,
  font_url     TEXT NULL,
  font_weight  INTEGER NOT NULL DEFAULT 700 CHECK (font_weight BETWEEN 100 AND 900),
  text_case    TEXT NOT NULL DEFAULT 'upper' CHECK (text_case IN ('upper','lower','title','sentence')),

  color_base    TEXT NOT NULL DEFAULT '#FFFFFF',
  color_keyword TEXT NOT NULL DEFAULT '#F7C204',
  color_stroke  TEXT NULL,
  stroke_width  INTEGER NOT NULL DEFAULT 0 CHECK (stroke_width BETWEEN 0 AND 20),

  background_type  TEXT NOT NULL DEFAULT 'none' CHECK (background_type IN ('none','pill','box')),
  background_color TEXT NULL,

  position TEXT NOT NULL DEFAULT 'bottom' CHECK (position IN ('top','upper-third','center','lower-third','bottom')),

  animation TEXT NOT NULL DEFAULT 'none' CHECK (animation IN (
    'none','fade','pop-in','pop-scale','bounce-aggressive',
    'word-fade','color-switch','pill-slide-in','scale-keyword',
    'char-by-char','fade-soft','glow-pulse'
  )),

  keyword_emphasis     TEXT NOT NULL DEFAULT 'color-only' CHECK (keyword_emphasis IN (
    'color-only','supersize','pill','glow','stroke-color'
  )),
  supersize_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (supersize_multiplier BETWEEN 1.0 AND 3.0),

  max_words_per_line INTEGER NOT NULL DEFAULT 4 CHECK (max_words_per_line BETWEEN 1 AND 10),
  use_brand_colors   BOOLEAN NOT NULL DEFAULT false,
  use_primary_font   BOOLEAN NOT NULL DEFAULT false,

  preview_video_url TEXT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT caption_styles_slug_scope_unique UNIQUE (slug, user_id)
);

-- ----- 3. Índices ------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS caption_styles_is_preset_idx ON public.caption_styles (is_preset);
CREATE INDEX IF NOT EXISTS caption_styles_user_id_idx   ON public.caption_styles (user_id);
CREATE INDEX IF NOT EXISTS caption_styles_category_idx  ON public.caption_styles (category);
CREATE INDEX IF NOT EXISTS caption_styles_name_trgm_idx ON public.caption_styles USING gin (name gin_trgm_ops);

-- ----- 4. Trigger de updated_at ----------------------------------

CREATE OR REPLACE FUNCTION public.caption_styles_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS caption_styles_updated_at_trg ON public.caption_styles;
CREATE TRIGGER caption_styles_updated_at_trg
BEFORE UPDATE ON public.caption_styles
FOR EACH ROW EXECUTE FUNCTION public.caption_styles_set_updated_at();

-- ----- 5. RLS ----------------------------------------------------

ALTER TABLE public.caption_styles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS caption_styles_select ON public.caption_styles;
CREATE POLICY caption_styles_select ON public.caption_styles
  FOR SELECT
  USING (is_preset = true OR user_id = auth.uid());

DROP POLICY IF EXISTS caption_styles_insert ON public.caption_styles;
CREATE POLICY caption_styles_insert ON public.caption_styles
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_preset = false);

DROP POLICY IF EXISTS caption_styles_update ON public.caption_styles;
CREATE POLICY caption_styles_update ON public.caption_styles
  FOR UPDATE
  USING (user_id = auth.uid() AND is_preset = false)
  WITH CHECK (user_id = auth.uid() AND is_preset = false);

DROP POLICY IF EXISTS caption_styles_delete ON public.caption_styles;
CREATE POLICY caption_styles_delete ON public.caption_styles
  FOR DELETE
  USING (user_id = auth.uid() AND is_preset = false);

-- ----- 6. FK soft de video_projects.selected_style_id ------------

ALTER TABLE public.video_projects
  DROP CONSTRAINT IF EXISTS video_projects_selected_style_id_fkey;

ALTER TABLE public.video_projects
  ADD CONSTRAINT video_projects_selected_style_id_fkey
  FOREIGN KEY (selected_style_id)
  REFERENCES public.caption_styles(id)
  ON DELETE SET NULL;

COMMIT;
