import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  fetchActiveStories,
  persistActiveStories,
} from "@/lib/analytics/instagram-fetcher";
import type { Connection } from "@/types/providers";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutos

/**
 * GET /api/cron/sync-stories
 *
 * Sincroniza stories ativos de todas as conexões Instagram ativas.
 * Stories expiram em 24h — deve rodar diariamente (sugestão: 6h e 18h BRT).
 *
 * Autenticado via header: Authorization: Bearer <CRON_SECRET>
 * Idempotente: upsert por (connection_id, provider_content_id).
 *
 * Configuração sugerida no Coolify (2x por dia para capturar stories antes de expirar):
 *   0 6,18 * * *
 */
export async function GET(req: NextRequest) {
  // Validar CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const admin = getAdminSupabase();

  // Buscar conexões Instagram ativas
  const { data: connections, error: connErr } = await admin
    .from("social_connections")
    .select("*")
    .eq("is_active", true)
    .eq("provider", "instagram")
    .order("empresa_id", { ascending: true });

  if (connErr) {
    console.error("[sync-stories] Erro ao buscar conexoes:", connErr);
    return NextResponse.json(
      { error: "Erro ao buscar conexoes", details: connErr.message },
      { status: 500 }
    );
  }

  if (!connections || connections.length === 0) {
    return NextResponse.json({
      message: "Nenhuma conexao Instagram ativa",
      synced: 0,
      failed: 0,
      details: [],
    });
  }

  type StoryResult = {
    connection_id: string;
    empresa_id: string;
    username: string | null;
    status: "ok" | "error" | "empty";
    stories_count?: number;
    error?: string;
  };

  const results: StoryResult[] = [];

  for (const conn of connections as Connection[]) {
    if (!conn.provider_user_id || !conn.access_token) {
      results.push({
        connection_id: conn.id,
        empresa_id: conn.empresa_id,
        username: conn.username,
        status: "error",
        error: "provider_user_id ou access_token ausente",
      });
      continue;
    }

    try {
      const stories = await fetchActiveStories(
        conn.provider_user_id,
        conn.access_token
      );

      if (stories.length === 0) {
        results.push({
          connection_id: conn.id,
          empresa_id: conn.empresa_id,
          username: conn.username,
          status: "empty",
          stories_count: 0,
        });
        continue;
      }

      await persistActiveStories(conn.empresa_id, conn.id, stories);

      results.push({
        connection_id: conn.id,
        empresa_id: conn.empresa_id,
        username: conn.username,
        status: "ok",
        stories_count: stories.length,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error(
        `[sync-stories] Falha em instagram/${conn.username ?? conn.id}: ${errorMsg}`
      );
      results.push({
        connection_id: conn.id,
        empresa_id: conn.empresa_id,
        username: conn.username,
        status: "error",
        error: errorMsg,
      });
    }
  }

  const synced = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status === "error").length;
  const empty = results.filter((r) => r.status === "empty").length;

  console.log(
    `[sync-stories] Concluido: ${synced} ok, ${failed} erros, ${empty} sem stories`
  );

  return NextResponse.json({
    message: "Sync de stories concluido",
    synced,
    failed,
    empty,
    details: results,
  });
}
