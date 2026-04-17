export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserRoleInEmpresa, requireRole } from '@/lib/rbac';
import type { EmpresaMember, EmpresaMemberWithProfile, EmpresaRole } from '@/types/rbac';
import { randomUUID } from 'crypto';

const VALID_INVITE_ROLES: EmpresaRole[] = ['creator', 'approver', 'editor'];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** GET /api/empresas/[id]/members — lista membros com perfil */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: empresaId } = await params;
  const supabase = await createClient();

  // Qualquer member pode listar — basta ser member da empresa
  const role = await getUserRoleInEmpresa(supabase, empresaId);
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  // Busca membros
  const { data: members, error: membersError } = await supabase
    .from('empresa_members')
    .select('*')
    .eq('empresa_id', empresaId);

  if (membersError) {
    console.error('[members GET] DB error:', membersError);
    return NextResponse.json({ error: 'DB_ERROR', message: membersError.message }, { status: 500 });
  }

  if (!members || members.length === 0) {
    return NextResponse.json({ members: [] });
  }

  const userIds = members.map((m: EmpresaMember) => m.user_id);

  // Busca perfis
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, display_name, avatar_url')
    .in('id', userIds);

  if (profilesError) {
    console.error('[members GET] Profiles error:', profilesError);
    // Retorna members sem perfil em vez de 500
  }

  const profileMap = new Map<string, { email: string | null; display_name: string | null; avatar_url: string | null }>(
    (profiles ?? []).map((p: { id: string; email: string | null; display_name: string | null; avatar_url: string | null }) => [p.id, p])
  );

  const roleOrder: Record<EmpresaRole, number> = {
    owner: 1,
    editor: 2,
    approver: 3,
    creator: 4,
  };

  const membersWithProfile = members.map((m: EmpresaMember): EmpresaMemberWithProfile => {
    const profile = profileMap.get(m.user_id) ?? { email: null, display_name: null, avatar_url: null };
    // Epsilon defines EmpresaMemberWithProfile — cast allows parallel squad delivery
    return { ...m, ...profile } as unknown as EmpresaMemberWithProfile;
  });

  membersWithProfile.sort((a, b) => {
    const roleA = roleOrder[a.role as EmpresaRole] ?? 99;
    const roleB = roleOrder[b.role as EmpresaRole] ?? 99;
    if (roleA !== roleB) return roleA - roleB;
    return new Date(a.joined_at ?? 0).getTime() - new Date(b.joined_at ?? 0).getTime();
  });

  return NextResponse.json({ members: membersWithProfile });
}

/** POST /api/empresas/[id]/members — convidar/adicionar membro */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: empresaId } = await params;
  const supabase = await createClient();

  const auth = await requireRole(supabase, empresaId, 'member.invite');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const { email, role } = body as { email?: unknown; role?: unknown };

  if (typeof email !== 'string' || !isValidEmail(email)) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'email inválido' }, { status: 400 });
  }

  if (typeof role !== 'string' || !VALID_INVITE_ROLES.includes(role as EmpresaRole)) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: `role deve ser um de: ${VALID_INVITE_ROLES.join(', ')}` },
      { status: 400 }
    );
  }

  const normalizedEmail = email.toLowerCase();

  // Verifica se já existe perfil com esse email
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (profile) {
    // Verifica se já é member — empresa_members tem PK composta, não há coluna "id"
    const { data: existing } = await supabase
      .from('empresa_members')
      .select('user_id')
      .eq('empresa_id', empresaId)
      .eq('user_id', profile.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'ALREADY_MEMBER' }, { status: 409 });
    }

    // Adiciona diretamente
    const { data: member, error: insertError } = await supabase
      .from('empresa_members')
      .insert({
        empresa_id: empresaId,
        user_id: profile.id,
        role: role as EmpresaRole,
        invited_by: auth.user.id,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('[members POST] Insert member error:', insertError);
      return NextResponse.json({ error: 'DB_ERROR', message: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ type: 'added', member }, { status: 201 });
  }

  // Usuário não existe — criar invite
  // Revogar invites pendentes anteriores para o mesmo (empresa_id, email)
  await supabase
    .from('empresa_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('empresa_id', empresaId)
    .ilike('email', normalizedEmail)
    .is('accepted_at', null)
    .is('revoked_at', null);

  // Token é UUID (column type na tabela empresa_invites).
  // Se não passarmos, o DB usa DEFAULT gen_random_uuid() — geramos aqui
  // para retornar o link já formatado sem round-trip extra.
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 dias

  const { data: invite, error: inviteError } = await supabase
    .from('empresa_invites')
    .insert({
      empresa_id: empresaId,
      email: normalizedEmail,
      role: role as EmpresaRole,
      invited_by: auth.user.id,
      token,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (inviteError) {
    console.error('[members POST] Insert invite error:', inviteError);
    return NextResponse.json({ error: 'DB_ERROR', message: inviteError.message }, { status: 500 });
  }

  const appUrl = process.env.APP_URL || 'https://contia.bertuzzipatrimonial.com.br';
  const acceptUrl = `${appUrl}/invite/accept?token=${token}`;

  return NextResponse.json({ type: 'invited', invite, accept_url: acceptUrl }, { status: 201 });
}
