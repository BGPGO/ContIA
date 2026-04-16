/**
 * GET  /api/reports/[id] — detalhes do relatório
 * DELETE /api/reports/[id] — soft delete (marca como deletado via status)
 *   na prática faz hard delete pois não há coluna deleted_at no schema
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: report, error } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !report) {
    return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });
  }

  // Verify ownership via empresa
  const { data: empresa } = await supabase
    .from("empresas")
    .select("id")
    .eq("id", report.empresa_id)
    .eq("user_id", user.id)
    .single();

  if (!empresa) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  return NextResponse.json({ report });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Verify ownership
  const { data: report } = await supabase
    .from("reports")
    .select("empresa_id")
    .eq("id", id)
    .single();

  if (!report) {
    return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });
  }

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id")
    .eq("id", report.empresa_id)
    .eq("user_id", user.id)
    .single();

  if (!empresa) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { error } = await supabase.from("reports").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Erro ao deletar relatório" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
