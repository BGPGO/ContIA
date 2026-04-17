// src/types/rbac.ts
// Contratos RBAC — FROZEN. Não altere sem alinhar Delta/Gamma.

export type EmpresaRole = 'owner' | 'editor' | 'approver' | 'creator';

export const ROLE_HIERARCHY: Record<EmpresaRole, number> = {
  creator: 1,
  approver: 2,
  editor: 3,
  owner: 4,
};

export const ROLE_LABELS: Record<EmpresaRole, string> = {
  owner: 'Dono',
  editor: 'Editor',
  approver: 'Aprovador',
  creator: 'Criador',
};

export const ROLE_DESCRIPTIONS: Record<EmpresaRole, string> = {
  owner: 'Acesso total — inclui deletar empresa e gerenciar membros.',
  editor: 'Cria e edita posts, aprova, publica e conecta redes.',
  approver: 'Aprova e publica posts. Não cria nem edita.',
  creator: 'Cria posts e edita os próprios. Não aprova nem publica.',
};

export type RbacAction =
  | 'post.create'
  | 'post.edit.any'
  | 'post.edit.own'
  | 'post.approve'
  | 'post.publish'
  | 'connection.manage'
  | 'empresa.edit'
  | 'empresa.delete'
  | 'empresa.restore'
  | 'empresa.transfer'
  | 'member.invite'
  | 'member.manage';

const ACTION_MIN_ROLE: Record<RbacAction, EmpresaRole> = {
  'post.create': 'creator',
  'post.edit.any': 'editor',
  'post.edit.own': 'creator',
  'post.approve': 'approver',
  'post.publish': 'approver',
  'connection.manage': 'editor',
  'empresa.edit': 'editor',
  'empresa.delete': 'owner',
  'empresa.restore': 'owner',
  'empresa.transfer': 'owner',
  'member.invite': 'owner',
  'member.manage': 'owner',
};

// Exceções: approver NÃO cria/edita posts (papel puro de revisor).
const ACTION_EXCLUDE_ROLES: Partial<Record<RbacAction, EmpresaRole[]>> = {
  'post.create': ['approver'],
  'post.edit.own': ['approver'],
};

export function hasRole(userRole: EmpresaRole | null | undefined, minRole: EmpresaRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

export function canDoAction(userRole: EmpresaRole | null | undefined, action: RbacAction): boolean {
  if (!userRole) return false;
  const excluded = ACTION_EXCLUDE_ROLES[action];
  if (excluded?.includes(userRole)) return false;
  return hasRole(userRole, ACTION_MIN_ROLE[action]);
}

// DTOs

export interface EmpresaMember {
  empresa_id: string;
  user_id: string;
  role: EmpresaRole;
  invited_by: string | null;
  joined_at: string;
  updated_at: string;
}

export interface EmpresaMemberWithProfile extends EmpresaMember {
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface EmpresaInvite {
  id: string;
  empresa_id: string;
  email: string;
  role: EmpresaRole;
  token: string;
  invited_by: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

export interface EmpresaInviteWithEmpresa extends EmpresaInvite {
  empresa_nome: string;
  empresa_logo_url: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}
