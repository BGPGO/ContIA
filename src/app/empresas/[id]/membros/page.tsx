'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, UserPlus, Loader2, AlertCircle, Copy, X } from 'lucide-react';
import { useEmpresa } from '@/hooks/useEmpresa';
import { canDoAction } from '@/types/rbac';
import type { EmpresaMemberWithProfile, EmpresaInvite, EmpresaRole } from '@/types/rbac';
import { ROLE_LABELS } from '@/types/rbac';
import { RoleBadge } from '@/components/empresas/RoleBadge';
import { MemberRow } from '@/components/empresas/MemberRow';
import { InviteMemberModal } from '@/components/empresas/InviteMemberModal';

export default function MembrosPage() {
  const params = useParams();
  const empresaId = params.id as string;
  const { empresa, myRole } = useEmpresa();

  const [members, setMembers] = useState<EmpresaMemberWithProfile[]>([]);
  const [invites, setInvites] = useState<EmpresaInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  const isOwner = myRole === 'owner';

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/empresas/${empresaId}/members`);
      if (!res.ok) throw new Error('Falha ao carregar membros');
      const data = await res.json();
      setMembers(data.members ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar membros');
    }
  }, [empresaId]);

  const fetchInvites = useCallback(async () => {
    if (!isOwner) return;
    try {
      const res = await fetch(`/api/empresas/${empresaId}/invites`);
      if (!res.ok) return;
      const data = await res.json();
      setInvites(data.invites ?? []);
    } catch {
      // invites section is optional
    }
  }, [empresaId, isOwner]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchMembers(), fetchInvites()]);
    setLoading(false);
  }, [fetchMembers, fetchInvites]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function handleChangeRole(userId: string, role: EmpresaRole) {
    try {
      const res = await fetch(`/api/empresas/${empresaId}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) return;
      await refetch();
    } catch {
      // silently fail — UI unchanged
    }
  }

  async function handleRemove(userId: string) {
    if (!confirm('Remover este membro da empresa?')) return;
    try {
      const res = await fetch(`/api/empresas/${empresaId}/members/${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) return;
      await refetch();
    } catch {
      // silently fail
    }
  }

  async function handleRevoke(inviteId: string) {
    try {
      const res = await fetch(`/api/empresas/${empresaId}/invites/${inviteId}/revoke`, {
        method: 'POST',
      });
      if (!res.ok) return;
      await fetchInvites();
    } catch {
      // silently fail
    }
  }

  async function handleCopyInviteLink(token: string, inviteId: string) {
    const url = `${window.location.origin}/invite/accept?token=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedInviteId(inviteId);
      setTimeout(() => setCopiedInviteId(null), 2000);
    } catch {
      // fallback
    }
  }

  const ownersCount = members.filter((m) => m.role === 'owner').length;
  // We need the current user id to know which row is "me"
  // We'll read it from the member list matching with the empresa context
  // Since we don't have direct userId, we'll do best-effort by checking invite logic
  // For isMe: check based on email matching the current user — we don't have that here
  // so we check member via empresa's user_id if available
  // Simple fallback: no isMe detection (all false) until Delta provides currentUserId in response
  const getMeId = (): string | null => null;
  const meId = getMeId();

  const pendingInvites = invites.filter((i) => !i.accepted_at && !i.revoked_at);

  return (
    <div className="min-h-screen bg-[#080b1e] p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/configuracoes"
          className="inline-flex items-center gap-1.5 text-[12px] text-[#5e6388] hover:text-[#8b8fb0] transition-colors duration-150 mb-3"
        >
          <ArrowLeft size={13} />
          Configurações
        </Link>

        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-[#e8eaff]">
            {empresa?.nome ?? 'Empresa'} — Membros
          </h1>
          {myRole && <RoleBadge role={myRole} size="md" />}

          {canDoAction(myRole, 'member.invite') && (
            <button
              type="button"
              onClick={() => setInviteModalOpen(true)}
              className="ml-auto inline-flex items-center gap-1.5 px-3 h-9 text-[12px] font-medium text-white bg-[#6c5ce7] hover:bg-[#6c5ce7]/90 rounded-xl transition-colors duration-150"
            >
              <UserPlus size={14} />
              Convidar membro
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="text-[#6c5ce7] animate-spin" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-[#f87171]/[0.06] border border-[#f87171]/25 rounded-xl text-[#f87171] text-[13px]">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Members list */}
      {!loading && !error && (
        <div className="space-y-4">
          <div className="bg-[#0f1230] border border-[#1e2348]/60 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1e2348]/40">
              <h2 className="text-[11px] font-semibold text-[#5e6388] uppercase tracking-wide">
                Membros ({members.length})
              </h2>
            </div>

            {members.length === 0 ? (
              <div className="py-10 text-center text-[#5e6388] text-[13px]">
                Nenhum membro encontrado
              </div>
            ) : (
              <div className="divide-y divide-[#1e2348]/30">
                {members.map((member) => (
                  <MemberRow
                    key={member.user_id}
                    member={member}
                    myRole={myRole ?? 'creator'}
                    isMe={meId ? member.user_id === meId : false}
                    ownersCount={ownersCount}
                    onChangeRole={handleChangeRole}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pending invites — owner only */}
          {isOwner && pendingInvites.length > 0 && (
            <div className="bg-[#0f1230] border border-[#1e2348]/60 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1e2348]/40">
                <h2 className="text-[11px] font-semibold text-[#5e6388] uppercase tracking-wide">
                  Convites pendentes ({pendingInvites.length})
                </h2>
              </div>

              <div className="divide-y divide-[#1e2348]/30">
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#e8eaff] truncate">{invite.email}</p>
                      <p className="text-[11px] text-[#5e6388]">
                        {ROLE_LABELS[invite.role]} — enviado em{' '}
                        {new Date(invite.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>

                    <RoleBadge role={invite.role} />

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyInviteLink(invite.token, invite.id)}
                        className="p-1.5 rounded-lg text-[#5e6388] hover:text-[#4ecdc4] hover:bg-[#4ecdc4]/10 transition-colors duration-150"
                        title="Copiar link"
                      >
                        {copiedInviteId === invite.id ? <X size={13} /> : <Copy size={13} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevoke(invite.id)}
                        className="px-2.5 h-7 text-[11px] font-medium text-[#f87171]/70 hover:text-[#f87171] hover:bg-[#f87171]/[0.06] rounded-lg transition-colors duration-150"
                      >
                        Revogar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invite modal */}
      <InviteMemberModal
        empresaId={empresaId}
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onInvited={refetch}
      />
    </div>
  );
}
