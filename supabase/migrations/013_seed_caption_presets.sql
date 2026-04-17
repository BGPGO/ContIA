-- ============================================================
-- 013_seed_caption_presets.sql
-- 4 presets virais iniciais — globais e imutáveis
-- ============================================================

BEGIN;

-- 1. HORMOZI CLASSIC
INSERT INTO public.caption_styles (
  slug, name, description, category,
  is_preset, empresa_id, user_id,
  font_family, font_url, font_weight, text_case,
  color_base, color_keyword, color_stroke, stroke_width,
  background_type, background_color,
  position, animation,
  keyword_emphasis, supersize_multiplier,
  max_words_per_line, use_brand_colors, use_primary_font
) VALUES (
  'hormozi-classic',
  'Hormozi Clássico',
  'Amarelo icônico com stroke preto pesado. Impacto máximo para vídeos de negócios.',
  'viral',
  true, NULL, NULL,
  'Montserrat', NULL, 900, 'upper',
  '#FFFFFF', '#F7C204', '#000000', 6,
  'none', NULL,
  'lower-third', 'pop-in',
  'color-only', 1.0,
  3, false, false
) ON CONFLICT (slug, user_id) DO NOTHING;

-- 2. MRBEAST
INSERT INTO public.caption_styles (
  slug, name, description, category,
  is_preset, empresa_id, user_id,
  font_family, font_url, font_weight, text_case,
  color_base, color_keyword, color_stroke, stroke_width,
  background_type, background_color,
  position, animation,
  keyword_emphasis, supersize_multiplier,
  max_words_per_line, use_brand_colors, use_primary_font
) VALUES (
  'mrbeast-beast',
  'MrBeast',
  'Estilo cartoon agressivo. Bangers com stroke grosso e pulse verde-neon.',
  'entertainment',
  true, NULL, NULL,
  'Bangers', NULL, 400, 'upper',
  '#FFFFFF', '#02FB23', '#000000', 8,
  'none', NULL,
  'lower-third', 'glow-pulse',
  'supersize', 1.3,
  3, false, false
) ON CONFLICT (slug, user_id) DO NOTHING;

-- 3. ALI MINIMAL
INSERT INTO public.caption_styles (
  slug, name, description, category,
  is_preset, empresa_id, user_id,
  font_family, font_url, font_weight, text_case,
  color_base, color_keyword, color_stroke, stroke_width,
  background_type, background_color,
  position, animation,
  keyword_emphasis, supersize_multiplier,
  max_words_per_line, use_brand_colors, use_primary_font
) VALUES (
  'ali-minimal',
  'Ali Minimal',
  'Clean, elegante. Inter medium, sem stroke, fade suave palavra a palavra.',
  'minimal',
  true, NULL, NULL,
  'Inter', NULL, 500, 'title',
  '#FFFFFF', '#FFD54F', NULL, 0,
  'none', NULL,
  'bottom', 'word-fade',
  'color-only', 1.0,
  5, false, false
) ON CONFLICT (slug, user_id) DO NOTHING;

-- 4. KARAOKÊ CLÁSSICO
INSERT INTO public.caption_styles (
  slug, name, description, category,
  is_preset, empresa_id, user_id,
  font_family, font_url, font_weight, text_case,
  color_base, color_keyword, color_stroke, stroke_width,
  background_type, background_color,
  position, animation,
  keyword_emphasis, supersize_multiplier,
  max_words_per_line, use_brand_colors, use_primary_font
) VALUES (
  'karaoke-classic',
  'Karaokê Clássico',
  'Palavra ativa muda de cor sem scale. Bebas Neue, estilo pop.',
  'viral',
  true, NULL, NULL,
  'Bebas Neue', NULL, 400, 'upper',
  '#FFFFFF', '#F7C204', '#000000', 3,
  'none', NULL,
  'lower-third', 'color-switch',
  'color-only', 1.0,
  4, false, false
) ON CONFLICT (slug, user_id) DO NOTHING;

COMMIT;
