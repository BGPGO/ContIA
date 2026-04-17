export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/rbac';

/** DELETE /api/empresas/[id] — soft delete com confirmação por nome */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: empresaId } = await params;
  const supabase = await createClient();

  const auth = await requireRole(supabase, empresaId, 'empresa.delete');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const { confirm_name } = body as { confirm_name?: unknown };

  if (typeof confirm_name !== 'string' || !confirm_name.trim()) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'confirm_name é obrigatório' },
      { status: 400 }
    );
  }

  // Busca nome atual da empresa
  const { data: empresa, error: fetchError } = await supabase
    .from('empresas')
    .select('nome')
    .eq('id', empresaId)
    .single();

  if (fetchError || !empresa) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  if (empresa.nome !== confirm_name.trim()) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'confirm_name não corresponde ao nome da empresa' },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabase
    .from('empresas')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', empresaId);

  if (deleteError) {
    console.error('[empresa DELETE] Update error:', deleteError);
    return NextResponse.json({ error: 'DB_ERROR', message: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, restore_deadline_days: 30 });
}
