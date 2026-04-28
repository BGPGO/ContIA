'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Save, Loader2, Check, Users, Cable, Trash2 } from 'lucide-react';
import type { Empresa } from '@/types';
import type { EmpresaRole } from '@/types/rbac';
import { canDoAction } from '@/types/rbac';
import { useEmpresa } from '@/hooks/useEmpresa';
import { DeleteEmpresaModal } from './DeleteEmpresaModal';

interface EmpresaSettingsPanelProps {
  empresa: Empresa;
  myRole: EmpresaRole | null;
}

const inputClass =
  'w-full h-9 bg-bg-card border border-border text-text-primary placeholder:text-text-muted rounded-lg px-3 text-sm outline-none focus:border-[#6c5ce7]/50 focus:ring-1 focus:ring-[#6c5ce7]/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

const labelClass =
  'block text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-1.5';

export function EmpresaSettingsPanel({ empresa, myRole }: EmpresaSettingsPanelProps) {
  const { updateEmpresa, refreshEmpresas } = useEmpresa();
  const canEdit = canDoAction(myRole, 'empresa.edit');
  const canDelete = canDoAction(myRole, 'empresa.delete');

  const [form, setForm] = useState({
    nome: empresa.nome,
    descricao: empresa.descricao,
    nicho: empresa.nicho,
    website: empresa.website ?? '',
    cor_primaria: empresa.cor_primaria,
    cor_secundaria: empresa.cor_secundaria,
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  function updateField<K extends keyof typeof form>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaveError(null);
    setSaving(true);
    try {
      const result = await updateEmpresa(empresa.id, {
        nome: form.nome,
        descricao: form.descricao,
        nicho: form.nicho,
        website: form.website || null,
        cor_primaria: form.cor_primaria,
        cor_secundaria: form.cor_secundaria,
      });
      if (!result) {
        setSaveError('Erro ao salvar. Tente novamente.');
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleDeleted() {
    refreshEmpresas();
  }

  return (
    <div className="space-y-4">
      {/* Dados da empresa */}
      <div className="bg-bg-input border border-border/60 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40">
          <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">
            Dados da empresa
          </h3>
        </div>

        <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Nome */}
          <div className="md:col-span-2">
            <label className={labelClass}>Nome</label>
            <input
              type="text"
              className={inputClass}
              value={form.nome}
              onChange={(e) => updateField('nome', e.target.value)}
              disabled={!canEdit}
              placeholder="Nome da empresa"
            />
          </div>

          {/* Descrição */}
          <div className="md:col-span-2">
            <label className={labelClass}>Descrição</label>
            <textarea
              className={`${inputClass} h-auto py-2 resize-none`}
              rows={3}
              value={form.descricao}
              onChange={(e) => updateField('descricao', e.target.value)}
              disabled={!canEdit}
              placeholder="Descreva sua empresa..."
            />
          </div>

          {/* Nicho */}
          <div>
            <label className={labelClass}>Nicho</label>
            <input
              type="text"
              className={inputClass}
              value={form.nicho}
              onChange={(e) => updateField('nicho', e.target.value)}
              disabled={!canEdit}
              placeholder="Ex: Tecnologia / SaaS"
            />
          </div>

          {/* Website */}
          <div>
            <label className={labelClass}>Website</label>
            <input
              type="url"
              className={inputClass}
              value={form.website}
              onChange={(e) => updateField('website', e.target.value)}
              disabled={!canEdit}
              placeholder="https://suaempresa.com.br"
            />
          </div>

          {/* Cor primária */}
          <div>
            <label className={labelClass}>Cor primária</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.cor_primaria}
                onChange={(e) => updateField('cor_primaria', e.target.value)}
                disabled={!canEdit}
                className="w-6 h-6 rounded-md border border-border bg-transparent cursor-pointer p-0 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <input
                type="text"
                className={`${inputClass} font-mono uppercase text-xs`}
                value={form.cor_primaria}
                onChange={(e) => updateField('cor_primaria', e.target.value)}
                disabled={!canEdit}
                maxLength={7}
                placeholder="#6c5ce7"
              />
            </div>
          </div>

          {/* Cor secundária */}
          <div>
            <label className={labelClass}>Cor secundária</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.cor_secundaria}
                onChange={(e) => updateField('cor_secundaria', e.target.value)}
                disabled={!canEdit}
                className="w-6 h-6 rounded-md border border-border bg-transparent cursor-pointer p-0 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <input
                type="text"
                className={`${inputClass} font-mono uppercase text-xs`}
                value={form.cor_secundaria}
                onChange={(e) => updateField('cor_secundaria', e.target.value)}
                disabled={!canEdit}
                maxLength={7}
                placeholder="#a29bfe"
              />
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="px-4 pb-4 flex items-center justify-end gap-2">
            {saveError && (
              <span className="text-[11px] text-[#f87171]">{saveError}</span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`inline-flex items-center gap-1.5 px-4 h-8 rounded-lg font-medium text-[12px] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${
                saved
                  ? 'bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/20'
                  : 'bg-[#6c5ce7] hover:bg-[#6c5ce7]/90 text-white'
              }`}
            >
              {saving ? (
                <><Loader2 size={11} className="animate-spin" />Salvando...</>
              ) : saved ? (
                <><Check size={11} />Salvo</>
              ) : (
                <><Save size={11} />Salvar</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Membros */}
      <div className="bg-bg-input border border-border/60 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40">
          <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">
            Equipe
          </h3>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#6c5ce7]/10 flex items-center justify-center">
              <Users size={14} className="text-[#6c5ce7]" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-text-primary">Membros da empresa</p>
              <p className="text-[11px] text-text-muted">Gerencie quem tem acesso</p>
            </div>
          </div>
          <Link
            href={`/empresas/${empresa.id}/membros`}
            className="inline-flex items-center gap-1.5 px-3 h-8 text-[12px] font-medium text-text-secondary hover:text-text-primary bg-bg-card border border-border rounded-lg transition-colors duration-150"
          >
            Gerenciar
          </Link>
        </div>
      </div>

      {/* Redes Sociais */}
      <div className="bg-bg-input border border-border/60 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40">
          <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">
            Redes Sociais
          </h3>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#4ecdc4]/10 flex items-center justify-center">
              <Cable size={14} className="text-[#4ecdc4]" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-text-primary">Conexões de redes sociais</p>
              <p className="text-[11px] text-text-muted">Instagram, Facebook, LinkedIn e mais</p>
            </div>
          </div>
          <Link
            href={`/conexoes?empresaId=${empresa.id}`}
            className="inline-flex items-center gap-1.5 px-3 h-8 text-[12px] font-medium text-text-secondary hover:text-text-primary bg-bg-card border border-border rounded-lg transition-colors duration-150"
          >
            Gerenciar
          </Link>
        </div>
      </div>

      {/* Zona de perigo */}
      {canDelete && (
        <div className="bg-bg-input border border-[#f87171]/25 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f87171]/15">
            <h3 className="text-[11px] font-semibold text-[#f87171]/70 uppercase tracking-wide">
              Zona de perigo
            </h3>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-text-primary">Deletar empresa</p>
              <p className="text-[11px] text-text-muted">
                Desativa a empresa. Restaurável em até 30 dias.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 h-8 text-[12px] font-medium text-[#f87171] hover:text-white hover:bg-[#f87171] border border-[#f87171]/30 rounded-lg transition-all duration-150"
            >
              <Trash2 size={12} />
              Deletar
            </button>
          </div>
        </div>
      )}

      <DeleteEmpresaModal
        empresa={{ id: empresa.id, nome: empresa.nome }}
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
