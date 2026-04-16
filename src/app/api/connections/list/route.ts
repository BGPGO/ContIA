import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * GET /api/connections/list?empresa_id=xxx
 *
 * Returns all active social_connections for the given empresa.
 * Auth required — user must own or have access to the empresa.
 */
export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) {
    return NextResponse.json(
      { error: "empresa_id obrigatório" },
      { status: 400 }
    );
  }

  // Auth check com session client
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Verificar que empresa pertence ao user
  const { data: empresaCheck } = await supabase
    .from("empresas")
    .select("id")
    .eq("id", empresaId)
    .single();
  if (!empresaCheck) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 403 });
  }

  // QUERIES DE DADOS usam admin client (bypass RLS)
  const admin = getAdminSupabase();

  // Fetch active connections for this empresa
  const { data, error } = await admin
    .from("social_connections")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[connections/list] DB error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar conexões" },
      { status: 500 }
    );
  }

  const connections = data ?? [];

  // ── FALLBACK: check empresa.redes_sociais for legacy connections ──
  const hasIg = connections.some((c) => c.provider === "instagram");
  if (!hasIg) {
    const { data: empresa } = await admin
      .from("empresas")
      .select("id, user_id, redes_sociais, updated_at")
      .eq("id", empresaId)
      .single();

    const legacyIg = (empresa?.redes_sociais as Record<string, unknown> | null)?.instagram as
      | { conectado?: boolean; username?: string; access_token?: string; provider_user_id?: string; profile_picture_url?: string }
      | undefined;

    if (legacyIg?.conectado && legacyIg.access_token && empresa) {
      connections.push({
        id: `legacy-ig-${empresaId}`,
        empresa_id: empresaId,
        user_id: empresa.user_id,
        provider: "instagram",
        provider_user_id: legacyIg.provider_user_id ?? `legacy_${empresaId}`,
        username: legacyIg.username ?? null,
        display_name: legacyIg.username ?? null,
        display_label: legacyIg.username ?? null,
        profile_picture_url: legacyIg.profile_picture_url ?? null,
        access_token: legacyIg.access_token,
        refresh_token: null,
        token_expires_at: null,
        page_id: null,
        page_access_token: null,
        app_id: null,
        scopes: ["instagram_business_basic"],
        is_active: true,
        last_verified_at: null,
        last_error: null,
        metadata: { migrated_from: "empresa.redes_sociais", fallback: true },
        created_at: empresa.updated_at ?? new Date().toISOString(),
        updated_at: empresa.updated_at ?? new Date().toISOString(),
      } as typeof connections[number]);
    }
  }

  return NextResponse.json({ connections });
}
