export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/rbac';
import type { EmpresaMember, EmpresaRole } from '@/types/rbac';

const VALID_ROLES: EmpresaRole[] = ['creator', 'approver', 'editor'];

/** PATCH /api/empresas/[id]/members/[userId] — mudar role */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id: empresaId, userId } = await params;
  const supabase = await createClient();

  const auth = await requireRole(supabase, empresaId, 'member.manage');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const { role } = body as { role?: unknown };

  if (typeof role !== 'string' || !VALID_ROLES.includes(role as EmpresaRole)) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: `role deve ser um de: ${VALID_ROLES.join(', ')}` },
      { status: 400 }
    );
  }

  if ((role as EmpresaRole) === 'owner') {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'Use transfer-ownership para mudar owner' },
      { status: 400 }
    );
  }

  if (userId === auth.user.id) {
    return NextResponse.json({ error: 'CANNOT_DEMOTE_SELF' }, { status: 409 });
  }

  const { data: member, error: updateError } = await supabase
    .from('empresa_members')
    .update({ role: role as EmpresaRole })
    .eq('empresa_id', empresaId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (updateError) {
    console.error('[members PATCH] Update error:', updateError);
    return NextResponse.json({ error: 'DB_ERROR', message: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ member: member as EmpresaMember });
}

/** DELETE /api/empresas/[id]/members/[userId] — remover member */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id: empresaId, userId } = await params;
  const supabase = await createClient();

  const auth = await requireRole(supabase, empresaId, 'member.manage');
  if (!auth.ok) return auth.response;

  // Se removendo a si mesmo, verificar se é o último owner
  if (userId === auth.user.id) {
    // empresa_members tem PK composta (empresa_id, user_id) — não há coluna "id".
    // user_id sempre existe e é ideal para count em HEAD.
    const { count, error: countError } = await supabase
      .from('empresa_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('role', 'owner');

    if (countError) {
      console.error('[members DELETE] Count error:', countError);
      return NextResponse.json({ error: 'DB_ERROR', message: countError.message }, { status: 500 });
    }

    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: 'LAST_OWNER' }, { status: 409 });
    }
  }

  const { error: deleteError } = await supabase
    .from('empresa_members')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('user_id', userId);

  if (deleteError) {
    console.error('[members DELETE] Delete error:', deleteError);
    return NextResponse.json({ error: 'DB_ERROR', message: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
