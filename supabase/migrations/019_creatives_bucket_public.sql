-- 019_creatives_bucket_public.sql
-- Torna bucket creatives público pra que URLs de imagens não expirem.
-- Criativos são conteúdo de redes sociais (público por natureza), path tem UUIDs
-- (não é descoberta trivial), e signed URLs com TTL curto causam thumbs quebrados
-- na biblioteca histórica.

update storage.buckets
set public = true
where id = 'creatives';

-- Policy de SELECT público — necessária pra public URLs funcionarem mesmo anon
drop policy if exists creatives_public_select on storage.objects;
create policy creatives_public_select on storage.objects
  for select
  using (bucket_id = 'creatives');

-- INSERT continua restrito: só membro da empresa (policy existente da 015 preservada).
