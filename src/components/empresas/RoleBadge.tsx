'use client';

import type { EmpresaRole } from '@/types/rbac';
import { ROLE_LABELS } from '@/types/rbac';

const COLORS: Record<EmpresaRole, string> = {
  owner: 'bg-violet-500/20 dark:text-violet-300 text-violet-700 border-violet-500/40',
  editor: 'bg-blue-500/20 dark:text-blue-300 text-blue-700 border-blue-500/40',
  approver: 'bg-amber-500/20 dark:text-amber-300 text-amber-700 border-amber-500/40',
  creator: 'bg-zinc-500/20 dark:text-zinc-300 text-zinc-600 border-zinc-500/40',
};

export function RoleBadge({ role, size = 'sm' }: { role: EmpresaRole; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5';
  return (
    <span className={`inline-flex items-center rounded-full border ${COLORS[role]} ${cls} font-medium`}>
      {ROLE_LABELS[role]}
    </span>
  );
}
