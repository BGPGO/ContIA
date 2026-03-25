"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Sparkles,
  BarChart3,
  CalendarDays,
  Users,
  Newspaper,
  Brain,
  Settings,
  ChevronDown,
  Check,
  LogOut,
  Plus,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useUser } from "@/hooks/useUser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { EmpresaWizard } from "@/components/empresas/EmpresaWizard";
import type { Empresa } from "@/types";

const navLinks = [
  { label: "Gestor de Redes", href: "/dashboard", icon: LayoutDashboard },
  { label: "Criação", href: "/criacao", icon: Sparkles },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Calendário", href: "/calendario", icon: CalendarDays },
  { label: "Concorrentes", href: "/concorrentes", icon: Users },
  { label: "Notícias", href: "/noticias", icon: Newspaper },
  { label: "Relatório", href: "/relatorio", icon: Brain },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { empresa, empresas, setEmpresaId } = useEmpresa();
  const { user, signOut } = useUser();
  const supabaseConfigured = isSupabaseConfigured();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleWizardCreated = (empresa: Empresa) => {
    // EmpresaProvider already updates the list and selects the new empresa
    // via createEmpresa. Just close the wizard.
    setShowWizard(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [dropdownOpen]);

  return (
    <>
      {/* Sidebar — SOLID background, no transparency */}
      <aside className="hidden md:flex flex-col w-[240px] min-h-screen shrink-0 border-r border-border bg-[#0c0f24] relative z-30">
        {/* Brand */}
        <div className="px-5 h-14 flex items-center gap-2.5 border-b border-border">
          <div className="w-[26px] h-[26px] rounded-lg bg-gradient-to-br from-accent to-blue-500 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-text-primary">
            ContIA
          </span>
          <span className="ml-auto text-[10px] font-medium text-text-muted bg-bg-card px-1.5 py-0.5 rounded">
            AI
          </span>
        </div>

        {/* Empresa Selector */}
        <div className="px-3 py-3 border-b border-border relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg bg-bg-card border border-border hover:border-border-light hover:bg-bg-card-hover transition-all duration-200 group"
          >
            {empresa && (
              <span
                className="w-2 h-2 rounded-full shrink-0 ring-2 ring-transparent group-hover:ring-[#282d58] transition-all duration-200"
                style={{ backgroundColor: empresa.cor_primaria }}
              />
            )}
            <span className="flex-1 text-left text-[13px] text-text-primary truncate font-medium">
              {empresa?.nome ?? "Selecionar empresa"}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${
                dropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-[#141736] border border-border rounded-lg shadow-xl shadow-black/30 overflow-hidden py-1">
              {empresas.map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    setEmpresaId(e.id);
                    setDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-[7px] text-[13px] text-text-secondary hover:text-text-primary hover:bg-[#1a1e42] transition-colors duration-150"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: e.cor_primaria }}
                  />
                  <span className="flex-1 text-left truncate">{e.nome}</span>
                  {empresa?.id === e.id && (
                    <Check className="w-3 h-3 text-accent" />
                  )}
                </button>
              ))}

              {/* Divider */}
              <div className="my-1 mx-2 border-t border-border" />

              {/* Nova Empresa */}
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  setShowWizard(true);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-[7px] text-[13px] text-accent hover:bg-[#6c5ce714] transition-colors duration-150"
              >
                <Plus className="w-3 h-3" />
                Nova Empresa
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5">
          {navLinks.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                  active
                    ? "text-text-primary bg-[#6c5ce733]"
                    : "text-text-secondary hover:text-text-primary hover:bg-[#141736]"
                }`}
              >
                {/* Active indicator bar */}
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-accent" />
                )}
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? "text-accent-light" : ""
                  }`}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <p className="text-[11px] text-text-muted">
              Powered by AI
            </p>
            <span className="ml-auto text-[10px] text-text-muted/60">
              v0.1
            </span>
          </div>
          {supabaseConfigured && (
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center gap-2 px-2 h-7 rounded-lg text-[11px] text-text-muted hover:text-danger hover:bg-danger/10 transition-all duration-200 group"
              title="Sair"
            >
              <LogOut className="w-3 h-3 shrink-0" />
              <span className="flex-1 text-left truncate">
                {user?.email ?? "Sair"}
              </span>
            </button>
          )}
        </div>
      </aside>

      {/* Empresa creation wizard — rendered outside the aside so it overlays everything */}
      <EmpresaWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onCreated={handleWizardCreated}
      />
    </>
  );
}
