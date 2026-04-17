-- ============================================================
-- Migration 014: RBAC Empresas (membros, convites, soft delete)
-- ADITIVA — NÃO remove nenhuma policy/coluna existente.
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 0. Helper genérico handle_updated_at (se ainda não existir)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 1. ENUM empresa_role
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'empresa_role') THEN
    CREATE TYPE public.empresa_role AS ENUM ('creator','approver','editor','owner');
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────
-- 2. profiles — espelho mínimo de auth.users
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(lower(email));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Seed profiles
INSERT INTO public.profiles (id, email, display_name, avatar_url)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
WHERE u.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Trigger: auto-cria profile
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, display_name, avatar_url)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
      NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 3. empresa_members
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.empresa_members (
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.empresa_role NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_empresa_members_user ON public.empresa_members(user_id);
CREATE INDEX IF NOT EXISTS idx_empresa_members_empresa_role ON public.empresa_members(empresa_id, role);

DROP TRIGGER IF EXISTS empresa_members_updated_at ON public.empresa_members;
CREATE TRIGGER empresa_members_updated_at
  BEFORE UPDATE ON public.empresa_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 4. empresa_invites
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.empresa_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        public.empresa_role NOT NULL,
  token       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_empresa_invites_email ON public.empresa_invites(lower(email));
CREATE INDEX IF NOT EXISTS idx_empresa_invites_token ON public.empresa_invites(token);
CREATE INDEX IF NOT EXISTS idx_empresa_invites_pending
  ON public.empresa_invites(empresa_id)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 5. empresas.deleted_at (soft delete)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_empresas_active ON public.empresas(id) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 6. Helpers SECURITY DEFINER
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_empresa_member(
  p_empresa_id UUID,
  p_min_role TEXT DEFAULT 'creator'
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH hierarchy(role, rank) AS (
    VALUES ('creator',1), ('approver',2), ('editor',3), ('owner',4)
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.empresa_members m
    JOIN hierarchy h_user ON h_user.role = m.role::text
    JOIN hierarchy h_min  ON h_min.role  = p_min_role
    WHERE m.empresa_id = p_empresa_id
      AND m.user_id = auth.uid()
      AND h_user.rank >= h_min.rank
  );
$$;

REVOKE ALL ON FUNCTION public.is_empresa_member(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_empresa_member(UUID, TEXT) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.user_empresa_role(p_empresa_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.empresa_members
  WHERE empresa_id = p_empresa_id
    AND user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.user_empresa_role(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_empresa_role(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 7. Seed retroativo — toda empresa existente ganha owner
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.empresa_members (empresa_id, user_id, role, invited_by, joined_at)
SELECT e.id, e.user_id, 'owner'::public.empresa_role, e.user_id, e.created_at
FROM public.empresas e
WHERE e.user_id IS NOT NULL
ON CONFLICT (empresa_id, user_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 8. Trigger: nova empresa → owner em empresa_members
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_empresa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.empresa_members (empresa_id, user_id, role, invited_by, joined_at)
    VALUES (NEW.id, NEW.user_id, 'owner'::public.empresa_role, NEW.user_id, now())
    ON CONFLICT (empresa_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_empresa_created ON public.empresas;
CREATE TRIGGER on_empresa_created
  AFTER INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_empresa();

-- ─────────────────────────────────────────────────────────────
-- 9. RLS — empresa_members
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.empresa_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members view own memberships" ON public.empresa_members;
CREATE POLICY "members view own memberships"
  ON public.empresa_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_empresa_member(empresa_id, 'creator'));

DROP POLICY IF EXISTS "owners manage members" ON public.empresa_members;
CREATE POLICY "owners manage members"
  ON public.empresa_members FOR ALL
  USING (public.is_empresa_member(empresa_id, 'owner'))
  WITH CHECK (public.is_empresa_member(empresa_id, 'owner'));

-- ─────────────────────────────────────────────────────────────
-- 10. RLS — empresa_invites
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.empresa_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners read invites" ON public.empresa_invites;
CREATE POLICY "owners read invites"
  ON public.empresa_invites FOR SELECT
  USING (public.is_empresa_member(empresa_id, 'owner'));

DROP POLICY IF EXISTS "owners write invites" ON public.empresa_invites;
CREATE POLICY "owners write invites"
  ON public.empresa_invites FOR ALL
  USING (public.is_empresa_member(empresa_id, 'owner'))
  WITH CHECK (public.is_empresa_member(empresa_id, 'owner'));

-- ─────────────────────────────────────────────────────────────
-- 11. RLS — empresas (aditivas)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "members view empresas" ON public.empresas;
CREATE POLICY "members view empresas"
  ON public.empresas FOR SELECT
  USING (deleted_at IS NULL AND public.is_empresa_member(id, 'creator'));

DROP POLICY IF EXISTS "editors update empresas" ON public.empresas;
CREATE POLICY "editors update empresas"
  ON public.empresas FOR UPDATE
  USING (public.is_empresa_member(id, 'editor'))
  WITH CHECK (public.is_empresa_member(id, 'editor'));

-- ─────────────────────────────────────────────────────────────
-- 12. RLS — posts
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "members view posts" ON public.posts;
CREATE POLICY "members view posts"
  ON public.posts FOR SELECT
  USING (public.is_empresa_member(empresa_id, 'creator'));

DROP POLICY IF EXISTS "creators insert posts" ON public.posts;
CREATE POLICY "creators insert posts"
  ON public.posts FOR INSERT
  WITH CHECK (public.is_empresa_member(empresa_id, 'creator'));

DROP POLICY IF EXISTS "editors update any post" ON public.posts;
CREATE POLICY "editors update any post"
  ON public.posts FOR UPDATE
  USING (public.is_empresa_member(empresa_id, 'editor'))
  WITH CHECK (public.is_empresa_member(empresa_id, 'editor'));

DROP POLICY IF EXISTS "editors delete posts" ON public.posts;
CREATE POLICY "editors delete posts"
  ON public.posts FOR DELETE
  USING (public.is_empresa_member(empresa_id, 'editor'));

-- ─────────────────────────────────────────────────────────────
-- 13. RLS — post_approvals
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "members view approvals" ON public.post_approvals;
CREATE POLICY "members view approvals"
  ON public.post_approvals FOR SELECT
  USING (public.is_empresa_member(empresa_id, 'creator'));

DROP POLICY IF EXISTS "creators request approvals" ON public.post_approvals;
CREATE POLICY "creators request approvals"
  ON public.post_approvals FOR INSERT
  WITH CHECK (public.is_empresa_member(empresa_id, 'creator'));

DROP POLICY IF EXISTS "approvers review approvals" ON public.post_approvals;
CREATE POLICY "approvers review approvals"
  ON public.post_approvals FOR UPDATE
  USING (public.is_empresa_member(empresa_id, 'approver'))
  WITH CHECK (public.is_empresa_member(empresa_id, 'approver'));

-- ─────────────────────────────────────────────────────────────
-- 14. RLS — social_connections
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "members view connections" ON public.social_connections;
CREATE POLICY "members view connections"
  ON public.social_connections FOR SELECT
  USING (public.is_empresa_member(empresa_id, 'creator'));

DROP POLICY IF EXISTS "editors manage connections" ON public.social_connections;
CREATE POLICY "editors manage connections"
  ON public.social_connections FOR ALL
  USING (public.is_empresa_member(empresa_id, 'editor'))
  WITH CHECK (public.is_empresa_member(empresa_id, 'editor'));

-- ─────────────────────────────────────────────────────────────
-- 15. RLS — video_projects
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "members manage videos" ON public.video_projects;
CREATE POLICY "members manage videos"
  ON public.video_projects FOR ALL
  USING (public.is_empresa_member(empresa_id, 'creator'))
  WITH CHECK (public.is_empresa_member(empresa_id, 'creator'));

-- ─────────────────────────────────────────────────────────────
-- 16. RLS — catch-all demais tabelas com empresa_id
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'marca_dna','brand_assets','templates','copy_sessions','visual_templates',
    'content_items','provider_snapshots','metric_events','reports','scheduled_reports',
    'ai_analyses','sync_jobs','concorrentes','scheduled_jobs','analytics_daily',
    'instagram_media_cache','instagram_profile_cache',
    'instagram_insights_cache','instagram_sync_log','caption_styles'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=t
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='empresa_id'
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'members rbac ' || t, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL
           USING (public.is_empresa_member(empresa_id, ''creator''))
           WITH CHECK (public.is_empresa_member(empresa_id, ''creator''))',
        'members rbac ' || t, t
      );
    END IF;
  END LOOP;
END$$;

-- concorrente_plataformas (indireta)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='concorrente_plataformas')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='concorrentes') THEN
    EXECUTE 'DROP POLICY IF EXISTS "members rbac concorrente_plataformas" ON public.concorrente_plataformas';
    EXECUTE 'CREATE POLICY "members rbac concorrente_plataformas"
              ON public.concorrente_plataformas FOR ALL
              USING (concorrente_id IN (SELECT id FROM public.concorrentes WHERE public.is_empresa_member(empresa_id, ''creator'')))
              WITH CHECK (concorrente_id IN (SELECT id FROM public.concorrentes WHERE public.is_empresa_member(empresa_id, ''creator'')))';
  END IF;
END$$;

COMMIT;
