/**
 * GET  /api/reports/scheduled — lista agendamentos
 * POST /api/reports/scheduled — cria agendamento
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { computeNextRunAt } from "@/lib/reports/cron-utils";

const CreateSchema = z.object({
  empresa_id: z.string().uuid("empresa_id inválido"),
  name: z.string().min(1, "Nome obrigatório").max(200),
  schedule_cron: z.string().min(1, "Cron obrigatório"),
  providers: z.array(z.string()).min(1, "Selecione pelo menos 1 plataforma"),
  template_id: z.string().optional(),
  recipients: z.array(z.string().email()).min(1, "Informe pelo menos 1 destinatário"),
  active: z.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const empresaId = searchParams.get("empresa_id");

  let query = supabase
    .from("scheduled_reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (empresaId) {
    // Verify ownership
    const { data: empresa } = await supabase
      .from("empresas")
      .select("id")
      .eq("id", empresaId)
      .eq("user_id", user.id)
      .single();

    if (!empresa) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    }

    query = query.eq("empresa_id", empresaId);
  } else {
    const { data: empresas } = await supabase
      .from("empresas")
      .select("id")
      .eq("user_id", user.id);
    const ids = (empresas ?? []).map((e: { id: string }) => e.id);
    if (ids.length === 0) return NextResponse.json({ schedules: [] });
    query = query.in("empresa_id", ids);
  }

  const { data: schedules, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar agendamentos" }, { status: 500 });
  }

  return NextResponse.json({ schedules: schedules ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const validation = CreateSchema.safeParse(body);
  if (!validation.success) {
    const messages = validation.error.issues.map((i) => i.message).join("; ");
    return NextResponse.json({ error: messages }, { status: 400 });
  }

  const { empresa_id, name, schedule_cron, providers, template_id, recipients, active } =
    validation.data;

  // Verify ownership
  const { data: empresa } = await supabase
    .from("empresas")
    .select("id")
    .eq("id", empresa_id)
    .eq("user_id", user.id)
    .single();

  if (!empresa) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const next_run_at = computeNextRunAt(schedule_cron);

  const { data: schedule, error } = await supabase
    .from("scheduled_reports")
    .insert({
      empresa_id,
      user_id: user.id,
      name,
      schedule_cron,
      providers,
      template_id: template_id ?? null,
      recipients,
      active,
      next_run_at: next_run_at?.toISOString() ?? null,
    })
    .select("*")
    .single();

  if (error || !schedule) {
    console.error("[scheduled/create]", error);
    return NextResponse.json({ error: "Erro ao criar agendamento" }, { status: 500 });
  }

  return NextResponse.json({ schedule }, { status: 201 });
}
