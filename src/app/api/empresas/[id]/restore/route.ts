export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminSupabase } from '@/lib/supabase/admin';

/** POST /api/empresas/[id]/restore — restaurar soft delete (apenas dentro de 30 dias) */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: empresaId } = await params;
  const supabase = await createClient();

  // Auth obrigatória via client normal
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const admin = getAdminSupabase();

  // Admin client para buscar empresa (RLS esconde deleted_at IS NOT NULL)
  const { data: empresa, error: fetchError } = await admin
    .from('empresas')
    .select('id, deleted_at, nome, logo_url, user_id')
    .eq('id', empresaId)
    .single();

  if (fetchError || !empresa) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  if (!empresa.deleted_at) {
    return NextResponse.json({ error: 'NOT_DELETED' }, { status: 400 });
  }

  // Verificar deadline de 30 dias
  const deletedAt = new Date(empresa.deleted_at as string);
  const deadline = new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (new Date() > deadline) {
    return NextResponse.json({ error: 'RESTORE_DEADLINE_EXCEEDED' }, { status: 410 });
  }

  // Verificar que user é owner via empresa_members (admin para bypassar RLS)
  const { data: membership } = await admin
    .from('empresa_members')
    .select('role')
    .eq('empresa_id', empresaId)
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  // Restaura
  const { data: restored, error: restoreError } = await admin
    .from('empresas')
    .update({ deleted_at: null })
    .eq('id', empresaId)
    .select('*')
    .single();

  if (restoreError) {
    console.error('[empresa restore] Update error:', restoreError);
    return NextResponse.json({ error: 'DB_ERROR', message: restoreError.message }, { status: 500 });
  }

  return NextResponse.json({ empresa: restored });
}
