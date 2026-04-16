/**
 * GET /api/reports/list
 * Lista relatórios com filtros opcionais.
 * Query params: empresa_id, month, year, status, type
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const empresaId = searchParams.get("empresa_id");
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  // Verify empresa belongs to user
  if (empresaId) {
    const { data: empresa } = await supabase
      .from("empresas")
      .select("id")
      .eq("id", empresaId)
      .eq("user_id", user.id)
      .single();

    if (!empresa) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    }
  }

  let query = supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (empresaId) {
    query = query.eq("empresa_id", empresaId);
  } else {
    // Fallback: get all reports for user's empresas
    const { data: empresas } = await supabase
      .from("empresas")
      .select("id")
      .eq("user_id", user.id);
    const ids = (empresas ?? []).map((e: { id: string }) => e.id);
    if (ids.length === 0) return NextResponse.json({ reports: [], total: 0 });
    query = query.in("empresa_id", ids);
  }

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (type && type !== "all") {
    query = query.eq("type", type);
  }

  if (year) {
    const y = parseInt(year, 10);
    if (month) {
      const m = parseInt(month, 10);
      const start = new Date(y, m - 1, 1).toISOString();
      const end = new Date(y, m, 0, 23, 59, 59).toISOString();
      query = query.gte("created_at", start).lte("created_at", end);
    } else {
      const start = new Date(y, 0, 1).toISOString();
      const end = new Date(y, 11, 31, 23, 59, 59).toISOString();
      query = query.gte("created_at", start).lte("created_at", end);
    }
  }

  const { data: reports, error, count } = await query;

  if (error) {
    console.error("[reports/list]", error);
    return NextResponse.json({ error: "Erro ao buscar relatórios" }, { status: 500 });
  }

  return NextResponse.json({
    reports: reports ?? [],
    total: count ?? (reports ?? []).length,
  });
}
