export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/rbac';

/** POST /api/empresas/[id]/invites/[inviteId]/revoke — revogar convite */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  const { id: empresaId, inviteId } = await params;
  const supabase = await createClient();

  const auth = await requireRole(supabase, empresaId, 'member.invite');
  if (!auth.ok) return auth.response;

  const { error } = await supabase
    .from('empresa_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', inviteId)
    .eq('empresa_id', empresaId);

  if (error) {
    console.error('[invite revoke] DB error:', error);
    return NextResponse.json({ error: 'DB_ERROR', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
