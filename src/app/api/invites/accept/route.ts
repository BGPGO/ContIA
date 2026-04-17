export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import type { EmpresaRole } from '@/types/rbac';

/** POST /api/invites/accept — aceitar invite autenticado */
export async function POST(req: Request) {
  const supabase = await createClient();

  // Auth obrigatória — usa client normal para verificar sessão
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const { token } = body as { token?: unknown };

  if (typeof token !== 'string' || !token.trim()) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'token é obrigatório' }, { status: 400 });
  }

  const admin = getAdminSupabase();

  // Busca invite com admin (user ainda não é member — RLS impediria leitura)
  const { data: invite, error: inviteError } = await admin
    .from('empresa_invites')
    .select('*')
    .eq('token', token.trim())
    .maybeSingle();

  if (inviteError) {
    console.error('[invite accept] DB error:', inviteError);
    return NextResponse.json({ error: 'DB_ERROR', message: inviteError.message }, { status: 500 });
  }

  if (!invite) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const now = new Date();

  if (invite.accepted_at) {
    return NextResponse.json({ error: 'INVITE_ALREADY_ACCEPTED' }, { status: 409 });
  }
  if (invite.revoked_at) {
    return NextResponse.json({ error: 'INVITE_REVOKED' }, { status: 410 });
  }
  if (invite.expires_at && new Date(invite.expires_at as string) < now) {
    return NextResponse.json({ error: 'INVITE_EXPIRED' }, { status: 410 });
  }

  // Verificar se email do user bate com o do invite
  if (!user.email || (user.email.toLowerCase() !== (invite.email as string).toLowerCase())) {
    return NextResponse.json({ error: 'EMAIL_MISMATCH' }, { status: 403 });
  }

  // Adiciona member (ON CONFLICT DO NOTHING via upsert=false + ignore duplicate)
  const { error: memberError } = await admin
    .from('empresa_members')
    .insert({
      empresa_id: invite.empresa_id,
      user_id: user.id,
      role: invite.role as EmpresaRole,
      invited_by: invite.invited_by,
    });

  // Ignora conflito (já é member)
  if (memberError && !memberError.message.includes('duplicate') && !memberError.message.includes('unique')) {
    console.error('[invite accept] Insert member error:', memberError);
    return NextResponse.json({ error: 'DB_ERROR', message: memberError.message }, { status: 500 });
  }

  // Marca invite como aceito
  const { error: updateError } = await admin
    .from('empresa_invites')
    .update({ accepted_at: now.toISOString() })
    .eq('id', invite.id as string);

  if (updateError) {
    console.error('[invite accept] Update invite error:', updateError);
    // Não é fatal — member foi adicionado
  }

  return NextResponse.json({ empresa_id: invite.empresa_id, role: invite.role });
}
