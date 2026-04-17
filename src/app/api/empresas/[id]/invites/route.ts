export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/rbac';
import type { EmpresaInvite } from '@/types/rbac';

/** GET /api/empresas/[id]/invites — lista convites pendentes */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: empresaId } = await params;
  const supabase = await createClient();

  const auth = await requireRole(supabase, empresaId, 'member.invite');
  if (!auth.ok) return auth.response;

  const { data: invites, error } = await supabase
    .from('empresa_invites')
    .select('*')
    .eq('empresa_id', empresaId)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[invites GET] DB error:', error);
    return NextResponse.json({ error: 'DB_ERROR', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ invites: (invites ?? []) as EmpresaInvite[] });
}
