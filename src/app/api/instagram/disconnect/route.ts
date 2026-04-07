import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/instagram/disconnect
 * Desconecta o Instagram de uma empresa
 * Body: { empresa_id: string }
 */
export async function POST(req: NextRequest) {
  const { empresa_id } = await req.json();

  if (!empresa_id) {
    return NextResponse.json({ error: "empresa_id obrigatório" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Soft delete — marcar como inativo
  await supabase
    .from("social_connections")
    .update({ is_active: false })
    .eq("empresa_id", empresa_id)
    .eq("provider", "instagram");

  // Atualizar empresa
  await supabase
    .from("empresas")
    .update({
      redes_sociais: {
        instagram: { conectado: false, username: "" },
      },
    })
    .eq("id", empresa_id);

  return NextResponse.json({ success: true });
}
