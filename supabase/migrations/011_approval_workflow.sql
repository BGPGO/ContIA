-- ============================================================
-- Migration 011: Fluxo de aprovação de posts
-- ============================================================
-- Adiciona estados 'pendente_aprovacao' e 'rejeitado' ao status do post,
-- campos auxiliares (approval_required, rejection_reason) e tabela
-- post_approvals para rastreio do ciclo de aprovação.
-- IDEMPOTENTE — pode ser executada múltiplas vezes com segurança.
-- ============================================================


-- ── 1. Atualizar CHECK constraint de posts.status ──
-- Inclui 'pendente_aprovacao' e 'rejeitado' como valores válidos.

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_status_check;

ALTER TABLE public.posts ADD CONSTRAINT posts_status_check
  CHECK (status IN (
    'rascunho',
    'pendente_aprovacao',
    'agendado',
    'publicado',
    'erro',
    'rejeitado'
  ));


-- ── 2. Campos auxiliares em posts ──

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS approval_required BOOLEAN DEFAULT FALSE;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;


-- ── 3. Tabela post_approvals ──
-- Histórico do ciclo de aprovação. Cada solicitação gera um registro;
-- o status final ('approved' | 'rejected') registra a decisão.

CREATE TABLE IF NOT EXISTS public.post_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ── 4. Trigger updated_at ──
-- Reaproveita a função pública handle_updated_at() criada na migration 001.
-- DROP TRIGGER IF EXISTS para garantir idempotência (CREATE TRIGGER não tem IF NOT EXISTS).

DROP TRIGGER IF EXISTS post_approvals_updated_at ON public.post_approvals;

CREATE TRIGGER post_approvals_updated_at
  BEFORE UPDATE ON public.post_approvals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ── 5. Índices ──

CREATE INDEX IF NOT EXISTS idx_post_approvals_post
  ON public.post_approvals(post_id);

CREATE INDEX IF NOT EXISTS idx_post_approvals_empresa_status
  ON public.post_approvals(empresa_id, status);

-- Recriado mesmo já existindo na migration 003 (lá é (status, empresa_id)).
-- Esta versão (empresa_id, status) é mais útil para o filtro "posts pendentes da empresa".
CREATE INDEX IF NOT EXISTS idx_posts_status_empresa
  ON public.posts(empresa_id, status);


-- ── 6. RLS ──
-- Mesmo padrão das migrations 001/003/007: acesso via empresa_id → user_id.

ALTER TABLE public.post_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own post_approvals" ON public.post_approvals;
CREATE POLICY "Users can view own post_approvals" ON public.post_approvals
  FOR SELECT USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert own post_approvals" ON public.post_approvals;
CREATE POLICY "Users can insert own post_approvals" ON public.post_approvals
  FOR INSERT WITH CHECK (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own post_approvals" ON public.post_approvals;
CREATE POLICY "Users can update own post_approvals" ON public.post_approvals
  FOR UPDATE USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete own post_approvals" ON public.post_approvals;
CREATE POLICY "Users can delete own post_approvals" ON public.post_approvals
  FOR DELETE USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );
