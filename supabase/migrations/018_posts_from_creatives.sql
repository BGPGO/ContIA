-- 018_posts_from_creatives.sql
-- Expande posts pra receber carrossel de PNGs e rastrear origem (creative message)

alter table public.posts
  add column if not exists midia_urls jsonb not null default '[]'::jsonb,
  add column if not exists creative_message_id uuid references public.creative_messages(id) on delete set null;

create index if not exists posts_creative_message_idx
  on public.posts(creative_message_id)
  where creative_message_id is not null;
