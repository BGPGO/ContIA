'use client';

import { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteEmpresaModalProps {
  empresa: { id: string; nome: string };
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteEmpresaModal({ empresa, open, onClose, onDeleted }: DeleteEmpresaModalProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const isMatch = confirmInput.trim() === empresa.nome;

  function handleClose() {
    setConfirmInput('');
    setError(null);
    onClose();
  }

  async function handleDelete() {
    if (!isMatch) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/empresas/${empresa.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm_name: confirmInput.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? data?.message ?? 'Erro ao deletar empresa.');
        return;
      }

      onDeleted();
      handleClose();
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
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
          <h2 className="text-[15px] font-semibold text-text-primary">Deletar empresa</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-colors duration-150"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 px-3 py-3 bg-[#f87171]/[0.06] border border-[#f87171]/25 rounded-xl">
            <AlertTriangle size={16} className="text-[#f87171] shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-medium text-[#f87171]">Atenção: ação destrutiva</p>
              <p className="text-[11px] text-[#f87171]/70 mt-0.5">
                Esta ação desativa a empresa. Você poderá restaurar em até 30 dias.
              </p>
            </div>
          </div>

          {/* Confirm name */}
          <div>
            <label className="block text-[12px] text-text-secondary mb-2">
              Digite{' '}
              <code className="px-1 py-0.5 bg-bg-card border border-border rounded text-text-primary text-[11px]">
                {empresa.nome}
              </code>{' '}
              para confirmar:
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={empresa.nome}
              className="w-full h-9 bg-bg-card border border-border text-text-primary placeholder:text-text-muted rounded-lg px-3 text-sm outline-none focus:border-[#f87171]/40 focus:ring-1 focus:ring-[#f87171]/15 transition-all duration-200"
            />
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
              disabled={loading}
              className="px-4 h-9 text-[12px] font-medium text-text-secondary hover:text-text-primary bg-bg-card border border-border rounded-lg transition-colors duration-150 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!isMatch || loading}
              className="inline-flex items-center gap-1.5 px-4 h-9 text-[12px] font-medium text-white bg-[#f87171] hover:bg-[#f87171]/90 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
            >
              {loading && <Loader2 size={12} className="animate-spin" />}
              Deletar empresa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
