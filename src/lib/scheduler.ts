import { SupabaseClient } from "@supabase/supabase-js";
import { createInstagramPublisherWithEmpresa } from "@/lib/publishers/instagram-publisher";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScheduledJob {
  id: string;
  post_id: string;
  empresa_id: string;
  scheduled_for: string;
  platforms: string[];
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  last_error: string | null;
  published_at: string | null;
  created_at: string;
}

export interface PostPublish {
  id: string;
  post_id: string;
  plataforma: string;
  status: "pendente" | "simulado" | "publicado" | "erro";
  plataforma_post_id: string | null;
  error_message: string | null;
  published_at: string | null;
  created_at: string;
}

export interface ScheduleResult {
  jobId: string;
}

export interface PublishResult {
  platform: string;
  success: boolean;
  error?: string;
}

// ── Interface para publishers futuros ────────────────────────────────────────
// Quando as APIs de redes sociais forem integradas, implemente esta interface
// para cada plataforma (Instagram, Facebook, LinkedIn, etc.)

export interface PlatformPublisher {
  platform: string;
  publish(post: {
    id: string;
    titulo: string;
    conteudo: string;
    midia_url: string | null;
  }): Promise<{ success: boolean; platformPostId?: string; error?: string }>;
}

// Publisher simulado (usado enquanto APIs reais nao estao integradas)
const simulatedPublisher: PlatformPublisher = {
  platform: "simulated",
  async publish() {
    return { success: true, platformPostId: `sim_${Date.now()}` };
  },
};

// Registry de publishers por plataforma
// Quando integrar uma API real, registre aqui:
//   platformPublishers.set("instagram", new InstagramPublisher());
const platformPublishers = new Map<string, PlatformPublisher>();

function getPublisher(
  platform: string,
  supabase?: SupabaseClient,
  empresaId?: string
): PlatformPublisher {
  // Publisher real para Instagram — criado on-the-fly com contexto da empresa
  if (platform === "instagram" && supabase && empresaId) {
    return createInstagramPublisherWithEmpresa(supabase, empresaId);
  }
  // Retorna publisher registrado estaticamente, ou simulado como fallback
  return platformPublishers.get(platform) || simulatedPublisher;
}

// ── Agendar post ─────────────────────────────────────────────────────────────

export async function schedulePost(
  supabase: SupabaseClient,
  postId: string,
  empresaId: string,
  scheduledFor: string,
  platforms: string[]
): Promise<ScheduleResult> {
  // Validar que a data e futura
  const scheduleDate = new Date(scheduledFor);
  if (scheduleDate <= new Date()) {
    throw new Error("A data de agendamento deve ser no futuro.");
  }

  if (!platforms.length) {
    throw new Error("Selecione ao menos uma plataforma.");
  }

  // Verificar se ja existe um job pendente para este post
  const { data: existingJob } = await supabase
    .from("scheduled_jobs")
    .select("id")
    .eq("post_id", postId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingJob) {
    throw new Error(
      "Este post ja possui um agendamento pendente. Cancele-o antes de criar outro."
    );
  }

  // Atualizar post para status 'agendado'
  const { error: postError } = await supabase
    .from("posts")
    .update({
      status: "agendado",
      agendado_para: scheduledFor,
      plataformas: platforms,
    })
    .eq("id", postId);

  if (postError) {
    throw new Error(`Erro ao atualizar post: ${postError.message}`);
  }

  // Criar job em scheduled_jobs
  const { data: job, error: jobError } = await supabase
    .from("scheduled_jobs")
    .insert({
      post_id: postId,
      empresa_id: empresaId,
      scheduled_for: scheduledFor,
      platforms,
      status: "pending",
      attempts: 0,
    })
    .select("id")
    .single();

  if (jobError) {
    // Rollback: voltar post para rascunho
    await supabase
      .from("posts")
      .update({ status: "rascunho", agendado_para: null })
      .eq("id", postId);
    throw new Error(`Erro ao criar agendamento: ${jobError.message}`);
  }

  return { jobId: job.id };
}

// ── Cancelar agendamento ─────────────────────────────────────────────────────

export async function cancelSchedule(
  supabase: SupabaseClient,
  jobId: string
): Promise<void> {
  // Buscar o job para saber o post_id
  const { data: job, error: fetchError } = await supabase
    .from("scheduled_jobs")
    .select("id, post_id, status")
    .eq("id", jobId)
    .single();

  if (fetchError || !job) {
    throw new Error("Agendamento nao encontrado.");
  }

  if (job.status !== "pending") {
    throw new Error(
      `Nao e possivel cancelar um agendamento com status '${job.status}'.`
    );
  }

  // Deletar o job
  const { error: deleteError } = await supabase
    .from("scheduled_jobs")
    .delete()
    .eq("id", jobId);

  if (deleteError) {
    throw new Error(`Erro ao deletar agendamento: ${deleteError.message}`);
  }

  // Voltar post para rascunho
  const { error: postError } = await supabase
    .from("posts")
    .update({ status: "rascunho", agendado_para: null })
    .eq("id", job.post_id);

  if (postError) {
    console.error("Erro ao reverter status do post:", postError.message);
  }
}

// ── Buscar jobs prontos para publicacao ──────────────────────────────────────

