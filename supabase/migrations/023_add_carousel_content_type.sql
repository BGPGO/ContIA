-- ── 023: Adiciona 'carousel' ao CHECK constraint de content_items.content_type ──
-- Migration ADITIVA. NÃO destrói dados existentes.
--
-- Contexto: instagram-fetcher.ts mapeava CAROUSEL_ALBUM para 'post' porque
-- a constraint da migration 009 não incluía 'carousel'.
-- Após o fix no fetcher (Wave 1 – Squad A), novos upserts usarão 'carousel'.
-- Esta migration remove a constraint antiga e adiciona a nova com 'carousel'.

-- Remover constraint CHECK existente (criada em 009_inteligencia_schema.sql)
ALTER TABLE content_items
  DROP CONSTRAINT IF EXISTS content_items_content_type_check;

-- Adicionar nova constraint incluindo 'carousel'
ALTER TABLE content_items
  ADD CONSTRAINT content_items_content_type_check
  CHECK (content_type IN (
    'post', 'reel', 'story', 'carousel', 'video', 'landing_page',
    'ad_campaign', 'ad', 'email', 'whatsapp', 'youtube_video', 'youtube_short'
  ));
