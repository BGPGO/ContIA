import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLastSyncStatus } from "@/lib/instagram-sync";

/**
 * GET /api/instagram/sync/status?empresa_id=xxx
 *
 * Returns the last sync status and cached data counts.
 * Requires authenticated user.
 */
export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get("empresa_id");

  if (!empresaId) {
    return NextResponse.json(
      { error: "empresa_id obrigatório" },
      { status: 400 }
    );
  }

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401 }
    );
  }

  try {
    const status = await getLastSyncStatus(empresaId);

    if (!status) {
      return NextResponse.json({
        lastSync: null,
        counts: { media: 0, profileSnapshots: 0, insights: 0 },
        message: "Nenhuma sincronização realizada ainda",
      });
    }

    return NextResponse.json(status);
  } catch (err) {
    console.error("[api/instagram/sync/status] Error:", err);
    return NextResponse.json(
      { error: "Erro ao buscar status de sincronização" },
      { status: 500 }
    );
  }
}
