/**
 * InstagramPublisher — publica posts reais via Instagram Graph API.
 *
 * Implementa a interface PlatformPublisher do scheduler.
 * Busca a conexão ativa da empresa em social_connections e executa
 * o fluxo: criar container → aguardar processamento → publicar.
 *
 * Uso: getPublisher("instagram", supabase, empresaId) em processJob()
 * já instancia este publisher automaticamente via createInstagramPublisherWithEmpresa().
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { PlatformPublisher } from "@/lib/scheduler";
import {
  createMediaContainer,
  checkContainerStatus,
  publishMedia,
} from "@/lib/instagram";
import { decryptToken } from "@/lib/drivers/base";

// Tempo máximo de espera pelo processamento do container: 60s (30 × 2s)
const MAX_STATUS_POLLS = 30;
const POLL_INTERVAL_MS = 2000;

/**
 * Cria um publisher Instagram real para uma empresa específica.
 *
 * O empresaId é necessário para buscar a conexão correta em social_connections.
 * Chamado on-the-fly em getPublisher() dentro de processJob().
 */
export function createInstagramPublisherWithEmpresa(
  supabase: SupabaseClient,
  empresaId: string
): PlatformPublisher {
  return {
    platform: "instagram",

    async publish(post) {
      // 1. Buscar conexão Instagram ativa da empresa
      const { data: conn } = await supabase
        .from("social_connections")
        .select("provider_user_id, access_token, is_active")
        .eq("empresa_id", empresaId)
        .eq("provider", "instagram")
        .eq("is_active", true)
        .maybeSingle();

      if (!conn) {
        return {
          success: false,
          error:
            "Conexão Instagram não encontrada ou inativa para esta empresa.",
        };
      }

      if (!post.midia_url) {
        return {
          success: false,
          error: "Post sem mídia. Instagram requer imagem ou vídeo.",
        };
      }

      // Decriptar token (atualmente passthrough — ver drivers/base.ts)
      const token = decryptToken(conn.access_token);
      const igUserId: string = conn.provider_user_id;

      // 2. Criar container de mídia
      let containerId: string;
      try {
        const collaborators =
          Array.isArray(post.instagram_collaborators) &&
          (post.instagram_collaborators as string[]).length > 0
            ? (post.instagram_collaborators as string[])
            : undefined;

        containerId = await createMediaContainer(igUserId, token, {
          image_url: post.midia_url ?? undefined,
          caption: post.conteudo,
          media_type: "IMAGE",
          collaborators,
        });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Erro ao criar container IG";
        return { success: false, error: `Falha ao criar container: ${msg}` };
      }

      // 3. Aguardar processamento do container (até 60s)
      let ready = false;
      for (let i = 0; i < MAX_STATUS_POLLS; i++) {
        let statusData: { status: string; status_code?: string };
        try {
          statusData = await checkContainerStatus(containerId, token);
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "Erro ao checar status";
          return {
            success: false,
            error: `Falha ao verificar status do container: ${msg}`,
          };
        }

        if (statusData.status_code === "FINISHED") {
          ready = true;
          break;
        }

        if (statusData.status_code === "ERROR") {
          return {
            success: false,
            error: `Container retornou ERROR: ${statusData.status}`,
          };
        }

        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }

      if (!ready) {
        return {
          success: false,
          error: "Timeout aguardando processamento do container Instagram.",
        };
      }

      // 4. Publicar mídia
      let result: Awaited<ReturnType<typeof publishMedia>>;
      try {
        result = await publishMedia(igUserId, token, containerId);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Erro ao publicar no IG";
        return { success: false, error: `Falha ao publicar: ${msg}` };
      }

      if (result.status === "error") {
        return {
          success: false,
          error: `Publicação falhou: ${result.error ?? "Erro desconhecido"}`,
        };
      }

      return { success: true, platformPostId: result.id };
    },
  };
}
