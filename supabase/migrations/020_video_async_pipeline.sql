-- ============================================================
-- 020_video_async_pipeline.sql
-- Refatoração de /cortes para suportar podcasts 2h+
-- Pipeline assíncrono in-process: extract → chunk → transcribe paralelo
-- → detect cuts (Gemini Flash + Sonnet) → render FFmpeg+ASS → delivery
--
-- IMPORTANTE: NÃO migra dados antigos. Mantém colunas/status legacy
-- intactos (uploading/processing/analyzed/editing/exporting/done/error
-- + cut_suggestions jsonb) para backward-compat. Fluxo novo escreve
-- nas colunas e status novos. Idempotente — pode rodar múltiplas vezes.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. EXTENSÃO video_projects: status granular + telemetria
-- ============================================================

ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS processing_step TEXT;

COMMENT ON COLUMN public.video_projects.processing_step IS
  'Etapa atual do pipeline assíncrono (ex: extract_audio, transcribe, detect_cuts, rendering). NULL quando não está processando.';

ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS processing_progress INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.video_projects.processing_progress IS
  'Progresso 0-100 da etapa atual (processing_step). Atualizado em tempo real pelo runner.';

ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

COMMENT ON COLUMN public.video_projects.processing_started_at IS
  'Timestamp UTC quando o job assíncrono iniciou (status=queued -> running). Usado para timeout e métricas.';

ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.video_projects.processing_completed_at IS
  'Timestamp UTC quando o job terminou (sucesso ou falha). Diferença com processing_started_at = duração total.';

ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS error_step TEXT;

COMMENT ON COLUMN public.video_projects.error_step IS
  'Etapa onde a falha ocorreu (mesmo set de valores que processing_step). Permite retry seletivo.';

ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS error_message TEXT;

COMMENT ON COLUMN public.video_projects.error_message IS
  'Mensagem de erro humano-legível quando status=failed. Substitui semanticamente a coluna legacy `error`.';

ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS cost_estimate_cents INT;

COMMENT ON COLUMN public.video_projects.cost_estimate_cents IS
  'Custo total do podcast em centavos USD (Whisper + Gemini Flash + Sonnet + storage). Calculado ao final do job.';

-- ============================================================
-- 2. Coluna nova `cuts` (jsonb) — desacopla de cut_suggestions legacy
-- ============================================================

ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS cuts JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.video_projects.cuts IS
  'Array de cortes do pipeline assíncrono novo. Cada item: {id, title, hook, start_time, end_time, viral_score, category, reason, rendered_url, render_status, render_error, caption_style_id}. NÃO substitui cut_suggestions legacy — fluxo novo escreve aqui, fluxo antigo continua em cut_suggestions.';

-- ============================================================
-- 3. CHECK do status: adiciona novos valores, mantém legacy
-- ============================================================

-- Drop CHECK antigo (nome auto-gerado pelo Postgres). Vamos descobrir
-- o nome real e dropar de forma segura.
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.video_projects'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%IN%uploading%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.video_projects DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

-- CHECK novo: legacy + novos status do pipeline assíncrono
ALTER TABLE public.video_projects
  ADD CONSTRAINT video_projects_status_check
  CHECK (status IN (
    -- Legacy (preservados para backward-compat com fluxo antigo)
    'uploading',
    'processing',
    'analyzed',
    'editing',
    'exporting',
    'done',
    'error',
    -- Novos do pipeline assíncrono
    'queued',
    'extracting_audio',
    'transcribing',
    'detecting_cuts',
    'rendering',
    'ready',
    'failed'
  ));

-- ============================================================
-- 4. Tabela video_jobs — tracking de execução in-process
-- ============================================================

CREATE TABLE IF NOT EXISTS public.video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('process_full', 'rerender_clip')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'cancelled'
  )),
  current_step TEXT,
  progress INT NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 2,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.video_jobs IS
  'Tracking de execução de jobs assíncronos in-process do pipeline de cortes. Mesmo sem fila externa (Redis/BullMQ), mantém histórico para retry, observabilidade e auditoria de custos.';