export async function getReadyJobs(
  supabase: SupabaseClient
): Promise<ScheduledJob[]> {
  const { data, error } = await supabase
    .from("scheduled_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(10);

  if (error) {
    throw new Error(`Erro ao buscar jobs: ${error.message}`);
  }

  return (data ?? []) as ScheduledJob[];
}

// ── Atualizar status do job ──────────────────────────────────────────────────

export async function updateJobStatus(
  supabase: SupabaseClient,
  jobId: string,
  status: ScheduledJob["status"],
  extra?: { lastError?: string; publishedAt?: string }
): Promise<void> {
  const update: Record<string, unknown> = { status };

  if (extra?.lastError !== undefined) {
    update.last_error = extra.lastError;
  }
  if (extra?.publishedAt) {
    update.published_at = extra.publishedAt;
  }
  if (status === "processing" || status === "failed") {
    // Incrementar attempts via raw update
    const { data: current } = await supabase
      .from("scheduled_jobs")
      .select("attempts")
      .eq("id", jobId)
      .single();

    update.attempts = (current?.attempts ?? 0) + 1;
  }

  const { error } = await supabase
    .from("scheduled_jobs")
    .update(update)
    .eq("id", jobId);

  if (error) {
    throw new Error(`Erro ao atualizar job: ${error.message}`);
  }
}

// ── Registrar publicacao em post_publishes ───────────────────────────────────

export async function recordPublish(
  supabase: SupabaseClient,
  postId: string,
  platform: string,
  status: PostPublish["status"],
  extra?: { platformPostId?: string; errorMessage?: string }
): Promise<void> {
  const insert: Record<string, unknown> = {
    post_id: postId,
    plataforma: platform,
    status,
  };

  if (extra?.platformPostId) {
    insert.plataforma_post_id = extra.platformPostId;
  }
  if (extra?.errorMessage) {
    insert.error_message = extra.errorMessage;
  }
  if (status === "simulado" || status === "publicado") {
    insert.published_at = new Date().toISOString();
  }

  const { error } = await supabase.from("post_publishes").insert(insert);

  if (error) {
    console.error(`Erro ao registrar publish (${platform}):`, error.message);
  }
}

// ── Processar um job completo ────────────────────────────────────────────────
// Orquestra a publicacao em todas as plataformas de um job

export async function processJob(
  supabase: SupabaseClient,
  job: ScheduledJob
): Promise<{ success: boolean; results: PublishResult[] }> {
  const results: PublishResult[] = [];
  let allSuccess = true;

  // Buscar dados do post
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id, titulo, conteudo, midia_url")
    .eq("id", job.post_id)
    .single();

  if (postError || !post) {
    const errorMsg = postError?.message || "Post nao encontrado";
    await updateJobStatus(supabase, job.id, "failed", { lastError: errorMsg });
    return { success: false, results: [{ platform: "*", success: false, error: errorMsg }] };
  }

  // Marcar como processing
  await updateJobStatus(supabase, job.id, "processing");

  // Publicar em cada plataforma
  for (const platform of job.platforms) {
    try {
      // Registrar como pendente
      await recordPublish(supabase, job.post_id, platform, "pendente");

      // Tentar publicar via publisher da plataforma
      const publisher = getPublisher(platform, supabase, job.empresa_id);
      const result = await publisher.publish(post);

      if (result.success) {
        // Publisher real (ex: Instagram) retorna sucesso real → status 'publicado'
        // Publisher simulado (fallback) → status 'simulado'
        const isRealPublisher =
          platform === "instagram" ||
          platformPublishers.has(platform);
        const publishStatus = isRealPublisher
          ? "publicado" as const
          : "simulado" as const;

        await recordPublish(supabase, job.post_id, platform, publishStatus, {
          platformPostId: result.platformPostId,
        });
        results.push({ platform, success: true });
      } else {
        await recordPublish(supabase, job.post_id, platform, "erro", {
          errorMessage: result.error,
        });
        results.push({ platform, success: false, error: result.error });
        allSuccess = false;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      await recordPublish(supabase, job.post_id, platform, "erro", {
        errorMessage: errorMsg,
      });
      results.push({ platform, success: false, error: errorMsg });
      allSuccess = false;
    }
  }

  const now = new Date().toISOString();

  if (allSuccess) {
    // Marcar job como completed
    await updateJobStatus(supabase, job.id, "completed", { publishedAt: now });

    // Atualizar post para publicado
    await supabase
      .from("posts")
      .update({ status: "publicado", publicado_em: now })
      .eq("id", job.post_id);
  } else {
    // Verificar attempts
    const { data: currentJob } = await supabase
      .from("scheduled_jobs")
      .select("attempts")
      .eq("id", job.id)
      .single();

    const attempts = currentJob?.attempts ?? 0;
    const errorSummary = results
      .filter((r) => !r.success)
      .map((r) => `${r.platform}: ${r.error}`)
      .join("; ");

    if (attempts >= 3) {
      await updateJobStatus(supabase, job.id, "failed", { lastError: errorSummary });

      // Marcar post como erro
      await supabase
        .from("posts")
        .update({ status: "erro" })
        .eq("id", job.post_id);
    } else {
      // Voltar para pending para retry
      await supabase
        .from("scheduled_jobs")
        .update({ status: "pending", last_error: errorSummary })
        .eq("id", job.id);
    }
  }

  return { success: allSuccess, results };
}

// ── Buscar status de agendamento de um post ──────────────────────────────────

export async function getScheduleStatus(
  supabase: SupabaseClient,
  postId: string
): Promise<{
  job: ScheduledJob | null;
  publishes: PostPublish[];
}> {
  const { data: job } = await supabase
    .from("scheduled_jobs")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: publishes } = await supabase
    .from("post_publishes")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: false });

  return {
    job: (job as ScheduledJob) ?? null,
    publishes: (publishes ?? []) as PostPublish[],
  };
}
