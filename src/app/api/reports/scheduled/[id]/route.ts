/**
 * GET   /api/reports/scheduled/[id] — detalhes
 * PATCH /api/reports/scheduled/[id] — atualiza
 * DELETE /api/reports/scheduled/[id] — remove
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { computeNextRunAt } from "@/lib/reports/cron-utils";

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  schedule_cron: z.string().min(1).optional(),
  providers: z.array(z.string()).min(1).optional(),
  template_id: z.string().optional(),
  recipients: z.array(z.string().email()).min(1).optional(),
  active: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getScheduleOwned(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data: schedule } = await supabase
    .from("scheduled_reports")
    .select("*, empresas!inner(user_id)")
    .eq("id", id)
    .single();

  if (!schedule) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((schedule as any).empresas?.user_id !== userId) return null;
  return schedule;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const schedule = await getScheduleOwned(supabase, id, user.id);
  if (!schedule) return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });

  return NextResponse.json({ schedule });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const existing = await getScheduleOwned(supabase, id, user.id);
  if (!existing) return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const validation = UpdateSchema.safeParse(body);
  if (!validation.success) {
    const messages = validation.error.issues.map((i) => i.message).join("; ");
    return NextResponse.json({ error: messages }, { status: 400 });
  }

  const updates: Record<string, unknown> = { ...validation.data };

  // Recalculate next_run_at if cron changed
  if (validation.data.schedule_cron) {
    const next = computeNextRunAt(validation.data.schedule_cron);
    updates.next_run_at = next?.toISOString() ?? null;
  }

  const { data: schedule, error } = await supabase
    .from("scheduled_reports")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !schedule) {
    return NextResponse.json({ error: "Erro ao atualizar agendamento" }, { status: 500 });
  }

  return NextResponse.json({ schedule });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const existing = await getScheduleOwned(supabase, id, user.id);
  if (!existing) return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });

  const { error } = await supabase.from("scheduled_reports").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Erro ao deletar agendamento" }, { status: 500 });

  return NextResponse.json({ success: true });
}
