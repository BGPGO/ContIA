export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/rbac';

/** PATCH /api/empresas/[id]/transfer-ownership — transferir ownership para outro membro */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: empresaId } = await params;
  const supabase = await createClient();

  const auth = await requireRole(supabase, empresaId, 'empresa.transfer');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const { target_user_id, confirm } = body as { target_user_id?: unknown; confirm?: unknown };

  if (typeof target_user_id !== 'string' || !target_user_id.trim()) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'target_user_id é obrigatório' },
      { status: 400 }
    );
  }

  if (confirm !== true) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'confirm deve ser true' },
      { status: 400 }
    );
  }

  if (target_user_id === auth.user.id) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'target_user_id não pode ser o mesmo que o usuário atual' },
      { status: 400 }
    );
  }

  // Verifica se target é member da empresa
  const { data: targetMember, error: memberError } = await supabase
    .from('empresa_members')
    .select('role')
    .eq('empresa_id', empresaId)
    .eq('user_id', target_user_id)
    .maybeSingle();

  if (memberError) {
    console.error('[transfer-ownership] Member check error:', memberError);
    return NextResponse.json({ error: 'DB_ERROR', message: memberError.message }, { status: 500 });
  }

  if (!targetMember) {
    return NextResponse.json(
      { error: 'TARGET_NOT_MEMBER', message: 'target_user_id não é membro desta empresa' },
      { status: 400 }
    );
  }

  // Executa a transferência em 3 passos sequenciais
  // 1. Promove target para owner
  const { error: promoteError } = await supabase
    .from('empresa_members')
    .update({ role: 'owner' })
    .eq('empresa_id', empresaId)
    .eq('user_id', target_user_id);

  if (promoteError) {
    console.error('[transfer-ownership] Promote error:', promoteError);
    return NextResponse.json({ error: 'DB_ERROR', message: promoteError.message }, { status: 500 });
  }

  // 2. Rebaixa caller para editor
  const { error: demoteError } = await supabase
    .from('empresa_members')
    .update({ role: 'editor' })
    .eq('empresa_id', empresaId)
    .eq('user_id', auth.user.id);

  if (demoteError) {
    console.error('[transfer-ownership] Demote error:', demoteError);
    // Tenta reverter promoção
    await supabase
      .from('empresa_members')
      .update({ role: targetMember.role })
      .eq('empresa_id', empresaId)
      .eq('user_id', target_user_id);
    return NextResponse.json({ error: 'DB_ERROR', message: demoteError.message }, { status: 500 });
  }

  // 3. Atualiza user_id da empresa
  const { error: empresaError } = await supabase
    .from('empresas')
    .update({ user_id: target_user_id })
    .eq('id', empresaId);

  if (empresaError) {
    console.error('[transfer-ownership] Empresa update error:', empresaError);
    // Não reverte — members já foram atualizados corretamente
  }

  return NextResponse.json({ new_owner_id: target_user_id });
}