COMMENT ON COLUMN public.video_jobs.type IS
  'Tipo do job: process_full = pipeline completo (extract→transcribe→detect→render); rerender_clip = re-renderiza apenas um corte específico (ex: troca de caption_style).';

COMMENT ON COLUMN public.video_jobs.current_step IS
  'Mesmo set de valores que video_projects.processing_step. Espelhado para query rápida sem JOIN.';

COMMENT ON COLUMN public.video_jobs.progress IS
  'Progresso 0-100 da etapa atual.';

COMMENT ON COLUMN public.video_jobs.attempts IS
  'Quantas tentativas já foram feitas. Incrementado a cada retry. Job vira failed permanente quando attempts >= max_attempts.';

COMMENT ON COLUMN public.video_jobs.max_attempts IS
  'Máximo de tentativas antes de desistir. Default 2 (1 inicial + 1 retry).';

COMMENT ON COLUMN public.video_jobs.payload IS
  'Input do job (ex: {chunk_strategy, model_overrides, target_cut_id, caption_style_id}). Serve para idempotência e debug.';

COMMENT ON COLUMN public.video_jobs.result IS
  'Output do job (ex: {cuts_count, total_duration_ms, cost_cents}). NULL enquanto não completou.';

CREATE INDEX IF NOT EXISTS video_jobs_project_id_idx
  ON public.video_jobs (project_id);

-- Index parcial: só jobs ativos. Otimiza query "qual job está rodando agora?"
CREATE INDEX IF NOT EXISTS video_jobs_active_idx
  ON public.video_jobs (status)
  WHERE status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS video_jobs_created_at_idx
  ON public.video_jobs (created_at DESC);

-- RLS: usuário só vê jobs de projetos seus (via JOIN em video_projects)
ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS video_jobs_select_own ON public.video_jobs;
CREATE POLICY video_jobs_select_own ON public.video_jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.video_projects vp
      WHERE vp.id = video_jobs.project_id
        AND vp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS video_jobs_insert_own ON public.video_jobs;
CREATE POLICY video_jobs_insert_own ON public.video_jobs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.video_projects vp
      WHERE vp.id = video_jobs.project_id
        AND vp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS video_jobs_update_own ON public.video_jobs;
CREATE POLICY video_jobs_update_own ON public.video_jobs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.video_projects vp
      WHERE vp.id = video_jobs.project_id
        AND vp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.video_projects vp
      WHERE vp.id = video_jobs.project_id
        AND vp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS video_jobs_delete_own ON public.video_jobs;
CREATE POLICY video_jobs_delete_own ON public.video_jobs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.video_projects vp
      WHERE vp.id = video_jobs.project_id
        AND vp.user_id = auth.uid()
    )
  );

-- ============================================================
-- 5. Bucket Supabase Storage `cuts` — MP4 finais dos cortes
-- ============================================================
-- Bucket separado de `videos` (que tem o original). Path:
--   cuts/{user_id}/{project_id}/{cut_id}.mp4
-- Privado por padrão; acesso via signed URL gerada pelo backend.

INSERT INTO storage.buckets (id, name, public)
VALUES ('cuts', 'cuts', false)
ON CONFLICT (id) DO NOTHING;

-- Policies escopadas por bucket_id='cuts' — não conflitam com policies
-- de outros buckets (videos, creatives, etc).

DROP POLICY IF EXISTS cuts_select_own ON storage.objects;
CREATE POLICY cuts_select_own ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'cuts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS cuts_insert_own ON storage.objects;
CREATE POLICY cuts_insert_own ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'cuts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS cuts_update_own ON storage.objects;
CREATE POLICY cuts_update_own ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'cuts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS cuts_delete_own ON storage.objects;
CREATE POLICY cuts_delete_own ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'cuts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

COMMIT;
