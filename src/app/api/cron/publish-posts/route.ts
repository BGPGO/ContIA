import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getReadyJobs, processJob } from "@/lib/scheduler";

// Cron endpoint para processar posts agendados.
// Protegido por CRON_SECRET no header Authorization.
//
// Para configurar:
// 1. Defina CRON_SECRET no .env.local
// 2. Configure um cron externo (Vercel Cron, GitHub Actions, etc.) para
//    chamar GET /api/cron/publish-posts com header:
//    Authorization: Bearer <CRON_SECRET>
//
// Frequencia recomendada: a cada 1-5 minutos.

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase nao configurado para cron.");
  }

  // Usamos service role key para bypass de RLS no cron
  return createServiceClient(url, serviceKey);
}

function validateCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET nao definido nas variaveis de ambiente.");
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const token = authHeader.replace(/^Bearer\s+/i, "");
  return token === cronSecret;
}

export async function GET(request: NextRequest) {
  // Validar autenticacao
  if (!validateCronSecret(request)) {
    return NextResponse.json(
      { error: "Nao autorizado." },
      { status: 401 }
    );
  }

  try {
    const supabase = getServiceSupabase();

    // Buscar jobs prontos
    const jobs = await getReadyJobs(supabase);

    if (jobs.length === 0) {
      return NextResponse.json({
        message: "Nenhum post para publicar.",
        processed: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // Processar cada job
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const job of jobs) {
      try {
        const result = await processJob(supabase, job);
        results.push({
          jobId: job.id,
          postId: job.post_id,
          success: result.success,
          platforms: result.results,
        });

        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Erro desconhecido";
        results.push({
          jobId: job.id,
          postId: job.post_id,
          success: false,
          error: errorMsg,
        });
        failCount++;
      }
    }

    return NextResponse.json({
      message: `Processados ${jobs.length} jobs: ${successCount} sucesso, ${failCount} falha.`,
      processed: jobs.length,
      success: successCount,
      failed: failCount,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro interno";
    console.error("Cron publish-posts error:", errorMsg);

    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
