'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertCircle, Building2, CheckCircle } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import type { EmpresaInviteWithEmpresa } from '@/types/rbac';
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/types/rbac';
import { RoleBadge } from '@/components/empresas/RoleBadge';

interface InviteDetails {
  invite: EmpresaInviteWithEmpresa;
  requires_signup: boolean;
}

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const { user } = useUser();

  const [details, setDetails] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Link inválido ou expirado.');
      setLoading(false);
      return;
    }

    fetch(`/api/invites/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error ?? 'Convite não encontrado ou expirado.');
        }
        return res.json() as Promise<InviteDetails>;
      })
      .then((data) => {
        setDetails(data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar convite.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? 'Erro ao aceitar convite.');
        return;
      }

      setAccepted(true);
      // Redirect after short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setAccepting(false);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#080b1e] flex items-center justify-center">
        <Loader2 size={32} className="text-[#6c5ce7] animate-spin" />
      </div>
    );
  }

  // ── Invalid / error ──
  if (error && !details) {
    return (
      <div className="min-h-screen bg-[#080b1e] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0f1230] border border-[#1e2348]/80 rounded-2xl p-6 text-center">
          <AlertCircle size={36} className="text-[#f87171] mx-auto mb-3" />
          <h1 className="text-[17px] font-semibold text-[#e8eaff] mb-2">Link inválido</h1>
          <p className="text-[13px] text-[#5e6388]">{error}</p>
          <Link
            href="/login"
            className="mt-5 inline-flex items-center gap-1.5 px-4 h-9 text-[12px] font-medium text-white bg-[#6c5ce7] rounded-xl hover:bg-[#6c5ce7]/90 transition-colors duration-150"
          >
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  if (!details) return null;

  const { invite, requires_signup } = details;
  const redirectParam = encodeURIComponent(`/invite/accept?token=${token}`);
  const emailParam = encodeURIComponent(invite.email);

  // ── Accepted ──
  if (accepted) {
    return (
      <div className="min-h-screen bg-[#080b1e] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0f1230] border border-[#1e2348]/80 rounded-2xl p-6 text-center">
          <CheckCircle size={40} className="text-[#34d399] mx-auto mb-3" />
          <h1 className="text-[17px] font-semibold text-[#e8eaff] mb-1">Convite aceito!</h1>
          <p className="text-[13px] text-[#5e6388]">Redirecionando para o painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080b1e] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0f1230] border border-[#1e2348]/80 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
        {/* Card header */}
        <div className="px-6 pt-6 pb-4 text-center">
          {/* Company logo/icon */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6c5ce7]/30 to-[#4ecdc4]/30 border border-[#1e2348] flex items-center justify-center mx-auto mb-4">
            {invite.empresa_logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={invite.empresa_logo_url}
                alt={invite.empresa_nome}
                className="w-10 h-10 object-contain rounded-xl"
              />
            ) : (
              <Building2 size={24} className="text-[#6c5ce7]" />
            )}
          </div>

          <h1 className="text-[18px] font-bold text-[#e8eaff] mb-1">
            Você foi convidado
          </h1>
          <p className="text-[14px] text-[#8b8fb0]">
            para participar de{' '}
            <span className="font-semibold text-[#e8eaff]">{invite.empresa_nome}</span>
          </p>
        </div>

        {/* Role info */}
        <div className="mx-6 mb-4 px-4 py-3 bg-[#141736] border border-[#1e2348] rounded-xl flex items-center gap-3">
          <RoleBadge role={invite.role} size="md" />
          <div>
            <p className="text-[12px] font-medium text-[#e8eaff]">
              {ROLE_LABELS[invite.role]}
            </p>
            <p className="text-[11px] text-[#5e6388] mt-0.5">
              {ROLE_DESCRIPTIONS[invite.role]}
            </p>
          </div>
        </div>

        {/* Error inline */}
        {error && (
          <div className="mx-6 mb-4 flex items-center gap-2 px-3 py-2.5 bg-[#f87171]/[0.06] border border-[#f87171]/25 rounded-xl text-[#f87171] text-[12px]">
            <AlertCircle size={13} />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="px-6 pb-6">
          {/* Not logged in + requires signup */}
          {!user && requires_signup && (
            <div className="space-y-3">
              <p className="text-[12px] text-[#5e6388] text-center">
                Crie uma conta para aceitar este convite.
              </p>
              <Link
                href={`/register?email=${emailParam}&redirect=${redirectParam}`}
                className="w-full flex items-center justify-center h-10 text-[13px] font-medium text-white bg-[#6c5ce7] hover:bg-[#6c5ce7]/90 rounded-xl transition-colors duration-150"
              >
                Criar conta
              </Link>
            </div>
          )}

          {/* Not logged in + already has account */}
          {!user && !requires_signup && (
            <div className="space-y-3">
              <p className="text-[12px] text-[#5e6388] text-center">
                Faça login para aceitar este convite.
              </p>
              <Link
                href={`/login?email=${emailParam}&redirect=${redirectParam}`}
                className="w-full flex items-center justify-center h-10 text-[13px] font-medium text-white bg-[#6c5ce7] hover:bg-[#6c5ce7]/90 rounded-xl transition-colors duration-150"
              >
                Entrar
              </Link>
            </div>
          )}

          {/* Logged in + email matches */}
          {user && user.email === invite.email && (
            <button
              type="button"
              onClick={handleAccept}
              disabled={accepting}
              className="w-full flex items-center justify-center gap-2 h-10 text-[13px] font-medium text-white bg-[#6c5ce7] hover:bg-[#6c5ce7]/90 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150"
            >
              {accepting && <Loader2 size={14} className="animate-spin" />}
              Aceitar convite
            </button>
          )}

          {/* Logged in + email doesn't match */}
          {user && user.email !== invite.email && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 px-3 py-3 bg-[#fbbf24]/[0.06] border border-[#fbbf24]/25 rounded-xl">
                <AlertCircle size={14} className="text-[#fbbf24] shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#fbbf24]/80">
                  Você está logado como{' '}
                  <span className="font-semibold">{user.email}</span>, mas o convite é para{' '}
                  <span className="font-semibold">{invite.email}</span>. Saia da conta atual para aceitar.
                </p>
              </div>
              <Link
                href="/login"
                className="w-full flex items-center justify-center h-9 text-[12px] font-medium text-[#8b8fb0] bg-[#141736] border border-[#1e2348] rounded-xl hover:text-[#e8eaff] hover:border-[#1e2348]/80 transition-colors duration-150"
              >
                Trocar de conta
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
