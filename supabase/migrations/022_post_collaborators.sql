-- 022_post_collaborators.sql
-- Adiciona suporte a colaboradores (Collab) no Instagram para posts agendados.
-- Array de usernames sem o "@" (ex: {"user1","user2"}).
-- Compatível com IMAGE, REELS e CAROUSEL_ALBUM (não children do carousel).

alter table public.posts
  add column if not exists instagram_collaborators text[] not null default '{}';

-- GIN index para queries de filtro/busca por collaborators (ex: WHERE 'user1' = ANY(instagram_collaborators))
create index if not exists posts_instagram_collaborators_gin
  on public.posts using gin(instagram_collaborators)
  where array_length(instagram_collaborators, 1) > 0;
