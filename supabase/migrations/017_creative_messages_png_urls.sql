-- 017_creative_messages_png_urls.sql
-- Adiciona png_urls jsonb pra suportar carrossel (array de PNGs).
-- png_url continua existindo como primeiro slide (compat).

alter table public.creative_messages
  add column if not exists png_urls jsonb not null default '[]'::jsonb;
