-- ══════════════════════════════════════════════════════════════════════════════
-- 010: Migrar dados legados de Instagram para tabelas novas (social_connections,
--      provider_snapshots, content_items).
--
-- Migration ADITIVA — NUNCA faz DROP, TRUNCATE ou UPDATE em tabelas legadas.
-- Usa INSERT ... WHERE NOT EXISTS para idempotencia.
-- ══════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Migrar conexoes de empresas.redes_sociais → social_connections
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO social_connections (
  id, empresa_id, user_id, provider, provider_user_id,
  username, display_name, profile_picture_url,
  access_token, token_expires_at,
  is_active, scopes, metadata, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  e.id,
  e.user_id,
  'instagram',
  COALESCE(e.redes_sociais->'instagram'->>'provider_user_id', 'legacy_' || e.id::text),
  e.redes_sociais->'instagram'->>'username',
  e.redes_sociais->'instagram'->>'username',
  e.redes_sociais->'instagram'->>'profile_picture_url',
  e.redes_sociais->'instagram'->>'access_token',
  NULL,  -- token_expires_at desconhecido para dados legados
  (e.redes_sociais->'instagram'->>'conectado')::boolean,
  ARRAY['instagram_business_basic','instagram_business_content_publish','instagram_business_manage_comments','instagram_business_manage_insights'],
  jsonb_build_object(
    'migrated_from', 'empresa.redes_sociais',
    'migrated_at', now()
  ),
  COALESCE(e.updated_at, now()),
  now()
FROM empresas e
WHERE e.redes_sociais->'instagram'->>'conectado' = 'true'
  AND e.redes_sociais->'instagram'->>'access_token' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM social_connections sc
    WHERE sc.empresa_id = e.id AND sc.provider = 'instagram'
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Migrar perfis de instagram_profile_cache → provider_snapshots
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO provider_snapshots (
  id, empresa_id, connection_id, provider, snapshot_date, metrics, created_at
)
SELECT
  gen_random_uuid(),
  ipc.empresa_id,
  sc.id,
  'instagram',
  ipc.snapshot_date,
  jsonb_build_object(
    'followers_count', ipc.followers_count,
    'follows_count', ipc.follows_count,
    'media_count', ipc.media_count,
    'username', ipc.username,
    'biography', ipc.biography,
    'profile_picture_url', ipc.profile_picture_url
  ),
  COALESCE(ipc.created_at, now())
FROM instagram_profile_cache ipc
JOIN social_connections sc ON sc.empresa_id = ipc.empresa_id AND sc.provider = 'instagram'
WHERE NOT EXISTS (
  SELECT 1 FROM provider_snapshots ps
  WHERE ps.connection_id = sc.id AND ps.snapshot_date = ipc.snapshot_date
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Migrar posts de instagram_media_cache → content_items
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO content_items (
  id, empresa_id, connection_id, provider, provider_content_id,
  content_type, title, caption, url, thumbnail_url,
  published_at, metrics, raw, synced_at
)
SELECT
  gen_random_uuid(),
  imc.empresa_id,
  sc.id,
  'instagram',
  imc.ig_media_id,
  CASE
    WHEN imc.media_type = 'VIDEO' THEN 'reel'
    WHEN imc.media_type = 'CAROUSEL_ALBUM' THEN 'post'
    ELSE 'post'
  END,
  NULL,
  imc.caption,
  imc.permalink,
  COALESCE(imc.thumbnail_url, imc.media_url),
  imc.timestamp,
  COALESCE(imc.insights, '{}'::jsonb) || jsonb_build_object(
    'likes', imc.like_count,
    'comments', imc.comments_count
  ),
  jsonb_build_object('media_type', imc.media_type, 'media_url', imc.media_url),
  COALESCE(imc.synced_at, now())
FROM instagram_media_cache imc
JOIN social_connections sc ON sc.empresa_id = imc.empresa_id AND sc.provider = 'instagram'
WHERE NOT EXISTS (
  SELECT 1 FROM content_items ci
  WHERE ci.connection_id = sc.id AND ci.provider_content_id = imc.ig_media_id
);
