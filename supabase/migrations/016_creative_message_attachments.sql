-- 016_creative_message_attachments.sql
-- Adiciona coluna attachments (jsonb) em creative_messages pra suportar imagens
-- anexadas pelo usuário no chat de Criativos.

alter table public.creative_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;
