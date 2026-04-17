'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, ChevronRight } from 'lucide-react';
import type { EmpresaMemberWithProfile, EmpresaRole } from '@/types/rbac';
import { canDoAction, ROLE_LABELS } from '@/types/rbac';
import { RoleBadge } from './RoleBadge';

interface MemberRowProps {
  member: EmpresaMemberWithProfile;
  myRole: EmpresaRole;
  isMe: boolean;
  ownersCount: number;
  onChangeRole: (userId: string, role: EmpresaRole) => void;
  onRemove: (userId: string) => void;
}

const ASSIGNABLE_ROLES: EmpresaRole[] = ['creator', 'approver', 'editor'];

function getInitials(name: string | null, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
}

export function MemberRow({ member, myRole, isMe, ownersCount, onChangeRole, onRemove }: MemberRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [roleSubmenuOpen, setRoleSubmenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const canManage = canDoAction(myRole, 'member.manage');
  const displayName = member.display_name ?? member.email;
  const initials = getInitials(member.display_name, member.email);

  const isRemoveDisabled = isMe && member.role === 'owner' && ownersCount <= 1;

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setRoleSubmenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors duration-150">
      {/* Avatar */}
      <div className="shrink-0 w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-[#6c5ce7]/30 to-[#4ecdc4]/30 border border-[#1e2348] flex items-center justify-center">
        {member.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.avatar_url} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[11px] font-bold text-[#a29bfe]">{initials}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[13px] font-medium text-[#e8eaff] truncate">{displayName}</p>
          {isMe && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[#4ecdc4]/10 text-[#4ecdc4] rounded-md shrink-0">
              Você
            </span>
          )}
        </div>
        <p className="text-[11px] text-[#5e6388] truncate">{member.email}</p>
      </div>

      {/* Role badge */}
      <RoleBadge role={member.role} />

      {/* Actions menu */}
      {canManage && (
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => {
              setMenuOpen((o) => !o);
              setRoleSubmenuOpen(false);
            }}
            className="p-1.5 rounded-lg text-[#5e6388] hover:text-[#e8eaff] hover:bg-[#1a1e42] transition-colors duration-150"
          >
            <MoreHorizontal size={15} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-[#141736] border border-[#1e2348]/80 rounded-xl shadow-xl shadow-black/40 py-1 overflow-hidden">
              {/* Change role */}
              <div className="relative">
                <button
                  type="button"
                  onMouseEnter={() => setRoleSubmenuOpen(true)}
                  onMouseLeave={() => setRoleSubmenuOpen(false)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[12px] text-[#8b8fb0] hover:text-[#e8eaff] hover:bg-[#1a1e42] transition-colors duration-150"
                >
                  <span>Mudar papel</span>
                  <ChevronRight size={12} />
                </button>

                {roleSubmenuOpen && (
                  <div
                    onMouseEnter={() => setRoleSubmenuOpen(true)}
                    onMouseLeave={() => setRoleSubmenuOpen(false)}
                    className="absolute right-full top-0 mr-1 w-40 bg-[#141736] border border-[#1e2348]/80 rounded-xl shadow-xl shadow-black/40 py-1"
                  >
                    {ASSIGNABLE_ROLES.map((role) => (
                      <button
                        key={role}
                        type="button"
                        disabled={member.role === role}
                        onClick={() => {
                          onChangeRole(member.user_id, role);
                          setMenuOpen(false);
                          setRoleSubmenuOpen(false);
                        }}
                        className="w-full flex items-center px-3 py-2 text-[12px] text-[#8b8fb0] hover:text-[#e8eaff] hover:bg-[#1a1e42] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                      >
                        {ROLE_LABELS[role]}
                        {member.role === role && (
                          <span className="ml-auto text-[#4ecdc4] text-[10px]">atual</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="my-1 mx-2 border-t border-[#1e2348]" />

              {/* Remove */}
              <button
                type="button"
                disabled={isRemoveDisabled}
                onClick={() => {
                  onRemove(member.user_id);
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-[12px] text-left text-[#f87171]/70 hover:text-[#f87171] hover:bg-[#f87171]/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                title={isRemoveDisabled ? 'Não é possível remover o único dono' : undefined}
              >
                Remover membro
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
