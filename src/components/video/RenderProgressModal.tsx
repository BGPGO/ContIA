/**
 * @deprecated
 * Modal de progresso do render client-side (browser-render.ts).
 * Substituído pelo JobStatusPanel + render server-side (Wave 5).
 * Mantido só pra fallback de cortes legacy sem rendered_url.
 */
'use client';

import React from 'react';

interface RenderProgressModalProps {
  open: boolean;
  progress: number;           // 0..100
  message: string;
  status: 'rendering' | 'success' | 'error' | 'cancelled';
  error?: string;
  outputUrl?: string;         // download URL quando success
  onCancel: () => void;
  onClose: () => void;
  onDownload?: () => void;
}

export const RenderProgressModal: React.FC<RenderProgressModalProps> = ({
  open, progress, message, status, error, outputUrl: _outputUrl, onCancel, onClose, onDownload,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-bg-card dark:border-white/10 border-border rounded-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-text-primary font-semibold text-lg">
            {status === 'rendering' && 'Renderizando vídeo...'}
            {status === 'success' && 'Vídeo pronto!'}
            {status === 'error' && 'Erro ao renderizar'}
            {status === 'cancelled' && 'Cancelado'}
          </h3>
        </div>

        {status === 'rendering' && (
          <>
            <div className="mb-3">
              <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 transition-all duration-200"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
              <p className="text-xs text-text-muted mt-2">{message} ({progress}%)</p>
            </div>
            <p className="text-xs text-text-muted mb-4">
              O render acontece no seu navegador. Não feche esta aba.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition"
              >
                Cancelar
              </button>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <p className="text-sm text-text-secondary mb-4">
              Seu vídeo com legendas virais está pronto.
            </p>
            <div className="flex justify-end gap-2">
              {onDownload && (
                <button
                  type="button"
                  onClick={onDownload}
                  className="px-4 py-2 text-sm font-semibold bg-yellow-400 text-black rounded-lg hover:bg-yellow-300 transition"
                >
                  Baixar vídeo
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition"
              >
                Fechar
              </button>
            </div>
          </>
        )}

        {(status === 'error' || status === 'cancelled') && (
          <>
            {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
            {status === 'cancelled' && !error && (
              <p className="text-sm text-text-muted mb-4">Render cancelado pelo usuário.</p>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition"
              >
                Fechar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
