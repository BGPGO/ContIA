'use client';

import { useState } from 'react';
import { X, Copy, Check, Loader2 } from 'lucide-react';
import type { EmpresaRole } from '@/types/rbac';
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/types/rbac';

interface InviteMemberModalProps {
  empresaId: string;
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}

type ViewMode = 'form' | 'link';

const INVITABLE_ROLES: EmpresaRole[] = ['creator', 'approver', 'editor'];

export function InviteMemberModal({ empresaId, open, onClose, onInvited }: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<EmpresaRole>('creator');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('form');
  const [acceptUrl, setAcceptUrl] = useState('');
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  function handleClose() {
    setEmail('');
    setRole('creator');
    setError(null);
    setView('form');
    setAcceptUrl('');
    setCopied(false);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/empresas/${empresaId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.error ?? data?.message ?? 'Erro ao convidar membro';
        setError(msg);
        return;
      }

      if (data.type === 'added') {
        onInvited();
        handleClose();
      } else if (data.type === 'invited') {
        setAcceptUrl(data.accept_url ?? '');
        setView('link');
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(acceptUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the input
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-bg-primary/80 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-bg-input border border-border/80 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <h2 className="text-[15px] font-semibold text-text-primary">
            {view === 'form' ? 'Convidar membro' : 'Convite gerado'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-colors duration-150"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {view === 'form' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  className="w-full h-9 bg-bg-card border border-border text-text-primary placeholder:text-text-muted rounded-lg px-3 text-sm outline-none focus:border-[#6c5ce7]/50 focus:ring-1 focus:ring-[#6c5ce7]/20 transition-all duration-200"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-1.5">
                  Papel
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as EmpresaRole)}
                  className="w-full h-9 bg-bg-card border border-border text-text-primary rounded-lg px-3 text-sm outline-none focus:border-[#6c5ce7]/50 focus:ring-1 focus:ring-[#6c5ce7]/20 transition-all duration-200"
                >
                  {INVITABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-text-muted">{ROLE_DESCRIPTIONS[role]}</p>
              </div>

              {/* Error */}
              {error && (
                <p className="text-[12px] text-[#f87171] px-3 py-2 bg-[#f87171]/[0.06] border border-[#f87171]/20 rounded-lg">
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 h-9 text-[12px] font-medium text-text-secondary hover:text-text-primary bg-bg-card border border-border rounded-lg transition-colors duration-150"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-4 h-9 text-[12px] font-medium text-white bg-[#6c5ce7] hover:bg-[#6c5ce7]/90 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150"
                >
                  {loading && <Loader2 size={12} className="animate-spin" />}
                  Convidar
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 px-3 py-3 bg-[#4ecdc4]/[0.06] border border-[#4ecdc4]/20 rounded-xl">
                <Check size={14} className="text-[#4ecdc4] shrink-0 mt-0.5" />
                <p className="text-[12px] text-text-secondary">
                  Usuário ainda não cadastrado. Envie este link para ele acessar o convite:
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-1.5">
                  Link de convite
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={acceptUrl}
                    className="flex-1 h-9 bg-bg-card border border-border text-text-secondary rounded-lg px-3 text-xs font-mono outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 h-9 text-[12px] font-medium text-white bg-[#6c5ce7] hover:bg-[#6c5ce7]/90 rounded-lg transition-colors duration-150"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-text-muted">Expira em 7 dias.</p>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 h-9 text-[12px] font-medium text-text-primary bg-bg-card border border-border rounded-lg hover:border-border/80 transition-colors duration-150"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
