import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  fetchInstagramLive,
  persistInstagramSnapshot,
} from "@/lib/analytics/instagram-fetcher";
import { facebookDriver } from "@/lib/drivers/facebook";
import { metaAdsDriver } from "@/lib/drivers/meta_ads";
import type { Connection } from "@/types/providers";
import type { OnDemandSyncResponse } from "@/types/sync";

export const runtime = "nodejs";
export const maxDuration = 60; // 1 minuto — endpoint interativo

/**
 * POST /api/connections/sync/[connectionId]
 *
 * Dispara sincronizacao imediata de uma conexao (util para botao "Sincronizar agora").
 * O user precisa ter acesso a empresa da conexao (verificado via RLS do Supabase).
 *
 * Retorna:
 *   { status: "ok", synced_at: ISO, snapshot_count: N }
 *   { status: "error", message: "..." }
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params;

  if (!connectionId) {
    return NextResponse.json(
      { status: "error", message: "connectionId ausente" } satisfies OnDemandSyncResponse,
      { status: 400 }
    );
  }

  // Auth check com session client
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { status: "error", message: "Nao autenticado" } satisfies OnDemandSyncResponse,
      { status: 401 }
    );
  }

  const admin = getAdminSupabase();

  // Buscar conexao — admin bypassa RLS, verificamos empresa_id manualmente
  const { data: conn, error: connErr } = await admin
    .from("social_connections")
    .select("*")
    .eq("id", connectionId)
    .single();

  if (connErr || !conn) {
    return NextResponse.json(
      { status: "error", message: "Conexao nao encontrada" } satisfies OnDemandSyncResponse,
      { status: 404 }
    );
  }

  // Verificar que a empresa pertence ao user autenticado (simula RLS)
  const { data: empresaCheck } = await supabase
    .from("empresas")
    .select("id")
    .eq("id", conn.empresa_id)
    .single();

  if (!empresaCheck) {
    return NextResponse.json(
      { status: "error", message: "Sem permissao para esta conexao" } satisfies OnDemandSyncResponse,
      { status: 403 }
    );
  }

  if (!conn.is_active) {
    return NextResponse.json(
      {
        status: "error",
        message: "Conexao inativa. Reative-a antes de sincronizar.",
      } satisfies OnDemandSyncResponse,
      { status: 422 }
    );
  }

  if (!conn.access_token) {
    return NextResponse.json(
      {
        status: "error",
        message: "Token de acesso ausente. Reconecte a conta.",
      } satisfies OnDemandSyncResponse,
      { status: 422 }
    );
  }

  const connection = conn as Connection;

  // Registrar sync_job
  const started_at = new Date().toISOString();
  let jobId: string | null = null;

  try {
    const { data: jobRow } = await admin
      .from("sync_jobs")
      .insert({
        empresa_id: connection.empresa_id,
        connection_id: connection.id,
        provider: connection.provider,
        job_type: "profile_sync",
        status: "running",
        started_at,
        payload: { triggered_by: "on_demand", user_id: user.id },
      })
      .select("id")
      .single();

    jobId = jobRow?.id ?? null;
  } catch {
    // falha graceful — nao bloqueia o sync
  }

  let snapshotCount = 0;

  try {
    if (connection.provider === "instagram") {
      if (!connection.provider_user_id) {
        throw new Error("provider_user_id ausente para conexao Instagram");
      }
      const liveData = await fetchInstagramLive(
        connection.access_token,
        connection.provider_user_id,
        30
      );
      await persistInstagramSnapshot(connection.empresa_id, connection.id, liveData);
      snapshotCount = 1 + liveData.media.length;
    } else if (connection.provider === "facebook") {
      const [, content] = await Promise.all([
        facebookDriver.syncProfile(connection),
        facebookDriver.syncContent(connection),
        facebookDriver.syncMetrics(connection),
      ]);
      snapshotCount = 1 + content.length;
    } else if (connection.provider === "meta_ads") {
      const [, content] = await Promise.all([
        metaAdsDriver.syncProfile(connection),
        metaAdsDriver.syncContent(connection),
        metaAdsDriver.syncMetrics(connection),
      ]);
      const campaignIds = content.map((c) => c.provider_content_id);
      const insights = campaignIds.length > 0 && metaAdsDriver.syncInsights
        ? await metaAdsDriver.syncInsights(connection, campaignIds)
        : [];
      snapshotCount = 1 + content.length + insights.length;
    } else {
      return NextResponse.json(
        {
          status: "error",
          message: `Provider "${connection.provider}" nao suportado para sincronizacao manual ainda.`,
        } satisfies OnDemandSyncResponse,
        { status: 422 }
      );
    }

    const synced_at = new Date().toISOString();

    // Atualizar sync_job como concluido
    if (jobId) {
      await admin
        .from("sync_jobs")
        .update({
          status: "completed",
          completed_at: synced_at,
          result: { snapshot_count: snapshotCount },
        })
        .eq("id", jobId);
    }

    return NextResponse.json({
      status: "ok",
      synced_at,
      snapshot_count: snapshotCount,
    } satisfies OnDemandSyncResponse);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";

    if (jobId) {
      await admin
        .from("sync_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          last_error: errorMsg,
        })
        .eq("id", jobId);
    }

    console.error(
      `[connections/sync] Falha ao sincronizar ${connection.provider}/${connection.id}: ${errorMsg}`
    );

    return NextResponse.json(
      {
        status: "error",
        message: "Erro ao sincronizar conexao. Tente novamente.",
      } satisfies OnDemandSyncResponse,
      { status: 500 }
    );
  }
}
