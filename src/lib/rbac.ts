import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmpresaRole, RbacAction } from '@/types/rbac';
import { canDoAction } from '@/types/rbac';
import { NextResponse } from 'next/server';

/**
 * Busca o role do user atual numa empresa via RPC user_empresa_role.
 * Retorna null se user não for member.
 */
export async function getUserRoleInEmpresa(
  supabase: SupabaseClient,
  empresaId: string
): Promise<EmpresaRole | null> {
  const { data, error } = await supabase.rpc('user_empresa_role', { p_empresa_id: empresaId });
  if (error) return null;
  return (data as EmpresaRole | null) ?? null;
}

/**
 * Helper para rotas: autentica + autoriza por RbacAction.
 * Retorna NextResponse de erro se falhar, ou { user, role } se ok.
 */
export async function requireRole(
  supabase: SupabaseClient,
  empresaId: string,
  action: RbacAction
): Promise<
  | { ok: true; user: { id: string; email: string | null }; role: EmpresaRole }
  | { ok: false; response: NextResponse }
> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 }) };
  }

  const role = await getUserRoleInEmpresa(supabase, empresaId);
  if (!role) {
    return { ok: false, response: NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }) };
  }

  if (!canDoAction(role, action)) {
    return { ok: false, response: NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }) };
  }

  return { ok: true, user: { id: user.id, email: user.email ?? null }, role };
}
