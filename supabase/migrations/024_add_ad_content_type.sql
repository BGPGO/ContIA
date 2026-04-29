-- Migration 024: adiciona 'ad' ao CHECK constraint de content_type em content_items
--
-- Contexto: Squad C (Wave 1 do Relatório Agência) passou a sincronizar anúncios
-- individuais (level=ad) com content_type='ad' no MetaAdsDriver.syncAds().
-- Sem esta migration o upsert retorna violação de constraint e os ads não são
-- salvos no banco.
--
-- Atenção: NÃO usar DROP/TRUNCATE nem --force-reset.
-- Idempotente: executa ALTER TABLE apenas se a constraint existir com o nome
-- content_items_content_type_check (nome padrão Postgres para CHECKs inline).

ALTER TABLE content_items
  DROP CONSTRAINT IF EXISTS content_items_content_type_check;

ALTER TABLE content_items
  ADD CONSTRAINT content_items_content_type_check
  CHECK (content_type IN (
    'post',
    'reel',
    'story',
    'carousel',
    'video',
    'landing_page',
    'ad_campaign',
    'ad',
    'email',
    'whatsapp',
    'youtube_video',
    'youtube_short'
  ));
