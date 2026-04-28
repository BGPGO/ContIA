import { NextRequest, NextResponse } from "next/server";
import {
  createMediaContainer,
  publishMedia,
  checkContainerStatus,
  validateCollabSupport,
  InstagramAPIError,
} from "@/lib/instagram";
import { createClient } from "@/lib/supabase/server";

/** Máximo de colaboradores permitido pela Instagram Graph API */
const MAX_COLLABORATORS = 3;

/**
 * Sanitiza a lista de usernames de colaboradores:
 * - Remove "@" inicial
 * - Lowercase + trim
 * - Descarta strings vazias
 * - Limita a MAX_COLLABORATORS (3)
 */
function sanitizeCollaborators(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((u) => String(u).trim().toLowerCase().replace(/^@/, ""))
    .filter((u) => u.length > 0)
    .slice(0, MAX_COLLABORATORS);
}

/**
 * POST /api/instagram/publish
 * Publica conteúdo no Instagram
 *
 * Body: {
 *   empresa_id: string,
 *   image_url?: string,           // URL pública da imagem
 *   video_url?: string,           // URL pública do vídeo
 *   caption?: string,
 *   media_type?: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REELS",
 *   children_urls?: string[],     // URLs das imagens do carrossel
 *   collaborators?: string[]      // Usernames dos colaboradores (sem "@", máx 3)
 * }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { empresa_id, image_url, video_url, caption, media_type, children_urls, collaborators: rawCollaborators } = body;

  // Sanitize collaborators
  const collaborators = sanitizeCollaborators(rawCollaborators);

  if (!empresa_id) {
    return NextResponse.json({ error: "empresa_id obrigatório" }, { status: 400 });
  }

  if (!image_url && !video_url && !children_urls?.length) {
    return NextResponse.json(
      { error: "Pelo menos uma mídia (image_url, video_url ou children_urls) é obrigatória" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: connection } = await supabase
    .from("social_connections")
    .select("access_token, provider_user_id")
    .eq("empresa_id", empresa_id)
    .eq("provider", "instagram")
    .eq("is_active", true)
    .single();

  if (!connection) {
    return NextResponse.json(
      { error: "Instagram não conectado" },
      { status: 404 }
    );
  }

  const { access_token: token, provider_user_id: igId } = connection;

  // Validar suporte a Collab se foram passados colaboradores
  if (collaborators.length > 0) {
    const collabCheck = await validateCollabSupport(igId, token);
    if (!collabCheck.supported) {
      return NextResponse.json(
        { error: collabCheck.reason ?? "Collab não suportado para este perfil" },
        { status: 400 }
      );
    }
  }

  try {
    let containerId: string;

    if (media_type === "CAROUSEL_ALBUM" && children_urls?.length) {
      // Criar containers individuais para cada imagem do carrossel (SEM collaborators)
      const childIds: string[] = [];
      for (const url of children_urls) {
        const childId = await createMediaContainer(igId, token, {
          image_url: url,
        });
        childIds.push(childId);
      }

      // Criar container do carrossel (COM collaborators se houver)
      containerId = await createMediaContainer(igId, token, {
        media_type: "CAROUSEL_ALBUM",
        caption,
        children: childIds,
        collaborators: collaborators.length > 0 ? collaborators : undefined,
      });
    } else {
      // Post simples (imagem, vídeo ou reels)
      containerId = await createMediaContainer(igId, token, {
        image_url,
        video_url,
        caption,
        media_type: media_type as "IMAGE" | "VIDEO" | "REELS" | undefined,
        collaborators: collaborators.length > 0 ? collaborators : undefined,
      });
    }

    // Para vídeos, aguardar processamento
    if (video_url || media_type === "REELS") {
      let attempts = 0;
      const maxAttempts = 30; // ~60 segundos
      while (attempts < maxAttempts) {
        const status = await checkContainerStatus(containerId, token);
        if (status.status_code === "FINISHED") break;
        if (status.status_code === "ERROR") {
          return NextResponse.json(
            { error: "Erro ao processar vídeo no Instagram" },
            { status: 502 }
          );
        }
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;
      }
    }

    // Publicar
    const result = await publishMedia(igId, token, containerId);

    if (result.status === "error") {
      return NextResponse.json(
        { error: result.error },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      post_id: result.id,
      permalink: result.permalink,
    });
  } catch (err) {
    const message = err instanceof InstagramAPIError
      ? err.message
      : "Erro ao publicar no Instagram";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
