export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/** GET /api/invites/[token] — lookup de invite por token (não requer auth) */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = getAdminSupabase();

  // Busca invite com dados da empresa (join manual pois admin client)
  const { data: invite, error } = await admin
    .from('empresa_invites')
    .select('*, empresa:empresas(nome, logo_url)')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.error('[invite GET] DB error:', error);
    return NextResponse.json({ error: 'DB_ERROR', message: error.message }, { status: 500 });
  }

  if (!invite) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const now = new Date();

  // Validações de estado do invite
  if (invite.accepted_at) {
    return NextResponse.json({ error: 'INVITE_ALREADY_ACCEPTED' }, { status: 410 });
  }
  if (invite.revoked_at) {
    return NextResponse.json({ error: 'INVITE_REVOKED' }, { status: 410 });
  }
  if (invite.expires_at && new Date(invite.expires_at as string) < now) {
    return NextResponse.json({ error: 'INVITE_EXPIRED' }, { status: 410 });
  }

  // Verifica se o email já tem conta
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .ilike('email', invite.email as string)
    .maybeSingle();

  const requiresSignup = !existingProfile;

  const empresa = invite.empresa as { nome: string | null; logo_url: string | null } | null;

  return NextResponse.json({
    invite: {
      empresa_id: invite.empresa_id,
      empresa_nome: empresa?.nome ?? null,
      empresa_logo_url: empresa?.logo_url ?? null,
      role: invite.role,
      email: invite.email,
      expires_at: invite.expires_at,
    },
    requires_signup: requiresSignup,
  });
}
